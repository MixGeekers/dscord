import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Connection } from "../connection";
import type { MessageKey, Translate } from "../locale";
import type {
  DecisionPreset,
  DecisionProvider,
  KernelState,
  KernelUpdates,
} from "../types";
import { Button, Checkbox, Input, Radio, Select } from "./controls";

const message = (reason: unknown) => (reason as Error).message;

export type DecisionState =
  "missing" | "disabled" | "failed" | "unchecked" | "ready";

/** Where the decision model stands, in the order the owner would fix it: a key, the switch, then a working answer. */
export function decisionState(
  provider: DecisionProvider | null | undefined,
): DecisionState {
  if (!provider?.configured) return "missing";
  if (provider.enabled === false) return "disabled";
  if (provider.available === false) return "failed";
  return provider.available ? "ready" : "unchecked";
}

/** Whether Bots on this device can rely on the decision model. A model that was never asked counts until it fails. */
export const decisionWorks = (provider: DecisionProvider | null | undefined) =>
  ["ready", "unchecked"].includes(decisionState(provider));

const STATE_TEXT: Record<DecisionState, MessageKey> = {
  missing: "decisionMissing",
  disabled: "decisionDisabled",
  failed: "decisionFailed",
  unchecked: "decisionUnchecked",
  ready: "decisionReady",
};
const SAVED_TEXT: Record<DecisionState, MessageKey> = {
  missing: "decisionSavedNoKey",
  disabled: "decisionSavedDisabled",
  failed: "decisionSavedFailed",
  unchecked: "decisionSaved",
  ready: "decisionSaved",
};
const STATE_TONE: Record<DecisionState, string> = {
  missing: "warning",
  disabled: "warning",
  failed: "error",
  unchecked: "online",
  ready: "online",
};
// What the service's refusal means for the person filling in the form.
const ERRORS: [RegExp, MessageKey][] = [
  [/^ATTENTION_HTTP_40[13]$/, "decisionErrorKey"],
  [/^ATTENTION_HTTP_404$/, "decisionErrorAddress"],
  [/^ATTENTION_HTTP_429$/, "decisionErrorLimit"],
  [
    /^ATTENTION_(INVALID_RESPONSE|REFUSAL|SERVICE_ERROR)$/,
    "decisionErrorProtocol",
  ],
  [/^ATTENTION_(TIMEOUT|PROVIDER_ERROR)$/, "decisionErrorUnreachable"],
];

const cloudflareEndpoint = (accountId: string, model: string) =>
  /^[a-fA-F0-9]{32}$/.test(accountId)
    ? `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/cloudflare/${model}`
    : "";

/**
 * The model that decides when Bots speak. Bots lose most of their conversational sense without it, so it has
 * its own panel: what it does, what is missing, and a form that checks the settings as it saves them.
 */
