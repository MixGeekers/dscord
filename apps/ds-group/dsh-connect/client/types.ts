/** What the DSH host route `api/dscord` answers with `status` and every connection action. */
export interface ConnectionState {
  user: { id: string; name?: string; globalId?: string } | null;
  /** The chat server page the connection key came from, where the owner sets Bots up. */
  webUrl?: string;
  /** This device's name as the owner sees it on the web. */
  label?: string;
  bots: DeviceBot[];
  runtime?: { available: boolean; message?: string | null };
  nativeBundled?: boolean;
  /** Why the last report to the central server failed, if it did. */
  lastError?: string | null;
  syncedAt?: string | null;
  dataDirectory?: string;
  kernelUpdates?: KernelUpdates;
}

export type BotStatus = "offline" | "connecting" | "online" | "error";

/** A Bot the owner's account assigned to this device, and how it is doing on each of its chat servers. */
export interface DeviceBot {
  id: string;
  name: string;
  username: string;
  globalId?: string;
  model?: string | null;
  error?: string;
  servers: {
    url: string;
    serverName: string;
    status: BotStatus;
    error?: string;
  }[];
}

export interface KernelUpdates {
  current: string;
  phase?: "idle" | "installing" | "installed" | "restart-required" | "failed";
  error?: string;
  serverProtocol?: string;
  compatible?: boolean;
  available?: string | null;
  source?: string;
  policy?: "auto" | "notify" | "manual";
  channel?: "stable" | "prerelease";
}

export interface KernelState {
  decisionProvider?: DecisionProvider | null;
}

export interface DecisionProvider {
  enabled?: boolean;
  configured?: boolean;
  available?: boolean | null;
  model?: string;
}
