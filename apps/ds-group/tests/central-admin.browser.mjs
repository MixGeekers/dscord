import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { createCentral } from "../central/service.mjs";
import { packageRoot } from "../src/paths.mjs";

// A real central server with its built panel; chat servers' public pages are synthetic.
const ISSUER = "https://id.example.org";
const servers = [
  { origin: "https://robotics.example.org", name: "机器人社", description: "机械臂、小车和每周的搭建夜", tags: ["robots", "hardware"], discovery: "public", join: "open", people: 42, bots: 5 },
  { origin: "https://reading.example.org", name: "读书会", description: "每月一本书，线上讨论", tags: ["books"], discovery: "number", join: "invite", people: 18, bots: 1 },
  { origin: "https://design.example.org", name: "Design Lab", description: "UI critique and weekly challenges", tags: ["design"], discovery: "public", join: "open", people: 27, bots: 2 },
  { origin: "https://spam.example.org", name: "免费领取", description: "点击就送", tags: [], discovery: "public", join: "open", people: 3, bots: 40 },
];
const pages = new Map(servers.map((server) => [`${server.origin}/.well-known/dscord/server`, {
  schemaVersion: 1, central: ISSUER, origin: server.origin, discovery: server.discovery, name: server.name, description: server.description,
  tags: server.tags, join: server.join, members: { people: server.people, bots: server.bots },
}]));
const root = await mkdtemp(path.join(os.tmpdir(), "dscord-central-admin-browser-"));
const central = await createCentral({
  dataRoot: root,
  refreshIntervalMs: 0,
  adminWebRoot: path.join(packageRoot, "dist/central-admin"),
  config: { issuer: ISSUER, admins: ["curator"] },
  fetch: async (url) => {
    const page = pages.get(String(url));
    if (!page) throw new TypeError("fetch failed");
    return Response.json(page);
  },
});
await new Promise((resolve) => central.server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${central.server.address().port}`;
const api = async (route, { method = "GET", token, body } = {}) => {
  const response = await fetch(base + route, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const value = await response.json();
  assert.ok(response.ok, `${route}: ${JSON.stringify(value)}`);
  return value;
};
const register = async (username, displayName) =>
  (await api("/api/register", { method: "POST", body: { username, password: `${username}-password`, displayName } })).token;
const curator = await register("curator", "中央管理员");
const alice = await register("alice", "爱丽丝");
await register("bob", "Bob");
await api("/api/bots", { method: "POST", token: alice, body: { username: "helper", displayName: "小助手" } });
for (const server of servers) await api("/api/servers", { method: "POST", body: { origin: server.origin } });
const decide = (origin, status, note = "") =>
  api(`/api/admin/servers/${encodeURIComponent(origin)}/decision`, { method: "POST", token: curator, body: { status, note } });
await decide("https://design.example.org", "listed");
await decide("https://spam.example.org", "banned", "广告");

const output = path.join(packageRoot, ".local/central-admin-browser");
await mkdir(output, { recursive: true });
const checks = [];
const errors = [];
let browser;
let failure;
try {
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "zh-CN" });
  await context.addInitScript(() => {
    localStorage.setItem("ds-group.language", "zh-CN");
    localStorage.setItem("ds-group.theme", "light");
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${base}/admin`);
  await page.getByRole("heading", { name: "登录中央管理" }).waitFor();
  await page.screenshot({ path: path.join(output, "central-login-zh.png"), animations: "disabled" });

  // An account that is not an administrator is turned away with the reason.
  await page.getByLabel("用户名", { exact: true }).fill("alice");
  await page.getByLabel("密码", { exact: true }).fill("alice-password");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.getByText("这个账号不是本中央服务器的管理员。", { exact: true }).waitFor();
  checks.push("nonAdministratorIsRefusedWithAReason");

  await page.getByLabel("用户名", { exact: true }).fill("curator");
  await page.getByLabel("密码", { exact: true }).fill("curator-password");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.getByRole("heading", { name: "概览", exact: true }).waitFor();
  await page.locator(".admin-metric").filter({ hasText: "待审核" }).getByText("2", { exact: true }).waitFor();
  await page.screenshot({ path: path.join(output, "central-overview-zh.png"), animations: "disabled" });
  checks.push("administratorSeesPendingCountsAndSettings");

  await page.getByRole("button", { name: "查看服务器", exact: true }).click();
  await page.getByRole("tab", { name: /待审核/ }).waitFor();
  assert.equal(await page.locator(".central-server-row").count(), 2);
  await page.getByText("机器人社", { exact: true }).waitFor();
  await page.screenshot({ path: path.join(output, "central-servers-pending-zh.png"), fullPage: true, animations: "disabled" });
  const robotics = page.locator(".central-server-row").filter({ hasText: "机器人社" });
  await robotics.getByRole("button", { name: "上架", exact: true }).click();
  await page.getByText("https://robotics.example.org：已上架。", { exact: true }).waitFor();
  const reading = page.locator(".central-server-row").filter({ hasText: "读书会" });
  await reading.getByLabel("给该服务器管理员的留言", { exact: true }).fill("请在简介里写清加入规则");
  await reading.getByRole("button", { name: "驳回", exact: true }).click();
  await page.getByText("这里没有服务器。", { exact: true }).waitFor();
  const found = await api("/api/servers?q=robots");
  assert.deepEqual(found.servers.map((server) => server.origin), ["https://robotics.example.org"]);
  const rejected = await api("/api/admin/servers?status=rejected", { token: curator });
  assert.equal(rejected.servers[0].note, "请在简介里写清加入规则");
  checks.push("reviewListsAndRejectsWithANote");

  await page.getByRole("tab", { name: /全部/ }).click();
  await page.locator(".central-server-row").nth(3).waitFor();
  await page.screenshot({ path: path.join(output, "central-servers-all-zh.png"), fullPage: true, animations: "disabled" });

  await page.getByRole("button", { name: /^账号/ }).click();
  await page.getByText("alice@id.example.org", { exact: true }).waitFor();
  const aliceRow = page.locator(".admin-list-row").filter({ has: page.getByText("alice@id.example.org", { exact: true }) });
  await aliceRow.getByRole("button", { name: "停用", exact: true }).click();
  await page.getByText("已停用 alice。", { exact: true }).waitFor();
  await aliceRow.getByText("已停用", { exact: true }).waitFor();
  assert.equal(await page.locator(".admin-list-row").filter({ has: page.getByText("curator@id.example.org", { exact: true }) }).getByRole("button").count(), 0,
    "an administrator has no button to disable themselves");
  await page.screenshot({ path: path.join(output, "central-accounts-zh.png"), fullPage: true, animations: "disabled" });
  checks.push("accountsCanBeDisabledButNotOneself");

  await page.getByRole("button", { name: /^设置/ }).click();
  await page.getByLabel("新登记的服务器", { exact: true }).selectOption("open");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByText("设置已保存。", { exact: true }).waitFor();
  assert.equal((await api("/api/admin/overview", { token: curator })).settings.listing, "open");
  await page.getByLabel("新登记的服务器", { exact: true }).selectOption("review");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByText("设置已保存。", { exact: true }).waitFor();
  await page.screenshot({ path: path.join(output, "central-settings-zh.png"), animations: "disabled" });
  checks.push("settingsSwitchBetweenReviewAndImmediateListing");

  await page.getByLabel("语言", { exact: true }).selectOption("en");
  await page.getByRole("button", { name: /^Servers/ }).click();
  await page.getByRole("tab", { name: /All/ }).click();
  await page.locator(".central-server-row").nth(3).waitFor();
  await page.screenshot({ path: path.join(output, "central-servers-all-en.png"), fullPage: true, animations: "disabled" });
  checks.push("panelSwitchesToEnglish");

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "zh-CN" });
  await mobile.addInitScript((token) => {
    localStorage.setItem("ds-group.language", "zh-CN");
    localStorage.setItem("ds-group.theme", "light");
    sessionStorage.setItem(`dscord.central-admin.${location.origin}`, token);
  }, curator);
  const phone = await mobile.newPage();
  phone.on("pageerror", (error) => errors.push(error.message));
  await phone.goto(`${base}/admin`);
  await phone.getByRole("button", { name: /^服务器/ }).click();
  await phone.getByRole("tab", { name: /全部/ }).click();
  await phone.locator(".central-server-row").first().waitFor();
  const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `no horizontal scroll on a phone (${overflow}px)`);
  await phone.screenshot({ path: path.join(output, "central-servers-zh-mobile.png"), fullPage: true, animations: "disabled" });
  checks.push("phoneLayoutHasNoHorizontalScroll");
  assert.deepEqual(errors, []);
} catch (error) {
  failure = error;
} finally {
  await browser?.close();
  await central.close();
  await rm(root, { recursive: true, force: true });
}
console.log(JSON.stringify({ status: failure ? "failed" : "passed", level: "real-chromium-real-central-built-panel", checks, errors,
  ...(failure ? { error: failure.message } : {}) }));
if (failure) throw failure;
