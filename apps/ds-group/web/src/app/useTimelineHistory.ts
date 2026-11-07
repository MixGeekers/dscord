import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { messageOf } from "../api";
import type { createApi } from "../api";
import type { ChatEvent, Room } from "../types";
import { mergeEvents } from "./workspace";

type Api = ReturnType<typeof createApi>;
const PAGE_SIZE = 50;
/** A page may hold only state changes; stop after this many empty pages in one scroll. */
const MAX_EMPTY_PAGES = 5;

interface Cursor {
  roomId: string;
  before: string | null;
  loading: boolean;
}
interface UnreadAnchor {
  roomId: string;
  eventId: string | null;
  count: number;
}

export interface TimelineHistory {
  hasOlder: boolean;
  /** The first page arrived and there is nothing older. */
  atStart: boolean;
  loadingOlder: boolean;
  loadOlder(): Promise<void>;
  /** Called with each latest-page cursor; only the first one per room starts the history walk. */
  seed(roomId: string, before: string | null): void;
  unreadEventId: string | null;
  unreadCount: number;
  dismissUnread(): void;
}

/**
 * Older messages for the open room, fetched page by page as the reader scrolls up, and the
 * "new messages" position as it stood when the room was opened (it stays put while reading).
 */
export function useTimelineHistory(options: {
  api: Api;
  roomId: string | null;
  room: Room | null;
  setEvents: Dispatch<SetStateAction<ChatEvent[]>>;
  onError(message: string): void;
}): TimelineHistory {
  const { api, roomId, room, setEvents, onError } = options;
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const cursorRef = useRef(cursor);
  const roomRef = useRef(roomId);
  useEffect(() => {
    cursorRef.current = cursor;
    roomRef.current = roomId;
  });

  const [unread, setUnread] = useState<UnreadAnchor | null>(null);
  if (room && room.roomId === roomId && unread?.roomId !== roomId)
    setUnread({
      roomId: room.roomId,
      eventId: room.firstUnreadEventId ?? null,
      count: room.unreadCount ?? 0,
    });

  const seed = useCallback((target: string, before: string | null) => {
    setCursor((current) =>
      current?.roomId === target
        ? current
        : { roomId: target, before, loading: false },
    );
  }, []);

  const loadOlder = useCallback(async () => {
    const current = cursorRef.current;
    if (!current?.before || current.loading || current.roomId !== roomId)
      return;
    const target = current.roomId;
    const loading = { ...current, loading: true };
    cursorRef.current = loading;
    setCursor(loading);
    let before: string | null = current.before;
    try {
      for (let page = 0; page < MAX_EMPTY_PAGES && before; page++) {
        const result: { events: ChatEvent[]; before: string | null } =
          await api(
            `/api/rooms/${encodeURIComponent(target)}/messages?limit=${PAGE_SIZE}&before=${encodeURIComponent(before)}`,
          );
        if (roomRef.current !== target) return;
        setEvents((previous) => mergeEvents(previous, result.events, target));
        before = result.before;
        if (result.events.some((event) => event.type === "m.room.message"))
          break;
      }
      if (roomRef.current === target)
        setCursor({ roomId: target, before, loading: false });
    } catch (reason) {
      if (roomRef.current !== target) return;
      setCursor({ ...current, loading: false });
      onError(messageOf(reason));
    }
  }, [api, roomId, setEvents, onError]);

  const dismissUnread = useCallback(() => {
    setUnread((current) =>
      current ? { ...current, eventId: null, count: 0 } : current,
    );
  }, []);

  const active = cursor?.roomId === roomId ? cursor : null;
  const anchor = unread?.roomId === roomId ? unread : null;
  return {
    hasOlder: Boolean(active?.before),
    atStart: Boolean(active && !active.before),
    loadingOlder: Boolean(active?.loading),
    loadOlder,
    seed,
    unreadEventId: anchor?.eventId ?? null,
    unreadCount: anchor?.count ?? 0,
    dismissUnread,
  };
}
