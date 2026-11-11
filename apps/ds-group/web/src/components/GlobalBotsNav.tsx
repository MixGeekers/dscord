import { Avatar } from "./Avatar";
import { Button } from "../../../ui/controls";
import { useTranslation } from "../locale";
import { shellMessages } from "../locales/shell";
import { botHomeMessages } from "../locales/bot-home";
import type { BotStatus } from "../bot-kernel";
import type { Participant, Room } from "../types";
import { Icon } from "./Icons";
import { Loading } from "../../../ui/loading";

function directRoom(rooms: Room[], botId: string) {
  return rooms.find(
    (room) => room.kind === "direct" && room.participantIds.includes(botId),
  );
}

export function GlobalBotsNav({
  bots,
  known,
  rooms,
  active,
  onOpen,
}: {
  bots: Participant[];
  known: boolean;
  rooms: Room[];
  active: boolean;
  onOpen(): void;
}) {
  const t = useTranslation(shellMessages);
  const unread = bots.reduce(
    (sum, bot) => sum + (directRoom(rooms, bot.id)?.mentionCount ?? 0),
    0,
  );
  return (
    <div className="rail-bots">
      <button
        id="global-bots-button"
        className={`server-icon rail-bots-trigger${active ? " active" : ""}`}
        type="button"
        aria-label={`${t("myBots")} · ${known ? bots.length : t("loadingBots")}`}
        aria-current={active ? "page" : undefined}
        title={t("myBots")}
        onClick={onOpen}
      >
        <Icon name="bot" />
        <span
          id="owned-bot-count"
          className="rail-bots-count"
          aria-hidden="true"
        >
          {known ? bots.length : "…"}
        </span>
        {unread > 0 && (
          <span
            className="server-invite-count"
            title={t("mentions", { count: unread })}
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
    </div>
  );
}

/** One short line on what a Bot is doing, from the owner's status poll. */
function statusLine(
  t: (
    key: keyof (typeof botHomeMessages)["en"],
    values?: Record<string, string | number>,
  ) => string,
  status: BotStatus | undefined,
  name: (id?: string | null) => string,
) {
  if (!status) return "";
  if (!status.online) return t("rowOffline");
  if (status.workers.length)
    return t("rowWorking", { count: status.workers.length });
  if (status.responder?.state === "replying")
    return t("rowReplying", { name: name(status.responder.requesterId) });
  if (status.responder?.state === "deciding") return t("rowDeciding");
  return t("rowIdle");
}

export function GlobalBotsSidebar({
  bots,
  known,
  rooms,
  people,
  statuses,
  selectedRoom,
  homeBotId,
  openingBotId,
  onSelect,
  onManage,
  onCreate,
}: {
  bots: Participant[];
  known: boolean;
  rooms: Room[];
  people: Participant[];
  statuses: Record<string, BotStatus>;
  selectedRoom: Room | null;
  homeBotId: string | null;
  openingBotId: string | null;
  onSelect(id: string): void;
  onManage(): void;
  onCreate(): void;
}) {
  const t = useTranslation(shellMessages);
  const h = useTranslation(botHomeMessages);
  const name = (id?: string | null) =>
    people.find((person) => person.id === id)?.name ?? id ?? "";
  return (
    <div className="global-bots-sidebar">
      <nav
        id="owned-bots"
        className="global-bots-list"
        aria-label={t("myBots")}
      >
        {bots.length ? (
          bots.map((bot) => {
            const direct = directRoom(rooms, bot.id);
            const selected =
              homeBotId === bot.id ||
              (selectedRoom?.kind === "direct" &&
                selectedRoom.participantIds.includes(bot.id));
            const status = statuses[bot.id];
            const line = statusLine(h, status, name);
            return (
              <Button
                key={bot.id}
                variant="ghost"
                className={`global-bot-row${selected ? " selected" : ""}`}
                type="button"
                data-owned-bot-id={bot.id}
                title={bot.id}
                aria-current={selected ? "page" : undefined}
                aria-busy={openingBotId === bot.id}
                onClick={() => onSelect(bot.id)}
              >
                <Avatar member={bot} />
                <span className="global-bot-identity">
                  <strong>{bot.name}</strong>
                  <small
                    data-bot-status={
                      status
                        ? status.online
                          ? (status.activity ?? "unknown")
                          : "offline"
                        : undefined
                    }
                  >
                    {line || bot.id}
                  </small>
                </span>
                {openingBotId === bot.id && (
                  <span className="global-bot-opening">{t("opening")}</span>
                )}
                {!!direct?.mentionCount && (
                  <span className="unread-badge">
                    {direct.mentionCount > 99 ? "99+" : direct.mentionCount}
                  </span>
                )}
              </Button>
            );
          })
        ) : known ? (
          <p className="sidebar-empty">{t("noBots")}</p>
        ) : (
          <Loading label={t("loadingBotOwnership")} />
        )}
      </nav>
      <div className="global-bots-actions">
        <Button
          id="manage-bots-button"
          variant="ghost"
          type="button"
          onClick={onManage}
          disabled={!known}
        >
          <Icon name="gear" /> {t("manageBots")}
        </Button>
        <Button
          id="create-bot-button"
          variant="secondary"
          type="button"
          onClick={onCreate}
        >
          <Icon name="plus" /> {t("createBot")}
        </Button>
      </div>
    </div>
  );
}
