import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../dsh-connect/client.js', import.meta.url), 'utf8');
const loggedOut = { user: null, bots: [], runtime: { available: true, message: null } };
const loggedIn = {
  user: { id: 'alice@id.test', name: 'Alice', globalId: 'alice@id.test' }, label: 'DSH laptop', webUrl: 'https://chat.example.test',
  bots: [{ id: 'central-bot-1', name: '财务', username: 'finance', globalId: 'finance@id.test', model: 'deepseek/v4',
    servers: [{ url: 'https://chat.example.test', serverName: 'chat.example.test', status: 'offline' }] }],
  runtime: { available: true, message: null }, lastError: null, dataDirectory: '/synthetic/profile/dscord',
};

function harness(oracle = () => loggedOut, language = 'zh') {
  const requests = [];
  const entries = [];
  const disposers = [];
  const intervals = new Set();
  const timeouts = [];
  const dictionaries = new Map();
  let localeSnapshot = { active: language, revision: 0 };
  const localeListeners = new Set();
  const locale = {
    register(namespace, translations) {
      dictionaries.set(namespace, translations);
      return () => dictionaries.delete(namespace);
    },
    bind(namespace) {
      return (key, params = {}) => {
        const translations = dictionaries.get(namespace);
        const template = translations?.[localeSnapshot.active]?.[key] ?? translations?.en[key] ?? key;
        return template.replace(/\{(\w+)\}/g, (match, name) => name in params ? String(params[name]) : match);
      };
    },
    getSnapshot: () => localeSnapshot,
    subscribe(listener) { localeListeners.add(listener); return () => localeListeners.delete(listener); },
    setLocale(active) {
      localeSnapshot = { active, revision: localeSnapshot.revision + 1 };
      for (const listener of localeListeners) listener();
    },
  };
  let descriptor;
  const react = {
    Fragment: Symbol('Fragment'),
    useState: value => [value, () => {}],
    createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat() }),
    useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
    useRef: current => ({ current }),
    useEffect: () => {},
  };
  const element = (type, { children, ...props } = {}, key) => ({
    type, props: key === undefined ? props : { ...props, key }, children: children === undefined ? [] : [children].flat(Infinity),
  });
  const jsxRuntime = { Fragment: react.Fragment, jsx: element, jsxs: element };
  vm.runInNewContext(source, {
    window: { __ModuleLoader__: { load(value) { descriptor = value; } } },
    document: { visibilityState: 'visible' },
    URL, AbortController, clearTimeout, atob,
    setTimeout(callback, milliseconds) { timeouts.push(milliseconds); return setTimeout(callback, milliseconds); },
    setInterval(callback) { intervals.add(callback); return callback; },
    clearInterval(callback) { intervals.delete(callback); },
    async fetch(url, options) {
      const payload = JSON.parse(options.body);
      requests.push({ url, ...options, payload });
      const result = await oracle(payload, options.signal);
      if (result instanceof Response) return result;
      return { ok: true, json: async () => ({ ok: true, value: result }) };
    },
  });
  const plugin = descriptor.factory(name => {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return jsxRuntime;
    if (name === 'react-dom') return { createPortal: element => element };
    if (name === '@deepseek-ai/dsh-client-ui-primitives') return { Button: 'button', Input: 'input', IconPluginPinwheelOutlineRegular: () => null };
    throw new Error(`Unexpected dependency ${name}`);
  });
  plugin.apply({
    locale,
    effect(setup) { disposers.push(setup()); },
    slots: {
      inject(_name, register) { return register(); },
      register(options, component) {
        const originalInject = options.inject;
        entries.push({
          options: { ...options, inject: () => ({ ...originalInject?.(), t: locale.bind(options.locale) }) },
          component,
        });
        return () => {};
      },
    },
  });
  const main = entries.find(entry => entry.options.name === 'main');
  return {
    descriptor, plugin, requests, entries, intervals, timeouts, main, locale, dictionaries, react,
    connection: main.options.inject().connection,
    dispose: () => disposers.forEach(dispose => dispose()),
  };
}

function render(element) {
  if (!element || typeof element !== 'object') return element;
  if (typeof element.type === 'function') return render(element.type(element.props));
  return { ...element, children: element.children.map(render) };
}

function find(element, predicate) {
  if (!element || typeof element !== 'object') return undefined;
  if (predicate(element)) return element;
  return element.children.map(child => find(child, predicate)).find(Boolean);
}

