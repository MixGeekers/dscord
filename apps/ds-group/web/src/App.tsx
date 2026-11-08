import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ApiError,
  createApi,
  createRequest,
  messageOf,
  readStored,
} from "./api";
import { defaultClientConfig, discoverHome } from "./client-config";
import type { ClientConfig, ClientDiscovery } from "./client-config";
import {
  bindSession,
  readScoped,
  restoreSession,
  sessionStorageKey,
  storageKey,
} from "./session";
import { matrixServer, roomsInSpace } from "./spaces";
import type { SpacesResult } from "./spaces";
import { useTranslation } from "./locale";
import { appMessages } from "./locales/app";
import { Shell } from "./components/Shell";
import { MemberDialog, RoomDialog } from "./components/BasicDialogs";
import { AuthDialog } from "./components/AuthDialog";
import type { AuthSubmission } from "./components/AuthDialog";
import { CreateBotDialog } from "./components/CreateBotDialog";
import { Composer } from "./components/Composer";
import { Timeline } from "./components/Timeline";
import { TaskHistoryDialog } from "./components/TaskTray";
import { SettingsDialog } from "./components/SettingsDialog";
import { RolesDialog } from "./components/RolesDialog";
import { SpacesDialog } from "./components/SpacesDialog";
import { MyBotsDialog } from "./components/MyBotsDialog";
import { InboxDialog } from "./components/InboxDialog";
import { NotificationDialog } from "./components/NotificationDialog";
import {
  emptyMentions,
  isOwnedBotRoom,
  mergeEvents,
  ownedBotCacheKey,
  restoredOwnedBots,
} from "./app/workspace";
import { useWorkspaceSync } from "./app/useWorkspaceSync";
import type {
  Bootstrap,
  ChatEvent,
  ComposerHandle,
  Mentionables,
  OutgoingMessage,
  Participant,
  PwaHandle,
  ReplyTarget,
  Role,
  Room,
  ServerStatus,
  Session,
  SettingsTab,
  WorkTask,
} from "./types";

const defaultConfig = () => defaultClientConfig();

