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
  form.elements.namedItem(name) as HTMLInputElement;

/** Signs in to central through any chat server that trusts it; the password never stays in the form. */
export function LoginForm({ connection, state, t }: PageProps) {
  const busy = Boolean(state.busy);
  return (
    <form
      className="dc-panel dc-login"
      aria-label={t("loginTitle")}
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const passwordInput = field(form, "password");
        const password = passwordInput.value;
        passwordInput.value = "";
        void connection.login(
          field(form, "serverUrl").value.trim(),
          field(form, "user").value.trim(),
          password,
          field(form, "inviteCode").value.trim(),
        );
      }}
    >
      <h2>{t("loginTitle")}</h2>
      <p className="dc-muted">{t("loginHelp")}</p>
      <label className="dc-field">
        {t("serverUrl")}
        <Input
          name="serverUrl"
          type="url"
          required
          defaultValue={state.value?.servers?.[0]?.url || ""}
          placeholder="https://chat.example.com"
          autoComplete="url"
          disabled={busy}
        />
      </label>
      <label className="dc-field">
        {t("username")}
        <Input
          name="user"
          type="text"
          required
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          disabled={busy}
        />
      </label>
      <label className="dc-field">
        {t("password")}
        <Input
          name="password"
          type="password"
          required
          autoComplete="off"
          disabled={busy}
        />
      </label>
      <label className="dc-field">
        {t("inviteCodeOptional")}
        <Input
          name="inviteCode"
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={20}
          placeholder="ABCD-2345"
          disabled={busy}
        />
      </label>
      <Button
        variant="primary"
        type="submit"
        className="dc-primary"
        disabled={busy}
      >
        {t(state.busy?.action === "login" ? "loggingIn" : "login")}
      </Button>
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
    <div className="dc-model-settings">
      <form
        className="dc-model-form"
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
          variant="primary"
          className="dc-primary"
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
        <p className="dc-model-info" role="status">
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
 * Creates a Bot on this node. A creation whose answer was lost keeps its request id in session storage, so trying
 * again confirms the same creation instead of making a second Bot.
 */
export function CreateLocalBot({ connection, state, value, t }: ReadyProps) {
  const catalog = value.models;
  const models = (catalog?.providers || []).flatMap(
    (provider) => provider.models,
  );
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
  const [name, setName] = useState(draft?.input.name || "");
  const [role, setRole] = useState(draft?.input.role || "");
  const [model, setModel] = useState(
    draft?.input.model || catalog?.defaultSelection?.model || "",
  );
  const [uncertain, setUncertain] = useState(Boolean(draft));
  const disabled = Boolean(state.busy);
  const usable = models.some((item) => item.model === model && !item.needsKey);
  return (
    <details className="dc-create">
      <summary>{t("newBot")}</summary>
      <form
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
          const created = await connection.createNative({
            ...input,
            requestId: pending.current.requestId,
          });
          if (created) {
            pending.current = null;
            setUncertain(false);
            setName("");
            setRole("");
            try {
              sessionStorage.removeItem(storageKey);
            } catch {
              // Storage may be disabled by the host.
            }
          } else setUncertain(true);
        }}
      >
        <label className="dc-field">
          {t("botName")}
          <Input
            name="botName"
            required
            maxLength={80}
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
            value={role}
            onChange={(event) => {
              setRole(event.target.value);
              setUncertain(false);
            }}
            disabled={disabled}
            autoComplete="off"
          />
        </label>
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
            disabled={disabled}
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
        {uncertain && (
          <p role="status" className="dc-muted dc-model-info">
            {t("creationPending")}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={disabled || !usable}>
          {t(
            state.busy?.action === "create-native"
              ? "creatingLocal"
              : uncertain
                ? "confirmCreation"
                : "createLocal",
          )}
        </Button>
      </form>
    </details>
  );
}
