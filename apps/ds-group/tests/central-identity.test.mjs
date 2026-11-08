import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createCore } from '../src/core.mjs';
import { validateIdentityOptions } from '../src/identity.mjs';
import { MatrixClient } from '../src/matrix-client.mjs';
import { listen, startCentral, startMatrix, stop, writeServerMetadata } from './helpers/central.mjs';

const CORE_URL = 'https://chat.test';

// Seeded accounts with fixed tokens for the guard and CORS checks.
async function fixture(t, { extraParticipants = [] } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dscord-identity-'));
  const calls = [];
  const matrix = http.createServer((req, res) => {
    calls.push({ url: req.url, authorization: req.headers.authorization });
    req.resume();
    res.setHeader('Content-Type', 'application/json');
    if (req.headers.authorization === 'Bearer alice-client' || req.headers.authorization === 'Bearer alice-service') return res.end(JSON.stringify({ user_id: '@alice:home.test' }));
    const extra = extraParticipants.find(person => req.headers.authorization === `Bearer ${person.accessToken}`);
    if (extra) return res.end(JSON.stringify({ user_id: extra.id }));
    res.writeHead(401); res.end(JSON.stringify({ errcode: 'M_UNKNOWN_TOKEN', error: 'Expired or revoked' }));
  });
  const matrixUrl = await listen(matrix);
  const setup = { serverName: 'home.test', homeserverUrl: matrixUrl, publicHomeserverUrl: matrixUrl,
    roomId: null, participants: [{ id: '@alice:home.test', kind: 'human', localpart: 'alice', name: 'Alice', accessToken: 'alice-service' }, ...extraParticipants] };
  const config = { nodeSecret: 'private-node-secret', publicUrl: 'https://core.test', identity: { matrixUrl, clientOrigins: ['https://client.test'] } };
  const core = await createCore({ dataRoot: root, setup, config, enablePush: false });
  const base = await listen(core.server);
  t.after(async () => { await core.close(); await stop(matrix); await rm(root, { recursive: true, force: true }); });
  return { core, base, root, matrixUrl, calls };
}

// A chat server that trusts a real central server, over a Matrix stand-in that registers accounts.
async function chatServer(t) {
  const central = await startCentral(t);
  const matrix = await startMatrix(t, 'chat.test');
  const root = await mkdtemp(path.join(os.tmpdir(), 'dscord-chat-'));
  await writeServerMetadata(root, 'chat.test');
  const core = await createCore({ dataRoot: root, enablePush: false,
    setup: { serverName: 'chat.test', homeserverUrl: matrix.url, publicHomeserverUrl: matrix.url, roomId: null, participants: [] },
    config: { nodeSecret: 'chat-node-secret', publicUrl: CORE_URL, identity: { central: central.url } } });
  const base = await listen(core.server);
  t.after(async () => { await core.close(); await rm(root, { recursive: true, force: true }); });
  const post = async (route, body, token) => {
    const response = await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    return { status: response.status, value: await response.json() };
  };
  const signIn = async centralToken => post('/api/session', { identityToken: await central.identityToken(centralToken, CORE_URL) });
  return { central, matrix, core, base, post, signIn };
}

test('discovery names the trusted central server and this server as the token audience, with no secrets', async t => {
  const f = await chatServer(t);
  const response = await fetch(f.base + '/.well-known/dscord/client', { headers: { Origin: 'https://untrusted.test', Host: 'untrusted.test' } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  const value = await response.json();
  assert.deepEqual(value.central, { issuer: f.central.url });
  assert.equal(value.auth.audience, CORE_URL);
  assert.equal(value.auth.sessionPath, '/api/session');
  assert.equal(value.home.coreUrl, CORE_URL);
  assert.equal(JSON.stringify(value).includes('chat-node-secret'), false);
  assert.deepEqual(await (await fetch(f.base + '/api/client-config')).json(), value);
  assert.deepEqual((await (await fetch(f.base + '/api/bootstrap')).json()).identity, value);
});

test('a central account signs in to the chat server with an identity token and keeps its username', async t => {
  const f = await chatServer(t);
  const alice = await f.central.person('alice', 'Alice');
  const { status, value: session } = await f.signIn(alice);
  assert.equal(status, 200);
  assert.equal(session.user_id, '@alice:chat.test');
  assert.deepEqual(session.identity, { globalId: `alice@${f.central.domain}`, matrixUserId: '@alice:chat.test', kind: 'human' });
  assert.equal(f.matrix.users.get('@alice:chat.test').name, 'Alice');
  const me = await (await fetch(f.base + '/api/me', { headers: { Authorization: `Bearer ${session.access_token}` } })).json();
  assert.equal(me.user.globalId, `alice@${f.central.domain}`);
  const again = (await f.signIn(alice)).value;
  assert.equal(again.user_id, session.user_id);
  assert.notEqual(again.access_token, session.access_token);
});

test('tokens for another server, from another central server, or malformed are refused', async t => {
  const f = await chatServer(t);
  const alice = await f.central.person('alice');
  const elsewhere = await f.post('/api/session', { identityToken: await f.central.identityToken(alice, 'https://other-chat.test') });
  assert.equal(elsewhere.status, 401);
  assert.equal(elsewhere.value.code, 'IDENTITY_TOKEN_AUDIENCE');
  const impostor = await startCentral(t);
  const forged = await f.post('/api/session', { identityToken: await impostor.identityToken(await impostor.person('alice'), CORE_URL) });
  assert.equal(forged.status, 401);
  assert.equal(forged.value.code, 'IDENTITY_TOKEN_KEY_UNKNOWN');
  const malformed = await f.post('/api/session', { identityToken: 'not-a-token' });
  assert.equal(malformed.value.code, 'IDENTITY_TOKEN_MALFORMED');
  assert.equal(f.matrix.users.size, 0);
});

test('a chat server without a central server refuses sign-in', async t => {
  const f = await fixture(t);
  const response = await fetch(f.base + '/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"identityToken":"x"}' });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'CENTRAL_UNCONFIGURED');
  assert.equal((await (await fetch(f.base + '/api/client-config')).json()).central, null);
});

