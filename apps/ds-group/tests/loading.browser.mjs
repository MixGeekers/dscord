// The loading indicator (ui/loading.tsx) in a real page: it replaces the old "Loading…" text, keeps that text for
// screen readers, animates, and stands still when the system asks for reduced motion. Screenshots go to .local/.
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { chromium } from 'playwright';
import { packageRoot } from '../src/paths.mjs';

const temporary = await mkdtemp(path.join(os.tmpdir(), 'dscord-loading-ui-'));
const output = path.join(packageRoot, '.local/loading-browser');
await mkdir(output, { recursive: true });
const report = { status: 'failed', level: 'real-chromium-web-components', checks: [], screenshots: [] };
const style = `<meta name="viewport" content="width=device-width, initial-scale=1"><script src="/theme.js"></script><link rel="stylesheet" href="/tokens.css"><link rel="stylesheet" href="/@fs/${packageRoot}/ui/tailwind.css"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/@fs/${packageRoot}/ui/styles.css">`;
const html = `<!doctype html><html><head>${style}</head><body><div id="root"></div><script type="module">
  import React from 'react'; import { createRoot } from 'react-dom/client';
  import { BotHome } from '/src/components/BotHome.tsx';
  import { Loading } from '/@fs/${packageRoot}/ui/loading.tsx';
  const owner = {id:'@alice:home.test',name:'Alice',kind:'human'};
  const bot = {id:'@helper:home.test',name:'Shiyu',kind:'bot',ownerId:owner.id};
  // Every read stays open, so the page shows what it shows while it waits.
  const api = () => new Promise(() => {});
  const session = {user_id:owner.id,access_token:'synthetic-token'};
  const status = {nodes:[{id:'n',botId:bot.id,name:bot.name,status:'waiting'}]};
  createRoot(document.getElementById('root')).render(React.createElement('div',{style:{display:'flex',minHeight:'100dvh'}},
    React.createElement('section',{id:'bots-panel',className:'home-panel bots-panel',style:{flex:1}},
      React.createElement(BotHome,{bot,session,api,status,rooms:[],participants:[owner,bot],opening:false,onDirect:()=>{}})),
    React.createElement('p',{id:'inline',style:{position:'fixed',right:16,bottom:16,margin:0}},
      React.createElement(Loading,{size:'sm',label:'inline'}))));
</script></body></html>`;

const server = await createServer({
  configFile: false, root: path.join(packageRoot, 'web'), cacheDir: path.join(temporary, 'vite-cache'), plugins: [tailwindcss(), {
    name: 'loading-fixture', configureServer(vite) {
      vite.middlewares.use(async (request, response, next) => {
        if (request.url.split('?')[0] !== '/__loading' || request.url.includes('html-proxy')) return next();
        response.setHeader('Content-Type', 'text/html');
        response.end(await vite.transformIndexHtml('/__loading', html));
      });
    },
  }], server: { host: '127.0.0.1', port: 0 }, logLevel: 'error',
  optimizeDeps: { include: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client'] },
});
let browser;
try {
  await server.listen(); browser = await chromium.launch();
  const url = `http://127.0.0.1:${server.httpServer.address().port}/__loading`;
  const views = [
    { name: 'zh-light', locale: 'zh-CN', colorScheme: 'light', width: 900, label: '正在读取 Bot 设置…' },
    { name: 'zh-dark', locale: 'zh-CN', colorScheme: 'dark', width: 900, label: '正在读取 Bot 设置…' },
    { name: 'en-dark', locale: 'en-US', colorScheme: 'dark', width: 900, label: 'Loading Bot settings…' },
    { name: 'zh-light-mobile', locale: 'zh-CN', colorScheme: 'light', width: 390, label: '正在读取 Bot 设置…' },
  ];
  for (const view of views) {
    const context = await browser.newContext({ locale: view.locale, colorScheme: view.colorScheme, viewport: { width: view.width, height: 560 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.goto(url);
    const loading = page.locator('#bots-panel .ds-loading');
    await loading.waitFor();
    // The old words are gone from sight but still read out.
    assert.equal(await loading.getAttribute('role'), 'status');
    assert.equal(await loading.locator('.ds-loading-label').textContent(), view.label);
    assert.ok((await loading.locator('.ds-loading-label').boundingBox()).width <= 1, 'the label is for screen readers only');
    assert.equal(await page.locator('#bots-panel p[role="status"]').count(), 0, 'no plain loading text is left');
    const names = await page.evaluate(() => document.getAnimations().map(animation => animation.animationName).sort());
    for (const name of ['ds-loading-whale', 'ds-loading-human', 'ds-loading-whale-eyes', 'ds-loading-human-eyes']) assert.ok(names.includes(name), `${name} runs`);
    // Stop the loop at the same moment each time: the whale half way round the bubble.
    await page.evaluate(() => document.getAnimations().forEach(animation => { animation.pause(); animation.currentTime = animation.animationName === 'ds-loading-in' ? 400 : 560; }));
    const file = path.join(output, `loading-${view.name}.png`);
    await page.screenshot({ path: file });
    report.screenshots.push(path.relative(packageRoot, file));
    await context.close();
  }
  report.checks.push('labelKeptForScreenReadersAndAnimationRunsInBothLanguagesAndThemes');

  const still = await browser.newContext({ locale: 'zh-CN', colorScheme: 'light', reducedMotion: 'reduce', viewport: { width: 900, height: 560 }, deviceScaleFactor: 2 });
  const page = await still.newPage();
  await page.goto(url);
  await page.locator('#bots-panel .ds-loading').waitFor();
  assert.deepEqual(await page.evaluate(() => document.getAnimations().map(animation => animation.animationName)), [], 'reduced motion stops every loading animation');
  // Standing still, it is the mark as drawn.
  const offsets = await page.locator('#bots-panel .ds-loading-whale, #bots-panel .ds-loading-human').evaluateAll(nodes => nodes.map(node => getComputedStyle(node).transform));
  assert.deepEqual(offsets, ['none', 'none']);
  const file = path.join(output, 'loading-zh-light-reduced-motion.png');
  await page.screenshot({ path: file });
  report.screenshots.push(path.relative(packageRoot, file));
  await still.close();
  report.checks.push('reducedMotionShowsTheStillMark');
  report.status = 'passed';
} finally {
  await writeFile(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  await browser?.close();
  await server.close();
  await rm(temporary, { recursive: true, force: true });
}
