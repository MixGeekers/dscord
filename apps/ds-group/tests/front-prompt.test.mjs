import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateTokens, frontMessage, FRONT_RULES, HISTORY_TOKEN_BUDGET, messageRef, READING_CHARS, requestMarker, roomList, roomMembers, roomReading,
  roomRef } from '../src/front-prompt.mjs';
import { conversationContext, messageSource, speakerOf } from '../src/message-context.mjs';
import { projectNativeRequestMessage } from '../src/native-request.mjs';
import { install } from '../vendor/ds-bot/src/host/prompt.js';

const ANN = '@ann:chat.test', SELF = '@lin:chat.test', PEER = '@zhou:chat.test', GUEST = '@guest:elsewhere.test';
const ROOM = '!project:chat.test';
const people = [
  { id: PEER, name: '小周', kind: 'bot', globalId: 'zhou@id.test', ownerId: ANN },
  { id: SELF, name: '小林', kind: 'bot', globalId: 'lin@id.test', ownerId: ANN },
  { id: ANN, name: 'Ann', kind: 'human', globalId: 'ann@id.test' },
];
// Both Bots were renamed: every name carries member-state provenance, as in a real room.
const room = { name: '项目群', topic: '', creatorId: ANN, members: [...people.map(person => person.id), GUEST],
  memberProfiles: Object.fromEntries(people.map(person => [person.id, { displayname: person.name, source: 'matrix-member-state',
    observedAt: 1, eventTimestamp: 1, eventId: `$rename-${person.id}-0123456789abcdefghijklmnopqrstu` }])) };
const T0 = Date.UTC(2026, 10, 11, 20, 0);
const id = index => `$event-${index}-0123456789abcdefghijklmnopqrstuvwxyz`;
const said = (index, sender, body, { replyTo, meta, relation, minutes = index } = {}) => ({ type: 'm.room.message', event_id: id(index), room_id: ROOM, sender,
  origin_server_ts: T0 + minutes * 60_000, content: { body, ...(meta ? { 'org.ds_group': meta } : {}),
    ...(replyTo !== undefined ? { 'm.relates_to': { 'm.in_reply_to': { event_id: id(replyTo) } } } : {}), ...(relation ? { 'm.relates_to': relation } : {}) } });
const nameOf = sender => people.find(person => person.id === sender)?.name || sender;
const kindOf = sender => people.find(person => person.id === sender)?.kind;
const item = event => ({ eventId: event.event_id, roomId: event.room_id, source: messageSource(event, people, room), senderId: event.sender,
  senderName: nameOf(event.sender), senderKind: kindOf(event.sender), body: event.content.body, attachments: [], to: event.content['org.ds_group']?.to || [],
  kind: event.content['org.ds_group']?.kind, originSenderId: event.content['org.ds_group']?.originSenderId });
/** The request the node builds for the last of these room events, as the Bot `self`. */
function request(events, { self = SELF, earlier = 0, event = {}, ...rest } = {}) {
  const current = events.at(-1), before = events.slice(0, -1), meta = current.content['org.ds_group'] || {};
  const replied = before.find(previous => previous.event_id === current.content['m.relates_to']?.['m.in_reply_to']?.event_id);
  return { requestId: `matrix-${current.event_id}`, botId: self,
    context: conversationContext({ event: current, participants: people, room, history: before, earlierCount: earlier, reply: replied }),
    event: { eventId: current.event_id, roomId: ROOM, senderId: current.sender, senderName: nameOf(current.sender), senderKind: kindOf(current.sender),
      botIdentity: { id: self, name: nameOf(self), role: '通用助手' }, contacts: [], openRequests: [], body: current.content.body, to: meta.to || [], attachments: [],
      delivery: { kind: 'origin', state: 'requested', authoritative: true, sourceEventId: current.event_id, originBotId: self },
      ...(meta.kind ? { kind: meta.kind } : {}), ...(meta.originSenderId ? { originSenderId: meta.originSenderId } : {}),
      ...(meta.originEventId ? { originEventId: meta.originEventId, originRoomId: ROOM } : {}), ...event },
    history: before.map(item), ...rest };
}
const turnOf = result => JSON.parse(result.text.split('\n')[1]);
const chat = [said(0, ANN, '大家早上好'), said(1, PEER, '早上好，我在。', { replyTo: 0 }), said(2, ANN, '你们两个刚才怎么没回', { meta: { to: [SELF, PEER] } }),
  said(3, SELF, '刚才网络断了一下。', { replyTo: 2 }), said(4, ANN, '这份表格谁来整理')];

