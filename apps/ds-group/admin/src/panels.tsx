import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button, Checkbox, Input, NativeSelect } from "../../ui/controls";
import { Field } from "./fields";
import type { AdminState } from "./useAdmin";
import type { Administrator } from "./types";

type Props = { admin: AdminState };

export function OverviewPanel({ admin }: Props) {
  const { t, policy, overview, application, applicationStatus, number } = admin;
  return (
    <>
      <section className="admin-panel admin-metrics" aria-label={t("overview")}>
        {(
          [
            ["revision", policy?.revision || 0],
            [
              "activePartners",
              policy?.partners.filter((row) => row.enabled).length || 0,
            ],
            [
              "activeMembers",
              policy?.members.filter((row) => row.enabled).length || 0,
            ],
            ["managedRooms", policy?.rooms.length || 0],
          ] as const
        ).map(([label, value]) => (
          <div className="admin-metric" key={label}>
            <span>{t(label)}</span>
            <strong>{number(value)}</strong>
          </div>
        ))}
      </section>
      <div className="admin-overview-grid">
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <h2>{t("initialRoom")}</h2>
          </div>
          <code className="admin-primary-value">
            {overview?.initialRoomId || "—"}
          </code>
        </section>
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <h2>{t("application")}</h2>
          </div>
          {!application?.application ? (
            <p className="admin-empty">{t("noApplication")}</p>
          ) : (
            <>
              <div className="admin-application-summary">
                <span>
                  {t("revision")}{" "}
                  <strong>{application.application.revision}</strong>
                </span>
                <span
                  className={`admin-state ${application.application.status === "applied" ? "is-good" : "is-warning"}`}
                >
                  {applicationStatus(application.application.status)}
                </span>
              </div>
              {application.application.configuration?.error && (
                <div className="admin-inline-error">
                  <AlertCircle size={16} aria-hidden="true" />
                  {application.application.configuration.error}
                </div>
              )}
              {application.application.rooms.map((room) => (
                <div className="admin-application-row" key={room.roomId}>
                  <code>{room.roomId}</code>
                  <span className="admin-state">
                    {applicationStatus(room.status)}
                  </span>
                  {room.error && (
                    <span className="admin-inline-error">{room.error}</span>
                  )}
                  {room.bans.map((ban) => (
                    <span key={ban.id}>
                      {t("ban")}: {ban.id} · {applicationStatus(ban.status)}{" "}
                      {ban.error}
                    </span>
                  ))}
                </div>
              ))}
            </>
          )}
        </section>
      </div>
    </>
  );
}

