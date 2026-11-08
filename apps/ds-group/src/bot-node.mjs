import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { MatrixClient } from './matrix-client.mjs';
import { ContactBook, MAX_ASK_DEPTH } from './contact-book.mjs';
import { localPath, packageRoot } from './paths.mjs';
import { NodeStore } from './node-store.mjs';
import { NodeFiles, eventAttachments } from './node-files.mjs';
import { boundTaskRequest } from './node-request.mjs';
import { NodeDelivery, createDeliveryClient } from './node-delivery.mjs';
import { normalizeDelivery } from './delivery-policy.mjs';
import { runtimeSettings } from '../scripts/runtime-config.mjs';
import { createNodeWorkClient } from './node-work.mjs';
import { conversationContext, messageSource, speakerOf, threadOf } from './message-context.mjs';
import { normalizeAttentionConfig, attentionModeFor, attentionListens, sameAttention, reliableAttentionRoute, attentionMessage, attentionConflict,
  participationDelay, trailingBotTurns } from './attention.mjs';
import { ATTENTION_POLICY_VERSION, DecisionError, validateDecision, createOpenAIDecisionProvider, turnQuestion } from './decision-provider.mjs';

// A person often splits one thought over several quick messages. The decision
// model judges whether they are done (WAIT or REPLY), and whether a message that
// arrives while the front is answering belongs to that answer (JOIN). Without a
// decision model the next message is awaited BURST_SETTLE_MS, and a follow-up
// joins an answer that has not used tools yet.
export const BURST_SETTLE_MS = 2000;
export const BURST_WAIT_MS = 6000;
export const BURST_MAX_WAIT_MS = 15000;

const metadataOf = event => event.content?.['org.ds_group'] || {};
const digest = value => createHash('sha256').update(value).digest('hex');
const publicAttachment = ({ id, name, mimeType, size, sha256, contentUri, source }) => ({ id, name, mimeType, size, sha256, contentUri, ...(source ? { source } : {}) });
const uniqueAttachments = values => [...new Map(values.filter(value => value?.id).map(value => [value.id, publicAttachment(value)])).values()];
const legacyBotRoles = new Map([
  ['finance', { role: '财务', duties: '财务核算、预算和金额核对' }],
  ['hr', { role: '人事', duties: '人事、入职安排和人员事项协调' }],
]);
const temporaryTransferError = error => error.networkError === true || ['TimeoutError', 'AbortError'].includes(error.name)
  || error.status >= 500 || [408, 429].includes(error.status);
const sleep = (ms, signal) => new Promise(resolve => {
  if (signal?.aborted) { resolve(); return; }
  const finish = () => { clearTimeout(timer); signal?.removeEventListener('abort', finish); resolve(); };
  const timer = setTimeout(finish, ms);
  signal?.addEventListener('abort', finish, { once: true });
});
async function attentionCall(operation, timeoutMs, parentSignal) {
  const local = new AbortController();
  const signal = parentSignal ? AbortSignal.any([parentSignal, local.signal]) : local.signal;
  const timer = setTimeout(() => local.abort(new DecisionError('ATTENTION_TIMEOUT')), timeoutMs);
  let interrupted;
  try {
    const interruption = new Promise((resolve, reject) => {
      interrupted = () => reject(local.signal.aborted ? new DecisionError('ATTENTION_TIMEOUT') : new DecisionError('ATTENTION_ABORTED'));
      if (signal.aborted) interrupted(); else signal.addEventListener('abort', interrupted, { once: true });
    });
    return await Promise.race([Promise.resolve().then(() => operation(signal)), interruption]);
  } finally { clearTimeout(timer); signal.removeEventListener('abort', interrupted); }
}

const SPOKEN_ATTENTION_MS = 10 * 60_000;
const STRUCTURED = /^\{\s*"(?:text|delivery|artifacts)"\s*:/;

/** Escape quotes and raw line breaks inside JSON strings: a quote ends a string only before , : } ] or the end. */
export function repairJsonStrings(source) {
  let out = '';
  let inString = false;
  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (!inString) { out += char; if (char === '"') inString = true; continue; }
    if (char === '\\') { out += char + (source[index + 1] ?? ''); index++; continue; }
    if (char === '\n') { out += '\\n'; continue; }
    if (char === '\r') { out += '\\r'; continue; }
    if (char === '"') {
      let ahead = index + 1;
      while (/\s/.test(source[ahead] ?? '')) ahead++;
      const next = source[ahead];
      if (!next || ',:}]'.includes(next)) { out += char; inString = false; } else out += '\\"';
      continue;
    }
    out += char;
  }
  return out;
}

export function parseBotOutput(raw, participants, { ignoreDelivery = false } = {}) {
  if (typeof raw !== 'string' || !raw.trim()) throw new Error('Bot returned an empty response');
  const text = raw.trim();
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const source = fenced ? fenced[1] : text;
  let parsed;
  try { parsed = JSON.parse(source); }
  catch {
    // Models often leave quotes inside a string unescaped. A reply that is plainly the
    // delivery protocol must not reach the room as raw JSON.
    if (!STRUCTURED.test(source)) return { text };
    try { parsed = JSON.parse(repairJsonStrings(source)); }
    catch { throw new Error('Structured Bot response is not valid JSON'); }
  }
  // Plain JSON data and scalar answers are chat content. Only explicit delivery
  // fields opt into the text/delivery protocol.
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)
    || !['text', 'artifacts', 'delivery'].some(key => Object.hasOwn(parsed, key))) return { text };
  if (typeof parsed.text !== 'string' || !parsed.text.trim()) throw new Error('Structured Bot response requires non-empty text');
  if (parsed.text.length > 16000) throw new Error('Bot response is too long');
  return { text: parsed.text.trim(), ...(ignoreDelivery || parsed.delivery === undefined ? {} : { delivery: normalizeDelivery(parsed.delivery, participants) }) };
}

export function deliveriesFor(event, output, botId, participants, seed = event.event_id) {
  const meta = metadataOf(event);
  // A worker's result for another Bot's request answers that request, as the reply to it would have.
  if (meta.workerTask && meta.answers) {
    const request = { ...event, event_id: meta.answers.eventId, sender: meta.answers.sender,
      content: { ...event.content, 'org.ds_group': meta.answers.meta } };
    // The request was admitted from that Bot; its roster entry may not be loaded again yet after a restart.
    const known = participants.some(person => person.id === request.sender && person.kind === 'bot')
      ? participants : [...participants.filter(person => person.id !== request.sender), { id: request.sender, kind: 'bot' }];
    return deliveriesFor(request, output, botId, known, event.event_id);
  }
  const hop = Number.isInteger(meta.hop) && meta.hop >= 0 ? meta.hop : 0;
  // Requests to other Bots this turn made with ask_bot, each in the room the node picked for it.
  const asks = output.asks || [];
  // hop counts how many times the work was passed from Bot to Bot; replies and results keep it.
  if (hop > MAX_ASK_DEPTH || (asks.length && hop >= MAX_ASK_DEPTH)) throw new Error('Collaboration hop limit reached');
  const taskId = typeof meta.taskId === 'string' && meta.taskId ? meta.taskId : `task-${digest(event.event_id).slice(0, 24)}`;
  const requestedByBot = participants.some(p => p.kind === 'bot' && p.id === event.sender);
  const originSenderId = requestedByBot && typeof meta.originSenderId === 'string' ? meta.originSenderId : event.sender;
  const originRoomId = requestedByBot && typeof meta.originRoomId === 'string' ? meta.originRoomId : event.room_id;
  const originEventId = requestedByBot && typeof meta.originEventId === 'string' ? meta.originEventId : event.event_id;
  const sourceThreadRootId = threadOf(event) || undefined;
  // The origin thread survives peer rooms independently of the actual thread
  // used for this hop. Human sender metadata cannot choose another origin.
  const originThreadRootId = requestedByBot
    ? typeof meta.originThreadRootId === 'string' && meta.originThreadRootId ? meta.originThreadRootId : undefined
    : sourceThreadRootId;
  const returnTo = requestedByBot && meta.kind === 'task.request'
    && meta.returnTo === event.sender ? meta.returnTo : undefined;
  const prefix = `ds-group-${digest(`${botId}\0${seed}`).slice(0, 40)}`;
  const isFinalResult = requestedByBot && ['task.result', 'task.failure'].includes(meta.kind) && !asks.length;
  // A reply that only says the work was handed to a worker is not the result another Bot waits for.
  const answering = returnTo && !asks.length && !output.accepted;
  const replyRoomId = isFinalResult ? originRoomId : event.room_id;
  const replyEventId = isFinalResult ? originEventId : event.event_id;
  const replyThreadRootId = isFinalResult ? originThreadRootId : sourceThreadRootId;
  const common = { taskId, originSenderId, originRoomId, originEventId, hop,
    ...(originThreadRootId ? { originThreadRootId } : {}),
    ...(output.delivery || meta.delivery ? { delivery: output.delivery || meta.delivery } : {}) };
  const replyRecipient = isFinalResult ? originSenderId : event.sender;
  const sourceAttachments = uniqueAttachments([...eventAttachments(event), ...(output.sourceAttachments || [])]);
  const attachments = uniqueAttachments(output.attachments || []).filter(file => !asks.length
    || !sourceAttachments.some(source => source.sha256 === file.sha256 && source.name === file.name));
  // The asked Bot's files go to the human only with a final answer: a reply that hands
  // the result to a worker leaves the files to the worker's delivery.
  const replyAttachments = attachments.length ? attachments
    : isFinalResult && !output.failure && !output.accepted ? uniqueAttachments(output.resultAttachments || eventAttachments(event)) : [];
  const result = [{ roomId: replyRoomId, body: output.text, options: {
    ...common, replyTo: replyEventId, transactionId: `${prefix}-reply`, to: answering ? [returnTo] : [],
    ...(replyThreadRootId ? { threadRootId: replyThreadRootId } : {}),
    deliveryRole: output.controlOnly ? 'control' : asks.length || output.accepted ? 'ack' : returnTo ? 'peer' : 'final',
    kind: answering ? output.failure ? 'task.failure' : 'task.result' : 'reply',
    ...(replyAttachments.length ? { attachments: replyAttachments } : {}),
    mentions: { users: [], roles: [], everyone: false, here: false, replyUserId: replyRecipient,
      roleUsers: [], everyoneUsers: [], hereUsers: [] },
    mMentions: { user_ids: replyRecipient === botId ? [] : [replyRecipient] },
  } }];
  const askedFiles = uniqueAttachments([...sourceAttachments, ...attachments]);
  for (const [index, ask] of asks.entries()) {
    result.push({ roomId: ask.roomId, body: ask.body, options: {
      ...common, hop: hop + 1, transactionId: `${prefix}-ask-${index + 1}`, to: [ask.to], returnTo: botId, kind: 'task.request',
      // The asked Bot, also on file parts that do not notify it (their to is empty); not sent to Matrix.
      deliveryRole: 'delegate', askTo: ask.to,
      ...(event.room_id === ask.roomId ? { replyTo: event.event_id,
        ...(sourceThreadRootId ? { threadRootId: sourceThreadRootId } : {}) } : {}),
      ...(askedFiles.length || ask.attachments?.length ? { attachments: uniqueAttachments([...askedFiles, ...(ask.attachments || [])]) } : {}),
      mentions: { users: [ask.to], roles: [], everyone: false, here: false },
      mMentions: { user_ids: [ask.to] },
    } });
  }
  return result.flatMap(delivery => {
    const files = delivery.options.attachments || [];
    if (files.length <= 10) return [delivery];
    const batches = [];
    for (let offset = 0; offset < files.length; offset += 10) batches.push(files.slice(offset, offset + 10));
    return batches.map((batch, index) => {
      const finalPart = index === batches.length - 1;
      const notify = delivery.options.to.length ? finalPart : index === 0;
      return { ...delivery, body: `${delivery.body}\n\n附件 ${index + 1}/${batches.length}`, options: { ...delivery.options,
        attachments: batch, transactionId: `${delivery.options.transactionId}-part-${index + 1}`,
        fileBatch: { id: delivery.options.transactionId, index: index + 1, total: batches.length },
        to: finalPart ? delivery.options.to : [],
        ...(!notify ? { mentions: { users: [], roles: [], everyone: false, here: false }, mMentions: { user_ids: [] } } : {}),
      } };
    });
  });
}

