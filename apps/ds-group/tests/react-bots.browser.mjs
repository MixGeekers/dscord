import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { chromium } from 'playwright';
import { packageRoot } from '../src/paths.mjs';
import { CHAT, centralUrl, connectFixture } from './fixtures/connect.mjs';

// The page shows both Bot dialogs for one signed-in person. Its requests to the central server are carried there
// by the test, so the page, the central server and the DSH controller are the real ones end to end.
const html = token => `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script src="/theme.js"></script>
    <link rel="stylesheet" href="/tokens.css">
    <link rel="stylesheet" href="/@fs/${path.join(packageRoot, 'ui/tailwind.css')}">
    <link rel="stylesheet" href="/styles.css">
    <link rel="stylesheet" href="/@fs/${path.join(packageRoot, 'ui/styles.css')}">
  </head>
  <body>
    <div id="root"></div>
    <script type="module">
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { CreateBotDialog } from '/src/components/CreateBotDialog.tsx';
      import { MyBotsDialog } from '/src/components/MyBotsDialog.tsx';
      import { listBots } from '/src/central.ts';
      import { setLocalePreference } from '/i18n.js';

      const fixture = window.fixture = { closed: 0, direct: [], home: [], locale: setLocalePreference };
      const session = { user_id: '@alice:chat.example', access_token: 'synthetic-token', binding: { centralIssuer: '${centralUrl}' }, central: { token: '${token}' } };
      function Fixture() {
        const [open, setOpen] = React.useState('create');
        const [owned, setOwned] = React.useState([]);
        // What the chat server would list once the Bot has signed in to it.
        const arrived = React.useCallback(async () => {
          const bots = await listBots(session.binding.centralIssuer, session.central.token);
          setOwned(bots.map(bot => ({ id: '@' + bot.username + ':chat.example', name: bot.displayName, kind: 'bot', ownerId: session.user_id, globalId: bot.globalId })));
        }, []);
        return React.createElement(React.Fragment, null,
          React.createElement('button', { id: 'open-create-bot', onClick: () => setOpen('create') }, 'Add'),
          React.createElement('button', { id: 'open-my-bots', onClick: () => setOpen('manage') }, 'Manage'),
          React.createElement(CreateBotDialog, { open: open === 'create', session, server: '${CHAT}', ownedBots: owned, onArrived: arrived,
            onClose: () => { fixture.closed++; setOpen(null); }, onDirect: id => { fixture.direct.push(id); setOpen(null); } }),
          React.createElement(MyBotsDialog, { open: open === 'manage', bots: owned, status: null, session, server: '${CHAT}', onClose: () => setOpen(null),
            onCreate: () => setOpen('create'), onHome: id => fixture.home.push(id), onDirect: id => fixture.direct.push(id) }),
        );
      }
      createRoot(document.getElementById('root')).render(React.createElement(Fixture));
    </script>
  </body>
</html>`;