export default function App({
  config: suppliedConfig,
}: { config?: ClientConfig } = {}) {
  const [config] = useState(() => suppliedConfig ?? defaultConfig());
  const t = useTranslation(appMessages);
  const [session, setSession] = useState<Session | null>(() =>
    restoreSession(config),
  );
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(() =>
    readScoped(config, "bootstrap"),
  );
  const [allRooms, setAllRooms] = useState<Room[]>(() =>
    session ? (readScoped(config, "rooms", session) ?? []) : [],
  );
  const [spacesResult, setSpacesResult] = useState<SpacesResult | null>(() =>
    session ? readScoped(config, "spaces", session) : null,
  );
  const [serverName, setServerName] = useState<string | null>(() =>
    session
      ? (readScoped<string>(config, "server", session) ??
        matrixServer(session.user_id))
      : null,
  );
  const [roomId, setRoomId] = useState<string | null>(() =>
    session
      ? new URL(location.href).searchParams.get("roomId") ||
        readScoped<string>(config, "room", session, serverName)
      : null,
  );
  const [homeDiscovery, setHomeDiscovery] = useState<
    ClientDiscovery | undefined
  >(undefined);
  const [verified, setVerified] = useState(false);
  const [connection, setConnection] = useState<
    "connecting" | "connected" | "offline"
  >("connecting");
  const [directory, setDirectory] = useState<Participant[]>([]);
  const [ownedBotsState, setOwnedBotsState] = useState<Participant[] | null>(
    () => restoredOwnedBots(config, session),
  );
  const ownedBots = ownedBotsState ?? [];
  const ownedBotsKnown = ownedBotsState !== null;
  const [currentUser, setCurrentUser] = useState<Participant | null>(null);
  const [events, setEvents] = useState<ChatEvent[]>([]);
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [mentionables, setMentionables] = useState<Mentionables>(emptyMentions);
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [mentionCount, setMentionCount] = useState(0);
  const [view, setView] = useState<"home" | "chat" | "bots">("chat");
  const [openingDirectId, setOpeningDirectId] = useState<string | null>(null);
  const [showTaskHistory, setShowTaskHistory] = useState(false);
  const [loginOpen, setLoginOpen] = useState(!session);
  const [loginBusy, setLoginBusy] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [loginRateLimitUntil, setLoginRateLimitUntil] = useState<number | null>(
    null,
  );
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null);
  const [rolesOpen, setRolesOpen] = useState(false);
  const [spacesOpen, setSpacesOpen] = useState(false);
  const [botsOpen, setBotsOpen] = useState(false);
  const [botsSelection, setBotsSelection] = useState<string | null>(null);
  const [roomDialog, setRoomDialog] = useState<"create" | "invite" | null>(
    null,
  );
  const [createBotOpen, setCreateBotOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [notificationRoom, setNotificationRoom] = useState<Room | null>(null);
  const [member, setMember] = useState<Participant | null>(null);
  const [reply, setReply] = useState<ReplyTarget | null>(null);
  const [replyMention, setReplyMention] = useState(true);
  const [sendingKeys, setSendingKeys] = useState<Set<string>>(() => new Set());
  const sendingRef = useRef(new Set<string>());
  const [pendingNonce, setPendingNonce] = useState(0);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [bootstrapNonce, setBootstrapNonce] = useState(0);
  const [jump, setJump] = useState<{ roomId: string; eventId: string } | null>(
    null,
  );
  const composer = useRef<ComposerHandle>(null);
  const pwa = useRef<PwaHandle | null>(null);
  const sessionRef = useRef(session);
  const serverRef = useRef(serverName);
  const roomRef = useRef(roomId);
  const viewRef = useRef(view);
  const directRequestRef = useRef(0);
  const spacesRef = useRef(spacesResult);
  const roomsRef = useRef(allRooms);
  const verifiedRef = useRef(verified);
  const authBusyRef = useRef(false);
  const suppressReadUntil = useRef(0);
  const lastRead = useRef(new Map<string, string>());
  const initialNavigation = useRef(true);
  sessionRef.current = session;
  serverRef.current = serverName;
  roomRef.current = roomId;
  viewRef.current = view;
  spacesRef.current = spacesResult;
  roomsRef.current = allRooms;
  verifiedRef.current = verified;
  const api = useMemo(
    () => createApi(() => sessionRef.current, config),
    [config],
  );
  const authApi = useMemo(
    () => createApi(() => sessionRef.current, config, "auth"),
    [config],
  );
  const rawRequest = useMemo(
    () => createRequest(() => sessionRef.current, config),
    [config],
  );
  const participants = useMemo(() => {
    const members = new Map(
      (directory.length ? directory : (bootstrap?.participants ?? [])).map(
        (person) => [person.id, person],
      ),
    );
    if (currentUser) members.set(currentUser.id, currentUser);
    for (const bot of ownedBots) members.set(bot.id, bot);
    for (const label of mentionables.members) {
      const person = members.get(label.id);
      if (person && label.name)
        members.set(label.id, { ...person, name: label.name });
    }
    return [...members.values()];
  }, [
    bootstrap?.participants,
    directory,
    currentUser,
    ownedBots,
    mentionables.members,
  ]);
  const workspace = useMemo(
    () => bootstrap && { ...bootstrap, participants },
    [bootstrap, participants],
  );
  const spaces = spacesResult?.spaces ?? [];
  const selectedSpace =
    spaces.find((space) => space.serverName === serverName) ?? null;
  const rooms = useMemo(
    () => roomsInSpace(allRooms, selectedSpace),
    [allRooms, selectedSpace],
  );
  const room = rooms.find((value) => value.roomId === roomId) ?? null;
  const keyFor = useCallback(
    (
      kind: string,
      account: Session,
      space: string | null,
      id?: string | null,
    ) => storageKey(config, kind, account, space, id),
    [config],
  );
  const currentPendingKey =
    session && roomId ? keyFor("pending", session, serverName, roomId) : "";
  const pending = useMemo(() => {
    if (!session || !roomId) return null;
    return readScoped<OutgoingMessage>(
      config,
      "pending",
      session,
      serverName,
      roomId,
    );
  }, [config, session, serverName, roomId, pendingNonce]);
  const sending = sendingKeys.has(currentPendingKey);
  const refresh = useCallback(() => setRefreshNonce((value) => value + 1), []);
  const notify = useCallback((message: string) => setToast(message), []);
  const openLogin = useCallback(() => {
    setLoginError("");
    setLoginRateLimitUntil(null);
    setLoginOpen(true);
  }, []);
  const displayName = useCallback(
    (id: string) => participants.find((person) => person.id === id)?.name ?? id,
    [participants],
  );

  const resetConversation = useCallback(() => {
    setEvents([]);
    setTasks([]);
    setRoles([]);
    setMentionables(emptyMentions);
    setReply(null);
    setReplyMention(true);
    setJump(null);
    setShowTaskHistory(false);
    setMember(null);
    setRoomDialog(null);
    setNotificationRoom(null);
    setInboxOpen(false);
    setRolesOpen(false);
  }, []);

  const clearSession = useCallback(() => {
    const botCache = ownedBotCacheKey(config, sessionRef.current);
    if (botCache) sessionStorage.removeItem(botCache);
    sessionStorage.removeItem(sessionStorageKey(config));
    sessionRef.current = null;
    serverRef.current = null;
    roomRef.current = null;
    setSession(null);
    setServerName(null);
    setRoomId(null);
    setCurrentUser(null);
    setAllRooms([]);
    setSpacesResult(null);
    setOwnedBotsState(null);
    setDirectory([]);
    setMentionCount(0);
    resetConversation();
    setVerified(false);
    setSettingsTab(null);
    setCreateBotOpen(false);
    setBotsOpen(false);
    setBotsSelection(null);
    setSpacesOpen(false);
    setLoginError("");
    setLoginRateLimitUntil(null);
    setError("");
    lastRead.current.clear();
    setView("home");
    setLoginOpen(true);
  }, [config, resetConversation]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const controller = new AbortController();
    setHomeDiscovery(undefined);
    void discoverHome(config, controller.signal)
      .then((discovery) => {
        if (controller.signal.aborted) return;
        const account = sessionRef.current;
        if (account && account.binding?.authorityId !== discovery.authorityId) {
          clearSession();
          setLoginError(t("homeChanged"));
        }
        setHomeDiscovery(discovery);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setError(messageOf(reason));
          setConnection("offline");
        }
      });
    return () => controller.abort();
  }, [config, bootstrapNonce, clearSession]);

  useEffect(() => {
    const controller = new AbortController();
    void api<Bootstrap>("/api/bootstrap", {
      auth: false,
      signal: controller.signal,
    })
      .then((value) => {
        if (controller.signal.aborted) return;
        setBootstrap(value);
        sessionStorage.setItem(
          storageKey(config, "bootstrap"),
          JSON.stringify(value),
        );
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(messageOf(reason));
      });
    return () => controller.abort();
  }, [api, config, bootstrapNonce]);

  const navigate = useCallback(
    (nextRoom: Room | null, targetServer: string | null, eventId?: string) => {
      if (
        targetServer !== serverRef.current ||
        nextRoom?.roomId !== roomRef.current
      )
        resetConversation();
      serverRef.current = targetServer;
      roomRef.current = nextRoom?.roomId ?? null;
      setServerName(targetServer);
      setRoomId(nextRoom?.roomId ?? null);
      viewRef.current = "chat";
      setView("chat");
      setOpeningDirectId(null);
      const account = sessionRef.current;
      if (account) {
        sessionStorage.setItem(
          storageKey(config, "server", account),
          JSON.stringify(targetServer),
        );
        if (nextRoom?.kind !== "direct")
          sessionStorage.setItem(
            storageKey(config, "room", account, targetServer),
            JSON.stringify(nextRoom?.roomId ?? null),
          );
      }
      const url = new URL(location.href);
      if (targetServer) url.searchParams.set("server", targetServer);
      else url.searchParams.delete("server");
      if (nextRoom) url.searchParams.set("roomId", nextRoom.roomId);
      else url.searchParams.delete("roomId");
      if (eventId) url.searchParams.set("eventId", eventId);
      else url.searchParams.delete("eventId");
      for (const key of ["userId", "homeCoreUrl", "authorityId"])
        url.searchParams.delete(key);
      history.replaceState(null, "", url);
      if (eventId && nextRoom) {
        suppressReadUntil.current = Date.now() + 1500;
        setJump({ roomId: nextRoom.roomId, eventId });
      }
    },
    [config, resetConversation],
  );

  const selectRoom = useCallback(
    (next: Room) => {
      const space = spacesRef.current?.spaces.find((value) =>
        value.rooms.some(
          (item) => item.roomId === next.roomId && item.status === "joined",
        ),
      );
      if (!space) {
        notify(t("notJoined"));
        return;
      }
      navigate(next, space.serverName);
    },
    [navigate, notify, t],
  );

  const selectServer = useCallback(
    (name: string) => {
      const space = spacesRef.current?.spaces.find(
        (value) => value.serverName === name,
      );
      if (!space) return;
      const joined = roomsInSpace(roomsRef.current, space);
      const account = sessionRef.current;
      const saved = account
        ? readScoped<string>(config, "room", account, name)
        : null;
      const savedRoom = joined.find((value) => value.roomId === saved);
      navigate(
        (isOwnedBotRoom(savedRoom, ownedBots, account?.user_id)
          ? null
          : savedRoom) ??
          joined.find((value) => value.kind === "group") ??
          joined.find(
            (value) => !isOwnedBotRoom(value, ownedBots, account?.user_id),
          ) ??
          null,
        name,
      );
    },
    [config, navigate, ownedBots],
  );

  useWorkspaceSync({
    api,
    authApi,
    config,
    session,
    homeDiscovery,
    roomId,
    serverName,
    refreshNonce,
    refresh,
    clearSession,
    navigate,
    refs: {
      session: sessionRef,
      room: roomRef,
      server: serverRef,
      rooms: roomsRef,
      spaces: spacesRef,
      initialNavigation,
    },
    set: {
      status: setStatus,
      connection: setConnection,
      allRooms: setAllRooms,
      spaces: setSpacesResult,
      currentUser: setCurrentUser,
      ownedBots: setOwnedBotsState,
      directory: setDirectory,
      mentionCount: setMentionCount,
      verified: setVerified,
      error: setError,
      jump: setJump,
      events: setEvents,
      tasks: setTasks,
      mentionables: setMentionables,
      roles: setRoles,
    },
  });

  useEffect(() => {
    const recover = () => {
      if (homeDiscovery === undefined) setBootstrapNonce((value) => value + 1);
    };
    window.addEventListener("online", recover);
    return () => window.removeEventListener("online", recover);
  }, [homeDiscovery]);

  const openDirect = useCallback(
    async (participantId: string) => {
      const account = sessionRef.current;
      const sourceServer = serverRef.current;
      const sourceRoom = roomRef.current;
      const sourceView = viewRef.current;
      const requestId = ++directRequestRef.current;
      if (!account) {
        openLogin();
        return;
      }
      setOpeningDirectId(participantId);
      try {
        const result = await api<Room>("/api/dm", {
          method: "POST",
          body: { participantId },
        });
        if (
          sessionRef.current !== account ||
          serverRef.current !== sourceServer ||
          roomRef.current !== sourceRoom ||
          viewRef.current !== sourceView ||
          directRequestRef.current !== requestId
        )
          return;
        if (!result.roomId) throw new Error(t("notJoined"));
        const next = {
          ...result,
          kind: "direct" as const,
          name: result.name || displayName(participantId),
          participantIds: result.participantIds || [
            account.user_id,
            participantId,
          ],
        };
        const ownBot = ownedBots.some(
          (bot) => bot.id === participantId && bot.ownerId === account.user_id,
        );
        const space = ownBot
          ? null
          : spacesRef.current?.spaces.find((value) =>
              value.rooms.some((item) => item.roomId === next.roomId),
            );
        navigate(
          next,
          ownBot
            ? matrixServer(account.user_id)
            : (space?.serverName ?? matrixServer(account.user_id)),
        );
        refresh();
      } catch (reason) {
        if (
          sessionRef.current === account &&
          serverRef.current === sourceServer &&
          roomRef.current === sourceRoom &&
          viewRef.current === sourceView &&
          directRequestRef.current === requestId
        )
          notify(messageOf(reason));
      } finally {
        if (directRequestRef.current === requestId) setOpeningDirectId(null);
      }
    },
    [api, displayName, notify, openLogin, navigate, ownedBots, refresh, t],
  );

  async function authenticate(input: AuthSubmission) {
    if (authBusyRef.current || logoutBusy || homeDiscovery === undefined)
      return;
    authBusyRef.current = true;
    setLoginBusy(true);
    setLoginError("");
    setLoginRateLimitUntil(null);
    try {
      const { username, password } = input;
      await pwa.current?.beforeIdentityChange("");
      const receipt =
        input.mode === "register"
          ? await authApi<Session>("/api/register", {
              method: "POST",
              body: { username, password, displayName: input.displayName },
              auth: false,
              timeout: 30000,
            })
          : password
            ? await authApi<Session>("/api/login", {
                method: "POST",
                body: { user: username, password },
                auth: false,
                timeout: 30000,
              })
            : await authApi<Session>(
                `/api/demo-login?user=${encodeURIComponent(username)}`,
                { auth: false },
              );
      const next = bindSession(receipt, config, homeDiscovery);
      sessionStorage.setItem(sessionStorageKey(config), JSON.stringify(next));
      sessionRef.current = next;
      setSession(next);
      setCurrentUser(null);
      setOwnedBotsState(restoredOwnedBots(config, next));
      setDirectory([]);
      resetConversation();
      setAllRooms([]);
      setSpacesResult(null);
      setMentionCount(0);
      setVerified(false);
      const home = matrixServer(next.user_id);
      const savedServer = readScoped<string>(config, "server", next) ?? home;
      serverRef.current = savedServer;
      setServerName(savedServer);
      const savedRoom = readScoped<string>(config, "room", next, savedServer);
      roomRef.current = savedRoom;
      setRoomId(savedRoom);
      initialNavigation.current = true;
      lastRead.current.clear();
      setLoginOpen(false);
      setView("chat");
      refresh();
      void pwa.current?.refresh();
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 429)
        setLoginRateLimitUntil(
          reason.retryAfterMs > 0 ? Date.now() + reason.retryAfterMs : 0,
        );
      else setLoginError(messageOf(reason));
    } finally {
      authBusyRef.current = false;
      setLoginBusy(false);
    }
  }

  async function logout() {
    if (authBusyRef.current || logoutBusy || !sessionRef.current) return;
    authBusyRef.current = true;
    setLogoutBusy(true);
    try {
      await pwa.current?.beforeIdentityChange("");
      try {
        await authApi("/api/logout", { method: "POST", body: {} });
      } catch (reason) {
        if (!(reason instanceof ApiError) || reason.status !== 401)
          throw reason;
      }
      clearSession();
      const url = new URL(location.href);
      for (const key of ["roomId", "eventId", "server"])
        url.searchParams.delete(key);
      history.replaceState(null, "", url);
      void pwa.current?.refresh();
    } catch (reason) {
      notify(messageOf(reason));
    } finally {
      authBusyRef.current = false;
      setLogoutBusy(false);
    }
  }

  const sendMessage = useCallback(
    async (message: OutgoingMessage): Promise<boolean> => {
      const account = sessionRef.current;
      const targetRoom = roomRef.current;
      const targetServer = serverRef.current;
      const fact = spacesRef.current?.spaces
        .find((value) => value.serverName === targetServer)
        ?.rooms.find((value) => value.roomId === targetRoom);
      if (
        !account ||
        !targetRoom ||
        !verifiedRef.current ||
        fact?.status !== "joined" ||
        !fact.canSend
      )
        return false;
      const key = keyFor("pending", account, targetServer, targetRoom);
      if (sendingRef.current.has(key)) return false;
      const outgoing = readStored<OutgoingMessage>(key) || message;
      sessionStorage.setItem(key, JSON.stringify(outgoing));
      setPendingNonce((value) => value + 1);
      sendingRef.current.add(key);
      setSendingKeys(new Set(sendingRef.current));
      const stillHere = () =>
        sessionRef.current === account &&
        serverRef.current === targetServer &&
        roomRef.current === targetRoom;
      try {
        const receipt = await api<{ event_id: string }>(
          `/api/rooms/${encodeURIComponent(targetRoom)}/messages`,
          { method: "POST", body: outgoing, timeout: 30000 },
        );
        if (!receipt.event_id) throw new Error(t("receiptPending"));
        sessionStorage.removeItem(key);
        sessionStorage.removeItem(
          keyFor("draft", account, targetServer, targetRoom),
        );
        if (stillHere()) {
          setPendingNonce((value) => value + 1);
          setReply(null);
          setReplyMention(true);
        }
        refresh();
        return true;
      } catch (reason) {
        if (
          reason instanceof ApiError &&
          reason.status >= 400 &&
          reason.status < 500 &&
          reason.status !== 429
        ) {
          sessionStorage.removeItem(key);
          if (stillHere()) setPendingNonce((value) => value + 1);
        }
        if (stillHere()) notify(messageOf(reason));
        return false;
      } finally {
        sendingRef.current.delete(key);
        setSendingKeys(new Set(sendingRef.current));
      }
    },
    [api, keyFor, notify, refresh, t],
  );

  const markRead = useCallback(
    async (eventId: string) => {
      const id = roomRef.current;
      const account = sessionRef.current;
      const scope = `${serverRef.current}/${id}`;
      if (
        !id ||
        !account ||
        !verifiedRef.current ||
        view !== "chat" ||
        document.hidden ||
        Date.now() < suppressReadUntil.current ||
        lastRead.current.get(scope) === eventId
      )
        return;
      try {
        await api(`/api/rooms/${encodeURIComponent(id)}/read`, {
          method: "POST",
          body: { eventId },
        });
        if (
          sessionRef.current !== account ||
          roomRef.current !== id ||
          `${serverRef.current}/${id}` !== scope
        )
          return;
        lastRead.current.set(scope, eventId);
        setAllRooms((previous) =>
          previous.map((value) =>
            value.roomId === id
              ? { ...value, unreadCount: 0, mentionCount: 0 }
              : value,
          ),
        );
      } catch {
        /* A later visible timeline update retries the read position. */
      }
    },
    [api, view],
  );

  const jumpToEvent = useCallback(
    async (targetRoomId: string, eventId?: string) => {
      const account = sessionRef.current;
      const sourceRoom = roomRef.current;
      const sourceServer = serverRef.current;
      if (!account) {
        openLogin();
        return;
      }
      try {
        const [listed, facts] = await Promise.all([
          api<{ rooms: Room[] }>("/api/rooms"),
          api<SpacesResult>("/api/spaces"),
        ]);
        if (
          sessionRef.current !== account ||
          roomRef.current !== sourceRoom ||
          serverRef.current !== sourceServer
        )
          return;
        const target = listed.rooms.find(
          (value) => value.roomId === targetRoomId,
        );
        const space = facts.spaces.find((value) =>
          value.rooms.some(
            (item) => item.roomId === targetRoomId && item.status === "joined",
          ),
        );
        if (!target || !space) {
          notify(t("notJoined"));
          return;
        }
        setAllRooms(listed.rooms);
        roomsRef.current = listed.rooms;
        setSpacesResult(facts);
        spacesRef.current = facts;
        navigate(target, space.serverName, eventId);
      } catch (reason) {
        if (sessionRef.current === account) notify(messageOf(reason));
      }
    },
    [api, navigate, notify, openLogin, t],
  );

  useEffect(() => {
    if (!jump || roomId !== jump.roomId || !session) return;
    const controller = new AbortController();
    const existing = document.querySelector<HTMLElement>(
      `[data-event-id="${CSS.escape(jump.eventId)}"]`,
    );
    if (existing) {
      existing.classList.add("notification-target");
      existing.scrollIntoView({ block: "center", behavior: "smooth" });
      setTimeout(() => existing.classList.remove("notification-target"), 3500);
      setJump(null);
      return;
    }
    const account = session;
    void api<{ events: ChatEvent[] }>(
      `/api/rooms/${encodeURIComponent(jump.roomId)}/context/${encodeURIComponent(jump.eventId)}`,
      { signal: controller.signal },
    )
      .then((result) => {
        if (
          !controller.signal.aborted &&
          sessionRef.current === account &&
          roomRef.current === jump.roomId
        )
          setEvents((previous) =>
            mergeEvents(previous, result.events, jump.roomId),
          );
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          notify(messageOf(reason));
          setJump(null);
        }
      });
    return () => controller.abort();
  }, [jump, roomId, session, events, api, notify]);

  const openRoomFromNotification = useCallback(
    (targetRoomId: string, eventId?: string, expectedUserId?: string) => {
      if (expectedUserId && expectedUserId !== sessionRef.current?.user_id)
        return;
      if (!sessionRef.current) {
        const url = new URL(location.href);
        url.searchParams.set("roomId", targetRoomId);
        if (eventId) url.searchParams.set("eventId", eventId);
        history.replaceState(null, "", url);
        openLogin();
        return;
      }
      void jumpToEvent(targetRoomId, eventId);
    },
    [jumpToEvent, openLogin],
  );

  const cancelTask = useCallback(
    async (requestId: string) => {
      const account = sessionRef.current;
      const sourceRoom = roomRef.current;
      try {
        await api(`/api/tasks/${encodeURIComponent(requestId)}/cancel`, {
          method: "POST",
          body: {},
        });
        if (sessionRef.current === account && roomRef.current === sourceRoom) {
          refresh();
          notify(t("cancelled"));
        }
      } catch (reason) {
        if (sessionRef.current === account) notify(messageOf(reason));
        throw reason;
      }
    },
    [api, notify, refresh, t],
  );

  const joinedMentionables = useMemo(
    () =>
      mentionables.members.length
        ? mentionables
        : {
            ...mentionables,
            members: participants.filter((person) =>
              room?.participantIds.includes(person.id),
            ),
          },
    [mentionables, participants, room],
  );
  useEffect(() => {
    if (session && room && isOwnedBotRoom(room, ownedBots, session.user_id))
      sessionStorage.setItem(
        storageKey(config, "owned-bot-room", session),
        JSON.stringify(room.roomId),
      );
  }, [config, ownedBots, room, session]);
  const homeSelected = selectedSpace?.home === true;

  return (
    <>
      <Shell
        bootstrap={workspace}
        session={session}
        rooms={rooms}
        allRooms={allRooms}
        room={room}
        spaces={spaces}
        selectedSpace={selectedSpace}
        currentUser={currentUser}
        connection={connection}
        ownedBots={ownedBots}
        ownedBotsKnown={ownedBotsKnown}
        openingDirectId={openingDirectId}
        mentionables={joinedMentionables}
        status={status}
        view={view}
        mentionCount={mentionCount}
        showTaskHistory={showTaskHistory}
        canCreateRoom={verified && homeSelected}
        canInvite={
          verified &&
          homeSelected &&
          room?.kind === "group" &&
          room.permissions?.inviteMembers === true
        }
        onRoom={selectRoom}
        onDirect={(id) => openDirect(id)}
        onHome={() => {
          viewRef.current = "home";
          setView("home");
          setOpeningDirectId(null);
        }}
        onBots={() => {
          const account = sessionRef.current;
          const saved =
            account && readScoped<string>(config, "owned-bot-room", account);
          const home = spacesRef.current?.spaces.find((space) => space.home);
          const recent = roomsRef.current.find(
            (candidate) =>
              candidate.roomId === saved &&
              isOwnedBotRoom(candidate, ownedBots, account?.user_id),
          );
          if (
            recent &&
            home?.rooms.some(
              (item) =>
                item.roomId === recent.roomId && item.status === "joined",
            )
          )
            navigate(recent, home.serverName);
          else {
            viewRef.current = "bots";
            setView("bots");
          }
        }}
        onServer={selectServer}
        onSpaces={() => (session ? setSpacesOpen(true) : openLogin())}
        onSettings={(tab = "account") => setSettingsTab(tab)}
        onLogin={openLogin}
        onCreateRoom={() => (session ? setRoomDialog("create") : openLogin())}
        onCreateBot={() => (session ? setCreateBotOpen(true) : openLogin())}
        onManageBots={() => {
          setBotsSelection(null);
          if (session) setBotsOpen(true);
          else openLogin();
        }}
        onInvite={() => (session ? setRoomDialog("invite") : openLogin())}
        onInbox={() => (session ? setInboxOpen(true) : openLogin())}
        onNotifications={() =>
          session ? setNotificationRoom(room) : openLogin()
        }
        onToggleTasks={() => setShowTaskHistory((value) => !value)}
        onMember={(id) =>
          setMember(participants.find((person) => person.id === id) ?? null)
        }
      >
        <div
          id="page-error"
          className="notice notice-error"
          role="alert"
          hidden={!error}
        >
          <span id="page-error-text">{error}</span>
          <button
            id="retry-connection"
            type="button"
            onClick={() => {
              setBootstrapNonce((value) => value + 1);
              refresh();
            }}
          >
            {t("retry")}
          </button>
        </div>
        <Timeline
          key={`${serverName}/${roomId ?? "signed-out"}`}
          events={events}
          participants={participants}
          session={session}
          request={rawRequest}
          mentionables={joinedMentionables}
          roles={roles}
          onReply={(event) => {
            if (!session) {
              openLogin();
              return;
            }
            setReply({
              eventId: event.event_id,
              senderName: displayName(event.sender),
              body: event.content.body,
            });
            setReplyMention(true);
            composer.current?.focus();
          }}
          onMember={(id) =>
            setMember(participants.find((person) => person.id === id) ?? null)
          }
          onJump={(id) => {
            if (roomId) void jumpToEvent(roomId, id);
          }}
          onRead={(id) => void markRead(id)}
          onRole={homeSelected ? () => setRolesOpen(true) : undefined}
        />
        <Composer
          ref={composer}
          session={session}
          room={room}
          request={rawRequest}
          contextKey={
            session && room
              ? keyFor("draft", session, serverName, room.roomId)
              : ""
          }
          requestScope={
            session ? storageKey(config, "transport", session, serverName) : ""
          }
          canSend={
            verified &&
            homeDiscovery !== undefined &&
            connection === "connected" &&
            room?.permissions?.sendMessages !== false
          }
          mentionables={joinedMentionables}
          reply={reply}
          replyMention={replyMention}
          onReplyMention={setReplyMention}
          onClearReply={() => setReply(null)}
          onRestoreReply={(target, mention) => {
            setReply(target);
            setReplyMention(mention);
          }}
          sending={sending}
          isWorking={tasks.some(
            (task) => task.status === "queued" || task.status === "running",
          )}
          pending={pending}
          onSend={sendMessage}
          limits={bootstrap?.attachments}
          onError={notify}
        />
      </Shell>
      <TaskHistoryDialog
        tasks={tasks}
        participants={participants}
        open={showTaskHistory}
        onClose={() => setShowTaskHistory(false)}
        onCancel={cancelTask}
        onError={notify}
      />
      <AuthDialog
        open={loginOpen}
        bootstrap={workspace}
        session={session}
        busy={loginBusy || logoutBusy || homeDiscovery === undefined}
        error={loginError}
        rateLimitUntil={loginRateLimitUntil}
        onSubmit={authenticate}
        onClearError={() => {
          setLoginError("");
          setLoginRateLimitUntil(null);
        }}
        onClose={() => {
          if (session) setLoginOpen(false);
        }}
      />
      <CreateBotDialog
        open={createBotOpen}
        api={api}
        session={session}
        status={status}
        pendingStorageKey={
          session ? storageKey(config, "pending-bot", session) : ""
        }
        onCreated={(bot) => {
          setOwnedBotsState((previous) =>
            previous === null
              ? null
              : [...previous.filter((value) => value.id !== bot.id), bot],
          );
          refresh();
        }}
        onClose={() => setCreateBotOpen(false)}
      />
      <RoomDialog
        mode={roomDialog}
        session={session}
        room={room}
        participants={participants}
        ownedBots={ownedBots}
        api={api}
        pendingStorageKey={
          session ? storageKey(config, "pending-room", session, serverName) : ""
        }
        onRoom={(next) => {
          navigate(next, matrixServer(session!.user_id));
          refresh();
          if (next.status === "partially_joined") notify(t("joinPending"));
        }}
        onChanged={refresh}
        onClose={() => setRoomDialog(null)}
        onError={notify}
      />
      <MemberDialog
        member={member}
        session={session}
        room={room}
        roles={roles}
        botStatus={
          status?.nodes.find((node) => node.botId === member?.id)?.status
        }
        owner={participants.find((person) => person.id === member?.ownerId)}
        onManageBot={(id) => {
          setMember(null);
          setBotsSelection(id);
          setBotsOpen(true);
        }}
        onClose={() => setMember(null)}
        onDirect={(id) => {
          setMember(null);
          void openDirect(id);
        }}
        onMention={(person) => {
          setMember(null);
          requestAnimationFrame(() => composer.current?.insertMention(person));
        }}
      />
      <SettingsDialog
        tab={settingsTab}
        onTab={setSettingsTab}
        onClose={() => setSettingsTab(null)}
        session={session}
        api={api}
        config={config}
        logoutBusy={logoutBusy}
        onLogout={() => void logout()}
        onSwitchAccount={() => {
          setSettingsTab(null);
          openLogin();
        }}
        onOpenRoom={openRoomFromNotification}
        onPwaReady={(handle) => {
          pwa.current = handle;
        }}
      />
      <RolesDialog
        open={rolesOpen}
        participants={participants}
        session={session}
        api={api}
        onChanged={refresh}
        onClose={() => setRolesOpen(false)}
      />
      <SpacesDialog
        open={spacesOpen}
        spaces={spaces}
        selectedServer={serverName}
        onRoles={() => {
          setSpacesOpen(false);
          setRolesOpen(true);
        }}
        api={api}
        session={session}
        onClose={() => setSpacesOpen(false)}
        onServer={(name) => {
          selectServer(name);
          setSpacesOpen(false);
        }}
        onChanged={refresh}
        onJoined={(id) => {
          setSpacesOpen(false);
          refresh();
          void jumpToEvent(id);
        }}
      />
      <MyBotsDialog
        open={botsOpen}
        bots={ownedBots}
        api={api}
        rooms={spaces.flatMap((space) => roomsInSpace(allRooms, space))}
        participants={participants}
        status={status}
        initialBotId={botsSelection}
        session={session}
        onClose={() => setBotsOpen(false)}
        onCreate={() => {
          setBotsOpen(false);
          setCreateBotOpen(true);
        }}
        onDirect={(id) => {
          setBotsOpen(false);
          void openDirect(id);
        }}
      />
      <InboxDialog
        open={inboxOpen}
        api={api}
        rooms={allRooms}
        participants={participants}
        onClose={() => setInboxOpen(false)}
        onJump={(id, eventId) => {
          setInboxOpen(false);
          void jumpToEvent(id, eventId);
        }}
        onChanged={refresh}
      />
      <NotificationDialog
        room={notificationRoom}
        api={api}
        onClose={() => setNotificationRoom(null)}
        onSaved={() => {
          setNotificationRoom(null);
          notify(t("notificationSaved"));
        }}
      />
      <div id="toast" className="toast" role="status" hidden={!toast}>
        {toast}
      </div>
    </>
  );
}