export function DecisionPanel({
  connection,
  status,
  t,
}: {
  connection: Connection;
  /** What the device says about the service now; the page reads it again every few seconds. */
  status: DecisionProvider | null | undefined;
  t: Translate;
}) {
  const [form, setForm] = useState<KernelState["decisionForm"]>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<DecisionState | null>(null);
  const [round, setRound] = useState(0);
  const [enabled, setEnabled] = useState(status?.enabled !== false);
  const [preset, setPreset] = useState("openai-decisions");
  const [model, setModel] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [accountId, setAccountId] = useState("");
  const [hasKey, setHasKey] = useState(false);
  function selectPreset(selected: DecisionPreset) {
    setPreset(selected.id);
    setModel(selected.model);
    setEndpoint(selected.endpoint);
    setAccountId(selected.accountId ?? "");
    setHasKey(selected.hasKey);
    setSaved(null);
    setError(null);
  }
  function readForm(value: KernelState["decisionForm"]) {
    setForm(value);
    if (value) {
      setEnabled(value.enabled);
      selectPreset(
        value.presets.find((item) => item.id === value.preset) ?? {
          ...value,
          id: value.preset,
          name: "OpenAI Decisions",
          models: [],
        },
      );
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    void connection
      .kernel<KernelState>("kernel-state", {}, controller)
      .then((value) => {
        if (!controller.signal.aborted) readForm(value.decisionForm);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(message(reason));
      });
    return () => controller.abort();
  }, [connection]);
  const state = decisionState(status);
  const working = decisionWorks(status);
  const selected = form?.presets.find((item) => item.id === preset);
  const cloudflare = preset === "cloudflare-clef";
  function changeModel(value: string) {
    if (cloudflare && endpoint === cloudflareEndpoint(accountId, model))
      setEndpoint(cloudflareEndpoint(accountId, value));
    setModel(value);
  }
  function changeAccount(value: string) {
    if (endpoint === cloudflareEndpoint(accountId, model))
      setEndpoint(cloudflareEndpoint(value, model));
    setAccountId(value);
  }
  const reason = status?.error
    ? t(
        ERRORS.find(([pattern]) => pattern.test(status.error!))?.[1] ??
          "decisionErrorOther",
        { code: status.error },
      )
    : null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = event.currentTarget.elements;
    const field = (name: string) => fields.namedItem(name) as HTMLInputElement;
    const apiKey = field("decisionApiKey").value.trim();
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const next = await connection.kernel<DecisionProvider>(
        "save-decision-provider",
        {
          enabled,
          preset,
          ...(apiKey ? { apiKey } : {}),
          // Only a changed value is saved, so untouched defaults keep following the device's environment.
          ...(model === (selected?.model ?? "") ? {} : { model: model.trim() }),
          ...(endpoint === (selected?.endpoint ?? "")
            ? {}
            : { endpoint: endpoint.trim() }),
          ...(cloudflare && accountId !== (selected?.accountId ?? "")
            ? { accountId: accountId.trim() }
            : {}),
        },
      );
      const kernel = await connection.kernel<KernelState>("kernel-state");
      // The page's status, its guide and the report to the owner's web page follow the new state.
      await connection.refresh({ clearError: false });
      readForm(kernel.decisionForm);
      setSaved(decisionState(next));
      setRound((value) => value + 1);
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  }

  const settings = (
    <form
      className="dc-form"
      // After a save the fields start again from what the device now holds, and the typed key leaves the page.
      key={`${preset}\n${round}`}
      onSubmit={(event) => void submit(event)}
    >
      <div className="dc-field">
        <label htmlFor="decision-preset">{t("decisionService")}</label>
        <Select
          id="decision-preset"
          name="decisionPreset"
          value={preset}
          disabled={busy || !form}
          onValueChange={(id) => {
            const next = form?.presets.find((item) => item.id === id);
            if (next) selectPreset(next);
          }}
          options={(form?.presets ?? []).map((item) => ({
            value: item.id,
            label: item.name,
          }))}
        />
        <span className="dc-hint">{t("decisionServiceHelp")}</span>
      </div>
      {cloudflare && (
        <div className="dc-field">
          <label className="dc-field">
            {t("decisionAccount")}
            <Input
              name="decisionAccount"
              value={accountId}
              onChange={(event) => changeAccount(event.target.value.trim())}
              required={enabled && !endpoint}
              disabled={busy}
              spellCheck={false}
              autoCapitalize="none"
            />
          </label>
          <span className="dc-hint">{t("decisionAccountHelp")}</span>
        </div>
      )}
      <div className="dc-field">
        <label className="dc-field">
          {t("decisionApiKey")}
          <Input
            name="decisionApiKey"
            type="password"
            autoComplete="new-password"
            required={enabled && !hasKey}
            disabled={busy}
            spellCheck={false}
            autoCapitalize="none"
          />
        </label>
        <span className="dc-hint">
          {t(hasKey ? "decisionKeyHelp" : "decisionKeyNeeded")}
        </span>
      </div>
      <div className="dc-field">
        <label htmlFor="decision-model">{t("decisionModelName")}</label>
        {cloudflare ? (
          <Select
            id="decision-model"
            name="decisionModel"
            value={model}
            onValueChange={changeModel}
            disabled={busy}
            options={[
              { value: "clef", label: "Clef" },
              { value: "clef-flash", label: "Clef Flash" },
            ]}
          />
        ) : (
          <Input
            id="decision-model"
            name="decisionModel"
            value={model}
            onChange={(event) => changeModel(event.target.value)}
            list="decision-models"
            disabled={busy}
            spellCheck={false}
            autoCapitalize="none"
          />
        )}
        {!cloudflare && (
          <datalist id="decision-models">
            {selected?.models.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
        )}
        <span className="dc-hint">{t("decisionModelHelp")}</span>
      </div>
      <div className="dc-field">
        <label className="dc-field">
          {t("decisionEndpoint")}
          <Input
            name="decisionEndpoint"
            value={endpoint}
            onChange={(event) => setEndpoint(event.target.value)}
            disabled={busy}
            spellCheck={false}
            autoCapitalize="none"
          />
        </label>
        <span className="dc-hint">{t("decisionEndpointHelp")}</span>
      </div>
      <label className="dc-check">
        <Checkbox
          name="enabled"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
          disabled={busy}
        />
        {t("enableDecision")}
      </label>
      <div className="dc-actions">
        <Button
          type="submit"
          variant={working ? "secondary" : "default"}
          disabled={busy}
        >
          {t(busy ? "decisionSaving" : "saveDecision")}
        </Button>
      </div>
    </form>
  );
  return (
    <section
      className="dc-panel dc-decision"
      aria-label={t("decisionTitle")}
      data-state={state}
    >
      <div className="dc-heading">
        <h2>{t("decisionTitle")}</h2>
        <p className="dc-status" data-status={STATE_TONE[state]}>
          {[t(STATE_TEXT[state]), working && status?.model]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <p className="dc-meta">{t("decisionHelp")}</p>
      {!working && (
        <>
          <ul className="dc-points">
            <li>{t("decisionDoesJoin")}</li>
            <li>{t("decisionDoesTurns")}</li>
          </ul>
          <p className="dc-notice" data-tone="warning">
            {t("decisionWithout")}
          </p>
        </>
      )}
      {error && (
        <p role="alert" className="dc-error dc-small">
          {error}
        </p>
      )}
      {saved && (
        <p
          role="status"
          className={
            saved === "ready" || saved === "unchecked"
              ? "dc-meta"
              : "dc-error dc-small"
          }
        >
          {t(SAVED_TEXT[saved])}
        </p>
      )}
      {state === "failed" && reason && (
        <p role="alert" className="dc-error dc-small">
          {reason}
        </p>
      )}
      {working ? (
        <details className="dc-disclosure">
          <summary>{t("decisionEdit")}</summary>
          <div className="dc-body">{settings}</div>
        </details>
      ) : (
        <>
          {state === "missing" && (
            <ol className="dc-how">
              <li>{t("decisionSetup1")}</li>
              <li>{t("decisionSetup2")}</li>
              <li>{t("decisionSetup3")}</li>
            </ol>
          )}
          {settings}
        </>
      )}
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
            variant="secondary"
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
              <Radio
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
            <Checkbox
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
