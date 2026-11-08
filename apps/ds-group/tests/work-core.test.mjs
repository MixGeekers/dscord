import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { WorkCore, FRONT_REFUSAL, FRONT_TOOLS, WORKER_DENY, localBot } from '../dsh-connect/work-core.mjs';
import { ContactBook } from '../src/contact-book.mjs';

async function fixture(t, options = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'work-core-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const sessions = new Map(); const prompts = []; let guard; let created = 0;
  const agentFor = id => sessions.get(id) || sessions.set(id, { session: { id }, cancelled: 0, tools: new Map(), restricted: [],
    cancel() { this.cancelled++; },
    ctx: { tools: { register(def) { sessions.get(id).tools.set(def.name, def); }, restrict({ deny }) { sessions.get(id).restricted.push(...deny); },
      schemas: () => ['bash', 'write', 'recall', 'message_bot'].map(name => ({ name })) } } }).get(id);
  const ctx = {
    tools: { guard(fn) { guard = fn; return () => { guard = undefined; }; } },
    sessionController: {
      create: async ({ cwd }) => ({ sessionId: `worker-${++created}`, cwd }),
      prompt: async ({ sessionId, content, mode }) => { prompts.push({ sessionId, text: content[0].text, mode }); },
      selectModel: async () => ({}),
    },
  };
  const native = { bot: async () => ({ id: 'native', name: 'Lin', sessionId: 'front', model: 'p/m' }), agent: async id => agentFor(id) };
  const state = { tasks: {} }; let saves = 0;
  const { nativeBotId = 'native', origin = { roomId: '!room', eventId: '$ask', senderId: '@ann' }, ...rest } = options;
  const id = `@${nativeBotId}:dsh.test`;
  const core = new WorkCore({ ctx, native, node: { id, nativeBotId, directory }, state, save: async () => { saves++; }, ...rest });
  const db = new DatabaseSync(':memory:');
  core.contacts = new ContactBook({ db, self: { id }, local: localBot });
  // The room message the front is answering; null for a Bot that is only asked by another Bot.
  core.origin = origin;
  t.after(() => db.close());
  const results = [];
  core.onResult = async (task, message) => { results.push({ task: structuredClone(task), message, text: core.resultText(task, message) }); };
  t.after(() => core.dispose());
  return { core, state, prompts, results, agentFor, guard: exec => guard(exec), directory, saves: () => saves };
}

const run = (f, sessionId, name, args = {}) => f.agentFor(sessionId).tools.get(name).execute(args, { agent: f.agentFor(sessionId) });

test('the front keeps only communication tools and is refused everything else', async t => {
  const f = await fixture(t);
  await f.core.serveFront(f.agentFor('front'));
  const front = f.agentFor('front');
  assert.ok(['dispatch_work', 'task_status', 'task_cancel', 'task_note'].every(name => front.tools.has(name)));
  assert.deepEqual(front.restricted, ['bash', 'write']);
  assert.equal(f.guard({ agent: front, name: 'bash' }), FRONT_REFUSAL);
  assert.equal(f.guard({ agent: front, name: 'recall' }), undefined);
  // Every tool a worker is denied stays available at the front, so nothing becomes unreachable.
  for (const name of WORKER_DENY) assert.ok(FRONT_TOOLS.has(name), name);
  assert.equal(f.guard({ agent: f.agentFor('someone-else'), name: 'bash' }), undefined);
});

