import test from 'node:test';
import assert from 'node:assert/strict';
import { BotNode, deliveriesFor, parseBotOutput } from '../src/bot-node.mjs';
import { botInstructions } from '../dsh-plugin/runtime-rules.mjs';

test('Bot instructions and delegation retain the configured Matrix server name', () => {
  const participants = [
    { id: '@alice:chat.example.org:8448', localpart: 'alice', name: 'Alice', kind: 'human' },
    { id: '@finance:chat.example.org:8448', localpart: 'finance', name: 'Finance', kind: 'bot' },
    { id: '@hr:chat.example.org:8448', localpart: 'hr', name: 'HR', kind: 'bot' },
  ];
  const hr = participants[2];
  const finance = participants[1];
  const instructions = botInstructions(BotNode.prototype.instructions.call({ participant: hr, participants }));
  assert.ok(instructions.includes(hr.id));
  assert.equal(instructions.includes('ds-group.local'), false);

  const output = { ...parseBotOutput(JSON.stringify({ text: '请财务核对预算' }), participants),
    asks: [{ to: finance.id, body: '核对两份 75 元的预算', roomId: '!team:chat.example.org:8448' }] };
  const event = { event_id: '$request', room_id: '!private:chat.example.org:8448', sender: participants[0].id, content: {} };
  const deliveries = deliveriesFor(event, output, hr.id, participants);
  assert.deepEqual(deliveries[1].options.to, [finance.id]);
  assert.equal(deliveries[1].roomId, '!team:chat.example.org:8448');
  assert.equal(deliveries[1].options.originRoomId, event.room_id);
});

test('A Bot result handed to a worker is acknowledged without forwarding its files', () => {
  const human = { id: '@lin:chat.example.org', localpart: 'lin', name: 'Lin', kind: 'human' };
  const assistant = { id: '@assistant:chat.example.org', localpart: 'assistant', name: 'Assistant', kind: 'bot' };
  const planner = { id: '@planner:chat.example.org', localpart: 'planner', name: 'Planner', kind: 'bot' };
  const participants = [human, assistant, planner];
  const draft = { id: 'draft', name: 'known-issues.md', mimeType: 'text/markdown', size: 2023, sha256: 'a'.repeat(64), contentUri: 'mxc://chat.example.org/draft' };
  const event = { event_id: '$result', room_id: '!direct:chat.example.org', sender: planner.id, content: {
    'org.ds_group': { kind: 'task.result', taskId: 'T-1', originSenderId: human.id, originRoomId: '!team:chat.example.org', originEventId: '$g5' } } };
  const output = { ...parseBotOutput(JSON.stringify({ text: '核对已经开始。' }), participants), resultAttachments: [draft] };

  const accepted = deliveriesFor(event, { ...output, accepted: true }, assistant.id, participants);
  assert.equal(accepted[0].roomId, '!team:chat.example.org');
  assert.equal(accepted[0].options.deliveryRole, 'ack');
  assert.equal(accepted[0].options.attachments, undefined);

  const final = deliveriesFor(event, output, assistant.id, participants);
  assert.equal(final[0].options.deliveryRole, 'final');
  assert.deepEqual(final[0].options.attachments.map(file => file.name), ['known-issues.md']);
});
