import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import path from 'node:path';
import { packageRoot } from '../src/paths.mjs';

const execute = promisify(execFile);
const name = `dscord-update-smoke-${randomBytes(4).toString('hex')}`;
const image = process.env.DS_GROUP_IMAGE || 'dscord-updates:base';
const { version: baseVersion } = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'));
const [major, minor, patch] = baseVersion.split('-')[0].split('.').map(Number);
const [goodVersion, badVersion, interruptedVersion] = [1, 2, 3].map(index => `${major}.${minor}.${patch + 1}-smoke.${index}`);
const output = path.resolve(process.env.DS_GROUP_UPDATE_SMOKE_REPORT || path.join(packageRoot, '.local/server-update-smoke.json'));
await mkdir(path.dirname(output), { recursive: true });
const root = await mkdtemp(path.join(path.dirname(output), `${name}-`));
const report = { project: name, level: 'real-docker-matrix-administration', releaseSource: 'synthetic-local-images', modelCalls: 0, checks: [] };
const env = { ...process.env, DS_GROUP_IMAGE: image, DS_GROUP_SERVER_NAME: `${name}.test`, DS_GROUP_BOOTSTRAP_DEMO: 'true',
  DS_GROUP_BIND: '127.0.0.1', DS_GROUP_HTTP_PORT: '0', DS_GROUP_MATRIX_PORT: '0', DS_GROUP_ADMIN_PORT: '0', DS_GROUP_CENTRAL_PORT: '0',
  DS_GROUP_PUBLIC_URL: 'http://localhost:18100', DS_GROUP_MATRIX_PUBLIC_URL: 'http://localhost:18008', DS_GROUP_CENTRAL_URL: 'http://localhost:18200',
  DS_GROUP_CENTRAL_FETCH_URL: 'http://central:18200', DS_GROUP_BOOTSTRAP_PROFILES_PATH: '', DS_GROUP_WEB_MODE: 'bundled',
  DSCORD_CENTRAL_REGISTRATION: 'open', DSCORD_CENTRAL_ADMINS: '' };
const compose = JSON.parse((await execute('docker', ['compose', '-p', name, '-f', path.join(packageRoot, 'deploy/compose.yaml'), 'config', '--format', 'json'],
  { env, timeout: 30000 })).stdout);
const fixture = path.join(root, 'fixtures'); await mkdir(fixture);
await writeFile(path.join(fixture, 'runner.mjs'), await readFile(path.join(packageRoot, 'tests/fixtures/server-updater-runner.mjs')));
const state = path.join(root, 'updates'); await mkdir(state);
const feed = async (version, targetImage, pauseAfterCreate = false) => writeFile(path.join(fixture, 'feed.json'), JSON.stringify({ pauseAfterCreate,
  target: { version, image: targetImage, eligible: true, fromVersions: [baseVersion, goodVersion], nodeProtocol: '1.0', deploymentContract: 1, rollbackCompatible: true } }));
await feed(goodVersion, `${name}:good`);
for (const service of Object.values(compose.services)) {
  if (service.build) { delete service.build; service.image = image; }
}
compose.services.updater.command = ['node', '/fixtures/runner.mjs'];
compose.services.updater.volumes = compose.services.updater.volumes.map(value => value.target === '/updates' ? { ...value, source: state } : value);
compose.services.updater.volumes.push({ type: 'bind', source: fixture, target: '/fixtures', read_only: true });
const file = path.join(root, 'compose.json'); await writeFile(file, JSON.stringify(compose));
const docker = async args => (await execute('docker', args, { cwd: packageRoot, env, timeout: 300000, maxBuffer: 8 * 1024 * 1024 })).stdout.trim();
const dc = args => docker(['compose', '-p', name, '-f', file, ...args]);
const base = async (service, port) => `http://${(await dc(['port', service, String(port)])).split('\n')[0]}`;
const call = async (url, route, { token, body, status = 200 } = {}) => {
  report.lastRequest = route;
  const response = await fetch(url + route, { method: body === undefined ? 'GET' : 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000) });
  const value = await response.json();
  assert.equal(response.status, status, `${route}: HTTP ${response.status}${value.error ? ` ${value.error}` : ''}`); return value;
};
const waitFor = async (check, timeout = 120000) => {
  const deadline = Date.now() + timeout;
  do { if (await check().catch(() => false)) return; await new Promise(resolve => setTimeout(resolve, 500)); } while (Date.now() < deadline);
  throw new Error('Smoke condition timed out');
};
const socketStatus = async () => JSON.parse(await dc(['exec', '-T', 'updater', 'node', '-e',
  "require('http').get({socketPath:'/run/dscord-updater/updater.sock',path:'/status'},r=>r.pipe(process.stdout)).on('error',()=>process.exit(1))"]));
