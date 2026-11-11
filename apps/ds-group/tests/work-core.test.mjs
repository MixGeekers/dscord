import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { WorkCore, CARD_REFUSAL, CARD_TOOLS, FRONT_REFUSAL, FRONT_TOOLS, NATIVE_TEAM_REFUSAL, NATIVE_TEAM_TOOLS, WORKER_DENY, localBot } from '../dsh-connect/work-core.mjs';
import { ContactBook } from '../src/contact-book.mjs';

async function fixture(t, options = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'work-core-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const sessions = new Map(); const prompts = []; let guard; let created = 0;
  const agentFor = id => sessions.get(id) || sessions.set(id, { session: { id }, cancelled: 0, tools: new Map(), restricted: [],
    cancel() { this.cancelled++; },
    ctx: { tools: { register(def) { sessions.get(id).tools.set(def.name, def); }, restrict({ deny }) { sessions.get(id).restricted.push(...deny); },
      schemas: () => ['bash', 'write', 'recall', 'message_bot'].map(name => ({ name })) } } }).get(id);
  const policies = [];
  const ctx = {
    get: name => name === 'approval' ? { setPolicy: (agent, policy) => policies.push([agent.session.id, policy]) } : undefined,
    tools: { guard(fn) { guard = fn; return () => { guard = undefined; }; } },
    sessionController: {
      create: async ({ cwd }) => ({ sessionId: `worker-${++created}`, cwd }),
      prompt: async ({ sessionId, content, mode }) => { prompts.push({ sessionId, text: content[0].text, mode }); },
      selectModel: async () => ({}),
    },
  };
  const native = { bot: async () => ({ id: 'native', name: 'Lin', sessionId: 'front', model: 'p/m' }), agent: async id => agentFor(id) };
  const { nativeBotId = 'native', origin = { roomId: '!room', eventId: '$ask', senderId: '@ann' }, ...rest } = options;
  const id = `@${nativeBotId}:dsh.test`;
  const core = await new WorkCore({ ctx, native, nativeBotId, directory, ...rest }).initialize();
  // Every request in these tests comes in through the Bot's one server account.
  let current = null;
  Object.defineProperty(core, 'origin', { get: () => current, set: value => { current = value && { botId: id, ...value }; } });
  const db = new DatabaseSync(':memory:');
  const seat = core.seat(id);
  seat.contacts = new ContactBook({ db }).on({ self: { id }, local: localBot });
  // The room message the front is answering; null for a Bot that is only asked by another Bot.
  core.origin = origin;
  t.after(() => db.close());
  const results = [];
  seat.onResult = async (task, message, text) => { results.push({ task: structuredClone(task), message, text }); };
  t.after(() => core.dispose());
  return { core, state: core.state, prompts, results, policies, agentFor, guard: exec => guard(exec), directory, id };
}

const run = (f, sessionId, name, args = {}) => f.agentFor(sessionId).tools.get(name).execute(args, { agent: f.agentFor(sessionId) });

test('the front keeps only communication tools and is refused everything else', async t => {
  const f = await fixture(t);
  await f.core.serveFront(f.agentFor('front'));
  const front = f.agentFor('front');
  assert.ok(['dispatch_work', 'task_join', 'task_status', 'task_cancel', 'task_note', 'ask_bot'].every(name => front.tools.has(name)));
  assert.deepEqual(front.restricted, ['bash', 'write', 'message_bot']);
  assert.equal(f.guard({ agent: front, name: 'bash' }), FRONT_REFUSAL);
  assert.equal(f.guard({ agent: front, name: 'recall' }), undefined);
  // Every tool a worker is denied stays available at the front, so nothing becomes unreachable.
  for (const name of WORKER_DENY) assert.ok(FRONT_TOOLS.has(name), name);
  assert.equal(f.guard({ agent: f.agentFor('someone-else'), name: 'bash' }), undefined);
  // Script 02 G16: a desktop card has no reader in a chat room and leaves the turn without a reply.
  for (const name of CARD_TOOLS) {
    assert.equal(FRONT_TOOLS.has(name), false, name);
    assert.equal(f.guard({ agent: front, name }), CARD_REFUSAL);
  }
  assert.equal(f.guard({ agent: f.agentFor('someone-else'), name: 'ask_user' }), undefined);
  // One way for each thing: the native host's Bot channel, team and groups are off for the front and for workers.
  for (const name of NATIVE_TEAM_TOOLS) {
    assert.equal(FRONT_TOOLS.has(name), false, name);
    assert.equal(f.guard({ agent: front, name }), NATIVE_TEAM_REFUSAL, name);
  }
  // Looking things up on the web is a worker's job.
  assert.equal(f.guard({ agent: front, name: 'web_fetch' }), FRONT_REFUSAL);
});

