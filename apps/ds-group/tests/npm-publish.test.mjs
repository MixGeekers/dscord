import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { createTar } from '../scripts/release-pack.mjs';
import { publishNpm, readNpmRelease } from '../scripts/npm-publish.mjs';

async function fixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'dscord-npm-publish-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const version = '0.4.0-alpha.99', tag = 'alpha', repository = 'MixGeekers/dscord';
  const pkg = { name: 'dscord', version, repository: { url: `git+https://github.com/${repository}.git` },
    publishConfig: { access: 'public', registry: 'https://registry.npmjs.org', tag } };
  const bytes = gzipSync(createTar([{ path: 'package/package.json', bytes: Buffer.from(JSON.stringify(pkg)) }]));
  const archive = path.join(directory, `dscord-${version}.tgz`);
  await writeFile(archive, bytes);
  await writeFile(path.join(directory, 'NPM-SHA256SUMS'), `${createHash('sha256').update(bytes).digest('hex')}  ${path.basename(archive)}\n`);
  const remote = { name: 'dscord', version, dist: { integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}` } };
  return { archive, version, tag, repository, remote };
}

test('first publication sends the exact tested tarball and confirms registry integrity', async t => {
  const f = await fixture(t);
  let published = false, reads = 0;
  const result = await publishNpm({ ...f, readVersion: async () => ++reads > 2 ? f.remote : null,
    publish: async (archive, release) => { assert.equal(archive, f.archive); assert.equal(release.tag, 'alpha'); published = true; }, sleep: async () => {} });
  assert.equal(published, true);
  assert.equal(result.published, true);
  assert.equal(result.integrity, f.remote.dist.integrity);
  assert.equal(reads, 3, 'a short registry visibility delay is allowed without publishing twice');
});

test('a rerun verifies existing bytes and does not republish or change a distribution tag', async t => {
  const f = await fixture(t);
  const result = await publishNpm({ ...f, readVersion: async () => f.remote, publish: async () => { assert.fail('must not republish'); } });
  assert.equal(result.alreadyPublished, true);
  await assert.rejects(publishNpm({ ...f, readVersion: async () => ({ ...f.remote, dist: { integrity: 'sha512-different' } }) }), /differs from the tested tarball/);
});

test('checksum, channel and repository mismatches stop before any publication', async t => {
  const f = await fixture(t);
  await assert.rejects(readNpmRelease(f.archive, { ...f, tag: 'latest' }), /channel/);
  await assert.rejects(readNpmRelease(f.archive, { ...f, repository: 'Other/fork' }), /repository/);
  await writeFile(f.archive, 'modified');
  await assert.rejects(publishNpm({ ...f, readVersion: async () => { assert.fail('must verify local bytes first'); } }), /checksum/);
});

test('a CLI error after the registry committed is recovered by reading the version back', async t => {
  const f = await fixture(t);
  let reads = 0;
  const result = await publishNpm({ ...f, readVersion: async () => ++reads === 1 ? null : f.remote,
    publish: async () => { throw Error('connection lost after upload'); } });
  assert.equal(result.recoveredAfterCliError, true);
});

test('registry outages and rejected publications are failures, not permission to overwrite', async t => {
  const f = await fixture(t);
  await assert.rejects(publishNpm({ ...f, readVersion: async () => { throw Error('HTTP 503'); }, publish: async () => assert.fail('lookup failed') }), /503/);
  await assert.rejects(publishNpm({ ...f, readVersion: async () => null, publish: async () => { throw Error('OIDC rejected'); } }), /OIDC rejected/);
  await assert.rejects(publishNpm({ ...f, readVersion: async () => null, publish: async () => {}, sleep: async () => {} }), /without a publicly readable/);
});
