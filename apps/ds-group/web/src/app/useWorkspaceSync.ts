import { useEffect } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { ApiError, messageOf } from "../api";
import type { createApi } from "../api";
import { storageKey } from "../session";
import { roomsInSpace } from "../spaces";
import type { SpacesResult } from "../spaces";
import type { ClientConfig, ClientDiscovery } from "../client-config";
import { emptyMentions, ownedBotCacheKey } from "./workspace";
import { mergeEvents } from "./timeline-events";
import type {
  AccountProfile,
  ChatEvent,
  InboxResult,
  Mentionables,
  Participant,
  Role,
  Room,
  ServerStatus,
  Session,
  WorkTask,
} from "../types";

type Api = ReturnType<typeof createApi>;
type Setter<T> = Dispatch<SetStateAction<T>>;
const ACTIVE_POLL_MS = 2500;
const HIDDEN_POLL_MS = 12000;

export interface WorkspaceSync {
  api: Api;
  config: ClientConfig;
  session: Session | null;
  homeDiscovery: ClientDiscovery | undefined;
  roomId: string | null;
  serverName: string | null;
  refreshNonce: number;
  refresh: () => void;
  clearSession: () => void;
  navigate: (
    room: Room | null,
    server: string | null,
    eventId?: string,
  ) => void;
  refs: {
    session: MutableRefObject<Session | null>;
    room: MutableRefObject<string | null>;
    server: MutableRefObject<string | null>;
    rooms: MutableRefObject<Room[]>;
    spaces: MutableRefObject<SpacesResult | null>;
    initialNavigation: MutableRefObject<boolean>;
  };
  set: {
    status: Setter<ServerStatus | null>;
    connection: Setter<"connecting" | "connected" | "offline">;
    allRooms: Setter<Room[]>;
    spaces: Setter<SpacesResult | null>;
    currentUser: Setter<Participant | null>;
    ownedBots: Setter<Participant[] | null>;
    directory: Setter<Participant[]>;
    mentionCount: Setter<number>;
    verified: Setter<boolean>;
    error: Setter<string>;
    jump: Setter<{ roomId: string; eventId: string } | null>;
    events: Setter<ChatEvent[]>;
    tasks: Setter<WorkTask[]>;
    mentionables: Setter<Mentionables>;
    roles: Setter<Role[]>;
    historyCursor: (roomId: string, before: string | null) => void;
  };
}

/** Prefer an expired-session failure so the caller signs out instead of showing a generic error. */
async function settle<T extends readonly unknown[]>(work: {
  [K in keyof T]: Promise<T[K]>;
}): Promise<T> {
  const results = await Promise.allSettled(work);
  const failures = results.flatMap((result) =>
    result.status === "rejected" ? [result.reason] : [],
  );
  if (failures.length)
    throw (
      failures.find(
        (reason) => reason instanceof ApiError && reason.status === 401,
      ) ?? failures[0]
    );
  return results.map(
    (result) => (result as PromiseFulfilledResult<unknown>).value,
  ) as unknown as T;
}

function initialTarget(account: Session, config: ClientConfig) {
  const navigation = new URL(location.href).searchParams;
  const matches =
    (!navigation.has("userId") ||
      navigation.get("userId") === account.user_id) &&
    (!navigation.has("homeCoreUrl") ||
      navigation.get("homeCoreUrl") === config.homeCoreUrl) &&
    (!navigation.has("centralIssuer") ||
      navigation.get("centralIssuer") === account.binding?.centralIssuer);
  return matches
    ? { roomId: navigation.get("roomId"), eventId: navigation.get("eventId") }
    : { roomId: null, eventId: null };
}

