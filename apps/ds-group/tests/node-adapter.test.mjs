import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BotNode, parseBotOutput, deliveriesFor, createBridge, acquireNodeLock } from '../src/bot-node.mjs';
import { NodeStore } from '../src/node-store.mjs';
import { createScriptDecisionProvider } from '../src/decision-provider.mjs';

const participants = [
  { id: '@alice:ds-group.local', localpart: 'alice', name: 'Alice', kind: 'human' },
  { id: '@bob:ds-group.local', localpart: 'bob', name: 'Bob', kind: 'human' },
  { id: '@finance:ds-group.local', localpart: 'finance', name: '财务', kind: 'bot' },
  { id: '@hr:ds-group.local', localpart: 'hr', name: '人事', kind: 'bot' },
];
const finance = participants[2];
const hr = participants[3];
const roomId = '!group:ds-group.local';
const event = (id, metadata = {}, extra = {}) => ({ event_id: id, type: 'm.room.message', room_id: roomId,
  sender: participants[0].id, content: { body: '请核算 100 + 200', 'org.ds_group': { to: [finance.id], ...metadata } }, ...extra });

function fixture({ matrix = {}, bridge = {} } = {}) {
  const store = new NodeStore(':memory:', finance.id);
  const node = new BotNode({ participant: finance, participants, roomId, store, matrix, bridge,
    heartbeat: async () => {}, pollTimeout: 0, onError: () => {} });
  return { node, store };
}

test('heartbeat refreshes the model after an independent runtime restart and clears an unavailable model', async () => {
  let model = 'first/chat';
  const bridge = createBridge('http://fixture.invalid', { fetchImpl: async url => {
    assert.equal(url.pathname, '/api/ds-group-node/status');
    if (!model) throw new Error('runtime restarting');
    return Response.json({ model });
  } });
  const { node, store } = fixture({ bridge });
  const sent = [];
  node.sendHeartbeat = async heartbeat => sent.push(heartbeat);
  try {
    await node.heartbeat();
    model = 'second/team/chat';
    await node.heartbeat();
    model = null;
    await node.heartbeat();
    assert.deepEqual(sent.map(heartbeat => heartbeat.model), ['first/chat', 'second/team/chat', null]);
  } finally { store.close(); }
});

test('heartbeat reports observed runtime identity and version without inventing a legacy version during outages', async () => {
  let available = true;
  const { node, store } = fixture({ bridge: { runtimeStatus: async () => {
    if (!available) throw new Error('offline');
    return { model: 'synthetic/model', mode: 'native', runtime: { id: 'dscord-kernel', version: 'observed-test-version' } };
  } } });
  node.executionMode = 'native';
  const sent = []; node.sendHeartbeat = async heartbeat => sent.push(heartbeat);
  try {
    await node.heartbeat(); available = false; await node.heartbeat();
    assert.equal(sent[0].engine, 'DSCord kernel observed-test-version');
    assert.equal(sent[1].engine, 'Native Bot runtime');
    assert.equal(sent[1].engine.includes('0.2.7'), false);
    const legacy = fixture();
    try {
      legacy.node.sendHeartbeat = async heartbeat => sent.push(heartbeat);
      await legacy.node.heartbeat();
      assert.equal(sent[2].engine, 'Bot bridge (legacy)');
    } finally { legacy.store.close(); }
  } finally { store.close(); }
});

