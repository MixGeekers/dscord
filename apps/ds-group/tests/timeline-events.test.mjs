import test from 'node:test';
import assert from 'node:assert/strict';
import { lastVisible, mergeEvents, visibleEvents } from '../web/src/app/timeline-events.ts';

const roomId = '!room:test';
const message = (id, sender, ts, content = {}) => ({ event_id: id, room_id: roomId, sender, type: 'm.room.message', origin_server_ts: ts,
  content: { body: id, ...content } });
const edit = (id, sender, target, body, ts) => message(id, sender, ts, { body: `* ${body}`, 'm.new_content': { body, 'org.ds_group': { mentions: { users: ['@bob:test'] } } },
  'm.relates_to': { rel_type: 'm.replace', event_id: target } });

test('edits fold into the original; only the sender\'s latest edit counts', () => {
  const events = [
    message('$a', '@alice:test', 1, { 'org.ds_group': { replyTo: '$x' } }),
    edit('$e1', '@alice:test', '$a', '第一次修改', 2),
    edit('$e2', '@alice:test', '$a', '第二次修改', 3),
    edit('$forged', '@mallory:test', '$a', '冒充', 4),
    message('$b', '@bob:test', 5),
  ];
  const shown = visibleEvents(events);
  assert.deepEqual(shown.map(event => event.event_id), ['$a', '$b']);
  assert.equal(shown[0].content.body, '第二次修改');
  assert.equal(shown[0].edited, 3);
  assert.equal(shown[0].content['org.ds_group'].replyTo, '$x', 'the reply relation stays on the original');
  assert.deepEqual(shown[0].content['org.ds_group'].mentions.users, ['@bob:test']);
  assert.equal(shown[1].edited, undefined);
});

test('withdrawals mark loaded messages, whether they arrive as redactions or redacted events', () => {
  let events = mergeEvents([], [message('$a', '@alice:test', 1), message('$b', '@alice:test', 2)], roomId);
  events = mergeEvents(events, [{ event_id: '$r', room_id: roomId, sender: '@alice:test', type: 'm.room.redaction', redacts: '$a', origin_server_ts: 3, content: {} }], roomId);
  events = mergeEvents(events, [{ ...message('$b', '@alice:test', 2), content: {}, unsigned: { redacted_because: { event_id: '$r2' } } }], roomId);
  const shown = visibleEvents(events);
  assert.deepEqual(shown.map(event => [event.event_id, event.withdrawn, event.content.body]), [['$a', true, ''], ['$b', true, '']]);
  assert.equal(lastVisible(shown), undefined);
  const same = mergeEvents(events, [{ event_id: '$r', room_id: roomId, sender: '@alice:test', type: 'm.room.redaction', redacts: '$a', origin_server_ts: 3, content: {} }], roomId);
  assert.equal(same, events, 'a repeated withdrawal changes nothing');
});

test('lastVisible skips withdrawn messages and applies the filter', () => {
  const shown = [message('$a', '@alice:test', 1), message('$b', '@bob:test', 2), { ...message('$c', '@alice:test', 3), withdrawn: true }];
  assert.equal(lastVisible(shown).event_id, '$b');
  assert.equal(lastVisible(shown, event => event.sender === '@alice:test').event_id, '$a');
});
