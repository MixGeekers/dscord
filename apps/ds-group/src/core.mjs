import { ProfileSync } from './profile-sync.mjs';
import http from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { MatrixClient } from './matrix-client.mjs';
import { ModelBudget } from './budget.mjs';
import { PushService } from './push.mjs';
import { MediaService } from './media.mjs';
import { TaskService } from './tasks.mjs';
import { ChatFeatures } from './mentions.mjs';
import { localPath, packageRoot } from './paths.mjs';
import { AccountService } from './accounts.mjs';
import { NativeBindings } from './native-bindings.mjs';
import { IdentityService } from './identity.mjs';
import { effectiveWebMode } from './web-mode.mjs';
import { NodeCredentials } from './node-auth.mjs';
import { Governance } from './governance.mjs';
import { CollaborationService } from './collaboration.mjs';
import { RoomMedia } from './room-media.mjs';
import { AttachmentAccess } from './attachment-access.mjs';
import { BotWorkService } from './bot-work.mjs';
import { readJsonBody } from './http-json.mjs';
import { KernelControl } from './kernel-control.mjs';
import { Router, httpError } from './core/router.mjs';
import { sessionRoutes } from './core/session-routes.mjs';
import { botRoutes } from './core/bot-routes.mjs';
import { attachmentRoutes } from './core/attachment-routes.mjs';
import { roomRoutes } from './core/room-routes.mjs';
import { nodeRoutes, pushRoutes, NODE_OFFLINE_MS } from './core/node-routes.mjs';
import { serverPage } from './core/server-page.mjs';
import { InviteStore } from './invites.mjs';
import { maintenance, authorizeUpdater, updateControlRoot } from './server-update-control.mjs';
import { KERNEL_VERSION, NODE_PROTOCOL } from './node-protocol.mjs';
export { readJsonBody } from './http-json.mjs';

const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