test('a turn opens with the message being answered and says who is who, without the node\'s bookkeeping', () => {
  const input = request(chat);
  const before = JSON.stringify(input);
  const result = frontMessage({ input, bot: { id: 'native-lin', name: '小林' } });
  const [marker, json, ...more] = result.text.split('\n');
  assert.equal(marker, requestMarker(input.requestId)); assert.deepEqual(more, []);
  assert.equal(marker.includes(input.requestId), false);
  const turn = JSON.parse(json);
  assert.deepEqual(Object.keys(turn), ['room', 'msg', 'people', 'history']);
  assert.deepEqual(turn.room, { name: '项目群', kind: 'group', creator: 'P3' });
  assert.deepEqual(turn.msg, { ref: messageRef(id(4)), from: 'P3', at: '11-11 20:04', text: '这份表格谁来整理' });
  // The reader is P1; every account carries what establishes who it is. Names are labels beside it.
  assert.deepEqual(turn.people, {
    P1: { name: '小林', self: true, kind: 'bot', id: SELF, gid: 'lin@id.test', owner: 'P3' },
    P2: { name: '小周', kind: 'bot', id: PEER, gid: 'zhou@id.test', owner: 'P3' },
    P3: { name: 'Ann', kind: 'human', id: ANN, gid: 'ann@id.test' },
    // In the room but not in the server's account directory: the name proves nothing.
    P4: { name: GUEST, id: GUEST, unverified: true },
  });
  assert.deepEqual(turn.history, [
    { ref: messageRef(id(0)), from: 'P3', at: '20:00', text: '大家早上好' },
    { ref: messageRef(id(1)), from: 'P2', at: '20:01', text: '早上好，我在。', replyTo: messageRef(id(0)) },
    { ref: messageRef(id(2)), from: 'P3', at: '20:02', text: '你们两个刚才怎么没回', to: ['P1', 'P2'] },
    { ref: messageRef(id(3)), from: 'P1', at: '20:03', text: '刚才网络断了一下。', replyTo: messageRef(id(2)) },
  ]);
  for (const bookkeeping of ['$event-', '$rename-', ROOM, 'identitySource', 'nameEventId', 'nameObservedAt', 'transport', 'delivery', 'requestId', input.requestId])
    assert.equal(json.includes(bookkeeping), false, bookkeeping);
  // The host keeps the first 4000 characters of a turn when it condenses the Session: the message is among them.
  assert.ok(result.text.indexOf('这份表格谁来整理') < 200);
  assert.deepEqual(result.size, { chars: result.text.length, tokens: estimateTokens(result.text), history: 4 });
  assert.equal(JSON.stringify(input), before, 'the request the memory keeps is not changed');
});

test('a Session reads a room message once: the next turn lists what is new and whom it involves', () => {
  const first = frontMessage({ input: request(chat) });
  const next = [...chat, said(5, SELF, '我来整理，今天下班前给你。', { replyTo: 4 }), said(6, PEER, '我可以帮忙核对数字。', { replyTo: 4 }),
    said(7, ANN, '那我明天上午来看')];
  const second = frontMessage({ input: request(next), reading: first.reading });
  assert.deepEqual(turnOf(second), {
    room: { name: '项目群', kind: 'group' },
    msg: { ref: messageRef(id(7)), from: 'P3', at: '11-11 20:07', text: '那我明天上午来看' },
    // The same accounts under the same codes as before; the reader's own reply is in its Session already.
    people: { P2: { name: '小周', kind: 'bot', id: PEER, gid: 'zhou@id.test', owner: 'P3' }, P3: { name: 'Ann', kind: 'human', id: ANN, gid: 'ann@id.test' } },
    history: [{ ref: messageRef(id(6)), from: 'P2', at: '20:06', text: '我可以帮忙核对数字。', replyTo: messageRef(id(4)) }],
    seenBefore: true,
  });
  assert.ok(second.text.length < first.text.length);
  // Another room is read for the first time, by the same reader with the same codes.
  const elsewhere = request(next);
  elsewhere.event.roomId = '!other:chat.test';
  const third = frontMessage({ input: elsewhere, reading: second.reading });
  assert.equal(turnOf(third).seenBefore, undefined); assert.equal(turnOf(third).history.length, 7);
  assert.equal(turnOf(third).people.P1.self, true); assert.equal(turnOf(third).people.P2.id, PEER);
  assert.deepEqual(Object.keys(third.reading.rooms), [ROOM, '!other:chat.test']);
  assert.deepEqual(third.reading.people, { [SELF]: 1, [PEER]: 2, [ANN]: 3, [GUEST]: 4 });
});

