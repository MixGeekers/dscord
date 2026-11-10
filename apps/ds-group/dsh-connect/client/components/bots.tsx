import { useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@deepseek-ai/dsh-client-ui-primitives";
import type { MessageKey } from "../locale";
import type { BotStatus, NativeBot, ServerBot } from "../types";
import { CreateLocalBot, ModelForm } from "./forms";
import type { ReadyProps } from "./forms";
import { LocalBotSettings } from "./kernel";
import { webUrl } from "./servers";

const STATUS_KEYS: Record<BotStatus, MessageKey> = {
  offline: "statusOffline",
  connecting: "statusConnecting",
  online: "statusOnline",
  error: "statusError",
};

function Avatar({ name }: { name: string }) {
  return (
    <span className="dc-avatar" aria-hidden>
      {Array.from(name)[0]}
    </span>
  );
}

/** One Bot account on one chat server: whether it is online there, and the actions that change that. */
function ConnectionRow({
  bot,
  title,
  connection,
  state,
  value,
  t,
}: ReadyProps & { bot: ServerBot; title: string }) {
  const busy = state.busy?.botId === bot.id;
  const status = bot.status || "offline";
  const connected =
    bot.connected || status === "online" || status === "connecting";
  const disabled = Boolean(state.busy);
  const name = bot.name || bot.id;
  const catalog = value.models;
  const nextModel = bot.modelSelection || catalog?.defaultSelection;
  const modelAvailable =
    catalog?.available !== true ||
    catalog.providers.some((provider) =>
      provider.models.some((model) => model.model === nextModel?.model),
    );
  const blocked =
    disabled || value.runtime?.available === false || !modelAvailable;
  const chat = status === "online" ? webUrl(bot.serverUrl || "") : null;
  return (
    <li className="dc-row">
      <div className="dc-copy">
        <p className="dc-title">{title}</p>
        <p className="dc-status" data-status={status}>
          {STATUS_KEYS[status] ? t(STATUS_KEYS[status]) : status}
        </p>
        {!modelAvailable && (
          <p className="dc-error dc-small">{t("modelUnavailable")}</p>
        )}
        {bot.lastError && <p className="dc-error dc-small">{bot.lastError}</p>}
      </div>
      <div className="dc-actions">
        {chat && (
          <a href={chat} target="_blank" rel="noopener noreferrer">
            {t("openChat")}
          </a>
        )}
        {connected && (
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
            disabled={blocked}
            onClick={() => void connection.connect(bot.id)}
            aria-label={t("connectBot", { name })}
          >
            {t(busy ? "connecting" : "connect")}
          </Button>
        )}
      </div>
    </li>
  );
}

/** A Bot that lives on this device: where it is online, and its settings. */
function LocalBot({ bot, ...props }: ReadyProps & { bot: NativeBot }) {
  const { connection, state, value, t } = props;
  const [settings, setSettings] = useState(false);
  const [serverUrl, setServerUrl] = useState("");
  const links = value.bots.filter((link) => link.nativeBotId === bot.id);
  const servers = value.user ? value.servers || [] : [];
  const target =
    servers.find((server) => server.url === serverUrl) || servers[0];
  const model = (value.models?.providers || [])
    .flatMap((provider) => provider.models)
    .find((item) => item.model === bot.model);
  const busy = Boolean(state.busy);
  return (
    <li className="dc-bot" aria-label={bot.name}>
      <div className="dc-row">
        <div className="dc-identity">
          <Avatar name={bot.name} />
          <div className="dc-copy">
            <p className="dc-title">{bot.name}</p>
            {bot.role && <p className="dc-meta">{bot.role}</p>}
            <p className="dc-meta">
              {`${t("model")} · ${model?.name || bot.model || t("noModel")}`}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          type="button"
          aria-expanded={settings}
          aria-label={t("botSettings", { name: bot.name })}
          onClick={() => setSettings(!settings)}
        >
          {t(settings ? "closeSettings" : "settings")}
        </Button>
      </div>
      {links.length ? (
        <ul className="dc-links">
          {links.map((link) => (
            <ConnectionRow
              key={link.id}
              bot={link}
              title={link.serverName || link.id}
              {...props}
            />
          ))}
        </ul>
      ) : (
        <div className="dc-links">
          <div className="dc-row">
            <p className="dc-copy dc-muted">
              {t(target ? "notJoined" : "signInToAttach")}
            </p>
            {target && (
              <div className="dc-actions">
                {servers.length > 1 && (
                  <select
                    aria-label={t("joinServer")}
                    value={target.url}
                    onChange={(event) => setServerUrl(event.target.value)}
                    disabled={busy}
                  >
                    {servers.map((server) => (
                      <option key={server.url} value={server.url}>
                        {server.serverName}
                      </option>
                    ))}
                  </select>
                )}
                <Button
                  variant="primary"
                  type="button"
                  disabled={busy || !bot.model}
                  aria-label={t("attachBot", { name: bot.name })}
                  onClick={() =>
                    void connection.attach(bot.id, undefined, target.url)
                  }
                >
                  {t(state.busy?.action === "attach" ? "joining" : "attach")}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
      {settings && (
        <LocalBotSettings bot={bot} connection={connection} t={t}>
          {links[0] && value.models?.available && (
            <ModelForm
              key={JSON.stringify(links[0].modelSelection)}
              bot={links[0]}
              {...props}
            />
          )}
        </LocalBotSettings>
      )}
    </li>
  );
}

/** A Bot account that no Bot on this device runs yet: pick the local Bot that takes it over. */
function UnlinkedBot({
  bot,
  connection,
  state,
  value,
  t,
}: ReadyProps & { bot: ServerBot }) {
  const [nativeId, setNativeId] = useState("");
  const disabled = Boolean(state.busy);
  const name = bot.name || bot.id;
  const free = (value.nativeBots || []).filter(
    (local) => !value.bots.some((item) => item.nativeBotId === local.id),
  );
  return (
    <li className="dc-row">
      <div className="dc-identity">
        <Avatar name={name} />
        <div className="dc-copy">
          <p className="dc-title">{name}</p>
          <p className="dc-meta">{bot.localpart || bot.id}</p>
        </div>
      </div>
      <form
        className="dc-actions"
        onSubmit={(event) => {
          event.preventDefault();
          void connection.attach(nativeId, bot.id);
        }}
      >
        <select
          aria-label={t("bindLabel", { name })}
          value={nativeId}
          onChange={(event) => setNativeId(event.target.value)}
          disabled={disabled || !free.length}
        >
          <option value="">
            {t(free.length ? "chooseNative" : "noFreeNative")}
          </option>
          {free.map((local) => (
            <option key={local.id} value={local.id}>
              {local.name}
            </option>
          ))}
        </select>
        <Button
          type="submit"
          variant="outline"
          disabled={disabled || !nativeId}
        >
          {t("bind")}
        </Button>
      </form>
    </li>
  );
}

/** A Bot the plugin runs as its own process: its account on one chat server, and the model it uses. */
function ServerBotRow({ bot, ...props }: ReadyProps & { bot: ServerBot }) {
  const name = bot.name || bot.id;
  const next = bot.modelSelection || props.value.models?.defaultSelection;
  return (
    <li className="dc-bot" aria-label={name}>
      <div className="dc-identity">
        <Avatar name={name} />
        <div className="dc-copy">
          <p className="dc-title">{name}</p>
          <p className="dc-meta">{bot.localpart || bot.id}</p>
          {bot.activeModel && (
            <p className="dc-meta">{`${props.t("activeModel")} · ${bot.activeModel.model}`}</p>
          )}
          {next && (
            <p className="dc-meta">{`${props.t("nextModel")} · ${next.model}`}</p>
          )}
        </div>
      </div>
      <ul className="dc-links">
        <ConnectionRow bot={bot} title={bot.serverName || bot.id} {...props} />
      </ul>
      {props.value.models?.available && (
        <ModelForm
          key={JSON.stringify(bot.modelSelection)}
          bot={bot}
          {...props}
        />
      )}
    </li>
  );
}

/** Bot accounts grouped by the chat server they are on. */
function ByServer({
  bots,
  listClass,
  empty,
  render,
  value,
}: ReadyProps & {
  bots: ServerBot[];
  listClass: string;
  empty: string;
  render: (bot: ServerBot) => ReactNode;
}) {
  return (
    <>
      {(value.servers || []).map((server) => {
        const mine = bots.filter((bot) => bot.serverUrl === server.url);
        return (
          <section
            key={server.url}
            className="dc-group"
            aria-label={server.serverName}
          >
            <h3>{server.serverName}</h3>
            {mine.length ? (
              <ul className={listClass}>{mine.map(render)}</ul>
            ) : (
              <p className="dc-muted">{empty}</p>
            )}
          </section>
        );
      })}
    </>
  );
}

/**
 * The owner's Bots. With the DSCord kernel they live on this device: each one shows where it is online, and new
 * ones are created here. Without it, they are the account's Bots on each chat server.
 */
export function BotsPanel(props: ReadyProps) {
  const { value, t } = props;
  if (!value.nativeMode)
    return (
      <section className="dc-panel" aria-label={t("myBots")}>
        <h2>{t("myBots")}</h2>
        {value.bots.length === 0 ? (
          <p className="dc-muted">{t("emptyBots")}</p>
        ) : (
          <ByServer
            {...props}
            bots={value.bots}
            listClass="dc-bots"
            empty={t("noServerBots")}
            render={(bot) => <ServerBotRow key={bot.id} bot={bot} {...props} />}
          />
        )}
      </section>
    );
  const local = value.nativeBots || [];
  // One account is on every added server; binding it once covers them all.
  const unlinked = value.bots.filter(
    (bot, index, all) =>
      !bot.nativeBotId &&
      all.findIndex((item) => item.localpart === bot.localpart) === index,
  );
  return (
    <section className="dc-panel" aria-label={t("nativeBots")}>
      <div className="dc-heading">
        <h2>{t("nativeBots")}</h2>
        <p className="dc-muted">{t("nativeHelp")}</p>
      </div>
      {local.length ? (
        <ul className="dc-bots">
          {local.map((bot) => (
            <LocalBot key={bot.id} bot={bot} {...props} />
          ))}
        </ul>
      ) : (
        <p className="dc-muted">{t("nativeEmpty")}</p>
      )}
      {unlinked.length > 0 && (
        <section
          className="dc-section dc-divided"
          aria-label={t("unlinkedBots")}
        >
          <div className="dc-heading">
            <h3>{t("unlinkedBots")}</h3>
            <p className="dc-meta">{t("unlinkedHelp")}</p>
          </div>
          <ul className="dc-list">
            {unlinked.map((bot) => (
              <UnlinkedBot key={bot.id} bot={bot} {...props} />
            ))}
          </ul>
        </section>
      )}
      <CreateLocalBot
        {...props}
        startOpen={Boolean(value.user) && !local.length}
      />
      {local.length > 0 && <p className="dc-meta">{t("nativeLifecycle")}</p>}
    </section>
  );
}
