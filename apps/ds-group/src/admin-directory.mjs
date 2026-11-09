import { readFile } from "node:fs/promises";
import path from "node:path";
import { policyError } from "./governance.mjs";

const centralError = (status, value) => {
  const code = typeof value?.code === "string" ? value.code : "CENTRAL_FAILED";
  // A refusal about this server's page or standing is the operator's to fix; anything else is the central server's.
  return policyError(
    status >= 400 && status < 500 ? 409 : 502,
    `Central server refused: ${code}`,
  );
};

/**
 * Submits this chat server to its central server's index. No central account is involved: the central server reads
 * this server's public page from its origin, and that page naming the central server is the consent to be listed.
 * Submitting again re-reads the page and brings back the current number and standing, which the policy keeps.
 */
export async function listInCentral({
  dataRoot,
  governance,
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
  let response;
  try {
    response = await fetch(`${base}/api/servers`, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(20000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin }),
    });
  } catch {
    throw policyError(502, "Central server is unreachable");
  }
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw centralError(response.status, value);
  const { server } = value;
  // Members pass the number on, so others can find the server by it.
  const current = await governance.read();
  await governance.save({
    ...current,
    directory: {
      ...current.directory,
      number: server.number,
      listing: server.status,
      listingNote: server.note || "",
    },
  });
  return { central: issuer, server, policy: await governance.read() };
}
