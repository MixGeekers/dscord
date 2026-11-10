import { ApiError, responseError } from "./api";
import { httpOrigin } from "./client-config.ts";

/** The public part of a central server: where accounts live and whether anyone may register. */
export interface CentralInfo {
  issuer: string;
  host: string;
  registration: "open" | "closed";
}

async function call<T>(
  issuer: string,
  route: string,
  init: { method?: string; token?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(new URL(route, issuer), {
    method: init.method ?? "GET",
    headers: {
      ...(init.body === undefined
        ? {}
        : { "Content-Type": "application/json" }),
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    credentials: "omit",
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(`HTTP ${response.status}`, response.status);
  }
  if (!response.ok) throw responseError(response, data);
  return data as T;
}

export async function loadCentral(issuer: string): Promise<CentralInfo> {
  const origin = httpOrigin(issuer, "Central server");
  const value = await call<{ issuer: string; registration: string }>(
    origin,
    "/.well-known/dscord/central",
  );
  if (value.issuer !== origin)
    throw new Error("The central server published another identity");
  return {
    issuer: origin,
    host: new URL(origin).host,
    registration: value.registration === "open" ? "open" : "closed",
  };
}

/**
 * Sign in (or register) at the central server and get a five-minute identity token naming this
 * chat server. The central session stays with the client so it can make DSH connection keys.
 */
export async function centralSignIn(
  issuer: string,
  audience: string,
  input: {
    mode: "login" | "register";
    username: string;
    password: string;
    displayName: string;
  },
): Promise<{ identityToken: string; centralToken: string }> {
  const { token } =
    input.mode === "register"
      ? await call<{ token: string }>(issuer, "/api/register", {
          method: "POST",
          body: {
            username: input.username,
            password: input.password,
            displayName: input.displayName,
          },
        })
      : await call<{ token: string }>(issuer, "/api/login", {
          method: "POST",
          body: { username: input.username, password: input.password },
        });
  try {
    // Signing in to this server from its own page is the person's consent to it.
    const issued = await call<{ token: string }>(
      issuer,
      "/api/identity-tokens",
      { method: "POST", token, body: { audience, allowNew: true } },
    );
    return { identityToken: issued.token, centralToken: token };
  } catch (reason) {
    centralSignOut(issuer, token);
    throw reason;
  }
}

/** Ends a central session; a session that is already gone is fine. */
export function centralSignOut(issuer: string, token: string): void {
  void call(issuer, "/api/logout", { method: "POST", token, body: {} }).catch(
    () => {},
  );
}

/**
 * A connection key for the person's DSH: base64url JSON naming this chat server and a one-time
 * central code. DSH redeems the code at the central server this chat server trusts.
 */
export async function connectionKey(
  issuer: string,
  centralToken: string,
  server: string,
): Promise<{ key: string; expiresIn: number }> {
  const { code, expiresIn } = await call<{ code: string; expiresIn: number }>(
    issuer,
    "/api/connect-codes",
    { method: "POST", token: centralToken, body: {} },
  );
  const bytes = new TextEncoder().encode(JSON.stringify({ server, code }));
  const base64 = btoa(String.fromCharCode(...bytes));
  return {
    key: base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
    expiresIn,
  };
}

/** A chat server as the central server's index lists it. */
export interface ListedServer {
  origin: string;
  number: number;
  join: "open" | "invite";
  name: string;
  description: string;
  tags: string[];
  members: { people: number; bots: number };
  owner?: string;
  updatedAt: string;
}

/** Searches the central server's index of chat servers. The index is public, so no account is used. */
export async function searchServers(
  issuer: string,
  query: string,
): Promise<ListedServer[]> {
  const { servers } = await call<{ servers: ListedServer[] }>(
    issuer,
    `/api/servers?${new URLSearchParams({ q: query.trim() })}`,
  );
  return servers;
}

/** What the owner set a Bot up to be. An empty model means the device's default. */
export interface BotSettings {
  role: string;
  model: string;
  effort: string;
  deviceId: string | null;
  /** Origins of the chat servers the Bot is on. */
  servers: string[];
  revision: number;
}

export type BotConnection = "offline" | "connecting" | "online" | "error";

/** A Bot the person owns, as the central server keeps it and as the device that runs it last reported. */
export interface ManagedBot {
  id: string;
  username: string;
  globalId: string;
  displayName: string;
  status: "active" | "disabled" | "closed";
  settings: BotSettings;
  /** Missing while no device runs the Bot. */
  runtime: {
    online: boolean;
    revision?: number;
    model?: string;
    error?: string;
    servers?: Record<string, { status: BotConnection; error?: string }>;
  } | null;
}

/** A DSH the person linked with a connection key, and the models it can run. */
export interface Device {
  id: string;
  label: string;
  online: boolean;
  lastSeen: string;
  models: {
    providers: {
      id: string;
      name: string;
      models: { model: string; name?: string; needsKey?: boolean }[];
    }[];
    defaultModel: string;
    error?: string;
  } | null;
  plugin: { version: string; available?: string | null } | null;
}

export type BotInput = Partial<
  Pick<BotSettings, "role" | "model" | "deviceId" | "servers">
> & { displayName?: string };

export async function listBots(
  issuer: string,
  token: string,
): Promise<ManagedBot[]> {
  const { bots } = await call<{ bots: ManagedBot[] }>(issuer, "/api/bots", {
    token,
  });
  return bots.filter((bot) => bot.status === "active");
}

export async function createBot(
  issuer: string,
  token: string,
  input: BotInput,
): Promise<ManagedBot> {
  const { bot } = await call<{ bot: ManagedBot }>(issuer, "/api/bots", {
    method: "POST",
    token,
    body: input,
  });
  return bot;
}

export async function updateBot(
  issuer: string,
  token: string,
  id: string,
  input: BotInput,
): Promise<ManagedBot> {
  const { bot } = await call<{ bot: ManagedBot }>(
    issuer,
    `/api/bots/${encodeURIComponent(id)}`,
    { method: "PATCH", token, body: input },
  );
  return bot;
}

export async function listDevices(
  issuer: string,
  token: string,
): Promise<Device[]> {
  const { devices } = await call<{ devices: Device[] }>(
    issuer,
    "/api/devices",
    { token },
  );
  return devices;
}

export async function removeDevice(
  issuer: string,
  token: string,
  id: string,
): Promise<void> {
  await call(issuer, `/api/devices/${encodeURIComponent(id)}`, {
    method: "DELETE",
    token,
  });
}
