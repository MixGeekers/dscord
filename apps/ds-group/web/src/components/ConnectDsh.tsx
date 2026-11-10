import { useEffect, useState } from "react";
import { Button, Textarea } from "../../../ui/controls";
import { messageOf } from "../api";
import { connectionKey } from "../central";
import { useTranslation } from "../locale";
import { settingsMessages } from "../locales/settings";
import type { Session } from "../types";

/**
 * Makes a one-time connection key for the person's DSH and copies it in the same click. The key names this
 * chat server and a central code, so pasting it is all DSH needs to sign in and add this server. `idPrefix`
 * keeps the control ids apart where the page shows this more than once; `bare` leaves out the heading.
 */
export function ConnectDsh({
  session,
  server,
  idPrefix = "",
  bare = false,
}: {
  session: Session;
  server: string;
  idPrefix?: string;
  bare?: boolean;
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
  async function write(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  async function make() {
    if (!issuer || !token) return;
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      const made = await connectionKey(issuer, token, server);
      setKey({ value: made.key, minutes: Math.round(made.expiresIn / 60) });
      await write(made.key);
    } catch (reason) {
      setKey(null);
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  }
  const id = (name: string) => `${idPrefix}${name}`;
  return (
    <section
      className={bare ? "connect-dsh connect-dsh-bare" : "connect-dsh"}
      aria-label={t("connectDsh")}
    >
      {!bare && <h3>{t("connectDsh")}</h3>}
      {!bare && <p className="settings-feedback">{t("connectDshHelp")}</p>}
      {!token || !issuer ? (
        <p className="settings-feedback">{t("connectionKeyNeedsSignIn")}</p>
      ) : (
        <>
          {key && (
            <>
              <label htmlFor={id("connection-key")}>{t("connectionKey")}</label>
              <Textarea
                id={id("connection-key")}
                className="connection-key"
                readOnly
                rows={4}
                value={key.value}
                onFocus={(event) => event.currentTarget.select()}
              />
              <p className="settings-feedback" role="status">
                {t(copied ? "connectionKeyCopied" : "connectionKeyNotCopied")}
              </p>
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
            {key && (
              <Button
                id={id("copy-connection-key")}
                type="button"
                onClick={() => void write(key.value)}
              >
                {t(copied ? "copiedConnectionKey" : "copyConnectionKey")}
              </Button>
            )}
            <Button
              id={id("make-connection-key")}
              type="button"
              variant={key ? "secondary" : "default"}
              disabled={busy}
              onClick={() => void make()}
            >
              {t(
                busy
                  ? "makingConnectionKey"
                  : key
                    ? "remakeConnectionKey"
                    : "makeConnectionKey",
              )}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
