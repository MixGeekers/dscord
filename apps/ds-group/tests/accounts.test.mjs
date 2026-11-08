import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { AccountService } from '../src/accounts.mjs';

const serverName = 'accounts.test';
const aliceId = `@alice:${serverName}`;
const roomId = `!lobby:${serverName}`;
const upstreamError = (status, errcode) => Object.assign(new Error(errcode), { status, errcode });

function matrixFixture() {
  const users = new Map([[aliceId, { password: 'alice-password', name: 'Alice' }]]);
  const tokens = new Map([['alice-server-token', { user_id: aliceId, device_id: 'legacy-alice' }]]);
  const joined = new Map([[aliceId, new Set([roomId])]]);
  const calls = [];
  let serial = 0;
  let lostRegistration = false;
  let failedJoin = false;
  const session = (userId, deviceId) => {
    for (const [token, old] of tokens) if (old.user_id === userId && old.device_id === deviceId) tokens.delete(token);
    const result = { user_id: userId, device_id: deviceId, access_token: `synthetic-token-${++serial}` };
    tokens.set(result.access_token, result);
    return result;
  };
  const clientFactory = token => {
    const identity = () => {
      const result = tokens.get(token);
      if (!result) throw upstreamError(401, 'M_UNKNOWN_TOKEN');
      return result;
    };
    return {
      async whoami() { return identity(); },
      async join(id) {
        const { user_id: userId } = identity();
        if (failedJoin) { failedJoin = false; throw upstreamError(503, 'M_UNAVAILABLE'); }
        if (!joined.has(userId)) joined.set(userId, new Set());
        joined.get(userId).add(id);
        return { room_id: id };
      },
      async request(method, route, body, options) {
        calls.push({ method, route, body, token, options });
        if (route === '/_synapse/admin/v1/register' && method === 'GET') return { nonce: `nonce-${serial}` };
        if (route === '/_synapse/admin/v1/register') {
          const userId = `@${body.username}:${serverName}`;
          if (users.has(userId)) throw upstreamError(400, 'M_USER_IN_USE');
          users.set(userId, { password: body.password, name: body.displayname });
          const result = session(userId, `registration-${serial}`);
          if (lostRegistration) { lostRegistration = false; throw new Error('Synthetic lost registration response'); }
          return result;
        }
        if (route === '/_matrix/client/v3/login') {
          const userId = body.identifier.user;
          if (users.get(userId)?.password !== body.password) throw upstreamError(403, 'M_FORBIDDEN');
          return session(userId, body.device_id);
        }
        const { user_id: userId } = identity();
        if (route === '/_matrix/client/v3/logout') { tokens.delete(token); return {}; }
        if (route === '/_matrix/client/v3/joined_rooms') return { joined_rooms: [...(joined.get(userId) || [])] };
        if (route.endsWith('/invite')) return {};
        if (route.includes('/profile/')) {
          if (method === 'PUT') users.get(userId).name = body.displayname;
          return { displayname: users.get(userId).name };
        }
        throw new Error(`Unhandled fixture route ${route}`);
      },
    };
  };
  return { users, tokens, joined, calls, clientFactory,
    loseNextRegistration() { lostRegistration = true; }, failNextJoin() { failedJoin = true; } };
}

async function fixture(t, options = {}) {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), 'dscord-accounts-'));
  const matrix = matrixFixture();
  const setup = { serverName, homeserverUrl: 'https://matrix.accounts.test', roomId, participants: [
    { id: aliceId, localpart: 'alice', name: 'Alice', kind: 'human', accessToken: 'alice-server-token', password: 'alice-password' },
  ] };
  const service = await new AccountService({ setup, dataRoot, registrationSecret: 'synthetic-registration-secret', clientFactory: matrix.clientFactory, ...options }).initialize();
  const services = [service];
  t.after(async () => { for (const value of services) value.close(); await rm(dataRoot, { recursive: true, force: true }); });
  return { service, dataRoot, matrix, setup, async restore() {
    service.close();
    const restoredSetup = { ...setup, participants: [{ id: aliceId, localpart: 'alice', name: 'Alice', kind: 'human', accessToken: 'alice-server-token' }] };
    const restored = await new AccountService({ setup: restoredSetup, dataRoot, registrationSecret: 'synthetic-registration-secret', clientFactory: matrix.clientFactory, ...options }).initialize();
    services.push(restored);
    return restored;
  } };
}

// Claims as a verified identity token from the central server carries them.
const human = (username, name = username, sub = `sub-${username}`) => ({ sub, username, gid: `${username}@id.test`, kind: 'human', name });
const bot = (username, name = username) => ({ ...human(username, name), kind: 'bot', owner: 'alice@id.test' });

