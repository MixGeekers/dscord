import { createHash } from 'node:crypto';
import { clipText, conversationView, list, TEXT_CHARS } from './conversation-view.mjs';

/*
 * What the front (the Bot's own native Session) reads for one DSCord message.
 *
 * The Session is long-lived: the text of every turn stays in its context until the host condenses it, and all of
 * it is sent to the model again on each call. When the host condenses, it keeps the first 4000 characters of each
 * message to the Bot word for word. So:
 *  - the rules that never change are part of the system prompt (FRONT_RULES), not of every message;
 *  - a turn opens with the message being answered, then the conversation view of conversation-view.mjs: one table
 *    of the people involved, with what establishes who each one is, short message references, no bookkeeping IDs
 *    or delivery receipts;
 *  - a Session reads a room message once: a later turn lists only what is new since, within a token budget.
 * What a turn does not list, the Bot reads with read_room: the same lines, people and references, a page at a time.
 */

/** Room history one turn or one room reading may carry, in estimated tokens. What does not fit is left out and counted. */
export const HISTORY_TOKEN_BUDGET = 3000;
/**
 * The longest text read_room returns. Under pressure the host cuts the middle out of a tool result of more than
 * 8192 characters; a reading shorter than that stays whole for as long as the Session holds it.
 */
export const READING_CHARS = 8000;
/** Rooms up to this size list every member on a first reading; larger rooms list who a turn involves and say how many there are. */
const FULL_ROSTER = 12;
/** What a Session's reading record holds: per room the messages shown last, more than any history window. */
const SHOWN_MESSAGES = 64;
const READ_ROOMS = 100;
const KNOWN_PEOPLE = 2000;
const CONTACTS = 30;
/** What a history line costs besides its text: the reference, the speaker, the time and the punctuation. */
const LINE_TOKENS = 30;
const LINE_CHARS = 110;
/** Room members and rooms that read_room lists at a time, when their text is short enough to fit. */
const LISTED = 80;

