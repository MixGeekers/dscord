import { Fragment, useEffect, useState } from "react";
import { Button, Input } from "@deepseek-ai/dsh-client-ui-primitives";
import type { Connection } from "../connection";
import type { MessageKey, Translate } from "../locale";
import type {
  AttentionMode,
  DecisionProvider,
  KernelState,
  KernelUpdates,
  MemoryProfile,
  MemorySource,
  NativeBot,
} from "../types";
import { CreateLocalBot } from "./forms";
import type { ReadyProps } from "./forms";

type Feedback = { ok: true; pending?: boolean } | { error: string } | null;
const message = (reason: unknown) => (reason as Error).message;
const MEMORY_SECTIONS = [
  "currentClaims",
  "preferences",
  "projectFacts",
  "changes",
] as const;
const ACTIVITIES = ["listening", "waiting", "working", "speaking"];
const MODES: AttentionMode[] = ["mention", "shadow", "natural"];

function FeedbackLine({ feedback, ok }: { feedback: Feedback; ok: string }) {
  if (!feedback) return null;
  const error = "error" in feedback ? feedback.error : null;
  return (
    <p
      role={error ? "alert" : "status"}
      className={error ? "dc-error dc-model-info" : "dc-model-info"}
    >
      {error || ok}
    </p>
  );
}

/** The private key for the natural-participation decision service; a saved key is never shown again. */
function DecisionProviderForm({
  connection,
  provider,
  onSaved,
  t,
}: {
  connection: Connection;
  provider: DecisionProvider | null;
  onSaved: (provider: DecisionProvider) => void;
  t: Translate;
}) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [enabled, setEnabled] = useState(provider?.enabled !== false);
  useEffect(() => {
    setEnabled(provider?.enabled !== false);
  }, [provider?.enabled]);
  return (
    <details className="dc-private">
      <summary>{t("decisionTitle")}</summary>
      <p className="dc-muted dc-model-info">
        {provider
          ? `${t(provider.configured ? "configured" : "notConfigured")} · ${t(
              provider.available === true
                ? "available"
                : provider.available === false
                  ? "serviceUnavailable"
                  : "availabilityUnknown",
            )}`
          : t("unknown")}
      </p>
      {provider?.model && (
        <p className="dc-muted dc-model-info">{provider.model}</p>
      )}
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const input = event.currentTarget.elements.namedItem(
            "decisionApiKey",
          ) as HTMLInputElement;
          const apiKey = input.value.trim();
          input.value = "";
          setBusy(true);
          setFeedback(null);
          try {
            onSaved(
              await connection.kernel<DecisionProvider>(
                "save-decision-provider",
                { enabled, ...(apiKey ? { apiKey } : {}) },
              ),
            );
            setFeedback({ ok: true });
          } catch (reason) {
            setFeedback({ error: message(reason) });
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="dc-field">
          {t("decisionApiKey")}
          <Input
            name="decisionApiKey"
            type="password"
            autoComplete="new-password"
            disabled={busy}
            spellCheck={false}
            autoCapitalize="none"
          />
        </label>
        <p className="dc-muted dc-model-info">{t("decisionKeyHelp")}</p>
        <label className="dc-check">
          <input
            name="enabled"
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            disabled={busy}
          />
          {t("enableDecision")}
        </label>
        <Button type="submit" variant="outline" disabled={busy}>
          {t("saveDecision")}
        </Button>
      </form>
      <FeedbackLine feedback={feedback} ok={t("decisionSaved")} />
    </details>
  );
}

function SourceList({ sources, t }: { sources: MemorySource[]; t: Translate }) {
  return (
    <ul>
      {sources.map((source) => (
        <li key={`${source.id}/${source.revision || ""}`}>
          <strong>
            {source.authorId || source.authorKind || t("unknown")}
          </strong>
          {source.roomId && <p>{source.roomId}</p>}
          {source.timestamp != null && (
            <p>{new Date(source.timestamp).toLocaleString()}</p>
          )}
          <small>{source.eventId || source.id}</small>
        </li>
      ))}
    </ul>
  );
}

