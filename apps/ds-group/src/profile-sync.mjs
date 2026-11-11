/** Pull public identity images from our trusted central; Matrix replicas are an independently retried projection. */
export class ProfileSync {
  constructor({ accounts, trust, intervalMs = 5000, fetchImpl = globalThis.fetch }) {
    Object.assign(this, { accounts, trust, fetchImpl });
    accounts.db.exec(`CREATE TABLE IF NOT EXISTS account_profiles (
      user_id TEXT PRIMARY KEY, version INTEGER NOT NULL, profile_json TEXT NOT NULL,
      matrix_version INTEGER NOT NULL DEFAULT -1, pending_uri TEXT);`);
    accounts.profileOf = id => {
      const row = accounts.db.prepare('SELECT profile_json FROM account_profiles WHERE user_id=?').get(id);
      return row ? JSON.parse(row.profile_json) : {};
    };
    accounts.refreshSetup();
    this.work = null;
    this.stopped = false;
    this.timer = trust && intervalMs > 0 ? setInterval(() => void this.sync(), intervalMs) : null;
    this.timer?.unref();
    if (trust) void this.sync();
  }
  sync() {
    if (this.stopped || !this.trust) return Promise.resolve();
    if (this.work) return this.work;
    this.work = this.pull().catch(error => { this.lastError = error.message; }).finally(() => { this.work = null; });
    return this.work;
  }
  async pull() {
    const rows = this.accounts.db.prepare("SELECT * FROM accounts WHERE status='active' AND central_id IS NOT NULL").all();
    for (let offset = 0; offset < rows.length && !this.stopped; offset += 100) {
      const batch = rows.slice(offset, offset + 100);
      const url = new URL('/api/profiles', this.trust.url);
      url.searchParams.set('ids', batch.map(row => row.central_id).join(','));
      const response = await this.fetchImpl(url, { redirect: 'error', signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`Central profiles HTTP ${response.status}`);
      const { profiles } = await response.json();
      if (!Array.isArray(profiles) || profiles.length > 100) throw new Error('Invalid central profiles');
      for (const profile of profiles) {
        if (this.stopped) return;
        const account = batch.find(row => row.central_id === profile.id && row.global_id === profile.globalId);
        if (!account || !Number.isSafeInteger(profile.profileVersion) || profile.profileVersion < 0) continue;
        const avatar = profile.avatar;
        if (avatar !== null && (!avatar || !/^[a-f0-9]{64}$/.test(avatar.id))) continue;
        // Build addresses from the trusted issuer and asset ID, never from caller-controlled URLs.
        const clean = { profileVersion: profile.profileVersion, avatar: avatar ? {
          id: avatar.id, url: `${this.trust.issuer}/avatars/${avatar.id}/128.webp`,
          sizes: Object.fromEntries([64, 128, 512].map(size => [size, `${this.trust.issuer}/avatars/${avatar.id}/${size}.webp`])),
        } : null };
        const previous = this.accounts.db.prepare('SELECT * FROM account_profiles WHERE user_id=?').get(account.user_id);
        if (previous && previous.version > profile.profileVersion) continue;
        if (!previous || previous.version < profile.profileVersion) {
          this.accounts.db.prepare(`INSERT INTO account_profiles (user_id,version,profile_json) VALUES (?,?,?)
            ON CONFLICT(user_id) DO UPDATE SET version=excluded.version,profile_json=excluded.profile_json,pending_uri=NULL`).run(account.user_id, profile.profileVersion, JSON.stringify(clean));
          this.accounts.refreshSetup();
        }
        const saved = this.accounts.db.prepare('SELECT * FROM account_profiles WHERE user_id=?').get(account.user_id);
        if (saved.matrix_version === saved.version) continue;
        // A default, never-customized profile need not create Matrix member events.
        if (saved.version === 0) {
          this.accounts.db.prepare('UPDATE account_profiles SET matrix_version=0 WHERE user_id=?').run(account.user_id);
          continue;
        }
        try { await this.mirror(account, saved, clean); }
        catch (error) { this.lastError = error.message; } // One unavailable account must not delay every other identity.
      }
    }
  }
  async mirror(account, saved, profile) {
    if (!account.service_token) return;
    const client = this.accounts.clientFactory(account.service_token);
    let uri = saved.pending_uri;
    if (profile.avatar && !uri) {
      const url = new URL(`/avatars/${profile.avatar.id}/512.webp`, this.trust.url);
      const response = await this.fetchImpl(url, { redirect: 'error', signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`Central avatar HTTP ${response.status}`);
      const chunks = []; let size = 0;
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > 2 * 1024 * 1024) throw new Error('Central avatar exceeds replica limit');
        chunks.push(chunk);
      }
      const result = await client.uploadMedia(Buffer.concat(chunks), { filename: 'avatar.webp', mimeType: 'image/webp', size });
      if (!/^mxc:\/\/[^/?#]+\/[^/?#]+$/.test(result.content_uri || '')) throw new Error('Invalid Matrix avatar receipt');
      uri = result.content_uri;
      this.accounts.db.prepare('UPDATE account_profiles SET pending_uri=? WHERE user_id=? AND version=?').run(uri, account.user_id, saved.version);
    }
    if (this.stopped) return;
    await client.request('PUT', `/_matrix/client/v3/profile/${encodeURIComponent(account.user_id)}/avatar_url`, { avatar_url: uri || '' });
    this.accounts.db.prepare('UPDATE account_profiles SET matrix_version=?,pending_uri=NULL WHERE user_id=? AND version=?').run(saved.version, account.user_id, saved.version);
  }
  async close() { this.stopped = true; clearInterval(this.timer); await this.work; }
}
