import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { MatrixClient } from './matrix-client.mjs';

const failure = (status, message) => Object.assign(new Error(message), { status });
const coded = (status, code, message = code) => Object.assign(failure(status, message), { code });
const publicPerson = ({ id, localpart, name, kind, ownerId, globalId, avatar, profileVersion }) => ({ id, localpart, name, kind,
  ...(kind === 'bot' ? { ownerId } : {}), ...(globalId ? { globalId } : {}), ...(profileVersion > 0 ? { avatar, profileVersion } : {}) });
const MATRIX_LOCALPART = /^[a-z0-9._=\-/]{1,64}$/;
const IDENTITY_SCHEMA_VERSION = '2';

const SESSION_CACHE_MS = 15000;

/**
 * Local accounts on this chat server. Every person and Bot comes from the central server: an
 * identity token is the only way in, and Core keeps each Matrix password so nobody else needs one.
 */

export class AccountService {
  constructor({ setup, config = {}, dataRoot, onParticipant, registrationSecret, clientFactory } = {}) {
    this.setup = setup;
    this.config = config;
    this.dataRoot = dataRoot;
    this.onParticipant = onParticipant;
    this.registrationSecret = registrationSecret;
    this.clientFactory = clientFactory || (accessToken => new MatrixClient({ baseUrl: setup.homeserverUrl, accessToken }));
    this.serverName = setup.serverName || setup.participants[0]?.id.split(':').slice(1).join(':');
    this.operations = new Map();
    this.sessions = new Map();
  }

