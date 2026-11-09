import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import {
  Button,
  Checkbox,
  Input,
  NativeSelect,
  Textarea,
} from "../../ui/controls";
import { Field, lines } from "./fields";
import type { AdminState } from "./useAdmin";
import type { Administrator, Policy } from "./types";

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

const listingKeys = {
  pending: "listingPending",
  listed: "listingListed",
  rejected: "listingRejected",
  banned: "listingBanned",
} as const;

export function DirectoryPanel({ admin }: Props) {
  const {
    t,
    policy,
    setPolicy,
    readOnly,
    busy,
    dirty,
    api,
    action,
    acceptPolicy,
    application,
    setNotice,
  } = admin;
  const [tags, setTags] = useState(
    () => policy?.directory.tags.join(", ") || "",
  );
  if (!policy) return null;
  const directory = policy.directory;
  const change = (patch: Partial<Policy["directory"]>) =>
    setPolicy({ ...policy, directory: { ...directory, ...patch } });
  return (
    <>
      <section className="admin-panel admin-deployment-panel">
        <div className="admin-panel-heading">
          <div>
            <h2>{t("directory")}</h2>
            <p>{t("directoryHint")}</p>
          </div>
        </div>
        <div className="admin-settings-grid">
          <div className="admin-settings-group">
            <h3>{t("directoryPublic")}</h3>
            <Field label={t("directoryDiscovery")}>
              <NativeSelect
                disabled={readOnly}
                value={directory.discovery}
                onChange={(event) =>
                  change({
                    discovery: event.target
                      .value as Policy["directory"]["discovery"],
                  })
                }
              >
                <option value="public">{t("discoveryPublic")}</option>
                <option value="number">{t("discoveryNumber")}</option>
                <option value="hidden">{t("discoveryHidden")}</option>
              </NativeSelect>
            </Field>
            <Field label={t("directoryJoin")}>
              <NativeSelect
                disabled={readOnly}
                value={directory.join}
                onChange={(event) =>
                  change({
                    join: event.target.value as Policy["directory"]["join"],
                  })
                }
              >
                <option value="open">{t("joinOpen")}</option>
                <option value="invite">{t("joinInvite")}</option>
              </NativeSelect>
            </Field>
            <Field label={t("directoryName")}>
              <Input
                maxLength={80}
                disabled={readOnly}
                placeholder={policy.serverName}
                value={directory.name}
                onChange={(event) => change({ name: event.target.value })}
              />
            </Field>
            <Field label={t("directoryDescription")}>
              <Textarea
                maxLength={500}
                rows={4}
                disabled={readOnly}
                value={directory.description}
                onChange={(event) =>
                  change({ description: event.target.value })
                }
              />
            </Field>
            <Field label={t("directoryTags")}>
              <Input
                disabled={readOnly}
                value={tags}
                onChange={(event) => {
                  setTags(event.target.value);
                  change({
                    tags: lines(event.target.value)
                      .map((tag) => tag.toLowerCase())
                      .slice(0, 10),
                  });
                }}
              />
            </Field>
          </div>
          <div className="admin-settings-group">
            <h3>{t("directoryCentral")}</h3>
            {directory.number !== null && (
              <div className="admin-server-number">
                <span>{t("directoryNumber")}</span>
                <strong>{directory.number}</strong>
              </div>
            )}
            <p
              className={`admin-status-note admin-listing-status ${directory.listing === "listed" ? "is-good" : directory.listing ? "is-warning" : ""}`}
              role="status"
            >
              {directory.listing
                ? t(listingKeys[directory.listing])
                : t("directoryNotListed")}
            </p>
            {directory.listingNote && (
              <p className="admin-muted">
                {t("directoryListingNote", { note: directory.listingNote })}
              </p>
            )}
            <p className="admin-muted">{t("directoryCentralHint")}</p>
            {dirty && <p className="admin-muted">{t("directorySaveFirst")}</p>}
            <div className="admin-actions">
              <Button
                variant="default"
                disabled={readOnly || busy || dirty}
                onClick={() =>
                  void action(async () => {
                    const result = await api<{
                      central: string;
                      server: { number: number; status: string };
                      policy: Policy;
                    }>("directory/list", "POST");
                    if (application)
                      acceptPolicy({ policy: result.policy, application });
                    setNotice(
                      t(
                        result.server.status === "listed"
                          ? "directoryDoneListed"
                          : "directoryDone",
                        {
                          central: result.central,
                          number: result.server.number,
                        },
                      ),
                    );
                  })
                }
              >
                {directory.listing
                  ? t("directoryListAgain")
                  : t("directoryListAction")}
              </Button>
            </div>
          </div>
        </div>
      </section>
      <InvitesPanel admin={admin} />
    </>
  );
}

interface Invite {
  code: string;
  createdBy: string;
  expiresAt: string;
  uses: number;
}

function InvitesPanel({ admin }: Props) {
  const { t, locale, readOnly, busy, api, action, setNotice } = admin;
  const [invites, setInvites] = useState<Invite[] | null>(null);
  useEffect(() => {
    void api<{ invites: Invite[] }>("invites")
      .then((result) => setInvites(result.invites))
      .catch(() => setInvites([]));
  }, [api]);
  const reload = async () =>
    setInvites((await api<{ invites: Invite[] }>("invites")).invites);
  return (
    <section className="admin-panel admin-list-panel" aria-label={t("invites")}>
      <div className="admin-panel-heading">
        <div>
          <h2>{t("invites")}</h2>
          <p>{t("invitesHint")}</p>
        </div>
        <Button
          variant="default"
          disabled={readOnly || busy}
          onClick={() =>
            void action(async () => {
              const { invite } = await api<{ invite: Invite }>(
                "invites",
                "POST",
              );
              await reload();
              setNotice(t("inviteCreated", { code: invite.code }));
            })
          }
        >
          {t("createInvite")}
        </Button>
      </div>
      <div className="admin-list">
        {invites?.length === 0 && (
          <p className="admin-muted">{t("noInvites")}</p>
        )}
        {invites?.map((invite) => (
          <article className="admin-list-row" key={invite.code}>
            <div className="admin-row-top">
              <div className="admin-row-identity">
                <strong className="admin-invite-code">{invite.code}</strong>
                <span>
                  {t("inviteDetails", {
                    by: invite.createdBy.startsWith("admin:")
                      ? t("inviteByAdmin", {
                          name: invite.createdBy.slice("admin:".length),
                        })
                      : invite.createdBy,
                    expires: new Date(invite.expiresAt).toLocaleString(locale),
                    uses: invite.uses,
                  })}
                </span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                disabled={readOnly || busy}
                onClick={() =>
                  void action(async () => {
                    await api(
                      `invites/${encodeURIComponent(invite.code)}`,
                      "DELETE",
                    );
                    await reload();
                  })
                }
              >
                {t("revokeInvite")}
              </Button>
            </div>
          </article>
        ))}
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