export class BotNode {
  constructor({ participant, participants, roomId, matrix, store, bridge, heartbeat, files, tasks, delivery, roster, work, pollTimeout = 10000,
    transferAttempts = 3, transferRetryDelayMs = 500, controlIntervalMs = 500, onError = console.error,
    attention = {}, decisionProvider, readAttentionView, observe, executionMode, nativeBinding, localBots }) {
    this.participant = participant;
    this.participants = participants;
    this.roomId = roomId;
    this.matrix = matrix;
    this.store = store;
    this.bridge = bridge;
    this.sendHeartbeat = heartbeat;
    this.files = files;
    this.tasks = tasks;
    this.roster = roster;
    this.work = work;
    if (executionMode !== undefined && !['native', 'scoped'].includes(executionMode)) throw new RangeError('Invalid Bot execution mode');
    if (nativeBinding && (typeof nativeBinding.nativeBotId !== 'string' || nativeBinding.botId && nativeBinding.botId !== participant.id
      || executionMode === 'scoped')) throw new Error('Native Bot binding does not match this node');
    this.executionMode = executionMode || (nativeBinding ? 'native' : undefined);
    this.nativeBinding = nativeBinding;
    this.roomRosters = new Map();
    this.roomRosterTimes = new Map();
    // This Bot's own contact book; every route to another Bot is looked up here.
    this.contacts = new ContactBook({ db: store.db, self: participant, people: () => this.participants, local: localBots });
    this.transferAttempts = transferAttempts;
    this.transferRetryDelayMs = transferRetryDelayMs;
    this.controlIntervalMs = controlIntervalMs;
    this.reconciled = new Set();
    this.pollTimeout = pollTimeout;
    this.onError = onError;
    this.runtimeId = randomUUID();
    this.controller = new AbortController();
    this.state = 'idle';
    this.lastError = null;
    this.processing = null;
    const { revision = 0, ...attentionConfig } = attention;
    this.attention = normalizeAttentionConfig(attentionConfig);
    this.attentionRevision = revision;
    this.attentionEpoch = 0;
    this.decisionProvider = decisionProvider;
    this.readAttentionView = readAttentionView || (bridge.readAttentionView ? (input, options) => bridge.readAttentionView(input, options) : undefined);
    this.observe = observe || (bridge.observe ? (input, options) => bridge.observe(input, options) : undefined);
    this.lastObservationError = null;
    this.delivery = new NodeDelivery({ store, participant, participants, matrix, client: delivery,
      tasks: tasks ? { ...tasks, control: (id, options = {}) => this.control(id, options.signal) } : undefined,
      updateTask: (item, value) => this.taskUpdate(item, value), flushTasks: () => this.flushTaskUpdates(),
      ingest: events => this.ingestEvents(events) });
  }

  configureAttention(patch, { revision = patch?.revision } = {}) {
    const { revision: ignored, ...changes } = patch || {};
    const next = normalizeAttentionConfig(changes, this.attention);
    if (revision !== undefined && (!Number.isSafeInteger(revision) || revision < 0)) throw new RangeError('Invalid attention revision');
    if (revision !== undefined && revision < this.attentionRevision) return { ...this.attention, revision: this.attentionRevision };
    if (revision !== undefined && revision === this.attentionRevision) {
      if (JSON.stringify(next) !== JSON.stringify(this.attention)) throw new Error('Attention revision already has a different configuration');
      return { ...this.attention, revision: this.attentionRevision };
    }
    if (!sameAttention(this.attention, next)) this.store.settleAttention('mode_changed');
    this.attention = next;
    this.attentionRevision = revision ?? this.attentionRevision + 1;
    this.attentionEpoch++;
    if (this.started && !this.attending && (this.observe || attentionListens(next))) this.attending = this.attentionLoop();
    return { ...this.attention, revision: this.attentionRevision };
  }

  setDecisionProvider(provider) {
    if (provider !== undefined && provider !== null && typeof provider.decide !== 'function') throw new TypeError('Invalid decision provider');
    this.decisionProvider = provider || undefined;
    this.decisionHealth = null;
    this.attentionEpoch++;
    return this.attentionStatus();
  }

  wakeAttention(reason, scope = {}) { return this.store.wakeAttention(reason, scope); }

  attentionStatus() {
    const snapshot = this.store.attentionSnapshot();
    const providerHealth = this.decisionHealth || this.decisionProvider?.health?.() || {};
    const configured = Boolean(this.decisionProvider && this.decisionProvider.configured !== false);
    const health = providerHealth.health || (configured ? 'unknown' : 'unconfigured');
    return { mode: this.attention.mode, rooms: this.attention.rooms, revision: this.attentionRevision,
      activity: this.state === 'thinking' ? 'working' : this.sendingAttention ? 'speaking' : snapshot.queue.waiting ? 'waiting' : 'listening',
      provider: { id: this.decisionProvider?.id || null, model: this.decisionProvider?.model || null, configured,
        available: !configured || ['error', 'unconfigured'].includes(health) ? false : health === 'ok' ? true : null, health,
        lastErrorCode: providerHealth.lastErrorCode || null, lastSuccessAt: providerHealth.lastSuccessAt || null },
      ...snapshot, ...(this.lastObservationError ? { observationError: this.lastObservationError } : {}) };
  }

  /** What the responder is doing now: replying to one request, deciding whether to speak, or idle. */
  responderStatus() {
    if (this.state === 'thinking' && this.replying) return { state: 'replying', ...this.replying };
    if (this.store.attentionSnapshot().queue.evaluating) return { state: 'deciding', roomId: null, requesterId: null, since: null };
    return { state: this.state === 'offline' ? 'offline' : 'idle', roomId: null, requesterId: null, since: null };
  }

  /**
   * One timeline, newest first: requests taken on, attention decisions, task
   * stage changes and exchanges with other Bots, all timed in milliseconds.
   */
  timeline({ before, limit = 50 } = {}, tasks = []) {
    limit = Math.max(1, Math.min(200, Number(limit) || 50));
    const cutoff = before ?? Number.MAX_SAFE_INTEGER;
    const taskItems = tasks.filter(task => !task.joined).flatMap(task => (task.events || []).map((event, index) => ({
      id: `task:${task.id}:${index}`, kind: 'task', at: Date.parse(event.at) || 0, taskId: task.id, title: task.title || '',
      from: event.from ?? null, to: event.to, by: event.by || null, roomId: task.origin?.roomId || null, peerId: task.origin?.senderId || null })))
      .filter(item => item.at < cutoff);
    const exchanges = this.contacts.view({ limit, before: cutoff }).exchanges.map(exchange => ({ id: `exchange:${exchange.id}`, kind: 'exchange',
      at: exchange.at, direction: exchange.direction, peerId: exchange.peerId, roomId: exchange.roomId, status: exchange.status,
      taskId: exchange.taskId || null, detail: exchange.detail || null }));
    const items = [...this.store.recentRequests({ before: cutoff, limit }), ...this.store.recentDecisions({ before: cutoff, limit }), ...taskItems, ...exchanges]
      .sort((a, b) => b.at - a.at || a.id.localeCompare(b.id));
    const page = items.slice(0, limit);
    return { items: page, next: items.length > limit ? page.at(-1).at : null };
  }

  async flushObservations() {
    if (!this.observe) return true;
    if (Date.now() < (this.observationRetryAt || 0)) return false;
    if (this.observing) return this.observing;
    this.observing = (async () => {
      for (let batch = this.store.observationBatch(); batch.events.length; batch = this.store.observationBatch()) {
        try {
          await attentionCall(signal => this.observe({ botId: this.participant.id, events: batch.events.filter(event => !metadataOf(event).workerTask),
            cursor: batch.cursor, watermark: batch.watermark,
            rooms: Object.fromEntries([...new Set(batch.events.map(event => event.room_id))].map(roomId => [roomId, this.roomContextFor(roomId)])),
            eventRooms: Object.fromEntries(batch.events.map(event => [event.event_id, this.store.roomContextForEvent(event)])),
            sourceDispositions: this.store.sourceDispositions(batch.events),
          }, { signal }), this.attention.providerTimeoutMs, this.controller.signal);
          this.store.acknowledgeObservation(batch.after, batch.watermark.sequence);
          this.lastObservationError = null;
        } catch {
          this.lastObservationError = { code: 'ATTENTION_OBSERVATION_UNAVAILABLE', at: Date.now() };
          this.observationRetryAt = Date.now() + 1000;
          return false;
        }
      }
      return true;
    })();
    try { return await this.observing; }
    finally { this.observing = null; }
  }

