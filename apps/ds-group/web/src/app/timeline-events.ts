import type { ChatEvent } from "../types";

/** Merge fetched message events into the timeline, keeping the previous array when nothing changed. */
export function mergeEvents(
  previous: ChatEvent[],
  incoming: ChatEvent[],
  roomId: string,
): ChatEvent[] {
  const known = new Map(previous.map((event) => [event.event_id, event]));
  let changed = false;
  const store = (event: ChatEvent) => {
    const current = known.get(event.event_id);
    if (current && JSON.stringify(current) === JSON.stringify(event)) return;
    known.set(event.event_id, event);
    changed = true;
  };
  for (const event of incoming) {
    if (!event.event_id || (event.room_id && event.room_id !== roomId))
      continue;
    const raw = event as ChatEvent & { redacts?: string };
    if (event.type === "m.room.redaction") {
      // A withdrawal may arrive after the message itself was loaded.
      const target = known.get(
        raw.redacts ?? (event.content as { redacts?: string })?.redacts ?? "",
      );
      if (target && !target.unsigned?.redacted_because)
        store(withdrawnEvent(target, event.event_id));
      continue;
    }
    if (event.type !== "m.room.message") continue;
    const normalized = event.room_id ? event : { ...event, room_id: roomId };
    if (event.unsigned?.redacted_because)
      store(withdrawnEvent(normalized, event.unsigned.redacted_because));
    else if (typeof event.content?.body === "string") store(normalized);
  }
  if (!changed) return previous;
  return [...known.values()].sort(
    (left, right) => left.origin_server_ts - right.origin_server_ts,
  );
}

export function withdrawnEvent(event: ChatEvent, because: unknown): ChatEvent {
  return {
    ...event,
    content: { body: "" },
    unsigned: { redacted_because: because },
  };
}

function replacedEventId(event: ChatEvent): string | undefined {
  const relation = event.content["m.relates_to"];
  return relation?.rel_type === "m.replace" ? relation.event_id : undefined;
}

/**
 * What the timeline shows: edits fold into the message they change (latest edit by the
 * original sender wins) and withdrawn messages are marked rather than shown.
 */
export function visibleEvents(events: ChatEvent[]): ChatEvent[] {
  const senders = new Map(
    events.map((event) => [event.event_id, event.sender]),
  );
  const latest = new Map<string, ChatEvent>();
  for (const event of events) {
    const target = replacedEventId(event);
    if (!target || senders.get(target) !== event.sender) continue;
    const current = latest.get(target);
    if (!current || current.origin_server_ts <= event.origin_server_ts)
      latest.set(target, event);
  }
  return events.flatMap((event) => {
    if (replacedEventId(event)) return [];
    if (event.unsigned?.redacted_because)
      return [{ ...event, withdrawn: true }];
    const edit = latest.get(event.event_id);
    const replacement = edit?.content["m.new_content"];
    if (!edit || typeof replacement?.body !== "string") return [event];
    const metadata = event.content["org.ds_group"];
    return [
      {
        ...event,
        content: {
          ...event.content,
          body: replacement.body,
          "org.ds_group": {
            ...metadata,
            mentions:
              replacement["org.ds_group"]?.mentions ?? metadata?.mentions,
          },
        },
        edited: edit.origin_server_ts,
      },
    ];
  });
}

/** The newest shown message that matches, e.g. the sender's own latest for ↑ editing. */
export function lastVisible(
  events: ChatEvent[],
  matches: (event: ChatEvent) => boolean = () => true,
): ChatEvent | undefined {
  for (let index = events.length - 1; index >= 0; index--)
    if (!events[index].withdrawn && matches(events[index]))
      return events[index];
  return undefined;
}