test('a Bot signs in with its own central identity, belongs to its owner and fetches its own node configuration', async t => {
  const f = await chatServer(t);
  const alice = await f.central.person('alice', 'Alice');
  const owner = (await f.signIn(alice)).value;
  const helper = await f.central.bot(alice, 'helper', 'Helper');
  const { status, value: session } = await f.signIn(helper.token);
  assert.equal(status, 200);
  assert.equal(session.user_id, '@helper:chat.test');
  assert.deepEqual(session.identity, { globalId: `helper@${f.central.domain}`, matrixUserId: '@helper:chat.test', kind: 'bot', ownerMatrixUserId: '@alice:chat.test' });
  const bots = await (await fetch(f.base + '/api/bots', { headers: { Authorization: `Bearer ${owner.access_token}` } })).json();
  assert.deepEqual(bots.bots.map(bot => [bot.id, bot.ownerId, bot.nativeBinding]), [['@helper:chat.test', '@alice:chat.test', null]]);
  const route = `/api/bots/${encodeURIComponent('@helper:chat.test')}/connect`;
  const byOwner = await f.post(route, {}, owner.access_token);
  assert.equal(byOwner.status, 403);
  assert.equal(byOwner.value.code, 'BOT_SESSION_REQUIRED');
  const native = { hostId: 'host-1', nativeBotId: 'native-helper' };
  const { status: connected, value: { bundle } } = await f.post(route, { native }, session.access_token);
  assert.equal(connected, 200);
  assert.equal(bundle.nodeId, 'helper');
  assert.equal(bundle.coreUrl, CORE_URL);
  assert.equal(bundle.coreConfig.executionMode, 'native');
  assert.deepEqual(bundle.coreConfig.nativeBinding, { ...native, botId: '@helper:chat.test' });
  assert.ok(bundle.setup.participants.find(person => person.id === '@helper:chat.test').accessToken);
  const plain = (await f.post(route, {}, session.access_token)).value.bundle;
  assert.equal(plain.coreConfig.executionMode, undefined);
});

