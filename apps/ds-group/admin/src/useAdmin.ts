import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslation } from "./locale";
import { adminMessages } from "./messages";
import type {
  Administrator,
  Application,
  AuditEvent,
  ManagementSession,
  Overview,
  Policy,
} from "./types";

const SESSION_KEY = `dscord.management.${location.origin}`;
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
const knownErrorKeys = {
  "Administrator sign-in failed": "signInFailed",
  "An instance administrator session is required": "sessionRequired",
  "Administrator session expired": "sessionExpired",
  "Your administrator role cannot perform this operation": "roleForbidden",
  "Too many administrator login attempts; try again in 15 minutes":
    "signInLimited",
  "Invalid management origin": "invalidManagementOrigin",
  "Use this instance’s management origin": "wrongManagementOrigin",
  "Keep at least one active owner": "keepOwner",
  "This server does not trust a central server": "directoryNoCentral",
  "Central server is unreachable": "directoryUnreachable",
  "Central server refused: LOGIN_FAILED": "directoryLoginFailed",
  "Central server refused: CHALLENGE_MISMATCH": "directoryPageUnseen",
  "Central server refused: SERVER_PAGE_MISSING": "directoryPageUnseen",
  "Central server refused: SERVER_UNREACHABLE": "directoryPageUnseen",
} as const;
const storedSession = () => {
  try {
    return JSON.parse(
      sessionStorage.getItem(SESSION_KEY) || "null",
    ) as ManagementSession | null;
  } catch {
    return null;
  }
};

export type AdminState = ReturnType<typeof useAdmin>;

/** Management session, loaded policy and records, and the request helpers every panel shares. */
export function useAdmin() {
  const t = useTranslation(adminMessages);
  const { locale } = useLocale();
  const [session, setSession] = useState(storedSession);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [saved, setSaved] = useState("");
  const [application, setApplication] = useState<Application | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [administrators, setAdministrators] = useState<Administrator[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const dirty = !!policy && JSON.stringify(policy) !== saved;
  const readOnly = session?.administrator.role === "auditor";

  function remember(value: ManagementSession | null) {
    setSession(value);
    if (value) sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
    else {
      sessionStorage.removeItem(SESSION_KEY);
      setPolicy(null);
      setSaved("");
      setApplication(null);
      setOverview(null);
      setAdministrators([]);
      setEvents([]);
    }
  }
  const api = useCallback(
    async <T>(route: string, method = "GET", body?: unknown): Promise<T> => {
      const response = await fetch(`/admin-api/${route}`, {
        method,
        credentials: "omit",
        headers: {
          ...(session
            ? { authorization: `Bearer ${session.access_token}` }
            : {}),
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(60000),
      });
      const data = (await response.json()) as T & { error?: string };
      if (!response.ok) {
        if (response.status === 401 && route !== "login") remember(null);
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      return data;
    },
    [session],
  );
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  function acceptPolicy(data: { policy: Policy; application: Application }) {
    setPolicy(data.policy);
    setSaved(JSON.stringify(data.policy));
    setApplication(data.application);
  }
  const load = useCallback(async () => {
    const [data, overview, admins, audit] = await Promise.all([
      api<{ policy: Policy; application: Application }>("policy"),
      api<Overview>("overview"),
      api<{ administrators: Administrator[] }>("administrators"),
      api<{ events: AuditEvent[] }>("audit"),
    ]);
    acceptPolicy(data);
    setOverview(overview);
    setAdministrators(admins.administrators);
    setEvents(audit.events);
  }, [api]);
  useEffect(() => {
    if (session) void load().catch((error) => setError(errorText(error)));
  }, [session, load]);

  const applicationStatus = (status: string) => {
    const labels: Record<string, string> = {
      pending: t("pending"),
      applied: t("applied"),
      partial: t("partial"),
      failed: t("failed"),
      prepared: t("prepared"),
      applying: t("applying"),
    };
    return labels[status] || status;
  };
  const roleLabel = (role: string) => {
    if (role === "owner") return t("ownerRole");
    if (role === "operator") return t("operatorRole");
    if (role === "auditor") return t("auditorRole");
    return role;
  };
  const localizedError = (message: string) => {
    const key = Object.hasOwn(knownErrorKeys, message)
      ? knownErrorKeys[message as keyof typeof knownErrorKeys]
      : undefined;
    return key ? t(key) : message;
  };
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);

  return {
    t,
    locale,
    session,
    policy,
    setPolicy,
    application,
    setApplication,
    overview,
    administrators,
    setAdministrators,
    events,
    setEvents,
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
    applicationStatus,
    roleLabel,
    localizedError,
    number,
  };
}
