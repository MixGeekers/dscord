import { useEffect, useSyncExternalStore } from "react";
import type { AvatarProfile, Participant } from "./types";

const profiles = new Map<string, AvatarProfile>();
const listeners = new Set<() => void>();
let channel: BroadcastChannel | undefined;
function accept(profile: AvatarProfile) {
  const old = profiles.get(profile.globalId);
  if (old && old.profileVersion >= profile.profileVersion) return;
  profiles.set(profile.globalId, profile);
  for (const listener of listeners) listener();
}
export function publishAvatar(profile: AvatarProfile) {
  const previous = profiles.get(profile.globalId)?.profileVersion ?? -1;
  accept(profile);
  if (profile.profileVersion > previous) channel?.postMessage(profile);
}
function subscribe(listener: () => void) {
  if (!channel && typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel("dscord-avatars");
    channel.onmessage = (event: MessageEvent<AvatarProfile>) => {
      if (
        event.data?.globalId &&
        Number.isSafeInteger(event.data.profileVersion)
      )
        accept(event.data);
    };
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function useAvatar(member?: Partial<Participant> | null) {
  useEffect(() => {
    if (member?.globalId && member.profileVersion !== undefined)
      publishAvatar({
        id: member.id || member.globalId,
        globalId: member.globalId,
        profileVersion: member.profileVersion,
        avatar: member.avatar ?? null,
      });
  }, [member?.globalId, member?.profileVersion, member?.avatar]);
  const latest = useSyncExternalStore(subscribe, () =>
    member?.globalId ? profiles.get(member.globalId) : undefined,
  );
  return latest && latest.profileVersion > (member?.profileVersion ?? 0)
    ? latest.avatar
    : member?.avatar;
}
export function avatarColor(id: string) {
  let hash = 0;
  for (const character of id)
    hash = ((hash << 5) - hash + character.codePointAt(0)!) | 0;
  return `hsl(${Math.abs(hash) % 360} 34% 43%)`;
}
