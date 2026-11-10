import { useRef, useState } from "react";
import { Button, Input } from "@deepseek-ai/dsh-client-ui-primitives";
import type { Connection, Snapshot } from "../connection";
import type { Translate } from "../locale";
import type { ConnectionState, ServerBot } from "../types";

export interface PageProps {
  connection: Connection;
  state: Snapshot;
  t: Translate;
}
/** A part of the page that only shows once the status has been read. */
export interface ReadyProps extends PageProps {
  value: ConnectionState;
}

const field = (form: HTMLFormElement, name: string) =>
  form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement;

/** Whether pasted text is a whole connection key: base64url JSON naming a chat server and a one-time code. */
function isConnectionKey(text: string) {
  if (!/^[A-Za-z0-9_-]{16,}$/.test(text)) return false;
  try {
    const value = JSON.parse(
      atob(text.replace(/-/g, "+").replace(/_/g, "/")),
    ) as { server?: unknown; code?: unknown };
    return typeof value.server === "string" && typeof value.code === "string";
  } catch {
    return false;
  }
}

/**
 * Signs in with a connection key from the DSCord web page. Pasting a whole key signs in at once, and the key
 * never stays in the form.
 */
export function LoginForm({ connection, state, t }: PageProps) {
  const busy = Boolean(state.busy);
  return (
    <form
      className="dc-panel dc-login"
      aria-label={t("loginTitle")}
      onSubmit={(event) => {
        event.preventDefault();
        const input = field(event.currentTarget, "connectionKey");
        const key = input.value.trim();
        input.value = "";
        if (key) void connection.login(key);
      }}
    >
      <h2>{t("loginTitle")}</h2>
      <ol className="dc-how">
        <li>{t("loginStep1")}</li>
        <li>{t("loginStep2")}</li>
        <li>{t("loginStep3")}</li>
      </ol>
      <div className="dc-field">
        <label className="dc-field">
          {t("connectionKey")}
          <textarea
            name="connectionKey"
            className="dc-key"
            required
            rows={3}
            placeholder={t("keyPlaceholder")}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            disabled={busy}
            onPaste={(event) => {
              const key = event.clipboardData.getData("text").trim();
              if (!isConnectionKey(key)) return;
              event.preventDefault();
              event.currentTarget.value = "";
              void connection.login(key);
            }}
          />
        </label>
        <span className="dc-hint">{t("keyHint")}</span>
      </div>
      <div className="dc-actions">
        <Button variant="primary" type="submit" disabled={busy}>
          {t(state.busy?.action === "login" ? "loggingIn" : "login")}
        </Button>
      </div>
    </form>
  );
}

/** Picks the model a Bot runs on from the models DSH has configured. */
export function ModelForm({
  bot,
  connection,
  state,
  value,
  t,
}: ReadyProps & { bot: ServerBot }) {
  const catalog = value.models;
  const models = (catalog?.providers || []).flatMap(
    (provider) => provider.models,
  );
  const saved = bot.modelSelection || catalog?.defaultSelection;
  const [reference, setReference] = useState(saved?.model || "");
  const selected = models.find((model) => model.model === reference);
  const pending =
    !value.nativeMode &&
    bot.activeModel &&
    bot.modelSelection &&
    bot.activeModel.model !== bot.modelSelection.model;
  return (
    <div className="dc-section">
      <form
        className="dc-inline"
        onSubmit={(event) => {
          event.preventDefault();
          void connection.saveModel(bot.id, { model: reference });
        }}
      >
        <label className="dc-field">
          {t("model")}
          <select
            name="model"
            aria-label={t("model")}
            required
            value={reference}
            disabled={Boolean(state.busy)}
            onChange={(event) => setReference(event.target.value)}
          >
            {!reference && <option value="">{t("noModel")}</option>}
            {reference && !selected && (
              <option value={reference} disabled>
                {`${reference} · ${t("modelUnavailable")}`}
              </option>
            )}
            {(catalog?.providers || [])
              .filter((provider) => provider.models.length)
              .map((provider) => (
                <optgroup key={provider.id} label={provider.name}>
                  {provider.models.map((model) => (
                    <option key={model.model} value={model.model}>
                      {model.name}
                    </option>
                  ))}
                </optgroup>
              ))}
          </select>
        </label>
        <Button
          variant="outline"
          type="submit"
          disabled={
            Boolean(state.busy) ||
            !selected ||
            reference === bot.modelSelection?.model
          }
        >
          {t("saveModel")}
        </Button>
      </form>
      {pending && (
        <p className="dc-meta" role="status">
          {t("modelPending")}
        </p>
      )}
    </div>
  );
}

interface CreationDraft {
  requestId: string;
  fingerprint?: string;
  input: { name: string; role: string; model: string };
}

/**
 * Creates a Bot on this device and, once the account has a chat server, brings it online there in the same step.
 * A creation whose answer was lost keeps its request id in session storage, so trying again confirms the same
 * creation instead of making a second Bot.
 */
