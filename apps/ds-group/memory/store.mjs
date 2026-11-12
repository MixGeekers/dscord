// Adapted from Shiyu relationship-domain, cognition-domain and ingress-domain.
// Accounts, source revisions and claims remain separate; labels never establish identity.
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const sortedJson = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
// The same value with the keys of every object in order, as the replacer above would rebuild it. Stored rows and
// rows read back are in order already and come back as they are: the replacer rebuilds every object on every call,
// which is most of what writing a row cost. A value with its own toJSON is left to sortedJson.
function ordered(value) {
  if (typeof value === 'bigint' || value !== null && typeof value === 'object' && typeof value.toJSON === 'function') throw new TypeError('not plain data');
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    let copy;
    for (let index = 0; index < value.length; index++) {
      const item = ordered(value[index]);
      if (item !== value[index]) (copy ||= value.slice())[index] = item;
    }
    return copy || value;
  }
  const keys = Object.keys(value), kind = Object.getPrototypeOf(value);
  let inOrder = kind === Object.prototype || kind === null;
  for (let index = 1; inOrder && index < keys.length; index++) inOrder = keys[index - 1] < keys[index];
  if (!inOrder) return Object.fromEntries(keys.sort().map(key => [key, ordered(value[key])]));
  let copy;
  for (const key of keys) {
    const item = ordered(value[key]);
    if (item !== value[key]) (copy ||= { ...value })[key] = item;
  }
  return copy || value;
}
/** JSON with the keys of every object in order: equal values give equal text, whatever order their keys were written in. */
export const canonical = value => { try { return JSON.stringify(ordered(value)); } catch { return sortedJson(value); } };
export const sha = value => createHash('sha256').update(value).digest('hex');
export const identityId = (transport, account) => `${transport}:${account}`;
export const canonicalIdentity = id => typeof id === 'string' && /^[@!]/.test(id) ? `matrix:${id}` : id;
export const sourceId = (transport, room, event) => `source_${sha(canonical([transport, room, event]))}`;
const parsed = row => row ? JSON.parse(row.json) : undefined;
const MISSING = Symbol('missing');
// What a source as a Bot knows it is counted as against the budget: a copy of the row's fields, sharing its text.
const KNOWN_SIZE = 256;
/** Every reader shares a kept row, so nobody may change one. */
function frozen(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.freeze(value); for (const item of Object.values(value)) frozen(item); }
  return value;
}
/**
 * Rows this process has read, kept so that a view over a Bot's whole history does not ask the file for the same row
 * thousands of times. The file stays the only record: a write drops the row here and the next read loads it again,
 * so what a reader gets is always what the file holds. A row that the file does not have is kept as missing.
 */
class Kept {
  constructor(store) { this.store = store; this.rows = new Map(); this.sizes = new Map(); }
  /** @param load reads the row's JSON text from the file, or nothing when the file has no such row */
  read(key, load) {
    const hit = this.rows.get(key);
    if (hit !== undefined) return hit === MISSING ? undefined : hit;
    const json = load(), size = (json?.length || 0) + 64;
    this.store.hold(size);
    this.rows.set(key, json === undefined ? MISSING : frozen(JSON.parse(json))); this.sizes.set(key, size);
    return this.rows.get(key) === MISSING ? undefined : this.rows.get(key);
  }
  drop(key) {
    if (!this.rows.delete(key)) return;
    this.store.held -= this.sizes.get(key); this.sizes.delete(key);
  }
  clear() { this.rows.clear(); this.sizes.clear(); }
}
const fail = code => { throw Object.assign(new Error(code), { code }); };
const nonempty = (value, code) => typeof value === 'string' && value.trim() ? value.trim() : fail(code);
function contactObservation(old, { id, name, kind, ownerId, source, observedAt }) {
  const newer = !old || observedAt >= (old.nameAt || 0);
  const effectiveKind = kind === 'unknown' && old ? old.kind : newer ? kind : old.kind;
  const effectiveOwner = ownerId || old?.ownerId;
  if (old?.name === name && old.kind === effectiveKind && old.ownerId === effectiveOwner && observedAt <= (old.nameAt || 0)) return old;
  return { id, kind: effectiveKind, ...(effectiveOwner ? { ownerId: effectiveOwner } : {}),
    name: newer ? name : old.name, nameAt: newer ? observedAt : old.nameAt,
    aliases: [...new Set([...(old?.aliases || []), name])],
    observations: [...(old?.observations || []), { name, kind, source, at: observedAt }].slice(-100) };
}

