import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { connectKey } from '../dsh-connect/controller.mjs';
import { CHAT, ELSEWHERE, TWO, centralUrl, connectFixture } from './fixtures/connect.mjs';

async function fixture(t, options) {
  const value = await connectFixture(options);
  t.after(value.close);
  return value;
}

test('a connection key links DSH to its owner; the key is used once and never stored or returned', async t => {
  const { directory, controller, login, key, calls, api, alice } = await fixture(t);
  assert.deepEqual(await readdir(directory).catch(() => []), ['connection.json']);
  assert.equal((await controller.handle({ action: 'status' })).user, null);
  await assert.rejects(controller.handle({ action: 'login', key: 'not a key' }), { code: 'CONNECT_KEY_INVALID' });
  const pasted = await key();
  const result = await controller.handle({ action: 'login', key: pasted });
  await controller.queue;
  assert.deepEqual(result.user, { id: 'alice@id.example', name: 'alice', globalId: 'alice@id.example' });
  assert.equal(result.webUrl, CHAT);
  assert.equal(result.label, 'DSH laptop');
  assert.deepEqual(result.bots, []);
  const filename = path.join(directory, 'connection.json');
  const saved = await readFile(filename, 'utf8');
  const code = connectKey(pasted).code;
  assert.equal(saved.includes(code) || JSON.stringify(result).includes(code), false);
  assert.equal(JSON.stringify(result).includes(JSON.parse(saved).centralToken), false, 'the page never sees the session');
  if (process.platform !== 'win32') assert.equal((await stat(filename)).mode & 0o777, 0o600);
  assert.equal(calls.some(call => call.origin === CHAT && call.pathname === '/api/session'), false, 'the owner is not signed in to any chat server');
  await assert.rejects(controller.handle({ action: 'login', key: pasted }), { code: 'CONNECT_CODE_UNKNOWN' });

  // The device shows up on the owner's page as soon as it has reported.
  const devices = (await api('GET', '/api/devices', { token: alice })).devices;
  assert.deepEqual(devices.map(device => [device.label, device.online, device.models.defaultModel, device.models.providers[0].models.length]),
    [['DSH laptop', true, 'fixture/default', 3]]);

  // Linking again ends the session the first key gave.
  const first = JSON.parse(saved).centralToken;
  await login();
  const logouts = calls.filter(call => call.pathname === '/api/logout').map(call => [call.origin, call.init.headers.Authorization]);
  assert.deepEqual(logouts, [[centralUrl, `Bearer ${first}`]]);
});

test('a Bot set up on the web is created and brought online by the device, which reports back how it went', async t => {
  const { controller, login, createBot, managed, locals, effects, kernel, calls, directory } = await fixture(t);
  const bot = await createBot({ displayName: '识雨', role: '生活和工作伙伴', model: 'fixture/large', servers: [CHAT] });
  await login();
  assert.deepEqual(locals.map(local => [local.id, local.name, local.role, local.model, local.owner.id]),
    [['native-1', '识雨', '生活和工作伙伴', 'fixture/large', 'alice@id.example']]);
  const created = kernel.find(([endpoint]) => endpoint === 'create-bot')[1];
  assert.equal(created.greet, false);
  assert.match(created.requestId, new RegExp(`^dscord:${bot.id}:`));
  const account = `@${bot.username}:chat.example`;
  assert.deepEqual(effects, [['start', account, 'native-1']]);
  const status = await controller.handle({ action: 'status' });
  assert.deepEqual(status.bots, [{ id: bot.id, name: '识雨', username: bot.username, globalId: bot.globalId, model: 'fixture/large',
    servers: [{ url: CHAT, serverName: 'chat.example', status: 'online' }] }]);
  // The Bot signs in with its own identity, and the chat server learns which local Bot stands behind it.
  const connect = calls.find(call => call.pathname.endsWith('/connect'));
  assert.deepEqual(JSON.parse(connect.init.body), { native: { hostId: status.hostId, nativeBotId: 'native-1' } });
  const node = JSON.parse(await readFile(path.join(directory, 'connection.json'), 'utf8')).nodes[account];
  assert.equal(node.centralId, bot.id);
  assert.equal(JSON.parse(await readFile(path.join(node.directory, 'core-config.json'), 'utf8')).nodeSecret, 'synthetic-node-key');
  // The owner's page sees it online without waiting for the next round.
  assert.deepEqual((await managed(bot.id)).runtime, { online: true, revision: bot.settings.revision + 1, model: 'fixture/large', servers: { [CHAT]: { status: 'online' } } });

  // Another round changes nothing.
  const before = kernel.length;
  await controller.synchronize();
  assert.equal(kernel.length, before);
  assert.equal(effects.length, 1);
});