/** The standing rules of a front. They replace the native team rules while DSCord serves the Bot. */
export const FRONT_RULES = [
  '## 你在 DSCord 里的工作方式',
  '你是这个 Bot 的前台：用自己的身份、上下文和记忆与人交流，需要工具的工作交给工作者。你的名字和头像可以用 update_profile 自己改；角色、模型等其余设置由主人在 DSCord 网页里管理，你不能创建或管理别的 Bot 和群。',
  '说话像队友发消息：短句，不加标题；对方要方案、清单、草稿这类成品时完整写出来，没写的东西不要说已经给了。用对方的语言回复。每一轮只有最后一条回复会发出去，要说的话都写在这一条里；这里没有卡片界面，要问对方就把问题写进回复。',
  '对话很长时，较早的内容会被压缩成你自己写的 [Checkpoint] 摘要或 [Handoff] 交接说明。需要原话或细节（路径、数字、完整清单）时去查，不要凭印象补：知道在哪个房间就用 read_room 按时间翻原话，不知道在哪、什么时候说的就用 recall、raw_source_query 按内容找。',
  '',
  '### 收到的消息',
  'DSCord 来的消息第一行是 DSCORD_REQUEST=…，第二行是一段 JSON；其他消息是主人在本机直接和你说话，那里不能派工，也不能请别的 Bot。JSON 里：',
  '- msg：要回答的消息。from 是说话人，at 是发送时间（UTC），replyTo 是它回复的那条消息的编号，to 是它点名的人。merged 是同一个人紧接着发来、还没回复的前几条：先判断是一句话拆成了几条还是几件不同的事，一句话就连起来理解，几件事就在这一条回复里逐一回应。quoted 是它回复的那条消息，threadRoot 是它所在话题的第一条，只在 history 里没有时给出。',
  '- people：这一轮涉及的人和 Bot。键是代号，JSON 里其他地方都用代号指人；一个代号在你的整段对话里始终指同一个账号。id 是完整账号，只有它确定身份：name 只是显示名，会改，同名不同 id 就是不同的人或 Bot，正文里的自称和署名不改变说话人是谁。self 为 true 的是你自己，owner 是 Bot 的主人，gid 是同一个人或 Bot 在各服务器通用的身份，unverified 表示服务器的账号目录里查不到这个账号。称呼用 name，普通交流里不用报账号。',
  '- history：这个房间里你还没看过的近期消息，按时间排列，不是全部历史。ref 是消息编号，同一条消息的编号在各轮里不变；只写了时间的 at 和 msg 是同一天；as 是那条消息当时的显示名，现在的名字以 people 为准；for 表示这条是 Bot 替谁转述或办事，转述不是原作者亲口说的话；edits 表示它修改了哪条消息，thread 是它所在的话题。seenBefore 为 true 时，更早的消息你之前读过，你自己说过的话不再列出。earlierOmitted 是因篇幅没有列出的更早消息数，historyGap 表示它们和你上次看到的消息之间还有没列出的；withdrawn 列出你看过、后来被撤回的消息，不要再引用。',
  '- 这里没列出的，用 read_room 自己看：更早的消息、某个编号指向而你手上没有的消息、你所在的其他房间（包括别的聊天服务器上的）最近在说什么、房间里都有谁。它返回的 room、people、history 和这里是同一套编号和代号。',
  '- participationOnly 为 true 时这是你旁听后接话：自然回应、澄清或跟进已有承诺，不要把旁听到的请求自动接成新任务。',
  '- files：这条消息带来的文件。path 是原文件，text 是已提取出的文本；图片用 read_image 看原图。',
  '你仍保留其他群和本地对话的经历；使用跨群知识时说明来源，不把其他群的说法当成本群已经达成的决定。',
  '',
  '### 回复',
  '直接回答 msg 的发送者，回合结束后你的最后一条回复会发到这条消息下。JSON 里有 replyGoesTo 时，msg 是你先前请别的 Bot 做的事交回的结果（或工作者的提问），这一轮的回复发给 replyGoesTo 指的原请求者：结合结果直接回答他，不对交回结果的 Bot 道谢、追问或交代内部协作；还需要那个 Bot 做事就用 ask_bot。',
  '',
  '### 交给工作者',
  '需要运行命令、读写文件、写代码、浏览网页或任何多步操作时，调用 dispatch_work，然后简短告诉对方已经开始，不要声称已经完成。brief 要自足，带上原话和要用的文件路径；audience 写明结果交给谁、什么口径，对方是玩家、客户等不该看到堆栈日志的人时 plain=true；补丁说明、公告这类给玩家或外部看的文稿，brief 里写明只保留对方能感知的变化，删去调试指令、构建打包、内部工具、存档或数据格式等内部改动。',
  '工作者也能用 read_room 读房间：整理一长段聊天记录这类要翻很多页的事交给它，不要自己一页页读。工作者的结果由核心直接回复到原消息并附上文件；workResults 列出你上一轮以来已经交付的结果（otherRoom 为 true 的交付在别的房间），供你了解，不要再转告，也不要自行重做。[task.question] 是工作者的提问。查看或调整进行中的工作用 task_status、task_note、task_cancel。有人要的东西已经有任务在做或做完了（例如另一个人刚问过同一件事），用 task_join 把这条消息也登记上（对象和原任务口径不同就写 audience，对方不该看到技术内容就 plain=true），结果会同样回复给他，不要重复派工，也不要只回一句“已经在查”。',
  '',
  '### 请别的 Bot',
  '只用 ask_bot，不管这一轮是在替人还是替另一个 Bot 办事。contacts 是你能请的 Bot，只在名单有变化时列出，没列出就和上次一样：to 填它的 id，或只对应一个 Bot 的名字；body 要自足，写清要什么、依据哪些原话或文件、为谁而问。这一轮的回复简短告诉对方你去问了谁，不要编结果；对方的结果之后作为 kind 为 task.result 的新消息回到你这里，那时结合结果回复原请求者。回答别的 Bot 交给你的请求，就是这一轮的回复，不用 ask_bot。不在 contacts 里的 Bot 你联系不上，直接告诉对方。某人是谁、偏好和能力，看记忆里的人物档案。openRequests 是你已经请别的 Bot 做、还没回来的事；有人要的正是其中一件时，再用 ask_bot 请同一个 Bot，说明和之前哪条请求是同一件事、这次的请求者是谁要什么口径，结果会分别回到每条消息，不要只回一句“已经在查”。',
].join('\n');