test('history fits its token budget: the oldest messages are left out first and counted', () => {
  const long = '可以，下午三点前给你初稿。'.repeat(120);
  const events = [...Array.from({ length: 30 }, (_, index) => said(index, index % 2 ? PEER : ANN, `${index}：${long}`)), said(30, ANN, '所以呢')];
  const result = frontMessage({ input: request(events, { earlier: 12 }) });
  const turn = turnOf(result);
  assert.ok(turn.history.length >= 2 && turn.history.length < 30);
  assert.equal(turn.history.at(-1).text.startsWith('29：'), true);
  assert.match(turn.history[0].text, /…（原文 \d+ 字，已截断）$/);
  assert.equal(turn.earlierOmitted, 30 - turn.history.length + 12);
  assert.deepEqual(result.size, { chars: result.text.length, tokens: estimateTokens(result.text), history: turn.history.length, omitted: turn.earlierOmitted });
  assert.ok(estimateTokens(JSON.stringify(turn.history)) <= HISTORY_TOKEN_BUDGET * 1.1);
  const tight = turnOf(frontMessage({ input: request(events), historyTokens: 100 }));
  assert.equal(tight.history.length, 1, 'the newest message is always listed');
  // What was left out is not what the Session saw: the next turn does not bring it back, and says there is a gap
  // only when the window has moved past everything it was shown.
  const later = [...events.slice(20), ...Array.from({ length: 45 }, (_, index) => said(31 + index, ANN, `新消息 ${index}`))];
  const moved = turnOf(frontMessage({ input: request(later.slice(-41), { earlier: 35 }), reading: result.reading }));
  assert.equal(moved.historyGap, true); assert.equal(moved.history.length, 40);
  const near = turnOf(frontMessage({ input: request([...events, said(31, PEER, '嗯'), said(32, ANN, '好')], { earlier: 12 }), reading: result.reading }));
  assert.deepEqual(near.history.map(line => line.text), ['嗯']); assert.equal(near.historyGap, undefined); assert.equal(near.earlierOmitted, undefined);
});

test('edits, threads, relays, old names and withdrawn messages keep their meaning', () => {
  const events = [said(0, ANN, '预算 300'), said(1, ANN, '预算 350', { relation: { rel_type: 'm.replace', event_id: id(0) } }),
    said(2, PEER, '话题里的回复', { relation: { rel_type: 'm.thread', event_id: id(0) } }),
    said(3, PEER, '安让我转告：周五交。', { meta: { originSenderId: ANN } }), said(4, ANN, '好')];
  const input = request(events);
  input.history[2].senderName = '周周';
  const first = frontMessage({ input });
  const turn = turnOf(first);
  assert.equal(turn.history[1].edits, messageRef(id(0)));
  assert.equal(turn.history[2].thread, messageRef(id(0))); assert.equal(turn.history[2].as, '周周');
  // A relay is the relaying Bot's message on someone's behalf, not that person's own words.
  assert.equal(turn.history[3].from, 'P2'); assert.equal(turn.history[3].for, 'P3');
  // A message the Session was shown and that is withdrawn afterwards is named once, by its reference.
  const withdrawn = request([...events, said(5, PEER, '收到')]);
  Object.assign(withdrawn.history[0], { body: '[message withdrawn]', source: { ...withdrawn.history[0].source, withdrawn: true } });
  const second = frontMessage({ input: withdrawn, reading: first.reading });
  assert.deepEqual(turnOf(second).withdrawn, [messageRef(id(0))]);
  const again = request([...events, said(5, PEER, '收到'), said(6, ANN, '嗯')]);
  Object.assign(again.history[0], { body: '[message withdrawn]', source: { ...again.history[0].source, withdrawn: true } });
  assert.equal(turnOf(frontMessage({ input: again, reading: second.reading })).withdrawn, undefined);
  // One that was withdrawn before it was ever shown is a line that says so.
  const fresh = turnOf(frontMessage({ input: withdrawn }));
  assert.deepEqual([fresh.history[0].text, fresh.history[0].withdrawn], ['[message withdrawn]', true]); assert.equal(fresh.withdrawn, undefined);
});

test('a reply to a message outside the listed history quotes it, with its own author', () => {
  const events = [said(0, PEER, '预算 300'), ...Array.from({ length: 3 }, (_, index) => said(index + 1, ANN, `闲聊 ${index}`)), said(4, ANN, '引用的预算是谁说的？', { replyTo: 0 })];
  const full = turnOf(frontMessage({ input: request(events) }));
  assert.equal(full.quoted, undefined); assert.equal(full.msg.replyTo, messageRef(id(0)));
  const input = request(events);
  input.history = input.history.slice(1);
  const turn = turnOf(frontMessage({ input }));
  assert.deepEqual(turn.quoted, { from: 'P2', text: '预算 300' }); assert.equal(turn.msg.replyTo, messageRef(id(0)));
});