  async processAttentionOnce() {
    if (this.decidingAttention) return false;
    this.decidingAttention = true;
    try {
      const observed = await this.flushObservations();
      if (!attentionListens(this.attention)) return Boolean(this.store.settleAttention('mention_mode'));
      const config = { ...this.attention };
      const epoch = this.attentionEpoch;
      const batch = this.store.nextAttentionBatch({ ...config, limit: config.historyLimit });
      if (!batch) return false;
      config.mode = attentionModeFor(config, batch.roomId);
      if (config.mode === 'mention') return Boolean(this.store.settleAttention('mention_mode', { roomId: batch.roomId }));
      const anchor = batch.events.at(-1);
      const recent = this.store.messagesThrough(batch.roomId, batch.watermark.sequence, config.historyLimit);
      const messages = recent.map(event => this.attentionMessageFor(event));
      const room = this.roomContextFor(batch.roomId);
      const sameRoom = event => event?.room_id === batch.roomId ? event : undefined;
      const context = conversationContext({ event: anchor, participants: this.participants, room,
        sourceRoom: this.store.roomContextForEvent(anchor),
        history: recent.filter(event => event.event_id !== anchor.event_id),
        reply: sameRoom(this.store.message(metadataOf(anchor).replyTo || anchor.content?.['m.relates_to']?.['m.in_reply_to']?.event_id)),
        replyRoom: this.store.roomContextForEvent(metadataOf(anchor).replyTo || anchor.content?.['m.relates_to']?.['m.in_reply_to']?.event_id),
        threadRoot: sameRoom(this.store.message(batch.threadRootId)), threadRootRoom: this.store.roomContextForEvent(batch.threadRootId) });
      const self = { id: this.participant.id, name: this.senderName(this.participant.id, room), role: this.roleOf(),
        interests: this.participant.interests || [], instructions: this.participant.instructions || '' };
      const workView = { runtime: { nodeState: this.state, nativeState: 'unknown' },
        ...this.store.attentionWorkView(batch.roomId, batch.threadRootId) };
      const input = { version: 1, policyVersion: ATTENTION_POLICY_VERSION, self, context,
        roomId: batch.roomId, threadRootId: batch.threadRootId, watermark: batch.watermark, eventIds: batch.eventIds,
        trigger: { reason: batch.reason, expiresAt: batch.expiresAt },
        currentMessages: batch.events.map(event => this.attentionMessageFor(event)), recentMessages: messages, workView };
      const id = `attention-${randomUUID()}`;
      this.store.beginAttentionDecision(id, batch, input);
      let providerAttempted = false;
      try {
        if (!observed) throw new DecisionError('ATTENTION_OBSERVATION_UNAVAILABLE');
        if (this.readAttentionView) {
          let view;
          try { view = await attentionCall(signal => this.readAttentionView({ botId: this.participant.id, roomId: batch.roomId,
            threadRootId: batch.threadRootId, watermark: batch.watermark, eventIds: batch.eventIds,
            recentMessages: messages, self, workView }, { signal }), config.providerTimeoutMs, this.controller.signal); }
          catch { throw new DecisionError('ATTENTION_CONTEXT_UNAVAILABLE'); }
          input.memoryView = view ?? { available: false };
          // The durable input must include exactly the view used by the provider.
          this.store.db.prepare('UPDATE attention_decisions SET input_json=? WHERE id=?').run(JSON.stringify(input), id);
        } else {
          input.memoryView = { available: false };
          this.store.db.prepare('UPDATE attention_decisions SET input_json=? WHERE id=?').run(JSON.stringify(input), id);
        }
        if (!this.decisionProvider || this.decisionProvider.configured === false) throw new DecisionError('ATTENTION_PROVIDER_UNCONFIGURED');
        providerAttempted = true;
        const result = validateDecision(await attentionCall(signal => this.decisionProvider.decide(input, { signal }),
          config.providerTimeoutMs, this.controller.signal));
        if (epoch === this.attentionEpoch) this.decisionHealth = { health: 'ok', lastSuccessAt: Date.now(), lastErrorCode: null };
        let outcome;
        let evidence;
        if (epoch !== this.attentionEpoch) outcome = 'configuration_changed';
        else if (Date.now() >= batch.expiresAt) outcome = 'expired';
        else if (config.mode === 'shadow') outcome = 'shadow';
        else if (result.action === 'SPEAK') {
          const blocked = attentionConflict({ botId: this.participant.id, eventIds: batch.eventIds }, anchor,
            this.store.messagesAfter(batch.roomId, batch.watermark.sequence), this.participants);
          if (blocked) outcome = blocked;
          else if (trailingBotTurns(messages.filter(message => (message.source.threadRootId || null) === batch.threadRootId)) >= config.maxBotTurns) outcome = 'bot_turn_limit';
          else {
            const peers = this.participants.filter(person => !room.members?.length || room.members.includes(person.id));
            const delay = participationDelay({ botId: this.participant.id, eventId: batch.eventIds[0], participants: peers,
              recentMessages: messages, coordinationMs: config.coordinationMs });
            evidence = { kind: 'natural', botId: this.participant.id, decisionId: id, eventIds: batch.eventIds,
              sourceEventIds: messages.filter(message => !message.withdrawn).map(message => message.eventId),
              workStateVersion: workView.stateVersion,
              // The decision window has passed: from here the answer only waits for this Bot's own queue,
              // which must not silently drop it. A newer turn in the conversation still supersedes it.
              watermark: batch.watermark, expiresAt: batch.expiresAt, speakBy: Date.now() + SPOKEN_ATTENTION_MS,
              notBefore: Math.max(Date.now() + delay, (this.lastAttentionSpokeAt || 0) + config.cooldownMs),
              context: { ...context, attention: { decisionId: id, watermark: batch.watermark, eventIds: batch.eventIds,
                participationOnly: true, memoryView: input.memoryView, workView } },
              history: messages.filter(message => message.eventId !== anchor.event_id) };
          }
        }
        this.store.finishAttentionDecision(id, result, { outcome, evidence,
          waitMs: Math.min(result.waitMs || config.waitMs, config.waitTtlMs), waitTtlMs: config.waitTtlMs });
        if (evidence) this.delivery.register(anchor);
      } catch (error) {
        const code = error instanceof DecisionError ? error.code : 'ATTENTION_PROVIDER_ERROR';
        if (providerAttempted && epoch === this.attentionEpoch) this.decisionHealth = {
          health: 'error', lastSuccessAt: this.decisionHealth?.lastSuccessAt || null, lastErrorCode: code,
        };
        this.store.failAttentionDecision(id, code);
        this.onError(`Attention decision ended: ${code}`);
      }
      return true;
    } finally { this.decidingAttention = false; }
  }

  async attentionLoop() {
    while (!this.controller.signal.aborted) {
      try { if (!await this.processAttentionOnce()) await sleep(100, this.controller.signal); }
      catch { await sleep(500, this.controller.signal); }
    }
  }

  attentionSuppression(item) {
    const evidence = item?.attention;
    if (evidence?.kind !== 'natural' || evidence.deliveryAttempted) return undefined;
    if (this.store.roomContext(item.event.room_id).membership === 'leave') return 'room_left';
    if (this.store.withdrawnAttentionSource(evidence)) return 'source_withdrawn';
    // Once actual work has produced an effect, its result keeps the task route.
    if (item.response?.delegated || item.response?.toolCalls > 0 || item.response?.artifacts?.length) return undefined;
    if (attentionModeFor(this.attention, item.event.room_id) !== 'natural') return 'mode_changed';
    if (!this.decisionProvider || this.decisionProvider.configured === false) return 'provider_unavailable';
    if (Date.now() >= (evidence.speakBy ?? evidence.expiresAt)) return 'expired';
    return attentionConflict(evidence, item.event,
      this.store.messagesAfter(item.event.room_id, evidence.watermark.sequence), this.participants);
  }

  suppressAttention(item, reason) {
    if (item.status === 'generated') this.store.cancelDelivery(item.event_id);
    else this.store.failed(item.event_id, `Natural participation superseded: ${reason}`, 'cancelled');
    this.store.attentionOutcome(item.event_id, reason);
  }

  senderName(id, room) { return speakerOf(id, this.participants, room).name; }

  /**
   * The room a request to another Bot goes to: one both are in, preferring the asked message's room,
   * else a direct room this Bot opens and invites it to. Every request between Bots travels over Matrix.
   */
  async roomForAsk(event, to) {
    const shared = this.contacts.roomFor(to, [event.room_id, this.roomId]);
    if (shared) return shared;
    const created = await this.matrix.createRoom({ preset: 'trusted_private_chat', is_direct: true, invite: [to],
      name: `${this.participant.name || this.participant.id} · ${this.senderName(to) || to}` });
    // Recorded at once, so a retried delivery reuses the room instead of opening another.
    this.contacts.member(created.room_id, this.participant.id, 'join');
    this.contacts.member(created.room_id, to, 'invite');
    return created.room_id;
  }

  noteMembers(roomId, events) {
    for (const event of events) {
      if (event.type === 'm.room.member' && event.state_key) this.contacts.member(roomId, event.state_key, event.content?.membership, event.content?.displayname);
    }
  }

  roomContextFor(roomId) {
    const room = this.store.roomContext(roomId);
    const people = this.roomRosters.get(roomId);
    if (!people) return room;
    room.members = people.map(person => person.id);
    room.memberProfiles = { ...(room.memberProfiles || {}) };
    for (const person of people) if (!Object.hasOwn(room.memberProfiles, person.id)) {
      room.memberProfiles[person.id] = { id: person.id, displayname: typeof person.name === 'string' ? person.name : null,
        membership: 'join', observedAt: this.roomRosterTimes.get(roomId) || null, observedSequence: 0,
        eventTimestamp: null, eventId: null, source: 'room-directory' };
    }
    return room;
  }

  attentionMessageFor(event) {
    const source = messageSource(event, this.participants, this.store.roomContextForEvent(event));
    return { ...attentionMessage(event, this.participants), source, senderName: source.sender.name };
  }

  mergeRoomIdentity(person) {
    const previous = this.participants.find(existing => existing.id === person.id);
    if (previous && previous.kind !== person.kind && previous.kind !== 'unknown' && person.kind !== 'unknown') throw new Error('A room participant changed identity kind');
    if (!previous) { this.participants.push({ ...person, name: person.id }); return; }
    if (person.kind === 'unknown') return;
    for (const key of ['id', 'kind', 'ownerId', 'localpart', 'role', 'instructions']) if (person[key] !== undefined) previous[key] = person[key];
    if (person.identitySource !== undefined) previous.identitySource = person.identitySource;
  }

  roleOf(participant = this.participant) {
    return participant.role || legacyBotRoles.get(participant.localpart)?.role || '通用助手';
  }

  async refreshRoster() {
    if (!this.roster) return;
    if (this.refreshingRoster) return this.refreshingRoster;
    this.refreshingRoster = (async () => {
      const { participants } = await this.roster.read();
      if (!Array.isArray(participants) || participants.some(person => !person || typeof person.id !== 'string' || !person.id
        || typeof person.name !== 'string' || !['human', 'bot'].includes(person.kind))
        || new Set(participants.map(person => person.id)).size !== participants.length
        || !participants.some(person => person.id === this.participant.id && person.kind === 'bot')) {
        throw new Error('Core returned an invalid participant roster');
      }
      const existing = new Map(this.participants.map(person => [person.id, person]));
      if (participants.some(person => existing.has(person.id) && existing.get(person.id).kind !== 'unknown' && existing.get(person.id).kind !== person.kind)) {
        throw new Error('A registered participant changed identity kind');
      }
      const updated = participants.map(person => {
        const record = existing.get(person.id) || {};
        delete record.identitySource;
        for (const field of ['id', 'localpart', 'name', 'kind', 'ownerId', 'role', 'instructions']) {
          if (person[field] !== undefined) record[field] = person[field];
        }
        return record;
      });
      const home = this.participant.id.slice(this.participant.id.indexOf(':') + 1);
      for (const people of this.roomRosters.values()) for (const person of people) {
        if (person.id.slice(person.id.indexOf(':') + 1) !== home && !updated.some(existing => existing.id === person.id)) {
          updated.push(existing.get(person.id) || { ...person, name: person.id });
        }
      }
      this.participants.splice(0, this.participants.length, ...updated);
    })();
    try { await this.refreshingRoster; }
    finally { this.refreshingRoster = null; }
  }

