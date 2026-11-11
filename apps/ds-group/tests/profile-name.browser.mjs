import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { chromium } from 'playwright';
import { createCentral } from '../central/service.mjs';
import { packageRoot } from '../src/paths.mjs';

// A person renames themselves in Settings → Account, against a real central server; Bots use their update_profile tool.
const root = await mkdtemp(path.join(os.tmpdir(), 'dscord-profile-name-'));
const output = path.join(packageRoot, '.local/profile-name-browser');
await mkdir(output, { recursive: true });
let html = '';
const vite = await createServer({ configFile: false, root: path.join(packageRoot, 'web'), cacheDir: path.join(root, 'vite'), logLevel: 'error',
  plugins: [tailwindcss(), { name: 'profile-name-fixture', configureServer(server) {
    server.middlewares.use('/__profile', async (request, response, next) => {
      if (request.url.includes('html-proxy')) { next(); return; }
      response.setHeader('Content-Type', 'text/html'); response.end(await server.transformIndexHtml('/__profile', html));
    });
  } }], server: { host: '127.0.0.1', port: 0 } });
let browser, central;
const errors = [];
try {
  await vite.listen();
  const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
  central = await createCentral({ dataRoot: path.join(root, 'central'), refreshIntervalMs: 0, config: { issuer: 'http://127.0.0.1', domain: 'id.test', clientOrigins: [origin] } });
  await new Promise(resolve => central.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${central.server.address().port}`;
  central.avatars.issuer = base;
  const register = await fetch(`${base}/api/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'alice', password: 'fixture password', displayName: 'Alice' }) });
  const alice = await register.json();
  const session = { user_id: '@alice:chat.test', access_token: 'fixture-matrix-token', binding: { centralIssuer: base }, central: { token: alice.token },
    identity: { globalId: alice.account.globalId } };
  html = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><script src="/theme.js"></script>
    <link rel="stylesheet" href="/tokens.css"><link rel="stylesheet" href="/@fs/${packageRoot}/ui/tailwind.css"><link rel="stylesheet" href="/styles.css">
    <link rel="stylesheet" href="/@fs/${packageRoot}/ui/styles.css"></head><body><div id="root"></div><script type="module">
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {SettingsDialog} from '/src/components/SettingsDialog.tsx';
    const api = async route => { if (route === '/api/push/config') return { enabled: false }; return {}; };
    function Fixture() {
      const [name, setName] = React.useState('Alice');
      window.fixtureChanged = 0;
      return React.createElement(SettingsDialog, { tab: 'account', onClose() {}, onTab() {}, session: ${JSON.stringify(session)}, api,
        currentUser: { id: '@alice:chat.test', name, kind: 'human', globalId: ${JSON.stringify(alice.account.globalId)} },
        onProfileChanged: () => { window.fixtureChanged++; }, onSwitchAccount() {}, onLogout() {}, logoutBusy: false,
        onOpenRoom() {}, onPwaReady() {} });
    }
    createRoot(document.getElementById('root')).render(React.createElement(Fixture));</script></body></html>`;
  browser = await chromium.launch();
  const shoot = async (page, name) => page.screenshot({ path: path.join(output, name), animations: 'disabled' });
  const open = async (options, language) => {
    const context = await browser.newContext(options);
    await context.addInitScript(value => localStorage.setItem('ds-group.language', value), language);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/__profile');
    await page.locator('#profile-display-name').waitFor();
    await page.evaluate(() => document.fonts.ready);
    return page;
  };

  const page = await open({ viewport: { width: 1000, height: 850 }, colorScheme: 'light', locale: 'zh-CN', deviceScaleFactor: 2 }, 'zh-CN');
  assert.equal(await page.locator('#profile-display-name').inputValue(), 'Alice');
  assert.equal(await page.getByRole('button', { name: '保存名称' }).isDisabled(), true, 'an unchanged name has nothing to save');
  await page.locator('#profile-display-name').scrollIntoViewIfNeeded();
  await shoot(page, '1-设置-账号-显示名称-中文.png');
  await page.locator('#profile-display-name').fill('爱丽丝');
  await page.getByRole('button', { name: '保存名称' }).click();
  await page.getByText('名称已保存，几秒内各聊天服务器都会显示新名称。').waitFor();
  assert.equal(central.store.account(alice.account.id).display_name, '爱丽丝');
  assert.equal(await page.evaluate(() => window.fixtureChanged), 1);
  await shoot(page, '2-设置-账号-名称已保存-中文.png');

  // The central server's refusal is shown in the person's language.
  await page.route('**/api/me', route => route.request().method() === 'PATCH'
    ? route.fulfill({ status: 400, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': origin },
      body: JSON.stringify({ error: 'DISPLAY_NAME_INVALID', code: 'DISPLAY_NAME_INVALID' }) }) : route.continue());
  await page.locator('#profile-display-name').fill('坏名字');
  await page.getByRole('button', { name: '保存名称' }).click();
  await page.getByRole('alert').filter({ hasText: '名称最多 80 个字' }).waitFor();
  await shoot(page, '3-设置-账号-名称无效-中文.png');
  await page.close();

  const mobile = await open({ viewport: { width: 390, height: 844 }, colorScheme: 'light', locale: 'zh-CN', deviceScaleFactor: 2 }, 'zh-CN');
  await mobile.locator('#profile-display-name').scrollIntoViewIfNeeded();
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await shoot(mobile, '4-设置-账号-显示名称-手机-中文.png');
  await mobile.close();

  const dark = await open({ viewport: { width: 1000, height: 850 }, colorScheme: 'dark', locale: 'en-US', deviceScaleFactor: 2 }, 'en');
  await dark.locator('#profile-display-name').scrollIntoViewIfNeeded();
  await dark.getByRole('button', { name: 'Save name' }).waitFor();
  await shoot(dark, '5-settings-account-name-dark-en.png');
  await dark.close();
  assert.deepEqual(errors, []);
  console.log(`profile name browser check passed; screenshots in ${output}`);
} finally {
  await browser?.close();
  await central?.close();
  await vite.close();
  await rm(root, { recursive: true, force: true });
}
