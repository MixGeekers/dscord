import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { NativeBridge } from '../dsh-connect/native-bridge.mjs';
import { NativeBots } from '../dsh-connect/native-bots.mjs';
import { parseBotOutput } from '../src/bot-node.mjs';

async function fixture(t, { idle = Promise.resolve(), send, cwd, beforeObserve, beforeView } = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'native-bridge-'));
  const handlers = new Map(); let cancelled = 0; let turn = 0;
  const ctx = { get(name) { return name === 'workingDirectory' && cwd ? { get: () => cwd } : undefined; }, on(name, handler) { handlers.set(name, handler); return () => handlers.delete(name); } };
  const native = new NativeBots(ctx);
  native.bot = async () => ({ id: 'native-one', name: 'Original', role: 'Research', sessionId: 'native-one', model: 'dsh/model' });
  native.agent = async () => ({ whenIdle: () => idle, cancel: () => cancelled++, ctx: { tools: { schemas: () => ['create_bot','remember','bash'].map(name => ({ name })) } } });
  const calls = [];
  const event = async (type, data, sessionId = 'native-one') => handlers.get('session/event')?.({ id: sessionId }, { type, data });
  native.call = async (endpoint, payload) => {
    if (endpoint === 'observe') { await beforeObserve?.(); return { accepted: payload.inputs.length }; }
    if (endpoint === 'attention-view') { await beforeView?.(); return { schema: 2, currentClaims: [], recentSources: [], historyGaps: [] }; }
    assert.equal(endpoint, 'send');
    assert.equal(payload.requestId, JSON.parse(payload.text.split('\n').at(-1)).requestId);
    calls.push(JSON.parse(payload.text.split('\n').at(-1))); turn++;
    await event('turn/start', { turn });
    await event('user/message', { content: [{ type: 'text', text: payload.text }], source: payload.source });
    if (send) return send({ event, turn, payload });
    await event('assistant/message', { turn, message: { content: [{ type: 'text', text: calls.at(-1).currentMessage.body }] } });
    await event('turn/end', { turn, reason: { kind: 'completed' } });
  };
  const node = { id: '@native:home.test', nativeBotId: 'native-one', directory };
  const bridge = await new NativeBridge({ ctx, native, node, timeoutMs: 2000 }).initialize();
  t.after(async () => { await bridge.detach(); await rm(directory, { recursive: true, force: true }); });
  const request = (id, room = '!a:home.test') => ({ requestId: id, botId: node.id,
    event: { roomId: room, eventId: `$${id}`, senderId: '@same:home.test', senderName: 'Same', senderKind: 'human', body: `Reply for ${room}` } });
  return { bridge, native, node, calls, event, handlers, request, cancelled: () => cancelled };
}

