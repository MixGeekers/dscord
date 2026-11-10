import { useEffect, useState } from "react";
import { Button, Input } from "@deepseek-ai/dsh-client-ui-primitives";
import type { Connection } from "../connection";
import type { Translate } from "../locale";
import type { DecisionProvider, KernelState, KernelUpdates } from "../types";

type Feedback = { ok: true; pending?: boolean } | { error: string } | null;
const message = (reason: unknown) => (reason as Error).message;

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
