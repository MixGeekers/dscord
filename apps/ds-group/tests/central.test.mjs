import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createCentral, centralOptions } from '../central/service.mjs';
import { usernameRule } from '../central/rules.mjs';
import { verifyIdentityToken } from '../central/tokens.mjs';

const CHAT_A = 'https://chat-a.example.org';
const CHAT_B = 'https://chat-b.example.org';

async function fixture(t, config = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dscord-central-'));
  let clock = Date.parse('2026-11-08T12:00:00Z');
  const central = await createCentral({ dataRoot: root, now: () => clock,
    config: { issuer: 'https://id.example.org', ...config } });
  await new Promise(resolve => central.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${central.server.address().port}`;
  t.after(async () => { await central.close(); await rm(root, { recursive: true, force: true }); });
  const call = async (method, pathname, { token, body } = {}) => {
    const response = await fetch(base + pathname, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, body: await response.json() };
  };
  const register = async (username, extra = {}) => {
    const result = await call('POST', '/api/register', { body: { username, password: 'correct horse', ...extra } });
    assert.equal(result.status, 201, JSON.stringify(result.body));
    return result.body;
  };
  return { central, root, call, register, advance: ms => { clock += ms; } };
}

test('the central server publishes its account rule and keys, and the rule only narrows Matrix localparts', async t => {
  const { call, root } = await fixture(t, { usernameRule: { minLength: 4, reserved: ['ops'] } });
  const { body } = await call('GET', '/.well-known/dscord/central');
  assert.equal(body.issuer, 'https://id.example.org');
  assert.equal(body.globalIdFormat, '{username}@id.example.org');
  assert.deepEqual(body.usernameRule, { pattern: '^[a-z][a-z0-9._-]*$', minLength: 4, maxLength: 32, reserved: ['ops'],
    charset: '^[a-z0-9._=\\-/]+$', caseInsensitive: true, immutable: true });
  const jwks = (await call('GET', '/.well-known/jwks.json')).body;
  assert.equal(jwks.keys.length, 1);
  assert.equal(jwks.keys[0].d, undefined, 'the private key is never published');
  assert.equal((await stat(path.join(root, 'signing-key.json'))).mode & 0o777, 0o600);

  // A permissive pattern still cannot let characters Matrix refuses into a username.
  const loose = usernameRule({ pattern: '^.+$' });
  assert.deepEqual(loose.check('Alice'), { username: 'alice' });
  assert.equal(loose.check('alice smith').error, 'USERNAME_CHARACTERS');
  assert.equal(loose.check('爱丽丝').error, 'USERNAME_CHARACTERS');
  assert.throws(() => usernameRule({ pattern: 'a+' }), /anchored/);
  assert.throws(() => usernameRule({ maxLength: 65 }), /maxLength/);
  assert.throws(() => centralOptions({ issuer: 'http://id.example.org' }), /HTTPS/);
  assert.throws(() => centralOptions({ issuer: 'https://id.example.org/path' }), /bare origin/);
});

test('people register under the central rule; usernames are case-insensitive, unique and never reused', async t => {
  const { call, register } = await fixture(t);
  const alice = await register('Alice', { displayName: '爱丽丝' });
  assert.deepEqual({ ...alice.account, id: undefined, createdAt: undefined },
    { id: undefined, username: 'alice', globalId: 'alice@id.example.org', kind: 'human', displayName: '爱丽丝', status: 'active', createdAt: undefined });
  assert.equal((await call('POST', '/api/register', { body: { username: 'ALICE', password: 'another one' } })).body.code, 'USERNAME_TAKEN');
  assert.equal((await call('POST', '/api/register', { body: { username: 'admin', password: 'another one' } })).body.code, 'USERNAME_RESERVED');
  assert.equal((await call('POST', '/api/register', { body: { username: '1abc', password: 'another one' } })).body.code, 'USERNAME_CHARACTERS');
  assert.equal((await call('POST', '/api/register', { body: { username: 'bob', password: 'short' } })).body.code, 'PASSWORD_LENGTH');

  assert.equal((await call('POST', '/api/login', { body: { username: 'alice', password: 'wrong password' } })).status, 401);
  const login = await call('POST', '/api/login', { body: { username: ' ALICE ', password: 'correct horse' } });
  assert.equal(login.status, 200);
  assert.equal((await call('GET', '/api/me', { token: login.body.token })).body.account.username, 'alice');
  await call('POST', '/api/logout', { token: login.body.token });
  assert.equal((await call('GET', '/api/me', { token: login.body.token })).status, 401);

  assert.equal((await call('DELETE', '/api/me', { token: alice.token })).status, 200);
  assert.equal((await call('POST', '/api/login', { body: { username: 'alice', password: 'correct horse' } })).status, 401);
  assert.equal((await call('POST', '/api/register', { body: { username: 'alice', password: 'correct horse' } })).body.code, 'USERNAME_TAKEN');
});

test('registration can be closed by the central operator', async t => {
  const { call } = await fixture(t, { registration: 'closed' });
  assert.equal((await call('POST', '/api/register', { body: { username: 'alice', password: 'correct horse' } })).body.code, 'REGISTRATION_CLOSED');
});

test('an identity token is bound to one chat server, needs a first grant, and stops when the grant is revoked', async t => {
  const { call, register, central, advance } = await fixture(t);
  const { token } = await register('alice');
  const first = await call('POST', '/api/identity-tokens', { token, body: { audience: CHAT_A } });
  assert.equal(first.body.code, 'GRANT_REQUIRED');
  assert.equal((await call('POST', '/api/identity-tokens', { token, body: { audience: `${CHAT_A}/rooms`, allowNew: true } })).body.code, 'AUDIENCE_INVALID');
  assert.equal((await call('POST', '/api/identity-tokens', { token, body: { audience: 'http://chat-a.example.org', allowNew: true } })).body.code, 'AUDIENCE_INVALID');

  const issued = await call('POST', '/api/identity-tokens', { token, body: { audience: CHAT_A, allowNew: true } });
  assert.equal(issued.status, 200);
  const options = { jwks: central.jwks, issuer: 'https://id.example.org', now: Date.parse('2026-11-08T12:00:00Z') };
  const claims = verifyIdentityToken(issued.body.token, { ...options, audience: CHAT_A });
  assert.equal(claims.gid, 'alice@id.example.org');
  assert.equal(claims.username, 'alice');
  assert.equal(claims.kind, 'human');
  assert.equal(claims.exp - claims.iat, 300);
  assert.throws(() => verifyIdentityToken(issued.body.token, { ...options, audience: CHAT_B }), /IDENTITY_TOKEN_AUDIENCE/);
  assert.throws(() => verifyIdentityToken(issued.body.token, { ...options, audience: CHAT_A, issuer: 'https://other.example.org' }), /IDENTITY_TOKEN_ISSUER/);
  assert.throws(() => verifyIdentityToken(issued.body.token, { ...options, audience: CHAT_A, now: options.now + 301_000 }), /IDENTITY_TOKEN_EXPIRED/);
  const [header, body, signature] = issued.body.token.split('.');
  const forged = Buffer.from(JSON.stringify({ ...claims, gid: 'mallory@id.example.org' })).toString('base64url');
  assert.throws(() => verifyIdentityToken(`${header}.${forged}.${signature}`, { ...options, audience: CHAT_A }), /IDENTITY_TOKEN_SIGNATURE/);
  assert.ok(body);

  advance(60_000);
  assert.equal((await call('POST', '/api/identity-tokens', { token, body: { audience: CHAT_A } })).status, 200, 'a granted server needs no new confirmation');
  const grants = (await call('GET', '/api/grants', { token })).body.grants;
  assert.deepEqual(grants.map(grant => grant.audience), [CHAT_A]);
  assert.equal((await call('DELETE', `/api/grants/${encodeURIComponent(CHAT_A)}`, { token })).status, 200);
  assert.equal((await call('POST', '/api/identity-tokens', { token, body: { audience: CHAT_A } })).body.code, 'GRANT_REQUIRED');
});

test('a Bot is a central account with an owner; its node signs in by a device code the owner approves', async t => {
  const { call, register, central } = await fixture(t);
  const alice = await register('alice');
  const bob = await register('bob');
  const created = await call('POST', '/api/bots', { token: alice.token, body: { username: 'helper', displayName: '小助手' } });
  assert.equal(created.status, 201);
  const bot = created.body.bot;
  assert.equal(bot.kind, 'bot');
  assert.equal(bot.owner, 'alice@id.example.org');
  assert.equal(bot.globalId, 'helper@id.example.org');
  assert.equal((await call('POST', '/api/register', { body: { username: 'helper', password: 'correct horse' } })).body.code, 'USERNAME_TAKEN',
    'people and Bots share one namespace');
  assert.deepEqual((await call('GET', '/api/bots', { token: alice.token })).body.bots.map(item => item.username), ['helper']);
  assert.equal((await call('POST', '/api/login', { body: { username: 'helper', password: 'correct horse' } })).status, 401, 'a Bot has no password');

  const device = (await call('POST', '/api/device', { body: { label: 'Alice laptop' } })).body;
  assert.match(device.userCode, /^[A-Z]{4}-[A-Z]{4}$/);
  assert.equal((await call('POST', '/api/device/token', { body: { deviceCode: device.deviceCode } })).body.code, 'AUTHORIZATION_PENDING');
  assert.equal((await call('POST', '/api/device/approve', { token: bob.token, body: { userCode: device.userCode, botId: bot.id } })).body.code,
    'BOT_NOT_FOUND', 'only the owner approves a node for the Bot');
  assert.equal((await call('POST', '/api/device/approve', { token: alice.token, body: { userCode: device.userCode.toLowerCase(), botId: bot.id } })).status, 200);
  const redeemed = await call('POST', '/api/device/token', { body: { deviceCode: device.deviceCode } });
  assert.equal(redeemed.status, 200);
  assert.equal(redeemed.body.account.username, 'helper');
  assert.equal((await call('POST', '/api/device/token', { body: { deviceCode: device.deviceCode } })).status, 404, 'a device code is redeemed once');

  // The node signs in to chat servers exactly as a person does.
  const nodeToken = redeemed.body.token;
  const issued = await call('POST', '/api/identity-tokens', { token: nodeToken, body: { audience: CHAT_A, allowNew: true } });
  const claims = verifyIdentityToken(issued.body.token, { jwks: central.jwks, issuer: 'https://id.example.org', audience: CHAT_A,
    now: Date.parse('2026-11-08T12:00:00Z') });
  assert.deepEqual([claims.kind, claims.gid, claims.owner, claims.name], ['bot', 'helper@id.example.org', 'alice@id.example.org', '小助手']);
  assert.equal((await call('POST', '/api/bots', { token: nodeToken, body: { username: 'child' } })).body.code, 'HUMAN_REQUIRED');

  // The owner sees and revokes the Bot's grants and nodes.
  assert.deepEqual((await call('GET', `/api/bots/${bot.id}/grants`, { token: alice.token })).body.grants.map(grant => grant.audience), [CHAT_A]);
  const nodes = (await call('GET', `/api/bots/${bot.id}/nodes`, { token: alice.token })).body.nodes;
  assert.deepEqual(nodes.map(node => node.label), ['Alice laptop']);
  assert.equal((await call('DELETE', `/api/bots/${bot.id}/grants/${encodeURIComponent(CHAT_A)}`, { token: alice.token })).status, 200);
  assert.equal((await call('POST', '/api/identity-tokens', { token: nodeToken, body: { audience: CHAT_A } })).body.code, 'GRANT_REQUIRED');
  assert.equal((await call('DELETE', `/api/bots/${bot.id}/nodes/${nodes[0].id}`, { token: alice.token })).status, 200);
  assert.equal((await call('GET', '/api/me', { token: nodeToken })).status, 401);

  assert.equal((await call('DELETE', '/api/me', { token: alice.token })).body.code, 'OWNS_ACTIVE_BOTS');
  assert.equal((await call('DELETE', `/api/bots/${bot.id}`, { token: alice.token })).status, 200);
  assert.equal((await call('DELETE', '/api/me', { token: alice.token })).status, 200);
});

test('a device code expires after ten minutes', async t => {
  const { call, register, advance } = await fixture(t);
  const alice = await register('alice');
  const bot = (await call('POST', '/api/bots', { token: alice.token, body: { username: 'helper' } })).body.bot;
  const device = (await call('POST', '/api/device', { body: {} })).body;
  advance(10 * 60_000 + 1);
  assert.equal((await call('POST', '/api/device/approve', { token: alice.token, body: { userCode: device.userCode, botId: bot.id } })).body.code, 'DEVICE_CODE_UNKNOWN');
  assert.equal((await call('POST', '/api/device/token', { body: { deviceCode: device.deviceCode } })).body.code, 'DEVICE_CODE_EXPIRED');
});