test('native inputs keep original tools, distinguish interleaved rooms and persist retries without generation', async t => {
  const f = await fixture(t);
  assert.deepEqual((await f.bridge.createBot({ botId: f.node.id })).tools, ['create_bot','remember','bash']);
  const a = f.request('one'); const b = f.request('two', '!b:other.test');
  const [first, second] = await Promise.all([f.bridge.turn(a), f.bridge.turn(b)]);
  assert.equal(first.text, 'Reply for !a:home.test'); assert.equal(second.text, 'Reply for !b:other.test');
  assert.equal(first.sessionId, second.sessionId);
  assert.notEqual(f.calls[0].context.key, f.calls[1].context.key);
  assert.equal(f.calls[1].replyRoute.eventId, '$two');
  await f.bridge.turn(a); assert.equal(f.calls.length, 2);
  await f.bridge.detach();
  const restarted = await new NativeBridge({ ctx: { on: () => () => {} }, native: f.native, node: f.node }).initialize();
  assert.equal((await restarted.turn(a)).text, first.text);
  await assert.rejects(restarted.turn({ ...a, event: { ...a.event, body: 'changed' } }), { code: 'REQUEST_ID_CONFLICT' });
  await restarted.detach();
});

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const deadline = promise => Promise.race([promise, new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Cancellation did not settle')), 1500); timer.unref(); })]);

for (const stage of ['beforeObserve', 'beforeView']) {
  test(`cancellation during ${stage} never sends the task or cancels unrelated native work`, async t => {
    const entered = deferred(), gate = deferred();
    const f = await fixture(t, { [stage]: async () => { entered.resolve(); await gate.promise; } });
    const pending = f.bridge.turn(f.request(`cancel-${stage}`)); await entered.promise;
    await f.bridge.cancel(`cancel-${stage}`); gate.resolve();
    const result = await pending;
    assert.equal(result.status, 'cancelled'); assert.equal(f.calls.length, 0); assert.equal(f.cancelled(), 0);
  });
  test(`detach during ${stage} drains the request without a later send`, async t => {
    const entered = deferred(), gate = deferred();
    const f = await fixture(t, { [stage]: async () => { entered.resolve(); await gate.promise; } });
    const pending = f.bridge.turn(f.request(`detach-${stage}`)); await entered.promise;
    await deadline(f.bridge.detach());
    assert.equal((await pending).status, 'unknown'); gate.resolve(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.calls.length, 0); assert.equal(f.cancelled(), 0);
  });
}

test('task control cancels while the native Bot remains busy without cancelling that other work', async t => {
  const f = await fixture(t, { idle: new Promise(() => {}) });
  const pending = f.bridge.turn(f.request('cancel-before-idle'), { control: async () => ({ cancelRequested: true }) });
  const result = await deadline(pending);
  assert.equal(result.status, 'cancelled'); assert.equal(f.calls.length, 0); assert.equal(f.cancelled(), 0);
});

test('an aborted transport settles its queued task before another binding releases the native queue', async t => {
  const f = await fixture(t), ahead = deferred(), started = deferred();
  const blocking = f.native.enqueue(f.node.nativeBotId, () => { started.resolve(); return ahead.promise; });
  await started.promise;
  const controller = new AbortController();
  const pending = f.bridge.turn(f.request('abort-queued'), { signal: controller.signal });
  await new Promise(resolve => setTimeout(resolve, 10)); controller.abort();
  try {
    assert.equal((await deadline(pending)).status, 'unknown'); assert.equal(f.calls.length, 0);
  } finally { ahead.resolve(); await blocking; await pending; }
});

test('cancellation during native admission waits for admission and then stops this actual turn', async t => {
  const entered = deferred(), gate = deferred();
  const f = await fixture(t, { send: async () => { entered.resolve(); await gate.promise; } });
  const pending = f.bridge.turn(f.request('cancel-admission')); await entered.promise;
  await f.bridge.cancel('cancel-admission'); assert.equal(f.cancelled(), 0);
  gate.resolve(); const result = await pending;
  assert.equal(result.status, 'cancelled'); assert.equal(f.cancelled(), 1); assert.equal(f.calls.length, 1);
});

test('a cancellation lookup that finishes after the native turn does not cancel different work', async t => {
  const f = await fixture(t, { send: async () => {} }), lookup = deferred(), gate = deferred();
  const agentOf = f.native.agent;
  const pending = f.bridge.turn(f.request('late-cancel'));
  while (!f.bridge.run?.sent) await new Promise(resolve => setImmediate(resolve));
  f.native.agent = async id => { lookup.resolve(); await gate.promise; return agentOf(id); };
  const cancellation = f.bridge.cancel('late-cancel'); await lookup.promise;
  await f.event('assistant/message', { turn: 1, message: { content: [{ type: 'text', text: 'Finished before lookup.' }] } });
  await f.event('turn/end', { turn: 1, reason: { kind: 'completed' } });
  gate.resolve(); await cancellation; await pending;
  assert.equal(f.cancelled(), 0);
});

test('cancellation removes its own admitted inbox item and leaves unrelated native work running', async t => {
  const f = await fixture(t), inbox = [{ id: 'unrelated', source: { rpcId: 'someone-else' } }]; let cancelled = 0;
  f.native.agent = async () => ({ whenIdle: async () => {}, cancel: () => cancelled++, session: { id: 'native-one' },
    inbox: { nextTurn: inbox, nextStep: [], remove(id) { const index = inbox.findIndex(message => message.id === id); if (index >= 0) inbox.splice(index, 1); } } });
  const call = f.native.call;
  f.native.call = async (endpoint, payload) => {
    if (endpoint !== 'send') return call(endpoint, payload);
    inbox.push({ id: 'mine', source: { rpcId: payload.requestId }, content: [{ type: 'text', text: payload.text }] });
  };
  const pending = f.bridge.turn(f.request('cancel-inbox'));
  while (!f.bridge.run?.sent) await new Promise(resolve => setImmediate(resolve));
  await f.bridge.cancel('cancel-inbox'); assert.equal((await pending).status, 'cancelled');
  assert.deepEqual(inbox.map(message => message.id), ['unrelated']); assert.equal(cancelled, 0);
});

test('disconnect while original Bot is busy returns promptly and never cancels its native work', async t => {
  const f = await fixture(t, { idle: new Promise(() => {}) });
  const pending = f.bridge.turn(f.request('waiting'));
  while (!f.bridge.waiting) await new Promise(resolve => setTimeout(resolve, 1));
  await f.bridge.detach();
  assert.equal((await pending).status, 'unknown');
  assert.equal(f.cancelled(), 0); assert.equal(f.calls.length, 0);
});

test('native handoff follows its exchange and ignores an unrelated local conversation', async t => {
  const f = await fixture(t, { send: async ({ event, turn }) => {
    await event('user/message', { source: { kind: 'bot', role: 'request', senderSessionId: 'native-one', exchangeId: 'work-1' } }, 'native-peer');
    await event('assistant/message', { turn, message: { content: [{ type: 'text', text: '[HANDOFF_WAIT]' }] } });
    await event('turn/end', { turn, reason: { kind: 'completed' } });
    await event('turn/start', { turn: 99 });
    await event('user/message', { content: [{ type: 'text', text: 'Local user request' }], source: { kind: 'user' } });
    await event('user/message', { source: { kind: 'bot', role: 'request', senderSessionId: 'native-one', exchangeId: 'unrelated-work' } }, 'native-peer');
    await event('assistant/message', { turn: 99, message: { content: [{ type: 'text', text: 'Local-only answer' }] } });
    await event('turn/end', { turn: 99, reason: { kind: 'completed' } });
    await event('turn/start', { turn: 101 });
    await event('user/message', { source: { kind: 'bot', role: 'reply', replyTo: 'unrelated-work' } });
    await event('assistant/message', { turn: 101, message: { content: [{ type: 'text', text: 'Unrelated delegated answer' }] } });
    await event('turn/end', { turn: 101, reason: { kind: 'completed' } });
    await event('turn/start', { turn: 100 });
    await event('user/message', { source: { kind: 'bot', role: 'reply', replyTo: 'work-1' } });
    await event('assistant/message', { turn: 100, message: { content: [{ type: 'text', text: 'Delegated result' }] } });
    await event('turn/end', { turn: 100, reason: { kind: 'completed' } });
  } });
  const result = await f.bridge.turn(f.request('handoff'));
  assert.equal(result.status, 'completed'); assert.equal(result.text, 'Delegated result');
});

test('usage observation cannot fail or restrict a native model stream', async t => {
  const f = await fixture(t);
  f.bridge.run = { seen: true, record: { sessionId: 'native-one', calls: [] } };
  const save = f.bridge.save; f.bridge.save = async () => { throw new Error('synthetic persistence outage'); };
  const chunks = [];
  for await (const chunk of f.bridge.observeUsage({ sessionId: 'native-one', provider: 'native', model: 'model' }, async function* () { yield { type: 'text', text: 'unchanged' }; })) chunks.push(chunk);
  assert.deepEqual(chunks, [{ type: 'text', text: 'unchanged' }]);
  f.bridge.save = save; f.bridge.run = null;
});

test('native account quota failures remain distinguishable from other failed turns', async t => {
  let failure={code:'QUOTA',message:'429: {"type":"GoUsageLimitError","message":"Go usage limit exceeded"}'};
  const f=await fixture(t,{send:async({event,turn})=>{
    await event('turn/end',{turn,reason:{kind:'error',error:failure}});
  }});
  const blocked=await f.bridge.turn(f.request('quota'));
  assert.equal(blocked.status,'failed');assert.equal(blocked.errorCode,'MODEL_QUOTA_EXCEEDED');
  assert.deepEqual(blocked.nativeFailure,failure);
  failure={code:'INVALID_REQUEST',message:'Invalid tool id'};
  assert.equal((await f.bridge.turn(f.request('other-error'))).errorCode,'NATIVE_TURN_FAILED');
});

test('a native context-part handoff keeps the request and does not publish its acknowledgement', async t => {
  const f = await fixture(t, { send: async ({ event, turn }) => {
    await event('assistant/message', { turn, message: { content: [{ type: 'text', text: 'Still working' }] } });
    await event('turn/end', { turn, reason: { kind: 'blocked' } });
    f.native.bot = async () => ({ id: 'native-one', sessionId: 'native-next', model: 'dsh/model' });
    await event('turn/start', { turn: 2 }, 'native-next');
    await event('user/message', { source: { kind: 'bot', handoff: true, resume: true } }, 'native-next');
    await event('assistant/message', { turn: 2, message: { content: [{ type: 'text', text: 'Noted. I have my handoff note and carry on from here.' }] } }, 'native-next');
    await event('assistant/message', { turn: 2, message: { content: [{ type: 'text', text: 'Final result after native context handoff' }] } }, 'native-next');
    await event('turn/end', { turn: 2, reason: { kind: 'completed' } }, 'native-next');
  } });
  const result = await f.bridge.turn(f.request('part-switch'));
  assert.equal(result.status, 'completed'); assert.equal(result.sessionId, 'native-next');
  assert.equal(result.text, 'Final result after native context handoff');
});

test('ordinary delegation acknowledgements wait for all correlated native replies', async t => {
  let replyWork;
  const f = await fixture(t, { send: async ({ event, turn }) => {
    for (const exchangeId of ['first', 'second']) await event('user/message', { source: {
      kind: 'bot', role: 'request', senderSessionId: 'native-one', exchangeId,
    } }, 'native-peer');
    await event('assistant/message', { turn, message: { content: [{ type: 'text', text: 'I delegated the work and will pass on the results later.' }] } });
    await event('turn/end', { turn, reason: { kind: 'completed' } });
    // Return from send before either reply, as the real native tool does.
    replyWork = (async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
      await event('turn/start', { turn: 2 });
      await event('user/message', { source: { kind: 'bot', role: 'reply', replyTo: 'first' } });
      await event('assistant/message', { turn: 2, message: { content: [{ type: 'text', text: 'The first answer is 437; still waiting for the second.' }] } });
      await event('turn/end', { turn: 2, reason: { kind: 'completed' } });
      await new Promise(resolve => setTimeout(resolve, 20));
      await event('turn/start', { turn: 3 });
      await event('user/message', { source: { kind: 'bot', role: 'reply', replyTo: 'second' } });
      await event('assistant/message', { turn: 3, message: { content: [{ type: 'text', text: 'Both actual answers: 437 and 391.' }] } });
      await event('turn/end', { turn: 3, reason: { kind: 'completed' } });
    })();
  } });
  const result = await f.bridge.turn(f.request('await-delegation')); await replyWork;
  assert.equal(result.status, 'completed'); assert.equal(result.text, 'Both actual answers: 437 and 391.');
});

test('native direct-to-user delegation does not wait for a reply to the originating Bot', async t => {
  const f = await fixture(t, { send: async ({ event, turn }) => {
    await event('user/message', { source: { kind: 'bot', role: 'request', senderSessionId: 'native-one', exchangeId: 'direct', audience: 'user' } }, 'native-peer');
    await event('assistant/message', { turn, message: { content: [{ type: 'text', text: 'The Bot will answer you in its own native chat.' }] } });
    await event('turn/end', { turn, reason: { kind: 'completed' } });
  } });
  const result = await f.bridge.turn(f.request('direct-user'));
  assert.equal(result.status, 'completed'); assert.equal(result.text, 'The Bot will answer you in its own native chat.');
});

test('ordinary structured native answers are kept verbatim through the native and chat output parsers', async t => {
  let answer;
  const f = await fixture(t, { send: async ({ event, turn }) => {
    await event('assistant/message', { turn, message: { content: [{ type: 'text', text: answer }] } });
    await event('turn/end', { turn, reason: { kind: 'completed' } });
  } });
  const answers = [JSON.stringify({ value: '苍鹭-7321', roomId: '!north:memory.test', speakerId: '@lin:a.test' }), '[1,2,3]', '437', 'true', 'null', '"quoted data"'];
  for (const [index, value] of answers.entries()) {
    answer = value;
    const result = await f.bridge.turn(f.request(`ordinary-data-${index}`));
    assert.equal(result.status, 'completed'); assert.equal(result.text, answer); assert.deepEqual(result.artifacts, []);
    assert.deepEqual(parseBotOutput(result.text, f.node.id, []), { text: answer });
  }
});

test('the front never publishes files, even when its answer names or links one', async t => {
  const f = await fixture(t, { send: async ({ event, turn }) => {
    await event('assistant/message', { turn, message: { content: [{ type: 'text', text: '{"text":"see","artifacts":[{"path":"/etc/hostname"}]}' }] } });
    await event('turn/end', { turn, reason: { kind: 'completed' } });
  } });
  const result = await f.bridge.turn(f.request('front-no-files'));
  assert.equal(result.status, 'completed'); assert.deepEqual(result.artifacts, []);
});

test('a worker-result turn delivers exactly the files the core verified for that task', async t => {
  const f = await fixture(t);
  const file = { path: path.join(f.node.directory, 'report.csv'), name: 'report.csv', size: 3, sha256: 'a'.repeat(64), mimeType: 'text/csv' };
  f.bridge.state.tasks['T-1'] = { id: 'T-1', title: 'CSV', status: 'done', artifacts: [file], origin: { roomId: '!a:home.test', eventId: '$origin' } };
  const request = f.request('worker-result');
  const result = await f.bridge.turn({ ...request, event: { ...request.event, kind: 'task.result', workerTask: 'T-1' } });
  assert.equal(result.status, 'completed'); assert.deepEqual(result.artifacts, [file]);
});
