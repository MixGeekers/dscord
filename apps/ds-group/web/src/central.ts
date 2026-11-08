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
 * Sign in (or register) at the central server and trade the central session for a
 * five-minute identity token naming this chat server. The central session is closed
 * right after: the chat server's own session is what the client keeps.
 */
export async function centralIdentityToken(
  issuer: string,
  audience: string,
  input: {
    mode: "login" | "register";
    username: string;
    password: string;
    displayName: string;
  },
): Promise<string> {
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
    return issued.token;
  } finally {
    void call(issuer, "/api/logout", { method: "POST", token, body: {} }).catch(
      () => {},
    );
  }
}
