import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Gauge,
  Globe,
  LogOut,
  RefreshCw,
  Settings,
  Users,
} from "lucide-react";
import { Button, Input, NativeSelect } from "../../../ui/controls";
import { Field } from "../../src/fields";
import { useLocale, useTranslation } from "../../src/locale";
import { centralMessages } from "./messages";
import type { CentralMessage } from "./messages";

type ListingStatus = "pending" | "listed" | "rejected" | "banned";
interface Server {
  origin: string;
  number: number;
  status: ListingStatus;
  note: string;
  discovery: "public" | "number" | "hidden";
  name: string;
  description: string;
  tags: string[];
  members: { people: number; bots: number };
  join: "open" | "invite";
  submittedAt: string;
  fetchedAt: string | null;
  lastError: string | null;
}
interface Account {
  id: string;
  username: string;
  globalId: string;
  kind: "human" | "bot";
  displayName: string;
  owner?: string;
  status: "active" | "disabled" | "closed";
  createdAt: string;
  lastSeen: string | null;
  servers: number;
}
interface CentralSettings {
  registration: "open" | "closed";
  listing: "review" | "open";
}
interface Overview {
  account: Account;
  issuer: string;
  settings: CentralSettings;
  servers: Record<ListingStatus, number>;
  accounts: { people: number; bots: number; disabled: number };
}

const SESSION_KEY = `dscord.central-admin.${location.origin}`;
const sections = ["overview", "servers", "accounts", "settings"] as const;
type Section = (typeof sections)[number];
const icons = {
  overview: Gauge,
  servers: Globe,
  accounts: Users,
  settings: Settings,
};
const statuses: ListingStatus[] = ["pending", "listed", "rejected", "banned"];
const knownErrors: Record<string, CentralMessage> = {
  ADMIN_REQUIRED: "errorAdminRequired",
  LOGIN_FAILED: "errorLoginFailed",
  ACCOUNT_DISABLED: "errorDisabled",
  SIGN_IN_REQUIRED: "errorSession",
  ADMIN_SELF: "errorSelf",
};

const storedToken = () => {
  try {
    return sessionStorage.getItem(SESSION_KEY) || "";
  } catch {
    return "";
  }
};

class CentralError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

function useCentral() {
  const t = useTranslation(centralMessages);
  const { locale } = useLocale();
  const [token, setToken] = useState(storedToken);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const remember = useCallback((value: string) => {
    setToken(value);
    if (!value) setOverview(null);
    try {
      if (value) sessionStorage.setItem(SESSION_KEY, value);
      else sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // A browser without session storage keeps the session for this page only.
    }
  }, []);
  const api = useCallback(
    async <T,>(
      route: string,
      method = "GET",
      body?: unknown,
      bearer = token,
    ): Promise<T> => {
      const response = await fetch(`/api/${route}`, {
        method,
        credentials: "omit",
        headers: {
          ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(60000),
      });
      const data = (await response.json().catch(() => ({}))) as T & {
        error?: string;
        code?: string;
      };
      if (!response.ok) {
        if (response.status === 401 && route !== "login") remember("");
        throw new CentralError(
          data.error || `HTTP ${response.status}`,
          data.code || "",
        );
      }
      return data;
    },
    [token, remember],
  );
  const fail = useCallback(
    (value: unknown) => {
      setError(
        value instanceof CentralError && knownErrors[value.code]
          ? t(knownErrors[value.code])
          : value instanceof Error
            ? value.message
            : String(value),
      );
      // A signed-in account that is not an administrator goes back to the sign-in page with the reason.
      if (value instanceof CentralError && value.code === "ADMIN_REQUIRED")
        remember("");
    },
    [t, remember],
  );
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (failure) {
      fail(failure);
    } finally {
      setBusy(false);
    }
  }
  const load = useCallback(async () => {
    setOverview(await api<Overview>("admin/overview"));
  }, [api]);
  useEffect(() => {
    if (token) load().catch(fail);
  }, [token, load, fail]);
  const time = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat(locale, {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(value))
      : t("never");
  return {
    t,
    token,
    overview,
    setOverview,
    busy,
    error,
    notice,
    setNotice,
    fail,
    remember,
    api,
    action,
    load,
    time,
  };
}
type Central = ReturnType<typeof useCentral>;

function Preferences({ central }: { central: Central }) {
  const { t } = central;
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

function Login({ central }: { central: Central }) {
  const { t, busy, error, api, action, remember } = central;
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
              const result = await api<{ token: string }>("login", "POST", {
                username: input.get("username"),
                password: input.get("password"),
              });
              // Only an administrator gets past the overview; anyone else is signed out again.
              try {
                await api("admin/overview", "GET", undefined, result.token);
              } catch (failure) {
                await api("logout", "POST", undefined, result.token).catch(
                  () => {},
                );
                throw failure;
              }
              remember(result.token);
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
            {error}
          </p>
        )}
        <Preferences central={central} />
      </div>
    </main>
  );
}