test('dispatch starts a worker with the brief and origin, and a verified report goes back once', async t => {
  const f = await fixture(t);
  await f.core.serveFront(f.agentFor('front'));
  f.core.origin = { roomId: '!r', eventId: '$e', senderId: '@ann', senderName: 'Ann', body: '帮我整理成 CSV', files: ['/in/a.xlsx'] };
  const reply = await run(f, 'front', 'dispatch_work', { audience: '提出请求的人', title: '整理表格', brief: '把 a.xlsx 转成 CSV' });
  const task = Object.values(f.state.tasks)[0];
  assert.match(reply, new RegExp(task.id));
  assert.equal(task.status, 'running'); assert.equal(task.sessionId, 'worker-1');
  assert.match(f.prompts[0].text, /把 a\.xlsx 转成 CSV/); assert.match(f.prompts[0].text, /帮我整理成 CSV/); assert.match(f.prompts[0].text, /\/in\/a\.xlsx/);
  assert.equal(f.guard({ agent: f.agentFor('worker-1'), name: 'message_bot' }) !== undefined, true);
  assert.equal(f.guard({ agent: f.agentFor('worker-1'), name: 'bash' }), undefined);
  await writeFile(path.join(task.dir, 'outputs', 'out.csv'), 'a,b\n');
  // The reply is what the requester reads; the summary is the front's record and never goes out.
  assert.match(await run(f, 'worker-1', 'work_report', { status: 'done', summary: '转好了' }), /需要 reply/);
  assert.match(await run(f, 'worker-1', 'work_report', { status: 'done', reply: '转好了，2 列', summary: 'openpyxl 读取 Sheet1，pandas 写出，2 列 1 行' }), /核对了 1 个文件/);
  assert.equal(task.status, 'done'); assert.equal(task.artifacts[0].name, 'out.csv'); assert.equal(task.notified, true);
  assert.equal(f.results.length, 1); assert.equal(f.results[0].text, '「整理表格」完成了。\n\n转好了，2 列');
  assert.equal(task.summary, 'openpyxl 读取 Sheet1，pandas 写出，2 列 1 行'); assert.doesNotMatch(f.results[0].text, /openpyxl/);
  assert.match(await run(f, 'worker-1', 'work_report', { status: 'done', summary: 'again' }), /已经结束/);
  assert.equal(f.results.length, 1);
});

test('listed files that do not exist are refused so the worker can correct its report', async t => {
  const f = await fixture(t);
  await f.core.serveFront(f.agentFor('front'));
  await run(f, 'front', 'dispatch_work', { audience: '提出请求的人', title: 'x', brief: 'y' });
  const reply = await run(f, 'worker-1', 'work_report', { status: 'done', reply: 'r', summary: 'ok', files: ['missing.txt'] });
  assert.match(reply, /文件核对没有通过/);
  assert.equal(Object.values(f.state.tasks)[0].status, 'running');
});

test('a worker turn without a report is reminded once, then fails with its last words', async t => {
  const f = await fixture(t);
  await f.core.serveFront(f.agentFor('front'));
  await run(f, 'front', 'dispatch_work', { audience: '提出请求的人', title: 'x', brief: 'y' });
  await f.core.event({ id: 'worker-1' }, { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: '我做到一半' }] } } });
  await f.core.event({ id: 'worker-1' }, { type: 'turn/end', data: { reason: { kind: 'completed' } } });
  assert.match(f.prompts.at(-1).text, /还没有调用 work_report/);
  await f.core.event({ id: 'worker-1' }, { type: 'turn/end', data: { reason: { kind: 'completed' } } });
  assert.equal(f.results[0].task.status, 'failed'); assert.match(f.results[0].task.summary, /我做到一半/);
});

test('slots queue extra work, cancel stops a worker without a result message, and the queue moves on', async t => {
  const f = await fixture(t, { maxWorkers: 1 });
  await f.core.serveFront(f.agentFor('front'));
  await run(f, 'front', 'dispatch_work', { audience: '提出请求的人', title: 'one', brief: '1' });
  assert.match(await run(f, 'front', 'dispatch_work', { audience: '提出请求的人', title: 'two', brief: '2' }), /在排队.*不要说已经开始/);
  const [first, second] = Object.values(f.state.tasks);
  assert.equal(second.status, 'queued');
  assert.match(await run(f, 'front', 'task_note', { id: second.id, text: '用中文' }), /排队中/);
  assert.match(await run(f, 'front', 'task_cancel', { id: first.id }), /已取消/);
  assert.equal(f.agentFor('worker-1').cancelled, 1); assert.equal(f.results.length, 0);
  assert.equal(second.status, 'running'); assert.match(f.prompts.at(-1).text, /补充：用中文/);
  assert.match(await run(f, 'front', 'task_status', {}), new RegExp(`${second.id} running two`));
  assert.deepEqual(first.events.map(e => [e.from, e.to, e.by]), [[null, 'queued', 'front'], ['queued', 'running', 'core'], ['running', 'cancelled', 'front']]);
  await f.core.event({ id: second.sessionId }, { type: 'tool/call', data: { name: 'bash', arguments: { command: 'ls outputs' } } });
  const view = f.core.view();
  assert.equal(view.workers[0].taskId, second.id); assert.equal(view.workers[0].toolCalls, 1);
  assert.deepEqual([view.workers[0].doing.tool, view.workers[0].doing.target], ['bash', 'ls outputs']); assert.deepEqual(view.queue, []);
});

