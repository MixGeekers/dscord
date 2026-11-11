import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../web/sw.js', import.meta.url), 'utf8');
const origin = 'https://chat.test';
const owner = { userId: '@alice:test', homeCoreUrl: 'https://core.test', centralIssuer: 'https://central.test' };

/** Runs the real service worker against a browser stand-in that records what it shows and opens. */
function worker({ windows = [] } = {}) {
  const listeners = new Map();
  const stored = new Map();
  const shown = [];
  const opened = [];
  const indexedDB = {
    open() {
      const request = {};
      queueMicrotask(() => {
        request.result = {
          createObjectStore() {},
          close() {},
          transaction() {
            const tx = {};
            const store = {
              get(key) {
                const result = { result: stored.has(key) ? structuredClone(stored.get(key)) : undefined };
                return result;
              },
              put(value, key) { stored.set(key, structuredClone(value)); return { result: key }; },
            };
            tx.objectStore = () => store;
            queueMicrotask(() => tx.oncomplete?.());
            return tx;
          },
        };
        request.onsuccess();
      });
      return request;
    },
  };
  const registration = {
    async showNotification(title, options) {
      const index = shown.findIndex(item => options.tag && item.options.tag === options.tag);
      const notification = { title, options, data: structuredClone(options.data), close() { shown.splice(shown.indexOf(notification), 1); } };
      if (index >= 0) shown.splice(index, 1, notification); else shown.push(notification);
    },
    async getNotifications({ tag } = {}) { return shown.filter(item => !tag || item.options.tag === tag); },
  };
  const self = {
    location: new URL(origin),
    navigator: { language: 'zh-CN' },
    registration,
    clients: {
      async matchAll() { return windows; },
      async openWindow(url) { opened.push(url); },
      claim: async () => {},
    },
    addEventListener(name, handler) { listeners.set(name, handler); },
    skipWaiting: async () => {},
  };
  vm.runInNewContext(source, { self, indexedDB, caches: {}, fetch, URL, console, queueMicrotask, structuredClone, btoa, Date, Math });
  async function dispatch(name, event) {
    let work = Promise.resolve();
    listeners.get(name)({ ...event, waitUntil(promise) { work = promise; } });
    await work;
  }
  return {
    shown, opened, stored,
    tell: (data, client = { id: 'window-1', url: `${origin}/` }) => dispatch('message', { data, source: client }),
    push: payload => dispatch('push', { data: { json: () => payload } }),
    click: notification => dispatch('notificationclick', { notification }),
  };
}

const message = (overrides = {}) => ({
  type: 'message', userId: owner.userId, roomId: '!room:test', eventId: '$1', sentAt: 1700000000000,
  room: { kind: 'direct', name: null }, sender: { id: '@bob:test', name: 'Bob', kind: 'human', avatar: 'https://central.test/avatars/b/128.webp' },
  text: '今晚七点开会', ...overrides,
});

test('a notification is shown only to the reader this browser is signed in as', async () => {
  const sw = worker();
  await sw.push(message());
  assert.equal(sw.shown.length, 0);
  await sw.tell({ type: 'ds-group:set-owner', owner, locale: 'zh-CN' });
  await sw.push(message({ userId: '@mallory:test' }));
  assert.equal(sw.shown.length, 0);
  await sw.push({ title: '伪造', body: '没有收件人' });
  assert.equal(sw.shown.length, 0);
});

test('a direct message shows who sent it, their picture and what they said', async () => {
  const sw = worker();
  await sw.tell({ type: 'ds-group:set-owner', owner, locale: 'zh-CN' });
  await sw.push(message());
  assert.equal(sw.shown.length, 1);
  const [{ title, options }] = sw.shown;
  assert.equal(title, 'Bob');
  assert.equal(options.body, '今晚七点开会');
  assert.equal(options.icon, 'https://central.test/avatars/b/128.webp');
  assert.equal(options.timestamp, 1700000000000);
  assert.equal(options.renotify, true);
  assert.equal(options.data.roomId, '!room:test');
  assert.equal(options.data.eventId, '$1');
  assert.equal(options.data.userId, owner.userId);
});

