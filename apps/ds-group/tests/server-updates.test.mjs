import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { ServerUpdater, updateSettings, updateWindow } from '../src/server-updater.mjs';
import { ServerReleases, validateUpdateManifest } from '../src/server-update-release.mjs';
import { serverUpdateManifest } from '../scripts/server-update-manifest.mjs';
import { createAdmin } from '../src/admin.mjs';
import { createCore } from '../src/core.mjs';
import { BotNode } from '../src/bot-node.mjs';
import { NodeStore } from '../src/node-store.mjs';
import { UpdateDocker } from '../src/server-update-docker.mjs';
import { serveUpdater } from '../scripts/server-updater.mjs';

const oldVersion = '0.4.0-alpha.3', version = '0.4.0-alpha.4';
const image = `ghcr.io/mixgeekers/ds-group@sha256:${'a'.repeat(64)}`;
const manifest = { schemaVersion: 1, version, deploymentContract: 1, nodeProtocol: '1.0', image,
  fromVersions: [oldVersion], rollbackCompatible: true };
const target = { ...manifest, eligible: true, reason: null, url: 'https://github.com/MixGeekers/dscord/releases/tag/ds-group-v0.4.0-alpha.4' };
const response = value => new Response(JSON.stringify(value), { status: 200 });

async function fixture(t, options = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dscord-update-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const operations = [];
  const containers = new Map(['core', 'administration', 'synapse'].map(service => [service, {
    Id: service, Name: `/${service}`, Config: { Image: 'old', Labels: { 'com.docker.compose.service': service } },
    HostConfig: {}, State: { Running: true }, NetworkSettings: { Networks: { test: { Aliases: [service] } } },
  }]));
  const engine = {
    async containers() { return [...containers.values()].map(c => ({ Id: c.Id, Labels: c.Config.Labels, State: c.State.Running ? 'running' : 'exited' })); },
    async inspect(id) { assert.ok(containers.has(id), `missing ${id}`); return structuredClone(containers.get(id)); },
    async pull() { operations.push('pull'); if (options.pullFails) throw new Error('download interrupted'); },
    async stop(id) { operations.push(`stop:${id}`); containers.get(id).State.Running = false; },
    async start(id) { operations.push(`start:${id}`); containers.get(id).State.Running = true; },
    async remove(id) { operations.push(`remove:${id}`); containers.delete(id); },
    async rename(id, name) { operations.push(`rename:${id}`); containers.get(id).Name = name.startsWith('/') ? name : `/${name}`; },
    async replace(original, next, id) {
      const fresh = structuredClone(original); fresh.Id += '-new'; fresh.Name = original.Name;
      fresh.Config.Image = next; fresh.Config.Labels['org.dscord.update-job'] = id; fresh.State.Running = true;
      containers.set(fresh.Id, fresh); operations.push(`replace:${original.Id}`);
      if (options.replaceFails) throw new Error('crash after container creation');
      return fresh.Id;
    },
  };
  const current = () => [...containers.values()].find(c => c.Name === '/core' && c.State.Running);
  const control = path.join(root, 'control');
  const fetchImpl = async url => {
    const fresh = current()?.Config.Image === image;
    const value = fresh ? version : oldVersion;
    if (fresh && options.unhealthy && !url.includes('/internal/')) return new Response('{}', { status: 503 });
    if (url.includes('/internal/')) {
      let gate;
      try { gate = JSON.parse(await readFile(path.join(control, 'maintenance.json'), 'utf8')); } catch {}
      return response({ version: value, protocol: '1.0', maintenanceId: gate?.id || null, drained: !options.busy });
    }
    return response({ version: value });
  };
  let backups = 0;
  const snapshot = async () => {
    backups++;
    assert.ok([...containers.values()].every(c => !c.State.Running), 'snapshot is cold');
    if (options.backupFails) throw new Error('backup disk full');
    operations.push('backup');
  };
  const params = { directory: path.join(root, 'updates'), control, project: 'test', engine, snapshot, fetchImpl,
    releases: { check: async () => target }, drainTimeout: 3, readyTimeout: 3, wait: async () => {} };
  const updater = await new ServerUpdater(params).initialize();
  return { root, params, updater, engine, containers, operations, backups: () => backups };
}

