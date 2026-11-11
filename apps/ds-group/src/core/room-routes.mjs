import { createHash, randomBytes } from 'node:crypto';
import { MatrixClient } from '../matrix-client.mjs';
import { serverOf, roomAllows } from '../governance.mjs';
import { httpError } from './router.mjs';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const REQUEST_ID = /^[a-zA-Z0-9_.:-]{1,200}$/;
const IDENTITY_FIELDS = ['replyTo', 'threadRootId', 'taskId', 'returnTo', 'kind', 'hop', 'originSenderId', 'originRoomId', 'originEventId', 'originThreadRootId'];

async function validateMessageReferences(client, roomId, input) {
  const references = [input.threadRootId, input.replyTo].filter(id => id !== undefined);
  if ([...references, input.originThreadRootId].filter(id => id !== undefined)
    .some(id => typeof id !== 'string' || !id || id.length > 1024 || id.includes('\0'))) {
    throw httpError(400, 'Message references must be non-empty event IDs', { code: 'INVALID_MESSAGE_REFERENCE' });
  }
  const events = new Map(await Promise.all([...new Set(references)].map(async id => {
    let event;
    try { event = await client.request('GET', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/event/${encodeURIComponent(id)}`); }
    catch (error) {
      if (![403, 404].includes(error.status)) throw error;
      throw httpError(400, 'The message reference is unavailable in this conversation', { code: 'MESSAGE_REFERENCE_UNAVAILABLE' });
    }
    if (event.event_id !== id || event.room_id !== roomId || event.type !== 'm.room.message') {
      throw httpError(400, 'Message references must belong to this conversation', { code: 'INVALID_MESSAGE_REFERENCE' });
    }
    return [id, event];
  })));
  if (input.threadRootId && events.get(input.threadRootId)?.content?.['m.relates_to']?.rel_type) {
    throw httpError(400, 'Choose the original thread root rather than a related event', { code: 'INVALID_THREAD_ROOT' });
  }
}

export function roomRoutes(router, app) {
  const { setup, chat, chatFeatures, attachmentAccess, media, accounts, tasks } = app;
  chat.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
    CREATE TABLE IF NOT EXISTS direct_rooms (pair_key TEXT PRIMARY KEY, room_id TEXT NOT NULL, participants_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS group_requests (request_key TEXT PRIMARY KEY, input_hash TEXT NOT NULL, status TEXT NOT NULL, room_id TEXT);
    UPDATE group_requests SET status='unknown' WHERE status='creating';
    CREATE TABLE IF NOT EXISTS message_requests (request_key TEXT PRIMARY KEY, input_hash TEXT NOT NULL,
      payload_json TEXT NOT NULL, token_hash TEXT NOT NULL, event_id TEXT);`);
  const creatingDirectRooms = new Map();
  const sendingMessages = new Map();
  const matrixAs = accessToken => new MatrixClient({ baseUrl: setup.homeserverUrl, accessToken });
  const person = id => app.publicParticipants().find(p => p.id === id);
  const joinedMembers = async (client, roomId) =>
    (await client.request('GET', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/joined_members`)).joined || {};
  const isDirectRoom = roomId => Boolean(chat.prepare('SELECT 1 FROM direct_rooms WHERE room_id=?').get(roomId));
  // People, and the caller's own Bots, wherever their home server is.
  const addable = (userId, id) => {
    const target = person(id);
    return Boolean(target && id !== userId && (target.kind === 'human' || target.ownerId === userId));
  };
  // Core joins a member of this server with that member's own Matrix account; a member of another server accepts there.
  async function admit(roomId, id) {
    const account = setup.participants.find(p => p.id === id);
    if (!account?.accessToken) return { participantId: id, status: 'invited' };
    try {
      await matrixAs(account.accessToken).join(roomId);
      return { participantId: id, status: 'joined' };
    } catch (error) {
      return { participantId: id, status: 'pending', reason: error.errcode || 'JOIN_UNCONFIRMED' };
    }
  }
  // Matrix defaults: without a power-levels event everyone may invite (invite level 0).
  const mayInvite = (levels, userId) => (levels.users?.[userId] ?? levels.users_default ?? 0) >= (levels.invite ?? 0);
  const joinOutcome = (userId, results) => ({
    status: results.every(item => item.status === 'joined') ? 'joined' : 'partially_joined', joinResults: results,
    participantIds: [userId, ...results.filter(item => item.status === 'joined').map(item => item.participantId)],
  });

  async function directRoomFor(client, userId, target) {
    const ids = [userId, target.id].sort();
    const key = JSON.stringify(ids);
    if (!creatingDirectRooms.has(key)) {
      const work = (async () => {
        let roomId = chat.prepare('SELECT room_id FROM direct_rooms WHERE pair_key=?').get(key)?.room_id;
        if (!roomId) {
          const localAlias = `ds-group-dm-${sha256(key)}`;
          const alias = `#${localAlias}:${setup.serverName || userId.slice(userId.indexOf(':') + 1)}`;
          const findAlias = async () => {
            try { return (await client.request('GET', `/_matrix/client/v3/directory/room/${encodeURIComponent(alias)}`)).room_id; }
            catch (error) { if (error.errcode === 'M_NOT_FOUND') return undefined; throw error; }
          };
          roomId = await findAlias();
          if (!roomId) {
            try {
              roomId = (await client.createRoom({ is_direct: true, preset: 'private_chat', room_alias_name: localAlias,
                invite: [target.id], name: ids.map(id => person(id)?.name).join(' · ') })).room_id;
            } catch (error) {
              // A lost create response or a concurrent creator is resolved by the stable alias.
              roomId = await findAlias();
              if (!roomId) throw error;
            }
          }
        }
        await client.join(roomId);
        await matrixAs(target.accessToken).join(roomId);
        if (JSON.stringify(Object.keys(await joinedMembers(client, roomId)).sort()) !== key) throw httpError(409, 'The direct conversation has unexpected members');
        chat.prepare('INSERT OR IGNORE INTO direct_rooms VALUES (?, ?, ?)').run(key, roomId, key);
        return roomId;
      })();
      creatingDirectRooms.set(key, work);
      void work.finally(() => creatingDirectRooms.delete(key)).catch(() => {});
    }
    return { roomId: await creatingDirectRooms.get(key), name: target.name, kind: 'direct', participantIds: ids };
  }

  // Each (user, room, transactionId) is sent once; retries with the same content return the original event.
  async function sendMessage({ client, userId, roomId, input, attachments, members, token }) {
    const key = JSON.stringify([userId, roomId, input.transactionId]);
    const identity = { body: input.body, attachments: attachments.map(file => file.id), to: [...new Set(input.to)].sort(), replyMention: input.replyMention !== false };
    for (const field of IDENTITY_FIELDS) if (input[field] !== undefined) identity[field] = input[field];
    const inputHash = sha256(JSON.stringify(identity));
    const previous = chat.prepare('SELECT * FROM message_requests WHERE request_key=?').get(key);
    const active = sendingMessages.get(key);
    if ((previous && previous.input_hash !== inputHash) || (active && active.inputHash !== inputHash)) {
      throw httpError(409, 'This message transaction belongs to different content');
    }
    if (previous?.event_id) {
      attachmentAccess.record(JSON.parse(previous.payload_json).attachments || [], roomId, previous.event_id);
      return { event_id: previous.event_id };
    }
    if (active) return active.promise;
    const tokenHash = sha256(token);
    if (previous && previous.token_hash !== tokenHash) {
      throw httpError(409, 'Check the conversation for this pending message before sending it from another login');
    }
    const promise = (async () => {
      for (const attachment of attachments) await attachmentAccess.local({ client, userId, id: attachment.id });
      let payload;
      if (previous) payload = JSON.parse(previous.payload_json);
      else {
        await validateMessageReferences(client, roomId, input);
        const direct = chat.prepare('SELECT participants_json FROM direct_rooms WHERE room_id=?').get(roomId);
        const directIds = direct ? JSON.parse(direct.participants_json) : [];
        const conversationKind = directIds.length === 2 && members.length === 2 && directIds.every(id => members.includes(id)) ? 'direct' : 'group';
        const resolved = await chatFeatures.resolveMessage({ userId, roomId, input, client, members, directIds: conversationKind === 'direct' ? directIds : [] });
        payload = { ...input, ...resolved, attachments, conversationKind };
        chat.prepare('INSERT INTO message_requests VALUES (?,?,?,?,NULL)').run(key, inputHash, JSON.stringify(payload), tokenHash);
      }
      const receipt = await client.send(roomId, payload.body, payload);
      chat.prepare('UPDATE message_requests SET event_id=? WHERE request_key=?').run(receipt.event_id, key);
      attachmentAccess.record(attachments, roomId, receipt.event_id);
      return receipt;
    })();
    sendingMessages.set(key, { inputHash, promise });
    try { return await promise; }
    finally { sendingMessages.delete(key); }
  }

  const observed = (userId, roomId, events) => {
    const scoped = events.map(event => ({ ...event, room_id: roomId }));
    attachmentAccess.observe(scoped, roomId);
    chatFeatures.recordEvents(userId, scoped);
    return scoped;
  };

  router.get('/api/rooms', async ({ userId, client, send }) => {
    const matrix = client();
    const { joined_rooms: joined } = await matrix.request('GET', '/_matrix/client/v3/joined_rooms');
    const joinedSet = new Set(joined);
    const rooms = [];
    for (const row of chat.prepare('SELECT * FROM direct_rooms').all()) {
      const ids = JSON.parse(row.participants_json);
      if (!ids.includes(userId) || !joinedSet.has(row.room_id)) continue;
      rooms.push({ roomId: row.room_id, name: person(ids.find(id => id !== userId))?.name || '私聊', kind: 'direct', participantIds: ids });
    }
    const known = new Set(rooms.map(room => room.roomId));
    rooms.push(...await Promise.all(joined.filter(roomId => !known.has(roomId)).map(async roomId => {
      const state = type => matrix.request('GET', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/${type}/`);
      const [roomName, levels, members] = await Promise.all([
        state('m.room.name').catch(() => ({ name: '群聊' })),
        state('m.room.power_levels').catch(() => ({})),
        joinedMembers(matrix, roomId),
      ]);
      return { roomId, name: roomId === setup.roomId ? '初次协作' : roomName.name || '群聊', kind: 'group', participantIds: Object.keys(members),
        permissions: { inviteMembers: mayInvite(levels, userId) } };
    })));
    send(200, { rooms: rooms.map(room => ({ ...room, ...chatFeatures.unreadFor(userId, room.roomId) })) });
  });

  router.post('/api/rooms', async ({ userId, client, body, send }) => {
    const input = await body();
    if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 80 || !Array.isArray(input.inviteIds)) return send(400, { error: 'A group name and member list are required' });
    const name = input.name.trim();
    const invited = [...new Set(input.inviteIds)].filter(id => id !== userId);
    if (!invited.every(id => addable(userId, id))) return send(403, { error: 'Choose people or your own Bots' });
    const requestId = input.requestId || randomBytes(16).toString('hex');
    if (typeof requestId !== 'string' || !REQUEST_ID.test(requestId)) return send(400, { error: 'Invalid group request ID' });
    const requestKey = `${userId}/${requestId}`;
    const inputHash = sha256(JSON.stringify({ name, invited: [...invited].sort() }));
    const previous = chat.prepare('SELECT * FROM group_requests WHERE request_key=?').get(requestKey);
    if (previous && previous.input_hash !== inputHash) return send(409, { error: 'This group request ID belongs to different content' });
    if (previous && previous.status !== 'created') return send(409, { error: 'Group creation is pending confirmation; check your room list', requestId });
    let roomId = previous?.room_id;
    if (!roomId) {
      chat.prepare("INSERT INTO group_requests VALUES (?, ?, 'creating', NULL)").run(requestKey, inputHash);
      try {
        roomId = (await client().createRoom({ name, preset: 'private_chat', invite: invited })).room_id;
        chat.prepare("UPDATE group_requests SET status='created',room_id=? WHERE request_key=?").run(roomId, requestKey);
      } catch {
        chat.prepare("UPDATE group_requests SET status='unknown' WHERE request_key=?").run(requestKey);
        return send(409, { error: 'Group creation result is unknown; check your room list before creating another group', requestId });
      }
    }
    const joinResults = await Promise.all(invited.map(id => admit(roomId, id)));
    send(200, { roomId, requestId, name, kind: 'group', ...joinOutcome(userId, joinResults) });
  });

  // A person in a group adds other people and their own Bots to it; a member of another server needs this room approved for them first.
  router.post(/^\/api\/rooms\/([^/]+)\/invite$/, async ({ userId, client, body, policy, send }, roomId) => {
    const input = await body();
    const ids = Array.isArray(input.participantIds) ? [...new Set(input.participantIds)] : [];
    if (!ids.length || ids.some(id => typeof id !== 'string' || id === userId)) return send(400, { error: 'Choose at least one other member' });
    if (isDirectRoom(roomId)) return send(400, { error: 'Members are added to groups, not direct conversations' });
    accounts.human(userId);
    if (!ids.every(id => addable(userId, id))) return send(403, { error: 'Choose people or your own Bots' });
    const matrix = client();
    const joined = await joinedMembers(matrix, roomId);
    const joinResults = [];
    let rules;
    for (const id of ids) {
      if (joined[id]) {
        joinResults.push({ participantId: id, status: 'joined' });
        continue;
      }
      if (serverOf(id) !== setup.serverName && !roomAllows(rules ??= await policy(), roomId, id)) {
        joinResults.push({ participantId: id, status: 'approval_required' });
        continue;
      }
      const { membership } = await matrix.request('GET', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/state/m.room.member/${encodeURIComponent(id)}`)
        .catch(error => { if (error.errcode === 'M_NOT_FOUND' || error.status === 404) return {}; throw error; });
      if (membership !== 'invite') await matrix.request('POST', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/invite`, { user_id: id });
      joinResults.push(await admit(roomId, id));
    }
    const outcome = joinOutcome(userId, joinResults);
    send(200, { roomId, ...outcome, participantIds: [...new Set([...Object.keys(joined), ...outcome.participantIds])] });
  });

  router.post('/api/dm', async ({ userId, client, body, send }) => {
    const input = await body();
    const target = setup.participants.find(p => p.id === input.participantId);
    if (!target || target.id === userId || !person(userId)) return send(400, { error: 'Choose a different demo participant' });
    send(200, await directRoomFor(client(), userId, target));
  });

  router.get(/^\/api\/rooms\/([^/]+)\/context\/([^/]+)$/, async ({ userId, client, send }, roomId, eventId) => {
    const result = await client().request('GET', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/context/${encodeURIComponent(eventId)}?limit=30`);
    const events = [...(result.events_before || []).toReversed(), ...(result.event ? [result.event] : []), ...(result.events_after || [])];
    send(200, { eventId, events: observed(userId, roomId, events) });
  });

  router.get(/^\/api\/rooms\/([^/]+)\/messages$/, async ({ userId, client, url, send }, roomId) => {
    const before = url.searchParams.get('before') || undefined;
    const page = await client().timelinePage(roomId, { limit: Math.min(Number(url.searchParams.get('limit')) || 100, 200), from: before });
    send(200, { events: observed(userId, roomId, page.events), before: page.end });
  });

  router.post(/^\/api\/rooms\/([^/]+)\/messages$/, async ({ userId, client, token, body, send }, roomId) => {
    const input = await body();
    const attachments = media.resolve(input.attachments);
    const text = input.body ?? '';
    const to = input.to ?? [];
    if (typeof text !== 'string' || (!text.trim() && !attachments.length) || text.length > 16000) return send(400, { error: 'A message needs text or an attachment, with at most 16000 text characters' });
    if (!Array.isArray(to) || to.some(id => !person(id))) return send(400, { error: 'Unknown recipient' });
    if (typeof input.transactionId !== 'string' || !REQUEST_ID.test(input.transactionId)) return send(400, { error: 'A stable transaction ID is required' });
    const matrix = client();
    const members = await chatFeatures.roomMembers(matrix, roomId, userId);
    send(200, await sendMessage({ client: matrix, userId, roomId, input: { ...input, body: text, to }, attachments, members, token: token() }));
  });

  // Only the sender changes or withdraws a message, and only the original (not an earlier edit).
  async function ownMessage(client, userId, roomId, eventId) {
    let event;
    try { event = await client.request('GET', `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/event/${encodeURIComponent(eventId)}`); }
    catch (error) {
      if (![403, 404].includes(error.status)) throw error;
      throw httpError(404, 'The message is unavailable in this conversation', { code: 'MESSAGE_UNAVAILABLE' });
    }
    if (event.event_id !== eventId || event.type !== 'm.room.message' || event.content?.['m.relates_to']?.rel_type === 'm.replace') {
      throw httpError(400, 'Choose an original message', { code: 'INVALID_MESSAGE_TARGET' });
    }
    if (event.sender !== userId) throw httpError(403, 'Only the sender can change this message', { code: 'NOT_MESSAGE_SENDER' });
    if (event.unsigned?.redacted_because) throw httpError(409, 'The message was withdrawn', { code: 'MESSAGE_WITHDRAWN' });
    return event;
  }

  router.put(/^\/api\/rooms\/([^/]+)\/messages\/([^/]+)$/, async ({ userId, client, body, send }, roomId, eventId) => {
    const input = await body();
    const text = input.body;
    if (typeof text !== 'string' || !text.trim() || text.length > 16000) return send(400, { error: 'An edited message needs text, with at most 16000 characters' });
    if (typeof input.transactionId !== 'string' || !REQUEST_ID.test(input.transactionId)) return send(400, { error: 'A stable transaction ID is required' });
    const matrix = client();
    const original = await ownMessage(matrix, userId, roomId, eventId);
    const members = await chatFeatures.roomMembers(matrix, roomId, userId);
    const meta = original.content['org.ds_group'] || {};
    const resolved = await chatFeatures.resolveMessage({ userId, roomId, client: matrix, members,
      input: { body: text, mentions: input.mentions, replyTo: meta.replyTo, replyMention: meta.replyMention } });
    const receipt = await matrix.edit(roomId, eventId, text, { transactionId: `edit-${input.transactionId}`, mentions: resolved.mentions, mMentions: resolved.mMentions });
    send(200, { event_id: receipt.event_id });
  });

  router.delete(/^\/api\/rooms\/([^/]+)\/messages\/([^/]+)$/, async ({ userId, client, send }, roomId, eventId) => {
    const matrix = client();
    await ownMessage(matrix, userId, roomId, eventId);
    const receipt = await matrix.redact(roomId, eventId);
    // Withdrawing a request also stops the work it started.
    send(200, { event_id: receipt.event_id, cancelledTasks: tasks.cancelForEvent(roomId, eventId) });
  });
}