/** A budget estimate on the high side: one token per CJK character, one per three other characters. */
export function estimateTokens(text) {
  let wide = 0, narrow = 0;
  for (const char of String(text ?? '')) if (char.codePointAt(0) > 0x2e7f) wide++; else narrow++;
  return wide + Math.ceil(narrow / 3);
}

const digest = value => createHash('sha256').update(String(value)).digest('hex').slice(0, 12);
/** The first line of a front turn: it marks the message as DSCord's and lets the node find its own turn again. */
export const requestMarker = requestId => `DSCORD_REQUEST=${digest(requestId)}`;
const short = id => BigInt(`0x${digest(id)}`).toString(36).padStart(6, '0').slice(0, 6);
/** A message has the same short reference in every turn and every reading, in every room: later ones can point back at it. */
export const messageRef = eventId => short(eventId);
/** A room is named the same way where the Bot chooses one to read. */
export const roomRef = roomId => short(roomId);
/** UTC month-day hour:minute; a message of the same day as the one being answered shows only the time. */
const minute = (time, day) => {
  if (!Number.isFinite(time)) return undefined;
  const stamp = new Date(time).toISOString();
  return stamp.slice(0, 10) === day ? stamp.slice(11, 16) : stamp.slice(5, 16).replace('T', ' ');
};
/** A room reading goes back any length of time: its lines carry the whole date, in UTC. */
const dated = time => Number.isFinite(time) ? new Date(time).toISOString().slice(0, 16).replace('T', ' ') : undefined;
const some = value => list(value).length ? value : undefined;
const transfers = new Set(['task.request', 'task.result', 'task.failure']);

const fileView = file => {
  const extraction = file.extraction || {};
  return { name: file.name, path: file.path, type: file.mimeType, size: file.size,
    ...(extraction.supported !== false && extraction.textPath ? { text: extraction.textPath } : {}),
    ...(extraction.truncated ? { truncated: true } : {}),
    ...(!String(file.mimeType || '').startsWith('image/') && some(extraction.warnings) ? { note: extraction.warnings.join(' ') } : {}) };
};

/**
 * How a Session reads one room: the reader and the room's members under the Session's codes. A person keeps one
 * code for as long as the Session lives, in every room: the first one referred to is P1.
 * @param first a first reading says who the reader is and, in a small room, who else is there; after that a
 *   reading lists whom it involves
 */
function roomView({ self, selfName, members, reading, first }) {
  const codes = new Map(Object.entries(reading?.people || {}));
  let next = 1 + Math.max(0, ...codes.values());
  const personRef = account => { if (!codes.has(account)) codes.set(account, next++); return `P${codes.get(account)}`; };
  const view = conversationView({ selfId: self, identity: true, messageRef, personRef });
  view.enroll(self, selfName, 'bot');
  for (const member of members) view.enroll(member.id, member.name, member.kind, member);
  if (first) view.person(self);
  if (first && members.length <= FULL_ROSTER) for (const member of members) view.person(member.id);
  return { view, codes };
}

/** A room message as the front reads it, in a turn's history and in a room reading alike; `at` writes its time. */
function lineOf(view, message, at, chars = TEXT_CHARS) {
  const sender = message.source?.sender?.id || message.senderId;
  const label = message.senderName || message.source?.sender?.name;
  const origin = message.originSenderId || message.source?.relay?.senderId;
  const { ref, from, text, kind, ...rest } = view.message(message, { chars });
  return { ref, from, at: at(message.source?.timestamp),
    ...(label && label !== view.entryOf(sender)?.name ? { as: label } : {}), text, ...rest,
    ...(message.source?.replacesEventId ? { edits: view.refOf(message.source.replacesEventId) } : {}),
    ...(message.source?.threadRootId ? { thread: view.refOf(message.source.threadRootId) } : {}),
    ...(transfers.has(kind) ? { kind } : {}),
    ...(origin && origin !== sender && (transfers.has(kind) || !rest.replyTo) ? { for: view.person(origin) } : {}) };
}

