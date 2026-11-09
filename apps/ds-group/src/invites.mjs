import { randomInt } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const INVITE_MS = 7 * 24 * 60 * 60 * 1000;
// Letters and digits that cannot be misread for each other, for a code read aloud or typed from a screenshot.
const LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const failure = (status, code) => Object.assign(new Error(code), { status, code });

export function normalizeInviteCode(value) {
  return typeof value === 'string' ? value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
}

/**
 * Invitations to join this chat server. When the server only takes invited people, a central account that has never
 * signed in here needs a live code; members and administrators make them, and each lasts seven days until revoked.
 * Core and the administration service share the file.
 */
export class InviteStore {
  constructor({ dataRoot, now = Date.now }) {
    this.now = now;
    this.db = new DatabaseSync(path.join(dataRoot, 'invites.sqlite'));
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS invites (code TEXT PRIMARY KEY, created_by TEXT NOT NULL, created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL, uses INTEGER NOT NULL DEFAULT 0, revoked INTEGER NOT NULL DEFAULT 0);`);
  }

  view(row) {
    return { code: `${row.code.slice(0, 4)}-${row.code.slice(4)}`, createdBy: row.created_by, createdAt: new Date(row.created_at).toISOString(),
      expiresAt: new Date(row.expires_at).toISOString(), uses: row.uses };
  }

  create(createdBy) {
    const at = this.now();
    for (;;) {
      const code = Array.from({ length: 8 }, () => LETTERS[randomInt(LETTERS.length)]).join('');
      try {
        this.db.prepare('INSERT INTO invites (code,created_by,created_at,expires_at) VALUES (?,?,?,?)').run(code, createdBy, at, at + INVITE_MS);
        return this.view(this.db.prepare('SELECT * FROM invites WHERE code=?').get(code));
      } catch (error) { if (!String(error.message).includes('UNIQUE')) throw error; }
    }
  }

  /** Live invitations, all of them or one member's. */
  list(createdBy) {
    const live = 'revoked=0 AND expires_at>?';
    const rows = createdBy
      ? this.db.prepare(`SELECT * FROM invites WHERE ${live} AND created_by=? ORDER BY created_at DESC`).all(this.now(), createdBy)
      : this.db.prepare(`SELECT * FROM invites WHERE ${live} ORDER BY created_at DESC`).all(this.now());
    return rows.map(row => this.view(row));
  }

  /** Revoke a code; a member can revoke only their own, an administrator any. */
  revoke(value, createdBy) {
    const code = normalizeInviteCode(value);
    const changes = createdBy
      ? this.db.prepare('UPDATE invites SET revoked=1 WHERE code=? AND created_by=?').run(code, createdBy).changes
      : this.db.prepare('UPDATE invites SET revoked=1 WHERE code=?').run(code).changes;
    if (!changes) throw failure(404, 'INVITE_NOT_FOUND');
  }

  /** Use a code to let a new account in. */
  redeem(value) {
    const code = normalizeInviteCode(value);
    if (!code) throw failure(403, 'INVITE_REQUIRED');
    const used = this.db.prepare('UPDATE invites SET uses=uses+1 WHERE code=? AND revoked=0 AND expires_at>?').run(code, this.now()).changes;
    if (!used) throw failure(403, 'INVITE_INVALID');
  }

  close() { this.db.close(); }
}
