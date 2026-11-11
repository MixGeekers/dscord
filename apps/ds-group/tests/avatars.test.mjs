import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { createCentral } from '../central/service.mjs';
import { avatarOptions } from '../central/avatars.mjs';
import { AccountService } from '../src/accounts.mjs';
import { ProfileSync } from '../src/profile-sync.mjs';

async function fixture(t, avatars) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dscord-avatars-'));
  const config = { issuer: 'https://id.example.org', avatars, clientOrigins: ['https://client.example.org'] };
  let central, base;
  async function open() {
    central = await createCentral({ dataRoot: root, config, refreshIntervalMs: 0 });
    await new Promise(resolve => central.server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${central.server.address().port}`;
  }
  await open();
  t.after(async () => { await central.close(); await rm(root, { recursive: true, force: true }); });
  const request = async (route, { token, method = 'GET', json, bytes, type = 'image/png', ...rest } = {}) => {
    const response = await fetch(base + route, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(json ? { 'Content-Type': 'application/json' } : bytes ? { 'Content-Type': type } : {}) }, body: json ? JSON.stringify(json) : bytes, ...rest });
    return { response, body: response.headers.get('content-type')?.includes('json') ? await response.json() : Buffer.from(await response.arrayBuffer()) };
  };
  const register = async username => (await request('/api/register', { method: 'POST', json: { username, password: 'synthetic password' } })).body;
  const image = await sharp({ create: { width: 640, height: 320, channels: 3, background: '#258044' } }).png().toBuffer();
  return { request, register, root, image, get central() { return central; }, get base() { return base; }, restart: async () => { await central.close(); await open(); } };
}

test('avatar upload, crop, immutable images, ownership, rollback, conflict, clear and restart', async t => {
  const f = await fixture(t);
  const alice = await f.register('alice'), bob = await f.register('bobby');
  const bot = (await f.request('/api/bots', { token: alice.token, method: 'POST', json: { username: 'helper', displayName: 'Helper' } })).body.bot;
  const route = `/api/bots/${bot.id}/avatar`;
  const revision = bot.settings.revision;
  assert.equal((await f.request(`${route}?version=0`, { token: bob.token, method: 'PUT', bytes: f.image })).response.status, 404);
  assert.equal((await f.request('/api/me/avatar?version=0', { method: 'PUT', bytes: f.image })).response.status, 401);
  assert.equal((await f.request(`${route}?version=0&left=0&top=0&size=900`, { token: alice.token, method: 'PUT', bytes: f.image })).response.status, 400);
  const saved = await f.request(`${route}?version=0&left=320&top=0&size=320`, { token: alice.token, method: 'PUT', bytes: f.image });
  assert.equal(saved.response.status, 200, JSON.stringify(saved.body));
  const { profile } = saved.body;
  assert.equal(profile.profileVersion, 1);
  assert.equal(profile.globalId, bot.globalId);
  for (const size of [64, 128, 512]) {
    const result = await f.request(new URL(profile.avatar.sizes[size]).pathname);
    assert.equal(result.response.status, 200);
    assert.match(result.response.headers.get('cache-control'), /immutable/);
    const meta = await sharp(result.body).metadata();
    assert.equal(meta.width, size); assert.equal(meta.height, size); assert.equal(meta.exif, undefined);
  }
  assert.equal((await f.request('/api/bots', { token: alice.token })).body.bots[0].settings.revision, revision, 'a profile edit does not change runtime settings');
  assert.equal((await f.request(`${route}?version=0`, { token: alice.token, method: 'DELETE' })).response.status, 409);
  assert.equal((await f.request(`${route}?version=1`, { token: alice.token, method: 'PUT', bytes: Buffer.from('bad image') })).response.status, 400);
  assert.equal((await f.request(`${route}?version=1`, { token: alice.token, method: 'PUT', bytes: f.image, type: 'image/svg+xml' })).response.status, 415);
  assert.deepEqual((await f.request(route, { token: alice.token })).body.profile, profile, 'failed uploads preserve the current image');
  const preflight = await fetch(`${f.base}/api/me/avatar`, { method: 'OPTIONS', headers: { Origin: 'https://client.example.org', 'Access-Control-Request-Method': 'PUT' } });
  assert.match(preflight.headers.get('access-control-allow-methods'), /PUT/);
  assert.equal((await f.request(`/api/profiles?ids=${encodeURIComponent(bot.globalId)}`)).body.profiles[0].avatar.id, profile.avatar.id);
  await f.restart();
  assert.deepEqual((await f.request(route, { token: alice.token })).body.profile, profile, 'files and metadata survive a new central process');
  assert.equal((await f.request(`${route}?version=1`, { token: alice.token, method: 'DELETE' })).body.profile.avatar, null);
  assert.equal((await f.request(route, { token: alice.token })).body.profile.profileVersion, 2);
  assert.ok((await readdir(path.join(f.root, 'avatars'))).every(name => !name.startsWith('.upload-')));
  assert.ok((await readFile(path.join(f.root, 'central.sqlite'))).length);
});

test('upload limits, real image decoding and concurrent updates are enforced by central', async t => {
  const f = await fixture(t, { maxUploadBytes: 4096 });
  const alice = await f.register('alice');
  const put = bytes => f.request('/api/me/avatar?version=0', { token: alice.token, method: 'PUT', bytes });
  assert.equal((await put(Buffer.alloc(4097))).response.status, 413);
  const results = await Promise.all([put(f.image), put(f.image)]);
  assert.deepEqual(results.map(result => result.response.status).sort(), [200, 409]);
  assert.equal((await f.request('/api/me/avatar', { token: alice.token })).body.profile.profileVersion, 1);
  assert.throws(() => avatarOptions({ backend: 's3' }), /local/);
  assert.throws(() => avatarOptions({ sizes: [16] }), /sizes/);
});

test('two chat servers pull offline Bot profiles, retry a Matrix failure without reupload, clear and persist', async t => {
  const f = await fixture(t);
  const alice = await f.register('alice');
  const bot = (await f.request('/api/bots', { token: alice.token, method: 'POST', json: { username: 'helper', displayName: 'Helper' } })).body.bot;
  const route = `/api/bots/${bot.id}/avatar`;
  const servers = [];
  for (const serverName of ['chat-a.test', 'chat-b.test']) {
    const dataRoot = path.join(f.root, serverName);
    const calls = []; let failOnce = serverName === 'chat-a.test';
    const setup = { serverName, participants: [{ id: `@helper:${serverName}`, localpart: 'helper', name: 'Helper', kind: 'bot', ownerId: `@alice:${serverName}`, accessToken: 'fixture-bot-token' }] };
    const accounts = await new AccountService({ setup, dataRoot, clientFactory: () => ({
      uploadMedia: async bytes => { calls.push(['upload', bytes.length]); return { content_uri: `mxc://${serverName}/avatar` }; },
      request: async (method, target, body) => { calls.push([method, target, body]); if (failOnce) { failOnce = false; throw new Error('Matrix offline'); } },
    }) }).initialize();
    accounts.db.prepare('UPDATE accounts SET central_id=?,global_id=?').run(bot.id, bot.globalId);
    const sync = new ProfileSync({ accounts, trust: { issuer: 'https://id.example.org', url: f.base }, intervalMs: 0 });
    await sync.sync();
    servers.push({ accounts, sync, calls });
    t.after(async () => { await sync.close(); accounts.close(); });
  }
  await f.request(`${route}?version=0`, { token: alice.token, method: 'PUT', bytes: f.image });
  for (const { accounts, sync, calls } of servers) {
    await sync.sync(); await sync.sync();
    assert.equal(accounts.publicParticipants()[0].profileVersion, 1);
    assert.ok(accounts.publicParticipants()[0].avatar.url.startsWith('https://id.example.org/avatars/'));
    assert.equal(calls.filter(call => call[0] === 'upload').length, 1, 'PUT retry reuses persisted media receipt');
    assert.equal(accounts.db.prepare('SELECT matrix_version FROM account_profiles').get().matrix_version, 1);
  }
  await f.request(`${route}?version=1`, { token: alice.token, method: 'DELETE' });
  for (const { accounts, sync, calls } of servers) {
    await sync.sync();
    assert.equal(accounts.publicParticipants()[0].avatar, null);
    assert.equal(calls.at(-1)[2].avatar_url, '');
    await sync.close();
    const restored = new ProfileSync({ accounts, trust: null, intervalMs: 0 });
    assert.equal(accounts.publicParticipants()[0].profileVersion, 2);
    assert.equal(accounts.publicParticipants()[0].avatar, null);
    await restored.close();
  }
});

