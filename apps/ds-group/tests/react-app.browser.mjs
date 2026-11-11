import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { chromium } from 'playwright';
import { packageRoot } from '../src/paths.mjs';

const people = [
  { id: '@alice:test', localpart: 'alice', name: 'Alice', kind: 'human' },
  { id: '@bob:test', localpart: 'bob', name: 'Bob', kind: 'human' },
];
const rooms = [
  { roomId: '!one:test', name: 'One', kind: 'group', participantIds: people.map(person => person.id) },
  { roomId: '!two:test', name: 'Two', kind: 'group', participantIds: people.map(person => person.id) },
];
const bootstrap = {
  name: 'DSCord',
  roomId: rooms[0].roomId,
  roomName: rooms[0].name,
  participants: people,
  attachments: { maxBytes: 52428800, maxPerMessage: 10 },
};
const centralOrigin = 'https://id.example';
const identityOf = localpart => ({ globalId: `${localpart}@id.example`, matrixUserId: `@${localpart}:test`, kind: 'human' });
const sessions = {
  alice: { user_id: people[0].id, access_token: 'alice-fixture', identity: identityOf('alice') },
  bob: { user_id: people[1].id, access_token: 'bob-fixture', identity: identityOf('bob') },
};
const pendingMessage = {
  body: 'Alice pending in One',
  mentions: { users: [], roles: [], everyone: false, here: false },
  attachments: [],
  transactionId: 'already-submitted-one',
};
const aliceTwoDraft = {
  body: 'Independent Alice draft Two',
  attachments: [],
  replyMention: true,
};
const bobOneDraft = {
  body: 'Bob private draft One',
  attachments: [],
  replyMention: true,
};
const discovery = {
  schemaVersion: 2,
  contractVersion: '2.0.0',
  name: 'DSCord',
  home: { serverName: 'test', coreUrl: null, matrixUrl: 'http://127.0.0.1:1' },
  central: { issuer: centralOrigin },
  auth: { mode: 'central-identity-token', audience: null, sessionPath: '/api/session', cookieCredentials: false },
};
const spacesFor = userId => ({
  homeServer: 'test',
  userId,
  spaces: [{
    serverName: 'test', name: 'DSCord', home: true, status: 'connected', invitations: [],
    rooms: rooms.map(room => ({ roomId: room.roomId, name: room.name, status: 'joined', canSend: true })),
  }],
});
// Readable aliases resolved by readStorage() to the client's scoped keys.
const alicePendingKey = `ds-group.pending.${sessions.alice.user_id}.${rooms[0].roomId}`;
const aliceTwoDraftKey = `ds-group.draft.${sessions.alice.user_id}.${rooms[1].roomId}`;
const bobOneDraftKey = `ds-group.draft.${sessions.bob.user_id}.${rooms[0].roomId}`;