/** Poll the signed-in account, its spaces and the open room, and keep navigation on a joined room. */
export function useWorkspaceSync(sync: WorkspaceSync) {
  const {
    api,
    config,
    session,
    homeDiscovery,
    roomId,
    serverName,
    refreshNonce,
    refresh,
    clearSession,
    navigate,
    refs,
    set,
  } = sync;
  useEffect(() => {
    if (homeDiscovery === undefined) return;
    const controller = new AbortController();
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const account = session;
    const targetRoom = roomId;
    const targetServer = serverName;
    const active = () =>
      !stopped &&
      refs.session.current === account &&
      refs.room.current === targetRoom &&
      refs.server.current === targetServer;
    const options = { signal: controller.signal };

    async function syncAccount(account: Session) {
      const [profile, listed, facts, roster, inbox, runtime] = await settle<
        [
          AccountProfile,
          { rooms: Room[] },
          SpacesResult,
          { participants: Participant[] },
          InboxResult,
          ServerStatus,
        ]
      >([
        api<AccountProfile>("/api/me", options),
        api<{ rooms: Room[] }>("/api/rooms", options),
        api<SpacesResult>("/api/spaces", options),
        api<{ participants: Participant[] }>("/api/directory", options),
        api<InboxResult>("/api/inbox?filter=mentions&limit=1", options),
        api<ServerStatus>("/api/status", { ...options, auth: false }),
      ]);
      if (!active()) return null;
      if (profile.user.id !== account.user_id)
        throw new ApiError("Signed-in account changed", 401);
      set.allRooms(listed.rooms);
      refs.rooms.current = listed.rooms;
      set.spaces(facts);
      refs.spaces.current = facts;
      sessionStorage.setItem(
        storageKey(config, "rooms", account),
        JSON.stringify(listed.rooms),
      );
      sessionStorage.setItem(
        storageKey(config, "spaces", account),
        JSON.stringify(facts),
      );
      set.currentUser(profile.user);
      set.ownedBots(profile.ownedBots);
      const botCache = ownedBotCacheKey(config, account);
      if (botCache)
        sessionStorage.setItem(botCache, JSON.stringify(profile.ownedBots));
      set.directory(roster.participants);
      set.mentionCount(inbox.mentionCount);
      set.status(runtime);
      set.connection("connected");
      set.verified(true);
      set.error("");
      return { rooms: listed.rooms, facts };
    }

    // Returns false when navigation moved elsewhere and this poll should stop.
    function settleNavigation(
      account: Session,
      rooms: Room[],
      facts: SpacesResult,
    ) {
      let space =
        facts.spaces.find((value) => value.serverName === targetServer) ??
        facts.spaces.find((value) => value.home) ??
        null;
      const initial = refs.initialNavigation.current
        ? initialTarget(account, config)
        : { roomId: null, eventId: null };
      refs.initialNavigation.current = false;
      if (initial.roomId)
        space =
          facts.spaces.find((value) =>
            value.rooms.some(
              (item) =>
                item.roomId === initial.roomId && item.status === "joined",
            ),
          ) ?? space;
      const available = roomsInSpace(rooms, space);
      const nextRoom =
        available.find((value) => value.roomId === targetRoom) ??
        available.find((value) => value.kind === "group") ??
        available[0] ??
        null;
      const eventId =
        initial.eventId && nextRoom?.roomId === initial.roomId
          ? initial.eventId
          : undefined;
      if (eventId && nextRoom) set.jump({ roomId: nextRoom.roomId, eventId });
      if (
        space?.serverName !== targetServer ||
        nextRoom?.roomId !== (targetRoom ?? undefined)
      ) {
        navigate(nextRoom, space?.serverName ?? null, eventId);
        return null;
      }
      return { room: nextRoom, home: space?.home === true };
    }

    async function syncRoom(targetRoom: string, home: boolean) {
      const base = `/api/rooms/${encodeURIComponent(targetRoom)}`;
      const [messages, work, mentions, roleList] = await settle<
        [
          { events: ChatEvent[]; before?: string | null },
          { tasks: WorkTask[] },
          Mentionables,
          { roles: Role[] },
          unknown,
        ]
      >([
        api<{ events: ChatEvent[]; before?: string | null }>(
          `${base}/messages?limit=200`,
          options,
        ),
        api<{ tasks: WorkTask[] }>(`${base}/tasks`, options),
        api<Mentionables>(`${base}/mentionables`, options),
        home
          ? api<{ roles: Role[] }>("/api/roles", options)
          : Promise.resolve({ roles: [] }),
        api("/api/presence", {
          ...options,
          method: "POST",
          body: { status: document.hidden ? "idle" : "online" },
        }),
      ]);
      if (!active()) return;
      set.events((previous) =>
        mergeEvents(previous, messages.events, targetRoom),
      );
      set.historyCursor(targetRoom, messages.before ?? null);
      set.tasks(work.tasks.filter((task) => task.roomId === targetRoom));
      set.mentionables(mentions);
      set.roles(roleList.roles);
    }

    async function poll() {
      try {
        if (!account) {
          const value = await api<ServerStatus>("/api/status", {
            ...options,
            auth: false,
          });
          if (active()) {
            set.status(value);
            set.connection("connected");
          }
          return;
        }
        const synced = await syncAccount(account);
        if (!synced) return;
        const target = settleNavigation(account, synced.rooms, synced.facts);
        if (!target) return;
        if (!targetRoom || !target.room) {
          set.events([]);
          set.tasks([]);
          return;
        }
        await syncRoom(targetRoom, target.home);
      } catch (reason) {
        if (!active()) return;
        if (reason instanceof ApiError && reason.status === 401) {
          clearSession();
          return;
        }
        if (reason instanceof ApiError && reason.status === 403) {
          set.events([]);
          set.tasks([]);
          set.mentionables(emptyMentions);
          set.verified(false);
        }
        set.error(messageOf(reason));
        set.connection("offline");
      } finally {
        if (active())
          timer = setTimeout(
            () => void poll(),
            document.hidden ? HIDDEN_POLL_MS : ACTIVE_POLL_MS,
          );
      }
    }
    void poll();
    const resume = () => {
      stopped = true;
      controller.abort();
      clearTimeout(timer);
      refresh();
    };
    const offline = () => set.connection("offline");
    window.addEventListener("online", resume);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", resume);
    return () => {
      stopped = true;
      controller.abort();
      clearTimeout(timer);
      window.removeEventListener("online", resume);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", resume);
    };
    // refs and setters are stable; the poll restarts when the target or session changes.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [
    api,
    config,
    session,
    homeDiscovery,
    roomId,
    serverName,
    refreshNonce,
    refresh,
    clearSession,
    navigate,
  ]);
}
