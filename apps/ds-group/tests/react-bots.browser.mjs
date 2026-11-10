import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { chromium } from 'playwright';
import { packageRoot } from '../src/paths.mjs';

const html = `<!doctype html>
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
      import { setLocalePreference } from '/i18n.js';

      const fixture = window.fixture = { closed: 0, codes: 0, locale: setLocalePreference };
      // The signed-in account's central session, which makes the connection key the dialog hands over.
      const session = { user_id: '@alice:home.test', access_token: 'synthetic-token', binding: { centralIssuer: 'https://central.test' }, central: { token: 'central-session' } };
      window.fetch = async (url, init) => {
        if (String(url) !== 'https://central.test/api/connect-codes' || init.headers.Authorization !== 'Bearer central-session') throw new Error('Unexpected fixture request ' + url);
        return Response.json({ code: 'connect-' + ++fixture.codes, expiresIn: 600 });
      };
      function Fixture() {
        const [open, setOpen] = React.useState(true);
        return React.createElement(React.Fragment, null,
          React.createElement('button', { id: 'open-create-bot', onClick: () => setOpen(true) }, 'Open'),
          React.createElement(CreateBotDialog, { open, session, server: 'https://chat.test', onClose: () => { fixture.closed++; setOpen(false); } }),
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
const report = { status: 'failed', level: 'real-chromium-add-bot-guidance-fixture', checks, pageErrors, modelCalls: 0 };
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
        response.end(await vite.transformIndexHtml('/__bots', html));
      });
    },
  }],
  server: { host: '127.0.0.1', port: 0 },
  logLevel: 'error',
});
let browser;
let page;
try {
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
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__bots`);
  await page.locator('#create-bot-dialog[open]').waitFor();
  assert.equal(await page.locator('#create-bot-title').textContent(), 'Add a Bot');
  assert.equal(await page.locator('#create-bot-dialog input, #create-bot-dialog select, #create-bot-dialog [role="radio"]').count(), 0);
  checks.push('addBotExplainsDshWithoutAWebCreationForm');
  // One click makes the key and copies it; the dialog says where it goes next.
  assert.equal(await page.locator('.bot-add-steps > li').count(), 3);
  await page.getByRole('button', { name: 'Copy connection key', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Copied. Paste it into the DSCord panel in DSH' }).waitFor();
  const key = await page.locator('#bot-connection-key').inputValue();
  assert.deepEqual(JSON.parse(Buffer.from(key, 'base64url').toString('utf8')), { server: 'https://chat.test', code: 'connect-1' });
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), key);
  await page.screenshot({ path: path.join(packageRoot, '.local/react-bots-add-dark-en.png') });
  await page.evaluate(() => { window.fixture.locale('zh-CN'); window.DSGroupTheme.setPreference('light'); });
  await page.getByRole('status').filter({ hasText: '已复制。到 DSH 的 DSCord 面板里粘贴' }).waitFor();
  await page.screenshot({ path: path.join(packageRoot, '.local/react-bots-add-light-zh.png') });
  await page.evaluate(() => { window.fixture.locale('en'); window.DSGroupTheme.setPreference('dark'); });
  checks.push('oneClickMakesTheConnectionKeyCopiesItAndSaysWhereToPasteIt');
  await page.keyboard.press('Escape');
  await page.locator('#create-bot-dialog').waitFor({ state: 'hidden' });
  await page.locator('#open-create-bot').click();
  await page.locator('#create-bot-done').click();
  await page.locator('#create-bot-dialog').waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => window.fixture.closed), 2);
  await page.locator('#open-create-bot').click();
  assert.equal(await page.locator('#bot-connection-key').count(), 0, 'a key made earlier is not shown again');
  checks.push('escapeAndCloseButtonBothDismiss');
  await page.setViewportSize({width:390,height:844});
  const bounds=await page.locator('#create-bot-dialog').evaluate(element=>({width:element.getBoundingClientRect().width,scroll:element.scrollWidth,client:element.clientWidth}));
  assert.ok(bounds.width<=390 && bounds.scroll<=bounds.client+1);
  assert.deepEqual(pageErrors,[]);
  checks.push('mobileLayoutFitsAndHasNoBrowserErrors');
  report.status='passed';
} catch (error) {
  report.error = error.stack ?? String(error);
  throw error;
} finally {
  await mkdir(path.dirname(reportPath), { recursive: true });
  if (report.status !== 'passed' && page) await page.screenshot({ path: path.join(packageRoot, '.local/react-bots-browser-failure.png') }).catch(() => {});
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  await browser?.close();
  await server.close();
  await rm(temporary, { recursive: true, force: true });
  console.log(JSON.stringify(report));
}