test('a first sign-in creates the account, joins the lobby and keeps browser sessions apart from the server session', async t => {
  const changed = [];
  const f = await fixture(t, { onParticipant: person => changed.push(person) });
  const originalArray = f.setup.participants;
  const session = await f.service.signIn(human('charlie', 'Charlie'));
  const person = f.service.person(session.user_id);
  assert.equal(session.user_id, `@charlie:${serverName}`);
  assert.equal(originalArray, f.setup.participants);
  assert.equal(person.name, 'Charlie');
  assert.equal(person.globalId, 'charlie@id.test');
  assert.notEqual(person.accessToken, session.access_token);
  assert.equal(f.matrix.joined.get(person.id).has(roomId), true);
  assert.equal(changed.length, 1);
  assert.deepEqual(session.identity, { globalId: 'charlie@id.test', matrixUserId: person.id, kind: 'human' });
  assert.deepEqual(await f.service.me(session.access_token), { user: { id: person.id, name: 'Charlie', kind: 'human', localpart: 'charlie', globalId: 'charlie@id.test' },
    ownedBots: [], identity: session.identity });
  const publicJson = JSON.stringify(f.service.publicParticipants());
  assert.equal(publicJson.includes('accessToken'), false);
  assert.equal(publicJson.includes('password'), false);
  assert.equal((await stat(path.join(f.dataRoot, 'accounts.sqlite'))).mode & 0o777, 0o600);
  const restored = await f.restore();
  assert.equal(restored.person(person.id).accessToken, person.accessToken);
  assert.equal(restored.ownerId, aliceId);
});

test('each sign-in has its own device and logout preserves other clients and the Core service token', async t => {
  const f = await fixture(t);
  const first = await f.service.signIn(human('alice', 'Alice'));
  const second = await f.service.signIn(human('alice', 'Alice'));
  assert.notEqual(first.device_id, second.device_id);
  assert.notEqual(first.access_token, second.access_token);
  assert.deepEqual(await f.service.logout(first.access_token), { loggedOut: true });
  await assert.rejects(f.service.me(first.access_token), error => error.status === 401);
  assert.equal((await f.service.me(second.access_token)).user.id, aliceId);
  assert.equal(f.matrix.tokens.has('alice-server-token'), true);
  assert.deepEqual(await f.service.logout('alice-server-token'), { loggedOut: true, localOnly: true });
  assert.equal(f.matrix.tokens.has('alice-server-token'), true);
  assert.equal(f.matrix.calls.some(call => call.route === '/_matrix/client/v3/logout' && call.token === 'alice-server-token'), false);
});

test('a seeded account is claimed by the central account of the same name, and only by that one', async t => {
  const f = await fixture(t);
  const session = await f.service.signIn(human('alice', 'Alice Liddell'));
  assert.equal(session.user_id, aliceId);
  assert.equal(f.service.person(aliceId).accessToken, 'alice-server-token');
  assert.equal(f.service.person(aliceId).name, 'Alice Liddell');
  assert.equal(f.matrix.users.get(aliceId).name, 'Alice Liddell');
  await assert.rejects(f.service.signIn(human('alice', 'Alice', 'another-central-subject')), error => error.code === 'IDENTITY_CONFLICT');
  await assert.rejects(f.service.signIn(bot('alice'), { ownerId: aliceId }), error => error.code === 'IDENTITY_KIND_CONFLICT');
});

test('a seeded account without a password Core can use cannot be claimed', async t => {
  const f = await fixture(t);
  f.service.db.prepare('UPDATE accounts SET recovery_password=NULL WHERE user_id=?').run(aliceId);
  await assert.rejects(f.service.signIn(human('alice')), error => error.code === 'ACCOUNT_NOT_CLAIMABLE');
});

test('sign-in forwards the client address to every Matrix registration and login call', async t => {
  const f = await fixture(t);
  const clientIp = '192.0.2.10';
  await f.service.signIn(human('charlie'), { clientIp });
  const calls = f.matrix.calls.filter(call => call.route === '/_synapse/admin/v1/register' || call.route === '/_matrix/client/v3/login');
  assert.equal(calls.length, 3);
  assert.equal(calls.every(call => call.options.clientIp === clientIp), true);
});

test('a lost registration response recovers on the next sign-in with the reserved password', async t => {
  const f = await fixture(t);
  f.matrix.loseNextRegistration();
  await assert.rejects(f.service.signIn(human('charlie')), /lost registration/);
  assert.equal(f.service.row('@charlie:accounts.test').status, 'provisioning');
  const restored = await f.restore();
  const session = await restored.signIn(human('charlie'));
  assert.equal(session.user_id, '@charlie:accounts.test');
  assert.equal(restored.row(session.user_id).status, 'active');
});

