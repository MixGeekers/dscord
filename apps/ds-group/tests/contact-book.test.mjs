import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { ContactBook } from '../src/contact-book.mjs';

const book = (t, self, options = {}) => {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  let now = 1000;
  return new ContactBook({ db, now: () => now++ }).on({ self: { id: self }, ...options });
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
  assert.deepEqual([planner.contact(qa).reach, planner.contact(qa).sameDsh], ['room', true]);
  // Every request between Bots goes over Matrix: a Bot in the same DSH with no shared room gets a direct room.
  planner.member('!r1', qa, 'leave');
  assert.deepEqual([planner.contact(qa).reach, planner.contact(qa).rooms], ['direct', []]);
  assert.equal(promo.contact(qa).firstRoomId, '!r2');
  assert.deepEqual(promo.reachableBots(), [{ id: qa, account: qa, name: 'QA', reach: 'room', rooms: ['!r2'] }]);
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
    contacts.open({ id: `x${index}`, direction: index === 1 ? 'in' : 'out', peer, via: 'matrix', status: index === 1 ? 'received' : 'sent',
      origin: { roomId: '!r1', eventId: `$e${index}`, senderId: '@lin:a.test' } });
  }
  contacts.settle('x1', { status: 'dispatched', taskId: 'T-1' });
  assert.equal(contacts.exchange('x1').status, 'dispatched');
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

test('pending lists requests sent and not yet back, with what was asked and for whom', t => {
  const contacts = book(t, '@community:a.test');
  contacts.open({ id: 'T-1>@qa:b.test', direction: 'out', peer: '@qa:b.test', via: 'matrix', status: 'sending',
    detail: '看小满的 crash.log', origin: { roomId: '!r4', eventId: '$g13', senderId: '@xiaoman:a.test' } });
  contacts.open({ id: 'T-2>@qa:b.test', direction: 'out', peer: '@qa:b.test', via: 'matrix', status: 'sent', detail: '别的事' });
  contacts.settle('T-1>@qa:b.test', { status: 'sent' });
  contacts.settle('T-2>@qa:b.test', { status: 'returned' });
  assert.deepEqual(contacts.pending().map(exchange => [exchange.id, exchange.detail, exchange.origin.eventId]), [['T-1>@qa:b.test', '看小满的 crash.log', '$g13']]);
});

test('a request names a Bot by its full ID, a Matrix link to it, or a name only one Bot has', t => {
  const self = '@community:b.test';
  const qa = '@qa:a.test';
  const contacts = book(t, self, { people: () => [{ id: qa, name: 'QA', kind: 'bot' }, { id: '@qa2:c.test', name: 'QA2', kind: 'bot' },
    { id: '@xiaoman:b.test', name: '小满', kind: 'human' }] });
  contacts.seeRoom('!r4', [{ id: self, kind: 'bot' }, { id: qa, name: 'QA', kind: 'bot' }, { id: '@xiaoman:b.test', name: '小满', kind: 'human' }]);
  for (const to of [qa, `matrix:${qa}`, `matrix:u/${qa.slice(1)}`, `https://matrix.to/#/${qa}`, ' QA ', '@QA']) assert.equal(contacts.resolve(to).id, qa, to);
  assert.match(contacts.resolve('@xiaoman:b.test').error, /不在你的通讯录/);
  assert.match(contacts.resolve('Nobody').error, /不在你的通讯录/);
  // A Bot met before but sharing no room now is still reached, in a direct room.
  contacts.open({ id: 'old', direction: 'out', peer: '@qa2:c.test', via: 'matrix', status: 'returned' });
  assert.equal(contacts.resolve('QA2').reach, 'direct');
});

test('one book for every server a Bot is on: a person is one contact keyed by global identity, reached through the account on each server', t => {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  const book = new ContactBook({ db });
  const lin = { id: '@lin:a.test', globalId: 'lin@central.test' };
  const people = { a: [lin, { id: '@qa:a.test', name: 'QA', kind: 'bot', globalId: 'qa@central.test' }, { id: '@ann:a.test', name: 'Ann', kind: 'human', globalId: 'ann@central.test' }],
    b: [{ id: '@lin:b.test', globalId: 'lin@central.test' }, { id: '@qa:b.test', name: 'QA', kind: 'bot', globalId: 'qa@central.test' }] };
  const onA = book.on({ self: lin, people: () => people.a });
  const onB = book.on({ self: people.b[0], people: () => people.b });
  onA.seeRoom('!x:a.test', [lin, people.a[1], people.a[2]]);
  onB.seeRoom('!y:b.test', [people.b[0], people.b[1]]);
  // Meeting the same person on two servers is one contact; the Bot itself is never its own contact.
  assert.deepEqual(onA.list().map(contact => contact.id).sort(), ['ann@central.test', 'qa@central.test']);
  assert.deepEqual(onA.contact('qa@central.test').servers, ['a.test', 'b.test']);
  // Each server reaches the contact through its own account and rooms there.
  assert.deepEqual([onA.resolve('qa@central.test').account, onA.contact('@qa:a.test').rooms], ['@qa:a.test', ['!x:a.test']]);
  assert.deepEqual([onB.resolve('QA').account, onB.contact('qa@central.test').rooms], ['@qa:b.test', ['!y:b.test']]);
  // Someone with no account on this server is in the book but cannot be reached from here.
  assert.deepEqual([onB.contact('ann@central.test').account, onB.contact('ann@central.test').reach], [null, null]);
  // Exchanges are keyed by identity; what is still open is listed on the server it was sent from.
  onB.open({ id: 'T-1>@qa:b.test', direction: 'out', peer: '@qa:b.test', via: 'matrix', status: 'sent', detail: '核对' });
  assert.deepEqual(onB.pending().map(exchange => [exchange.peerId, exchange.account]), [['qa@central.test', '@qa:b.test']]);
  assert.deepEqual(onA.pending(), []);
  assert.deepEqual(onA.view({ contact: '@qa:a.test' }).exchanges.map(exchange => exchange.id), ['T-1>@qa:b.test']);
});
