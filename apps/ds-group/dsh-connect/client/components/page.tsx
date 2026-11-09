import { useSyncExternalStore } from "react";
import { Button } from "@deepseek-ai/dsh-client-ui-primitives";
import type { Connection } from "../connection";
import type { Translate } from "../locale";
import { styles } from "../styles";
import { LoginForm } from "./forms";
import type { ReadyProps } from "./forms";
import { KernelUpdatePanel, LocalKernelPanel } from "./kernel";
import { BotRow, ServersPanel } from "./servers";

/** The signed-in account, its chat servers, and the Bots it has on each. */
function AccountSections(props: ReadyProps) {
  const { connection, state, value, t } = props;
  const user = value.user!;
  return (
    <>
      <section className="dc-panel dc-account" aria-label={t("account")}>
        <div>
          <p className="dc-account-name">{user.name || user.id}</p>
          <p className="dc-server">{user.globalId || user.id}</p>
        </div>
        <Button
          variant="outline"
          type="button"
          disabled={Boolean(state.busy)}
          onClick={() => void connection.logout()}
        >
          {t(state.busy?.action === "logout" ? "loggingOut" : "logout")}
        </Button>
      </section>
      <ServersPanel {...props} />
      <section className="dc-panel" aria-label={t("myBots")}>
        <h2>{t("myBots")}</h2>
        {value.bots.length === 0 ? (
          <p className="dc-muted">{t("emptyBots")}</p>
        ) : (
          (value.servers || []).map((server) => {
            const bots = value.bots.filter(
              (bot) => bot.serverUrl === server.url,
            );
            return (
              <section
                key={server.url}
                className="dc-server-bots"
                aria-label={server.serverName}
              >
                <h3>{server.serverName}</h3>
                {bots.length === 0 ? (
                  <p className="dc-muted">{t("noServerBots")}</p>
                ) : (
                  <ul className="dc-bots">
                    {bots.map((bot) => (
                      <BotRow key={bot.id} bot={bot} {...props} />
                    ))}
                  </ul>
                )}
              </section>
            );
          })
        )}
      </section>
    </>
  );
}

/** DSCord's page in DSH: sign-in, chat servers, Bots, the local kernel and plugin updates. */
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
  const errorMessage = state.errorTranslation
    ? t(state.errorTranslation.key, state.errorTranslation.params)
    : state.error;
  const ready = value ? { connection, state, value, t } : null;
  return (
    <section
      className="dscord-connect"
      aria-label={t("pageLabel")}
      aria-busy={state.loading || Boolean(state.busy)}
    >
      <style>{styles}</style>
      <div className="dc-content">
        <header className="dc-header">
          <h1>{t("title")}</h1>
          <div className="dc-toolbar">
            <Button
              variant="outline"
              type="button"
              disabled={state.loading || Boolean(state.busy)}
              onClick={() => void connection.refresh()}
            >
              {t("refresh")}
            </Button>
          </div>
        </header>
        {state.notice && (
          <p role="status" className="dc-notice">
            {t(state.notice)}
          </p>
        )}
        {errorMessage && (
          <p role="alert" className="dc-notice dc-error">
            {errorMessage}
          </p>
        )}
        {value?.lastError && value.lastError !== errorMessage && (
          <p role="alert" className="dc-notice dc-error">
            {value.lastError}
          </p>
        )}
        {state.loading && (
          <p role="status" className="dc-muted">
            {t("readStatus")}
          </p>
        )}
        {value?.runtime?.available === false && (
          <p role="status" className="dc-notice dc-error">
            {value.runtime.message || t("runtimeUnavailable")}
          </p>
        )}
        {!state.loading && !value?.user && (
          <LoginForm
            key={value?.servers?.[0]?.url || "login"}
            connection={connection}
            state={state}
            t={t}
          />
        )}
        {ready?.value.nativeMode && (
          <LocalKernelPanel
            key={`${ready.value.hostId || "local"}/${ready.value.user?.id || "local-owner"}`}
            {...ready}
          />
        )}
        {ready?.value.user && <AccountSections {...ready} />}
        {value?.kernelUpdates && (
          <KernelUpdatePanel
            connection={connection}
            initial={value.kernelUpdates}
            t={t}
          />
        )}
        {value?.dataDirectory && (
          <details className="dc-directory">
            <summary>{t("configDirectory")}</summary>
            <code>{value.dataDirectory}</code>
          </details>
        )}
      </div>
    </section>
  );
}