function OverviewPanel({
  central,
  open,
}: {
  central: Central;
  open: (status: ListingStatus) => void;
}) {
  const { t, overview } = central;
  if (!overview) return null;
  const metrics: [CentralMessage, number][] = [
    ["pendingServers", overview.servers.pending],
    ["listedServers", overview.servers.listed],
    ["people", overview.accounts.people],
    ["bots", overview.accounts.bots],
  ];
  return (
    <>
      <section className="admin-panel admin-metrics" aria-label={t("overview")}>
        {metrics.map(([label, value]) => (
          <div className="admin-metric" key={label}>
            <span>{t(label)}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <h2>{t("reviewQueue")}</h2>
            <p>
              {overview.servers.pending
                ? t("serversHint")
                : t("reviewQueueEmpty")}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => open("pending")}>
            {t("openServers")}
          </Button>
        </div>
        <dl className="admin-detail-list admin-detail-list-wide">
          <div>
            <dt>{t("listing")}</dt>
            <dd>
              {overview.settings.listing === "review"
                ? t("listingReview")
                : t("listingOpen")}
            </dd>
          </div>
          <div>
            <dt>{t("registration")}</dt>
            <dd>
              {overview.settings.registration === "open"
                ? t("registrationOpen")
                : t("registrationClosed")}
            </dd>
          </div>
          <div>
            <dt>{t("disabledAccounts")}</dt>
            <dd>{overview.accounts.disabled}</dd>
          </div>
        </dl>
      </section>
    </>
  );
}

function ServerRow({
  central,
  server,
  changed,
}: {
  central: Central;
  server: Server;
  changed: () => Promise<void>;
}) {
  const { t, busy, api, action, setNotice, time } = central;
  const [note, setNote] = useState(server.note);
  const [confirming, setConfirming] = useState(false);
  const route = `admin/servers/${encodeURIComponent(server.origin)}`;
  const decide = (status: "listed" | "rejected" | "banned") =>
    void action(async () => {
      await api(`${route}/decision`, "POST", { status, note });
      await changed();
      setNotice(t("decided", { origin: server.origin, status: t(status) }));
    });
  const tone =
    server.status === "listed"
      ? "is-good"
      : server.status === "pending"
        ? "is-warning"
        : "is-muted";
  return (
    <article className="admin-list-row central-server-row">
      <div className="admin-row-top">
        <div className="admin-row-identity">
          <strong>{server.name}</strong>
          <span>
            <code>{server.origin}</code> ·{" "}
            {t("serverNumber", { number: server.number })}
          </span>
        </div>
        <span className={`admin-state ${tone}`}>{t(server.status)}</span>
      </div>
      {server.description && (
        <p className="central-description">{server.description}</p>
      )}
      <p className="admin-hint">
        {[
          t(
            server.discovery === "public"
              ? "discoveryPublic"
              : server.discovery === "number"
                ? "discoveryNumber"
                : "discoveryHidden",
          ),
          t(server.join === "open" ? "joinOpen" : "joinInvite"),
          t("members", {
            people: server.members.people,
            bots: server.members.bots,
          }),
          ...server.tags.map((tag) => `#${tag}`),
        ].join(" · ")}
      </p>
      <p className="admin-hint">
        {t("submittedAt", { time: time(server.submittedAt) })} ·{" "}
        {t("fetchedAt", { time: time(server.fetchedAt) })}
        {server.lastError && (
          <> · {t("lastError", { code: server.lastError })}</>
        )}
      </p>
      <Field label={t("note")}>
        <Input
          maxLength={500}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </Field>
      <div className="admin-row-actions">
        {server.status !== "listed" && (
          <Button
            variant="default"
            size="sm"
            disabled={busy}
            onClick={() => decide("listed")}
          >
            {server.status === "banned" ? t("unban") : t("approve")}
          </Button>
        )}
        {server.status !== "rejected" && server.status !== "banned" && (
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => decide("rejected")}
          >
            {t("reject")}
          </Button>
        )}
        {server.status !== "banned" && (
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => decide("banned")}
          >
            {t("ban")}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() =>
            void action(async () => {
              await api(`${route}/refresh`, "POST");
              await changed();
              setNotice(t("refreshed", { origin: server.origin }));
            })
          }
        >
          <RefreshCw size={16} aria-hidden="true" />
          {t("refresh")}
        </Button>
        {confirming ? (
          <span className="admin-confirm" role="group">
            <span>{t("confirmRemove", { origin: server.origin })}</span>
            <Button
              variant="destructive"
              size="sm"
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  await api(route, "DELETE");
                  await changed();
                  setNotice(t("removed", { origin: server.origin }));
                })
              }
            >
              {t("remove")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirming(false)}
            >
              {t("cancel")}
            </Button>
          </span>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => setConfirming(true)}
          >
            {t("remove")}
          </Button>
        )}
      </div>
    </article>
  );
}

