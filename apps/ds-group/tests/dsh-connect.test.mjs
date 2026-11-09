import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ConnectController, connectKey } from '../dsh-connect/controller.mjs';
import { NodeProcesses } from '../dsh-connect/processes.mjs';

const serverUrl = 'https://chat.example';
// What the chat server's page shows: base64url JSON naming the server and a one-time central code.
const connectionKey = (server, code) => Buffer.from(JSON.stringify({ server, code })).toString('base64url');
const centralUrl = 'https://id.example';
const userId = '@alice:chat.example';
const botId = '@alice-helper:chat.example';
const bot = { id: botId, name: 'Helper', kind: 'bot', localpart: 'alice-helper', ownerId: userId };
const centralBot = { id: 'central-bot-1', username: 'alice-helper', displayName: 'Helper', globalId: 'alice-helper@id.example', kind: 'bot', status: 'active' };

// Chat servers by origin; the last one trusts another central server.
const serverNames = { [serverUrl]: 'chat.example', 'https://two.example': 'two.example', 'https://elsewhere.example': 'elsewhere.example', 'https://invite.example': 'invite.example' };

function bundle(serverName = 'chat.example') {
  const origin = Object.keys(serverNames).find(origin => serverNames[origin] === serverName);
  const account = { ...bot, id: `@${bot.localpart}:${serverName}`, ownerId: `@alice:${serverName}` };
  return {
    schemaVersion: 1, nodeId: bot.localpart, coreUrl: origin,
    setup: { serverName, roomId: `!lobby:${serverName}`, homeserverUrl: `https://matrix.${serverName}`,
      publicHomeserverUrl: `https://matrix.${serverName}`, participants: [{ ...account, accessToken: 'synthetic-bot-token' }] },
    coreConfig: { nodeSecret: 'synthetic-node-key', publicUrl: origin, modelCallLimit: 0, maxOutputTokens: 1024 },
  };
}

async function fixture(t, options = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'dscord-connect-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const calls = [];
  const live = new Set();
  const effects = [];
  const processes = {
    async available() { return { available: true, message: null }; },
    async start(node) { effects.push(['start', node.id]); live.add(node.id); },
    async stop(node) { effects.push(['stop', node.id]); live.delete(node.id); },
    async probe(node) { return { status: live.has(node.id) ? 'online' : 'offline', lastError: null }; },
    ...options.processes,
  };
  let logins = 0;
  let devices = 0;
  // The chat server at serverUrl and its central server at centralUrl, as one fake network.
  const request = async (url, init) => {
    const { origin, pathname } = new URL(url);
    calls.push({ origin, pathname, init });
    const body = init.body ? JSON.parse(init.body) : {};
    if (origin === centralUrl) {
      if (pathname === '/api/connect-codes/redeem') {
        if (body.code === 'expired-code') return Response.json({ error: 'expired', code: 'CONNECT_CODE_EXPIRED' }, { status: 410 });
        logins++;
        return Response.json({ token: `synthetic-central-token-${logins}`, account: { kind: 'human', displayName: 'Alice', globalId: 'alice@id.example' } });
      }
      if (pathname === '/api/bots') return Response.json({ bots: [centralBot] });
      if (pathname === '/api/device') { devices++; return Response.json({ deviceCode: `device-${devices}`, userCode: `USER-${devices}` }); }
      if (pathname === '/api/device/approve') return Response.json({ bot: centralBot });
      if (pathname === '/api/device/token') return Response.json({ token: `synthetic-bot-central-${body.deviceCode}` });
      if (pathname === '/api/identity-tokens') return Response.json({ token: `identity:${init.headers.Authorization.slice(7)}` });
      if (pathname === '/api/logout') return Response.json({ loggedOut: true });
      if (pathname === '/api/servers') return Response.json({ servers: [
        { origin: serverUrl, name: 'Chat', description: '', tags: [], members: { people: 3, bots: 1 }, owner: 'carol@id.example' },
        { origin: 'https://two.example', name: 'Two', description: 'Robots', tags: ['robots'], members: { people: 9, bots: 0 }, owner: 'carol@id.example' }] });
    }
    const serverName = serverNames[origin];
    if (pathname === '/.well-known/dscord/client') return Response.json({ home: { serverName },
      central: { issuer: origin === 'https://elsewhere.example' ? 'https://id.elsewhere.example' : centralUrl },
      auth: { audience: origin, sessionPath: '/api/session' } });
    if (pathname === '/api/session') {
      const bot = body.identityToken.startsWith('identity:synthetic-bot-central');
      if (origin === 'https://invite.example' && !bot && body.inviteCode !== 'WXYZ-2345')
        return Response.json({ error: body.inviteCode ? 'INVITE_INVALID' : 'INVITE_REQUIRED', code: body.inviteCode ? 'INVITE_INVALID' : 'INVITE_REQUIRED' }, { status: 403 });
      return Response.json(bot ? { user_id: `@${centralBot.username}:${serverName}`, access_token: 'synthetic-bot-session' }
        : { user_id: `@alice:${serverName}`, access_token: `synthetic-human-token-${logins}${origin === serverUrl ? '' : `-${serverName}`}` });
    }
    if (pathname === '/api/status') return Response.json({ budget: options.policy || { maxTokens: 8192, allowedModels: null } });
    if (pathname === `/api/bots/${encodeURIComponent(`@${centralBot.username}:${serverName}`)}/connect`) {
      await options.beforeBundle?.();
      return Response.json({ bundle: options.bundle?.() || bundle(serverName) });
    }
    if (pathname === '/api/logout') return Response.json({});
    return Response.json({ error: 'Unknown route' }, { status: 404 });
  };
  const settings = { directory, processes, models: options.models, request, selectPort: async () => 23100 };
  const controller = await new ConnectController(settings).initialize();
  await controller.restoring;
  const login = (code = 'synthetic-connect-code') => controller.handle({ action: 'login', key: connectionKey(serverUrl, code) });
  return { directory, calls, effects, live, processes, controller, settings, login };
}