test('the Bots that can be asked are listed when they change, open requests every time', () => {
  const contacts = [{ id: 'zhou@id.test', account: PEER, name: '小周', role: '摸鱼', reach: 'room', rooms: [ROOM] }];
  const openRequests = [{ to: 'zhou@id.test', name: '小周', request: '查一下崩溃日志', forSenderId: ANN, forEventId: id(2), since: new Date(T0 + 60_000).toISOString() }];
  const first = frontMessage({ input: request(chat, { event: { contacts, openRequests } }) });
  assert.deepEqual(turnOf(first).contacts, [{ name: '小周', id: PEER, role: '摸鱼' }]);
  assert.deepEqual(turnOf(first).openRequests, [{ to: '小周', request: '查一下崩溃日志', for: 'P3', replyTo: messageRef(id(2)), since: '20:01' }]);
  const next = [...chat, said(5, ANN, '还在吗')];
  const second = frontMessage({ input: request(next, { event: { contacts, openRequests } }), reading: first.reading });
  assert.equal(turnOf(second).contacts, undefined); assert.equal(turnOf(second).openRequests.length, 1);
  const third = frontMessage({ input: request([...next, said(6, ANN, '喂')], { event: { contacts: [] } }), reading: second.reading });
  assert.deepEqual(turnOf(third).contacts, []);
  const many = Array.from({ length: 40 }, (_, index) => ({ id: `bot${index}@id.test`, account: `@bot${index}:chat.test`, name: `Bot ${index}` }));
  const crowded = turnOf(frontMessage({ input: request(chat, { event: { contacts: many } }) }));
  assert.equal(crowded.contacts.length, 30); assert.equal(crowded.contactsOmitted, 10);
});

test('another Bot\'s result is answered to the person who asked, and a worker\'s question names its task', () => {
  const result = said(5, PEER, '（小周 交回的结果）角色名需要林确认。', { meta: { kind: 'task.result', originSenderId: ANN, originEventId: id(2) } });
  const turn = turnOf(frontMessage({ input: request([...chat, result]) }));
  assert.deepEqual(turn.replyGoesTo, { who: 'P3', ref: messageRef(id(2)) });
  assert.deepEqual([turn.msg.from, turn.msg.kind, turn.msg.for], ['P2', 'task.result', 'P3']);
  assert.match(FRONT_RULES, /不对交回结果的 Bot 道谢/);
  assert.equal(turnOf(frontMessage({ input: request(chat) })).replyGoesTo, undefined);
  // The core's own hand-over events are not room messages: a question goes to the front, results are in workResults.
  const question = { ...said(6, SELF, '[task.question] 工作者 T-1（统计）提问：按哪一列？'), event_id: '$dscord-T-1-q-1' };
  question.content['org.ds_group'] = { kind: 'task.result', originSenderId: ANN, originEventId: id(4) };
  const handed = { ...said(5, SELF, '「统计」完成了。'), event_id: '$dscord-T-0-result' };
  const input = request([...chat, handed, question], { event: { workerTask: 'T-1', workerKind: 'question' },
    workResults: [{ taskId: 'T-0', title: '统计', status: 'done', requester: 'Ann', roomId: ROOM, reply: '华东最高。', summary: '读了 3 个文件。', files: ['report.csv'] },
      { taskId: 'T-9', title: '别处的事', status: 'failed', requester: 'Ann', roomId: '!other:chat.test', summary: 'x'.repeat(1500), files: [] }] });
  const asked = turnOf(frontMessage({ input }));
  assert.deepEqual([asked.msg.from, asked.msg.task, asked.replyGoesTo.who], ['P1', 'T-1', 'P3']);
  assert.equal(asked.history.some(line => line.text.includes('完成了')), false);
  assert.deepEqual(asked.workResults[0], { taskId: 'T-0', title: '统计', status: 'done', requester: 'Ann', reply: '华东最高。', summary: '读了 3 个文件。', files: ['report.csv'] });
  assert.equal(asked.workResults[1].otherRoom, true); assert.match(asked.workResults[1].summary, /已截断）$/);
});