async function loadCoreConfig(dataRoot, filename = process.env.DS_GROUP_CORE_CONFIG_PATH || path.join(dataRoot, 'core-config.json')) {
  await mkdir(path.dirname(filename), { recursive: true });
  try { return JSON.parse(await readFile(filename, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const config = { nodeSecret: randomBytes(32).toString('hex'), modelCallLimit: null, maxOutputTokens: 8192 };
    await writeFile(filename, JSON.stringify(config, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    return config;
  }
}

export async function createCore({ setup, config, dataRoot = localPath(), webRoot = process.env.DS_GROUP_WEB_DIR || path.join(packageRoot, 'dist', 'web'), enablePush = true, updateControlDir = updateControlRoot() } = {}) {
  setup ||= JSON.parse(await readFile(process.env.DS_GROUP_MATRIX_SETUP_PATH || path.join(dataRoot, 'matrix-setup.json'), 'utf8'));
  setup = { ...setup, homeserverUrl: process.env.DS_GROUP_MATRIX_URL || setup.homeserverUrl };
  config ||= await loadCoreConfig(dataRoot);
  const webMode = effectiveWebMode(config);
  const proxySetting = process.env.DS_GROUP_TRUST_PROXY;
  if (proxySetting !== undefined && !['true', 'false'].includes(proxySetting)) throw new Error('DS_GROUP_TRUST_PROXY must be true or false');
  if (config.trustProxy !== undefined && typeof config.trustProxy !== 'boolean') throw new Error('trustProxy must be a boolean');
  const trustProxy = proxySetting === undefined ? config.trustProxy === true : proxySetting === 'true';
  if (typeof config.nodeSecret !== 'string' || !config.nodeSecret) throw new Error('Core nodeSecret is required');
  await mkdir(dataRoot, { recursive: true });
  let push;
  const accounts = await new AccountService({ setup, config, dataRoot,
    onParticipant: async person => { if (push) await push.upsertParticipant(person); },
  }).initialize();
  const nativeBots = new NativeBindings(accounts);
  setup.serverName ||= accounts.serverName || 'localhost';
  let identity;
  try {
    // DS_GROUP_CENTRAL_FETCH_URL reaches the central server inside a container network; tokens still name its public issuer.
    identity = new IdentityService({ accounts, setup, config, centralUrl: process.env.DS_GROUP_CENTRAL_FETCH_URL }).initialize();
  } catch (error) {
    accounts.close();
    throw error;
  }
  const profiles = new ProfileSync({ accounts, trust: identity.central });
  const governance = new Governance({ dataRoot, serverName: setup.serverName });
  const collaboration = new CollaborationService({ setup, governance, accounts });
  const invites = new InviteStore({ dataRoot });
  // What a client reads before signing in: the central server to use, and whether joining here needs an invitation.
  const discovery = async () => {
    const { directory } = await governance.read();
    return { ...identity.discovery(), directory: { join: directory.join, number: directory.number } };
  };
  const roomMedia = new RoomMedia({ governance });
  const directorySetup = { ...setup, participants: [] };
  const nodeCredentials = await new NodeCredentials({ dataRoot, setup, legacySecret: config.nodeSecret }).initialize();
  const budget = new ModelBudget(path.join(dataRoot, 'model-budget.sqlite'), {
    limit: config.modelCallLimit, maxTokens: config.maxOutputTokens, allowedModels: config.allowedModels,
  });
  const media = new MediaService({ dataRoot, maxBytes: config.maxUploadBytes ?? process.env.DS_GROUP_MAX_UPLOAD_BYTES,
    verifiedDownloadMaxBytes: config.verifiedDownloadMaxBytes, verifiedDownloadConcurrency: config.verifiedDownloadConcurrency });
  const attachmentAccess = new AttachmentAccess({ media, roomMedia, accounts });
  const chat = new DatabaseSync(path.join(dataRoot, 'chat.sqlite'));
  const chatFeatures = new ChatFeatures({ setup: directorySetup, dataRoot });
  chatFeatures.ownerId = accounts.ownerId;
  push = enablePush ? new PushService({ dataRoot, setup,
    onEvent: (userId, event) => chatFeatures.recordEvents(userId, [event]),
    shouldNotify: (userId, event) => chatFeatures.shouldNotify(userId, event),
  }) : null;
  if (push) await push.start();
  const nodes = new Map();
  const kernelControl = await new KernelControl({ dataRoot, accounts, node: botId => nodes.get(botId),
    rpcTimeoutMs: config.kernelRpcTimeoutMs, leaseMs: config.kernelLeaseMs }).initialize();
  const startedAt = new Date().toISOString();
  let directory = await collaboration.directory();
  directorySetup.participants = directory;
  const publicParticipants = () => directory;
  const authorizeNode = request => nodeCredentials.authorize(request);
  const tasks = new TaskService({ setup, dataRoot, authorizeNode, readJsonBody, participants: publicParticipants });
  const botWork = new BotWorkService({ setup, accounts, governance, dataRoot, authorizeNode, readJsonBody, tasks,
    nativeBot: id => nativeBots.isNative(id), maxBytes: () => media.maxBytes });
  const app = { setup, config, accounts, nativeBots, identity, discovery, invites, governance, nodeCredentials, budget, media, attachmentAccess, chat, chatFeatures, tasks,
    push, nodes, kernelControl, trustProxy, webMode, startedAt, publicParticipants,
    updateMaintenance: () => maintenance(updateControlDir),
    nodeSnapshot: () => accounts.publicParticipants().filter(p => p.kind === 'bot').map(participant => {
      const active = nodes.get(participant.id);
      if (!active) return { id: participant.localpart, botId: participant.id, name: participant.name, status: 'offline', engine: 'DSCord node' };
      // Owner-only kernel settings and memory counts stay out of public status.
      const { kernel, kernelControl: control, ...visible } = active;
      return { ...visible, status: Date.now() - active.heartbeatAt > NODE_OFFLINE_MS ? 'offline' : active.status };
    }) };
  const router = new Router();
  for (const register of [sessionRoutes, pushRoutes, botRoutes, attachmentRoutes, roomRoutes, nodeRoutes]) register(router, app);
  // Feature services that route their own paths.
  const delegates = [collaboration, kernelControl, botWork, tasks, chatFeatures];
  const unauthenticated = new Set(['/api/session', '/api/logout', '/api/bootstrap', '/api/status', '/api/push/config']);
  const activeWrites = new Set();

  async function dispatch(request, response) {
    const url = new URL(request.url, 'http://localhost');
    const { pathname } = url;
    const send = (status, value) => { response.writeHead(status, jsonHeaders); response.end(JSON.stringify(value)); };
    const gate = await maintenance(updateControlDir);
    if (pathname === '/internal/server-update/status' && request.method === 'GET') {
      if (!await authorizeUpdater(request, updateControlDir)) return send(403, { error: 'Updater authorization required' });
      const live = [...nodes.values()].filter(node => node.status !== 'offline' && Date.now() - node.heartbeatAt < NODE_OFFLINE_MS);
      const activeTasks = tasks.db.prepare("SELECT COUNT(*) AS count FROM file_tasks WHERE status IN ('running','unknown')").get().count;
      const blocked = live.filter(node => node.maintenanceId !== gate?.id || node.status !== 'idle'
        || node.pendingUpdates || (node.kernel?.work?.activeTasks ?? 0) > 0 || node.maintenanceBusy);
      return send(200, { version: KERNEL_VERSION, protocol: NODE_PROTOCOL, maintenanceId: gate?.id || null,
        drained: Boolean(gate) && !activeWrites.size && !activeTasks && !blocked.length,
        activeTasks, activeRequests: activeWrites.size, blockedNodes: blocked.map(node => node.botId) });
    }
    if (gate && ((pathname.startsWith('/api/') && (gate.phase === 'verifying' || !['GET', 'HEAD', 'OPTIONS'].includes(request.method)))
      || (gate.phase === 'verifying' && pathname.startsWith('/internal/') && !['/internal/nodes/heartbeat', '/internal/node/hello'].includes(pathname)))) {
      response.setHeader('Retry-After', '10');
      return send(503, { error: 'Server update in progress', code: 'SERVER_MAINTENANCE' });
    }
    identity.cors(request, response, pathname);
    const isApi = pathname.startsWith('/api/');
    const isInternal = pathname.startsWith('/internal/');
    if (request.method === 'OPTIONS' && (isApi || pathname.startsWith('/.well-known/'))) {
      response.writeHead(204, { 'Cache-Control': 'no-store' }); response.end(); return;
    }
    if (request.method === 'GET' && (pathname === '/.well-known/dscord/client' || pathname === '/api/client-config')) return send(200, await discovery());
    if (request.method === 'GET' && pathname === '/.well-known/dscord/server') {
      // The page the central server's index reads; it only exists once an operator has started listing this server.
      const page = serverPage({ policy: await governance.read(), identity, participants: accounts.publicParticipants() });
      if (!page) return send(404, { error: 'This server is not in a directory', code: 'NOT_LISTED' });
      return send(200, page);
    }
    if (request.method === 'GET' && pathname === '/.well-known/matrix/client') return send(200, {
      'm.homeserver': { base_url: identity.home.matrixUrl }, 'org.dscord.client': { base_url: identity.home.coreUrl },
    });
    if (pathname.startsWith('/admin-api/') || pathname === '/admin.html') return send(404, { error: 'Use the separate administration service' });
    const token = () => {
      const authorization = request.headers.authorization || '';
      if (!authorization.startsWith('Bearer ')) throw httpError(401, 'Please sign in');
      return authorization.slice(7);
    };
    let policy;
    if (isApi || isInternal) {
      policy = await governance.read();
      directory = await collaboration.directory();
      directorySetup.participants = directory;
      media.maxBytes = policy.settings.maxUploadBytes ?? Number(config.maxUploadBytes ?? process.env.DS_GROUP_MAX_UPLOAD_BYTES ?? 52428800);
    }
    // Every ordinary credential is checked at this home; no caller-selected upstream is used.
    if (isApi && !unauthenticated.has(pathname)) request.dsIdentity = await accounts.authenticate(token());
    const userId = request.dsIdentity?.user_id;
    let matrix;
    const client = () => (matrix ||= new MatrixClient({ baseUrl: setup.homeserverUrl, accessToken: token() }));
    const delegate = delegates.find(service => service.handles(pathname));
    if (delegate === kernelControl) {
      return isApi ? kernelControl.handle({ request, response, url, send, userId, readJsonBody })
        : kernelControl.handle({ request, response, url, send, scope: authorizeNode(request), readJsonBody });
    }
    if (delegate === chatFeatures) return chatFeatures.handle({ request, url, userId, client: client(), readJsonBody, send });
    if (delegate) return delegate.handle({ request, url, send });
    const route = router.match(request.method, pathname);
    if (isInternal) {
      const scope = authorizeNode(request);
      if (!route) return send(404, { error: 'Unknown internal endpoint' });
      return route.handler({ request, response, url, send, scope, body: () => readJsonBody(request) }, ...route.params);
    }
    if (route) return route.handler({ request, response, url, send, userId, token, client, policy: async () => policy,
      body: () => readJsonBody(request) }, ...route.params);
    if (webMode === 'api-only' && !isApi) return send(404, { error: 'The chat client is hosted separately', code: 'WEB_DISABLED' });
    if (webMode === 'bundled' && request.method === 'GET' && !isApi) {
      const filename = path.resolve(webRoot, pathname === '/' ? 'index.html' : pathname.slice(1));
      if (!filename.startsWith(path.resolve(webRoot) + path.sep)) return send(404, { error: 'Not found' });
      try {
        const body = await readFile(filename);
        response.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
        response.end(body);
        return;
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    send(404, { error: 'Not found' });
  }
  const server = http.createServer((request, response) => {
    if (request.url.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      activeWrites.add(request);
      response.once('close', () => activeWrites.delete(request));
    }
    dispatch(request, response).catch(error => {
      if (response.headersSent || response.destroyed) { response.destroy(); return; }
      const retryAfterMs = Number.isSafeInteger(error.retryAfterMs) && error.retryAfterMs >= 0 ? error.retryAfterMs : undefined;
      response.writeHead(error.status || error.statusCode || 500, {
        ...jsonHeaders, ...(retryAfterMs === undefined ? {} : { 'Retry-After': String(Math.ceil(retryAfterMs / 1000)) }),
      });
      response.end(JSON.stringify({ error: error.message, code: error.code || error.errcode || 'REQUEST_FAILED',
        ...(error.nodeCode === undefined ? {} : { nodeCode: error.nodeCode }),
        ...(retryAfterMs === undefined ? {} : { retry_after_ms: retryAfterMs }) }));
    });
  });
  return { server, profiles, budget, push, media, tasks, chatFeatures, accounts, identity, nodeCredentials, governance, collaboration, botWork, kernelControl, close: async () => {
    await profiles.close();
    media.verified.stop();
    kernelControl.close();
    await new Promise(resolve => server.close(resolve));
    if (push) await push.close();
    await nodeCredentials.close();
    accounts.close();
    invites.close();
    await media.close();
    tasks.close();
    botWork.close();
    chatFeatures.close();
    budget.close();
    chat.close();
  } };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const core = await createCore();
  const port = Number(process.env.DS_GROUP_PORT || 18100);
  const host = process.env.DS_GROUP_HOST || '127.0.0.1';
  core.server.listen(port, host, () => console.log(`DS-Group ready at http://${host}:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await core.close(); process.exit(0); });
}