export class MemoryStore {
  /** @param cacheChars how much JSON text of rows already read this store keeps in memory; past it, it starts over */
  constructor(filename, { clock = Date.now, cacheChars = 48_000_000 } = {}) {
    if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
    this.clock = clock;
    this.cacheChars = cacheChars; this.held = 0; this.changes = 0;
    this.statements = new Map(); this.memos = new Map();
    this.meta = new Kept(this); this.memories = new Kept(this); this.contactRows = new Kept(this); this.identities = new Kept(this);
    // Source revisions never change once written: id -> revision -> row. A head is the newest revision of an id.
    this.sourceRows = new Map(); this.heads = new Map();
    // Per Bot: what it observed, in order, and how it is to treat the few sources that are more than context.
    this.observed = new Map(); this.dispositions = new Map();
    // Per Bot, worked out from the rows above and kept in step with them: which observations carry an event, which
    // revisions of a source were observed, and each source as that Bot knows it.
    this.eventRefs = new Map(); this.observedRevisions = new Map(); this.knownRows = new Map(); this.knownHeld = 0;
    this.counted = new Map();
    this.db = new DatabaseSync(filename);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS contacts(id TEXT PRIMARY KEY, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS identity_accounts(account TEXT PRIMARY KEY, identity TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sources(id TEXT, revision INTEGER, json TEXT NOT NULL, PRIMARY KEY(id,revision));
      CREATE TABLE IF NOT EXISTS source_heads(id TEXT PRIMARY KEY,revision INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS memories(id TEXT PRIMARY KEY,bot TEXT NOT NULL,scope TEXT NOT NULL,status TEXT NOT NULL,json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS memory_lookup ON memories(bot,scope,status);
      CREATE TABLE IF NOT EXISTS journal(seq INTEGER PRIMARY KEY AUTOINCREMENT,json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS observations(bot TEXT NOT NULL,seq INTEGER NOT NULL,source TEXT NOT NULL,revision INTEGER NOT NULL,
        PRIMARY KEY(bot,seq),UNIQUE(bot,source,revision));
      CREATE TABLE IF NOT EXISTS observation_dispositions(bot TEXT NOT NULL,source TEXT NOT NULL,revision INTEGER NOT NULL,json TEXT NOT NULL,
        PRIMARY KEY(bot,source,revision));
      CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,json TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS journal_action ON journal(json_extract(json,'$.action'));`);
    this.deploymentId = this.getMeta('deployment') || `dscord_${randomUUID()}`;
    this.setMeta('deployment', this.deploymentId);
  }
  close() { this.statements.clear(); this.db.close(); }
  /** A statement is compiled once; the hot paths run the same few statements for every row. */
  sql(text) {
    let statement = this.statements.get(text);
    if (!statement) this.statements.set(text, statement = this.db.prepare(text));
    return statement;
  }
  /** Room for a row about to be kept. A store that outgrows its budget starts over instead of growing without limit. */
  hold(size) {
    if (this.held + size > this.cacheChars) this.reload();
    this.held += size;
  }
  /** Drop everything kept in memory; the next read of anything loads it from the file. For a file changed behind this store's back. */
  reload() {
    for (const kept of [this.meta, this.memories, this.contactRows, this.identities]) kept.clear();
    for (const map of [this.sourceRows, this.heads, this.observed, this.dispositions, this.memos, this.eventRefs, this.observedRevisions, this.knownRows, this.counted]) map.clear();
    this.held = 0; this.knownHeld = 0; this.changes++;
  }
  /**
   * A value worked out from the whole store, good until the store next changes. Of the notes in meta only review
   * marks count as a change here: a value that reads any other note has to read it each time.
   */
  memo(name, compute) {
    const hit = this.memos.get(name);
    if (hit?.at === this.changes) return hit.value;
    const value = compute();
    this.memos.set(name, { at: this.changes, value });
    return value;
  }
  transaction(fn) {
    // Batch ingress/review composes these same synchronous store operations.
    if (this.inTransaction) return fn();
    this.db.exec('BEGIN IMMEDIATE');
    this.inTransaction = true;
    // What was read inside a transaction that is rolled back is not what the file holds.
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); this.reload(); throw error; }
    finally { this.inTransaction = false; }
  }
  getMeta(key) { return this.meta.read(key, () => this.sql('SELECT json FROM meta WHERE key=?').get(key)?.json); }
  setMeta(key, value) {
    if (key.startsWith('reviewed:')) this.reviewMarked(key, value);
    this.sql('INSERT OR REPLACE INTO meta VALUES(?,?)').run(key, canonical(value));
    this.meta.drop(key);
  }
  /** A review mark is about to be written: what was worked out from the marks follows it. */
  reviewMarked(key, value) {
    this.changes++; this.forgetKnown();
    if (!this.counted.size || this.getMeta(key) === true && value === true) return;
    const [, botId, id, revision] = /^reviewed:(.*):(source_[0-9a-f]{64}):(\d+)$/.exec(key) || [];
    // A mark only ever goes from unset to set. Anything else is counted again from the start.
    if (value !== true || botId === undefined) this.counted.clear();
    else if (this.counted.has(botId) && this.revisionsObserved(botId, id)?.has(Number(revision))) this.counted.get(botId).reviewedCount++;
  }
  log(action, value) { this.sql('INSERT INTO journal(json) VALUES(?)').run(canonical({ changeId: randomUUID(), action, at: this.clock(), ...value })); }
  contact({ id, name = id, kind = 'human', ownerId, source, observedAt = this.clock(), botId }) {
    nonempty(id, 'IDENTITY_REQUIRED');
    const observation = { id, name, kind, ownerId, source, observedAt }, old = this.getContact(id), next = contactObservation(old, observation);
    if (next !== old) {
      this.sql('INSERT OR REPLACE INTO contacts VALUES(?,?)').run(id, canonical(next));
      this.contactRows.drop(id); this.changes++;
    }
    if (botId) {
      const key = `contact:${botId}:${id}`, prior = this.getMeta(key), own = contactObservation(prior, observation);
      if (own !== prior) this.setMeta(key, own);
    }
    return next;
  }
  /** A chat-server account belongs to this global identity; returns the identity. */
  link(account, identity) {
    const key = canonicalIdentity(account);
    this.sql('INSERT OR REPLACE INTO identity_accounts VALUES(?,?)').run(key, identity);
    this.identities.drop(key); this.changes++;
    return identity;
  }
  /** The identity an ID names: the global identity behind a known account, else the canonical ID itself. */
  identity(id) {
    const key = canonicalIdentity(id);
    if (typeof key !== 'string') return key;
    return this.identities.read(key, () => JSON.stringify(this.sql('SELECT identity FROM identity_accounts WHERE account=?').get(key)?.identity)) || key;
  }
  getContact(id) { return this.contactRows.read(id, () => this.sql('SELECT json FROM contacts WHERE id=?').get(id)?.json); }
  contacts(query = '') {
    return this.memo('contact-ids', () => this.sql('SELECT id FROM contacts ORDER BY id').all().map(row => row.id)).map(id => this.getContact(id))
      .filter(row => !query || row.id.includes(query) || row.aliases.some(name => name.includes(query)));
  }
  observe({ id, revision = 1, body = '', ...metadata }) {
    nonempty(id, 'SOURCE_REQUIRED');
    if (!Number.isSafeInteger(revision) || revision < 1) fail('SOURCE_REVISION_REQUIRED');
    const next = { ...metadata, id, revision, body, digest: sha(body), observedAt: this.clock() };
    const old = this.source(id, revision);
    if (old) {
      // Same event can arrive with a newer display label. Event content and authorship cannot change in place.
      if (old.digest !== next.digest || old.authorId !== next.authorId || old.roomId !== next.roomId || old.withdrawn !== next.withdrawn) fail('SOURCE_CONTENT_CONFLICT');
      return old;
    }
    return this.transaction(() => {
      const head = this.source(id);
      if (head && revision <= head.revision) fail('STALE_SOURCE_REVISION');
      if (head && head.authorId !== next.authorId) fail('SOURCE_AUTHOR_CONFLICT');
      this.sql('INSERT INTO sources VALUES(?,?,?)').run(id, revision, canonical(next));
      this.sql('INSERT OR REPLACE INTO source_heads VALUES(?,?)').run(id, revision);
      this.sourceRows.get(id)?.delete(revision); this.heads.delete(id); this.changes++;
      // The revision that was the newest until now is out of date for every Bot that observed it.
      if (head && !head.withdrawn) for (const [botId, count] of this.counted) if (this.revisionsObserved(botId, id)?.has(head.revision)) count.invalidatedCount++;
      // Every Bot that knows this source knows it by its newest revision.
      for (const known of this.knownRows.values()) {
        const dropped = known.get(id)?.size || 0;
        if (known.delete(id)) { this.held -= dropped * KNOWN_SIZE; this.knownHeld -= dropped * KNOWN_SIZE; }
      }
      this.log('source', { id, revision });
      return next;
    });
  }
  source(id, revision) {
    if (revision === undefined) {
      revision = this.heads.get(id);
      if (revision === undefined) this.heads.set(id, revision = this.sql('SELECT revision FROM source_heads WHERE id=?').get(id)?.revision ?? MISSING);
      if (revision === MISSING) return undefined;
    }
    const hit = this.sourceRows.get(id)?.get(revision);
    if (hit !== undefined) return hit === MISSING ? undefined : hit;
    const json = this.sql('SELECT json FROM sources WHERE id=? AND revision=?').get(id, revision)?.json;
    this.hold((json?.length || 0) + 64);
    const row = json === undefined ? MISSING : frozen(JSON.parse(json));
    let revisions = this.sourceRows.get(id);
    if (!revisions) this.sourceRows.set(id, revisions = new Map());
    revisions.set(revision, row);
    return row === MISSING ? undefined : row;
  }
  sources() { return this.sql('SELECT s.json FROM sources s JOIN source_heads h ON h.id=s.id AND h.revision=s.revision ORDER BY s.rowid').all().map(parsed); }
  observeFor(botId, refs) {
    nonempty(botId, 'BOT_REQUIRED');
    return this.transaction(() => refs.map(ref => {
      if (!this.source(ref.id, ref.revision)) fail('SOURCE_NOT_FOUND');
      const old = this.sql('SELECT seq FROM observations WHERE bot=? AND source=? AND revision=?').get(botId, ref.id, ref.revision);
      if (old) return { sequence: old.seq, ...ref };
      const sequence = this.sql('SELECT COALESCE(MAX(seq),0)+1 AS seq FROM observations WHERE bot=?').get(botId).seq;
      this.sql('INSERT INTO observations VALUES(?,?,?,?)').run(botId, sequence, ref.id, ref.revision);
      // The new observation is the last one: readers of the old list keep theirs, the next reader gets this one.
      const rows = this.observed.get(botId), row = Object.freeze({ sequence, id: ref.id, revision: ref.revision });
      if (rows) this.observed.set(botId, Object.freeze([...rows, row]));
      const events = this.eventRefs.get(botId), revisions = this.observedRevisions.get(botId);
      if (events) {
        const event = this.source(ref.id, ref.revision)?.eventId;
        if (events.has(event)) events.get(event).push(row); else events.set(event, [row]);
      }
      if (revisions) { if (revisions.has(ref.id)) revisions.get(ref.id).add(ref.revision); else revisions.set(ref.id, new Set([ref.revision])); }
      const count = this.counted.get(botId);
      if (count) { const state = this.observedState(botId, row); if (state.reviewed) count.reviewedCount++; if (state.invalidated) count.invalidatedCount++; }
      this.changes++;
      return { sequence, ...ref };
    }));
  }
  /** What a Bot observed, in order. The list is shared by every reader: read it, never change it. */
  observations(botId) {
    let rows = this.observed.get(botId);
    if (!rows) this.observed.set(botId, rows = frozen(this.sql('SELECT seq AS sequence,source AS id,revision FROM observations WHERE bot=? ORDER BY seq').all(botId)));
    return rows;
  }
  setSourceDisposition(botId, ref, disposition) {
    if (!disposition || !['context', 'pending-request', 'task-update'].includes(disposition.kind)
      || disposition.kind === 'task-update' && (typeof disposition.forEventId !== 'string' || !disposition.forEventId || disposition.forEventId.length > 1024)) fail('MEMORY_DISPOSITION_INVALID');
    if (!this.sql('SELECT 1 FROM observations WHERE bot=? AND source=? AND revision=?').get(botId, ref.id, ref.revision)) fail('MEMORY_SOURCE_NOT_OBSERVED');
    const old = this.sourceDisposition(botId, ref);
    // A generic contextual replay cannot downgrade a trusted queued-work marker.
    if (old.kind !== 'context' && disposition.kind === 'context') return old;
    const value = { kind: disposition.kind, ...(disposition.kind === 'task-update' ? { forEventId: disposition.forEventId } : {}) };
    this.sql('INSERT OR REPLACE INTO observation_dispositions VALUES(?,?,?,?)').run(botId, ref.id, ref.revision, canonical(value));
    this.dispositions.delete(botId); this.changes++;
    return value;
  }
  // Few sources are anything but context: a Bot's are read together, and every other source needs no lookup.
  sourceDisposition(botId, ref) {
    let rows = this.dispositions.get(botId);
    if (!rows) {
      this.dispositions.set(botId, rows = new Map());
      for (const row of this.sql('SELECT source,revision,json FROM observation_dispositions WHERE bot=?').all(botId)) {
        if (!rows.has(row.source)) rows.set(row.source, new Map());
        rows.get(row.source).set(row.revision, frozen(JSON.parse(row.json)));
      }
    }
    return rows.get(ref.id)?.get(Number(ref.revision)) || { kind: 'context' };
  }
  admitSources(botId, current) {
    for (const ref of current.sourceRefs || []) {
      const source = this.source(ref.id, ref.revision); if (!source) continue;
      if (!this.getMeta(`admitted-source:${botId}:${ref.id}`)) this.setMeta(`admitted-source:${botId}:${ref.id}`,
        { revision: ref.revision, eventId: source.eventId, sessionId: current.sessionId || null, at: this.clock() });
    }
  }
  sourceAdmitted(botId, ref) { return Boolean(this.getMeta(`admitted-source:${botId}:${ref.id}`)); }
  /** The revisions of a source that a Bot observed, if any. */
  revisionsObserved(botId, id) {
    let revisions = this.observedRevisions.get(botId);
    if (!revisions) {
      revisions = new Map();
      for (const ref of this.observations(botId)) { if (revisions.has(ref.id)) revisions.get(ref.id).add(ref.revision); else revisions.set(ref.id, new Set([ref.revision])); }
      this.observedRevisions.set(botId, revisions);
    }
    return revisions.get(id);
  }
  /**
   * A source as one Bot knows it: with its place in what the Bot observed, whether it is still the newest revision,
   * and whether the Bot has reviewed it. Kept until the source gets a new revision or a review mark is written.
   * @param ref the revision, with `sequence` when the Bot observed it
   */
  knownSource(botId, ref) {
    const sequence = ref.sequence ?? null;
    const hit = this.knownRows.get(botId)?.get(ref.id)?.get(ref.revision);
    if (hit && hit.sequence === sequence) return hit;
    const source = this.source(ref.id, ref.revision), head = this.source(ref.id);
    if (!source) return undefined;
    const row = Object.freeze({ ...source, sequence, currentRevision: head?.revision ?? null,
      derivation: !head || head.withdrawn ? 'source-withdrawn' : head.revision !== ref.revision ? 'source-revised' : 'current',
      reviewed: this.getMeta(`reviewed:${botId}:${ref.id}:${ref.revision}`) === true });
    this.hold(KNOWN_SIZE); this.knownHeld += KNOWN_SIZE;
    let known = this.knownRows.get(botId);
    if (!known) this.knownRows.set(botId, known = new Map());
    if (!known.has(ref.id)) known.set(ref.id, new Map());
    known.get(ref.id).set(ref.revision, row);
    return row;
  }
  forgetKnown() { this.knownRows.clear(); this.held -= this.knownHeld; this.knownHeld = 0; }
  eventAdmitted(botId, eventId, roomId) {
    // Which of a Bot's observations carry an event: asked once for every task update a view goes through.
    let byEvent = this.eventRefs.get(botId);
    if (!byEvent) {
      byEvent = new Map();
      for (const ref of this.observations(botId)) {
        const event = this.source(ref.id, ref.revision)?.eventId;
        if (byEvent.has(event)) byEvent.get(event).push(ref); else byEvent.set(event, [ref]);
      }
      this.eventRefs.set(botId, byEvent);
    }
    return (byEvent.get(eventId) || []).some(ref => {
      const source = this.source(ref.id, ref.revision);
      return (!roomId || source.roomId === roomId) && this.sourceAdmitted(botId, ref);
    });
  }
  watermarks(botId) {
    return { ...this.countObserved(botId),
      contextThrough: this.getMeta(`context-through:${botId}`) || 0,
      pendingReviewCount: (this.getMeta(`unreviewed:${botId}`) || []).filter(ref => {
        const source = this.source(ref.id);
        return source && source.revision === ref.revision && !source.withdrawn && !this.getMeta(`reviewed:${botId}:${ref.id}:${ref.revision}`);
      }).length };
  }
  /** Where one observation stands: reviewed, out of date (revised or withdrawn since), or a notice that needs no review. */
  observedState(botId, row) {
    const head = this.source(row.id);
    return { reviewed: this.getMeta(`reviewed:${botId}:${row.id}:${row.revision}`) === true,
      invalidated: Boolean(!head || head.revision !== row.revision || head.withdrawn), notice: head?.eventKind === 'redaction-notice' };
  }
  /** The watermarks that come from going through everything a Bot observed, counted from the first observation. */
  scanObserved(botId) {
    const rows = this.observations(botId);
    let reviewedThrough = 0, settledThrough = 0, reviewedCount = 0, invalidatedCount = 0;
    for (const row of rows) {
      const { reviewed, invalidated, notice } = this.observedState(botId, row);
      if (reviewed) reviewedCount++;
      if (invalidated) invalidatedCount++;
      if (row.sequence === reviewedThrough + 1 && reviewed) reviewedThrough = row.sequence;
      if (row.sequence === settledThrough + 1 && (reviewed || invalidated || notice)) settledThrough = row.sequence;
    }
    return { receivedThrough: rows.at(-1)?.sequence || 0, reviewedThrough, settledThrough, reviewedCount, invalidatedCount };
  }
  /**
   * The same watermarks, kept up as the store changes instead of counted again for every message. An observation is
   * never removed, a review mark is never taken back, and a revision that is out of date stays so: the two counts
   * only grow, by what observeFor, observe and reviewMarked add, and the two positions only move forward.
   */
  countObserved(botId) {
    const rows = this.observations(botId);
    let count = this.counted.get(botId);
    if (!count) {
      const { reviewedThrough, settledThrough, reviewedCount, invalidatedCount } = this.scanObserved(botId);
      this.counted.set(botId, count = { reviewedThrough, settledThrough, reviewedCount, invalidatedCount });
    }
    // A position is reached through observations numbered 1, 2, 3 and so on: the one after position n is the nth row.
    for (let row = rows[count.reviewedThrough]; row?.sequence === count.reviewedThrough + 1 && this.observedState(botId, row).reviewed; row = rows[count.reviewedThrough]) count.reviewedThrough = row.sequence;
    for (let row = rows[count.settledThrough], state; row?.sequence === count.settledThrough + 1
      && ((state = this.observedState(botId, row)).reviewed || state.invalidated || state.notice); row = rows[count.settledThrough]) count.settledThrough = row.sequence;
    return { receivedThrough: rows.at(-1)?.sequence || 0, reviewedThrough: count.reviewedThrough, settledThrough: count.settledThrough,
      reviewedCount: count.reviewedCount, invalidatedCount: count.invalidatedCount };
  }
  evidenceRoots(refs, seen = new Set()) {
    const roots = new Map();
    for (const ref of refs) {
      const key = `${ref.id}:${ref.revision}`; if (seen.has(key)) continue; seen.add(key);
      const source = this.source(ref.id, ref.revision);
      const origins = source?.originRefs?.filter(origin => this.source(origin.id, origin.revision)) || [];
      if (origins.length) for (const root of this.evidenceRoots(origins, seen)) roots.set(`${root.id}:${root.revision}`, root);
      else roots.set(key, { id: ref.id, revision: ref.revision });
    }
    return [...roots.values()].sort((a, b) => a.id.localeCompare(b.id));
  }
  retractSource(id) {
    const old = this.source(id); if (!old) fail('SOURCE_NOT_FOUND');
    return this.observe({ ...old, revision: old.revision + 1, withdrawn: true });
  }
  get(id) { return this.memories.read(id, () => this.sql('SELECT json FROM memories WHERE id=?').get(id)?.json); }
  write(row) {
    this.sql('INSERT OR REPLACE INTO memories VALUES(?,?,?,?,?)').run(row.id, row.botId, row.scope, row.status, canonical(row));
    this.memories.drop(row.id); this.changes++;
    return row;
  }
  prepare(input) {
    const botId = nonempty(input.botId, 'BOT_REQUIRED'), scope = nonempty(input.scope, 'SCOPE_REQUIRED');
    const text = nonempty(input.text, 'MEMORY_EMPTY');
    if (Buffer.byteLength(text) > 15000) fail('MEMORY_TOO_LONG');
    const sourceRefs = [...new Map((input.sourceRefs || []).map(ref => [`${ref.id}:${ref.revision}`, ref])).values()]
      .sort((a, b) => a.id.localeCompare(b.id) || a.revision - b.revision);
    if (!sourceRefs.length) fail('MEMORY_SOURCE_REQUIRED');
    for (const ref of sourceRefs) {
      const source = this.source(ref.id);
      if (!source || source.revision !== ref.revision || source.withdrawn) fail('MEMORY_SOURCE_STALE');
    }
    const subjectId = this.identity(nonempty(input.subjectId, 'SUBJECT_REQUIRED'));
    const predicate = input.predicate?.trim() || 'note';
    const kind = input.kind || 'stated';
    if (!['stated', 'reported', 'observation', 'inference'].includes(kind)) fail('INVALID_CLAIM_KIND');
    const validFrom = input.validFrom ?? Math.min(...sourceRefs.map(ref => this.source(ref.id).timestamp ?? this.clock()));
    const validUntil = input.validUntil ?? null;
    const saidBy = this.identity(input.saidBy) || null;
    if (!Number.isFinite(validFrom) || validUntil !== null && (!Number.isFinite(validUntil) || validUntil <= validFrom)) fail('INVALID_VALIDITY');
    const claimState = input.claimState || 'statement';
    if (!['statement', 'proposal', 'confirmed', 'uncertain'].includes(claimState)) fail('INVALID_CLAIM_STATE');
    const ids = (values, identify = canonicalIdentity) => {
      if (values === undefined) return [];
      if (!Array.isArray(values) || values.length > 32 || values.some(id => typeof id !== 'string' || !id.trim() || id.length > 512)) fail('INVALID_MEMORY_ENTITIES');
      return [...new Set(values.map(id => identify(id.trim())))].sort();
    };
    const entityIds = ids(input.entityIds, id => this.identity(id)), projectIds = ids(input.projectIds), facets = ids(input.facets);
    if (input.basisRefs !== undefined && (!Array.isArray(input.basisRefs) || input.basisRefs.some(ref => !ref || typeof ref.id !== 'string' || !Number.isSafeInteger(ref.revision) || ref.revision < 1))) fail('INVALID_MEMORY_BASIS');
    const basisRefs = [...new Map((input.basisRefs || []).map(ref => [`${ref.id}:${ref.revision}`, { id: ref.id, revision: ref.revision }])).values()]
      .sort((a,b) => a.id.localeCompare(b.id));
    if (basisRefs.length > 32) fail('INVALID_MEMORY_BASIS');
    for (const ref of basisRefs) {
      const basis = this.get(ref.id);
      if (!basis || basis.revision !== ref.revision || basis.botId !== botId && basis.scope !== 'team' || this.derivation(basis) !== 'current') fail('MEMORY_BASIS_STALE');
    }
    // Keep the pre-v2 identity for claims without added semantic metadata. An
    // upgrade/retry must not duplicate every legacy record in an existing store.
    const fingerprint = sha(canonical({ botId, scope, text, sourceRefs, subjectId, predicate, kind,
      ...(claimState !== 'statement' ? { claimState } : {}), ...(entityIds.length ? { entityIds } : {}),
      ...(projectIds.length ? { projectIds } : {}), ...(facets.length ? { facets } : {}), ...(basisRefs.length ? { basisRefs } : {}),
      saidBy, validFrom, validUntil, replaces: input.replaces || null }));
    const id = `memory_${fingerprint}`;
    const duplicate = this.get(id); if (duplicate) return duplicate;
    const old = input.replaces ? this.get(input.replaces) : undefined;
    const reclassify = old && input.reclassify === true && old.text === text
      && canonical(old.sourceRefs) === canonical(sourceRefs);
    if (input.replaces && (!old || old.status !== 'active' || old.revision !== input.expectedRevision
      || old.botId !== botId || old.scope !== scope || this.identity(old.subjectId) !== subjectId && !reclassify)) fail('MEMORY_REVISION_CONFLICT');
    return this.write({ id, rootId: old?.rootId || id, revision: (old?.revision || 0) + 1,
      botId, scope, text, subjectId, predicate, kind, claimState, entityIds, projectIds, facets, basisRefs, saidBy, topic: input.topic || null,
      sourceRefs, validFrom, validUntil, observedAt: this.clock(), replaces: old?.id || null,
      ...(reclassify ? { reclassifiedFrom: old.subjectId } : {}),
      status: 'pending', bodyDigest: sha(text), receipt: null, index: null });
  }
  activate(id, receipt) {
    return this.transaction(() => {
      const row = this.get(id); if (!row) fail('MEMORY_NOT_FOUND');
      if (row.status === 'active') return row;
      if (row.status !== 'pending') fail('MEMORY_NOT_PENDING');
      if (receipt.bodyDigest !== row.bodyDigest) fail('MEMORY_BODY_MISMATCH');
      if (this.basisStatus(row).status !== 'current') fail('MEMORY_SOURCE_STALE');
      if (row.replaces) {
        const old = this.get(row.replaces);
        if (old.status !== 'active' || old.revision + 1 !== row.revision) fail('MEMORY_REVISION_CONFLICT');
        this.write({ ...old, status: 'superseded', supersededBy: row.id });
      }
      const saved = this.write({ ...row, status: 'active', receipt });
      this.log('remember', { id, revision: row.revision, replaces: row.replaces, botId: row.botId }); return saved;
    });
  }
  indexed(id, index) { const row = this.get(id); return this.write({ ...row, index }); }
  forget(id, expectedRevision) {
    return this.transaction(() => {
      const row = this.get(id);
      if (!row || row.status !== 'active' || row.revision !== expectedRevision) fail('MEMORY_REVISION_CONFLICT');
      this.log('forget', { id, revision: row.revision, botId: row.botId });
      return this.write({ ...row, status: 'withdrawn', withdrawnAt: this.clock() });
    });
  }
  undo(changeId) {
    return this.transaction(() => {
      const change = this.history().find(item => item.changeId === changeId || `${item.action}:${item.id}` === changeId);
      if (!change) fail('MEMORY_CHANGE_NOT_FOUND');
      changeId = change.changeId || `${change.action}:${change.id}`;
      if (this.getMeta(`undone:${changeId}`)) fail('MEMORY_ALREADY_RESTORED');
      const action = change.action, row = this.get(change.id);
      if (!row) fail('MEMORY_NOT_FOUND');
      if (change.revision !== undefined && row.revision !== change.revision) fail('MEMORY_REVISION_CONFLICT');
      if (action === 'forget') {
        if (row.status !== 'withdrawn') fail('MEMORY_REVISION_CONFLICT');
        this.write({ ...row, status: 'active', revision: row.revision + 1 });
      } else if (action === 'remember') {
        if (row.status !== 'active') fail('MEMORY_REVISION_CONFLICT');
        this.write({ ...row, status: 'withdrawn', withdrawnAt: this.clock() });
        if (row.replaces) {
          const old = this.get(row.replaces);
          if (old.status !== 'superseded' || old.supersededBy !== row.id) fail('MEMORY_REVISION_CONFLICT');
          this.write({ ...old, status: 'active', revision: row.revision + 1 });
        }
      } else fail('MEMORY_CHANGE_NOT_FOUND');
      this.setMeta(`undone:${changeId}`, true); this.log('restore', { changeId, botId: row.botId });
      return this.get(row.replaces && action === 'remember' ? row.replaces : row.id);
    });
  }
  basisStatus({ sourceRefs = [], basisRefs = [] }, asOf = this.clock(), seen = new Set()) {
    const issues = [], pending = [...sourceRefs], visited = new Set();
    for (const ref of pending) {
      const key = `${ref.id}:${ref.revision}`; if (visited.has(key)) continue; visited.add(key);
      const head = this.source(ref.id);
      if (!head || head.withdrawn || head.revision !== ref.revision) issues.push({ type: 'source', ...ref, currentRevision: head?.revision ?? null,
        reason: !head || head.withdrawn ? 'source-withdrawn' : 'source-revised' });
      const source = this.source(ref.id, ref.revision);
      pending.push(...(source?.originRefs || []).filter(origin => this.source(origin.id)));
    }
    for (const ref of basisRefs) {
      const row = this.get(ref.id), state = row ? this.derivation(row, asOf, seen) : 'missing';
      if (!row || row.revision !== ref.revision || state !== 'current') issues.push({ type: 'memory', ...ref,
        currentRevision: row?.revision ?? null, reason: row && row.revision !== ref.revision ? 'basis-revised' : `basis-${state}` });
    }
    return { status: issues.length ? 'needs-review' : 'current', issues };
  }
  derivation(row, asOf = this.clock(), seen = new Set()) {
    if (!row) return 'missing';
    if (seen.has(row.id)) return 'basis-cycle';
    seen = new Set([...seen, row.id]);
    if (row.status !== 'active') return row.status;
    if (asOf < row.validFrom) return 'not-yet-valid';
    if (row.validUntil !== null && asOf >= row.validUntil) return 'expired';
    const pending = [...row.sourceRefs], visited = new Set();
    for (const ref of pending) {
      const key = `${ref.id}:${ref.revision}`; if (visited.has(key)) continue; visited.add(key);
      const source = this.source(ref.id);
      if (!source || source.withdrawn) return 'source-withdrawn';
      if (source.revision !== ref.revision) return 'source-revised';
      // A known original event invalidates its relay chain as well. An explicitly
      // unavailable original stays a reported source, never fabricated evidence.
      pending.push(...(source.originRefs || []).filter(origin => this.source(origin.id)));
    }
    const basis = this.basisStatus({ basisRefs: row.basisRefs }, asOf, seen);
    if (basis.status !== 'current') return basis.issues[0].reason;
    return 'current';
  }
  list({ botId, scopes, subjectId, topic, asOf, history = false } = {}) {
    const rows = this.memo('memory-ids', () => this.sql('SELECT id FROM memories ORDER BY rowid').all().map(row => row.id)).map(id => this.get(id))
      .filter(row => (!botId || row.botId === botId || row.scope === 'team')
        && (!scopes || scopes.includes(row.scope)) && (!subjectId || this.identity(row.subjectId) === this.identity(subjectId)) && (!topic || row.topic === topic))
      .map(row => ({ ...row, derivation: this.derivation(row, asOf) }));
    return history ? rows : rows.filter(row => row.derivation === 'current');
  }
  conflicts(row) {
    if (row.predicate === 'note' || !['stated', 'observation'].includes(row.kind)) return [];
    return this.list({ botId: row.botId, scopes: [row.scope], subjectId: row.subjectId })
      .filter(other => other.id !== row.id && other.predicate === row.predicate && other.text !== row.text
        && ['stated', 'observation'].includes(other.kind)).map(other => other.id);
  }
  /** The journal, newest first. @param actions only entries of these kinds, found without reading the rest */
  history(actions) {
    return (actions ? this.sql(`SELECT json FROM journal WHERE json_extract(json,'$.action') IN (${actions.map(() => '?').join(',')}) ORDER BY seq DESC`).all(...actions)
      : this.sql('SELECT json FROM journal ORDER BY seq DESC').all()).map(parsed);
  }
}
