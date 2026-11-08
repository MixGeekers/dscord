import { readStored, storageKey } from "../session";
import type { ClientConfig } from "../client-config";
import type {
  ChatEvent,
  Mentionables,
  Participant,
  Room,
  Session,
} from "../types";

export const emptyMentions: Mentionables = {
  members: [],
  roles: [],
  canMentionEveryone: false,
  canMentionHere: false,
};

/** Merge fetched message events into the timeline, keeping the previous array when nothing changed. */
export function mergeEvents(
  previous: ChatEvent[],
  incoming: ChatEvent[],
  roomId: string,
): ChatEvent[] {
  const known = new Map(previous.map((event) => [event.event_id, event]));
  let changed = false;
  for (const event of incoming) {
    if (
      !event.event_id ||
      event.type !== "m.room.message" ||
      typeof event.content?.body !== "string" ||
      (event.room_id && event.room_id !== roomId)
    )
      continue;
    const normalized = event.room_id ? event : { ...event, room_id: roomId };
    const current = known.get(event.event_id);
    if (current && JSON.stringify(current) === JSON.stringify(normalized))
      continue;
    known.set(event.event_id, normalized);
    changed = true;
  }
  if (!changed) return previous;
  return [...known.values()].sort(
    (left, right) => left.origin_server_ts - right.origin_server_ts,
  );
}

export function ownedBotCacheKey(
  config: ClientConfig,
  account: Session | null,
): string | null {
  return account?.identity?.kind === "human"
    ? storageKey(config, "owned-bots", account)
    : null;
}

export function restoredOwnedBots(
  config: ClientConfig,
  account: Session | null,
): Participant[] | null {
  const key = ownedBotCacheKey(config, account);
  if (!key) return null;
  const value = readStored<Participant[]>(key);
  return Array.isArray(value) ? value : null;
}

/** A direct room with one of the signed-in owner's own Bots. */
export function isOwnedBotRoom(
  room: Room | null | undefined,
  ownedBots: Participant[],
  ownerId: string | undefined,
): boolean {
  return (
    room?.kind === "direct" &&
    ownedBots.some(
      (bot) => bot.ownerId === ownerId && room.participantIds.includes(bot.id),
    )
  );
}
