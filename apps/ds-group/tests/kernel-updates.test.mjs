import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { KernelUpdates, satisfiesRange, selectKernel } from '../dsh-connect/kernel-updates.mjs';

const release = (protocol, extra = {}) => ({ dscord: { protocol }, engines: { dsh: '>=0.2.2-rc.1 <0.3.0' }, ...extra });
const v1 = { min: '1.0', max: '1.0' };
const v1to2 = { min: '1.0', max: '2.0' };
const v2 = { min: '2.0', max: '2.0' };

test('engine ranges accept comparators, alternatives and prereleases the way DSH matches them', () => {
  assert.equal(satisfiesRange('0.2.2-rc.1', '>=0.2.2-rc.1 <0.3.0'), true);
  assert.equal(satisfiesRange('0.2.5', '>=0.2.2-rc.1 <0.3.0'), true);
  assert.equal(satisfiesRange('0.3.0-rc.1', '>=0.2.2-rc.1 <0.3.0'), true, 'prereleases take part in matching');
  assert.equal(satisfiesRange('0.3.0', '>=0.2.2-rc.1 <0.3.0'), false);
  assert.equal(satisfiesRange('0.2.1', '>=0.2.2-rc.1 <0.3.0'), false);
  assert.equal(satisfiesRange('1.4.0', '<1.0.0 || >=1.4.0'), true);
  assert.equal(satisfiesRange('1.2.0', '1.2.0'), true);
  assert.equal(satisfiesRange('1.2.0', '*'), true);
  assert.equal(satisfiesRange('1.2.0', ''), false);
  assert.equal(satisfiesRange('garbage', '*'), false);
});

test('a compatible kernel only moves forward, to the newest release that speaks the server protocol', () => {
  const packument = { versions: {
    '0.4.0': release(v1), '0.5.0': release(v1to2), '0.6.0': release(v2), '0.5.1-alpha.1': release(v1to2),
    '0.5.2': release(v1to2, { deprecated: 'broken' }),
  } };
  assert.deepEqual(selectKernel(packument, { protocol: '1.0', current: '0.4.0', currentRange: v1 }), { version: '0.5.0', protocol: v1to2 });
  assert.deepEqual(selectKernel(packument, { protocol: '1.0', current: '0.4.0', currentRange: v1, channel: 'prerelease' }), { version: '0.5.1-alpha.1', protocol: v1to2 });
  assert.equal(selectKernel(packument, { protocol: '1.0', current: '0.5.0', currentRange: v1to2 }), null, 'already on the newest compatible release');
  assert.deepEqual(selectKernel(packument, { protocol: '2.0', current: '0.5.0', currentRange: v1to2 }), { version: '0.6.0', protocol: v2 });
  assert.equal(selectKernel(packument, { protocol: null, current: '0.4.0', currentRange: v1 }), null);
});

test('an incompatible kernel moves to the best release for this server, even an older one', () => {
  const packument = { versions: { '0.4.0': release(v1), '0.5.0': release(v1to2), '0.6.0': release(v2) } };
  assert.deepEqual(selectKernel(packument, { protocol: '1.0', current: '0.6.0', currentRange: v2 }), { version: '0.5.0', protocol: v1to2 });
  assert.equal(selectKernel(packument, { protocol: '3.0', current: '0.6.0', currentRange: v2 }), null, 'no release speaks it yet');
});

test('a release built for another DSH is skipped', () => {
  const packument = { versions: { '0.4.0': release(v1), '0.5.0': release(v1, { engines: { dsh: '>=0.3.0 <0.4.0' } }) } };
  assert.equal(selectKernel(packument, { protocol: '1.0', current: '0.4.0', currentRange: v1, dshVersion: '0.2.2-rc.1' }), null);
  assert.deepEqual(selectKernel(packument, { protocol: '1.0', current: '0.4.0', currentRange: v1, dshVersion: '0.3.1' }), { version: '0.5.0', protocol: v1 });
});

function host({ bundles = [{ name: 'dscord', source: '^0.4.0' }], install } = {}) {
  const calls = [];
  const manager = {
    listBundles: () => bundles,
    registries: () => ({ registry: 'https://registry.test/' }),
    installBundle: async (spec, options) => { calls.push(['install', spec, options.registry]); return install ? install(spec, calls) : { application: 'applied' }; },
    removeBundle: async name => { calls.push(['remove', name]); return {}; },
  };
  const loader = { import: async () => ({ getDshRuntimeVersion: () => '0.2.2-rc.1' }), unwrapExports: value => value };
  const ctx = { get: name => ({ pluginManager: manager, loader })[name] };
  return { ctx, calls };
}