test('a Matrix account made outside DSCord is left intact', async t => {
  const f = await fixture(t);
  f.matrix.users.set('@dave:accounts.test', { password: 'their-own-password', name: 'Dave' });
  await assert.rejects(f.service.signIn(human('dave')), error => error.code === 'MATRIX_ACCOUNT_EXISTS');
  assert.equal(f.matrix.users.get('@dave:accounts.test').password, 'their-own-password');
});

test('a partial lobby join preserves credentials and succeeds on the next sign-in without a second account', async t => {
  const f = await fixture(t);
  f.matrix.failNextJoin();
  await assert.rejects(f.service.signIn(human('charlie')), error => error.status === 503);
  const token = f.service.row('@charlie:accounts.test').service_token;
  assert.ok(token);
  await f.service.signIn(human('charlie'));
  assert.equal(f.service.row('@charlie:accounts.test').service_token, token);
  assert.equal(f.matrix.joined.get('@charlie:accounts.test').has(roomId), true);
});

test('a Bot signs in with its owner from the identity token and stays out of the lobby', async t => {
  const f = await fixture(t);
  await assert.rejects(f.service.signIn(bot('helper')), error => error.code === 'IDENTITY_TOKEN_OWNER');
  const session = await f.service.signIn(bot('helper', 'Helper'), { ownerId: aliceId });
  assert.equal(session.identity.kind, 'bot');
  assert.equal(session.identity.ownerMatrixUserId, aliceId);
  assert.deepEqual(f.service.ownedBots(aliceId), [{ id: '@helper:accounts.test', localpart: 'helper', name: 'Helper', kind: 'bot', ownerId: aliceId, globalId: 'helper@id.test' }]);
  assert.equal(f.matrix.joined.get('@helper:accounts.test'), undefined);
  await assert.rejects(f.service.me(session.access_token), error => error.status === 403);
  await assert.rejects(f.service.signIn(human('helper')), error => error.code === 'IDENTITY_KIND_CONFLICT');
});

test('incomplete claims fail before contacting Matrix', async t => {
  const f = await fixture(t);
  for (const claims of [{ ...human('charlie'), username: 'Charlie!' }, { ...human('charlie'), sub: undefined }, { ...human('charlie'), gid: 7 }]) {
    await assert.rejects(f.service.signIn(claims), error => error.code === 'IDENTITY_TOKEN_CLAIMS');
  }
  assert.equal(f.matrix.calls.length, 0);
});

test('a server without Matrix registration configuration refuses sign-in', async t => {
  const f = await fixture(t, { registrationSecret: undefined });
  await assert.rejects(f.service.signIn(human('charlie')), error => error.code === 'ACCOUNTS_UNCONFIGURED');
});

test('disabled accounts cannot sign in, use an existing session or reactivate after restart', async t => {
  const f = await fixture(t);
  const session = await f.service.signIn(human('alice'));
  f.service.db.prepare("UPDATE accounts SET status='disabled' WHERE user_id=?").run(aliceId);
  await assert.rejects(f.service.me(session.access_token), error => error.status === 403);
  await assert.rejects(f.service.signIn(human('alice')), /disabled/);
  await assert.rejects(f.service.activate(aliceId), /disabled/);
  const restored = await f.restore();
  assert.equal(restored.person(aliceId), undefined);
  assert.equal(restored.row(aliceId).status, 'disabled');
  await assert.rejects(restored.signIn(human('alice')), /disabled/);
});

test('an account database from before central identity is refused', async t => {
  const f = await fixture(t);
  f.service.db.prepare("UPDATE account_metadata SET value='1' WHERE key='identitySchemaVersion'").run();
  await assert.rejects(f.restore(), /predates central identity/);
});

test('an empty directory reads Matrix identity from server metadata and retains it across restart', async t => {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), 'dscord-accounts-'));
  t.after(() => rm(dataRoot, { recursive: true, force: true }));
  await writeFile(path.join(dataRoot, 'server.json'), JSON.stringify({ serverName, registrationSecret: 'from-metadata' }));
  const setup = { homeserverUrl: 'https://matrix.accounts.test', participants: [] };
  const service = await new AccountService({ setup, dataRoot }).initialize();
  assert.equal(service.serverName, serverName);
  assert.equal(setup.serverName, serverName);
  assert.equal(service.registrationSecret, 'from-metadata');
  service.close();
  const restored = await new AccountService({ setup: { homeserverUrl: setup.homeserverUrl, participants: [] }, dataRoot }).initialize();
  assert.equal(restored.serverName, serverName);
  restored.close();
});
