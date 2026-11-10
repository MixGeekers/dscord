import { Button } from "../../../ui/controls";
import { useEffect, useRef } from "react";
import { useTranslation } from "../locale";
import { botMessages } from "../locales/bots";
import type { Session } from "../types";
import { ConnectDsh } from "./ConnectDsh";
import { Icon } from "./Icons";

export interface CreateBotDialogProps {
  open: boolean;
  session: Session | null;
  server: string;
  onClose(): void;
}

/**
 * Bots are central accounts that DSH creates and runs, so adding one starts here with the connection key DSH
 * asks for, and the three steps that end with the Bot online.
 */
export function CreateBotDialog({
  open,
  session,
  server,
  onClose,
}: CreateBotDialogProps) {
  const t = useTranslation(botMessages);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open) dialog.current?.close();
  }, [open]);
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
        <h2 id="create-bot-title">{t("createBot")}</h2>
        <Button
          id="close-create-bot"
          variant="ghost"
          size="icon"
          aria-label={t("close")}
          onClick={onClose}
        >
          <Icon name="close" />
        </Button>
      </header>
      <div className="dialog-scroll-region">
        <p>{t("nativeHelp")}</p>
        <ol className="bot-add-steps">
          <li>{t("nodeConnection")}</li>
          <li>
            {t("copyKeyStep")}
            {session && open && (
              <ConnectDsh
                session={session}
                server={server}
                idPrefix="bot-"
                bare
              />
            )}
          </li>
          <li>{t("nodeConnectionHelp")}</li>
        </ol>
        <p className="muted small">{t("nativeLifecycle")}</p>
      </div>
      <footer className="dialog-footer">
        <Button id="create-bot-done" onClick={onClose}>
          {t("close")}
        </Button>
      </footer>
    </dialog>
  );
}
