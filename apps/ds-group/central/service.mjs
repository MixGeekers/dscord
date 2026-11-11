import { Avatars } from './avatars.mjs';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { localPath, packageRoot } from '../src/paths.mjs';
import { readJsonBody } from '../src/http-json.mjs';
import { Router } from '../src/core/router.mjs';
import { usernameRule, publicRule } from './rules.mjs';
import { CentralStore, failure } from './store.mjs';
import { LISTING_MODES, ServerDirectory } from './directory.mjs';
import { IDENTITY_TOKEN_TTL_SECONDS, loadSigningKey, publicJwks, signIdentityToken } from './tokens.mjs';

const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const loopback = new Set(['localhost', '127.0.0.1', '[::1]']);

function origin(value, name) {
  let url;
  try { url = new URL(String(value)); } catch { throw new Error(`${name} must be an absolute URL`); }
  if (url.origin !== String(value).replace(/\/$/, '')) throw new Error(`${name} must be a bare origin without a path`);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback.has(url.hostname))) throw new Error(`${name} must use HTTPS`);
  return url.origin;
}

/** A chat server is named by its origin; anything else is refused before a token is issued. */
function audienceOf(value) {
  try { return origin(typeof value === 'string' ? value : '', 'audience'); }
  catch { throw failure(400, 'AUDIENCE_INVALID', 'Name the chat server by its HTTPS origin'); }
}

function serverOrigin(value) {
  try { return origin(typeof value === 'string' ? value : '', 'origin'); }
  catch { throw failure(400, 'SERVER_ORIGIN_INVALID', 'Name the chat server by its HTTPS origin'); }
}

export function centralOptions(config = {}) {
  const issuer = origin(config.issuer, 'issuer');
  const domain = config.domain ?? new URL(issuer).hostname;
  if (typeof domain !== 'string' || !/^[a-z0-9.-]+$/.test(domain)) throw new Error('domain must be a lowercase host name');
  if (config.registration !== undefined && !['open', 'closed'].includes(config.registration)) throw new Error('registration must be open or closed');
  if (config.listing !== undefined && !LISTING_MODES.includes(config.listing)) throw new Error('listing must be review or open');
  const admins = (config.admins ?? []).map(name => String(name).trim().toLowerCase()).filter(Boolean);
  const clientOrigins = (config.clientOrigins ?? []).map(value => origin(value, 'clientOrigins'));
  const serverFetchUrls = Object.fromEntries(Object.entries(config.serverFetchUrls ?? {})
    .map(([key, value]) => [origin(key, 'serverFetchUrls'), new URL(String(value)).href.replace(/\/$/, '')]));
  return { issuer, domain, registration: config.registration ?? 'open', listing: config.listing ?? 'review', admins,
    rule: usernameRule(config.usernameRule), clientOrigins, serverFetchUrls };
}

/**
 * The saved configuration. On first start a deployment may seed it from the environment
 * (DSCORD_CENTRAL_ISSUER, DSCORD_CENTRAL_REGISTRATION, DSCORD_CENTRAL_LISTING, DSCORD_CENTRAL_ADMINS, DSCORD_CENTRAL_CLIENT_ORIGINS,
 * DSCORD_CENTRAL_SERVER_FETCH_URLS); after that the file is the configuration. Registration and listing are only the starting
 * values: administrators change them in the panel, and the saved choice wins from then on.
 */