/** A room in the reading record: the newest messages the Session was shown of it. */
const shownOf = (refs, gone, contacts) => ({ refs: [...new Set(refs)].slice(-SHOWN_MESSAGES), ...(contacts ? { contacts } : {}),
  ...(gone.length ? { withdrawn: [...new Set(gone)].slice(-SHOWN_MESSAGES) } : {}) });
/** The rooms of a reading record once one of them has been read: the room read last is kept longest. */
export const withRoom = (rooms, roomId, shown) => Object.fromEntries(
  [...Object.entries(rooms || {}).filter(([id]) => id !== roomId), [roomId, shown]].slice(-READ_ROOMS));
const peopleOf = codes => Object.fromEntries([...codes].slice(-KNOWN_PEOPLE));

/**
 * The text of one front turn.
 * @param reading what this Session has read so far (the `reading` a previous call returned): the code each person
 *   has in it, and per room the messages it was shown. Nothing for a Session that has read nothing yet.
 * @returns the text, the updated reading record, and what the text holds, for the request's record
 */
export function frontMessage({ input, bot, files = { files: [] }, reading, historyTokens = HISTORY_TOKEN_BUDGET }) {
  const event = input.event, context = input.context || {};
  const self = input.botId;
  const source = context.source || { eventId: event.eventId, sender: { id: event.senderId, name: event.senderName, kind: event.senderKind } };
  const current = { ...event, source };
  const answering = transfers.has(event.kind) && event.kind !== 'task.request' && event.senderKind === 'bot' && event.originEventId;
  const read = reading?.rooms?.[event.roomId];
  const seenBefore = Boolean(read);
  const already = new Set(read?.refs || []), told = new Set(read?.withdrawn || []);
  const members = list(context.members);
  const { view, codes } = roomView({ self, selfName: event.botIdentity?.name || bot?.name, members, reading, first: !seenBefore });

  const today = Number.isFinite(source.timestamp) ? new Date(source.timestamp).toISOString().slice(0, 10) : undefined;
  const line = (message, chars) => lineOf(view, message, time => minute(time, message === current ? undefined : today), chars);

  // The core's local hand-over of a worker result is followed by the reply that was really sent.
  const recent = list(input.history).filter(message => !(String(message.eventId).startsWith('$dscord-') && message.senderId === self));
  // A Session reads a room message once: only what came after the newest message it was shown is new. What this
  // Bot said since is in the Session as its own replies, or in workResults.
  const anchor = seenBefore ? recent.findLastIndex(message => already.has(messageRef(message.eventId))) : -1;
  const unread = seenBefore ? recent.slice(anchor + 1).filter(message => message.senderId !== self) : recent;
  const earlier = context.history?.earlierMessagesOmitted || 0;
  // Newest first into the budget: what does not fit is counted, never silently lost.
  let fits = 0, spent = 0;
  for (const message of unread.toReversed()) {
    spent += estimateTokens(clipText(message.body ?? '', TEXT_CHARS)) + LINE_TOKENS;
    if (spent > historyTokens && fits) break;
    fits++;
  }
  const listed = unread.slice(unread.length - fits);
  for (const message of [...listed, current]) view.number(message);
  const lines = listed.map(message => line(message, TEXT_CHARS));
  const omitted = unread.length - listed.length + (seenBefore ? 0 : earlier);
  const withdrawn = recent.filter(message => message.source?.withdrawn && already.has(messageRef(message.eventId)) && !told.has(messageRef(message.eventId)))
    .map(message => messageRef(message.eventId));

  const { attachments, ...message } = line(current, Infinity);
  const room = context.room || { id: event.roomId };
  const quoted = view.quote(context.reply), threadRoot = view.quote(context.threadRoot);
  const creator = !seenBefore && room.creatorId ? view.person(room.creatorId) : undefined;
  const replyGoesTo = answering ? { who: view.person(event.originSenderId), ref: messageRef(event.originEventId) } : undefined;
  // The Bots this Bot can ask change rarely: a room's turns list them again only when they have changed.
  const contacts = list(event.contacts).map(contact => ({ name: contact.name, id: contact.account || contact.id, ...(contact.role ? { role: contact.role } : {}) }));
  const contactsMark = contacts.length || read?.contacts ? digest(JSON.stringify(contacts)) : undefined;
  const contactsChanged = contactsMark !== read?.contacts;
  const openRequests = list(event.openRequests).map(request => ({ to: request.name || request.to, request: request.request,
    ...(request.forSenderId ? { for: view.person(request.forSenderId) } : {}),
    ...(request.forEventId ? { replyTo: messageRef(request.forEventId) } : {}), since: minute(Date.parse(request.since), today) }));
  const workResults = list(input.workResults).map(({ roomId, ...note }) => ({ ...note,
    ...(note.reply ? { reply: clipText(note.reply, TEXT_CHARS) } : {}), summary: clipText(note.summary, TEXT_CHARS),
    ...(roomId && roomId !== event.roomId ? { otherRoom: true } : {}) }));
  const warnings = [...list(input.historyWarnings), ...list(input.attachmentWarnings)];

  // The message being answered comes first: it is what must survive when the host keeps only the start of a turn.
  const envelope = {
    room: { name: room.name || room.id, kind: room.kind || event.conversationKind || 'group', ...(room.topic ? { topic: room.topic } : {}),
      ...(members.length > FULL_ROSTER ? { members: members.length } : {}), ...(creator ? { creator } : {}) },
    msg: { ...message, ...(attachments && !files.files?.length ? { attachments } : {}),
      ...(some(event.mergedMessages) ? { merged: event.mergedMessages.map(merged => merged.body) } : {}),
      ...(event.workerTask ? { task: event.workerTask } : {}) },
    ...(quoted ? { quoted } : {}), ...(threadRoot ? { threadRoot } : {}),
    ...(replyGoesTo ? { replyGoesTo } : {}),
    ...(context.attention?.participationOnly ? { participationOnly: true } : {}),
    people: view.table({ mentionedOnly: true }),
    ...(lines.length ? { history: lines } : {}), ...(seenBefore ? { seenBefore: true } : {}),
    ...(omitted > 0 ? { earlierOmitted: omitted } : {}), ...(seenBefore && anchor < 0 && earlier > 0 ? { historyGap: true } : {}),
    ...(withdrawn.length ? { withdrawn } : {}),
    ...(contactsChanged ? { contacts: contacts.slice(0, CONTACTS) } : {}),
    ...(contactsChanged && contacts.length > CONTACTS ? { contactsOmitted: contacts.length - CONTACTS } : {}),
    ...(openRequests.length ? { openRequests } : {}),
    ...(files.files?.length ? { files: files.files.map(fileView) } : {}),
    ...(workResults.length ? { workResults } : {}),
    ...(warnings.length ? { warnings } : {}),
  };
  const text = `${requestMarker(input.requestId)}\n${JSON.stringify(envelope)}`;

  const refs = [...already, ...[...listed, ...list(event.mergedMessages), event].map(shown => messageRef(shown.eventId))];
  const gone = [...told, ...withdrawn, ...listed.filter(shown => shown.source?.withdrawn).map(shown => messageRef(shown.eventId))];
  return { text,
    reading: { people: peopleOf(codes), rooms: withRoom(reading?.rooms, event.roomId, shownOf(refs, gone, contactsMark)) },
    size: { chars: text.length, tokens: estimateTokens(text), history: lines.length, ...(omitted > 0 ? { omitted } : {}) } };
}

