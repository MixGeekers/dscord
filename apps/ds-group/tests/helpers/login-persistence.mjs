import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

/** Runs against the same production bundle and split-origin synthetic APIs as unified-client. */
export async function verifyLoginPersistence({ origin, output, checks, holdSend, revokeSession }) {
  const profile = await mkdtemp(path.join(output, 'login-profile-'));
  let context;
  const errors = [];
  const launch = async () => {
    context = await chromium.launchPersistentContext(profile, { headless: true, locale: 'en-US', viewport: { width: 1100, height: 850 } });
    context.setDefaultTimeout(15000);
    context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
    return context.newPage();
  };
  const ready = async (page, user = '@alice:home.test') => {
    await page.waitForFunction(user => document.querySelector('#current-id')?.textContent === user, user);
    await page.locator('#connection-text').filter({ hasText: 'Connected' }).waitFor();
    assert.equal(await page.locator('#login-dialog').evaluate(dialog => dialog.open), false);
  };
  const login = async (page, user, remember = true) => {
    await page.locator('#login-dialog[open]').waitFor();
    await page.locator('#login-user').fill(user);
    await page.locator('#login-password').fill('synthetic-password');
    if (await page.locator('#login-remember').isChecked() !== remember) await page.locator('.auth-remember').click();
    assert.equal(await page.locator('#login-remember').isChecked(), remember);
    await page.locator('#login-submit').click();
    await ready(page, `@${user}:home.test`);
  };
  const logout = async page => {
    await page.locator('#identity-button').click();
    await page.locator('#settings-button').click();
    await page.locator('[data-settings-tab="account"]').click();
    await page.locator('#logout-button').click();
    await page.locator('#login-dialog[open]').waitFor();
  };
  try {
    let page = await launch();
    await page.goto(origin);
    await page.locator('#login-dialog[open]').waitFor();
    assert.equal(await page.locator('#login-remember').isChecked(), true);
    await page.screenshot({ path: path.join(output, 'remember-device-login.png'), animations: 'disabled' });
    await login(page, 'alice');
    await page.getByRole('button', { name: 'Project', exact: true }).click();
    await page.locator('#room-title').filter({ hasText: 'Project' }).waitFor();
    await page.locator('#message-input').fill('Unsent draft across a real browser restart');
    await page.waitForFunction(() => Object.keys(localStorage).some(key => localStorage.getItem(key)?.includes('Unsent draft across a real browser restart')));
    const loginBefore = await page.evaluate(() => Object.entries(localStorage).find(([key]) => key.startsWith('ds-group.session.v3.') && !key.endsWith('.change'))?.[1]);
    assert.ok(loginBefore);
    await context.close(); // Finish the browser process, retaining only its on-disk profile.
    page = await launch();
    await page.goto(origin); // Bare origin: no roomId carried across in the URL.
    await ready(page);
    await page.locator('#room-title').filter({ hasText: 'Project' }).waitFor();
    await page.waitForFunction(() => document.querySelector('#message-input')?.textContent === 'Unsent draft across a real browser restart');
    assert.equal(await page.evaluate(() => Object.entries(localStorage).find(([key]) => key.startsWith('ds-group.session.v3.') && !key.endsWith('.change'))?.[1]), loginBefore);
    checks.push('rememberedIdentityOriginalRoomAndDraftSurviveFullBrowserProcessRestart');

    const second = await context.newPage();
    await second.goto(origin);
    await ready(second);
    const held = holdSend();
    await page.locator('#send-button').click();
    const release = await held;
    await second.locator('#message-input').fill('Another tab keeps its independent draft');
    await second.locator('#send-button').click();
    await second.getByText('Another message is waiting for confirmation. Resolve it in the original tab first. Your draft is kept.', { exact: true }).waitFor();
    assert.equal(await second.locator('#message-input').textContent(), 'Another tab keeps its independent draft');
    release();
    await page.waitForFunction(() => document.querySelector('#message-input')?.textContent === '');
    await second.reload();
    await ready(second);
    assert.equal(await second.locator('#message-input').textContent(), 'Another tab keeps its independent draft');
    checks.push('anotherTabsPendingSendCannotResendWrongMessageOrEraseItsNewerDraft');
    await logout(page);
    await second.locator('#login-dialog[open]').waitFor();
    assert.equal(await second.locator('#send-button').isDisabled(), true);
    await second.reload();
    await second.locator('#login-dialog[open]').waitFor();
    checks.push('logoutClearsRememberedLoginAndSignsOutOtherTabsIncludingAfterReload');

    await login(page, 'bob');
    await ready(second, '@bob:home.test');
    assert.equal(await second.locator('#message-input').textContent(), '');
    assert.equal(await page.locator('#message-input').textContent(), '');
    checks.push('newRememberedAccountPropagatesToOtherTabsWithoutRestoringPreviousUsersDraft');

    await context.setOffline(true);
    await page.waitForFunction(() => document.querySelector('#connection-text')?.textContent === 'Offline');
    assert.equal(await page.locator('#login-dialog').evaluate(dialog => dialog.open), false);
    await page.locator('#message-input').fill('Offline draft is kept');
    await context.setOffline(false);
    await ready(page, '@bob:home.test');
    assert.equal(await page.locator('#message-input').textContent(), 'Offline draft is kept');
    checks.push('networkLossPreservesLoginAndDraftAndOnlineEventReconnectsWithoutPassword');

    const token = await page.evaluate(() => JSON.parse(Object.entries(localStorage).find(([key]) => key.startsWith('ds-group.session.v3.') && !key.endsWith('.change'))[1]).session.access_token);
    revokeSession(token);
    await page.locator('#login-dialog[open]').waitFor();
    await second.locator('#login-dialog[open]').waitFor();
    checks.push('serverRevocationInvalidatesRememberedLoginInEveryTab');
    await second.close();
    await login(page, 'alice', false);
    await page.close();
    page = await context.newPage();
    await page.goto(origin);
    await page.locator('#login-dialog[open]').waitFor();
    checks.push('uncheckedRememberDeviceDoesNotRestoreLoginInNewIndependentTab');

    const blocked = await context.browser().newContext({ locale: 'en-US' });
    try {
      await blocked.addInitScript(() => {
        for (const key of ['sessionStorage', 'localStorage']) Object.defineProperty(window, key, { configurable: true, get() { throw new DOMException('Storage disabled', 'SecurityError'); } });
      });
      const temporaryPage = await blocked.newPage();
      temporaryPage.on('pageerror', error => errors.push(error.message));
      await temporaryPage.goto(origin);
      await login(temporaryPage, 'alice');
      await temporaryPage.locator('#message-input').fill('A working page with both storage APIs disabled');
      await temporaryPage.locator('#send-button').click();
      await temporaryPage.waitForFunction(() => document.querySelector('#message-input')?.textContent === '');
      await logout(temporaryPage);
      checks.push('blockedBrowserStorageStillAllowsTemporaryLoginSendAndLocalLogout');
    } finally { await blocked.close(); }
    assert.deepEqual(errors, []);
  } finally {
    await context?.close();
    await rm(profile, { recursive: true, force: true });
  }
}