export function CreateLocalBot({
  connection,
  state,
  value,
  t,
  startOpen,
}: ReadyProps & { startOpen: boolean }) {
  const catalog = value.models;
  const models = (catalog?.providers || []).flatMap(
    (provider) => provider.models,
  );
  const servers = value.user ? value.servers || [] : [];
  const storageKey = `dscord.pending-native.${value.hostId || "local"}.${value.user?.id || "local-owner"}`;
  const [draft] = useState<CreationDraft | null>(() => {
    try {
      const stored = JSON.parse(
        sessionStorage.getItem(storageKey) || "null",
      ) as CreationDraft | null;
      return stored &&
        typeof stored.requestId === "string" &&
        (["name", "role", "model"] as const).every(
          (key) => typeof stored.input?.[key] === "string",
        )
        ? stored
        : null;
    } catch {
      return null;
    }
  });
  const pending = useRef(draft);
  const [open, setOpen] = useState(startOpen || Boolean(draft));
  const [name, setName] = useState(draft?.input.name || "");
  const [role, setRole] = useState(draft?.input.role || "");
  const [model, setModel] = useState(
    draft?.input.model || catalog?.defaultSelection?.model || "",
  );
  const [serverUrl, setServerUrl] = useState("");
  const [uncertain, setUncertain] = useState(Boolean(draft));
  const disabled = Boolean(state.busy);
  const usable = models.some((item) => item.model === model && !item.needsKey);
  const target =
    servers.find((server) => server.url === serverUrl) || servers[0];
  return (
    <details
      className="dc-disclosure dc-divided"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>{t("newBot")}</summary>
      <form
        className="dc-form"
        onSubmit={async (event) => {
          event.preventDefault();
          const input = { name: name.trim(), role: role.trim(), model };
          if (!input.name || !usable) return;
          const fingerprint = JSON.stringify(input);
          if (pending.current?.fingerprint !== fingerprint)
            pending.current = {
              input,
              fingerprint,
              requestId:
                globalThis.crypto?.randomUUID?.() ||
                `create-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
            };
          try {
            sessionStorage.setItem(storageKey, JSON.stringify(pending.current));
          } catch {
            // The live form still retains its request identity.
          }
          const created = await connection.createNative(
            { ...input, requestId: pending.current.requestId },
            target?.url,
          );
          if (created) {
            pending.current = null;
            setUncertain(false);
            setName("");
            setRole("");
            setOpen(false);
            try {
              sessionStorage.removeItem(storageKey);
            } catch {
              // Storage may be disabled by the host.
            }
          } else setUncertain(true);
        }}
      >
        {!models.length && (
          <p role="status" className="dc-notice">
            {t("modelsMissing")}
          </p>
        )}
        <label className="dc-field">
          {t("botName")}
          <Input
            name="botName"
            required
            maxLength={80}
            placeholder={t("botNamePlaceholder")}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setUncertain(false);
            }}
            disabled={disabled}
            autoComplete="off"
          />
        </label>
        <label className="dc-field">
          {t("botRole")}
          <Input
            name="botRole"
            maxLength={1000}
            placeholder={t("botRolePlaceholder")}
            value={role}
            onChange={(event) => {
              setRole(event.target.value);
              setUncertain(false);
            }}
            disabled={disabled}
            autoComplete="off"
          />
        </label>
        <div className="dc-inline">
          <label className="dc-field">
            {t("model")}
            <select
              name="localModel"
              required
              value={model}
              onChange={(event) => {
                setModel(event.target.value);
                setUncertain(false);
              }}
              disabled={disabled || !models.length}
            >
              <option value="">{t("noModel")}</option>
              {models.map((item) => (
                <option
                  key={item.model}
                  value={item.model}
                  disabled={item.needsKey === true}
                >
                  {item.name || item.model}
                </option>
              ))}
            </select>
          </label>
          {servers.length > 1 && (
            <label className="dc-field">
              {t("joinServer")}
              <select
                name="joinServer"
                value={target?.url || ""}
                onChange={(event) => setServerUrl(event.target.value)}
                disabled={disabled}
              >
                {servers.map((server) => (
                  <option key={server.url} value={server.url}>
                    {server.serverName}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {uncertain && (
          <p role="status" className="dc-meta">
            {t("creationPending")}
          </p>
        )}
        <div className="dc-actions">
          <Button
            type="submit"
            variant="primary"
            disabled={disabled || !usable}
          >
            {t(
              state.busy?.action === "create-native"
                ? "creatingLocal"
                : state.busy?.action === "attach"
                  ? "joining"
                  : uncertain
                    ? "confirmCreation"
                    : target
                      ? "createAndJoin"
                      : "createLocal",
            )}
          </Button>
          {!target && <span className="dc-meta">{t("signInToAttach")}</span>}
        </div>
      </form>
    </details>
  );
}