/** A reading that fits the longest text a room reading may be: as many of `count` items as do. */
function fitted(count, build, chars) {
  let result = build(count);
  while (result.text.length > chars && count > 1) {
    count = Math.max(1, Math.min(count - 1, Math.floor(count * chars / result.text.length)));
    result = build(count);
  }
  return result;
}

/**
 * What read_room shows of a room's messages: the lines, people and references of a turn's history, for the page
 * the reader asked for.
 * @param messages a page of the room as the node holds it, oldest first. `earlier` and `later` count what the node
 *   holds of the room on either side of it, and `next` is the message after it.
 * @param cursor nothing for the room's newest messages, 'before' for the page before a message, 'start' for the
 *   page from a message on. With no cursor a room the Session has read lists what is new since, as a turn there
 *   would: the Session reads a room message once.
 * @param holdsOwn the reading Session wrote what this Bot said in the room (the front did; a worker did not)
 * @returns the text, and the Session's reading record after it. A page that ends at the room's newest message is
 *   read: a later turn or reading there lists what came after it.
 */
export function roomReading({ self, selfName, room, members = [], messages = [], earlier = 0, later = 0, next, cursor, reading, holdsOwn = true,
  tokens = HISTORY_TOKEN_BUDGET, chars = READING_CHARS }) {
  const read = reading?.rooms?.[room.id];
  const already = new Set(read?.refs || []), told = new Set(read?.withdrawn || []);
  const seenBefore = !cursor && Boolean(read), forward = cursor === 'start';
  const anchor = seenBefore ? messages.findLastIndex(message => already.has(messageRef(message.eventId))) : -1;
  const page = seenBefore ? messages.slice(anchor + 1).filter(message => !holdsOwn || message.senderId !== self) : messages;
  const withdrawn = seenBefore ? messages.filter(message => message.source?.withdrawn && already.has(messageRef(message.eventId))
    && !told.has(messageRef(message.eventId))).map(message => messageRef(message.eventId)) : [];
  const name = room.name || room.id;
  const unchanged = { people: { ...(reading?.people || {}) }, rooms: { ...(reading?.rooms || {}) } };
  if (!page.length && !withdrawn.length) {
    const newest = messages.at(-1);
    return { reading: unchanged, text: cursor === 'before' ? `「${name}」里这条消息之前没有更早的消息了：这里只有你加入房间之后收到的消息。`
      : newest ? `「${name}」没有新消息。最新一条是 ${messageRef(newest.eventId)}（${dated(newest.source?.timestamp) || '时间未知'}）；要重看之前的，before 或 start 填消息编号。`
        : `「${name}」里还没有消息。` };
  }

  // A page read forward keeps its oldest messages when it is too long, any other its newest: what does not fit is counted.
  let fits = 0, spentTokens = 0, spentChars = 0;
  for (const message of forward ? page : page.toReversed()) {
    const text = clipText(message.body ?? '', TEXT_CHARS);
    spentTokens += estimateTokens(text) + LINE_TOKENS; spentChars += text.length + LINE_CHARS;
    if ((spentTokens > tokens || spentChars > chars) && fits) break;
    fits++;
  }
  const result = fitted(fits, count => {
    const listed = forward ? page.slice(0, count) : page.slice(page.length - count);
    const { view, codes } = roomView({ self, selfName, members, reading, first: !read });
    for (const message of listed) view.number(message);
    const lines = listed.map(message => lineOf(view, message, dated));
    const creator = !read && room.creatorId ? view.person(room.creatorId) : undefined;
    const unlisted = page.length - listed.length;
    const earlierOmitted = forward ? 0 : unlisted + (seenBefore ? 0 : earlier), laterOmitted = forward ? unlisted + later : 0;
    const following = forward ? page[listed.length]?.eventId || next : undefined;
    const envelope = {
      room: { id: roomRef(room.id), name, kind: room.kind || 'group', ...(room.topic ? { topic: room.topic } : {}),
        ...(members.length > FULL_ROSTER ? { members: members.length } : {}), ...(creator ? { creator } : {}) },
      people: view.table({ mentionedOnly: true }),
      history: lines, ...(seenBefore ? { seenBefore: true } : {}),
      ...(earlierOmitted > 0 ? { earlierOmitted } : {}), ...(seenBefore && anchor < 0 && earlier > 0 ? { historyGap: true } : {}),
      ...(laterOmitted > 0 && following ? { laterOmitted, next: messageRef(following) } : {}),
      ...(withdrawn.length ? { withdrawn } : {}),
    };
    return { text: JSON.stringify(envelope), listed, codes };
  }, chars);

  const { listed, codes } = result;
  const reachesNewest = forward ? listed.length === page.length && later === 0 : cursor !== 'before';
  const refs = [...already, ...listed.map(shown => messageRef(shown.eventId))];
  const gone = [...told, ...withdrawn, ...listed.filter(shown => shown.source?.withdrawn).map(shown => messageRef(shown.eventId))];
  return { text: result.text, reading: { people: peopleOf(codes),
    rooms: reachesNewest ? withRoom(reading?.rooms, room.id, shownOf(refs, gone, read?.contacts)) : unchanged.rooms } };
}