function ServersPanel({
  central,
  filter,
  setFilter,
}: {
  central: Central;
  filter: ListingStatus | "";
  setFilter: (value: ListingStatus | "") => void;
}) {
  const { t, api, load, overview } = central;
  const [servers, setServers] = useState<Server[] | null>(null);
  const fetchServers = useCallback(async () => {
    const result = await api<{ servers: Server[] }>(
      `admin/servers${filter ? `?status=${filter}` : ""}`,
    );
    setServers(result.servers);
  }, [api, filter]);
  const { fail } = central;
  useEffect(() => {
    fetchServers().catch(fail);
  }, [fetchServers, fail]);
  const changed = async () => {
    await Promise.all([fetchServers(), load()]);
  };
  return (
    <section className="admin-panel admin-list-panel">
      <div className="admin-panel-heading">
        <div>
          <h2>{t("servers")}</h2>
          <p>{t("serversHint")}</p>
        </div>
      </div>
      <div className="central-filter" role="tablist" aria-label={t("status")}>
        {(["", ...statuses] as const).map((status) => (
          <button
            type="button"
            role="tab"
            key={status || "all"}
            aria-selected={filter === status}
            className="admin-nav-button"
            onClick={() => setFilter(status)}
          >
            {status ? t(status) : t("all")}
            {status && overview ? (
              <span className="admin-count">{overview.servers[status]}</span>
            ) : null}
          </button>
        ))}
      </div>
      {servers && servers.length === 0 && (
        <p className="admin-empty">{t("noServers")}</p>
      )}
      <div className="admin-list">
        {servers?.map((server) => (
          <ServerRow
            key={`${server.origin}|${server.status}|${server.note}`}
            central={central}
            server={server}
            changed={changed}
          />
        ))}
      </div>
    </section>
  );
}

function AccountsPanel({ central }: { central: Central }) {
  const { t, api, action, busy, load, setNotice, time, overview } = central;
  const [query, setQuery] = useState({ q: "", kind: "", status: "" });
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const fetchAccounts = useCallback(async () => {
    const result = await api<{ accounts: Account[] }>(
      `admin/accounts?${new URLSearchParams(query)}`,
    );
    setAccounts(result.accounts);
  }, [api, query]);
  const { fail } = central;
  useEffect(() => {
    fetchAccounts().catch(fail);
  }, [fetchAccounts, fail]);
  return (
    <section className="admin-panel admin-list-panel">
      <div className="admin-panel-heading">
        <div>
          <h2>{t("accounts")}</h2>
          <p>{t("accountsHint")}</p>
        </div>
      </div>
      <form
        className="central-account-search"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          const input = new FormData(event.currentTarget);
          setQuery({
            q: String(input.get("q") || ""),
            kind: String(input.get("kind") || ""),
            status: String(input.get("status") || ""),
          });
        }}
      >
        <Field label={t("search")}>
          <Input name="q" placeholder={t("searchAccounts")} />
        </Field>
        <Field label={t("kind")}>
          <NativeSelect name="kind" defaultValue="">
            <option value="">{t("all")}</option>
            <option value="human">{t("human")}</option>
            <option value="bot">{t("bot")}</option>
          </NativeSelect>
        </Field>
        <Field label={t("status")}>
          <NativeSelect name="status" defaultValue="">
            <option value="">{t("all")}</option>
            <option value="active">{t("active")}</option>
            <option value="disabled">{t("disabled")}</option>
            <option value="closed">{t("closed")}</option>
          </NativeSelect>
        </Field>
        <Button variant="secondary" type="submit" disabled={busy}>
          {t("search")}
        </Button>
      </form>
      {accounts && accounts.length === 0 && (
        <p className="admin-empty">{t("noAccounts")}</p>
      )}
      <div className="admin-list">
        {accounts?.map((account) => (
          <article className="admin-list-row" key={account.id}>
            <div className="admin-row-top">
              <div className="admin-row-identity">
                <strong>{account.displayName}</strong>
                <span>
                  <code>{account.globalId}</code> ·{" "}
                  {t(account.kind === "bot" ? "bot" : "human")}
                  {account.owner && (
                    <> · {t("ownedBy", { owner: account.owner })}</>
                  )}
                </span>
              </div>
              <span
                className={`admin-state ${account.status === "active" ? "is-good" : account.status === "disabled" ? "is-warning" : "is-muted"}`}
              >
                {t(account.status)}
              </span>
            </div>
            <p className="admin-hint">
              {t("joinedServers", { count: account.servers })} ·{" "}
              {t("lastSeen", { time: time(account.lastSeen) })}
            </p>
            {account.status !== "closed" &&
              account.id !== overview?.account.id && (
                <div className="admin-row-actions">
                  <Button
                    variant={
                      account.status === "active" ? "secondary" : "default"
                    }
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void action(async () => {
                        const disabling = account.status === "active";
                        await api(
                          `admin/accounts/${encodeURIComponent(account.id)}/${disabling ? "disable" : "enable"}`,
                          "POST",
                        );
                        await Promise.all([fetchAccounts(), load()]);
                        setNotice(
                          t(disabling ? "accountDisabled" : "accountEnabled", {
                            name: account.username,
                          }),
                        );
                      })
                    }
                  >
                    {account.status === "active" ? t("disable") : t("enable")}
                  </Button>
                </div>
              )}
          </article>
        ))}
      </div>
    </section>
  );
}

