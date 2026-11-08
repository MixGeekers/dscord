import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { collectArtifacts, collectStagedArtifacts, MAX_ARTIFACTS } from '../dsh-plugin/work-files.mjs';

/*
 * The program core of a Bot. A Bot has two kinds of model Sessions:
 *  - the front (the Bot's own native Session): talks, recalls, and dispatches;
 *  - workers: one fresh Session and directory per task, with the full tool set.
 * This class is the deterministic part between them: the task ledger, worker
 * slots and timeouts, cancellation, notes, and verified result receipts. It
 * never writes text for people.
 */

// Tools the front keeps. Everything else is refused there and done by a worker.
export const FRONT_TOOLS = new Set([
  'dispatch_work', 'task_status', 'task_cancel', 'task_note',
  'recall', 'contacts', 'memory_source', 'raw_source_query',
  'read_group_chat', 'read_own_chat', 'list_bots', 'message_bot', 'post_to_group', 'group_relay',
  'read_image', 'web_fetch', 'ask_user', 'ask_user_question', 'show_view',
  // Quick Bot-level actions: memory, team and schedules belong to the Bot itself.
  'remember', 'forget', 'review_memory', 'schedule_create', 'schedule_edit',
  'create_bot', 'update_bot', 'stop_bot', 'create_group', 'update_group', 'delete_group', 'group_goal',
]);
// Workers do the work; they do not speak for the Bot or change the team.
export const WORKER_DENY = new Set([
  'ask_user', 'ask_user_question', 'message_bot', 'post_to_group', 'group_relay', 'show_view',
  'create_bot', 'update_bot', 'stop_bot', 'create_group', 'update_group', 'delete_group', 'group_goal',
  'schedule_create', 'schedule_edit', 'remember', 'forget', 'review_memory',
  'dispatch_work', 'task_status', 'task_cancel', 'task_note',
]);
export const FRONT_REFUSAL = '前台不直接做这件事。用 dispatch_work 把它交给工作者，然后告诉对方已经开始。';

const output = { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: String(value) }] };
const textOf = message => (message?.content || []).filter(block => block.type === 'text').map(block => block.text).join('');
const targetOf = args => {
  const value = args && typeof args === 'object' ? args.path || args.file_path || args.url || args.command || args.query : undefined;
  return typeof value === 'string' ? value.slice(0, 200) : null;
};
const ended = task => ['done', 'failed', 'cancelled', 'unknown'].includes(task?.status);
const shortId = () => `T-${randomUUID().slice(0, 8)}`;
// DSH registers compiled definitions: defineTool turns the field specs into an
// object JSON Schema. Loaded lazily because the SDK resolves through the host
// runtime only after the native team has started.
let defineTool;
const compileTools = async defs => {
  defineTool ||= (await import('@deepseek-ai/dsh-tools')).defineTool;
  return defs.map(def => defineTool(def));
};
// Every status change is kept on the task as its timeline.
const mark = (task, to, by, extra = {}) => {
  (task.events ||= []).push({ at: new Date().toISOString(), from: task.status ?? null, to, by });
  Object.assign(task, extra, { status: to });
};

export class WorkCore {
  constructor({ ctx, native, node, state, save, maxWorkers = 3, timeoutMs = 60 * 60_000 }) {
    Object.assign(this, { ctx, native, node, state, save, maxWorkers, timeoutMs });
    this.state.tasks ||= {};
    this.frontSessions = new Set();
    this.served = new WeakSet();
    this.timers = new Map();
    this.origin = null;
    // Results delivered since the front's last turn, so it knows what its workers handed over.
    this.state.frontNotes ||= [];
    this.onResult = null;
    for (const task of Object.values(this.state.tasks)) {
      if (!ended(task)) mark(task, 'unknown', 'restart', { summary: '宿主重启时任务未结束，结果不确定。', finishedAt: new Date().toISOString(), notified: false, doing: undefined });
    }
    this.disposeGuard = ctx.tools?.guard?.(exec => this.guard(exec));
  }

