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

test('a person makes a one-time connection code for their DSH, which redeems it once for their own session', async t => {
  const { call, register, advance } = await fixture(t);
  const alice = await register('alice');
  assert.equal((await call('POST', '/api/connect-codes', { body: {} })).status, 401);
  const bot = (await call('POST', '/api/bots', { token: alice.token, body: { username: 'helper' } })).body.bot;
  const device = (await call('POST', '/api/device', { body: {} })).body;
  await call('POST', '/api/device/approve', { token: alice.token, body: { userCode: device.userCode, botId: bot.id } });
  const botToken = (await call('POST', '/api/device/token', { body: { deviceCode: device.deviceCode } })).body.token;
  assert.equal((await call('POST', '/api/connect-codes', { token: botToken, body: {} })).body.code, 'HUMAN_REQUIRED');

  const made = await call('POST', '/api/connect-codes', { token: alice.token, body: {} });
  assert.equal(made.status, 201);
  assert.equal(made.body.expiresIn, 600);
  const redeemed = await call('POST', '/api/connect-codes/redeem', { body: { code: made.body.code, label: 'DSH laptop' } });
  assert.equal(redeemed.status, 200);
  assert.equal(redeemed.body.account.globalId, alice.account.globalId);
  assert.notEqual(redeemed.body.token, alice.token, 'DSH gets a session of its own');
  assert.equal((await call('GET', '/api/me', { token: redeemed.body.token })).body.account.username, 'alice');
  assert.equal((await call('POST', '/api/connect-codes/redeem', { body: { code: made.body.code } })).body.code, 'CONNECT_CODE_UNKNOWN', 'a code is redeemed once');
  assert.equal((await call('POST', '/api/connect-codes/redeem', { body: {} })).body.code, 'CONNECT_CODE_UNKNOWN');

  const late = (await call('POST', '/api/connect-codes', { token: alice.token, body: {} })).body;
  advance(10 * 60_000 + 1);
  assert.equal((await call('POST', '/api/connect-codes/redeem', { body: { code: late.code } })).body.code, 'CONNECT_CODE_EXPIRED');
});

test('first start seeds the saved configuration from the environment and the file wins afterwards', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dscord-central-config-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(loadConfig(root, {}), { code: 'ENOENT' });
  const env = { DSCORD_CENTRAL_ISSUER: 'https://id.example.org', DSCORD_CENTRAL_REGISTRATION: 'closed',
    DSCORD_CENTRAL_CLIENT_ORIGINS: 'https://chat-a.example.org, https://chat-b.example.org' };
  const seeded = await loadConfig(root, env);
  assert.deepEqual(seeded, { issuer: 'https://id.example.org', registration: 'closed', listing: 'review', admins: [],
    clientOrigins: ['https://chat-a.example.org', 'https://chat-b.example.org'] });
  const filename = path.join(root, 'central-config.json');
  assert.deepEqual(JSON.parse(await readFile(filename, 'utf8')), seeded);
  if (process.platform !== 'win32') assert.equal((await stat(filename)).mode & 0o777, 0o600);
  assert.deepEqual(await loadConfig(root, { ...env, DSCORD_CENTRAL_REGISTRATION: 'open' }), seeded);
  await assert.rejects(loadConfig(await mkdtemp(path.join(root, 'bad-')), { DSCORD_CENTRAL_ISSUER: 'ftp://id.example.org' }));
  const mapped = await loadConfig(await mkdtemp(path.join(root, 'fetch-')), { DSCORD_CENTRAL_ISSUER: 'https://id.example.org',
    DSCORD_CENTRAL_SERVER_FETCH_URLS: 'https://chat-a.example.org=http://core:18100' });
  assert.deepEqual(mapped.serverFetchUrls, { 'https://chat-a.example.org': 'http://core:18100' });
});


const PAGE_A = `${CHAT_A}/.well-known/dscord/server`;
const serverPage = (origin, extra = {}) => ({ schemaVersion: 1, central: 'https://id.example.org', origin, discovery: 'public',
  name: 'Chat A', description: 'A place for robotics', tags: ['Robotics', 'hardware'], join: 'open',
  members: { people: 12, bots: 3 }, ...extra });

