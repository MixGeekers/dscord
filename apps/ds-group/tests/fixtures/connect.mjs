import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ConnectController } from '../../dsh-connect/controller.mjs';
import { createCentral } from '../../central/service.mjs';

export const centralUrl = 'https://id.example';
export const CHAT = 'https://chat.example';
export const TWO = 'https://two.example';
export const ELSEWHERE = 'https://elsewhere.example';
const serverNames = { [CHAT]: 'chat.example', [TWO]: 'two.example', [ELSEWHERE]: 'elsewhere.example' };
// What the chat server's page shows: base64url JSON naming the server and a one-time central code.
const connectionKey = (server, code) => Buffer.from(JSON.stringify({ server, code })).toString('base64url');
const claimsOf = token => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));

/**
 * A real central server, synthetic chat servers and a synthetic DSH kernel. The controller's requests to
 * https://id.example reach the central server; chat servers answer discovery, sign-in and the node bundle.
 * The caller closes it.
 */
export async function connectFixture(options = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dscord-connect-'));
  const directory = path.join(root, 'dsh');
  let clock = Date.parse('2026-11-10T08:00:00Z');
  const central = await createCentral({ dataRoot: path.join(root, 'central'), now: () => clock, refreshIntervalMs: 0, config: { issuer: centralUrl } });
  await new Promise(resolve => central.server.listen(0, '127.0.0.1', resolve));
  const centralBase = `http://127.0.0.1:${central.server.address().port}`;
  const calls = [];
  const down = new Set();
  const request = async (url, init = {}) => {
    const { origin, pathname } = new URL(url);
    calls.push({ origin, pathname, init });
    if (down.has(origin)) throw new TypeError('fetch failed');
    if (origin === centralUrl) return fetch(centralBase + pathname, init);
    const serverName = serverNames[origin];
    const body = init.body ? JSON.parse(init.body) : {};
    if (pathname === '/.well-known/dscord/client') return Response.json({ home: { serverName },
      central: { issuer: origin === ELSEWHERE ? 'https://id.elsewhere.example' : centralUrl }, auth: { audience: origin, sessionPath: '/api/session' } });
    if (pathname === '/api/session') {
      const claims = claimsOf(body.identityToken);
      assert.equal(claims.aud, origin);
      return Response.json({ user_id: `@${claims.username}:${serverName}`, access_token: `session:${claims.username}:${serverName}` });
    }
    const connect = pathname.match(/^\/api\/bots\/(.+)\/connect$/);
    if (connect) {
      const id = decodeURIComponent(connect[1]);
      const localpart = id.slice(1, id.indexOf(':'));
      assert.equal(init.headers.Authorization, `Bearer session:${localpart}:${serverName}`, 'a Bot fetches its own node configuration');
      return Response.json({ bundle: { schemaVersion: 1, nodeId: localpart, coreUrl: origin,
        setup: { serverName, roomId: `!lobby:${serverName}`, homeserverUrl: `https://matrix.${serverName}`,
          participants: [{ id, kind: 'bot', localpart, name: 'Bot', accessToken: 'synthetic-bot-token', nativeBinding: body.native }] },
        coreConfig: { nodeSecret: 'synthetic-node-key', publicUrl: origin } } });
    }
    if (pathname === '/api/logout') return Response.json({});
    return Response.json({ error: 'Unknown route' }, { status: 404 });
  };
  const api = async (method, pathname, { token, body } = {}) => {
    const response = await fetch(centralBase + pathname, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const value = await response.json();
    assert.ok(response.ok, `${method} ${pathname}: ${JSON.stringify(value)}`);
    return value;
  };
  const register = async username => (await api('POST', '/api/register', { body: { username, password: 'correct horse', displayName: username } })).token;
  const alice = await register('alice');

  // The DSH kernel: local Bots, made once per request name however often the request is repeated.
  const locals = [];
  const receipts = new Map();
  const kernel = [];
  const catalog = { available: true, defaultSelection: { model: 'fixture/default' }, providers: [{ id: 'fixture', name: 'fixture', models: [
    { model: 'fixture/default', name: 'Default', needsKey: false }, { model: 'fixture/large', name: 'Large', needsKey: false },
    { model: 'fixture/locked', name: 'Locked', needsKey: true }] }] };
  let loseNextCreate = options.loseFirstCreate === true;
  const native = {
    list: async () => locals.map(bot => ({ ...bot, model: bot.model || 'fixture/default' })),
    models: async () => catalog,
    call: async (endpoint, input) => {
      kernel.push([endpoint, input]);
      if (endpoint === 'create-bot') {
        if (!receipts.has(input.requestId)) {
          const bot = { id: `native-${locals.length + 1}`, name: input.name, role: input.role, model: input.model, effort: input.effort, owner: input.owner };
          locals.push(bot);
          receipts.set(input.requestId, bot);
        }
        if (loseNextCreate) { loseNextCreate = false; throw new Error('Created but the answer was lost'); }
        return receipts.get(input.requestId);
      }
      if (endpoint === 'update-bot') {
        const { id, ...patch } = input;
        Object.assign(locals.find(bot => bot.id === id), patch);
        return {};
      }
      throw new Error(`Unexpected kernel call ${endpoint}`);
    },
  };
  const live = new Set();
  const effects = [];
  const refuse = new Set();
  const processes = {
    async available() { return { available: true, message: null }; },
    async start(node) {
      if (refuse.has(node.serverUrl)) throw new Error('Core is still starting');
      effects.push(['start', node.id, node.nativeBotId]);
      live.add(node.id);
    },
    async stop(node) { effects.push(['stop', node.id]); live.delete(node.id); },
    async probe(node) { return { status: live.has(node.id) ? 'online' : 'offline', lastError: null }; },
    async kernelState() { return { runtime: { id: 'dscord-kernel' }, decisionProvider: { configured: false } }; },
    decisionStatus() { return { configured: false, enabled: true, available: false, model: 'gpt-6-luna' }; },
    ...options.processes,
  };
  const settings = { directory, processes, native, request, label: 'DSH laptop', now: () => clock, updates: options.updates };
  const controller = await new ConnectController(settings).initialize();
  await controller.restoring;
  const controllers = [controller];
  const close = async () => {
    for (const item of controllers) await item.dispose().catch(() => {});
    await central.close();
    await rm(root, { recursive: true, force: true });
  };
  const key = async (token = alice, server = CHAT) => connectionKey(server, (await api('POST', '/api/connect-codes', { token, body: {} })).code);
  const login = async (token = alice, target = controller) => {
    const result = await target.handle({ action: 'login', key: await key(token) });
    await target.queue;
    return result;
  };
  const createBot = body => api('POST', '/api/bots', { token: alice, body }).then(result => result.bot);
  const managed = async id => (await api('GET', '/api/bots', { token: alice })).bots.find(bot => bot.id === id);
  const reopen = async () => {
    const next = await new ConnectController(settings).initialize();
    controllers.push(next);
    return next;
  };
  return { directory, calls, effects, live, locals, kernel, controller, settings, login, key, api, alice, register, createBot, managed, centralBase,
    down, refuse, reopen, close, advance: ms => { clock += ms; } };
}

