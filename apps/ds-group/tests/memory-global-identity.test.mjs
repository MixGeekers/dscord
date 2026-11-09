import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MemoryService } from '../memory/service.mjs';
import { sourceId } from '../memory/store.mjs';

const input = (eventId, senderId, roomId) => ({
  event: { eventId, senderId, roomId, body: '我周三下午有空。', timestamp: 100 }, context: { room: { id: roomId, name: roomId },
    source: { transport: 'matrix', eventId, roomId, sender: { id: senderId, name: 'Ann', kind: 'human', globalId: 'ann@central.test' }, timestamp: 100 } },
});

test('a person on two chat servers is one memory identity, and each source keeps the account it came from', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'memory-global-identity-')), memory = new MemoryService({ directory });
  try {
    memory.observe('bot', input('$one', '@ann:one.test', '!r:one.test'));
    memory.observe('bot', input('$two', '@ann:two.test', '!s:two.test'));
    assert.deepEqual(memory.contacts('bot').filter(contact => contact.kind === 'human').map(contact => contact.id), ['ann@central.test']);
    const sources = [['!r:one.test', '$one'], ['!s:two.test', '$two']].map(([room, event]) => memory.store.source(sourceId('matrix', room, event)));
    assert.deepEqual(sources.map(source => [source.authorId, source.authorAccount]),
      [['ann@central.test', 'matrix:@ann:one.test'], ['ann@central.test', 'matrix:@ann:two.test']]);
    // Naming the person by either account finds the same identity.
    assert.equal(memory.store.identity('@ann:two.test'), 'ann@central.test');
    assert.equal(memory.profile('bot', { kind: 'person', id: '@ann:one.test' }).identity.id, 'ann@central.test');
  } finally { await memory.close(); await rm(directory, { recursive: true }); }
});
