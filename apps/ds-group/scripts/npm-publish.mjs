import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { packageRoot } from '../src/paths.mjs';
import { releaseVersion } from './release-version.mjs';

const execute = promisify(execFile);
const registry = 'https://registry.npmjs.org';
const digest = (algorithm, bytes, encoding = 'base64') => createHash(algorithm).update(bytes).digest(encoding);
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

export async function readNpmRelease(archive, { version, tag, repository }) {
  if (tag !== releaseVersion(version).npmTag) throw new Error('npm channel does not match the release version');
  if (path.basename(archive) !== `dscord-${version}.tgz`) throw new Error('Unexpected npm release filename');
  const bytes = await readFile(archive);
  const checksums = await readFile(path.join(path.dirname(archive), 'NPM-SHA256SUMS'), 'utf8');
  const expected = checksums.split('\n').find(line => line.endsWith(`  ${path.basename(archive)}`))?.split('  ')[0];
  if (expected !== digest('sha256', bytes, 'hex')) throw new Error('npm release checksum does not match the tested artifact');
  const { stdout } = await execute('tar', ['-xOf', archive, 'package/package.json'], { maxBuffer: 1024 * 1024 });
  const pkg = JSON.parse(stdout);
  if (pkg.name !== 'dscord' || pkg.version !== version || pkg.private === true) throw new Error('npm manifest does not match the release');
  if (pkg.repository?.url !== `git+https://github.com/${repository}.git`) throw new Error('npm repository does not match the publishing workflow');
  if (pkg.publishConfig?.registry?.replace(/\/$/, '') !== registry || pkg.publishConfig?.tag !== tag || pkg.publishConfig?.access !== 'public') {
    throw new Error('npm publish configuration does not match the public release');
  }
  return { name: pkg.name, version, tag, integrity: `sha512-${digest('sha512', bytes)}` };
}

async function registryVersion(version) {
  const response = await fetch(`${registry}/dscord/${encodeURIComponent(version)}`, { signal: AbortSignal.timeout(20_000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`npm version lookup failed: HTTP ${response.status}`);
  return response.json();
}

function assertRegistryIntegrity(remote, local) {
  if (remote?.name !== local.name || remote.version !== local.version || remote.dist?.integrity !== local.integrity) {
    throw new Error('Published npm version differs from the tested tarball; use a new version instead of overwriting');
  }
}

async function oidcPublish(archive, release) {
  if (process.env.GITHUB_ACTIONS !== 'true' || process.env.GITHUB_REF_TYPE !== 'tag'
    || !process.env.ACTIONS_ID_TOKEN_REQUEST_URL || !process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN) {
    throw new Error('Automatic npm publication requires a GitHub tag workflow with id-token: write');
  }
  try {
    await execute('npm', ['publish', archive, '--registry', registry, '--access', 'public', '--tag', release.tag, '--ignore-scripts', '--provenance'],
      { timeout: 180_000, maxBuffer: 4 * 1024 * 1024 });
  } catch (error) {
    throw new Error(`npm publish failed (${error.code || error.signal || 'unknown'}); check the npm trusted publisher and workflow permissions`);
  }
}

export async function publishNpm({ archive, version, tag, repository, readVersion = registryVersion, publish = oidcPublish, sleep = delay }) {
  const release = await readNpmRelease(archive, { version, tag, repository });
  const existing = await readVersion(version);
  if (existing) {
    assertRegistryIntegrity(existing, release);
    // A rerun of an older release must not move alpha/latest back from a newer version.
    return { ...release, published: false, alreadyPublished: true };
  }
  let publicationError;
  try { await publish(archive, release); }
  catch (error) { publicationError = error; }
  // Read back even after a failed CLI call: the registry may have committed before the connection failed.
  for (let attempt = 0; attempt < 10; attempt++) {
    const remote = await readVersion(version);
    if (remote) {
      assertRegistryIntegrity(remote, release);
      return { ...release, published: true, alreadyPublished: false, recoveredAfterCliError: Boolean(publicationError) };
    }
    if (publicationError) throw publicationError;
    if (attempt < 9) await sleep(2000);
  }
  throw new Error('npm publish returned without a publicly readable matching version; rerun this job to verify before retrying');
}

export async function checkRegistryInstallation(release) {
  const parent = path.join(packageRoot, '.local/npm-registry-check');
  await mkdir(parent, { recursive: true });
  const directory = await mkdtemp(path.join(parent, 'run-'));
  try {
    await execute('npm', ['install', '--prefix', directory, '--cache', path.join(directory, 'cache'), '--omit=dev', '--ignore-scripts',
      '--no-audit', '--no-fund', '--package-lock=false', '--registry', registry, `dscord@${release.version}`], { timeout: 240_000, maxBuffer: 4 * 1024 * 1024 });
    const installed = path.join(directory, 'node_modules/dscord');
    const pkg = JSON.parse(await readFile(path.join(installed, 'package.json'), 'utf8'));
    if (pkg.version !== release.version) throw new Error('Registry installation returned a different version');
    const { stdout } = await execute(process.execPath, [path.join(installed, 'bin/dscord.mjs'), '--version'], { timeout: 30_000 });
    if (stdout.trim() !== release.version) throw new Error('Installed registry CLI version does not match the release');
    return { version: pkg.version, cli: stdout.trim(), source: registry };
  } finally { await rm(directory, { recursive: true, force: true }); }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const result = await publishNpm({ archive: path.resolve('release', process.env.NPM_ARCHIVE || ''), version: process.env.VERSION,
    tag: process.env.NPM_TAG, repository: process.env.GITHUB_REPOSITORY });
  const installation = await checkRegistryInstallation(result);
  console.log(JSON.stringify({ ...result, installation }, null, 2));
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,
    `### npm registry\n\n- dscord@${result.version}: ${result.alreadyPublished ? 'existing integrity verified' : 'published and read back'}\n- Clean registry installation and CLI: passed\n- Integrity: \`${result.integrity}\`\n`);
}
