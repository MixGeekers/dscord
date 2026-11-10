import { createHash, randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { httpUrl } from '../scripts/runtime-config.mjs';
import { importNodeBundle } from '../scripts/server-admin.mjs';
import { readOptionalJson, savePrivateJson } from '../scripts/server-init.mjs';

const STATE_VERSION = 3;
const MODEL_CATALOG_MS = 60 * 1000;
const RETRY_FIRST_MS = 10 * 1000;
const RETRY_LAST_MS = 5 * 60 * 1000;

/** The chat server and one-time central code inside a connection key from a chat server's page. */
export function connectKey(value) {
  let decoded;
  try {
    decoded = JSON.parse(Buffer.from(String(value || '').replace(/\s+/g, ''), 'base64url').toString('utf8'));
  } catch {
    decoded = null;
  }
  if (!decoded || typeof decoded.server !== 'string' || typeof decoded.code !== 'string' || !decoded.code) {
    throw Object.assign(new Error('连接密钥不完整，请从 DSCord 网页重新复制'), { code: 'CONNECT_KEY_INVALID' });
  }
  return { server: decoded.server, code: decoded.code };
}

/**
 * Links this DSH to its owner's central account and runs the Bots that account assigns to this device.
 * Nothing about a Bot is decided here: the owner sets Bots up on a chat server's page, the central server keeps
 * that setup, and this device asks for it every few seconds, reports what it has (its models, its plugin, how
 * each Bot is doing) and makes the local Bots and their chat-server connections match. Each Bot signs in to its
 * chat servers with its own identity token, like anyone else; one Bot on several servers is one local Bot with
 * one connection per server.
 */
export class ConnectController {
  constructor({ directory, processes, native, updates, request = fetch, label = `DSH ${hostname()}`, now = Date.now }) {
    this.directory = path.resolve(directory);
    this.filename = path.join(this.directory, 'connection.json');
    Object.assign(this, { processes, native, updates, request, label, now });
    this.state = { schemaVersion: STATE_VERSION, centralUrl: '', centralToken: null, user: null, webUrl: '', servers: {}, bots: [], nodes: {} };
    // Connections by node id (`@name:server`), what each Bot's last setup attempt came to, and failed connections waiting to be retried.
    this.running = new Map();
    this.outcomes = new Map();
    this.failures = new Map();
    this.queue = Promise.resolve();
    this.closed = false;
    this.lastError = null;
    this.syncedAt = null;
  }

  async initialize() {
    const saved = await readOptionalJson(this.filename);
    if (saved?.schemaVersion === STATE_VERSION) this.state = saved;
    this.state.servers ||= {};
    this.state.nodes ||= {};
    this.state.botSessions ||= {};
    this.state.nativeLinks ||= {};
    this.state.creations ||= {};
    this.state.bots = (this.state.bots || []).filter(bot => bot.settings);
    if (!this.state.hostId) { this.state.hostId = randomUUID(); await this.save(); }
    await this.processes.configure?.({ directory: this.directory });
    this.runtime = await this.processes.available();
    // Bots that were online come back before the central server is asked anything, so a restart needs no network round trip.
    this.restoring = this.serial(async () => {
      for (const node of Object.values(this.state.nodes)) {
        if (this.closed) break;
        try { await this.start(node); } catch { /* The page shows each startup error, and the next report retries it. */ }
      }
    });
    return this;
  }

  serial(operation) {
    const work = this.queue.then(operation);
    this.queue = work.catch(() => {});
    return work;
  }

  async save(state = this.state) {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    await savePrivateJson(this.filename, state);
  }

  async remote(base, pathname, { method = 'GET', token, body } = {}) {
    const response = await this.request(`${base}${pathname}`, {
      method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(typeof data.error === 'string' ? data.error : `服务器请求失败 (${response.status})`);
      error.code = response.status === 401 ? 'dscord/login-required' : 'dscord/server-error';
      error.status = response.status;
      error.remoteCode = data.code;
      throw error;
    }
    return data;
  }

  /** The connection of one Bot to one chat server, as this device knows it. */
  nodeOf(bot, serverUrl) {
    return Object.values(this.state.nodes).find(node => node.centralId === bot.id && node.serverUrl === serverUrl);
  }

  async connection(bot, serverUrl) {
    const node = this.nodeOf(bot, serverUrl);
    const failed = this.failures.get(`${bot.id}\n${serverUrl}`);
    let current = (node && this.running.get(node.id)) || { status: failed ? 'error' : 'offline', lastError: failed?.message ?? null };
    if (node && current.status === 'online') current = await this.processes.probe(node);
    return { status: current.status, ...(current.lastError ? { error: current.lastError } : {}) };
  }

  /** What the connect page shows: who this DSH is linked to and how the Bots it runs are doing. */
  async status() {
    this.runtime = await this.processes.available();
    const bots = await Promise.all(this.state.bots.map(async bot => {
      const outcome = this.outcomes.get(bot.id);
      return { id: bot.id, name: bot.displayName, username: bot.username, globalId: bot.globalId,
        model: outcome?.model || bot.settings.model || null, ...(outcome?.error ? { error: outcome.error } : {}),
        servers: await Promise.all(bot.settings.servers.map(async url => ({ url,
          serverName: this.state.servers[url]?.serverName || new URL(url).host, ...await this.connection(bot, url) }))) };
    }));
    return { centralUrl: this.state.centralUrl, webUrl: this.state.webUrl || '', user: this.state.user, hostId: this.state.hostId,
      label: this.label, bots, runtime: this.runtime, lastError: this.lastError, syncedAt: this.syncedAt,
      nativeBundled: this.native.bundled === true, dataDirectory: this.directory,
      ...(this.updates ? { kernelUpdates: this.updates.view() } : {}) };
  }

  /** The models this DSH can run, which the owner chooses from on the web; read again once a minute. */
  async modelCatalog() {
    if (this.catalog && this.now() - this.catalog.at < MODEL_CATALOG_MS) return this.catalog.value;
    let value;
    try {
      const { providers, defaultSelection } = await this.native.models();
      value = { providers, defaultModel: defaultSelection?.model || '' };
    } catch (error) { value = { providers: [], defaultModel: '', error: error.message }; }
    this.catalog = { at: this.now(), value };
    return value;
  }

  async report() {
    const bots = {};
    for (const bot of this.state.bots) {
      const outcome = this.outcomes.get(bot.id);
      const servers = {};
      for (const url of bot.settings.servers) servers[url] = await this.connection(bot, url);
      bots[bot.id] = { revision: outcome?.revision ?? 0, ...(outcome?.model ? { model: outcome.model } : {}),
        ...(outcome?.error ? { error: outcome.error } : {}), servers };
    }
    const updates = this.updates?.view();
    return { models: await this.modelCatalog(), runtime: this.runtime?.available ? null : this.runtime?.message || null,
      plugin: updates ? { version: updates.current, available: updates.available, compatible: updates.compatible } : null, bots };
  }

  /**
   * Report to the central server, learn which Bots this device runs, and make it so. A change made here is
   * reported at once, so the owner's page does not wait for the next round to see a Bot come online.
   */
  synchronize({ force = false } = {}) {
    return this.serial(async () => {
      if (force) { this.failures.clear(); this.catalog = undefined; }
      for (let round = 0; round < 2; round++) {
        if (!this.state.centralToken || this.closed) return;
        const { centralUrl, centralToken, hostId } = this.state;
        let assigned;
        try {
          assigned = await this.remote(centralUrl, `/api/devices/${hostId}/sync`, { method: 'POST', token: centralToken,
            body: { label: this.label, report: await this.report() } });
          if (!Array.isArray(assigned.bots)) throw new Error('中央服务器没有返回 Bot 列表');
        } catch (error) {
          // The owner ended this device's session from elsewhere: it stops running their Bots.
          if (error.status === 401) await this.signedOut();
          else this.lastError = error.message;
          return;
        }
        this.lastError = null;
        this.syncedAt = new Date(this.now()).toISOString();
        if (JSON.stringify(assigned.bots) !== JSON.stringify(this.state.bots)) {
          this.state = { ...this.state, bots: assigned.bots };
          await this.save();
        }
        if (!await this.reconcile()) return;
      }
    });
  }

  /** Make the local Bots and their connections match what the central server assigned. Answers whether anything changed. */
  async reconcile() {
    let changed = false;
    const wanted = new Set();
    for (const bot of this.state.bots) for (const url of bot.settings.servers) wanted.add(`${bot.id}\n${url}`);
    for (const node of Object.values(this.state.nodes)) {
      if (wanted.has(`${node.centralId}\n${node.serverUrl}`)) continue;
      await this.stop(node);
      const { [node.id]: _left, ...nodes } = this.state.nodes;
      this.state = { ...this.state, nodes };
      await this.save();
      changed = true;
    }
    for (const bot of this.state.bots) {
      if (this.closed) break;
      const before = JSON.stringify(this.outcomes.get(bot.id));
      let local;
      try {
        local = await this.localBot(bot);
        this.outcomes.set(bot.id, { revision: bot.settings.revision, model: local.model || '' });
      } catch (error) {
        this.outcomes.set(bot.id, { revision: bot.settings.revision, error: error.message });
      }
      if (JSON.stringify(this.outcomes.get(bot.id)) !== before) changed = true;
      if (!local) continue;
      for (const url of bot.settings.servers) {
        if (this.closed) break;
        const key = `${bot.id}\n${url}`;
        const node = this.nodeOf(bot, url);
        if (node && ['online', 'connecting'].includes(this.running.get(node.id)?.status)) continue;
        const failed = this.failures.get(key);
        if (failed && failed.until > this.now()) continue;
        try {
          await this.connect(bot, url, local);
          this.failures.delete(key);
        } catch (error) {
          const delay = Math.min(failed ? failed.delay * 2 : RETRY_FIRST_MS, RETRY_LAST_MS);
          this.failures.set(key, { message: error.message, delay, until: this.now() + delay });
        }
        changed = true;
      }
    }
    for (const id of this.outcomes.keys()) if (!this.state.bots.some(bot => bot.id === id)) this.outcomes.delete(id);
    return changed;
  }

  /** The local Bot behind a central Bot account, created on first sight and kept in step with the owner's setup. */
  async localBot(bot) {
    const { settings } = bot;
    if (settings.model) {
      const catalog = await this.modelCatalog();
      const model = catalog.providers.flatMap(provider => provider.models).find(model => model.model === settings.model);
      if (!model) throw Object.assign(new Error(`这台设备上没有模型 ${settings.model}，请在网页上另选一个`), { code: 'MODEL_UNAVAILABLE' });
      if (model.needsKey) throw Object.assign(new Error(`模型 ${settings.model} 还没有凭据，请在 DSH 的模型设置里填写`), { code: 'MISSING_CREDENTIAL' });
    }
    const locals = await this.native.list();
    let local = locals.find(item => item.id === this.state.nativeLinks[bot.id]);
    if (!local) {
      // The request is saved before it is sent, so a lost answer is asked for again under the same name and no second Bot appears.
      let creation = this.state.creations[bot.id];
      if (!creation) {
        creation = { requestId: `dscord:${bot.id}:${randomUUID()}`, name: bot.displayName, role: settings.role,
          ...(settings.model ? { model: settings.model } : {}), ...(settings.effort ? { effort: settings.effort } : {}) };
        this.state = { ...this.state, creations: { ...this.state.creations, [bot.id]: creation } };
        await this.save();
      }
      const owner = { ...this.state.user, kind: 'human' };
      const { requestId, ...payload } = creation;
      const created = await this.native.call('create-bot', { ...payload, greet: false, requestId, owner,
        source: { sender: owner, requestId, transport: 'matrix' } });
      const id = created?.id || created?.bot?.id;
      if (!id) throw new Error('内核没有返回新建 Bot 的身份');
      const { [bot.id]: _done, ...creations } = this.state.creations;
      this.state = { ...this.state, creations, nativeLinks: { ...this.state.nativeLinks, [bot.id]: id } };
      await this.save();
      local = (await this.native.list()).find(item => item.id === id);
      if (!local) throw new Error('内核没有列出新建的 Bot');
    }
    const patch = {
      ...(local.name !== bot.displayName ? { name: bot.displayName } : {}),
      ...((local.role || '') !== settings.role ? { role: settings.role } : {}),
      ...(settings.model && local.model !== settings.model ? { model: settings.model } : {}),
      ...(settings.effort && local.effort !== settings.effort ? { effort: settings.effort } : {}),
    };
    if (!Object.keys(patch).length) return local;
    await this.native.call('update-bot', { id: local.id, ...patch });
    return { ...local, ...patch };
  }

  /** A chat server's discovery, which must name the central server this device is linked to. It is read once and kept. */
  async server(input) {
    const url = httpUrl(String(input || '').trim(), '服务器地址');
    if (this.state.servers[url]) return this.state.servers[url];
    const server = await this.discover(url);
    if (server.centralUrl !== this.state.centralUrl) throw new Error('这台聊天服务器接入的是另一个中央服务器');
    this.state = { ...this.state, servers: { ...this.state.servers, [url]: server } };
    await this.save();
    return server;
  }

  async discover(input) {
    const url = httpUrl(String(input || '').trim(), '服务器地址');
    const discovery = await this.remote(url, '/.well-known/dscord/client');
    if (!discovery.central?.issuer || !discovery.auth?.audience) throw new Error('这台聊天服务器还没有接入中央服务器');
    return { url, centralUrl: httpUrl(discovery.central.issuer, '中央服务器地址'), audience: discovery.auth.audience,
      serverName: discovery.home.serverName, sessionPath: discovery.auth.sessionPath || '/api/session' };
  }

  /** A five-minute identity token from the central server that names one chat server. */
  async identityToken(centralToken, audience) {
    const { token } = await this.remote(this.state.centralUrl, '/api/identity-tokens', { method: 'POST', token: centralToken,
      body: { audience, allowNew: true } });
    return token;
  }

  signOut(base, token) {
    return token ? this.remote(base, '/api/logout', { method: 'POST', token, body: {} }).catch(() => {}) : Promise.resolve();
  }

  /**
   * Link this DSH with a connection key made on a chat server's page: base64url JSON `{server, code}`. The code is
   * redeemed, once, at the central server that chat server trusts. The Bots to run arrive with the first report.
   */
  async login({ key }) {
    const { server: input, code } = connectKey(key);
    const discovered = await this.discover(input);
    const { centralUrl } = discovered;
    let central;
    try {
      central = await this.remote(centralUrl, '/api/connect-codes/redeem', { method: 'POST', body: { code, label: this.label } });
    } catch (error) {
      if (['CONNECT_CODE_UNKNOWN', 'CONNECT_CODE_EXPIRED'].includes(error.remoteCode)) {
        throw Object.assign(new Error(error.remoteCode === 'CONNECT_CODE_EXPIRED' ? '连接密钥已过期，请在网页上重新生成' : '连接密钥已用过或不存在，请在网页上重新生成'),
          { code: error.remoteCode });
      }
      throw error;
    }
    if (!central.token || central.account?.kind !== 'human' || !central.account.globalId) throw new Error('中央服务器登录响应不完整');
    const previous = this.state;
    const identity = `${centralUrl}\n${central.account.globalId}`;
    // The same person linking again keeps their local Bots; anyone else starts with none of them.
    const kept = identity === previous.identity ? previous : {};
    const next = {
      schemaVersion: STATE_VERSION, hostId: previous.hostId, identity, centralUrl, centralToken: central.token, webUrl: discovered.url,
      user: { id: central.account.globalId, name: central.account.displayName || central.account.globalId, globalId: central.account.globalId },
      servers: { ...(kept.servers || {}), [discovered.url]: discovered }, bots: kept.bots || [], nodes: kept.nodes || {},
      botSessions: kept.botSessions || {}, nativeLinks: kept.nativeLinks || {}, creations: kept.creations || {},
    };
    try {
      if (kept !== previous) await this.stopAll();
      await this.save(next);
    } catch (error) {
      await this.signOut(centralUrl, central.token);
      throw error;
    }
    this.state = next;
    this.lastError = null;
    if (kept !== previous) { this.outcomes.clear(); this.failures.clear(); }
    if (previous.centralToken) await this.signOut(previous.centralUrl, previous.centralToken);
    // The page answers at once; the Bots appear as this first report brings them.
    void this.synchronize().catch(() => {});
    return this.status();
  }

  /** The Bot's own central session, from the device-code flow that the owner's session approves. */
  async botSession(bot) {
    const saved = this.state.botSessions[bot.centralId];
    if (saved) return saved;
    const { centralUrl, centralToken } = this.state;
    const { deviceCode, userCode } = await this.remote(centralUrl, '/api/device', { method: 'POST', body: { label: this.label } });
    await this.remote(centralUrl, '/api/device/approve', { method: 'POST', token: centralToken, body: { userCode, botId: bot.centralId } });
    const { token } = await this.remote(centralUrl, '/api/device/token', { method: 'POST', body: { deviceCode } });
    this.state = { ...this.state, botSessions: { ...this.state.botSessions, [bot.centralId]: token } };
    await this.save();
    return token;
  }

  /** The Bot's node configuration, fetched by the Bot itself after it signs in to the chat server. */
  async botBundle(bot, server, native) {
    let token = await this.botSession(bot);
    let identityToken;
    try { identityToken = await this.identityToken(token, server.audience); }
    catch (error) {
      if (error.status !== 401) throw error;
      // The owner revoked this node: ask for a new one once.
      const { [bot.centralId]: _revoked, ...botSessions } = this.state.botSessions;
      this.state = { ...this.state, botSessions };
      await this.save();
      token = await this.botSession(bot);
      identityToken = await this.identityToken(token, server.audience);
    }
    const session = await this.remote(server.url, server.sessionPath, { method: 'POST', body: { identityToken } });
    if (session.user_id !== bot.id) throw new Error('服务器返回的 Bot 身份不匹配');
    try {
      const { bundle } = await this.remote(server.url, `/api/bots/${encodeURIComponent(bot.id)}/connect`, {
        method: 'POST', token: session.access_token, body: { native },
      });
      return bundle;
    } finally {
      // The node runs on the service credential in its bundle, not on this sign-in session.
      await this.signOut(server.url, session.access_token);
    }
  }

  async writeBundle(bot, bundle, directory) {
    if (bundle?.schemaVersion !== 1 || !bundle.coreConfig?.nodeSecret || !bundle.coreUrl) throw new Error('服务器返回的节点配置不完整');
    if (bundle?.nodeId !== bot.localpart || !/^[a-zA-Z0-9_-]+$/.test(bot.localpart)) throw new Error('服务器返回的 Bot 身份不匹配');
    if (['all', 'core'].includes(bot.localpart)) throw new Error('Bot 账号与服务命令保留名称冲突');
    const identity = bundle.setup?.participants?.find(item => item.id === bot.id && item.kind === 'bot');
    if (!identity?.accessToken || identity.localpart !== bot.localpart) throw new Error('服务器没有返回所选 Bot 的节点凭据');
    const prior = await readOptionalJson(path.join(directory, 'matrix-setup.json'));
    if (!prior) return importNodeBundle(bundle, directory);
    const previousBot = prior.participants?.find(item => item.accessToken && item.kind === 'bot');
    if (previousBot?.id !== bot.id || prior.homeserverUrl !== bundle.setup.homeserverUrl) throw new Error('节点目录属于另一个 Bot');
    // The account identity is stable while roster, public names and credentials can change.
    await savePrivateJson(path.join(directory, 'matrix-setup.json'), bundle.setup);
    await savePrivateJson(path.join(directory, 'core-config.json'), bundle.coreConfig);
  }

  /** Bring a Bot online on one chat server, as its account there (`@name:server`). */
  async connect(bot, serverUrl, local) {
    const server = await this.server(serverUrl);
    this.runtime = await this.processes.available();
    if (!this.runtime.available) throw new Error(this.runtime.message);
    const account = { id: `@${bot.username}:${server.serverName}`, centralId: bot.id, name: bot.displayName, localpart: bot.username,
      serverUrl: server.url, serverName: server.serverName, globalId: bot.globalId };
    const existing = this.state.nodes[account.id];
    if (existing && this.running.has(account.id)) await this.stop(existing);
    const bundle = await this.botBundle(account, server, { hostId: this.state.hostId, nativeBotId: local.id });
    if (this.closed) throw new Error('连接插件正在关闭');
    const key = createHash('sha256').update(`${server.url}\n${account.id}`).digest('hex').slice(0, 24);
    const directory = path.join(this.directory, 'nodes', key);
    await this.writeBundle(account, bundle, directory);
    const node = { ...account, directory, nativeBotId: local.id };
    this.state = { ...this.state, nodes: { ...this.state.nodes, [account.id]: node } };
    await this.save();
    await this.start(node);
  }

  async start(node) {
    if (this.closed) throw new Error('连接插件正在关闭');
    this.running.set(node.id, { status: 'connecting', lastError: null });
    try {
      await this.processes.start(node);
      if (this.closed) await this.processes.stop(node);
      else this.running.set(node.id, { status: 'online', lastError: null });
    } catch (error) {
      let message = error.message;
      if (!this.closed) {
        try { await this.processes.stop(node); } catch (stopError) { message += `\n${stopError.message}`; }
        this.running.set(node.id, { status: 'error', lastError: message });
      }
      throw Object.assign(new Error(message), { code: error.code });
    }
  }

  async stop(node) {
    if (this.running.has(node.id)) await this.processes.stop(node);
    this.running.delete(node.id);
  }

  async stopAll() {
    // Start every cleanup before awaiting any one Bot's drain or the host shutdown deadline.
    const results = await Promise.allSettled(Object.values(this.state.nodes).map(node => this.stop(node)));
    const errors = results.filter(result => result.status === 'rejected').map(result => result.reason);
    if (errors.length) throw new AggregateError(errors, errors.map(error => error.message).join('\n'));
  }

  /** This device is no longer linked: its Bots stop, and the same person linking again finds them as they were. */
  async signedOut() {
    await this.stopAll();
    this.state = { ...this.state, user: null, centralToken: null, bots: [], nodes: {} };
    await this.save();
    this.outcomes.clear();
    this.failures.clear();
    this.syncedAt = null;
  }

  async logout() {
    const { centralUrl, centralToken, hostId } = this.state;
    await this.signedOut();
    if (centralToken) {
      // The owner's Bots wait for another device instead of showing this one as merely offline. Removing the
      // device ends its session too; a DSH that never reported has no device to remove and signs out itself.
      await this.remote(centralUrl, `/api/devices/${hostId}`, { method: 'DELETE', token: centralToken }).catch(() => {});
      await this.signOut(centralUrl, centralToken);
    }
    return this.status();
  }

  async handle(body) {
    if (this.closed) throw new Error('连接插件正在关闭');
    if (body.action === 'status') return this.status();
    if (body.action === 'kernel-state') return this.processes.kernelState();
    if (body.action?.startsWith?.('kernel-update-')) {
      if (!this.updates) throw new Error('当前运行方式不支持插件升级');
      switch (body.action) {
        case 'kernel-update-status': return this.updates.view();
        case 'kernel-update-check': return this.updates.check({ fresh: true });
        case 'kernel-update-policy': return this.updates.setPolicy({ policy: body.policy, channel: body.channel });
        case 'kernel-update-install': return this.updates.install();
        default: throw new Error('未知连接操作');
      }
    }
    if (body.action === 'sync') {
      await this.synchronize({ force: true });
      return this.status();
    }
    return this.serial(async () => {
      if (this.closed) throw new Error('连接插件正在关闭');
      switch (body.action) {
        case 'save-decision-provider': return this.processes.saveDecisionProvider({ apiKey: body.apiKey, enabled: body.enabled,
          model: body.model, endpoint: body.endpoint });
        case 'login': return this.login(body);
        case 'logout': return this.logout();
        default: throw new Error('未知连接操作');
      }
    });
  }

  async dispose() {
    this.closed = true;
    const cleanup = this.stopAll().then(() => null, error => error);
    await this.queue;
    const error = await cleanup;
    if (error) throw error;
  }
}
