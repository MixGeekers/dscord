import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { chromium } from 'playwright';
import { packageRoot } from '../src/paths.mjs';
import { ConnectController } from '../dsh-connect/controller.mjs';
import { DecisionSettings } from '../dsh-connect/decision-settings.mjs';
import { KernelUpdates } from '../dsh-connect/kernel-updates.mjs';

const temporary = await mkdtemp(path.join(os.tmpdir(), 'dscord-kernel-ui-'));
const output = path.join(packageRoot, '.local/kernel-settings-browser');
await mkdir(output, { recursive: true });
const checks = [];
const errors = [];
const report = { status: 'failed', level: 'real-chromium-web-fixture-and-actual-dsh-controller-with-synthetic-native-runtime', modelCalls: 0, checks, errors, screenshots: [] };
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
      React.createElement(MyBotsDialog,{open,bots:[bot],status,session,onClose:()=>setOpen(false),onCreate:()=>{},onHome:id=>{setOpen(false);setHome(id);},onDirect:id=>fixture.direct.push(id)}),
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
  function Button({variant,...props}){return React.createElement('button',props);}
  const plugin=descriptor.factory(name=>name==='react'?React:name==='react/jsx-runtime'?JsxRuntime:name==='react-dom'?{createPortal:element=>element}:{Button,Input:'input',IconPluginPinwheelOutlineRegular:()=>null});
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
let controller;
let updates;
async function screenshot(name) { const filename = path.join(output, name); await page.screenshot({ path: filename }); report.screenshots.push(filename); }
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

  const nativeState = { serverUrl: 'https://chat.example.test', user: { id: '@alice:home.test', name: 'Alice' }, bots: [], nativeBots: [], nativeMode: true, hostId: 'node-a', runtime: { available: true }, models: { available: true, defaultSelection: { model: 'local/chat' }, providers: [{ id: 'local', name: 'Local', models: [{ model: 'local/chat', name: 'Local chat', needsKey: false }] }] } };
  const nativeRequests = [];
  let creationReceiptLost = false;
  const creations = new Map();
  await mkdir(path.join(temporary, 'decision'), { recursive: true });
  const decisionSettings = await new DecisionSettings({ directory: path.join(temporary, 'decision'), environment: {}, providerFactory: () => ({ model: 'participation-model', health: () => ({ health: 'ok' }) }) }).initialize();
  const native = {
    list: async () => nativeState.nativeBots,
    bot: async id => { const bot = nativeState.nativeBots.find(bot => bot.id === id); if (!bot) throw new Error('Unknown local Bot'); return bot; },
    models: async () => nativeState.models,
    async call(endpoint, body) {
      if (endpoint === 'create-bot') {
        if (!creations.has(body.requestId)) {
          const created = { id: 'local-shiyu', name: body.name, role: body.role, model: body.model, owner: body.owner };
          nativeState.nativeBots.push(created); creations.set(body.requestId, created);
        }
        if (!creationReceiptLost) { creationReceiptLost = true; throw new Error('Synthetic creation receipt lost'); }
        return creations.get(body.requestId);
      }
      if (endpoint === 'memory-profile') return { kind: body.kind, id: body.id, identity: { id: body.id, name: 'Bob' }, view: { currentClaims: [{ id: 'native-claim', text: 'Bob prefers herbs.', claimState: 'statement', kind: 'stated', sources: [{ id: 's', authorId: '@bob:home.test', roomId: '!project:home.test', eventId: '$source' }] }] } };
      if (endpoint === 'memory-profiles') return { kind: body.kind, items: [{ id: '@bob:home.test', name: 'Bob' }], more: false };
      throw new Error('Unexpected native fixture endpoint ' + endpoint);
    },
  };
  // A synthetic registry: the plugin runs 0.4.0 and a newer release speaks the same protocol.
  const pluginManager = { listBundles: () => [{ name: 'dscord', source: '^0.4.0' }], registries: () => ({ registry: 'https://registry.test/' }),
    installBundle: async () => ({ application: 'restart-required' }) };
  const releases = { versions: Object.fromEntries(['0.4.0', '0.5.0'].map(version => [version, { dscord: { protocol: { min: '1.0', max: '1.0' } } }])) };
  updates = await new KernelUpdates({ ctx: { get: name => ({ pluginManager })[name] }, directory: path.join(temporary, 'updates'), current: '0.4.0',
    currentRange: { min: '1.0', max: '1.0' }, startTimers: false, fetchImpl: async () => new Response(JSON.stringify(releases)) }).initialize();
  updates.observeProtocol('1.0');
  await updates.check({ fresh: true });
  controller = await new ConnectController({ directory: path.join(temporary, 'controller'), native, models: {}, updates, processes: {
    available: async () => nativeState.runtime,
    async kernelState(nativeBotId) { return { runtime: { id: 'dscord-kernel', available: true }, decisionProvider: decisionSettings.publicStatus(), ...(nativeBotId ? { attention: { mode: 'mention', activity: 'unknown', online: false, provider: decisionSettings.publicStatus() }, work: { activeTasks: 0, waiting: 0 } } : {}) }; },
    saveDecisionProvider: settings => decisionSettings.save(settings),
    stop: async () => {},
  } }).initialize();
  await controller.restoring;
  controller.state.user = nativeState.user;
  controller.state.servers = { [nativeState.serverUrl]: { url: nativeState.serverUrl, serverName: 'chat.example.test' } };
  await page.route('**/api/dscord', async route => {
    const body = route.request().postDataJSON(); nativeRequests.push({ ...body, ...(body.apiKey ? { apiKey: '[redacted synthetic test key]' } : {}) });
    try {
      const value = await controller.handle(body);
      await route.fulfill({ json: { ok: true, value } });
    } catch (error) {
      await route.fulfill({ json: { ok: false, error: { code: error.code, message: error.message } } });
    }
  });
  await page.setViewportSize({ width: 1000, height: 900 });
  await page.goto(`${origin}/__native`);
  await page.evaluate(() => document.body.setAttribute('data-ds-dark-theme', ''));
  await page.getByText('There are no Bots on this node yet. Create one here.', { exact: true }).waitFor();
  await page.getByText('Create Bot', { exact: true }).click();
  await page.getByLabel('Name', { exact: true }).fill('Shiyu');
  await page.getByLabel('Role or introduction').fill('A friend and project partner');
  await page.getByRole('button', { name: 'Create on this node' }).click();
  await page.getByRole('alert').filter({ hasText: 'Synthetic creation receipt lost' }).waitFor();
  await page.getByRole('button', { name: 'Confirm same creation' }).click();
  await page.getByText('Bot created. You can now add it to the server.', { exact: true }).waitFor();
  const creationRequests = nativeRequests.filter(item => item.action === 'create-native');
  assert.equal(creationRequests.length, 2); assert.deepEqual(creationRequests[0], creationRequests[1]);
  assert.ok(typeof creationRequests[0].requestId === 'string' && creationRequests[0].requestId.length > 10);
  assert.deepEqual({ ...creationRequests[0], requestId: '[stable request]' }, { action: 'create-native', name: 'Shiyu', role: 'A friend and project partner', model: 'local/chat', requestId: '[stable request]' });
  assert.equal(nativeState.nativeBots.length, 1);
  checks.push('dshCreatesLocalBotWithChosenModelAndConfirmsSameRequestAfterLostReceipt');
  await page.getByRole('button', { name: 'Bot settings', exact: true }).click();
  await page.getByRole('radio', { name: /Join naturally/ }).check();
  await page.getByRole('button', { name: 'Save participation', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'The node will apply this' }).first().waitFor();
  await page.getByRole('button', { name: 'Save participation', exact: true }).waitFor({ state: 'visible' });
  await page.waitForFunction(() => !document.querySelector('.dc-mode-options').disabled);
  assert.equal(await page.getByRole('radio', { name: /Join naturally/ }).isChecked(), true);
  assert.equal(await page.getByRole('button', { name: 'Save participation', exact: true }).isDisabled(), true);
  assert.equal(nativeRequests.find(item => item.action === 'attention-update').nativeBotId, 'local-shiyu');
  await page.getByRole('button', { name: 'Bob', exact: true }).click();
  await page.getByText('Bob prefers herbs.', { exact: true }).waitFor();
  checks.push('actualDshControllerKeepsDesiredModePendingWithoutRevertingAndReadsMemoryForExactBot');
  await page.getByText('Participation service', { exact: true }).click();
  await page.getByLabel('Decision service API key', { exact: true }).fill('synthetic-decision-key');
  await page.getByRole('button', { name: 'Save participation service', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Participation service saved' }).waitFor();
  assert.equal(await page.getByLabel('Decision service API key', { exact: true }).inputValue(), '');
  assert.equal(await page.evaluate(() => JSON.stringify(window.fixture.connection.getSnapshot()).includes('synthetic-decision-key')), false);
  assert.equal((await page.locator('body').innerText()).includes('synthetic-decision-key'), false);
  checks.push('decisionCredentialIsSubmitOnlyAndNeverReadBackOrStoredInConnectionSnapshot');
  await screenshot('local-decision-private-dark-en.png');
  await page.locator('.dscord-connect').evaluate(element => { element.scrollTop = 0; });
  await screenshot('local-kernel-dark-en.png');
  const upgrades = page.getByRole('region', { name: 'Plugin version' });
  await upgrades.getByText('0.5.0 is available', { exact: true }).waitFor();
  await upgrades.getByText('Upgrade automatically', { exact: true }).click();
  await page.waitForFunction(() => document.querySelector('input[name="kernelUpdatePolicy"][value="auto"]')?.checked);
  assert.equal(updates.view().policy, 'auto');
  await upgrades.getByRole('button', { name: 'Install 0.5.0', exact: true }).click();
  await upgrades.getByText('The new version is installed. Restart DSH to use it.', { exact: true }).waitFor();
  checks.push('ownerSeesCompatiblePluginReleaseSetsUpgradePolicyAndInstallsThroughDshPluginManager');
  await upgrades.scrollIntoViewIfNeeded();
  await screenshot('plugin-version-dark-en.png');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { window.fixture.locale('zh'); document.body.removeAttribute('data-ds-dark-theme'); });
  const nativeBounds = await page.locator('.dscord-connect').evaluate(element => ({ scroll: element.scrollWidth, client: element.clientWidth }));
  assert.ok(nativeBounds.scroll <= nativeBounds.client + 1);
  await screenshot('local-kernel-light-zh-mobile.png');
  // Adding a chat server: search the central index by keyword or server number; invite-only servers take a code.
  controller.state.centralUrl = 'https://central.test';
  const fetchCentral = controller.request;
  controller.request = async (url, init) => {
    if (!String(url).startsWith('https://central.test/api/servers')) return fetchCentral(url, init);
    return Response.json({ servers: [
      { origin: 'https://robots.example.test', number: 48213907, join: 'open', name: '机器人社', description: '机械臂、小车，每周四晚上一起做', tags: ['robots', 'hardware'],
        members: { people: 12, bots: 3 } },
      { origin: 'https://lab.example.test', number: 61530284, join: 'invite', name: '机器人实验室', description: '只接受邀请', tags: ['robots'],
        members: { people: 5, bots: 1 } }] });
  };
  await page.setViewportSize({ width: 1000, height: 900 });
  const serverSearch = page.getByRole('search', { name: '搜索服务器' });
  await serverSearch.locator('input[name="query"]').fill('机器人');
  await serverSearch.getByRole('button', { name: '搜索', exact: true }).click();
  await page.getByText('号码 48213907 · https://robots.example.test', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: '添加 机器人实验室', exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole('button', { name: '添加 机器人社', exact: true }).isDisabled(), false);
  assert.equal(nativeRequests.filter(item => item.action === 'search-servers').at(-1).query, '机器人');
  await page.getByRole('region', { name: '聊天服务器' }).scrollIntoViewIfNeeded();
  await screenshot('servers-search-light-zh.png');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('region', { name: '聊天服务器' }).scrollIntoViewIfNeeded();
  const searchBounds = await page.locator('.dscord-connect').evaluate(element => ({ scroll: element.scrollWidth, client: element.clientWidth }));
  assert.ok(searchBounds.scroll <= searchBounds.client + 1);
  await screenshot('servers-search-light-zh-mobile.png');
  controller.request = fetchCentral;
  checks.push('dshAddServerSearchesCentralIndexShowsNumbersAndKeepsInviteOnlyServersForTheCodeForm');
  await page.evaluate(() => {
    const value = window.fixture.connection.getSnapshot().value;
    sessionStorage.setItem(`dscord.pending-native.${value.hostId}.${value.user.id}`, JSON.stringify({
      requestId: 'alice-pending-request', fingerprint: 'alice-only', input: { name: 'Alice private draft', role: 'Alice draft role', model: 'local/chat' },
    }));
  });
  controller.state.user = { id: '@bob:home.test', name: 'Bob' };
  await page.evaluate(() => window.fixture.connection.refresh());
  await page.getByText('此节点尚无 Bot，可以在这里创建。', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('名称', { exact: true }).inputValue(), '');
  assert.doesNotMatch(await page.locator('.dc-content').innerText(), /Alice private draft|Alice draft role|local-shiyu/);
  checks.push('changingLocalAccountClearsSelectedBotAndKeepsOtherOwnersCreationDraftPrivate');
  assert.deepEqual(errors, []);
  checks.push('dshNativeSettingsRenderInChineseOnMobileWithoutOverflowOrBrowserErrors');
  report.status = 'passed';
} catch (error) {
  report.error = error.stack ?? String(error);
  if (page) await screenshot('failure.png').catch(() => {});
  throw error;
} finally {
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await controller?.dispose(); updates?.dispose();
  await browser?.close(); await server.close(); await rm(temporary, { recursive: true, force: true });
  console.log(JSON.stringify(report));
}