test('timeouts stop the worker and report failure; restarts turn open work into unknown results', async t => {
  const f = await fixture(t, { timeoutMs: 20 });
  await f.core.serveFront(f.agentFor('front'));
  await run(f, 'front', 'dispatch_work', { audience: '提出请求的人', title: 'slow', brief: 's' });
  await new Promise(resolve => setTimeout(resolve, 60));
  assert.equal(f.results[0].task.status, 'failed'); assert.equal(f.agentFor('worker-1').cancelled, 1);
  const state = { tasks: { 'T-x': { id: 'T-x', title: 'old', status: 'running', createdAt: 'x', origin: { roomId: '!r' } } } };
  const restarted = new WorkCore({ ctx: {}, native: {}, node: {}, state, save: async () => {} });
  const seen = []; restarted.onResult = async task => { seen.push(task.status); };
  await restarted.flush();
  assert.deepEqual(seen, ['unknown']);
});

test('a worker question goes to the front without ending the task', async t => {
  const f = await fixture(t);
  await f.core.serveFront(f.agentFor('front'));
  await run(f, 'front', 'dispatch_work', { audience: '提出请求的人', title: 'q', brief: 'q' });
  await run(f, 'worker-1', 'work_ask', { question: '用哪个日期格式？' });
  assert.equal(f.results[0].message.kind, 'question'); assert.match(f.results[0].text, /\[task\.question\].*日期格式/s);
  assert.equal(Object.values(f.state.tasks)[0].status, 'running');
});

test('a file listed twice, or listed and staged under the same name and content, is delivered once', async t => {
  const f = await fixture(t);
  await f.core.serveFront(f.agentFor('front'));
  await run(f, 'front', 'dispatch_work', { audience: '提出请求的人', title: 'x', brief: 'y' });
  const task = Object.values(f.state.tasks)[0];
  await writeFile(path.join(task.dir, 'outputs', 'a.txt'), '1');
  await run(f, 'worker-1', 'work_report', { status: 'done', reply: 'r', summary: 'ok', files: ['outputs/a.txt', path.join(task.dir, 'outputs', 'a.txt'), './outputs/a.txt'] });
  assert.deepEqual(task.artifacts.map(file => file.name), ['a.txt']);
});

test('a worker that asked cannot deliver before the answer arrives, and a note cuts into its running turn', async t => {
  const f = await fixture(t);
  await f.core.serveFront(f.agentFor('front'));
  await run(f, 'front', 'dispatch_work', { audience: '提出请求的人', title: '日期', brief: '统一日期' });
  const task = Object.values(f.state.tasks)[0];
  const worker = { id: 'worker-1' };
  await f.core.event(worker, { type: 'turn/start', data: { turn: 1 } });
  await run(f, 'worker-1', 'work_ask', { question: 'C004 是日/月还是月/日？' });
  await writeFile(path.join(task.dir, 'outputs', 'dates_clean.csv'), 'id,date\n');
  assert.match(await run(f, 'worker-1', 'work_report', { status: 'done', reply: 'r', summary: '先交了' }), /还没有答复/);
  assert.equal(task.status, 'running');
  // Ending the turn while waiting is not a missing report.
  const before = f.prompts.length;
  await f.core.event(worker, { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } });
  assert.equal(f.prompts.length, before); assert.equal(task.reminded, undefined);
  await run(f, 'front', 'task_note', { id: task.id, text: '都按日/月/年' });
  assert.equal(f.prompts.at(-1).text, '前台答复：都按日/月/年'); assert.equal(f.prompts.at(-1).mode, 'queue');
  assert.match(await run(f, 'worker-1', 'work_report', { status: 'done', reply: 'r', summary: '还没读' }), /还没读到/);
  await f.core.event(worker, { type: 'turn/start', data: { turn: 2 } });
  await f.core.event(worker, { type: 'user/message', data: { content: [{ type: 'text', text: '前台答复：都按日/月/年' }] } });
  // A change while the worker is busy steers into its turn.
  await run(f, 'front', 'task_note', { id: task.id, text: '改成英文表头' });
  assert.equal(f.prompts.at(-1).mode, 'steer');
  assert.match(await run(f, 'worker-1', 'work_report', { status: 'done', reply: 'r', summary: 'x' }), /还没读到/);
  await f.core.event(worker, { type: 'user/message', data: { content: [{ type: 'text', text: '前台补充：改成英文表头' }] } });
  assert.match(await run(f, 'worker-1', 'work_report', { status: 'done', reply: 'r', summary: '按日/月/年统一了' }), /已汇报完成/);
  assert.equal(task.status, 'done'); assert.equal(task.waiting, undefined);
});

