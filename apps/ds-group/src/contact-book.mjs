/**
 * One Bot's own contact book: who it has met, where it can reach them, and the
 * exchanges it has had with them. Every routing decision reads this book instead
 * of guessing. Each Bot keeps one book for all the chat servers it is on; the same
 * person can sit in two Bots' books with different shared rooms and exchanges.
 *
 * A contact is keyed by its global identity ID (`user@central-domain`), which is
 * also the key of the person's memory profile, so someone met on two servers is
 * one contact with an account on each. An account the server knows no global
 * identity for is its own identity, keyed by its Matrix ID. What someone is like,
 * prefers or can do lives only in memory, so nothing about a contact is recorded twice.
 *
 * Rooms and Matrix traffic belong to one server, so a node reads the book through
 * `on()`: the book as seen from the Bot's account on that server.
 */
// How many times one piece of work may be passed from Bot to Bot; results going back do not count.
export const MAX_ASK_DEPTH = 4;

export const EXCHANGE_STATUSES = ['received', 'dispatched', 'sending', 'sent', 'returned', 'delivered', 'failed'];

const json = value => value === undefined || value === null ? null : JSON.stringify(value);
const parse = value => value ? JSON.parse(value) : null;
const isAccount = id => typeof id === 'string' && id.startsWith('@');
/** The chat server a Matrix account is on. */
export const serverOf = account => account.slice(account.indexOf(':') + 1);

