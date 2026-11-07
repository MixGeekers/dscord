import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { chromium } from 'playwright';
import { packageRoot } from '../src/paths.mjs';

// The real Timeline, Composer and edit folding; the server side is a scripted onEdit/onWithdraw.
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
      import { Timeline } from '/src/components/Timeline.tsx';
      import { Composer } from '/src/components/Composer.tsx';
      import { lastVisible, mergeEvents, visibleEvents, withdrawnEvent } from '/src/app/timeline-events.ts';

      const roomId = '!edit:test';
      const room = { roomId, name: 'Edit', kind: 'group', participantIds: ['@alice:test', '@bob:test', '@helper:test'] };
      const session = { user_id: '@alice:test', access_token: 'synthetic' };
      const people = [
        { id: '@alice:test', name: 'Alice', kind: 'human' },
        { id: '@bob:test', name: 'Bob', kind: 'human' },
        { id: '@helper:test', name: 'Helper', kind: 'bot' },
      ];
      const roster = { members: people, roles: [], canMentionEveryone: false, canMentionHere: false };
      const start = Date.UTC(2026, 10, 7, 9, 0);
      const message = (id, sender, minutes, body) => ({ event_id: id, room_id: roomId, sender, type: 'm.room.message',
        origin_server_ts: start + minutes * 60000, content: { body } });
      window.edits = [];
      window.withdrawals = [];

      function Fixture() {
        const [events, setEvents] = React.useState([
          message('$bob', '@bob:test', 0, 'Bob 的消息'),
          message('$ask', '@alice:test', 10, '请 <@@helper:test> 整理报表'),
          message('$later', '@alice:test', 20, '最后一条'),
        ]);
        const [editingId, setEditingId] = React.useState(null);
        const onEdit = async (eventId, value) => {
          window.edits.push({ eventId, ...value });
          await new Promise(resolve => setTimeout(resolve, 30));
          setEvents(previous => mergeEvents(previous, [{ ...message('$edit-' + window.edits.length, '@alice:test', 30 + window.edits.length, '* ' + value.body),
            content: { body: '* ' + value.body, 'm.new_content': { body: value.body, 'org.ds_group': { mentions: value.mentions } },
              'm.relates_to': { rel_type: 'm.replace', event_id: eventId } } }], roomId));
          return true;
        };
        const onWithdraw = async eventId => {
          window.withdrawals.push(eventId);
          setEvents(previous => previous.map(event => event.event_id === eventId ? withdrawnEvent(event, { event_id: '$r' }) : event));
          return true;
        };
        return React.createElement('main', { className: 'conversation', style: { height: '100dvh' } },
          React.createElement(Timeline, {
            events, participants: people, session, mentionables: roster, roles: [],
            editingId, onEditing: setEditingId, onEdit, onWithdraw,
            onMember: () => {}, onReply: () => {}, onJump: () => {}, onRead: () => {},
          }),
          React.createElement(Composer, {
            session, room, mentionables: roster, reply: null, replyMention: true,
            onReplyMention: () => {}, onClearReply: () => {}, sending: false, pending: null,
            onError: () => {}, onSend: async () => true,
            onEditLast: () => {
              const own = lastVisible(visibleEvents(events), event => event.sender === session.user_id);
              if (own) setEditingId(own.event_id);
              return Boolean(own);
            },
          }));
      }
      createRoot(document.getElementById('root')).render(React.createElement(Fixture));
    </script>
  </body>
