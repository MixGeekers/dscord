import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { changedFiles, classifyChanges } from '../scripts/ci-scope.mjs';
import { checkDocuments } from '../scripts/ci-docs.mjs';

const scope = (...files) => classifyChanges(files.map(file => `apps/ds-group/${file}`));

test('documentation and unrelated changes keep the fixed CI entry lightweight', () => {
  assert.deepEqual(scope('deploy/releasing.md'), { code: false, browser: false, runtime: false, deploy: false, packaging: false, docs: true });
  assert.equal(classifyChanges(['README.md']).docs, true);
  assert.equal(classifyChanges(['plugins/shiyu/index.mjs']).code, false);
  assert.equal(scope('assets/readme/hero.png').code, false);
  assert.equal(scope('vendor/ds-bot/src/office/skills/office/SKILL.md').runtime, true);
});

test('frontends, native runtime, deployment and packaging select the relevant integration suites', () => {
  assert.deepEqual(scope('web/src/app.tsx'), { code: true, browser: true, runtime: false, deploy: false, packaging: false, docs: false });
  assert.equal(scope('dsh-connect/client/index.tsx').browser, true);
  assert.equal(scope('dsh-connect/client/index.tsx').runtime, false);
  assert.equal(scope('memory/snapshot-context.mjs').runtime, true);
  assert.equal(scope('src/node-store.mjs').runtime, true);
  assert.equal(scope('dsh-connect/kernel-runtime.mjs').runtime, true);
  assert.equal(scope('tests/memory-snapshot.runtime.mjs').runtime, true);
  assert.equal(scope('deploy/compose.yaml').deploy, true);
  assert.equal(scope('central/service.mjs').deploy, true);
  assert.equal(scope('scripts/npm-pack.mjs').packaging, true);
  assert.equal(scope('tests/mentions.test.mjs').code, true);
  assert.equal(scope('tests/mentions.test.mjs').browser, false);
  const combined = scope('web/src/app.tsx', 'memory/store.mjs', 'Dockerfile', 'bin/dscord.mjs');
  for (const key of ['code', 'browser', 'runtime', 'deploy', 'packaging']) assert.equal(combined[key], true);
  for (const files of [['package-lock.json'], ['scripts/ci-scope.mjs']]) {
    assert.deepEqual(scope(...files), combined);
  }
  assert.deepEqual(classifyChanges(['.github/workflows/ds-group-release.yml']), combined);
});

test('PR changes use the merge base, pushes use both endpoints and renames keep both paths', async () => {
  const base = 'a'.repeat(40), head = 'b'.repeat(40);
  let args;
  const run = async (binary, input) => { assert.equal(binary, 'git'); args = input; return { stdout: 'apps/ds-group/memory/old.mjs\0apps/ds-group/src/new.mjs\0' }; };
  const result = await changedFiles({ root: '/repo', event: { pull_request: { base: { sha: base }, head: { sha: head } } }, eventName: 'pull_request', run });
  assert.ok(args.includes(`${base}...${head}`));
  assert.ok(args.includes('--no-renames'));
  assert.equal(classifyChanges(result.files).runtime, true);
  await changedFiles({ root: '/repo', event: { before: base }, eventName: 'push', sha: head, run });
  assert.deepEqual(args.slice(-3), [base, head, '--']);
  assert.equal((await changedFiles({ event: {}, eventName: 'workflow_dispatch' })).full, true);
  assert.equal((await changedFiles({ event: { before: '0'.repeat(40) }, eventName: 'push', sha: head })).full, true);
  await assert.rejects(changedFiles({ event: { before: base }, eventName: 'push', sha: head, run: async () => { throw Error('missing history'); } }), /missing history/);
});

test('lightweight document checks find broken local links and ignore URLs, code and deletions', async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dscord-ci-docs-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'guides'));
  await writeFile(path.join(root, 'guides/目标.md'), '# target');
  const valid = '[Local](<guides/目标.md#anchor>) [URL](https://example.com)\n```sh\n[example](missing.md)\n```\n`[inline](missing.md)`';
  await writeFile(path.join(root, 'README.md'), valid);
  assert.deepEqual(await checkDocuments({ root, files: ['README.md', 'deleted.md'] }), { checked: 1 });
  await writeFile(path.join(root, 'README.md'), '[Broken](guides/missing.md)');
  await assert.rejects(checkDocuments({ root, files: ['README.md'] }), /missing local link/);
});
