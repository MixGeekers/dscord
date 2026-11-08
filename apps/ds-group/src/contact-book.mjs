/**
 * One Bot's own contact book: who it has met, where it can reach them, and the
 * exchanges it has had with them. Every routing decision reads this book instead
 * of guessing. Each Bot keeps its own; the same person can sit in two Bots' books
 * with different shared rooms and different exchanges.
 *
 * A contact is keyed by its full identity ID, which is also the key of the
 * person's memory profile. What someone is like, prefers or can do lives only in
 * memory, so nothing about a contact is recorded twice.
 */
// How many times one piece of work may be passed from Bot to Bot; results going back do not count.
export const MAX_ASK_DEPTH = 4;

export const EXCHANGE_STATUSES = ['received', 'dispatched', 'sending', 'sent', 'returned', 'delivered', 'failed'];

const json = value => value === undefined || value === null ? null : JSON.stringify(value);
const parse = value => value ? JSON.parse(value) : null;

export class ContactBook {
  /**
   * @param {object} options
   * @param {import('node:sqlite').DatabaseSync} options.db the Bot's own node database
   * @param {{id: string}} options.self this Bot
   * @param {() => object[]} [options.people] registered people and Bots, for names and kinds
   * @param {(id: string) => ({name: string}|undefined)} [options.local] a Bot in this Bot's DSH, a contact before they meet in a room
   */
  constructor({ db, self, people = () => [], local = () => undefined, now = Date.now }) {
    Object.assign(this, { db, self, people, local, now });
    db.exec(`
      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        name TEXT,
        kind TEXT,
        first_seen_at INTEGER NOT NULL,
        first_room_id TEXT,
        introduced_by TEXT,
        last_exchange_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS contact_rooms (
        contact_id TEXT NOT NULL,
        room_id TEXT NOT NULL,
        seen_at INTEGER NOT NULL,
        PRIMARY KEY(contact_id, room_id)
      );
      CREATE TABLE IF NOT EXISTS contact_exchanges (
        id TEXT PRIMARY KEY,
        at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        direction TEXT NOT NULL,
        peer_id TEXT NOT NULL,
        via TEXT NOT NULL,
        room_id TEXT,
        origin_json TEXT,
        status TEXT NOT NULL,
        task_id TEXT,
        detail TEXT
      );
      CREATE INDEX IF NOT EXISTS contact_exchange_peer ON contact_exchanges(peer_id, at);
      CREATE INDEX IF NOT EXISTS contact_exchange_task ON contact_exchanges(task_id);
    `);
  }

  person(id) { return this.people().find(person => person.id === id); }

  /** Meet someone: the first sighting is kept, a later one only refreshes name and kind. */
  meet(id, { name, kind, roomId, by } = {}) {
    if (typeof id !== 'string' || !id || id === this.self.id) return;
    const known = this.person(id);
    this.db.prepare(`INSERT INTO contacts(id,name,kind,first_seen_at,first_room_id,introduced_by) VALUES (?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET name=COALESCE(excluded.name,contacts.name), kind=COALESCE(excluded.kind,contacts.kind)`)
      .run(id, known?.name || name || null, known?.kind || kind || null, this.now(), roomId || null, by || null);
  }

  /** A room's current members, from its roster. Only a member can read a roster, so this Bot is in it. */
  seeRoom(roomId, members) {
    const at = this.now();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('DELETE FROM contact_rooms WHERE room_id=?').run(roomId);
      const add = this.db.prepare('INSERT OR REPLACE INTO contact_rooms(contact_id,room_id,seen_at) VALUES (?,?,?)');
      add.run(this.self.id, roomId, at);
      for (const member of members) {
        if (!member?.id) continue;
        add.run(member.id, roomId, at);
        this.meet(member.id, { name: member.name, kind: member.kind, roomId });
      }
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }

  /** One membership change seen in a room's timeline. */
  member(roomId, id, membership, name) {
    // An invited Bot joins on its own; a request sent there reaches it.
    if (['join', 'invite'].includes(membership)) {
      this.db.prepare('INSERT OR REPLACE INTO contact_rooms(contact_id,room_id,seen_at) VALUES (?,?,?)').run(id, roomId, this.now());
      this.meet(id, { name, roomId });
    } else if (['leave', 'ban'].includes(membership)) {
      if (id === this.self.id) this.db.prepare('DELETE FROM contact_rooms WHERE room_id=?').run(roomId);
      else this.db.prepare('DELETE FROM contact_rooms WHERE contact_id=? AND room_id=?').run(id, roomId);
    }
  }

  /** Rooms this Bot and the contact are both known to be in. */
  rooms(id) {
    return this.db.prepare(`SELECT theirs.room_id FROM contact_rooms theirs JOIN contact_rooms mine
      ON mine.room_id=theirs.room_id AND mine.contact_id=? WHERE theirs.contact_id=? ORDER BY theirs.room_id`)
      .all(this.self.id, id).map(row => row.room_id);
  }

  /** Where to reach a contact over Matrix: the first preferred room both are in, else any shared room. */
  roomFor(id, preferred = []) {
    const shared = this.rooms(id);
    return preferred.find(roomId => shared.includes(roomId)) || shared[0];
  }

  /** How this Bot reaches a contact: always over Matrix, in a shared room, or in a direct room the core opens for them. */
  reach(id) {
    if (this.rooms(id).length) return { via: 'room' };
    const row = this.db.prepare('SELECT kind FROM contacts WHERE id=?').get(id);
    return this.local(id) || (this.person(id)?.kind || row?.kind) === 'bot' ? { via: 'direct' } : { via: null };
  }