export function StoragePanel({ admin }: Props) {
  const { t, policy, overview, number } = admin;
  if (!overview) return null;
  function exportPolicy() {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([JSON.stringify(policy, null, 2)], { type: "application/json" }),
    );
    link.download = `dscord-policy-${policy?.revision}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
  return (
    <div className="admin-storage-grid">
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <h2>{t("backend")}</h2>
        </div>
        <strong className="admin-primary-value">
          {overview.storage.backend}
        </strong>
        {overview.storage.bucket && (
          <dl className="admin-detail-list admin-detail-list-wide">
            <div>
              <dt>{t("bucket")}</dt>
              <dd>{overview.storage.bucket}</dd>
            </div>
            <div>
              <dt>{t("prefix")}</dt>
              <dd>{overview.storage.prefix || "—"}</dd>
            </div>
          </dl>
        )}
        <p className="admin-supporting-text">{t("storageHint")}</p>
      </section>
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <h2>{t("localFiles")}</h2>
        </div>
        {overview.storage.files.map((file) => (
          <div className="admin-record-detail" key={file.filename}>
            <code>{file.filename}</code>
            <span>{number(file.bytes)} B</span>
          </div>
        ))}
        {!overview.storage.files.length && (
          <p className="admin-empty">{t("none")}</p>
        )}
      </section>
      <section className="admin-panel admin-backup-panel">
        <div className="admin-panel-heading">
          <h2>{t("backup")}</h2>
        </div>
        <p className="admin-supporting-text">{t("backupHint")}</p>
        <Button variant="secondary" onClick={exportPolicy}>
          {t("exportPolicy")}
        </Button>
      </section>
    </div>
  );
}

export function DeploymentPanel({ admin }: Props) {
  const { t, policy, setPolicy, overview, readOnly } = admin;
  if (!policy) return null;
  return (
    <section className="admin-panel admin-deployment-panel">
      <div className="admin-panel-heading">
        <div>
          <h2>{t("serverSettings")}</h2>
          <p>{t("deploymentHint")}</p>
        </div>
      </div>
      <div className="admin-settings-grid">
        <div className="admin-settings-group">
          <h3>{t("serverIdentity")}</h3>
          <Field label={t("server")}>
            <Input readOnly value={policy.serverName} />
          </Field>
          <Field label={t("publicUrl")}>
            <Input readOnly value={overview?.publicUrl || ""} />
          </Field>
        </div>
        <div className="admin-settings-group">
          <h3>{t("requestLimits")}</h3>
          <Field label={t("upload")}>
            <Input
              type="number"
              min="0.001"
              max="50"
              step="0.001"
              placeholder={t("existingLimit")}
              disabled={readOnly}
              value={
                policy.settings.maxUploadBytes === null
                  ? ""
                  : policy.settings.maxUploadBytes / 1048576
              }
              onChange={(event) =>
                setPolicy({
                  ...policy,
                  settings: {
                    ...policy.settings,
                    maxUploadBytes: event.target.value
                      ? Math.round(Number(event.target.value) * 1048576)
                      : null,
                  },
                })
              }
            />
          </Field>
        </div>
      </div>
    </section>
  );
}

export function AdministratorsPanel({ admin }: Props) {
  const {
    t,
    session,
    administrators,
    setAdministrators,
    busy,
    api,
    action,
    remember,
    roleLabel,
    number,
  } = admin;
  const [adminEdit, setAdminEdit] = useState<Administrator | null>(null);
  if (!session) return null;
  return (
    <div
      className={`admin-section-layout ${session.administrator.role === "owner" ? "" : "is-single"}`}
    >
      <section
        className="admin-panel admin-list-panel"
        aria-label={t("administrators")}
      >
        <div className="admin-panel-heading">
          <div>
            <h2>{t("entries")}</h2>
            <p>{t("adminHint")}</p>
          </div>
          <span
            className="admin-count"
            aria-label={t("entryCount", { count: administrators.length })}
          >
            {number(administrators.length)}
          </span>
        </div>
        <div className="admin-list">
          {administrators.map((admin) => (
            <article className="admin-list-row" key={admin.username}>
              <div className="admin-row-top">
                <div className="admin-row-identity">
                  <strong>{admin.username}</strong>
                  <span>
                    {t("role")}: {roleLabel(admin.role)}
                  </span>
                </div>
                <span
                  className={`admin-state ${admin.enabled ? "is-good" : "is-muted"}`}
                >
                  {admin.enabled ? t("enabled") : t("closed")}
                </span>
              </div>
              {session.administrator.role === "owner" && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setAdminEdit(admin)}
                >
                  {t("edit")}
                </Button>
              )}
            </article>
          ))}
        </div>
      </section>
      {session.administrator.role === "owner" && (
        <form
          className="admin-panel admin-editor"
          key={adminEdit?.username || "new"}
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            void action(async () => {
              const password = String(data.get("password") || "");
              const result = await api<{
                administrators: Administrator[];
              }>("administrators", "PUT", {
                username: data.get("username"),
                role: data.get("role"),
                enabled: data.get("enabled") === "on",
                ...(password ? { password } : {}),
              });
              setAdministrators(result.administrators);
              if (data.get("username") === session.administrator.username)
                remember(null);
              setAdminEdit(null);
              form.reset();
            });
          }}
        >
          <div className="admin-panel-heading">
            <h2>
              {adminEdit ? t("editAdministrator") : t("addAdministrator")}
            </h2>
          </div>
          <div className="admin-form-fields">
            <Field label={t("username")}>
              <Input
                name="username"
                required
                pattern="[a-z][a-z0-9_.-]{2,63}"
                defaultValue={adminEdit?.username || ""}
              />
            </Field>
            <Field label={t("role")}>
              <NativeSelect
                name="role"
                defaultValue={adminEdit?.role || "operator"}
              >
                <option value="owner">{t("ownerRole")}</option>
                <option value="operator">{t("operatorRole")}</option>
                <option value="auditor">{t("auditorRole")}</option>
              </NativeSelect>
            </Field>
            <Field label={t("newPassword")}>
              <Input
                name="password"
                type="password"
                minLength={12}
                autoComplete="new-password"
                required={!adminEdit}
              />
            </Field>
            <label className="admin-checkbox">
              <Checkbox
                name="enabled"
                defaultChecked={adminEdit?.enabled ?? true}
              />
              {t("enabled")}
            </label>
          </div>
          <div className="admin-form-actions">
            <Button variant="default" type="submit" disabled={busy}>
              {t("updateAdmin")}
            </Button>
            <Button
              variant="secondary"
              type="button"
              onClick={() => setAdminEdit(null)}
            >
              {t("reset")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

export function AuditPanel({ admin }: Props) {
  const { t, locale, events, setEvents, busy, api, action } = admin;
  const date = (at: number) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "short",
      timeStyle: "medium",
    }).format(at);
  return (
    <section className="admin-panel admin-audit">
      <div className="admin-panel-heading">
        <h2>{t("events")}</h2>
      </div>
      <div className="admin-list">
        {events.map((event) => (
          <article className="admin-list-row" key={event.sequence}>
            <div className="admin-row-top">
              <strong>{event.action}</strong>
              <time>{date(event.at)}</time>
            </div>
            <p className="admin-audit-meta">
              {t("actor")}: {event.actor} · #{event.sequence}
            </p>
            <pre>{JSON.stringify(event.detail, null, 2)}</pre>
          </article>
        ))}
      </div>
      <Button
        variant="secondary"
        disabled={busy || !events.length}
        onClick={() =>
          void action(async () => {
            const result = await api<{ events: typeof events }>(
              `audit?before=${events.at(-1)?.sequence}`,
            );
            setEvents([...events, ...result.events]);
          })
        }
      >
        {t("more")}
      </Button>
    </section>
  );
}