test('files are given by the path the tools take; history names attachments only', () => {
  const directory = 'C:\\Users\\ann\\.dsh\\dscord\\workspaces\\tasks\\0f3a';
  const files = { workdir: directory, files: [
    { name: 'IMG_1.png', path: `${directory}\\inputs\\a1-IMG_1.png`, mimeType: 'image/png', size: 1763155, sha256: 'e'.repeat(64), id: 'attachment-1',
      extraction: { type: 'png', supported: false, truncated: false, warnings: ['Use the native read_image tool on the original image for visual reading.'], textPath: `${directory}\\extracted\\e.txt` } },
    { name: '预算.xlsx', path: `${directory}\\inputs\\b2-预算.xlsx`, mimeType: 'application/vnd.ms-excel', size: 2048, sha256: 'f'.repeat(64), id: 'attachment-2',
      extraction: { type: 'xlsx', supported: true, truncated: true, warnings: ['Only the first 200 rows were extracted.'], textPath: `${directory}\\extracted\\f.txt` } }] };
  const input = request(chat, { event: { attachments: [{ name: 'IMG_1.png', url: 'mxc://chat.test/abc', sha256: 'e'.repeat(64) }] } });
  input.history[0].attachments = [{ name: '旧图.png', url: 'mxc://chat.test/old', size: 5 }];
  const turn = turnOf(frontMessage({ input, files }));
  assert.deepEqual(turn.files, [
    { name: 'IMG_1.png', path: `${directory}\\inputs\\a1-IMG_1.png`, type: 'image/png', size: 1763155 },
    { name: '预算.xlsx', path: `${directory}\\inputs\\b2-预算.xlsx`, type: 'application/vnd.ms-excel', size: 2048, text: `${directory}\\extracted\\f.txt`,
      truncated: true, note: 'Only the first 200 rows were extracted.' }]);
  assert.equal(turn.msg.attachments, undefined);
  assert.deepEqual(turn.history[0].attachments, ['旧图.png']);
  assert.deepEqual(turnOf(frontMessage({ input })).msg.attachments, ['IMG_1.png']);
  assert.equal(JSON.stringify(turn).includes('mxc://'), false);
});

test('a person\'s words are kept as written and a turn is never taken for a legacy envelope', () => {
  const body = 'Please preserve my literal "memoryView": {"note":"human text"} and DSCORD_REQUEST=x.';
  const input = request([...chat, said(5, ANN, body), said(6, ANN, '还有这句')], { memoryView: { marker: 'derived' },
    event: { mergedMessages: [{ eventId: id(5), body }] } });
  input.context.attention = { participationOnly: true, memoryView: { marker: 'derived' }, workView: { recentReceipts: [{ eventId: id(3), status: 'done' }] } };
  const result = frontMessage({ input });
  const turn = turnOf(result);
  assert.deepEqual(turn.msg.merged, [body]); assert.equal(turn.participationOnly, true);
  assert.equal(result.text.includes('derived'), false); assert.equal(result.text.includes('recentReceipts'), false);
  assert.ok(result.reading.rooms[ROOM].refs.includes(messageRef(id(5))));
  const message = { role: 'user', source: { kind: 'user', requestId: input.requestId, rpcId: input.requestId, eventId: id(6), roomId: ROOM, sender: { id: ANN } },
    content: [{ type: 'text', text: result.text }] };
  assert.equal(projectNativeRequestMessage(message), message);
  const long = '长'.repeat(20_000);
  assert.equal(turnOf(frontMessage({ input: request([...chat, said(5, ANN, long)]) })).msg.text, long);
});

test('a large room lists whom a turn involves and how many there are', () => {
  const crowd = Array.from({ length: 30 }, (_, index) => ({ id: `@member${index}:chat.test`, name: `成员 ${index}`, kind: 'human' }));
  const input = request(chat);
  input.context.members = [...input.context.members, ...crowd.map(person => ({ ...person, identitySource: 'account-directory' }))];
  const turn = turnOf(frontMessage({ input }));
  assert.equal(turn.room.members, 34);
  assert.deepEqual(Object.values(turn.people).map(person => person.name), ['小林', 'Ann', '小周']);
});

test('the reading record stays bounded', () => {
  let reading;
  for (let index = 0; index < 105; index++) {
    const input = request(chat);
    input.event.roomId = `!room${index}:chat.test`;
    reading = frontMessage({ input, reading }).reading;
  }
  assert.equal(Object.keys(reading.rooms).length, 100);
  assert.deepEqual([Object.keys(reading.rooms)[0], Object.keys(reading.rooms).at(-1)], ['!room5:chat.test', '!room104:chat.test']);
  const events = Array.from({ length: 41 }, (_, index) => said(index, ANN, `第 ${index} 条`));
  let busy = frontMessage({ input: request(events) }).reading;
  busy = frontMessage({ input: request([...events.slice(-10), ...Array.from({ length: 31 }, (_, index) => said(41 + index, PEER, `又 ${index} 条`))]), reading: busy }).reading;
  assert.equal(busy.rooms[ROOM].refs.length, 64);
  assert.equal(busy.rooms[ROOM].refs.at(-1), messageRef(id(71)));
});

test('the standing rules explain every field a turn can carry and are safe as a system prompt section', () => {
  assert.equal(FRONT_RULES.includes('{{'), false, 'the host interpolates {{…}} groups in prompt sections');
  for (const field of ['msg', 'people', 'history', 'participationOnly', 'files', 'replyGoesTo', 'workResults', 'contacts', 'openRequests', 'quoted', 'threadRoot',
    'merged', 'replyTo', 'seenBefore', 'earlierOmitted', 'historyGap', 'withdrawn', 'unverified', 'owner', 'gid', 'self', 'edits', 'thread', 'otherRoom'])
    assert.match(FRONT_RULES, new RegExp(`(^|[^a-zA-Z])${field}([^a-zA-Z]|$)`), field);
  // What DSCord refuses a front is not among its instructions.
  for (const tool of ['message_bot', 'list_bots', 'update_bot', 'ask_user', 'show_view', 'read_own_chat', 'create_group'])
    assert.equal(FRONT_RULES.includes(tool), false, tool);
  assert.ok(FRONT_RULES.length < 3200);
  // What a turn does not list has one way to be read.
  assert.match(FRONT_RULES, /read_room/);
});