test('DSH client registers the package page, sidebar icon and installed-package configuration', t => {
  const fixture = harness();
  t.after(fixture.dispose);
  assert.equal(fixture.descriptor.id, 'dscord');
  assert.deepEqual(Array.from(fixture.plugin.inject), ['slots', 'locale', 'layout']);
  assert.deepEqual(fixture.entries.map(entry => [entry.options.name, entry.options.key || entry.options.id]), [
    ['main', 'dscord'], ['sidebar.panellist', 'dscord'], ['shell.overlay', 'dscord'], ['plugins.bundle.config', 'dscord'],
  ]);
  assert.equal(fixture.entries[3].options.inject().connection, fixture.connection);
  assert.ok(fixture.entries.every(entry => entry.options.locale === 'dscord.connection'));
  assert.equal(fixture.requests.length, 0);
});

test('the DSH locale namespace covers both languages and switches page labels without recreating state', async t => {
  const fixture = harness(() => loggedOut, 'en');
  t.after(fixture.dispose);
  await fixture.connection.refresh();
  const dictionaries = fixture.dictionaries.get('dscord.connection');
  assert.deepEqual(Object.keys(dictionaries.en).sort(), Object.keys(dictionaries.zh).sort());
  const connection = fixture.connection;
  for (const [language, labels] of [
    ['en', { page: 'DSCord connection', login: 'Connect your DSCord account', submit: 'Connect', key: 'Connection key' }],
    ['zh', { page: 'DSCord 连接', login: '连接 DSCord 账号', submit: '连接', key: '连接密钥' }],
  ]) {
    fixture.locale.setLocale(language);
    for (const entry of fixture.entries.filter(item => ['main', 'plugins.bundle.config'].includes(item.options.name))) {
      const tree = render(entry.component(entry.options.inject()));
      assert.equal(tree.props['aria-label'], labels.page);
      assert.ok(find(tree, element => element.type === 'form' && element.props['aria-label'] === labels.login));
      assert.ok(find(tree, element => element.type === 'button' && element.props.type === 'submit' && element.children.includes(labels.submit)));
      assert.ok(find(tree, element => element.type === 'label' && element.children.includes(labels.key)));
    }
    assert.equal(fixture.entries[1].options.label(), 'DSCord');
    assert.equal(fixture.main.options.inject().connection, connection);
  }
  assert.equal(fixture.requests.length, 1);
});

test('the linked page shows the account, this device and the Bots it runs, in the host language, with nothing to edit', async t => {
  const online = { ...loggedIn, bots: [{ ...loggedIn.bots[0], name: 'Finance', servers: [{ ...loggedIn.bots[0].servers[0], status: 'online' }] }] };
  const fixture = harness(() => online, 'en');
  t.after(fixture.dispose);
  await fixture.connection.refresh();
  for (const [language, labels] of [
    ['en', { bots: 'Bots this device runs', status: 'Online', logout: 'Sign out', web: 'Open DSCord on the web', chat: 'Open chat', model: 'Model · deepseek/v4' }],
    ['zh', { bots: '这台设备运行的 Bot', status: '已上线', logout: '退出登录', web: '打开 DSCord 网页', chat: '去聊天', model: '模型 · deepseek/v4' }],
  ]) {
    fixture.locale.setLocale(language);
    const tree = render(fixture.main.component(fixture.main.options.inject()));
    const panel = find(tree, element => element.props['aria-label'] === labels.bots);
    assert.ok(find(panel, element => element.props['data-status'] === 'online' && element.children.includes(labels.status)));
    assert.ok(find(panel, element => element.type === 'a' && element.props.href === 'https://chat.example.test/' && element.children.includes(labels.web)));
    assert.ok(find(panel, element => element.type === 'a' && element.children.includes(labels.chat)));
    assert.ok(find(panel, element => element.children.includes(labels.model)));
    assert.equal(find(panel, element => ['button', 'input', 'select', 'textarea', 'form'].includes(element.type)), undefined, 'Bots are set up on the web');
    assert.ok(find(tree, element => element.type === 'button' && element.children.includes(labels.logout)));
    assert.ok(find(tree, element => element.children.includes('alice@id.test · DSH laptop')));
    assert.equal(find(tree, element => element.type === 'ol'), undefined, 'the guide leaves once a Bot is online');
  }
});

test('the guide names the next step: link, add a Bot on the web, then the Bot goes online', async t => {
  let value = loggedOut;
  const fixture = harness(() => value);
  t.after(fixture.dispose);
  const current = async () => {
    await fixture.connection.refresh();
    const tree = render(fixture.main.component(fixture.main.options.inject()));
    const step = find(tree, element => element.props['aria-current'] === 'step');
    return [find(step, element => element.type === 'strong').children[0], find(step, element => element.type === 'small').children[0]];
  };
  assert.deepEqual(await current(), ['连接账号', '粘贴网页上复制的连接密钥']);
  value = { ...loggedIn, bots: [] };
  assert.deepEqual(await current(), ['添加 Bot', '在 DSCord 网页点「添加 Bot」']);
  const tree = render(fixture.main.component(fixture.main.options.inject()));
  assert.ok(find(tree, element => element.children.includes('还没有 Bot。在 DSCord 网页点「添加 Bot」，它会自动出现在这里并上线。')));
  value = loggedIn;
  assert.deepEqual(await current(), ['上线', 'Bot 自动上线，去聊天里 @ 它']);
});

