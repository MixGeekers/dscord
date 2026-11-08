import { Button, Radio, RadioGroup } from "../../../ui/controls";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, messageOf } from "../api";
import { formatDateTime, formatNumber, formatTime } from "../../i18n.js";
import { useTranslation } from "../locale";
import { kernelMessages } from "../locales/kernel";
import { botHomeMessages } from "../locales/bot-home";
import { sessionIdentity } from "../session";
import { connectionLabel, kernelActivity } from "../bot-kernel";
import type {
  AttentionReceipt,
  BotKernelView,
  ContactsPage,
  MemoryChangesPage,
  ParticipationMode,
  ResponderStatus,
  TimelineItem,
  TimelinePage,
  WorkerTask,
} from "../bot-kernel";
import type { Api, Participant, Room, ServerStatus, Session } from "../types";
import { BotMemory } from "./BotMemory";
import { BotWorkGrants } from "./BotWorkGrants";
import { Icon } from "./Icons";

export type BotHomeTab =
  "now" | "timeline" | "conversations" | "memory" | "settings";
const tabs: BotHomeTab[] = [
  "now",
  "timeline",
  "conversations",
  "memory",
  "settings",
];
const modes: ParticipationMode[] = ["mention", "shadow", "natural"];
type Translate = (
  key: keyof (typeof botHomeMessages)["en"],
  values?: Record<string, string | number>,
) => string;
type Names = {
  person(id?: string | null): string;
  room(id?: string | null): string;
};

