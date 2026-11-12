import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { publishImageIndex, verifyImageIndex } from '../scripts/release-image.mjs';

test('image publication reuses a matching index and refuses missing architectures or different bytes', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'dscord-image-publish-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const candidates = ['a'.repeat(64), 'b'.repeat(64)];
  for (const digest of candidates) await writeFile(path.join(directory, digest), '');
  const manifests = ['amd64', 'arm64'].map((architecture, i) => ({ digest: `sha256:${String(i + 1).repeat(64)}`, platform: { os: 'linux', architecture } }));
  const state = { index: null, creates: 0 };
  const run = async (binary, args) => {
    assert.equal(binary, 'docker');
    if (args[2] === 'create') { state.creates++; state.index = { manifests }; return { stdout: '' }; }
    if (args.includes('--format')) return { stdout: `sha256:${'c'.repeat(64)}\n` };
    const source = candidates.findIndex(digest => args[3].endsWith(digest));
    if (source >= 0) return { stdout: JSON.stringify({ manifests: [manifests[source]] }) };
    if (!state.index) throw Object.assign(Error('missing'), { stderr: 'manifest unknown' });
    return { stdout: JSON.stringify(state.index) };
  };
  const outputRoot = await mkdtemp(path.join(os.tmpdir(), 'dscord-image-index-'));
  t.after(() => rm(outputRoot, { recursive: true, force: true }));
  const options = { directory, output: path.join(outputRoot, 'image-index.json'), image: 'ghcr.io/mixgeekers/ds-group', version: '0.4.0-alpha.99', run };
  assert.equal((await publishImageIndex(options)).alreadyPublished, false);
  const first = await readFile(options.output, 'utf8');
  assert.equal((await publishImageIndex(options)).alreadyPublished, true);
  assert.equal(await readFile(options.output, 'utf8'), first);
  assert.equal(state.creates, 1);
  state.index = { manifests: [{ ...manifests[0], digest: 'sha256:different' }, manifests[1]] };
  await assert.rejects(publishImageIndex(options), /no tag was overwritten/);
  assert.equal(state.creates, 1);
  assert.throws(() => verifyImageIndex({ manifests: [manifests[0]] }), /arm64/);
});
