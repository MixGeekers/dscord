import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { publishGithubRelease } from '../scripts/github-release.mjs';

async function fixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'dscord-github-publish-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const version = '0.4.0-alpha.99', tag = `ds-group-v${version}`, repository = 'MixGeekers/dscord';
  const names = [`ds-group-${version}-source.tar.gz`, `dscord-${version}.tgz`, 'release-manifest.json', 'SHA256SUMS', 'NPM-SHA256SUMS', 'image-index.json'];
  for (const name of names) await writeFile(path.join(directory, name), `synthetic ${name}`);
  const state = { exists: false, draft: true, assets: new Map(), uploads: [], creates: 0, fail: null };
  const run = async (binary, args) => {
    assert.equal(binary, 'gh');
    assert.deepEqual(args.slice(-2), ['--repo', repository]);
    const action = args[1];
    if (action === 'view') {
      if (!state.exists) throw Object.assign(Error('not found'), { stderr: 'release not found' });
      return { stdout: JSON.stringify({ isDraft: state.draft, url: 'https://github.com/MixGeekers/dscord/releases/synthetic', assets: [...state.assets.keys()].map(name => ({ name })) }) };
    }
    if (action === 'create') {
      assert.ok(args.includes('--draft'));
      assert.ok(args.includes('--verify-tag'));
      state.exists = true; state.creates++;
    } else if (action === 'upload') {
      const name = path.basename(args[3]);
      if (state.fail === name) throw Error('interrupted upload');
      assert.equal(state.assets.has(name), false, 'existing assets are never clobbered');
      state.assets.set(name, await readFile(args[3])); state.uploads.push(name);
    } else if (action === 'download') {
      const name = args[args.indexOf('--pattern') + 1], output = args[args.indexOf('--dir') + 1];
      await writeFile(path.join(output, name), state.assets.get(name));
    } else if (action === 'edit') { assert.ok(args.includes('--draft=false')); state.draft = false; }
    else assert.fail(`unexpected gh operation ${action}`);
    return { stdout: '' };
  };
  return { directory, version, tag, repository, state, names, run };
}

test('GitHub assets are uploaded into a draft, verified and then made public; reruns do not upload again', async t => {
  const f = await fixture(t);
  const result = await publishGithubRelease(f);
  assert.equal(result.assets.length, f.names.length);
  assert.equal(f.state.draft, false);
  await publishGithubRelease(f);
  assert.equal(f.state.creates, 1);
  assert.equal(f.state.uploads.length, f.names.length);
});

test('an interrupted GitHub asset upload resumes the same draft and preserves already uploaded files', async t => {
  const f = await fixture(t);
  f.state.fail = 'image-index.json';
  await assert.rejects(publishGithubRelease(f), /interrupted upload/);
  assert.equal(f.state.draft, true);
  assert.ok(f.state.uploads.length > 0);
  f.state.fail = null;
  await publishGithubRelease(f);
  assert.equal(f.state.creates, 1);
  assert.equal(f.state.uploads.length, f.names.length);
  assert.equal(f.state.draft, false);
});

test('a mismatched existing asset stops publication without replacement', async t => {
  const f = await fixture(t);
  f.state.exists = true;
  f.state.assets.set('NPM-SHA256SUMS', Buffer.from('different bytes'));
  await assert.rejects(publishGithubRelease(f), /asset differs: NPM-SHA256SUMS/);
  assert.equal(f.state.draft, true);
  assert.deepEqual(f.state.uploads, []);
});

test('lookup failures are not treated as a missing release', async t => {
  const f = await fixture(t);
  await assert.rejects(publishGithubRelease({ ...f, run: async () => { throw Error('network unavailable'); } }), /network unavailable/);
  assert.equal(f.state.creates, 0);
});
