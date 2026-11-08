import { createHash, randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { httpUrl } from '../scripts/runtime-config.mjs';
import { importNodeBundle } from '../scripts/server-admin.mjs';
import { readOptionalJson, savePrivateJson } from '../scripts/server-init.mjs';
import { availablePort, NodeProcesses } from './processes.mjs';
import { LEGACY_MODEL, checkModelPolicy } from '../src/model-config.mjs';

const STATE_VERSION = 2;

function publicBot(bot) {
  return { id: bot.id, centralId: bot.centralId, name: bot.name || bot.localpart, localpart: bot.localpart,
    ...(bot.ownerId ? { ownerId: bot.ownerId } : {}), ...(bot.globalId ? { globalId: bot.globalId } : {}),
    ...(bot.nativeBinding ? { nativeBinding: bot.nativeBinding } : {}) };
}

/** A central username for a new Bot: its name in Latin letters where possible, made unique. */
function botUsername(name) {
  const slug = name.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20);
  return `${/^[a-z]/.test(slug) ? slug : `bot${slug ? `-${slug}` : ''}`}-${randomUUID().slice(0, 6)}`;
}

/**
 * Connects this DSH host to one chat server. The owner signs in with their central account; each
 * Bot gets its own central session through the device-code flow, which the owner's session approves,
 * and then signs in to the chat server with its own identity token like anyone else.
 */
export class ConnectController {
  constructor({ directory, sourceHome, sourceProfile, processes, models, native, updates, request = fetch, selectPort = availablePort }) {
    this.directory = path.resolve(directory);
    this.filename = path.join(this.directory, 'connection.json');
    this.processes = processes || new NodeProcesses({ sourceHome, sourceProfile });
    this.request = request;
    this.selectPort = selectPort;
    this.models = models;
    this.native = native;
    this.updates = updates;
    this.state = { schemaVersion: STATE_VERSION, serverUrl: '', centralUrl: '', user: null, accessToken: null, centralToken: null, bots: [], nodes: {} };
    this.running = new Map();
    this.queue = Promise.resolve();
    this.closed = false;
  }

