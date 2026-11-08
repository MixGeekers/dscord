import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { ContactBook } from '../src/contact-book.mjs';

const book = (t, self, options = {}) => {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  let now = 1000;
  return new ContactBook({ db, self: { id: self }, now: () => now++, ...options });
};

test('each Bot keeps its own book: the same contact has different shared rooms in two books', t => {
  const qa = '@qa:a.test';
  const promo = book(t, '@promo:b.test');
  const planner = book(t, '@planner:a.test', { local: id => id === qa ? { name: 'QA' } : undefined });
  promo.seeRoom('!r2', [{ id: '@promo:b.test', kind: 'bot' }, { id: qa, name: 'QA', kind: 'bot' }, { id: '@tang:b.test', kind: 'human' }]);
  planner.seeRoom('!r1', [{ id: '@planner:a.test', kind: 'bot' }, { id: qa, name: 'QA', kind: 'bot' }]);
  assert.deepEqual(promo.contact(qa).rooms, ['!r2']);
  assert.equal(promo.contact(qa).reach, 'room');
  assert.equal(promo.contact(qa).sameDsh, false);
  assert.deepEqual(planner.contact(qa).rooms, ['!r1']);
  assert.deepEqual([planner.contact(qa).reach, planner.contact(qa).callAs, planner.contact(qa).sameDsh], ['message_bot', 'QA', true]);
  assert.equal(promo.contact(qa).firstRoomId, '!r2');
  assert.deepEqual(promo.reachableBots(), [{ id: qa, name: 'QA', reach: 'room', rooms: ['!r2'] }]);
});

test('a room is used only while both are in it, and the preferred room wins when shared', t => {
  const self = '@promo:b.test';
  const qa = '@qa:a.test';
  const contacts = book(t, self);
  contacts.seeRoom('!home', [{ id: self }]);
  contacts.seeRoom('!r2', [{ id: self }, { id: qa }]);
  contacts.seeRoom('!r3', [{ id: self }, { id: qa }]);
  assert.equal(contacts.roomFor(qa, ['!home', '!r3']), '!r3');
  assert.equal(contacts.roomFor(qa, ['!home']), '!r2');
  contacts.member('!r2', qa, 'leave');
  contacts.member('!r3', self, 'leave');
  assert.equal(contacts.roomFor(qa, ['!home']), undefined);
  assert.equal(contacts.reach(qa).via, null);
  contacts.member('!home', qa, 'join', 'QA');
  assert.equal(contacts.roomFor(qa), '!home');
});

test('exchanges record who asked whom, for which message, how it ended, and page newest first', t => {
  const self = '@dev:a.test';
  const contacts = book(t, self);
  for (const [index, peer] of ['@planner:a.test', '@qa:a.test', '@planner:a.test'].entries()) {
    contacts.open({ id: `x${index}`, direction: index === 1 ? 'in' : 'out', peer, via: 'message_bot', status: index === 1 ? 'received' : 'sent',
      origin: { roomId: '!r1', eventId: `$e${index}`, senderId: '@lin:a.test' } });
  }
  assert.equal(contacts.awaiting().id, 'x1');
  contacts.settle('x1', { status: 'dispatched', taskId: 'T-1' });
  assert.equal(contacts.awaiting(), undefined);
  contacts.settle('x2', { status: 'returned' });
  const first = contacts.view({ contact: '@planner:a.test', limit: 1 });
  assert.deepEqual(first.exchanges.map(exchange => [exchange.id, exchange.status]), [['x2', 'returned']]);
  assert.deepEqual(first.contacts.map(contact => contact.id), ['@planner:a.test']);
  const second = contacts.view({ contact: '@planner:a.test', limit: 1, before: first.next });
  assert.deepEqual(second.exchanges.map(exchange => exchange.id), ['x0']);
  assert.equal(second.next, null);
  assert.equal(contacts.contact('@qa:a.test').introducedBy, '@qa:a.test');
  assert.deepEqual(contacts.view().contacts.map(contact => contact.id), ['@planner:a.test', '@qa:a.test']);
  assert.throws(() => contacts.settle('x0', { status: 'lost' }), /Invalid exchange status/);
});
