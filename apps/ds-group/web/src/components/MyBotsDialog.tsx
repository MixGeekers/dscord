import { AvatarEditor } from "./AvatarEditor";
import { Avatar } from "./Avatar";
import { Button } from "../../../ui/controls";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { messageOf } from "../api";
import { removeDevice, updateBot } from "../central";
import type { Device, ManagedBot } from "../central";
import { useTranslation } from "../locale";
import { spaceMessages } from "../locales/spaces";
import { Icon } from "./Icons";
import { botMessages } from "../locales/bots";
import { botHomeMessages } from "../locales/bot-home";
import { kernelMessages } from "../locales/kernel";
import { connectionLabel } from "../bot-kernel";
import { botStage, sameServer, useManagedBots } from "../managed-bots";
import type { ManagedBots } from "../managed-bots";
import type { Participant, ServerStatus, Session } from "../types";
import { BotSetupFields, DecisionWarning, StageLabel } from "./BotSetup";
import type { BotSetup } from "./BotSetup";
import { ConnectDsh } from "./ConnectDsh";

const setupOf = (bot: ManagedBot): BotSetup => ({
  displayName: bot.displayName,
  role: bot.settings.role,
  model: bot.settings.model,
  deviceId: bot.settings.deviceId ?? "",
});

/** The form that changes one Bot's setup at the central server. It starts from the Bot as it is when opened. */
function BotSettingsForm({
  bot,
  server,
  managed,
  session,
}: {
  bot: ManagedBot;
  server: string;
  managed: ManagedBots;
  session: Session | null;
}) {
  const t = useTranslation(botMessages);
  const [setup, setSetup] = useState(() => setupOf(bot));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const here = bot.settings.servers.some((item) => sameServer(item, server));

  async function change(input: Parameters<typeof updateBot>[3]) {
    setBusy(true);
    setSaved(false);
    setError("");
    try {
      setSetup(
        setupOf(await updateBot(managed.issuer, managed.token, bot.id, input)),
      );
      setSaved(true);
      await managed.reload();
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void change({
      displayName: setup.displayName.trim(),
      role: setup.role.trim(),
      model: setup.model,
      deviceId: setup.deviceId || null,
    });
  }
  return (
    <form className="bot-setup-form" onSubmit={submit}>
      {session && (
        <AvatarEditor
          session={session}
          botId={bot.id}
          member={{
            id: bot.id,
            globalId: bot.globalId,
            name: bot.displayName,
            kind: "bot",
            avatar: bot.avatar,
            profileVersion: bot.profileVersion,
          }}
          onChanged={() => void managed.reload()}
        />
      )}
      <BotSetupFields
        idPrefix={`bot-${bot.id}`}
        value={setup}
        devices={managed.devices}
        disabled={busy}
        onChange={(next) => {
          setSetup(next);
          setSaved(false);
        }}
      />
      {bot.runtime?.model && (
        <p className="small muted">
          {t("runningModel", { model: bot.runtime.model })}
        </p>
      )}
      {error && (
        <p className="settings-feedback error-text" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="settings-feedback" role="status">
          {t("saved")}
        </p>
      )}
      <div className="settings-actions">
        <Button
          type="submit"
          data-save-bot={bot.id}
          disabled={busy || !setup.displayName.trim()}
        >
          {t(busy ? "saving" : "save")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          data-bot-here={bot.id}
          disabled={busy}
          onClick={() =>
            void change({
              servers: here
                ? bot.settings.servers.filter(
                    (item) => !sameServer(item, server),
                  )
                : [...bot.settings.servers, server],
            })
          }
        >
          {t(here ? "leaveHere" : "joinHere")}
        </Button>
      </div>
    </form>
  );
}

function DeviceRow({
  device,
  managed,
}: {
  device: Device;
  managed: ManagedBots;
}) {
  const t = useTranslation(botMessages);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const facts = [
    device.models?.defaultModel &&
      t("deviceModel", { model: device.models.defaultModel }),
    device.plugin?.version &&
      t("devicePlugin", { version: device.plugin.version }),
  ].filter(Boolean);
  return (
    <article className="space-card" data-device={device.id}>
      <header>
        <div>
          <strong>{device.label}</strong>
          {facts.length > 0 && (
            <small className="member-full-id">{facts.join(" · ")}</small>
          )}
        </div>
        <span
          className="space-state bot-stage"
          data-stage={device.online ? "online" : "deviceOffline"}
        >
          {t(device.online ? "deviceOnline" : "deviceOffline")}
        </span>
        <Button
          variant="secondary"
          type="button"
          data-remove-device={device.id}
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setError("");
            removeDevice(managed.issuer, managed.token, device.id)
              .then(() => managed.reload())
              .catch((reason) => setError(messageOf(reason)))
              .finally(() => setBusy(false));
          }}
        >
          {t("removeDevice")}
        </Button>
      </header>
      <DecisionWarning device={device} />
      {error && <p className="node-error">{error}</p>}
    </article>
  );
}

/**
 * Where the person looks after their Bots: who each one is, which device runs it, whether it is on this
 * server, and the devices themselves. Everything here is kept at the central server.
 */