test('a Bot served by DSCord works by the front rules; other Bots keep the native team rules', () => {
  let section;
  const bots = { served: { name: '小林', role: '通用助手', instructions: '回答要简短。' }, local: { name: 'Chief' } };
  const rt = { config: { botRules: botId => botId === 'served' ? FRONT_RULES : undefined }, selfOf: sessionId => sessionId.split(':')[0], botOf: botId => bots[botId],
    isMain: botId => botId === 'local', roomOf: () => undefined,
    ctx: { effect: register => register(), systemPrompt: { section: definition => { section = definition; return () => {}; } } } };
  install(rt);
  assert.deepEqual([section.name, section.interpolate], ['bot-identity', false]);
  const served = section.text({ agent: { id: 'served:session' } });
  assert.ok(served.startsWith('# Your identity\nYou are 小林')); assert.ok(served.includes('回答要简短。')); assert.ok(served.endsWith(FRONT_RULES));
  assert.equal(served.includes('message_bot'), false);
  const local = section.text({ agent: { id: 'local:session' } });
  assert.ok(local.includes('## You are the Main Bot')); assert.ok(local.includes('message_bot')); assert.equal(local.includes('DSCord'), false);
  assert.equal(section.text({ agent: { id: 'nobody:session' } }), '');
});

// What read_room is given: the room as the node knows it now, and a page of its messages as a request's history carries them.
const members = room.members.map(id => speakerOf(id, people, room));
const here = { id: ROOM, name: room.name, topic: '', creatorId: ANN, kind: 'group' };
const read = (events, options = {}) => roomReading({ self: SELF, selfName: '小林', room: here, members, messages: events.map(item), ...options });
const undated = ({ at, ...line }) => line;

test('a room reading carries the lines, people and references of a turn, with the whole date', () => {
  const turn = turnOf(frontMessage({ input: request(chat) }));
  const result = read(chat);
  const reading = JSON.parse(result.text);
  assert.deepEqual(Object.keys(reading), ['room', 'people', 'history']);
  assert.deepEqual(reading.room, { id: roomRef(ROOM), name: '项目群', kind: 'group', creator: 'P3' });
  assert.deepEqual(reading.people, turn.people);
  assert.deepEqual(reading.history.map(undated), [...turn.history, turn.msg].map(undated));
  assert.deepEqual(reading.history.map(line => line.at), [0, 1, 2, 3, 4].map(minute => `2026-11-11 20:0${minute}`));
  for (const bookkeeping of ['$event-', ROOM, 'identitySource', 'nameEventId', 'transport'])
    assert.equal(result.text.includes(bookkeeping), false, bookkeeping);
  // The newest messages of the room are read: the record is the one a turn would have left.
  assert.deepEqual(result.reading.rooms[ROOM].refs, chat.map(event => messageRef(event.event_id)));
  assert.deepEqual(result.reading.people, { [SELF]: 1, [PEER]: 2, [ANN]: 3, [GUEST]: 4 });
  assert.equal(read([]).text, '「项目群」里还没有消息。');
});

