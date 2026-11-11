import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { createCentral } from '../central/service.mjs';
import { packageRoot } from '../src/paths.mjs';

const root = await mkdtemp(path.join(os.tmpdir(), 'dscord-avatar-browser-'));
const output = path.join(packageRoot, '.local/avatar-validation');
await mkdir(output, { recursive: true });
let html = '';
const vite = await createServer({ configFile: false, root: path.join(packageRoot, 'web'), cacheDir: path.join(root, 'vite'), logLevel: 'error',
  plugins: [tailwindcss(), { name: 'avatar-fixture', configureServer(server) {
    server.middlewares.use('/__avatars', async (request, response, next) => {
      if (request.url.includes('html-proxy')) { next(); return; }
      response.setHeader('Content-Type', 'text/html'); response.end(await server.transformIndexHtml('/__avatars', html));
    });
  } }], server: { host: '127.0.0.1', port: 0 } });
let browser, central;
const checks = [], errors = [];
const check = name => checks.push(name);
try {
  await vite.listen();
  const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
  central = await createCentral({ dataRoot: path.join(root, 'central'), refreshIntervalMs: 0, config: { issuer: 'http://127.0.0.1', domain: 'id.test', clientOrigins: [origin] } });
  await new Promise(resolve => central.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${central.server.address().port}`;
  central.avatars.issuer = base;
  const call = async (route, token, body) => (await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })).json();
  const alice = await call('/api/register', null, { username: 'alice', password: 'fixture password', displayName: 'Alice' });
  const { bot } = await call('/api/bots', alice.token, { username: 'helper', displayName: 'Offline Helper' });
  const human = { id: '@alice:chat.test', name: 'Alice', globalId: alice.account.globalId, kind: 'human' };
  const helper = { id: '@helper:chat.test', name: bot.displayName, globalId: bot.globalId, kind: 'bot', ownerId: human.id };
  const session = { user_id: human.id, access_token: 'fixture-matrix-token', binding: { centralIssuer: base }, central: { token: alice.token } };
  html = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><script src="/theme.js"></script><link rel="stylesheet" href="/tokens.css"><link rel="stylesheet" href="/@fs/${packageRoot}/ui/tailwind.css"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/@fs/${packageRoot}/ui/styles.css"></head><body><main style="max-width:560px;padding:24px;margin:auto"><div id="root"></div></main><script type="module">
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {AvatarEditor} from '/src/components/AvatarEditor.tsx'; import {Avatar} from '/src/components/Avatar.tsx';
    function Fixture() { const [bot,setBot] = React.useState(false); const member = bot ? ${JSON.stringify(helper)} : ${JSON.stringify(human)};
      return React.createElement(React.Fragment,null,React.createElement('button',{onClick:()=>setBot(!bot)},bot?'Edit self':'Edit bot'),
        React.createElement('div',{'data-list-avatar':true},React.createElement(Avatar,{member})),
        React.createElement(AvatarEditor,{key:member.id,session:${JSON.stringify(session)},member})); }
    createRoot(document.getElementById('root')).render(React.createElement(Fixture));</script></body></html>`;
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 960, height: 900 }, colorScheme: 'dark', locale: 'en-US' });
  await context.addInitScript(() => localStorage.setItem('ds-group.language', 'en'));
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin + '/__avatars');
  await page.getByRole('button', { name: 'Change avatar', exact: true }).waitFor();
  check('central profile loads cross origin using the signed-in account');
  await page.locator('input[type=file]').setInputFiles({ name: 'bad.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
  assert.match(await page.getByRole('alert').textContent(), /JPG/); check('unsupported input gives an actionable error');
  const image = await sharp({ create: { width: 640, height: 320, channels: 3, background: '#b24c72' } }).png().toBuffer();
  const choose = target => target.locator('input[type=file]').setInputFiles({ name: 'portrait.png', mimeType: 'image/png', buffer: image });
  await choose(page);
  await page.getByRole('slider', { name: 'Zoom', exact: true }).focus(); await page.keyboard.press('ArrowRight');
  assert.ok(Number(await page.getByRole('slider', { name: 'Zoom', exact: true }).inputValue()) > 1); check('keyboard zoom and position controls work');
  const stage = page.locator('.avatar-crop-stage'); const box = await stage.boundingBox();
  await page.mouse.move(box.x + 100, box.y + 100); await page.mouse.down(); await page.mouse.move(box.x + 135, box.y + 100); await page.mouse.up();
  check('pointer crop keeps the image inside the square');
  await page.screenshot({ path: path.join(output, 'crop-dark.png'), fullPage: true });
  await page.getByRole('button', { name: 'Save avatar', exact: true }).click();
  await page.getByText('Avatar saved', { exact: true }).waitFor();
  await page.locator('[data-list-avatar] img').waitFor();
  assert.equal(await page.locator('[data-list-avatar] img').evaluate(img => img.complete && img.naturalWidth > 0), true);
  check('real central upload updates every subscribed avatar immediately');
  const second = await context.newPage(); second.on('pageerror', error => errors.push(error.message));
  await second.goto(origin + '/__avatars'); await second.getByRole('button', { name: 'Restore default', exact: true }).waitFor();
  await choose(second);
  await page.getByRole('button', { name: 'Restore default', exact: true }).click();
  await page.getByText('Default avatar restored', { exact: true }).waitFor();
  await second.waitForFunction(() => !document.querySelector('[data-list-avatar] img'));
  check('restoring default synchronizes to another open tab');
  await second.getByRole('button', { name: 'Save avatar', exact: true }).click();
  await second.getByRole('alert').waitFor(); assert.match(await second.getByRole('alert').textContent(), /another device/);
  assert.equal(await second.locator('.avatar-crop-stage').count(), 1); check('stale edits preserve their draft and report a version conflict');
  await second.getByRole('button', { name: 'Save avatar', exact: true }).click();
  await second.getByText('Avatar saved', { exact: true }).waitFor();
  await page.locator('[data-list-avatar] img').waitFor(); check('explicit conflict retry succeeds and broadcasts the new version');
  await choose(page);
  await page.route('**/api/me/avatar?**', route => route.request().method() === 'PUT' ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Synthetic upload failure' }), headers: { 'Access-Control-Allow-Origin': origin } }) : route.continue());
  await page.getByRole('button', { name: 'Save avatar', exact: true }).click();
  await page.getByRole('alert').waitFor(); assert.match(await page.getByRole('alert').textContent(), /Synthetic/);
  assert.equal(await page.locator('[data-list-avatar] img').count(), 1); assert.equal(await page.locator('.avatar-crop-stage').count(), 1);
  check('failed upload preserves both the published avatar and editable crop');
  await page.unroute('**/api/me/avatar?**');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Edit bot', exact: true }).click();
  await page.getByRole('button', { name: 'Change avatar', exact: true }).waitFor();
  await choose(page); await page.getByRole('button', { name: 'Save avatar', exact: true }).click(); await page.getByText('Avatar saved', { exact: true }).waitFor();
  assert.equal(central.store.settingsOf(central.store.account(bot.id)).revision, bot.settings.revision);
  check('an offline Bot can change avatar without changing its runtime revision');
  await page.reload(); await page.getByRole('button', { name: 'Edit bot', exact: true }).click(); await page.getByRole('button', { name: 'Restore default', exact: true }).waitFor();
  check('reload restores the saved central Bot avatar');
  await page.evaluate(() => document.documentElement.dataset.theme = 'light');
  await page.screenshot({ path: path.join(output, 'bot-light.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 }); await choose(page);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: path.join(output, 'crop-mobile.png'), fullPage: true });
  check('light mode and mobile crop fit the viewport');
  await page.locator('main').evaluate(element => { element.style.padding = '80px'; });
  const narrow = await stage.boundingBox();
  assert.ok(narrow.width < 240 && Math.abs(narrow.width - narrow.height) < 1, JSON.stringify(narrow));
  await page.waitForFunction(() => {
    const stage = document.querySelector('.avatar-crop-stage');
    const picture = stage.querySelector('img');
    return Math.abs(parseFloat(picture.style.height) - stage.clientWidth) < 1;
  });
  check('nested narrow containers keep the crop square and scale the image to the actual viewport');
  await page.locator('main').evaluate(element => { element.style.padding = '24px'; });
  await page.evaluate(() => { localStorage.setItem('ds-group.language', 'zh-CN'); window.dispatchEvent(new StorageEvent('storage', { key: 'ds-group.language', newValue: 'zh-CN' })); });
  await page.getByRole('button', { name: '保存头像', exact: true }).waitFor();
  check('Chinese labels follow the account language');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: 'passed', level: 'real-central-http-chromium-react', checks, modelCalls: 0 }, null, 2));
} finally {
  await writeFile(path.join(output, 'browser.json'), JSON.stringify({ checks, errors, modelCalls: 0 }, null, 2));
  await browser?.close(); await central?.close(); await vite.close(); await rm(root, { recursive: true, force: true });
}
