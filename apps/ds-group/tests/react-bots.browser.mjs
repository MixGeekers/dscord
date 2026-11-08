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

      const fixture = window.fixture = { closed: 0 };
      function Fixture() {
        const [open, setOpen] = React.useState(true);
        return React.createElement(React.Fragment, null,
          React.createElement('button', { id: 'open-create-bot', onClick: () => setOpen(true) }, 'Open'),
          React.createElement(CreateBotDialog, { open, onClose: () => { fixture.closed++; setOpen(false); } }),
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
  const context = await browser.newContext({ viewport: { width: 985, height: 822 }, locale: 'en-US' });
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
  await page.keyboard.press('Escape');
  await page.locator('#create-bot-dialog').waitFor({ state: 'hidden' });
  await page.locator('#open-create-bot').click();
  await page.locator('#create-bot-done').click();
  await page.locator('#create-bot-dialog').waitFor({ state: 'hidden' });
  assert.equal(await page.evaluate(() => window.fixture.closed), 2);
  await page.locator('#open-create-bot').click();
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