test('a room the Session has read lists what is new, and turns and readings share one record', () => {
  const first = frontMessage({ input: request(chat) });
  const next = [...chat, said(5, SELF, '我来整理，今天下班前给你。', { replyTo: 4 }), said(6, PEER, '我可以帮忙核对数字。', { replyTo: 4 }), said(7, ANN, '那我明天上午来看')];
  const caught = read(next, { reading: first.reading });
  assert.deepEqual(JSON.parse(caught.text), {
    room: { id: roomRef(ROOM), name: '项目群', kind: 'group' },
    // The same accounts under the same codes; what the front said itself is in its Session already.
    people: { P2: { name: '小周', kind: 'bot', id: PEER, gid: 'zhou@id.test', owner: 'P3' }, P3: { name: 'Ann', kind: 'human', id: ANN, gid: 'ann@id.test' } },
    history: [{ ref: messageRef(id(6)), from: 'P2', at: '2026-11-11 20:06', text: '我可以帮忙核对数字。', replyTo: messageRef(id(4)) },
      { ref: messageRef(id(7)), from: 'P3', at: '2026-11-11 20:07', text: '那我明天上午来看' }],
    seenBefore: true,
  });
  // A worker did not write what the Bot said: its reading keeps those lines.
  assert.deepEqual(JSON.parse(read(next, { reading: first.reading, holdsOwn: false }).text).history.map(line => line.from), ['P1', 'P2', 'P3']);
  // The turn that follows the reading lists nothing again, and a second reading has nothing new.
  const turn = turnOf(frontMessage({ input: request([...next, said(8, ANN, '在吗')]), reading: caught.reading }));
  assert.equal(turn.history, undefined); assert.equal(turn.seenBefore, true);
  const again = read(next, { reading: caught.reading });
  assert.equal(again.text, `「项目群」没有新消息。最新一条是 ${messageRef(id(7))}（2026-11-11 20:07）；要重看之前的，before 或 start 填消息编号。`);
  assert.deepEqual(again.reading, caught.reading);
  // A message the Session was shown and that is withdrawn afterwards is named, once.
  const withdrawn = next.map(item);
  Object.assign(withdrawn[6], { body: '[message withdrawn]', source: { ...withdrawn[6].source, withdrawn: true } });
  const told = roomReading({ self: SELF, selfName: '小林', room: here, members, messages: withdrawn, reading: caught.reading });
  assert.deepEqual([JSON.parse(told.text).history, JSON.parse(told.text).withdrawn], [[], [messageRef(id(6))]]);
  assert.match(roomReading({ self: SELF, selfName: '小林', room: here, members, messages: withdrawn, reading: told.reading }).text, /没有新消息/);
});

test('a reading is a page: what does not fit is counted, and the pages before and after are asked for by reference', () => {
  const events = Array.from({ length: 60 }, (_, index) => said(index, index % 2 ? PEER : ANN, `${index}：${'可以，下午三点前给你初稿。'.repeat(10)}`));
  const latest = read(events.slice(10), { earlier: 10 });
  const page = JSON.parse(latest.text);
  assert.ok(page.history.length > 5 && page.history.length < 50);
  assert.equal(page.history.at(-1).ref, messageRef(id(59)));
  assert.equal(page.earlierOmitted, 60 - page.history.length);
  assert.ok(estimateTokens(JSON.stringify(page.history)) <= HISTORY_TOKEN_BUDGET * 1.1);
  // The page before the oldest line shown: it is not the newest of the room, so the record stays where it was.
  const oldest = 60 - page.history.length;
  const back = read(events.slice(0, oldest), { cursor: 'before', later: 60 - oldest, reading: latest.reading });
  const earlier = JSON.parse(back.text);
  assert.equal(earlier.history.at(-1).ref, messageRef(id(oldest - 1)));
  assert.equal(earlier.earlierOmitted, oldest - earlier.history.length);
  assert.equal(earlier.seenBefore, undefined); assert.equal(earlier.room.creator, undefined);
  assert.deepEqual(back.reading.rooms, latest.reading.rooms);
  assert.equal(read([], { cursor: 'before', reading: latest.reading }).text, '「项目群」里这条消息之前没有更早的消息了：这里只有你加入房间之后收到的消息。');
  // Reading on from a message keeps the oldest lines and says where to go on.
  const on = read(events.slice(0, 50), { cursor: 'start', later: 10, next: id(50), reading: latest.reading });
  const forward = JSON.parse(on.text);
  assert.equal(forward.history[0].ref, messageRef(id(0)));
  assert.deepEqual([forward.laterOmitted, forward.next], [60 - forward.history.length, messageRef(id(forward.history.length))]);
  assert.deepEqual(on.reading.rooms, latest.reading.rooms);
  const whole = JSON.parse(read(events.slice(0, 3), { cursor: 'start', later: 57, next: id(3) }).text);
  assert.deepEqual([whole.history.length, whole.laterOmitted, whole.next], [3, 57, messageRef(id(3))]);
  // A page that reaches the newest message is read up to there.
  const end = read(events.slice(55), { cursor: 'start', earlier: 55 });
  assert.equal(JSON.parse(end.text).next, undefined);
  assert.equal(end.reading.rooms[ROOM].refs.at(-1), messageRef(id(59)));
  // A room read long ago: what is listed does not join up with what the Session was shown.
  const stale = { people: latest.reading.people, rooms: { [ROOM]: { refs: [messageRef(id(2))] } } };
  const apart = JSON.parse(read(events.slice(40), { earlier: 40, reading: stale }).text);
  assert.deepEqual([apart.seenBefore, apart.historyGap, apart.earlierOmitted], [true, true, 20 - apart.history.length]);
  // The host cuts the middle out of a longer tool result: a reading stays under that whatever its script.
  const latin = Array.from({ length: 20 }, (_, index) => said(index, ANN, `${index} ${'word '.repeat(230)}`));
  const capped = read(latin);
  assert.ok(capped.text.length <= READING_CHARS);
  assert.ok(JSON.parse(capped.text).history.length >= 5);
  assert.equal(JSON.parse(capped.text).earlierOmitted, 20 - JSON.parse(capped.text).history.length);
  const crowd = Array.from({ length: 12 }, (_, index) => ({ id: `@member${index}:chat.test`, name: `成员 ${index}`, kind: 'human', identitySource: 'account-directory' }));
  const busy = roomReading({ self: SELF, selfName: '小林', room: here, members: [...members.slice(0, 1), ...crowd.slice(0, 11)], chars: 2500,
    messages: crowd.map((person, index) => item({ ...said(index, person.id, '在'.repeat(100)), sender: person.id })) });
  assert.ok(busy.text.length <= 2500); assert.ok(JSON.parse(busy.text).history.length >= 1);
});

