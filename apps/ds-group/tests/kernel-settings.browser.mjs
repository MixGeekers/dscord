import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { chromium } from 'playwright';
import { packageRoot } from '../src/paths.mjs';
import { CHAT, connectFixture } from './fixtures/connect.mjs';
import { DecisionSettings } from '../dsh-connect/decision-settings.mjs';
import { createDecisionProvider } from '../src/decision-provider.mjs';
import { KernelUpdates } from '../dsh-connect/kernel-updates.mjs';

const temporary = await mkdtemp(path.join(os.tmpdir(), 'dscord-kernel-ui-'));
const output = path.join(packageRoot, '.local/kernel-settings-browser');
await mkdir(output, { recursive: true });
const checks = [];
const errors = [];
const report = { status: 'failed', level: 'real-chromium-web-fixture-and-actual-dsh-controller-with-real-central-and-synthetic-kernel', modelCalls: 0, checks, errors, screenshots: [] };
const style = `<meta name="viewport" content="width=device-width, initial-scale=1"><script src="/theme.js"></script><link rel="stylesheet" href="/tokens.css"><link rel="stylesheet" href="/@fs/${packageRoot}/ui/tailwind.css"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/@fs/${packageRoot}/ui/styles.css">`;
const webHtml = `<!doctype html><html><head>${style}</head><body><div id="root"></div><script type="module">
  import React from 'react'; import { createRoot } from 'react-dom/client';
  import { MyBotsDialog } from '/src/components/MyBotsDialog.tsx';
  import { BotHome } from '/src/components/BotHome.tsx';
  import { MemberDialog } from '/src/components/BasicDialogs.tsx';
  import { ApiError } from '/src/api.ts';
  import { setLocalePreference } from '/i18n.js';
  const owner = {id:'@alice:home.test',name:'Alice',kind:'human'};
  const bot = {id:'@helper:home.test',name:'Shiyu',kind:'bot',ownerId:owner.id,nativeBinding:{hostId:'node-a',nativeBotId:'local-shiyu',botId:'@helper:home.test'}};
  const person = {id:'@bob:home.test',name:'Bob',kind:'human'};
  const planner = {id:'@planner:home.test',name:'Planner',kind:'bot'};
  const room = {roomId:'!project:home.test',name:'Garden project',kind:'group',participantIds:[owner.id,bot.id,person.id]};
  const fixture = window.fixture = {calls:[],offline:false,failSave:false,direct:[],mode:'natural',desired:null};
  const source = {id:'source-2',revision:2,authorId:person.id,authorKind:'human',eventId:'$updated-plan',roomId:room.roomId,timestamp:1793898000000};
  const claim = {id:'claim-1',revision:2,text:'Bob proposed planting herbs on Saturday.',claimState:'proposal',kind:'reported',saidBy:owner.id,scope:'room:'+room.roomId,sources:[source],sourceRefs:[{id:source.id,revision:2}],conflicts:['claim-conflicting-date']};
  const at = 1793898000000;
  const timeline = [
    {id:'request:$ask',kind:'request',at:at+4000,roomId:room.roomId,peerId:person.id,status:'running',text:'Can we plant herbs on Saturday?'},
    {id:'decision:d1',kind:'decision',at:at+3000,roomId:room.roomId,peerId:person.id,action:'SPEAK',status:'decided',outcome:'delivered'},
    {id:'task:task-1:1',kind:'task',at:at+2000,taskId:'task-1',title:'Plan the herb bed',from:'queued',to:'running',by:'core',roomId:room.roomId,peerId:owner.id},
    {id:'exchange:task-1>planner',kind:'exchange',at:at+1000,direction:'out',peerId:planner.id,roomId:room.roomId,status:'returned',taskId:'task-1',detail:'Asked for a planting calendar'},
  ];
  const earlier = {id:'task:task-0:0',kind:'task',at:at-60000,taskId:'task-0',title:'Measure the bed',from:null,to:'done',by:'core',roomId:room.roomId,peerId:owner.id};
  const offline = () => { if (fixture.offline) throw new ApiError('Connect this Bot before reading its memory', 503, 0, 'BOT_OFFLINE'); };
  const api = async (route, options={}) => {
    fixture.calls.push({route,method:options.method,body:options.body,timeout:options.timeout});
    const url = new URL(route,'http://fixture.test');
    if(route.endsWith('/kernel')) return {runtime:{id:fixture.offline?null:'dscord-kernel',version:fixture.offline?null:'0.4.0',available:!fixture.offline},online:!fixture.offline,updatedAt:Date.now(),desiredAttention:fixture.desired,
      attention:fixture.offline?{mode:fixture.desired?.mode??null,activity:null,provider:{configured:null,available:null,model:null},queue:null,lastDecision:null}:{mode:fixture.mode,activity:'waiting',provider:{configured:true,available:null,health:'unknown',model:'participation-model'},queue:{pending:2,waiting:1,evaluating:0,errors:0},lastDecision:{action:'SPEAK',at:at+3000,outcome:'delivered'}},
      responder:fixture.offline?null:{state:'replying',roomId:room.roomId,requesterId:person.id,since:at+4000},
      work:{status:fixture.offline?'unknown':'waiting',activeTasks:fixture.offline?null:1,waiting:fixture.offline?null:1,
        workers:fixture.offline?[]:[{taskId:'task-1',title:'Plan the herb bed',stage:'running',roomId:room.roomId,requesterId:owner.id,doing:{tool:'read',target:'garden.md'},since:new Date(at+2000).toISOString(),toolCalls:3}],
        queue:fixture.offline?[]:[{taskId:'task-2',title:'Order seeds',stage:'queued',requesterId:owner.id}]}};
    if(route.endsWith('/attention')) {if(fixture.failSave)throw new Error('Synthetic uncertain save'); fixture.desired={mode:options.body.mode,revision:1,status:'pending',applied:false,online:!fixture.offline};return fixture.desired;}
    if(url.pathname.endsWith('/timeline')) { offline(); return url.searchParams.has('before') ? {items:[earlier],next:null} : {items:timeline,next:timeline.at(-1).at}; }
    if(url.pathname.endsWith('/contacts')) { offline(); const contact=url.searchParams.get('contact');
      const exchanges=[{id:'task-1>planner',at:at+1000,direction:'out',peerId:planner.id,roomId:room.roomId,status:'returned',taskId:'task-1',detail:'Asked for a planting calendar'},{id:'in:$bob',at:at,direction:'in',peerId:person.id,roomId:room.roomId,status:'received'}];
      return {contacts:[{...person,rooms:[room.roomId],lastExchangeAt:at},{...planner,reach:'matrix',rooms:[room.roomId],lastExchangeAt:at+1000}],exchanges:exchanges.filter(exchange=>!contact||exchange.peerId===contact),next:null}; }
    if(url.pathname.endsWith('/memory/changes')) { offline(); return {rows:[{id:'c1',time:new Date(at).toISOString(),op:'add',scope:'own',text:'Bob prefers herbs.',by:'Shiyu'}],more:null}; }
    if(route.includes('/memory/profile')) {
      if(fixture.holdMemory) await new Promise(resolve=>{fixture.releaseMemory=resolve;});
      const kind=url.searchParams.get('kind');const id=url.searchParams.get('id');
      if(!id)return {kind,items:[{id:kind==='person'?person.id:'project:garden',name:kind==='person'?'Bob':'Garden',kind,currentCount:1,historyCount:1,scopes:['room:'+room.roomId]}],more:false};
      return {kind,id,identity:{id,name:kind==='person'?'Bob':'Garden',kind},view:{currentClaims:[claim],preferences:[],projectFacts:[],changes:[{...claim,id:'claim-old',text:'The old draft said Friday.',claimState:'statement',kind:'legacy',derivation:'superseded',conflicts:[]}],recentSources:[source],historyGaps:[]}};
    }
    throw new Error('Unexpected fixture route '+route);
  };
  const status = {nodes:[{id:'n',botId:bot.id,name:bot.name,status:'waiting'}]};
  function Fixture(){const [open,setOpen]=React.useState(true);const [member,setMember]=React.useState(null);const [user,setUser]=React.useState(owner.id);const [home,setHome]=React.useState(null);
    fixture.locale=setLocalePreference;fixture.switchUser=setUser;fixture.closeHome=()=>setHome(null);
    const session={user_id:user,access_token:'synthetic-token'};
    return React.createElement(React.Fragment,null,
      React.createElement('button',{id:'open-profile',onClick:()=>setMember(bot)},'Profile'),
      React.createElement('button',{id:'open-bots',onClick:()=>setOpen(true)},'Bots'),
      React.createElement(MyBotsDialog,{open,bots:[bot],status,session,server:'https://home.test',onClose:()=>setOpen(false),onCreate:()=>{},onHome:id=>{setOpen(false);setHome(id);},onDirect:id=>fixture.direct.push(id)}),
      home && React.createElement('section',{id:'bots-panel',className:'home-panel bots-panel'},React.createElement(BotHome,{key:home,bot,session,api,status,rooms:[room],participants:[owner,person,bot,planner],opening:false,onDirect:id=>fixture.direct.push(id)})),
      React.createElement(MemberDialog,{member,session,room,roles:[],botStatus:'waiting',owner,onClose:()=>setMember(null),onDirect:()=>{},onMention:()=>{},onManageBot:id=>{setMember(null);setHome(id);}}));
  }createRoot(document.getElementById('root')).render(React.createElement(Fixture));
</script></body></html>`;
const dshHtml = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;height:100dvh"><div id="root" style="height:100%"></div><script type="module">
  import React from 'react';import * as JsxRuntime from 'react/jsx-runtime';import {createRoot} from 'react-dom/client';
  let descriptor;window.__ModuleLoader__={load:value=>{descriptor=value;}};
  await import('/@fs/${packageRoot}/dsh-connect/client.js');
  const listeners=new Set();const dictionaries=new Map();let language='en';let main;const cleanup=[];
  const locale={register:(id,value)=>{dictionaries.set(id,value);},bind:id=>(key,params={})=>{const text=dictionaries.get(id)?.[language]?.[key]||key;return text.replace(/\\{(\\w+)\\}/g,(m,k)=>params[k]??m);}};
  const modules={react:React,'react/jsx-runtime':JsxRuntime,'react-dom':{createPortal:element=>element}};
  const plugin=descriptor.factory(name=>{if(!modules[name])throw new Error('The page asked DSH for '+name);return modules[name];});
  plugin.apply({locale,effect:fn=>cleanup.push(fn()),slots:{inject:(_n,fn)=>fn(),register:(options,component)=>{if(options.name==='main')main={options,component};return ()=>{};}},layout:{selectPanel:()=>{}}});
  const root=createRoot(document.getElementById('root'));const connection=main.options.inject().connection;
  window.fixture={connection,locale:value=>{language=value;render();}};
  function render(){root.render(React.createElement(main.component,{connection,t:locale.bind(main.options.locale)}));}render();