test('DSH connection login stores a private client token and never persists or returns the connection key', async t => {
  const { directory, controller, login, calls } = await fixture(t);
  assert.deepEqual(await readdir(directory), []);
  assert.equal((await controller.handle({ action: 'status' })).user, null);
  const result = await login();
  assert.equal(result.user.id, 'alice@id.example');
  assert.deepEqual(result.servers, [{ url: serverUrl, serverName: 'chat.example' }]);
  assert.equal(result.bots[0].status, 'offline');
  assert.equal(result.dataDirectory, directory);
  assert.equal(JSON.stringify(result).includes('synthetic-human-token'), false);
  const filename = path.join(directory, 'connection.json');
  const saved = await readFile(filename, 'utf8');
  assert.equal(saved.includes('synthetic-connect-code'), false);
  assert.equal(calls.find(call => call.pathname === '/api/connect-codes/redeem').init.body.includes('synthetic-connect-code'), true);
  assert.equal(JSON.parse(saved).servers[serverUrl].accessToken, 'synthetic-human-token-1');
  assert.equal(JSON.parse(saved).centralToken, 'synthetic-central-token-1');
  assert.equal(result.user.globalId, 'alice@id.example');
  if (process.platform !== 'win32') assert.equal((await stat(filename)).mode & 0o777, 0o600);
  await login();
  const logouts = calls.filter(call => call.pathname === '/api/logout').map(call => [call.origin, call.init.headers.Authorization]);
  assert.deepEqual(logouts, [[serverUrl, 'Bearer synthetic-human-token-1'], [centralUrl, 'Bearer synthetic-central-token-1']]);
  await controller.dispose();
});

test('DSH decision settings action forwards the selected protocol route without dropping it', async t => {
  const received = [];
  const { controller } = await fixture(t, { processes: {
    async saveDecisionProvider(settings) { received.push(settings); return { configured: true, model: settings.model }; },
  } });
  t.after(() => controller.dispose());
  const input = { apiKey: 'synthetic-private-decision-key', enabled: true,
    model: 'company/decision-v2', endpoint: 'https://decision.example/v2/decisions' };
  const result = await controller.handle({ action: 'save-decision-provider', ...input });
  assert.deepEqual(received, [input]);
  assert.equal(result.model, input.model);
  assert.equal(JSON.stringify(result).includes(input.apiKey), false);
});