test('a lost answer to creating a Bot is asked for again under the same request, so no second Bot appears', async t => {
  const { controller, login, createBot, managed, locals, kernel, api, alice } = await fixture(t, { loseFirstCreate: true });
  const bot = await createBot({ displayName: 'Helper', role: 'Notes', servers: [CHAT] });
  await login();
  // The first round's failure was reported, and the second round asked again by the same name.
  assert.match((await managed(bot.id)).runtime.error, /answer was lost/);
  const creates = kernel.filter(([endpoint]) => endpoint === 'create-bot').map(([, input]) => [input.requestId, input.name, input.role]);
  assert.equal(creates.length, 2);
  assert.deepEqual(creates[0], creates[1]);
  assert.equal(locals.length, 1);
  assert.deepEqual((await controller.handle({ action: 'status' })).bots[0].servers.map(server => server.status), ['online']);
  // An edit made meanwhile is applied to that one Bot.
  await api('PATCH', `/api/bots/${bot.id}`, { token: alice, body: { role: 'Minutes' } });
  await controller.synchronize();
  assert.deepEqual(locals.map(local => [local.id, local.role]), [['native-1', 'Minutes']]);
  assert.equal((await managed(bot.id)).runtime.error, undefined);
  assert.equal((await managed(bot.id)).runtime.servers[CHAT].status, 'online');
});

test('changes made on the web reach the local Bot: name, role, model and the servers it is on', async t => {
  const { controller, login, createBot, managed, locals, effects, kernel, api, alice } = await fixture(t);
  const bot = await createBot({ displayName: 'Helper', servers: [CHAT] });
  await login();
  assert.equal((await controller.handle({ action: 'status' })).bots[0].model, 'fixture/default', 'with no model chosen the device default runs');
  const change = async body => { await api('PATCH', `/api/bots/${bot.id}`, { token: alice, body }); await controller.synchronize(); };

  await change({ displayName: '纪要助手', role: '整理会议纪要', model: 'fixture/large', effort: 'high' });
  assert.deepEqual(kernel.filter(([endpoint]) => endpoint === 'update-bot').map(([, input]) => input),
    [{ id: 'native-1', name: '纪要助手', role: '整理会议纪要', model: 'fixture/large', effort: 'high' }]);
  assert.equal((await managed(bot.id)).runtime.model, 'fixture/large');
  assert.equal(effects.length, 1, 'a new model does not reconnect the Bot');

  // A model this device does not have, or has no credential for, is reported and the Bot keeps running as it was.
  await change({ model: 'elsewhere/model' });
  assert.match((await managed(bot.id)).runtime.error, /没有模型 elsewhere\/model/);
  await change({ model: 'fixture/locked' });
  assert.match((await managed(bot.id)).runtime.error, /还没有凭据/);
  assert.equal(locals[0].model, 'fixture/large');
  assert.equal((await managed(bot.id)).runtime.servers[CHAT].status, 'online');
  await change({ model: 'fixture/default' });
  assert.deepEqual([(await managed(bot.id)).runtime.error, locals[0].model], [undefined, 'fixture/default']);

  // One local Bot stands behind the account on every server.
  await change({ servers: [CHAT, TWO] });
  assert.deepEqual(effects.at(-1), ['start', `@${bot.username}:two.example`, 'native-1']);
  assert.deepEqual((await controller.handle({ action: 'status' })).bots[0].servers.map(server => [server.serverName, server.status]),
    [['chat.example', 'online'], ['two.example', 'online']]);
  await change({ servers: [TWO] });
  assert.deepEqual(effects.at(-1), ['stop', `@${bot.username}:chat.example`]);
  assert.deepEqual(Object.keys(controller.state.nodes), [`@${bot.username}:two.example`]);

  // A chat server that trusts another central server is refused, and only that server.
  await change({ servers: [TWO, ELSEWHERE] });
  const runtime = (await managed(bot.id)).runtime;
  assert.equal(runtime.servers[TWO].status, 'online');
  assert.deepEqual(runtime.servers[ELSEWHERE], { status: 'error', error: '这台聊天服务器接入的是另一个中央服务器' });
  assert.equal(locals.length, 1);
});