test('a chat server submits itself by origin, with no account; the index reads its page from there and waits for review', async t => {
  const { call, register, pages, fetched } = await fixture(t, { admins: ['carol'] });
  const root = await register('carol');
  const alice = await register('alice');
  const submit = origin => call('POST', '/api/servers', { body: { origin } });
  assert.equal((await submit(`${CHAT_A}/path`)).body.code, 'SERVER_ORIGIN_INVALID');
  assert.equal((await submit(CHAT_A)).body.code, 'SERVER_UNREACHABLE');
  pages.set(PAGE_A, new Response('{}', { status: 404 }));
  assert.equal((await submit(CHAT_A)).body.code, 'SERVER_PAGE_MISSING');
  pages.set(PAGE_A, serverPage(CHAT_A, { central: 'https://other.example.org' }));
  assert.equal((await submit(CHAT_A)).body.code, 'CENTRAL_MISMATCH');
  pages.set(PAGE_A, serverPage(CHAT_B));
  assert.equal((await submit(CHAT_A)).body.code, 'SERVER_PAGE_INVALID');

  pages.set(PAGE_A, serverPage(CHAT_A));
  const submitted = await submit(CHAT_A);
  assert.equal(submitted.status, 200, JSON.stringify(submitted.body));
  const { number } = submitted.body.server;
  assert.match(String(number), /^\d{8}$/, 'central gives each server an eight-digit number');
  assert.deepEqual(submitted.body.server, { origin: CHAT_A, number, status: 'pending', note: '', discovery: 'public' });
  assert.ok(fetched.every(entry => entry.redirect === 'error'), 'the index never follows a redirect away from the origin');
  assert.deepEqual((await call('GET', '/api/servers?q=robot')).body.servers, [], 'a pending server is not searchable');
  assert.deepEqual((await call('GET', `/api/servers?q=${number}`)).body.servers, [], 'not even by number');

  // Only the configured administrators see and decide.
  assert.equal((await call('GET', '/api/admin/servers', { token: alice.token })).body.code, 'ADMIN_REQUIRED');
  assert.equal((await call('GET', '/api/admin/servers')).status, 401);
  const overview = (await call('GET', '/api/admin/overview', { token: root.token })).body;
  assert.deepEqual([overview.settings, overview.servers.pending, overview.accounts.people], [{ registration: 'open', listing: 'review' }, 1, 2]);
  const queue = (await call('GET', '/api/admin/servers?status=pending', { token: root.token })).body.servers;
  assert.deepEqual(queue.map(server => [server.origin, server.name, server.tags, server.members.people]), [[CHAT_A, 'Chat A', ['robotics', 'hardware'], 12]]);
  const enc = encodeURIComponent(CHAT_A);
  const decide = (status, note) => call('POST', `/api/admin/servers/${enc}/decision`, { token: root.token, body: { status, note } });
  assert.equal((await decide('pending')).body.code, 'LISTING_STATUS_INVALID');
  assert.equal((await decide('listed')).body.server.status, 'listed');

  const found = (await call('GET', '/api/servers?q=ROBOT')).body.servers;
  assert.deepEqual(found.map(server => [server.origin, server.number, server.join]), [[CHAT_A, number, 'open']]);
  assert.equal(found[0].status, undefined, 'search shows listed servers without their review state');
  assert.deepEqual((await call('GET', '/api/servers?q=robotics+gardening')).body.servers, [], 'every word must match');
  assert.equal((await call('GET', '/api/servers?tag=hardware')).body.servers.length, 1);
  assert.equal((await submit(CHAT_A)).body.server.status, 'listed', 'submitting again re-reads the page and keeps the decision');

  // A rejected server may ask again; a banned one may not.
  assert.equal((await decide('rejected', 'Add a description of the rules')).body.server.note, 'Add a description of the rules');
  assert.deepEqual((await call('GET', '/api/servers')).body.servers, []);
  const again = (await submit(CHAT_A)).body.server;
  assert.deepEqual([again.status, again.number, again.note], ['pending', number, 'Add a description of the rules']);
  await decide('banned');
  assert.equal((await submit(CHAT_A)).body.code, 'SERVER_BANNED');
  assert.equal((await decide('listed')).body.server.status, 'listed', 'lifting a ban lists the server again');

  assert.equal((await call('DELETE', `/api/admin/servers/${enc}`, { token: root.token })).status, 200);
  assert.deepEqual((await call('GET', '/api/admin/servers', { token: root.token })).body.servers, []);
  assert.notEqual((await submit(CHAT_A)).body.server.status, undefined, 'a removed server can submit again');
});

