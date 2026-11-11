import test from 'node:test';
import assert from 'node:assert/strict';
import { decisionState, DECISION_STATE_CHARS } from '../src/decision-state.mjs';
import { clipText } from '../src/conversation-view.mjs';
import { attentionMessage } from '../src/attention.mjs';
import { messageSource } from '../src/message-context.mjs';

const people = [
  { id: '@tomato:chat.test', name: 'Devtomato', kind: 'human', globalId: 'g-tomato' },
  { id: '@helper:chat.test', name: '毛毛', kind: 'bot', globalId: 'g-helper', ownerId: '@tomato:chat.test' },
  { id: '@fish:chat.test', name: '雨雨', kind: 'bot', globalId: 'g-fish', ownerId: '@tomato:chat.test' },
];
// A room where both Bots were just renamed: every message carries member-state name provenance.
const room = { memberProfiles: Object.fromEntries(people.map(person => [person.id, { displayname: person.name,
  source: 'matrix-member-state', observedAt: 1, eventTimestamp: 1, eventId: `$rename-${person.id}-0123456789abcdefghijklmnopqrstu` }])) };
const event = (index, sender, body, extra = {}) => ({ event_id: `$event-${index}-0123456789abcdefghijklmnopqrstuvwxyz`,
  room_id: '!fish-room:chat.test', sender, origin_server_ts: 1_800_000_000_000 + index * 1000, content: { body, ...extra } });
const message = value => ({ ...attentionMessage(value, people), source: messageSource(value, people, room) });

function busyRoom({ count = 40, botText = '想啊。写代码的人皱着眉盯着屏幕的样子，本来就有意思。'.repeat(40) } = {}) {
  const events = Array.from({ length: count }, (_, index) => event(index, people[index % 3].id,
    index % 3 ? botText : `第 ${index} 条：你俩刚刚怎么晕了啊`,
    index ? { 'm.relates_to': { 'm.in_reply_to': { event_id: `$event-${index - 1}-0123456789abcdefghijklmnopqrstuvwxyz` } } } : {}));
  const recentMessages = events.map(message);
  return { version: 1, policyVersion: 'dscord-attention-v1',
    self: { id: '@helper:chat.test', name: '毛毛', role: '通用助手', interests: ['猫'], instructions: '说话像猫。' },
    context: { room: { id: '!fish-room:chat.test', name: '鱼鱼', topic: '', kind: 'group' },
      members: people.map(person => ({ id: person.id, name: person.name, kind: person.kind })) },
    roomId: '!fish-room:chat.test', watermark: { sequence: count }, eventIds: [events.at(-1).event_id],
    trigger: { reason: 'room_messages', expiresAt: 0 }, currentMessages: [recentMessages.at(-1)], recentMessages,
    workView: { stateVersion: 'f'.repeat(64), tasks: [], recentReceipts: Array.from({ length: 10 }, (_, index) => ({
      eventId: `$receipt-${index}`, status: 'done', summary: botText.slice(0, 1600), artifacts: [{ name: 'a.png', sha256: 'e'.repeat(64) }] })) },
    memoryView: { self: {}, memory: { facts: ['Devtomato 喜欢番茄'] }, tasks: { status: 'idle', workers: [], queue: [] }, runtime: { status: 'idle' } } };
}

test('a busy, renamed room fits the decision budget and keeps who said what to whom', () => {
  const input = busyRoom();
  assert.ok(JSON.stringify(input).length > 2 * DECISION_STATE_CHARS, 'the full record is far over any one-request budget');
  const state = decisionState(input);
  const text = JSON.stringify(state);
  assert.ok(text.length <= DECISION_STATE_CHARS, `${text.length} characters`);
  assert.equal(text.includes('$event-'), false, 'Matrix event IDs stay in the node\'s own record');
  assert.equal(text.includes('@helper:chat.test'), false);
  assert.deepEqual(state.people, { P1: { name: '毛毛', kind: 'bot', self: true }, P2: { name: 'Devtomato', kind: 'human' },
    P3: { name: '雨雨', kind: 'bot' } });
  assert.deepEqual(state.self, { ref: 'P1', role: '通用助手', interests: ['猫'], instructions: '说话像猫。' });
  const last = state.messages.at(-1);
  assert.equal(last.new, true);
  assert.equal(last.ref, 'M40');
  assert.equal(last.from, 'P2');
  assert.equal(state.messages.at(-2).ref, 'M39');
  assert.equal(last.replyTo, 'M39');
  assert.ok(state.earlierMessagesOmitted > 0);
  assert.equal(state.messages.length + state.earlierMessagesOmitted, 40);
  assert.equal(state.trigger, 'room_messages');
  assert.deepEqual(state.memory, { facts: ['Devtomato 喜欢番茄'] });
  assert.ok(state.work.recentResults.length <= 3);
});

test('a short conversation is sent whole', () => {
  const input = busyRoom({ count: 6, botText: '好呀' });
  const state = decisionState(input);
  assert.equal(state.messages.length, 6);
  assert.equal(state.earlierMessagesOmitted, undefined);
  assert.equal(state.messages[0].secondsBeforeLatest, 5);
  assert.equal(state.messages.at(-1).secondsBeforeLatest, 0);
});

test('the messages being decided on stay even when they alone are long', () => {
  const huge = '长'.repeat(50_000);
  const input = busyRoom({ count: 3 });
  input.currentMessages = [message(event(99, '@tomato:chat.test', huge))];
  const state = decisionState(input);
  assert.ok(JSON.stringify(state).length <= DECISION_STATE_CHARS);
  assert.equal(state.messages.at(-1).new, true);
  assert.match(state.messages.at(-1).text, /原文 50000 字，已截断/);
});

test('turn-taking questions keep their phase, pending messages and the answer being written', () => {
  const state = decisionState({ version: 1, self: { id: '@helper:chat.test', name: '毛毛' }, phase: 'during',
    answering: ['我想要'], newMessage: message(event(2, '@tomato:chat.test', '看看有没有好玩的')) });
  assert.deepEqual(state, { self: { ref: 'P1' }, people: { P1: { name: '毛毛', kind: 'bot', self: true }, P2: { name: 'Devtomato', kind: 'human' } },
    phase: 'during', answering: ['我想要'], newMessage: { ref: 'M1', from: 'P2', text: '看看有没有好玩的', secondsBeforeLatest: 0 } });
});

test('clipping never splits a character', () => {
  assert.equal(clipText('😾😾', 3), '😾…（原文 4 字，已截断）');
  assert.equal(clipText('短', 3), '短');
});
