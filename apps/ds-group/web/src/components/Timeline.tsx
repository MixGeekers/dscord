import {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { formatDate, formatDateTime, formatTime } from "../../i18n.js";
import { displayMentionText, mentionKindsFor } from "../../mention-tokens.js";
import { useTranslation } from "../locale";
import { chatMessages } from "../locales/chat";
import type {
  ChatEvent,
  Mentionables,
  Participant,
  Role,
  RawRequest,
  Session,
} from "../types";
import { AttachmentView } from "./AttachmentView";
import { Icon } from "./Icons";
import { markdownPreview } from "../markdown";
import type { MentionToken } from "../markdown";
import { MarkdownMessage } from "./MarkdownMessage";
import type { TimelineHistory } from "../app/useTimelineHistory";
import { lastVisible, visibleEvents } from "../app/timeline-events";
import type { MentionValue } from "../../mention-editor.js";
import { MessageEditor } from "./MessageEditor";

export interface TimelineProps {
  events: ChatEvent[];
  participants: Participant[];
  session: Session | null;
  request?: RawRequest;
  mentionables: Mentionables;
  roles: Role[];
  onReply(event: ChatEvent): void;
  onMember(id: string): void;
  onRole?(): void;
  onJump(eventId: string): void;
  onRead(eventId: string): void;
  history?: TimelineHistory;
  /** The message being edited in place, if any. */
  editingId?: string | null;
  onEditing?(eventId: string | null): void;
  onEdit?(eventId: string, value: MentionValue): Promise<boolean>;
  onWithdraw?(eventId: string): Promise<boolean>;
}

/** Load the next older page once the reader is this close to the top. */
const OLDER_THRESHOLD_PX = 400;

type RenderMention = (
  token: MentionToken,
  key: string,
  roleLabels?: Record<string, string>,
) => ReactNode;

/** Memoised so scrolling and toasts do not re-parse every message. */
const MessageBody = memo(function MessageBody(props: {
  body: string;
  roleLabels?: Record<string, string>;
  renderMention: RenderMention;
}) {
  const { body, roleLabels, renderMention } = props;
  const render = useCallback(
    (token: MentionToken, key: string) => renderMention(token, key, roleLabels),
    [renderMention, roleLabels],
  );
  return <MarkdownMessage body={body} renderMention={render} />;
});

export function Timeline(props: TimelineProps) {
  const t = useTranslation(chatMessages);
  const container = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const latestProps = useRef(props);
  latestProps.current = props;
  const [showJump, setShowJump] = useState(false);
  const [unreadAbove, setUnreadAbove] = useState(false);
  const positioned = useRef(false);
  const snapshot = useRef<{ first?: string; height: number; top: number }>({
    height: 0,
    top: 0,
  });
  const history = props.history;
  const shown = useMemo(() => visibleEvents(props.events), [props.events]);
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const [confirmWithdraw, setConfirmWithdraw] = useState<string | null>(null);
  const unreadEventId = history?.unreadEventId ?? null;
  const [copyStatus, setCopyStatus] = useState("");
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const roleList = useMemo(
    () => [
      ...new Map(
        [...props.roles, ...props.mentionables.roles].map((role) => [
          role.id,
          role,
        ]),
      ).values(),
    ],
    [props.roles, props.mentionables.roles],
  );
  const hasRoleAction = Boolean(props.onRole);
  const renderMention = useCallback<RenderMention>(
    (token, key, roleLabels = {}) => {
      const className = `mention-tag mention-${token.kind}`;
      if (token.kind === "user" && token.id) {
        const id = token.id;
        const name =
          props.participants.find((person) => person.id === id)?.name ??
          id.split(":")[0]?.replace(/^@/, "") ??
          id;
        return (
          <button
            key={key}
            className={className}
            type="button"
            onClick={() => latestProps.current.onMember(id)}
          >
            @{name}
          </button>
        );
      }
      if (token.kind === "role" && token.id) {
        const label =
          roleList.find((role) => role.id === token.id)?.name ??
          roleLabels[token.id] ??
          t("role");
        return hasRoleAction ? (
          <button
            key={key}
            className={className}
            type="button"
            onClick={() => latestProps.current.onRole?.()}
          >
            @{label}
          </button>
        ) : (
          <span key={key} className={className}>
            @{label}
          </span>
        );
      }
      return (
        <span key={key} className={className}>
          @{token.kind}
        </span>
      );
    },
    [props.participants, roleList, hasRoleAction, t],
  );

  function displayName(id: string) {
    return (
      props.participants.find((person) => person.id === id)?.name ??
      id.split(":")[0]?.replace(/^@/, "") ??
      id
    );
  }

  function readLatest() {
    // Edits and withdrawn messages are not read markers; the newest shown message is.
    const latest = lastVisible(shownRef.current);
    if (
      latest &&
      nearBottom.current &&
      !document.hidden &&
      latestProps.current.session
    )
      latestProps.current.onRead(latest.event_id);
  }

  function unreadDivider() {
    return container.current?.querySelector<HTMLElement>(".unread-separator");
  }

  /** The banner shows while the first unread message is above the viewport or not loaded yet. */
  function updateUnread() {
    const element = container.current;
    if (!element || !latestProps.current.history?.unreadEventId) {
      setUnreadAbove(false);
      return;
    }
    const divider = unreadDivider();
    setUnreadAbove(
      !divider ||
        divider.getBoundingClientRect().bottom <
          element.getBoundingClientRect().top,
    );
  }

  function remember() {
    const element = container.current;
    if (!element) return;
    snapshot.current = {
      first: latestProps.current.events[0]?.event_id,
      height: element.scrollHeight,
      top: element.scrollTop,
    };
  }

  function loadOlderIfNear() {
    const element = container.current;
    const older = latestProps.current.history;
    if (
      element &&
      older?.hasOlder &&
      !older.loadingOlder &&
      element.scrollTop < OLDER_THRESHOLD_PX
    )
      void older.loadOlder();
  }

  function onScroll() {
    const element = container.current;
    if (!element) return;
    nearBottom.current =
      element.scrollHeight - element.scrollTop - element.clientHeight < 100;
    setShowJump(!nearBottom.current);
    readLatest();
    remember();
    updateUnread();
    loadOlderIfNear();
  }

  function jumpToUnread() {
    const divider = unreadDivider();
    if (divider) divider.scrollIntoView({ block: "start", behavior: "smooth" });
    else if (unreadEventId) props.onJump(unreadEventId);
  }

  function markAllRead() {
    history?.dismissUnread();
    const latest = lastVisible(shown);
    if (latest && props.session) props.onRead(latest.event_id);
  }

  function scrollToBottom() {
    const element = container.current;
    if (!element) return;
    nearBottom.current = true;
    element.scrollTop = element.scrollHeight;
    setShowJump(false);
    readLatest();
  }

  useLayoutEffect(() => {
    const element = container.current;
    if (!element) return;
    const first = props.events[0]?.event_id;
    const previous = snapshot.current;
    if (!positioned.current && props.events.length) {
      // Open at the first unread message when it is loaded, otherwise at the latest.
      positioned.current = true;
      const divider = unreadDivider();
      if (divider) {
        divider.scrollIntoView({ block: "start" });
        nearBottom.current =
          element.scrollHeight - element.scrollTop - element.clientHeight < 100;
        setShowJump(!nearBottom.current);
        readLatest();
      } else scrollToBottom();
    } else if (nearBottom.current) scrollToBottom();
    else if (previous.first && first !== previous.first)
      // Older messages were added above: keep the reader's place.
      element.scrollTop = previous.top + element.scrollHeight - previous.height;
    remember();
    updateUnread();
    // Short rooms never scroll, so fetch older pages until the view fills or history ends.
    loadOlderIfNear();
    // The helpers read the latest props through refs.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [props.events, history?.hasOlder, history?.loadingOlder, unreadEventId]);

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      if (nearBottom.current) scrollToBottom();
    });
    if (list.current) observer.observe(list.current);
    const visible = () => readLatest();
    document.addEventListener("visibilitychange", visible);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", visible);
      clearTimeout(copyTimer.current);
    };
  }, []);

  async function copy(body: string) {
    try {
      await navigator.clipboard.writeText(
        displayMentionText(body, props.participants, roleList),
      );
      setCopyStatus(t("copied"));
    } catch {
      setCopyStatus(t("copyFailed"));
    }
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopyStatus(""), 3000);
  }

  return (
    <>
      <div
        id="timeline"
        ref={container}
        className="timeline"
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        onScroll={onScroll}
      >
        {unreadEventId && unreadAbove && (
          // A zero-height sticky dock, so showing the banner never shifts the messages.
          <div className="unread-banner-dock">
            <div className="unread-banner">
              <button
                className="unread-banner-jump"
                type="button"
                onClick={jumpToUnread}
              >
                <span>
                  {t("unreadSince", { count: history?.unreadCount ?? 0 })}
                </span>
                <span className="unread-banner-action">{t("jumpUnread")}</span>
              </button>
              <button
                className="unread-banner-read"
                type="button"
                onClick={markAllRead}
              >
                {t("markRead")}
              </button>
            </div>
          </div>
        )}
        {!shown.length && (
          <div id="empty-state" className="empty-state">
            <h2>{t("empty")}</h2>
            {!props.session && <p id="empty-description">{t("signedOut")}</p>}
          </div>
        )}
        {history?.loadingOlder && (
          <div className="history-status" role="status">
            {t("loadingOlder")}
          </div>
        )}
        {history?.atStart && shown.length > 0 && (
          <div className="history-status">{t("historyStart")}</div>
        )}
        <div id="message-list" ref={list}>
          {shown.map((event, index) => {
            const previous = shown[index - 1];
            const day = formatDate(event.origin_server_ts);
            const sameDay =
              previous && formatDate(previous.origin_server_ts) === day;
            const metadata = event.content["org.ds_group"];
            const quoteId =
              metadata?.replyTo ??
              event.content["m.relates_to"]?.["m.in_reply_to"]?.event_id;
            const unreadStart = event.event_id === unreadEventId;
            const grouped =
              !unreadStart &&
              sameDay &&
              previous.sender === event.sender &&
              !quoteId &&
              event.origin_server_ts - previous.origin_server_ts < 300000;
            const person = props.participants.find(
              (member) => member.id === event.sender,
            );
            const name = displayName(event.sender);
            const quote = shown.find((item) => item.event_id === quoteId);
            const attachments = metadata?.attachments ?? [];
            const showBody =
              event.content.body &&
              !attachments.some((file) => file.name === event.content.body);
            const mentioned =
              event.sender !== props.session?.user_id &&
              mentionKindsFor(event, props.session?.user_id).length > 0;
            const own = event.sender === props.session?.user_id;
            const editing =
              props.editingId === event.event_id && !event.withdrawn;
            const className = `message ${person?.kind === "bot" ? "bot" : "human"}${grouped ? " grouped" : ""}${mentioned ? " mentioned" : ""}`;
            return (
              <Fragment key={event.event_id}>
                {!sameDay && <div className="date-separator">{day}</div>}
                {unreadStart && (
                  <div className="unread-separator" role="separator">
                    <span>{t("newMessages")}</span>
                  </div>
                )}
                <article className={className} data-event-id={event.event_id}>
                  <button
                    className="message-avatar-button"
                    type="button"
                    aria-label={t("profile", { name })}
                    onClick={() => props.onMember(event.sender)}
                  >
                    <span
                      className={`avatar avatar-${person?.kind === "bot" ? "bot" : "human"}${props.participants.findIndex((member) => member.id === event.sender) % 2 ? " avatar-alternate" : ""}`}
                    >
                      {[...name][0]}
                    </span>
                  </button>
                  <div className="message-content">
                    <div className="message-meta">
                      <button
                        className="message-name"
                        type="button"
                        onClick={() => props.onMember(event.sender)}
                      >
                        {name}
                      </button>
                      {person?.kind === "bot" && (
                        <span className="message-kind">BOT</span>
                      )}
                      <time
                        className="message-time"
                        title={formatDateTime(event.origin_server_ts)}
                      >
                        {formatTime(event.origin_server_ts)}
                      </time>
                    </div>
                    {quoteId && (
                      <button
                        className="message-quote"
                        type="button"
                        onClick={() => props.onJump(quoteId)}
                      >
                        <Icon name="reply" />
                        <span>
                          {quote
                            ? `${displayName(quote.sender)}　${markdownPreview(displayMentionText(quote.content.body, props.participants, roleList))}`
                            : t("previous")}
                        </span>
                      </button>
                    )}
                    {event.withdrawn ? (
                      <div className="message-withdrawn">
                        {t("withdrawnMessage")}
                      </div>
                    ) : editing && props.onEdit ? (
                      <MessageEditor
                        body={event.content.body}
                        mentionables={props.mentionables}
                        onSave={(value) => props.onEdit!(event.event_id, value)}
                        onCancel={() => props.onEditing?.(null)}
                      />
                    ) : (
                      showBody && (
                        <div className="message-bubble">
                          <MessageBody
                            body={event.content.body}
                            roleLabels={metadata?.mentions?.roleLabels}
                            renderMention={renderMention}
                          />
                        </div>
                      )
                    )}
                    {event.edited && !event.withdrawn && !editing && (
                      <span
                        className="message-edited"
                        title={t("editedAt", {
                          time: formatDateTime(event.edited),
                        })}
                      >
                        {t("edited")}
                      </span>
                    )}
                    {confirmWithdraw === event.event_id && (
                      <div className="message-confirm" role="group">
                        <span>{t("confirmWithdraw")}</span>
                        <button
                          type="button"
                          className="message-editor-button"
                          onClick={() => setConfirmWithdraw(null)}
                        >
                          {t("cancel")}
                        </button>
                        <button
                          type="button"
                          className="message-editor-button danger"
                          onClick={() => {
                            setConfirmWithdraw(null);
                            void props.onWithdraw?.(event.event_id);
                          }}
                        >
                          {t("withdraw")}
                        </button>
                      </div>
                    )}
                    {!event.withdrawn && attachments.length > 0 && (
                      <div className="message-attachments">
                        {attachments.map((attachment) => (
                          <AttachmentView
                            key={attachment.id}
                            attachment={attachment}
                            session={props.session}
                            request={props.request}
                            roomId={event.room_id}
                            eventId={event.event_id}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="message-actions" hidden={event.withdrawn}>
                    {own && props.onEdit && !event.withdrawn && (
                      <button
                        className="message-action"
                        type="button"
                        title={t("edit")}
                        aria-label={t("edit")}
                        onClick={() => {
                          setConfirmWithdraw(null);
                          props.onEditing?.(event.event_id);
                        }}
                      >
                        <Icon name="edit" />
                      </button>
                    )}
                    <button
                      className="message-action"
                      type="button"
                      title={t("reply")}
                      aria-label={t("replyNamed", { name })}
                      onClick={() => props.onReply(event)}
                    >
                      <Icon name="reply" />
                    </button>
                    <button
                      className="message-action"
                      type="button"
                      title={t("copy")}
                      aria-label={t("copy")}
                      onClick={() => void copy(event.content.body)}
                    >
                      <Icon name="copy" />
                    </button>
                    {own && props.onWithdraw && !event.withdrawn && (
                      <button
                        className="message-action danger"
                        type="button"
                        title={t("withdraw")}
                        aria-label={t("withdraw")}
                        onClick={() => {
                          props.onEditing?.(null);
                          setConfirmWithdraw(event.event_id);
                        }}
                      >
                        <Icon name="trash" />
                      </button>
                    )}
                  </div>
                </article>
              </Fragment>
            );
          })}
        </div>
      </div>
      <button
        id="jump-latest"
        className="jump-latest"
        type="button"
        hidden={!showJump}
        onClick={scrollToBottom}
      >
        {t("latest")} <Icon name="arrowDown" />
      </button>
      {copyStatus && (
        <div className="toast" role="status">
          {copyStatus}
        </div>
      )}
    </>
  );
}