  async initialize() {
    await mkdir(this.dataRoot, { recursive: true, mode: 0o700 });
    try {
      const metadata = JSON.parse(await readFile(path.join(this.dataRoot, 'server.json'), 'utf8'));
      if (this.serverName && metadata.serverName && metadata.serverName !== this.serverName) throw new Error('Account registration belongs to another Matrix server');
      this.serverName ||= metadata.serverName;
      this.registrationSecret ??= metadata.registrationSecret;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const filename = path.join(this.dataRoot, 'accounts.sqlite');
    this.db = new DatabaseSync(filename);
    try { return await this.#initializeDatabase(filename); }
    catch (error) { this.close(); throw error; }
  }

  async #initializeDatabase(filename) {
    await chmod(filename, 0o600);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS account_metadata (key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
    const identityVersion = this.db.prepare("SELECT value FROM account_metadata WHERE key='identitySchemaVersion'").get()?.value;
    if (identityVersion !== undefined && identityVersion !== IDENTITY_SCHEMA_VERSION) {
      throw new Error('This account database predates central identity. Start the chat server with a new data directory');
    }
    this.db.exec(`CREATE TABLE IF NOT EXISTS accounts (
        user_id TEXT PRIMARY KEY, localpart TEXT UNIQUE NOT NULL, name TEXT NOT NULL, kind TEXT NOT NULL,
        owner_id TEXT, status TEXT NOT NULL, service_token TEXT, service_device_id TEXT,
        recovery_password TEXT, central_id TEXT UNIQUE, global_id TEXT UNIQUE, last_error TEXT,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );`);
    const storedServer = this.db.prepare("SELECT value FROM account_metadata WHERE key='serverName'").get()?.value;
    if (storedServer && this.serverName && storedServer !== this.serverName) throw new Error('Account database belongs to another Matrix server');
    this.serverName ||= storedServer;
    if (this.serverName) {
      this.setup.serverName = this.serverName;
      this.db.prepare("INSERT OR IGNORE INTO account_metadata VALUES ('serverName',?)").run(this.serverName);
    }
    const seedOwner = this.setup.participants.find(person => person.kind === 'human')?.id;
    if (seedOwner) this.db.prepare("INSERT OR IGNORE INTO account_metadata VALUES ('ownerId',?)").run(seedOwner);
    this.ownerId = this.db.prepare("SELECT value FROM account_metadata WHERE key='ownerId'").get()?.value;
    // Accounts a deployment seeds directly in Matrix. The central account of the same name claims one on first sign-in.
    for (const person of this.setup.participants) {
      if (!['human', 'bot'].includes(person.kind) || person.id !== `@${person.localpart}:${this.serverName}`) {
        throw new Error('Account registry must contain complete identities on its own Matrix server');
      }
      const existing = this.row(person.id);
      if (existing && existing.kind !== person.kind) throw new Error('An existing account cannot change identity kind');
      this.db.prepare(`INSERT OR IGNORE INTO accounts
        (user_id,localpart,name,kind,owner_id,status,service_token,recovery_password,created_at,updated_at) VALUES (?,?,?,?,?,'active',?,?,?,?)`)
        .run(person.id, person.localpart, person.name, person.kind, person.kind === 'bot' ? person.ownerId || this.ownerId : null,
          person.accessToken || null, person.password || null, Date.now(), Date.now());
    }
    this.db.prepare("INSERT OR REPLACE INTO account_metadata VALUES ('identitySchemaVersion',?)").run(IDENTITY_SCHEMA_VERSION);
    this.refreshSetup();
    return this;
  }

  row(userId) { return this.db.prepare('SELECT * FROM accounts WHERE user_id=?').get(userId); }

  identity(userId) {
    const row = this.row(userId);
    if (!row) throw failure(403, 'A registered account is required');
    return { globalId: row.global_id, matrixUserId: userId, kind: row.kind, ...(row.owner_id ? { ownerMatrixUserId: row.owner_id } : {}) };
  }

  assertActive(userId) {
    if (this.row(userId)?.status !== 'active') throw Object.assign(failure(403, 'This account is not active on its home server'), { code: 'ACCOUNT_INACTIVE' });
    return userId;
  }

  // Matrix owns token validity; a short cache avoids one whoami round trip per API call.
  async authenticate(token) {
    const now = Date.now();
    let cached = this.sessions.get(token);
    if (!cached || cached.expires <= now) {
      if (this.sessions.size > 1000) for (const [key, value] of this.sessions) if (value.expires <= now) this.sessions.delete(key);
      cached = { result: await this.clientFactory(token).whoami(), expires: now + SESSION_CACHE_MS };
      this.sessions.set(token, cached);
    }
    this.assertActive(cached.result.user_id);
    return cached.result;
  }

  session(session) {
    this.assertActive(session.user_id);
    return { ...session, identity: this.identity(session.user_id), ...(this.home ? { home: this.home } : {}) };
  }

  participant(row) {
    return { id: row.user_id, localpart: row.localpart, name: row.name, kind: row.kind,
      ...(row.owner_id ? { ownerId: row.owner_id } : {}), ...(row.global_id ? { globalId: row.global_id } : {}),
      ...(row.service_token ? { accessToken: row.service_token } : {}), ...this.profileOf?.(row.user_id) };
  }

  refreshSetup() {
    const existing = new Map(this.setup.participants.map(person => [person.id, person]));
    const people = this.db.prepare("SELECT * FROM accounts WHERE status='active' ORDER BY created_at,rowid").all()
      .map(row => ({ ...existing.get(row.user_id), ...this.participant(row) }));
    this.setup.participants.splice(0, this.setup.participants.length, ...people);
  }

  person(userId) { return this.setup.participants.find(person => person.id === userId); }
  publicParticipants() { return this.setup.participants.map(publicPerson); }
  ownedBots(userId) { return this.setup.participants.filter(person => person.kind === 'bot' && person.ownerId === userId).map(publicPerson); }

  human(userId) {
    this.assertActive(userId);
    const person = this.person(userId);
    if (person?.kind !== 'human') throw failure(403, 'A registered human account is required');
    return person;
  }

  async publish(userId) {
    this.refreshSetup();
    const person = this.person(userId);
    await this.onParticipant?.(person);
    return person;
  }

  async serialize(key, work) {
    const previous = this.operations.get(key);
    if (previous) return previous;
    const promise = Promise.resolve().then(work);
    this.operations.set(key, promise);
    try { return await promise; }
    finally { this.operations.delete(key); }
  }

  async passwordLogin(userId, password, service = false, clientIp) {
    const deviceId = service ? `DSCORD_CORE_${createHash('sha256').update(userId).digest('hex').slice(0, 24)}` : `DSCORD_${randomUUID()}`;
    const session = await this.clientFactory().request('POST', '/_matrix/client/v3/login', {
      type: 'm.login.password', identifier: { type: 'm.id.user', user: userId }, password,
      device_id: deviceId, initial_device_display_name: service ? 'DSCord server' : 'DSCord client',
    }, { clientIp });
    if (session.user_id !== userId || !session.access_token) throw failure(502, 'Matrix returned another account identity');
    return session;
  }

  async saveServiceSession(userId, session) {
    this.db.prepare('UPDATE accounts SET service_token=?,service_device_id=?,updated_at=? WHERE user_id=?')
      .run(session.access_token, session.device_id || null, Date.now(), userId);
  }

  async ensureServiceSession(userId, password, clientIp) {
    const row = this.row(userId);
    if (row?.service_token) {
      try {
        if ((await this.clientFactory(row.service_token).whoami()).user_id === userId) return;
      } catch (error) { if (![401, 403].includes(error.status)) throw error; }
    }
    await this.saveServiceSession(userId, await this.passwordLogin(userId, password, true, clientIp));
  }

  async joinInitialRoom(userId) {
    if (!this.setup.roomId || userId === this.ownerId || this.row(userId).kind === 'bot') return;
    const person = this.row(userId);
    const client = this.clientFactory(person.service_token);
    const { joined_rooms: joined = [] } = await client.request('GET', '/_matrix/client/v3/joined_rooms');
    if (joined.includes(this.setup.roomId)) return;
    const owner = this.row(this.ownerId);
    if (!owner?.service_token) throw failure(503, 'The server owner must sign in before new members can join');
    await this.clientFactory(owner.service_token).request('POST', `/_matrix/client/v3/rooms/${encodeURIComponent(this.setup.roomId)}/invite`, { user_id: userId });
    await client.join(this.setup.roomId);
  }

  async activate(userId) {
    if (['disabled', 'deactivated'].includes(this.row(userId)?.status)) throw failure(403, 'This account is disabled');
    this.db.prepare("UPDATE accounts SET status='active',last_error=NULL,updated_at=? WHERE user_id=?").run(Date.now(), userId);
    if (!this.ownerId && this.row(userId).kind === 'human') {
      this.db.prepare("INSERT OR IGNORE INTO account_metadata VALUES ('ownerId',?)").run(userId);
      this.ownerId = this.db.prepare("SELECT value FROM account_metadata WHERE key='ownerId'").get().value;
    }
    return this.publish(userId);
  }

  async provision(userId, clientIp) {
    const row = this.row(userId);
    const password = row.recovery_password;
    if (['disabled', 'deactivated'].includes(row?.status)) throw failure(403, 'This account is disabled');
    try {
      if (!row.service_token) {
        const recovering = Boolean(row.last_error);
        this.db.prepare("UPDATE accounts SET last_error='REGISTRATION_STARTED' WHERE user_id=?").run(userId);
        const anonymous = this.clientFactory();
        const { nonce } = await anonymous.request('GET', '/_synapse/admin/v1/register', undefined, { clientIp });
        const mac = createHmac('sha1', this.registrationSecret).update([nonce, row.localpart, password, 'notadmin'].join('\0')).digest('hex');
        let session;
        try {
          session = await anonymous.request('POST', '/_synapse/admin/v1/register', {
            nonce, username: row.localpart, password, displayname: row.name, admin: false, mac,
          }, { clientIp });
        } catch (error) {
          if (error.errcode !== 'M_USER_IN_USE') throw error;
          if (!recovering) throw coded(409, 'MATRIX_ACCOUNT_EXISTS', 'This Matrix account was created outside DSCord');
          // A previous attempt may have reached Matrix before its response was lost.
          session = await this.passwordLogin(userId, password, true, clientIp);
        }
        if (session.user_id !== userId || !session.access_token) throw failure(502, 'Matrix returned another account identity');
        await this.saveServiceSession(userId, session);
      } else await this.ensureServiceSession(userId, password, clientIp);
      const client = this.clientFactory(this.row(userId).service_token);
      await client.request('PUT', `/_matrix/client/v3/profile/${encodeURIComponent(userId)}/displayname`, { displayname: row.name });
      await this.joinInitialRoom(userId);
      return await this.activate(userId);
    } catch (error) {
      this.db.prepare('UPDATE accounts SET last_error=?,updated_at=? WHERE user_id=?').run(error.code || error.errcode || 'PROVISIONING_PENDING', Date.now(), userId);
      throw error;
    }
  }

  /**
   * Sign in with verified identity-token claims. The central username is the Matrix localpart, so
   * the first sign-in creates the account and later ones open another session for it.
   */
  async signIn(claims, { ownerId = null, admit, clientIp } = {}) {
    if (!this.serverName || !this.registrationSecret) throw coded(503, 'ACCOUNTS_UNCONFIGURED', 'This server has no Matrix account registration configuration');
    const kind = claims.kind === 'bot' ? 'bot' : 'human';
    if (typeof claims.username !== 'string' || !MATRIX_LOCALPART.test(claims.username) || typeof claims.sub !== 'string' || typeof claims.gid !== 'string') {
      throw coded(401, 'IDENTITY_TOKEN_CLAIMS', 'The identity token is incomplete');
    }
    if (kind === 'bot' && !ownerId) throw coded(401, 'IDENTITY_TOKEN_OWNER', 'A Bot identity names its owner');
    const userId = `@${claims.username}:${this.serverName}`;
    const name = typeof claims.name === 'string' && claims.name.trim() ? claims.name.trim().slice(0, 80) : claims.username;
    await this.serialize(userId, async () => {
      const previous = this.row(userId);
      if (previous?.central_id && previous.central_id !== claims.sub) throw coded(409, 'IDENTITY_CONFLICT', 'This account belongs to another central identity');
      if (previous && previous.kind !== kind) throw coded(409, 'IDENTITY_KIND_CONFLICT', 'This account name belongs to another kind of account');
      if (['disabled', 'deactivated'].includes(previous?.status)) throw failure(403, 'This account is disabled');
      if (previous && !previous.recovery_password) throw coded(409, 'ACCOUNT_NOT_CLAIMABLE', 'This seeded account has no password Core can use');
      if (previous) {
        this.db.prepare('UPDATE accounts SET central_id=?,global_id=?,name=?,owner_id=?,updated_at=? WHERE user_id=?')
          .run(claims.sub, claims.gid, name, kind === 'bot' ? ownerId : null, Date.now(), userId);
      } else {
        await admit?.();
        this.db.prepare(`INSERT INTO accounts (user_id,localpart,name,kind,owner_id,status,recovery_password,central_id,global_id,created_at,updated_at)
          VALUES (?,?,?,?,?,'provisioning',?,?,?,?,?)`)
          .run(userId, claims.username, name, kind, kind === 'bot' ? ownerId : null, randomBytes(32).toString('base64url'),
            claims.sub, claims.gid, Date.now(), Date.now());
      }
      await this.provision(userId, clientIp);
    });
    return this.session(await this.passwordLogin(userId, this.row(userId).recovery_password, false, clientIp));
  }

  async me(token) {
    const { user_id: userId } = await this.authenticate(token);
    return { user: publicPerson(this.human(userId)), ownedBots: this.ownedBots(userId), identity: this.identity(userId),
      ...(this.home ? { home: this.home } : {}) };
  }

  async logout(token) {
    this.sessions.delete(token);
    // A seeded account's credential is also the Core service credential. It is never revoked here.
    if (this.setup.participants.some(person => person.accessToken === token)) return { loggedOut: true, localOnly: true };
    try { await this.clientFactory(token).request('POST', '/_matrix/client/v3/logout', {}); }
    catch (error) { if (error.status !== 401) throw error; }
    return { loggedOut: true };
  }

  close() { this.db?.close(); this.db = null; }
}
