import { useEffect, useRef, useState } from "react";
import {
  Gauge,
  Network,
  Users,
  DoorOpen,
  Bot,
  HardDrive,
  Settings,
  ShieldCheck,
  ScrollText,
  LogOut,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Globe,
  Download,
} from "lucide-react";
import { useLocale } from "./locale";
import { Button, Input, NativeSelect } from "../../ui/controls";
import { Field } from "./fields";
import PolicyCollection from "./PolicyCollection";
import type { Collection } from "./PolicyCollection";
import {
  AdministratorsPanel,
  AuditPanel,
  DeploymentPanel,
  DirectoryPanel,
  OverviewPanel,
  StoragePanel,
} from "./panels";
import { useAdmin } from "./useAdmin";
import type { AdminState } from "./useAdmin";
import type { Application, ManagementSession, Policy } from "./types";
import UpdatesPanel from "./UpdatesPanel";

const sections = [
  "overview",
  "partners",
  "members",
  "rooms",
  "bots",
  "directory",
  "storage",
  "deployment",
  "serverUpdates",
  "administrators",
  "audit",
] as const;
type Section = (typeof sections)[number];
const icons = {
  overview: Gauge,
  partners: Network,
  members: Users,
  rooms: DoorOpen,
  bots: Bot,
  directory: Globe,
  storage: HardDrive,
  deployment: Settings,
  serverUpdates: Download,
  administrators: ShieldCheck,
  audit: ScrollText,
};
const collections: readonly Section[] = [
  "partners",
  "members",
  "rooms",
  "bots",
];
const policySections: Section[] = [
  "overview",
  "partners",
  "members",
  "rooms",
  "bots",
  "directory",
  "deployment",
];

function Preferences({ admin }: { admin: AdminState }) {
  const { t } = admin;
  const { preference, setPreference } = useLocale();
  const [theme, setTheme] = useState(
    () => window.DSGroupTheme?.getPreference() || "system",
  );
  return (
    <div className="admin-preferences">
      <Field label={t("theme")}>
        <NativeSelect
          value={theme}
          onChange={(event) => {
            const value = event.target.value as "dark" | "light" | "system";
            setTheme(value);
            window.DSGroupTheme?.setPreference(value);
          }}
        >
          <option value="system">{t("system")}</option>
          <option value="light">{t("light")}</option>
          <option value="dark">{t("dark")}</option>
        </NativeSelect>
      </Field>
      <Field label={t("language")}>
        <NativeSelect
          value={preference}
          onChange={(event) =>
            setPreference(event.target.value as "en" | "zh-CN" | "system")
          }
        >
          <option value="system">{t("system")}</option>
          <option value="zh-CN">简体中文</option>
          <option value="en">English</option>
        </NativeSelect>
      </Field>
    </div>
  );
}

function Login({ admin }: { admin: AdminState }) {
  const { t, busy, error, api, action, remember, localizedError } = admin;
  return (
    <main className="admin-login">
      <div className="admin-login-panel">
        <span className="admin-login-mark" aria-hidden="true" />
        <h1>{t("signIn")}</h1>
        <p>{t("credentialHint")}</p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const input = new FormData(event.currentTarget);
            void action(async () => {
              const result = await api<ManagementSession>("login", "POST", {
                username: input.get("username"),
                password: input.get("password"),
              });
              remember(result);
            });
          }}
        >
          <Field label={t("username")}>
            <Input name="username" autoComplete="username" required />
          </Field>
          <Field label={t("password")}>
            <Input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>
          <Button variant="default" type="submit" disabled={busy}>
            {busy ? t("busy") : t("login")}
          </Button>
        </form>
        {error && (
          <p className="admin-error" role="alert">
            {localizedError(error)}
          </p>
        )}
        <Preferences admin={admin} />
      </div>
    </main>
  );
}

