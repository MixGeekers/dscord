import { randomInt } from 'node:crypto';
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
/** Where a listing stands with this central's administrators. Only listed servers are searchable. */
export const LISTING_STATUS = ['pending', 'listed', 'rejected', 'banned'];
/** Whether a newly submitted server waits for an administrator ('review') or is listed at once ('open'). */
export const LISTING_MODES = ['review', 'open'];
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
 * The server index. A chat server submits its origin; the index reads the server's public page from that origin and
 * keeps reading it. A page served at the origin and naming this central is the server's consent to be listed, so
 * submitting needs no account. This central's administrators decide what is listed: new servers wait for review
 * unless the central lists them at once.
 */
export class ServerDirectory {
  constructor({ db, issuer, now = Date.now, fetch = globalThis.fetch, fetchVia = {} }) {
    Object.assign(this, { db, issuer, now, fetch, fetchVia });
    db.exec(`CREATE TABLE IF NOT EXISTS servers (origin TEXT PRIMARY KEY, number INTEGER NOT NULL UNIQUE,
        status TEXT NOT NULL CHECK(status IN ('pending','listed','rejected','banned')), note TEXT NOT NULL DEFAULT '',
        discovery TEXT NOT NULL, page_json TEXT NOT NULL, submitted_at INTEGER NOT NULL, reviewed_at INTEGER,
        fetched_at INTEGER, last_error TEXT, checked_at INTEGER NOT NULL);`);
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

  /**
   * Reads the page and keeps the server. A new server is pending under review and listed at once otherwise;
   * a rejected server that submits again goes back to pending. A banned origin stays out.
   */
  async submit(origin, { review = true } = {}) {
    const existing = this.server(origin);
    if (existing?.status === 'banned') throw failure(403, 'SERVER_BANNED', 'This central does not list the server');
    const read = await this.read(origin);
    const at = this.now();
    const page = JSON.stringify(read.page);
    if (existing) {
      const status = existing.status === 'rejected' ? 'pending' : existing.status;
      this.db.prepare(`UPDATE servers SET status=?, discovery=?, page_json=?, submitted_at=CASE WHEN ?<>status THEN ? ELSE submitted_at END,
          fetched_at=?, last_error=NULL, checked_at=? WHERE origin=?`).run(status, read.discovery, page, status, at, at, at, origin);
    } else {
      // A server keeps its number for as long as it stays in the index.
      for (;;) {
        const number = NUMBER_MIN + randomInt(NUMBER_SPAN);
        try {
          this.db.prepare(`INSERT INTO servers(origin,number,status,discovery,page_json,submitted_at,reviewed_at,fetched_at,checked_at)
              VALUES (?,?,?,?,?,?,?,?,?)`).run(origin, number, review ? 'pending' : 'listed', read.discovery, page, at, review ? null : at, at, at);
          break;
        } catch (error) { if (!String(error.message).includes('UNIQUE')) throw error; }
      }
    }
    return this.submittedView(this.server(origin));
  }

  server(origin) { return this.db.prepare('SELECT * FROM servers WHERE origin=?').get(origin); }

  existing(origin) {
    const row = this.server(origin);
    if (!row) throw failure(404, 'SERVER_NOT_FOUND');
    return row;
  }

  /** Reads the page again. A page that cannot be read keeps the last listing, which drops out of search once stale. */
  async refresh(origin) {
    const row = this.server(origin);
    if (!row) return undefined;
    const at = this.now();
    try {
      const read = await this.read(origin);
      this.db.prepare('UPDATE servers SET discovery=?, page_json=?, fetched_at=?, last_error=NULL, checked_at=? WHERE origin=?')
        .run(read.discovery, JSON.stringify(read.page), at, at, origin);
    } catch (error) {
      if (!error.code) throw error;
      this.db.prepare('UPDATE servers SET last_error=?, checked_at=? WHERE origin=?').run(error.code, at, origin);
    }
    return this.server(origin);
  }

  async refreshAll() {
    for (const { origin } of this.db.prepare("SELECT origin FROM servers WHERE status IN ('pending','listed') ORDER BY checked_at").all()) {
      await this.refresh(origin);
    }
  }

  /** An administrator's decision: list, reject or ban a server, with an optional note the server's operators can read. */
  decide(origin, status, note = '') {
    if (!['listed', 'rejected', 'banned'].includes(status)) throw failure(400, 'LISTING_STATUS_INVALID');
    if (typeof note !== 'string' || note.length > 500) throw failure(400, 'NOTE_INVALID');
    this.existing(origin);
    this.db.prepare('UPDATE servers SET status=?, note=?, reviewed_at=? WHERE origin=?').run(status, note.trim(), this.now(), origin);
    return this.adminView(this.server(origin));
  }

  /** Drops a server from the index, number and all; a removed server may submit again and gets a new number. */
  remove(origin) {
    if (!this.db.prepare('DELETE FROM servers WHERE origin=?').run(origin).changes) throw failure(404, 'SERVER_NOT_FOUND');
  }

  /** What a submitting server learns: its number and where its listing stands. */
  submittedView(row) {
    return { origin: row.origin, number: row.number, status: row.status, note: row.note, discovery: row.discovery };
  }

  adminView(row) {
    return { ...this.submittedView(row), ...JSON.parse(row.page_json), submittedAt: iso(row.submitted_at), reviewedAt: iso(row.reviewed_at),
      fetchedAt: iso(row.fetched_at), checkedAt: iso(row.checked_at), lastError: row.last_error };
  }

  /** Every server in the index for its administrators, newest submissions first, optionally of one status. */
  list({ status = '' } = {}) {
    if (status && !LISTING_STATUS.includes(status)) throw failure(400, 'LISTING_STATUS_INVALID');
    const rows = status ? this.db.prepare('SELECT * FROM servers WHERE status=? ORDER BY submitted_at DESC').all(status)
      : this.db.prepare('SELECT * FROM servers ORDER BY submitted_at DESC').all();
    return rows.map(row => this.adminView(row));
  }

  counts() {
    return Object.fromEntries(LISTING_STATUS.map(status => [status,
      this.db.prepare('SELECT COUNT(*) AS n FROM servers WHERE status=?').get(status).n]));
  }

  /**
   * Listed servers read within the last three days. A query of digits finds the server with that number, unless it is hidden;
   * otherwise only public servers are searched, and every word must appear in the name, description or tags.
   */
  search({ q = '', tag = '', limit = 20 } = {}) {
    const query = String(q).trim();
    const fresh = this.now() - LISTING_STALE_MS;
    if (/^\d{8}$/.test(query)) {
      const row = this.db.prepare("SELECT * FROM servers WHERE number=? AND status='listed' AND discovery IN ('public','number') AND fetched_at>=?")
        .get(Number(query), fresh);
      if (row) return [this.publicView(row, JSON.parse(row.page_json))];
    }
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const wanted = String(tag).trim().toLowerCase();
    const size = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), MAX_RESULTS);
    return this.db.prepare("SELECT * FROM servers WHERE status='listed' AND discovery='public' AND fetched_at>=?").all(fresh)
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
    return { origin: row.origin, number: row.number, ...page, updatedAt: iso(row.fetched_at) };
  }
}
