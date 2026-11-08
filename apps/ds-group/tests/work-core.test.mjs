import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { WorkCore, FRONT_REFUSAL, FRONT_TOOLS, WORKER_DENY } from '../dsh-connect/work-core.mjs';

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
      prompt: async ({ sessionId, content }) => { prompts.push({ sessionId, text: content[0].text }); },
      selectModel: async () => ({}),
    },
  };
  const native = { bot: async () => ({ id: 'native', name: 'Lin', sessionId: 'front', model: 'p/m' }), agent: async id => agentFor(id) };
  const state = { tasks: {} }; let saves = 0;
  const core = new WorkCore({ ctx, native, node: { nativeBotId: 'native', directory }, state, save: async () => { saves++; }, ...options });
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
  const reply = await run(f, 'front', 'dispatch_work', { title: '整理表格', brief: '把 a.xlsx 转成 CSV' });
  const task = Object.values(f.state.tasks)[0];
  assert.match(reply, new RegExp(task.id));
  assert.equal(task.status, 'running'); assert.equal(task.sessionId, 'worker-1');
  assert.match(f.prompts[0].text, /把 a\.xlsx 转成 CSV/); assert.match(f.prompts[0].text, /帮我整理成 CSV/); assert.match(f.prompts[0].text, /\/in\/a\.xlsx/);
  assert.equal(f.guard({ agent: f.agentFor('worker-1'), name: 'message_bot' }) !== undefined, true);
  assert.equal(f.guard({ agent: f.agentFor('worker-1'), name: 'bash' }), undefined);
  await writeFile(path.join(task.dir, 'outputs', 'out.csv'), 'a,b\n');
  assert.match(await run(f, 'worker-1', 'work_report', { status: 'done', summary: '转好了，2 列' }), /核对了 1 个文件/);
  assert.equal(task.status, 'done'); assert.equal(task.artifacts[0].name, 'out.csv'); assert.equal(task.notified, true);
  assert.equal(f.results.length, 1); assert.match(f.results[0].text, /\[task\.result\].*已完成/s); assert.match(f.results[0].text, /out\.csv/);
  assert.match(await run(f, 'worker-1', 'work_report', { status: 'done', summary: 'again' }), /已经结束/);
  assert.equal(f.results.length, 1);
});

test('listed files that do not exist are refused so the worker can correct its report', async t => {
  const f = await fixture(t);
  await f.core.serveFront(f.agentFor('front'));
  await run(f, 'front', 'dispatch_work', { title: 'x', brief: 'y' });
  const reply = await run(f, 'worker-1', 'work_report', { status: 'done', summary: 'ok', files: ['missing.txt'] });
  assert.match(reply, /文件核对没有通过/);
  assert.equal(Object.values(f.state.tasks)[0].status, 'running');
});

test('a worker turn without a report is reminded once, then fails with its last words', async t => {
  const f = await fixture(t);
  await f.core.serveFront(f.agentFor('front'));
  await run(f, 'front', 'dispatch_work', { title: 'x', brief: 'y' });
  await f.core.event({ id: 'worker-1' }, { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: '我做到一半' }] } } });
  await f.core.event({ id: 'worker-1' }, { type: 'turn/end', data: { reason: { kind: 'completed' } } });
  assert.match(f.prompts.at(-1).text, /还没有调用 work_report/);
  await f.core.event({ id: 'worker-1' }, { type: 'turn/end', data: { reason: { kind: 'completed' } } });
  assert.equal(f.results[0].task.status, 'failed'); assert.match(f.results[0].task.summary, /我做到一半/);
});

test('slots queue extra work, cancel stops a worker without a result message, and the queue moves on', async t => {
  const f = await fixture(t, { maxWorkers: 1 });
  await f.core.serveFront(f.agentFor('front'));
  await run(f, 'front', 'dispatch_work', { title: 'one', brief: '1' });
  assert.match(await run(f, 'front', 'dispatch_work', { title: 'two', brief: '2' }), /排队中/);
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
  await run(f, 'front', 'dispatch_work', { title: 'slow', brief: 's' });
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
  await run(f, 'front', 'dispatch_work', { title: 'q', brief: 'q' });
  await run(f, 'worker-1', 'work_ask', { question: '用哪个日期格式？' });
  assert.equal(f.results[0].message.kind, 'question'); assert.match(f.results[0].text, /\[task\.question\].*日期格式/s);
  assert.equal(Object.values(f.state.tasks)[0].status, 'running');
});

test('while reporting an unknown or failed result the front cannot redo the work on its own', async t => {
  const f = await fixture(t, { timeoutMs: 20 });
  await f.core.serveFront(f.agentFor('front'));
  await run(f, 'front', 'dispatch_work', { title: 'budget', brief: 'b' });
  await new Promise(resolve => setTimeout(resolve, 60));
  const failed = Object.values(f.state.tasks)[0];
  assert.match(f.results[0].text, /不要自行重做/);
  f.core.resultTask = failed;
  assert.match(await run(f, 'front', 'dispatch_work', { title: '重跑 budget', brief: 'b' }), /不能在汇报.*自行重做/);
  assert.equal(Object.keys(f.state.tasks).length, 1);
  // Once the person asks again, the next turn reports no result and dispatch works.
  f.core.resultTask = null;
  assert.match(await run(f, 'front', 'dispatch_work', { title: '重跑 budget', brief: 'b' }), /T-/);
  assert.equal(Object.keys(f.state.tasks).length, 2);
});

test('a file listed twice, or listed and staged under the same name and content, is delivered once', async t => {
  const f = await fixture(t);
  await f.core.serveFront(f.agentFor('front'));
  await run(f, 'front', 'dispatch_work', { title: 'x', brief: 'y' });
  const task = Object.values(f.state.tasks)[0];
  await writeFile(path.join(task.dir, 'outputs', 'a.txt'), '1');
  await run(f, 'worker-1', 'work_report', { status: 'done', summary: 'ok', files: ['outputs/a.txt', path.join(task.dir, 'outputs', 'a.txt'), './outputs/a.txt'] });
  assert.deepEqual(task.artifacts.map(file => file.name), ['a.txt']);
});