test('DSH connect is idempotent, preserves identity across reload, and explicit disconnect stays offline', async t => {
  const { controller, login, settings, directory, effects } = await fixture(t);
  await login();
  await Promise.all([controller.handle({ action: 'connect', botId: bot.id }), controller.handle({ action: 'connect', botId: bot.id })]);
  assert.deepEqual(effects, [['start', bot.id]]);
  const node = controller.state.nodes[bot.id];
  assert.ok(node.directory.startsWith(path.join(directory, 'nodes') + path.sep));
  const setupPath = path.join(node.directory, 'matrix-setup.json');
  const initialSetup = await readFile(setupPath, 'utf8');
  if (process.platform !== 'win32') assert.equal((await stat(setupPath)).mode & 0o777, 0o600);
  await writeFile(path.join(node.directory, 'history-marker'), 'keep');
  await controller.dispose();
  assert.equal(JSON.parse(await readFile(path.join(directory, 'connection.json'), 'utf8')).nodes[bot.id].desired, true);
  const restored = await new ConnectController(settings).initialize();
  await restored.restoring;
  assert.equal((await restored.handle({ action: 'status' })).bots[0].status, 'online');
  assert.equal(await readFile(setupPath, 'utf8'), initialSetup);
  assert.equal(await readFile(path.join(node.directory, 'history-marker'), 'utf8'), 'keep');
  await restored.handle({ action: 'disconnect', botId: bot.id });
  await restored.dispose();
  const offline = await new ConnectController(settings).initialize();
  await offline.restoring;
  assert.equal((await offline.handle({ action: 'status' })).bots[0].status, 'offline');
  assert.deepEqual(effects, [['start', bot.id], ['stop', bot.id], ['start', bot.id], ['stop', bot.id]]);
  await offline.dispose();
});

test('a Bot connects with its own central session from an owner-approved device code, reused on reconnect', async t => {
  const { controller, login, calls } = await fixture(t);
  await login();
  await controller.handle({ action: 'connect', botId: bot.id });
  await controller.handle({ action: 'disconnect', botId: bot.id });
  await controller.handle({ action: 'connect', botId: bot.id });
  assert.equal(calls.filter(call => call.pathname === '/api/device').length, 1);
  const approve = calls.find(call => call.pathname === '/api/device/approve');
  assert.equal(approve.init.headers.Authorization, 'Bearer synthetic-central-token-1');
  assert.deepEqual(JSON.parse(approve.init.body), { userCode: 'USER-1', botId: centralBot.id });
  assert.equal(controller.state.botSessions[centralBot.id], 'synthetic-bot-central-device-1');
  const connects = calls.filter(call => call.pathname.endsWith('/connect'));
  assert.equal(connects.length, 2);
  assert.ok(connects.every(call => call.init.headers.Authorization === 'Bearer synthetic-bot-session'));
  const botLogouts = calls.filter(call => call.pathname === '/api/logout' && call.init.headers.Authorization === 'Bearer synthetic-bot-session');
  assert.equal(botLogouts.length, 2);
  await controller.dispose();
});

test('failed Bot start drains partial processes and remains retryable', async t => {
  let fail = true;
  let starts = 0;
  let stops = 0;
  const { controller, login } = await fixture(t, { processes: {
    async start() { starts++; if (fail) throw new Error('synthetic startup failure'); },
    async stop() { stops++; },
    async probe() { return { status: 'online', lastError: null }; },
  } });
  await login();
  await assert.rejects(controller.handle({ action: 'connect', botId: bot.id }), /synthetic startup failure/);
  assert.equal(stops, 1);
  const failed = await controller.handle({ action: 'status' });
  assert.equal(failed.bots[0].status, 'error');
  assert.equal(failed.bots[0].connected, true);
  fail = false;
  assert.equal((await controller.handle({ action: 'connect', botId: bot.id })).bots[0].status, 'online');
  assert.equal(starts, 2);
  await controller.handle({ action: 'logout' });
  assert.equal((await controller.handle({ action: 'status' })).user, null);
  await controller.dispose();
});

test('DSH connection rejects unknown ownership and mismatched node bundle before spawning', async t => {
  const { controller, login, effects, directory } = await fixture(t, { bundle: () => ({ ...bundle(), nodeId: 'another-bot' }) });
  await login();
  await assert.rejects(controller.handle({ action: 'connect', botId: '@other:chat.example' }), /自己的 Bot/);
  await assert.rejects(controller.handle({ action: 'connect', botId: bot.id }), /身份不匹配/);
  await assert.rejects(controller.handle({ action: 'login', key: connectionKey('https://name:secret@example.com', 'code') }), /without credentials/);
  assert.deepEqual(effects, []);
  assert.deepEqual(await readdir(directory), ['connection.json']);
  await controller.dispose();
});