/** A Bot's own page: what it is doing now, what happened, whom it talks with, what it remembers, and its settings. */
export function BotHome({
  bot,
  session,
  api,
  status,
  rooms,
  participants,
  opening,
  initialTab = "now",
  openedAt = 0,
  onDirect,
}: {
  bot: Participant;
  session: Session | null;
  api: Api;
  status: ServerStatus | null;
  rooms: Room[];
  participants: Participant[];
  opening: boolean;
  initialTab?: BotHomeTab;
  /** Each time the owner opens this page it starts on `initialTab`. */
  openedAt?: number;
  onDirect(id: string): void;
}) {
  const t = useTranslation(botHomeMessages);
  const k = useTranslation(kernelMessages);
  const [tab, setTab] = useState<BotHomeTab>(initialTab);
  const [view, setView] = useState<BotKernelView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{
    key: "unsupported" | "failed";
    message: string;
  } | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [revision, setRevision] = useState(0);
  const context = `${sessionIdentity(session)}/${bot.id}`;
  const current = useRef(context);
  current.current = context;
  const route = `/api/bots/${encodeURIComponent(bot.id)}`;
  const owned = bot.ownerId === session?.user_id;
  useEffect(() => setTab(initialTab), [initialTab, openedAt]);

  useEffect(() => {
    if (!owned) {
      setLoading(false);
      return;
    }
    const abort = new AbortController();
    setLoading(true);
    setError(null);
    void api<BotKernelView>(`${route}/kernel`, { signal: abort.signal })
      .then((result) => {
        if (abort.signal.aborted || current.current !== context) return;
        if (!result || typeof result !== "object" || !("runtime" in result))
          throw new Error("Invalid Bot kernel receipt");
        setView(result);
        setUpdatedAt(Date.now());
      })
      .catch((cause) => {
        if (abort.signal.aborted || current.current !== context) return;
        setError({
          key:
            cause instanceof ApiError && cause.status === 404
              ? "unsupported"
              : "failed",
          message: messageOf(cause),
        });
        setView(null);
      })
      .finally(() => {
        if (!abort.signal.aborted && current.current === context)
          setLoading(false);
      });
    return () => abort.abort();
  }, [api, route, context, owned, revision]);

  useEffect(() => {
    if (!owned || (tab !== "now" && tab !== "settings")) return;
    const timer = setInterval(() => setRevision((value) => value + 1), 10000);
    return () => clearInterval(timer);
  }, [tab, owned]);

  const names: Names = {
    person: (id) =>
      (id && participants.find((person) => person.id === id)?.name) ||
      id ||
      k("unknown"),
    room: (id) =>
      (id && rooms.find((room) => room.roomId === id)?.name) ||
      id ||
      k("unknown"),
  };
  if (!owned) return <p>{k("denied")}</p>;
  const node = status?.nodes.find((value) => value.botId === bot.id);
  const connection =
    view?.online === true
      ? "online"
      : view?.online === false
        ? "offline"
        : connectionLabel(node?.status);
  return (
    <section className="bot-home" data-bot-home={bot.id}>
      <header className="bot-home-header">
        <span className="avatar avatar-bot" aria-hidden="true">
          {bot.name.slice(0, 1)}
        </span>
        <div className="bot-home-identity">
          <h2>{bot.name}</h2>
          <small className="member-full-id">{bot.id}</small>
          <span className="bot-state-pill" data-connection={connection}>
            {k(connection)}
          </span>
        </div>
        <div className="bot-home-actions">
          <Button
            variant="ghost"
            size="sm"
            type="button"
            disabled={loading}
            onClick={() => setRevision((value) => value + 1)}
          >
            <Icon name="refresh" />
            {k("refresh")}
          </Button>
          <Button
            variant="default"
            type="button"
            data-bot-direct={bot.id}
            aria-busy={opening}
            disabled={opening}
            onClick={() => onDirect(bot.id)}
          >
            <Icon name="message" />
            {t("sendMessage")}
          </Button>
        </div>
      </header>
      {opening && (
        <p id="bot-open-status" role="status" className="muted small">
          {t("openingDirect", { name: bot.name })}
        </p>
      )}
      <nav className="settings-tabs bot-settings-tabs" aria-label={bot.name}>
        {tabs.map((value) => (
          <Button
            key={value}
            variant="ghost"
            type="button"
            data-bot-tab={value}
            aria-current={tab === value ? "page" : undefined}
            onClick={() => setTab(value)}
          >
            {t(value)}
          </Button>
        ))}
      </nav>
      <div className="bot-home-content">
        {error && (
          <p className="bot-settings-error" role="alert">
            {k(error.key, { error: error.message })}
          </p>
        )}
        {tab === "now" && (
          <NowPanel
            bot={bot}
            view={view}
            loading={loading}
            updatedAt={updatedAt}
            names={names}
            participants={participants}
          />
        )}
        {tab === "timeline" && (
          <TimelinePanel
            api={api}
            route={route}
            context={context}
            names={names}
          />
        )}
        {tab === "conversations" && (
          <ConversationsPanel
            api={api}
            route={route}
            context={context}
            names={names}
          />
        )}
        {tab === "memory" && (
          <div data-bot-panel="memory">
            <BotMemory
              bot={bot}
              api={api}
              rooms={rooms}
              participants={participants}
            />
            <MemoryChangesPanel api={api} route={route} context={context} />
          </div>
        )}
        {tab === "settings" && (
          <div data-bot-panel="settings">
            <Participation
              api={api}
              route={route}
              context={context}
              view={view}
              loading={loading}
              locked={!!error}
              onView={setView}
            />
            {!bot.nativeBinding && (
              <BotWorkGrants
                bot={bot}
                api={api}
                session={session}
                rooms={rooms}
                participants={participants}
                onBack={() => setTab("now")}
              />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function responderLine(
  t: Translate,
  responder: ResponderStatus | null | undefined,
  names: Names,
) {
  if (responder?.state === "replying")
    return responder.roomId
      ? t("replyingIn", {
          name: names.person(responder.requesterId),
          room: names.room(responder.roomId),
        })
      : t("replying", { name: names.person(responder.requesterId) });
  if (responder?.state === "deciding") return t("deciding");
  if (responder?.state === "offline") return t("offline");
  return t("idle");
}

function NowPanel({
  bot,
  view,
  loading,
  updatedAt,
  names,
  participants,
}: {
  bot: Participant;
  view: BotKernelView | null;
  loading: boolean;
  updatedAt: number | null;
  names: Names;
  participants: Participant[];
}) {
  const t = useTranslation(botHomeMessages);
  const k = useTranslation(kernelMessages);
  const activity = kernelActivity(view);
  const owner = participants.find((person) => person.id === bot.ownerId);
  const responder =
    view?.online === false ? { state: "offline" } : view?.responder;
  const decision = view?.attention?.lastDecision;
  return (
    <div data-bot-panel="now">
      {loading && !view && <p role="status">{k("loading")}</p>}
      {!loading && view?.runtime?.available === false && (
        <p role="status">{k("unavailableHelp")}</p>
      )}
      <div className="bot-activity-card" data-activity={activity}>
        <Icon
          name={
            activity === "working"
              ? "work"
              : activity === "speaking"
                ? "message"
                : activity === "waiting"
                  ? "clock"
                  : "listen"
          }
        />
        <div>
          <strong>{k(activity)}</strong>
          <p>{k(`${activity}Help`)}</p>
        </div>
      </div>
      <section
        className="bot-home-section"
        data-bot-responder={responder?.state ?? "unknown"}
      >
        <h3>{t("responder")}</h3>
        <p>
          {responderLine(t, responder, names)}
          {typeof responder?.since === "number" && (
            <small className="muted">
              {" · "}
              {t("since", { time: formatTime(responder.since) })}
            </small>
          )}
        </p>
      </section>
      <section className="bot-home-section">
        <h3>{t("workers")}</h3>
        {view?.work?.workers?.length ? (
          <ul className="bot-work-list">
            {view.work.workers.map((task) => (
              <WorkerRow key={task.taskId} task={task} names={names} />
            ))}
          </ul>
        ) : (
          <p className="muted">{t("noWorkers")}</p>
        )}
        {!!view?.work?.queue?.length && (
          <>
            <h4>{t("queued")}</h4>
            <ul className="bot-work-list">
              {view.work.queue.map((task) => (
                <WorkerRow key={task.taskId} task={task} names={names} />
              ))}
            </ul>
          </>
        )}
      </section>
      <section className="bot-home-section">
        <h3>{t("lastDecision")}</h3>
        <p>
          {decision?.action
            ? `${t(decision.action)}${decision.at ? ` · ${formatDateTime(decision.at)}` : ""}`
            : t("noDecision")}
        </p>
      </section>
      <dl className="bot-overview-grid">
        <div>
          <dt>{k("owner")}</dt>
          <dd>
            {owner?.name ?? bot.ownerId ?? k("unknown")}
            <small className="member-full-id">
              {owner?.name && bot.ownerId}
            </small>
          </dd>
        </div>
        <div>
          <dt>{k("queue")}</dt>
          <dd>
            {typeof view?.attention?.queue?.pending === "number"
              ? formatNumber(view.attention.queue.pending)
              : k("unknown")}
          </dd>
        </div>
      </dl>
      {!!view?.runtime?.id && (
        <details className="bot-runtime-details">
          <summary>{k("details")}</summary>
          <p>
            {k("engine")} · {k("node")}
          </p>
          <small>
            {view.runtime.id}
            {view.runtime.version ? ` · ${view.runtime.version}` : ""}
          </small>
        </details>
      )}
      {updatedAt && (
        <p className="muted small">
          {k("updated", { time: formatDateTime(updatedAt) })}
        </p>
      )}
    </div>
  );
}

function WorkerRow({ task, names }: { task: WorkerTask; names: Names }) {
  const t = useTranslation(botHomeMessages);
  const doing = [task.doing?.tool, task.doing?.target]
    .filter(Boolean)
    .join(" ");
  return (
    <li className="bot-work-item" data-task-id={task.taskId}>
      <strong>{task.title || task.taskId}</strong>
      <small className="muted">
        {[
          task.requesterId &&
            t("askedBy", { name: names.person(task.requesterId) }),
          task.roomId && t("inRoom", { room: names.room(task.roomId) }),
          task.since && t("since", { time: formatTime(task.since) }),
          task.toolCalls ? t("toolCalls", { count: task.toolCalls }) : "",
        ]
          .filter(Boolean)
          .join(" · ")}
      </small>
      {doing && <p>{t("doing", { what: doing })}</p>}
      {task.doing?.said && <p className="muted">{task.doing.said}</p>}
      {task.progress && <p className="muted">{task.progress}</p>}
    </li>
  );
}

/** Reads one page from the Bot's node; offline and unsupported nodes get their own explanations. */
function usePagedRead<T>(api: Api, context: string, path: string | null) {
  const [pages, setPages] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const current = useRef("");
  const t = useTranslation(botHomeMessages);
  const load = useCallback(
    (query: string, append: boolean) => {
      if (!path) return;
      const key = `${context}|${path}`;
      current.current = key;
      setLoading(true);
      setError("");
      void api<T>(`${path}${query}`)
        .then((page) => {
          if (current.current !== key) return;
          setPages((previous) => (append ? [...previous, page] : [page]));
        })
        .catch((cause) => {
          if (current.current !== key) return;
          const code = cause instanceof ApiError ? cause.code : "";
          setError(
            code === "BOT_OFFLINE"
              ? t("offlineHelp")
              : code === "KERNEL_CONTROL_UNAVAILABLE" ||
                  (cause instanceof ApiError &&
                    cause.code === "" &&
                    cause.status === 404)
                ? t("unsupportedRead")
                : t("readFailed", { error: messageOf(cause) }),
          );
        })
        .finally(() => {
          if (current.current === key) setLoading(false);
        });
    },
    [api, context, path, t],
  );
  useEffect(() => {
    setPages([]);
    load("", false);
    return () => {
      current.current = "";
    };
  }, [load]);
  return { pages, loading, error, load };
}

function stageText(t: Translate, stage?: string | null) {
  const key = `${stage || "unknown"}Stage` as const;
  return key in botHomeMessages.en
    ? t(key as keyof (typeof botHomeMessages)["en"])
    : stage || t("unknownStage");
}
function statusText(t: Translate, value?: string | null) {
  return value && value in botHomeMessages.en
    ? t(value as keyof (typeof botHomeMessages)["en"])
    : value || "";
}

function describe(t: Translate, item: TimelineItem, names: Names) {
  if (item.kind === "request")
    return t("request", { name: names.person(item.peerId) });
  if (item.kind === "decision")
    return t("decisionItem", {
      action: item.action ? t(item.action) : statusText(t, item.status),
    });
  if (item.kind === "task")
    return t("taskItem", {
      title: item.title || item.taskId,
      stage: stageText(t, item.to),
    });
  return item.direction === "out"
    ? t("exchangeOut", { name: names.person(item.peerId) })
    : t("exchangeIn", { name: names.person(item.peerId) });
}
const kindIcon = {
  request: "message",
  decision: "listen",
  task: "work",
  exchange: "bot",
} as const;

function TimelinePanel({
  api,
  route,
  context,
  names,
}: {
  api: Api;
  route: string;
  context: string;
  names: Names;
}) {
  const t = useTranslation(botHomeMessages);
  const { pages, loading, error, load } = usePagedRead<TimelinePage>(
    api,
    context,
    `${route}/timeline`,
  );
  const items = pages.flatMap((page) => page.items ?? []);
  const next = pages.at(-1)?.next;
  return (
    <div data-bot-panel="timeline">
      {error && (
        <p role="alert" className="bot-settings-error">
          {error}
        </p>
      )}
      {!error && !loading && !items.length && (
        <p className="muted">{t("emptyTimeline")}</p>
      )}
      <ol className="bot-timeline">
        {items.map((item) => (
          <li key={item.id} className="bot-timeline-item" data-kind={item.kind}>
            <Icon name={kindIcon[item.kind]} />
            <div>
              <p>
                <strong>{describe(t, item, names)}</strong>
                {item.roomId && (
                  <span className="muted">
                    {" "}
                    · {t("inRoom", { room: names.room(item.roomId) })}
                  </span>
                )}
              </p>
              {item.kind === "request" && item.text && (
                <blockquote>{item.text}</blockquote>
              )}
              {item.kind === "exchange" && item.detail && (
                <p className="muted">{item.detail}</p>
              )}
              <small className="muted">
                {formatDateTime(item.at)}
                {item.kind !== "task" && item.status
                  ? ` · ${statusText(t, item.kind === "decision" ? (item.outcome ?? item.status) : item.status)}`
                  : ""}
                {item.kind === "task" && item.by ? ` · ${item.by}` : ""}
              </small>
            </div>
          </li>
        ))}
      </ol>
      {loading && <p role="status">{t("loading")}</p>}
      {!loading && next && (
        <Button
          variant="ghost"
          type="button"
          data-load-more="timeline"
          onClick={() => load(`?before=${next}`, true)}
        >
          {t("loadMore")}
        </Button>
      )}
    </div>
  );
}

function ConversationsPanel({
  api,
  route,
  context,
  names,
}: {
  api: Api;
  route: string;
  context: string;
  names: Names;
}) {
  const t = useTranslation(botHomeMessages);
  const [contact, setContact] = useState<string | null>(null);
  const path = `${route}/contacts${contact ? `?contact=${encodeURIComponent(contact)}` : ""}`;
  const { pages, loading, error, load } = usePagedRead<ContactsPage>(
    api,
    context,
    path,
  );
  const [everyone, setEveryone] = useState<ContactsPage["contacts"]>([]);
  useEffect(() => {
    if (!contact && pages[0]) setEveryone(pages[0].contacts ?? []);
  }, [contact, pages]);
  const exchanges = pages.flatMap((page) => page.exchanges ?? []);
  const next = pages.at(-1)?.next;
  const join = contact ? "&" : "?";
  return (
    <div data-bot-panel="conversations">
      {error && (
        <p role="alert" className="bot-settings-error">
          {error}
        </p>
      )}
      <div
        className="bot-contact-list"
        role="group"
        aria-label={t("conversations")}
      >
        <Button
          variant="ghost"
          size="sm"
          type="button"
          aria-pressed={!contact}
          onClick={() => setContact(null)}
        >
          {t("allContacts")}
        </Button>
        {everyone.map((person) => (
          <Button
            key={person.id}
            variant="ghost"
            size="sm"
            type="button"
            data-contact-id={person.id}
            aria-pressed={contact === person.id}
            title={person.id}
            onClick={() => setContact(person.id)}
          >
            <span
              className={`avatar${person.kind === "bot" ? " avatar-bot" : ""}`}
              aria-hidden="true"
            >
              {(person.name || person.id).slice(0, 1)}
            </span>
            <span className="bot-contact-name">
              <strong>{person.name || names.person(person.id)}</strong>
              <small className="muted">
                {[
                  person.lastExchangeAt &&
                    t("lastExchange", {
                      time: formatDateTime(person.lastExchangeAt),
                    }),
                  person.rooms?.length
                    ? t("sharedRooms", { count: person.rooms.length })
                    : "",
                  person.reach ? t("reachable") : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </small>
            </span>
          </Button>
        ))}
      </div>
      {!error && !loading && !everyone.length && !contact && (
        <p className="muted">{t("noContacts")}</p>
      )}
      <h3>{t("exchanges")}</h3>
      {!error && !loading && !exchanges.length && (
        <p className="muted">{t("noExchanges")}</p>
      )}
      <ol className="bot-timeline">
        {exchanges.map((exchange) => (
          <li
            key={exchange.id}
            className="bot-timeline-item"
            data-kind="exchange"
          >
            <Icon name="bot" />
            <div>
              <p>
                <strong>
                  {exchange.direction === "out"
                    ? t("exchangeOut", { name: names.person(exchange.peerId) })
                    : t("exchangeIn", { name: names.person(exchange.peerId) })}
                </strong>
                {exchange.roomId && (
                  <span className="muted">
                    {" "}
                    · {t("inRoom", { room: names.room(exchange.roomId) })}
                  </span>
                )}
              </p>
              {exchange.detail && <p className="muted">{exchange.detail}</p>}
              <small className="muted">
                {formatDateTime(exchange.at)}
                {exchange.status ? ` · ${statusText(t, exchange.status)}` : ""}
              </small>
            </div>
          </li>
        ))}
      </ol>
      {loading && <p role="status">{t("loading")}</p>}
      {!loading && next && (
        <Button
          variant="ghost"
          type="button"
          onClick={() => load(`${join}before=${next}`, true)}
        >
          {t("loadMore")}
        </Button>
      )}
    </div>
  );
}

function MemoryChangesPanel({
  api,
  route,
  context,
}: {
  api: Api;
  route: string;
  context: string;
}) {
  const t = useTranslation(botHomeMessages);
  const { pages, loading, error, load } = usePagedRead<MemoryChangesPage>(
    api,
    context,
    `${route}/memory/changes`,
  );
  const rows = pages.flatMap((page) => page.rows ?? []);
  const more = pages.at(-1)?.more;
  return (
    <section className="bot-home-section" data-bot-memory-changes>
      <h3>{t("memoryChanges")}</h3>
      {error && (
        <p role="alert" className="bot-settings-error">
          {error}
        </p>
      )}
      {!error && !loading && !rows.length && (
        <p className="muted">{t("noChanges")}</p>
      )}
      <ol className="bot-timeline">
        {rows.map((row) => (
          <li key={row.id} className="bot-timeline-item" data-op={row.op}>
            <Icon name="memory" />
            <div>
              <p>
                <strong>
                  {row.op && row.op in botHomeMessages.en
                    ? t(row.op as "add")
                    : row.op}
                </strong>{" "}
                {row.text}
              </p>
              <small className="muted">
                {[
                  row.time && formatDateTime(Date.parse(row.time)),
                  row.by === "user"
                    ? t("byUser")
                    : row.by
                      ? t("by", { name: row.by })
                      : "",
                  row.restored ? t("restored") : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </small>
            </div>
          </li>
        ))}
      </ol>
      {loading && <p role="status">{t("loading")}</p>}
      {!loading && more && (
        <Button
          variant="ghost"
          type="button"
          onClick={() => load(`?before=${encodeURIComponent(more)}`, true)}
        >
          {t("loadMore")}
        </Button>
      )}
    </section>
  );
}

function Participation({
  api,
  route,
  context,
  view,
  loading,
  locked: unavailable,
  onView,
}: {
  api: Api;
  route: string;
  context: string;
  view: BotKernelView | null;
  loading: boolean;
  locked: boolean;
  onView(
    update: (previous: BotKernelView | null) => BotKernelView | null,
  ): void;
}) {
  const k = useTranslation(kernelMessages);
  const [mode, setMode] = useState<ParticipationMode | "">("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<
    "saved" | "pending" | "saveUncertain" | ""
  >("");
  const [uncertain, setUncertain] = useState(false);
  const current = useRef(context);
  current.current = context;
  const selected = view?.desiredAttention?.mode ?? view?.attention?.mode;
  const touched = useRef(false);
  useEffect(() => {
    touched.current = false;
    setFeedback("");
    setUncertain(false);
  }, [context]);
  useEffect(() => {
    if (!touched.current)
      setMode(selected && modes.includes(selected) ? selected : "");
  }, [selected]);
  const locked = unavailable || uncertain;
  const provider = view?.attention?.provider;
  const health =
    provider?.available === true || provider?.health === "ok"
      ? "available"
      : provider?.available === false || provider?.health === "error"
        ? "unavailable"
        : "healthUnknown";

  async function save() {
    if (!view || !mode || saving || loading || locked) return;
    const operation = context;
    setSaving(true);
    setFeedback("");
    try {
      const result = await api<AttentionReceipt>(`${route}/attention`, {
        method: "PATCH",
        body: { mode },
      });
      if (current.current !== operation) return;
      if (
        result.mode !== mode ||
        !["pending", "applied"].includes(result.status)
      )
        throw new Error("Invalid participation receipt");
      touched.current = false;
      onView(
        (previous) =>
          previous && {
            ...previous,
            desiredAttention: result,
            attention:
              result.applied && previous.attention
                ? { ...previous.attention, mode: result.mode }
                : previous.attention,
          },
      );
      setFeedback(result.status === "pending" ? "pending" : "saved");
    } catch {
      if (current.current === operation) {
        setFeedback("saveUncertain");
        setUncertain(true);
      }
    } finally {
      if (current.current === operation) setSaving(false);
    }
  }

  return (
    <div data-bot-panel="participation">
      <h3>{k("mode")}</h3>
      <p>
        {k("currentMode")} ·{" "}
        {k(
          view?.online !== false &&
            view?.attention?.mode &&
            modes.includes(view.attention.mode)
            ? view.attention.mode
            : "unknown",
        )}
      </p>
      {view?.desiredAttention?.status === "pending" && (
        <p role="status">{k("pending")}</p>
      )}
      <RadioGroup
        className="bot-participation-modes"
        value={mode}
        onValueChange={(value) => {
          if (modes.includes(value as ParticipationMode)) {
            touched.current = true;
            setMode(value as ParticipationMode);
            setFeedback("");
          }
        }}
        aria-label={k("mode")}
        disabled={loading || saving || !view || locked}
      >
        {modes.map((value) => (
          <label
            className="bot-mode-option"
            data-selected={mode === value}
            key={value}
          >
            <Radio
              value={value}
              disabled={loading || saving || !view || locked}
            />
            <span>
              <strong>{k(value)}</strong>
              <small>{k(`${value}Help`)}</small>
            </span>
          </label>
        ))}
      </RadioGroup>
      <p>{k("naturalNote")}</p>
      <div className="bot-decision-status">
        <h3>{k("decisionModel")}</h3>
        <p>
          <span className="bot-state-pill">
            {typeof provider?.configured === "boolean"
              ? k(provider.configured ? "configured" : "notConfigured")
              : k("unknown")}
          </span>
          {provider?.configured && (
            <span className="bot-state-pill">{k(health)}</span>
          )}
        </p>
        {provider?.model && (
          <small className="member-full-id">{provider.model}</small>
        )}
        <p>{k("decisionPrivate")}</p>
        {mode === "natural" &&
          (provider?.configured === false || health === "unavailable") && (
            <p>{k("decisionRequired")}</p>
          )}
      </div>
      <div className="settings-actions">
        <Button
          id="save-bot-participation"
          type="button"
          disabled={
            loading || saving || locked || !view || !mode || mode === selected
          }
          onClick={() => void save()}
        >
          {k(saving ? "saving" : "save")}
        </Button>
      </div>
      <p role="status" className="settings-feedback">
        {feedback && k(feedback)}
      </p>
    </div>
  );
}
