// Installed-app (PWA) layout on a phone: no zoom, nothing under the status bar,
// the composer meets the home indicator and, with the keyboard open, the keyboard.
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { chromium } from 'playwright';
import { packageRoot } from '../src/paths.mjs';

const SAFE_TOP = 59;
const SAFE_BOTTOM = 34;
const KEYBOARD = 336;
const screen = { width: 390, height: 844 };

const people = [
  { id: '@alice:test', localpart: 'alice', name: '林小雨', kind: 'human' },
  { id: '@bob:test', localpart: 'bob', name: '王大可', kind: 'human' },
];
const room = { roomId: '!one:test', name: '产品讨论', kind: 'group', participantIds: people.map(person => person.id) };
const bootstrap = {
  name: 'DSCord', roomId: room.roomId, roomName: room.name, participants: people,
  attachments: { maxBytes: 52428800, maxPerMessage: 10 },
};
const centralOrigin = 'https://id.example';
const session = {
  user_id: people[0].id, access_token: 'alice-fixture',
  identity: { globalId: 'alice@id.example', matrixUserId: people[0].id, kind: 'human' },
};
const discovery = {
  schemaVersion: 2, contractVersion: '2.0.0', name: 'DSCord',
  home: { serverName: 'test', coreUrl: null, matrixUrl: 'http://127.0.0.1:1' },
  central: { issuer: centralOrigin },
  auth: { mode: 'central-identity-token', audience: null, sessionPath: '/api/session', cookieCredentials: false },
};
const now = Date.now();
const lines = [
  ['@bob:test', '早上好，新版本的安装包已经放到群文件里了。'],
  ['@alice:test', '收到，我装到手机上看看。'],
  ['@bob:test', '主屏幕打开以后，顶部和底部都留意一下有没有被遮挡。'],
  ['@alice:test', '顶部状态栏下面是干净的标题栏，底部输入框正好贴着横条上方。'],
  ['@bob:test', '双指缩放也试一下，应该已经缩不动了。'],
  ['@alice:test', '试过了，缩不动，键盘弹出来输入框也直接贴在键盘上面。'],
];
const events = lines.map(([sender, body], index) => ({
  event_id: `$line-${index}`, room_id: room.roomId, sender, type: 'm.room.message',
  origin_server_ts: now - (lines.length - index) * 60000, content: { body },
}));

const html = `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
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
      import App from '/src/App.tsx';
      createRoot(document.getElementById('root')).render(React.createElement(App));
    </script>
  </body>
</html>`;

const output = path.join(packageRoot, '.local/mobile-viewport');
const temporary = await mkdtemp(path.join(os.tmpdir(), 'ds-group-mobile-viewport-'));
const server = await createServer({
  configFile: false,
  root: path.join(packageRoot, 'web'),
  cacheDir: path.join(temporary, 'vite-cache'),
  plugins: [tailwindcss(), {
    name: 'mobile-viewport-fixture',
    configureServer(vite) {
      vite.middlewares.use('/__app', async (request, response, next) => {
        if (request.url.includes('html-proxy')) return next();
        response.setHeader('Content-Type', 'text/html');
        response.end(await vite.transformIndexHtml('/__app', html));
      });
    },
  }],
  server: { host: '127.0.0.1', port: 0 },
  logLevel: 'error',
});

const checks = [];
const pageErrors = [];
const unhandled = [];
let browser;
let failure;