test('a displayed client error changes language with DSH without repeating the failed request', async t => {
  const fixture = harness(() => ({}), 'en');
  t.after(fixture.dispose);
  await fixture.connection.refresh();
  for (const [language, text] of [['en', 'DSH returned incomplete connection status'], ['zh', 'DSH 返回的连接状态不完整']]) {
    fixture.locale.setLocale(language);
    const tree = render(fixture.main.component(fixture.main.options.inject()));
    assert.ok(find(tree, element => element.props.role === 'alert' && element.children.includes(text)));
  }
  assert.equal(fixture.requests.length, 1);
});

test('only the first status read retries a not-yet-registered route, with three attempts at most', async t => {
  let attempts = 0;
  const starting = harness(() => ++attempts < 3 ? new Response(null, { status: 404 }) : loggedOut);
  t.after(starting.dispose);
  await starting.connection.refresh();
  assert.equal(attempts, 3);
  assert.equal(starting.connection.getSnapshot().error, null);
  assert.equal(starting.connection.getSnapshot().value.user, null);

  const unavailable = harness(() => new Response(null, { status: 404 }));
  t.after(unavailable.dispose);
  await unavailable.connection.refresh();
  assert.equal(unavailable.requests.length, 3);
  assert.match(unavailable.connection.getSnapshot().error, /HTTP 404/);
  await unavailable.connection.refresh();
  assert.equal(unavailable.requests.length, 4);
  await unavailable.connection.login('synthetic-connection-key');
  assert.equal(unavailable.requests.length, 5);
  assert.equal(unavailable.requests[4].payload.action, 'login');
  assert.match(unavailable.connection.getSnapshot().error, /HTTP 404/);
});

test('the page has three actions of its own: link, report now, unlink', async t => {
  const fixture = harness(payload => payload.action === 'logout' ? loggedOut : loggedIn);
  t.after(fixture.dispose);
  await fixture.connection.login('synthetic-connection-key');
  assert.equal(fixture.requests[0].url, 'api/dscord');
  assert.equal(fixture.requests[0].credentials, 'same-origin');
  assert.deepEqual(fixture.requests[0].payload, { action: 'login', key: 'synthetic-connection-key' });
  assert.equal(JSON.stringify(fixture.connection.getSnapshot()).includes('synthetic-connection-key'), false);
  assert.equal(fixture.connection.getSnapshot().notice, 'linked');
  // Refresh on a linked page asks the device to report to the central server at once.
  const tree = render(fixture.main.component(fixture.main.options.inject()));
  find(tree, element => element.type === 'button' && element.children.includes('刷新')).props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  await fixture.connection.logout();
  assert.deepEqual(fixture.requests.map(request => request.payload.action), ['login', 'sync', 'logout']);
  assert.deepEqual(fixture.timeouts, [30_000, 300_000, 300_000]);
  assert.equal(fixture.connection.getSnapshot().value.user, null);
  assert.deepEqual(Object.keys(fixture.connection).sort(), ['dispose', 'getSnapshot', 'kernel', 'login', 'logout', 'refresh', 'subscribe', 'sync']);
});

test('an older status response cannot replace a completed login', async t => {
  let resolveStatus;
  const fixture = harness(payload => payload.action === 'status'
    ? new Promise(resolve => { resolveStatus = resolve; }) : loggedIn);
  t.after(fixture.dispose);
  const staleRead = fixture.connection.refresh();
  await fixture.connection.login('synthetic-connection-key');
  resolveStatus(loggedOut);
  await staleRead;
  assert.equal(fixture.connection.getSnapshot().value.user.id, 'alice@id.test');
  assert.equal(fixture.connection.getSnapshot().error, null);
});

test('background status refresh preserves an action error until an explicit refresh', async t => {
  const fixture = harness(payload => {
    if (payload.action === 'login') throw new Error('账号或密码错误');
    return loggedOut;
  });
  t.after(fixture.dispose);
  await fixture.connection.login('synthetic-connection-key');
  await fixture.connection.refresh({ clearError: false });
  assert.equal(fixture.connection.getSnapshot().error, '账号或密码错误');
  await fixture.connection.refresh();
  assert.equal(fixture.connection.getSnapshot().error, null);
});

