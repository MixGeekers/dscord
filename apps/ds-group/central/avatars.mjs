import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const failure = (status, code) => Object.assign(new Error(code), { status, code });
const ASSET = /^[a-f0-9]{64}$/;
export function avatarOptions(input = {}) {
  const result = { backend: 'local', directory: 'avatars', maxUploadBytes: 5 * 1024 * 1024, sizes: [64, 128, 512], ...input };
  if (result.backend !== 'local') throw new Error('avatars.backend currently supports local storage');
  if (typeof result.directory !== 'string' || !result.directory.trim()) throw new Error('avatars.directory is required');
  if (!Number.isSafeInteger(result.maxUploadBytes) || result.maxUploadBytes < 1 || result.maxUploadBytes > 20 * 1024 * 1024) throw new Error('avatars.maxUploadBytes must be between 1 and 20971520');
  if (!Array.isArray(result.sizes) || ![64, 128, 512].every(size => result.sizes.includes(size)) || result.sizes.length > 6 || result.sizes.some(size => !Number.isSafeInteger(size) || size < 32 || size > 1024)) throw new Error('avatars.sizes must include 64, 128 and 512, with at most six sizes between 32 and 1024');
  result.sizes = [...new Set(result.sizes)].sort((a, b) => a - b);
  return result;
}

/** Identity images only. Original uploads and processing directories are never published. */
export class Avatars {
  constructor({ store, dataRoot, issuer, config }) {
    Object.assign(this, { store, issuer });
    this.options = avatarOptions(config);
    this.directory = path.resolve(dataRoot, this.options.directory);
    store.db.exec(`CREATE TABLE IF NOT EXISTS account_profiles (
      account_id TEXT PRIMARY KEY REFERENCES accounts(id), version INTEGER NOT NULL,
      asset_id TEXT, updated_at INTEGER NOT NULL);`);
    store.profileOf = account => this.profile(account);
  }
  profile(account) {
    const row = this.store.db.prepare('SELECT * FROM account_profiles WHERE account_id=?').get(account.id);
    return { id: account.id, globalId: this.store.globalId(account.username), profileVersion: row?.version ?? 0,
      avatar: row?.asset_id ? { id: row.asset_id, url: `${this.issuer}/avatars/${row.asset_id}/128.webp`,
        sizes: Object.fromEntries(this.options.sizes.map(size => [size, `${this.issuer}/avatars/${row.asset_id}/${size}.webp`])) } : null };
  }
  expected(account, value) {
    if (value === null || !/^\d+$/.test(value)) throw failure(400, 'AVATAR_VERSION_REQUIRED');
    const version = Number(value);
    if (!Number.isSafeInteger(version) || this.profile(account).profileVersion !== version) throw failure(409, 'AVATAR_CHANGED');
    return version;
  }
  commit(account, version, assetId) {
    this.store.db.exec('BEGIN IMMEDIATE');
    try {
      this.expected(account, String(version));
      if (this.store.account(account.id)?.status !== 'active') throw failure(403, 'ACCOUNT_INACTIVE');
      this.store.db.prepare(`INSERT INTO account_profiles VALUES (?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET
        version=excluded.version,asset_id=excluded.asset_id,updated_at=excluded.updated_at`).run(account.id, version + 1, assetId, this.store.now());
      this.store.db.exec('COMMIT');
    } catch (error) { this.store.db.exec('ROLLBACK'); throw error; }
    return this.profile(account);
  }
  async upload(request, query) {
    const type = String(request.headers['content-type'] || '').split(';')[0];
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) throw failure(415, 'AVATAR_FORMAT');
    if (Number(request.headers['content-length']) > this.options.maxUploadBytes) throw failure(413, 'AVATAR_TOO_LARGE');
    let size = 0;
    const chunks = [];
    // Do not destroy the socket on a bounded-body rejection; let HTTP return the error.
    for await (const chunk of request.iterator({ destroyOnReturn: false })) {
      size += chunk.length;
      if (size > this.options.maxUploadBytes) { request.resume(); throw failure(413, 'AVATAR_TOO_LARGE'); }
      chunks.push(chunk);
    }
    let bytes;
    try {
      const image = sharp(Buffer.concat(chunks), { limitInputPixels: 40_000_000, failOn: 'warning' });
      const meta = await image.metadata();
      if (!['jpeg', 'png', 'webp'].includes(meta.format) || (meta.pages ?? 1) !== 1) throw failure(415, 'AVATAR_FORMAT');
      const swapped = [5, 6, 7, 8].includes(meta.orientation);
      const width = swapped ? meta.height : meta.width, height = swapped ? meta.width : meta.height;
      const cropKeys = ['left', 'top', 'size'];
      const hasCrop = cropKeys.some(key => query.has(key));
      let pipeline = image.autoOrient();
      if (hasCrop) {
        const [left, top, edge] = cropKeys.map(key => query.has(key) ? Number(query.get(key)) : NaN);
        if (![left, top, edge].every(Number.isSafeInteger) || left < 0 || top < 0 || edge < 1 || left + edge > width || top + edge > height) throw failure(400, 'AVATAR_CROP');
        pipeline = pipeline.extract({ left, top, width: edge, height: edge });
      }
      bytes = await pipeline.resize(512, 512, { fit: 'cover' }).webp({ quality: 85 }).toBuffer();
    } catch (error) { if (error.status) throw error; throw failure(400, 'AVATAR_INVALID_IMAGE'); }
    const id = createHash('sha256').update(bytes).digest('hex');
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const temp = path.join(this.directory, `.upload-${randomUUID()}`);
    await mkdir(temp, { mode: 0o700 });
    try {
      for (const edge of this.options.sizes) {
        const output = edge === 512 ? bytes : await sharp(bytes).resize(edge, edge).webp({ quality: 85 }).toBuffer();
        await writeFile(path.join(temp, `${edge}.webp`), output, { mode: 0o600 });
      }
      try { await rename(temp, path.join(this.directory, id)); }
      catch (error) { if (!['ENOTEMPTY', 'EEXIST'].includes(error.code)) throw error; }
    } finally { await rm(temp, { recursive: true, force: true }); }
    return id;
  }
  async serve(response, id, size) {
    if (!ASSET.test(id) || !this.options.sizes.includes(Number(size))) throw failure(404, 'AVATAR_NOT_FOUND');
    let bytes;
    try { bytes = await readFile(path.join(this.directory, id, `${size}.webp`)); }
    catch (error) { if (error.code === 'ENOENT') throw failure(404, 'AVATAR_NOT_FOUND'); throw error; }
    response.writeHead(200, { 'Content-Type': 'image/webp', 'Content-Length': bytes.length,
      'Cache-Control': 'public, max-age=86400, immutable', 'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': '*', 'Cross-Origin-Resource-Policy': 'cross-origin' });
    response.end(bytes);
  }
}
