import { useState } from "react";
import type { FormEvent } from "react";
import { Button, Input } from "../../../ui/controls";
import { Field } from "../../../ui/form";
import { ApiError, messageOf } from "../api";
import { updateProfile } from "../central";
import { useTranslation } from "../locale";
import { settingsMessages } from "../locales/settings";
import type { Session } from "../types";

/** The person's own display name, kept on the central server like their avatar. Bots change theirs with a tool. */
export function NameEditor({
  session,
  name,
  onChanged,
}: {
  session: Session;
  name: string;
  onChanged?(): void;
}) {
  const t = useTranslation(settingsMessages);
  const [value, setValue] = useState(name);
  const [saved, setSaved] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const issuer = session.binding?.centralIssuer;
  const token = session.central?.token;
  if (!issuer || !token) return null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!issuer || !token) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const account = await updateProfile(issuer, token, {
        displayName: value.trim(),
      });
      setValue(account.displayName);
      setSaved(account.displayName);
      setNotice(t("nameSaved"));
      onChanged?.();
    } catch (reason) {
      setError(
        reason instanceof ApiError && reason.code === "DISPLAY_NAME_INVALID"
          ? t("nameInvalid")
          : messageOf(reason),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      id="profile-name-form"
      className="profile-name-form"
      onSubmit={(event) => void submit(event)}
    >
      <Field
        label={t("displayName")}
        htmlFor="profile-display-name"
        description={t("displayNameHelp")}
        error={error || undefined}
      >
        <Input
          id="profile-display-name"
          maxLength={80}
          autoComplete="nickname"
          required
          value={value}
          disabled={busy}
          aria-describedby={
            error
              ? "profile-display-name-error"
              : "profile-display-name-description"
          }
          onChange={(event) => {
            setValue(event.target.value);
            setNotice("");
          }}
        />
      </Field>
      <div className="settings-actions">
        <Button
          type="submit"
          variant="secondary"
          disabled={busy || !value.trim() || value.trim() === saved}
        >
          {t("saveName")}
        </Button>
        <p className="settings-feedback" role="status">
          {notice}
        </p>
      </div>
    </form>
  );
}