test('dispatch starts a worker with the brief and origin, and a verified report goes back once', async t => {
  const f = await fixture(t);
  await f.core.serveFront(f.agentFor('front'));
  f.core.origin = { roomId: '!r', eventId: '$e', senderId: '@ann', senderName: 'Ann', body: '帮我整理成 CSV', files: ['/in/a.xlsx'] };
  const reply = await run(f, 'front', 'dispatch_work', { audience: '提出请求的人', title: '整理表格', brief: '把 a.xlsx 转成 CSV' });
  const task = Object.values(f.state.tasks)[0];
  assert.match(reply, new RegExp(task.id));
  assert.equal(task.status, 'running'); assert.equal(task.sessionId, 'worker-1');
  // No one answers a worker's approval prompts, so the worker never waits on one.
  assert.deepEqual(f.policies, [['worker-1', 'never']]);
  assert.match(f.prompts[0].text, /把 a\.xlsx 转成 CSV/); assert.match(f.prompts[0].text, /帮我整理成 CSV/); assert.match(f.prompts[0].text, /\/in\/a\.xlsx/);
  assert.equal(f.guard({ agent: f.agentFor('worker-1'), name: 'message_bot' }) !== undefined, true);
  assert.equal(f.guard({ agent: f.agentFor('worker-1'), name: 'bash' }), undefined);
  assert.equal(f.guard({ agent: f.agentFor('worker-1'), name: 'ask_user' }), CARD_REFUSAL);
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

test('files written outside outputs/ and left out of files are asked about once, then a second report stands', async t => {
  const f = await fixture(t);
  await f.core.serveFront(f.agentFor('front'));
  await run(f, 'front', 'dispatch_work', { audience: '林：只要结论', title: '补丁说明', brief: 'patch-notes.md 放在工作目录根', deliverables: 'patch-notes.md' });
  const task = Object.values(f.state.tasks)[0];
  await writeFile(path.join(task.dir, 'patch-notes.md'), '# 0.9.1\n');
  const asked = await run(f, 'worker-1', 'work_report', { status: 'done', reply: '写好了', summary: 'ok' });
  assert.match(asked, /patch-notes\.md/); assert.match(asked, /files 为空/);
  assert.equal(task.status, 'running');
  assert.match(await run(f, 'worker-1', 'work_report', { status: 'done', reply: '写好了', summary: 'ok', files: ['patch-notes.md'] }), /核对了 1 个文件/);
  assert.equal(task.artifacts[0].name, 'patch-notes.md');
  const g = await fixture(t);
  await g.core.serveFront(g.agentFor('front'));
  await run(g, 'front', 'dispatch_work', { audience: 'x', title: 'x', brief: 'y' });
  const other = Object.values(g.state.tasks)[0];
  await writeFile(path.join(other.dir, 'scratch.log'), 'x');
  assert.match(await run(g, 'worker-1', 'work_report', { status: 'done', reply: 'r', summary: 'ok' }), /files 为空/);
  assert.match(await run(g, 'worker-1', 'work_report', { status: 'done', reply: 'r', summary: 'ok' }), /核对了 0 个文件/);
  assert.equal(other.status, 'done');
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

test('timeouts stop the worker and report failure; restarts turn open work into unknown results', { timeout: 10_000 }, async t => {
  const f = await fixture(t, { timeoutMs: 20 });
  const delivered = Promise.withResolvers();
  const seat = f.core.seat(f.id);
  const recordResult = seat.onResult;
  seat.onResult = async (...args) => { await recordResult(...args); delivered.resolve(); };
  await f.core.serveFront(f.agentFor('front'));
  await run(f, 'front', 'dispatch_work', { audience: '提出请求的人', title: 'slow', brief: 's' });
  await delivered.promise;
  assert.equal(f.results[0].task.status, 'failed'); assert.equal(f.agentFor('worker-1').cancelled, 1);
  const directory = path.join(f.directory, 'restarted');
  await mkdir(directory);
  await writeFile(path.join(directory, 'work.json'), JSON.stringify({ version: 1, nativeBotId: 'other', frontNotes: [],
    tasks: { 'T-x': { id: 'T-x', title: 'old', status: 'running', createdAt: 'x', origin: { roomId: '!r', botId: '@other:dsh.test' } } } }));
  const restarted = await new WorkCore({ ctx: {}, native: {}, nativeBotId: 'other', directory }).initialize();
  t.after(() => restarted.dispose());
  const seen = []; restarted.seat('@other:dsh.test').onResult = async task => { seen.push(task.status); };
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

test('a second message asking for the same work joins the task and gets its own reply, also after the task ended', async t => {
  const f = await fixture(t);
  await f.core.serveFront(f.agentFor('front'));
  f.core.origin = { roomId: '!players', eventId: '$g13', senderId: '@xiaoman', senderName: '小满' };
  await run(f, 'front', 'dispatch_work', { audience: '玩家', title: '查崩溃', brief: '看 crash.log' });
  const task = Object.values(f.state.tasks)[0];
  // 苏 asks about the same crash in R2 while QA is still on it.
  f.core.origin = { roomId: '!r2', eventId: '$g14', senderId: '@su', senderName: '苏', files: ['/in/crash.log'] };
  assert.match(await run(f, 'front', 'task_join', { id: task.id }), /已登记.*task_note/s);
  assert.match(await run(f, 'front', 'task_join', { id: task.id }), /已经是/);
  assert.match(await run(f, 'front', 'task_join', { id: 'nope' }), /没有这个任务/);
  await run(f, 'worker-1', 'work_report', { status: 'done', reply: '是钟楼已知问题，先别进钟楼', summary: 'ok' });
  assert.deepEqual(f.results.map(result => [result.task.id, result.task.origin.eventId]), [[task.id, '$g13'], [`${task.id}-1`, '$g14']]);
  assert.match(f.results[1].text, /同一件事[\s\S]*先别进钟楼/);
  assert.equal(f.state.tasks[`${task.id}-1`].notified, true);
  assert.equal(task.notifiedOrigins, 2);
  // A third asker after the task ended is answered at once; nobody earlier gets it twice.
  f.core.origin = { roomId: '!r3', eventId: '$late', senderId: '@tang' };
  assert.match(await run(f, 'front', 'task_join', { id: task.id }), /已经结束/);
  assert.deepEqual(f.results.map(result => result.task.origin.eventId), ['$g13', '$g14', '$late']);
  await f.core.flush();
  assert.equal(f.results.length, 3);
});

test('a plain-language requester who joins gets only the files and reply lines fit for them', async t => {
  const f = await fixture(t);
  await f.core.serveFront(f.agentFor('front'));
  f.core.origin = { roomId: '!r2', eventId: '$su', senderId: '@su', senderName: '苏' };
  await run(f, 'front', 'dispatch_work', { audience: '苏：开发，要完整调用链', title: '查崩溃', brief: '看 crash.log' });
  const task = Object.values(f.state.tasks)[0];
  f.core.origin = { roomId: '!r4', eventId: '$xiaoman', senderId: '@xiaoman', senderName: '小满' };
  await run(f, 'front', 'task_join', { id: task.id, audience: '玩家小满：通俗说明', plain: true });
  await writeFile(path.join(task.dir, 'outputs', 'crash-analysis.md'), '# 分析\nSystem.NullReferenceException at SaveLoader.Restore (SaveLoader.cs:412)\n');
  await writeFile(path.join(task.dir, 'outputs', '给小满-回复.md'), '先别读那个存档，下个补丁会修。\n');
  await run(f, 'worker-1', 'work_report', { status: 'done', summary: 'ok',
    reply: '技术版：空引用在 SaveLoader.Restore (SaveLoader.cs:412)\n玩家版：先别读那个存档，下个补丁会修。' });
  const [first, second] = f.results.map(result => result.task);
  assert.deepEqual(first.artifacts.map(file => file.name).sort(), ['crash-analysis.md', '给小满-回复.md']);
  assert.deepEqual(second.artifacts.map(file => file.name), ['给小满-回复.md']);
  assert.equal(second.reply, '玩家版：先别读那个存档，下个补丁会修。');
});

test('ask_bot is the one way to ask another Bot: it names a contact and goes out with this turn\'s reply', async t => {
  const f = await fixture(t, { origin: { requestId: 'req-1', roomId: '!r4', eventId: '$g13', senderId: '@xiaoman' } });
  await f.core.serveFront(f.agentFor('front'));
  f.core.contacts.seeRoom('!r4', [{ id: '@native:dsh.test', kind: 'bot' }, { id: '@qa:a.test', name: 'QA', kind: 'bot' },
    { id: '@xiaoman', name: '小满', kind: 'human' }]);
  assert.match(await run(f, 'front', 'ask_bot', { to: 'QA', body: '核对 crash.log 是不是钟楼读档闪退', audience: '玩家小满：通俗说明', plain: true }), /这一轮结束后发给 QA/);
  assert.match(await run(f, 'front', 'ask_bot', { to: 'matrix:@qa:a.test', body: '再问一次' }), /已经请过 QA/);
  assert.match(await run(f, 'front', 'ask_bot', { to: '@xiaoman', body: 'x' }), /不在你的通讯录/);
  assert.match(await run(f, 'front', 'ask_bot', { to: 'QA', body: ' ' }), /需要 body/);
  const asks = f.core.takeAsks('req-1');
  assert.deepEqual(asks.map(ask => ask.to), ['@qa:a.test']);
  assert.match(asks[0].body, /^核对 crash\.log 是不是钟楼读档闪退\n\n结果给谁、什么口径：玩家小满：通俗说明\n\n最终读者不该看到技术内部信息/);
  assert.deepEqual(f.core.takeAsks('req-1'), []);
  // A worker asks through the front, and a turn with no message to answer has no one to report back to.
  assert.ok(WORKER_DENY.has('ask_bot'));
  f.core.origin = null;
  assert.match(await run(f, 'front', 'ask_bot', { to: 'QA', body: 'x' }), /没有要回复的消息/);
});

test('ask_bot hands local files over as attachments and stops passing work after four Bot-to-Bot hops', async t => {
  const f = await fixture(t, { origin: { requestId: 'req-2', roomId: '!r2', eventId: '$g8', senderId: '@tang', hop: 3 } });
  await f.core.serveFront(f.agentFor('front'));
  f.core.contacts.seeRoom('!r2', [{ id: '@native:dsh.test', kind: 'bot' }, { id: '@qa:a.test', name: 'QA', kind: 'bot' }]);
  const summary = path.join(f.directory, 'bug-summary.md');
  await writeFile(summary, '# 未修致命 bug\n');
  assert.match(await run(f, 'front', 'ask_bot', { to: 'QA', body: '核对未修致命 bug 数', files: [path.join(f.directory, 'missing.md')] }), /读不到文件/);
  assert.match(await run(f, 'front', 'ask_bot', { to: 'QA', body: '核对未修致命 bug 数', files: [summary] }), /这一轮结束后发给 QA/);
  assert.deepEqual(f.core.takeAsks('req-2')[0].files, [{ path: summary, name: 'bug-summary.md' }]);
  f.core.origin = { ...f.core.origin, hop: 4 };
  assert.match(await run(f, 'front', 'ask_bot', { to: 'QA', body: '再转一次' }), /已经在 Bot 之间转了 4 次/);
  assert.deepEqual(f.core.takeAsks('req-2'), []);
});

test('one request is either handed to a worker or waits for another Bot in a turn, so the requester gets one result', async t => {
  const f = await fixture(t, { origin: { requestId: 'req-g22', roomId: '!r2', eventId: '$g22', senderId: '@tang' } });
  await f.core.serveFront(f.agentFor('front'));
  f.core.contacts.seeRoom('!r2', [{ id: '@native:dsh.test', kind: 'bot' }, { id: '@planner:a.test', name: '策划', kind: 'bot' }]);
  // Asked first: no worker for the same request until the planner's result is back.
  assert.match(await run(f, 'front', 'ask_bot', { to: '策划', body: '补一段游戏简介' }), /这一轮结束后发给 策划/);
  assert.match(await run(f, 'front', 'dispatch_work', { audience: '唐', title: '资料包', brief: '整理媒体资料包' }), /已经请了 策划.*不要派工/);
  assert.deepEqual(f.core.handedOff('req-g22'), []);
  assert.equal(f.core.takeAsks('req-g22').length, 1);
  // Dispatched first: the worker's result is the answer, so the same turn does not also ask the planner.
  f.core.origin = { requestId: 'req-g22b', roomId: '!r2', eventId: '$g22b', senderId: '@tang' };
  assert.match(await run(f, 'front', 'dispatch_work', { audience: '唐', title: '资料包', brief: '整理媒体资料包' }), /已派工/);
  assert.match(await run(f, 'front', 'ask_bot', { to: '策划', body: '补一段游戏简介' }), /已经把这件事交给了工作者/);
  assert.deepEqual(f.core.takeAsks('req-g22b'), []);
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
  // Script 02 G6: explaining what was left out discloses it again.
  assert.match(await run(f, 'worker-1', 'work_report', { status: 'done', summary: 'x', reply: '写好了。另外说明一下取舍：调试指令、打包脚本没有写入。' }),
    /取舍[\s\S]*写进 summary/);
  assert.match(await run(f, 'worker-1', 'work_report', { status: 'done', summary: '空引用在 SaveLoader.RestoreTowerState', reply: '这是读档时的已知问题，下个补丁会修，先别读那个存档。' }), /已汇报完成/);
  assert.equal(f.results[0].text, '「看崩溃日志」完成了。\n\n这是读档时的已知问题，下个补丁会修，先别读那个存档。');
});

test('a turn with no message to answer cannot dispatch, so work a restart left unknown is not redone on its own', async t => {
  const f = await fixture(t, { origin: null, nativeBotId: 'planner' });
  await f.core.serveFront(f.agentFor('front'));
  assert.match(await run(f, 'front', 'dispatch_work', { audience: '唐', title: '写简介', brief: '按 facts.md 写' }), /不能派工/);
  // A message_bot request whose work ended unknown is not taken up again by a resumed turn.
  f.core.state.tasks['T-old'] = { id: 'T-old', title: '写简介', status: 'unknown', origin: { roomId: '!r2', eventId: '$g18' } };
  f.core.seat(f.id).contacts.open({ id: 'x9', direction: 'in', peer: '@promo:b.test', via: 'message_bot', status: 'received', origin: { roomId: '!r2', eventId: '$g18' } });
  assert.match(await run(f, 'front', 'dispatch_work', { audience: '唐', title: '写简介（重做）', brief: '按 facts.md 写' }), /不能派工/);
  // A Matrix request is answered through the bridge's own origin, never picked up from the book.
  f.core.seat(f.id).contacts.open({ id: 'in:$g19', direction: 'in', peer: '@promo:b.test', via: 'matrix', status: 'received', origin: { roomId: '!r2', eventId: '$g19' } });
  assert.match(await run(f, 'front', 'dispatch_work', { audience: '唐', title: 'x', brief: 'y' }), /不能派工/);
  assert.equal(Object.keys(f.state.tasks).length, 1);
});

test('a Bot on two chat servers has one core, and each result goes back through the server its request came in on', async t => {
  const f = await fixture(t);
  assert.equal(await WorkCore.acquire({ nativeBotId: 'native' }), f.core);
  const elsewhere = '@native:other.test'; const there = [];
  f.core.seat(elsewhere).onResult = async (task, message, text) => { there.push(text); };
  await f.core.serveFront(f.agentFor('front'));
  f.core.origin = { requestId: 'here', roomId: '!home', eventId: '$here', senderId: '@ann:dsh.test' };
  await run(f, 'front', 'dispatch_work', { audience: 'Ann', title: '本服务器的事', brief: 'a' });
  f.core.origin = { botId: elsewhere, requestId: 'there', roomId: '!other', eventId: '$there', senderId: '@bob:other.test' };
  await run(f, 'front', 'dispatch_work', { audience: 'Bob', title: '另一台服务器的事', brief: 'b' });
  await run(f, 'worker-2', 'work_report', { status: 'done', reply: '给 Bob', summary: 'ok' });
  await run(f, 'worker-1', 'work_report', { status: 'done', reply: '给 Ann', summary: 'ok' });
  assert.deepEqual(there, ['「另一台服务器的事」完成了。\n\n给 Bob']);
  assert.deepEqual(f.results.map(result => result.task.origin.eventId), ['$here']);
  // A server that disconnects leaves the core to the others; a result for it waits until it is back.
  await f.core.release(elsewhere);
  assert.equal(await WorkCore.acquire({ nativeBotId: 'native' }), f.core);
});

test('update_profile changes the Bot\'s own name and avatar through its connection, and checks the image first', async t => {
  const f = await fixture(t);
  await f.core.serveFront(f.agentFor('front'));
  assert.ok(FRONT_TOOLS.has('update_profile'));
  assert.match(NATIVE_TEAM_REFUSAL, /update_profile/, 'the native update_bot refusal points to the one way to rename');
  assert.match(await run(f, 'front', 'update_profile', { name: '小林' }), /连不上中央服务器/);
  const edits = [];
  f.core.seat(f.id).editProfile = async changes => {
    edits.push(changes);
    if (changes.displayName?.length > 80) throw Object.assign(new Error('DISPLAY_NAME_INVALID'), { remoteCode: 'DISPLAY_NAME_INVALID' });
    return { displayName: changes.displayName ?? '小林' };
  };
  assert.match(await run(f, 'front', 'update_profile', { name: ' 小林 ' }), /已保存：名字是「小林」/);
  assert.deepEqual(edits.at(-1), { displayName: '小林' });
  assert.equal(f.core.botName, '小林');
  const png = path.join(f.directory, 'me.png');
  await writeFile(png, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]));
  assert.match(await run(f, 'front', 'update_profile', { avatar: png }), /头像已换上/);
  assert.equal(edits.at(-1).avatar.type, 'image/png');
  assert.equal(edits.at(-1).displayName, undefined);
  const note = path.join(f.directory, 'note.txt');
  await writeFile(note, 'not an image');
  const count = edits.length;
  assert.match(await run(f, 'front', 'update_profile', { avatar: note }), /PNG、JPEG 或 WebP/);
  assert.match(await run(f, 'front', 'update_profile', { avatar: path.join(f.directory, 'missing.png') }), /读不到文件/);
  assert.match(await run(f, 'front', 'update_profile', { avatar: png, clear_avatar: true }), /只填一个/);
  assert.match(await run(f, 'front', 'update_profile', {}), /没有要改的/);
  assert.match(await run(f, 'front', 'update_profile', { name: '  ' }), /不能是空的/);
  assert.equal(edits.length, count, 'nothing invalid reaches the central server');
  assert.match(await run(f, 'front', 'update_profile', { name: 'x'.repeat(81) }), /没改成：名字最多 80 个字/);
  // A Bot changes its own profile whenever it decides to, not only while answering a message.
  f.core.origin = null;
  assert.match(await run(f, 'front', 'update_profile', { clear_avatar: true }), /头像已去掉/);
  assert.equal(edits.at(-1).avatar, null);
});
