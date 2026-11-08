import { Button } from "../../../ui/controls";
import { useEffect, useRef } from "react";
import { useTranslation } from "../locale";
import { botMessages } from "../locales/bots";
import { Icon } from "./Icons";

export interface CreateBotDialogProps {
  open: boolean;
  onClose(): void;
}

/** Bots are central accounts that DSH creates and runs, so this page explains where to add one. */
export function CreateBotDialog({ open, onClose }: CreateBotDialogProps) {
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
        <p className="muted">{t("nativeHelp")}</p>
        <div className="bot-node-help">
          <h3>
            <Icon name="server" />
            {t("nodeConnection")}
          </h3>
          <p>{t("nodeConnectionHelp")}</p>
        </div>
        <p className="muted">{t("nativeLifecycle")}</p>
      </div>
      <footer className="dialog-footer">
        <Button id="create-bot-done" onClick={onClose}>
          {t("close")}
        </Button>
      </footer>
    </dialog>
  );
}
