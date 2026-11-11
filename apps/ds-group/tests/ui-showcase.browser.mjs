// The design system showcase (ui/showcase/) in a real Chromium with classic scrollbars, as Windows draws them:
// screenshots in both languages and themes, and the layout checks behind the problems found on Windows —
// focus rings cut off by scroll areas, sideways overflow, a native select, text roles out of order.
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";
import { packageRoot } from "../src/paths.mjs";
import { chooseOption, classicScrollbars } from "./helpers/select.mjs";

const output = path.join(packageRoot, ".local/ui-showcase");
const temporary = await mkdtemp(path.join(os.tmpdir(), "dscord-ui-showcase-"));
const server = await createServer({
  configFile: path.join(packageRoot, "ui/showcase/vite.config.ts"),
  cacheDir: path.join(temporary, "vite-cache"),
  server: { host: "127.0.0.1", port: 0 },
  logLevel: "error",
});

const checks = [];
const pageErrors = [];
let browser;
try {
  await server.listen();
  await mkdir(output, { recursive: true });
  const base = `http://127.0.0.1:${server.httpServer.address().port}/`;
  browser = await chromium.launch(classicScrollbars);

  for (const [lang, theme] of [["zh-CN", "dark"], ["zh-CN", "light"], ["en", "dark"], ["en", "light"]]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(`${base}?lang=${lang}&theme=${theme}`);
    await page.locator("#scroll").waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), theme);
    assert.equal(await page.evaluate(() => document.documentElement.lang), lang);

    // Classic scrollbars are on: the scroll area's scrollbar takes layout space.
    const scroll = page.getByTestId("showcase-scroll");
    const gutter = await scroll.evaluate((element) => element.offsetWidth - element.clientWidth - element.clientLeft * 2);
    assert.ok(gutter > 0, "classic scrollbars take layout space in this browser");
    // The scrollbar is the system's thin one, not the classic bar with arrow buttons (about 15px wide).
    assert.ok(gutter <= 8, `the scroll area draws a thin scrollbar (${gutter}px)`);
    // A fieldset's legend keeps its distance from the controls under it, focus ring included.
    const legendGap = await scroll.evaluate((element) => {
      const legend = element.querySelector("legend").getBoundingClientRect();
      return element.querySelector(".showcase-swatch").getBoundingClientRect().top - legend.bottom;
    });
    assert.ok(legendGap >= 8, `the legend sits clear of the controls under it (${legendGap}px)`);

    // Nothing scrolls sideways: not the page, not the scroll area.
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "the page does not scroll sideways");
    assert.ok(await scroll.evaluate((element) => element.scrollWidth <= element.clientWidth), "the scroll area does not scroll sideways");

    // A focus ring at the scroll area's left edge is drawn in full (Windows: the theme colour and device name rings were cut off).
    await page.keyboard.press("Tab");
    for (const target of [scroll.locator(".showcase-swatch").first(), page.locator("#showcase-scroll-device")]) {
      await target.focus();
      const room = await target.evaluate((element) => {
        const area = element.closest(".ds-scroll-area");
        const box = element.getBoundingClientRect();
        const frame = area.getBoundingClientRect();
        const style = getComputedStyle(element);
        const ring = parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);
        return { ring, left: box.left - ring - (frame.left + area.clientLeft), right: frame.left + area.clientLeft + area.clientWidth - (box.right + ring) };
      });
      assert.ok(room.ring > 0, "the focused control draws a ring");
      assert.ok(room.left >= 0 && room.right >= 0, `the focus ring fits inside the scroll area (${JSON.stringify(room)})`);
    }
    await page.locator("body").click({ position: { x: 4, y: 4 } });

    // Text roles keep their order of importance as rendered.
    const sizes = await page.evaluate(() => Object.fromEntries(["display", "title", "heading", "message", "body-strong", "body", "label", "caption", "micro"]
      .map((role) => [role, parseFloat(getComputedStyle(document.querySelector(`.showcase-role-${role}`)).fontSize)])));
    const order = Object.values(sizes);
    for (let index = 1; index < order.length; index++) assert.ok(order[index - 1] >= order[index], `text roles out of order: ${JSON.stringify(sizes)}`);
    const sectionTitle = await page.locator("#empty .ds-section-title").first().evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
    const emptyTitle = await page.locator("#empty .ds-empty-title").evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
    assert.ok(sectionTitle > emptyTitle, "a section title is larger than the empty state inside it");

    await page.screenshot({ path: path.join(output, `showcase-${theme}-${lang}.png`), fullPage: true, animations: "disabled" });

    // The select is ours: a button, a list we draw, keyboard and pointer both work.
    const model = page.locator("#showcase-model");
    assert.equal(await model.evaluate((element) => element.tagName), "BUTTON");
    assert.equal(await page.locator("select").count(), 0, "no native select on the page");
    await model.click();
    const popup = page.locator(".ds-select-popup[data-open]");
    await popup.waitFor();
    assert.equal(await popup.locator(".ds-select-group-label").count(), 2);
    await page.waitForTimeout(150);
    await page.locator("#select").screenshot({ path: path.join(output, `select-open-${theme}-${lang}.png`), animations: "disabled" });
    const popupBox = await popup.boundingBox();
    const cardBox = await page.locator("#select").boundingBox();
    await page.screenshot({
      path: path.join(output, `select-list-${theme}-${lang}.png`),
      clip: { x: cardBox.x, y: cardBox.y, width: cardBox.width, height: Math.max(cardBox.height, popupBox.y + popupBox.height - cardBox.y + 16) },
      animations: "disabled",
    });
    await page.keyboard.press("Escape");
    await chooseOption(model, "deepseek-chat");
    assert.equal((await model.textContent()).trim(), "DeepSeek Chat");
    await model.focus();
    await page.keyboard.press("ArrowDown");
    await popup.waitFor();
    await popup.locator('.ds-select-item[data-highlighted][data-value="deepseek-chat"]').waitFor();
    await page.keyboard.press("ArrowDown");
    await popup.locator('.ds-select-item[data-highlighted][data-value="deepseek-reasoner"]').waitFor();
    await page.keyboard.press("Enter");
    await popup.waitFor({ state: "hidden" });
    assert.match(await model.textContent(), /Reasoner/);

    // Filter chips: one chosen at a time, all the same height.
    const chips = page.locator("#filters .ds-chip");
    const heights = new Set(await chips.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height)));
    assert.equal(heights.size, 1, "every chip has the same height");
    await chips.nth(1).click();
    assert.equal(await page.locator("#filters .ds-chip[data-pressed]").count(), 1);
    assert.match(await page.locator("#filters .ds-chip[data-pressed]").textContent(), /Devtomato/);
    await page.close();
  }
  checks.push("showcaseScreenshotsInBothLanguagesAndThemes", "classicScrollbarsHaveNoSidewaysOverflow", "focusRingsFitInScrollAreas", "textRolesInOrder", "selectIsDrawnBySystem", "filterChipsChooseOne");

  // Phone width: the info list puts each label above its value and nothing scrolls sideways.
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  phone.on("pageerror", (error) => pageErrors.push(error.message));
  await phone.goto(`${base}?lang=zh-CN&theme=light`);
  await phone.locator("#sections").waitFor();
  assert.ok(await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "no sideways scroll at phone width");
  const [label, value] = await phone.locator("#sections .ds-info-row").first().locator("dt, dd").evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect()));
  assert.ok(value.top >= label.bottom - 1, "on a phone the label sits above its value");
  await phone.locator("#sections").screenshot({ path: path.join(output, "sections-mobile-light-zh-CN.png"), animations: "disabled" });
  await phone.close();
  checks.push("infoListStacksOnPhones");

  assert.deepEqual(pageErrors, []);
  await writeFile(path.join(output, "ui-showcase-browser.json"), `${JSON.stringify({ checks }, null, 2)}\n`);
  console.log(JSON.stringify({ checks }, null, 2));
} finally {
  await browser?.close();
  await server.close();
  await rm(temporary, { recursive: true, force: true });
}