async function openApp(theme) {
  const context = await browser.newContext({ locale: 'zh-CN', viewport: screen, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  context.setDefaultTimeout(15000);
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  discovery.auth.audience = origin;
  const { parseClientConfig } = await import('../web/src/client-config.ts');
  const { bindSession, sessionStorageKey, storageKey } = await import('../web/src/session.ts');
  const clientConfig = parseClientConfig({ schemaVersion: 1 }, origin);
  const bound = bindSession(session, clientConfig, discovery);
  const stored = {
    [sessionStorageKey(clientConfig)]: bound,
    [storageKey(clientConfig, 'bootstrap')]: bootstrap,
    [storageKey(clientConfig, 'rooms', bound)]: [room],
    [storageKey(clientConfig, 'room', bound, 'test')]: room.roomId,
  };
  await context.addInitScript(({ stored, theme }) => {
    localStorage.setItem('ds-group.language', 'zh-CN');
    localStorage.setItem('ds-group.theme', theme);
    for (const [key, value] of Object.entries(stored)) sessionStorage.setItem(key, JSON.stringify(value));
    // A stand-in visual viewport the test can shrink the way an on-screen keyboard does.
    const viewport = new EventTarget();
    const state = { height: innerHeight, offsetTop: 0 };
    Object.defineProperties(viewport, {
      height: { get: () => state.height }, width: { get: () => innerWidth },
      offsetTop: { get: () => state.offsetTop }, offsetLeft: { get: () => 0 }, scale: { get: () => 1 },
    });
    Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => viewport });
    window.setKeyboard = (height, offsetTop = 0) => {
      state.height = innerHeight - height;
      state.offsetTop = offsetTop;
      viewport.dispatchEvent(new Event('resize'));
      return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    };
    if ('serviceWorker' in navigator) {
      Object.defineProperty(navigator.serviceWorker, 'register', {
        configurable: true, value: async () => ({ active: {}, pushManager: { getSubscription: async () => null } }),
      });
    }
  }, { stored, theme });

  const responses = new Map([
    ['GET /api/bootstrap', bootstrap],
    ['GET /api/status', { nodes: [], core: { roomId: room.roomId }, budget: { used: 0, limit: null } }],
    ['GET /api/rooms', { rooms: [room] }],
    ['GET /api/inbox?filter=mentions&limit=1', { events: [], unreadCount: 0, mentionCount: 0 }],
    ['GET /api/roles', { roles: [], canManage: true }],
    ['GET /api/push/config', { enabled: false }],
    ['POST /api/presence', { accepted: true }],
    ['GET /api/directory', { participants: people }],
    ['GET /api/me', { user: people[0], ownedBots: [] }],
    ['GET /api/spaces', {
      homeServer: 'test', userId: people[0].id,
      spaces: [{ serverName: 'test', name: 'DSCord', home: true, status: 'connected', invitations: [],
        rooms: [{ roomId: room.roomId, name: room.name, status: 'joined', canSend: true }] }],
    }],
  ]);
  const base = `/api/rooms/${encodeURIComponent(room.roomId)}`;
  responses.set(`GET ${base}/messages?limit=200`, { events });
  responses.set(`GET ${base}/tasks`, { tasks: [] });
  responses.set(`POST ${base}/read`, { read: true });
  responses.set(`GET ${base}/mentionables`, { members: people, roles: [], canMentionEveryone: true, canMentionHere: true });

  const page = await context.newPage();
  page.on('pageerror', error => pageErrors.push(error.message));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: SAFE_TOP, bottom: SAFE_BOTTOM } });
  await page.route('**/.well-known/dscord/client', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(discovery) }));
  await page.route(`${centralOrigin}/**`, async route => {
    const request = route.request();
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const { pathname } = new URL(request.url());
    const body = pathname === '/.well-known/dscord/central' ? { issuer: centralOrigin, domain: 'id.example', registration: 'open' }
      : pathname === '/api/me/avatar' ? { profile: { id: 'central-alice', globalId: 'alice@id.example', profileVersion: 0, avatar: null }, maxUploadBytes: 5242880 }
        : pathname === '/api/bots' ? { bots: [] }
          : pathname === '/api/devices' ? { devices: [] } : null;
    if (!body) unhandled.push(`${request.method()} ${centralOrigin}${pathname}`);
    await route.fulfill({ status: body ? 200 : 501, headers: cors, contentType: 'application/json', body: JSON.stringify(body ?? {}) });
  });
  await page.route(`${origin}/api/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const key = `${request.method()} ${url.pathname}${url.search}`;
    if (!responses.has(key)) unhandled.push(key);
    await route.fulfill({ status: responses.has(key) ? 200 : 501, contentType: 'application/json', body: JSON.stringify(responses.get(key) ?? {}) });
  });
  await page.goto(`${origin}/__app`);
  await page.locator('.message').nth(lines.length - 1).waitFor();
  await page.locator('#toast').waitFor({ state: 'hidden' }).catch(() => {});
  return { context, page };
}

const box = (page, selector) => page.locator(selector).first().evaluate(element => {
  const { top, bottom, left, right } = element.getBoundingClientRect();
  return { top, bottom, left, right };
});
const style = (page, selector, property) => page.locator(selector).first().evaluate(
  (element, property) => getComputedStyle(element)[property], property);
const shot = (page, name) => page.screenshot({ path: path.join(output, `${name}.png`), animations: 'disabled' });

try {
  await server.listen();
  await mkdir(output, { recursive: true });
  browser = await chromium.launch();

  const indexHtml = await readFile(path.join(packageRoot, 'web/index.html'), 'utf8');
  assert.match(indexHtml, /maximum-scale=1, user-scalable=no, viewport-fit=cover/);
  checks.push('viewportForbidsZoomAndCoversTheScreen');

  for (const theme of ['light', 'dark']) {
    const { context, page } = await openApp(theme);
    if (theme === 'light') {
      // The page itself never scrolls or zooms; only its panes scroll.
      assert.equal(await style(page, 'html', 'touchAction'), 'pan-x pan-y');
      assert.equal(await style(page, 'html', 'overscrollBehaviorY'), 'none');
      const gesture = await page.evaluate(() => {
        const event = new Event('gesturestart', { bubbles: true, cancelable: true });
        document.body.dispatchEvent(event);
        return event.defaultPrevented;
      });
      assert.equal(gesture, true);
      checks.push('pinchAndDoubleTapZoomAreBlocked');

      // The shell fills the screen; the header clears the status bar, the composer the home indicator.
      assert.deepEqual(await box(page, '.app-shell'), { top: 0, bottom: screen.height, left: 0, right: screen.width });
      const header = await box(page, '.conversation-header');
      assert.equal(header.top, 0);
      assert.equal(await style(page, '.conversation-header', 'paddingTop'), `${SAFE_TOP}px`);
      assert.equal(await style(page, '.composer-area', 'paddingBottom'), `${SAFE_BOTTOM}px`);
      assert.equal((await box(page, '.composer-area')).bottom, screen.height);
      assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor),
        await style(page, '.conversation', 'backgroundColor'));
      checks.push('shellFillsScreenAndClearsStatusBarAndHomeIndicator');
    }
    await shot(page, `chat-${theme}-zh`);

    // Keyboard open: the shell ends at the keyboard and drops the home-indicator gap.
    await page.locator('#message-input').click();
    await page.keyboard.type('键盘弹出时输入框贴着键盘');
    await page.evaluate(height => window.setKeyboard(height), KEYBOARD);
    if (theme === 'light') {
      assert.equal(await page.evaluate(() => document.documentElement.hasAttribute('data-keyboard')), true);
      assert.equal((await box(page, '.app-shell')).bottom, screen.height - KEYBOARD);
      assert.equal((await box(page, '.conversation-header')).top, 0);
      assert.equal(await style(page, '.composer-area', 'paddingBottom'), '6px');
      // A browser that pans the page instead still keeps the header in view.
      await page.evaluate(height => window.setKeyboard(height, 120), KEYBOARD);
      assert.equal((await box(page, '.app-shell')).top, 120);
      assert.equal((await box(page, '.app-shell')).bottom, 120 + screen.height - KEYBOARD);
      await page.evaluate(height => window.setKeyboard(height), KEYBOARD);
      checks.push('composerSitsOnTheKeyboardAndHeaderStaysPut');
    }
    // Stand-in keys so the screenshot shows where the real keyboard sits.
    await page.evaluate(height => {
      const keys = document.createElement('div');
      keys.id = 'fixture-keyboard';
      keys.textContent = '（键盘）';
      keys.style.cssText = `position:fixed;left:0;right:0;bottom:0;height:${height}px;display:grid;place-items:center;background:#8e8e93;color:#fff;font:16px sans-serif;z-index:9999`;
      document.documentElement.append(keys);
    }, KEYBOARD);
    await shot(page, `keyboard-${theme}-zh`);
    await page.locator('#fixture-keyboard').evaluate(element => element.remove());
    await page.evaluate(() => window.setKeyboard(0));
    await page.locator('#message-input').blur();
    assert.equal(await page.evaluate(() => document.documentElement.hasAttribute('data-keyboard')), false);

    if (theme === 'light') {
      // Drawers and dialogs stay below the status bar too.
      await page.locator('.mobile-channels').click();
      await page.waitForFunction(() => document.querySelector('#channel-panel').getBoundingClientRect().left >= 63);
      assert.equal(await style(page, '.brand', 'paddingTop'), `${SAFE_TOP}px`);
      assert.equal(await style(page, '.server-rail', 'paddingTop'), `${SAFE_TOP}px`);
      await shot(page, 'drawer-light-zh');
      await page.locator('#identity-button').click();
      await page.locator('#settings-button').click();
      await page.locator('#settings-dialog').waitFor();
      await page.waitForTimeout(250);
      const dialog = await box(page, '#settings-dialog');
      assert.ok(dialog.top >= SAFE_TOP, `settings dialog top ${dialog.top} is under the status bar`);
      assert.ok(dialog.bottom <= screen.height - SAFE_BOTTOM, `settings dialog bottom ${dialog.bottom} is over the home indicator`);
      checks.push('drawersAndDialogsStayClearOfStatusBarAndHomeIndicator');
      await shot(page, 'settings-light-zh');
    }
    await context.close();
  }
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(unhandled, []);
} catch (error) {
  failure = error;
} finally {
  await writeFile(path.join(output, 'report.json'), `${JSON.stringify({
    passed: !failure, checks, pageErrors, unhandled, ...(failure ? { error: failure.stack ?? String(failure) } : {}),
  }, null, 2)}\n`).catch(() => {});
  await browser?.close();
  await server.close();
  await rm(temporary, { recursive: true, force: true });
}

if (failure) throw failure;
console.log(`Mobile viewport checks passed (${checks.length})`);