test('members and rooms are listed as many at a time as fit', () => {
  const crowd = Array.from({ length: 30 }, (_, index) => ({ id: `@member${index}:chat.test`, name: `成员 ${index}`, kind: 'human', identitySource: 'account-directory' }));
  const everyone = [...members, ...crowd];
  const whole = roomMembers({ self: SELF, selfName: '小林', room: here, members: everyone });
  const listed = JSON.parse(whole.text);
  assert.deepEqual(listed.room, { id: roomRef(ROOM), name: '项目群', members: 34 });
  assert.equal(Object.keys(listed.people).length, 34); assert.equal(listed.next, undefined);
  assert.deepEqual(listed.people.P1, { name: '小周', kind: 'bot', id: PEER, gid: 'zhou@id.test', owner: 'P3' });
  // Each member keeps the code the listing gave, in the turns and readings that follow.
  assert.equal(whole.reading.people[crowd[29].id], 34);
  assert.equal(turnOf(frontMessage({ input: request(chat), reading: whole.reading })).people.P2.id, SELF);
  const first = roomMembers({ self: SELF, selfName: '小林', room: here, members: everyone, chars: 1500 });
  const page = JSON.parse(first.text);
  const count = Number(page.next);
  assert.ok(first.text.length <= 1500 && count >= 5 && count < 34);
  assert.equal(page.membersOmitted, 34 - count);
  const second = JSON.parse(roomMembers({ self: SELF, selfName: '小林', room: here, members: everyone, start: page.next, reading: first.reading }).text);
  assert.equal(Object.values(second.people).some(person => person.id === everyone[count].id), true);
  assert.equal(Object.values(second.people).some(person => person.id === PEER), false);
  assert.equal(roomMembers({ self: SELF, selfName: '小林', room: here, members: everyone, start: '34' }).text, '「项目群」一共 34 个成员，已经列完。');

  const rooms = [{ id: '!quiet:chat.test', name: '安静的群', topic: '', members: 3, latestAt: null },
    { id: ROOM, name: '项目群', topic: '每周五同步', members: 4, latestAt: T0 },
    { id: '!dm:chat.test', name: 'Ann', topic: '', members: 2, latestAt: T0 + 60_000 }];
  assert.deepEqual(JSON.parse(roomList({ rooms, here: ROOM }).text), { rooms: [
    { id: roomRef('!dm:chat.test'), name: 'Ann', members: 2, last: '2026-11-11 20:01' },
    { id: roomRef(ROOM), name: '项目群', topic: '每周五同步', members: 4, last: '2026-11-11 20:00', here: true },
    { id: roomRef('!quiet:chat.test'), name: '安静的群', members: 3 }] });
  // A Bot on several chat servers sees which server each room is on.
  const elsewhere = JSON.parse(roomList({ rooms: [...rooms, { id: '!team:other.test', name: '项目群', topic: '', members: 9, latestAt: T0 - 1 }] }).text);
  assert.deepEqual(elsewhere.rooms.map(found => found.server), ['chat.test', 'chat.test', 'other.test', 'chat.test']);
  const many = Array.from({ length: 200 }, (_, index) => ({ id: `!room${index}:chat.test`, name: `房间 ${index}`, topic: '', members: 5, latestAt: T0 - index }));
  const some = roomList({ rooms: many });
  const shown = JSON.parse(some.text);
  assert.ok(some.text.length <= READING_CHARS);
  assert.deepEqual([shown.rooms[0].name, shown.roomsOmitted, shown.next], ['房间 0', 200 - shown.rooms.length, String(shown.rooms.length)]);
  assert.equal(JSON.parse(roomList({ rooms: many, start: shown.next }).text).rooms[0].name, `房间 ${shown.rooms.length}`);
  assert.equal(roomList({ rooms: many, start: '200' }).text, '你一共在 200 个房间里，已经列完。');
  assert.equal(roomList({ rooms: [] }).text, '你现在不在任何房间里。');
});
