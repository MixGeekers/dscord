import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const digest = value => createHash('sha256').update(value).digest('hex');
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const DEVICE_MS = 10 * 60 * 1000;
// Unambiguous letters for a code a person reads off one screen and types into another.
const USER_CODE_LETTERS = 'BCDFGHJKLMNPQRSTVWXZ';

export function failure(status, code, message = code) {
  return Object.assign(new Error(message), { status, code });
}

async function passwordHash(password, salt) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 512) throw failure(400, 'PASSWORD_LENGTH', 'Use a password of 8–512 characters');
  return Buffer.from(await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 })).toString('hex');
}

function displayName(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string' || value.trim().length > 80 || /[\u0000-\u001f\u007f]/.test(value)) throw failure(400, 'DISPLAY_NAME_INVALID');
  return value.trim() || fallback;
}

/** An account that may sign in: closed and disabled accounts are refused. */
function usable(account) {
  if (account.status === 'closed') throw failure(403, 'ACCOUNT_CLOSED');
  if (account.status === 'disabled') throw failure(403, 'ACCOUNT_DISABLED', 'An administrator has disabled this account');
  return account;
}

/** Accounts, sessions, server grants and device codes. No chat data lives here. */
export class CentralStore {
  constructor({ filename, rule, domain, now = Date.now }) {
    Object.assign(this, { rule, domain, now });
    this.db = new DatabaseSync(filename);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, kind TEXT NOT NULL CHECK(kind IN ('human','bot')),
        display_name TEXT NOT NULL, owner_id TEXT REFERENCES accounts(id), salt TEXT, password_hash TEXT,
        status TEXT NOT NULL CHECK(status IN ('active','disabled','closed')), created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, account_id TEXT NOT NULL REFERENCES accounts(id),
        kind TEXT NOT NULL CHECK(kind IN ('login','node')), label TEXT NOT NULL, created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL, expires_at INTEGER);
      CREATE TABLE IF NOT EXISTS grants (account_id TEXT NOT NULL REFERENCES accounts(id), audience TEXT NOT NULL, granted_at INTEGER NOT NULL,
        last_used INTEGER NOT NULL, PRIMARY KEY(account_id, audience));
      CREATE TABLE IF NOT EXISTS device_codes (device_hash TEXT PRIMARY KEY, user_code TEXT NOT NULL UNIQUE, label TEXT NOT NULL,
        created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, account_id TEXT REFERENCES accounts(id), approved_by TEXT, consumed INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  }

  close() { this.db.close(); }

  globalId(username) { return `${username}@${this.domain}`; }

  view(row) {
    if (!row) return undefined;
    const owner = row.owner_id ? this.db.prepare('SELECT username FROM accounts WHERE id=?').get(row.owner_id) : undefined;
    return { id: row.id, username: row.username, globalId: this.globalId(row.username), kind: row.kind, displayName: row.display_name,
      ...(owner ? { owner: this.globalId(owner.username) } : {}), status: row.status, createdAt: new Date(row.created_at).toISOString() };
  }

  account(id) { return this.db.prepare('SELECT * FROM accounts WHERE id=?').get(id); }

  setting(key, fallback) { return this.db.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value ?? fallback; }