</script></body></html>`;

const server = await createServer({
  configFile: false, root: path.join(packageRoot, 'web'), cacheDir: path.join(temporary, 'vite-cache'), plugins: [tailwindcss(), {
    name: 'kernel-settings-fixture', configureServer(vite) {
      vite.middlewares.use(async (request, response, next) => {
        const route = request.url.split('?')[0];
        if (!['/__kernel', '/__native'].includes(route) || request.url.includes('html-proxy')) return next();
        response.setHeader('Content-Type', 'text/html');
        response.end(await vite.transformIndexHtml(route, route === '/__kernel' ? webHtml : dshHtml));
      });
    },
  }], server: { host: '127.0.0.1', port: 0 }, logLevel: 'error',
  // The DSH client's modules are known up front, so a late dependency discovery cannot reload the page mid-test.
  optimizeDeps: { include: ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client'] },
});
let browser;
let page;
let f;
let reporting;
let updates;
async function screenshot(name) { const filename = path.join(output, name); await page.screenshot({ path: filename, animations: 'disabled' }); report.screenshots.push(filename); }
try {
  await server.listen(); browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1120, height: 850 }, locale: 'en-US' });
  context.setDefaultTimeout(10000);
  await context.addInitScript(() => { localStorage.setItem('ds-group.language', 'en'); localStorage.setItem('ds-group.theme', 'dark'); });
  page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  await page.goto(`${origin}/__kernel`);
  await page.locator('[data-bot-home-button]').click();
  await page.locator('[data-bot-home] [data-activity="waiting"]').waitFor();
  const now = page.locator('[data-bot-panel="now"]');
  assert.match(await now.innerText(), /Alice/);
  assert.match(await now.innerText(), /normal state/);
  assert.match(await page.locator('[data-bot-responder="replying"]').innerText(), /Replying to Bob in Garden project/);
  assert.match(await page.locator('[data-task-id="task-1"]').innerText(), /Plan the herb bed[\s\S]*Asked by Alice[\s\S]*3 tool calls[\s\S]*Doing: read garden\.md/);
  assert.match(await page.locator('[data-task-id="task-2"]').innerText(), /Order seeds/);
  assert.match(await now.innerText(), /Decided to speak/);
  assert.equal(await page.getByRole('alert').count(), 0);
  assert.match(await page.locator('.bot-home-header').innerText(), /@helper:home.test/);
  checks.push('statusPageShowsResponderWorkersQueueDecisionAndOwner');
  await screenshot('bot-home-now-dark-en.png');
  await page.locator('[data-bot-direct]').click();
  assert.deepEqual(await page.evaluate(() => window.fixture.direct), ['@helper:home.test']);
  checks.push('statusPageOpensTheDirectConversation');
  await page.locator('[data-bot-tab="settings"]').click();
  assert.equal(await page.getByRole('radio', { name: /Join naturally/ }).isChecked(), true);
  assert.equal(await page.locator('input[type="password"]').count(), 0);
  await page.getByRole('radio', { name: /Observe quietly/ }).check();
  await page.locator('#save-bot-participation').click();
  await page.getByRole('status').filter({ hasText: 'Saved. The node' }).first().waitFor();
  assert.equal(await page.locator('#save-bot-participation').isDisabled(), true);
  const patch = await page.evaluate(() => window.fixture.calls.find(call => call.method === 'PATCH'));
  assert.deepEqual(patch.body, { mode: 'shadow' });
  assert.equal(patch.route, '/api/bots/%40helper%3Ahome.test/attention');
  checks.push('ownerModeSaveUsesRealContractAndKeepsPendingDistinctFromApplied');
  await screenshot('bot-participation-dark-en.png');
  await page.evaluate(() => { window.fixture.failSave = true; });
  await page.getByRole('radio', { name: /When mentioned/ }).check();
  await page.locator('#save-bot-participation').click();
  await page.getByRole('status').filter({ hasText: 'not confirmed' }).waitFor();
  assert.equal(await page.getByRole('radio', { name: /When mentioned/ }).isDisabled(), true);
  checks.push('uncertainSaveLocksFurtherWritesUntilRefreshed');
  await page.locator('[data-bot-tab="timeline"]').click();
  const request = page.locator('[data-bot-panel="timeline"] [data-kind="request"]');
  await request.waitFor();
  assert.match(await request.innerText(), /Bob asked[\s\S]*Garden project[\s\S]*Can we plant herbs on Saturday\?/);
  assert.match(await page.locator('[data-bot-panel="timeline"]').innerText(), /Participation: Decided to speak[\s\S]*Task “Plan the herb bed”: running[\s\S]*Asked Planner/);
  await page.locator('[data-load-more="timeline"]').click();
  await page.locator('[data-bot-panel="timeline"]').getByText('Task “Measure the bed”: done').waitFor();
  assert.equal(await page.locator('[data-bot-panel="timeline"] .bot-timeline-item').count(), 5);
  assert.ok(await page.evaluate(() => window.fixture.calls.some(call => call.route.endsWith('/timeline?before=1793898001000'))));
  checks.push('timelineShowsOriginalWordsAllEventKindsAndPagesEarlier');
  await screenshot('bot-timeline-dark-en.png');
  await page.locator('[data-bot-tab="conversations"]').click();
  await page.locator('[data-contact-id="@planner:home.test"]').click();
  await page.locator('[data-bot-panel="conversations"]').getByText('Asked for a planting calendar').waitFor();
  assert.ok(await page.evaluate(() => window.fixture.calls.some(call => call.route.endsWith('/contacts?contact=%40planner%3Ahome.test'))));
  assert.doesNotMatch(await page.locator('[data-bot-panel="conversations"] .bot-timeline').innerText(), /Bob asked/);
  checks.push('conversationsListContactsAndFilterExchangesByContact');
  await page.locator('[data-bot-tab="memory"]').click();
  await page.locator('[data-memory-profile="@bob:home.test"]').click();
  await page.locator('[data-memory-record="claim-1"]').waitFor();
  const record = page.locator('[data-memory-record="claim-1"]');
  assert.match(await record.innerText(), /Proposal/); assert.match(await record.innerText(), /Reported by someone else/); assert.match(await record.innerText(), /Unresolved conflict/);
  await record.locator('summary').click();
  assert.match(await record.innerText(), /Bob/); assert.match(await record.innerText(), /Garden project/); assert.match(await record.innerText(), /\$updated-plan/);
  assert.match(await page.locator('.bot-memory-profile').innerText(), /not presented as current facts/);
  assert.equal(await page.evaluate(() => window.fixture.calls.find(call => call.route.includes('/memory/profile')).timeout), 20000);
  assert.match(await page.locator('[data-bot-memory-changes]').innerText(), /Added Bob prefers herbs\.[\s\S]*by Shiyu/);
  checks.push('memoryKeepsOriginalSourcesReportedClaimsConflictsHistoricalChangesAndRecentEdits');
  await screenshot('bot-memory-dark-en.png');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { window.fixture.locale('zh-CN'); window.DSGroupTheme.setPreference('light'); });
  await page.locator('[data-bot-tab="settings"]', { hasText: '设置' }).waitFor();
  const overflow = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth, home: document.querySelector('[data-bot-home]').getBoundingClientRect().right }));
  assert.ok(overflow.page <= overflow.viewport + 1 && overflow.home <= overflow.viewport + 1, JSON.stringify(overflow));
  await screenshot('bot-memory-light-zh-mobile.png');
  checks.push('mobileLightThemeAndChineseKeepStatusPageInsideViewport');
  await page.locator('[data-bot-tab="now"]').click();
  await page.evaluate(() => { window.fixture.offline = true; window.fixture.failSave = false; });
  await page.getByRole('button', { name: '刷新', exact: true }).click();
  await page.locator('[data-bot-home] [data-activity="unknown"]').waitFor();
  assert.match(await page.locator('[data-bot-responder]').innerText(), /离线/);
  assert.match(await page.locator('.bot-home-header').innerText(), /离线/);
  await page.locator('[data-bot-tab="timeline"]').click();
  await page.locator('[data-bot-panel="timeline"]').getByRole('alert').filter({ hasText: '连上 Bot 后才能查看' }).waitFor();
  await page.locator('[data-bot-tab="settings"]').click();
  assert.doesNotMatch(await page.locator('.bot-decision-status').innerText(), /未配置/);
  assert.match(await page.locator('[data-bot-panel="participation"]').innerText(), /当前参与方式 · 未知/);
  await page.getByRole('radio', { name: /自然参与/ }).check();
  await page.locator('#save-bot-participation').click();
  await page.getByRole('status').filter({ hasText: '下次同步' }).first().waitFor();
  checks.push('offlineActivityStaysUnknownHistoryExplainsWhereItLivesAndDesiredModeCanBeSaved');
  await page.evaluate(() => window.fixture.closeHome());
  await page.locator('[data-bot-home]').waitFor({ state: 'detached' });
  await page.locator('#open-profile').click();
  assert.match(await page.locator('.bot-profile-owner').innerText(), /Alice/);
  await page.locator('#member-bot-home').click();
  await page.locator('[data-bot-home]').waitFor();
  checks.push('memberProfileShowsOwnerAndOpensOwnedBotStatusPage');
  await page.locator('[data-bot-tab="memory"]').click();
  await page.evaluate(() => { window.fixture.holdMemory = true; });
  await page.locator('[data-memory-profile]').click();
  await page.waitForFunction(() => !!window.fixture.releaseMemory);
  await page.evaluate(() => { window.fixture.switchUser('@bob:home.test'); window.fixture.releaseMemory(); });
  await page.locator('[data-bot-home]').waitFor({ state: 'detached' });
  assert.equal(await page.locator('[data-memory-record]').count(), 0);
  checks.push('lateMemoryReadCannotPublishIntoAnotherOwnersAccount');

  // The DSH panel links this DSH and shows what it runs. The Bots are set up on the web page, at the central
  // server; here the real controller follows a real central server, with a synthetic kernel underneath.
  const nativeRequests = [];
  await mkdir(path.join(temporary, 'decision'), { recursive: true });
  // A synthetic decision service: it refuses every key but one, and answers as the model it was asked for.
  const decisionCalls = [];
  const decisionFetch = async (url, options) => {
    const body = JSON.parse(options.body); decisionCalls.push({ url, model: body.model });
    const systemone = !Array.isArray(body.questions);
    const cf = url.includes('api.cloudflare.com');
    const expectedKey = cf ? 'synthetic-cloudflare-key' : systemone ? 'synthetic-jev-key' : 'synthetic-decision-key';
    if (options.headers.Authorization !== `Bearer ${expectedKey}`) return new Response('{}', { status: 401 });
    const name = systemone ? Object.keys(body.questions)[0] : body.questions[0].name;
    const choice = name === 'participation' ? 'SPEAK' : 'REPLY';
    const choices = systemone ? Object.keys(body.questions[name].criteria) : body.questions[0].choices.map(item => item.value);
    const probabilities = Object.fromEntries(choices.map(value => [value, value === choice ? 0.9 : 0.05]));
    if (systemone) {
      assert.ok(body.state.self);
      assert.equal(body.prompt_cache_options, undefined);
      const result = { model: body.model, answers: { [name]: { type: 'choice', choice, confidence: 0.9, probabilities } }, usage: { input_tokens: 42, output_tokens: 7 } };
      return Response.json(cf ? { success: true, result, errors: [], messages: [] } : result);
    }
    return Response.json({ model: body.model, answers: [{ name, type: 'choice', choice, confidence: 0.9,
      probabilities: Object.entries(probabilities).map(([value, probability]) => ({ value, probability })) }] });
  };
  const decisionSettings = await new DecisionSettings({ directory: path.join(temporary, 'decision'), environment: {},
    providerFactory: options => createDecisionProvider({ ...options, fetchImpl: decisionFetch }) }).initialize();
  // A synthetic registry: the plugin runs 0.4.0 and a newer release speaks the same protocol.
  const pluginManager = { listBundles: () => [{ name: 'dscord', source: '^0.4.0' }], registries: () => ({ registry: 'https://registry.test/' }),
    installBundle: async () => ({ application: 'restart-required' }) };
  const releases = { versions: Object.fromEntries(['0.4.0', '0.5.0'].map(version => [version, { dscord: { protocol: { min: '1.0', max: '1.0' } } }])) };
  updates = await new KernelUpdates({ ctx: { get: name => ({ pluginManager })[name] }, directory: path.join(temporary, 'updates'), current: '0.4.0',
    currentRange: { min: '1.0', max: '1.0' }, startTimers: false, fetchImpl: async () => new Response(JSON.stringify(releases)) }).initialize();
  updates.observeProtocol('1.0');
  await updates.check({ fresh: true });
  f = await connectFixture({ updates, processes: {
    kernelState: async () => ({ runtime: { id: 'dscord-kernel', available: true }, decisionProvider: decisionSettings.publicStatus(), decisionForm: decisionSettings.form() }),
    saveDecisionProvider: async settings => { await decisionSettings.save(settings); return decisionSettings.verify(); },
    decisionStatus: () => decisionSettings.publicStatus(),
  } });
  await page.route('**/api/dscord', async route => {
    const body = route.request().postDataJSON(); nativeRequests.push({ ...body, ...(body.apiKey ? { apiKey: '[redacted synthetic test key]' } : {}) });
    try {
      const value = await f.controller.handle(body);
      await route.fulfill({ json: { ok: true, value } });
    } catch (error) {
      await route.fulfill({ json: { ok: false, error: { code: error.code, message: error.message } } });
    }
  });
  // DSH reports every few seconds; the test does not wait that long.
  reporting = setInterval(() => void f.controller.synchronize().catch(() => {}), 300);
  const step = () => page.locator('.dc-step[aria-current="step"]').innerText().then(text => text.split('\n')[1]);
  // The same view in the other language and theme, for the people who read the screenshots.
  const alsoChinese = async name => {
    await page.evaluate(() => { window.fixture.locale('zh'); document.body.removeAttribute('data-ds-dark-theme'); });
    await page.getByRole('region', { name: '决策模型' }).waitFor();
    await screenshot(name);
    await page.evaluate(() => { window.fixture.locale('en'); document.body.setAttribute('data-ds-dark-theme', ''); });
    await page.getByRole('region', { name: 'Decision model' }).waitFor();
  };
  await page.setViewportSize({ width: 1000, height: 900 });
  await page.goto(`${origin}/__native`);
  await page.evaluate(() => document.body.setAttribute('data-ds-dark-theme', ''));
  await page.getByLabel('Connection key', { exact: true }).waitFor();
  assert.equal(await step(), 'Connect your account');
  await screenshot('panel-link-dark-en.png');
  // Pasting the key copied from the web page links at once.
  const key = await f.key();
  await page.getByLabel('Connection key', { exact: true }).evaluate((element, text) => {
    const data = new DataTransfer(); data.setData('text', text);
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  }, key);
  await page.getByText('No Bots yet. Choose “Add a Bot” on the DSCord web page', { exact: false }).waitFor();
  // The decision model is the next step, with its own panel ahead of the Bots: what it is for, what is lost without it, and the form.
  assert.equal(await step(), 'Set up the decision model');
  const decision = page.getByRole('region', { name: 'Decision model' });
  assert.equal(await decision.getAttribute('data-state'), 'missing');
  assert.match(await decision.innerText(), /Not set up[\s\S]*Without it, Bots answer only when mentioned[\s\S]*Choose a service/);
  assert.deepEqual([await decision.getByLabel('Decision model name', { exact: true }).inputValue(), await decision.getByLabel('Service address', { exact: true }).inputValue()],
    ['gpt-6-luna', 'https://api.openai.com/v1/decisions']);
  assert.ok(await page.evaluate(() => { const [first, second] = [...document.querySelectorAll('.dc-decision, [aria-label="Bots this device runs"]')]; return first.matches('.dc-decision') && Boolean(second); }));
  assert.deepEqual(nativeRequests.filter(item => item.action === 'login').map(item => Object.keys(item)), [['action', 'key']]);
  assert.equal(await page.getByRole('link', { name: 'Open DSCord on the web' }).first().getAttribute('href'), `${CHAT}/`);
  assert.equal(await page.getByRole('region', { name: 'Bots this device runs' }).locator('input, select, textarea, button').count(), 0, 'nothing about a Bot is set here');
  checks.push('pastingTheConnectionKeyLinksDshAndThePanelPointsToTheWebPageForBots');
  await screenshot('panel-linked-dark-en.png');
  await alsoChinese('panel-decision-missing-light-zh.png');
  // A Bot the owner adds on the web page appears and goes online with no step here.
  const bot = await f.createBot({ displayName: 'Shiyu', role: 'A friend and project partner', model: 'fixture/large', servers: [CHAT] });
  const card = page.getByRole('listitem', { name: 'Shiyu', exact: true });
  await card.locator('[data-status="online"]').waitFor();
  assert.match(await card.innerText(), new RegExp(`${bot.globalId}[\\s\\S]*fixture/large[\\s\\S]*chat\\.example[\\s\\S]*Online`));
  assert.equal(await step(), 'Set up the decision model', 'a Bot that is online without its decision model is not finished');
  assert.equal((await f.api('GET', '/api/devices', { token: f.alice })).devices[0].decision.configured, false, 'the owner\'s web page is told');
  assert.deepEqual(f.locals.map(local => [local.name, local.role, local.model]), [['Shiyu', 'A friend and project partner', 'fixture/large']]);
  assert.deepEqual(nativeRequests.map(item => item.action).filter(action => !['status', 'kernel-state', 'kernel-update-status', 'sync', 'login'].includes(action)), []);
  checks.push('aBotAddedOnTheWebPageAppearsOnTheDeviceAndGoesOnlineWithoutAnyPanelStep');
  await screenshot('panel-bot-online-dark-en.png');
  // Taken off the server on the web page, the card says where to put it back.
  await f.api('PATCH', `/api/bots/${bot.id}`, { token: f.alice, body: { servers: [] } });
  await card.getByText('Not on any chat server yet.', { exact: false }).waitFor();
  await f.api('PATCH', `/api/bots/${bot.id}`, { token: f.alice, body: { servers: [CHAT], displayName: '诗雨' } });
  const renamed = page.getByRole('listitem', { name: '诗雨', exact: true });
  await renamed.locator('[data-status="online"]').waitFor();
  checks.push('thePanelFollowsChangesMadeOnTheWebPage');
  // Saving asks the service at once. A key it refuses is said so, with what to check, and the form stays in reach.
  const keyField = decision.getByLabel('Decision model API key', { exact: true });
  const save = decision.getByRole('button', { name: 'Save and check', exact: true });
  await keyField.fill('synthetic-wrong-key');
  await save.click();
  await decision.getByRole('alert').filter({ hasText: 'The service refused this key (ATTENTION_HTTP_401)' }).waitFor();
  assert.equal(await decision.getAttribute('data-state'), 'failed');
  assert.match(await decision.locator('.dc-status').innerText(), /Check failed/);
  assert.equal(await keyField.inputValue(), '');
  assert.equal(await step(), 'Set up the decision model');
  checks.push('aRefusedDecisionKeyIsReportedAtOnceWithWhatToCheck');
  await decision.scrollIntoViewIfNeeded();
  await screenshot('panel-decision-failed-dark-en.png');
  await alsoChinese('panel-decision-failed-light-zh.png');
  // A wrong address is refused before anything is saved, in the page's language.
  await decision.getByLabel('Service address', { exact: true }).fill('ftp://decision.example');
  await save.click();
  await decision.getByRole('alert').filter({ hasText: 'The address must start with http:// or https://' }).waitFor();
  assert.equal(await decision.getByLabel('Service address', { exact: true }).inputValue(), 'ftp://decision.example', 'what was typed stays to be corrected');
  // The right key and the owner's own model: the status turns real and the guide is done.
  await decision.getByLabel('Service address', { exact: true }).fill('https://decision.example/v2/decisions');
  await decision.getByLabel('Decision model name', { exact: true }).fill('company/decision-v2');
  await keyField.fill('synthetic-decision-key');
  await save.click();
  await decision.getByRole('status').filter({ hasText: 'Saved. The decision model is working.' }).waitFor();
  assert.equal(await decision.getAttribute('data-state'), 'ready');
  assert.equal(await decision.locator('.dc-status').innerText(), 'Working · company/decision-v2');
  assert.deepEqual(decisionCalls.at(-1), { url: 'https://decision.example/v2/decisions', model: 'company/decision-v2' });
  assert.equal(await decision.locator('form').isVisible(), false, 'a working model keeps its form folded away');
  assert.equal(await page.locator('.dc-step').count(), 0, 'the guide is done once the decision model works and a Bot is online');
  assert.equal(await page.evaluate(() => JSON.stringify(window.fixture.connection.getSnapshot()).includes('synthetic-decision-key')), false);
  assert.equal((await page.locator('body').innerText()).includes('synthetic-decision-key'), false);
  const reported = (await f.api('GET', '/api/devices', { token: f.alice })).devices[0].decision;
  assert.equal(JSON.stringify(reported).includes('decision.example'), false, 'the address stays on the device');
  checks.push('decisionCredentialIsSubmitOnlyAndNeverReadBackOrStoredInConnectionSnapshot');
  checks.push('aWorkingDecisionModelCompletesTheGuideAndFoldsItsForm');
  await screenshot('panel-decision-ready-dark-en.png');
  await decision.locator('summary').click();
  assert.equal(await decision.getByLabel('Decision model name', { exact: true }).inputValue(), 'company/decision-v2');
  await alsoChinese('panel-decision-edit-light-zh.png');
  const decisionShot = async name => {
    const filename = path.join(output, name);
    const viewport = page.viewportSize();
    // Fit the complete form so the page's sticky connection notice cannot cover its heading.
    await page.setViewportSize({ ...viewport, height: 1600 });
    await page.locator('.dscord-connect').evaluate(element => element.scrollTo(0, 0));
    await page.locator('.dc-decision').screenshot({ path: filename, animations: 'disabled' }); report.screenshots.push(filename);
    await page.setViewportSize(viewport);
  };
  const revealDecision = async () => {
    const panel = page.locator('.dc-decision');
    if (!await panel.locator('form').isVisible()) await panel.locator('summary').click();
    await panel.locator('form').waitFor();
  };
  await decision.getByLabel('Service preset', { exact: true }).selectOption('typesafe-jev');
  assert.equal(await decision.getByLabel('Decision model name', { exact: true }).inputValue(), 'jev-1.14.0');
  assert.equal(await decision.getByLabel('Service address', { exact: true }).inputValue(), 'https://api.typesafe.ai/v1/systemone');
  assert.equal(await keyField.inputValue(), '');
  assert.equal(await keyField.getAttribute('required'), '', 'the old OpenAI credential is not reused');
  await keyField.fill('synthetic-jev-key');
  await save.click();
  await decision.getByRole('status').filter({ hasText: 'Saved. The decision model is working.' }).waitFor();
  assert.equal(await decision.locator('.dc-status').innerText(), 'Working · jev-1.14.0');
  await decision.locator('summary').click();
  await decisionShot('decision-jev-dark-en.png');
  await page.evaluate(() => { window.fixture.locale('zh'); document.body.removeAttribute('data-ds-dark-theme'); });
  await revealDecision();
  await page.getByLabel('服务预设', { exact: true }).waitFor();
  await decisionShot('decision-jev-light-zh.png');
  await page.evaluate(() => { window.fixture.locale('en'); document.body.setAttribute('data-ds-dark-theme', ''); });
  await revealDecision();
  await decision.getByLabel('Service preset', { exact: true }).selectOption('cloudflare-clef');
  assert.equal(await keyField.getAttribute('required'), '');
  const accountId = '0123456789abcdef0123456789abcdef';
  await decision.getByLabel('Cloudflare Account ID', { exact: true }).fill(accountId);
  assert.equal(await decision.getByLabel('Service address', { exact: true }).inputValue(), `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/cloudflare/clef`);
  await decision.getByLabel('Decision model name', { exact: true }).selectOption('clef-flash');
  assert.match(await decision.getByLabel('Service address', { exact: true }).inputValue(), /\/clef-flash$/);
  await keyField.fill('synthetic-cloudflare-key');
  await save.click();
  await decision.getByRole('status').filter({ hasText: 'Saved. The decision model is working.' }).waitFor();
  assert.equal(await decision.locator('.dc-status').innerText(), 'Working · clef-flash');
  await decision.locator('summary').click();
  assert.equal(await keyField.inputValue(), '');
  await decisionShot('decision-clef-dark-en.png');
  await page.evaluate(() => { window.fixture.locale('zh'); document.body.removeAttribute('data-ds-dark-theme'); });
  await revealDecision();
  await page.getByLabel('Cloudflare 账户 ID', { exact: true }).waitFor();
  await decisionShot('decision-clef-light-zh.png');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await decisionShot('decision-clef-light-zh-mobile.png');
  await page.setViewportSize({ width: 1000, height: 900 });
  await page.evaluate(() => { window.fixture.locale('en'); document.body.setAttribute('data-ds-dark-theme', ''); });
  await revealDecision();
  await decision.getByLabel('Service preset', { exact: true }).selectOption('typesafe-jev');
  assert.equal(await keyField.getAttribute('required'), null, 'switching back keeps this service’s credential');
  await save.click();
  await decision.getByRole('status').filter({ hasText: 'Saved. The decision model is working.' }).waitFor();
  await decision.locator('summary').click();
  assert.equal(await keyField.inputValue(), '');
  checks.push('jevAndClefPresetsUseSystemOneAndSeparateCredentialsWithAutomaticCloudflareRouting');
  checks.push('decisionPresetsWorkInChineseEnglishDarkLightAndMobile');
  await decision.locator('summary').click();
  const upgrades = page.getByRole('region', { name: 'Plugin version' });
  await upgrades.getByText('0.5.0 is available', { exact: true }).waitFor();
  await upgrades.locator('summary').click();
  await upgrades.getByText('Upgrade automatically', { exact: true }).click();
  await page.waitForFunction(() => document.querySelector('input[name="kernelUpdatePolicy"][value="auto"]')?.checked);
  assert.equal(updates.view().policy, 'auto');
  await upgrades.getByRole('button', { name: 'Install 0.5.0', exact: true }).click();
  await upgrades.getByText('The new version is installed. Restart DSH to use it.', { exact: true }).waitFor();
  checks.push('ownerSeesCompatiblePluginReleaseSetsUpgradePolicyAndInstallsThroughDshPluginManager');
  await upgrades.scrollIntoViewIfNeeded();
  await screenshot('plugin-version-dark-en.png');
  await page.locator('.dscord-connect').evaluate(element => { element.scrollTop = 0; });
  await page.evaluate(() => { window.fixture.locale('zh'); document.body.removeAttribute('data-ds-dark-theme'); });
  await page.getByRole('region', { name: '这台设备运行的 Bot' }).waitFor();
  await screenshot('panel-bot-online-light-zh.png');
  await page.setViewportSize({ width: 390, height: 844 });
  const nativeBounds = await page.locator('.dscord-connect').evaluate(element => ({ scroll: element.scrollWidth, client: element.clientWidth }));
  assert.ok(nativeBounds.scroll <= nativeBounds.client + 1);
  await screenshot('panel-bot-online-light-zh-mobile.png');
  await page.setViewportSize({ width: 1000, height: 900 });
  // Signing out stops the Bots here and takes this DSH off the owner's device list.
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await page.getByLabel('连接密钥', { exact: true }).waitFor();
  assert.equal(f.live.size, 0);
  assert.deepEqual((await f.api('GET', '/api/devices', { token: f.alice })).devices, []);
  await screenshot('panel-link-light-zh.png');
  checks.push('signingOutStopsTheBotsAndRemovesTheDevice');
  assert.deepEqual(errors, []);
  checks.push('dshNativeSettingsRenderInChineseOnMobileWithoutOverflowOrBrowserErrors');
  report.status = 'passed';
} catch (error) {
  report.error = error.stack ?? String(error);
  if (page) await screenshot('failure.png').catch(() => {});
  throw error;
} finally {
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  clearInterval(reporting);
  await f?.close(); updates?.dispose();
  await browser?.close(); await server.close(); await rm(temporary, { recursive: true, force: true });
  console.log(JSON.stringify(report));
}
