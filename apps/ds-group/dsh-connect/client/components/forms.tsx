import { Button } from "@deepseek-ai/dsh-client-ui-primitives";
import type { Connection, Snapshot } from "../connection";
import type { Translate } from "../locale";
import type { ConnectionState } from "../types";

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
 * Links this DSH with a connection key from the DSCord web page. Pasting a whole key links at once, and the key
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