test('work a Bot does for another Bot goes back through the asking Bot to the room message behind the request', async t => {
  const dev = await fixture(t, { nativeBotId: 'dev', origin: null });
  const planner = await fixture(t, { nativeBotId: 'planner', origin: null });
  await dev.core.serveFront(dev.agentFor('front'));
  await planner.core.serveFront(planner.agentFor('front'));
  // 开发助理 is answering 林 in R1 and asks 策划 with message_bot; 策划 dispatches a worker for it.
  dev.core.origin = { roomId: '!r1', eventId: '$g5', senderId: '@lin', body: '请策划写 known-issues.md' };
  await planner.core.event({ id: 'front' }, { type: 'user/message', data: { message: { content: [{ type: 'text', text: '写 known-issues.md' }],
    source: { kind: 'bot', role: 'request', senderSessionId: 'dev', exchangeId: 'x1' } } } });
  // 开发助理 finishes its turn before 策划 gets round to dispatching.
  dev.core.origin = null;
  await run(planner, 'front', 'dispatch_work', { audience: '提出请求的人', title: '写 known-issues.md', brief: '整理已知问题' });
  const task = Object.values(planner.state.tasks)[0];
  assert.deepEqual([task.origin.roomId, task.origin.eventId, task.origin.via], ['!r1', '$g5', '@dev:dsh.test']);
  await writeFile(path.join(task.dir, 'outputs', 'known-issues.md'), '# 已知问题\n');
  await run(planner, 'worker-1', 'work_report', { status: 'done', reply: 'r', summary: '整理了 3 个已知问题' });
  assert.equal(planner.results.length, 0);
  assert.equal(dev.results.length, 1);
  assert.equal(dev.results[0].task.origin.eventId, '$g5');
  assert.deepEqual(dev.results[0].task.artifacts.map(file => file.name), ['known-issues.md']);
  assert.match(dev.results[0].text, /^Lin：「写 known-issues\.md」完成了/);
  assert.equal(task.notified, true);
  // Both contact books keep the exchange: who asked whom, for which room message, and how it ended.
  const asked = planner.core.contacts.exchange('x1');
  assert.deepEqual([asked.direction, asked.peerId, asked.via, asked.origin.eventId, asked.status, asked.taskId],
    ['in', '@dev:dsh.test', 'message_bot', '$g5', 'delivered', task.id]);
  const sent = dev.core.contacts.exchange('x1');
  assert.deepEqual([sent.direction, sent.peerId, sent.status], ['out', '@planner:dsh.test', 'returned']);
  assert.deepEqual(dev.core.contacts.contact('@planner:dsh.test').reach, 'message_bot');
});

test('each Bot-to-Bot request keeps its own room message, even when the asking Bot is already done', async t => {
  const dev = await fixture(t, { nativeBotId: 'dev', origin: null });
  const ops = await fixture(t, { nativeBotId: 'ops', origin: null });
  const planner = await fixture(t, { nativeBotId: 'planner', origin: null });
  await planner.core.serveFront(planner.agentFor('front'));
  const ask = (from, exchangeId) => planner.core.event({ id: 'front' }, { type: 'user/message', data: { message: {
    content: [{ type: 'text', text: '帮忙' }], source: { kind: 'bot', role: 'request', senderSessionId: from, exchangeId } } } });
  // 开发助理 asked while answering R1; its turn ended right after (the core keeps the last room message briefly).
  dev.core.lastOrigin = { origin: { roomId: '!r1', eventId: '$a' }, at: Date.now() };
  await ask('dev', 'x1');
  // 运维 asks next, about R2, and is done before 策划 dispatches either.
  ops.core.origin = { roomId: '!r2', eventId: '$b' };
  await ask('ops', 'x2');
  ops.core.origin = null;
  await run(planner, 'front', 'dispatch_work', { audience: '提出请求的人', title: '运维的活', brief: 'b' });
  // A later room turn of 策划's own goes back to its own room.
  planner.core.origin = { roomId: '!r3', eventId: '$c' };
  await run(planner, 'front', 'dispatch_work', { audience: '提出请求的人', title: '自己的活', brief: 'c' });
  planner.core.origin = null;
  const [forOps, own] = Object.values(planner.state.tasks);
  assert.deepEqual([forOps.origin.roomId, forOps.origin.via], ['!r2', '@ops:dsh.test']);
  assert.equal(planner.core.contacts.exchange('x2').status, 'dispatched');
  assert.deepEqual([own.origin.roomId, own.origin.via], ['!r3', undefined]);
  // The first request still had 开发助理's room message on record when it arrived.
  await ask('dev', 'x3');
  await run(planner, 'front', 'dispatch_work', { audience: '提出请求的人', title: '开发的活', brief: 'a' });
  const forDev = Object.values(planner.state.tasks)[2];
  assert.deepEqual([forDev.origin.roomId, forDev.origin.via], ['!r1', '@dev:dsh.test']);
});

