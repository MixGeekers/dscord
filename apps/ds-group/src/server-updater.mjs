import { mkdir, readFile, writeFile, rename, rm, chmod, chown, stat, open } from 'node:fs/promises';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { ServerReleases } from './server-update-release.mjs';
import { UpdateDocker } from './server-update-docker.mjs';

const execute = promisify(execFile);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const running = new Set(['queued', 'pulling', 'draining', 'backing-up', 'installing', 'verifying', 'rolling-back']);
const failure = (status, message) => Object.assign(new Error(message), { status });
const optional = async filename => {
  try { return JSON.parse(await readFile(filename, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; return null; }
};
async function atomic(filename, value, mode = 0o600) {
  const temp = `${filename}.${randomUUID()}.tmp`;
  const file = await open(temp, 'wx', mode);
  try { await file.writeFile(JSON.stringify(value, null, 2) + '\n'); await file.sync(); }
  finally { await file.close(); }
  await rename(temp, filename);
  const directory = await open(path.dirname(filename), 'r');
  try { await directory.sync(); } finally { await directory.close(); }
}
export function updateWindow(settings, now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: settings.timeZone }).format(now));
  return settings.windowStart < settings.windowEnd ? hour >= settings.windowStart && hour < settings.windowEnd
    : hour >= settings.windowStart || hour < settings.windowEnd;
}
export function updateSettings(previous, input) {
  const next = { ...previous };
  for (const field of ['policy', 'channel', 'windowStart', 'windowEnd', 'timeZone']) if (Object.hasOwn(input, field)) next[field] = input[field];
  if (!['manual', 'notify', 'auto'].includes(next.policy) || !['stable', 'prerelease'].includes(next.channel)
    || ![next.windowStart, next.windowEnd].every(n => Number.isInteger(n) && n >= 0 && n <= 23)
    || next.windowStart === next.windowEnd || typeof next.timeZone !== 'string') throw failure(400, 'Invalid update settings');
  try { new Intl.DateTimeFormat('en', { timeZone: next.timeZone }).format(); }
  catch { throw failure(400, 'Invalid update time zone'); }
  return next;
}

/** A durable, single-project application update. Synapse and central versions never change here.
 * Rollback only changes programs; it never restores a stale database over accepted writes. */