test('synthetic response protocol accepts text/JSON and validates explicit delegation', () => {
  assert.deepEqual(parseBotOutput('普通回复', finance.id, participants), { text: '普通回复' });
  assert.deepEqual(parseBotOutput('```json\n{"text":"收到","delegate":{"to":"@hr:ds-group.local","body":"整理名单"}}\n```', finance.id, participants),
    { text: '收到', delegate: { to: hr.id, body: '整理名单' } });
  // A handoff that cannot go out is said in the reply instead of failing it (nothing reached the asker before).
  for (const to of ['@finance:ds-group.local', '@alice:ds-group.local', '@nobody:ds-group.local']) {
    assert.deepEqual(parseBotOutput(`{"text":"x","delegate":{"to":"${to}","body":"x"}}`, finance.id, participants),
      { text: 'x\n\n（这次没能转交出去：对方不在我能联系的 Bot 里。）' });
  }
  // Script 02 G14 retest: extra fields such as audience go into the request; a display name resolves to the full ID.
  assert.deepEqual(parseBotOutput('{"text":"收到","delegate":{"to":"人事","body":"看日志","audience":"玩家小满：通俗说明"}}', finance.id, participants),
    { text: '收到', delegate: { to: hr.id, body: '看日志\n\naudience：玩家小满：通俗说明' } });
  // Script 02 G18 retest: a remote Bot whose roster name is its full ID is still found by its room label.
  const cold = [...participants.filter(person => person.id !== hr.id), { id: hr.id, name: hr.id, kind: 'bot' }];
  assert.equal(parseBotOutput(`好的。\n@${hr.name} 写两段`, finance.id, cold).delegate, undefined);
  assert.deepEqual(parseBotOutput(`好的。\n@${hr.name} 写两段`, finance.id, [...cold, { id: hr.id, name: hr.name, kind: 'bot' }]).delegate,
    { to: hr.id, body: '写两段' });
  assert.throws(() => parseBotOutput('{"delegate":{"to":"@hr:ds-group.local","body":"x"}}', finance.id, participants), /non-empty text/);
  // Script 02 G18: an unescaped quote inside the delegation body must not drop the
  // delegation and post the raw JSON to the room.
  assert.deepEqual(parseBotOutput('{"text":"收到，我去找人事","delegate":{"to":"@hr:ds-group.local","body":"不能拿"氛围词"顶上,\n要具体"}}', finance.id, participants),
    { text: '收到，我去找人事', delegate: { to: hr.id, body: '不能拿"氛围词"顶上,\n要具体' } });
  assert.throws(() => parseBotOutput('{"text":"收到","delegate":{"to":"@hr:ds-group.local","body":"a", "b"}}', finance.id, participants), /not valid JSON/);
  // Script 02 G18 retest: a handoff written as chat ("@人事 …" on its own line) becomes the delegation.
  assert.deepEqual(parseBotOutput(`唐，我这就去要。\n\n@${hr.name} 唐要两段简介，\n各 50 字`, finance.id, participants),
    { text: '唐，我这就去要。', delegate: { to: hr.id, body: '唐要两段简介，\n各 50 字' } });
  assert.deepEqual(parseBotOutput(`@${hr.name} 你好`, finance.id, participants, { handoff: false }), { text: `@${hr.name} 你好` });
  assert.deepEqual(parseBotOutput(`我刚和 @${hr.name} 聊过`, finance.id, participants), { text: `我刚和 @${hr.name} 聊过` });
  // Ordinary text that merely starts with a brace is still chat content.
  assert.deepEqual(parseBotOutput('{a, b} 是两个元素', finance.id, participants), { text: '{a, b} 是两个元素' });
});

test('synthetic delegation produces stable transactions and result routing returns once to the requesting Bot', () => {
  const original = event('$alice', { to: [hr.id] });
  const deliveries = deliveriesFor(original, { text: '财务帮忙核算', delegate: { to: finance.id, body: '100+200' } }, hr.id, participants);
  assert.equal(deliveries.length, 2);
  assert.deepEqual(deliveries[1].options.to, [finance.id]);
  assert.equal(deliveries[1].options.returnTo, hr.id);
  assert.equal(deliveries[1].options.originSenderId, participants[0].id);
  assert.equal(deliveries[1].options.kind, 'task.request');
  assert.deepEqual(deliveriesFor(original, { text: '财务帮忙核算', delegate: { to: finance.id, body: '100+200' } }, hr.id, participants), deliveries);
  const requested = event('$hr', deliveries[1].options, { sender: hr.id });
  const result = deliveriesFor(requested, { text: '300' }, finance.id, participants)[0];
  assert.deepEqual(result.options.to, [hr.id]);
  assert.equal(result.options.kind, 'task.result');
  const returned = event('$finance', result.options, { sender: finance.id });
  const summary = deliveriesFor(returned, { text: 'Alice，结果是300' }, hr.id, participants)[0];
  assert.deepEqual(summary.options.to, []);
  assert.equal(summary.options.taskId, deliveries[1].options.taskId);
  assert.throws(() => deliveriesFor(event('$loop', { hop: 4 }), { text: '继续', delegate: { to: hr.id, body: '继续' } }, finance.id, participants), /hop limit/);
});

