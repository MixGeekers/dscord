import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const digest = value => createHash('sha256').update(value).digest('hex');
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const DEVICE_MS = 10 * 60 * 1000;
const CONNECT_MS = 10 * 60 * 1000;
// A device that has not reported for this long is shown as offline; devices report every few seconds.
const DEVICE_ONLINE_MS = 30 * 1000;
const REPORT_LIMIT = 200000;
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

function text(value, limit, code) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' || value.length > limit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw failure(400, code);
  return value.trim();
}

/** A username for a Bot whose owner gave only a name: the name in Latin letters where possible, made unique. */
function derivedUsername(name) {
  const slug = String(name || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20);
  return `${/^[a-z]/.test(slug) ? slug : `bot${slug ? `-${slug}` : ''}`}-${randomUUID().slice(0, 6)}`;
}

/** An account that may sign in: closed and disabled accounts are refused. */
function usable(account) {
  if (account.status === 'closed') throw failure(403, 'ACCOUNT_CLOSED');
  if (account.status === 'disabled') throw failure(403, 'ACCOUNT_DISABLED', 'An administrator has disabled this account');
  return account;
}

/**
 * Accounts, sessions, server grants and device codes, and for each Bot what its owner set it up to be:
 * its role, model, the chat servers it is on and the device that runs it. No chat data lives here.
 */
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
      CREATE TABLE IF NOT EXISTS connect_codes (code_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id),
        created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, consumed INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS devices (id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), label TEXT NOT NULL,
        report_json TEXT NOT NULL, created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL, session_id TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS bot_settings (bot_id TEXT PRIMARY KEY REFERENCES accounts(id), role TEXT NOT NULL, model TEXT NOT NULL,
        effort TEXT NOT NULL, device_id TEXT, servers_json TEXT NOT NULL, revision INTEGER NOT NULL, updated_at INTEGER NOT NULL);
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

  /** A person's new Bot. With no username given, one is made from its name. */
  createBot(owner, { username, displayName: name, ...settings }, { serverOrigin } = {}) {
    if (owner.kind !== 'human') throw failure(403, 'HUMAN_REQUIRED', 'Only a person can own a Bot');
    const checked = this.checkedSettings(owner, settings, serverOrigin);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const bot = this.insertAccount({ username: username || derivedUsername(name), kind: 'bot', name, ownerId: owner.id });
      this.writeSettings(bot, { ...this.settingsOf(bot), ...checked });
      this.db.exec('COMMIT');
      return bot;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }

  /** What the owner set a Bot up to be. A Bot nobody has configured runs on its device's default model and is on no server. */
  settingsOf(bot) {
    const row = this.db.prepare('SELECT * FROM bot_settings WHERE bot_id=?').get(bot.id);
    return { role: row?.role ?? '', model: row?.model ?? '', effort: row?.effort ?? '', deviceId: row?.device_id ?? null,
      servers: row ? JSON.parse(row.servers_json) : [], revision: row?.revision ?? 0 };
  }

  checkedSettings(owner, input, serverOrigin = value => value) {
    const checked = {};
    if (input.role !== undefined) checked.role = text(input.role, 4000, 'BOT_ROLE_INVALID');
    if (input.model !== undefined) checked.model = text(input.model, 200, 'BOT_MODEL_INVALID');
    if (input.effort !== undefined) checked.effort = text(input.effort, 40, 'BOT_EFFORT_INVALID');
    if (input.deviceId !== undefined) checked.deviceId = input.deviceId === null || input.deviceId === '' ? null : this.ownedDevice(owner, input.deviceId).id;
    if (input.servers !== undefined) {
      if (!Array.isArray(input.servers) || input.servers.length > 32) throw failure(400, 'BOT_SERVERS_INVALID');
      checked.servers = [...new Set(input.servers.map(serverOrigin))];
    }
    return checked;
  }

  writeSettings(bot, settings) {
    this.db.prepare(`INSERT INTO bot_settings VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(bot_id) DO UPDATE SET role=excluded.role, model=excluded.model,
      effort=excluded.effort, device_id=excluded.device_id, servers_json=excluded.servers_json, revision=excluded.revision, updated_at=excluded.updated_at`)
      .run(bot.id, settings.role, settings.model, settings.effort, settings.deviceId, JSON.stringify(settings.servers), settings.revision + 1, this.now());
  }

  /** The owner changes a Bot's name or setup; the device that runs it picks the change up the next time it reports. */
  updateBot(owner, bot, { displayName: name, ...input }, { serverOrigin } = {}) {
    const checked = this.checkedSettings(owner, input, serverOrigin);
    if (name !== undefined) this.db.prepare('UPDATE accounts SET display_name=? WHERE id=?').run(displayName(name, bot.username), bot.id);
    this.writeSettings(bot, { ...this.settingsOf(bot), ...checked });
    return this.account(bot.id);
  }

  /** A Bot as its owner manages it: the account, its setup, and what its device last reported about it. */
  managedBot(bot) {
    const settings = this.settingsOf(bot);
    const device = settings.deviceId ? this.db.prepare('SELECT * FROM devices WHERE id=?').get(settings.deviceId) : undefined;
    const reported = device ? JSON.parse(device.report_json).bots?.[bot.id] : undefined;
    return { ...this.view(bot), settings,
      runtime: device ? { online: this.deviceOnline(device), ...(reported && typeof reported === 'object' ? reported : {}) } : null };
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

  deviceOnline(row) { return this.now() - row.last_seen < DEVICE_ONLINE_MS; }

  deviceView(row) {
    const { models = null, plugin = null, decision = null } = JSON.parse(row.report_json);
    return { id: row.id, label: row.label, online: this.deviceOnline(row), models, plugin, decision,
      createdAt: new Date(row.created_at).toISOString(), lastSeen: new Date(row.last_seen).toISOString() };
  }

  /** The person's devices: each DSH they signed in with a connection key. */
  devicesOf(owner) {
    return this.db.prepare('SELECT * FROM devices WHERE account_id=? ORDER BY created_at').all(owner.id).map(row => this.deviceView(row));
  }

  ownedDevice(owner, deviceId) {
    const row = typeof deviceId === 'string' && this.db.prepare('SELECT * FROM devices WHERE id=? AND account_id=?').get(deviceId, owner.id);
    if (!row) throw failure(404, 'DEVICE_NOT_FOUND');
    return row;
  }

  /**
   * A device reports what it has (its models, its plugin, how each of its Bots is doing) and learns which Bots it should run.
   * A Bot that has no device yet goes to the first of its owner's devices that reports.
   */
  syncDevice(owner, session, deviceId, { label, report }) {
    if (typeof deviceId !== 'string' || !/^[A-Za-z0-9_-]{8,80}$/.test(deviceId)) throw failure(400, 'DEVICE_ID_INVALID');
    if (report === null || typeof report !== 'object' || Array.isArray(report)) throw failure(400, 'DEVICE_REPORT_INVALID');
    const json = JSON.stringify(report);
    if (json.length > REPORT_LIMIT) throw failure(413, 'DEVICE_REPORT_TOO_LARGE');
    const name = text(label, 80, 'DEVICE_LABEL_INVALID') || 'DSH';
    const at = this.now();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      // A device signed in as someone else now: the Bots it ran for the previous person wait for another device.
      this.db.prepare(`UPDATE bot_settings SET device_id=NULL, revision=revision+1 WHERE device_id=? AND bot_id NOT IN
        (SELECT id FROM accounts WHERE owner_id=?)`).run(deviceId, owner.id);
      this.db.prepare(`INSERT INTO devices VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET account_id=excluded.account_id, label=excluded.label,
        report_json=excluded.report_json, last_seen=excluded.last_seen, session_id=excluded.session_id`).run(deviceId, owner.id, name, json, at, at, session.id);
      const bots = this.botsOf(owner).filter(bot => bot.status === 'active');
      for (const bot of bots) {
        const settings = this.settingsOf(bot);
        if (!settings.deviceId) this.writeSettings(bot, { ...settings, deviceId });
      }
      this.db.exec('COMMIT');
      return { device: this.deviceView(this.ownedDevice(owner, deviceId)),
        bots: bots.map(bot => ({ ...this.view(bot), settings: this.settingsOf(bot) })).filter(bot => bot.settings.deviceId === deviceId) };
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }

  /**
   * Removing a device leaves its Bots waiting for another one and ends the session the device reports with, so
   * a device removed from somewhere else finds itself signed out and stops.
   */
  removeDevice(owner, deviceId) {
    const device = this.ownedDevice(owner, deviceId);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('UPDATE bot_settings SET device_id=NULL, revision=revision+1 WHERE device_id=?').run(device.id);
      this.db.prepare('DELETE FROM devices WHERE id=?').run(device.id);
      this.db.prepare('DELETE FROM sessions WHERE id=?').run(device.session_id);
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
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

  /** A one-time code that lets the person's DSH sign in as them; it is shown once, in a connection key. */
  startConnect(account) {
    const code = randomBytes(32).toString('base64url');
    const at = this.now();
    this.db.prepare('DELETE FROM connect_codes WHERE expires_at<=? OR consumed=1').run(at);
    this.db.prepare('INSERT INTO connect_codes(code_hash,account_id,created_at,expires_at) VALUES (?,?,?,?)')
      .run(digest(code), usable(account).id, at, at + CONNECT_MS);
    return { code, expiresIn: CONNECT_MS / 1000 };
  }

  /** Trades a connection code, once, for a session of the person who made it. */
  redeemConnect(code, label) {
    const row = typeof code === 'string' && code && this.db.prepare('SELECT * FROM connect_codes WHERE code_hash=?').get(digest(code));
    if (!row || row.consumed) throw failure(404, 'CONNECT_CODE_UNKNOWN', 'This connection key is unknown or was already used');
    if (row.expires_at <= this.now()) throw failure(410, 'CONNECT_CODE_EXPIRED', 'This connection key has expired');
    const account = usable(this.account(row.account_id));
    this.db.prepare('UPDATE connect_codes SET consumed=1 WHERE code_hash=?').run(row.code_hash);
    return { token: this.openSession(account, 'login', label), account };
  }

  /** Closing keeps the username taken; the account's sessions and grants end. A person closes their Bots first. */
  closeAccount(account) {
    if (this.botsOf(account).some(bot => bot.status !== 'closed')) throw failure(409, 'OWNS_ACTIVE_BOTS', 'Close your Bots first');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare("UPDATE accounts SET status='closed', salt=NULL, password_hash=NULL WHERE id=?").run(account.id);
      this.db.prepare('DELETE FROM sessions WHERE account_id=?').run(account.id);
      this.db.prepare('DELETE FROM grants WHERE account_id=?').run(account.id);
      this.db.prepare('DELETE FROM connect_codes WHERE account_id=?').run(account.id);
      this.db.prepare('DELETE FROM bot_settings WHERE bot_id=?').run(account.id);
      this.db.prepare('DELETE FROM devices WHERE account_id=?').run(account.id);
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
}