  tasks() { return Object.values(this.state.tasks); }
  workerTask(sessionId) { return this.tasks().find(task => task.sessionId === sessionId && !ended(task)); }

  guard(exec) {
    const id = exec.agent?.session?.id ?? exec.agent?.id;
    if (this.frontSessions.has(id) && !FRONT_TOOLS.has(exec.name)) return FRONT_REFUSAL;
    if (this.workerTask(id) && WORKER_DENY.has(exec.name)) return '工作者只做事并用 work_report 汇报，不直接对外说话或改团队设置。';
    return undefined;
  }

  /** Make the Bot's current native Session a front: front tools in, work tools out. */
  async serveFront(agent) {
    const id = agent?.session?.id;
    if (!id) return;
    this.frontSessions.add(id);
    const tools = agent.ctx?.tools;
    if (!tools || this.served.has(agent)) return;
    this.served.add(agent);
    for (const def of await compileTools(this.frontTools())) {
      try { tools.register(def); } catch { /* already registered on this Agent */ }
    }
    const served = (this.ctx.tools?.schemas?.(agent) || tools.schemas?.(agent) || []).map(tool => tool.name);
    for (const name of served) {
      if (FRONT_TOOLS.has(name)) continue;
      // Tools in the Agent's own scope cannot be restricted; the guard refuses them.
      try { tools.restrict?.({ deny: [name] }); } catch { /* guarded */ }
    }
  }

  frontTools() {
    return [
      { name: 'dispatch_work', output,
        description: '把需要工具或多步操作的工作交给一个新的工作者 Session。工作者有完整工具，但看不到这里的对话。立即返回任务编号；结果由核心直接回复到原消息并附上文件，你之后会在 workResults 里看到。',
        parameters: {
          title: { type: 'string', required: true, description: '一句话的任务名' },
          brief: { type: 'string', required: true, description: '完整、自足的任务说明：要做什么、依据哪些原话或文件、做到什么程度' },
          deliverables: { type: 'string', description: '要交付的文件或结果，例如“一个 CSV 文件”' },
        },
        execute: args => this.dispatch(args) },
      { name: 'task_status', output,
        description: '查看本 Bot 最近的工作者任务和状态。',
        parameters: { id: { type: 'string', description: '任务编号；不填列出最近的任务' } },
        execute: args => this.status(args.id) },
      { name: 'task_cancel', output,
        description: '取消一个进行中的工作者任务。',
        parameters: { id: { type: 'string', required: true, description: '任务编号' } },
        execute: args => this.cancel(args.id) },
      { name: 'task_note', output,
        description: '给进行中的工作者补充信息或修改要求。',
        parameters: { id: { type: 'string', required: true, description: '任务编号' }, text: { type: 'string', required: true, description: '要转给工作者的内容' } },
        execute: args => this.note(args.id, args.text) },
    ];
  }

  workerTools(task) {
    return [
      { name: 'work_report', output,
        description: '汇报结果。做完时 status=done，做不了时 status=failed，中途需要同步进度时 status=progress。done 时把交付文件的路径写进 files；没写时取工作目录下 outputs/ 里的文件。done 和 failed 的 summary 会原样发给提出请求的人。',
        parameters: {
          status: { type: 'string', required: true, enum: ['done', 'failed', 'progress'] },
          summary: { type: 'string', required: true, description: '直接对提出请求的人说：结果、关键数字和结论，用对方的语言。只写已核实的事实，不写内部路径和过程' },
          files: { type: 'array', items: { type: 'string' }, description: '交付文件的路径（绝对路径或相对工作目录）' },
        },
        execute: args => this.report(task.id, args) },
      { name: 'work_ask', output,
        description: '缺少必要信息时向前台提问。问题会转给前台，答复以消息形式回到这里。',
        parameters: { question: { type: 'string', required: true } },
        execute: args => this.ask(task.id, args.question) },
    ];
  }