test('release resolution selects a complete compatible release and checks its exact manifest hash', async () => {
  const raw = JSON.stringify(manifest);
  const list = [
    { tag_name: `ds-group-v${version}`, prerelease: true, assets: [{ name: 'server-update.json' }, { name: 'SHA256SUMS' }] },
    { tag_name: 'ds-group-v0.4.0-alpha.99', prerelease: true, assets: [] },
  ];
  const requested = [];
  const source = new ServerReleases({ fetchImpl: async url => {
    requested.push(url);
    return new Response(url.includes('api.github.com') ? JSON.stringify(list)
      : url.endsWith('SHA256SUMS') ? `${createHash('sha256').update(raw).digest('hex')}  server-update.json\n` : raw);
  } });
  assert.equal(await source.check({ currentVersion: oldVersion, protocol: '1.0', channel: 'stable' }), null);
  assert.deepEqual(await source.check({ currentVersion: oldVersion, protocol: '1.0', channel: 'prerelease', version }), target);
  assert.equal((await source.check({ currentVersion: oldVersion, protocol: '2.0', channel: 'prerelease' })).eligible, false);
  assert.ok(requested.every(url => url.startsWith('https://api.github.com/repos/MixGeekers/dscord/') || url.startsWith('https://github.com/MixGeekers/dscord/releases/download/')));
  source.fetchImpl = async url => new Response(url.includes('api.github.com') ? JSON.stringify(list) : url.endsWith('SHA256SUMS') ? `${'0'.repeat(64)}  server-update.json` : raw);
  await assert.rejects(source.check({ currentVersion: oldVersion, protocol: '1.0', channel: 'prerelease' }), /checksum/);
});

test('release manifest rejects arbitrary images, unknown contracts and undeclared data rollback', () => {
  assert.deepEqual(validateUpdateManifest(manifest, { version }), manifest);
  for (const patch of [{ image: 'attacker/image:latest' }, { image: image + 'extra' }, { deploymentContract: 2 },
    { rollbackCompatible: false }, { fromVersions: [] }, { version: 'garbage' }]) {
    assert.throws(() => validateUpdateManifest({ ...manifest, ...patch }, { version }));
  }
  assert.deepEqual(serverUpdateManifest({ version, image, policy: { deploymentContract: 1, fromVersions: [oldVersion], rollbackCompatible: true }, repository: 'MixGeekers/dscord' }), manifest);
});

test('successful update backs up stopped writers, preserves Synapse and publishes the future Compose override', async t => {
  const f = await fixture(t);
  const started = await f.updater.apply(version);
  assert.equal(started.job.phase, 'queued');
  await assert.rejects(f.updater.apply(version), { status: 409 });
  await f.updater.work;
  assert.equal(f.updater.view().job.phase, 'succeeded');
  assert.equal(f.updater.view().currentVersion, version);
  assert.equal(f.backups(), 1);
  assert.equal(f.containers.get('synapse').Config.Image, 'old');
  assert.equal(f.operations.filter(value => value.startsWith('replace:')).length, 2);
  const override = JSON.parse(await readFile(path.join(f.params.directory, 'current.compose.json')));
  assert.deepEqual(Object.keys(override.services), ['core', 'administration', 'config', 'bootstrap']);
  assert.equal(override.services.core.image, image);
  await assert.rejects(readFile(path.join(f.params.control, 'maintenance.json')), { code: 'ENOENT' });
  assert.equal(JSON.stringify(f.updater.view()).includes('transaction'), false);
  assert.equal(JSON.stringify(f.updater.view()).includes('Labels'), false);
});

