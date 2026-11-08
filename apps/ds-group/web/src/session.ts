import { bindingKey } from "./client-config.ts";
import type { ClientConfig, ClientDiscovery } from "./client-config.ts";
import type { Session } from "./types";

export interface SessionBinding {
  schemaVersion: 1;
  homeCoreUrl: string;
  authUrl: string;
  homeMatrixUrl: string | null;
  authorityId: string;
}

export function sameBinding(session: Session, config: ClientConfig): boolean {
  return (
    session.binding?.schemaVersion === 1 &&
    session.binding.homeCoreUrl === config.homeCoreUrl &&
    session.binding.authUrl === config.authUrl &&
    session.binding.homeMatrixUrl === config.homeMatrixUrl
  );
}

export function bindSession(
  input: Session,
  config: ClientConfig,
  discovery: ClientDiscovery,
): Session {
  if (!input.access_token || !input.user_id)
    throw new Error("Invalid login session");
  return {
    ...input,
    binding: {
      schemaVersion: 1,
      homeCoreUrl: config.homeCoreUrl,
      authUrl: config.authUrl,
      homeMatrixUrl: config.homeMatrixUrl,
      authorityId: discovery.authorityId,
    },
  };
}

export function sessionIdentity(session: Session | null): string {
  return session
    ? JSON.stringify([
        session.binding,
        session.identity?.subjectId,
        session.user_id,
        session.access_token,
      ])
    : "";
}

export function sessionStorageKey(config: ClientConfig): string {
  return `ds-group.session.v2.${bindingKey(config)}`;
}

export function readStored<T>(key: string): T | null {
  try {
    return JSON.parse(sessionStorage.getItem(key) ?? "null") as T | null;
  } catch {
    return null;
  }
}

export function restoreSession(config: ClientConfig): Session | null {
  const value = readStored<Session>(sessionStorageKey(config));
  return value && sameBinding(value, config) ? value : null;
}

/** Persisted room, draft and retry keys use the full identity and the producing space. */
export function storageKey(
  config: ClientConfig,
  kind: string,
  session?: Session | null,
  spaceId?: string | null,
  roomId?: string | null,
): string {
  return `ds-group.v2.${bindingKey(config)}.${encodeURIComponent(
    JSON.stringify([
      kind,
      session?.binding?.authorityId ?? null,
      session?.identity?.subjectId ?? null,
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
  return readStored<T>(storageKey(config, kind, session, spaceId, roomId));
}