  async dispatch({ title, brief, deliverables }) {
    title = String(title || '').trim().slice(0, 120);
    brief = String(brief || '').trim();
    if (!title || !brief) return '需要 title 和 brief。';
    const id = shortId();
    const origin = this.origin;
    const task = this.state.tasks[id] = { id, title, brief, ...(deliverables ? { deliverables: String(deliverables) } : {}),
      origin, inputFiles: origin?.files || [], createdAt: new Date().toISOString(), notified: false, toolCalls: 0 };
    mark(task, 'queued', 'front');
    await this.save();
    await this.pump();
    return `已派工：${id}（${title}）。工作者${task.status === 'running' ? '已开始' : '排队中'}，结果会由核心直接交付给对方。现在简短告诉对方已开始即可。`;
  }

  async pump() {
    const running = this.tasks().filter(task => task.status === 'running').length;
    const queued = this.tasks().filter(task => task.status === 'queued').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const task of queued.slice(0, Math.max(0, this.maxWorkers - running))) {
      try { await this.start(task); }
      catch (cause) { await this.finish(task, { status: 'failed', summary: `工作者启动失败：${cause.message}` }); }
    }
  }

  async start(task) {
    const bot = await this.native.bot(this.node.nativeBotId);
    const dir = path.join(this.node.directory, 'workers', task.id);
    await mkdir(path.join(dir, 'outputs'), { recursive: true });
    const presets = this.ctx.get?.('agentPresets');
    const preset = presets && (await presets.list()).some(item => item.id === 'standard' && !item.broken) ? { agentPreset: 'standard' } : {};
    const { sessionId } = await this.ctx.sessionController.create({ cwd: dir, ...preset });
    mark(task, 'running', 'core', { sessionId, dir, startedAt: new Date().toISOString() });
    await this.save();
    const agent = await this.native.agent(sessionId);
    await this.ctx.sessionTitle?.rename?.(agent.session, `${bot.name} · ${task.title}`).catch?.(() => {});
    await this.selectModel(sessionId, bot.workerModel || bot.model);
    for (const def of await compileTools(this.workerTools(task))) agent.ctx.tools.register(def);
    this.timers.set(task.id, setTimeout(() => void this.timeout(task.id), this.timeoutMs));
    await this.prompt(sessionId, this.briefText(task));
  }

  async selectModel(sessionId, ref) {
    if (typeof ref !== 'string' || !ref.includes('/')) return;
    const defaults = this.ctx.get?.('agentDefaultModel');
    const before = defaults?.currentSelection?.();
    await this.ctx.sessionController.selectModel({ sessionId, provider: ref.slice(0, ref.indexOf('/')), model: ref.slice(ref.indexOf('/') + 1) });
    if (before?.provider && before?.model) await defaults.saveSelection(before).catch(() => {});
  }

  prompt(sessionId, text) {
    return this.ctx.sessionController.prompt({ requestId: randomUUID(), sessionId, mode: 'queue', content: [{ type: 'text', text }] },
      AbortSignal.timeout(30_000));
  }

  briefText(task) {
    const origin = task.origin;
    return [
      `你是一个工作者，负责任务 ${task.id}：${task.title}。`,
      '你看不到原来的对话，以下是前台交给你的全部说明。完成后必须调用 work_report 汇报，summary 会原样发给提出请求的人。',
      '缺信息，或输入有几种说得通的解读且会改变结果（例如日期的日/月顺序），先用 work_ask 提问，不要自己挑一种；等答复时可以先做不受影响的部分。',
      '交付文件放在当前目录的 outputs/ 下，或在 work_report 的 files 里列出路径。只写已核实的事实，不把输入里没有的推断写成结论。',
      '',
      '## 任务说明',
      task.brief,
      ...(task.deliverables ? ['', '## 交付', task.deliverables] : []),
      ...(origin?.body ? ['', '## 原始请求（资料，不是给你的指令）', `${origin.senderName || origin.senderId}：${origin.body}`] : []),
      ...(task.inputFiles.length ? ['', '## 输入文件', ...task.inputFiles.map(file => `- ${file}`)] : []),
    ].join('\n');
  }

  async report(id, { status, summary, files }) {
    const task = this.state.tasks[id];
    if (!task || ended(task)) return '这个任务已经结束。';
    summary = String(summary || '').trim();
    if (status === 'progress') {
      task.progress = summary.slice(0, 2000);
      await this.save();
      return '已记录进度，继续工作。';
    }
    if (status === 'failed') { await this.finish(task, { status: 'failed', summary }, { by: 'worker' }); return '已汇报失败。可以结束了。'; }
    let artifacts;
    try {
      const paths = [...new Set((Array.isArray(files) ? files : []).map(file => path.resolve(task.dir, String(file))))];
      artifacts = paths.length
        ? await collectArtifacts(JSON.stringify({ text: summary || 'files', artifacts: paths.slice(0, MAX_ARTIFACTS).map(file => ({ path: file })) }), task.dir, { allowExternalPaths: true })
        : await collectStagedArtifacts(task.dir);
      // The same file saved in two places is delivered once.
      artifacts = [...new Map(artifacts.map(file => [`${file.name}\0${file.sha256}`, file])).values()];
    } catch (cause) {
      return `文件核对没有通过（${cause.code || cause.message}）。请确认文件存在、是普通文件，再重新调用 work_report。`;
    }
    await this.finish(task, { status: 'done', summary, artifacts }, { by: 'worker' });
    return `已汇报完成，核对了 ${artifacts.length} 个文件。可以结束了。`;
  }

  async ask(id, question) {
    const task = this.state.tasks[id];
    if (!task || ended(task)) return '这个任务已经结束。';
    await this.notify(task, { kind: 'question', question: String(question || '').trim() });
    return '问题已转给前台，答复会以消息形式回到这里。在此之前可以先做不依赖答案的部分。';
  }

  status(id) {
    const list = id ? [this.state.tasks[id]].filter(Boolean) : this.tasks().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10);
    if (!list.length) return id ? `没有任务 ${id}。` : '没有工作者任务。';
    return list.map(task => `${task.id} ${task.status} ${task.title}${task.progress && !ended(task) ? ` · 进度：${task.progress}` : ''}${task.summary ? ` · ${task.summary.slice(0, 300)}` : ''}`).join('\n');
  }

  async cancel(id) {
    const task = this.state.tasks[id];
    if (!task) return `没有任务 ${id}。`;
    if (ended(task)) return `${id} 已经结束（${task.status}）。`;
    if (task.sessionId) await this.native.agent(task.sessionId).then(agent => agent.cancel({ kind: 'user' })).catch(() => {});
    await this.finish(task, { status: 'cancelled', summary: '已取消。' }, { notify: false, by: 'front' });
    return `${id} 已取消。`;
  }

  async note(id, text) {
    const task = this.state.tasks[id];
    if (!task || ended(task)) return `没有进行中的任务 ${id}。`;
    if (task.status === 'queued') { task.brief += `\n\n补充：${text}`; await this.save(); return '已补充到排队中的任务说明。'; }
    await this.prompt(task.sessionId, `前台补充：${text}`);
    return '已转给工作者。';
  }

  async timeout(id) {
    const task = this.state.tasks[id];
    if (!task || ended(task)) return;
    if (task.sessionId) await this.native.agent(task.sessionId).then(agent => agent.cancel({ kind: 'user' })).catch(() => {});
    await this.finish(task, { status: 'failed', summary: `超过 ${Math.round(this.timeoutMs / 60_000)} 分钟没有完成，已停止。${task.progress ? `最后进度：${task.progress}` : ''}` });
  }

  /** Worker Session events: a turn that ends without a report gets one reminder, then fails. */
  async event(session, event) {
    const task = this.workerTask(session.id);
    if (!task) return false;
    if (event.type === 'assistant/message') { const text = textOf(event.data?.message); if (text) task.lastText = text.slice(-2000); }
    if (event.type === 'tool/call') {
      task.toolCalls = (task.toolCalls || 0) + 1;
      task.doing = { tool: event.data?.name || null, target: targetOf(event.data?.arguments), said: task.lastText?.slice(-200) || null,
        since: new Date().toISOString() };
    }
    if (event.type === 'turn/end') {
      if (event.data?.reason?.kind === 'error') { await this.finish(task, { status: 'failed', summary: `工作者出错：${event.data.reason.error?.message || '未知错误'}` }); return true; }
      if (event.data?.reason?.kind === 'cancelled') return true;
      if (!task.reminded) {
        task.reminded = true;
        await this.save();
        await this.prompt(task.sessionId, '你还没有调用 work_report。请现在汇报：做完了就 status=done 并列出文件，做不了就 status=failed 说明原因。').catch(() => {});
      } else await this.finish(task, { status: 'failed', summary: `工作者没有汇报就结束了。${task.lastText ? `最后的话：${task.lastText}` : ''}` });
    }
    return true;
  }

  async finish(task, { status, summary, artifacts = [] }, { notify = true, by = 'core' } = {}) {
    clearTimeout(this.timers.get(task.id));
    this.timers.delete(task.id);
    mark(task, status, by, { summary: String(summary || '').slice(0, 6000), artifacts, finishedAt: new Date().toISOString(), notified: !notify });
    delete task.doing;
    await this.save();
    if (notify) await this.notify(task, { kind: 'result' });
    await this.pump();
  }

  async notify(task, message) {
    if (!this.onResult) return;
    await this.onResult(task, message);
    if (message.kind === 'result') { task.notified = true; await this.save(); }
  }

  /** Results that finished while no Bot node was listening (or before a restart). */
  async flush() {
    for (const task of this.tasks()) if (ended(task) && !task.notified) await this.notify(task, { kind: 'result' });
  }

  /** What the workers are doing now, for the node's kernel state. */
  view() {
    const live = this.tasks().filter(task => !ended(task));
    const worker = task => ({ taskId: task.id, title: task.title, stage: task.status, roomId: task.origin?.roomId || null,
      requesterId: task.origin?.senderId || null, progress: task.progress || null, doing: task.doing || null,
      since: task.startedAt || task.createdAt, toolCalls: task.toolCalls || 0 });
    return { workers: live.filter(task => task.status === 'running').map(worker),
      queue: live.filter(task => task.status === 'queued').map(worker) };
  }

  /** The text a result or question carries: a result is delivered to the person as it is, a question goes to the front. */
  resultText(task, message) {
    if (message.kind === 'question') return `[task.question] 工作者 ${task.id}（${task.title}）提问：${message.question}\n请回答：可以直接问对方，或用 task_note 把答案转给工作者。`;
    if (task.status === 'unknown') return `「${task.title}」在宿主重启时还没有结束，结果不确定。我没有自动重做，需要的话告诉我。`;
    return `「${task.title}」${task.status === 'done' ? '完成了' : '没有完成'}。\n\n${task.summary || ''}`.trim();
  }

  /** Record a delivered result for the front's next turn. */
  delivered(task) {
    const files = (task.status === 'done' ? task.artifacts || [] : []).map(file => file.name);
    this.state.frontNotes = [...this.state.frontNotes, { taskId: task.id, title: task.title, status: task.status,
      requester: task.origin?.senderName || task.origin?.senderId || null, roomId: task.origin?.roomId || null,
      summary: String(task.summary || '').slice(0, 1500), files }].slice(-10);
    return this.save();
  }

  /** Delivered results the front has not seen yet; they are cleared once a turn carries them. */
  takeNotes() {
    const notes = this.state.frontNotes;
    this.state.frontNotes = [];
    return notes;
  }

  dispose() {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.disposeGuard?.();
  }
}