test('isolated node environment uses the selected server bundle and its own absolute data paths', () => {
  const runner = new NodeProcesses({ sourceHome: '/fixture/source', sourceProfile: 'web', env: {
    DS_GROUP_DATA_DIR: '/unrelated', DS_GROUP_MATRIX_URL: 'http://unrelated-matrix', PATH: '/fixture/bin',
  } });
  const directory = path.resolve('synthetic-node');
  const env = runner.environment({ directory, serverUrl, port: 23104 });
  assert.equal(env.DS_GROUP_DATA_DIR, directory);
  assert.equal(env.DS_GROUP_MATRIX_SETUP_PATH, path.join(directory, 'matrix-setup.json'));
  assert.equal(env.DS_GROUP_MATRIX_URL, undefined);
  assert.equal(env.DS_GROUP_DSH_SOURCE_HOME, '/fixture/source');
  assert.equal(env.DS_GROUP_DSH_SOURCE_PROFILE, 'web');
  assert.equal(env.DS_GROUP_CORE_URL, serverUrl);
  assert.equal(env.DS_GROUP_BOT_ENDPOINT, 'http://127.0.0.1:23104');
});

test('DSH process controller rejects aggregate service commands as Bot identities', async () => {
  const runner = new NodeProcesses();
  for (const localpart of ['all', 'core', '../core']) {
    await assert.rejects(runner.command({ localpart }, 'scripts/service.mjs', ['up', localpart]), /保留名称/);
  }
});

test('a connection key is base64url JSON naming the server and code, and a broken or spent key says so', async t => {
  assert.deepEqual(connectKey(` ${connectionKey(serverUrl, 'abc')}\n`), { server: serverUrl, code: 'abc' });
  for (const broken of ['', 'not a key', Buffer.from('{"server":"https://chat.example"}').toString('base64url')])
    assert.throws(() => connectKey(broken), error => error.code === 'CONNECT_KEY_INVALID');
  const { controller, login, calls } = await fixture(t);
  await assert.rejects(controller.handle({ action: 'login', key: 'not a key' }), error => error.code === 'CONNECT_KEY_INVALID');
  await assert.rejects(login('expired-code'), error => error.code === 'CONNECT_CODE_EXPIRED' && /过期/.test(error.message));
  assert.equal(calls.filter(call => call.pathname === '/api/session').length, 0);
  assert.equal((await controller.handle({ action: 'status' })).user, null);
});

test('failed login persistence retains the previous identity and revokes the unused new session', async t => {
  const { controller, login, calls, directory } = await fixture(t);
  await login();
  const previous = controller.state;
  const savedFilename = controller.filename;
  controller.filename = path.join(directory, 'missing-parent', 'connection.json');
  await assert.rejects(login(), /ENOENT/);
  assert.equal(controller.state, previous);
  assert.equal(JSON.parse(await readFile(savedFilename, 'utf8')).servers[serverUrl].accessToken, 'synthetic-human-token-1');
  const logouts = calls.filter(call => call.pathname === '/api/logout').map(call => [call.origin, call.init.headers.Authorization]);
  assert.deepEqual(logouts, [[serverUrl, 'Bearer synthetic-human-token-2'], [centralUrl, 'Bearer synthetic-central-token-2']]);
  controller.filename = savedFilename;
  await controller.dispose();
});

test('host disposal starts every Bot cleanup before waiting for an individual drain', async t => {
  const stops = [];
  const finish = [];
  const { controller } = await fixture(t, { processes: {
    async stop(node) { stops.push(node.id); await new Promise(resolve => finish.push(resolve)); },
  } });
  for (const id of ['one', 'two']) {
    controller.state.nodes[id] = { id, desired: true };
    controller.running.set(id, { status: 'online', lastError: null });
  }
  const disposing = controller.dispose();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(stops, ['one', 'two']);
  for (const resolve of finish) resolve();
  await disposing;
  assert.equal(controller.state.nodes.one.desired, true);
  assert.equal(controller.state.nodes.two.desired, true);
});

test('host disposal dispatches cleanup while a Bot startup command is still pending', async t => {
  let releaseStartup;
  let started;
  const startup = new Promise(resolve => { releaseStartup = resolve; });
  const ready = new Promise(resolve => { started = resolve; });
  let stops = 0;
  const { controller, login } = await fixture(t, { processes: {
    async start() { started(); await startup; },
    async stop() { stops++; },
  } });
  await login();
  const connecting = controller.handle({ action: 'connect', botId: bot.id });
  await ready;
  const disposing = controller.dispose();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(stops, 1);
  releaseStartup();
  await Promise.all([connecting, disposing]);
  assert.equal(controller.running.size, 0);
});