test('crop coordinates follow EXIF orientation and published images contain only the selected pixels', async t => {
  const f = await fixture(t);
  const alice = await f.register('alice');
  const left = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#ff0000' } }).png().toBuffer();
  const right = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#0000ff' } }).png().toBuffer();
  const portrait = await sharp({ create: { width: 80, height: 40, channels: 3, background: 'white' } })
    .composite([{ input: left, left: 0, top: 0 }, { input: right, left: 40, top: 0 }]).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const saved = await f.request('/api/me/avatar?version=0&left=0&top=40&size=40', { token: alice.token, method: 'PUT', type: 'image/jpeg', bytes: portrait });
  assert.equal(saved.response.status, 200, JSON.stringify(saved.body));
  const image = (await f.request(new URL(saved.body.profile.avatar.url).pathname)).body;
  const { data } = await sharp(image).resize(1, 1).raw().toBuffer({ resolveWithObject: true });
  assert.ok(data[2] > 200 && data[0] < 30, `Expected the blue lower half after rotation, got ${[...data]}`);
  assert.equal((await sharp(image).metadata()).exif, undefined);
});

test('people and Bots rename themselves and change their own avatar, and chat servers follow the name', async t => {
  const f = await fixture(t);
  const alice = await f.register('alice');
  const bot = (await f.request('/api/bots', { token: alice.token, method: 'POST', json: { username: 'helper', displayName: 'Helper' } })).body.bot;
  // The Bot's own central session, approved by its owner with the code its device shows.
  const { deviceCode, userCode } = (await f.request('/api/device', { method: 'POST', json: { label: 'DSH test' } })).body;
  assert.equal((await f.request('/api/device/approve', { token: alice.token, method: 'POST', json: { userCode, botId: bot.id } })).response.status, 200);
  const botToken = (await f.request('/api/device/token', { method: 'POST', json: { deviceCode } })).body.token;
  const serverName = 'chat-a.test';
  const calls = [];
  const setup = { serverName, participants: [{ id: `@helper:${serverName}`, localpart: 'helper', name: 'Helper', kind: 'bot', ownerId: `@alice:${serverName}`, accessToken: 'fixture-bot-token' }] };
  const accounts = await new AccountService({ setup, dataRoot: path.join(f.root, serverName), clientFactory: () => ({
    uploadMedia: async () => ({ content_uri: `mxc://${serverName}/avatar` }),
    request: async (method, target, body) => { calls.push([method, target, body]); },
  }) }).initialize();
  accounts.db.prepare('UPDATE accounts SET central_id=?,global_id=?').run(bot.id, bot.globalId);
  const sync = new ProfileSync({ accounts, trust: { issuer: 'https://id.example.org', url: f.base }, intervalMs: 0 });
  t.after(async () => { await sync.close(); accounts.close(); });
  const profile = async () => (await f.request(`/api/profiles?ids=${encodeURIComponent(bot.globalId)}`)).body.profiles[0];

  assert.equal((await f.request('/api/me', { method: 'PATCH', json: { displayName: 'x' } })).response.status, 401);
  const renamed = await f.request('/api/me', { token: botToken, method: 'PATCH', json: { displayName: ' 小助手 ' } });
  assert.equal(renamed.response.status, 200, JSON.stringify(renamed.body));
  assert.equal(renamed.body.account.displayName, '小助手');
  assert.equal(renamed.body.account.kind, 'bot');
  assert.deepEqual([(await profile()).displayName, (await profile()).profileVersion], ['小助手', 1]);
  await f.request('/api/me', { token: botToken, method: 'PATCH', json: { displayName: '小助手' } });
  assert.equal((await profile()).profileVersion, 1, 'the same name is not a new profile version');
  const invalid = await f.request('/api/me', { token: botToken, method: 'PATCH', json: { displayName: 'x'.repeat(81) } });
  assert.deepEqual([invalid.response.status, invalid.body.code], [400, 'DISPLAY_NAME_INVALID']);

  await sync.sync();
  assert.equal(accounts.publicParticipants()[0].name, '小助手');
  assert.deepEqual(calls.find(call => call[1].endsWith('/displayname'))?.[2], { displayname: '小助手' });

  // The avatar route the web uses for a person serves a Bot's own session the same way.
  const avatar = await f.request('/api/me/avatar?version=1', { token: botToken, method: 'PUT', bytes: f.image });
  assert.equal(avatar.response.status, 200, JSON.stringify(avatar.body));
  assert.equal(avatar.body.profile.profileVersion, 2);
  assert.equal((await profile()).avatar.id, avatar.body.profile.avatar.id);
  assert.equal((await profile()).displayName, '小助手', 'a new image keeps the name');

  // The owner can still rename the Bot from its settings, and that reaches chat servers too.
  await f.request(`/api/bots/${bot.id}`, { token: alice.token, method: 'PATCH', json: { displayName: 'Helper 2' } });
  assert.equal((await profile()).profileVersion, 3);
  await sync.sync();
  assert.equal(accounts.publicParticipants()[0].name, 'Helper 2');
  assert.equal(accounts.publicParticipants()[0].avatar.id, avatar.body.profile.avatar.id);

  const person = await f.request('/api/me', { token: alice.token, method: 'PATCH', json: { displayName: '爱丽丝' } });
  assert.equal(person.body.account.displayName, '爱丽丝');
  assert.equal((await f.request('/api/me', { token: alice.token })).body.account.displayName, '爱丽丝');
});
