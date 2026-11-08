import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { localPath } from '../src/paths.mjs';
import { readJsonBody } from '../src/http-json.mjs';
import { Router } from '../src/core/router.mjs';
import { usernameRule, publicRule } from './rules.mjs';
import { CentralStore, failure } from './store.mjs';
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

export function centralOptions(config = {}) {
  const issuer = origin(config.issuer, 'issuer');
  const domain = config.domain ?? new URL(issuer).hostname;
  if (typeof domain !== 'string' || !/^[a-z0-9.-]+$/.test(domain)) throw new Error('domain must be a lowercase host name');
  if (config.registration !== undefined && !['open', 'closed'].includes(config.registration)) throw new Error('registration must be open or closed');
  const clientOrigins = (config.clientOrigins ?? []).map(value => origin(value, 'clientOrigins'));
  return { issuer, domain, registration: config.registration ?? 'open', rule: usernameRule(config.usernameRule), clientOrigins };
}

export async function createCentral({ dataRoot = localPath('central'), config, now = Date.now } = {}) {
  await mkdir(dataRoot, { recursive: true, mode: 0o700 });
  config ||= JSON.parse(await readFile(process.env.DSCORD_CENTRAL_CONFIG_PATH || path.join(dataRoot, 'central-config.json'), 'utf8'));
  const options = centralOptions(config);
  const key = await loadSigningKey(path.join(dataRoot, 'signing-key.json'));
  const filename = path.join(dataRoot, 'central.sqlite');
  const store = new CentralStore({ filename, rule: options.rule, domain: options.domain, now });
  await chmod(filename, 0o600);
  const jwks = publicJwks(key);
  const discovery = {
    issuer: options.issuer, domain: options.domain, registration: options.registration,
    usernameRule: publicRule(options.rule), globalIdFormat: `{username}@${options.domain}`,
    jwksUri: `${options.issuer}/.well-known/jwks.json`, identityTokenTtlSeconds: IDENTITY_TOKEN_TTL_SECONDS,
    deviceVerificationUri: `${options.issuer}/device`,
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

  router.get('/.well-known/dscord/central', ({ send }) => send(200, discovery));
  router.get('/.well-known/jwks.json', ({ send }) => send(200, jwks));

  router.post('/api/register', async ({ body, send }) => {
    if (options.registration !== 'open') throw failure(403, 'REGISTRATION_CLOSED');
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

  router.post('/api/bots', async ({ request, body, send }) => {
    const { account } = person(request);
    send(201, { bot: store.view(store.createBot(account, await body())) });
  });
  router.get('/api/bots', ({ request, send }) => send(200, { bots: store.botsOf(person(request).account).map(bot => store.view(bot)) }));
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

  function cors(request, response) {
    const from = request.headers.origin;
    if (!from || !options.clientOrigins.includes(from)) return;
    response.setHeader('Access-Control-Allow-Origin', from);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE');
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
  return { server, store, discovery, jwks, close: async () => {
    await new Promise(resolve => server.close(resolve));
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