  unknownParticipants(events) {
    const known = new Set(this.participants.map(person => person.id));
    const unknown = new Set();
    for (const event of events) {
      const meta = metadataOf(event);
      if (event.type !== 'm.room.message' || event.sender === this.participant.id
        || !Array.isArray(meta.to) || !meta.to.includes(this.participant.id)) continue;
      for (const id of [event.sender, meta.originSenderId, meta.returnTo, meta.delivery?.recipientId, meta.delivery?.originBotId, ...meta.to]) {
        if (typeof id === 'string' && !known.has(id)) unknown.add(id);
      }
    }
    return [...unknown];
  }

  async ensureParticipants(events) {
    if (!this.roster || !this.unknownParticipants(events).length) return;
    await this.refreshRoster();
    if (this.unknownParticipants(events).length) throw new Error('Message participants are not yet registered in the core roster');
  }

  routeOf(event) {
    // A worker result is the Bot's own core speaking to its front; nothing else from the Bot itself is routed.
    if (event.sender === this.participant.id && metadataOf(event).workerTask) return { kind: 'reliable', reason: 'worker_result' };
    return reliableAttentionRoute(event, { botId: this.participant.id, store: this.store, participants: this.participants });
  }

  /** The core hands a worker's result (or question) to the node as a local task.result message: results are delivered as they are, questions go to the front. */
  acceptWorkerResult(task, message, text) {
    const origin = task.origin;
    const eventId = message.kind === 'result' ? `$dscord-${task.id}-result` : `$dscord-${task.id}-q-${Date.now()}`;
    // Work done for another Bot's request goes back to that Bot as the answer to its request.
    const request = message.kind === 'result' ? this.store.message(origin.eventId) : undefined;
    const requestMeta = request ? metadataOf(request) : {};
    // The request was admitted as a Bot's task.request when it arrived; after a restart the room
    // roster may not be loaded yet, so the stored request is the evidence, not the current roster.
    const answers = requestMeta.kind === 'task.request' && requestMeta.returnTo === request.sender
      ? { eventId: request.event_id, sender: request.sender, meta: requestMeta } : undefined;
    const event = { type: 'm.room.message', event_id: eventId, room_id: origin.roomId, sender: this.participant.id,
      origin_server_ts: Date.now(), content: { msgtype: 'm.notice', body: text, 'org.ds_group': { kind: 'task.result', workerTask: task.id, workerKind: message.kind,
        originSenderId: origin.senderId, originRoomId: origin.roomId, originEventId: origin.eventId,
        ...(origin.threadRootId ? { originThreadRootId: origin.threadRootId } : {}), ...(answers ? { answers } : {}) } } };
    this.store.ingest([event], undefined, item => this.delivery.register(item), { route: candidate => this.routeOf(candidate),
      roomContext: roomId => this.roomContextFor(roomId) });
  }

  async ingestEvents(events, cursor) {
    await this.refreshRoster();
    if (this.work) {
      for (const roomId of new Set(events.map(event => event.room_id))) {
        try {
          const { participants } = await this.work.directory(roomId);
          this.roomRosters.set(roomId, participants);
          this.roomRosterTimes.set(roomId, Date.now());
          this.contacts.seeRoom(roomId, participants);
          for (const person of participants) this.mergeRoomIdentity(person);
        } catch (error) {
          // Preserve the sync position and inbox. Admission rechecks the exact sender before any work.
          this.onError(`Room work directory unavailable: ${error.message}`);
        }
      }
    } else await this.ensureParticipants(events);
    const ingested = this.store.ingest(events, cursor, event => {
      this.delivery.register(event);
      const route = this.store.item(event.event_id)?.attention;
      if (route?.reason === 'active_task_control' && route.sourceEventId) {
        this.store.requestLocalCancellation(route.sourceEventId, event.event_id, route.cancel ? 'cancelled' : 'requirements_updated');
        const original = this.store.item(route.sourceEventId);
        if (original) this.taskUpdate(original, { status: 'cancelled', stage: 'cancelled',
          summary: route.cancel ? '任务已取消' : '任务要求已更新，等待处理新要求' });
      }
    }, { route: event => this.routeOf(event),
      roomContext: roomId => this.roomContextFor(roomId) });
    void this.considerJoin().catch(error => this.onError(`Follow-up join check failed: ${error.message}`));
    return ingested;
  }

  async start() {
    await this.refreshRoster();
    const setup = await this.bridge.createBot({ botId: this.participant.id, name: this.participant.name,
      role: this.roleOf(),
      ...(this.participant.ownerId ? { ownerId: this.participant.ownerId } : {}),
      instructions: this.instructions(),
      ...(this.executionMode ? { mode: this.executionMode } : {}),
      ...(this.nativeBinding ? { nativeBinding: this.nativeBinding } : {}) });
    this.model = setup?.model;
    this.bridgeMode = setup?.mode || this.executionMode;
    await this.heartbeat();
    this.processing = this.processLoop();
    this.syncing = this.syncLoop();
    this.heartbeats = this.heartbeatLoop();
    this.started = true;
    if (this.observe || attentionListens(this.attention)) this.attending = this.attentionLoop();
    return this;
  }

  instructions() {
    const duties = this.participant.instructions || legacyBotRoles.get(this.participant.localpart)?.duties
      || '根据请求者的要求处理对话和工作，使用已有工具完成任务';
    return `你是 DS-Group 中独立的${this.participant.name}，身份 ${this.participant.id}。你的职责是${duties}。保留自己的经历并区分每个人的身份。\n`
      + '消息源附有发送者、房间、原消息、任务和回复关系。按这些关系回答当前发送者。\n'
      + '当前身份以每轮 event.botIdentity 为准。\n'
      + '你也是群聊中的正式成员，可以分享与自身身份、兴趣和经历相符的看法，参与生活和工作聊天。context.attention 表示本次是自然参与，沿当前话题自然接话，不必把每句话变成受理任务；旁听决策本身不构成新的工具或外部操作授权。\n'
      + '每轮输出一个 JSON 对象，格式为 {"text":"给请求者的回答"}。\n'
      + '使用宿主提供的文件与终端工具完成工作。附件已下载到任务工作目录，先实际读取内容，再计算或编辑，检查成果后交付。文件修改工作要生成可下载的新文件。最终回复使用 JSON，生成的文件列入 artifacts 数组，每项包含 path 和 name。\n'
      + '收到 kind=task.result 后，结合结果向原请求者总结并交付文件。';
  }

