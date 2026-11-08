import path from 'node:path';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { readOptionalJson, savePrivateJson } from '../scripts/server-init.mjs';
import { KERNEL_PROTOCOL, KERNEL_VERSION, supports } from '../src/node-protocol.mjs';
import { cleanVersion, encodeName, newer, registryPlan, sourceOf } from '../vendor/ds-bot/src/host/update.js';

// Kernel upgrades follow the server's protocol, not the server's release: a node
// picks the newest DSCord plugin whose declared protocol range covers what Core
// speaks, so an old server never holds its nodes back. The owner sets the policy.

export const PACKAGE_NAME = 'dscord';
// auto installs while idle, notify checks and shows, manual checks only when the owner asks.
export const POLICIES = Object.freeze(['auto', 'notify', 'manual']);
export const CHANNELS = Object.freeze(['stable', 'prerelease']);
const APP_BOOT = '@deepseek-ai/dsh-app-boot';
const CHECK_INTERVAL_MS = 6 * 60 * 60_000;
const STARTUP_DELAY_MS = 15_000;
const IDLE_RETRY_MS = 5 * 60_000;
const FETCH_TIMEOUT_MS = 10_000;

const isPrerelease = version => cleanVersion(version)?.includes('-') ?? false;

/** Whether `version` satisfies an npm-style range made of `||` alternatives of space-separated comparators. */
export function satisfiesRange(version, range) {
  const current = cleanVersion(version);
  if (!current || typeof range !== 'string') return false;
  const test = (operator, bound) => {
    const target = cleanVersion(bound);
    if (!target) return false;
    const same = current === target;
    switch (operator) {
      case '>=': return same || newer(current, target);
      case '>': return newer(current, target);
      case '<=': return same || newer(target, current);
      case '<': return newer(target, current);
      default: return same;
    }
  };
  return range.split('||').some(alternative => {
    const parts = alternative.trim().split(/\s+/).filter(Boolean);
    if (!parts.length || parts.every(part => part === '*' || part === 'x')) return parts.length > 0;
    return parts.every(part => {
      const found = /^(>=|<=|>|<|=)?\s*(.+)$/.exec(part);
      return found ? test(found[1] ?? '=', found[2]) : false;
    });
  });
}

/**
 * Choose the plugin release to run. A compatible current kernel only moves to a
 * newer release; an incompatible one moves to the best release that works with
 * this server, even an older one, because a server that never upgrades must
 * still keep its nodes.
 */
export function selectKernel(packument, { protocol, dshVersion = null, channel = 'stable', current = KERNEL_VERSION, currentRange = KERNEL_PROTOCOL }) {
  if (!protocol) return null;
  const compatible = range => { try { return supports(range, protocol); } catch { return false; } };
  let best = null;
  for (const [key, manifest] of Object.entries(packument?.versions ?? {})) {
    const version = cleanVersion(key);
    if (!version || manifest?.deprecated) continue;
    if (channel === 'stable' && isPrerelease(version)) continue;
    if (!compatible(manifest?.dscord?.protocol)) continue;
    if (dshVersion && typeof manifest?.engines?.dsh === 'string' && !satisfiesRange(dshVersion, manifest.engines.dsh)) continue;
    if (!best || newer(version, best.version)) best = { version, protocol: manifest.dscord.protocol };
  }
  if (!best || best.version === cleanVersion(current)) return null;
  return compatible(currentRange) && !newer(best.version, current) ? null : best;
}

export class KernelUpdates {
  constructor({ ctx, directory, current = KERNEL_VERSION, currentRange = KERNEL_PROTOCOL, isIdle = () => true,
    fetchImpl = fetch, startTimers = true }) {
    Object.assign(this, { ctx, current, currentRange, isIdle, fetchImpl, startTimers });
    this.filename = path.join(directory, 'kernel-updates.json');
    this.settings = { policy: 'notify', channel: isPrerelease(current) ? 'prerelease' : 'stable' };
    this.status = { phase: 'idle', protocol: null, compatible: true, target: null, checkedAt: 0, error: null, source: null, dsh: null };
    this.timers = new Set();
    this.checking = null;
  }

