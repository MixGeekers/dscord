import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { chromium } from 'playwright';
import { packageRoot } from '../src/paths.mjs';

// The real Timeline and history hook against a scripted messages API: 80 messages in three
// pages, 20 of them unread, in a viewport that shows only part of the conversation.
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
      import { useTimelineHistory } from '/src/app/useTimelineHistory.ts';

      const roomId = '!history:test';
      const session = { user_id: '@alice:test', access_token: 'synthetic' };
      const people = [
        { id: '@alice:test', name: 'Alice', kind: 'human' },
        { id: '@bot:test', name: 'Helper', kind: 'bot' },
      ];
      const roster = { members: people, roles: [], canMentionEveryone: false, canMentionHere: false };
      const start = Date.UTC(2026, 10, 7, 8, 0);
      const message = index => ({
        event_id: '$' + index, room_id: roomId, sender: index % 3 ? '@bot:test' : '@alice:test',
        type: 'm.room.message', origin_server_ts: start + index * 600000,
        content: { body: index === 75
          ? '## 汇总\\n\\n| 项 | 状态 |\\n|---|---|\\n| 读取 | 完成 |\\n\\n\`\`\`js\\nconsole.log("ok");\\n\`\`\`'
          : 'Message ' + index + (index % 4 ? '' : '\\nwith a second line') },
      });
      const range = (from, to) => Array.from({ length: to - from }, (_, offset) => message(from + offset));
      const pages = { p1: { events: range(20, 40), before: 'p2' }, p2: { events: range(0, 20), before: null } };
      window.apiCalls = [];
      window.reads = [];
      window.jumps = [];
      const api = async route => {
        window.apiCalls.push(route);
        const before = new URL(route, location.origin).searchParams.get('before');
        await new Promise(resolve => setTimeout(resolve, 40));
        return pages[before];
      };
      const room = { roomId, name: 'History', kind: 'group', participantIds: people.map(person => person.id),
        unreadCount: 20, firstUnreadEventId: '$60' };

      function Fixture() {
        const [events, setEvents] = React.useState([]);
        const history = useTimelineHistory({ api, roomId, room, setEvents, onError: message => { window.error = message; } });
        React.useEffect(() => {
          setEvents(range(40, 80));
          history.seed(roomId, 'p1');
        }, []);
        return React.createElement('main', { className: 'conversation', style: { height: '640px', position: 'relative' } },
          React.createElement(Timeline, {
            events, participants: people, session, mentionables: roster, roles: [], history,
            onMember: () => {}, onReply: () => {},
            onJump: id => window.jumps.push(id),
            onRead: id => window.reads.push(id),
          }));
      }
      createRoot(document.getElementById('root')).render(React.createElement(Fixture));
    </script>
  </body>
