import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NodeStore } from '../src/node-store.mjs';

const botId = '@finance:ds-group.local';
const event = (id, { sender = '@alice:ds-group.local', roomId = '!group:ds-group.local', to = [botId], body = id } = {}) => ({
  event_id: id, type: 'm.room.message', room_id: roomId, sender,
  content: { msgtype: 'm.text', body, 'org.ds_group': { to } },
});

test('synthetic inbox preserves identities, room history and a durable cursor, deduplicating Matrix replay', () => {
  const store = new NodeStore(':memory:', botId);
  assert.equal(store.ingest([event('a'), event('b', { roomId: '!dm:ds-group.local' }), event('c')], 'cursor-1'), 3);
  assert.equal(store.ingest([event('a'), event('b'), event('c')], 'cursor-2'), 0);
  assert.equal(store.cursor(), 'cursor-2');
  assert.equal(store.next().event.sender, '@alice:ds-group.local');
  assert.deepEqual(store.historyBefore('c').map(row => row.event_id), ['a']);
  assert.equal(store.snapshot().pending, 3);
  store.close();
});

test('synthetic non-targeted messages and self echoes are history without model inbox entries', () => {
  const store = new NodeStore(':memory:', botId);
  store.ingest([event('broadcast', { to: [] }), event('other', { to: ['@hr:ds-group.local'] }), event('self', { sender: botId })], 'cursor');
  assert.equal(store.next(), undefined);
  assert.equal(store.snapshot().pending, 0);
  assert.equal(store.hasEvent('self'), true);
  store.close();
});

test('synthetic generation and outbox are durable before delivery and receipts finish only after all sends', () => {
  const store = new NodeStore(':memory:', botId);
  store.ingest([event('a')], 'cursor');
  const request = { requestId: 'r1', history: [{ body: 'fixed history' }] };
  store.begin('a', request);
  assert.deepEqual(JSON.parse(store.db.prepare('SELECT request_json FROM inbox').get().request_json), request);
  store.generated('a', { text: '{"text":"ready"}', sessionId: 'native-1' }, [
    { roomId: '!group:ds-group.local', body: 'ready', options: { transactionId: 'reply' } },
    { roomId: '!group:ds-group.local', body: 'calculate', options: { transactionId: 'delegate' } },
  ]);
  assert.equal(store.pendingDelivery().transaction_id, 'reply');
  store.sent('reply', '$reply');
  assert.equal(store.snapshot().processed, 0);
  assert.equal(store.pendingDelivery().transaction_id, 'delegate');
  store.deliveryFailed('delegate', 'temporary network failure');
  assert.equal(store.pendingDelivery().options.transactionId, 'delegate');
  store.sent('delegate', '$delegate');
  assert.equal(store.snapshot().processed, 1);
  assert.equal(store.snapshot().sessionId, 'native-1');
  assert.equal(store.pendingDelivery(), undefined);
  assert.throws(() => store.sent('delegate', '$changed'), /receipt changed/);
  store.close();
});

test('synthetic restart preserves generated sends and marks interrupted generation unknown without retry', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ds-group-node-store-'));
  const filename = path.join(directory, 'node.sqlite');
  let store = new NodeStore(filename, botId);
  store.ingest([event('ready'), event('interrupted')], 'cursor');
  store.begin('ready', { requestId: 'r1' });
  store.generated('ready', { text: 'ready', sessionId: 'native-1' }, [{ roomId: '!group:ds-group.local', body: 'ready', options: { transactionId: 'reply' } }]);
  store.begin('interrupted', { requestId: 'r2', history: ['original'] });
  store.close();
  store = new NodeStore(filename, botId);
  assert.equal(store.next(), undefined);
  assert.equal(store.snapshot().unknown, 1);
  assert.equal(store.pendingDelivery().transaction_id, 'reply');
  store.sent('reply', '$sent-after-restart');
  assert.equal(store.snapshot().processed, 1);
  assert.equal(store.cursor(), 'cursor');
  store.close();
  assert.throws(() => new NodeStore(filename, '@hr:ds-group.local'), /different Bot/);
  await rm(directory, { recursive: true, force: true });
});

test('synthetic cursor failure rolls back the complete sync batch', () => {
  const store = new NodeStore(':memory:', botId);
  assert.throws(() => store.ingest([event('a')], ''), /cursor/);
  assert.equal(store.hasEvent('a'), false);
  assert.equal(store.next(), undefined);
  store.close();
});

test('synthetic rooms are read a page at a time in the order they were received, and only the ones the account is in', () => {
  const store = new NodeStore(':memory:', botId);
  const group = '!group:ds-group.local', direct = '!dm:ds-group.local', left = '!left:ds-group.local', quiet = '!quiet:ds-group.local';
  const at = (id, roomId, timestamp, sender) => ({ ...event(id, { roomId, to: [], ...(sender ? { sender } : {}) }), origin_server_ts: timestamp });
  for (const roomId of [group, direct, quiet]) store.noteRoomMembership(roomId, 'join');
  store.noteRoomMembership(left, 'leave');
  store.noteRoomState(group, [{ type: 'm.room.name', content: { name: '项目群' } }]);
  store.ingest([at('$g1', group, 10), at('$d1', direct, 20), at('$g2', group, 30), at('$l1', left, 40), at('$g3', group, 50),
    // The core's local hand-over of a worker result is kept among the messages, and is not one of the room's.
    at('$dscord-T-1-result', group, 60, botId), at('$d2', direct, 25)], 'cursor');
  assert.deepEqual(store.joinedRooms().map(room => [room.id, room.name, room.latestAt]),
    [[direct, undefined, 25], [group, '项目群', 50], [quiet, undefined, null]]);
  const page = options => { const found = store.roomPage(group, options); return found && [found.events.map(row => row.event_id), found.earlier, found.later, found.next]; };
  assert.deepEqual(page(), [['$g1', '$g2', '$g3'], 0, 0, undefined]);
  assert.deepEqual(page({ limit: 2 }), [['$g2', '$g3'], 1, 0, undefined]);
  assert.deepEqual(page({ before: '$g3', limit: 1 }), [['$g2'], 1, 1, undefined]);
  assert.deepEqual(page({ before: '$g1' }), [[], 0, 0, undefined]);
  assert.deepEqual(page({ from: '$g1', limit: 2 }), [['$g1', '$g2'], 0, 1, '$g3']);
  assert.deepEqual(page({ from: '$g2' }), [['$g2', '$g3'], 1, 0, undefined]);
  assert.equal(page({ before: '$d1' }), undefined, 'a message of another room starts no page here');
  // A withdrawn message is a line that says so, as in a request's history.
  store.ingest([{ type: 'm.room.redaction', event_id: '$gone', room_id: group, sender: '@alice:ds-group.local', redacts: '$g2' }]);
  assert.deepEqual(store.roomPage(group).events.map(row => row.content.body), ['$g1', '[message withdrawn]', '$g3']);
  assert.deepEqual(store.findMessage(id => id.endsWith('2')), { eventId: '$d2', roomId: direct });
  assert.deepEqual(store.findMessage(id => id.endsWith('2'), group), { eventId: '$g2', roomId: group });
  assert.equal(store.findMessage(id => id === '$d1', group), undefined);
  store.close();
});
