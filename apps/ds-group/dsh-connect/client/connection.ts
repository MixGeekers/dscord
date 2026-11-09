import type { MessageKey, Translate } from "./locale";
import type { ConnectionState, ListedServer, ModelChoice } from "./types";

export interface Snapshot {
  value: ConnectionState | null;
  busy: { action: string; botId?: string } | null;
  error: string | null;
  errorTranslation: {
    key: MessageKey;
    params?: Record<string, string | number>;
  } | null;
  loading: boolean;
  notice?: MessageKey | null;
}

type ClientError = Error & {
  translation?: Snapshot["errorTranslation"];
  httpStatus?: number;
};

const SHORT_ACTIONS = ["status", "login", "kernel-state", "memory-profile"];
const MODEL_ERRORS: Record<string, MessageKey> = {
  MODEL_POLICY_DENIED: "serverPolicyDenied",
  MODEL_OUTPUT_LIMIT: "serverOutputLimit",
  MISSING_CREDENTIAL: "missingCredential",
  INVALID_REASONING_EFFORT: "invalidEffort",
  INVALID_OUTPUT_LIMIT: "invalidOutput",
  INVALID_MODEL: "modelUnavailable",
  MODEL_UNAVAILABLE: "modelUnavailable",
  MODEL_PROVIDER_UNAVAILABLE: "modelUnavailable",
  MODEL_PROFILE_INVALID: "providerInvalid",
  DSCORD_KERNEL_CONFLICT: "kernelConflict",
};

/**
 * The page's one view of the DSH host route: it reads the connection status every five seconds while the page is
 * visible, runs one action at a time, and keeps an action's error until the next action or an explicit refresh.
 */