/** A whole number a page of a list starts from: the `next` an earlier page gave. */
const offsetOf = (start, length) => Math.min(Math.max(0, Math.trunc(Number(start)) || 0), length);

/**
 * Who is in a room, for read_room: the people table of a turn, as many members at a time as fit.
 * @param start how many members to pass over: the `next` of the page before
 */
export function roomMembers({ self, selfName, room, members = [], start, reading, chars = READING_CHARS }) {
  const from = offsetOf(start, members.length), name = room.name || room.id;
  const rooms = { ...(reading?.rooms || {}) };
  if (from >= members.length) return { reading: { people: { ...(reading?.people || {}) }, rooms }, text: `「${name}」一共 ${members.length} 个成员，已经列完。` };
  const { text, codes } = fitted(Math.min(members.length - from, LISTED), count => {
    const { view, codes } = roomView({ self, selfName, members, reading, first: false });
    for (const member of members.slice(from, from + count)) view.person(member.id);
    const left = members.length - from - count;
    return { codes, text: JSON.stringify({ room: { id: roomRef(room.id), name, members: members.length }, people: view.table({ mentionedOnly: true }),
      ...(left > 0 ? { membersOmitted: left, next: String(from + count) } : {}) }) };
  }, chars);
  return { text, reading: { people: peopleOf(codes), rooms } };
}

