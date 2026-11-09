import { useState } from "react";
import { Button, Input } from "@deepseek-ai/dsh-client-ui-primitives";
import type { MessageKey } from "../locale";
import type { BotStatus, ListedServer, ServerBot } from "../types";
import { ModelForm } from "./forms";
import type { PageProps, ReadyProps } from "./forms";

const STATUS_KEYS: Record<BotStatus, MessageKey> = {
  offline: "statusOffline",
  connecting: "statusConnecting",
  online: "statusOnline",
  error: "statusError",
};

/** The chat server's web address, when it is one a browser can open safely. */
function webUrl(serverUrl: string) {
  try {
    const url = new URL(serverUrl);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}

function origin(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

/** One Bot account on a chat server: its status, connect actions, the local Bot it runs as, and its model. */
export function BotRow({
  bot,
  connection,
  state,
  value,
  t,
}: ReadyProps & { bot: ServerBot }) {
  const [nativeId, setNativeId] = useState("");
  const needsBinding = value.nativeMode && !bot.nativeBotId;
  const busy = state.busy?.botId === bot.id;
  const status = bot.status || "offline";
  const connected =
    bot.connected || status === "online" || status === "connecting";
  const disabled = Boolean(state.busy);
  const runtimeAvailable = value.runtime?.available !== false;
  const name = bot.name || bot.id;
  const catalog = value.models;
  const nextModel = bot.modelSelection || catalog?.defaultSelection;
  const modelAvailable =
    catalog?.available !== true ||
    catalog.providers.some((provider) =>
      provider.models.some((model) => model.model === nextModel?.model),
    );
  const blocked = disabled || !runtimeAvailable || !modelAvailable;
  const unbound = (value.nativeBots || []).filter(
    (local) => !value.bots.some((item) => item.nativeBotId === local.id),
  );
  return (
    <li className="dc-bot">
      <div className="dc-bot-identity">
        <span className="dc-avatar" aria-hidden>
          {Array.from(name)[0]}
        </span>
        <div className="dc-bot-copy">
          <p className="dc-bot-name">{name}</p>
          <p className="dc-bot-id">{bot.localpart || bot.id}</p>
          <p className="dc-status" data-status={status}>
            {STATUS_KEYS[status] ? t(STATUS_KEYS[status]) : status}
          </p>
          {bot.activeModel && (
            <p className="dc-muted dc-model-info">{`${t("activeModel")} · ${bot.activeModel.model}`}</p>
          )}
          {nextModel && (
            <p className="dc-muted dc-model-info">{`${t("nextModel")} · ${nextModel.model}`}</p>
          )}
          {!modelAvailable && (
            <p className="dc-error dc-bot-error">{t("modelUnavailable")}</p>
          )}
          {bot.lastError && (
            <p className="dc-error dc-bot-error">{bot.lastError}</p>
          )}
        </div>
      </div>
      {needsBinding ? (
        <form
          className="dc-model-form"
          onSubmit={(event) => {
            event.preventDefault();
            void connection.attach(nativeId, bot.id);
          }}
        >
          <label className="dc-field">
            {t("bind")}
            <select
              value={nativeId}
              onChange={(event) => setNativeId(event.target.value)}
              disabled={disabled}
            >
              <option value="">{t("chooseNative")}</option>
              {unbound.map((local) => (
                <option key={local.id} value={local.id}>
                  {local.name}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="submit"
            variant="primary"
            disabled={disabled || !nativeId}
          >
            {t("bind")}
          </Button>
        </form>
      ) : (
        <div className="dc-actions">
          {connected ? (
            <Button
              variant="outline"
              type="button"
              disabled={disabled}
              onClick={() => void connection.disconnect(bot.id)}
              aria-label={t("disconnectBot", { name })}
            >
              {t(
                busy && state.busy?.action === "disconnect"
                  ? "disconnecting"
                  : "disconnect",
              )}
            </Button>
          ) : (
            <Button
              variant="primary"
              type="button"
              className="dc-primary"
              disabled={blocked}
              onClick={() => void connection.connect(bot.id)}
              aria-label={t("connectBot", { name })}
            >
              {t(busy ? "connecting" : "connect")}
            </Button>
          )}
          {(connected || status === "error") && (
            <Button
              variant="outline"
              type="button"
              disabled={blocked}
              onClick={() => void connection.reconnect(bot.id)}
              aria-label={t("reconnectBot", { name })}
            >
              {t(
                busy && state.busy?.action === "reconnect"
                  ? "reconnecting"
                  : "reconnect",
              )}
            </Button>
          )}
        </div>
      )}
      {!needsBinding && catalog?.available && (
        <ModelForm
          key={JSON.stringify(bot.modelSelection)}
          bot={bot}
          connection={connection}
          state={state}
          value={value}
          t={t}
        />
      )}
    </li>
  );
}

/** Searches central's server index and adds a listed server in one step. */
function ServerSearch({ connection, state, value, t }: ReadyProps) {
  const [results, setResults] = useState<ListedServer[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const added = new Set(
    (value.servers || []).map((server) => origin(server.url)),
  );
  return (
    <div className="dc-server-search">
      <form
        className="dc-model-form"
        role="search"
        aria-label={t("searchServers")}
        onSubmit={(event) => {
          event.preventDefault();
          const query = (
            event.currentTarget.elements.namedItem("query") as HTMLInputElement
          ).value;
          setSearching(true);
          setError("");
          connection
            .searchServers(query)
            .then(
              (found) => setResults(found.servers),
              (reason: Error) => {
                setResults(null);
                setError(reason.message);
              },
            )
            .finally(() => setSearching(false));
        }}
      >
        <label className="dc-field">
          {t("searchServers")}
          <Input
            name="query"
            type="search"
            maxLength={200}
            autoComplete="off"
          />
        </label>
        <Button type="submit" variant="outline" disabled={searching}>
          {t(searching ? "searchingServers" : "searchQuery")}
        </Button>
      </form>
      <p className="dc-muted">
        {error ||
          (results && !results.length
            ? t("noServerResults")
            : t("searchServersHelp"))}
      </p>
      {results && results.length > 0 && (
        <ul className="dc-bots dc-server-list" aria-label={t("searchServers")}>
          {results.map((server) => {
            const isAdded = server.added || added.has(server.origin);
            const inviteOnly = server.join === "invite" && !isAdded;
            const tags = server.tags?.length
              ? ` · ${server.tags.map((tag) => `#${tag}`).join(" ")}`
              : "";
            return (
              <li key={server.origin} className="dc-bot">
                <div className="dc-bot-copy">
                  <strong>{server.name}</strong>
                  <p className="dc-server">{`${t("serverNumber", { number: server.number })} · ${server.origin}`}</p>
                  <p className="dc-muted">
                    {t("serverMembers", {
                      people: server.members?.people ?? 0,
                      bots: server.members?.bots ?? 0,
                    }) + tags}
                  </p>
                  {server.description && (
                    <p className="dc-muted">{server.description}</p>
                  )}
                  {inviteOnly && (
                    <p className="dc-muted">{t("inviteOnlyHint")}</p>
                  )}
                </div>
                <Button
                  variant="outline"
                  type="button"
                  disabled={isAdded || inviteOnly || Boolean(state.busy)}
                  aria-label={t("addServerLabel", { server: server.name })}
                  onClick={() => void connection.addServer(server.origin)}
                >
                  {t(
                    isAdded
                      ? "serverAdded"
                      : inviteOnly
                        ? "inviteOnly"
                        : "addThisServer",
                  )}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** The chat servers this account has added, with search and add-by-address. */
export function ServersPanel(props: ReadyProps) {
  const { connection, state, value, t } = props;
  const busy = Boolean(state.busy);
  return (
    <section className="dc-panel" aria-label={t("servers")}>
      <h2>{t("servers")}</h2>
      <p className="dc-muted">{t("serversHelp")}</p>
      <ul className="dc-bots dc-server-list">
        {(value.servers || []).map((server) => {
          const href = webUrl(server.url);
          return (
            <li key={server.url} className="dc-bot">
              <div className="dc-bot-copy">
                <strong>{server.serverName}</strong>
                <p className="dc-server">{server.url}</p>
              </div>
              <div className="dc-toolbar">
                {href && (
                  <a
                    className="dc-link"
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t("openWeb")}
                  </a>
                )}
                <Button
                  variant="outline"
                  type="button"
                  disabled={busy}
                  onClick={() => void connection.removeServer(server.url)}
                  aria-label={t("removeServerLabel", {
                    server: server.serverName,
                  })}
                >
                  {t("removeServer")}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <ServerSearch {...props} />
      <AddServerForm connection={connection} state={state} t={t} />
    </section>
  );
}

function AddServerForm({ connection, state, t }: PageProps) {
  const busy = Boolean(state.busy);
  return (
    <form
      className="dc-model-form"
      aria-label={t("addServer")}
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const input = form.elements.namedItem("serverUrl") as HTMLInputElement;
        const invite = form.elements.namedItem(
          "inviteCode",
        ) as HTMLInputElement;
        const url = input.value.trim();
        if (!url) return;
        const code = invite.value.trim();
        input.value = "";
        invite.value = "";
        void connection.addServer(url, code);
      }}
    >
      <label className="dc-field">
        {t("serverUrl")}
        <Input
          name="serverUrl"
          type="url"
          required
          placeholder="https://chat.example.com"
          autoComplete="url"
          disabled={busy}
        />
      </label>
      <label className="dc-field">
        {t("inviteCodeOptional")}
        <Input
          name="inviteCode"
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={20}
          placeholder="ABCD-2345"
          disabled={busy}
        />
      </label>
      <Button type="submit" variant="outline" disabled={busy}>
        {t(state.busy?.action === "add-server" ? "addingServer" : "addServer")}
      </Button>
    </form>
  );
}