</html>`;

const temporary = await mkdtemp(path.join(os.tmpdir(), 'ds-group-message-edit-'));
const server = await createServer({
  configFile: false,
  root: path.join(packageRoot, 'web'),
  cacheDir: path.join(temporary, 'vite-cache'),
  plugins: [tailwindcss(), {
    name: 'message-edit-fixture',
    configureServer(vite) {
      vite.middlewares.use('/__edit', async (request, response, next) => {
        if (request.url.includes('html-proxy')) { next(); return; }
        response.setHeader('Content-Type', 'text/html');
        response.end(await vite.transformIndexHtml('/__edit', html));
      });
    },
  }],
  server: { host: '127.0.0.1', port: 0 },
  logLevel: 'error',
});

let browser;
const pageErrors = [];
try {
  await server.listen();
  browser = await chromium.launch();
  const context = await browser.newContext({ locale: 'en-US', viewport: { width: 900, height: 700 } });
  const page = await context.newPage();
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('ds-group.language', 'en');
    localStorage.setItem('ds-group.theme', 'dark');
  });
  await page.goto(server.resolvedUrls.local[0] + '__edit');
  const ask = page.locator('[data-event-id="$ask"]');
  await ask.waitFor();

  // Only the sender's own messages offer edit and withdraw.
  await page.locator('[data-event-id="$bob"]').hover();
  assert.equal(await page.locator('[data-event-id="$bob"]').getByRole('button', { name: 'Edit message' }).count(), 0);
  assert.equal(await page.locator('[data-event-id="$bob"]').getByRole('button', { name: 'Withdraw' }).count(), 0);

  // Editing keeps the mention as a member chip and saves with Enter.
  await ask.hover();
  await ask.getByRole('button', { name: 'Edit message' }).click();
  const editor = ask.getByRole('textbox', { name: 'Edit message' });
  await editor.waitFor();
  assert.match(await editor.innerText(), /@Helper/);
  await page.keyboard.press('End');
  await page.keyboard.type('，今天完成');
  await mkdir(path.join(packageRoot, '.local', 'chat-timeline'), { recursive: true });
  await page.locator('#timeline').screenshot({ path: path.join(packageRoot, '.local', 'chat-timeline', 'editing-dark-en.png') });
  await page.keyboard.press('Enter');
  await ask.locator('.message-edited').waitFor();
  assert.deepEqual(await page.evaluate(() => window.edits.map(edit => [edit.eventId, edit.body, edit.mentions.users])),
    [['$ask', '请 <@@helper:test> 整理报表，今天完成', ['@helper:test']]]);
  assert.equal(await ask.locator('.message-bubble').innerText(), '请 @Helper 整理报表，今天完成');
  assert.equal(await ask.locator('.message-edited').textContent(), '(edited)');
  assert.equal(await page.locator('[data-event-id^="$edit-"]').count(), 0, 'the edit event itself is not a message');

  // Escape leaves without saving; an unchanged save does not send.
  await ask.hover();
  await ask.getByRole('button', { name: 'Edit message' }).click();
  await editor.waitFor();
  await page.keyboard.type('不要保存');
  await page.keyboard.press('Escape');
  await editor.waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => window.edits.length), 1);

  // ↑ in the empty composer edits the latest own message.
  await page.locator('#message-input').click();
  await page.keyboard.press('ArrowUp');
  const later = page.locator('[data-event-id="$later"]');
  await later.getByRole('textbox', { name: 'Edit message' }).waitFor();
  await later.getByRole('button', { name: 'Save' }).click();
  await later.getByRole('textbox', { name: 'Edit message' }).waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => window.edits.length), 1);

  // Withdrawing asks first, then leaves a marker without actions.
  await later.hover();
  await later.getByRole('button', { name: 'Withdraw' }).click();
  const confirm = later.locator('.message-confirm');
  const screenshots = path.join(packageRoot, '.local', 'chat-timeline');
  await mkdir(screenshots, { recursive: true });
  await page.locator('#timeline').screenshot({ path: path.join(screenshots, 'edited-and-withdraw-confirm-dark-en.png') });
  assert.match(await confirm.innerText(), /Withdraw this message\?/);
  await confirm.getByRole('button', { name: 'Cancel' }).click();
  assert.deepEqual(await page.evaluate(() => window.withdrawals), []);
  await later.hover();
  await later.getByRole('button', { name: 'Withdraw' }).click();
  await later.locator('.message-confirm').getByRole('button', { name: 'Withdraw' }).click();
  await later.locator('.message-withdrawn').waitFor();
  await page.locator('#timeline').screenshot({ path: path.join(screenshots, 'withdrawn-dark-en.png') });
  assert.equal(await later.locator('.message-withdrawn').textContent(), 'This message was withdrawn');
  assert.equal(await later.locator('.message-actions').isHidden(), true);
  assert.deepEqual(await page.evaluate(() => window.withdrawals), ['$later']);

  // With the latest withdrawn, ↑ reaches the earlier own message.
  await page.locator('#message-input').click();
  await page.keyboard.press('ArrowUp');
  await ask.getByRole('textbox', { name: 'Edit message' }).waitFor();
  assert.deepEqual(pageErrors, []);
} finally {
  await browser?.close();
  await server.close();
  await rm(temporary, { recursive: true, force: true });
}
