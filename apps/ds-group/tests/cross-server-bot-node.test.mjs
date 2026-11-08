import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { BotNode } from '../src/bot-node.mjs';
import { NodeStore } from '../src/node-store.mjs';

const botId = '@helper:a.node.test';
const humanId = '@alice:b.node.test';
const roomId = '!work:b.node.test';
async function fixture(t, { meta = {}, sender = humanId } = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'dscord-node-work-'));
  const filename = path.join(directory, 'node.sqlite');
  let store = new NodeStore(filename, botId);
  const participant = {
    id: botId,
    localpart: 'helper',
    name: 'Helper',
    kind: 'bot',
    ownerId: '@owner:a.node.test',
  };
  const participants = [
    participant,
    { id: humanId, name: 'Alice', kind: 'human' },
    { id: '@peer:b.node.test', name: 'Peer', kind: 'bot' },
  ];
  const event = {
    event_id: '$node-request',
    room_id: roomId,
    sender,
    type: 'm.room.message',
    content: {
      body: 'Write and return my result',
      'org.ds_group': { to: [botId], ...meta },
    },
  };
  let calls = 0;
  const sent = [];
  const client = {};
  const bridge = {
    turn: async () => {
      calls++;
      return {
        status: 'completed',
        text: JSON.stringify({ text: 'Done.' }),
        sessionId: 'native-room-session',
        artifacts: [],
        toolReceipts: [],
      };
    },
  };
  const matrix = {
    send: async (roomId, body, options) => {
      sent.push({ roomId, body, options });
      return { event_id: '$result' };
    },
  };
  function node() {
    return new BotNode({
      participant,
      participants,
      roomId: '!home:a.node.test',
      store,
      matrix,
      bridge,
      heartbeat: async () => {},
      work: client,
      onError: () => {},
    });
  }
  const runtime = node();
  store.ingest([event], 'cursor', (event) => runtime.delivery.register(event));
  t.after(async () => {
    store.close();
    await rm(directory, { recursive: true, force: true });
  });
  return {
    directory,
    filename,
    runtime,
    event,
    bridge,
    client,
    matrix,
    sent,
    store: () => store,
    calls: () => calls,
    restart: () => {
      store.close();
      store = new NodeStore(filename, botId);
      return node();
    },
  };
}

test('a denied external invitation survives sync and restart until the owner actually grants it', async (t) => {
  const f = await fixture(t);
  let allowed = false;
  let attempts = 0;
  let syncs = 0;
  f.client.join = async (target) => {
    assert.equal(target, roomId);
    attempts++;
    if (!allowed)
      throw Object.assign(new Error('Owner permission pending'), {
        status: 403,
      });
    return { roomId, status: 'joined' };
  };
  f.matrix.sync = async () => ({
    next_batch: `cursor-${++syncs}`,
    rooms: syncs === 1 ? { invite: { [roomId]: {} } } : {},
  });
  await f.runtime.syncOnce();
  assert.equal(f.store().pendingInvitations().length, 1);
  const restarted = f.restart();
  allowed = true;
  await restarted.syncOnce();
  assert.equal(attempts, 2);
  assert.equal(f.store().pendingInvitations().length, 0);
});

test('one hundred permanently denied invitations cannot starve a later approved room', async (t) => {
  const f = await fixture(t);
  let approved = 0;
  f.client.join = async (target) => {
    if (target === roomId) {
      approved++;
      return { roomId, status: 'joined' };
    }
    throw Object.assign(new Error('Not authorized'), { status: 403 });
  };
  const invites = Object.fromEntries([
    ...Array.from({ length: 100 }, (_, index) => [
      `!denied-${index}:b.node.test`,
      {},
    ]),
    [roomId, {}],
  ]);
  let first = true;
  f.matrix.sync = async () => {
    const response = {
      next_batch: 'invitation-cursor',
      rooms: first ? { invite: invites } : {},
    };
    first = false;
    return response;
  };
  // Fix insertion order independently of lexical room IDs and wall-clock resolution.
  for (const id of Object.keys(invites)) f.store().noteInvitation(id);
  f.store()
    .db.prepare('UPDATE room_invitations SET received_at=0 WHERE room_id<>?')
    .run(roomId);
  f.store()
    .db.prepare('UPDATE room_invitations SET received_at=1 WHERE room_id=?')
    .run(roomId);
  await f.runtime.syncOnce();
  assert.equal(approved, 0);
  const restarted = f.restart();
  await restarted.syncOnce();
  assert.equal(approved, 1);
  assert.equal(f.store().pendingInvitations().length, 100);
});