async function updates(t, options = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'kernel-updates-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const { ctx, calls } = host(options);
  const packument = { versions: { '0.4.0': release(v1), '0.5.0': release(v1) } };
  const fetched = [];
  const fetchImpl = async url => { fetched.push(String(url)); return new Response(JSON.stringify(packument)); };
  const service = await new KernelUpdates({ ctx, directory, current: '0.4.0', currentRange: v1, fetchImpl, startTimers: false,
    isIdle: () => options.idle ?? true }).initialize();
  t.after(() => service.dispose());
  return { service, calls, fetched, directory };
}

const settle = () => new Promise(resolve => setTimeout(resolve, 10));

test('under the default policy a newer release is only shown, and the owner installs it', async t => {
  const { service, calls, fetched } = await updates(t);
  service.observeProtocol('1.0');
  const view = await service.check({ fresh: true });
  assert.equal(fetched[0], 'https://registry.test/dscord');
  assert.equal(view.policy, 'notify');
  assert.equal(view.available, '0.5.0');
  assert.equal(view.source, 'registry');
  assert.equal(view.dsh, '0.2.2-rc.1');
  assert.deepEqual(calls, []);
  assert.equal(service.install().phase, 'installing');
  await settle();
  assert.deepEqual(calls, [['install', 'dscord@0.5.0', 'https://registry.test/']]);
  assert.equal(service.view().phase, 'installed');
});

test('the auto policy installs once the node is idle and is remembered across restarts', async t => {
  const { service, calls, directory } = await updates(t);
  await service.setPolicy({ policy: 'auto' });
  assert.deepEqual(JSON.parse(await readFile(path.join(directory, 'kernel-updates.json'), 'utf8')), { policy: 'auto', channel: 'stable' });
  service.observeProtocol('1.0');
  await settle(); await service.check(); await settle();
  assert.deepEqual(calls, [['install', 'dscord@0.5.0', 'https://registry.test/']]);
  await assert.rejects(service.setPolicy({ policy: 'sometimes' }));
});

test('a busy node waits before an automatic install', async t => {
  const { service, calls } = await updates(t, { idle: false });
  await service.setPolicy({ policy: 'auto' });
  service.observeProtocol('1.0');
  await settle(); await service.check(); await settle();
  assert.deepEqual(calls, []);
  assert.equal(service.view().available, '0.5.0');
});

test('a plugin that was not installed from npm is never moved', async t => {
  const { service, calls } = await updates(t, { bundles: [{ name: 'dscord', source: 'file:../dscord' }] });
  service.observeProtocol('1.0');
  await service.check({ fresh: true });
  assert.equal(service.view().source, 'path');
  assert.throws(() => service.install(), /手动安装/);
  assert.deepEqual(calls, []);
});

test('under hot reload the bundle is removed and reinstalled, and a failed upgrade puts the running version back', async t => {
  const { service, calls } = await updates(t, { install: (spec, calls) => {
    const installs = calls.filter(call => call[0] === 'install').length;
    if (installs === 1) return { error: { code: 'already-installed' } };
    return spec === 'dscord@0.5.0' ? { error: { code: 'network', diagnostic: 'registry unreachable' } } : { application: 'applied' };
  } });
  service.observeProtocol('1.0');
  await service.check({ fresh: true });
  service.install();
  await settle();
  assert.deepEqual(calls, [['install', 'dscord@0.5.0', 'https://registry.test/'], ['remove', 'dscord'],
    ['install', 'dscord@0.5.0', 'https://registry.test/'], ['install', 'dscord@0.4.0', 'https://registry.test/']]);
  assert.equal(service.view().phase, 'failed');
  assert.equal(service.view().error, 'registry unreachable');
});

test('under the manual policy nothing is looked up until the owner checks', async t => {
  const { service, fetched } = await updates(t);
  await service.setPolicy({ policy: 'manual' });
  const before = fetched.length;
  service.observeProtocol('1.0', { compatible: false });
  await settle();
  assert.equal(fetched.length, before);
  assert.equal((await service.check({ fresh: true })).available, '0.5.0');
  assert.equal(fetched.length, before + 1);
});