test('synthetic private-chat delegation goes through the shared room and returns to the original private message', () => {
  const dmRoom = '!alice-hr:ds-group.local';
  const original = event('$private-request', { to: [hr.id] }, { room_id: dmRoom });
  const deliveries = deliveriesFor(original, { text: '请财务核算', delegate: { to: finance.id, body: '100+200' } }, hr.id, participants, roomId);
  assert.equal(deliveries[0].roomId, dmRoom);
  assert.equal(deliveries[0].options.replyTo, '$private-request');
  const delegation = deliveries[1];
  assert.equal(delegation.roomId, roomId);
  assert.equal(delegation.options.replyTo, undefined);
  assert.equal(delegation.options.originRoomId, dmRoom);
  assert.equal(delegation.options.originEventId, '$private-request');
  const requested = event('$hr-delegate', delegation.options, { sender: hr.id });
  const result = deliveriesFor(requested, { text: '300' }, finance.id, participants, roomId)[0];
  assert.equal(result.roomId, roomId);
  assert.equal(result.options.replyTo, '$hr-delegate');
  assert.deepEqual(result.options.to, [hr.id]);
  const summary = deliveriesFor(event('$finance-result', result.options, { sender: finance.id }), { text: 'Alice，合计300' }, hr.id, participants, roomId)[0];
  assert.equal(summary.roomId, dmRoom);
  assert.equal(summary.options.replyTo, '$private-request');
  assert.deepEqual(summary.options.to, []);
});

test('synthetic adapter persists generation once and retries only pending Matrix sends with identical transaction', async () => {
  let calls = 0;
  const sent = [];
  const { node, store } = fixture({
    bridge: { async turn(input) { calls++; assert.equal(input.event.senderId, participants[0].id); return { status: 'completed', text: '{"text":"300"}', sessionId: 'native-1' }; } },
    matrix: { async send(room, body, options) { sent.push({ room, body, options }); if (sent.length === 1) throw new Error('lost receipt'); return { event_id: '$answer' }; } },
  });
  store.ingest([event('$a')], 's1');
  await node.processOne();
  assert.equal(calls, 1);
  assert.equal(store.snapshot().pendingSends, 1);
  await assert.rejects(node.processOne(), /lost receipt/);
  await node.processOne();
  assert.equal(calls, 1);
  assert.deepEqual(sent[0], sent[1]);
  assert.equal(store.snapshot().processed, 1);
  assert.equal(await node.processOne(), false);
  store.close();
});

test('synthetic transport failure ends the inbox as unknown without a second model call', async () => {
  let calls = 0;
  const { node, store } = fixture({ bridge: { async turn() { calls++; throw Object.assign(new Error('connection interrupted'), { networkError: true }); } } });
  store.ingest([event('$a')], 's1');
  await node.processOne();
  await node.processOne();
  assert.equal(calls, 1);
  assert.equal(store.snapshot().unknown, 1);
  store.close();
});

test('synthetic permanent send rejection ends that operation and allows the next conversation to proceed', async () => {
  const requests = [];
  const { node, store } = fixture({
    bridge: { async turn(input) { requests.push(input); return { status: 'completed', text: '{"text":"回答"}', sessionId: 'native-1' }; } },
    matrix: { async send() { throw Object.assign(new Error('not a room member'), { status: 403 }); } },
  });
  store.ingest([event('$first'), event('$second', {}, { sender: participants[1].id })], 's1');
  await node.processOne();
  await node.processOne();
  assert.equal(store.pendingDelivery(), undefined);
  assert.equal(store.snapshot().failed, 1);
  await node.processOne();
  assert.equal(requests.length, 2);
  assert.equal(requests[1].event.eventId, '$second');
  store.close();
});

test('synthetic sync continues during a blocked generation and keeps the same Bot queue ordered', async () => {
  let release;
  const generated = new Promise(resolve => { release = resolve; });
  const calls = [];
  const { node, store } = fixture({ bridge: { async turn(input) { calls.push(input.event.eventId); await generated; return { status: 'completed', text: '{"text":"完成"}', sessionId: 'native-1' }; } },
    matrix: { async sync() { return { next_batch: 's2', rooms: { join: { [roomId]: { timeline: { events: [event('$b')] } } } } }; } },
  });
  store.ingest([event('$a')], 's1');
  const running = node.processOne();
  await node.syncOnce();
  assert.equal(store.cursor(), 's2');
  assert.equal(store.snapshot().pending, 2);
  assert.deepEqual(calls, ['$a']);
  release();
  await running;
  assert.equal(store.next().event_id, '$b');
  store.close();
});