  /**
   * The Bot a request names: its full ID (a Matrix link to it counts), or a name that only one Bot in the book has.
   * @returns {{id: string, name: string} | {error: string}}
   */
  resolve(to) {
    const address = String(to ?? '').trim().replace(/^https:\/\/matrix\.to\/#\//i, '').replace(/^matrix:(u\/)?/i, (_, u) => u ? '@' : '');
    const bots = this.list({ kind: 'bot' }).filter(contact => contact.reach);
    const byId = bots.find(contact => contact.id === address);
    if (byId) return byId;
    const named = bots.filter(contact => contact.name === address.replace(/^@/, ''));
    if (named.length === 1) return named[0];
    if (named.length > 1) return { error: `通讯录里有 ${named.length} 个叫“${address.replace(/^@/, '')}”的 Bot：${named.map(contact => contact.id).join('、')}。用完整 ID。` };
    return { error: `“${address}”不在你的通讯录里，联系不上；直接告诉请求者。` };
  }

  contact(id) {
    const row = this.db.prepare('SELECT * FROM contacts WHERE id=?').get(id);
    const known = this.person(id);
    const local = this.local(id);
    if (!row && !known && !local) return undefined;
    const reach = this.reach(id);
    return { id, name: known?.name || row?.name || local?.name || id, kind: known?.kind || row?.kind || (local ? 'bot' : 'unknown'),
      ...(known?.ownerId ? { ownerId: known.ownerId } : {}), ...(known?.role ? { role: known.role } : {}),
      rooms: this.rooms(id), reach: reach.via,
      sameDsh: Boolean(local), home: id.slice(id.indexOf(':') + 1),
      introducedBy: row?.introduced_by || null, firstSeenAt: row?.first_seen_at ?? null, firstRoomId: row?.first_room_id || null,
      lastExchangeAt: row?.last_exchange_at ?? null };
  }

  /** Everyone in the book, most recent exchange first. Bots in this DSH are contacts even before meeting. */
  list({ kind } = {}) {
    const ids = new Set(this.db.prepare('SELECT id FROM contacts ORDER BY last_exchange_at DESC, first_seen_at DESC').all().map(row => row.id));
    for (const person of this.people()) if (person.id !== this.self.id && this.local(person.id)) ids.add(person.id);
    return [...ids].map(id => this.contact(id)).filter(contact => contact && (!kind || contact.kind === kind));
  }

  /** The Bots this Bot can ask with ask_bot, and the rooms they share. */
  reachableBots() {
    return this.list({ kind: 'bot' }).filter(contact => contact.reach)
      .map(({ id, name, role, reach, rooms }) => ({ id, name, ...(role ? { role } : {}), reach, rooms }));
  }

  open({ id, direction, peer, via, roomId, origin, status, taskId, detail }) {
    if (!['in', 'out'].includes(direction) || !EXCHANGE_STATUSES.includes(status)) throw new RangeError('Invalid exchange');
    const at = this.now();
    this.meet(peer, direction === 'in' ? { by: peer } : { by: origin?.senderId });
    this.db.prepare(`INSERT INTO contact_exchanges(id,at,updated_at,direction,peer_id,via,room_id,origin_json,status,task_id,detail)
      VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at,
      origin_json=COALESCE(contact_exchanges.origin_json,excluded.origin_json), room_id=COALESCE(excluded.room_id,contact_exchanges.room_id),
      detail=COALESCE(contact_exchanges.detail,excluded.detail)`)
      .run(id, at, at, direction, peer, via, roomId || null, json(origin), status, taskId || null, detail ? String(detail).slice(0, 500) : null);
    this.db.prepare('UPDATE contacts SET last_exchange_at=? WHERE id=?').run(at, peer);
    return this.exchange(id);
  }

  settle(id, { status, taskId, detail } = {}) {
    if (status && !EXCHANGE_STATUSES.includes(status)) throw new RangeError('Invalid exchange status');
    const at = this.now();
    const changed = this.db.prepare(`UPDATE contact_exchanges SET updated_at=?, status=COALESCE(?,status),
      task_id=COALESCE(?,task_id), detail=COALESCE(?,detail) WHERE id=?`)
      .run(at, status || null, taskId || null, detail ? String(detail).slice(0, 500) : null, id).changes;
    if (changed) this.db.prepare('UPDATE contacts SET last_exchange_at=? WHERE id=(SELECT peer_id FROM contact_exchanges WHERE id=?)').run(at, id);
    return changed ? this.exchange(id) : undefined;
  }

  exchange(id) {
    const row = this.db.prepare('SELECT * FROM contact_exchanges WHERE id=?').get(id);
    return row && {
      id: row.id, at: row.at, updatedAt: row.updated_at, direction: row.direction, peerId: row.peer_id, via: row.via,
      roomId: row.room_id, origin: parse(row.origin_json), status: row.status, taskId: row.task_id, detail: row.detail };
  }

  /** Requests this Bot sent that have not come back yet, newest first: what it is already waiting on. */
  pending({ maxAgeMs = 2 * 60 * 60_000, limit = 10 } = {}) {
    return this.db.prepare(`SELECT id FROM contact_exchanges WHERE direction='out' AND status IN ('sending','sent','dispatched')
      AND at>=? ORDER BY at DESC, rowid DESC LIMIT ?`).all(this.now() - maxAgeMs, limit).map(row => this.exchange(row.id));
  }

  /** The open outbound exchange a returned task answers. */
  byTask(taskId, peer) {
    const row = this.db.prepare(`SELECT id FROM contact_exchanges WHERE task_id=? AND peer_id=? AND direction='out'
      ORDER BY at DESC LIMIT 1`).get(taskId, peer);
    return row && this.exchange(row.id);
  }

  /** Read-only owner view: contacts and exchanges, filtered by contact, newest first, paged by time. */
  view({ contact, limit = 50, before } = {}) {
    limit = Math.max(1, Math.min(200, Number(limit) || 50));
    const rows = this.db.prepare(`SELECT id FROM contact_exchanges WHERE (? IS NULL OR peer_id=?) AND (? IS NULL OR at<?)
      ORDER BY at DESC, rowid DESC LIMIT ?`).all(contact ?? null, contact ?? null, before ?? null, before ?? null, limit + 1);
    const exchanges = rows.slice(0, limit).map(row => this.exchange(row.id));
    return { contacts: contact ? [this.contact(contact)].filter(Boolean) : this.list(), exchanges,
      next: rows.length > limit ? exchanges.at(-1).at : null };
  }
}
