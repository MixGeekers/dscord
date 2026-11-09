import { useEffect, useState } from "react";
import { Button, Textarea } from "../../../ui/controls";
import { messageOf } from "../api";
import { connectionKey } from "../central";
import { useTranslation } from "../locale";
import { settingsMessages } from "../locales/settings";
import type { Session } from "../types";

/**
 * Makes a one-time connection key for the person's DSH. The key names this chat server and a
 * central code, so pasting it is all DSH needs to sign in and add this server.
 */
export function ConnectDsh({
  session,
  server,
}: {
  session: Session;
  server: string;
}) {
  const t = useTranslation(settingsMessages);
  const [key, setKey] = useState<{ value: string; minutes: number } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const issuer = session.binding?.centralIssuer;
  const token = session.central?.token;
  // A key belongs to the account that made it.
  useEffect(() => {
    setKey(null);
    setError("");
  }, [token]);
  async function make() {
    if (!issuer || !token) return;
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      const made = await connectionKey(issuer, token, server);
      setKey({ value: made.key, minutes: Math.round(made.expiresIn / 60) });
    } catch (reason) {
      setKey(null);
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key.value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return (
    <section className="connect-dsh" aria-labelledby="connect-dsh-title">
      <h3 id="connect-dsh-title">{t("connectDsh")}</h3>
      <p className="settings-feedback">{t("connectDshHelp")}</p>
      {!token || !issuer ? (
        <p className="settings-feedback">{t("connectionKeyNeedsSignIn")}</p>
      ) : (
        <>
          {key && (
            <>
              <label htmlFor="connection-key">{t("connectionKey")}</label>
              <Textarea
                id="connection-key"
                className="connection-key"
                readOnly
                rows={4}
                value={key.value}
                onFocus={(event) => event.currentTarget.select()}
              />
              <p className="small muted">
                {t("connectionKeyExpiry", { minutes: key.minutes })}
              </p>
            </>
          )}
          {error && (
            <p className="settings-feedback error-text" role="alert">
              {error}
            </p>
          )}
          <div className="connect-dsh-actions">
            <Button
              id="make-connection-key"
              type="button"
              variant={key ? "secondary" : "default"}
              disabled={busy}
              onClick={() => void make()}
            >
              {t(busy ? "makingConnectionKey" : "makeConnectionKey")}
            </Button>
            {key && (
              <Button
                id="copy-connection-key"
                type="button"
                onClick={() => void copy()}
              >
                {t(copied ? "copiedConnectionKey" : "copyConnectionKey")}
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