export function createConnectionModel(t: Translate) {
  let snapshot: Snapshot = {
    value: null,
    busy: null,
    error: null,
    errorTranslation: null,
    loading: true,
  };
  const listeners = new Set<() => void>();
  let disposed = false;
  let pollTimer: ReturnType<typeof setInterval> | undefined;
  let readController: AbortController | undefined;
  let actionController: AbortController | undefined;
  let revision = 0;
  let errorSource: "action" | "status" | null = null;
  let initialStatus = true;

  function clientError(
    key: MessageKey,
    params?: Record<string, string | number>,
  ): ClientError {
    return Object.assign(new Error(t(key, params)), {
      translation: { key, params },
    });
  }

  function publish(update: Partial<Snapshot>) {
    if (disposed) return;
    snapshot = { ...snapshot, ...update };
    for (const listener of listeners) listener();
  }

  async function request<T = ConnectionState>(
    action: string,
    payload: Record<string, unknown>,
    controller: AbortController,
    connectionState = true,
  ): Promise<T> {
    const timeoutMs = SHORT_ACTIONS.includes(action) ? 30_000 : 300_000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch("api/dscord", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
        signal: controller.signal,
      });
      if (!response.ok)
        throw Object.assign(
          clientError("requestHttp", { status: response.status }),
          { httpStatus: response.status },
        );
      const result = (await response.json()) as {
        ok: boolean;
        value?: T;
        error?: { code?: string; message?: string };
      };
      if (!result.ok) {
        const key = result.error?.code
          ? MODEL_ERRORS[result.error.code]
          : undefined;
        throw key
          ? clientError(key)
          : result.error?.message
            ? new Error(result.error.message)
            : clientError("requestFailed");
      }
      if (
        !result.value ||
        (connectionState &&
          !Array.isArray((result.value as unknown as ConnectionState).bots))
      )
        throw clientError("invalidStatus");
      return result.value;
    } catch (error) {
      if ((error as Error).name === "AbortError")
        throw clientError("requestTimeout");
      if (error instanceof TypeError)
        throw clientError("connectionUnavailable");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  // DSH registers the route a moment after the page can load, so only the first read waits for it.
  async function readStatus(controller: AbortController) {
    const attempts = initialStatus ? 3 : 1;
    initialStatus = false;
    for (let attempt = 0; ; attempt++) {
      try {
        return await request("status", {}, controller);
      } catch (error) {
        if (
          (error as ClientError).httpStatus !== 404 ||
          attempt + 1 === attempts ||
          controller.signal.aborted
        )
          throw error;
        await new Promise((resolve) => setTimeout(resolve, 250));
        controller.signal.throwIfAborted();
      }
    }
  }

  async function refresh({ clearError = true } = {}) {
    if (disposed || snapshot.busy || readController) return;
    const current = revision;
    const controller = new AbortController();
    readController = controller;
    try {
      const value = await readStatus(controller);
      if (current === revision) {
        const error =
          !clearError && errorSource === "action" ? snapshot.error : null;
        if (!error) errorSource = null;
        publish({
          value,
          loading: false,
          error,
          errorTranslation: error ? snapshot.errorTranslation : null,
        });
      }
    } catch (error) {
      if (current === revision) {
        errorSource = "status";
        publish({
          loading: false,
          error: (error as Error).message,
          errorTranslation: (error as ClientError).translation || null,
        });
      }
    } finally {
      if (readController === controller) readController = undefined;
    }
  }

  async function mutate(action: string, payload: Record<string, unknown> = {}) {
    if (disposed || snapshot.busy) return undefined;
    revision += 1;
    readController?.abort();
    readController = undefined;
    const controller = new AbortController();
    actionController = controller;
    errorSource = null;
    publish({
      busy: { action, botId: payload.botId as string | undefined },
      notice: null,
      error: null,
      errorTranslation: null,
    });
    try {
      if (action === "reconnect") {
        publish({ value: await request("disconnect", payload, controller) });
        action = "connect";
      }
      const value = await request(action, payload, controller);
      publish({
        value,
        error: null,
        errorTranslation: null,
        notice:
          action === "save-model"
            ? "savedModel"
            : action === "create-native"
              ? "localCreated"
              : null,
      });
      return value;
    } catch (error) {
      errorSource = "action";
      publish({
        error: (error as Error).message,
        errorTranslation: (error as ClientError).translation || null,
      });
      return undefined;
    } finally {
      actionController = undefined;
      publish({ busy: null, loading: false });
    }
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    if (listeners.size === 1) {
      void refresh({ clearError: false });
      pollTimer = setInterval(() => {
        if (document.visibilityState !== "hidden")
          void refresh({ clearError: false });
      }, 5000);
    }
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        clearInterval(pollTimer);
        pollTimer = undefined;
      }
    };
  }

  const invite = (inviteCode: string) => (inviteCode ? { inviteCode } : {});
  return {
    getSnapshot: () => snapshot,
    subscribe,
    refresh,
    login: (
      serverUrl: string,
      user: string,
      password: string,
      inviteCode = "",
    ) => mutate("login", { serverUrl, user, password, ...invite(inviteCode) }),
    addServer: (serverUrl: string, inviteCode = "") =>
      mutate("add-server", { serverUrl, ...invite(inviteCode) }),
    searchServers: (query: string) =>
      request<{ servers: ListedServer[] }>(
        "search-servers",
        { query },
        new AbortController(),
        false,
      ),
    removeServer: (serverUrl: string) => mutate("remove-server", { serverUrl }),
    logout: () => mutate("logout"),
    saveModel: (botId: string, selection: ModelChoice) =>
      mutate("save-model", { botId, selection }),
    createNative: (payload: Record<string, unknown>) =>
      mutate("create-native", payload),
    kernel: <T>(
      action: string,
      payload: Record<string, unknown> = {},
      controller = new AbortController(),
    ) => request<T>(action, payload, controller, false),
    attach: (nativeBotId: string, botId?: string, serverUrl?: string) =>
      mutate("attach", {
        nativeBotId,
        ...(botId ? { botId } : {}),
        ...(serverUrl ? { serverUrl } : {}),
      }),
    connect: (botId: string) => mutate("connect", { botId }),
    disconnect: (botId: string) => mutate("disconnect", { botId }),
    reconnect: (botId: string) => mutate("reconnect", { botId }),
    dispose() {
      disposed = true;
      revision += 1;
      clearInterval(pollTimer);
      readController?.abort();
      actionController?.abort();
      listeners.clear();
    },
  };
}

export type Connection = ReturnType<typeof createConnectionModel>;
