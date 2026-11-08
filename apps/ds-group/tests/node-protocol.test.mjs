import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createCore } from '../src/core.mjs';
import { KERNEL_PROTOCOL, KERNEL_VERSION, NODE_PROTOCOL, accepts, answerHello, hello, parseProtocol, supports } from '../src/node-protocol.mjs';

test('protocol versions parse strictly and ranges compare by major then minor', () => {
  assert.deepEqual(parseProtocol('1.12'), { major: 1, minor: 12 });
  for (const bad of ['1', '1.0.0', '01.0', 'v1.0', '', null, 1.0]) assert.throws(() => parseProtocol(bad), { code: 'PROTOCOL_INVALID' });
  assert.equal(supports({ min: '1.0', max: '1.3' }, '1.2'), true);
  assert.equal(supports({ min: '1.0', max: '1.3' }, '1.4'), false);
  assert.equal(supports({ min: '1.2', max: '2.0' }, '1.10'), true);
  assert.equal(supports({ min: '1.2', max: '2.0' }, '1.1'), false);
  assert.equal(supports(KERNEL_PROTOCOL, NODE_PROTOCOL), true, 'this kernel speaks the protocol of the Core it ships with');
});

test('Core accepts a node on its own major up to its own minor, and a node that names no protocol speaks the baseline', () => {
  assert.equal(accepts('1.2', '1.0'), true);
  assert.equal(accepts('1.2', '1.2'), true);
  assert.equal(accepts('1.2', '1.3'), false);
  assert.equal(accepts('1.2', '2.0'), false);
  assert.equal(accepts('2.0', undefined), false);
  assert.equal(accepts('1.0', undefined), true);
  assert.equal(accepts('1.0', 'garbage'), false);
});

test('hello answers with the server protocol, and an incompatible kernel still learns which protocol to look for', () => {
  const input = version => ({ botId: '@a:t', nodeId: 'a', kernel: { version, protocol: { min: '1.0', max: '1.1' }, capabilities: [] } });
  assert.deepEqual(answerHello(input('0.5.0'), { protocol: '1.1', capabilities: ['kernel-control'], serverVersion: '0.4.0' }),
    { status: 200, body: { protocol: '1.1', capabilities: ['kernel-control'], server: { version: '0.4.0' } } });
  const refused = answerHello(input('0.5.0'), { protocol: '2.0', serverVersion: '0.9.0' });
  assert.equal(refused.status, 426);
  assert.equal(refused.body.code, 'PROTOCOL_UPGRADE_REQUIRED');
  assert.equal(refused.body.protocol, '2.0');
});

function answering(status, body) {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url: String(url), body: JSON.parse(init.body) });
    return new Response(body === undefined ? 'not json' : JSON.stringify(body), { status }); };
  return { calls, fetchImpl };
}

test('the node side of hello handles a current server, an older server without hello, and a server it cannot speak to', async () => {
  const base = { coreUrl: 'http://core.test', nodeSecret: 'secret', botId: '@a:t', nodeId: 'a', capabilities: ['kernel-control'] };
  const current = answering(200, { protocol: '1.0', capabilities: ['kernel-control'], server: { version: '0.4.0' } });
  assert.deepEqual(await hello({ ...base, fetchImpl: current.fetchImpl }), { protocol: '1.0', capabilities: ['kernel-control'], server: { version: '0.4.0' } });
  assert.equal(current.calls[0].url, 'http://core.test/internal/node/hello');
  assert.deepEqual(current.calls[0].body.kernel, { version: KERNEL_VERSION, protocol: KERNEL_PROTOCOL, capabilities: ['kernel-control'] });

  const old = answering(404, undefined);
  assert.deepEqual(await hello({ ...base, fetchImpl: old.fetchImpl }), { protocol: '1.0', capabilities: ['kernel-control'], server: null });
  await assert.rejects(hello({ ...base, fetchImpl: old.fetchImpl, range: { min: '2.0', max: '2.1' } }), { code: 'PROTOCOL_SERVER_TOO_OLD', protocol: '1.0' });

  const newer = answering(426, { code: 'PROTOCOL_UPGRADE_REQUIRED', protocol: '2.0' });
  await assert.rejects(hello({ ...base, fetchImpl: newer.fetchImpl }), { code: 'PROTOCOL_UPGRADE_REQUIRED', protocol: '2.0' });

  const lying = answering(200, { protocol: '3.0', capabilities: [] });
  await assert.rejects(hello({ ...base, fetchImpl: lying.fetchImpl }), { code: 'PROTOCOL_UPGRADE_REQUIRED' });
});

test('Core serves hello to its own nodes and refuses a heartbeat in a protocol it does not speak', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ds-group-hello-'));
  const setup = { homeserverUrl: 'http://127.0.0.1:1', roomId: '!demo:test', participants: [
    { id: '@alice:test', localpart: 'alice', name: 'Alice', kind: 'human', accessToken: 'synthetic-alice-token' },
    { id: '@finance:test', localpart: 'finance', name: 'Finance', kind: 'bot', accessToken: 'synthetic-bot-token' },
  ] };
  const core = await createCore({ setup, config: { nodeSecret: 'synthetic-node-secret', modelCallLimit: null, maxOutputTokens: 8192 }, dataRoot: directory, enablePush: false });
  await new Promise(resolve => core.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${core.server.address().port}`;
  const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer synthetic-node-secret' };
  const post = (route, body) => fetch(base + route, { method: 'POST', headers, body: JSON.stringify(body) });
  try {
    assert.equal((await post('/internal/node/hello', { botId: '@finance:test' })).status, 400);
    const session = await hello({ coreUrl: base, nodeSecret: 'synthetic-node-secret', botId: '@finance:test', nodeId: 'finance', capabilities: ['kernel-control'] });
    assert.equal(session.protocol, NODE_PROTOCOL);
    assert.deepEqual(session.capabilities, ['kernel-control']);
    const future = await post('/internal/node/hello', { botId: '@finance:test', nodeId: 'finance', kernel: { version: '9.0.0', protocol: { min: '9.0', max: '9.0' } } });
    assert.equal(future.status, 426);
    assert.equal((await future.json()).protocol, NODE_PROTOCOL);

    const identity = { id: 'finance', botId: '@finance:test', runtimeId: 'run-one', status: 'idle' };
    const ahead = await post('/internal/nodes/heartbeat', { ...identity, protocol: '9.0' });
    assert.equal(ahead.status, 426);
    assert.equal((await post('/internal/nodes/heartbeat', { ...identity, protocol: NODE_PROTOCOL, kernelVersion: '0.5.0' })).status, 200);
    const status = await (await fetch(base + '/api/status')).json();
    assert.equal(status.core.nodeProtocol, NODE_PROTOCOL);
    assert.equal(status.nodes[0].protocol, NODE_PROTOCOL);
    assert.equal(status.nodes[0].kernelVersion, '0.5.0');
  } finally {
    await core.close();
    await rm(directory, { recursive: true, force: true });
  }
});
