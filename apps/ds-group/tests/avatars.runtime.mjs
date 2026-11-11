// Explicit zero-model integration: two isolated real Synapse servers, two Core services and Central.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { createCentral } from '../central/service.mjs';
import { createCore } from '../src/core.mjs';
import { MatrixClient } from '../src/matrix-client.mjs';
import { packageRoot } from '../src/paths.mjs';

const execute = promisify(execFile);
const id = `dscord-avatar-${randomBytes(4).toString('hex')}`;
const root = path.join(packageRoot, '.local/avatar-validation', id);
await mkdir(root, { recursive: true });
const image = process.env.DSCORD_AVATAR_SYNAPSE_IMAGE || 'ghcr.io/element-hq/synapse:v1.164.2@sha256:f0df87cff259872637b4b5e5174b9977e5e3046dd421505407803b5e45c5f842';
const containers = [], nodes = [], checks = [];
let central;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const reserve = async () => { const server = http.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const port = server.address().port; await new Promise(resolve => server.close(resolve)); return `http://127.0.0.1:${port}`; };
const docker = async args => (await execute('docker', args, { timeout: 120000, maxBuffer: 2 * 1024 * 1024 })).stdout.trim();
async function until(work, message) { const end = Date.now() + 60000; let last; while (Date.now() < end) { try { if (await work()) return; } catch (error) { last = error.message; } await pause(500); } throw new Error(`${message}: ${last || 'timed out'}`); }
async function json(base, route, { token, body, method = body ? 'POST' : 'GET', bytes } = {}) {
  const response = await fetch(base + route, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : bytes ? { 'Content-Type': 'image/png' } : {}) }, body: body ? JSON.stringify(body) : bytes, signal: AbortSignal.timeout(20000) });
  const value = await response.json(); assert.ok(response.ok, `${route}: ${response.status} ${JSON.stringify(value)}`); return value;
}
try {
  const centralBase = await reserve();
  const centralConfig = { issuer: centralBase, domain: 'identity.test' };
  const openCentral = async () => { central = await createCentral({ dataRoot: path.join(root, 'central'), config: centralConfig, refreshIntervalMs: 0 }); await new Promise(resolve => central.server.listen(Number(new URL(centralBase).port), '127.0.0.1', resolve)); };
  await openCentral();
  const alice = await json(centralBase, '/api/register', { body: { username: 'alice', password: 'synthetic-avatar-test', displayName: 'Alice' } });
  const { bot } = await json(centralBase, '/api/bots', { token: alice.token, body: { username: 'helper', displayName: 'Offline Helper' } });
  for (const suffix of ['a', 'b']) {
    const container = `${id}-${suffix}`, serverName = `avatar-${suffix}.test`;
    const dataRoot = path.join(root, suffix, 'core'), synapseRoot = path.join(root, suffix, 'synapse');
    await mkdir(dataRoot, { recursive: true }); await mkdir(synapseRoot, { recursive: true });
    const registrationSecret = randomBytes(32).toString('hex');
    await writeFile(path.join(synapseRoot, 'homeserver.yaml'), JSON.stringify({ server_name: serverName, report_stats: false,
      listeners: [{ port: 8008, tls: false, type: 'http', bind_addresses: ['0.0.0.0'], resources: [{ names: ['client'] }] }],
      database: { name: 'sqlite3', args: { database: '/data/homeserver.db' } }, media_store_path: '/data/media_store', signing_key_path: '/data/signing.key',
      registration_shared_secret: registrationSecret, trusted_key_servers: [], suppress_key_server_warning: true, enable_registration: false,
      rc_login: { address: { per_second: 100, burst_count: 200 } }, rc_joins: { local: { per_second: 100, burst_count: 200 } }, rc_3pid_validation: { per_second: 100, burst_count: 200 }, rc_message: { per_second: 100, burst_count: 200 },
    }));
    containers.push(container);
    await docker(['run', '-d', '--name', container, '--user', '0:0', '-e', 'UID=0', '-e', 'GID=0', '-v', `${synapseRoot}:/data`, '-p', '127.0.0.1::8008', image, 'run', '--config-path', '/data/homeserver.yaml']);
    const binding = await docker(['port', container, '8008/tcp']);
    const matrixUrl = `http://${binding.split('\n')[0]}`;
    await until(async () => (await fetch(matrixUrl + '/_matrix/client/versions')).ok, 'Synapse readiness');
    await writeFile(path.join(dataRoot, 'server.json'), JSON.stringify({ serverName, registrationSecret }));
    const coreBase = await reserve();
    const setup = { serverName, homeserverUrl: matrixUrl, publicHomeserverUrl: matrixUrl, participants: [] };
    const config = { nodeSecret: randomBytes(32).toString('hex'), publicUrl: coreBase, identity: { central: centralBase } };
    const openCore = async () => { const core = await createCore({ dataRoot, setup, config, enablePush: false }); await new Promise(resolve => core.server.listen(Number(new URL(coreBase).port), '127.0.0.1', resolve)); return core; };
    let core = await openCore();
    const tokenFor = async account => {
      const token = central.store.openSession(central.store.account(account.id), account.kind === 'bot' ? 'node' : 'login', 'synthetic-runtime');
      return (await json(centralBase, '/api/identity-tokens', { token, body: { audience: coreBase, allowNew: true } })).token;
    };
    const userSession = await json(coreBase, '/api/session', { body: { identityToken: await tokenFor(alice.account) } });
    const botSession = await json(coreBase, '/api/session', { body: { identityToken: await tokenFor(bot) } });
    const humanClient = new MatrixClient({ baseUrl: matrixUrl, accessToken: userSession.access_token });
    const botClient = new MatrixClient({ baseUrl: matrixUrl, accessToken: botSession.access_token });
    nodes.push({ core, coreBase, userSession, botSession, humanClient, botClient, restart: async () => { await core.close(); core = await openCore(); return core; } });
  }
  checks.push('two real Synapse/Core pairs provision the same central human and offline Bot identities');
  const pixels = await sharp({ create: { width: 480, height: 640, channels: 3, background: '#875bb6' } }).png().toBuffer();
  const userProfile = (await json(centralBase, '/api/me/avatar?version=0', { token: alice.token, method: 'PUT', bytes: pixels })).profile;
  const botProfile = (await json(centralBase, `/api/bots/${bot.id}/avatar?version=0`, { token: alice.token, method: 'PUT', bytes: pixels })).profile;
  for (const node of nodes) {
    await until(async () => {
      const me = await json(node.coreBase, '/api/me', { token: node.userSession.access_token });
      return me.user.profileVersion === 1 && me.ownedBots[0]?.profileVersion === 1;
    }, 'automatic background profile sync');
    for (const [client, session] of [[node.humanClient, node.userSession], [node.botClient, node.botSession]]) {
      let uri;
      await until(async () => { uri = (await client.request('GET', `/_matrix/client/v3/profile/${encodeURIComponent(session.user_id)}/avatar_url`)).avatar_url; return uri?.startsWith('mxc://'); }, 'Matrix avatar update');
      const response = await client.downloadMedia(uri); const meta = await sharp(Buffer.from(await response.arrayBuffer())).metadata(); assert.equal(meta.width, 512);
    }
  }
  checks.push('automatic timers update both servers and real Matrix avatar profiles with downloadable 512px media');
  await central.close(); await openCentral();
  nodes[0].core = await nodes[0].restart();
  const restored = await json(nodes[0].coreBase, '/api/me', { token: nodes[0].userSession.access_token });
  assert.equal(restored.user.avatar.id, userProfile.avatar.id); assert.equal(restored.ownedBots[0].avatar.id, botProfile.avatar.id);
  checks.push('Central and Core restart retain image files, profile versions and existing sessions');
  await json(centralBase, `/api/bots/${bot.id}/avatar?version=1`, { token: alice.token, method: 'DELETE' });
  for (const node of nodes) {
    await until(async () => !(await node.botClient.request('GET', `/_matrix/client/v3/profile/${encodeURIComponent(node.botSession.user_id)}/avatar_url`)).avatar_url, 'Matrix avatar clear');
    const me = await json(node.coreBase, '/api/me', { token: node.userSession.access_token }); assert.equal(me.ownedBots[0].avatar, null);
  }
  checks.push('restore default propagates through real Matrix on both servers without a Bot node');
  console.log(JSON.stringify({ status: 'passed', level: 'real-central-two-core-two-synapse-one-physical-host', checks, modelCalls: 0 }, null, 2));
} finally {
  await writeFile(path.join(root, 'report.json'), JSON.stringify({ checks, modelCalls: 0 }, null, 2));
  for (const node of nodes) await node.core.close();
  await central?.close();
  for (const name of containers) { try { await docker(['rm', '-f', name]); } catch {} }
}