export class ServerUpdater {
  constructor({ directory = '/updates', control = '/run/dscord-updater', engine = new UpdateDocker(),
    releases = new ServerReleases(), fetchImpl = fetch, project, snapshot, wait = sleep,
    drainTimeout = 120000, readyTimeout = 120000 } = {}) {
    Object.assign(this, { directory, control, engine, releases, fetchImpl, project, wait, drainTimeout, readyTimeout });
    this.snapshot = snapshot || (job => this.backup(job));
    this.state = { schemaVersion: 1, settings: { policy: 'notify', channel: 'stable', windowStart: 3, windowEnd: 5, timeZone: 'UTC' },
      currentVersion: null, checkedAt: null, available: null, checkError: null, job: null, history: [], blockedVersions: [] };
    this.saving = Promise.resolve();
    this.busy = false;
  }
  async initialize() {
    await mkdir(this.directory, { recursive: true, mode: 0o755 });
    await chmod(this.directory, 0o755);
    await mkdir(this.control, { recursive: true, mode: 0o750 });
    await chmod(this.control, 0o750);
    // The app runs as node (gid 1000); only the control volume is shared with it.
    if (process.getuid?.() === 0) await chown(this.control, 0, 1000);
    try { this.token = (await readFile(path.join(this.control, 'token'), 'utf8')).trim(); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      this.token = randomBytes(32).toString('hex');
      await writeFile(path.join(this.control, 'token'), this.token, { flag: 'wx', mode: 0o640 });
      if (process.getuid?.() === 0) await chown(path.join(this.control, 'token'), 0, 1000);
    }
    const saved = await optional(path.join(this.directory, 'state.json'));
    if (saved) {
      if (saved.schemaVersion !== 1) throw new Error('Unsupported updater state');
      this.state = saved;
      this.state.settings = updateSettings(this.state.settings, {});
    }
    this.project ||= await this.engine.project();
    if (this.state.job && running.has(this.state.job.phase)) {
      this.busy = true;
      try { await this.rollback(this.state.job, 'Update interrupted; restored the previous containers'); }
      catch { /* Keep maintenance and the recovery record for an operator. */ }
      finally { this.busy = false; }
    } else if (this.state.job?.phase === 'succeeded') await this.clearGate(this.state.job.id);
    return this;
  }
  save() {
    this.saving = this.saving.catch(() => {}).then(() => atomic(path.join(this.directory, 'state.json'), this.state));
    return this.saving;
  }
  view() {
    const job = value => value ? Object.fromEntries(['id', 'phase', 'version', 'previousVersion', 'startedAt', 'finishedAt', 'error', 'backup', 'steps'].map(key => [key, value[key]])) : null;
    return { enabled: true, currentVersion: this.state.currentVersion, settings: this.state.settings,
      checkedAt: this.state.checkedAt, available: this.state.available, checkError: this.state.checkError,
      job: job(this.state.job), history: this.state.history.map(job) };
  }
  async configure(input) {
    if (this.busy || running.has(this.state.job?.phase)) throw failure(409, 'An update is already running');
    this.state.settings = updateSettings(this.state.settings, input);
    this.state.channelInitialized = true;
    await this.save(); return this.view();
  }
  async coreStatus() {
    const response = await this.fetchImpl('http://core:18100/internal/server-update/status', {
      headers: { Authorization: `Bearer ${this.token}` }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error('Core update status is unavailable');
    return response.json();
  }
  async check() {
    if (this.busy) return this.view();
    if (this.checking) return this.checking;
    this.checking = (async () => {
      try {
        const current = await this.coreStatus();
        this.state.currentVersion = current.version;
        if (!this.state.channelInitialized) {
          this.state.settings.channel = current.version.includes('-') ? 'prerelease' : 'stable';
          this.state.channelInitialized = true;
        }
        this.state.available = await this.releases.check({ currentVersion: current.version, protocol: current.protocol, channel: this.state.settings.channel });
        this.state.checkError = null;
      } catch (error) { this.state.checkError = String(error.message).slice(0, 500); this.state.available = null; }
      this.state.checkedAt = Date.now(); await this.save();
      return this.view();
    })().finally(() => { this.checking = null; });
    return this.checking;
  }
  async apply(version) {
    if (this.busy || running.has(this.state.job?.phase) || this.state.job?.phase === 'needs-attention') throw failure(409, 'Resolve the current update before starting another');
    // Reserve the single execution slot before the first await, including fresh release resolution.
    this.busy = true;
    try {
      const current = await this.coreStatus();
      const target = await this.releases.check({ currentVersion: current.version, protocol: current.protocol, channel: this.state.settings.channel });
      if (!target?.eligible || version !== target.version) throw failure(409, 'No compatible update is available; check updates again');
      this.state.currentVersion = current.version;
      // Leave room to record recovery even if a snapshot fills its filesystem.
      await writeFile(path.join(this.directory, 'recovery-reserve'), Buffer.alloc(1024 * 1024), { mode: 0o600 });
      const job = { id: randomUUID(), version: target.version, previousVersion: current.version,
        phase: 'queued', startedAt: Date.now(), error: null, steps: [], backup: 'pending', target,
        transaction: { originals: [], previousOverride: await optional(path.join(this.directory, 'current.compose.json')) } };
      this.state.job = job;
      await this.save();
      this.work = this.run(job).finally(() => { this.busy = false; });
      return this.view();
    } catch (error) { this.busy = false; throw error; }
  }
  async phase(job, phase) {
    job.phase = phase; job.steps.push({ phase, at: Date.now() });
    await this.save();
  }
  async gate(job, phase) {
    await atomic(path.join(this.control, 'maintenance.json'), { id: job.id, phase, startedAt: job.startedAt }, 0o644);
  }
  async clearGate(id) {
    const gate = await optional(path.join(this.control, 'maintenance.json'));
    if (gate?.id === id) await rm(path.join(this.control, 'maintenance.json'), { force: true });
  }
  async until(check, timeout, message) {
    const deadline = Date.now() + timeout;
    do {
      if (await check()) return;
      await this.wait(1000);
    } while (Date.now() < deadline);
    throw new Error(message);
  }
  async originals() {
    const all = await this.engine.containers(this.project);
    const result = [];
    for (const service of ['core', 'administration', 'synapse']) {
      const matches = all.filter(c => c.State === 'running' && c.Labels?.['com.docker.compose.service'] === service && c.Labels?.['com.docker.compose.oneoff'] !== 'True');
      if (matches.length !== 1) throw new Error(`Updater requires one ${service} container`);
      const container = await this.engine.inspect(matches[0].Id);
      if (!container.State.Running || container.HostConfig.AutoRemove || container.HostConfig.NetworkMode?.startsWith('container:')) throw new Error(`Unsupported ${service} container configuration`);
      result.push({ service, container });
    }
    return result;
  }
  async run(job) {
    try {
      job.transaction.originals = await this.originals();
      await this.phase(job, 'pulling');
      await this.engine.pull(job.target.image);
      await this.gate(job, 'draining');
      await this.phase(job, 'draining');
      await this.until(async () => {
        const status = await this.coreStatus();
        return status.maintenanceId === job.id && status.drained === true;
      }, this.drainTimeout, 'Tasks or older Bot nodes did not become idle; update deferred');
      await this.phase(job, 'backing-up');
      job.transaction.stopping = true; await this.save();
      // All data writers in these three volumes stop before the cold snapshot.
      for (const { container } of job.transaction.originals) await this.engine.stop(container.Id);
      await this.snapshot(job);
      job.backup = 'complete'; await this.save();
      await this.gate(job, 'verifying');
      await this.phase(job, 'installing');
      const synapse = job.transaction.originals.find(o => o.service === 'synapse').container;
      await this.engine.start(synapse.Id);
      for (const { service, container } of job.transaction.originals.filter(o => o.service !== 'synapse')) {
        await this.engine.rename(container.Id, `${container.Name}-previous-${job.id}`);
        await this.engine.replace(container, job.target.image, job.id);
        job.steps.push({ phase: 'started', service, at: Date.now() }); await this.save();
      }
      await this.phase(job, 'verifying');
      await this.verify(job.version, job.id);
      // Future Compose invocations use this last overlay, including one-shot setup services.
      await atomic(path.join(this.directory, 'current.compose.json'), { services: Object.fromEntries(
        ['core', 'administration', 'config', 'bootstrap'].map(service => [service, { image: job.target.image }])) }, 0o644);
      this.state.currentVersion = job.version;
      this.state.available = null; this.state.checkedAt = null; this.state.checkError = null;
      await this.finish(job, 'succeeded');
      await this.clearGate(job.id);
      for (const { service, container } of job.transaction.originals) if (service !== 'synapse') {
        await this.engine.remove(container.Id).catch(() => {});
      }
    } catch (error) {
      this.state.blockedVersions = [...new Set([...this.state.blockedVersions, job.version])].slice(-30);
      try { await this.rollback(job, String(error.message).slice(0, 500)); }
      catch { /* rollback persisted needs-attention and retained the maintenance gate */ }
    }
  }
  async verify(version, maintenanceId) {
    await this.until(async () => {
      try {
        const status = await this.coreStatus();
        const ready = await this.fetchImpl('http://core:18100/readyz', { signal: AbortSignal.timeout(4000) });
        const admin = await this.fetchImpl('http://administration:18110/healthz', { signal: AbortSignal.timeout(4000) });
        const identity = await admin.json();
        return ready.ok && admin.ok && identity.version === version && status.version === version && status.maintenanceId === maintenanceId;
      } catch { return false; }
    }, this.readyTimeout, 'Updated services did not pass readiness and version checks');
  }
  async rollback(job, reason) {
    await rm(path.join(this.directory, 'recovery-reserve'), { force: true }).catch(() => {});
    if (!job.transaction.stopping) {
      job.error = reason;
      await this.clearGate(job.id);
      await this.finish(job, 'failed');
      return;
    }
    // Recording a recovery must never be a prerequisite for restoring stopped programs.
    await this.phase(job, 'rolling-back').catch(() => {});
    try {
      // Container creation is tagged before starting, so recovery also finds a crash between create/start/save.
      const created = (await this.engine.containers(this.project)).filter(c => c.Labels?.['org.dscord.update-job'] === job.id);
      for (const container of created) await this.engine.remove(container.Id);
      for (const { container } of job.transaction.originals) {
        const current = await this.engine.inspect(container.Id);
        if (current.Name !== container.Name) await this.engine.rename(container.Id, container.Name);
        if (!current.State.Running) await this.engine.start(container.Id);
      }
      const previous = job.transaction.previousOverride;
      if (previous) await atomic(path.join(this.directory, 'current.compose.json'), previous, 0o644);
      else await rm(path.join(this.directory, 'current.compose.json'), { force: true });
      // Before any mutation (download/drain failure), the original instance is still serving.
      if (job.transaction.originals.length) {
        await this.gate(job, 'verifying').catch(() => {});
        await this.verify(job.previousVersion, job.id);
      }
      this.state.currentVersion = job.previousVersion;
      job.error = reason;
      await this.clearGate(job.id);
      await this.finish(job, 'rolled-back');
    } catch (error) {
      job.error = `${reason}; recovery failed: ${String(error.message).slice(0, 300)}`;
      job.phase = 'needs-attention';
      await this.finish(job, 'needs-attention').catch(() => {});
      throw error;
    }
  }
  async recover() {
    if (this.busy || this.state.job?.phase !== 'needs-attention') throw failure(409, 'No interrupted update requires recovery');
    this.busy = true;
    this.work = this.rollback(this.state.job, 'Operator requested recovery').catch(() => {}).finally(() => { this.busy = false; });
    return this.view();
  }
  async finish(job, phase) {
    job.phase = phase; job.finishedAt = Date.now();
    const { transaction: _transaction, target: _target, ...record } = job;
    this.state.history = [structuredClone(record), ...this.state.history.filter(old => old.id !== job.id)].slice(0, 20);
    await this.save();
  }
  async backup(job) {
    const self = await this.engine.inspect(process.env.HOSTNAME);
    for (const [name, service, destination] of [['core', 'core', '/data'], ['synapse', 'synapse', '/data'], ['governance', 'core', '/dscord-policy']]) {
      const source = job.transaction.originals.find(item => item.service === service).container.Mounts.find(mount => mount.Destination === destination);
      const mounted = self.Mounts.find(mount => mount.Destination === `/snapshot/${name}`);
      if (!source || !mounted || source.Source !== mounted.Source || source.Type !== mounted.Type) throw new Error(`Updater snapshot mount does not match ${name} data`);
    }
    const directory = path.join(this.directory, 'backups', job.id);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const files = [];
    try {
      for (const name of ['core', 'synapse', 'governance']) {
        const file = path.join(directory, `${name}.tgz`);
        await execute('tar', ['-czf', file, '-C', `/snapshot/${name}`, '.'], { timeout: 600000, maxBuffer: 1024 * 1024 });
        await chmod(file, 0o600);
        const hash = createHash('sha256');
        for await (const chunk of createReadStream(file)) hash.update(chunk);
        files.push({ name: `${name}.tgz`, bytes: (await stat(file)).size, sha256: hash.digest('hex') });
      }
      await atomic(path.join(directory, 'manifest.json'), { version: job.previousVersion, at: Date.now(), files });
    } catch (error) {
      job.backup = 'failed';
      // Only this transaction's incomplete snapshot is disposable; completed backups remain.
      await rm(directory, { recursive: true, force: true }).catch(() => {});
      throw error;
    }
  }
  async tick() {
    if (this.busy || this.state.job?.phase === 'needs-attention' || this.state.settings.policy === 'manual') return;
    if (!this.state.checkedAt || Date.now() - this.state.checkedAt >= 6 * 60 * 60 * 1000) await this.check();
    const available = this.state.available;
    if (this.state.settings.policy === 'auto' && available?.eligible && !this.state.blockedVersions.includes(available.version)
      && updateWindow(this.state.settings)) {
      try { await this.apply(available.version); }
      catch (error) {
        this.state.blockedVersions = [...new Set([...this.state.blockedVersions, available.version])].slice(-30);
        this.state.checkError = String(error.message).slice(0, 500);
        await this.save().catch(() => {});
      }
    }
  }
}
