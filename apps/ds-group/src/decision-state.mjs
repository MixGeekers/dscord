/**
 * What a decision model reads. The node's own records keep Matrix IDs, name provenance and delivery receipts for
 * bookkeeping; the model only needs who said what to whom, in order, and what this Bot is busy with. People and
 * messages become short references (P1, M1), and the whole state fits a character budget, oldest history first to
 * go, so a long or busy conversation cannot push a request past the service's context limit (TypeSafe Jev reads at
 * most 32k tokens per question by default).
 */
export const DECISION_STATE_CHARS = 20_000;
const TEXT_CHARS = 1200;
const SHORT_TEXT_CHARS = 300;
const QUOTE_CHARS = 300;
const SUMMARY_CHARS = 200;
const INSTRUCTION_CHARS = 2000;

/** Cut at a code point boundary and say how long the original was. */
export function clipText(value, max) {
  const text = typeof value === 'string' ? value : '';
  if (text.length <= max) return text;
  const end = /[\ud800-\udbff]/.test(text[max - 1]) ? max - 1 : max;
  return `${text.slice(0, end)}…（原文 ${text.length} 字，已截断）`;
}

const list = value => Array.isArray(value) ? value : [];
const bodyOf = message => message?.body ?? message?.text ?? message?.content?.body ?? '';
const eventIdOf = message => message?.eventId || message?.source?.eventId || null;