  async collectRoomEvents(roomId, joined) {
    const timeline = joined.timeline || {};
    const current = (timeline.events || []).map(event => ({ ...event, room_id: roomId }));
    if (!timeline.limited || !timeline.prev_batch) return current;
    const older = [];
    let token = timeline.prev_batch;
    const seenTokens = new Set();
    for (let page = 0; page < 100; page++) {
      if (seenTokens.has(token)) throw new Error('Matrix history pagination did not advance');
      seenTokens.add(token);
      const result = await this.matrix.request('GET', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/messages?dir=b&limit=100&from=${encodeURIComponent(token)}`);
      const chunk = result.chunk || [];
      const boundary = chunk.findIndex(event => this.store.hasEvent(event.event_id));
      older.push(...(boundary < 0 ? chunk : chunk.slice(0, boundary)));
      if (boundary >= 0 || !chunk.length || !result.end) {
        return [...older.reverse().map(event => ({ ...event, room_id: roomId })), ...current];
      }
      token = result.end;
    }
    throw new Error('Matrix history gap exceeded 100 pages; sync cursor preserved for inspection');
  }

  async syncOnce() {
    const response = await this.matrix.sync({ since: this.store.cursor(), timeout: this.pollTimeout });
    if (this.work) {
      for (const roomId of Object.keys(response.rooms?.invite || {})) this.store.noteInvitation(roomId);
      for (const roomId of [...Object.keys(response.rooms?.join || {}), ...Object.keys(response.rooms?.leave || {})]) this.store.finishInvitation(roomId);
      for (const invitation of this.store.pendingInvitations()) {
        try { await this.work.join(invitation.room_id); this.store.finishInvitation(invitation.room_id); }
        catch (error) {
          if (invitation.last_error !== error.message) this.onError(`Bot room invitation remains unaccepted: ${error.message}`);
          this.store.invitationFailed(invitation.room_id, error.message);
        }
      }
    }
    const events = [];
    for (const [roomId, room] of Object.entries(response.rooms?.join || {})) {
      this.store.noteRoomState(roomId, room.state?.events || []);
      this.store.noteRoomMembership(roomId, 'join');
      this.contacts.member(roomId, this.participant.id, 'join');
      this.noteMembers(roomId, [...(room.state?.events || []), ...(room.timeline?.events || [])]);
      events.push(...await this.collectRoomEvents(roomId, room));
    }
    for (const [roomId, room] of Object.entries(response.rooms?.leave || {})) {
      this.store.noteRoomState(roomId, room.state?.events || []);
      this.store.noteRoomMembership(roomId, 'leave');
      this.contacts.member(roomId, this.participant.id, 'leave');
      events.push(...(room.timeline?.events || []).map(event => ({ ...event, room_id: roomId })));
    }
    await this.ingestEvents(events, response.next_batch);
    if (this.tasks) {
      for (const event of events) {
        const item = this.store.item(event.event_id);
        if (item?.status === 'queued' && !this.store.task(event.event_id)) this.taskUpdate(item, { status: 'queued', stage: 'queued', summary: '等待处理' });
      }
      await this.flushTaskUpdates();
    }
    return events.length;
  }

  async syncLoop() {
    let delay = 500;
    while (!this.controller.signal.aborted) {
      try { await this.syncOnce(); delay = 500; }
      catch (error) {
        if (this.controller.signal.aborted) break;
        this.lastError = `Matrix sync failed: ${error.message}`;
        this.onError(this.lastError);
        await sleep(delay, this.controller.signal);
        delay = Math.min(delay * 2, 10000);
      }
    }
  }

  requestFor(item) {
    const event = item.event;
    this.delivery.register(event);
    const meta = metadataOf(event);
    const replyTo = meta.replyTo || event.content['m.relates_to']?.['m.in_reply_to']?.event_id;
    const replied = replyTo ? this.store.message(replyTo) : undefined;
    const workTransfer = ['task.request', 'task.result', 'task.failure'].includes(meta.kind);
    const sourceThreadRootId = threadOf(event) || undefined;
    const originThreadRootId = workTransfer && this.participants.some(person => person.id === event.sender && person.kind === 'bot')
      ? typeof meta.originThreadRootId === 'string' && meta.originThreadRootId ? meta.originThreadRootId : undefined
      : sourceThreadRootId;
    const referencedFiles = !workTransfer && replied?.room_id === event.room_id ? this.store.messageBatch(replied).flatMap(eventAttachments) : [];
    const ownFiles = workTransfer && meta.fileBatch ? this.store.messageBatch(event).flatMap(eventAttachments) : eventAttachments(event);
    const followupFiles = ownFiles.length || replyTo ? [] : this.delivery.inputFiles(item);
    const history = this.store.historyBefore(event.event_id);
    const inRoom = value => value?.room_id === event.room_id ? value : undefined;
    const room = this.roomContextFor(event.room_id);
    const sourceRoom = this.store.roomContextForEvent(event);
    if (meta.kind === 'task.request' && meta.returnTo === event.sender && this.participants.some(person => person.id === event.sender && person.kind === 'bot')) {
      this.contacts.open({ id: `in:${event.event_id}`, direction: 'in', peer: event.sender, via: 'matrix', roomId: event.room_id,
        taskId: meta.taskId, status: 'received', origin: { roomId: meta.originRoomId, eventId: meta.originEventId, senderId: meta.originSenderId } });
    }
    return { requestId: `matrix-${digest(`${this.participant.id}\0${event.event_id}`)}`, botId: this.participant.id,
      ...(this.executionMode === 'native' ? { mode: 'native', executionMode: 'native' } : {}),
      context: item.attention?.kind === 'natural' ? item.attention.context : conversationContext({ event, participants: this.participants, room, sourceRoom, history,
        earlierCount: Math.max(0, this.store.historyCountBefore(event.event_id) - history.length),
        reply: inRoom(replied), replyRoom: this.store.roomContextForEvent(replyTo),
        threadRoot: inRoom(this.store.message(threadOf(event))), threadRootRoom: this.store.roomContextForEvent(threadOf(event)) }),
      event: { eventId: event.event_id, roomId: event.room_id, senderId: event.sender, senderName: this.senderName(event.sender, sourceRoom),
        botIdentity: { id: this.participant.id, name: this.senderName(this.participant.id, room), role: this.roleOf() },
        contacts: this.contacts.reachableBots().map(contact => ({ ...contact, name: this.senderName(contact.id, room), role: this.roleOf(this.participants.find(person => person.id === contact.id) || contact) })),
        openRequests: this.contacts.pending().map(exchange => ({ to: exchange.peerId, name: this.senderName(exchange.peerId, room),
          request: exchange.detail, forSenderId: exchange.origin?.senderId || null, forEventId: exchange.origin?.eventId || null,
          since: new Date(exchange.at).toISOString() })),
        senderKind: this.participants.find(person => person.id === event.sender)?.kind,
        body: event.content['m.new_content']?.body ?? event.content.body, to: Array.isArray(meta.to) ? meta.to : [], attachments: uniqueAttachments([...ownFiles, ...referencedFiles, ...followupFiles]),
        delivery: this.delivery.publicRoute(item),
        ...(meta.conversationKind ? { conversationKind: meta.conversationKind } : {}),
        ...(meta.taskId ? { taskId: meta.taskId } : {}),
        ...(replyTo ? { replyTo } : {}),
        ...(sourceThreadRootId ? { threadRootId: sourceThreadRootId } : {}),
        ...(meta.kind ? { kind: meta.kind } : {}), ...(meta.returnTo ? { returnTo: meta.returnTo } : {}),
        ...(meta.workerTask ? { workerTask: meta.workerTask, workerKind: meta.workerKind } : {}),
        ...(meta.fileBatch ? { fileBatch: meta.fileBatch } : {}),
        ...(meta.originSenderId ? { originSenderId: meta.originSenderId } : {}), ...(Number.isInteger(meta.hop) ? { hop: meta.hop } : {}),
        ...(meta.originRoomId ? { originRoomId: meta.originRoomId } : {}), ...(meta.originEventId ? { originEventId: meta.originEventId } : {}),
        ...(originThreadRootId ? { originThreadRootId } : {}),
      },
      history: item.attention?.kind === 'natural' ? item.attention.history : history.map(previous => ({ eventId: previous.event_id, roomId: previous.room_id,
        source: messageSource(previous, this.participants, this.store.roomContextForEvent(previous)),
        senderId: previous.sender, senderName: this.senderName(previous.sender, this.store.roomContextForEvent(previous)), senderKind: this.participants.find(person => person.id === previous.sender)?.kind,
        body: previous.content['m.new_content']?.body ?? previous.content.body, attachments: eventAttachments(previous), taskId: metadataOf(previous).taskId,
        kind: metadataOf(previous).kind, originSenderId: metadataOf(previous).originSenderId, fileBatch: metadataOf(previous).fileBatch })),
    };
  }

  taskUpdate(item, changes) {
    // Participation and shadow decisions have no task card. Real tools/files or
    // delegation can establish a normal task and keep its existing result chain.
    const latest = this.store.item(item.event_id);
    if (item.attention?.kind === 'natural' && !this.store.task(item.event_id)
      && !latest?.response?.delegated && !(latest?.response?.toolCalls > 0) && !latest?.response?.artifacts?.length) return;
    const request = item.request || (item.request_json ? JSON.parse(item.request_json) : this.requestFor(item));
    const previous = this.store.task(item.event_id);
    if (previous?.status === 'cancelled' && changes.status !== 'cancelled') return;
    const meta = metadataOf(item.event);
    const payload = { requestId: request.requestId, botId: this.participant.id, roomId: item.event.room_id,
      eventId: item.event_id, taskId: meta.taskId || `task-${digest(item.event_id).slice(0, 24)}`,
      status: 'running', stage: 'thinking', summary: '', artifacts: [], toolCalls: 0,
      ...previous, ...changes, delivery: this.delivery.publicRoute(item), updatedAt: new Date().toISOString() };
    this.store.updateTask(item.event_id, payload);
  }

  async flushTaskUpdates() {
    if (!this.tasks) return;
    if (this.flushingTasks) return this.flushingTasks;
    this.flushingTasks = (async () => {
      while (this.store.pendingTaskUpdates().length) {
        for (const update of this.store.pendingTaskUpdates()) {
          try {
            await this.tasks.update(update.payload);
            this.store.acknowledgeTask(update.eventId, update.payload);
          } catch (error) {
            this.onError(`Task status will be sent again: ${error.message}`);
            return;
          }
        }
      }
    })();
    try { await this.flushingTasks; }
    finally { this.flushingTasks = null; }
  }

  async control(requestId, signal) {
    const local = this.store.localCancellation(requestId);
    if (local) return local;
    if (!this.tasks) return { cancelRequested: false };
    const item = this.store.requestItem(requestId);
    if (item?.attention?.kind === 'natural' && !this.store.task(item.event_id)) return { cancelRequested: false };
    try { return await this.tasks.control(requestId, { signal }); }
    catch (error) {
      if (!signal?.aborted) this.onError(`Task control is temporarily unavailable: ${error.message}`);
      return { cancelRequested: false };
    }
  }

  async withTransferControl(item, operation) {
    if (!this.tasks) return operation(this.controller.signal);
    const local = new AbortController();
    const signal = AbortSignal.any([local.signal, this.controller.signal]);
    const requestId = (item.request || (item.request_json ? JSON.parse(item.request_json) : this.requestFor(item))).requestId;
    let cancelled = false;
    const monitoring = (async () => {
      while (!signal.aborted) {
        if ((await this.control(requestId, signal)).cancelRequested) {
          cancelled = true;
          local.abort();
          return;
        }
        await sleep(this.controlIntervalMs, signal);
      }
    })();
    try {
      const result = await operation(signal);
      if (cancelled) throw Object.assign(new Error('任务已取消'), { taskCancelled: true });
      return result;
    } catch (error) {
      if (cancelled) throw Object.assign(new Error('任务已取消'), { taskCancelled: true });
      throw error;
    } finally {
      local.abort();
      await monitoring;
    }
  }

  async prepareRequest(item, request) {
    return this.withTransferControl(item, async signal => {
      for (let attempt = 0; attempt < this.transferAttempts; attempt++) {
        try { return await this.files.prepare(request, signal); }
        catch (error) {
          if (signal.aborted || !temporaryTransferError(error) || attempt === this.transferAttempts - 1) throw error;
          this.taskUpdate(item, { status: 'running', stage: 'downloading', summary: '附件传输中断，正在重试' });
          await this.flushTaskUpdates();
          await sleep(this.transferRetryDelayMs * (attempt + 1), signal);
        }
      }
    });
  }

  parentCancelled(item) {
    if (this.store.cancelledEvent(item.event_id)) return true;
    if (item.attention?.kind === 'natural' && this.store.withdrawnAttentionSource(item.attention)) return true;
    const meta = metadataOf(item.event);
    return ['task.result', 'task.failure'].includes(meta.kind) && meta.originEventId && this.store.task(meta.originEventId)?.status === 'cancelled';
  }

  async checkWaitingTasks() {
    if (!this.tasks) return;
    for (const waiting of this.store.waitingTasks()) {
      if ((await this.control(waiting.payload.requestId)).cancelRequested) {
        this.taskUpdate(this.store.item(waiting.eventId), { status: 'cancelled', stage: 'cancelled', summary: '协作任务已取消' });
      }
    }
    await this.flushTaskUpdates();
  }

  bridgeOptions(item, reconciled = false) {
    return { signal: this.controller.signal,
      control: requestId => this.control(requestId),
      onProgress: async snapshot => {
        this.taskUpdate(item, { status: 'running', stage: snapshot.stage || 'thinking',
          summary: snapshot.summary || '', toolCalls: snapshot.toolCalls || 0, ...(reconciled ? { reconciled: true } : {}) });
        await this.flushTaskUpdates();
      },
    };
  }

  async acceptResult(item, response) {
    if (response.status === 'completed' && this.parentCancelled(item)) {
      // Preserve the actual model/tool receipt, then stop before any new upload
      // or delivery. A cancellation never pretends earlier work did not happen.
      this.store.produced(item.event_id, response);
      this.store.failed(item.event_id, 'Task superseded by a reliable control message', 'cancelled');
      this.taskUpdate(item, { status: 'cancelled', stage: 'cancelled', summary: '任务已取消' });
      await this.flushTaskUpdates();
      return;
    }
    if (response.status !== 'completed') {
      const status = ['unknown', 'cancelled'].includes(response.status) ? response.status : 'failed';
      const reason = response.errorCode || response.summary || `Bridge returned ${response.status}`;
      const meta = metadataOf(item.event);
      const delegated = meta.kind === 'task.request' && meta.returnTo === item.event.sender
        && this.participants.some(person => person.kind === 'bot' && person.id === item.event.sender);
      if (status === 'failed' && delegated) {
        this.queueFailure(item, response, `${this.participant.name}执行任务失败。${reason}`);
      } else this.store.failed(item.event_id, reason, status);
      this.taskUpdate(item, { status, stage: status, summary: reason, toolCalls: response.toolCalls || 0 });
      this.lastError = status === 'cancelled' ? null : reason;
      await this.flushTaskUpdates();
      return;
    }
    // The result survives process loss or upload failure before any Matrix send.
    this.store.produced(item.event_id, response);
    this.wakeAttention('task_completed', { roomId: item.event.room_id, threadRootId: threadOf(item.event) });
    await this.publishProduced(this.store.item(item.event_id));
  }

  queueFailure(item, response, text) {
    const receipt = { ...response, text: JSON.stringify({ text }), failure: true, artifacts: [], publishedArtifacts: [], deliveredArtifacts: [] };
    this.store.produced(item.event_id, receipt);
    const output = { text, failure: true };
    this.delivery.applyOutput(item, output);
    const deliveries = deliveriesFor(item.event, output, this.participant.id, this.participants);
    this.store.generated(item.event_id, receipt, deliveries);
  }

  async publishProduced(item) {
    const response = item.response;
    const request = item.request;
    const attachments = [...(response.reusedAttachments || [])];
    this.taskUpdate(item, { status: 'running', stage: 'uploading', summary: '正在保存成果', toolCalls: response.toolCalls || 0 });
    await this.flushTaskUpdates();
    try {
      const output = parseBotOutput(response.text, this.participants, { ignoreDelivery: !this.delivery.acceptsProposal(item) });
      this.delivery.applyOutput(item, output);
      output.controlOnly = response.controlOnly === true;
      output.accepted = response.dispatched?.length > 0;
      // A worker that failed, or whose outcome a restart made unknown, is not a result.
      if (response.workerStatus && response.workerStatus !== 'done') output.failure = true;
      await this.withTransferControl(item, async signal => {
        for (const artifact of response.artifacts || []) {
          if (!this.files) throw new Error('This node has no attachment transfer service');
          const key = digest(`${artifact.path}\0${artifact.sha256 || ''}`);
          let uploaded = this.store.uploaded(item.event_id, key);
          if (!uploaded) {
            uploaded = await this.files.upload(artifact, request, signal);
            this.store.recordUpload(item.event_id, key, uploaded);
          }
          attachments.push(uploaded);
        }
        // Files a Bot hands to another Bot go as attachments: the other node cannot read this one's paths.
        for (const ask of response.asks || []) {
          ask.attachments = [];
          for (const file of ask.files || []) {
            if (!this.files) throw new Error('This node has no attachment transfer service');
            const key = digest(`ask\0${ask.to}\0${file.path}`);
            let uploaded = this.store.uploaded(item.event_id, key);
            if (!uploaded) {
              uploaded = await this.files.upload(file, request, signal);
              this.store.recordUpload(item.event_id, key, uploaded);
            }
            ask.attachments.push(uploaded);
          }
        }
      });
      output.attachments = attachments;
      output.sourceAttachments = uniqueAttachments(request.files || []);
      if (request.event?.kind === 'task.result') {
        const earlierParts = (request.history || []).filter(previous => previous.kind === 'task.result'
          && previous.taskId === request.event.taskId && previous.senderId === item.event.sender
          && (!request.event.fileBatch?.id || previous.fileBatch?.id === request.event.fileBatch.id));
        output.resultAttachments = uniqueAttachments([...earlierParts.flatMap(previous => previous.attachments || []), ...(request.event.attachments || eventAttachments(item.event))]);
      }
      output.asks = [];
      for (const ask of response.asks || []) {
        try { output.asks.push({ ...ask, roomId: await this.roomForAsk(item.event, ask.to) }); }
        catch (error) {
          if (temporaryTransferError(error)) throw error;
          // The requester hears plainly that this request did not go out; the rest of the reply still does.
          output.text += `\n\n（没能联系上${this.senderName(ask.to) || ask.to}：${error.message}。这件事没有交出去。）`;
        }
      }
      const deliveries = deliveriesFor(item.event, output, this.participant.id, this.participants);
      const deliveredArtifacts = uniqueAttachments(deliveries.filter(delivery => delivery.options.kind !== 'task.request')
        .flatMap(delivery => delivery.options.attachments || []));
      const published = { ...response, publishedArtifacts: attachments, deliveredArtifacts, delegated: output.asks.length > 0 };
      this.store.generated(item.event_id, published, deliveries);
      for (const handoff of deliveries.filter(delivery => delivery.options.deliveryRole === 'delegate')) {
        const { options } = handoff;
        const to = options.askTo;
        this.contacts.open({ id: `${options.taskId}>${to}`, direction: 'out', peer: to, via: 'matrix',
          roomId: handoff.roomId, taskId: options.taskId, status: 'sending', detail: handoff.body,
          origin: { roomId: options.originRoomId, eventId: options.originEventId, senderId: options.originSenderId } });
      }
      this.taskUpdate(item, { stage: 'delivering', summary: '正在发送成果', artifacts: deliveredArtifacts });
      this.lastError = null;
    } catch (error) {
      if (error.taskCancelled) {
        await this.acceptResult(item, { status: 'cancelled', summary: '任务已取消' });
        return;
      }
      const transient = temporaryTransferError(error);
      if (transient) {
        this.lastError = `Artifact delivery pending: ${error.message}`;
        this.taskUpdate(item, { stage: 'uploading', summary: '成果已生成，正在重试上传' });
        throw error;
      }
      await this.acceptResult(item, { status: 'failed', errorCode: error.message, toolCalls: response.toolCalls || 0 });
    }
    await this.flushTaskUpdates();
  }

  /** The requester was told the work went to another Bot; say plainly that it did not. */
  async retractDelegation(item, delivery, error) {
    const to = delivery.options.askTo;
    const name = this.senderName(to) || to;
    const threadRootId = threadOf(item.event);
    const body = `刚才说已经交给${name}，但请求没有发出去（${error.message}），${name}不会处理这件事。`;
    try {
      await this.matrix.send(item.event.room_id, body, { transactionId: `${delivery.transaction_id}-undelivered`, to: [],
        replyTo: item.event.event_id, ...(threadRootId ? { threadRootId } : {}), kind: 'reply', deliveryRole: 'final',
        taskId: delivery.options.taskId,
        mentions: { users: [], roles: [], everyone: false, here: false, replyUserId: item.event.sender, roleUsers: [], everyoneUsers: [], hereUsers: [] },
        mMentions: { user_ids: [item.event.sender] } });
    } catch (cause) { this.onError(`Delegation failure notice not sent: ${cause.message}`); }
  }

  finishDeliveryState(delivery) {
    const item = this.store.item(delivery.source_event_id);
    const failure = item.response?.failure;
    if (item.status !== 'completed' && !(item.status === 'failed' && failure)) return;
    this.delivery.sent(item);
    const delegated = item.response?.delegated;
    const finalAttachments = item.response?.deliveredArtifacts || delivery.options.attachments || item.response?.publishedArtifacts || [];
    const status = failure ? 'failed' : delegated ? 'running' : 'completed';
    const stage = failure ? 'failed' : delegated ? 'waiting_for_bot' : 'completed';
    this.taskUpdate(item, { status, stage,
      summary: failure ? item.response.errorCode || delivery.body : delegated ? '等待协作 Bot 的成果' : '已交付', artifacts: finalAttachments });
    this.wakeAttention(delegated ? 'delegation_started' : 'delivery_completed', { roomId: item.event.room_id, threadRootId: threadOf(item.event) });
    if (item.attention?.kind === 'natural') {
      this.store.attentionOutcome(item.event_id, 'delivered');
      this.lastAttentionSpokeAt = Date.now();
    }
    const meta = metadataOf(item.event);
    const answered = meta.answers?.eventId || item.event_id;
    if (['task.result', 'task.failure'].includes(delivery.options.kind)) {
      this.contacts.settle(`in:${answered}`, { status: delivery.options.kind === 'task.result' ? 'returned' : 'failed' });
    } else if (item.response?.dispatched?.length) this.contacts.settle(`in:${answered}`, { status: 'dispatched' });
    if (['task.result', 'task.failure'].includes(meta.kind) && meta.taskId) {
      this.contacts.settle(`${meta.taskId}>${item.event.sender}`, { status: meta.kind === 'task.result' ? 'returned' : 'failed' });
    }
    if (!delegated && ['task.result', 'task.failure'].includes(meta.kind) && meta.originEventId) {
      const parent = this.store.item(meta.originEventId);
      if (parent && parent.event_id !== item.event_id && parent.response?.delegated) {
        this.taskUpdate(parent, { status: failure ? 'failed' : 'completed', stage: failure ? 'failed' : 'completed',
          summary: failure ? delivery.body : '协作成果已交付', artifacts: finalAttachments });
      }
    }
  }

  async recoverInterrupted() {
    if (!this.bridge.status) return false;
    const item = this.store.interrupted().find(candidate => !this.reconciled.has(candidate.event_id));
    if (!item) return false;
    this.reconciled.add(item.event_id);
    try {
      let response = await this.bridge.status(item.request.requestId);
      if (['running', 'queued'].includes(response.status)) {
        this.store.resume(item.event_id);
        response = await this.bridge.wait(item.request.requestId, response, this.bridgeOptions(item, true));
      }
      await this.acceptResult(item, response);
      return true;
    }
    catch (error) {
      if (error.status !== 404) this.reconciled.delete(item.event_id);
      this.store.failed(item.event_id, error.message, 'unknown');
      throw error;
    }
  }

  async processOne() {
    let delivery = this.store.pendingDelivery();
    if (delivery) {
      const source = this.store.item(delivery.source_event_id);
      const suppressed = this.attentionSuppression(source);
      if (suppressed) { this.suppressAttention(source, suppressed); return true; }
      const cancelRequested = this.parentCancelled(source) || (this.tasks && (await this.control(source.request.requestId)).cancelRequested);
      if (cancelRequested) {
        this.store.cancelDelivery(source.event_id);
        this.taskUpdate(source, { status: 'cancelled', stage: 'cancelled', summary: '任务已取消' });
        await this.flushTaskUpdates();
        return true;
      }
      try {
        const receipt = await this.delivery.prepare(delivery, prepared => {
          delivery = prepared;
          const suppressed = this.attentionSuppression(this.store.item(source.event_id));
          if (suppressed) throw Object.assign(new Error('Natural participation superseded before sending'), { attentionSuppressed: suppressed });
          const send = () => {
            if (source.attention?.kind === 'natural') {
              this.store.updateAttentionEvidence(source.event_id, { deliveryAttempted: true });
              this.sendingAttention = true;
            }
            return this.matrix.send(delivery.room_id, delivery.body, delivery.options);
          };
          return send();
        });
        this.store.sent(delivery.transaction_id, receipt.event_id, () => this.finishDeliveryState(delivery));
        if (delivery.options.deliveryRole === 'delegate') this.contacts.settle(`${delivery.options.taskId}>${delivery.options.askTo}`, { status: 'sent' });
        this.lastError = null;
        await this.flushTaskUpdates();
      } catch (error) {
        if (error.attentionSuppressed) { this.suppressAttention(source, error.attentionSuppressed); return true; }
        if (error.taskCancelled) {
          this.store.cancelDelivery(source.event_id);
          this.taskUpdate(source, { status: 'cancelled', stage: 'cancelled', summary: '任务已取消' });
          await this.flushTaskUpdates();
          return true;
        }
        const terminal = error.status >= 400 && error.status < 500 && ![408, 429].includes(error.status);
        this.store.deliveryFailed(delivery.transaction_id, error.message, { terminal });
        this.lastError = `Matrix delivery ${terminal ? 'failed' : 'pending'}: ${error.message}`;
        if (terminal) {
          const item = this.store.item(delivery.source_event_id);
          this.taskUpdate(item, { status: 'failed', stage: 'delivering', summary: error.message });
          await this.flushTaskUpdates();
          if (delivery.options.deliveryRole === 'delegate') {
            this.contacts.settle(`${delivery.options.taskId}>${delivery.options.askTo}`, { status: 'failed', detail: error.message });
            await this.retractDelegation(item, delivery, error);
          }
          this.onError(this.lastError);
          return true;
        }
        throw error;
      } finally { this.sendingAttention = false; }
      return true;
    }
    const produced = this.store.pendingResult();
    if (produced) { await this.publishProduced(produced); return true; }
    if (this.bridge.status && this.store.interrupted().some(item => !this.reconciled.has(item.event_id))) {
      return this.recoverInterrupted();
    }
    let item = this.store.next();
    if (!item) return false;
    const suppressed = this.attentionSuppression(item);
    if (suppressed) { this.suppressAttention(item, suppressed); return true; }
    if (this.store.cancelledEvent(item.event_id)) {
      this.store.failed(item.event_id, 'Task superseded by a reliable control message', 'cancelled');
      return true;
    }
    if (item.attention?.kind === 'natural' && item.attention.workStateVersion
      && item.attention.workStateVersion !== this.store.attentionWorkView(item.event.room_id, threadOf(item.event), {
        excludeEventId: item.event_id,
      }).stateVersion) {
      this.store.recheckQueuedAttention(item.event_id);
      return true;
    }
    let merged = [];
    if (this.burstMessage(item)) {
      const burst = [];
      for (const next of this.store.burstAfter(item.event_id)) {
        if (!this.burstMessage(next) || (threadOf(next.event) || '') !== (threadOf(item.event) || '')) break;
        burst.push(next);
      }
      let held = this.holdBurst([item, ...burst]);
      if (held instanceof Promise) held = await held;
      if (held) return false;
      if (burst.length) { merged = [item, ...burst.slice(0, -1)]; item = this.store.item(burst.at(-1).event_id); }
    }
    if (this.roster && !this.work) await this.ensureParticipants([item.event]);
    let request = this.requestFor(item);
    if (merged.length) {
      request.event.mergedMessages = merged.map(earlier => ({ eventId: earlier.event_id,
        body: earlier.event.content['m.new_content']?.body ?? earlier.event.content.body }));
      request.event.attachments = uniqueAttachments([...merged.flatMap(earlier => eventAttachments(earlier.event)), ...request.event.attachments]);
    }
    this.store.begin(item.event_id, request);
    if (merged.length) {
      this.store.merge(merged.map(earlier => earlier.event_id), item.event_id);
      for (const earlier of merged) this.taskUpdate(earlier, { status: 'completed', stage: 'merged', summary: '和后面的消息一起回复' });
    }
    this.state = 'thinking';
    this.replying = { roomId: item.event.room_id, requesterId: item.event.sender, since: Date.now() };
    let submitted = false;
    try {
      request = boundTaskRequest(request);
      const routing = this.delivery.route(item);
      if (routing.error) throw new Error(routing.error);
      const controlResult = this.delivery.controlResult(item);
      if (controlResult) {
        this.store.prepared(item.event_id, request);
        await this.acceptResult(item, controlResult);
        return true;
      }
      if ((request.event.hop ?? 0) > MAX_ASK_DEPTH) throw new Error('Collaboration hop limit reached');
      if (this.parentCancelled(item)) {
        await this.acceptResult(item, { status: 'cancelled', summary: '协作任务已取消' });
        return true;
      }
      if (request.event.kind === 'task.failure' && this.participants.some(person => person.kind === 'bot' && person.id === item.event.sender)) {
        this.queueFailure(item, { status: 'failed' }, item.event.content.body);
        this.taskUpdate(item, { status: 'failed', stage: 'failed', summary: item.event.content.body });
        await this.flushTaskUpdates();
        return true;
      }
      if (this.files) {
        this.taskUpdate(item, { status: 'running', stage: 'downloading', summary: '正在读取附件' });
        await this.flushTaskUpdates();
        request = await this.prepareRequest(item, request);
        request = boundTaskRequest(request);
      }
      this.store.prepared(item.event_id, request);
      if (this.tasks) {
        this.taskUpdate(item, { status: 'running', stage: 'thinking', summary: '正在处理任务' });
        await this.flushTaskUpdates();
        if ((await this.control(request.requestId)).cancelRequested) {
          await this.acceptResult(item, { status: 'cancelled', summary: '任务已取消' });
          return true;
        }
      }
      submitted = true;
      this.current = { item, request };
      const response = await this.bridge.turn(request, this.bridgeOptions(item));
      if (this.rejoin(item, response)) return true;
      await this.acceptResult(item, response);
    } catch (error) {
      if (this.rejoin(item, { status: 'cancelled' })) return true;
      if (this.store.item(item.event_id).status === 'produced') throw error;
      const uncertain = submitted && temporaryTransferError(error);
      const status = error.taskCancelled ? 'cancelled' : uncertain ? 'unknown' : 'failed';
      await this.acceptResult(item, { status, errorCode: error.message });
      this.lastError = status === 'cancelled' ? null : error.message;
      if (status !== 'cancelled') this.onError(`Bot turn ${request.requestId} ended: ${error.message}`);
    } finally { this.state = 'idle'; this.current = null; this.joining = null; this.replying = null; }
    return true;
  }

  decisionsAvailable() { return Boolean(this.decisionProvider && this.decisionProvider.configured !== false); }

  /** WAIT, JOIN or REPLY from the decision model; null when it is unavailable or fails. */
  async decideTurn(input) {
    if (!this.decisionsAvailable()) return null;
    try {
      const result = await attentionCall(signal => this.decisionProvider.decide({ version: 1, self: { id: this.participant.id, name: this.participant.name }, ...input },
        { signal, question: turnQuestion }), Math.min(this.attention.providerTimeoutMs, 3000), this.controller.signal);
      return result.action;
    } catch { return null; }
  }

  /** Whether to wait before answering these consecutive messages from one person (a Promise only when the decision model is asked). */
  holdBurst(messages) {
    const last = messages.at(-1);
    const now = Date.now();
    const age = now - (last.event.origin_server_ts ?? 0);
    if (this.rejoined === messages[0].event_id) { this.rejoined = null; return false; }
    // A clock far off, or a burst that has gone on long enough, is answered now.
    if (!(age >= 0) || now - (messages[0].event.origin_server_ts ?? 0) > BURST_MAX_WAIT_MS) return false;
    if (this.burstHold?.eventId === last.event_id) return now < this.burstHold.until;
    if (!this.decisionsAvailable()) return age < BURST_SETTLE_MS;
    return this.decideTurn({ phase: 'before', pending: messages.map(message => this.attentionMessageFor(message.event)) }).then(action => {
      if (!action) return age < BURST_SETTLE_MS;
      this.burstHold = { eventId: last.event_id, until: action === 'WAIT' ? now + BURST_WAIT_MS : 0 };
      return action === 'WAIT';
    });
  }

  /** A follow-up from the same person while the front answers them: JOIN restarts the answer with both. */
  async considerJoin() {
    const current = this.current;
    if (!current || this.joining || !this.bridge.interrupt) return;
    const next = this.store.burstAfter(current.item.event_id, 1)[0];
    if (!next || !this.burstMessage(next) || (threadOf(next.event) || '') !== (threadOf(current.item.event) || '')
      || eventAttachments(next.event).length || this.considered === next.event_id) return;
    this.considered = next.event_id;
    if (!this.bridge.joinable?.(current.request.requestId)) return;
    const action = await this.decideTurn({ phase: 'during',
      answering: [...(current.request.event.mergedMessages || []).map(message => message.body), current.request.event.body],
      newMessage: this.attentionMessageFor(next.event) });
    if ((action ?? 'JOIN') !== 'JOIN' || this.current !== current) return;
    this.joining = current.item.event_id;
    if (!await this.bridge.interrupt(current.request.requestId)) this.joining = null;
  }

  /** The interrupted answer goes back to the queue and is answered again together with the follow-up. */
  rejoin(item, response) {
    if (this.joining !== item.event_id || response?.status !== 'cancelled') return false;
    this.store.requeue(item.event_id);
    this.rejoined = item.event_id;
    this.taskUpdate(item, { status: 'queued', stage: 'queued', summary: '对方补充了消息，合并后重新回答' });
    return true;
  }

  /** A plain message from a person: no work transfer, correction, reply or participation decision attached. */
  burstMessage(item) {
    const meta = metadataOf(item.event);
    const relation = item.event.content?.['m.relates_to'];
    return item.attention?.kind !== 'natural' && !meta.kind && !meta.workerTask && !meta.replyTo && !relation?.['m.in_reply_to'] && relation?.rel_type !== 'm.replace'
      && this.participants.find(person => person.id === item.event.sender)?.kind !== 'bot';
  }

  async processLoop() {
    while (!this.controller.signal.aborted) {
      try {
        if (!await this.processOne()) await sleep(100, this.controller.signal);
      } catch (error) {
        this.onError(`Delivery retry keeps the same Matrix transaction: ${error.message}`);
        await sleep(2000, this.controller.signal);
      }
    }
  }

  async heartbeat() {
    if (this.bridge.runtimeStatus && this.state !== 'offline') {
      const runtime = await this.bridge.runtimeStatus({
        signal: AbortSignal.any([this.controller.signal, AbortSignal.timeout(2000)]),
      }).catch(() => null);
      this.model = runtime?.model ?? null;
      const identity = runtime?.runtime;
      const observedEngine = identity?.id === 'dscord-kernel' ? 'DSCord kernel'
        : typeof runtime?.engine === 'string' && runtime.engine ? runtime.engine
          : typeof identity?.id === 'string' && identity.id ? identity.id : null;
      const version = typeof identity?.version === 'string' ? identity.version
        : typeof runtime?.engineVersion === 'string' ? runtime.engineVersion : null;
      const fallback = (runtime?.mode || this.bridgeMode || this.executionMode) === 'native' ? 'Native Bot runtime' : 'Bot bridge (legacy)';
      this.engine = observedEngine ? `${observedEngine}${version ? ` ${version}` : ''}` : fallback;
    }
    const snapshot = this.store.snapshot();
    const attention = this.attentionStatus();
    const kernel = this.bridge.kernelState && this.state !== 'offline'
      ? await this.bridge.kernelState({ botId: this.participant.id }, {
        signal: AbortSignal.any([this.controller.signal, AbortSignal.timeout(2000)]),
      }).catch(() => null) : null;
    await this.sendHeartbeat({ id: this.participant.localpart, botId: this.participant.id, name: this.participant.name,
      runtimeId: this.runtimeId, status: this.lastError && this.state === 'idle' ? 'error' : this.state,
      processed: snapshot.processed, pending: snapshot.pending, sessionId: snapshot.sessionId,
      lastError: this.lastError || snapshot.lastError, model: this.model,
      engine: this.engine || ((this.bridgeMode || this.executionMode) === 'native' ? 'Native Bot runtime' : 'Bot bridge (legacy)'),
      ...(this.executionMode ? { executionMode: this.executionMode } : {}),
      attention, kernel: { ...(kernel || {}), attention, responder: this.responderStatus() }, kernelControl: { version: 1 } });
  }

  async heartbeatLoop() {
    while (!this.controller.signal.aborted) {
      await sleep(5000, this.controller.signal);
      if (this.controller.signal.aborted) break;
      await this.checkWaitingTasks();
      try { await this.heartbeat(); }
      catch (error) { this.onError(`Heartbeat failed: ${error.message}`); }
      await this.flushTaskUpdates();
    }
  }

  async stop() {
    this.controller.abort();
    await this.kernelManagement?.stop();
    await Promise.allSettled([this.processing, this.syncing, this.heartbeats, this.attending, this.observing]);
    this.state = 'offline';
    await this.heartbeat().catch(() => {});
    this.store.close();
  }
}

export function createBridge(endpoint, { token, fetchImpl = fetch, timeoutMs = 180000, pollIntervalMs = 750, taskTimeoutMs = 30 * 60_000 } = {}) {
  async function request(pathname, body, { signal } = {}) {
    let response;
    try {
      response = await fetchImpl(new URL(pathname, endpoint), { method: body === undefined ? 'GET' : 'POST', headers: {
        'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}),
      }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs) });
    } catch (cause) { throw Object.assign(new Error(`DS-Bot bridge connection failed: ${cause.message}`), { networkError: true, cause }); }
    let result;
    try { result = await response.json(); }
    catch (cause) { throw Object.assign(new Error('DS-Bot bridge returned an unreadable receipt'), { networkError: true, cause }); }
    if (!response.ok) throw Object.assign(new Error(result.error || result.message || `Bridge HTTP ${response.status}`), {
      status: response.status, networkError: response.status >= 500,
    });
    return result;
  }
  const status = (requestId, options) => request(`/api/ds-group-node/turns/${encodeURIComponent(requestId)}`, undefined, options);
  async function wait(requestId, initial, { signal, onProgress, control } = {}) {
    let snapshot = initial;
    let cancelled = false;
    let previousProgress;
    const deadline = Date.now() + taskTimeoutMs;
    while (['queued', 'running'].includes(snapshot.status)) {
      if (signal?.aborted) throw Object.assign(new Error('Node stopped while its task was running'), { networkError: true });
      const progress = JSON.stringify([snapshot.status, snapshot.stage, snapshot.summary, snapshot.toolCalls]);
      if (onProgress && progress !== previousProgress) {
        await onProgress(snapshot);
        previousProgress = progress;
      }
      if (!cancelled && control && (await control(requestId)).cancelRequested) {
        await request(`/api/ds-group-node/turns/${encodeURIComponent(requestId)}/cancel`, {}, { signal });
        cancelled = true;
      }
      if (Date.now() >= deadline) throw Object.assign(new Error('Task remains active; its receipt will be reconciled after reconnecting'), { networkError: true });
      await sleep(pollIntervalMs, signal);
      snapshot = await status(requestId, { signal });
    }
    return snapshot;
  }
  return {
    createBot: input => request('/api/ds-group-node/bots', input), status, wait,
    runtimeStatus: options => request('/api/ds-group-node/status', undefined, options),
    observe: (input, options) => request('/api/ds-group-node/observe', input, options),
    readAttentionView: (input, options) => request('/api/ds-group-node/attention/view', input, options),
    kernelState: (input, options) => request('/api/ds-group-node/kernel/state', input, options),
    memoryProfiles: (input, options) => request('/api/ds-group-node/memory/profiles', input, options),
    memoryProfile: (input, options) => request('/api/ds-group-node/memory/profile', input, options),
    cancel: requestId => request(`/api/ds-group-node/turns/${encodeURIComponent(requestId)}/cancel`, {}),
    turn: async (input, options = {}) => {
      const snapshot = await request('/api/ds-group-node/turns', { ...input, async: true }, options);
      return wait(input.requestId, snapshot, options);
    },
  };
}

export function createTaskClient(coreUrl, nodeSecret, fetchImpl = fetch) {
  async function request(route, body, { signal } = {}) {
    const response = await fetchImpl(new URL(route, coreUrl), { method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${nodeSecret}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000) });
    if (!response.ok) throw Object.assign(new Error(`Task service HTTP ${response.status}`), { status: response.status });
    return response.json();
  }
  return { update: payload => request('/internal/tasks/update', payload),
    control: (requestId, options) => request(`/internal/tasks/${encodeURIComponent(requestId)}/control`, undefined, options) };
}

export function createRosterClient(coreUrl, _accessToken, fetchImpl = fetch) {
  return { read: async () => {
    const response = await fetchImpl(new URL('/api/bootstrap', coreUrl), {
      headers: { Accept: 'application/json' }, credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw Object.assign(new Error(`Core roster HTTP ${response.status}`), { status: response.status });
    return response.json();
  } };
}

export async function runNode(argv = process.argv.slice(2)) {
  const argument = name => { const index = argv.indexOf(name); return index >= 0 ? argv[index + 1] : undefined; };
  const name = argument('--bot');
  if (!name) throw new Error('Usage: node src/bot-node.mjs --bot ACCOUNT [--endpoint URL]');
  const setup = JSON.parse(await readFile(process.env.DS_GROUP_MATRIX_SETUP_PATH || localPath('matrix-setup.json'), 'utf8'));
  const config = JSON.parse(await readFile(process.env.DS_GROUP_CORE_CONFIG_PATH || localPath('core-config.json'), 'utf8'));
  let nodeConfig = {};
  try { nodeConfig = JSON.parse(await readFile(process.env.DS_GROUP_NODE_CONFIG_PATH || localPath(`dsh-${name}`, 'node-config.json'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (process.env.DS_GROUP_MATRIX_URL) setup.homeserverUrl = process.env.DS_GROUP_MATRIX_URL;
  const participant = setup.participants.find(p => p.localpart === name && p.kind === 'bot');
  if (!participant) throw new Error(`Unknown Bot ${name}`);
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error('Bot name must be a local account name');
  if (!participant.accessToken) throw new Error('This node needs its own Matrix access token');
  const endpoint = argument('--endpoint') || process.env.DS_GROUP_BOT_ENDPOINT || runtimeSettings(name, { root: packageRoot }).bridgeUrl;
  const directory = localPath('nodes', name);
  await mkdir(directory, { recursive: true });
  const releaseLock = await acquireNodeLock(path.join(directory, 'process.lock'));
  const coreUrl = process.env.DS_GROUP_CORE_URL || config.publicUrl || `http://127.0.0.1:${process.env.DS_GROUP_PORT || 18100}`;
  const work = createNodeWorkClient(coreUrl, config.nodeSecret, participant.id);
  const store = new NodeStore(path.join(directory, 'node.sqlite'), participant.id);
  const bridge = createBridge(endpoint, { token: process.env.DS_GROUP_BRIDGE_TOKEN });
  const executionMode = argument('--execution-mode') || process.env.DS_GROUP_EXECUTION_MODE || config.executionMode || nodeConfig.executionMode;
  const nativeBinding = config.nativeBinding || participant.nativeBinding || nodeConfig.nativeBinding;
  const attentionMode = argument('--attention-mode') || process.env.DSCORD_ATTENTION_MODE || process.env.DS_GROUP_ATTENTION_MODE
    || nodeConfig.attention?.mode || config.attention?.mode || 'mention';
  const decisionKey = process.env.DSCORD_DECISION_API_KEY || process.env.OPENAI_API_KEY;
  const decisionProvider = process.env.DSCORD_DECISION_ENABLED === 'false' ? undefined
    : createOpenAIDecisionProvider({ apiKey: decisionKey,
      model: process.env.DSCORD_DECISION_MODEL || undefined, endpoint: process.env.DSCORD_DECISION_ENDPOINT || undefined });
  // Learn the server's protocol before anything else; an incompatible kernel stops here with the upgrade it needs.
  const { KERNEL_VERSION, hello } = await import('./node-protocol.mjs');
  let session;
  try { session = await hello({ coreUrl, nodeSecret: config.nodeSecret, botId: participant.id, nodeId: participant.localpart, capabilities: ['kernel-control'] }); }
  catch (error) { store.close(); await releaseLock(); throw error; }
  const node = new BotNode({ participant, participants: setup.participants, roomId: setup.roomId,
    matrix: new MatrixClient({ baseUrl: setup.homeserverUrl, accessToken: participant.accessToken }), store,
    bridge, executionMode, nativeBinding, attention: { mode: attentionMode }, decisionProvider,
    files: new NodeFiles({ coreUrl, accessToken: participant.accessToken, directory: path.join(directory, 'tasks'), work,
      matrix: new MatrixClient({ baseUrl: setup.homeserverUrl, accessToken: participant.accessToken }) }),
    work,
    tasks: createTaskClient(coreUrl, config.nodeSecret),
    delivery: createDeliveryClient(coreUrl, participant.accessToken),
    roster: createRosterClient(coreUrl, participant.accessToken),
    heartbeat: async body => {
      const response = await fetch(new URL('/internal/nodes/heartbeat', coreUrl), { method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.nodeSecret}` },
        body: JSON.stringify({ ...body, protocol: session.protocol, kernelVersion: KERNEL_VERSION,
          ...(session.capabilities.includes('kernel-control') ? {} : { kernelControl: undefined }) }), signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`Core heartbeat HTTP ${response.status}`);
    },
  });
  const { KernelNodeClient } = await import('./kernel-node-client.mjs');
  node.kernelManagement = new KernelNodeClient({ coreUrl, nodeSecret: config.nodeSecret, botId: participant.id,
    nodeId: participant.localpart, runtimeId: node.runtimeId,
    operations: { configureAttention: value => { node.configureAttention(value); return node.attentionStatus(); },
      memoryProfiles: args => bridge.memoryProfiles({ botId: participant.id, ...args }),
      memoryProfile: args => bridge.memoryProfile({ botId: participant.id, ...args }),
      contacts: args => node.contacts.view(args),
      timeline: args => node.timeline(args) },
    onError: code => node.onError(`Kernel management: ${code}`) });
  try { await node.start(); }
  catch (error) { store.close(); await releaseLock(); throw error; }
  if (session.capabilities.includes('kernel-control')) node.kernelManagement.start();
  console.log(`DS-Group node ${name} connected as ${participant.id}`);
  let stopping;
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
    stopping ||= node.stop().then(releaseLock).then(() => process.exit(0));
  });
  return node;
}

export async function acquireNodeLock(filename) {
  const identity = { pid: process.pid, runtimeId: randomUUID() };
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS owner (id INTEGER PRIMARY KEY CHECK(id=1),pid INTEGER NOT NULL,runtime_id TEXT NOT NULL)');
  db.exec('BEGIN IMMEDIATE');
  try {
    const previous = db.prepare('SELECT * FROM owner WHERE id=1').get();
    if (previous) {
      let alive = true;
      try { process.kill(previous.pid, 0); }
      catch (error) {
        if (error.code !== 'ESRCH') throw new Error('Node process ownership could not be checked');
        alive = false;
      }
      if (alive) throw Object.assign(new Error(`This Bot already has a local process (${previous.pid})`), { code: 'NODE_PROCESS_ACTIVE' });
    }
    db.prepare('INSERT INTO owner VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET pid=excluded.pid,runtime_id=excluded.runtime_id')
      .run(identity.pid, identity.runtimeId);
    db.exec('COMMIT');
  }
  catch (error) {
    db.exec('ROLLBACK');
    db.close();
    throw error;
  }
  return async () => {
    db.prepare('DELETE FROM owner WHERE runtime_id=?').run(identity.runtimeId);
    db.close();
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  runNode().catch(error => { console.error(error.message); process.exitCode = 1; });
}
