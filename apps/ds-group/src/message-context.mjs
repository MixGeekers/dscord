const metadata = event => event.content?.['org.ds_group'] || {};
export const homeOf = id => typeof id === 'string' && id.startsWith('@') && id.includes(':') ? id.slice(id.indexOf(':') + 1) : null;

/**
 * Names are labels. Only the full Matrix ID identifies a speaker's account; the global identity ID
 * the server's roster gives (`globalId`) is the person behind it, the same on every chat server.
 */
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
    ...(person?.globalId ? { globalId: person.globalId } : {}),
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