test('synthetic Bot processing is serial per identity while two independent nodes overlap', async () => {
  let release;
  const firstRound = new Promise(resolve => { release = resolve; });
  const active = new Map();
  const maximum = new Map();
  let total = 0;
  let maxTotal = 0;
  const bridge = { async turn(input) {
    const current = (active.get(input.botId) || 0) + 1;
    active.set(input.botId, current);
    maximum.set(input.botId, Math.max(maximum.get(input.botId) || 0, current));
    maxTotal = Math.max(maxTotal, ++total);
    await firstRound;
    active.set(input.botId, current - 1);
    total--;
    return { status: 'completed', text: '{"text":"完成"}', sessionId: `native-${input.botId}` };
  } };
  const matrix = { async send(room, body, options) { return { event_id: `$${options.transactionId}` }; } };
  const first = fixture({ bridge, matrix });
  const secondStore = new NodeStore(':memory:', hr.id);
  const second = new BotNode({ participant: hr, participants, roomId, matrix, bridge, store: secondStore, heartbeat: async () => {}, onError: () => {} });
  first.store.ingest([event('$finance-a'), event('$finance-b', {}, { sender: participants[1].id })], 's1');
  secondStore.ingest([event('$hr-a', { to: [hr.id] })], 's1');
  const work = [first.node.processLoop(), second.processLoop()];
  assert.equal(total, 2);
  assert.equal(first.store.next().event_id, '$finance-b');
  release();
  for (let attempt = 0; attempt < 100 && first.store.snapshot().processed < 2; attempt++) await new Promise(resolve => setTimeout(resolve, 2));
  assert.equal(first.store.snapshot().processed, 2);
  assert.equal(secondStore.snapshot().processed, 1);
  assert.equal(maxTotal, 2);
  assert.equal(maximum.get(finance.id), 1);
  assert.equal(maximum.get(hr.id), 1);
  first.node.controller.abort();
  second.controller.abort();
  await Promise.all(work);
  first.store.close();
  secondStore.close();
});

test('synthetic sync fills limited history and includes direct-message rooms before advancing cursor', async () => {
  const dm = '!dm:ds-group.local';
  const { node, store } = fixture({ matrix: {
    async sync() { return { next_batch: 's2', rooms: { join: {
      [roomId]: { timeline: { limited: true, prev_batch: 'back', events: [event('$c')] } },
      [dm]: { timeline: { events: [event('$dm', {}, { room_id: undefined })] } },
    } } }; },
    async request(method, url) { assert.equal(method, 'GET'); assert.match(url, /from=back/); return { chunk: [event('$b'), event('$a')], end: 'previous' }; },
  } });
  store.ingest([event('$a', { to: [] })], 's1');
  await node.syncOnce();
  assert.equal(store.cursor(), 's2');
  assert.equal(store.hasEvent('$b'), true);
  assert.equal(store.next().event_id, '$b');
  const dmEvent = JSON.parse(store.db.prepare('SELECT event_json FROM messages WHERE event_id=?').get('$dm').event_json);
  assert.equal(dmEvent.room_id, dm);
  assert.deepEqual(store.historyBefore('$dm'), []);
  store.close();
});

test('synthetic history pagination failure preserves the old cursor and does not partially ingest', async () => {
  const { node, store } = fixture({ matrix: {
    async sync() { return { next_batch: 'new', rooms: { join: { [roomId]: { timeline: { limited: true, prev_batch: 'back', events: [event('$new')] } } } } }; },
    async request() { throw new Error('history unavailable'); },
  } });
  store.ingest([], 'old');
  await assert.rejects(node.syncOnce(), /history unavailable/);
  assert.equal(store.cursor(), 'old');
  assert.equal(store.hasEvent('$new'), false);
  store.close();
});