  saveSetting(key, value) { this.db.prepare('INSERT INTO settings VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, value); }

  /** Accounts for administrators: newest first, matching a username or display name, optionally of one kind or status. */
  accounts({ q = '', kind = '', status = '', limit = 100 } = {}) {
    const like = `%${String(q).trim().toLowerCase().replace(/[%_\\]/g, '\\$&')}%`;
    const size = Math.min(Math.max(Number.parseInt(limit, 10) || 100, 1), 500);
    return this.db.prepare(`SELECT a.*, (SELECT MAX(last_seen) FROM sessions s WHERE s.account_id=a.id) AS last_seen,
        (SELECT COUNT(*) FROM grants g WHERE g.account_id=a.id) AS servers FROM accounts a
        WHERE (lower(a.username) LIKE ? ESCAPE '\\' OR lower(a.display_name) LIKE ? ESCAPE '\\') AND (?='' OR a.kind=?) AND (?='' OR a.status=?)
        ORDER BY a.created_at DESC LIMIT ?`).all(like, like, kind, kind, status, status, size)
      .map(row => ({ ...this.view(row), lastSeen: row.last_seen ? new Date(row.last_seen).toISOString() : null, servers: row.servers }));
  }

  accountCounts() {
    const rows = this.db.prepare('SELECT kind, status, COUNT(*) AS n FROM accounts GROUP BY kind, status').all();
    const count = (kind, status) => rows.filter(row => row.kind === kind && (!status || row.status === status)).reduce((sum, row) => sum + row.n, 0);
    return { people: count('human', 'active'), bots: count('bot', 'active'), disabled: rows.filter(row => row.status === 'disabled').reduce((sum, row) => sum + row.n, 0) };
  }

  /** An administrator disables or restores an account. Disabling ends its sessions; a closed account stays closed. */
  setDisabled(id, disabled) {
    const account = this.account(id);
    if (!account) throw failure(404, 'ACCOUNT_NOT_FOUND');
    if (account.status === 'closed') throw failure(409, 'ACCOUNT_CLOSED');
    this.db.prepare('UPDATE accounts SET status=? WHERE id=?').run(disabled ? 'disabled' : 'active', id);
    if (disabled) this.db.prepare('DELETE FROM sessions WHERE account_id=?').run(id);
    return this.account(id);
  }

  insertAccount({ username, kind, name, ownerId = null, salt = null, hash = null }) {
    const checked = this.rule.check(username);
    if (checked.error) throw failure(400, checked.error);
    const id = randomUUID();
    try {
      this.db.prepare("INSERT INTO accounts VALUES (?,?,?,?,?,?,?,'active',?)")
        .run(id, checked.username, kind, displayName(name, checked.username), ownerId, salt, hash, this.now());
    } catch (error) {
      // Usernames are never reused, even after an account closes.
      if (String(error.message).includes('UNIQUE')) throw failure(409, 'USERNAME_TAKEN');
      throw error;
    }
    return this.account(id);
  }

  async createHuman({ username, password, displayName: name }) {
    const salt = randomBytes(16).toString('hex');
    return this.insertAccount({ username, kind: 'human', name, salt, hash: await passwordHash(password, salt) });
  }

  createBot(owner, { username, displayName: name }) {
    if (owner.kind !== 'human') throw failure(403, 'HUMAN_REQUIRED', 'Only a person can own a Bot');
    return this.insertAccount({ username, kind: 'bot', name, ownerId: owner.id });
  }

  botsOf(owner) {
    return this.db.prepare("SELECT * FROM accounts WHERE owner_id=? AND kind='bot' ORDER BY created_at").all(owner.id);
  }

  /** A Bot the caller owns, or a refusal. */
  ownedBot(owner, botId) {
    const bot = this.account(botId);
    if (!bot || bot.kind !== 'bot' || bot.owner_id !== owner.id) throw failure(404, 'BOT_NOT_FOUND');
    if (bot.status === 'closed') throw failure(409, 'ACCOUNT_CLOSED');
    return bot;
  }

  openSession(account, kind, label) {
    const token = `dscord_central_${randomBytes(32).toString('base64url')}`;
    const at = this.now();
    this.db.prepare('INSERT INTO sessions VALUES (?,?,?,?,?,?,?,?)')
      .run(randomUUID(), digest(token), account.id, kind, label, at, at, kind === 'login' ? at + SESSION_MS : null);
    return token;
  }

  async login(username, password) {
    const name = typeof username === 'string' ? username.trim().toLowerCase() : '';
    const row = this.db.prepare("SELECT * FROM accounts WHERE username=? AND kind='human'").get(name);
    const salt = row?.salt || randomBytes(16).toString('hex');
    const expected = Buffer.from(row?.password_hash || '0'.repeat(128), 'hex');
    const actual = Buffer.from(await passwordHash(typeof password === 'string' && password.length >= 8 ? password : '        ', salt), 'hex');
    if (!row || !timingSafeEqual(expected, actual)) throw failure(401, 'LOGIN_FAILED', 'Wrong username or password');
    usable(row);
    return { token: this.openSession(row, 'login', 'password'), account: row };
  }

  authenticate(token) {
    if (typeof token !== 'string' || !token.startsWith('dscord_central_')) throw failure(401, 'SIGN_IN_REQUIRED');
    const session = this.db.prepare('SELECT * FROM sessions WHERE token_hash=?').get(digest(token));
    const at = this.now();
    if (!session || (session.expires_at !== null && session.expires_at <= at)) throw failure(401, 'SIGN_IN_REQUIRED');
    const account = usable(this.account(session.account_id));
    this.db.prepare('UPDATE sessions SET last_seen=?, expires_at=CASE WHEN expires_at IS NULL THEN NULL ELSE ? END WHERE id=?')
      .run(at, at + SESSION_MS, session.id);
    return { account, session };
  }

  closeSession(session) { this.db.prepare('DELETE FROM sessions WHERE id=?').run(session.id); }

  nodesOf(bot) {
    return this.db.prepare("SELECT id,label,created_at,last_seen FROM sessions WHERE account_id=? AND kind='node' ORDER BY created_at").all(bot.id)
      .map(row => ({ id: row.id, label: row.label, createdAt: new Date(row.created_at).toISOString(), lastSeen: new Date(row.last_seen).toISOString() }));
  }

  revokeNode(bot, nodeId) {
    if (!this.db.prepare("DELETE FROM sessions WHERE id=? AND account_id=? AND kind='node'").run(nodeId, bot.id).changes) throw failure(404, 'NODE_NOT_FOUND');
  }

  grant(account, audience, { allowNew }) {
    const at = this.now();
    const existing = this.db.prepare('SELECT * FROM grants WHERE account_id=? AND audience=?').get(account.id, audience);
    if (!existing && !allowNew) throw failure(409, 'GRANT_REQUIRED', 'Confirm signing in to this server first');
    if (existing) this.db.prepare('UPDATE grants SET last_used=? WHERE account_id=? AND audience=?').run(at, account.id, audience);
    else this.db.prepare('INSERT INTO grants VALUES (?,?,?,?)').run(account.id, audience, at, at);
  }

  grantsOf(account) {
    return this.db.prepare('SELECT audience,granted_at,last_used FROM grants WHERE account_id=? ORDER BY granted_at').all(account.id)
      .map(row => ({ audience: row.audience, grantedAt: new Date(row.granted_at).toISOString(), lastUsed: new Date(row.last_used).toISOString() }));
  }

  revokeGrant(account, audience) {
    if (!this.db.prepare('DELETE FROM grants WHERE account_id=? AND audience=?').run(account.id, audience).changes) throw failure(404, 'GRANT_NOT_FOUND');
  }

  startDevice(label) {
    const deviceCode = randomBytes(32).toString('base64url');
    const at = this.now();
    for (;;) {
      const letters = [...randomBytes(8)].map(byte => USER_CODE_LETTERS[byte % USER_CODE_LETTERS.length]).join('');
      const userCode = `${letters.slice(0, 4)}-${letters.slice(4)}`;
      try {
        this.db.prepare('INSERT INTO device_codes(device_hash,user_code,label,created_at,expires_at) VALUES (?,?,?,?,?)')
          .run(digest(deviceCode), userCode, label, at, at + DEVICE_MS);
        return { deviceCode, userCode, expiresIn: DEVICE_MS / 1000 };
      } catch (error) { if (!String(error.message).includes('UNIQUE')) throw error; }
    }
  }

  approveDevice(owner, userCode, botId) {
    const bot = this.ownedBot(owner, botId);
    const code = typeof userCode === 'string' ? userCode.trim().toUpperCase() : '';
    const row = this.db.prepare('SELECT * FROM device_codes WHERE user_code=?').get(code);
    if (!row || row.expires_at <= this.now() || row.consumed) throw failure(404, 'DEVICE_CODE_UNKNOWN');
    if (row.account_id) throw failure(409, 'DEVICE_CODE_USED');
    this.db.prepare('UPDATE device_codes SET account_id=?, approved_by=? WHERE user_code=?').run(bot.id, owner.id, code);
    return { bot, label: row.label };
  }

  /** The node's session for the approved Bot, handed out once. */
  redeemDevice(deviceCode) {
    const row = typeof deviceCode === 'string' && this.db.prepare('SELECT * FROM device_codes WHERE device_hash=?').get(digest(deviceCode));
    if (!row || row.consumed) throw failure(404, 'DEVICE_CODE_UNKNOWN');
    if (row.expires_at <= this.now()) throw failure(410, 'DEVICE_CODE_EXPIRED');
    if (!row.account_id) throw failure(428, 'AUTHORIZATION_PENDING');
    const bot = usable(this.account(row.account_id));
    this.db.prepare('UPDATE device_codes SET consumed=1 WHERE device_hash=?').run(row.device_hash);
    return { token: this.openSession(bot, 'node', row.label), account: bot };
  }

  /** Closing keeps the username taken; the account's sessions and grants end. A person closes their Bots first. */
  closeAccount(account) {
    if (this.botsOf(account).some(bot => bot.status !== 'closed')) throw failure(409, 'OWNS_ACTIVE_BOTS', 'Close your Bots first');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare("UPDATE accounts SET status='closed', salt=NULL, password_hash=NULL WHERE id=?").run(account.id);
      this.db.prepare('DELETE FROM sessions WHERE account_id=?').run(account.id);
      this.db.prepare('DELETE FROM grants WHERE account_id=?').run(account.id);
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
}