export class ContactBook {
  /**
   * @param {object} options
   * @param {import('node:sqlite').DatabaseSync} options.db the Bot's own contact database
   */
  constructor({ db, now = Date.now }) {
    Object.assign(this, { db, now });
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
      CREATE TABLE IF NOT EXISTS contact_accounts (
        account_id TEXT PRIMARY KEY,
        contact_id TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS contact_account_owner ON contact_accounts(contact_id);
      CREATE TABLE IF NOT EXISTS account_rooms (
        account_id TEXT NOT NULL,
        room_id TEXT NOT NULL,
        seen_at INTEGER NOT NULL,
        PRIMARY KEY(account_id, room_id)
      );
      CREATE TABLE IF NOT EXISTS exchanges (
        id TEXT PRIMARY KEY,
        at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        direction TEXT NOT NULL,
        self_account TEXT NOT NULL,
        peer_id TEXT NOT NULL,
        peer_account TEXT NOT NULL,
        via TEXT NOT NULL,
        room_id TEXT,
        origin_json TEXT,
        status TEXT NOT NULL,
        task_id TEXT,
        detail TEXT
      );
      CREATE INDEX IF NOT EXISTS exchange_peer ON exchanges(peer_id, at);
    `);
  }

  /** The book as seen from this Bot's account on one chat server. */
  on({ self, people = () => [], local = () => undefined }) {
    return new ServerContacts(this, { self, people, local });
  }

  link(account, identity) {
    if (identity !== account) this.db.prepare('INSERT OR REPLACE INTO contact_accounts(account_id,contact_id) VALUES (?,?)').run(account, identity);
  }

  identityOf(account) { return this.db.prepare('SELECT contact_id FROM contact_accounts WHERE account_id=?').get(account)?.contact_id; }

  accountsOf(identity) {
    const linked = this.db.prepare('SELECT account_id FROM contact_accounts WHERE contact_id=? ORDER BY account_id').all(identity).map(row => row.account_id);
    return isAccount(identity) ? [identity, ...linked] : linked;
  }

  row(identity) { return this.db.prepare('SELECT * FROM contacts WHERE id=?').get(identity); }

  /** Meet someone: the first sighting is kept, a later one only refreshes name and kind. */
  meet(identity, { name, kind, roomId, by } = {}) {
    this.db.prepare(`INSERT INTO contacts(id,name,kind,first_seen_at,first_room_id,introduced_by) VALUES (?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET name=COALESCE(excluded.name,contacts.name), kind=COALESCE(excluded.kind,contacts.kind)`)
      .run(identity, name || null, kind || null, this.now(), roomId || null, by || null);
  }

  identities() {
    return this.db.prepare('SELECT id FROM contacts ORDER BY last_exchange_at DESC, first_seen_at DESC').all().map(row => row.id);
  }

  open({ id, direction, self, peer, account, via, roomId, origin, status, taskId, detail }) {
    if (!['in', 'out'].includes(direction) || !EXCHANGE_STATUSES.includes(status)) throw new RangeError('Invalid exchange');
    const at = this.now();
    this.db.prepare(`INSERT INTO exchanges(id,at,updated_at,direction,self_account,peer_id,peer_account,via,room_id,origin_json,status,task_id,detail)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at,
      origin_json=COALESCE(exchanges.origin_json,excluded.origin_json), room_id=COALESCE(excluded.room_id,exchanges.room_id),
      detail=COALESCE(exchanges.detail,excluded.detail)`)
      .run(id, at, at, direction, self, peer, account, via, roomId || null, json(origin), status, taskId || null, detail ? String(detail).slice(0, 500) : null);
    this.db.prepare('UPDATE contacts SET last_exchange_at=? WHERE id=?').run(at, peer);
    return this.exchange(id);
  }

  settle(id, { status, taskId, detail } = {}) {
    if (status && !EXCHANGE_STATUSES.includes(status)) throw new RangeError('Invalid exchange status');
    const at = this.now();
    const changed = this.db.prepare(`UPDATE exchanges SET updated_at=?, status=COALESCE(?,status),
      task_id=COALESCE(?,task_id), detail=COALESCE(?,detail) WHERE id=?`)
      .run(at, status || null, taskId || null, detail ? String(detail).slice(0, 500) : null, id).changes;
    if (changed) this.db.prepare('UPDATE contacts SET last_exchange_at=? WHERE id=(SELECT peer_id FROM exchanges WHERE id=?)').run(at, id);
    return changed ? this.exchange(id) : undefined;
  }

  exchange(id) {
    const row = this.db.prepare('SELECT * FROM exchanges WHERE id=?').get(id);
    return row && {
      id: row.id, at: row.at, updatedAt: row.updated_at, direction: row.direction, peerId: row.peer_id, account: row.peer_account,
      selfAccount: row.self_account, via: row.via, roomId: row.room_id, origin: parse(row.origin_json), status: row.status,
      taskId: row.task_id, detail: row.detail };
  }

  /** Requests this Bot sent from one of its accounts that have not come back yet, newest first. */
  pending(self, { maxAgeMs = 2 * 60 * 60_000, limit = 10 } = {}) {
    return this.db.prepare(`SELECT id FROM exchanges WHERE self_account=? AND direction='out' AND status IN ('sending','sent','dispatched')
      AND at>=? ORDER BY at DESC, rowid DESC LIMIT ?`).all(self, this.now() - maxAgeMs, limit).map(row => this.exchange(row.id));
  }

  exchanges({ contact, limit, before }) {
    return this.db.prepare(`SELECT id FROM exchanges WHERE (? IS NULL OR peer_id=?) AND (? IS NULL OR at<?)
      ORDER BY at DESC, rowid DESC LIMIT ?`).all(contact ?? null, contact ?? null, before ?? null, before ?? null, limit)
      .map(row => this.exchange(row.id));
  }
}

/** The book as seen from the Bot's account on one chat server: Matrix IDs in, identities out. */
class ServerContacts {
  constructor(book, { self, people, local }) {
    Object.assign(this, { book, self, people, local });
    this.server = serverOf(self.id);
    this.selfIdentity = self.globalId || self.id;
  }

  person(account) { return this.people().find(person => person.id === account); }

  /** The identity behind an account (or the identity itself), learned from this server's roster. */
  identity(target) {
    if (!isAccount(target)) return target;
    const known = this.person(target)?.globalId;
    if (known) { this.book.link(target, known); return known; }
    return this.book.identityOf(target) || target;
  }

  /** The account an identity has on this server, if any. */
  account(target) {
    const identity = this.identity(target);
    if (isAccount(target) && identity === target) return target;
    return this.people().find(person => person.globalId === identity)?.id
      || this.book.accountsOf(identity).find(account => serverOf(account) === this.server)
      || (isAccount(target) ? target : undefined);
  }

  isSelf(account) { return account === this.self.id || this.identity(account) === this.selfIdentity; }

  meet(account, { name, kind, roomId, by } = {}) {
    if (!isAccount(account) || this.isSelf(account)) return;
    const known = this.person(account);
    this.book.meet(this.identity(account), { name: known?.name || name, kind: known?.kind || kind, roomId, by: by && this.identity(by) });
  }

  /** A room's current members, from its roster. Only a member can read a roster, so this Bot is in it. */
  seeRoom(roomId, members) {
    const { db } = this.book;
    const at = this.book.now();
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('DELETE FROM account_rooms WHERE room_id=?').run(roomId);
      const add = db.prepare('INSERT OR REPLACE INTO account_rooms(account_id,room_id,seen_at) VALUES (?,?,?)');
      add.run(this.self.id, roomId, at);
      for (const member of members) {
        if (!member?.id) continue;
        add.run(member.id, roomId, at);
        this.meet(member.id, { name: member.name, kind: member.kind, roomId });
      }
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }

  /** One membership change seen in a room's timeline. */
  member(roomId, account, membership, name) {
    const { db } = this.book;
    // An invited Bot joins on its own; a request sent there reaches it.
    if (['join', 'invite'].includes(membership)) {
      db.prepare('INSERT OR REPLACE INTO account_rooms(account_id,room_id,seen_at) VALUES (?,?,?)').run(account, roomId, this.book.now());
      this.meet(account, { name, roomId });
    } else if (['leave', 'ban'].includes(membership)) {
      if (account === this.self.id) db.prepare('DELETE FROM account_rooms WHERE room_id=?').run(roomId);
      else db.prepare('DELETE FROM account_rooms WHERE account_id=? AND room_id=?').run(account, roomId);
    }
  }

  /** Rooms on this server this Bot and the contact are both known to be in. */
  rooms(target) {
    const account = this.account(target);
    if (!account) return [];
    return this.book.db.prepare(`SELECT theirs.room_id FROM account_rooms theirs JOIN account_rooms mine
      ON mine.room_id=theirs.room_id AND mine.account_id=? WHERE theirs.account_id=? ORDER BY theirs.room_id`)
      .all(this.self.id, account).map(row => row.room_id);
  }

  /** Where to reach a contact over Matrix: the first preferred room both are in, else any shared room. */
  roomFor(target, preferred = []) {
    const shared = this.rooms(target);
    return preferred.find(roomId => shared.includes(roomId)) || shared[0];
  }

  /** How this Bot reaches a contact from this server: in a shared room, or in a direct room the core opens for them. */
  reach(target) {
    const account = this.account(target);
    if (!account) return { via: null };
    if (this.rooms(account).length) return { via: 'room' };
    const kind = this.person(account)?.kind || this.book.row(this.identity(account))?.kind;
    return this.local(account) || kind === 'bot' ? { via: 'direct' } : { via: null };
  }

  /**
   * The Bot a request names: its identity ID, its account here (a Matrix link to it counts), or a name that only one Bot in the book has.
   * @returns {{id: string, account: string, name: string} | {error: string}}
   */
  resolve(to) {
    const address = String(to ?? '').trim().replace(/^https:\/\/matrix\.to\/#\//i, '').replace(/^matrix:(u\/)?/i, (_, u) => u ? '@' : '');
    const bots = this.list({ kind: 'bot' }).filter(contact => contact.reach);
    const byId = bots.find(contact => contact.id === address || contact.account === address);
    if (byId) return byId;
    const named = bots.filter(contact => contact.name === address.replace(/^@/, ''));
    if (named.length === 1) return named[0];
    if (named.length > 1) return { error: `通讯录里有 ${named.length} 个叫“${address.replace(/^@/, '')}”的 Bot：${named.map(contact => contact.id).join('、')}。用完整 ID。` };
    return { error: `“${address}”不在你的通讯录里，联系不上；直接告诉请求者。` };
  }

  contact(target) {
    const id = this.identity(target);
    const account = this.account(id);
    const row = this.book.row(id);
    const known = account && this.person(account);
    const local = account && this.local(account);
    if (!row && !known && !local) return undefined;
    return { id, account: account || null, name: known?.name || row?.name || local?.name || id,
      kind: known?.kind || row?.kind || (local ? 'bot' : 'unknown'),
      ...(known?.ownerId ? { ownerId: known.ownerId } : {}), ...(known?.role ? { role: known.role } : {}),
      rooms: this.rooms(id), reach: this.reach(id).via, sameDsh: Boolean(local),
      servers: [...new Set([...this.book.accountsOf(id), ...(account ? [account] : [])].map(serverOf))].sort(),
      introducedBy: row?.introduced_by || null, firstSeenAt: row?.first_seen_at ?? null, firstRoomId: row?.first_room_id || null,
      lastExchangeAt: row?.last_exchange_at ?? null };
  }

  /** Everyone in the book, most recent exchange first. Bots in this DSH are contacts even before meeting. */
  list({ kind } = {}) {
    const ids = new Set(this.book.identities());
    for (const person of this.people()) if (!this.isSelf(person.id) && this.local(person.id)) ids.add(this.identity(person.id));
    return [...ids].map(id => this.contact(id)).filter(contact => contact && (!kind || contact.kind === kind));
  }

  /** The Bots this Bot can ask with ask_bot from this server, and the rooms they share. */
  reachableBots() {
    return this.list({ kind: 'bot' }).filter(contact => contact.reach)
      .map(({ id, account, name, role, reach, rooms }) => ({ id, account, name, ...(role ? { role } : {}), reach, rooms }));
  }

  /** An exchange with the account `peer` on this server. */
  open({ id, direction, peer, via, roomId, origin, status, taskId, detail }) {
    this.meet(peer, direction === 'in' ? { by: peer } : { by: origin?.senderId });
    return this.book.open({ id, direction, self: this.self.id, peer: this.identity(peer), account: peer, via, roomId, origin, status, taskId, detail });
  }

  settle(id, update) { return this.book.settle(id, update); }
  exchange(id) { return this.book.exchange(id); }

  /** Requests this Bot sent from this server that have not come back yet: what it is already waiting on. */
  pending(options) { return this.book.pending(this.self.id, options); }

  /** Read-only owner view: contacts and exchanges, filtered by contact, newest first, paged by time. */
  view({ contact, limit = 50, before } = {}) {
    limit = Math.max(1, Math.min(200, Number(limit) || 50));
    const id = contact ? this.identity(contact) : undefined;
    const rows = this.book.exchanges({ contact: id, limit: limit + 1, before });
    const exchanges = rows.slice(0, limit);
    return { contacts: id ? [this.contact(id)].filter(Boolean) : this.list(), exchanges,
      next: rows.length > limit ? exchanges.at(-1).at : null };
  }
}
