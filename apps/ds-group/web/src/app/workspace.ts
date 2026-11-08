import { readStored, storageKey } from "../session";
import type { ClientConfig } from "../client-config";
import type { Mentionables, Participant, Room, Session } from "../types";

export const emptyMentions: Mentionables = {
  members: [],
  roles: [],
  canMentionEveryone: false,
  canMentionHere: false,
};

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