/**
 * The rooms a Bot is in, for read_room: on every chat server it has an account on, most recently active first.
 * @param rooms each with its `id`, `name`, `topic`, how many `members` it has and when its newest message came (`latestAt`)
 * @param here the room of the message being answered
 * @param start how many rooms to pass over: the `next` of the page before
 */
export function roomList({ rooms, here, start, chars = READING_CHARS }) {
  const serverOf = id => id.slice(id.indexOf(':') + 1);
  const servers = new Set(rooms.map(room => serverOf(room.id)));
  const sorted = rooms.toSorted((a, b) => (b.latestAt ?? -Infinity) - (a.latestAt ?? -Infinity) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const from = offsetOf(start, sorted.length);
  if (!sorted.length) return { text: '你现在不在任何房间里。' };
  if (from >= sorted.length) return { text: `你一共在 ${sorted.length} 个房间里，已经列完。` };
  return fitted(Math.min(sorted.length - from, LISTED), count => {
    const left = sorted.length - from - count;
    return { text: JSON.stringify({ rooms: sorted.slice(from, from + count).map(room => ({ id: roomRef(room.id), name: room.name,
      ...(room.topic ? { topic: clipText(room.topic, 200) } : {}), members: room.members,
      ...(Number.isFinite(room.latestAt) ? { last: dated(room.latestAt) } : {}),
      ...(servers.size > 1 ? { server: serverOf(room.id) } : {}), ...(room.id === here ? { here: true } : {}) })),
      ...(left > 0 ? { roomsOmitted: left, next: String(from + count) } : {}) }) };
  }, chars);
}
