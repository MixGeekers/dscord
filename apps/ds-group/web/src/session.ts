import { bindingKey } from "./client-config.ts";
import { newRequestId } from "./identifiers.ts";
import type { ClientConfig, ClientDiscovery } from "./client-config.ts";
import type { Session } from "./types";

export interface SessionBinding {
  schemaVersion: 2;
  homeCoreUrl: string;
  homeMatrixUrl: string | null;
  centralIssuer: string;
}

export function sameBinding(session: Session, config: ClientConfig): boolean {
  return (
    session.binding?.schemaVersion === 2 &&
    session.binding.homeCoreUrl === config.homeCoreUrl &&
    session.binding.homeMatrixUrl === config.homeMatrixUrl
  );
}

export function bindSession(
  input: Session,
  config: ClientConfig,
  discovery: ClientDiscovery,
): Session {
  if (!input.access_token || !input.user_id || !discovery.central)
    throw new Error("Invalid login session");
  return {
    ...input,
    binding: {
      schemaVersion: 2,
      homeCoreUrl: config.homeCoreUrl,
      homeMatrixUrl: config.homeMatrixUrl,
      centralIssuer: discovery.central.issuer,
    },
  };
}

export function sessionIdentity(session: Session | null): string {
  return session
    ? JSON.stringify([
        session.binding,
        session.identity?.globalId,
        session.user_id,
        session.access_token,
      ])
    : "";
}

export function sessionStorageKey(config: ClientConfig): string {
  return `ds-group.session.v3.${bindingKey(config)}`;
}

export const REMEMBER_SESSION_MS = 30 * 24 * 60 * 60 * 1000;

interface StoredLogin {
  schemaVersion: 1;
  revision: string;
  expiresAt: number;
  session: Session;
}

const memorySessions = new Map<
  string,
  { session: Session; revision: string }
>();
const volatile = new Map<string, string>();

function store(persistent = false): Storage | null {
  try {
    return persistent ? globalThis.localStorage : globalThis.sessionStorage;
  } catch {
    return null;
  }
}

function read<T>(key: string, persistent = false): T | null {
  try {
    return JSON.parse(store(persistent)?.getItem(key) ?? "null") as T | null;
  } catch {
    return null;
  }
}

/** Only explicitly selected workspace data may fall back to persistent storage. */
export function readStored<T>(key: string, persistent = false): T | null {
  if (volatile.has(key)) return JSON.parse(volatile.get(key)!) as T | null;
  if (persistent) {
    try {
      const value = store(true)?.getItem(key);
      if (value !== null && value !== undefined)
        return JSON.parse(value) as T | null;
    } catch {
      /* A legacy tab-local draft can still be available. */
    }
  }
  return read<T>(key);
}

export function writeStored(
  key: string,
  value: unknown,
  persistent = false,
): boolean {
  const text = JSON.stringify(value);
  let saved = false;
  for (const durable of persistent ? [false, true] : [false]) {
    try {
      const storage = store(durable);
      storage?.setItem(key, text);
      if (storage && (durable || !persistent)) saved = true;
    } catch {
      /* The other storage can still be available. */
    }
  }
  if (saved) volatile.delete(key);
  else volatile.set(key, text);
  return saved;
}

export function removeStored(key: string): void {
  volatile.delete(key);
  for (const persistent of [false, true]) {
    try {
      const storage = store(persistent);
      if (persistent && storage?.getItem(key) !== null)
        storage?.setItem(key, "null");
      else storage?.removeItem(key);
    } catch {
      /* Storage may be disabled. */
    }
  }
}

function validSession(
  value: Session | null,
  config: ClientConfig,
): value is Session {
  return Boolean(
    value &&
    typeof value.access_token === "string" &&
    value.access_token &&
    typeof value.user_id === "string" &&
    value.user_id &&
    sameBinding(value, config) &&
    typeof value.binding?.centralIssuer === "string" &&
    value.binding.centralIssuer,
  );
}

function revisionKey(config: ClientConfig): string {
  return `${sessionStorageKey(config)}.change`;
}

function remembered(
  config: ClientConfig,
  now = Date.now(),
): StoredLogin | null {
  const key = sessionStorageKey(config);
  const value = read<StoredLogin>(key, true);
  const revision = read<string>(revisionKey(config), true);
  if (
    value?.schemaVersion === 1 &&
    typeof value.revision === "string" &&
    (!revision || revision === value.revision) &&
    Number.isFinite(value.expiresAt) &&
    value.expiresAt > now &&
    value.expiresAt <= now + REMEMBER_SESSION_MS &&
    validSession(value.session, config)
  )
    return value;
  return null;
}

