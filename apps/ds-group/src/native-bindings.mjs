const invalid = (message, status = 400) => Object.assign(new Error(message), { status });
const identifier = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,200}$/.test(value);

/** Which Bots run as a DSH-native Bot, as each Bot reports when its node connects. No credentials live here. */
export class NativeBindings {
  constructor(accounts) {
    this.accounts = accounts;
    this.db = accounts.db;
    this.db.exec(`CREATE TABLE IF NOT EXISTS native_bot_bindings (
      bot_id TEXT PRIMARY KEY, host_id TEXT NOT NULL, native_id TEXT NOT NULL, UNIQUE(host_id,native_id));`);
  }

  /** Record (or clear, with no binding) how this Bot runs. */
  report(botId, native) {
    if (native === undefined || native === null) {
      this.db.prepare('DELETE FROM native_bot_bindings WHERE bot_id=?').run(botId);
      return null;
    }
    if (!identifier(native?.hostId) || !identifier(native.nativeBotId)) throw invalid('Invalid native Bot binding');
    const holder = this.db.prepare('SELECT bot_id FROM native_bot_bindings WHERE host_id=? AND native_id=?').get(native.hostId, native.nativeBotId);
    if (holder && holder.bot_id !== botId) throw invalid('This local Bot is already linked to another account', 409);
    this.db.prepare(`INSERT INTO native_bot_bindings VALUES (?,?,?) ON CONFLICT(bot_id)
      DO UPDATE SET host_id=excluded.host_id,native_id=excluded.native_id`).run(botId, native.hostId, native.nativeBotId);
    return this.binding(botId);
  }

  binding(botId) {
    return this.db.prepare('SELECT host_id AS hostId,native_id AS nativeBotId,bot_id AS botId FROM native_bot_bindings WHERE bot_id=?').get(botId) ?? null;
  }

  bindings(ownerId) {
    return this.db.prepare(`SELECT b.host_id AS hostId,b.native_id AS nativeBotId,b.bot_id AS botId FROM native_bot_bindings b
      JOIN accounts a ON a.user_id=b.bot_id WHERE a.owner_id=?`).all(ownerId);
  }

  isNative(botId) { return Boolean(this.binding(botId)); }
}
