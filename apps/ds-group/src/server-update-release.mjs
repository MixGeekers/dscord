import { createHash } from 'node:crypto';
import { cleanVersion, newer } from '../vendor/ds-bot/src/host/update.js';

export const UPDATE_CONTRACT = 1;
export const DEFAULT_REPOSITORY = 'MixGeekers/dscord';
const fail = message => { throw new Error(message); };

export function validateUpdateManifest(input, { repository = DEFAULT_REPOSITORY, version } = {}) {
  const image = `ghcr.io/${repository.split('/')[0].toLowerCase()}/ds-group@sha256:`;
  if (!input || input.schemaVersion !== 1 || cleanVersion(input.version) !== input.version || input.version !== version
    || input.deploymentContract !== UPDATE_CONTRACT || input.rollbackCompatible !== true
    || !Array.isArray(input.fromVersions) || !input.fromVersions.length || !input.fromVersions.every(v => cleanVersion(v) === v)
    || !/^\d+\.\d+$/.test(input.nodeProtocol || '') || typeof input.image !== 'string'
    || !input.image.startsWith(image) || !/^[a-f0-9]{64}$/.test(input.image.slice(image.length))) fail('Invalid server update manifest');
  return { schemaVersion: 1, version: input.version, image: input.image, deploymentContract: UPDATE_CONTRACT,
    fromVersions: [...input.fromVersions], nodeProtocol: input.nodeProtocol, rollbackCompatible: true };
}

/** GitHub is the configured release authority; checksums bind the manifest to its release assets. */
export class ServerReleases {
  constructor({ repository = DEFAULT_REPOSITORY, fetchImpl = fetch } = {}) {
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) fail('Invalid update repository');
    Object.assign(this, { repository, fetchImpl });
  }
  async download(url, limit = 1024 * 1024) {
    const response = await this.fetchImpl(url, { signal: AbortSignal.timeout(15000),
      headers: { Accept: 'application/json', 'User-Agent': 'DSCord-server-updater' } });
    if (!response.ok) fail(`Release service returned HTTP ${response.status}`);
    let length = 0;
    const chunks = [];
    for await (const chunk of response.body) {
      length += chunk.length;
      if (length > limit) fail('Release metadata exceeds size limit');
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
  }
  async manifest(release) {
    const version = release.tag_name.slice(10);
    // Construct URLs from the pinned repository/tag; asset URLs supplied by the response are not trusted.
    const base = `https://github.com/${this.repository}/releases/download/${release.tag_name}`;
    const [raw, checksums] = await Promise.all([this.download(`${base}/server-update.json`), this.download(`${base}/SHA256SUMS`)]);
    const expected = checksums.split('\n').map(line => line.trim().split(/\s+/)).find(parts => parts[1]?.replace(/^\*/, '') === 'server-update.json')?.[0];
    if (!/^[a-f0-9]{64}$/.test(expected || '') || createHash('sha256').update(raw).digest('hex') !== expected) fail('Update manifest checksum mismatch');
    return { ...validateUpdateManifest(JSON.parse(raw), { repository: this.repository, version }),
      url: `https://github.com/${this.repository}/releases/tag/${release.tag_name}` };
  }
  async check({ currentVersion, protocol, channel, version: requestedVersion }) {
    const releases = [];
    for (let page = 1; page <= 10; page++) {
      const batch = JSON.parse(await this.download(`https://api.github.com/repos/${this.repository}/releases?per_page=30&page=${page}`));
      if (!Array.isArray(batch)) fail('Invalid release response');
      releases.push(...batch);
      if (batch.length < 30) break;
      if (page === 10) fail('Release history exceeds search limit');
    }
    const candidates = releases.filter(r => !r.draft && (channel === 'prerelease' || !r.prerelease)
      && r.tag_name?.startsWith('ds-group-v') && cleanVersion(r.tag_name.slice(10)) === r.tag_name.slice(10)
      && newer(r.tag_name.slice(10), currentVersion)
      && r.assets?.some(a => a.name === 'server-update.json') && r.assets?.some(a => a.name === 'SHA256SUMS'))
      .sort((a, b) => newer(a.tag_name.slice(10), b.tag_name.slice(10)) ? -1 : 1);
    if (!candidates.length) return null;
    const manifests = Array.from({ length: candidates.length });
    let index = 0;
    // Bound concurrent asset requests while checking every possible intermediate release.
    await Promise.all(Array.from({ length: Math.min(4, candidates.length) }, async () => {
      while (index < candidates.length) {
        const next = index++;
        manifests[next] = await this.manifest(candidates[next]);
      }
    }));
    const eligible = manifest => manifest.nodeProtocol === protocol && manifest.fromVersions.includes(currentVersion);
    const target = manifest => ({ ...manifest, eligible: eligible(manifest), reason: eligible(manifest) ? null : 'compatibility' });
    // Installation resolves the requested release afresh and only accepts a direct edge.
    if (requestedVersion !== undefined) {
      const requested = manifests.find(manifest => manifest.version === requestedVersion);
      return requested ? target(requested) : null;
    }
    // Breadth-first search chooses the shortest tested path to the newest reachable release.
    // Descending neighbors prefer the newer first hop when paths have equal length.
    const paths = new Map([[currentVersion, []]]), queue = [currentVersion];
    for (let position = 0; position < queue.length; position++) {
      const source = queue[position];
      for (const manifest of manifests) {
        if (manifest.nodeProtocol !== protocol || !newer(manifest.version, source)
          || !manifest.fromVersions.includes(source) || paths.has(manifest.version)) continue;
        paths.set(manifest.version, [...paths.get(source), manifest.version]);
        queue.push(manifest.version);
      }
    }
    const reachable = manifests.find(manifest => paths.has(manifest.version));
    const route = reachable ? paths.get(reachable.version) : [];
    const recommended = manifests.find(manifest => manifest.version === route[0]) || manifests[0];
    return { ...target(recommended), latestVersion: manifests[0].version, path: route,
      options: manifests.filter(eligible).map(target) };
  }
}