export function restoreSession(config: ClientConfig): Session | null {
  const saved = remembered(config);
  if (saved) return saved.session;
  const key = sessionStorageKey(config);
  const value = read<Session>(key);
  const meta = read<{ revision: string; expiresAt: number | null }>(
    `${key}.meta`,
  );
  const revision = read<string>(revisionKey(config), true);
  // Old open tabs remain usable until the first explicit login/logout change.
  const memory = memorySessions.get(key);
  if (memory && (!revision || revision === memory.revision))
    return memory.session;
  if (revision && meta?.revision !== revision) return null;
  if (
    meta?.expiresAt !== undefined &&
    meta.expiresAt !== null &&
    (!Number.isFinite(meta.expiresAt) || meta.expiresAt <= Date.now())
  )
    return null;
  return validSession(value, config) ? value : null;
}

export function isRememberedSession(
  config: ClientConfig,
  session: Session | null,
): boolean {
  return Boolean(
    session &&
    sessionIdentity(remembered(config)?.session ?? null) ===
      sessionIdentity(session),
  );
}

/** The 30-day limit is local and absolute; it does not extend an upstream token. */
export function saveSession(
  config: ClientConfig,
  session: Session,
  remember = true,
): boolean {
  if (!validSession(session, config)) throw new Error("Invalid login session");
  const key = sessionStorageKey(config);
  const revision = newRequestId();
  let expiresAt: number | null = null;
  try {
    store(true)?.removeItem(key);
    if (remember && store(true)) {
      expiresAt = Date.now() + REMEMBER_SESSION_MS;
      store(true)!.setItem(
        key,
        JSON.stringify({
          schemaVersion: 1,
          revision,
          expiresAt,
          session,
        } satisfies StoredLogin),
      );
    }
  } catch {
    expiresAt = null;
  }
  let tabRevision = revision;
  try {
    store(true)?.setItem(revisionKey(config), JSON.stringify(revision));
  } catch {
    tabRevision = read<string>(revisionKey(config), true) ?? revision;
    expiresAt = null;
    try {
      store(true)?.removeItem(key);
    } catch {
      /* Report temporary mode. */
    }
  }
  const tabSaved = writeStored(key, session);
  writeStored(`${key}.meta`, { revision: tabRevision, expiresAt });
  if (!tabSaved && expiresAt === null)
    memorySessions.set(key, { session, revision: tabRevision });
  else memorySessions.delete(key);
  return isRememberedSession(config, session);
}

/** A late failure from the old account must not remove a newer login. */
export function forgetSession(
  config: ClientConfig,
  expected: Session | null,
): boolean {
  const current = restoreSession(config);
  if (current && sessionIdentity(current) !== sessionIdentity(expected))
    return false;
  const key = sessionStorageKey(config);
  removeStored(key);
  memorySessions.delete(key);
  removeStored(`${key}.meta`);
  try {
    store(true)?.setItem(revisionKey(config), JSON.stringify(newRequestId()));
  } catch {
    /* Storage may be disabled. */
  }
  return true;
}

/** Other tabs never receive credentials in an event; they re-read the bound store. */
export function observeSession(
  config: ClientConfig,
  changed: (session: Session | null) => void,
): () => void {
  let timer: ReturnType<typeof setTimeout>;
  const check = () => {
    clearTimeout(timer);
    changed(restoreSession(config));
    const saved = remembered(config);
    if (saved)
      timer = setTimeout(
        check,
        Math.min(2 ** 31 - 1, Math.max(1, saved.expiresAt - Date.now())),
      );
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === revisionKey(config)) check();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener("pageshow", check);
  window.addEventListener("focus", check);
  check();
  return () => {
    clearTimeout(timer);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("pageshow", check);
    window.removeEventListener("focus", check);
  };
}

/** Persisted room, draft and retry keys use the full identity and the producing space. */
export function storageKey(
  config: ClientConfig,
  kind: string,
  session?: Session | null,
  spaceId?: string | null,
  roomId?: string | null,
): string {
  return `ds-group.v3.${bindingKey(config)}.${encodeURIComponent(
    JSON.stringify([
      kind,
      session?.binding?.centralIssuer ?? null,
      session?.identity?.globalId ?? null,
      session?.user_id ?? null,
      spaceId ?? null,
      roomId ?? null,
    ]),
  )}`;
}

export function readScoped<T>(
  config: ClientConfig,
  kind: string,
  session?: Session | null,
  spaceId?: string | null,
  roomId?: string | null,
): T | null {
  return readStored<T>(
    storageKey(config, kind, session, spaceId, roomId),
    isRememberedSession(config, session ?? null),
  );
}