export function MyBotsDialog({
  open,
  bots,
  status,
  session,
  server,
  onClose,
  onCreate,
  onHome,
  onDirect,
}: {
  open: boolean;
  bots: Participant[];
  status: ServerStatus | null;
  session: Session | null;
  /** The chat server this page shows. */
  server: string;
  onClose(): void;
  onCreate(): void;
  onHome(id: string): void;
  onDirect(id: string): void;
}) {
  const t = useTranslation(spaceMessages);
  const kernelText = useTranslation(kernelMessages);
  const b = useTranslation(botMessages);
  const homeText = useTranslation(botHomeMessages);
  const dialog = useRef<HTMLDialogElement>(null);
  const managed = useManagedBots(session, open);
  const [editing, setEditing] = useState<string | null>(null);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open) {
      dialog.current?.close();
      setEditing(null);
    }
  }, [open]);
  const owned = bots.filter((bot) => bot.ownerId === session?.user_id);
  // A Bot is one row whether this server knows it yet or not; the central account is what ties the two together.
  const rows: { key: string; bot?: ManagedBot; participant?: Participant }[] = [
    ...managed.bots.map((bot) => ({
      key: bot.globalId,
      bot,
      participant: owned.find((item) => item.globalId === bot.globalId),
    })),
    ...owned
      .filter(
        (item) => !managed.bots.some((bot) => bot.globalId === item.globalId),
      )
      .map((participant) => ({
        key: participant.globalId ?? participant.id,
        participant,
      })),
  ];
  return (
    <dialog
      id="my-bots-dialog"
      className="settings-dialog"
      ref={dialog}
      aria-labelledby="my-bots-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="dialog-heading">
        <h2 id="my-bots-title">{t("myBots")}</h2>
        <Button
          variant="ghost"
          size="icon"
          className="icon-button"
          type="button"
          aria-label={t("close")}
          onClick={onClose}
        >
          <Icon name="close" />
        </Button>
      </header>
      <div className="dialog-scroll-region">
        <p className="muted">
          {b(managed.available ? "manageHelp" : "needsCentral")}
        </p>
        {managed.error && (
          <p className="settings-feedback error-text" role="alert">
            {managed.error}
          </p>
        )}
        <div className="space-list">
          {rows.map(({ key, bot, participant }) => {
            const node = participant
              ? status?.nodes.find((value) => value.botId === participant.id)
              : undefined;
            const stage = bot ? botStage(bot, server) : null;
            const name = bot?.displayName ?? participant?.name ?? "";
            const problem = stage?.detail ?? (bot ? "" : node?.lastError);
            return (
              <article
                className="space-card"
                data-owned-bot={participant?.id}
                data-managed-bot={bot?.id}
                key={key}
              >
                <header>
                  <Avatar
                    member={{
                      ...participant,
                      ...bot,
                      name,
                      kind: "bot",
                      id: participant?.id ?? bot?.id,
                    }}
                  />
                  <div>
                    <strong>{name}</strong>
                    <small className="member-full-id">
                      {bot?.globalId ?? participant?.id}
                    </small>
                  </div>
                  {stage ? (
                    <StageLabel stage={stage.stage} />
                  ) : (
                    <span className="space-state">
                      {kernelText(connectionLabel(node?.status))}
                    </span>
                  )}
                  {participant && (
                    <>
                      <Button
                        variant="secondary"
                        className="secondary-button"
                        type="button"
                        data-bot-home-button={participant.id}
                        onClick={() => onHome(participant.id)}
                      >
                        <Icon name="bot" />
                        {homeText("home")}
                      </Button>
                      <Button
                        variant="secondary"
                        className="secondary-button"
                        type="button"
                        onClick={() => onDirect(participant.id)}
                      >
                        {t("message")}
                      </Button>
                    </>
                  )}
                  {bot && (
                    <Button
                      variant="secondary"
                      className="secondary-button"
                      type="button"
                      data-bot-setup-button={bot.id}
                      aria-expanded={editing === bot.id}
                      onClick={() =>
                        setEditing(editing === bot.id ? null : bot.id)
                      }
                    >
                      <Icon name="gear" />
                      {b("settings")}
                    </Button>
                  )}
                </header>
                {problem && <p className="node-error">{problem}</p>}
                {bot && editing === bot.id && (
                  <BotSettingsForm
                    session={session}
                    bot={bot}
                    server={server}
                    managed={managed}
                  />
                )}
              </article>
            );
          })}
        </div>
        {!rows.length && <p className="muted">{t("noBots")}</p>}
        {managed.available && session && (
          <section className="bot-devices" aria-labelledby="bot-devices-title">
            <h3 id="bot-devices-title">{b("devices")}</h3>
            <p className="muted">{b("devicesHelp")}</p>
            <div className="space-list">
              {managed.devices.map((device) => (
                <DeviceRow key={device.id} device={device} managed={managed} />
              ))}
            </div>
            {managed.loaded && !managed.devices.length && (
              <p className="muted">{b("noDevices")}</p>
            )}
            <details
              className="bot-runtime-details"
              open={!managed.devices.length && managed.loaded}
            >
              <summary>{b("connectDevice")}</summary>
              <p>{b("linkDeviceHelp")}</p>
              <ConnectDsh
                session={session}
                server={server}
                idPrefix="device-"
                bare
              />
            </details>
          </section>
        )}
      </div>
      <footer className="dialog-footer">
        <Button
          variant="default"
          id="manage-create-bot"
          className="primary-button"
          type="button"
          disabled={!session}
          onClick={onCreate}
        >
          {t("createBot")}
        </Button>
      </footer>
    </dialog>
  );
}