test('install revalidates the explicitly selected intermediate version and refuses a changed compatibility edge', async t => {
  const f = await fixture(t);
  const seen = [];
  f.updater.releases.check = async input => {
    seen.push(input);
    return { ...target, eligible: false };
  };
  await assert.rejects(f.updater.apply(version), { status: 409 });
  assert.equal(seen[0].version, version);
  assert.equal(f.operations.length, 0);
  assert.equal(f.updater.state.job, null);
  f.updater.releases.check = async input => {
    assert.equal(input.version, version);
    return target;
  };
  await f.updater.apply(version); await f.updater.work;
  assert.equal(f.updater.view().job.phase, 'succeeded');
});

for (const [scenario, options, phase] of [
  ['interrupted download', { pullFails: true }, 'failed'], ['busy or old node', { busy: true }, 'failed'],
  ['failed cold backup', { backupFails: true }, 'rolled-back'], ['unhealthy target', { unhealthy: true }, 'rolled-back'],
  ['crash after container creation', { replaceFails: true }, 'rolled-back'],
]) test(`${scenario} leaves the original programs and data available`, async t => {
  const f = await fixture(t, options);
  await f.updater.apply(version); await f.updater.work;
  assert.equal(f.updater.view().job.phase, phase, f.updater.view().job.error);
  assert.equal(f.updater.view().currentVersion, oldVersion);
  assert.deepEqual([...f.containers.keys()], ['core', 'administration', 'synapse']);
  assert.ok([...f.containers.values()].every(c => c.State.Running));
  assert.equal(f.updater.state.blockedVersions.includes(version), true);
  if (phase === 'failed') assert.equal(f.operations.some(value => value.startsWith('stop:')), false);
  await assert.rejects(readFile(path.join(f.params.control, 'maintenance.json')), { code: 'ENOENT' });
});

test('updater restart recovers an unfinished replacement using durable container identities', async t => {
  const f = await fixture(t);
  const originals = await f.updater.originals();
  const job = { id: 'interrupted-job', version, previousVersion: oldVersion, phase: 'installing', steps: [], startedAt: Date.now(),
    backup: 'complete', target, transaction: { originals, stopping: true, previousOverride: null } };
  f.updater.state.job = job; await f.updater.save();
  for (const { container } of originals) await f.engine.stop(container.Id);
  await f.engine.rename('core', '/core-old');
  await f.engine.replace(originals[0].container, image, job.id);
  const restarted = await new ServerUpdater(f.params).initialize();
  assert.equal(restarted.view().job.phase, 'rolled-back');
  assert.equal(f.containers.get('core').Name, '/core');
  assert.equal(f.containers.has('core-new'), false);
});

test('metadata write failure cannot prevent stopped containers from being restored', async t => {
  const f = await fixture(t);
  f.updater.snapshot = async () => {
    f.updater.save = async () => { throw new Error('Synthetic metadata filesystem full'); };
    throw new Error('Synthetic backup filesystem full');
  };
  await f.updater.apply(version); await f.updater.work;
  assert.ok([...f.containers.values()].every(container => container.State.Running));
  assert.equal(f.updater.view().job.phase, 'needs-attention');
  assert.equal(f.updater.view().currentVersion, oldVersion);
  await assert.rejects(readFile(path.join(f.params.control, 'maintenance.json')), { code: 'ENOENT' });
  await assert.rejects(f.updater.apply(version), { status: 409 });
});

test('time-zone windows support midnight and auto never loops on a failed version', async t => {
  const settings = { policy: 'auto', channel: 'stable', windowStart: 23, windowEnd: 4, timeZone: 'America/Caracas' };
  assert.equal(updateWindow(settings, new Date('2026-11-11T04:00:00Z')), true);
  assert.equal(updateWindow(settings, new Date('2026-11-11T16:00:00Z')), false);
  assert.throws(() => updateSettings(settings, { windowEnd: 23 }));
  assert.throws(() => updateSettings(settings, { timeZone: 'invalid' }));
  const f = await fixture(t);
  f.updater.state.settings = { ...settings, windowStart: 0, windowEnd: 23, timeZone: 'UTC' };
  f.updater.state.checkedAt = Date.now(); f.updater.state.available = target; f.updater.state.blockedVersions = [version];
  await f.updater.tick(); assert.equal(f.updater.state.job, null);
});