  async initialize() {
    const saved = await readOptionalJson(this.filename);
    // A connection saved before central accounts holds a password-login session; it is not carried over.
    if (saved?.schemaVersion === STATE_VERSION) this.state = saved;
    this.state.modelSelections ||= {};
    this.state.botSessions ||= {};
    this.state.nativeLinks ||= {};
    this.state.attentionModes ||= {};
    this.state.nativeCreationRequests ||= {};
    if (this.native && !this.state.hostId) { this.state.hostId = randomUUID(); await this.save(); }
    await this.processes.configure?.({ directory: this.directory });
    for (const node of Object.values(this.state.nodes)) {
      if (Object.hasOwn(this.state.modelSelections, node.id)) continue;
      const prepared = await readOptionalJson(path.join(node.directory, `dsh-${node.localpart}`, 'node-config.json'));
      if (prepared?.model) {
        const legacyEffort = prepared.modelConfigVersion === undefined && prepared.model === LEGACY_MODEL ? 'low' : undefined;
        const reasoningEffort = prepared.reasoningEffort ?? legacyEffort;
        this.state.modelSelections[node.id] = { model: prepared.model, maxTokens: prepared.maxTokens || 4096,
          ...(reasoningEffort ? { reasoningEffort } : {}) };
      }
    }
    this.runtime = await this.processes.available();
    this.restoring = this.serial(async () => {
      for (const node of Object.values(this.state.nodes)) {
        if (!node.desired || this.closed) continue;
        try { await this.start(node); } catch { /* The status page retains each startup error. */ }
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

  async status({ refresh = true } = {}) {
    let lastError = null;
    if (refresh) this.runtime = await this.processes.available();
    if (refresh && this.state.centralToken && !this.closed) {
      const { centralToken } = this.state;
      try {
        const bots = await this.ownedBots();
        if (centralToken === this.state.centralToken) this.state.bots = bots;
      } catch (error) { lastError = error.message; }
    }
    const bots = await Promise.all(this.state.bots.map(async bot => {
      const node = this.state.nodes[bot.id];
      const active = this.running.get(bot.id);
      let current = active || { status: 'offline', lastError: null };
      if (node && active?.status === 'online') current = await this.processes.probe(node);
      return { ...bot, ...current, connected: Boolean(node?.desired),
        modelSelection: this.state.modelSelections?.[bot.id] ?? null,
        activeModel: current.status === 'online' ? current.modelConfig ?? active?.modelConfig ?? null : null };
    }));
    let nativeBots = [];
    if (this.native) {
      try { nativeBots = await this.ownedNativeBots(); } catch (error) { lastError ||= error.message; }
      for (const bot of bots) {
        const local = nativeBots.find(local => local.id === bot.nativeBinding?.nativeBotId && bot.nativeBinding.hostId === this.state.hostId);
        if (local) { bot.modelSelection = local.model ? { model: local.model } : null; bot.nativeBotId = local.id; }
      }
    }
    return { serverUrl: this.state.serverUrl, user: this.state.user, bots, runtime: this.runtime,
      ...(this.native ? { nativeBots, hostId: this.state.hostId, nativeMode: true, nativeBundled: this.native.bundled === true } : {}),
      dataDirectory: this.directory, lastError, modelPolicy: this.modelPolicy,
      ...(this.updates ? { kernelUpdates: this.updates.view() } : {}),
      models: this.native ? await this.native.models().catch(() => ({ available: false })) : this.models ? await this.models.view() : { available: false } };
  }

  async ownedNativeBots() {
    const bots = await this.native.list();
    return bots.filter(bot => !this.state.user || !bot.owner?.id || bot.owner.id === this.state.user.id);
  }

  async ownedNativeBot(id, { claim = false } = {}) {
    if (!this.native) throw new Error('DSCORD_KERNEL_UNAVAILABLE');
    const bot = await this.native.bot(id);
    if (this.state.user && bot.owner?.id && bot.owner.id !== this.state.user.id) {
      throw Object.assign(new Error('请选择属于当前账号的 Bot'), { code: 'BOT_OWNER_CONFLICT' });
    }
    if (claim && this.state.user && !bot.owner?.id) {
      await this.native.call('claim-bot', { id, owner: { ...this.state.user, kind: 'human' },
        source: { sender: { ...this.state.user, kind: 'human' }, transport: 'matrix' } });
    }
    return bot;
  }

  async createNative(body) {
    if (!this.native) throw new Error('DSCORD_KERNEL_UNAVAILABLE');
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const role = typeof body.role === 'string' ? body.role.trim() : '';
    if (!name || name.length > 120 || role.length > 4000) throw new Error('请输入有效的 Bot 名称和职责');
    if (typeof body.requestId !== 'string' || !/^[a-zA-Z0-9_.:-]{1,160}$/.test(body.requestId)) throw new Error('创建请求缺少有效的标识');
    await this.modelSource({ model: body.model });
    const hash = createHash('sha256').update(JSON.stringify({ name, role, model: body.model,
      ownerId: this.state.user?.id || null })).digest('hex');
    const prior = this.state.nativeCreationRequests[body.requestId];
    if (prior && prior.hash !== hash) throw new Error('同一创建请求的内容已经变化');
    if (prior?.nativeBotId) {
      await this.ownedNativeBot(prior.nativeBotId);
      return this.status({ refresh: false });
    }
    this.state.nativeCreationRequests[body.requestId] = { hash, status: 'creating' };
    await this.save();
    const sender = this.state.user ? { ...this.state.user, kind: 'human' }
      : { id: `local-user:${this.state.hostId}`, name: 'Local user', kind: 'human' };
    try {
      const created = await this.native.call('create-bot', { name, role, model: body.model, greet: false,
        requestId: body.requestId, ...(this.state.user ? { owner: sender } : {}),
        source: { sender, requestId: body.requestId, transport: this.state.user ? 'matrix' : 'native' } });
      const id = created?.id || created?.bot?.id;
      if (!id) throw new Error('内核没有返回新建 Bot 的身份');
      this.state.nativeCreationRequests[body.requestId] = { hash, status: 'completed', nativeBotId: id };
      await this.save();
    } catch (error) {
      this.state.nativeCreationRequests[body.requestId] = { hash, status: 'unknown' };
      await this.save();
      throw error;
    }
    return this.status({ refresh: false });
  }

  /** The owner's Bots on the central server, named as accounts on this chat server. */
  async ownedBots(state = this.state) {
    const { bots } = await this.remote(state.centralUrl, '/api/bots', { token: state.centralToken });
    if (!Array.isArray(bots)) throw new Error('中央服务器没有返回 Bot 列表');
    return bots.filter(bot => bot.status === 'active').map(bot => publicBot({ id: `@${bot.username}:${state.serverName}`,
      centralId: bot.id, name: bot.displayName, localpart: bot.username, ownerId: state.user.id, globalId: bot.globalId,
      ...(state.nativeLinks?.[bot.id] && state.hostId ? { nativeBinding: { hostId: state.hostId, nativeBotId: state.nativeLinks[bot.id],
        botId: `@${bot.username}:${state.serverName}` } } : {}) }));
  }

  /** A five-minute identity token from the central server that names this chat server. */
  async identityToken(centralToken, state = this.state) {
    const { token } = await this.remote(state.centralUrl, '/api/identity-tokens', { method: 'POST', token: centralToken,
      body: { audience: state.audience, allowNew: true } });
    return token;
  }

  async login({ serverUrl: input, user, password }) {
    const serverUrl = httpUrl(String(input || '').trim(), '服务器地址');
    if (typeof user !== 'string' || !user.trim() || typeof password !== 'string' || !password) throw new Error('请输入账号和密码');
    const discovery = await this.remote(serverUrl, '/.well-known/dscord/client');
    if (!discovery.central?.issuer || !discovery.auth?.audience) throw new Error('这台聊天服务器还没有接入中央服务器');
    const centralUrl = httpUrl(discovery.central.issuer, '中央服务器地址');
    const central = await this.remote(centralUrl, '/api/login', { method: 'POST', body: { username: user.trim(), password } });
    if (!central.token || central.account?.kind !== 'human') throw new Error('中央服务器登录响应不完整');
    const pending = { serverUrl, centralUrl, audience: discovery.auth.audience, serverName: discovery.home.serverName, centralToken: central.token };
    let login;
    let bots;
    try {
      login = await this.remote(serverUrl, discovery.auth.sessionPath || '/api/session', { method: 'POST',
        body: { identityToken: await this.identityToken(central.token, pending) } });
      if (!login.access_token || !login.user_id) throw new Error('服务器登录响应不完整');
      bots = await this.ownedBots({ ...pending, user: { id: login.user_id }, nativeLinks: this.state.nativeLinks, hostId: this.state.hostId });
    } catch (error) {
      if (login?.access_token) await this.remote(serverUrl, '/api/logout', { method: 'POST', token: login.access_token, body: {} }).catch(() => {});
      await this.remote(centralUrl, '/api/logout', { method: 'POST', token: central.token, body: {} }).catch(() => {});
      throw error;
    }
    const sameIdentity = serverUrl === this.state.serverUrl && login.user_id === this.state.user?.id;
    const previous = this.state;
    const next = {
      schemaVersion: STATE_VERSION, ...pending, user: { id: login.user_id, name: central.account.displayName || login.user_id, globalId: central.account.globalId },
      accessToken: login.access_token, bots, nodes: sameIdentity ? this.state.nodes : {},
      botSessions: sameIdentity ? this.state.botSessions : {}, nativeLinks: sameIdentity ? this.state.nativeLinks : {},
      modelSelections: sameIdentity ? this.state.modelSelections : {},
      attentionModes: sameIdentity ? this.state.attentionModes : {},
      nativeCreationRequests: this.state.nativeCreationRequests || {},
      ...(this.state.hostId ? { hostId: this.state.hostId } : {}),
    };
    try {
      if (!sameIdentity) await this.stopAll(false);
      await this.save(next);
    } catch (error) {
      await this.remote(serverUrl, '/api/logout', { method: 'POST', token: login.access_token, body: {} }).catch(() => {});
      await this.remote(centralUrl, '/api/logout', { method: 'POST', token: central.token, body: {} }).catch(() => {});
      throw error;
    }
    this.state = next;
    if (!sameIdentity) this.modelPolicy = undefined;
    await this.closeSessions(previous);
    return this.status({ refresh: false });
  }

  /** Close the owner's previous chat-server and central sessions after they are replaced. */
  async closeSessions(previous) {
    if (previous.accessToken && previous.accessToken !== this.state.accessToken) {
      await this.remote(previous.serverUrl, '/api/logout', { method: 'POST', token: previous.accessToken, body: {} }).catch(() => {});
    }
    if (previous.centralToken && previous.centralToken !== this.state.centralToken) {
      await this.remote(previous.centralUrl, '/api/logout', { method: 'POST', token: previous.centralToken, body: {} }).catch(() => {});
    }
  }

  /** Bring this host's linked native Bots online whenever they should be and are not. */
  synchronizeNative() {
    return this.serial(async () => {
      if (!this.native || !this.state.centralToken || this.closed) return;
      this.state.bots = await this.ownedBots();
      for (const bot of this.state.bots) {
        if (bot.nativeBinding?.hostId !== this.state.hostId || this.closed) continue;
        const node = this.state.nodes[bot.id];
        const active = this.running.get(bot.id);
        if (node && (!node.desired || ['online', 'connecting'].includes(active?.status))) continue;
        try { await this.connect(bot.id); }
        catch (error) {
          if (!this.closed) this.running.set(bot.id, { status: 'error', lastError: error.message });
        }
      }
    });
  }

  /** The Bot's own central session, from the device-code flow that the owner's session approves. */
  async botSession(bot) {
    const saved = this.state.botSessions[bot.centralId];
    if (saved) return saved;
    const { centralUrl, centralToken } = this.state;
    const { deviceCode, userCode } = await this.remote(centralUrl, '/api/device', { method: 'POST', body: { label: `DSH ${hostname()}` } });
    await this.remote(centralUrl, '/api/device/approve', { method: 'POST', token: centralToken, body: { userCode, botId: bot.centralId } });
    const { token } = await this.remote(centralUrl, '/api/device/token', { method: 'POST', body: { deviceCode } });
    const next = { ...this.state, botSessions: { ...this.state.botSessions, [bot.centralId]: token } };
    await this.save(next);
    this.state = next;
    return token;
  }

  /** The Bot's node configuration, fetched by the Bot itself after it signs in to the chat server. */
  async botBundle(bot, native) {
    let token = await this.botSession(bot);
    let identityToken;
    try { identityToken = await this.identityToken(token); }
    catch (error) {
      if (error.status !== 401) throw error;
      // The owner revoked this node: ask for a new one once.
      const { [bot.centralId]: _revoked, ...botSessions } = this.state.botSessions;
      this.state = { ...this.state, botSessions };
      await this.save();
      token = await this.botSession(bot);
      identityToken = await this.identityToken(token);
    }
    const session = await this.remote(this.state.serverUrl, '/api/session', { method: 'POST', body: { identityToken } });
    if (session.user_id !== bot.id) throw new Error('服务器返回的 Bot 身份不匹配');
    try {
      const { bundle } = await this.remote(this.state.serverUrl, `/api/bots/${encodeURIComponent(bot.id)}/connect`, {
        method: 'POST', token: session.access_token, body: native ? { native } : {},
      });
      return bundle;
    } finally {
      // The node runs on the service credential in its bundle, not on this sign-in session.
      await this.remote(this.state.serverUrl, '/api/logout', { method: 'POST', token: session.access_token, body: {} }).catch(() => {});
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

  async connect(botId) {
    if (!this.state.centralToken) throw new Error('请先登录服务器');
    const bots = await this.ownedBots();
    const bot = bots.find(item => item.id === botId);
    if (!bot) throw new Error('请选择自己的 Bot');
    this.state.bots = bots;
    const existing = this.state.nodes[botId];
    if (existing && this.running.get(botId)?.status === 'online' && (await this.processes.probe(existing)).status === 'online') {
      return this.status({ refresh: false });
    }
    this.runtime = await this.processes.available();
    if (!this.runtime.available) throw new Error(this.runtime.message);
    const local = this.native ? await this.ownedNativeBot(bot.nativeBinding?.hostId === this.state.hostId ? bot.nativeBinding.nativeBotId : '', { claim: true }) : undefined;
    const source = this.models ? await this.modelSource(local ? { model: local.model, reasoningEffort: local.effort } : this.state.modelSelections?.[botId]) : undefined;
    if (this.closed) throw new Error('连接插件正在关闭');
    if (existing && this.running.has(botId)) await this.stop(existing, false);
    const bundle = await this.botBundle(bot, local ? { hostId: this.state.hostId, nativeBotId: local.id } : undefined);
    if (this.closed) throw new Error('连接插件正在关闭');
    const key = createHash('sha256').update(`${this.state.serverUrl}\n${botId}`).digest('hex').slice(0, 24);
    const directory = path.join(this.directory, 'nodes', key);
    await this.writeBundle(bot, bundle, directory);
    const node = { ...publicBot(bot), directory, serverUrl: this.state.serverUrl,
      ...(local ? { nativeBotId: local.id } : {}),
      ...(local && this.state.attentionModes[local.id] ? { attention: { mode: this.state.attentionModes[local.id] } } : {}),
      ...(!local ? { port: existing?.port || await this.selectPort() } : {}), desired: true };
    if (this.closed) throw new Error('连接插件正在关闭');
    const next = { ...this.state, nodes: { ...this.state.nodes, [botId]: node } };
    await this.save(next);
    this.state = next;
    await this.start(node, source);
    return this.status({ refresh: false });
  }

  async modelSource(selection) {
    const source = this.native ? { selection: { ...selection } } : await this.models.export(selection);
    if (this.native) {
      const catalog = await this.native.models();
      const model = catalog.providers.flatMap(provider => provider.models).find(model => model.model === selection?.model);
      if (!model) throw Object.assign(new Error('请在 DSH 中选择可用模型'), { code: 'MODEL_UNAVAILABLE' });
      if (model.needsKey) throw Object.assign(new Error('请在 DSH 中配置模型凭据'), { code: 'MISSING_CREDENTIAL' });
      return source;
    }
    const { budget } = await this.remote(this.state.serverUrl, '/api/status', { token: this.state.accessToken });
    this.modelPolicy = { maxTokens: budget?.maxTokens, allowedModels: budget?.allowedModels ?? null };
    checkModelPolicy(source.selection, this.modelPolicy);
    return source;
  }

  async start(node, preparedSource) {
    if (this.closed) throw new Error('连接插件正在关闭');
    this.running.set(node.id, { status: 'connecting', lastError: null });
    try {
      let modelConfig;
      if (this.models && !node.nativeBotId) {
        const source = preparedSource ?? await this.modelSource(this.state.modelSelections?.[node.id]);
        modelConfig = source.selection;
        await savePrivateJson(path.join(node.directory, 'model-source.json'), source);
        if (!this.state.modelSelections[node.id]) {
          const next = { ...this.state, modelSelections: { ...this.state.modelSelections, [node.id]: source.selection } };
          await this.save(next);
          this.state = next;
        }
      }
      await this.processes.start(node);
      if (this.closed) await this.processes.stop(node);
      else this.running.set(node.id, { status: 'online', lastError: null, modelConfig });
    } catch (error) {
      let message = error.message;
      if (!this.closed) {
        try { await this.processes.stop(node); } catch (stopError) { message += `\n${stopError.message}`; }
        this.running.set(node.id, { status: 'error', lastError: message });
      }
      throw Object.assign(new Error(message), { code: error.code });
    }
  }

  async stop(node, clearDesired) {
    if (clearDesired) {
      const next = { ...this.state, nodes: { ...this.state.nodes, [node.id]: { ...node, desired: false } } };
      await this.save(next);
      this.state = next;
    }
    if (this.running.has(node.id)) await this.processes.stop(node);
    this.running.delete(node.id);
  }

  async stopAll(clearDesired) {
    if (clearDesired) {
      const nodes = Object.fromEntries(Object.entries(this.state.nodes).map(([id, node]) => [id, { ...node, desired: false }]));
      const next = { ...this.state, nodes };
      await this.save(next);
      this.state = next;
    }
    // Start every cleanup before awaiting any one Bot's drain or the host shutdown deadline.
    const results = await Promise.allSettled(Object.values(this.state.nodes).map(node => this.stop(node, false)));
    const errors = results.filter(result => result.status === 'rejected').map(result => result.reason);
    if (errors.length) throw new AggregateError(errors, errors.map(error => error.message).join('\n'));
  }

  async logout() {
    await this.stopAll(true);
    const previous = this.state;
    const next = { ...previous, user: null, accessToken: null, centralToken: null, bots: [] };
    await this.save(next);
    this.state = next;
    await this.closeSessions(previous);
    return this.status({ refresh: false });
  }

  /** Link a native DSH Bot to a central Bot account (a new one unless botId names one) and bring it online. */
  async attach({ nativeBotId, botId }) {
    if (!this.native || !this.state.centralToken) throw new Error('请先登录并启用原生 DS-Bot');
    const local = await this.ownedNativeBot(nativeBotId, { claim: true });
    if (Object.values(this.state.nativeLinks).includes(local.id)) throw new Error('这个本机 Bot 已经关联了账号');
    let bot = botId ? (await this.ownedBots()).find(item => item.id === botId) : undefined;
    if (botId && !bot) throw new Error('请选择自己的 Bot');
    if (bot && this.state.nativeLinks[bot.centralId]) throw new Error('这个 Bot 账号已经关联了本机 Bot');
    if (!bot) {
      const { bot: created } = await this.remote(this.state.centralUrl, '/api/bots', { method: 'POST', token: this.state.centralToken,
        body: { username: botUsername(local.name || 'bot'), displayName: String(local.name || 'Bot').slice(0, 80) } });
      bot = { centralId: created.id, id: `@${created.username}:${this.state.serverName}` };
    }
    const next = { ...this.state, nativeLinks: { ...this.state.nativeLinks, [bot.centralId]: local.id } };
    await this.save(next);
    this.state = next;
    return this.connect(bot.id);
  }

  async handle(body) {
    if (this.closed) throw new Error('连接插件正在关闭');
    if (body.action === 'status') return this.status();
    if (body.action === 'kernel-state') {
      if (body.nativeBotId) await this.ownedNativeBot(body.nativeBotId);
      const value = await this.processes.kernelState(body.nativeBotId);
      const desired = this.state.attentionModes[body.nativeBotId];
      return { ...value, ...(desired ? { desiredAttention: { mode: desired,
        status: value.attention?.mode === desired ? 'applied' : 'pending' } } : {}) };
    }
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
    if (body.action === 'memory-profile') {
      await this.ownedNativeBot(body.nativeBotId);
      return this.native.call(body.id ? 'memory-profile' : 'memory-profiles', {
        botId: body.nativeBotId, kind: body.kind, ...(body.id ? { id: body.id } : {}),
        ...(body.roomId ? { roomId: body.roomId } : {}), ...(body.query ? { query: body.query } : {}) });
    }
    return this.serial(async () => {
      if (this.closed) throw new Error('连接插件正在关闭');
      switch (body.action) {
        case 'create-native': return this.createNative(body);
        case 'save-decision-provider': return this.processes.saveDecisionProvider({ apiKey: body.apiKey, enabled: body.enabled,
          model: body.model, endpoint: body.endpoint });
        case 'attention-update': {
          await this.ownedNativeBot(body.nativeBotId);
          if (!['mention', 'shadow', 'natural'].includes(body.mode)) throw new Error('请选择有效的参与方式');
          this.state.attentionModes[body.nativeBotId] = body.mode;
          await this.save();
          let result = { mode: body.mode, status: 'pending', online: false };
          for (const node of Object.values(this.state.nodes).filter(node => node.nativeBotId === body.nativeBotId)) {
            if (!this.state.accessToken || node.serverUrl !== this.state.serverUrl) continue;
            result = await this.remote(node.serverUrl, `/api/bots/${encodeURIComponent(node.id)}/attention`, {
              method: 'PATCH', token: this.state.accessToken, body: { mode: body.mode, ...(body.rooms ? { rooms: body.rooms } : {}) } });
          }
          return result;
        }
        case 'save-model': {
          if (!this.models || !this.state.accessToken || !this.state.bots.some(bot => bot.id === body.botId)) throw new Error('请选择自己的 Bot');
          const prior = this.state.modelSelections?.[body.botId];
          const selection = body.selection && { ...body.selection, maxTokens: body.selection.maxTokens ?? prior?.maxTokens ?? 4096 };
          const source = await this.modelSource(selection);
          if (this.native) {
            const bot = this.state.bots.find(bot => bot.id === body.botId);
            if (bot.nativeBinding?.hostId !== this.state.hostId) throw new Error('请选择本机已经绑定的 Bot');
            await this.native.selectModel(bot.nativeBinding.nativeBotId, source.selection);
            return this.status({ refresh: false });
          }
          const next = { ...this.state, modelSelections: { ...this.state.modelSelections, [body.botId]: source.selection } };
          await this.save(next);
          this.state = next;
          return this.status({ refresh: false });
        }
        case 'login': return this.login(body);
        case 'attach': return this.attach(body);
        case 'logout': return this.logout();
        case 'connect': return this.connect(body.botId);
        case 'disconnect': {
          const node = this.state.nodes[body.botId];
          if (node) await this.stop(node, true);
          return this.status({ refresh: false });
        }
        default: throw new Error('未知连接操作');
      }
    });
  }

  async dispose() {
    this.closed = true;
    const cleanup = this.stopAll(false).then(() => null, error => error);
    await this.queue;
    const error = await cleanup;
    if (error) throw error;
  }
}
