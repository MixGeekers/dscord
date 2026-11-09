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

test('the directory section of the policy is validated; a new server is hidden and open to join', () => {
  const policy = emptyPolicy('chat.test');
  assert.deepEqual(policy.directory, { discovery: 'hidden', join: 'open', name: '', description: '', tags: [], challenge: '', number: null });
  const checked = validatePolicy({ ...policy, directory: { discovery: 'number', join: 'invite', name: ' Robotics ', description: 'Line one\nline two',
    tags: ['Robots', 'robots', 'arm'], challenge: 'dscord-server-abc_DEF-1', number: 12345678 } }, 'chat.test');
  assert.deepEqual(checked.directory, { discovery: 'number', join: 'invite', name: 'Robotics', description: 'Line one\nline two', tags: ['robots', 'arm'],
    challenge: 'dscord-server-abc_DEF-1', number: 12345678 });
  assert.throws(() => validatePolicy({ ...policy, directory: { ...policy.directory, join: 'anyone' } }, 'chat.test'), /join/);
  assert.throws(() => validatePolicy({ ...policy, directory: { ...policy.directory, number: 123 } }, 'chat.test'), /number/);
  assert.throws(() => validatePolicy({ ...policy, directory: { ...policy.directory, challenge: 'anything' } }, 'chat.test'), /challenge/);
  assert.throws(() => validatePolicy({ ...policy, directory: { ...policy.directory, tags: Array(11).fill('x') } }, 'chat.test'), /10 directory tags/);
  assert.throws(() => validatePolicy({ ...policy, directory: { ...policy.directory, discovery: 'yes' } }, 'chat.test'), /discovery/);
});

test('an operator lists the chat server from its administration service and anyone finds it in the central index', async t => {
  const f = await chatServer(t);
  assert.equal((await fetch(`${f.base}/.well-known/dscord/server`)).status, 404, 'nothing is published before listing starts');

  await f.central.person('alice', 'Alice');
  await f.central.person('bob', 'Bob');
  const governance = new Governance({ dataRoot: f.root, serverName: 'chat.test' });
  const before = await governance.read();
  await governance.save({ ...before, directory: { ...before.directory, discovery: 'public', name: 'Robotics club', description: 'Arms and wheels', tags: ['robots'] } });

  const wrong = await f.adminCall('directory/list', { method: 'POST', token: f.adminToken, body: { username: 'alice', password: 'wrong password' } });
  assert.deepEqual([wrong.status, wrong.value.error], [409, 'Central server refused: LOGIN_FAILED']);
  const listed = await f.adminCall('directory/list', { method: 'POST', token: f.adminToken, body: { username: 'alice', password: 'alice-password' } });
  assert.equal(listed.status, 200, JSON.stringify(listed.value));
  assert.equal(listed.value.central, f.central.url);
  assert.match(listed.value.policy.directory.challenge, /^dscord-server-/);
  assert.equal(listed.value.server.origin, CORE_URL);

  const page = await (await fetch(`${f.base}/.well-known/dscord/server`)).json();
  assert.deepEqual({ ...page, challenge: undefined }, { schemaVersion: 1, central: f.central.url, origin: CORE_URL, challenge: undefined, discovery: 'public',
    name: 'Robotics club', description: 'Arms and wheels', tags: ['robots'], join: 'open', members: { people: 0, bots: 0 } });
  assert.equal(listed.value.policy.directory.number, listed.value.server.number, 'the server keeps the number central gave it');
  const client = await (await fetch(`${f.base}/.well-known/dscord/client`)).json();
  assert.deepEqual(client.directory, { join: 'open', number: listed.value.server.number });

  const found = await f.central.api('/api/servers?q=robot');
  assert.deepEqual(found.servers.map(server => [server.origin, server.name, server.owner]), [[CORE_URL, 'Robotics club', `alice@${f.central.domain}`]]);

  // Hiding the server in its own policy takes it out of search at the next read.
  const current = await governance.read();
  await governance.save({ ...current, directory: { ...current.directory, discovery: 'hidden' } });
  await f.central.central.directory.refreshAll();
  assert.deepEqual((await f.central.api('/api/servers')).servers, []);
});

test('a server that only takes invited people lets in members, invited people and members\' Bots', async t => {
  const f = await chatServer(t);
  const governance = new Governance({ dataRoot: f.root, serverName: 'chat.test' });
  const alice = await f.central.person('alice', 'Alice');
  const bob = await f.central.person('bob', 'Bob');
  const carol = await f.central.person('carol', 'Carol');
  const signIn = async (token, extra = {}) => {
    const response = await fetch(`${f.base}/api/session`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identityToken: await f.central.identityToken(token, CORE_URL), ...extra }) });
    return { status: response.status, value: await response.json() };
  };
  // Alice joins while the server is open; then it switches to invitations only.
  const aliceSession = (await signIn(alice)).value;
  const before = await governance.read();
  await governance.save({ ...before, directory: { ...before.directory, join: 'invite' } });
  assert.equal((await (await fetch(`${f.base}/.well-known/dscord/client`)).json()).directory.join, 'invite');
  assert.equal((await signIn(alice)).status, 200, 'a member keeps signing in');
  assert.deepEqual([(await signIn(bob)).status, (await signIn(bob)).value.code], [403, 'INVITE_REQUIRED']);
  assert.equal((await signIn(bob, { inviteCode: 'NOPE-NOPE' })).value.code, 'INVITE_INVALID');

  const member = (route, init = {}) => fetch(`${f.base}${route}`, { ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aliceSession.access_token}` } }).then(async response => ({ status: response.status, value: await response.json() }));
  const created = await member('/api/invites', { method: 'POST', body: '{}' });
  assert.equal(created.status, 201);
  assert.match(created.value.invite.code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal((await signIn(bob, { inviteCode: created.value.invite.code.toLowerCase() })).status, 200, 'codes are read without case or dashes');
  assert.deepEqual((await member('/api/invites')).value.invites.map(invite => [invite.code, invite.uses]), [[created.value.invite.code, 1]]);
  assert.equal((await member(`/api/invites/${created.value.invite.code}`, { method: 'DELETE' })).status, 200);
  assert.equal((await signIn(carol, { inviteCode: created.value.invite.code })).value.code, 'INVITE_INVALID', 'a revoked code lets nobody else in');

  // Administrators make invitations from the administration service.
  const fromAdmin = await f.adminCall('invites', { method: 'POST', token: f.adminToken });
  assert.equal(fromAdmin.value.invite.createdBy, 'admin:admin');
  assert.equal((await signIn(carol, { inviteCode: fromAdmin.value.invite.code })).status, 200);

  // A Bot gets in because its owner is a member; a Bot whose owner is not stays out.
  const helper = await f.central.bot(alice, 'helper');
  assert.equal((await signIn(helper.token)).status, 200);
  const dave = await f.central.person('dave', 'Dave');
  const stray = await f.central.bot(dave, 'stray');
  assert.equal((await signIn(stray.token)).value.code, 'INVITE_REQUIRED');
});