test('synthetic bridge reports unreadable and server-error receipts as uncertain', async () => {
  const unreadable = createBridge('http://fixture.invalid', { fetchImpl: async () => new Response('bad', { status: 200 }) });
  await assert.rejects(unreadable.turn({ requestId: 'r1' }), error => error.networkError === true);
  const serverError = createBridge('http://fixture.invalid', { fetchImpl: async () => Response.json({ error: 'server failure' }, { status: 500 }) });
  await assert.rejects(serverError.turn({ requestId: 'r1' }), error => error.networkError === true);
});

test('local process ownership prevents concurrent writers for the same Bot', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ds-group-node-lock-'));
  const filename = path.join(directory, 'process.lock');
  const release = await acquireNodeLock(filename);
  await assert.rejects(acquireNodeLock(filename), /already has a local process/);
  await release();
  const releaseAgain = await acquireNodeLock(filename);
  await releaseAgain();
  await rm(directory, { recursive: true, force: true });
});

test('a worker result is handed to the bridge and its reply lands on the original message', async () => {
  const turns = []; const sent = [];
  const { node, store } = fixture({
    bridge: { async turn(input) { turns.push(input); return { status: 'completed', text: '表格整理好了', sessionId: 'front' }; } },
    matrix: { async send(room, body, options) { sent.push({ room, body, options }); return { event_id: '$answer' }; } },
  });
  try {
    node.acceptWorkerResult({ id: 'T-1', origin: { roomId, eventId: '$ask', senderId: participants[0].id } },
      { kind: 'result' }, '[task.result] 任务 T-1 已完成');
    await node.processOne(); await node.processOne();
    assert.equal(turns.length, 1);
    assert.equal(turns[0].event.workerTask, 'T-1'); assert.equal(turns[0].event.workerKind, 'result');
    assert.match(turns[0].event.body, /\[task\.result\]/);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].room, roomId);
    assert.equal(sent[0].options.replyTo, '$ask');
    assert.deepEqual(sent[0].options.mMentions.user_ids, [participants[0].id]);
  } finally { store.close(); }
});

test('closing a store twice is harmless, so startup cleanup cannot mask the original failure', () => {
  const store = new NodeStore(':memory:', finance.id);
  store.close();
  assert.doesNotThrow(() => store.close());
});

test('a person splitting one thought over quick messages gets one front turn and one reply', async () => {
  const turns = []; const sent = [];
  const { node, store } = fixture({
    bridge: { async turn(input) { turns.push(input); return { status: 'completed', text: '商场三楼有个电玩城', sessionId: 'front' }; } },
    matrix: { async send(room, body, options) { sent.push({ room, body, options }); return { event_id: `$answer-${sent.length}` }; } },
  });
  try {
    const now = Date.now();
    const say = (id, body, ts, sender = participants[0].id) => ({ ...event(id), sender, origin_server_ts: ts,
      content: { body, 'org.ds_group': { to: [finance.id] } } });
    store.ingest([say('$p1', '我想要', now - 1200), say('$p2', '看看有没有好玩的', now - 800), say('$p3', '在这个商场里', now - 100)]);
    // The last message is too fresh: the node waits for the person to finish.
    assert.equal(await node.processOne(), false);
    assert.equal(turns.length, 0);
    store.db.prepare("UPDATE messages SET event_json=json_set(event_json,'$.origin_server_ts',?) WHERE event_id='$p3'").run(now - 3000);
    assert.equal(await node.processOne(), true);
    assert.equal(turns.length, 1);
    assert.equal(turns[0].event.eventId, '$p3');
    assert.deepEqual(turns[0].event.mergedMessages.map(message => message.body), ['我想要', '看看有没有好玩的']);
    assert.equal(store.item('$p1').status, 'merged'); assert.equal(store.item('$p2').status, 'merged');
    await node.processOne();
    assert.equal(sent.length, 1); assert.equal(sent[0].options.replyTo, '$p3');
    assert.equal(await node.processOne(), false);
    // Someone else speaking in between ends a burst.
    store.ingest([say('$q1', '先问一个', now - 9000), say('$b1', '我插一句', now - 8000, participants[1].id), say('$q2', '再问一个', now - 7000)]);
    await node.processOne();
    assert.equal(turns.at(-1).event.eventId, '$q1'); assert.equal(turns.at(-1).event.mergedMessages, undefined);
  } finally { store.close(); }
});