const html = `<!doctype html>
<html>
  <head>
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

const temporary = await mkdtemp(path.join(os.tmpdir(), 'ds-group-react-app-'));
const server = await createServer({
  configFile: false,
  root: path.join(packageRoot, 'web'),
  cacheDir: path.join(temporary, 'vite-cache'),
  plugins: [tailwindcss(), {
    name: 'react-app-fixture',
    configureServer(vite) {
      vite.middlewares.use('/__app', async (request, response, next) => {
        if (request.url.includes('html-proxy')) {
          next();
          return;
        }
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
const unhandledRequests = [];
const sentMessages = [];
const logoutRequests = [];
const registrationRequests = [];
const loginRequests = [];
const centralLogouts = [];
const connectCodeTokens = [];
const centralBots = [];
const loginLimits = [];
const revokedTokens = new Set();
const ownedBots = new Map();
let registeredUser;
let holdNextMessage = false;
let releaseMessage;
let apiRequestCount = 0;
let browser;
let page;
let failure;

try {
  await server.listen();
  browser = await chromium.launch();
  const context = await browser.newContext({
    locale: 'en-US',
    viewport: { width: 1440, height: 900 },
  });
  context.setDefaultTimeout(15000);
  // Seed storage with the keys the client itself derives for this origin.
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  discovery.auth.audience = origin;
  const { parseClientConfig } = await import('../web/src/client-config.ts');
  const { bindSession, sessionStorageKey, storageKey } = await import('../web/src/session.ts');
  const clientConfig = parseClientConfig({ schemaVersion: 1 }, origin);
  const bound = account => bindSession(account, clientConfig, discovery);
  const stored = {
    [sessionStorageKey(clientConfig)]: bound(sessions.alice),
    [storageKey(clientConfig, 'bootstrap')]: bootstrap,
    [storageKey(clientConfig, 'rooms', bound(sessions.alice))]: rooms,
    [storageKey(clientConfig, 'rooms', bound(sessions.bob))]: rooms,
    [storageKey(clientConfig, 'room', bound(sessions.alice), 'test')]: rooms[0].roomId,
    [storageKey(clientConfig, 'pending', bound(sessions.alice), 'test', rooms[0].roomId)]: pendingMessage,
    [storageKey(clientConfig, 'draft', bound(sessions.alice), 'test', rooms[1].roomId)]: aliceTwoDraft,
    [storageKey(clientConfig, 'draft', bound(sessions.bob), 'test', rooms[0].roomId)]: bobOneDraft,
  };
  await context.addInitScript((seed) => {
    localStorage.setItem('ds-group.language', 'en');
    localStorage.setItem('ds-group.theme', 'dark');
    for (const [key, value] of Object.entries(seed.stored)) {
      sessionStorage.setItem(key, JSON.stringify(value));
    }
    if ('serviceWorker' in navigator) {
      Object.defineProperty(navigator.serviceWorker, 'register', {
        configurable: true,
        value: async () => ({
          active: {},
          pushManager: { getSubscription: async () => null },
        }),
      });
    }
  }, { stored });

  const responses = new Map([
    ['GET /api/bootstrap', bootstrap],
    ['GET /api/status', { nodes: [], core: { roomId: rooms[0].roomId }, budget: { used: 0, limit: null } }],
    ['GET /api/rooms', { rooms }],
    ['GET /api/inbox?filter=mentions&limit=1', { events: [], unreadCount: 0, mentionCount: 0 }],
    ['GET /api/roles', { roles: [], canManage: true }],
    ['GET /api/push/config', { enabled: false }],
    ['POST /api/presence', { accepted: true }],
  ]);
  for (const room of rooms) {
    const base = `/api/rooms/${encodeURIComponent(room.roomId)}`;
    responses.set(`GET ${base}/messages?limit=200`, { events: [] });
    responses.set(`GET ${base}/tasks`, { tasks: [] });
    responses.set(`POST ${base}/read`, { read: true });
    responses.set(`GET ${base}/mentionables`, {
      members: people,
      roles: [],
      canMentionEveryone: true,
      canMentionHere: true,
    });
  }

  page = await context.newPage();
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route('**/.well-known/dscord/client', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(discovery) }));
  // The central server holds the accounts: password sign-in and registration happen there.
  await page.route(`${centralOrigin}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    let status = 200;
    let body;
    let headers = cors;
    const token = request.headers().authorization?.replace('Bearer ', '');
    if (url.pathname === '/.well-known/dscord/central') {
      body = { issuer: centralOrigin, domain: 'id.example', registration: 'open' };
    } else if (url.pathname === '/api/me/avatar' && request.method() === 'GET') {
      const username = token?.replace(/^central-(login|register)-/, '') || 'alice';
      body = { profile: { id: 'central-' + username, globalId: username + '@id.example', profileVersion: 0, avatar: null }, maxUploadBytes: 5242880 };
    } else if (url.pathname === '/api/register') {
      const input = request.postDataJSON();
      registrationRequests.push(input);
      registeredUser = { id: `@${input.username}:test`, localpart: input.username, name: input.displayName, kind: 'human' };
      status = 201;
      body = { token: `central-register-${input.username}` };
    } else if (url.pathname === '/api/login') {
      const input = request.postDataJSON();
      loginRequests.push(input);
      const known = people.some(person => person.localpart === input.username)
        || input.username === registeredUser?.localpart && input.password === 'fixture-password';
      status = known ? 200 : 401;
      body = known ? { token: `central-login-${input.username}` } : { error: 'Invalid credentials' };
      const limit = loginLimits.shift();
      if (limit) {
        status = 429;
        body = { error: 'Too Many Requests', code: 'RATE_LIMITED', ...limit.body };
        headers = { ...cors, 'Access-Control-Expose-Headers': 'Retry-After', ...limit.headers };
      }
    } else if (url.pathname === '/api/identity-tokens') {
      assert.equal(request.postDataJSON().audience, origin);
      body = { token: `identity:${token}` };
    } else if (url.pathname === '/api/connect-codes') {
      connectCodeTokens.push(token);
      status = 201;
      body = { code: `connect-${connectCodeTokens.length}`, expiresIn: 600 };
    } else if (url.pathname === '/api/bots' && request.method() === 'POST') {
      // The central server keeps the Bot and its setup; a DSH linked later runs it.
      const input = request.postDataJSON();
      centralBots.push({ id: 'central-finance', username: 'finance', globalId: 'finance@id.example', displayName: input.displayName, status: 'active',
        settings: { role: input.role, model: input.model, effort: '', deviceId: null, servers: input.servers, revision: 1 }, runtime: null });
      status = 201;
      body = { bot: centralBots.at(-1) };
    } else if (url.pathname === '/api/bots') {
      body = { bots: centralBots };
    } else if (url.pathname === '/api/devices') {
      body = { devices: [] };
    } else if (url.pathname === '/api/logout') {
      centralLogouts.push(token);
      body = { loggedOut: true };
    } else {
      unhandledRequests.push(`${request.method()} ${centralOrigin}${url.pathname}`);
      status = 501;
      body = { error: 'Unhandled central request' };
    }
    await route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.route(`${origin}/api/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const key = `${request.method()} ${url.pathname}${url.search}`;
    apiRequestCount++;
    let body;
    let status = 200;
    let headers = {};
    const token = request.headers().authorization?.replace('Bearer ', '');
    const user = revokedTokens.has(token) ? null
      : token === sessions.alice.access_token ? people[0]
        : token === sessions.bob.access_token ? people[1]
          : ['registered-fixture', 'registered-login-fixture'].includes(token) ? registeredUser : null;
    if (key === 'GET /api/spaces') {
      body = user ? spacesFor(user.id) : { error: 'Session expired' };
      status = user ? 200 : 401;
    } else if (key === 'GET /api/directory') {
      body = { participants: registeredUser ? [...people, registeredUser] : people };
    } else if (key === 'GET /api/me') {
      status = user ? 200 : 401;
      body = user ? { user, ownedBots: ownedBots.get(user.id) ?? [] } : { error: 'Session expired' };
    } else if (key === 'POST /api/logout') {
      logoutRequests.push(token);
      revokedTokens.add(token);
      body = { loggedOut: true };
    } else if (key === 'POST /api/session') {
      // The identity token names the central session it came from; Core opens the chat session for that person.
      const [, how, localpart] = /^identity:central-(register|login)-(.+)$/.exec(request.postDataJSON().identityToken) ?? [];
      const person = people.find(value => value.localpart === localpart);
      body = person ? sessions[localpart]
        : { user_id: registeredUser.id, access_token: how === 'register' ? 'registered-fixture' : 'registered-login-fixture', identity: identityOf(localpart) };
    } else if (key === 'GET /api/bots/status') {
      body = { bots: (ownedBots.get(user?.id) ?? []).map(bot => ({ botId: bot.id, online: true, updatedAt: Date.now(), activity: 'working',
        responder: { state: 'idle' }, workers: [{ taskId: 'task-1', title: 'Close the books', stage: 'running' }], queue: [], lastDecision: null })) };
    } else if (key === `GET /api/bots/${encodeURIComponent('@finance:test')}/kernel`) {
      // Read at another moment than the list's status; the home page's live part must not come from here.
      body = { runtime: { id: 'dscord-kernel', version: '0.4.0', available: true }, online: true, updatedAt: Date.now(),
        attention: { mode: 'natural', activity: 'speaking', queue: null, lastDecision: null },
        responder: { state: 'replying', requesterId: '@bob:test', since: Date.now() }, work: { workers: [], queue: [] } };
    } else if (key === `POST /api/rooms/${encodeURIComponent(rooms[0].roomId)}/messages`) {
      sentMessages.push({
        roomId: rooms[0].roomId,
        authorization: request.headers().authorization,
        body: request.postDataJSON(),
      });
      status = sentMessages.length === 1 ? 503 : 200;
      body = status === 503
        ? { error: 'Synthetic temporarily unavailable' }
        : { event_id: '$confirmed-fixture-send' };
      if (holdNextMessage) {
        holdNextMessage = false;
        await new Promise(resolve => { releaseMessage = resolve; });
      }
    } else if (responses.has(key)) {
      body = responses.get(key);
    } else {
      unhandledRequests.push(key);
      status = 501;
      body = { error: `Unhandled fixture request ${key}` };
    }
    await route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(body) });
  });

  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__app`);
  const editor = page.locator('#message-input');
  const sendButton = page.locator('#send-button');
  async function expectEditor(body, editable) {
    await page.waitForFunction(({ body, editable }) => {
      const input = document.querySelector('#message-input');
      return input?.textContent === body && input.getAttribute('contenteditable') === String(editable);
    }, { body, editable });
  }
  async function readStorage(key) {
    return page.evaluate(async legacy => {
      const sessionModule = await import('/src/session.ts');
      const configModule = await import('/src/client-config.ts');
      const config = configModule.defaultClientConfig();
      if (legacy === 'ds-group.session') return JSON.parse(sessionStorage.getItem(sessionModule.sessionStorageKey(config)) ?? 'null');
      const prefix = 'ds-group.v3.' + configModule.bindingKey(config) + '.';
      for (const key of Object.keys(sessionStorage)) {
        if (!key.startsWith(prefix)) continue;
        const [kind, , , userId, , roomId] = JSON.parse(decodeURIComponent(key.slice(prefix.length)));
        if (legacy === 'ds-group.' + kind + '.' + userId + (roomId ? '.' + roomId : '')) return JSON.parse(sessionStorage.getItem(key));
      }
      return JSON.parse(sessionStorage.getItem(legacy) ?? 'null');
    }, key);
  }
  async function switchAccount(localpart, displayName) {
    await page.locator('#identity-button').click();
    await page.locator('#account-switch-button').click();
    await page.locator('#login-dialog[open]').waitFor();
    await page.locator('#login-user').fill(localpart);
    await page.locator('#login-password').fill('fixture-password');
    await page.locator('#login-submit').click();
    await page.waitForFunction(name => document.querySelector('#current-name')?.textContent === name, displayName);
    await page.locator('#login-dialog').waitFor({ state: 'hidden' });
  }

  await expectEditor(pendingMessage.body, false);
  // The server rail scrolls only up and down, so Windows' classic scrollbars never show a sideways one,
  // and its icons sit in the middle of their circles.
  const rail = await page.evaluate(() => {
    const rail = document.querySelector('.server-rail');
    const list = document.querySelector('.server-list');
    const add = document.querySelector('#server-settings-button');
    const icon = add.querySelector('svg').getBoundingClientRect();
    const button = add.getBoundingClientRect();
    return {
      rail: rail.scrollWidth - rail.clientWidth,
      list: list.scrollWidth - list.clientWidth,
      x: Math.abs(icon.left + icon.width / 2 - (button.left + button.width / 2)),
      y: Math.abs(icon.top + icon.height / 2 - (button.top + button.height / 2)),
    };
  });
  assert.deepEqual({ rail: rail.rail, list: rail.list }, { rail: 0, list: 0 });
  assert.ok(rail.x < 0.5 && rail.y < 0.5, JSON.stringify(rail));
  checks.push('serverRailHasNoSidewaysOverflowAndCentersItsIcons');
  await page.waitForFunction(() => !document.querySelector('#send-button').disabled);
  assert.equal(await page.locator('#send-button-text').textContent(), 'Retry sending');
  assert.deepEqual(await readStorage(alicePendingKey), pendingMessage);
  checks.push('appRestoresPendingMessageForInitialAccountAndRoom');

  await page.locator('#additional-rooms button').filter({ hasText: 'Two' }).click();
  await expectEditor(aliceTwoDraft.body, true);
  assert.equal(await page.locator('#room-title').textContent(), 'Two');
  assert.equal(await sendButton.isEnabled(), true);
  assert.equal(await page.locator('#send-button-text').textContent(), 'Send');
  await page.waitForTimeout(220);
  assert.equal((await readStorage(aliceTwoDraftKey)).body, aliceTwoDraft.body);
  assert.deepEqual(await readStorage(alicePendingKey), pendingMessage);
  checks.push('roomSwitchDoesNotApplyPreviousPendingMessageToIndependentDraft');

  await page.locator('#group-room-button').click();
  await expectEditor(pendingMessage.body, false);
  assert.equal(await page.locator('#room-title').textContent(), 'One');
  assert.equal(await page.locator('#send-button-text').textContent(), 'Retry sending');
  assert.equal((await readStorage(aliceTwoDraftKey)).body, aliceTwoDraft.body);
  checks.push('returningToPendingRoomRestoresReadonlyRetryState');

  await switchAccount('bob', 'Bob');
  await expectEditor(bobOneDraft.body, true);
  assert.equal(await page.locator('#send-button-text').textContent(), 'Send');
  await page.waitForTimeout(220);
  assert.equal((await readStorage(bobOneDraftKey)).body, bobOneDraft.body);
  assert.deepEqual(await readStorage(alicePendingKey), pendingMessage);
  checks.push('accountSwitchDoesNotApplyAlicePendingMessageToBobDraft');

  await switchAccount('alice', 'Alice');
  await expectEditor(pendingMessage.body, false);
  assert.equal(await page.locator('#send-button-text').textContent(), 'Retry sending');
  assert.equal((await readStorage(bobOneDraftKey)).body, bobOneDraft.body);
  checks.push('returningToAliceRestoresOnlyAlicePendingMessage');

  await sendButton.click();
  await page.waitForFunction(() => document.querySelector('#toast')?.textContent.includes('Synthetic temporarily unavailable'));
  await expectEditor(pendingMessage.body, false);
  assert.equal(sentMessages.length, 1);
  assert.equal(await sendButton.isEnabled(), true);
  assert.deepEqual(await readStorage(alicePendingKey), pendingMessage);
  checks.push('unconfirmedSendRemainsPendingAfterServerFailure');

  await sendButton.click();
  await expectEditor('', true);
  assert.equal(sentMessages.length, 2);
  assert.deepEqual(sentMessages, Array.from({ length: 2 }, () => ({
    roomId: rooms[0].roomId,
    authorization: `Bearer ${sessions.alice.access_token}`,
    body: pendingMessage,
  })));
  assert.equal(await readStorage(alicePendingKey), null);
  assert.equal((await readStorage(aliceTwoDraftKey)).body, aliceTwoDraft.body);
  assert.equal((await readStorage(bobOneDraftKey)).body, bobOneDraft.body);
  assert.equal(await editor.textContent(), '');
  checks.push('retryReusesOriginalTransactionAndClearsOnlyConfirmedAccountRoom');

  const currentRoomBase = `/api/rooms/${encodeURIComponent(rooms[0].roomId)}`;
  const attachment = {
    id: 'delivered-sheet', name: 'result.xlsx', size: 4096,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  const task = {
    requestId: 'activity-fixture', botId: people[1].id, roomId: rooms[0].roomId,
    eventId: '$task-request', status: 'running', stage: 'thinking',
    summary: '正在处理任务', artifacts: [attachment], toolCalls: 1,
    cancelRequested: false, createdAt: Date.now(), updatedAt: Date.now(),
  };
  responses.set(`GET ${currentRoomBase}/messages?limit=200`, {
    events: [{
      event_id: '$delivered-sheet', room_id: rooms[0].roomId,
      sender: people[1].id, type: 'm.room.message', origin_server_ts: Date.now(),
      content: { body: 'Delivered spreadsheet', 'org.ds_group': { attachments: [attachment] } },
    }],
  });
  async function refreshTask(nextTask) {
    responses.set(`GET ${currentRoomBase}/tasks`, { tasks: nextTask ? [nextTask] : [] });
    const refreshed = page.waitForResponse(response =>
      new URL(response.url()).pathname === `${currentRoomBase}/tasks`);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await refreshed;
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  }
  await mkdir(path.join(packageRoot, '.local'), { recursive: true });
  await page.locator('#toast').waitFor({ state: 'hidden' });
  for (const viewport of [{ width: 985, height: 822 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.waitForFunction(() => document.querySelector('#details-panel').getBoundingClientRect().left >= innerWidth - 1);
    await page.waitForFunction(() => {
      const panel = document.querySelector('#channel-panel');
      return getComputedStyle(panel).position !== 'fixed' || panel.getBoundingClientRect().right <= 1;
    });
    await refreshTask(null);
    const idleTimeline = await page.locator('#timeline').boundingBox();
    await refreshTask(task);
    await page.locator('.composer-activity').waitFor();
    assert.equal(await page.locator('.composer-activity').getAttribute('aria-label'), 'Processing');
    assert.equal(await page.locator('.composer-activity').textContent(), '');
    assert.equal(await page.locator('.composer-activity > span').count(), 3);
    assert.equal(await page.locator('.conversation .task-card, #task-tray').count(), 0);
    assert.equal(await page.locator('#task-history-dialog').evaluate(element => element.open), false);
    assert.equal(await page.locator('.attachment-card[data-attachment-id="delivered-sheet"]').count(), 1);
    const fileIcon = page.locator('.attachment-card[data-attachment-id="delivered-sheet"] svg.attachment-file-icon');
    assert.equal(await fileIcon.count(), 1);
    assert.equal(await fileIcon.textContent(), '');
    assert.equal(await fileIcon.getAttribute('stroke-width'), '2');
    assert.equal(await fileIcon.evaluate(element => getComputedStyle(element).borderWidth), '0px');
    const activeTimeline = await page.locator('#timeline').boundingBox();
    assert.equal(activeTimeline.height, idleTimeline.height);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(packageRoot, '.local', `chat-activity-${viewport.width}.png`) });
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.deepEqual(await page.locator('.composer-activity > span').evaluateAll(elements =>
    elements.map(element => getComputedStyle(element).animationName)), ['none', 'none', 'none']);
  checks.push('activityUsesAnonymousDotsWithoutTaskCardsDuplicateFilesOrLayoutShift');

  await refreshTask({ ...task, status: 'completed', stage: 'completed', summary: '已交付' });
  await page.locator('.composer-activity').waitFor({ state: 'detached' });
  assert.equal(await page.locator('.task-card').count(), 0);
  const closedTimeline = await page.locator('#timeline').boundingBox();
  await page.locator('#tasks-button').click();
  await page.locator('#task-history-dialog[open]').waitFor();
  assert.equal(await page.locator('#task-history-dialog .task-card').count(), 1);
  assert.equal(await page.locator('#task-history-dialog .attachment-card').count(), 0);
  assert.equal(await page.locator('.attachment-card[data-attachment-id="delivered-sheet"]').count(), 1);
  assert.equal((await page.locator('#timeline').boundingBox()).height, closedTimeline.height);
  await page.locator('#close-task-history').click();
  await page.locator('#task-history-dialog').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('.task-card').count(), 0);
  checks.push('completedWorkDisappearsAndHistoryRequiresExplicitOverlayOpen');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('#identity-button').click();
  await page.locator('#settings-button').click();
  await page.locator('#logout-button').click();
  await page.locator('#login-dialog[open]').waitFor();
  assert.deepEqual(logoutRequests, ['alice-fixture']);
  assert.equal(await readStorage('ds-group.session'), null);
  assert.equal(await page.locator('.message').count(), 0);
  assert.equal(await page.locator('#owned-bots [data-owned-bot-id]').count(), 0);
  assert.equal(await page.locator('#task-history-dialog').evaluate(element => element.open), false);
  checks.push('logoutRevokesCurrentSessionAndClearsVisibleAccountState');

  await page.locator('#auth-toggle-mode').click();
  await page.locator('#login-user').fill('charlie-new');
  await page.locator('#register-name').fill('Charlie New');
  await page.locator('#login-password').fill('fixture-password');
  await page.locator('#login-submit').click();
  await page.locator('#login-dialog').waitFor({ state: 'hidden' });
  await page.waitForFunction(() => document.querySelector('#current-name')?.textContent === 'Charlie New');
  assert.deepEqual(registrationRequests, [{ username: 'charlie-new', password: 'fixture-password', displayName: 'Charlie New' }]);
  assert.equal((await readStorage('ds-group.session')).user_id, '@charlie-new:test');
  assert.equal((await readStorage('ds-group.session')).access_token, 'registered-fixture');
  assert.equal((await readStorage('ds-group.session')).binding.homeCoreUrl, new URL(page.url()).origin);
  // The central session stays with the page so it can make DSH connection keys.
  assert.equal((await readStorage('ds-group.session')).central.token, 'central-register-charlie-new');
  assert.equal(centralLogouts.includes('central-register-charlie-new'), false);
  checks.push('newAccountRegistersAtCentralAndCoreSessionComesFromItsIdentityToken');

  await page.locator('#identity-button').click();
  await page.locator('#settings-button').click();
  await page.locator('#make-connection-key').click();
  const connectionKey = await page.locator('#connection-key').inputValue();
  assert.match(connectionKey, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(JSON.parse(Buffer.from(connectionKey, 'base64url').toString('utf8')), { server: origin, code: 'connect-1' });
  assert.deepEqual(connectCodeTokens, ['central-register-charlie-new']);
  // The key is shown only while the person stays: another tab or a closed dialog drops it.
  await page.locator('[data-settings-tab="appearance"]').click();
  await page.locator('[data-settings-tab="account"]').click();
  await page.locator('#make-connection-key').filter({ hasText: 'Copy connection key' }).waitFor();
  assert.equal(await page.locator('#connection-key').count(), 0);
  await page.locator('#make-connection-key').click();
  await page.locator('#connection-key').waitFor();
  await page.locator('#close-settings').click();
  await page.locator('#identity-button').click();
  await page.locator('#settings-button').click();
  await page.locator('#make-connection-key').filter({ hasText: 'Copy connection key' }).waitFor();
  assert.equal(await page.locator('#connection-key').count(), 0);
  await page.locator('#close-settings').click();
  checks.push('settingsMakeOneDshConnectionKeyFromTheCentralSessionAndDropItOnLeaving');

  await page.locator('#global-bots-button').click();
  await page.locator('#create-bot-button').click();
  await page.locator('#create-bot-dialog[open]').waitFor();
  await page.locator('#create-bot-name').fill('Finance');
  await page.locator('#create-bot-submit').click();
  // The Bot is made at the central server for this chat server. No DSH is linked yet, so the dialog hands over
  // the key DSH asks for.
  await page.locator('#create-bot-progress[data-stage="noDevice"]').waitFor();
  assert.deepEqual(centralBots.map(bot => [bot.displayName, bot.settings.servers]), [['Finance', [origin]]]);
  await page.locator('#bot-make-connection-key').click();
  assert.deepEqual(JSON.parse(Buffer.from(await page.locator('#bot-connection-key').inputValue(), 'base64url').toString('utf8')), { server: origin, code: 'connect-3' });
  await page.locator('#bot-copy-connection-key').waitFor();
  checks.push('addBotDialogCreatesTheBotAtCentralAndMakesTheDshConnectionKeyInPlace');
  await page.locator('#create-bot-done').click();
  await page.locator('#create-bot-dialog').waitFor({ state: 'hidden' });
  // Once a DSH runs the Bot it signs in here, and the web client lists what Core reports.
  ownedBots.set(registeredUser.id, [{ id: '@finance:test', localpart: 'finance', name: 'Finance', kind: 'bot', ownerId: registeredUser.id,
    nativeBinding: { hostId: 'dsh-test', nativeBotId: 'native-finance', botId: '@finance:test' } }]);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.locator('#owned-bots [data-owned-bot-id="@finance:test"]').filter({ hasText: 'Finance' }).waitFor();
  await page.locator('#owned-bots [data-owned-bot-id="@finance:test"] [data-bot-status="working"]').filter({ hasText: "Tasks running: 1" }).waitFor();
  assert.equal(await page.locator('#owned-bot-count').textContent(), '1');
  checks.push('addBotPointsToDshAndOwnedBotsFollowCore');
  // The Bot's page shows what the list shows: one status for both.
  await page.locator('#owned-bots [data-owned-bot-id="@finance:test"]').click();
  await page.locator('[data-bot-home] [data-activity="working"]').waitFor();
  assert.equal(await page.locator('[data-bot-home] [data-bot-responder]').getAttribute('data-bot-responder'), 'idle');
  assert.match(await page.locator('[data-bot-panel="now"]').innerText(), /Close the books/);
  checks.push('botHomeAndBotListReadOneStatus');

  await page.locator('#identity-button').click();
  await page.locator('#settings-button').click();
  await page.locator('#logout-button').click();
  await page.locator('#login-dialog[open]').waitFor();
  assert.deepEqual(logoutRequests, ['alice-fixture', 'registered-fixture']);
  for (let wait = 0; wait < 50 && !centralLogouts.includes('central-register-charlie-new'); wait++) await page.waitForTimeout(20);
  assert.deepEqual(centralLogouts.slice(-1), ['central-register-charlie-new'], 'signing out also ends the central session');
  assert.equal(await page.locator('#owned-bots [data-owned-bot-id]').count(), 0);
  await page.locator('#login-user').fill('charlie-new');
  await page.locator('#login-password').fill('fixture-password');
  loginLimits.push(
    { body: { retry_after_ms: 1100 } },
    { headers: { 'Retry-After': '2' } },
    {},
  );
  await page.locator('#login-submit').click();
  await page.locator('#login-error').filter({ hasText: 'Try again in 2 seconds' }).waitFor();
  assert.equal(await page.locator('#login-user').inputValue(), 'charlie-new');
  assert.equal(await page.locator('#login-password').inputValue(), 'fixture-password');
  assert.equal(await page.locator('#login-submit').isEnabled(), true);
  await page.locator('#login-error').filter({ hasText: 'Try again shortly' }).waitFor();
  assert.equal(loginRequests.filter(input => input.username === 'charlie-new').length, 1);
  await page.locator('#login-submit').click();
  await page.locator('#login-error').filter({ hasText: 'Try again in 2 seconds' }).waitFor();
  await page.evaluate(async () => (await import('/i18n.js')).setLocalePreference('zh-CN'));
  await page.locator('#login-error').filter({ hasText: '登录请求过于频繁' }).waitFor();
  await page.evaluate(async () => (await import('/i18n.js')).setLocalePreference('en'));
  await page.locator('#login-submit').click();
  await page.locator('#login-error').filter({ hasText: 'Try again shortly' }).waitFor();
  checks.push('rateLimitUsesBodyOrHeaderDelayPreservesInputsAndNeverRetriesAutomatically');
  await page.locator('#login-submit').click();
  await page.locator('#login-dialog').waitFor({ state: 'hidden' });
  await page.locator('#global-bots-button').click();
  await page.locator('#owned-bots [data-owned-bot-id="@finance:test"]').filter({ hasText: 'Finance' }).waitFor();
  await page.locator('[data-server="test"]').click();
  assert.deepEqual(loginRequests.filter(input => input.username === 'charlie-new'),
    Array.from({ length: 4 }, () => ({ username: 'charlie-new', password: 'fixture-password' })));
  assert.equal((await readStorage('ds-group.session')).access_token, 'registered-login-fixture');
  checks.push('passwordLoginRestoresNewAccountAndOwnedBotsAfterLogout');

  holdNextMessage = true;
  await editor.fill('Message awaiting receipt before logout');
  await sendButton.click();
  await page.waitForFunction(() => document.querySelector('#send-button-text')?.textContent === 'Sending');
  await page.locator('#identity-button').click();
  await page.locator('#settings-button').click();
  await page.locator('#logout-button').click();
  await page.locator('#login-dialog[open]').waitFor();
  await page.locator('#login-user').fill('bob');
  await page.locator('#login-password').fill('fixture-password');
  await page.locator('#login-submit').click();
  await page.locator('#login-dialog').waitFor({ state: 'hidden' });
  await page.waitForFunction(() => document.querySelector('#current-name')?.textContent === 'Bob');
  assert.equal(await editor.textContent(), bobOneDraft.body);
  assert.equal(typeof releaseMessage, 'function');
  releaseMessage();
  await expectEditor(bobOneDraft.body, true);
  await page.waitForTimeout(220);
  assert.equal((await readStorage(bobOneDraftKey)).body, bobOneDraft.body);
  assert.equal((await readStorage(`ds-group.pending.${registeredUser.id}.${rooms[0].roomId}`)).body, 'Message awaiting receipt before logout');
  checks.push('lateSendReceiptAfterLogoutPreservesNextAccountsDraft');

  assert.deepEqual(unhandledRequests, []);
  assert.deepEqual(pageErrors, []);
  checks.push('fullAppUsesOnlyMockedApiAndHasNoPageErrors');
} catch (error) {
  failure = error;
} finally {
  const reportDirectory = path.join(packageRoot, '.local');
  await mkdir(reportDirectory, { recursive: true });
  if (failure && page) {
    await page.screenshot({ path: path.join(reportDirectory, 'react-app-browser-failure.png') }).catch(() => {});
  }
  const report = {
    passed: !failure,
    evidence: 'real Chromium with actual React App, isolated Vite and mocked APIs',
    checks,
    pageErrors,
    unhandledRequests,
    apiRequestCount,
    sentMessages,
    modelCalls: 0,
    ...(failure ? { error: failure.stack ?? String(failure) } : {}),
  };
  await writeFile(path.join(reportDirectory, 'react-app-browser.json'), `${JSON.stringify(report, null, 2)}\n`);
  await browser?.close();
  await server.close();
  await rm(temporary, { recursive: true, force: true });
}

if (failure) throw failure;
console.log(`React App browser checks passed (${checks.length})`);