test('a connection awaiting a remote bundle cannot launch after the plugin begins closing', async t => {
  let releaseBundle;
  let requested;
  const bundleReady = new Promise(resolve => { releaseBundle = resolve; });
  const arrived = new Promise(resolve => { requested = resolve; });
  const { controller, login, effects } = await fixture(t, { beforeBundle: async () => { requested(); await bundleReady; } });
  await login();
  const connecting = controller.handle({ action: 'connect', botId: bot.id });
  await arrived;
  const disposing = controller.dispose();
  releaseBundle();
  await assert.rejects(connecting, /正在关闭/);
  await disposing;
  assert.deepEqual(effects, []);
  assert.deepEqual(controller.state.nodes, {});
});

test('per-Bot selections persist before connection and apply on reconnect with only a private credential snapshot', async t => {
  const first = { model: 'first/team/chat', maxTokens: 2048 };
  const second = { model: 'second/other', maxTokens: 4096 };
  const models = {
    view: async () => ({ available: true, providers: [], defaultSelection: first }),
    async export(selection = first) {
      if (selection.model === 'invalid/model') throw Object.assign(new Error('Missing model'), { code: 'MODEL_UNAVAILABLE' });
      return { selection, providers: { [selection.model.split('/')[0]]: { apiKeyEnv: 'KEY' } },
        credentials: { version: 1, refs: { KEY: 'synthetic-private-model-key' }, records: {} } };
    },
  };
  const { controller, login, effects, directory, settings } = await fixture(t, { models });
  await login();
  const initial = await controller.handle({ action: 'save-model', botId: bot.id, selection: first });
  assert.deepEqual(initial.bots[0].modelSelection, first);
  assert.deepEqual(effects, []);
  await controller.handle({ action: 'connect', botId: bot.id });
  assert.deepEqual((await controller.status()).bots[0].activeModel, first);
  const saved = await controller.handle({ action: 'save-model', botId: bot.id, selection: second });
  assert.deepEqual(saved.bots[0].activeModel, first);
  assert.deepEqual(saved.bots[0].modelSelection, second);
  assert.deepEqual(effects, [['start', bot.id]]);
  const priorState = await readFile(path.join(directory, 'connection.json'), 'utf8');
  await assert.rejects(controller.handle({ action: 'save-model', botId: bot.id, selection: { model: 'invalid/model' } }), { code: 'MODEL_UNAVAILABLE' });
  assert.equal(await readFile(path.join(directory, 'connection.json'), 'utf8'), priorState);
  assert.equal(priorState.includes('synthetic-private-model-key'), false);
  assert.equal(JSON.stringify(saved).includes('synthetic-private-model-key'), false);
  await controller.handle({ action: 'disconnect', botId: bot.id });
  await controller.handle({ action: 'connect', botId: bot.id });
  const node = controller.state.nodes[bot.id];
  const sourcePath = path.join(node.directory, 'model-source.json');
  assert.deepEqual(JSON.parse(await readFile(sourcePath, 'utf8')).selection, second);
  if (process.platform !== 'win32') assert.equal((await stat(sourcePath)).mode & 0o777, 0o600);
  const runner = new NodeProcesses({ env: { DS_GROUP_MODEL: 'ambient/wrong', OPENCODE_API_KEY: 'ambient-secret' } });
  const env = runner.environment(node);
  assert.equal(env.DS_GROUP_MODEL_SOURCE_PATH, sourcePath);
  assert.equal(env.DS_GROUP_MODEL, undefined);
  assert.equal(env.OPENCODE_API_KEY, undefined);
  await controller.dispose();
  const restored = await new ConnectController(settings).initialize();
  await restored.restoring;
  assert.deepEqual((await restored.status()).bots[0].activeModel, second);
  await restored.dispose();
});

test('legacy connection state migrates its prepared model before a changed DSH default can run', async t => {
  const { controller, login, settings } = await fixture(t);
  await login();
  await controller.handle({ action: 'connect', botId: bot.id });
  const node = controller.state.nodes[bot.id];
  const preparedDirectory = path.join(node.directory, `dsh-${node.localpart}`);
  await mkdir(preparedDirectory, { recursive: true });
  await writeFile(path.join(preparedDirectory, 'node-config.json'), JSON.stringify({ model: 'legacy/model', maxTokens: 3072 }));
  await controller.dispose();
  const selections = [];
  settings.models = {
    view: async () => ({ providers: [] }),
    export: async selection => {
      selections.push(selection);
      return { selection, providers: {}, credentials: {} };
    },
  };
  const restored = await new ConnectController(settings).initialize();
  await restored.restoring;
  assert.deepEqual(selections, [{ model: 'legacy/model', maxTokens: 3072 }]);
  await restored.dispose();
});

