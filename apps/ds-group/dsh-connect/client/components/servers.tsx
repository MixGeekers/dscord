import { useState } from "react";
import { Button, Input } from "@deepseek-ai/dsh-client-ui-primitives";
import type { ListedServer } from "../types";
import type { PageProps, ReadyProps } from "./forms";

/** The chat server's web address, when it is one a browser can open safely. */
export function webUrl(serverUrl: string) {
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

/** Searches central's server index and adds a listed server in one step. */
function ServerSearch({ connection, state, value, t }: ReadyProps) {
  const [results, setResults] = useState<ListedServer[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const added = new Set(
    (value.servers || []).map((server) => origin(server.url)),
  );
  return (
    <div className="dc-section">
      <form
        className="dc-inline"
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
      <p className={error ? "dc-error dc-small" : "dc-hint"}>
        {error ||
          (results && !results.length
            ? t("noServerResults")
            : t("searchServersHelp"))}
      </p>
      {results && results.length > 0 && (
        <ul className="dc-list" aria-label={t("searchServers")}>
          {results.map((server) => {
            const isAdded = server.added || added.has(server.origin);
            const inviteOnly = server.join === "invite" && !isAdded;
            const tags = server.tags?.length
              ? ` · ${server.tags.map((tag) => `#${tag}`).join(" ")}`
              : "";
            return (
              <li key={server.origin} className="dc-row">
                <div className="dc-copy">
                  <p className="dc-title">{server.name}</p>
                  <p className="dc-meta">{`${t("serverNumber", { number: server.number })} · ${server.origin}`}</p>
                  <p className="dc-meta">
                    {t("serverMembers", {
                      people: server.members?.people ?? 0,
                      bots: server.members?.bots ?? 0,
                    }) + tags}
                  </p>
                  {server.description && (
                    <p className="dc-meta">{server.description}</p>
                  )}
                  {inviteOnly && (
                    <p className="dc-meta">{t("inviteOnlyHint")}</p>
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

/** The chat servers this account has added; adding another, by search or by address, opens on request. */
export function ServersPanel(props: ReadyProps) {
  const { connection, state, value, t } = props;
  const busy = Boolean(state.busy);
  const servers = value.servers || [];
  return (
    <section className="dc-panel" aria-label={t("servers")}>
      <div className="dc-heading">
        <h2>{t("servers")}</h2>
        <p className="dc-muted">{t("serversHelp")}</p>
      </div>
      {servers.length ? (
        <ul className="dc-list">
          {servers.map((server) => {
            const href = webUrl(server.url);
            return (
              <li key={server.url} className="dc-row">
                <div className="dc-copy">
                  <p className="dc-title">{server.serverName}</p>
                  <p className="dc-meta">{server.url}</p>
                </div>
                <div className="dc-actions">
                  {href && (
                    <a href={href} target="_blank" rel="noopener noreferrer">
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
      ) : (
        <p className="dc-muted">{t("noServers")}</p>
      )}
      <details className="dc-disclosure dc-divided" open={!servers.length}>
        <summary>{t("addServer")}</summary>
        <div className="dc-body">
          <ServerSearch {...props} />
          <p className="dc-meta">{t("addByAddress")}</p>
          <AddServerForm connection={connection} state={state} t={t} />
        </div>
      </details>
    </section>
  );
}

function AddServerForm({ connection, state, t }: PageProps) {
  const busy = Boolean(state.busy);
  return (
    <form
      className="dc-inline"
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
        {t("inviteCode")}
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
