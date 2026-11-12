import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { parseClientConfig } from '../web/src/client-config.ts';
import { bindSession, saveSession, restoreSession, forgetSession, isRememberedSession, sessionStorageKey,
  REMEMBER_SESSION_MS, readScoped, readStored, writeStored, removeStored, storageKey } from '../web/src/session.ts';

class Storage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}
const originals = Object.fromEntries(['sessionStorage', 'localStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const config = parseClientConfig({ schemaVersion: 1, homeCoreUrl: 'https://core.example', homeMatrixUrl: 'https://matrix.example' }, 'https://client.example');
const discovery = { central: { issuer: 'https://id.example' } };
const alice = bindSession({ user_id: '@alice:example', access_token: 'synthetic-alice', central: { token: 'synthetic-central' } }, config, discovery);
const bob = bindSession({ user_id: '@bob:example', access_token: 'synthetic-bob' }, config, discovery);
function storage(key, value) { Object.defineProperty(globalThis, key, { value, configurable: true, writable: true }); }
beforeEach(() => { storage('sessionStorage', new Storage()); storage('localStorage', new Storage()); });
afterEach(() => {
  forgetSession(config, restoreSession(config));
  for (const key of Object.keys(originals)) {
    if (originals[key]) Object.defineProperty(globalThis, key, originals[key]);
    else delete globalThis[key];
  }
});

test('remembered login survives loss of every tab-local byte and stays pinned to its home', () => {
  assert.equal(saveSession(config, alice), true);
  const record = JSON.parse(localStorage.getItem(sessionStorageKey(config)));
  assert.equal(record.schemaVersion, 1);
  assert.ok(record.expiresAt <= Date.now() + REMEMBER_SESSION_MS);
  storage('sessionStorage', new Storage());
  assert.deepEqual(restoreSession(config), alice);
  assert.equal(isRememberedSession(config, alice), true);
  const foreign = { ...config, homeCoreUrl: 'https://another.example' };
  localStorage.setItem(sessionStorageKey(foreign), JSON.stringify(record));
  assert.equal(restoreSession(foreign), null);
});

test('temporary login replaces a remembered login without persisting credentials', () => {
  saveSession(config, alice);
  saveSession(config, bob, false);
  assert.equal(localStorage.getItem(sessionStorageKey(config)), null);
  assert.deepEqual(restoreSession(config), bob);
  storage('sessionStorage', new Storage());
  assert.equal(restoreSession(config), null);
});

test('local absolute expiry is checked for both persistent and tab-local copies', () => {
  saveSession(config, alice);
  const record = JSON.parse(localStorage.getItem(sessionStorageKey(config)));
  const now = Date.now;
  Date.now = () => record.expiresAt;
  try { assert.equal(restoreSession(config), null); }
  finally { Date.now = now; }
});

test('shared logout invalidates a suspended tab and a late old-account failure preserves the newer login', () => {
  saveSession(config, alice);
  const oldTab = sessionStorage;
  storage('sessionStorage', new Storage());
  saveSession(config, bob);
  storage('sessionStorage', oldTab);
  assert.deepEqual(restoreSession(config), bob);
  assert.equal(forgetSession(config, alice), false);
  assert.equal(forgetSession(config, bob), true);
  assert.equal(restoreSession(config), null);
});

test('a temporary change in another tab invalidates stale credentials without sharing the new credential', () => {
  saveSession(config, alice);
  const oldTab = sessionStorage;
  storage('sessionStorage', new Storage());
  saveSession(config, bob, false);
  storage('sessionStorage', oldTab);
  assert.equal(restoreSession(config), null);
});

test('blocked persistent storage falls back to a working temporary login', () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('disabled'); } });
  assert.equal(saveSession(config, alice), false);
  assert.deepEqual(restoreSession(config), alice);
  assert.equal(isRememberedSession(config, alice), false);
});

test('when both stores are blocked, the active page can still log in and log out', () => {
  for (const key of ['localStorage', 'sessionStorage']) Object.defineProperty(globalThis, key, { configurable: true, get() { throw new Error('disabled'); } });
  assert.equal(saveSession(config, alice), false);
  assert.deepEqual(restoreSession(config), alice);
  forgetSession(config, alice);
  assert.equal(restoreSession(config), null);
});

test('only remembered, identity-scoped workspace data survives tab loss, including retry IDs', () => {
  saveSession(config, alice);
  for (const kind of ['draft', 'location', 'pending']) {
    const key = storageKey(config, kind, alice, 'example', '!room:example');
    writeStored(key, { body: kind, transactionId: 'unchanged-id' }, true);
    assert.equal(readScoped(config, kind, bob, 'example', '!room:example'), null);
  }
  storage('sessionStorage', new Storage());
  assert.equal(readScoped(config, 'pending', alice, 'example', '!room:example').transactionId, 'unchanged-id');
  saveSession(config, alice, false);
  assert.equal(readScoped(config, 'draft', alice, 'example', '!room:example'), null);
});

test('clearing a sent draft or retry prevents a stale tab-local mirror from reviving it', () => {
  const key = storageKey(config, 'pending', alice);
  writeStored(key, { transactionId: 'same-id' }, true);
  const staleTab = sessionStorage;
  storage('sessionStorage', new Storage());
  removeStored(key);
  storage('sessionStorage', staleTab);
  assert.equal(readStored(key, true), null);
});

test('malformed persisted records are ignored and a valid open legacy tab stays temporary', () => {
  localStorage.setItem(sessionStorageKey(config), '{broken');
  assert.equal(restoreSession(config), null);
  sessionStorage.setItem(sessionStorageKey(config), JSON.stringify(alice));
  assert.deepEqual(restoreSession(config), alice);
  assert.equal(isRememberedSession(config, alice), false);
});