test('explicit client origins permit preflight and authenticated calls; unknown origins fail before Matrix', async t => {
  const f = await fixture(t);
  const preflight = await fetch(f.base + '/api/session', { method: 'OPTIONS', headers: { Origin: 'https://client.test',
    'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type, authorization, x-upload-id' } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://client.test');
  assert.equal(preflight.headers.has('access-control-allow-credentials'), false);
  assert.match(preflight.headers.get('access-control-allow-headers'), /X-Upload-Id/);
  for (const origin of ['https://evil.test', 'null', 'https://client.test/']) {
    const denied = await fetch(f.base + '/api/session', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{"identityToken":"x"}' });
    assert.equal(denied.status, 403);
    assert.equal((await denied.json()).code, 'CLIENT_ORIGIN_DENIED');
  }
  assert.equal(f.calls.length, 0);
  const me = await fetch(f.base + '/api/me', { headers: { Origin: 'https://client.test', Authorization: 'Bearer alice-client' } });
  assert.equal(me.status, 200);
  assert.equal(me.headers.get('access-control-allow-origin'), 'https://client.test');
  assert.equal((await me.json()).identity.matrixUserId, '@alice:home.test');
});

test('identity options accept only HTTPS origins for the central server and browser clients', () => {
  assert.deepEqual(validateIdentityOptions({ central: 'https://id.test/' }), { central: 'https://id.test', clientOrigins: [] });
  for (const identity of [{ central: 'http://id.test' }, { central: 'https://id.test/path' }, { clientOrigins: ['*'] }, { clientOrigins: ['http://public.test'] }]) {
    assert.throws(() => validateIdentityOptions(identity));
  }
});

test('without a public Core URL the page host is the one browser origin', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dscord-single-origin-'));
  const core = await createCore({ dataRoot: root, enablePush: false,
    setup: { serverName: 'single.test', homeserverUrl: 'http://127.0.0.1:1', participants: [] },
    config: { nodeSecret: 'single-origin-secret' } });
  const base = await listen(core.server);
  t.after(async () => { await core.close(); await rm(root, { recursive: true, force: true }); });
  assert.equal((await (await fetch(base + '/api/client-config')).json()).home.coreUrl, null);
  const sameHost = await new Promise((resolve, reject) => {
    const request = http.request(base + '/api/session', { method: 'POST', headers: { Host: 'single.test', Origin: 'https://single.test', 'Content-Type': 'application/json' } }, response => {
      response.resume(); response.once('end', () => resolve({ status: response.statusCode, origin: response.headers['access-control-allow-origin'] }));
    });
    request.once('error', reject); request.end('{}');
  });
  assert.equal(sameHost.status, 503); assert.equal(sameHost.origin, 'https://single.test');
  const unrelated = await fetch(base + '/api/session', { method: 'POST', headers: { Host: 'single.test', Origin: 'https://other.test', 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(unrelated.status, 403);
});

test('a separate allowed client can PATCH owned Bot participation while owner and origin checks still apply', async t => {
  const botId = '@owned:home.test';
  const f = await fixture(t, { extraParticipants: [
    { id: botId, localpart: 'owned', kind: 'bot', name: 'Owned', ownerId: '@alice:home.test' },
    { id: '@bob:home.test', localpart: 'bob', kind: 'human', name: 'Bob', accessToken: 'bob-client' },
  ] });
  const route = `/api/bots/${encodeURIComponent(botId)}/attention`;
  const preflight = origin => fetch(f.base + route, { method: 'OPTIONS', headers: { Origin: origin,
    'Access-Control-Request-Method': 'PATCH', 'Access-Control-Request-Headers': 'content-type, authorization' } });
  const allowed = await preflight('https://client.test');
  assert.equal(allowed.status, 204);
  assert.match(allowed.headers.get('access-control-allow-methods'), /(?:^|, )PATCH(?:,|$)/);
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://client.test');
  assert.equal((await preflight('https://evil.test')).status, 403);
  assert.equal(f.calls.length, 0, 'Browser preflights do not authenticate or mutate settings');
  const patch = (token, mode) => fetch(f.base + route, { method: 'PATCH', headers: { Origin: 'https://client.test',
    Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }) });
  const saved = await patch('alice-client', 'natural');
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).mode, 'natural');
  const denied = await patch('bob-client', 'mention');
  assert.equal(denied.status, 403);
  assert.equal((await denied.json()).code, 'BOT_OWNER_REQUIRED');
  assert.equal(f.core.kernelControl.desired(botId).mode, 'natural');
});

test('the shared Core guard rejects disabled and expired accounts before every protected route', async t => {
  const f = await fixture(t);
  f.core.accounts.db.prepare("UPDATE accounts SET status='disabled' WHERE user_id=?").run('@alice:home.test');
  for (const route of ['/api/me', '/api/attachments/unknown/metadata', '/api/rooms/unknown/messages', '/api/spaces', '/api/bots', '/api/tasks/unknown', '/api/push/subscriptions']) {
    const response = await fetch(f.base + route, { headers: { Authorization: 'Bearer alice-client' } });
    assert.equal(response.status, 403, route);
    assert.match((await response.json()).error, /not active/);
  }
  assert.equal((await fetch(f.base + '/api/me', { headers: { Authorization: 'Bearer expired-client' } })).status, 401);
});

test('password, token and media requests never follow even same-origin credential redirects', async t => {
  const received = [];
  let sameOriginReceived = 0;
  const receiver = http.createServer((req, res) => { received.push(req.url); req.resume(); res.end('{}'); });
  const receiverUrl = await listen(receiver);
  const redirector = http.createServer((req, res) => {
    req.resume();
    if (req.url === '/capture') { sameOriginReceived++; res.end('{}'); return; }
    res.writeHead(307, { Location: req.url === '/same-origin-start' ? '/capture' : receiverUrl + '/capture' }); res.end();
  });
  const redirectUrl = await listen(redirector);
  t.after(async () => { await stop(redirector); await stop(receiver); });
  const matrix = new MatrixClient({ baseUrl: redirectUrl, accessToken: 'private-token' });
  await assert.rejects(matrix.request('POST', '/_matrix/client/v3/login', { password: 'private-password' }));
  await assert.rejects(matrix.request('POST', '/same-origin-start', { password: 'private-password' }));
  await assert.rejects(matrix.whoami());
  await assert.rejects(matrix.downloadMedia('mxc://remote.test/one'));
  await assert.rejects(matrix.uploadMedia(Buffer.from('private-file'), { filename: 'file.txt', size: 12 }));
  assert.deepEqual(received, []);
  assert.equal(sameOriginReceived, 0);
});