export async function loadConfig(dataRoot, env = process.env) {
  const filename = env.DSCORD_CENTRAL_CONFIG_PATH || path.join(dataRoot, 'central-config.json');
  try { return JSON.parse(await readFile(filename, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT' || !env.DSCORD_CENTRAL_ISSUER) throw error; }
  const list = value => (value || '').split(',').map(item => item.trim()).filter(Boolean);
  const config = { issuer: env.DSCORD_CENTRAL_ISSUER, registration: env.DSCORD_CENTRAL_REGISTRATION || 'open',
    listing: env.DSCORD_CENTRAL_LISTING || 'review', admins: list(env.DSCORD_CENTRAL_ADMINS), clientOrigins: list(env.DSCORD_CENTRAL_CLIENT_ORIGINS) };
  // origin=fetch-url pairs, for chat servers whose public origin is not reachable from where central runs.
  const fetchUrls = list(env.DSCORD_CENTRAL_SERVER_FETCH_URLS).map(pair => pair.split('=').map(part => part.trim()));
  if (fetchUrls.length) config.serverFetchUrls = Object.fromEntries(fetchUrls);
  centralOptions(config);
  await writeFile(filename, JSON.stringify(config, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  return config;
}

const REFRESH_INTERVAL_MS = 60 * 60 * 1000;

const staticTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2' };

export async function createCentral({ dataRoot = localPath('central'), config, now = Date.now, fetch = globalThis.fetch,
  refreshIntervalMs = REFRESH_INTERVAL_MS, adminWebRoot = process.env.DSCORD_CENTRAL_ADMIN_WEB_DIR || path.join(packageRoot, 'dist/central-admin') } = {}) {
  await mkdir(dataRoot, { recursive: true, mode: 0o700 });
  config ||= await loadConfig(dataRoot);
  const options = centralOptions(config);
  const key = await loadSigningKey(path.join(dataRoot, 'signing-key.json'));
  const filename = path.join(dataRoot, 'central.sqlite');
  const store = new CentralStore({ filename, rule: options.rule, domain: options.domain, now });
  await chmod(filename, 0o600);
  const avatars = new Avatars({ store, dataRoot, issuer: options.issuer, config: config.avatars });
  const directory = new ServerDirectory({ db: store.db, issuer: options.issuer, now, fetch, fetchVia: options.serverFetchUrls });
  const jwks = publicJwks(key);
  const settings = () => ({ registration: store.setting('registration', options.registration), listing: store.setting('listing', options.listing) });
  const discovery = {
    issuer: options.issuer, domain: options.domain, registration: settings().registration,
    usernameRule: publicRule(options.rule), globalIdFormat: `{username}@${options.domain}`,
    jwksUri: `${options.issuer}/.well-known/jwks.json`, identityTokenTtlSeconds: IDENTITY_TOKEN_TTL_SECONDS,
    deviceVerificationUri: `${options.issuer}/device`, serverIndexUri: `${options.issuer}/api/servers`,
  };

  const router = new Router();
  const signedIn = request => {
    const authorization = request.headers.authorization || '';
    return store.authenticate(authorization.startsWith('Bearer ') ? authorization.slice(7) : '');
  };
  const person = request => {
    const signed = signedIn(request);
    if (signed.account.kind !== 'human') throw failure(403, 'HUMAN_REQUIRED');
    return signed;
  };

  const administrator = request => {
    const signed = person(request);
    if (!options.admins.includes(signed.account.username)) throw failure(403, 'ADMIN_REQUIRED', 'This account does not administer this central');
    return signed;
  };

  discovery.avatars = { maxUploadBytes: avatars.options.maxUploadBytes, sizes: avatars.options.sizes };
  router.get('/.well-known/dscord/central', ({ send }) => send(200, discovery));
  router.get('/.well-known/jwks.json', ({ send }) => send(200, jwks));

  router.post('/api/register', async ({ body, send }) => {
    if (settings().registration !== 'open') throw failure(403, 'REGISTRATION_CLOSED');
    const input = await body();
    const account = await store.createHuman(input);
    send(201, { token: store.openSession(account, 'login', 'password'), account: store.view(account) });
  });
  router.post('/api/login', async ({ body, send }) => {
    const input = await body();
    const { token, account } = await store.login(input.username, input.password);
    send(200, { token, account: store.view(account) });
  });
  router.post('/api/logout', ({ request, send }) => { store.closeSession(signedIn(request).session); send(200, { loggedOut: true }); });
  router.get('/api/me', ({ request, send }) => send(200, { account: store.view(signedIn(request).account) }));
  router.delete('/api/me', ({ request, send }) => { store.closeAccount(person(request).account); send(200, { closed: true }); });

  // Avatars are public identity images; edits always require the person or the Bot's owner.
  router.get('/api/profiles', ({ url, response, send }) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    const ids = (url.searchParams.get('ids') || '').split(',').filter(Boolean);
    if (ids.length > 100 || ids.some(id => id.length > 256)) throw failure(400, 'PROFILE_BATCH_LIMIT');
    send(200, { profiles: [...new Set(ids)].flatMap(id => {
      const account = store.account(id) || (id.endsWith(`@${options.domain}`) ? store.db.prepare('SELECT * FROM accounts WHERE username=?').get(id.slice(0, -(options.domain.length + 1))) : undefined);
      return account?.status === 'active' ? [avatars.profile(account)] : [];
    }) });
  });
  router.get(/^\/avatars\/([a-f0-9]{64})\/(\d+)\.webp$/, ({ response }, id, size) => avatars.serve(response, id, size));
  for (const route of ['/api/me/avatar', /^\/api\/bots\/([^/]+)\/avatar$/]) {
    const target = (request, id) => {
      const { account } = person(request);
      return id ? store.ownedBot(account, id) : account;
    };
    router.get(route, ({ request, send }, id) => send(200, { profile: avatars.profile(target(request, id)), maxUploadBytes: avatars.options.maxUploadBytes }));
    router.on('PUT', route, async ({ request, url, send }, id) => {
      const account = target(request, id);
      const version = avatars.expected(account, url.searchParams.get('version'));
      const asset = await avatars.upload(request, url.searchParams);
      target(request, id); // Recheck authorization after decoding and writing.
      send(200, { profile: avatars.commit(account, version, asset) });
    });
    router.delete(route, ({ request, url, send }, id) => {
      const account = target(request, id);
      send(200, { profile: avatars.commit(account, avatars.expected(account, url.searchParams.get('version')), null) });
    });
  }

  // A person's own DSH signs in with a connection key made on a chat server's page; the key carries one of these codes.
  router.post('/api/connect-codes', ({ request, send }) => send(201, store.startConnect(person(request).account)));
  router.post('/api/connect-codes/redeem', async ({ body, send }) => {
    const input = await body();
    const label = typeof input.label === 'string' && input.label.trim() ? input.label.trim().slice(0, 80) : 'DSH';
    const { token, account } = store.redeemConnect(input.code, label);
    send(200, { token, account: store.view(account) });
  });

  // The one way to sign in to a chat server, for people and Bots alike.
  router.post('/api/identity-tokens', async ({ request, body, send }) => {
    const { account } = signedIn(request);
    const input = await body();
    const audience = audienceOf(input.audience);
    store.grant(account, audience, { allowNew: input.allowNew === true });
    const view = store.view(account);
    const issuedAt = Math.floor(now() / 1000);
    const claims = { iss: options.issuer, sub: account.id, aud: audience, iat: issuedAt, exp: issuedAt + IDENTITY_TOKEN_TTL_SECONDS,
      jti: randomUUID(), username: view.username, gid: view.globalId, kind: view.kind, name: view.displayName,
      ...(view.owner ? { owner: view.owner } : {}) };
    send(200, { token: signIdentityToken(key, claims), expiresIn: IDENTITY_TOKEN_TTL_SECONDS, audience });
  });
  router.get('/api/grants', ({ request, send }) => send(200, { grants: store.grantsOf(signedIn(request).account) }));
  router.delete(/^\/api\/grants\/([^/]+)$/, ({ request, send }, audience) => {
    store.revokeGrant(signedIn(request).account, audienceOf(audience));
    send(200, { revoked: true });
  });

  // A Bot is set up here, from any chat server's page, and the device that runs it follows.
  router.post('/api/bots', async ({ request, body, send }) => {
    const { account } = person(request);
    send(201, { bot: store.managedBot(store.createBot(account, await body(), { serverOrigin })) });
  });
  router.get('/api/bots', ({ request, send }) => send(200, { bots: store.botsOf(person(request).account).map(bot => store.managedBot(bot)) }));
  router.on('PATCH', /^\/api\/bots\/([^/]+)$/, async ({ request, body, send }, botId) => {
    const { account } = person(request);
    send(200, { bot: store.managedBot(store.updateBot(account, store.ownedBot(account, botId), await body(), { serverOrigin })) });
  });
  router.delete(/^\/api\/bots\/([^/]+)$/, ({ request, send }, botId) => {
    store.closeAccount(store.ownedBot(person(request).account, botId));
    send(200, { closed: true });
  });
  router.get(/^\/api\/bots\/([^/]+)\/grants$/, ({ request, send }, botId) =>
    send(200, { grants: store.grantsOf(store.ownedBot(person(request).account, botId)) }));
  router.delete(/^\/api\/bots\/([^/]+)\/grants\/([^/]+)$/, ({ request, send }, botId, audience) => {
    store.revokeGrant(store.ownedBot(person(request).account, botId), audienceOf(audience));
    send(200, { revoked: true });
  });
  router.get(/^\/api\/bots\/([^/]+)\/nodes$/, ({ request, send }, botId) =>
    send(200, { nodes: store.nodesOf(store.ownedBot(person(request).account, botId)) }));
  router.delete(/^\/api\/bots\/([^/]+)\/nodes\/([^/]+)$/, ({ request, send }, botId, nodeId) => {
    store.revokeNode(store.ownedBot(person(request).account, botId), nodeId);
    send(200, { revoked: true });
  });

  // The person's DSH devices. Each reports every few seconds and is told which Bots to run and how.
  router.get('/api/devices', ({ request, send }) => send(200, { devices: store.devicesOf(person(request).account) }));
  router.post(/^\/api\/devices\/([^/]+)\/sync$/, async ({ request, body, send }, deviceId) => {
    const { account, session } = person(request);
    send(200, store.syncDevice(account, session, deviceId, await body()));
  });
  router.delete(/^\/api\/devices\/([^/]+)$/, ({ request, send }, deviceId) => {
    store.removeDevice(person(request).account, deviceId);
    send(200, { removed: true });
  });

  // A Bot has no password: its owner approves a node by the code the node shows.
  router.post('/api/device', async ({ body, send }) => {
    const input = await body();
    const label = typeof input.label === 'string' && input.label.trim() ? input.label.trim().slice(0, 80) : 'DSH node';
    send(200, { ...store.startDevice(label), verificationUri: discovery.deviceVerificationUri, interval: 5 });
  });
  router.post('/api/device/approve', async ({ request, body, send }) => {
    const { account } = person(request);
    const input = await body();
    const { bot, label } = store.approveDevice(account, input.userCode, input.botId);
    send(200, { bot: store.view(bot), label });
  });
  router.post('/api/device/token', async ({ body, send }) => {
    const { token, account } = store.redeemDevice((await body()).deviceCode);
    send(200, { token, account: store.view(account) });
  });

  // The server index. Anyone may search it, and any chat server may submit itself; this central's administrators decide what is listed.
  router.get('/api/servers', ({ url, response, send }) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    send(200, { servers: directory.search(Object.fromEntries(url.searchParams)) });
  });
  router.post('/api/servers', async ({ body, send }) =>
    send(200, { server: await directory.submit(serverOrigin((await body()).origin), { review: settings().listing === 'review' }) }));

  // The administrators named in the configuration run this central from its panel at /admin.
  router.get('/api/admin/overview', ({ request, send }) => {
    const { account } = administrator(request);
    send(200, { account: store.view(account), issuer: options.issuer, settings: settings(), servers: directory.counts(), accounts: store.accountCounts() });
  });
  router.post('/api/admin/settings', async ({ request, body, send }) => {
    administrator(request);
    const input = await body();
    if (input.registration !== undefined) {
      if (!['open', 'closed'].includes(input.registration)) throw failure(400, 'REGISTRATION_INVALID');
      store.saveSetting('registration', input.registration);
    }
    if (input.listing !== undefined) {
      if (!LISTING_MODES.includes(input.listing)) throw failure(400, 'LISTING_INVALID');
      store.saveSetting('listing', input.listing);
    }
    discovery.registration = settings().registration;
    send(200, { settings: settings() });
  });
  router.get('/api/admin/servers', ({ request, url, send }) => {
    administrator(request);
    send(200, { servers: directory.list({ status: url.searchParams.get('status') || '' }) });
  });
  router.post(/^\/api\/admin\/servers\/([^/]+)\/decision$/, async ({ request, body, send }, value) => {
    administrator(request);
    const input = await body();
    send(200, { server: directory.decide(serverOrigin(value), input.status, input.note ?? '') });
  });
  router.post(/^\/api\/admin\/servers\/([^/]+)\/refresh$/, async ({ request, send }, value) => {
    administrator(request);
    const server = serverOrigin(value);
    directory.existing(server);
    send(200, { server: directory.adminView(await directory.refresh(server)) });
  });
  router.delete(/^\/api\/admin\/servers\/([^/]+)$/, ({ request, send }, value) => {
    administrator(request);
    directory.remove(serverOrigin(value));
    send(200, { removed: true });
  });
  router.get('/api/admin/accounts', ({ request, url, send }) => {
    administrator(request);
    send(200, { accounts: store.accounts(Object.fromEntries(url.searchParams)) });
  });
  router.post(/^\/api\/admin\/accounts\/([^/]+)\/(disable|enable)$/, ({ request, send }, id, action) => {
    const { account } = administrator(request);
    if (id === account.id) throw failure(409, 'ADMIN_SELF', 'An administrator cannot disable their own account');
    send(200, { account: store.view(store.setDisabled(id, action === 'disable')) });
  });

  // The panel itself: a static single-page app.
  router.get(/^\/admin(\/.*)?$/, async ({ response }, rest = '/') => {
    const relative = path.normalize(rest === '/' || !path.extname(rest) ? '/index.html' : rest);
    let bytes;
    try { bytes = await readFile(path.join(adminWebRoot, relative)); }
    catch (error) { if (error.code === 'ENOENT' || error.code === 'EISDIR') throw failure(404, 'NOT_FOUND', 'Not found'); throw error; }
    response.writeHead(200, { 'Content-Type': staticTypes[path.extname(relative)] || 'application/octet-stream',
      'Cache-Control': relative === '/index.html' ? 'no-store' : 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' });
    response.end(bytes);
  });

  function cors(request, response) {
    const from = request.headers.origin;
    if (!from || !options.clientOrigins.includes(from)) return;
    response.setHeader('Access-Control-Allow-Origin', from);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
  }

  async function dispatch(request, response) {
    const url = new URL(request.url, 'http://localhost');
    const send = (status, value) => { response.writeHead(status, jsonHeaders); response.end(JSON.stringify(value)); };
    cors(request, response);
    if (request.method === 'OPTIONS') { response.writeHead(204, { 'Cache-Control': 'no-store' }); response.end(); return; }
    const route = router.match(request.method, url.pathname);
    if (!route) return send(404, { error: 'Not found', code: 'NOT_FOUND' });
    return route.handler({ request, response, url, send, body: () => readJsonBody(request) }, ...route.params);
  }

  const server = http.createServer((request, response) => {
    dispatch(request, response).catch(error => {
      if (response.headersSent || response.destroyed) { response.destroy(); return; }
      const status = error.status || 500;
      response.writeHead(status, jsonHeaders);
      response.end(JSON.stringify({ error: status === 500 ? 'Internal error' : error.message, code: error.code || 'REQUEST_FAILED' }));
      if (status === 500) console.error(error);
    });
  });
  let refreshing = Promise.resolve();
  const timer = refreshIntervalMs > 0 ? setInterval(() => {
    refreshing = refreshing.then(() => directory.refreshAll()).catch(error => console.error(error));
  }, refreshIntervalMs) : undefined;
  timer?.unref();
  return { server, store, avatars, directory, discovery, jwks, settings, close: async () => {
    clearInterval(timer);
    await new Promise(resolve => server.close(resolve));
    await refreshing;
    store.close();
  } };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const central = await createCentral({ dataRoot: process.env.DSCORD_CENTRAL_DATA_DIR || localPath('central') });
  const port = Number(process.env.DSCORD_CENTRAL_PORT || 18200);
  const host = process.env.DSCORD_CENTRAL_HOST || '127.0.0.1';
  central.server.listen(port, host, () => console.log(`DSCord Central ready at http://${host}:${port} (issuer ${central.discovery.issuer})`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await central.close(); process.exit(0); });
}