test('a plain-language task cannot hand stack traces or raw logs to the person who asked', async t => {
  const f = await fixture(t);
  await f.core.serveFront(f.agentFor('front'));
  f.core.origin = { roomId: '!players', eventId: '$g13', senderId: '@xiaoman', senderName: '小满', body: '游戏崩了', files: [] };
  await run(f, 'front', 'dispatch_work', { title: '看崩溃日志', brief: '分析 crash.log', audience: '玩家小满：通俗说明，不贴堆栈', plain: true });
  const task = Object.values(f.state.tasks)[0];
  assert.match(f.prompts[0].text, /## 交付对象\n玩家小满/);
  assert.match(f.prompts[0].text, /核心会检查并退回/);
  const leaky = await run(f, 'worker-1', 'work_report', { status: 'done', summary: 'x',
    reply: '是存档问题：NullReferenceException at SaveLoader.RestoreTowerState (SaveLoader.cs:212)' });
  assert.match(leaky, /异常类型「NullReferenceException」/); assert.match(leaky, /类名\.方法名/); assert.match(leaky, /源码位置「SaveLoader\.cs:212」/);
  await writeFile(path.join(task.dir, 'outputs', 'triage.md'), '# 分析\n2026-11-08 02:05:11 [ERROR] tower restore failed\n');
  const file = await run(f, 'worker-1', 'work_report', { status: 'done', summary: '空引用在 SaveLoader.RestoreTowerState', reply: '这是读档时的已知问题，下个补丁会修，先别读那个存档。' });
  assert.match(file, /交付文件 triage\.md/); assert.match(file, /日志原文/);
  assert.equal(task.status, 'running');
  await writeFile(path.join(task.dir, 'outputs', 'triage.md'), '# 处理建议\n先别读那个存档，下个补丁会修。\n');
  assert.match(await run(f, 'worker-1', 'work_report', { status: 'done', summary: '空引用在 SaveLoader.RestoreTowerState', reply: '这是读档时的已知问题，下个补丁会修，先别读那个存档。' }), /已汇报完成/);
  assert.equal(f.results[0].text, '「看崩溃日志」完成了。\n\n这是读档时的已知问题，下个补丁会修，先别读那个存档。');
});

test('a turn with no message to answer cannot dispatch, so work a restart left unknown is not redone on its own', async t => {
  const f = await fixture(t, { origin: null, nativeBotId: 'planner' });
  await f.core.serveFront(f.agentFor('front'));
  assert.match(await run(f, 'front', 'dispatch_work', { audience: '唐', title: '写简介', brief: '按 facts.md 写' }), /不能派工/);
  // A message_bot request whose work ended unknown is not taken up again by a resumed turn.
  f.core.state.tasks['T-old'] = { id: 'T-old', title: '写简介', status: 'unknown', origin: { roomId: '!r2', eventId: '$g18' } };
  f.core.contacts.open({ id: 'x9', direction: 'in', peer: '@promo:b.test', via: 'message_bot', status: 'received', origin: { roomId: '!r2', eventId: '$g18' } });
  assert.match(await run(f, 'front', 'dispatch_work', { audience: '唐', title: '写简介（重做）', brief: '按 facts.md 写' }), /不能派工/);
  // A Matrix request is answered through the bridge's own origin, never picked up from the book.
  f.core.contacts.open({ id: 'in:$g19', direction: 'in', peer: '@promo:b.test', via: 'matrix', status: 'received', origin: { roomId: '!r2', eventId: '$g19' } });
  assert.match(await run(f, 'front', 'dispatch_work', { audience: '唐', title: 'x', brief: 'y' }), /不能派工/);
  assert.equal(Object.keys(f.state.tasks).length, 1);
});