test('group messages name sender and channel, then stack per conversation', async () => {
  const sw = worker();
  await sw.tell({ type: 'ds-group:set-owner', owner, locale: 'zh-CN' });
  const group = { kind: 'group', name: '预算' };
  await sw.push(message({ room: group, text: '报表发了' }));
  assert.equal(sw.shown[0].title, 'Bob · #预算');
  assert.equal(sw.shown[0].options.body, '报表发了');
  await sw.push(message({ room: group, eventId: '$2', sender: { id: '@carol:test', name: 'Carol' }, text: '',
    attachment: { kind: 'image', name: 'a.png', count: 1 } }));
  await sw.push(message({ room: group, eventId: '$3', sender: { id: '@carol:test', name: 'Carol' }, text: '看第二页',
    attachment: { kind: 'file', name: '预算.xlsx', count: 3 } }));
  assert.equal(sw.shown.length, 1);
  assert.equal(sw.shown[0].title, '#预算 · 3 条新消息');
  assert.equal(sw.shown[0].options.body, 'Bob：报表发了\nCarol：[图片]\nCarol：[3 个文件] 预算.xlsx 等 看第二页');
  assert.equal(sw.shown[0].options.data.eventId, '$1', 'opening starts at the first unread message');
  assert.match(sw.shown[0].options.icon, /^\/icons\//, 'a sender without a picture falls back when drawing is unavailable');
  await sw.push(message({ room: group, eventId: '$3', text: '重复' }));
  assert.equal(sw.shown[0].options.data.count, 3, 'a repeated event is not counted twice');
});

test('the reader language words the notification', async () => {
  const sw = worker();
  await sw.tell({ type: 'ds-group:set-owner', owner, locale: 'en' });
  await sw.push(message({ room: { kind: 'group', name: null }, text: '', attachment: { kind: 'image', name: 'a.png', count: 2 } }));
  assert.equal(sw.shown[0].title, 'Bob · #Group');
  assert.equal(sw.shown[0].options.body, '[2 photos]');
  await sw.push({ type: 'test', userId: owner.userId });
  assert.match(sw.shown.at(-1).options.body, /^Notifications are on/);
});

test('the conversation on screen does not pop up', async () => {
  const client = { id: 'window-1', url: `${origin}/`, focused: true, visibilityState: 'visible' };
  const sw = worker({ windows: [client] });
  await sw.tell({ type: 'ds-group:set-owner', owner, locale: 'zh-CN' });
  await sw.tell({ type: 'ds-group:viewing', roomId: '!room:test' }, client);
  await sw.push(message());
  assert.equal(sw.shown.length, 0);
  await sw.push(message({ roomId: '!other:test', eventId: '$9' }));
  assert.equal(sw.shown.length, 1);
  client.focused = false;
  await sw.push(message({ eventId: '$10' }));
  assert.equal(sw.shown.length, 2);
});

test('opening a notification goes to its conversation and message', async () => {
  const sw = worker();
  await sw.tell({ type: 'ds-group:set-owner', owner, locale: 'zh-CN' });
  await sw.push(message());
  await sw.click(sw.shown[0]);
  const url = new URL(sw.opened[0]);
  assert.equal(url.origin, origin);
  assert.equal(url.searchParams.get('roomId'), '!room:test');
  assert.equal(url.searchParams.get('eventId'), '$1');
  assert.equal(url.searchParams.get('userId'), owner.userId);

  const posted = [];
  const open = { id: 'window-2', url: `${origin}/?roomId=!x:test`, focused: false, focus: async () => {}, postMessage: data => posted.push(JSON.parse(JSON.stringify(data))) };
  const running = worker({ windows: [open] });
  await running.tell({ type: 'ds-group:set-owner', owner, locale: 'zh-CN' });
  await running.push(message({ eventId: '$5' }));
  await running.click(running.shown[0]);
  assert.equal(running.opened.length, 0);
  assert.deepEqual(posted, [{ type: 'ds-group:open-room', url: `${origin}/?roomId=%21room%3Atest&eventId=%245&userId=%40alice%3Atest&homeCoreUrl=https%3A%2F%2Fcore.test&centralIssuer=https%3A%2F%2Fcentral.test`,
    roomId: '!room:test', eventId: '$5', ...owner }]);
});