test('automatic installation uses the recommended next step rather than the latest distant release', async t => {
  const f = await fixture(t);
  const hour = new Date().getUTCHours();
  f.updater.state.settings = { ...f.updater.state.settings, policy: 'auto', windowStart: hour, windowEnd: (hour + 2) % 24 };
  f.updater.state.checkedAt = Date.now();
  f.updater.state.available = { ...target, latestVersion: '0.4.0-alpha.6', path: [version, '0.4.0-alpha.6'], options: [target] };
  await f.updater.tick();
  await f.updater.work;
  assert.equal(f.updater.state.job.version, version);
  assert.equal(f.updater.state.job.phase, 'succeeded');
});

const setup = { serverName: 'updates.test', homeserverUrl: 'http://127.0.0.1:1', participants: [], roomId: '!room:updates.test' };
test('only instance owners can request deployment changes; the public Core has no management update route', async t => {
  const f = await fixture(t); const calls = [];
  const admin = await createAdmin({ dataRoot: path.join(f.root, 'admin'), setup,
    updater: async (route, body) => { calls.push({ route, body }); return f.updater.view(); } });
  t.after(() => admin.close());
  await admin.auth.change('console', { username: 'owner', password: 'synthetic-password-123', role: 'owner', enabled: true }, { bootstrap: true });
  await admin.auth.change('owner', { username: 'operator', password: 'synthetic-password-123', role: 'operator', enabled: true });
  await new Promise(resolve => admin.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${admin.server.address().port}`;
  for (const username of ['owner', 'operator']) {
    const session = await admin.auth.login({ username, password: 'synthetic-password-123' }, 'test');
    const headers = { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
    assert.equal((await fetch(`${base}/admin-api/server-update`, { headers })).status, 200);
    assert.equal((await fetch(`${base}/admin-api/server-update/apply`, { method: 'POST', headers, body: JSON.stringify({ version }) })).status, username === 'owner' ? 202 : 403);
  }
  assert.equal(calls.filter(call => call.route === '/apply').length, 1);
  assert.equal((await fetch(`${base}/admin-api/server-update`)).status, 401);
});

test('maintenance blocks new chat writes and requires authenticated node acknowledgements before drain', async t => {
  const f = await fixture(t); const dataRoot = path.join(f.root, 'core'); await mkdir(dataRoot);
  const core = await createCore({ setup, config: { nodeSecret: 'synthetic-node-secret', modelCallLimit: null }, dataRoot,
    enablePush: false, updateControlDir: f.params.control });
  t.after(() => core.close());
  await new Promise(resolve => core.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${core.server.address().port}`;
  await f.updater.gate({ id: 'maintenance-test', startedAt: Date.now() }, 'draining');
  assert.equal((await fetch(`${base}/api/session`, { method: 'POST', body: '{}' })).status, 503);
  assert.equal((await fetch(`${base}/internal/server-update/status`)).status, 403);
  const status = await fetch(`${base}/internal/server-update/status`, { headers: { Authorization: `Bearer ${f.updater.token}` } });
  assert.equal((await status.json()).drained, true);
  assert.equal((await fetch(`${base}/admin-api/server-update`)).status, 404);
});

test('Bot node acknowledges maintenance, stops starting turns and resumes when the gate is cleared', async t => {
  const f = await fixture(t), store = new NodeStore(path.join(f.root, 'node.sqlite'), 'helper');
  t.after(() => store.close());
  let gate = { id: 'gate' }; const heartbeats = [];
  const bot = new BotNode({ participant: { id: '@helper:updates.test', localpart: 'helper' }, participants: [], roomId: '!room',
    matrix: {}, bridge: {}, store, heartbeat: async body => { heartbeats.push(body); return { maintenance: gate }; } });
  bot.state = 'idle';
  await bot.heartbeat(); assert.equal(bot.maintenance.id, 'gate');
  await bot.heartbeat(); assert.equal(heartbeats.at(-1).maintenanceId, 'gate');
  assert.equal(await bot.processOne(), false); assert.equal(await bot.processAttentionOnce(), false);
  gate = null; await bot.heartbeat(); assert.equal(bot.maintenance, null);
});

test('a turn already inside an asynchronous preparation cannot acknowledge idle during maintenance', async t => {
  const f = await fixture(t), store = new NodeStore(path.join(f.root, 'inflight.sqlite'), 'helper'); t.after(() => store.close());
  const heartbeats = [];
  const bot = new BotNode({ participant: { id: '@helper:updates.test', localpart: 'helper' }, participants: [], roomId: '!room', matrix: {}, bridge: {}, store,
    heartbeat: async body => { heartbeats.push(body); return { maintenance: { id: 'gate' } }; } });
  bot.state = 'idle'; let complete;
  bot.processOneUnpaused = () => new Promise(resolve => { complete = resolve; });
  const turn = bot.processOne(); await bot.heartbeat();
  assert.equal(heartbeats.at(-1).maintenanceBusy, true);
  complete(false); await turn; await bot.heartbeat();
  assert.equal(heartbeats.at(-1).maintenanceBusy, false);
  assert.equal(heartbeats.at(-1).maintenanceId, 'gate');
});

test('Docker replacement keeps the allocated public port, mounts, command and aliases without editing the original', async () => {
  const engine = new UpdateDocker(), requests = [];
  engine.request = async (method, route, body) => { requests.push({ method, route, body }); return { Id: 'new-container' }; };
  const original = { Id: 'a'.repeat(64), Name: '/project-core-1', Config: { Hostname: 'a'.repeat(12), Cmd: ['node', 'src/core.mjs'],
    Env: ['DS_GROUP_WEB_MODE=api-only'], Image: 'old', Labels: { 'com.docker.compose.project': 'project' } },
    HostConfig: { PortBindings: { '18100/tcp': [{ HostIp: '127.0.0.1', HostPort: '0' }] }, Binds: ['data:/data:rw'] },
    NetworkSettings: { Ports: { '18100/tcp': [{ HostIp: '127.0.0.1', HostPort: '34567' }] }, Networks: { project_default: { Aliases: ['core', 'project-core-1'] } } } };
  const before = structuredClone(original);
  await engine.replace(original, image, 'job');
  const created = requests.find(request => request.route.startsWith('/containers/create')).body;
  assert.deepEqual(created.HostConfig.PortBindings['18100/tcp'], [{ HostIp: '127.0.0.1', HostPort: '34567' }]);
  assert.deepEqual(created.HostConfig.Binds, original.HostConfig.Binds);
  assert.deepEqual(created.Cmd, original.Config.Cmd); assert.deepEqual(created.Env, original.Config.Env);
  assert.deepEqual(original, before);
});

test('a second updater cannot recover or mutate the live updater transaction', async t => {
  const f = await fixture(t);
  // Keep the Unix path below the macOS sockaddr length; production uses /run/dscord-updater.
  const control = await mkdtemp('/tmp/dscord-uds-'); t.after(() => rm(control, { recursive: true, force: true }));
  const first = new ServerUpdater({ ...f.params, control });
  const service = await serveUpdater(first, { initialize: true }); t.after(() => service.close());
  const second = new ServerUpdater({ ...f.params, control });
  second.initialize = () => { throw new Error('Must not attempt recovery'); };
  await assert.rejects(serveUpdater(second, { initialize: true }), /already running/);
  assert.equal(first.view().enabled, true);
});
