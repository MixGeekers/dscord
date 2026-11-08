import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createCentral, centralOptions, loadConfig } from '../central/service.mjs';
import { usernameRule } from '../central/rules.mjs';
import { verifyIdentityToken } from '../central/tokens.mjs';

const CHAT_A = 'https://chat-a.example.org';
const CHAT_B = 'https://chat-b.example.org';

async function fixture(t, config = {}, { pages = new Map(), refreshIntervalMs = 0 } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dscord-central-'));
  let clock = Date.parse('2026-11-08T12:00:00Z');
  const fetched = [];
  // Chat servers' public pages, by URL; a function value is called on each read.
  const fakeFetch = async (url, init) => {
    fetched.push({ url: String(url), redirect: init?.redirect });
    const page = pages.get(String(url));
    if (page === undefined) throw new TypeError('fetch failed');
    const value = typeof page === 'function' ? page() : page;
    if (value instanceof Response) return value;
    return Response.json(value);
  };
  const central = await createCentral({ dataRoot: root, now: () => clock, fetch: fakeFetch, refreshIntervalMs,
    config: { issuer: 'https://id.example.org', ...config } });
  await new Promise(resolve => central.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${central.server.address().port}`;
  t.after(async () => { await central.close(); await rm(root, { recursive: true, force: true }); });
  const call = async (method, pathname, { token, body } = {}) => {
    const response = await fetch(base + pathname, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, headers: response.headers, body: await response.json() };
  };
  const register = async (username, extra = {}) => {
    const result = await call('POST', '/api/register', { body: { username, password: 'correct horse', ...extra } });
    assert.equal(result.status, 201, JSON.stringify(result.body));
    return result.body;
  };
  return { central, root, call, register, pages, fetched, advance: ms => { clock += ms; } };
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

test('first start seeds the saved configuration from the environment and the file wins afterwards', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dscord-central-config-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(loadConfig(root, {}), { code: 'ENOENT' });
  const env = { DSCORD_CENTRAL_ISSUER: 'https://id.example.org', DSCORD_CENTRAL_REGISTRATION: 'closed',
    DSCORD_CENTRAL_CLIENT_ORIGINS: 'https://chat-a.example.org, https://chat-b.example.org' };
  const seeded = await loadConfig(root, env);
  assert.deepEqual(seeded, { issuer: 'https://id.example.org', registration: 'closed',
    clientOrigins: ['https://chat-a.example.org', 'https://chat-b.example.org'] });
  const filename = path.join(root, 'central-config.json');
  assert.deepEqual(JSON.parse(await readFile(filename, 'utf8')), seeded);
  if (process.platform !== 'win32') assert.equal((await stat(filename)).mode & 0o777, 0o600);
  assert.deepEqual(await loadConfig(root, { ...env, DSCORD_CENTRAL_REGISTRATION: 'open' }), seeded);
  await assert.rejects(loadConfig(await mkdtemp(path.join(root, 'bad-')), { DSCORD_CENTRAL_ISSUER: 'ftp://id.example.org' }));
});


const serverPage = (origin, challenge, extra = {}) => ({ schemaVersion: 1, central: 'https://id.example.org', origin, challenge, listed: true,
  name: 'Chat A', description: 'A place for robotics', tags: ['Robotics', 'hardware'], join: 'central-account',
  members: { people: 12, bots: 3 }, ...extra });

test('a person lists a chat server by publishing its challenge on the server origin; the index reads the page from there', async t => {
  const { call, register, pages, fetched } = await fixture(t);
  const alice = await register('alice');
  const bob = await register('bob');
  const enc = encodeURIComponent(CHAT_A);
  assert.equal((await call('POST', '/api/servers', { token: alice.token, body: { origin: `${CHAT_A}/path` } })).body.code, 'SERVER_ORIGIN_INVALID');
  const claim = (await call('POST', '/api/servers', { token: alice.token, body: { origin: CHAT_A } })).body;
  assert.match(claim.challenge, /^dscord-server-/);
  assert.equal(claim.page, `${CHAT_A}/.well-known/dscord/server`);
  assert.equal((await call('POST', '/api/servers', { token: alice.token, body: { origin: CHAT_A } })).body.challenge, claim.challenge, 'a claim keeps its challenge');

  assert.equal((await call('POST', `/api/servers/${enc}/verify`, { token: alice.token })).body.code, 'SERVER_UNREACHABLE');
  pages.set(claim.page, new Response('{}', { status: 404 }));
  assert.equal((await call('POST', `/api/servers/${enc}/verify`, { token: alice.token })).body.code, 'SERVER_PAGE_MISSING');
  pages.set(claim.page, serverPage(CHAT_A, claim.challenge, { central: 'https://other.example.org' }));
  assert.equal((await call('POST', `/api/servers/${enc}/verify`, { token: alice.token })).body.code, 'CENTRAL_MISMATCH');
  pages.set(claim.page, serverPage(CHAT_A, 'something else'));
  assert.equal((await call('POST', `/api/servers/${enc}/verify`, { token: alice.token })).body.code, 'CHALLENGE_MISMATCH');
  pages.set(claim.page, serverPage(CHAT_B, claim.challenge));
  assert.equal((await call('POST', `/api/servers/${enc}/verify`, { token: alice.token })).body.code, 'SERVER_PAGE_INVALID');
  assert.equal((await call('POST', `/api/servers/${enc}/verify`, { token: bob.token })).body.code, 'CLAIM_REQUIRED');

  pages.set(claim.page, serverPage(CHAT_A, claim.challenge));
  const verified = await call('POST', `/api/servers/${enc}/verify`, { token: alice.token });
  assert.equal(verified.status, 200, JSON.stringify(verified.body));
  assert.deepEqual([verified.body.server.name, verified.body.server.tags, verified.body.server.members], ['Chat A', ['robotics', 'hardware'], { people: 12, bots: 3 }]);
  assert.ok(fetched.every(entry => entry.redirect === 'error'), 'the index never follows a redirect away from the origin');

  const found = (await call('GET', '/api/servers?q=ROBOT')).body.servers;
  assert.deepEqual(found.map(server => [server.origin, server.owner, server.join]), [[CHAT_A, 'alice@id.example.org', 'central-account']]);
  assert.equal(found[0].challenge, undefined, 'search never shows the challenge');
  assert.deepEqual((await call('GET', '/api/servers?q=robotics+gardening')).body.servers, [], 'every word must match');
  assert.equal((await call('GET', '/api/servers?tag=hardware')).body.servers.length, 1);
  assert.deepEqual((await call('GET', '/api/servers/mine', { token: alice.token })).body.servers.map(server => [server.origin, server.verified]), [[CHAT_A, true]]);
  assert.equal((await call('POST', `/api/servers/${enc}/refresh`, { token: bob.token })).body.code, 'SERVER_NOT_FOUND', 'only the owner refreshes');

  // Whoever proves control of the origin later takes the listing over.
  const bobClaim = (await call('POST', '/api/servers', { token: bob.token, body: { origin: CHAT_A } })).body;
  assert.deepEqual((await call('GET', '/api/servers/mine', { token: bob.token })).body.servers.map(server => server.verified), [false]);
  pages.set(claim.page, serverPage(CHAT_A, bobClaim.challenge));
  assert.equal((await call('POST', `/api/servers/${enc}/verify`, { token: bob.token })).status, 200);
  assert.equal((await call('GET', '/api/servers')).body.servers[0].owner, 'bob@id.example.org');
  assert.deepEqual((await call('GET', '/api/servers/mine', { token: alice.token })).body.servers.map(server => server.verified), [false]);
  assert.equal((await call('DELETE', `/api/servers/${enc}`, { token: bob.token })).status, 200);
  assert.deepEqual((await call('GET', '/api/servers')).body.servers, []);
});

test('the index keeps reading listed servers; unlisted, changed or silent servers drop out of search', async t => {
  const { call, register, pages, central, advance } = await fixture(t);
  const alice = await register('alice');
  const claim = (await call('POST', '/api/servers', { token: alice.token, body: { origin: CHAT_A } })).body;
  let page = serverPage(CHAT_A, claim.challenge);
  pages.set(claim.page, () => page);
  await call('POST', `/api/servers/${encodeURIComponent(CHAT_A)}/verify`, { token: alice.token });
  assert.equal((await call('GET', '/api/servers')).body.servers.length, 1);

  page = { ...page, name: 'Chat A renamed', listed: false };
  await central.directory.refreshAll();
  assert.deepEqual((await call('GET', '/api/servers')).body.servers, [], 'an operator can hide a server from its own admin page');
  page = { ...page, listed: true };
  await central.directory.refreshAll();
  assert.equal((await call('GET', '/api/servers')).body.servers[0].name, 'Chat A renamed');

  // A page that stops showing the owner's challenge keeps the last listing until it goes stale.
  page = { ...page, challenge: 'someone else', name: 'Hijacked' };
  await central.directory.refreshAll();
  const mine = (await call('GET', '/api/servers/mine', { token: alice.token })).body.servers[0];
  assert.deepEqual([mine.name, mine.lastError], ['Chat A renamed', 'CHALLENGE_MISMATCH']);
  advance(3 * 24 * 60 * 60 * 1000 + 1);
  assert.deepEqual((await call('GET', '/api/servers')).body.servers, []);

  page = { ...page, challenge: claim.challenge, name: 'Chat A' };
  const refreshed = await call('POST', `/api/servers/${encodeURIComponent(CHAT_A)}/refresh`, { token: alice.token });
  assert.equal(refreshed.body.server.lastError, null);
  assert.equal((await call('GET', '/api/servers')).body.servers[0].name, 'Chat A');

  // Closing the account takes its listings with it.
  assert.equal((await call('DELETE', '/api/me', { token: alice.token })).status, 200);
  assert.deepEqual((await call('GET', '/api/servers')).body.servers, []);
});

test('search ranks by people, caps results and is open to any web page', async t => {
  const { call, register, pages } = await fixture(t, { serverFetchUrls: { [CHAT_B]: 'http://chat-b.internal:8080' } });
  const alice = await register('alice');
  for (const [origin, base, people] of [[CHAT_A, CHAT_A, 3], [CHAT_B, 'http://chat-b.internal:8080', 40]]) {
    const claim = (await call('POST', '/api/servers', { token: alice.token, body: { origin } })).body;
    pages.set(`${base}/.well-known/dscord/server`, serverPage(origin, claim.challenge, { name: origin, members: { people, bots: 0 } }));
    assert.equal((await call('POST', `/api/servers/${encodeURIComponent(origin)}/verify`, { token: alice.token })).status, 200);
  }
  const all = await call('GET', '/api/servers');
  assert.deepEqual(all.body.servers.map(server => server.origin), [CHAT_B, CHAT_A]);
  assert.equal(all.headers.get('access-control-allow-origin'), '*');
  assert.equal((await call('GET', '/api/servers/mine', { token: alice.token })).headers.get('access-control-allow-origin'), null);
  assert.deepEqual((await call('GET', '/api/servers?limit=1')).body.servers.map(server => server.origin), [CHAT_B]);
  assert.equal((await call('GET', '/.well-known/dscord/central')).body.serverIndexUri, 'https://id.example.org/api/servers');
});