function SettingsPanel({ central }: { central: Central }) {
  const { t, overview, setOverview, api, action, busy, setNotice } = central;
  if (!overview) return null;
  return (
    <form
      className="admin-panel admin-deployment-panel"
      onSubmit={(event) => {
        event.preventDefault();
        const input = new FormData(event.currentTarget);
        void action(async () => {
          const result = await api<{ settings: CentralSettings }>(
            "admin/settings",
            "POST",
            {
              registration: input.get("registration"),
              listing: input.get("listing"),
            },
          );
          setOverview({ ...overview, settings: result.settings });
          setNotice(t("saved"));
        });
      }}
    >
      <div className="admin-panel-heading">
        <div>
          <h2>{t("settings")}</h2>
          <p>{t("settingsHint")}</p>
        </div>
      </div>
      <div className="admin-form-fields">
        <Field label={t("listing")}>
          <NativeSelect name="listing" defaultValue={overview.settings.listing}>
            <option value="review">{t("listingReview")}</option>
            <option value="open">{t("listingOpen")}</option>
          </NativeSelect>
        </Field>
        <Field label={t("registration")}>
          <NativeSelect
            name="registration"
            defaultValue={overview.settings.registration}
          >
            <option value="open">{t("registrationOpen")}</option>
            <option value="closed">{t("registrationClosed")}</option>
          </NativeSelect>
        </Field>
        <p className="admin-muted">{t("adminsHint")}</p>
      </div>
      <div className="admin-form-actions">
        <Button variant="default" type="submit" disabled={busy}>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}

function Workspace({ central }: { central: Central }) {
  const { t, overview, busy, error, notice, setNotice, api, action, remember } =
    central;
  const [section, setSection] = useState<Section>("overview");
  const [filter, setFilter] = useState<ListingStatus | "">("pending");
  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-icon" aria-hidden="true" />
          <div>
            <strong>DSCord Central</strong>
            <small>{t("title")}</small>
          </div>
        </div>
        <code className="admin-server-name">
          {overview ? new URL(overview.issuer).host : ""}
        </code>
        <nav aria-label={t("title")}>
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
                  setNotice("");
                }}
              >
                <Icon size={18} aria-hidden="true" />
                {t(name)}
                {name === "servers" && overview?.servers.pending ? (
                  <span className="admin-count">
                    {overview.servers.pending}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
        <div className="admin-account">
          <span>{overview?.account.username}</span>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() =>
              void action(async () => {
                await api("logout", "POST").catch(() => {});
                remember("");
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
          <Preferences central={central} />
        </header>
        {error && (
          <div className="admin-error" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <span>
              <strong>{t("error")}</strong>
              <span>{error}</span>
            </span>
          </div>
        )}
        {notice && (
          <div className="admin-notice" role="status">
            <CheckCircle2 size={18} aria-hidden="true" />
            {notice}
          </div>
        )}
        {!overview && !error && (
          <div className="admin-loading" role="status">
            {t("busy")}
          </div>
        )}
        {section === "overview" && (
          <OverviewPanel
            central={central}
            open={(status) => {
              setFilter(status);
              setSection("servers");
            }}
          />
        )}
        {section === "servers" && (
          <ServersPanel
            central={central}
            filter={filter}
            setFilter={setFilter}
          />
        )}
        {section === "accounts" && <AccountsPanel central={central} />}
        {section === "settings" && <SettingsPanel central={central} />}
      </main>
    </div>
  );
}

export default function CentralApp() {
  const central = useCentral();
  return central.token ? (
    <Workspace key={central.token} central={central} />
  ) : (
    <Login central={central} />
  );
}