  async initialize() {
    const saved = await readOptionalJson(this.filename);
    if (POLICIES.includes(saved?.policy)) this.settings.policy = saved.policy;
    if (CHANNELS.includes(saved?.channel)) this.settings.channel = saved.channel;
    if (this.startTimers) {
      this.later(STARTUP_DELAY_MS, () => this.automaticCheck());
      const interval = setInterval(() => void this.automaticCheck().catch(() => {}), CHECK_INTERVAL_MS);
      interval.unref?.();
      this.timers.add(interval);
    }
    return this;
  }

  later(ms, task) {
    const timer = setTimeout(() => { this.timers.delete(timer); void Promise.resolve().then(task).catch(() => {}); }, ms);
    timer.unref?.();
    this.timers.add(timer);
  }

  view() {
    return { current: this.current, protocolRange: { ...this.currentRange }, policy: this.settings.policy, channel: this.settings.channel,
      serverProtocol: this.status.protocol, compatible: this.status.compatible, available: this.status.target?.version ?? null,
      phase: this.status.phase, error: this.status.error, checkedAt: this.status.checkedAt || null,
      source: this.status.source, dsh: this.status.dsh };
  }

  /** Record the protocol a server answered with; a new answer is looked up at once unless the owner checks by hand. */
  observeProtocol(protocol, { compatible = true } = {}) {
    const changed = this.status.protocol !== protocol || this.status.compatible !== compatible;
    Object.assign(this.status, { protocol, compatible });
    if (changed) void this.automaticCheck({ fresh: true }).catch(() => {});
  }

  /** A check nobody asked for; under the manual policy only the owner starts one. */
  async automaticCheck(options) {
    return this.settings.policy === 'manual' ? this.view() : this.check(options);
  }

  async setPolicy({ policy, channel }) {
    if (policy !== undefined && !POLICIES.includes(policy)) throw new Error('请选择有效的升级策略');
    if (channel !== undefined && !CHANNELS.includes(channel)) throw new Error('请选择有效的升级渠道');
    this.settings = { policy: policy ?? this.settings.policy, channel: channel ?? this.settings.channel };
    await savePrivateJson(this.filename, this.settings);
    return this.check({ fresh: true });
  }

  manager() { return this.ctx?.get?.('pluginManager'); }