test('the login form takes one connection key and clears it before dispatching the login request', async t => {
  const fixture = harness();
  t.after(fixture.dispose);
  await fixture.connection.refresh();
  const tree = render(fixture.main.component(fixture.main.options.inject()));
  const form = find(tree, element => element.type === 'form');
  const fields = [];
  (function collect(element) {
    if (!element || typeof element !== 'object') return;
    if (['input', 'textarea'].includes(element.type)) fields.push(element.props.name);
    element.children.forEach(collect);
  })(form);
  assert.deepEqual(fields, ['connectionKey'], 'DSH asks for nothing but the key');
  const inputs = { connectionKey: { value: '  eyJzZXJ2ZXIiOiJ4In0  ' } };
  let sent;
  fixture.connection.login = (...args) => {
    assert.equal(inputs.connectionKey.value, '');
    sent = args;
  };
  form.props.onSubmit({ preventDefault() {}, currentTarget: { elements: { namedItem: name => inputs[name] } } });
  assert.deepEqual(sent, ['eyJzZXJ2ZXIiOiJ4In0']);
  assert.equal(find(tree, element => element.type === 'textarea').props.autoComplete, 'off');
});

test('pasting a whole connection key signs in at once, and other pasted text waits for the button', async t => {
  const fixture = harness();
  t.after(fixture.dispose);
  await fixture.connection.refresh();
  const tree = render(fixture.main.component(fixture.main.options.inject()));
  const textarea = find(tree, element => element.type === 'textarea');
  const sent = [];
  fixture.connection.login = key => sent.push(key);
  const paste = text => {
    const event = { prevented: false, preventDefault() { this.prevented = true; }, currentTarget: { value: 'left over' }, clipboardData: { getData: () => text } };
    textarea.props.onPaste(event);
    return event;
  };
  const key = Buffer.from(JSON.stringify({ server: 'https://chat.example.test', code: 'connect-1' })).toString('base64url');
  const whole = paste(`  ${key}\n`);
  assert.deepEqual(sent, [key]);
  assert.deepEqual([whole.prevented, whole.currentTarget.value], [true, ''], 'the key does not stay in the form');
  for (const text of ['hello', key.slice(0, 20), Buffer.from('{"server":"x"}').toString('base64url')]) assert.equal(paste(text).prevented, false, text);
  assert.deepEqual(sent, [key]);
});

test('connection key errors from the plugin show in the host language', async t => {
  const fixture = harness(payload => {
    if (payload.action === 'login') return new Response(JSON.stringify({ ok: false, error: { code: 'CONNECT_CODE_EXPIRED', message: '连接密钥已过期' } }), { status: 200 });
    return loggedOut;
  }, 'en');
  t.after(fixture.dispose);
  await fixture.connection.login('spent');
  assert.equal(fixture.connection.getSnapshot().error, 'This connection key has expired. Make a new one on the web page.');
});

test('the page links only to addresses a browser can open, and says what is wrong with the device or the central server', async t => {
  const fixture = harness(() => ({ ...loggedIn, webUrl: 'javascript:alert(1)', lastError: 'fetch failed', runtime: { available: false, message: 'DS-Bot 未就绪' },
    bots: [{ ...loggedIn.bots[0], error: '这台设备上没有模型 x/y，请在网页上另选一个',
      servers: [{ url: 'javascript:alert(1)', serverName: 'chat.example.test', status: 'online' }, { url: 'https://two.example.test', serverName: 'two.example.test', status: 'error', error: 'Core is still starting' }] }] }));
  t.after(fixture.dispose);
  await fixture.connection.refresh();
  const tree = render(fixture.main.component(fixture.main.options.inject()));
  assert.equal(find(tree, element => element.type === 'a'), undefined);
  assert.ok(find(tree, element => element.props.role === 'alert' && element.children.includes('暂时连不上中央服务器，Bot 按上次的设置继续运行：fetch failed')));
  assert.ok(find(tree, element => element.props.role === 'status' && element.children.includes('DS-Bot 未就绪')));
  assert.ok(find(tree, element => element.props.role === 'alert' && element.children.includes('这台设备上没有模型 x/y，请在网页上另选一个')));
  assert.ok(find(tree, element => element.props['data-status'] === 'error' && element.children.includes('连接失败')));
  assert.ok(find(tree, element => element.children.includes('Core is still starting')));
  assert.ok(find(tree, element => element.type === 'code' && element.children.includes('/synthetic/profile/dscord')));
});

test('shared page subscriptions own one polling timer and plugin disposal stops pending work', async () => {
  let abortSignal;
  const fixture = harness((_payload, signal) => {
    abortSignal = signal;
    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  });
  const unsubscribe = fixture.connection.subscribe(() => {});
  const unsubscribeOther = fixture.connection.subscribe(() => {});
  assert.equal(fixture.intervals.size, 1);
  assert.equal(fixture.requests.length, 1);
  unsubscribe();
  assert.equal(fixture.intervals.size, 1);
  unsubscribeOther();
  assert.equal(fixture.intervals.size, 0);
  fixture.dispose();
  assert.equal(abortSignal.aborted, true);
  await fixture.connection.refresh();
  assert.equal(fixture.requests.length, 1);
});
