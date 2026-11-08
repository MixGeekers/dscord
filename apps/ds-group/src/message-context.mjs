import { withoutNativeMemoryViews } from './native-request.mjs';

const metadata = event => event.content?.['org.ds_group'] || {};
export const homeOf = id => typeof id === 'string' && id.startsWith('@') && id.includes(':') ? id.slice(id.indexOf(':') + 1) : null;

/** Names are labels. Only the full Matrix ID identifies a speaker. */
export function speakerOf(id, participants = [], room = {}) {
  const person = participants.find(person => person.id === id);
  const profile = Object.hasOwn(room.memberProfiles || {}, id) ? room.memberProfiles[id] : undefined;
  const roomLabel = profile && Object.hasOwn(profile, 'displayname');
  // Matrix membership supplies only the label of this exact account in this
  // room/snapshot. It cannot supply identity kind, ownership or another ID.
  const name = roomLabel ? typeof profile.displayname === 'string' && profile.displayname.trim() || id : person?.name || id;
  return { id, name, kind: person?.kind || 'unknown', homeServer: homeOf(id),
    identitySource: person?.identitySource || (person ? 'account-directory' : 'matrix-event'),
    ...(roomLabel ? { nameSource: profile.source === 'room-directory' ? 'room-directory' : 'matrix-member-state',
      nameObservedAt: Number.isFinite(profile.observedAt) ? profile.observedAt : null,
      nameEventTimestamp: Number.isFinite(profile.eventTimestamp) ? profile.eventTimestamp : null,
      nameEventId: typeof profile.eventId === 'string' ? profile.eventId : null } : {}),
    ...(person?.ownerId ? { ownerId: person.ownerId } : {}) };
}

export function threadOf(event) {
  const relation = event.content?.['m.relates_to'];
  return relation?.rel_type === 'm.thread' && typeof relation.event_id === 'string' ? relation.event_id : null;
}

/** Retain source facts separately from statements quoted or relayed by a sender. */
export function messageSource(event, participants, room = {}) {
  const meta = metadata(event);
  const replyTo = meta.replyTo || event.content?.['m.relates_to']?.['m.in_reply_to']?.event_id;
  return { transport: 'matrix', eventId: event.event_id, roomId: event.room_id,
    ...(event.withdrawn || event.unsigned?.redacted || event.unsigned?.redacted_because ? { withdrawn: true } : {}),
    ...(event.type === 'm.room.redaction' && (event.redacts || event.content?.redacts) ? { retractsEventId: event.redacts || event.content.redacts } : {}),
    ...(event.content?.['m.relates_to']?.rel_type === 'm.replace' ? { replacesEventId: event.content['m.relates_to'].event_id } : {}),
    sender: speakerOf(event.sender, participants, room), timestamp: event.origin_server_ts ?? null,
    threadRootId: threadOf(event), ...(replyTo ? { replyTo } : {}),
    ...(meta.originSenderId || meta.originEventId ? { relay: {
      source: 'sender-metadata', senderId: meta.originSenderId || null,
      roomId: meta.originRoomId || null, eventId: meta.originEventId || null,
      taskId: meta.taskId || null,
    } } : {}) };
}

/** The observation and addressed-message paths use the same source contract. */
export function observedMemoryInput(event, participants = [], room = {}) {
  const source = messageSource(event, participants, room);
  const content = event.content?.['m.new_content'] || event.content || {};
  return { event: { eventId: event.event_id, roomId: event.room_id, senderId: event.sender,
    senderKind: source.sender.kind, body: content.body || '', timestamp: event.origin_server_ts ?? null },
    context: { source, room: { id: event.room_id, name: room.name || event.room_id, topic: room.topic || '' },
      members: (room.members || []).map(id => speakerOf(id, participants, room)) } };
}

export function conversationContext({ event, participants, room = {}, sourceRoom = room, replyRoom = sourceRoom,
  threadRootRoom = sourceRoom, history = [], earlierCount = 0, reply, threadRoot }) {
  const threadRootId = threadOf(event);
  const source = messageSource(event, participants, sourceRoom);
  const quote = (value, snapshot) => value ? { source: messageSource(value, participants, snapshot), body: value.content?.body || '' } : null;
  return {
    version: 1,
    key: JSON.stringify(['matrix', event.room_id, threadRootId]),
    room: { id: event.room_id, name: room.name || event.room_id, topic: room.topic || '',
      kind: metadata(event).conversationKind || 'group', creatorId: room.creatorId || null,
      creatorHomeServer: homeOf(room.creatorId), parentSpaceIds: room.parentSpaceIds || [] },
    source,
    threadRoot: threadRootId ? quote(threadRoot, threadRootRoom) || { eventId: threadRootId, available: false } : null,
    reply: source.replyTo ? quote(reply, replyRoom) || { eventId: source.replyTo, available: false } : null,
    members: (room.members || []).map(id => speakerOf(id, participants, room)),
    history: { scope: 'current-room', count: history.length, earlierMessagesOmitted: earlierCount,
      complete: false, note: 'Recent locally synchronized room history; not the entire conversation.' },
  };
}

