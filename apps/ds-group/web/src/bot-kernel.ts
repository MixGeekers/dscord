export type ParticipationMode = "mention" | "shadow" | "natural";
export type BotActivity = "listening" | "waiting" | "working" | "speaking";
export interface BotAttention {
  mode: ParticipationMode | null;
  activity?: BotActivity | null;
  status?: string | null;
  provider: {
    id?: string | null;
    model?: string | null;
    configured: boolean | null;
    available?: boolean | null;
    health?: "unknown" | "ok" | "error" | "unconfigured";
  } | null;
  queue?: {
    pending?: number;
    waiting?: number;
    evaluating?: number;
    errors?: number;
  } | null;
  lastDecision?: {
    action: "LISTEN" | "WAIT" | "SPEAK";
    at?: number;
    outcome?: string;
  } | null;
}
export interface BotKernelView {
  online?: boolean;
  updatedAt?: number | null;
  desiredAttention?: AttentionReceipt | null;
  runtime: {
    id: string | null;
    version?: string | null;
    upstreamVersion?: string | null;
    available: boolean | null;
  } | null;
  attention: BotAttention | null;
  work: {
    status: string | null;
    activeTasks: number | null;
    waiting: number | boolean | null;
    workers?: WorkerTask[];
    queue?: WorkerTask[];
  } | null;
  responder: ResponderStatus | null;
}
/** The front, which answers people: replying to one request, deciding whether to speak, or idle. */
export interface ResponderStatus {
  state?: "replying" | "deciding" | "idle" | "offline" | string;
  roomId?: string | null;
  requesterId?: string | null;
  since?: number | null;
}
/** A task the program core is running or holding in its queue. */
export interface WorkerTask {
  taskId: string;
  title?: string;
  stage?: string;
  roomId?: string | null;
  requesterId?: string | null;
  progress?: string | null;
  doing?: {
    tool?: string;
    target?: string;
    said?: string;
    since?: string;
  } | null;
  waiting?: unknown;
  since?: string | null;
  toolCalls?: number;
}
export interface BotStatus {
  botId: string;
  online: boolean;
  updatedAt: number | null;
  activity: BotActivity | null;
  responder: ResponderStatus | null;
  workers: WorkerTask[];
  queue: WorkerTask[];
  lastDecision: BotAttention["lastDecision"];
}
export type TimelineItem = {
  id: string;
  at: number;
  roomId?: string | null;
  peerId?: string | null;
  status?: string | null;
} & (
  | { kind: "request"; text?: string; error?: string | null }
  | {
      kind: "decision";
      action?: "LISTEN" | "WAIT" | "SPEAK" | null;
      outcome?: string | null;
    }
  | {
      kind: "task";
      taskId: string;
      title?: string;
      from?: string | null;
      to?: string;
      by?: string | null;
    }
  | {
      kind: "exchange";
      direction: "in" | "out";
      taskId?: string | null;
      detail?: string | null;
    }
);
export interface TimelinePage {
  items: TimelineItem[];
  next: number | null;
}
export interface BotContact {
  id: string;
  name?: string;
  kind?: string;
  role?: string;
  rooms?: string[];
  reach?: string | null;
  firstSeenAt?: number | null;
  lastExchangeAt?: number | null;
}
export interface ContactExchange {
  id: string;
  at: number;
  direction: "in" | "out";
  peerId: string;
  roomId?: string | null;
  status?: string;
  taskId?: string | null;
  detail?: string | null;
}
export interface ContactsPage {
  contacts: BotContact[];
  exchanges: ContactExchange[];
  next: number | null;
}
export interface MemoryChange {
  id: string;
  time?: string;
  op?: "add" | "remove" | "replace" | string;
  scope?: "own" | "team" | "group" | string;
  text?: string;
  by?: string;
  restored?: boolean;
}
export interface MemoryChangesPage {
  rows: MemoryChange[];
  more: string | null;
}
export interface AttentionReceipt {
  mode: ParticipationMode;
  revision: number;
  status: "pending" | "applied";
  applied?: boolean;
  online?: boolean;
}
export type MemoryProfileKind = "person" | "project";
export interface MemoryProfileItem {
  id: string;
  name: string;
  kind: MemoryProfileKind;
  aliases?: string[];
  currentCount?: number;
  historyCount?: number;
  scopes?: string[];
}
export interface MemorySource {
  id: string;
  revision?: number;
  authorId?: string;
  authorKind?: string;
  eventId?: string;
  roomId?: string;
  timestamp?: number | null;
  digest?: string;
}
export interface MemoryClaim {
  id: string;
  revision?: number;
  text: string;
  claimState?: "statement" | "proposal" | "confirmed" | "uncertain";
  kind?: "stated" | "reported" | "observation" | "inference" | "legacy";
  saidBy?: string;
  scope?: string;
  sources?: MemorySource[];
  sourceRefs?: { id: string; revision?: number }[];
  conflicts?: string[];
  derivation?: string;
}
export interface MemoryProfile {
  kind: MemoryProfileKind;
  id: string;
  identity: MemoryProfileItem;
  view: {
    currentClaims?: MemoryClaim[];
    preferences?: MemoryClaim[];
    projectFacts?: MemoryClaim[];
    changes?: MemoryClaim[];
    recentSources?: MemorySource[];
    historyGaps?: unknown[];
    knowledgeBoundary?: string | { text?: string };
    budget?: {
      maxChars?: number;
      usedChars?: number;
      omitted?: Record<string, number>;
    };
  };
}

/** Transport status and attention are separate: a waiting Bot is still online. */
export function connectionLabel(status: string | undefined) {
  if (
    ["online", "idle", "ready", "connected", "listening", "waiting"].includes(
      status ?? "",
    )
  )
    return "online";
  if (
    [
      "running",
      "thinking",
      "busy",
      "processing",
      "starting",
      "working",
      "speaking",
    ].includes(status ?? "")
  )
    return "busy";
  if (["failed", "error", "unavailable"].includes(status ?? ""))
    return "unavailable";
  if (status === "offline" || status === "disconnected") return "offline";
  return "unknown";
}
