import { useSyncExternalStore } from "react";
import type { Connection, Snapshot } from "../connection";
import type { MessageKey, Translate } from "../locale";
import { Loading } from "../../../ui/loading";
import { styles } from "../styles";
import type { ConnectionState } from "../types";
import { BotsPanel } from "./bots";
import { Button } from "./controls";
import { LoginForm } from "./forms";
import {
  ConfigDirectory,
  DecisionPanel,
  decisionWorks,
  KernelUpdatePanel,
} from "./kernel";

const STEPS: [MessageKey, MessageKey][] = [
  ["stepAccount", "stepAccountHint"],
  ["stepDecision", "stepDecisionHint"],
  ["stepBot", "stepBotHint"],
  ["stepOnline", "stepOnlineHint"],
];

/**
 * The steps from a fresh install to a Bot that answers the way it is meant to, shown until all are done.
 * The decision model is one of them: a Bot can go online without it, but it is not complete.
 */
function SetupGuide({ value, t }: { value: ConnectionState; t: Translate }) {
  const done = [
    Boolean(value.user),
    decisionWorks(value.decision),
    value.bots.length > 0,
    value.bots.some((bot) =>
      bot.servers.some((server) => server.status === "online"),
    ),
  ];
  if (done.every(Boolean)) return null;
  const current = done.indexOf(false);
  return (
    <ol className="dc-steps" aria-label={t("guideLabel")}>
      {STEPS.map(([title, hint], index) => {
        const state = done[index]
          ? "done"
          : index === current
            ? "current"
            : "todo";
        return (
          <li
            key={title}
            className="dc-step"
            data-state={state}
            aria-current={state === "current" ? "step" : undefined}
          >
            <span className="dc-step-mark" aria-hidden>
              {state === "done" ? "✓" : index + 1}
            </span>
            <span className="dc-step-copy">
              <strong>{t(title)}</strong>
              <small>{t(state === "done" ? "stepDone" : hint)}</small>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** What the last action said, and anything wrong with the link; it stays in view while the page scrolls. */
function Notices({
  state,
  value,
  t,
}: {
  state: Snapshot;
  value: ConnectionState | null;
  t: Translate;
}) {
  const errorMessage = state.errorTranslation
    ? t(state.errorTranslation.key, state.errorTranslation.params)
    : state.error;
  const unreachable = value?.user && value.lastError ? value.lastError : null;
  const runtimeDown = value?.runtime?.available === false;
  if (!state.notice && !errorMessage && !unreachable && !runtimeDown)
    return null;
  return (
    <div className="dc-notices">
      {state.notice && (
        <p role="status" className="dc-notice" data-tone="success">
          {t(state.notice)}
        </p>
      )}
      {errorMessage && (
        <p role="alert" className="dc-notice" data-tone="error">
          {errorMessage}
        </p>
      )}
      {unreachable && (
        <p role="alert" className="dc-notice" data-tone="error">
          {t("centralUnreachable", { error: unreachable })}
        </p>
      )}
      {runtimeDown && (
        <p role="status" className="dc-notice" data-tone="error">
          {value.runtime?.message || t("runtimeUnavailable")}
        </p>
      )}
    </div>
  );
}

/**
 * DSCord's page in DSH. It links this DSH to the owner's account, holds the decision model this device's Bots
 * share, and shows the Bots that account runs here; Bots themselves are set up on the DSCord web page.
 */
export function ConnectionPage({
  connection,
  t,
}: {
  connection: Connection;
  t: Translate;
}) {
  const state = useSyncExternalStore(
    connection.subscribe,
    connection.getSnapshot,
    connection.getSnapshot,
  );
  const value = state.value;
  const user = value?.user;
  const busy = state.loading || Boolean(state.busy);
  return (
    <section
      className="dscord-ui dscord-connect"
      aria-label={t("pageLabel")}
      aria-busy={busy}
    >
      <style>{styles}</style>
      <div className="dc-content">
        <header className="dc-header">
          <h1>{t("title")}</h1>
          <div className="dc-toolbar">
            {user && (
              <div className="dc-account" aria-label={t("account")}>
                <p className="dc-account-name">{user.name || user.id}</p>
                <p className="dc-meta">
                  {[user.globalId || user.id, value?.label]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            )}
            {user && (
              <Button
                variant="secondary"
                type="button"
                disabled={Boolean(state.busy)}
                onClick={() => void connection.logout()}
              >
                {t(state.busy?.action === "logout" ? "loggingOut" : "logout")}
              </Button>
            )}
            <Button
              variant="secondary"
              type="button"
              disabled={busy}
              onClick={() =>
                void (user ? connection.sync() : connection.refresh())
              }
            >
              {t(state.busy?.action === "sync" ? "refreshing" : "refresh")}
            </Button>
          </div>
        </header>
        <Notices state={state} value={value} t={t} />
        {state.loading && <Loading size="lg" label={t("readStatus")} />}
        {value && <SetupGuide value={value} t={t} />}
        {!state.loading && !user && (
          <LoginForm connection={connection} state={state} t={t} />
        )}
        {value && (
          <DecisionPanel
            connection={connection}
            status={value.decision}
            t={t}
          />
        )}
        {value && user && <BotsPanel value={value} t={t} />}
        {value?.kernelUpdates && (
          <KernelUpdatePanel
            connection={connection}
            initial={value.kernelUpdates}
            t={t}
          />
        )}
        {value?.dataDirectory && (
          <section className="dc-panel" aria-label={t("advanced")}>
            <h2>{t("advanced")}</h2>
            <ConfigDirectory directory={value.dataDirectory} t={t} />
          </section>
        )}
      </div>
    </section>
  );
}