/** What one Bot remembers about people and projects, with where each claim came from. */
function LocalSourceMemory({
  connection,
  nativeBotId,
  t,
}: {
  connection: Connection;
  nativeBotId: string;
  t: Translate;
}) {
  const [kind, setKind] = useState("person");
  const [query, setQuery] = useState("");
  const [request, setRequest] = useState<Record<string, string>>({
    kind: "person",
  });
  const [result, setResult] = useState<MemoryProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setResult(null);
    void connection
      .kernel<MemoryProfile>(
        "memory-profile",
        { nativeBotId, ...request },
        controller,
      )
      .then((value) => {
        if (!controller.signal.aborted) setResult(value);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(message(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [connection, nativeBotId, request]);
  const view = result?.view;
  const filled = MEMORY_SECTIONS.filter((key) => view?.[key]?.length);
  return (
    <section className="dc-memory" aria-label={t("memory")}>
      <h3>{t("memory")}</h3>
      <form
        className="dc-memory-filter"
        onSubmit={(event) => {
          event.preventDefault();
          setRequest({
            kind,
            ...(query.trim() ? { query: query.trim() } : {}),
          });
        }}
      >
        <select
          aria-label={t("memory")}
          value={kind}
          onChange={(event) => {
            setKind(event.target.value);
            setRequest({ kind: event.target.value });
          }}
        >
          <option value="person">{t("people")}</option>
          <option value="project">{t("projects")}</option>
        </select>
        <Input
          aria-label={t("memorySearch")}
          placeholder={t("memorySearch")}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button type="submit" variant="outline" disabled={loading}>
          {t("search")}
        </Button>
      </form>
      {loading && (
        <p role="status" className="dc-muted">
          {t("loadingKernel")}
        </p>
      )}
      {error && (
        <p role="alert" className="dc-error">
          {error}
        </p>
      )}
      {result?.items && (
        <div className="dc-memory-list">
          {!result.items.length && <p className="dc-muted">{t("noMemory")}</p>}
          {result.items.map((item) => (
            <Button
              key={item.id}
              variant="outline"
              onClick={() => setRequest({ kind, id: item.id })}
            >
              {item.name || item.id}
            </Button>
          ))}
        </div>
      )}
      {view && (
        <div>
          <h3>{result.identity?.name || result.id}</h3>
          <p className="dc-bot-id">{result.id}</p>
          {filled.map((key) => (
            <section key={key}>
              <h3>{t(key)}</h3>
              {view[key]?.map((item) => (
                <article
                  className="dc-memory-item"
                  key={`${item.id}/${item.revision || ""}`}
                >
                  {item.claimState && (
                    <span className="dc-memory-label">
                      {t(item.claimState)}
                    </span>
                  )}
                  {item.kind && (
                    <span className="dc-memory-label">
                      {t(item.kind as MessageKey)}
                    </span>
                  )}
                  <p>{item.text}</p>
                  {item.saidBy && <p className="dc-muted">{item.saidBy}</p>}
                  {item.scope && <p className="dc-muted">{item.scope}</p>}
                  {item.conflicts?.length ? (
                    <p className="dc-muted">{t("conflicts")}</p>
                  ) : null}
                  <details>
                    <summary>{t("sources")}</summary>
                    {item.sources?.length ? (
                      <SourceList sources={item.sources} t={t} />
                    ) : (
                      <p>{t("noSources")}</p>
                    )}
                    <small>{item.id}</small>
                  </details>
                </article>
              ))}
            </section>
          ))}
          {!filled.length && <p className="dc-muted">{t("noMemory")}</p>}
          {view.historyGaps?.length ? (
            <p className="dc-muted dc-model-info">{t("limitedMemory")}</p>
          ) : null}
          {Object.values(view.budget?.omitted || {}).some(
            (count) => count > 0,
          ) && <p className="dc-muted dc-model-info">{t("shortenedMemory")}</p>}
        </div>
      )}
      <p className="dc-muted dc-model-info">{t("memoryHelp")}</p>
    </section>
  );
}

/** One local Bot's activity, how it takes part in conversations, and its memory. */
function LocalBotSettings({
  bot,
  connection,
  t,
  onBack,
}: {
  bot: NativeBot;
  connection: Connection;
  t: Translate;
  onBack: () => void;
}) {
  const [kernel, setKernel] = useState<KernelState | null>(null);
  const [mode, setMode] = useState<AttentionMode | "">("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setKernel(null);
    void connection
      .kernel<KernelState>("kernel-state", { nativeBotId: bot.id }, controller)
      .then((value) => {
        if (controller.signal.aborted) return;
        setKernel(value);
        setMode(value.desiredAttention?.mode || value.attention?.mode || "");
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(message(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [connection, bot.id, revision]);
  const activity = kernel?.attention?.activity || kernel?.attention?.status;
  const current = kernel?.desiredAttention?.mode || kernel?.attention?.mode;
  return (
    <section className="dc-local-settings" aria-label={t("settings")}>
      <Button variant="outline" disabled={busy} onClick={onBack}>
        {t("back")}
      </Button>
      <h3>{bot.name}</h3>
      <p className="dc-bot-id">{`${t("stableIdentity")} · ${bot.id}`}</p>
      {loading && (
        <p role="status" className="dc-muted">
          {t("loadingKernel")}
        </p>
      )}
      {error && (
        <p role="alert" className="dc-error">
          {error}
        </p>
      )}
      {kernel && (
        <p className="dc-model-info">
          {t(
            activity && ACTIVITIES.includes(activity)
              ? (activity as MessageKey)
              : "unknown",
          )}
        </p>
      )}
      <p className="dc-muted dc-model-info">{t("waitHelp")}</p>
      <h3>{t("participation")}</h3>
      {kernel?.desiredAttention?.status === "pending" && (
        <p role="status" className="dc-muted dc-model-info">
          {t("participationPending")}
        </p>
      )}
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setFeedback(null);
          try {
            const receipt = await connection.kernel<{ status?: string }>(
              "attention-update",
              { nativeBotId: bot.id, mode },
            );
            setFeedback({ ok: true, pending: receipt.status === "pending" });
            setRevision((value) => value + 1);
          } catch (reason) {
            setFeedback({ error: message(reason) });
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset
          className="dc-mode-options"
          disabled={busy || loading || !kernel}
        >
          <legend className="dc-muted">{t("participation")}</legend>
          {MODES.map((value) => (
            <label className="dc-mode-option" key={value}>
              <input
                type="radio"
                name="participationMode"
                value={value}
                checked={mode === value}
                onChange={() => setMode(value)}
              />
              <span>
                <strong>{t(value)}</strong>
                <small>{t(`${value}Help`)}</small>
              </span>
            </label>
          ))}
        </fieldset>
        <Button
          type="submit"
          variant="primary"
          disabled={busy || loading || !kernel || !mode || mode === current}
        >
          {t("saveParticipation")}
        </Button>
      </form>
      <FeedbackLine
        feedback={feedback}
        ok={t(
          feedback && "pending" in feedback && feedback.pending
            ? "participationPending"
            : "participationSaved",
        )}
      />
      <LocalSourceMemory connection={connection} nativeBotId={bot.id} t={t} />
    </section>
  );
}

/** The Bots that live on this DSH node: create them, add them to chat servers, and open their settings. */
export function LocalKernelPanel({ connection, state, value, t }: ReadyProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [provider, setProvider] = useState<DecisionProvider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void connection
      .kernel<KernelState>("kernel-state", {}, controller)
      .then((kernel) => {
        if (controller.signal.aborted) return;
        setProvider(kernel.decisionProvider || null);
        setError(null);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(message(reason));
      });
    return () => controller.abort();
  }, [connection]);
  const servers = value.servers || [];
  const target = servers.length === 1 ? servers[0].url : serverUrl;
  const detail = value.nativeBots?.find((bot) => bot.id === selected);
  const busy = Boolean(state.busy);
  return (
    <section className="dc-panel" aria-label={t("nativeBots")}>
      <h2>{t("nativeBots")}</h2>
      <p className="dc-muted">{t("nativeHelp")}</p>
      {error && (
        <p role="alert" className="dc-error dc-model-info">
          {error}
        </p>
      )}
      {detail ? (
        <LocalBotSettings
          key={detail.id}
          bot={detail}
          connection={connection}
          t={t}
          onBack={() => setSelected(null)}
        />
      ) : (
        <Fragment>
          <ul className="dc-bots">
            {(value.nativeBots || []).map((bot) => {
              const bound = value.bots.some(
                (link) => link.nativeBotId === bot.id,
              );
              return (
                <li key={bot.id} className="dc-bot">
                  <div className="dc-bot-copy">
                    <strong>{bot.name}</strong>
                    <p className="dc-bot-id">{bot.id}</p>
                    {bot.role && <p className="dc-muted">{bot.role}</p>}
                  </div>
                  <div className="dc-toolbar">
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => setSelected(bot.id)}
                    >
                      {t("settings")}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={
                        busy || bound || !bot.model || !value.user || !target
                      }
                      onClick={() =>
                        void connection.attach(bot.id, undefined, target)
                      }
                    >
                      {t(bound ? "nativeBound" : "attach")}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
          {servers.length > 1 && (
            <label className="dc-field">
              {t("attach")}
              <select
                value={serverUrl}
                onChange={(event) => setServerUrl(event.target.value)}
                disabled={busy}
              >
                <option value="">{t("chooseServer")}</option>
                {servers.map((server) => (
                  <option key={server.url} value={server.url}>
                    {server.serverName}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!value.nativeBots?.length && (
            <p className="dc-muted dc-model-info">{t("nativeEmpty")}</p>
          )}
          {!value.user && (
            <p className="dc-muted dc-model-info">{t("signInToAttach")}</p>
          )}
          <CreateLocalBot
            connection={connection}
            state={state}
            value={value}
            t={t}
          />
        </Fragment>
      )}
      <DecisionProviderForm
        connection={connection}
        provider={provider}
        onSaved={setProvider}
        t={t}
      />
      <p className="dc-muted dc-model-info">{t("nativeLifecycle")}</p>
    </section>
  );
}

const POLICIES = [
  ["auto", "policyAuto"],
  ["notify", "policyNotify"],
  ["manual", "policyManual"],
] as const;

/** The plugin's own version, which server protocol it speaks, and how it upgrades. */
export function KernelUpdatePanel({
  connection,
  initial,
  t,
}: {
  connection: Connection;
  initial: KernelUpdates;
  t: Translate;
}) {
  const [view, setView] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setView(initial), [initial]);
  async function run(action: string, payload: Record<string, unknown> = {}) {
    setBusy(true);
    setError(null);
    try {
      setView(await connection.kernel<KernelUpdates>(action, payload));
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  }
  const installing = view.phase === "installing";
  // An install finishes in the background; follow it until it lands.
  useEffect(() => {
    if (!installing) return undefined;
    const timer = setInterval(
      () =>
        void connection
          .kernel<KernelUpdates>("kernel-update-status")
          .then(setView)
          .catch(() => {}),
      1000,
    );
    return () => clearInterval(timer);
  }, [connection, installing]);
  const summary =
    view.phase === "failed"
      ? t("updateFailed", { error: view.error || "" })
      : view.phase === "installed"
        ? t("updateInstalled")
        : view.phase === "restart-required"
          ? t("updateRestart")
          : !view.serverProtocol
            ? t("updateUnchecked")
            : !view.compatible && !view.available
              ? t("updateIncompatible")
              : view.available
                ? t("updateAvailable", { version: view.available })
                : t("updateLatest");
  return (
    <section className="dc-panel" aria-label={t("updateTitle")}>
      <h2>{t("updateTitle")}</h2>
      <p className="dc-model-info">
        {t("updateCurrent", { version: view.current }) +
          (view.serverProtocol
            ? ` · ${t("updateProtocol", { protocol: view.serverProtocol })}`
            : "")}
      </p>
      <p
        role="status"
        className={
          view.phase === "failed" || view.compatible === false
            ? "dc-error dc-model-info"
            : "dc-muted dc-model-info"
        }
      >
        {summary}
      </p>
      {view.source && view.source !== "registry" && (
        <p className="dc-muted dc-model-info">{t("updateNotRegistry")}</p>
      )}
      <fieldset className="dc-mode-options" disabled={busy || installing}>
        <legend className="dc-muted">{t("updatePolicy")}</legend>
        {POLICIES.map(([policy, key]) => (
          <label className="dc-mode-option" key={policy}>
            <input
              type="radio"
              name="kernelUpdatePolicy"
              value={policy}
              checked={view.policy === policy}
              onChange={() => void run("kernel-update-policy", { policy })}
            />
            <span>
              <strong>{t(key)}</strong>
              <small>{t(`${key}Help`)}</small>
            </span>
          </label>
        ))}
        <label className="dc-mode-option">
          <input
            type="checkbox"
            checked={view.channel === "prerelease"}
            onChange={(event) =>
              void run("kernel-update-policy", {
                channel: event.target.checked ? "prerelease" : "stable",
              })
            }
          />
          <span>
            <strong>{t("updatePrerelease")}</strong>
          </span>
        </label>
      </fieldset>
      <div className="dc-toolbar">
        <Button
          variant="outline"
          type="button"
          disabled={busy || installing}
          onClick={() => void run("kernel-update-check")}
        >
          {t("updateCheck")}
        </Button>
        {view.available &&
          view.source === "registry" &&
          view.phase !== "installed" &&
          view.phase !== "restart-required" && (
            <Button
              variant="primary"
              type="button"
              disabled={busy || installing}
              onClick={() => void run("kernel-update-install")}
            >
              {installing
                ? t("updateInstalling")
                : t("updateInstall", { version: view.available })}
            </Button>
          )}
      </div>
      {error && (
        <p role="alert" className="dc-error dc-model-info">
          {error}
        </p>
      )}
    </section>
  );
}