  /** Where this plugin was installed from; only a registry install can move between versions. */
  async source() {
    const bundles = await Promise.resolve(this.manager()?.listBundles?.()).catch(() => null);
    const own = Array.isArray(bundles) ? bundles.find(bundle => bundle.name === PACKAGE_NAME) : undefined;
    if (typeof own?.source === 'string') return sourceOf(own.source).kind;
    const dir = this.ctx?.get?.('profileContext')?.dir;
    if (typeof dir !== 'string') return 'unknown';
    try { return sourceOf(JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).dependencies?.[PACKAGE_NAME]).kind; }
    catch { return 'unknown'; }
  }

  /** The running DSH version, so a release that declares another `engines.dsh` is skipped. */
  async dshVersion() {
    try {
      const loader = this.ctx?.get?.('loader');
      const loaded = await loader?.import?.(APP_BOOT);
      const appBoot = loader?.unwrapExports?.(loaded) ?? loaded?.default ?? loaded;
      const version = cleanVersion(appBoot?.getDshRuntimeVersion?.());
      if (version) return version;
    } catch { /* read the install instead */ }
    let dir = dirname(String(process.argv[1] ?? ''));
    for (let depth = 0; depth < 12; depth += 1) {
      try {
        const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
        if (manifest?.name?.startsWith?.('@deepseek-ai/')) return cleanVersion(manifest.version);
      } catch { /* not a package directory */ }
      if (dirname(dir) === dir) break;
      dir = dirname(dir);
    }
    return null;
  }

  async packument(registry) {
    const response = await this.fetchImpl(`${registry}${encodeName(PACKAGE_NAME)}`, {
      headers: { accept: 'application/json' }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!response.ok) throw new Error(`registry HTTP ${response.status}`);
    return response.json();
  }

  async check({ fresh = false } = {}) {
    if (this.checking) return this.checking;
    if (!fresh && Date.now() - this.status.checkedAt < 10 * 60_000) return this.view();
    this.checking = this.runCheck().finally(() => { this.checking = null; });
    return this.checking;
  }

  async runCheck() {
    this.status.source = await this.source();
    this.status.dsh = await this.dshVersion();
    if (!this.status.protocol || this.status.phase === 'installing') return this.view();
    let found = null;
    let lastError = null;
    for (const registry of await registryPlan({}, this.manager())) {
      try {
        const chosen = selectKernel(await this.packument(registry), { protocol: this.status.protocol, dshVersion: this.status.dsh,
          channel: this.settings.channel, current: this.current, currentRange: this.currentRange });
        found = chosen && { ...chosen, registry };
        lastError = null;
        break;
      } catch (error) { lastError = error; }
    }
    Object.assign(this.status, { checkedAt: Date.now(), target: found, error: lastError ? String(lastError.message).slice(0, 300) : null });
    if (found && this.status.phase === 'failed') this.status.phase = 'idle';
    if (found && this.settings.policy === 'auto') this.autoInstall();
    return this.view();
  }

  autoInstall() {
    if (this.status.source !== 'registry') return;
    if (!this.isIdle()) { this.later(IDLE_RETRY_MS, () => this.settings.policy === 'auto' && this.status.target && this.autoInstall()); return; }
    try { this.install(); } catch { /* the status records why */ }
  }

  /** Install the chosen release through the DSH plugin manager; the result comes back through `view`. */
  install() {
    if (this.status.phase === 'installing') return this.view();
    const chosen = this.status.target;
    if (!chosen) throw new Error('没有可安装的插件版本');
    if (this.status.source !== 'registry') throw new Error('插件不是从 npm 安装的，请手动安装新版本');
    const service = this.manager();
    if (typeof service?.installBundle !== 'function') throw new Error('当前 DSH 不提供插件管理器');
    const spec = `${PACKAGE_NAME}@${chosen.version}`;
    const previous = `${PACKAGE_NAME}@${this.current}`;
    const options = chosen.registry ? { registry: chosen.registry } : {};
    const done = result => !result?.error && ['applied', 'restart-required'].includes(result?.application);
    Object.assign(this.status, { phase: 'installing', error: null });
    void Promise.resolve(service.installBundle(spec, options))
      .then(async result => {
        if (result?.error?.code !== 'already-installed') return result;
        // Under hot reload the manager refuses to install over a dependency the profile
        // already has: remove this bundle (which unloads us) and install the release.
        if (typeof service.removeBundle !== 'function') return { error: { code: 'not-removable' } };
        const removed = await service.removeBundle(PACKAGE_NAME);
        if (removed?.error) return removed;
        const again = await Promise.resolve(service.installBundle(spec, options)).catch(error => ({ error: { code: error?.message ?? 'install failed' } }));
        if (done(again)) return again;
        // Put the running version back so a failed upgrade never leaves the host without DSCord.
        await Promise.resolve(service.installBundle(previous, options)).catch(() => {});
        return again;
      })
      .then(result => {
        if (!done(result)) throw new Error(result?.error?.diagnostic ?? result?.error?.code ?? `install ${result?.application ?? 'failed'}`);
        Object.assign(this.status, { phase: result.application === 'restart-required' ? 'restart-required' : 'installed' });
      })
      .catch(error => { Object.assign(this.status, { phase: 'failed', error: String(error?.message ?? error).slice(0, 300) }); });
    return this.view();
  }

  dispose() {
    for (const timer of this.timers) { clearTimeout(timer); clearInterval(timer); }
    this.timers.clear();
  }
}
