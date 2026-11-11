import test from 'node:test';
import assert from 'node:assert/strict';
import { NodeStore } from '../src/node-store.mjs';
import { BotNode } from '../src/bot-node.mjs';
import { speakerOf } from '../src/message-context.mjs';
import { frontMessage } from '../src/front-prompt.mjs';
const bot = { id: '@bot:home.test', name: '小雨', kind: 'bot' };
const alice = { id: '@alice:home.test', name: '小雨', kind: 'human' };
const other = { id: '@alice:other.test', name: '小雨', kind: 'human' };
const people = [bot, alice, other];
const event = (id, room, sender, body, meta = {}) => ({ type: 'm.room.message', event_id: id, room_id: room, sender,
  origin_server_ts: 100, content: { body, 'org.ds_group': { to: [bot.id], ...meta } } });

test('same-name people/Bot, different rooms and old quoted messages retain distinct sources', () => {
  const store = new NodeStore(':memory:', bot.id);
  try {
    const node = new BotNode({ participant: bot, participants: people, roomId: '!a', store, matrix: {}, bridge: {} });
    store.noteRoomState('!a', [{ type: 'm.room.name', content: { name: '项目群' } }, { type: 'm.room.topic', content: { topic: '预算' } },
      { type: 'm.room.create', sender: alice.id }, ...people.map(person => ({ type: 'm.room.member', state_key: person.id, content: { membership: 'join', displayname: person.name } }))]);
    store.ingest([event('$quote','!a', alice.id,'预算 300'), event('$foreign','!b',other.id,'预算 900'),
      ...Array.from({ length: 41 }, (_, i) => event(`$${i}`, '!a', bot.id, 'Progress')),
      event('$current','!a',other.id,'引用的预算是谁说的？', { replyTo: '$quote' })]);
    const request = node.requestFor(store.item('$current'));
    assert.equal(request.context.room.name, '项目群'); assert.equal(request.context.room.topic, '预算');
    assert.equal(request.context.source.sender.id, other.id);
    assert.equal(request.context.reply.source.sender.id, alice.id); assert.equal(request.context.reply.body, '预算 300');
    assert.equal(request.context.history.count, 40); assert.equal(request.context.history.earlierMessagesOmitted, 2);
    assert.ok(request.history.every(item => item.roomId === '!a')); assert.ok(!JSON.stringify(request.history).includes('预算 900'));
    assert.equal(request.context.members[0].kind, 'bot'); assert.equal(request.context.members[1].kind, 'human');
    assert.equal(speakerOf('@unlisted:other.test', people).kind, 'unknown');
    // What the front reads of this request: three accounts with one display name stay three people.
    const { text } = frontMessage({ input: { ...request, authorization: { tools: ['read'] } }, bot: { id: 'native', name: bot.name } });
    assert.ok(!text.includes('authorization')); assert.ok(!text.includes('"tools"'));
    const turn = JSON.parse(text.split('\n')[1]);
    assert.deepEqual(Object.values(turn.people).map(person => [person.name, person.id]), [['小雨', bot.id], ['小雨', alice.id], ['小雨', other.id]]);
    assert.equal(turn.people.P1.self, true); assert.equal(turn.people[turn.msg.from].id, other.id);
    assert.equal(turn.people[turn.quoted.from].id, alice.id); assert.equal(turn.quoted.text, '预算 300');
    assert.deepEqual(turn.room, { name: '项目群', kind: 'group', topic: '预算', creator: turn.quoted.from });
    assert.equal(turn.history.length, 40); assert.equal(turn.earlierOmitted, 2);
  } finally { store.close(); }
});

test('thread roots and Bot relays remain distinct from the original human assertion', () => {
  const store = new NodeStore(':memory:', bot.id);
  try {
    const node = new BotNode({ participant: bot, participants: people, roomId: '!a', store, matrix: {}, bridge: {} });
    const peer = { id: '@peer:other.test', name: '小雨', kind: 'bot' }; node.participants = [...people, peer];
    const relayed = event('$relay','!a',peer.id,'转交工作', { kind: 'task.request', originSenderId: alice.id, originRoomId: '!elsewhere', originEventId: '$claimed' });
    relayed.content['m.relates_to'] = { rel_type: 'm.thread', event_id: '$root' };
    store.ingest([event('$root', '!a', alice.id, '话题根'), relayed]);
    const request = node.requestFor(store.item('$relay'));
    assert.equal(request.context.source.sender.id, peer.id); assert.equal(request.context.source.sender.kind, 'bot');
    assert.equal(request.context.source.relay.senderId, alice.id); assert.equal(request.context.source.relay.source, 'sender-metadata');
    assert.equal(request.context.threadRoot.body, '话题根');
    assert.deepEqual(JSON.parse(request.context.key), ['matrix','!a','$root']);
  } finally { store.close(); }
});