function Workspace({ admin }: { admin: AdminState }) {
  const {
    t,
    session,
    policy,
    setPolicy,
    application,
    setApplication,
    overview,
    busy,
    error,
    notice,
    setNotice,
    dirty,
    readOnly,
    remember,
    api,
    action,
    acceptPolicy,
    load,
    roleLabel,
    localizedError,
  } = admin;
  const [section, setSection] = useState<Section>("overview");
  const [lastPolicySection, setLastPolicySection] =
    useState<Section>("overview");
  const navigation = useRef<HTMLElement>(null);
  const showPolicyActions = policySections.includes(section);
  const policyNeedsAttention =
    !!policy &&
    (dirty ||
      application?.restartRequired ||
      !application?.livePolicyObserved ||
      (application?.application != null &&
        application.application.status !== "applied"));
  useEffect(() => {
    const element = navigation.current;
    if (!element) return;
    const revealCurrent = () => {
      const active = element.querySelector<HTMLElement>(
        '[aria-current="page"]',
      );
      if (!active || element.scrollWidth <= element.clientWidth) return;
      const item = active.getBoundingClientRect();
      const frame = element.getBoundingClientRect();
      element.scrollLeft +=
        item.left - frame.left - (frame.width - item.width) / 2;
    };
    revealCurrent();
    const observer = new ResizeObserver(revealCurrent);
    observer.observe(element);
    return () => observer.disconnect();
  }, [section]);
  if (!session) return null;
  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-icon" aria-hidden="true" />
          <div>
            <strong>DSCord</strong>
            <small>{t("title")}</small>
          </div>
        </div>
        <code className="admin-server-name">
          {policy?.serverName || overview?.serverName}
        </code>
        <nav ref={navigation} aria-label={t("title")}>
          {sections.map((name) => {
            const Icon = icons[name];
            return (
              <button
                type="button"
                className="admin-nav-button"
                key={name}
                aria-current={section === name ? "page" : undefined}
                onClick={() => {
                  setSection(name);
                  if (policySections.includes(name)) setLastPolicySection(name);
                  setNotice("");
                }}
              >
                <Icon size={18} aria-hidden="true" />
                {t(name)}
              </button>
            );
          })}
        </nav>
        <div className="admin-account">
          <span>
            {session.administrator.username} ·{" "}
            {roleLabel(session.administrator.role)}
          </span>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() =>
              void action(async () => {
                await api("logout", "POST");
                remember(null);
              })
            }
          >
            <LogOut size={17} aria-hidden="true" />
            {t("logout")}
          </Button>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-header">
          <div className="admin-page-title">
            <h1>{t(section)}</h1>
          </div>
          <Preferences admin={admin} />
        </header>
        {showPolicyActions ? (
          <section className="admin-policy-bar" aria-label={t("policyStatus")}>
            <div className="admin-policy-summary">
              <strong
                className={dirty ? "admin-state is-warning" : "admin-state"}
              >
                {dirty
                  ? t("unsaved")
                  : t("saved", { revision: policy?.revision || 0 })}
              </strong>
              <span
                className={`admin-status-note ${application?.livePolicyObserved ? "is-good" : "is-warning"}`}
              >
                {application?.livePolicyObserved
                  ? t("observed")
                  : t("unobserved")}
              </span>
              {application?.restartRequired && (
                <span className="admin-status-note is-warning">
                  {t("restart")}
                </span>
              )}
            </div>
            <div className="admin-actions">
              <Button
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => void action(load)}
              >
                <RefreshCw size={16} aria-hidden="true" />
                {dirty ? t("discardReload") : t("reload")}
              </Button>
              {!readOnly && (
                <>
                  <Button
                    variant="default"
                    size="sm"
                    disabled={busy || !dirty}
                    onClick={() =>
                      void action(async () => {
                        acceptPolicy(
                          await api<{
                            policy: Policy;
                            application: Application;
                          }>("policy", "PUT", policy),
                        );
                      })
                    }
                  >
                    {t("save")}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy || dirty || !policy}
                    onClick={() =>
                      void action(async () =>
                        setApplication(
                          await api<Application>("apply", "POST", {
                            revision: policy?.revision,
                          }),
                        ),
                      )
                    }
                  >
                    {busy ? t("busy") : t("apply")}
                  </Button>
                </>
              )}
            </div>
          </section>
        ) : (
          policyNeedsAttention && (
            <div className="admin-pending-bar" role="status">
              <span>
                <AlertCircle size={16} aria-hidden="true" />
                {dirty
                  ? t("unsaved")
                  : application?.restartRequired
                    ? t("restart")
                    : !application?.livePolicyObserved
                      ? t("unobserved")
                      : t("applicationNeedsAttention")}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSection(lastPolicySection)}
              >
                {t("reviewPolicy")}
              </Button>
            </div>
          )
        )}
        {readOnly && showPolicyActions && (
          <p className="admin-readonly-note">{t("readOnly")}</p>
        )}
        {error && (
          <div className="admin-error" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <span>
              <strong>{t("error")}</strong>
              <span>{localizedError(error)}</span>
            </span>
          </div>
        )}
        {notice && (
          <div className="admin-notice" role="status">
            <CheckCircle2 size={18} aria-hidden="true" />
            {notice}
          </div>
        )}
        {!policy && !error && (
          <div className="admin-loading" role="status">
            {t("busy")}
          </div>
        )}
        {section === "overview" && <OverviewPanel admin={admin} />}
        {policy && collections.includes(section) && (
          <PolicyCollection
            key={section}
            section={section as Collection}
            policy={policy}
            onChange={setPolicy}
            readOnly={readOnly}
            busy={busy || dirty}
            invite={(roomId, memberId) =>
              void action(async () => {
                await api("invite", "POST", {
                  roomId,
                  memberId,
                  revision: policy.revision,
                });
                setNotice(t("invited"));
              })
            }
          />
        )}
        {section === "directory" && <DirectoryPanel admin={admin} />}
        {section === "storage" && <StoragePanel admin={admin} />}
        {section === "deployment" && <DeploymentPanel admin={admin} />}
        {section === "serverUpdates" && <UpdatesPanel admin={admin} />}
        {section === "administrators" && <AdministratorsPanel admin={admin} />}
        {section === "audit" && <AuditPanel admin={admin} />}
      </main>
    </div>
  );
}

export default function AdminApp() {
  const admin = useAdmin();
  return admin.session ? (
    <Workspace key={admin.session.access_token} admin={admin} />
  ) : (
    <Login admin={admin} />
  );
}