export function decisionState(input = {}, { maxChars = DECISION_STATE_CHARS } = {}) {
  const people = new Map();
  const selfId = input.self?.id || null;
  const person = (id, name, kind) => {
    const key = id || name;
    if (!key) return undefined;
    let entry = people.get(key);
    if (!entry) {
      entry = { ref: `P${people.size + 1}`, name: name || id, ...(key === selfId ? { self: true } : {}) };
      people.set(key, entry);
    } else if (name && entry.name === key) entry.name = name;
    if (kind && kind !== 'unknown' && !entry.kind) entry.kind = kind;
    return entry.ref;
  };
  // Current names first: a message keeps the label its sender had then, the roster says who they are now.
  person(selfId, input.self?.name, 'bot');
  for (const member of list(input.context?.members)) person(member?.id, member?.name, member?.kind);

  const refs = new Map();
  const ordered = [...list(input.recentMessages)];
  const current = new Set(list(input.currentMessages).map(eventIdOf).filter(Boolean));
  for (const message of list(input.currentMessages)) {
    const id = eventIdOf(message);
    if (!id || !ordered.some(item => eventIdOf(item) === id)) ordered.push(message);
  }
  const all = [...ordered, ...list(input.pending), ...(input.newMessage ? [input.newMessage] : [])];
  for (const message of all) {
    const id = eventIdOf(message);
    if (id && !refs.has(id)) refs.set(id, `M${refs.size + 1}`);
  }
  const latest = Math.max(0, ...all.map(message => message?.source?.timestamp ?? message?.timestamp ?? 0).filter(Number.isFinite));
  const originals = new WeakMap();
  const compact = (message, isCurrent = false) => {
    const sender = message?.source?.sender || {};
    const replyTo = message?.source?.replyTo || message?.replyTo;
    const at = message?.source?.timestamp ?? message?.timestamp;
    const attachments = list(message?.attachments).map(file => file?.name || file?.filename || 'file');
    const to = list(message?.to).map(id => person(id)).filter(Boolean);
    const from = person(sender.id || message?.senderId, message?.senderName || sender.name, sender.kind || message?.senderKind);
    const result = { ...(refs.has(eventIdOf(message)) ? { ref: refs.get(eventIdOf(message)) } : {}),
      ...(from ? { from } : {}),
      text: clipText(bodyOf(message), TEXT_CHARS),
      ...(latest && Number.isFinite(at) && at > 0 ? { secondsBeforeLatest: Math.max(0, Math.round((latest - at) / 1000)) } : {}),
      ...(replyTo ? { replyTo: refs.get(replyTo) || 'earlier' } : {}),
      ...(to.length ? { to } : {}),
      ...(attachments.length ? { attachments } : {}),
      ...(message?.withdrawn ? { withdrawn: true } : {}),
      ...(message?.kind ? { kind: message.kind } : {}),
      ...(isCurrent ? { new: true } : {}) };
    originals.set(result, bodyOf(message));
    return result;
  };
  const quote = value => value?.body !== undefined && !refs.has(value.source?.eventId)
    ? { from: person(value.source?.sender?.id, value.source?.sender?.name, value.source?.sender?.kind), text: clipText(value.body, QUOTE_CHARS) }
    : undefined;

  const currentObjects = new Set(list(input.currentMessages));
  const messages = ordered.map(message => compact(message, currentObjects.has(message) || current.has(eventIdOf(message))));
  const context = input.context || {};
  const reply = quote(context.reply);
  const threadRoot = quote(context.threadRoot);
  const memoryView = input.memoryView?.available === false ? null : input.memoryView;
  const kernelWork = memoryView?.tasks || {};
  const workView = input.workView || {};
  const work = {
    ...(kernelWork.status || memoryView?.runtime?.status ? { status: kernelWork.status || memoryView.runtime.status } : {}),
    tasks: list(workView.tasks).slice(0, 5).map(task => ({ status: task.status, ...(task.stage ? { stage: task.stage } : {}),
      summary: clipText(task.summary, SUMMARY_CHARS) })),
    workers: [...list(kernelWork.workers), ...list(kernelWork.queue)].slice(0, 5).map(task => ({ title: clipText(task.title, SUMMARY_CHARS),
      stage: task.stage, ...(task.doing ? { doing: clipText(String(task.doing), SUMMARY_CHARS) } : {}) })),
    recentResults: list(workView.recentReceipts).slice(0, 3).map(item => ({ status: item.status,
      summary: clipText(item.summary, SUMMARY_CHARS), ...(list(item.artifacts).length ? { files: item.artifacts.length } : {}) })),
  };
  const self = input.self ? { ref: person(selfId, input.self.name, 'bot'),
    ...(input.self.role ? { role: input.self.role } : {}),
    ...(list(input.self.interests).length ? { interests: input.self.interests } : {}),
    ...(input.self.instructions ? { instructions: clipText(input.self.instructions, INSTRUCTION_CHARS) } : {}) } : undefined;
  const room = context.room ? { name: context.room.name, ...(context.room.topic ? { topic: context.room.topic } : {}), kind: context.room.kind } : undefined;

  const state = {
    ...(self ? { self } : {}),
    ...(room ? { room } : {}),
    people: {},
    ...(messages.length ? { messages } : {}),
    ...(reply ? { quotedReply: reply } : {}),
    ...(threadRoot ? { threadRoot } : {}),
    ...(input.phase ? { phase: input.phase } : {}),
    ...(input.pending ? { pending: list(input.pending).map(message => compact(message)) } : {}),
    ...(input.answering ? { answering: list(input.answering).map(text => clipText(text, TEXT_CHARS)) } : {}),
    ...(input.newMessage ? { newMessage: compact(input.newMessage) } : {}),
    ...(work.status || work.tasks.length || work.workers.length || work.recentResults.length ? { work } : {}),
    ...(memoryView?.memory !== undefined ? { memory: memoryView.memory } : {}),
    ...(input.trigger?.reason ? { trigger: input.trigger.reason } : {}),
  };
  const fill = () => { state.people = Object.fromEntries([...people.values()].map(({ ref, ...entry }) => [ref, entry])); };
  const size = () => { fill(); return JSON.stringify(state).length; };
  // Oldest history goes first; the messages being decided on always stay.
  let omitted = 0;
  while (size() > maxChars && state.messages?.length && !state.messages[0].new) { state.messages.shift(); omitted++; }
  if (omitted) state.earlierMessagesOmitted = omitted;
  if (size() > maxChars) for (const message of [...state.messages || [], ...state.pending || []]) message.text = clipText(originals.get(message), SHORT_TEXT_CHARS);
  if (size() > maxChars && state.work) delete state.work;
  if (size() > maxChars && state.memory !== undefined) delete state.memory;
  fill();
  return state;
}