const delegating = f => {
  f.bridge.turn = async () => ({ status: 'completed', sessionId: 'native-room-session', artifacts: [], toolReceipts: [],
    text: JSON.stringify({ text: '我去问 Peer。' }), asks: [{ to: '@peer:b.node.test', body: '请核对' }] });
  // The cross-server room is the only one this Bot shares with Peer; its own home room has neither.
  f.runtime.contacts.seeRoom(roomId, [{ id: botId, kind: 'bot' }, { id: humanId, kind: 'human' }, { id: '@peer:b.node.test', kind: 'bot' }]);
};
const drain = async node => { for (let i = 0; i < 10 && await node.processOne(); i++); };

test('a delegation goes to a room the delegate is actually in, not the node home room', async t => {
  const f = await fixture(t);
  delegating(f);
  await drain(f.runtime);
  const request = f.sent.find(message => message.options.kind === 'task.request');
  assert.equal(request.roomId, roomId);
  assert.equal(request.options.replyTo, '$node-request');
  assert.deepEqual(f.sent.map(message => message.options.deliveryRole), ['ack', 'delegate']);
  const [exchange] = f.runtime.contacts.view().exchanges;
  assert.deepEqual([exchange.direction, exchange.peerId, exchange.via, exchange.roomId, exchange.status, exchange.origin.eventId],
    ['out', '@peer:b.node.test', 'matrix', roomId, 'sent', '$node-request']);
  assert.deepEqual(f.runtime.contacts.contact('@peer:b.node.test').rooms, [roomId]);
  // The next turn sees what this Bot is still waiting on, so a second asker can be added to it.
  assert.deepEqual(f.runtime.contacts.pending().map(open => [open.peerId, open.detail, open.origin.eventId]), [['@peer:b.node.test', '请核对', '$node-request']]);
  const next = f.runtime.requestFor(f.runtime.store.item('$node-request'));
  assert.deepEqual(next.event.openRequests.map(open => [open.to, open.request, open.forEventId]), [['@peer:b.node.test', '请核对', '$node-request']]);
});

test('a Bot that shares no room is asked in a direct room the asking Bot opens, and the room is kept for next time', async t => {
  const f = await fixture(t);
  f.bridge.turn = async () => ({ status: 'completed', sessionId: 'native-room-session', artifacts: [], toolReceipts: [],
    text: JSON.stringify({ text: '我去问 Far。' }), asks: [{ to: '@far:c.node.test', body: '请看看' }] });
  const created = [];
  f.matrix.createRoom = async options => { created.push(options); return { room_id: '!direct:a.node.test' }; };
  await drain(f.runtime);
  assert.deepEqual(created.map(options => [options.is_direct, options.invite]), [[true, ['@far:c.node.test']]]);
  const request = f.sent.find(message => message.options.kind === 'task.request');
  assert.deepEqual([request.roomId, request.options.to, request.body], ['!direct:a.node.test', ['@far:c.node.test'], '请看看']);
  assert.equal(await f.runtime.roomForAsk({ room_id: roomId }, '@far:c.node.test'), '!direct:a.node.test');
  assert.equal(created.length, 1);
});

test('a result coming back from the deepest request still reaches the person, and only asks count as hops', async t => {
  const peer = '@peer:b.node.test';
  const f = await fixture(t, { sender: peer, meta: { kind: 'task.result', taskId: 'task-z', hop: 4,
    originSenderId: humanId, originRoomId: roomId, originEventId: '$tang' } });
  f.bridge.turn = async () => ({ status: 'completed', text: '一共 4 个未修致命 bug。', sessionId: 'native-room-session', artifacts: [], toolReceipts: [] });
  await drain(f.runtime);
  const answer = f.sent.at(-1);
  assert.deepEqual([answer.options.deliveryRole, answer.options.replyTo, answer.options.hop], ['final', '$tang', 4]);
  assert.match(answer.body, /4 个未修致命 bug/);
});

test('files a Bot hands to another Bot are uploaded and go with that request only', async t => {
  const f = await fixture(t);
  f.runtime.contacts.seeRoom(roomId, [{ id: botId, kind: 'bot' }, { id: '@peer:b.node.test', name: 'Peer', kind: 'bot' }]);
  const uploads = [];
  f.runtime.files = { prepare: async request => request,
    upload: async file => { uploads.push(file.path); return { id: `att-${uploads.length}`, name: file.name, mimeType: 'text/markdown', size: 3, sha256: 'b'.repeat(64), contentUri: 'mxc://a/1' }; } };
  f.bridge.turn = async () => ({ status: 'completed', sessionId: 'native-room-session', artifacts: [], toolReceipts: [],
    text: JSON.stringify({ text: '我去问 Peer。' }), asks: [{ to: '@peer:b.node.test', body: '核对数量', files: [{ path: '/node/bug-summary.md', name: 'bug-summary.md' }] }] });
  await drain(f.runtime);
  assert.deepEqual(uploads, ['/node/bug-summary.md']);
  const request = f.sent.find(message => message.options.kind === 'task.request');
  assert.deepEqual(request.options.attachments?.map(file => file.name), ['bug-summary.md']);
  assert.equal(request.options.hop, 1);
  assert.equal(f.sent.find(message => message.options.kind !== 'task.request').options.attachments, undefined);
});