/** A routing envelope in the existing native Session, not another tool scope. */
export function nativeMessage({ input, bot, files }) {
  input = withoutNativeMemoryViews(input);
  const context = input.context || { version: 1, key: JSON.stringify(['matrix', input.event.roomId, null]),
    room: { id: input.event.roomId, kind: input.event.conversationKind || 'group' },
    source: { transport: 'matrix', eventId: input.event.eventId, roomId: input.event.roomId,
      sender: { id: input.event.senderId, name: input.event.senderName || input.event.senderId, kind: input.event.senderKind || 'unknown' } } };
  const envelope = { requestId: input.requestId,
    self: { nativeBotId: bot.id, matrixId: input.botId, name: bot.name, role: bot.role || '' },
    context: { ...context, history: context.history ? { ...context.history, count: input.history?.length || 0 } : undefined },
    currentMessage: (({ contacts, ...event }) => event)(input.event), contacts: input.event.contacts || [], recentRoomHistory: input.history || [],
    historyWarnings: input.historyWarnings || [], attachmentWarnings: input.attachmentWarnings || [],
    attachmentsDirectory: files.workdir, files: files.files,
    ...(input.workResults?.length ? { workResults: input.workResults } : {}),
    replyRoute: { requestId: input.requestId, eventId: input.event.eventId, roomId: input.event.roomId,
      delivery: input.event.delivery || { kind: 'origin' } },
  };
  return `DSCORD_REQUEST=${input.requestId}\n你收到一条 DSCord 消息。你是这个 Bot 的前台：用你的原生身份、上下文和记忆交流，工具工作交给工作者。`
    + '\n本次说话人以 context.source.sender 的完整 ID 为准，名称只是显示标签；同名的人或 Bot 不是同一身份。'
    + '\n称呼优先采用当前房间成员资料或最新身份视图中的显示名；source、引用和历史快照里的旧名只说明当时标签。完整 ID 用于内部关联，不必在普通交流里反复报账号。'
    + '\ncontext 标明当前群组、话题和消息来源。recentRoomHistory 是这个群的近期历史，不代表全部历史；引用和转述保留各自作者，不把 Bot 转述当作原作者亲口说的话。'
    + '\n你仍保留其他群和本地对话的经历；使用跨群知识时说明来源，不把其他群的说法当成本群已经达成的决定。'
    + '\n若 context.attention.participationOnly 为 true，这是交流回合：自然回应、澄清或跟进已有承诺，不要把旁听到的请求自动接成新任务。'
    + '\n直接回答当前发送者，回合结束后你的最后一条回复会发到本次 replyRoute。'
    + '\ncurrentMessage.mergedMessages 是同一个人紧接着发来、还没回复的前几条消息，按时间排在 currentMessage 之前。先判断它们是一句话拆成了几条，还是几件不同的事：一句话就连起来理解，几件事就在这一条回复里逐一回应。'
    + '\n需要运行命令、读写文件、写代码、浏览网页或任何多步操作时，调用 dispatch_work 交给工作者（brief 要自足，带上原话和 files 里的输入文件路径），然后简短告诉对方已经开始；不要声称已经完成。'
    + '\n工作者的结果由核心直接回复到原消息并附上文件；workResults 列出自你上一轮以来已经交付的结果，供你了解，不要再转告，也不要自行重做。[task.question] 是工作者的提问。查看或调整进行中的工作用 task_status、task_note、task_cancel。'
    + '\n要找别的 Bot，查 contacts（你自己的通讯录）：reach=message_bot 的用 message_bot，to 填 callAs；reach=room 的回复 {"text":"说明","delegate":{"to":"完整 ID","body":"任务"}}，任务内容带上相关来源，核心会发到你们共同所在的房间。不在 contacts 里的 Bot 你联系不上，直接告诉对方。某人是谁、偏好和能力，看记忆里的人物档案，通讯录不另记。'
    + `\n${JSON.stringify(envelope)}`;
}
