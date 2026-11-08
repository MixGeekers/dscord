import { Button, Input } from "../../../ui/controls";
import { useEffect, useRef, useState } from "react";
import { ApiError, messageOf } from "../api";
import { searchServers } from "../central";
import type { ListedServer } from "../central";
import type { CollaborationSpace } from "../spaces";
import { useTranslation } from "../locale";
import { spaceMessages } from "../locales/spaces";
import { Icon } from "./Icons";
import type { Api, Session } from "../types";

export function SpacesDialog(props: {
  open: boolean;
  spaces: CollaborationSpace[];
  selectedServer: string | null;
  api: Api;
  session: Session | null;
  centralIssuer: string | null;
  onClose(): void;
  onServer(name: string): void;
  onChanged(): void;
  onJoined(roomId: string): void;
  onRoles?(): void;
}) {
  const t = useTranslation(spaceMessages);
  const dialog = useRef<HTMLDialogElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const discovery = useRef<AbortController | null>(null);
  const [query, setQuery] = useState("");
  const [roomId, setRoomId] = useState("");
  const [feedback, setFeedback] = useState("");
  const [found, setFound] = useState<ListedServer[] | null>(null);
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (props.open && !dialog.current?.open) dialog.current?.showModal();
    if (!props.open) {
      dialog.current?.close();
      discovery.current?.abort();
    }
    setFeedback("");
    setFound(null);
    setSearchError("");
  }, [props.open, props.session]);
  useEffect(() => () => discovery.current?.abort(), []);
  async function search() {
    const issuer = props.centralIssuer;
    if (!issuer) return;
    discovery.current?.abort();
    const controller = new AbortController();
    discovery.current = controller;
    setSearching(true);
    setSearchError("");
    try {
      const servers = await searchServers(issuer, query);
      if (!controller.signal.aborted) setFound(servers);
    } catch (reason) {
      if (!controller.signal.aborted) {
        setFound(null);
        setSearchError(messageOf(reason));
      }
    } finally {
      if (discovery.current === controller) setSearching(false);
    }
  }
  async function act(id: string, action: "join" | "leave") {
    if (busy || !props.session) return;
    const account = props.session;
    setBusy(true);
    setFeedback(t("pending"));
    try {
      const result = await props.api<{ roomId: string; status: string }>(
        `/api/rooms/${encodeURIComponent(id)}/${action}`,
        { method: "POST", body: {} },
      );
      if (latest.current.session !== account) return;
      props.onChanged();
      if (
        result.roomId !== id ||
        result.status !== (action === "join" ? "joined" : "left")
      ) {
        setFeedback(t("uncertain"));
        return;
      }
      setFeedback(
        t(action === "join" ? "joinedResult" : "leftResult", { room: id }),
      );
      if (action === "join" && latest.current.open) props.onJoined(id);
    } catch (reason) {
      if (latest.current.session !== account) return;
      props.onChanged();
      setFeedback(
        reason instanceof ApiError &&
          reason.status >= 400 &&
          reason.status < 500
          ? t("rejected", { error: messageOf(reason) })
          : `${t("uncertain")} ${messageOf(reason)}`,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      id="spaces-dialog"
      className="settings-dialog spaces-dialog"
      ref={dialog}
      aria-labelledby="spaces-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) props.onClose();
      }}
    >
      <header className="dialog-heading">
        <h2 id="spaces-title">{t("spaces")}</h2>
        <Button
          variant="ghost"
          size="icon"
          className="icon-button"
          type="button"
          disabled={busy}
          aria-label={t("close")}
          onClick={props.onClose}
        >
          <Icon name="close" />
        </Button>
      </header>
      <div className="dialog-scroll-region">
        <div className="space-list">
          {!props.spaces.length && <p className="muted">{t("noSpaces")}</p>}
          {props.spaces.map((space) => (
            <section
              className="space-card"
              key={space.serverName}
              data-space={space.serverName}
            >
              <header>
                <div>
                  <strong>{space.name}</strong>
                  <small className="member-full-id">{space.serverName}</small>
                </div>
                <span className={`space-state space-${space.status}`}>
                  {t(
                    space.status === "connected" ? "accessible" : space.status,
                  )}
                </span>
                <Button
                  variant="secondary"
                  className="secondary-button"
                  type="button"
                  disabled={busy}
                  onClick={() => props.onServer(space.serverName)}
                >
                  {t(
                    space.serverName === props.selectedServer
                      ? "current"
                      : "open",
                  )}
                </Button>
              </header>
              {space.home && <span className="muted small">{t("home")}</span>}
              {space.home && props.onRoles && (
                <Button
                  variant="ghost"
                  id="home-roles-button"
                  className="text-button"
                  type="button"
                  onClick={props.onRoles}
                >
                  {t("homeRoles")}
                </Button>
              )}
              {!space.rooms.length && !space.invitations.length && (
                <p className="muted small">{t("noRooms")}</p>
              )}
              {space.rooms.map((room) => (
                <div className="space-room" key={room.roomId}>
                  <span>
                    <strong>{room.name}</strong>
                    <small className="member-full-id">{room.roomId}</small>
                  </span>
                  <span className={`space-state space-${room.status}`}>
                    {t(room.status)}
                  </span>
                  <Button
                    variant="ghost"
                    className="text-button"
                    type="button"
                    disabled={busy}
                    onClick={() => void act(room.roomId, "leave")}
                  >
                    {t("leave")}
                  </Button>
                </div>
              ))}
              {!!space.invitations.length && <h3>{t("invitations")}</h3>}
              {space.invitations.map((invite) => (
                <div
                  className="space-invitation"
                  data-invitation={invite.roomId}
                  key={invite.roomId}
                >
                  <span>
                    <strong>{invite.name}</strong>
                    <small className="member-full-id">{invite.roomId}</small>
                    <small className="member-full-id">{invite.inviterId}</small>
                  </span>
                  <span className="space-state">{t(invite.status)}</span>
                  <div className="settings-actions">
                    <Button
                      variant="default"
                      className="primary-button"
                      type="button"
                      disabled={busy || !invite.canJoin}
                      onClick={() => void act(invite.roomId, "join")}
                    >
                      {t("join")}
                    </Button>
                    <Button
                      variant="secondary"
                      className="secondary-button"
                      type="button"
                      disabled={busy}
                      onClick={() => void act(invite.roomId, "leave")}
                    >
                      {t("decline")}
                    </Button>
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
        <p className="muted small">{t("connectionNote")}</p>
        <section>
          <h3>{t("join")}</h3>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void act(roomId.trim(), "join");
            }}
          >
            <label htmlFor="join-room-id">{t("roomId")}</label>
            <Input
              id="join-room-id"
              autoComplete="off"
              required
              pattern="!\S+"
              value={roomId}
              disabled={busy}
              onChange={(event) => setRoomId(event.target.value)}
              placeholder="!room:server.example"
            />
            <p className="muted small">{t("joinHelp")}</p>
            <Button
              variant="default"
              id="join-room"
              className="primary-button"
              type="submit"
              disabled={busy || !props.session}
            >
              {t(busy ? "joining" : "join")}
            </Button>
          </form>
        </section>
        <p id="space-feedback" className="settings-feedback" role="status">
          {feedback}
        </p>
        {props.centralIssuer && (
          <section>
            <h3>{t("discover")}</h3>
            <form
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                void search();
              }}
            >
              <label htmlFor="server-search">{t("search")}</label>
              <Input
                id="server-search"
                type="search"
                autoComplete="off"
                maxLength={200}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("searchPlaceholder")}
              />
              <Button
                variant="secondary"
                id="search-servers"
                className="secondary-button"
                type="submit"
                disabled={searching}
              >
                {t(searching ? "searching" : "search")}
              </Button>
            </form>
            <p id="server-feedback" className="settings-feedback" role="status">
              {searchError || (found && !found.length ? t("noResults") : "")}
            </p>
            {!!found?.length && (
              <ul id="server-results" className="space-list listed-servers">
                {found.map((server) => (
                  <li
                    key={server.origin}
                    className="space-card listed-server"
                    data-server={server.origin}
                  >
                    <div>
                      <strong>{server.name}</strong>
                      <span className="muted small">
                        {new URL(server.origin).host} ·{" "}
                        {t("people", { count: server.members.people })} ·{" "}
                        {t("bots", { count: server.members.bots })}
                      </span>
                      {server.description && (
                        <span className="small">{server.description}</span>
                      )}
                      {!!server.tags.length && (
                        <span className="muted small">
                          {server.tags.map((tag) => `#${tag}`).join(" ")}
                        </span>
                      )}
                    </div>
                    <a
                      className="ds-button ds-button-secondary"
                      href={server.origin}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t("openServer")}
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <p className="muted small">
              {t("discoveryHelp", {
                central: new URL(props.centralIssuer).host,
              })}
            </p>
          </section>
        )}
      </div>
      <footer className="dialog-footer">
        <Button
          variant="secondary"
          id="refresh-spaces"
          className="secondary-button"
          type="button"
          disabled={busy}
          onClick={props.onChanged}
        >
          {t("refresh")}
        </Button>
      </footer>
    </dialog>
  );
}