</html>`;

const temporary = await mkdtemp(path.join(os.tmpdir(), 'ds-group-timeline-history-'));
const server = await createServer({
  configFile: false,
  root: path.join(packageRoot, 'web'),
  cacheDir: path.join(temporary, 'vite-cache'),
  plugins: [tailwindcss(), {
    name: 'timeline-history-fixture',
    configureServer(vite) {
      vite.middlewares.use('/__history', async (request, response, next) => {
        if (request.url.includes('html-proxy')) { next(); return; }
        response.setHeader('Content-Type', 'text/html');
        response.end(await vite.transformIndexHtml('/__history', html));
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
  await page.goto(server.resolvedUrls.local[0] + '__history');
  await page.locator('[data-event-id="$79"]').waitFor();

  const timeline = page.locator('#timeline');
  const offsetInTimeline = selector => page.evaluate(target => {
    const element = document.querySelector(target);
    return element ? element.getBoundingClientRect().top - document.querySelector('#timeline').getBoundingClientRect().top : null;
  }, selector);
  const scrollTo = top => timeline.evaluate((element, value) => {
    element.scrollTop = value === 'bottom' ? element.scrollHeight : value;
    element.dispatchEvent(new Event('scroll'));
  }, top);

  // Opening the room lands on the first unread message, which is not yet read.
  const divider = page.locator('.unread-separator');
  assert.equal(await divider.textContent(), 'New messages');
  assert.equal(await page.evaluate(() => document.querySelector('.unread-separator').nextElementSibling.dataset.eventId), '$60');
  const dividerTop = await offsetInTimeline('.unread-separator');
  assert.ok(dividerTop >= 0 && dividerTop < 40, `divider opens at the top of the view (${dividerTop})`);
  assert.equal(await page.locator('.unread-banner').count(), 0);
  assert.deepEqual(await page.evaluate(() => window.reads), []);

  // Reading to the bottom marks the latest read; the divider stays and the banner offers a way back.
  await scrollTo('bottom');
  await page.locator('.unread-banner').waitFor();
  assert.equal(await page.locator('.unread-banner-jump').innerText(), '20 new messages\nJump to first unread');
  assert.equal(await page.evaluate(() => window.reads.at(-1)), '$79');
  await page.locator('.unread-banner-jump').click();
  await page.waitForFunction(() => {
    const top = document.querySelector('.unread-separator').getBoundingClientRect().top - document.querySelector('#timeline').getBoundingClientRect().top;
    return top >= 0 && top < 60;
  });
  await page.locator('.unread-banner').waitFor({ state: 'detached' });

  // Bot replies render as Markdown inside the timeline.
  assert.equal(await page.locator('[data-event-id="$75"] .markdown-table td').first().textContent(), '读取');
  assert.equal(await page.locator('[data-event-id="$75"] h2').textContent(), '汇总');
  await page.locator('[data-event-id="$75"] .markdown-code .hljs-built_in, [data-event-id="$75"] .markdown-code .hljs-string').first().waitFor();

  // Scrolling near the top fetches the next older page and keeps the reader's place.
  const before = await offsetInTimeline('[data-event-id="$40"]');
  await scrollTo(Math.max(0, (await timeline.evaluate(element => element.scrollTop)) - 100000));
  const anchored = await offsetInTimeline('[data-event-id="$40"]');
  await page.locator('[data-event-id="$39"]').waitFor();
  const afterLoad = await offsetInTimeline('[data-event-id="$40"]');
  assert.ok(Math.abs(afterLoad - anchored) <= 2, `message $40 stays put after older messages load (${anchored} → ${afterLoad})`);
  assert.ok(before !== null);
  assert.equal(await page.evaluate(() => window.apiCalls.length), 1);
  assert.match(await page.evaluate(() => window.apiCalls[0]), /\/api\/rooms\/!history%3Atest\/messages\?limit=50&before=p1$/);

  // The second page reaches the start of the room; no further requests follow.
  await scrollTo(0);
  await page.locator('[data-event-id="$0"]').waitFor();
  await page.getByText('This is the beginning of the conversation').waitFor();
  await scrollTo(0);
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => window.apiCalls.length), 2);
  const order = await page.locator('[data-event-id]').evaluateAll(nodes => nodes.map(node => Number(node.dataset.eventId.slice(1))));
  assert.deepEqual(order, Array.from({ length: 80 }, (_, index) => index));

  // Mark as read clears the banner and the divider for this visit.
  await scrollTo('bottom');
  await page.locator('.unread-banner').waitFor();
  await page.getByRole('button', { name: 'Mark as read' }).click();
  await page.locator('.unread-banner').waitFor({ state: 'detached' });
  assert.equal(await divider.count(), 0);
  assert.equal(await page.evaluate(() => window.reads.at(-1)), '$79');
  assert.deepEqual(await page.evaluate(() => window.jumps), []);
  assert.deepEqual(pageErrors, []);
} finally {
  await browser?.close();
  await server.close();
  await rm(temporary, { recursive: true, force: true });
}
