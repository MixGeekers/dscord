import { randomBytes, randomInt } from 'node:crypto';
import { failure } from './store.mjs';

export const SERVER_WELL_KNOWN = '/.well-known/dscord/server';
/** A server whose public page has not been read for this long drops out of search until it is read again. */
export const LISTING_STALE_MS = 3 * 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 64 * 1024;
const MAX_RESULTS = 50;
/** How a server can be found: by keyword search, only by its exact number, or not at all. */
export const DISCOVERY = ['public', 'number', 'hidden'];
/** How people join: anyone with a central account, or only with an invitation from the server. */
export const JOIN = ['open', 'invite'];
// Server numbers are eight digits, handed out at random so they say nothing about when a server was listed.
const NUMBER_MIN = 10_000_000;
const NUMBER_SPAN = 90_000_000;

const iso = value => value === null || value === undefined ? null : new Date(value).toISOString();

function text(value, max, field) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b-\u001f\u007f]/.test(value)) throw failure(502, 'SERVER_PAGE_INVALID', `${field} is not valid`);
  return value.trim();
}

function count(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

/** The public page a chat server serves at /.well-known/dscord/server, reduced to what the index keeps. */
export function readServerPage(value, origin) {
  if (!value || typeof value !== 'object' || value.schemaVersion !== 1) throw failure(502, 'SERVER_PAGE_INVALID', 'Unknown server page version');
  if (value.origin !== origin) throw failure(502, 'SERVER_PAGE_INVALID', 'The page names a different origin');
  const tags = Array.isArray(value.tags) ? value.tags : [];
  if (tags.length > 10) throw failure(502, 'SERVER_PAGE_INVALID', 'At most 10 tags');
  return {
    central: typeof value.central === 'string' ? value.central : '',
    challenge: typeof value.challenge === 'string' ? value.challenge : '',
    discovery: DISCOVERY.includes(value.discovery) ? value.discovery : 'hidden',
    page: {
      name: text(value.name, 80, 'name') || new URL(origin).hostname,
      description: text(value.description, 500, 'description'),
      tags: [...new Set(tags.map(tag => text(tag, 32, 'tag').toLowerCase()).filter(Boolean))],
      members: { people: count(value.members?.people), bots: count(value.members?.bots) },
      join: JOIN.includes(value.join) ? value.join : 'invite',
    },
  };
}

async function readJson(response) {
  const reader = response.body?.getReader();
  if (!reader) return response.json();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) { await reader.cancel(); throw failure(502, 'SERVER_PAGE_INVALID', 'The server page is too large'); }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

/**
 * The server index. An operator claims an origin and gets a challenge; once the chat server publishes that challenge
 * on its own origin, naming this central, the index reads the server's public page from there and keeps reading it.
 * Pulling from the origin is what proves control of the domain, so a chat server never needs a credential to be listed.
 */
export class ServerDirectory {
  constructor({ db, store, issuer, now = Date.now, fetch = globalThis.fetch, fetchVia = {} }) {
    Object.assign(this, { db, store, issuer, now, fetch, fetchVia });
    db.exec(`CREATE TABLE IF NOT EXISTS server_claims (origin TEXT NOT NULL, account_id TEXT NOT NULL REFERENCES accounts(id), challenge TEXT NOT NULL,
        created_at INTEGER NOT NULL, PRIMARY KEY(origin, account_id));
      CREATE TABLE IF NOT EXISTS servers (origin TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES accounts(id), challenge TEXT NOT NULL,
        number INTEGER NOT NULL UNIQUE, discovery TEXT NOT NULL, page_json TEXT NOT NULL, verified_at INTEGER NOT NULL, fetched_at INTEGER, last_error TEXT, checked_at INTEGER NOT NULL);`);
  }

  claim(account, origin) {
    const existing = this.db.prepare('SELECT challenge FROM server_claims WHERE origin=? AND account_id=?').get(origin, account.id);
    const challenge = existing?.challenge || `dscord-server-${randomBytes(18).toString('base64url')}`;
    if (!existing) this.db.prepare('INSERT INTO server_claims VALUES (?,?,?,?)').run(origin, account.id, challenge, this.now());
    return { origin, challenge, page: `${origin}${SERVER_WELL_KNOWN}` };
  }

  async read(origin) {
    const base = this.fetchVia[origin] || origin;
    let response;
    try {
      response = await this.fetch(`${base}${SERVER_WELL_KNOWN}`, { headers: { Accept: 'application/json' }, redirect: 'error',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    } catch { throw failure(502, 'SERVER_UNREACHABLE', 'Could not reach the server page'); }
    if (response.status === 404) throw failure(409, 'SERVER_PAGE_MISSING', 'The server does not publish a directory page');
    if (!response.ok) throw failure(502, 'SERVER_UNREACHABLE', `The server page answered ${response.status}`);
    let body;
    try { body = await readJson(response); } catch (error) { throw error.code ? error : failure(502, 'SERVER_PAGE_INVALID', 'The server page is not JSON'); }
    const page = readServerPage(body, origin);
    if (page.central !== this.issuer) throw failure(409, 'CENTRAL_MISMATCH', 'The server trusts a different central');
    return page;
  }

  /** Reads the page and, when it shows the caller's challenge, makes the caller the server's owner. */
  async verify(account, origin) {
    const claim = this.db.prepare('SELECT challenge FROM server_claims WHERE origin=? AND account_id=?').get(origin, account.id);
    if (!claim) throw failure(404, 'CLAIM_REQUIRED', 'Claim the server first');
    const read = await this.read(origin);
    if (read.challenge !== claim.challenge) throw failure(409, 'CHALLENGE_MISMATCH', 'The server page shows a different challenge');
    const at = this.now();
    const existing = this.server(origin);
    if (existing) {
      this.db.prepare(`UPDATE servers SET owner_id=?, challenge=?, discovery=?, page_json=?, verified_at=?, fetched_at=?, last_error=NULL,
          checked_at=? WHERE origin=?`).run(account.id, claim.challenge, read.discovery, JSON.stringify(read.page), at, at, at, origin);
    } else {
      // A server keeps its number for as long as it stays in the index.
      for (;;) {
        const number = NUMBER_MIN + randomInt(NUMBER_SPAN);
        try {
          this.db.prepare('INSERT INTO servers VALUES (?,?,?,?,?,?,?,?,NULL,?)')
            .run(origin, account.id, claim.challenge, number, read.discovery, JSON.stringify(read.page), at, at, at);
          break;
        } catch (error) { if (!String(error.message).includes('UNIQUE')) throw error; }
      }
    }
    return this.ownedView(this.server(origin));
  }

  server(origin) { return this.db.prepare('SELECT * FROM servers WHERE origin=?').get(origin); }

  owned(account, origin) {
    const row = this.server(origin);
    if (!row || row.owner_id !== account.id) throw failure(404, 'SERVER_NOT_FOUND');
    return row;
  }

  /** Reads the page again. A page that no longer shows the owner's challenge, or cannot be read, stops refreshing the listing. */
  async refresh(origin) {
    const row = this.server(origin);
    if (!row) return undefined;
    const at = this.now();
    try {
      const read = await this.read(origin);
      if (read.challenge !== row.challenge) throw failure(409, 'CHALLENGE_MISMATCH', 'The server page shows a different challenge');
      this.db.prepare('UPDATE servers SET discovery=?, page_json=?, fetched_at=?, last_error=NULL, checked_at=? WHERE origin=?')
        .run(read.discovery, JSON.stringify(read.page), at, at, origin);
    } catch (error) {
      if (!error.code) throw error;
      this.db.prepare('UPDATE servers SET last_error=?, checked_at=? WHERE origin=?').run(error.code, at, origin);
    }
    return this.server(origin);
  }

  async refreshAll() {
    for (const { origin } of this.db.prepare('SELECT origin FROM servers ORDER BY checked_at').all()) await this.refresh(origin);
  }

  remove(account, origin) {
    const row = this.server(origin);
    const removed = (row?.owner_id === account.id ? this.db.prepare('DELETE FROM servers WHERE origin=?').run(origin).changes : 0)
      + this.db.prepare('DELETE FROM server_claims WHERE origin=? AND account_id=?').run(origin, account.id).changes;
    if (!removed) throw failure(404, 'SERVER_NOT_FOUND');
  }

  /** A closed account's listings and claims go with it. */
  forget(account) {
    this.db.prepare('DELETE FROM servers WHERE owner_id=?').run(account.id);
    this.db.prepare('DELETE FROM server_claims WHERE account_id=?').run(account.id);
  }

  ownedView(row) {
    return { origin: row.origin, verified: true, number: row.number, challenge: row.challenge, discovery: row.discovery, ...JSON.parse(row.page_json),
      verifiedAt: iso(row.verified_at), fetchedAt: iso(row.fetched_at), checkedAt: iso(row.checked_at), lastError: row.last_error };
  }

  /** The servers the caller owns, and the claims they have not verified yet. */
  mine(account) {
    const owned = this.db.prepare('SELECT * FROM servers WHERE owner_id=? ORDER BY origin').all(account.id).map(row => this.ownedView(row));
    const pending = this.db.prepare(`SELECT c.origin, c.challenge, c.created_at FROM server_claims c LEFT JOIN servers s ON s.origin=c.origin
        WHERE c.account_id=? AND (s.owner_id IS NULL OR s.owner_id<>?) ORDER BY c.origin`).all(account.id, account.id)
      .map(row => ({ origin: row.origin, verified: false, challenge: row.challenge, claimedAt: iso(row.created_at) }));
    return [...owned, ...pending];
  }

  /**
   * Servers read within the last three days. A query of digits finds the server with that number, unless it is hidden;
   * otherwise only public servers are searched, and every word must appear in the name, description or tags.
   */
  search({ q = '', tag = '', limit = 20 } = {}) {
    const query = String(q).trim();
    const fresh = this.now() - LISTING_STALE_MS;
    if (/^\d{8}$/.test(query)) {
      const row = this.db.prepare("SELECT * FROM servers WHERE number=? AND discovery IN ('public','number') AND fetched_at>=?").get(Number(query), fresh);
      if (row) return [this.publicView(row, JSON.parse(row.page_json))];
    }
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const wanted = String(tag).trim().toLowerCase();
    const size = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), MAX_RESULTS);
    return this.db.prepare("SELECT * FROM servers WHERE discovery='public' AND fetched_at>=?").all(fresh)
      .map(row => ({ row, page: JSON.parse(row.page_json) }))
      .filter(({ page }) => {
        if (wanted && !page.tags.includes(wanted)) return false;
        const haystack = [page.name, page.description, ...page.tags].join('\n').toLowerCase();
        return words.every(word => haystack.includes(word));
      })
      .sort((a, b) => b.page.members.people - a.page.members.people || a.page.name.localeCompare(b.page.name))
      .slice(0, size)
      .map(({ row, page }) => this.publicView(row, page));
  }

  publicView(row, page) {
    return { origin: row.origin, number: row.number, ...page, owner: this.store.view(this.store.account(row.owner_id))?.globalId,
      updatedAt: iso(row.fetched_at) };
  }
}