test('a connection that fails is retried later, and at once when the owner asks', async t => {
  const { controller, login, createBot, effects, refuse, advance } = await fixture(t);
  const bot = await createBot({ displayName: 'Helper', servers: [CHAT, TWO] });
  refuse.add(CHAT);
  await login();
  const view = async () => (await controller.handle({ action: 'status' })).bots[0].servers.map(server => [server.serverName, server.status, server.error]);
  assert.deepEqual(await view(), [['chat.example', 'error', 'Core is still starting'], ['two.example', 'online', undefined]]);
  refuse.delete(CHAT);
  await controller.synchronize();
  assert.equal((await view())[0][1], 'error', 'not retried within ten seconds');
  advance(10_001);
  await controller.synchronize();
  assert.deepEqual(await view(), [['chat.example', 'online', undefined], ['two.example', 'online', undefined]]);
  assert.deepEqual(effects.filter(([kind]) => kind === 'start').map(([, id]) => id),
    [`@${bot.username}:two.example`, `@${bot.username}:chat.example`]);

  // The page's refresh button does not wait for the retry time.
  refuse.add(TWO);
  controller.running.set(`@${bot.username}:two.example`, { status: 'error', lastError: 'Connection dropped' });
  await controller.synchronize();
  refuse.delete(TWO);
  assert.equal((await controller.handle({ action: 'sync' })).bots[0].servers[1].status, 'online');
});

test('a restart brings Bots back before the central server answers, and a quiet central server stops nothing', async t => {
  const { login, createBot, effects, down, reopen, controller } = await fixture(t);
  const bot = await createBot({ displayName: 'Helper', servers: [CHAT] });
  await login();
  await controller.dispose();
  effects.length = 0;
  down.add(centralUrl);
  const restored = await reopen();
  await restored.restoring;
  assert.deepEqual(effects, [['start', `@${bot.username}:chat.example`, 'native-1']]);
  await restored.synchronize();
  const status = await restored.handle({ action: 'status' });
  assert.equal(status.lastError, 'fetch failed');
  assert.deepEqual(status.bots[0].servers.map(server => server.status), ['online']);
  down.delete(centralUrl);
  await restored.synchronize();
  assert.equal((await restored.handle({ action: 'status' })).lastError, null);
  assert.equal(effects.length, 1);
});

test('unlinking stops the Bots and frees them for another device; the same person linking again finds the same local Bots', async t => {
  const { controller, login, createBot, managed, locals, effects, api, alice, register } = await fixture(t);
  const bot = await createBot({ displayName: 'Helper', servers: [CHAT] });
  await login();
  const account = `@${bot.username}:chat.example`;
  const out = await controller.handle({ action: 'logout' });
  assert.deepEqual([out.user, out.bots], [null, []]);
  assert.deepEqual(effects.at(-1), ['stop', account]);
  assert.deepEqual((await api('GET', '/api/devices', { token: alice })).devices, []);
  assert.equal((await managed(bot.id)).settings.deviceId, null);
  assert.equal(JSON.parse(await readFile(controller.filename, 'utf8')).centralToken, null);

  await login();
  assert.equal(locals.length, 1, 'the local Bot and its memory are the same as before');
  assert.deepEqual(effects.at(-1), ['start', account, 'native-1']);

  // Someone else linking this DSH gets none of the first person's Bots, and the first person's stop.
  const bob = await register('bob');
  await login(bob);
  assert.deepEqual(effects.at(-1), ['stop', account]);
  assert.deepEqual((await controller.handle({ action: 'status' })).bots, []);
  assert.deepEqual(controller.state.nativeLinks, {});
  assert.equal((await managed(bot.id)).settings.deviceId, null);
});