test('administrators can list new servers at once and close registration; settings outlive the configuration', async t => {
  const { call, register, pages } = await fixture(t, { admins: ['carol'] });
  const root = await register('carol');
  assert.equal((await call('POST', '/api/admin/settings', { token: root.token, body: { listing: 'later' } })).body.code, 'LISTING_INVALID');
  const saved = await call('POST', '/api/admin/settings', { token: root.token, body: { listing: 'open', registration: 'closed' } });
  assert.deepEqual(saved.body.settings, { registration: 'closed', listing: 'open' });
  assert.equal((await call('GET', '/.well-known/dscord/central')).body.registration, 'closed');
  assert.equal((await call('POST', '/api/register', { body: { username: 'late', password: 'correct horse' } })).body.code, 'REGISTRATION_CLOSED');
  pages.set(PAGE_A, serverPage(CHAT_A));
  assert.equal((await call('POST', '/api/servers', { body: { origin: CHAT_A } })).body.server.status, 'listed');
  assert.equal((await call('GET', '/api/servers')).body.servers.length, 1);
});

test('administrators disable and restore accounts, but not their own', async t => {
  const { call, register } = await fixture(t, { admins: ['carol'] });
  const root = await register('carol');
  const alice = await register('alice', { displayName: '爱丽丝' });
  await call('POST', '/api/bots', { token: alice.token, body: { username: 'helper' } });
  const listed = (await call('GET', '/api/admin/accounts?q=%E7%88%B1', { token: root.token })).body.accounts;
  assert.deepEqual(listed.map(account => [account.username, account.status, account.servers]), [['alice', 'active', 0]]);
  assert.deepEqual((await call('GET', '/api/admin/accounts?kind=bot', { token: root.token })).body.accounts.map(account => [account.username, account.owner]),
    [['helper', 'alice@id.example.org']]);
  const id = listed[0].id;
  assert.equal((await call('POST', `/api/admin/accounts/${listed[0].id}/disable`, { token: root.token })).body.account.status, 'disabled');
  assert.equal((await call('GET', '/api/me', { token: alice.token })).status, 401, 'disabling ends the sessions');
  assert.equal((await call('POST', '/api/login', { body: { username: 'alice', password: 'correct horse' } })).body.code, 'ACCOUNT_DISABLED');
  assert.equal((await call('GET', '/api/admin/overview', { token: root.token })).body.accounts.disabled, 1);
  assert.equal((await call('POST', `/api/admin/accounts/${id}/enable`, { token: root.token })).body.account.status, 'active');
  assert.equal((await call('POST', '/api/login', { body: { username: 'alice', password: 'correct horse' } })).status, 200);
  const rootId = (await call('GET', '/api/admin/accounts?q=carol', { token: root.token })).body.accounts[0].id;
  assert.equal((await call('POST', `/api/admin/accounts/${rootId}/disable`, { token: root.token })).body.code, 'ADMIN_SELF');
});

