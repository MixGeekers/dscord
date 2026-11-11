import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { createAdmin } from '../src/admin.mjs';
import { packageRoot } from '../src/paths.mjs';
import { chooseOption } from './helpers/select.mjs';

const root = await mkdtemp(path.join(os.tmpdir(), 'dscord-update-browser-'));
const output = path.join(packageRoot, '.local/server-updates-browser'); await mkdir(output, { recursive: true });
const state = { enabled: true, currentVersion: '0.4.0-alpha.3', checkedAt: null, checkError: null,
  settings: { policy: 'notify', channel: 'prerelease', windowStart: 3, windowEnd: 5, timeZone: 'UTC' }, available: null, job: null, history: [] };
const operations = [], errors = [], checks = [];
const admin = await createAdmin({ dataRoot: root, setup: { serverName: 'updates.test', homeserverUrl: 'http://127.0.0.1:1', participants: [] },
  updater: async (route, input) => {
    operations.push(route);
    if (route === '/check') state.available = { version: '0.4.0-alpha.4', eligible: true, url: 'https://github.com/MixGeekers/dscord/releases' };
    if (route === '/settings') state.settings = input;
    if (route === '/apply') state.job = { id: 'synthetic-job', version: input.version, previousVersion: state.currentVersion,
      phase: 'draining', startedAt: Date.now(), backup: 'pending', error: null };
    return structuredClone(state);
  } });
await admin.auth.change('console', { username: 'owner', password: 'synthetic-browser-password', role: 'owner', enabled: true }, { bootstrap: true });
await new Promise(resolve => admin.server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'en-US' });
  await context.addInitScript(() => { localStorage.setItem('ds-group.language', 'en'); localStorage.setItem('ds-group.theme', 'light'); });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${admin.server.address().port}`);
  await page.getByLabel('Administrator', { exact: true }).fill('owner');
  await page.getByLabel('Password', { exact: true }).fill('synthetic-browser-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: 'Server updates', exact: true }).click();
  await page.getByRole('button', { name: 'Check for updates', exact: true }).click();
  await page.getByText('Available version: 0.4.0-alpha.4', { exact: true }).waitFor();
  checks.push('Owner checks a release through the real administration API and sees its version');
  await chooseOption(page.getByLabel('Update policy', { exact: true }), 'auto');
  await page.getByLabel('Time zone', { exact: true }).fill('America/Caracas');
  await page.getByRole('button', { name: 'Save update settings', exact: true }).click();
  await page.getByText('Settings saved', { exact: true }).waitFor();
  assert.equal(state.settings.timeZone, 'America/Caracas');
  await page.getByRole('button', { name: 'Install and restart', exact: true }).click();
  await page.getByText('Waiting for tasks and Bot nodes', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Install and restart', exact: true }).isDisabled(), true);
  assert.equal(operations.filter(operation => operation === '/apply').length, 1);
  checks.push('Maintenance settings save, and an active update prevents a second installation');
  state.currentVersion = '0.4.0-alpha.4'; state.available = null;
  state.job = { ...state.job, phase: 'succeeded', backup: 'complete' }; state.history = [state.job];
  await page.getByText('Installed version: 0.4.0-alpha.4', { exact: true }).waitFor();
  await page.screenshot({ path: path.join(output, 'desktop.png'), fullPage: true });
  await chooseOption(page.getByLabel('Language', { exact: true }), 'zh-CN');
  await page.getByRole('heading', { name: '服务器更新', exact: true }).waitFor();
  await page.getByText('已完成备份', { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
  await page.screenshot({ path: path.join(output, 'mobile.png'), fullPage: true });
  checks.push('Completion and backup status persist through polling, language changes and mobile layout');
  await admin.auth.change('owner', { username: 'reader', password: 'synthetic-browser-password', role: 'auditor', enabled: true });
  const reader = await admin.auth.login({ username: 'reader', password: 'synthetic-browser-password' }, 'test');
  await page.evaluate(session => sessionStorage.setItem(`dscord.management.${location.origin}`, JSON.stringify(session)), reader);
  await page.reload(); await page.getByRole('button', { name: 'Server updates', exact: true }).click();
  await page.getByText('Only an instance owner can change or install server updates.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Install and restart', exact: true }).count(), 0);
  checks.push('Auditors can inspect update history without installation or settings controls');
  assert.deepEqual(errors, []);
  await writeFile(path.join(output, 'report.json'), JSON.stringify({ level: 'real-browser-admin-http-synthetic-updater', checks, errors }, null, 2) + '\n');
  console.log(JSON.stringify({ checks, errors }));
} finally { await browser?.close(); await admin.close(); await rm(root, { recursive: true, force: true }); }