test('the decision layer waits for an unfinished thought and folds a follow-up into the answer in progress', async () => {
  const asked = []; const turns = []; const interrupted = [];
  let decide = () => ({ action: 'REPLY' }); let finishTurn;
  const store = new NodeStore(':memory:', finance.id);
  const node = new BotNode({ participant: finance, participants, roomId, store, heartbeat: async () => {}, onError: () => {},
    matrix: { async send() { return { event_id: '$answer' }; } },
    decisionProvider: createScriptDecisionProvider((input, { question }) => { asked.push({ input, question: question.name }); return decide(input); }),
    bridge: {
      async turn(input) { turns.push(input); return new Promise(resolve => { finishTurn = resolve; }); },
      joinable: () => true,
      async interrupt(requestId) { interrupted.push(requestId); finishTurn({ status: 'cancelled' }); return true; },
    } });
  try {
    const now = Date.now();
    const say = (id, body, ts) => ({ ...event(id), origin_server_ts: ts, content: { body, 'org.ds_group': { to: [finance.id] } } });
    decide = input => ({ action: input.pending.length === 1 ? 'WAIT' : 'REPLY' });
    store.ingest([say('$w1', '我想要', now)]);
    assert.equal(await node.processOne(), false);
    assert.equal(asked[0].question, 'turn_taking'); assert.equal(asked[0].input.phase, 'before');
    assert.equal(await node.processOne(), false, 'a WAIT is kept until the next message or its deadline');
    assert.equal(asked.length, 1);
    await node.ingestEvents([say('$w2', '看看有没有好玩的', now + 1)]);
    const first = node.processOne();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(turns.length, 1); assert.equal(turns[0].event.eventId, '$w2');
    // While the front answers, the same person adds a detail: JOIN restarts the answer with all three.
    decide = () => ({ action: 'JOIN' });
    await node.ingestEvents([say('$w3', '在这个商场里', now + 2)]);
    for (let i = 0; i < 20 && !interrupted.length; i++) await new Promise(resolve => setImmediate(resolve));
    assert.equal(asked.at(-1).input.phase, 'during'); assert.deepEqual(asked.at(-1).input.answering, ['我想要', '看看有没有好玩的']);
    assert.equal(await first, true);
    assert.equal(store.item('$w1').status, 'queued'); assert.equal(store.item('$w2').status, 'queued');
    decide = () => ({ action: 'REPLY' });
    const second = node.processOne();
    for (let i = 0; i < 20 && turns.length < 2; i++) await new Promise(resolve => setImmediate(resolve));
    assert.equal(turns[1].event.eventId, '$w3');
    assert.deepEqual(turns[1].event.mergedMessages.map(message => message.body), ['我想要', '看看有没有好玩的']);
    finishTurn({ status: 'completed', text: '三楼有电玩城', sessionId: 'front' });
    assert.equal(await second, true);
    assert.equal(interrupted.length, 1);
  } finally { node.controller.abort(); store.close(); }
});

test('a follow-up that is a different matter is answered after the current answer, not folded in', async () => {
  let finishTurn; const interrupted = [];
  const store = new NodeStore(':memory:', finance.id);
  const node = new BotNode({ participant: finance, participants, roomId, store, heartbeat: async () => {}, onError: () => {},
    matrix: { async send() { return { event_id: '$answer' }; } },
    decisionProvider: createScriptDecisionProvider(() => ({ action: 'REPLY' })),
    bridge: { async turn() { return new Promise(resolve => { finishTurn = resolve; }); }, joinable: () => true,
      async interrupt(id) { interrupted.push(id); return true; } } });
  try {
    const say = (id, body) => ({ ...event(id), content: { body, 'org.ds_group': { to: [finance.id] } } });
    store.ingest([say('$a', '1 到 100 能被 7 整除的有几个？')]);
    const first = node.processOne();
    await new Promise(resolve => setImmediate(resolve));
    await node.ingestEvents([say('$b', '另外帮我查下明天天气')]);
    for (let i = 0; i < 20; i++) await new Promise(resolve => setImmediate(resolve));
    assert.equal(interrupted.length, 0);
    finishTurn({ status: 'completed', text: '14 个', sessionId: 'front' });
    await first;
    assert.equal(store.item('$b').status, 'queued');
  } finally { node.controller.abort(); store.close(); }
});