const terminal = async phase => waitFor(async () => (await socketStatus()).job?.phase === phase);
const seed = "const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync('/data/update-smoke.sqlite');d.exec('CREATE TABLE IF NOT EXISTS retained(value TEXT)');d.prepare('INSERT INTO retained VALUES(?)').run(process.argv[1]);d.close();";
const readRows = () => dc(['exec', '-T', 'core', 'node', '-e', "const{DatabaseSync}=require('node:sqlite');const d=new DatabaseSync('/data/update-smoke.sqlite');console.log(JSON.stringify(d.prepare('SELECT value FROM retained').all()));d.close();"]);
try {
  for (const [tag, version, broken] of [['good', goodVersion, false], ['bad', badVersion, true], ['interrupted', interruptedVersion, false]]) {
    const dockerfile = path.join(root, `Dockerfile.${tag}`);
    const script = `const fs=require('fs');const p=JSON.parse(fs.readFileSync('/app/package.json'));p.version='${version}';fs.writeFileSync('/app/package.json',JSON.stringify(p));${broken ? "fs.writeFileSync('/app/src/core.mjs','process.exit(42)\\n');" : ''}`;
    await writeFile(dockerfile, `FROM ${image}\nUSER root\nRUN ["node", "-e", ${JSON.stringify(script)}]\nUSER node\n`);
    await docker(['build', '-f', dockerfile, '-t', `${name}:${tag}`, root]);
  }
  await dc(['up', '--no-build', '-d', '--wait', '--wait-timeout', '150']);
  const admin = await base('administration', 18110), core = await base('core', 18100), central = await base('central', 18200);
  await dc(['exec', '-T', '-e', 'DS_GROUP_ADMIN_PASSWORD=synthetic-update-smoke-password', 'administration', 'node', 'scripts/admin.mjs', 'init', 'owner']);
  const { access_token: adminToken } = await call(admin, '/admin-api/login', { body: { username: 'owner', password: 'synthetic-update-smoke-password' } });
  const account = await call(central, '/api/register', { body: { username: 'alice', password: 'synthetic-update-chat-password', displayName: 'Alice' }, status: 201 });
  const identity = await call(central, '/api/identity-tokens', { token: account.token, body: { audience: 'http://localhost:18100', allowNew: true } });
  const session = await call(core, '/api/session', { body: { identityToken: identity.token } });
  const roomId = await dc(['exec', '-T', 'core', 'node', '-e', "console.log(JSON.parse(require('fs').readFileSync('/data/matrix-setup.json')).roomId)"]);
  const message = await call(core, `/api/rooms/${encodeURIComponent(roomId)}/messages`, { token: session.access_token,
    body: { body: 'Synthetic message retained through server update', to: [], transactionId: name } });
  await dc(['exec', '-T', 'core', 'node', '-e', seed, 'before-update']);
  const snapshot = await dc(['exec', '-T', 'core', 'node', '-e', "const f=require('fs'),c=require('crypto');console.log(JSON.stringify(['matrix-setup.json','core-config.json'].map(n=>c.createHash('sha256').update(f.readFileSync('/data/'+n)).digest('hex'))))"]);
  await call(admin, '/admin-api/server-update/check', { token: adminToken, body: {} });
  await call(admin, '/admin-api/server-update/apply', { token: adminToken, body: { version: goodVersion }, status: 202 });
  await terminal('succeeded');
  assert.equal(await base('core', 18100), core); assert.equal(await base('administration', 18110), admin);
  await waitFor(async () => (await call(admin, '/healthz')).version === goodVersion, 20000);
  assert.deepEqual(JSON.parse(await readRows()), [{ value: 'before-update' }]);
  assert.equal(await dc(['exec', '-T', 'core', 'node', '-e', "const f=require('fs'),c=require('crypto');console.log(JSON.stringify(['matrix-setup.json','core-config.json'].map(n=>c.createHash('sha256').update(f.readFileSync('/data/'+n)).digest('hex'))))"]), snapshot);
  const history = await call(await base('synapse', 8008), `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=20`, { token: session.access_token });
  assert.ok(history.chunk.some(event => event.event_id === message.event_id));
  report.checks.push('Panel-triggered real image replacement retains ports, administrator session, chat session, Matrix message and server identity');
  assert.equal((await socketStatus()).job.backup, 'complete');
  await dc(['exec', '-T', 'updater', 'tar', '-tzf', `/updates/backups/${(await socketStatus()).job.id}/core.tgz`]);
  report.checks.push('Cold Core, Synapse and governance backups precede installation');
  await dc(['exec', '-T', 'core', 'node', '-e', seed, 'after-update']);
  await feed(badVersion, `${name}:bad`);
  await call(admin, '/admin-api/server-update/apply', { token: adminToken, body: { version: badVersion }, status: 202 });
  await terminal('rolled-back');
  assert.equal((await call(admin, '/healthz')).version, goodVersion);
  assert.deepEqual(JSON.parse(await readRows()), [{ value: 'before-update' }, { value: 'after-update' }]);
  report.checks.push('A target that crashes restores the preceding containers without rewinding accepted data');
  await feed(interruptedVersion, `${name}:interrupted`, true);
  await call(admin, '/admin-api/server-update/apply', { token: adminToken, body: { version: interruptedVersion }, status: 202 });
  await waitFor(async () => (await socketStatus()).job?.phase === 'installing' && (await docker(['ps', '--filter', `label=org.dscord.update-job=${(await socketStatus()).job.id}`, '--format', '{{.ID}}'])).length > 0);
  await feed(interruptedVersion, `${name}:interrupted`, false);
  await dc(['restart', 'updater']); await terminal('rolled-back');
  assert.equal((await call(admin, '/healthz')).version, goodVersion);
  assert.deepEqual(JSON.parse(await readRows()), [{ value: 'before-update' }, { value: 'after-update' }]);
  report.checks.push('Restarting the updater during replacement recovers the durable transaction');
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.error = error.message;
  report.containers = await dc(['ps', '-a', '--format', 'json']).catch(() => 'unavailable');
  report.updater = await socketStatus().catch(() => null);
  throw error;
}
finally {
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  // Only this generated project, its synthetic snapshots and its three fixture images are removed.
  await dc(['run', '--rm', '--no-deps', '--entrypoint', 'node', 'updater', '-e', "require('fs').rmSync('/updates/backups',{recursive:true,force:true});require('fs').chmodSync('/updates',0o755)"]).catch(() => {});
  await dc(['down', '--volumes', '--remove-orphans']).catch(() => {});
  for (const tag of ['good', 'bad', 'interrupted']) await docker(['image', 'rm', `${name}:${tag}`]).catch(() => {});
  await rm(root, { recursive: true, force: true });
  console.log(JSON.stringify(report, null, 2));
}
