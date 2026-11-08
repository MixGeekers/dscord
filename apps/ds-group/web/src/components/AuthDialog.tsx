import { Button, Input } from "../../../ui/controls";
import { useEffect, useRef, useState } from "react";
import type { FormEvent, MouseEvent } from "react";
import { messageOf } from "../api";
import { useTranslation } from "../locale";
import { authMessages } from "../locales/auth";
import type { CentralInfo } from "../central";
import type { Session } from "../types";
import { Icon } from "./Icons";

export interface AuthSubmission {
  mode: "login" | "register";
  username: string;
  password: string;
  displayName: string;
}

export interface AuthDialogProps {
  open: boolean;
  /** The central server whose accounts sign in here. */
  central: CentralInfo | null;
  session: Session | null;
  busy: boolean;
  error: string;
  rateLimitUntil?: number | null;
  onSubmit(input: AuthSubmission): void | Promise<void>;
  onClearError?(): void;
  onClose(): void;
}

type Mode = AuthSubmission["mode"];
type Field = "username" | "password" | "displayName";

export function AuthDialog({
  open,
  central,
  session,
  busy,
  error,
  rateLimitUntil = null,
  onSubmit,
  onClearError,
  onClose,
}: AuthDialogProps) {
  const t = useTranslation(authMessages);
  const dialog = useRef<HTMLDialogElement>(null);
  const usernameInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const displayNameInput = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  const editedUsername = useRef(false);
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedMode, setSubmittedMode] = useState<Mode | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<Field, boolean>>
  >({});
  const [localError, setLocalError] = useState("");
  const [currentTime, setCurrentTime] = useState(Date.now);
  const registrationOpen = central?.registration === "open";
  const registering = mode === "register" && registrationOpen;
  const disabled = busy || submitting;
  const canClose = Boolean(session) && !disabled;
  const retrySeconds = Math.max(
    0,
    Math.ceil(((rateLimitUntil ?? 0) - currentTime) / 1000),
  );
  const requestError =
    rateLimitUntil === null
      ? error
      : retrySeconds > 0
        ? t("rateLimitedFor", { seconds: retrySeconds })
        : t("rateLimited");
  const visibleError =
    localError || (submittedMode === mode ? requestError : "");

  useEffect(() => {
    setCurrentTime(Date.now());
    if (!open || !rateLimitUntil || rateLimitUntil <= Date.now()) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setCurrentTime(now);
      if (now >= rateLimitUntil) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [open, rateLimitUntil]);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setMode("login");
    setPassword("");
    setShowPassword(false);
    setFieldErrors({});
    setLocalError("");
    setSubmittedMode(null);
  }, [open]);

  useEffect(() => {
    if (!open || editedUsername.current || !session) return;
    // A local Matrix ID is the central username on this server.
    setUsername(session.user_id.slice(1, session.user_id.indexOf(":")));
  }, [open, session?.user_id]);

  useEffect(() => {
    if (!registrationOpen) setMode("login");
  }, [registrationOpen]);

  function changeMode() {
    if (disabled) return;
    setMode(registering ? "login" : "register");
    setFieldErrors({});
    setLocalError("");
    setSubmittedMode(null);
    setShowPassword(false);
    onClearError?.();
  }

  function clearFieldError(field: Field) {
    setFieldErrors((previous) => ({ ...previous, [field]: false }));
    setLocalError("");
    setSubmittedMode(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || pending.current) return;
    const errors = {
      username: username.trim().length === 0,
      password: password.length === 0,
      displayName: registering && displayName.trim().length === 0,
    };
    setFieldErrors(errors);
    if (errors.username) {
      usernameInput.current?.focus();
      return;
    }
    if (errors.displayName) {
      displayNameInput.current?.focus();
      return;
    }
    if (errors.password) {
      passwordInput.current?.focus();
      return;
    }
    const submitted = registering ? "register" : "login";
    setSubmittedMode(submitted);
    setLocalError("");
    pending.current = true;
    setSubmitting(true);
    try {
      await onSubmit({
        mode: submitted,
        username: username.trim(),
        password,
        displayName: displayName.trim(),
      });
    } catch (cause) {
      setLocalError(messageOf(cause));
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  }

  function dismissBackdrop(event: MouseEvent<HTMLDialogElement>) {
    if (!canClose || event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    )
      onClose();
  }

  return (
    <dialog
      ref={dialog}
      id="login-dialog"
      className="login-dialog"
      aria-labelledby="login-title"
      onCancel={(event) => {
        event.preventDefault();
        if (canClose) onClose();
      }}
      onClick={dismissBackdrop}
    >
      <form id="login-form" noValidate onSubmit={(event) => void submit(event)}>
        <div className="dialog-heading">
          <h2 id="login-title">
            {t(registering ? "createAccount" : "signIn")}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            id="close-login"
            className="icon-button"
            type="button"
            aria-label={t("close")}
            hidden={!session}
            disabled={disabled}
            onClick={onClose}
          >
            <Icon name="close" />
          </Button>
        </div>
        <div className="dialog-scroll-region">
          {central && (
            <p id="login-central" className="auth-central">
              {t(registering ? "centralRegister" : "centralSignIn", {
                host: central.host,
              })}
            </p>
          )}
          <label htmlFor="login-user">{t("username")}</label>
          <Input
            id="login-user"
            ref={usernameInput}
            type="text"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={username}
            disabled={disabled}
            aria-invalid={Boolean(fieldErrors.username)}
            aria-describedby={
              fieldErrors.username ? "username-error" : undefined
            }
            onChange={(event) => {
              editedUsername.current = true;
              setUsername(event.target.value);
              clearFieldError("username");
            }}
          />
          {fieldErrors.username && (
            <p id="username-error" className="field-error" role="alert">
              {t("usernameRequired")}
            </p>
          )}
          {registering && (
            <>
              <label htmlFor="register-name">{t("displayName")}</label>
              <Input
                id="register-name"
                ref={displayNameInput}
                type="text"
                name="displayName"
                autoComplete="nickname"
                required
                value={displayName}
                disabled={disabled}
                aria-invalid={Boolean(fieldErrors.displayName)}
                aria-describedby={
                  fieldErrors.displayName ? "display-name-error" : undefined
                }
                onChange={(event) => {
                  setDisplayName(event.target.value);
                  clearFieldError("displayName");
                }}
              />
              {fieldErrors.displayName && (
                <p id="display-name-error" className="field-error" role="alert">
                  {t("displayNameRequired")}
                </p>
              )}
            </>
          )}
          <label htmlFor="login-password">{t("password")}</label>
          <div className="auth-password-field">
            <Input
              id="login-password"
              ref={passwordInput}
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete={registering ? "new-password" : "current-password"}
              required
              value={password}
              disabled={disabled}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={
                fieldErrors.password ? "password-error" : undefined
              }
              onChange={(event) => {
                setPassword(event.target.value);
                clearFieldError("password");
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              id="password-toggle"
              className="icon-button"
              type="button"
              aria-label={t(showPassword ? "hidePassword" : "showPassword")}
              aria-pressed={showPassword}
              disabled={disabled}
              onClick={() => setShowPassword((previous) => !previous)}
            >
              <Icon name={showPassword ? "eyeOff" : "eye"} />
            </Button>
          </div>
          {fieldErrors.password && (
            <p id="password-error" className="field-error" role="alert">
              {t("passwordRequired")}
            </p>
          )}
          <div
            id="login-error"
            className="login-error"
            role="alert"
            hidden={!visibleError}
          >
            {visibleError}
          </div>
        </div>
        <footer className="dialog-footer">
          <Button
            variant="default"
            id="login-submit"
            className="primary-button login-submit"
            type="submit"
            disabled={disabled}
          >
            {t(
              registering
                ? disabled
                  ? "creatingAccount"
                  : "createAccount"
                : disabled
                  ? "signingIn"
                  : "signIn",
            )}
          </Button>
          {registrationOpen && (
            <Button
              variant="ghost"
              id="auth-toggle-mode"
              className="text-button auth-mode-switch"
              type="button"
              disabled={disabled}
              onClick={changeMode}
            >
              {t(registering ? "backToSignIn" : "createAccount")}
            </Button>
          )}
        </footer>
      </form>
    </dialog>
  );
}