test('a Bot moved to another device, or a session the owner ended, stops here', async t => {
  const { controller, login, createBot, effects, api, alice } = await fixture(t);
  const bot = await createBot({ displayName: 'Helper', servers: [CHAT] });
  await login();
  const account = `@${bot.username}:chat.example`;
  await api('POST', '/api/devices/desktop-0002/sync', { token: alice, body: { label: 'DSH desktop', report: {} } });
  await api('PATCH', `/api/bots/${bot.id}`, { token: alice, body: { deviceId: 'desktop-0002' } });
  await controller.synchronize();
  assert.deepEqual(effects.at(-1), ['stop', account]);
  assert.deepEqual((await controller.handle({ action: 'status' })).bots, []);
  await api('PATCH', `/api/bots/${bot.id}`, { token: alice, body: { deviceId: controller.state.hostId } });
  await controller.synchronize();
  assert.deepEqual(effects.at(-1), ['start', account, 'native-1']);

  await api('POST', '/api/logout', { token: controller.state.centralToken, body: {} });
  await controller.synchronize();
  const status = await controller.handle({ action: 'status' });
  assert.deepEqual([status.user, status.bots], [null, []]);
  assert.deepEqual(effects.at(-1), ['stop', account]);
});

test('the connect page still reaches the decision service settings and plugin upgrades, and nothing else', async t => {
  const received = [];
  const steps = [];
  const updates = {
    view: () => ({ current: '0.4.0', available: '0.5.0', compatible: true, policy: 'notify' }),
    check: async options => { steps.push(['check', options]); return { available: '0.5.0' }; },
    setPolicy: async input => { steps.push(['policy', input]); return { policy: input.policy }; },
    install: () => { steps.push(['install']); return { phase: 'installing' }; },
  };
  const { controller, login, api, alice } = await fixture(t, { updates, processes: {
    async saveDecisionProvider(settings) { received.push(settings); return { configured: true, model: settings.model }; },
  } });
  const input = { apiKey: 'synthetic-private-decision-key', enabled: true, model: 'company/decision-v2', endpoint: 'https://decision.example/v2/decisions' };
  const saved = await controller.handle({ action: 'save-decision-provider', ...input });
  assert.deepEqual(received, [input]);
  assert.equal(JSON.stringify(saved).includes(input.apiKey), false);
  assert.equal((await controller.handle({ action: 'kernel-state' })).decisionProvider.configured, false);

  assert.equal((await controller.handle({ action: 'status' })).kernelUpdates.available, '0.5.0');
  await controller.handle({ action: 'kernel-update-check' });
  await controller.handle({ action: 'kernel-update-policy', policy: 'auto', channel: 'stable' });
  assert.equal((await controller.handle({ action: 'kernel-update-install' })).phase, 'installing');
  assert.deepEqual(steps, [['check', { fresh: true }], ['policy', { policy: 'auto', channel: 'stable' }], ['install']]);
  await login();
  assert.deepEqual((await api('GET', '/api/devices', { token: alice })).devices[0].plugin, { version: '0.4.0', available: '0.5.0', compatible: true });

  // Setting Bots up is the web's job: the page's old actions are gone.
  for (const action of ['create-native', 'attach', 'connect', 'disconnect', 'add-server', 'remove-server', 'save-model', 'attention-update', 'kernel-update-everything']) {
    await assert.rejects(controller.handle({ action }), /未知连接操作/);
  }
});