test('when the delegation cannot be sent, the requester is told it did not go out', async t => {
  const f = await fixture(t);
  delegating(f);
  const errors = [];
  f.runtime.onError = message => errors.push(message);
  const send = f.matrix.send;
  f.matrix.send = async (target, body, options) => {
    if (options.kind === 'task.request') throw Object.assign(new Error('Bot is not in the room'), { status: 403 });
    return send(target, body, options);
  };
  await drain(f.runtime);
  assert.deepEqual(f.sent.map(message => message.options.deliveryRole), ['ack', 'final']);
  const notice = f.sent[1];
  assert.equal(notice.roomId, roomId);
  assert.equal(notice.options.replyTo, '$node-request');
  assert.match(notice.body, /没有发出去.*Peer不会处理/);
  assert.match(errors.join('\n'), /Matrix delivery failed/);
  assert.equal(f.runtime.contacts.view().exchanges[0].status, 'failed');
});

test('another Bot gets the worker result as the answer to its request, not the front saying work has started', async t => {
  const peer = '@peer:b.node.test';
  const f = await fixture(t, { sender: peer, meta: { kind: 'task.request', returnTo: peer, taskId: 'task-x', hop: 1,
    originSenderId: humanId, originRoomId: '!b-room:b.node.test', originEventId: '$su' } });
  f.bridge.turn = async request => request.event.workerKind === 'result'
    ? { status: 'completed', text: 'Helper：「核对崩溃」完成了。\n\n是已知问题 B-017。', sessionId: 'native-room-session', artifacts: [], toolReceipts: [] }
    : { status: 'completed', text: '收到，已开工，结论出来直接回你。', dispatched: ['T-1'], sessionId: 'native-room-session', artifacts: [], toolReceipts: [] };
  await drain(f.runtime);
  assert.equal(f.sent.length, 1);
  assert.deepEqual([f.sent[0].options.kind, f.sent[0].options.deliveryRole, f.sent[0].options.to], ['reply', 'ack', []]);
  assert.equal(f.runtime.contacts.exchange('in:$node-request').status, 'dispatched');
  f.runtime.acceptWorkerResult({ id: 'T-1', origin: { roomId, eventId: '$node-request', senderId: peer } }, { kind: 'result' }, 'ignored');
  await drain(f.runtime);
  const answer = f.sent[1];
  assert.deepEqual([answer.roomId, answer.options.kind, answer.options.to, answer.options.replyTo, answer.options.taskId],
    [roomId, 'task.result', [peer], '$node-request', 'task-x']);
  assert.deepEqual([answer.options.originEventId, answer.options.originRoomId, answer.options.hop], ['$su', '!b-room:b.node.test', 1]);
  assert.match(answer.body, /B-017/);
  assert.equal(f.runtime.contacts.exchange('in:$node-request').status, 'returned');
});

test('after a restart, an unknown worker outcome goes back to the asking Bot as a failure of its request', async t => {
  const peer = '@peer:b.node.test';
  const f = await fixture(t, { sender: peer, meta: { kind: 'task.request', returnTo: peer, taskId: 'task-y', hop: 1,
    originSenderId: humanId, originRoomId: roomId, originEventId: '$tang' } });
  f.bridge.turn = async request => request.event.workerKind === 'result'
    ? { status: 'completed', workerStatus: 'unknown', text: '「写简介」在宿主重启时还没有结束，结果不确定。我没有自动重做，需要的话告诉我。',
      sessionId: 'native-room-session', artifacts: [], toolReceipts: [] }
    : { status: 'completed', text: '收到，开工。', dispatched: ['T-2'], sessionId: 'native-room-session', artifacts: [], toolReceipts: [] };
  await drain(f.runtime);
  // A fresh connection: the foreign Bot's room roster has not been read yet.
  f.runtime.participants.splice(f.runtime.participants.findIndex(person => person.id === peer), 1);
  f.runtime.acceptWorkerResult({ id: 'T-2', status: 'unknown', origin: { roomId, eventId: '$node-request', senderId: peer } }, { kind: 'result' }, 'ignored');
  await drain(f.runtime);
  const notice = f.sent.at(-1);
  assert.deepEqual([notice.options.kind, notice.options.to, notice.options.replyTo, notice.options.taskId, notice.options.originEventId],
    ['task.failure', [peer], '$node-request', 'task-y', '$tang']);
  assert.equal(f.runtime.contacts.exchange('in:$node-request').status, 'failed');
});
