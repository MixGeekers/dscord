import { readFile } from "node:fs/promises";
import path from "node:path";
import { policyError } from "./governance.mjs";

const centralError = (status, value) => {
  const code = typeof value?.code === "string" ? value.code : "CENTRAL_FAILED";
  // Wrong credentials and refused claims are the operator's to fix; anything else is the central server's.
  return policyError(
    status === 401 || status === 403 || status === 409 || status === 400
      ? 409
      : 502,
    `Central server refused: ${code}`,
  );
};

/**
 * Lists this chat server in its central server's index. An operator signs in with their central account; the
 * administration service claims this server's public origin, writes the central server's challenge into the policy
 * (Core then serves it at /.well-known/dscord/server), asks the central server to read that page, and signs out.
 * The central account's password and session never leave this request.
 */
export async function listInCentral({
  dataRoot,
  governance,
  input,
  fetch = globalThis.fetch,
  centralFetchUrl = process.env.DS_GROUP_CENTRAL_FETCH_URL,
}) {
  let config;
  try {
    config = JSON.parse(
      await readFile(
        process.env.DS_GROUP_CORE_CONFIG_PATH ||
          path.join(dataRoot, "core-config.json"),
        "utf8",
      ),
    );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const issuer = config?.identity?.central;
  if (!issuer || !config?.publicUrl)
    throw policyError(409, "This server does not trust a central server");
  const origin = new URL(config.publicUrl).origin;
  const base = (centralFetchUrl || issuer).replace(/\/$/, "");
  const call = async (route, { token, body } = {}) => {
    let response;
    try {
      response = await fetch(base + route, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(20000),
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body ?? {}),
      });
    } catch {
      throw policyError(502, "Central server is unreachable");
    }
    const value = await response.json().catch(() => ({}));
    if (!response.ok) throw centralError(response.status, value);
    return value;
  };
  const username = typeof input?.username === "string" ? input.username : "";
  const password = typeof input?.password === "string" ? input.password : "";
  const { token } = await call("/api/login", { body: { username, password } });
  try {
    const { challenge } = await call("/api/servers", {
      token,
      body: { origin },
    });
    const policy = await governance.read();
    if (policy.directory.challenge !== challenge)
      await governance.save({
        ...policy,
        directory: { ...policy.directory, challenge },
      });
    const { server } = await call(
      `/api/servers/${encodeURIComponent(origin)}/verify`,
      { token },
    );
    // Members pass the number central handed out on, so others can find the server by it.
    const current = await governance.read();
    if (current.directory.number !== server.number)
      await governance.save({
        ...current,
        directory: { ...current.directory, number: server.number },
      });
    return { central: issuer, server, policy: await governance.read() };
  } finally {
    await call("/api/logout", { token }).catch(() => {});
  }
}
