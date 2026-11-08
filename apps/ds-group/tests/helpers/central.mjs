import http from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createCentral } from '../../central/service.mjs';

export const listen = (server, port = 0) => new Promise(resolve => server.listen(port, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`)));
export const stop = server => new Promise(resolve => server.close(resolve));

async function freePort() {
  const probe = http.createServer();
  await listen(probe);
  const { port } = probe.address();
  await stop(probe);
  return port;
}

async function call(base, route, { method = 'GET', token, body } = {}) {
  const response = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const value = await response.json();
  if (!response.ok) throw Object.assign(new Error(value.error), { status: response.status, code: value.code });
  return value;
}

/** A real central server on loopback, with helpers that act as its people and Bots. */
export async function startCentral(t, config = {}) {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), 'dscord-test-central-'));
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const central = await createCentral({ dataRoot, config: { issuer: url, ...config } });
  await listen(central.server, port);
  t.after(async () => { await central.close(); await rm(dataRoot, { recursive: true, force: true }); });
  const api = (route, options) => call(url, route, options);
  return {
    url, central, api, domain: central.discovery.domain,
    async person(username, displayName = username) {
      return (await api('/api/register', { method: 'POST', body: { username, password: `${username}-password`, displayName } })).token;
    },
    async bot(ownerToken, username, displayName = username) {
      const { bot } = await api('/api/bots', { method: 'POST', token: ownerToken, body: { username, displayName } });
      const { deviceCode, userCode } = await api('/api/device', { method: 'POST', body: { label: 'test node' } });
      await api('/api/device/approve', { method: 'POST', token: ownerToken, body: { userCode, botId: bot.id } });
      return { bot, token: (await api('/api/device/token', { method: 'POST', body: { deviceCode } })).token };
    },
    async identityToken(token, audience) {
      return (await api('/api/identity-tokens', { method: 'POST', token, body: { audience, allowNew: true } })).token;
    },
  };
}

/** A Matrix homeserver stand-in with shared-secret registration and password login. */
export async function startMatrix(t, serverName) {
  const users = new Map();
  const tokens = new Map();
  let serial = 0;
  const issue = (userId, deviceId = `DEVICE_${++serial}`) => {
    const session = { user_id: userId, device_id: deviceId, access_token: `matrix-token-${++serial}` };
    tokens.set(session.access_token, session);
    return session;
  };
  const server = http.createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    const input = body ? JSON.parse(body) : {};
    const send = (status, value) => { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(value)); };
    const caller = tokens.get((request.headers.authorization || '').slice(7));
    const route = request.url.split('?')[0];
    if (route === '/_synapse/admin/v1/register' && request.method === 'GET') return send(200, { nonce: `nonce-${serial}` });
    if (route === '/_synapse/admin/v1/register') {
      const userId = `@${input.username}:${serverName}`;
      if (users.has(userId)) return send(400, { errcode: 'M_USER_IN_USE', error: 'User ID already taken' });
      users.set(userId, { password: input.password, name: input.displayname });
      return send(200, issue(userId));
    }
    if (route === '/_matrix/client/v3/login') {
      const userId = input.identifier?.user;
      if (users.get(userId)?.password !== input.password) return send(403, { errcode: 'M_FORBIDDEN', error: 'Invalid password' });
      return send(200, issue(userId, input.device_id));
    }
    if (!caller) return send(401, { errcode: 'M_UNKNOWN_TOKEN', error: 'Unknown token' });
    if (route === '/_matrix/client/v3/account/whoami') return send(200, { user_id: caller.user_id, device_id: caller.device_id });
    if (route === '/_matrix/client/v3/logout') { tokens.delete(caller.access_token); return send(200, {}); }
    if (route === '/_matrix/client/v3/joined_rooms') return send(200, { joined_rooms: [] });
    if (route.startsWith('/_matrix/client/v3/profile/')) {
      if (request.method === 'PUT') users.get(caller.user_id).name = input.displayname;
      return send(200, { displayname: users.get(caller.user_id)?.name });
    }
    send(404, { errcode: 'M_UNRECOGNIZED', error: route });
  });
  const url = await listen(server);
  t.after(() => stop(server));
  return { url, users, tokens };
}

/** Core reads its Matrix registration secret from the server metadata that server-init writes. */
export async function writeServerMetadata(dataRoot, serverName) {
  await writeFile(path.join(dataRoot, 'server.json'), JSON.stringify({ schemaVersion: 1, serverName, registrationSecret: 'test-registration-secret' }));
}