const temporary = await mkdtemp(path.join(os.tmpdir(), 'dscord-react-bots-'));
const reportPath = path.join(packageRoot, '.local/react-bots-browser.json');
const checks = [];
const pageErrors = [];
const report = { status: 'failed', level: 'real-chromium-page-real-central-and-actual-dsh-controller-with-synthetic-kernel', checks, pageErrors, modelCalls: 0, screenshots: [] };
const f = await connectFixture();
const output = path.join(packageRoot, '.local/react-bots-browser');
const server = await createServer({
  configFile: false,
  root: path.join(packageRoot, 'web'),
  cacheDir: path.join(temporary, 'vite-cache'),
  plugins: [tailwindcss(), {
    name: 'react-bots-fixture',
    configureServer(vite) {
      vite.middlewares.use('/__bots', async (request, response, next) => {
        if (request.url.includes('html-proxy')) { next(); return; }
        response.setHeader('Content-Type', 'text/html');
        response.end(await vite.transformIndexHtml('/__bots', html(f.alice)));
      });
    },
  }],
  server: { host: '127.0.0.1', port: 0 },
  logLevel: 'error',
});
let browser;
let page;
let reporting;
// Both languages at each step the owner sees, so the Chinese page is checked as it is shown.
async function shots(name) {
  for (const [language, theme] of [['en', 'dark'], ['zh-CN', 'light']]) {
    await page.evaluate(([language, theme]) => { window.fixture.locale(language); window.DSGroupTheme.setPreference(theme); }, [language, theme]);
    await page.locator(`html[lang="${language}"]`).waitFor();
    const filename = path.join(output, `${name}-${theme}-${language === 'en' ? 'en' : 'zh'}.png`);
    await page.screenshot({ path: filename, animations: 'disabled' });
    report.screenshots.push(filename);
  }
  await page.evaluate(() => { window.fixture.locale('en'); window.DSGroupTheme.setPreference('dark'); });
  await page.locator('html[lang="en"]').waitFor();
}
const until = async (check, what) => {
  for (let attempt = 0; attempt < 100; attempt++) { if (await check()) return; await new Promise(resolve => setTimeout(resolve, 100)); }
  assert.fail(`Timed out waiting until ${what}`);
};
try {
  await mkdir(output, { recursive: true });
  await server.listen();
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 985, height: 822 }, locale: 'en-US', reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] });
  context.setDefaultTimeout(10000);
  await context.addInitScript(() => {
    localStorage.setItem('ds-group.language', 'en');
    localStorage.setItem('ds-group.theme', 'dark');
  });
  page = await context.newPage();
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route(`${centralUrl}/**`, async route => {
    const request = route.request();
    const { pathname, search } = new URL(request.url());
    const response = await fetch(f.centralBase + pathname + search, { method: request.method(), body: request.postData() ?? undefined,
      headers: Object.fromEntries(Object.entries(request.headers()).filter(([name]) => ['authorization', 'content-type'].includes(name))) });
    await route.fulfill({ status: response.status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: await response.text() });
  });
  // DSH reports every few seconds; the test does not wait that long.
  reporting = setInterval(() => void f.controller.synchronize().catch(() => {}), 300);
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__bots`);
  const dialog = page.locator('#create-bot-dialog[open]');
  await dialog.waitFor();
  assert.equal(await page.locator('#create-bot-title').textContent(), 'Add a Bot');
  assert.equal(await page.locator('#create-bot-submit').isDisabled(), true, 'a Bot needs a name');
  assert.deepEqual(await page.locator('#create-bot-model option').allTextContents(), ['Device default']);
  await dialog.getByText('Models can be chosen here once a device is connected.', { exact: true }).waitFor();
  // Where the Bot will run is always shown: with no device yet, it says the first one to connect takes it.
  assert.deepEqual(await page.locator('#create-bot-device option').allTextContents(), ['The first device that connects']);
  assert.equal(await page.locator('#create-bot-device').isDisabled(), true);
  await dialog.getByText('No device is connected yet. After creating the Bot you get a connection key', { exact: false }).waitFor();
  await page.locator('#create-bot-name').fill('Shiyu');
  await page.locator('#create-bot-role').fill('A friend and project partner');
  await shots('create-form');
  await page.locator('#create-bot-submit').click();
  await page.locator('#create-bot-progress[data-stage="noDevice"]').waitFor();
  assert.equal(await page.locator('#create-bot-title').textContent(), 'Shiyu is created');
  const [made] = (await f.api('GET', '/api/bots', { token: f.alice })).bots;
  assert.deepEqual([made.displayName, made.settings.role, made.settings.model, made.settings.servers, made.settings.deviceId], ['Shiyu', 'A friend and project partner', '', [CHAT], null]);
  assert.match(made.username, /^shiyu-[0-9a-f]{6}$/);
  checks.push('theOwnerCreatesABotOnThePageAndItIsKeptAtTheCentralServerForThisChatServer');
  // No DSH is linked yet, so the next thing shown is the key that links one.
  await page.getByRole('button', { name: 'Copy connection key', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Copied. Paste it into the DSCord panel in DSH' }).waitFor();
  const key = await page.locator('#bot-connection-key').inputValue();
  assert.equal(JSON.parse(Buffer.from(key, 'base64url').toString('utf8')).server, CHAT);
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), key);
  await shots('create-link-device');
  await f.controller.handle({ action: 'login', key });
  await page.locator('#create-bot-progress[data-stage="online"]').waitFor();
  assert.deepEqual(f.locals.map(bot => [bot.name, bot.role]), [['Shiyu', 'A friend and project partner']]);
  assert.equal(f.live.size, 1);
  await dialog.getByText('Shiyu is online and ready to chat.', { exact: true }).waitFor();
  await page.locator('#create-bot-chat:enabled').waitFor();
  await shots('create-online');
  await page.locator('#create-bot-chat').click();
  await page.locator('#create-bot-dialog').waitFor({ state: 'hidden' });
  assert.deepEqual(await page.evaluate(() => window.fixture.direct), [`@${made.username}:chat.example`]);
  checks.push('pastingTheKeyIntoDshBringsTheBotOnlineAndThePageOffersTheChat');

  // With a device linked, the form offers that device's models and a new Bot comes online with no further step.
  await page.locator('#open-create-bot').click();
  await dialog.waitFor();
  await page.locator('#create-bot-model option[value="fixture/large"]').waitFor({ state: 'attached' });
  assert.deepEqual(await page.locator('#create-bot-model option').allTextContents(), ['Device default (fixture/default)', 'Default', 'Large', 'Locked (no key on the device yet)']);
  assert.deepEqual(await page.locator('#create-bot-device option').allTextContents(), ['DSH laptop · Online']);
  assert.equal(await page.locator('#create-bot-device').inputValue(), f.controller.state.hostId);
  assert.equal(await page.locator('#create-bot-name').inputValue(), '', 'the form starts empty each time');
  await page.locator('#create-bot-name').fill('数据员');
  await page.locator('#create-bot-model').selectOption('fixture/large');
  await shots('create-form-device');
  await page.locator('#create-bot-submit').click();
  await page.locator('#create-bot-progress[data-stage="online"]').waitFor();
  assert.deepEqual(f.locals.map(bot => [bot.name, bot.model]), [['Shiyu', undefined], ['数据员', 'fixture/large']]);
  await page.keyboard.press('Escape');
  await page.locator('#create-bot-dialog').waitFor({ state: 'hidden' });
  checks.push('aSecondBotShowsTheDeviceItWillRunOnPicksOneOfItsModelsAndGoesOnlineOnItsOwn');

  // Managing: each Bot's setup is changed here and the device follows.
  await page.locator('#open-my-bots').click();
  const manage = page.locator('#my-bots-dialog[open]');
  await manage.waitFor();
  const row = manage.locator(`[data-managed-bot="${made.id}"]`);
  await row.locator('.bot-stage[data-stage="online"]').waitFor();
  assert.equal(await row.getAttribute('data-owned-bot'), `@${made.username}:chat.example`);
  assert.equal(await manage.locator('[data-managed-bot]').count(), 2);
  const device = manage.locator('[data-device]');
  assert.match(await device.innerText(), /DSH laptop[\s\S]*Default model fixture\/default[\s\S]*Online/);
  await row.locator('[data-bot-setup-button]').click();
  await row.getByLabel('Name', { exact: true }).fill('诗雨');
  await row.getByLabel('Role', { exact: true }).fill('Keeps the garden plan');
  assert.deepEqual(await row.getByLabel('Runs on', { exact: true }).locator('option').allTextContents(), ['DSH laptop · Online']);
  await row.getByLabel('Model', { exact: true }).selectOption('fixture/large');
  await row.locator('[data-save-bot]').click();
  await row.getByRole('status').filter({ hasText: 'Saved.' }).waitFor();
  await until(() => f.locals[0].name === '诗雨' && f.locals[0].role === 'Keeps the garden plan' && f.locals[0].model === 'fixture/large', 'the device applies the new setup');
  await row.getByText('Running model · fixture/large', { exact: true }).waitFor();
  await row.locator('strong', { hasText: '诗雨' }).waitFor();
  checks.push('nameRoleAndModelAreChangedOnThePageAndTheDeviceAppliesThem');
  await shots('manage-setup');
  await row.locator('[data-bot-here]', { hasText: 'Remove from this server' }).click();
  await row.locator('.bot-stage[data-stage="notHere"]').waitFor();
  await until(() => f.live.size === 1, 'the device stops the Bot on this server');
  await row.locator('[data-bot-here]', { hasText: 'Add to this server' }).click();
  await row.locator('.bot-stage[data-stage="online"]').waitFor();
  assert.equal(f.live.size, 2);
  checks.push('theOwnerTakesABotOffThisServerAndPutsItBack');
  await row.locator('[data-bot-setup-button]').click();
  await page.setViewportSize({ width: 390, height: 844 });
  const bounds = await page.locator('#my-bots-dialog').evaluate(element => ({ width: element.getBoundingClientRect().width, scroll: element.scrollWidth, client: element.clientWidth }));
  assert.ok(bounds.width <= 390 && bounds.scroll <= bounds.client + 1, JSON.stringify(bounds));
  await shots('manage-mobile');
  await page.setViewportSize({ width: 985, height: 822 });
  checks.push('mobileLayoutFits');
  // Removing the device signs that DSH out: its Bots stop and wait for another device.
  await device.locator('[data-remove-device]').click();
  await manage.getByText('No device is connected yet.', { exact: true }).waitFor();
  await row.locator('.bot-stage[data-stage="noDevice"]').waitFor();
  await until(() => f.live.size === 0 && !f.controller.state.centralToken, 'the removed device stops and is signed out');
  await manage.locator('#device-make-connection-key').waitFor();
  await shots('manage-no-device');
  checks.push('removingADeviceSignsItOutAndItsBotsWaitForAnother');
  assert.deepEqual(pageErrors, []);
  report.status = 'passed';
} catch (error) {
  report.error = error.stack ?? String(error);
  throw error;
} finally {
  clearInterval(reporting);
  await mkdir(path.dirname(reportPath), { recursive: true });
  if (report.status !== 'passed' && page) await page.screenshot({ path: path.join(packageRoot, '.local/react-bots-browser-failure.png') }).catch(() => {});
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  await browser?.close();
  await server.close();
  await f.close();
  await rm(temporary, { recursive: true, force: true });
  console.log(JSON.stringify(report));
}
