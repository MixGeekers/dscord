import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createCore } from '../src/core.mjs';
import { createAdmin } from '../src/admin.mjs';
import { AdminAuth } from '../src/admin-auth.mjs';
import { Governance, validatePolicy, emptyPolicy } from '../src/governance.mjs';
import { listen, startCentral, startMatrix, writeServerMetadata } from './helpers/central.mjs';

const CORE_URL = 'https://chat.test';
const ADMIN_PASSWORD = 'synthetic-admin-password-1234';

async function chatServer(t) {
  const central = await startCentral(t);
  const matrix = await startMatrix(t, 'chat.test');
  const root = await mkdtemp(path.join(os.tmpdir(), 'dscord-directory-'));
  await writeServerMetadata(root, 'chat.test');
  const config = { nodeSecret: 'chat-node-secret', publicUrl: CORE_URL, identity: { central: central.url } };
  await writeFile(path.join(root, 'core-config.json'), JSON.stringify(config));
  const setup = { serverName: 'chat.test', homeserverUrl: matrix.url, publicHomeserverUrl: matrix.url, roomId: null, participants: [] };
  const core = await createCore({ dataRoot: root, enablePush: false, setup, config });
  const base = await listen(core.server);
  // The central server reaches this chat server's public origin at its loopback address.
  central.central.directory.fetchVia[CORE_URL] = base;
  const auth = await new AdminAuth(root).initialize();
  await auth.change('console', { username: 'admin', password: ADMIN_PASSWORD, role: 'owner', enabled: true }, { bootstrap: true });
  auth.close();
  const admin = await createAdmin({ dataRoot: root, setup,
    controlFactory: () => ({ status: async () => ({}), apply: async () => ({}), invite: async () => ({}) }) });
  const adminBase = await listen(admin.server);
  t.after(async () => { await admin.close(); await core.close(); await rm(root, { recursive: true, force: true }); });
  const adminCall = async (route, { method = 'GET', token, body } = {}) => {
    const response = await fetch(`${adminBase}/admin-api/${route}`, { method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, value: await response.json() };
  };
  const adminToken = (await adminCall('login', { method: 'POST', body: { username: 'admin', password: ADMIN_PASSWORD } })).value.access_token;
  return { central, matrix, core, base, root, adminCall, adminToken };
}

test('the directory section of the policy is validated and defaults to unlisted', () => {
  const policy = emptyPolicy('chat.test');
  assert.deepEqual(policy.directory, { listed: false, name: '', description: '', tags: [], challenge: '' });
  const checked = validatePolicy({ ...policy, directory: { listed: true, name: ' Robotics ', description: 'Line one\nline two', tags: ['Robots', 'robots', 'arm'], challenge: 'dscord-server-abc_DEF-1' } }, 'chat.test');
  assert.deepEqual(checked.directory, { listed: true, name: 'Robotics', description: 'Line one\nline two', tags: ['robots', 'arm'], challenge: 'dscord-server-abc_DEF-1' });
  assert.throws(() => validatePolicy({ ...policy, directory: { ...policy.directory, challenge: 'anything' } }, 'chat.test'), /challenge/);
  assert.throws(() => validatePolicy({ ...policy, directory: { ...policy.directory, tags: Array(11).fill('x') } }, 'chat.test'), /10 directory tags/);
  assert.throws(() => validatePolicy({ ...policy, directory: { ...policy.directory, listed: 'yes' } }, 'chat.test'), /listed/);
});

test('an operator lists the chat server from its administration service and anyone finds it in the central index', async t => {
  const f = await chatServer(t);
  assert.equal((await fetch(`${f.base}/.well-known/dscord/server`)).status, 404, 'nothing is published before listing starts');

  await f.central.person('alice', 'Alice');
  await f.central.person('bob', 'Bob');
  const governance = new Governance({ dataRoot: f.root, serverName: 'chat.test' });
  const before = await governance.read();
  await governance.save({ ...before, directory: { ...before.directory, listed: true, name: 'Robotics club', description: 'Arms and wheels', tags: ['robots'] } });

  const wrong = await f.adminCall('directory/list', { method: 'POST', token: f.adminToken, body: { username: 'alice', password: 'wrong password' } });
  assert.deepEqual([wrong.status, wrong.value.error], [409, 'Central server refused: LOGIN_FAILED']);
  const listed = await f.adminCall('directory/list', { method: 'POST', token: f.adminToken, body: { username: 'alice', password: 'alice-password' } });
  assert.equal(listed.status, 200, JSON.stringify(listed.value));
  assert.equal(listed.value.central, f.central.url);
  assert.match(listed.value.policy.directory.challenge, /^dscord-server-/);
  assert.equal(listed.value.server.origin, CORE_URL);

  const page = await (await fetch(`${f.base}/.well-known/dscord/server`)).json();
  assert.deepEqual({ ...page, challenge: undefined }, { schemaVersion: 1, central: f.central.url, origin: CORE_URL, challenge: undefined, listed: true,
    name: 'Robotics club', description: 'Arms and wheels', tags: ['robots'], join: 'central-account', members: { people: 0, bots: 0 } });

  const found = await f.central.api('/api/servers?q=robot');
  assert.deepEqual(found.servers.map(server => [server.origin, server.name, server.owner]), [[CORE_URL, 'Robotics club', `alice@${f.central.domain}`]]);

  // Hiding the server in its own policy takes it out of search at the next read.
  const current = await governance.read();
  await governance.save({ ...current, directory: { ...current.directory, listed: false } });
  await f.central.central.directory.refreshAll();
  assert.deepEqual((await f.central.api('/api/servers')).servers, []);
});
