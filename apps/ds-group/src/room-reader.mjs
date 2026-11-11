import { speakerOf } from './message-context.mjs';

const metadataOf = event => event?.content?.['org.ds_group'] || {};

/**
 * What one Bot account can read on its chat server, for read_room: the rooms it is in, who is in them, and their
 * messages as its node holds them, which is what it has received since it joined. An account reads every room it
 * is in, whoever asks the Bot to look.
 */
export class RoomReader {
  constructor(node) { this.node = node; }

  /** A room without a name is known by who else is in it. */
  nameOf(roomId, room) {
    if (room.name) return room.name;
    const others = (room.members || []).filter(id => id !== this.node.participant.id)
      .map(id => speakerOf(id, this.node.participants, room).name);
    return others.length ? `${others.slice(0, 3).join('、')}${others.length > 3 ? ' 等' : ''}` : roomId;
  }

  /** The rooms the account is in, most recently active first. */
  rooms() {
    return this.node.store.joinedRooms().map(held => {
      const room = this.node.roomContextFor(held.id);
      return { id: held.id, name: this.nameOf(held.id, room), topic: room.topic || '', members: (room.members || []).length, latestAt: held.latestAt };
    });
  }

  /** A room the account is in: its name and topic, who made it and who is in it now. */
  room(roomId) {
    const room = this.node.roomContextFor(roomId);
    if (room.membership !== 'join') return undefined;
    return { id: roomId, name: this.nameOf(roomId, room), topic: room.topic || '', creatorId: room.creatorId || null,
      members: (room.members || []).map(id => speakerOf(id, this.node.participants, room)) };
  }

  /**
   * A page of a room's messages, oldest first, each as a turn's history carries it: the newest ones, those before
   * a message (`before`), or those from a message on (`from`). Nothing when that message is not in the room.
   */
  page(roomId, options) {
    const page = this.node.store.roomPage(roomId, options);
    if (!page) return undefined;
    const { events, ...around } = page;
    // A message a person sent through the server says whether the room was a direct conversation then.
    const kind = metadataOf(events.findLast(event => metadataOf(event).conversationKind)).conversationKind || 'group';
    return { ...around, kind, messages: events.map(event => this.node.historyItem(event)) };
  }

  /** The message whose ID passes a test, in one room the account is in or in any of them. */
  find(test, roomId) {
    const found = this.node.store.findMessage(test, roomId);
    return found && this.node.store.roomContext(found.roomId).membership === 'join' ? found : undefined;
  }
}
