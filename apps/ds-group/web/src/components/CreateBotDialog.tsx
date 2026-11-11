import { Button } from "../../../ui/controls";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { messageOf } from "../api";
import { createBot } from "../central";
import type { ManagedBot } from "../central";
import { useTranslation } from "../locale";
import { botMessages } from "../locales/bots";
import { botStage, useManagedBots } from "../managed-bots";
import type { Participant, Session } from "../types";
import { BotSetupFields, DecisionWarning, StageLabel } from "./BotSetup";
import type { BotSetup } from "./BotSetup";
import { ConnectDsh } from "./ConnectDsh";
import { Icon } from "./Icons";
import { ScrollArea } from "../../../ui/layout";

export interface CreateBotDialogProps {
  open: boolean;
  session: Session | null;
  /** The chat server this page shows; a new Bot joins it. */
  server: string;
  ownedBots: Participant[];
  onClose(): void;
  /** The Bot arrived on this server, so the page's own lists are out of date. */
  onArrived(): void;
  onDirect(id: string): void;
}

const EMPTY: BotSetup = { displayName: "", role: "", model: "", deviceId: "" };

/**
 * A Bot is made here, at the central server, with everything that says who it is. A linked DSH then runs it;
 * when no DSH is linked yet, the connection key for one is the next thing shown.
 */
export function CreateBotDialog({
  open,
  session,
  server,
  ownedBots,
  onClose,
  onArrived,
  onDirect,
}: CreateBotDialogProps) {
  const t = useTranslation(botMessages);
  const dialog = useRef<HTMLDialogElement>(null);
  const managed = useManagedBots(session, open);
  const [setup, setSetup] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<ManagedBot | null>(null);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open) dialog.current?.close();
    if (open) {
      setSetup(EMPTY);
      setCreated(null);
      setError("");
    }
  }, [open]);

  // A new Bot goes to a device that is there to run it now, unless the person picks another.
  const preferred =
    managed.devices.find((device) => device.online) ?? managed.devices[0];
  const chosen = {
    ...setup,
    deviceId: setup.deviceId || (preferred?.id ?? ""),
  };
  const bot =
    (created && managed.bots.find((item) => item.id === created.id)) ?? created;
  const stage = bot ? botStage(bot, server) : null;
  const participant = bot
    ? ownedBots.find((item) => item.globalId === bot.globalId)
    : undefined;
  const online = stage?.stage === "online";
  useEffect(() => {
    if (online && !participant) onArrived();
    // Asked again with every poll until the page knows the Bot.
  }, [online, participant, managed.bots, onArrived]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!managed.available || busy) return;
    setBusy(true);
    setError("");
    try {
      setCreated(
        await createBot(managed.issuer, managed.token, {
          displayName: chosen.displayName.trim(),
          role: chosen.role.trim(),
          model: chosen.model,
          ...(chosen.deviceId ? { deviceId: chosen.deviceId } : {}),
          servers: [server],
        }),
      );
      void managed.reload();
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      id="create-bot-dialog"
      className="settings-dialog"
      aria-labelledby="create-bot-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="dialog-heading">
        <h2 id="create-bot-title">
          {bot ? t("created", { name: bot.displayName }) : t("createBot")}
        </h2>
        <Button
          id="close-create-bot"
          variant="ghost"
          size="icon"
          type="button"
          aria-label={t("close")}
          onClick={onClose}
        >
          <Icon name="close" />
        </Button>
      </header>
      {bot && stage ? (
        <>
          <ScrollArea
            id="create-bot-progress"
            className="dialog-scroll-region"
            data-stage={stage.stage}
          >
            <p className="bot-progress-state" role="status">
              <StageLabel stage={stage.stage} />
            </p>
            {stage.stage === "noDevice" && session && (
              <>
                <p>{t("linkDeviceHelp")}</p>
                <ConnectDsh
                  session={session}
                  server={server}
                  idPrefix="bot-"
                  bare
                />
              </>
            )}
            {stage.stage === "deviceOffline" && <p>{t("deviceOfflineHelp")}</p>}
            {(stage.stage === "starting" ||
              stage.stage === "connecting" ||
              stage.stage === "offline") && (
              <p>{t("startingHelp", { name: bot.displayName })}</p>
            )}
            {stage.stage === "notHere" && (
              <p>{t("notHereHelp", { name: bot.displayName })}</p>
            )}
            {online && <p>{t("onlineHelp", { name: bot.displayName })}</p>}
            {online && (
              <DecisionWarning
                device={managed.devices.find(
                  (device) => device.id === bot.settings.deviceId,
                )}
              />
            )}
            {stage.detail && (
              <p className="settings-feedback error-text" role="alert">
                {stage.detail}
              </p>
            )}
          </ScrollArea>
          <footer className="dialog-footer">
            <div className="settings-actions">
              {online && (
                <Button
                  id="create-bot-chat"
                  type="button"
                  disabled={!participant}
                  onClick={() => participant && onDirect(participant.id)}
                >
                  {t("chat")}
                </Button>
              )}
              <Button
                id="create-bot-done"
                type="button"
                variant={online ? "secondary" : "default"}
                onClick={onClose}
              >
                {t("done")}
              </Button>
            </div>
          </footer>
        </>
      ) : (
        <form id="create-bot-form" onSubmit={(event) => void submit(event)}>
          <ScrollArea className="dialog-scroll-region">
            <p>{t(managed.available ? "createHelp" : "needsCentral")}</p>
            {managed.available && (
              <BotSetupFields
                idPrefix="create-bot"
                value={chosen}
                devices={managed.devices}
                disabled={busy}
                onChange={setSetup}
              />
            )}
            {(error || managed.error) && (
              <p className="settings-feedback error-text" role="alert">
                {error || managed.error}
              </p>
            )}
          </ScrollArea>
          <footer className="dialog-footer">
            <Button
              id="create-bot-submit"
              type="submit"
              disabled={
                !managed.available || busy || !chosen.displayName.trim()
              }
            >
              {t(busy ? "creating" : "create")}
            </Button>
          </footer>
        </form>
      )}
    </dialog>
  );
}
