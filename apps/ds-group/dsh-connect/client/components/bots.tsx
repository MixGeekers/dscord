import type { MessageKey, Translate } from "../locale";
import type { BotStatus, ConnectionState, DeviceBot } from "../types";

const STATUS_KEYS: Record<BotStatus, MessageKey> = {
  offline: "statusOffline",
  connecting: "statusConnecting",
  online: "statusOnline",
  error: "statusError",
};

/** An address a browser can open safely, or nothing. */
export function webLink(address: string | undefined) {
  try {
    const url = new URL(address || "");
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

/** One Bot this device runs: the model it is on and how it is doing on each chat server. Nothing here is editable. */
function BotCard({ bot, t }: { bot: DeviceBot; t: Translate }) {
  return (
    <li className="dc-bot" aria-label={bot.name}>
      <div className="dc-identity">
        <span className="dc-avatar" aria-hidden>
          {Array.from(bot.name)[0]}
        </span>
        <div className="dc-copy">
          <p className="dc-title">{bot.name}</p>
          <p className="dc-meta">{bot.globalId || bot.username}</p>
          {bot.model && (
            <p className="dc-meta">{`${t("model")} · ${bot.model}`}</p>
          )}
        </div>
      </div>
      {bot.error && (
        <p role="alert" className="dc-error dc-small">
          {bot.error}
        </p>
      )}
      {bot.servers.length ? (
        <ul className="dc-links">
          {bot.servers.map((server) => {
            const chat = server.status === "online" && webLink(server.url);
            return (
              <li key={server.url} className="dc-row">
                <div className="dc-copy">
                  <p className="dc-title">{server.serverName}</p>
                  <p className="dc-status" data-status={server.status}>
                    {t(STATUS_KEYS[server.status] || "statusOffline")}
                  </p>
                  {server.error && (
                    <p className="dc-error dc-small">{server.error}</p>
                  )}
                </div>
                {chat && (
                  <div className="dc-actions">
                    <a href={chat} target="_blank" rel="noopener noreferrer">
                      {t("openChat")}
                    </a>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="dc-meta">{t("notJoined")}</p>
      )}
    </li>
  );
}

/** The Bots the owner's account runs on this device. They are set up on the web; this page only shows them. */
export function BotsPanel({
  value,
  t,
}: {
  value: ConnectionState;
  t: Translate;
}) {
  const web = webLink(value.webUrl);
  return (
    <section className="dc-panel" aria-label={t("deviceBots")}>
      <div className="dc-heading">
        <h2>{t("deviceBots")}</h2>
        {web && (
          <a href={web} target="_blank" rel="noopener noreferrer">
            {t("openWeb")}
          </a>
        )}
      </div>
      <p className="dc-muted">{t("deviceBotsHelp")}</p>
      {value.bots.length ? (
        <ul className="dc-bots">
          {value.bots.map((bot) => (
            <BotCard key={bot.id} bot={bot} t={t} />
          ))}
        </ul>
      ) : (
        <p className="dc-muted">{t("emptyBots")}</p>
      )}
    </section>
  );
}