test('server model policy rejects a selection before persistence or node startup', async t => {
  const selection = { model: 'first/chat', maxTokens: 4096 };
  const models = {
    view: async () => ({ available: true, providers: [], defaultSelection: selection }),
    export: async input => ({ selection: { ...selection, ...input }, providers: {}, credentials: {} }),
  };
  const { controller, login, directory, effects } = await fixture(t, { models,
    policy: { allowedModels: ['second/chat'], maxTokens: 8192 },
  });
  await login();
  const before = await readFile(path.join(directory, 'connection.json'), 'utf8');
  await assert.rejects(controller.handle({ action: 'save-model', botId: bot.id, selection }), { code: 'MODEL_POLICY_DENIED' });
  await assert.rejects(controller.handle({ action: 'connect', botId: bot.id }), { code: 'MODEL_POLICY_DENIED' });
  assert.equal(await readFile(path.join(directory, 'connection.json'), 'utf8'), before);
  assert.deepEqual(effects, []);
  await assert.rejects(controller.handle({ action: 'save-model', botId: bot.id,
    selection: { model: 'second/chat', maxTokens: 9000 } }), { code: 'MODEL_OUTPUT_LIMIT' });
  await controller.dispose();
});

test('the owner signs in once and a Bot joins several chat servers, one node per server', async t => {
  const { controller, login, effects, calls } = await fixture(t);
  t.after(() => controller.dispose());
  await login();
  const added = await controller.handle({ action: 'add-server', serverUrl: 'https://two.example' });
  assert.deepEqual(added.servers.map(server => server.serverName), ['chat.example', 'two.example']);
  // One central Bot is an account on each server; it goes online only where the owner connects it.
  assert.deepEqual(added.bots.map(entry => [entry.id, entry.serverUrl]), [[botId, serverUrl], ['@alice-helper:two.example', 'https://two.example']]);
  await controller.handle({ action: 'connect', botId });
  await controller.handle({ action: 'connect', botId: '@alice-helper:two.example' });
  assert.deepEqual(effects, [['start', botId], ['start', '@alice-helper:two.example']]);
  assert.notEqual(controller.state.nodes[botId].directory, controller.state.nodes['@alice-helper:two.example'].directory);
  assert.equal(controller.state.nodes['@alice-helper:two.example'].serverUrl, 'https://two.example');
  // The central server is signed in to once; each server gets the owner's own session.
  assert.equal(calls.filter(call => call.pathname === '/api/connect-codes/redeem').length, 1);
  await assert.rejects(controller.handle({ action: 'add-server', serverUrl: 'https://elsewhere.example' }), /另一个中央服务器/);
  // The central index lists servers to add; ones already added are marked.
  const found = await controller.handle({ action: 'search-servers', query: ' robots ' });
  assert.deepEqual(found.servers.map(server => [server.origin, server.added]), [[serverUrl, true], ['https://two.example', true]]);
  // A server that only takes invited people is added with the code a member gave.
  await assert.rejects(controller.handle({ action: 'add-server', serverUrl: 'https://invite.example' }), /只接受邀请加入/);
  await assert.rejects(controller.handle({ action: 'add-server', serverUrl: 'https://invite.example', inviteCode: 'NOPE' }), /邀请码不对/);
  const invited = await controller.handle({ action: 'add-server', serverUrl: 'https://invite.example', inviteCode: ' WXYZ-2345 ' });
  assert.ok(invited.servers.some(server => server.url === 'https://invite.example'));
  await controller.handle({ action: 'remove-server', serverUrl: 'https://invite.example' });
  const search = calls.find(call => call.pathname === '/api/servers');
  assert.equal(search.init.headers.Authorization, undefined, 'the index is searched without a credential');
  const removed = await controller.handle({ action: 'remove-server', serverUrl: 'https://two.example' });
  assert.deepEqual(removed.servers.map(server => server.serverName), ['chat.example']);
  assert.deepEqual(effects.at(-1), ['stop', '@alice-helper:two.example']);
  assert.deepEqual(Object.keys(controller.state.nodes), [botId]);
  assert.ok(calls.some(call => call.origin === 'https://two.example' && call.pathname === '/api/logout'
    && call.init.headers.Authorization === 'Bearer synthetic-human-token-1-two.example'));
});
