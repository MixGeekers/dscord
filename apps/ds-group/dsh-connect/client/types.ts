/** What the DSH host route `api/dscord` answers with `status` and every connection action. */
export interface ConnectionState {
  servers?: Server[];
  user: { id: string; name?: string; globalId?: string } | null;
  bots: ServerBot[];
  runtime?: { available: boolean; message?: string | null };
  models?: ModelCatalog;
  nativeMode?: boolean;
  nativeBundled?: boolean;
  nativeBots?: NativeBot[];
  hostId?: string;
  lastError?: string | null;
  dataDirectory?: string;
  kernelUpdates?: KernelUpdates;
}

export interface Server {
  url: string;
  serverName: string;
}

export interface ModelChoice {
  model: string;
}

export interface ModelCatalog {
  available?: boolean;
  defaultSelection?: ModelChoice;
  providers: {
    id: string;
    name: string;
    models: { model: string; name?: string; needsKey?: boolean }[];
  }[];
}

export type BotStatus = "offline" | "connecting" | "online" | "error";

export interface ServerBot {
  id: string;
  name?: string;
  localpart?: string;
  serverUrl?: string;
  serverName?: string;
  status?: BotStatus;
  connected?: boolean;
  lastError?: string | null;
  nativeBotId?: string;
  modelSelection?: ModelChoice;
  activeModel?: ModelChoice;
}

export interface NativeBot {
  id: string;
  name: string;
  role?: string;
  model?: string;
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

export type AttentionMode = "mention" | "shadow" | "natural";

export interface KernelState {
  attention?: { mode?: AttentionMode; activity?: string; status?: string };
  desiredAttention?: { mode?: AttentionMode; status?: string };
  decisionProvider?: DecisionProvider | null;
}

export interface DecisionProvider {
  enabled?: boolean;
  configured?: boolean;
  available?: boolean | null;
  model?: string;
}

export interface ListedServer {
  origin: string;
  number: number;
  name: string;
  description?: string;
  tags?: string[];
  join?: "open" | "invite";
  members?: { people: number; bots: number };
  added?: boolean;
}

export interface MemorySource {
  id: string;
  revision?: string | number;
  authorId?: string;
  authorKind?: string;
  roomId?: string;
  timestamp?: number;
  eventId?: string;
}

export interface MemoryItem {
  id: string;
  revision?: string | number;
  claimState?: "confirmed" | "uncertain";
  kind?: string;
  text: string;
  saidBy?: string;
  scope?: string;
  conflicts?: unknown[];
  sources?: MemorySource[];
}

export interface MemoryProfile {
  id?: string;
  identity?: { name?: string };
  items?: { id: string; name?: string }[];
  view?: Partial<
    Record<
      "currentClaims" | "preferences" | "projectFacts" | "changes",
      MemoryItem[]
    >
  > & {
    historyGaps?: unknown[];
    budget?: { omitted?: Record<string, number> };
  };
}
