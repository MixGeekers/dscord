import { useSyncExternalStore } from "react";
import { Button } from "@deepseek-ai/dsh-client-ui-primitives";
import type { Connection, Snapshot } from "../connection";
import type { MessageKey, Translate } from "../locale";
import { styles } from "../styles";
import type { ConnectionState } from "../types";
import { BotsPanel } from "./bots";
import { LoginForm } from "./forms";
import {
  ConfigDirectory,
  DecisionProviderForm,
  KernelUpdatePanel,
} from "./kernel";
import { ServersPanel } from "./servers";

const STEPS: [MessageKey, MessageKey][] = [
  ["stepAccount", "stepAccountHint"],
  ["stepBot", "stepBotHint"],
  ["stepOnline", "stepOnlineHint"],
];

/** The three steps from a fresh install to a Bot that answers, shown until the last one is done. */
function SetupGuide({ value, t }: { value: ConnectionState; t: Translate }) {
  const done = [
    Boolean(value.user),
    Boolean(value.nativeBots?.length || value.bots.length),
    value.bots.some((bot) => bot.connected || bot.status === "online"),
  ];
  if (done[2]) return null;
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

/** What the last action said, and anything wrong with the connection; it stays in view while the page scrolls. */
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
  const lastError =
    value?.lastError && value.lastError !== errorMessage
      ? value.lastError
      : null;
  const runtimeDown = value?.runtime?.available === false;
  if (!state.notice && !errorMessage && !lastError && !runtimeDown) return null;
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
      {lastError && (
        <p role="alert" className="dc-notice" data-tone="error">
          {lastError}
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

/** DSCord's page in DSH: connect the account, run Bots, pick chat servers, then the settings few people need. */
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
  const ready = value ? { connection, state, value, t } : null;
  return (
    <section
      className="dscord-connect"
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
                <p className="dc-meta">{user.globalId || user.id}</p>
              </div>
            )}
            {user && (
              <Button
                variant="outline"
                type="button"
                disabled={Boolean(state.busy)}
                onClick={() => void connection.logout()}
              >
                {t(state.busy?.action === "logout" ? "loggingOut" : "logout")}
              </Button>
            )}
            <Button
              variant="outline"
              type="button"
              disabled={busy}
              onClick={() => void connection.refresh()}
            >
              {t("refresh")}
            </Button>
          </div>
        </header>
        <Notices state={state} value={value} t={t} />
        {state.loading && (
          <p role="status" className="dc-muted">
            {t("readStatus")}
          </p>
        )}
        {value?.nativeMode && <SetupGuide value={value} t={t} />}
        {!state.loading && !user && (
          <LoginForm connection={connection} state={state} t={t} />
        )}
        {ready && (ready.value.nativeMode || user) && (
          <BotsPanel
            key={`${ready.value.hostId || "local"}/${user?.id || "local-owner"}`}
            {...ready}
          />
        )}
        {ready && user && <ServersPanel {...ready} />}
        {value?.kernelUpdates && (
          <KernelUpdatePanel
            connection={connection}
            initial={value.kernelUpdates}
            t={t}
          />
        )}
        {(value?.nativeMode || value?.dataDirectory) && (
          <section className="dc-panel" aria-label={t("advanced")}>
            <h2>{t("advanced")}</h2>
            {value.nativeMode && (
              <DecisionProviderForm connection={connection} t={t} />
            )}
            {value.dataDirectory && (
              <ConfigDirectory directory={value.dataDirectory} t={t} />
            )}
          </section>
        )}
      </div>
    </section>
  );
}
