import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ServerReleases } from '../src/server-update-release.mjs';

const v = number => `0.4.0-alpha.${number}`;
function source(edges, { pages, corrupt } = {}) {
  const manifests = Object.entries(edges).map(([number, from]) => ({ schemaVersion: 1, version: v(number),
    fromVersions: from.map(v), deploymentContract: 1, nodeProtocol: number === '99' ? '2.0' : '1.0',
    rollbackCompatible: true, image: `ghcr.io/mixgeekers/ds-group@sha256:${'a'.repeat(64)}` }));
  const releases = manifests.map(manifest => ({ tag_name: `ds-group-v${manifest.version}`, prerelease: true,
    assets: [{ name: 'server-update.json' }, { name: 'SHA256SUMS' }] }));
  const requests = [];
  const resolver = new ServerReleases({ fetchImpl: async url => {
    requests.push(url);
    if (url.includes('api.github.com')) return new Response(JSON.stringify(pages ? pages[Number(new URL(url).searchParams.get('page')) - 1] || [] : releases));
    const version = url.split('/').at(-2).slice(10);
    const raw = JSON.stringify(manifests.find(manifest => manifest.version === version));
    return new Response(url.endsWith('SHA256SUMS')
      ? `${version === corrupt ? '0'.repeat(64) : createHash('sha256').update(raw).digest('hex')}  server-update.json\n` : raw);
  } });
  const check = (current = 4, extra = {}) => resolver.check({ currentVersion: v(current), protocol: '1.0', channel: 'prerelease', ...extra });
  return { check, resolver, releases, requests };
}

test('successive checks follow 4 → 5 → 6 → 7 without skipping a declared edge', async () => {
  const { check } = source({ 5: [4], 6: [5], 7: [6] });
  for (const current of [4, 5, 6]) {
    const result = await check(current);
    assert.equal(result.version, v(current + 1));
    assert.equal(result.latestVersion, v(7));
    assert.deepEqual(result.path, Array.from({ length: 7 - current }, (_, i) => v(current + i + 1)));
    assert.deepEqual(result.options.map(option => option.version), [v(current + 1)]);
    assert.equal(result.eligible, true);
  }
  assert.equal(await check(7), null);
});

test('recommendation reaches the newest reachable release, offers direct alternatives and accepts an explicit choice', async () => {
  const { check } = source({ 5: [4], 6: [4], 7: [5], 8: [7], 9: [2], 99: [4, 8] });
  const result = await check();
  assert.equal(result.version, v(5));
  assert.equal(result.latestVersion, v(99));
  assert.deepEqual(result.path, [v(5), v(7), v(8)]);
  assert.deepEqual(result.options.map(option => option.version), [v(6), v(5)]);
  assert.equal((await check(4, { version: v(6) })).eligible, true);
  for (const number of [7, 9, 99]) assert.equal((await check(4, { version: v(number) })).eligible, false);
  assert.equal(await check(4, { version: v(100) }), null);
  assert.equal(await check(4, { channel: 'stable' }), null);
});

test('shortest paths prefer a newer first hop and reject missing or backward edges', async () => {
  assert.deepEqual((await source({ 5: [4], 6: [4], 7: [5, 6], 8: [7] }).check()).path, [v(6), v(7), v(8)]);
  const missing = await source({ 5: [6], 6: [5] }).check();
  assert.equal(missing.eligible, false);
  assert.deepEqual(missing.options, []);
  assert.deepEqual(missing.path, []);
});

test('intermediate releases on later API pages are included and every manifest is verified', async () => {
  const feed = source({ 5: [4], 6: [5] });
  const { check, requests } = source({ 5: [4], 6: [5] }, { pages: [
    [feed.releases[1], ...Array.from({ length: 29 }, () => ({ draft: true }))], [feed.releases[0]],
  ] });
  assert.deepEqual((await check()).path, [v(5), v(6)]);
  assert.ok(requests.some(url => url.endsWith('page=2')));
  await assert.rejects(source({ 5: [4], 6: [5] }, { corrupt: v(5) }).check(), /checksum/);
});
