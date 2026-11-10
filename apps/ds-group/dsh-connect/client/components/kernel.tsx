import { useEffect, useState } from "react";
import type { ReactNode } from "react";
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
      className={error ? "dc-error dc-small" : "dc-meta"}
    >
      {error || ok}
    </p>
  );
}

/** The private key for the natural-participation decision service; a saved key is never shown again. */
export function DecisionProviderForm({
  connection,
  t,
}: {
  connection: Connection;
  t: Translate;
}) {
  const [provider, setProvider] = useState<DecisionProvider | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [enabled, setEnabled] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    void connection
      .kernel<KernelState>("kernel-state", {}, controller)
      .then((kernel) => {
        if (controller.signal.aborted) return;
        setProvider(kernel.decisionProvider || null);
        setEnabled(kernel.decisionProvider?.enabled !== false);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setFeedback({ error: message(reason) });
      });
    return () => controller.abort();
  }, [connection]);
  return (
    <details className="dc-disclosure">
      <summary>{t("decisionTitle")}</summary>
      <div className="dc-body">
        <p className="dc-meta">{t("decisionHelp")}</p>
        <p className="dc-meta">
          {provider
            ? `${t(provider.configured ? "configured" : "notConfigured")} · ${t(
                provider.available === true
                  ? "available"
                  : provider.available === false
                    ? "serviceUnavailable"
                    : "availabilityUnknown",
              )}${provider.model ? ` · ${provider.model}` : ""}`
            : t("unknown")}
        </p>
        <form
          className="dc-form"
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
              setProvider(
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
          <div className="dc-field">
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
            <span className="dc-hint">{t("decisionKeyHelp")}</span>
          </div>
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
          <div className="dc-actions">
            <Button type="submit" variant="outline" disabled={busy}>
              {t("saveDecision")}
            </Button>
          </div>
        </form>
        <FeedbackLine feedback={feedback} ok={t("decisionSaved")} />
      </div>
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
    <section className="dc-section" aria-label={t("memory")}>
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
        <div className="dc-section">
          <h3>{result.identity?.name || result.id}</h3>
          <p className="dc-meta">{result.id}</p>
          {filled.map((key) => (
            <section key={key} className="dc-section">
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
                  {item.saidBy && <p className="dc-meta">{item.saidBy}</p>}
                  {item.scope && <p className="dc-meta">{item.scope}</p>}
                  {item.conflicts?.length ? (
                    <p className="dc-meta">{t("conflicts")}</p>
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
            <p className="dc-meta">{t("limitedMemory")}</p>
          ) : null}
          {Object.values(view.budget?.omitted || {}).some(
            (count) => count > 0,
          ) && <p className="dc-meta">{t("shortenedMemory")}</p>}
        </div>
      )}
      <p className="dc-hint">{t("memoryHelp")}</p>
    </section>
  );
}

/** One local Bot's settings: its model (passed in by the row), how it takes part in conversations, and its memory. */
export function LocalBotSettings({
  bot,
  connection,
  t,
  children,
}: {
  bot: NativeBot;
  connection: Connection;
  t: Translate;
  children?: ReactNode;
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
    <section
      className="dc-settings"
      aria-label={t("botSettings", { name: bot.name })}
    >
      {children}
      <div className="dc-section">
        <h3>{t("participation")}</h3>
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
          <p className="dc-meta">
            {`${t("activity")} · ${t(
              activity && ACTIVITIES.includes(activity)
                ? (activity as MessageKey)
                : "unknown",
            )}`}
          </p>
        )}
        {kernel?.desiredAttention?.status === "pending" && (
          <p role="status" className="dc-meta">
            {t("participationPending")}
          </p>
        )}
        <form
          className="dc-form"
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
            className="dc-options"
            aria-label={t("participation")}
            disabled={busy || loading || !kernel}
          >
            {MODES.map((value) => (
              <label className="dc-option" key={value}>
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
          <div className="dc-actions">
            <Button
              type="submit"
              variant="outline"
              disabled={busy || loading || !kernel || !mode || mode === current}
            >
              {t("saveParticipation")}
            </Button>
          </div>
        </form>
        <FeedbackLine
          feedback={feedback}
          ok={t(
            feedback && "pending" in feedback && feedback.pending
              ? "participationPending"
              : "participationSaved",
          )}
        />
      </div>
      <LocalSourceMemory connection={connection} nativeBotId={bot.id} t={t} />
      <p className="dc-meta">{`${t("stableIdentity")} · ${bot.id}`}</p>
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
      <div className="dc-row">
        <div className="dc-copy">
          <h2>{t("updateTitle")}</h2>
          <p className="dc-meta">
            {t("updateCurrent", { version: view.current }) +
              (view.serverProtocol
                ? ` · ${t("updateProtocol", { protocol: view.serverProtocol })}`
                : "")}
          </p>
          <p
            role="status"
            className={
              view.phase === "failed" || view.compatible === false
                ? "dc-error dc-small"
                : "dc-meta"
            }
          >
            {summary}
          </p>
          {view.source && view.source !== "registry" && (
            <p className="dc-meta">{t("updateNotRegistry")}</p>
          )}
        </div>
        <div className="dc-actions">
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
      </div>
      {error && (
        <p role="alert" className="dc-error dc-small">
          {error}
        </p>
      )}
      <details className="dc-disclosure dc-divided">
        <summary>{`${t("updatePolicy")} · ${t(
          POLICIES.find(([policy]) => policy === view.policy)?.[1] ||
            "policyNotify",
        )}`}</summary>
        <fieldset
          className="dc-options"
          aria-label={t("updatePolicy")}
          disabled={busy || installing}
        >
          {POLICIES.map(([policy, key]) => (
            <label className="dc-option" key={policy}>
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
          <label className="dc-option">
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
      </details>
    </section>
  );
}

/** Where on this device the plugin keeps the account's connection and each Bot's files. */
export function ConfigDirectory({
  directory,
  t,
}: {
  directory: string;
  t: Translate;
}) {
  return (
    <details className="dc-disclosure">
      <summary>{t("configDirectory")}</summary>
      <code>{directory}</code>
    </details>
  );
}