test('the index keeps reading servers; hidden or silent servers drop out of search', async t => {
  const { call, register, pages, central, advance } = await fixture(t, { listing: 'open' });
  let page = serverPage(CHAT_A);
  pages.set(PAGE_A, () => page);
  const { number } = (await call('POST', '/api/servers', { body: { origin: CHAT_A } })).body.server;
  assert.equal((await call('GET', '/api/servers')).body.servers.length, 1);

  page = { ...page, name: 'Chat A renamed', discovery: 'number' };
  await central.directory.refreshAll();
  assert.deepEqual((await call('GET', '/api/servers?q=chat')).body.servers, [], 'a server found only by number stays out of keyword search');
  assert.deepEqual((await call('GET', `/api/servers?q=${number}`)).body.servers.map(server => server.name), ['Chat A renamed']);
  assert.deepEqual((await call('GET', `/api/servers?q=${number === 99999999 ? 10000000 : number + 1}`)).body.servers, [], 'a number matches exactly');
  page = { ...page, discovery: 'hidden' };
  await central.directory.refreshAll();
  assert.deepEqual((await call('GET', `/api/servers?q=${number}`)).body.servers, [], 'a hidden server cannot be found even by number');
  page = { ...page, discovery: 'public' };
  await central.directory.refreshAll();
  assert.equal((await call('GET', '/api/servers')).body.servers[0].name, 'Chat A renamed');

  // A page that can no longer be read keeps the last listing until it goes stale.
  pages.set(PAGE_A, new Response('{}', { status: 404 }));
  await central.directory.refreshAll();
  const kept = central.directory.adminView(central.directory.server(CHAT_A));
  assert.deepEqual([kept.name, kept.lastError], ['Chat A renamed', 'SERVER_PAGE_MISSING']);
  advance(3 * 24 * 60 * 60 * 1000 + 1);
  assert.deepEqual((await call('GET', '/api/servers')).body.servers, []);
  pages.set(PAGE_A, () => page);
  page = { ...page, name: 'Chat A' };
  await call('POST', '/api/servers', { body: { origin: CHAT_A } });
  assert.equal((await call('GET', '/api/servers')).body.servers[0].name, 'Chat A');
  await register('alice');
});

test('search ranks by people, caps results and is open to any web page', async t => {
  const { call, pages } = await fixture(t, { listing: 'open', serverFetchUrls: { [CHAT_B]: 'http://chat-b.internal:8080' } });
  for (const [origin, base, people] of [[CHAT_A, CHAT_A, 3], [CHAT_B, 'http://chat-b.internal:8080', 40]]) {
    pages.set(`${base}/.well-known/dscord/server`, serverPage(origin, { name: origin, members: { people, bots: 0 } }));
    assert.equal((await call('POST', '/api/servers', { body: { origin } })).status, 200);
  }
  const all = await call('GET', '/api/servers');
  assert.deepEqual(all.body.servers.map(server => server.origin), [CHAT_B, CHAT_A]);
  assert.equal(all.headers.get('access-control-allow-origin'), '*');
  assert.deepEqual((await call('GET', '/api/servers?limit=1')).body.servers.map(server => server.origin), [CHAT_B]);
  assert.equal((await call('GET', '/.well-known/dscord/central')).body.serverIndexUri, 'https://id.example.org/api/servers');
});

test('the central server serves its administration panel at /admin', async t => {
  const web = await mkdtemp(path.join(os.tmpdir(), 'dscord-central-admin-'));
  t.after(() => rm(web, { recursive: true, force: true }));
  const { writeFile, mkdir } = await import('node:fs/promises');
  await mkdir(path.join(web, 'assets'));
  await writeFile(path.join(web, 'index.html'), '<!doctype html><title>panel</title>');
  await writeFile(path.join(web, 'assets', 'app.js'), 'export {}');
  const root = await mkdtemp(path.join(os.tmpdir(), 'dscord-central-'));
  const central = await createCentral({ dataRoot: root, refreshIntervalMs: 0, adminWebRoot: web, config: { issuer: 'https://id.example.org' } });
  await new Promise(resolve => central.server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await central.close(); await rm(root, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${central.server.address().port}`;
  for (const route of ['/admin', '/admin/', '/admin/servers']) {
    const response = await fetch(base + route);
    assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8', route);
    assert.match(await response.text(), /panel/);
  }
  const script = await fetch(`${base}/admin/assets/app.js`);
  assert.equal(script.headers.get('content-type'), 'text/javascript; charset=utf-8');
  assert.equal((await fetch(`${base}/admin/assets/missing.js`)).status, 404);
  assert.equal((await fetch(`${base}/admin/..%2f..%2fcentral.sqlite`)).status, 404);
});
