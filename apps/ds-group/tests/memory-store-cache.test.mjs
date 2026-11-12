import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MemoryService } from '../memory/service.mjs';
import { MemoryStore } from '../memory/store.mjs';

// The store answers from rows it has already read. These tests hold it to the file: whatever it kept in memory
// must read the same as a store that has kept nothing.
const withMemory = async (options, run) => {
  const directory = await mkdtemp(join(tmpdir(), 'memory-store-cache-'));
  const memory = new MemoryService({ directory, clock: () => 50000, ...options });
  try { await run(memory, directory); } finally { await memory.close(); await rm(directory, { recursive: true }); }
};
const event = (id, body, { room = '!plan:test', sender = '@rin:test', replaces, retracts } = {}) => ({ event: {
  eventId: `$${id}`, roomId: room, senderId: sender, senderKind: 'human', body, timestamp: 1000 + Number(String(id).replace(/\D/g, '') || 0),
}, context: { source: { transport: 'matrix', sender: { id: sender, name: sender.slice(1, 4), kind: 'human' },
  ...(replaces ? { replacesEventId: `$${replaces}` } : {}), ...(retracts ? { retractsEventId: `$${retracts}` } : {}) } } });
const answers = (memory, bots) => JSON.stringify(bots.map(bot => ({
  watermarks: memory.store.watermarks(bot), observed: memory.store.observations(bot), snapshot: memory.contextSnapshot(bot, 's'),
  contacts: memory.contacts(bot, {}), pending: memory.pendingRequests(bot), rows: memory.store.list({ botId: bot, history: true }),
  found: memory.querySources(bot, { query: 'launch checklist 发布清单', scope: 'all' }),
})));
const sameAsFile = (memory, bots, step) => {
  for (const bot of bots) assert.deepEqual(memory.store.countObserved(bot), memory.store.scanObserved(bot), `${step}: counted watermarks of ${bot}`);
  const kept = answers(memory, bots);
  memory.store.reload();
  assert.equal(kept, answers(memory, bots), `${step}: answers from memory and from the file`);
  for (const bot of bots) assert.deepEqual(memory.store.countObserved(bot), memory.store.scanObserved(bot), `${step}: watermarks counted again of ${bot}`);
};

async function story(memory) {
  const bots = ['a', 'b'], check = step => sameAsFile(memory, bots, step);
  memory.ingest('a', event(1, 'The launch checklist is due on Friday'), { sessionId: 's' });
  check('first message');
  for (let index = 2; index <= 13; index++) {
    const input = event(index, index % 3 ? `Note ${index} about the launch checklist` : `发布清单第 ${index} 项已确认`,
      { room: index % 4 ? '!plan:test' : '!side:test', sender: index % 2 ? '@rin:test' : '@sol:test' });
    for (const bot of index % 5 ? bots : ['a']) memory.observe(bot, input,
      { sourceDispositions: { [input.event.eventId]: { kind: index % 6 ? 'context' : 'pending-request' } } });
    if (index % 4 === 0) check(`message ${index}`);
  }
  memory.ingest('b', event(14, 'What is on the launch checklist?', { sender: '@sol:test' }), { sessionId: 's' });
  check('second bot turn');
  memory.observe('a', event(15, 'The launch checklist is due on Monday', { replaces: 1 }));
  check('an edit');
  memory.observe('a', event(16, '', { sender: '@sol:test', retracts: 4 }));
  check('a retraction');
  memory.ingest('a', event(18, 'Who owns the launch checklist?'), { sessionId: 's' });
  const current = memory.current('a', 's');
  const saved = await memory.remember('a', { text: 'The launch checklist has an owner', predicate: 'checklist-owner' }, current);
  check('a memory');
  await memory.remember('a', { text: 'The launch checklist has two owners', predicate: 'checklist-owner' }, current);
  check('a memory that replaces it');
  const other = await memory.remember('a', { text: 'Reviews happen on Thursdays', predicate: 'review-day' }, current);
  memory.forget('a', { id: other.id }, current);
  check('a forgotten memory');
  assert.ok(saved.id && memory.store.list({ botId: 'a', history: true }).length >= 3);
  const marks = memory.store.observations('a').slice(0, 5);
  for (const ref of marks) memory.store.setMeta(`reviewed:a:${ref.id}:${ref.revision}`, true);
  check('review marks');
  memory.store.setMeta(`reviewed:a:${marks[0].id}:${marks[0].revision}`, false);
  check('a review mark taken back');
  assert.throws(() => memory.store.transaction(() => {
    memory.observe('a', event(17, 'This message is rolled back'));
    memory.store.setMeta('reviewed:a:nothing', true);
    throw new Error('stop');
  }), /stop/);
  check('a rollback');
  assert.equal(memory.store.observations('a').some(ref => memory.store.source(ref.id, ref.revision)?.eventId === '$17'), false);
  return bots;
}

test('rows kept in memory read the same as the file after every kind of write', () => withMemory({}, async (memory, directory) => {
  const bots = await story(memory);
  const kept = bots.map(bot => [memory.store.watermarks(bot), memory.store.observations(bot), memory.store.list({ botId: bot, history: true }), memory.store.contacts()]);
  const reopened = new MemoryStore(join(directory, 'knowledge.sqlite'), { clock: () => 50000 });
  try {
    assert.deepEqual(kept, bots.map(bot => [reopened.watermarks(bot), reopened.observations(bot), reopened.list({ botId: bot, history: true }), reopened.contacts()]));
  } finally { reopened.close(); }
}));

for (const cacheChars of [1500, 7000, 16000]) test(`a store that may keep ${cacheChars} characters starts over when it has more and still reads the file`, () => withMemory({ cacheChars }, async memory => {
  const reloads = memory.store.reload.bind(memory.store); let started = 0;
  memory.store.reload = () => { started++; return reloads(); };
  await story(memory);
  // The story itself starts over 13 times, once a check and once for the rollback; the rest is the allowance being passed.
  assert.ok(started > 40, `the allowance was passed while reading (${started})`);
  assert.ok(memory.store.held <= cacheChars);
}));

test('a row handed out by the store cannot be changed in place', () => withMemory({}, async memory => {
  memory.ingest('a', event(1, 'The launch checklist is due on Friday'), { sessionId: 's' });
  const ref = memory.store.observations('a')[0];
  assert.throws(() => { memory.store.source(ref.id).body = 'changed'; }, TypeError);
  assert.throws(() => { memory.store.observations('a').push(ref); }, TypeError);
  assert.throws(() => { memory.current('a', 's').sourceRefs.push(ref); }, TypeError);
  assert.equal(memory.store.source(ref.id).body, 'The launch checklist is due on Friday');
}));
