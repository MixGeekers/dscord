import { useSyncExternalStore } from "react";
import type { ComponentType } from "react";
import { createPortal } from "react-dom";
import { Button } from "./components/controls";
import { ConnectionPage } from "./components/page";
import { createConnectionModel } from "./connection";
import { en, localeNamespace, zh } from "./locale";
import type { Translate } from "./locale";
import mark from "./mark.png";
import { base } from "./styles";

const panelId = "dscord";

interface SlotEntry {
  options?: { id?: string };
  inject?: () => unknown;
}

/** The parts of DSH's plugin context this page uses. */
interface PluginContext {
  effect(run: () => void | (() => void), label: string): void;
  plugin(plugin: unknown): void;
  locale: {
    register(
      namespace: string,
      dictionaries: Record<string, object>,
    ): () => void;
    bind(namespace: string): Translate;
  };
  layout: { selectPanel(id: string): void };
  slots: {
    inject(name: string, register: () => () => void): void;
    register(
      options: Record<string, unknown>,
      component: ComponentType<never>,
    ): () => void;
    subscribe(name: string, listener: () => void): () => void;
    entries(name: string): SlotEntry[];
  };
}

/** The Bot workspace's return action, as the bundled native plugin publishes it. */
interface BotFace {
  actions: { setSurface(surface: string): void };
  hooks: {
    surface: {
      subscribe(listener: () => void): () => void;
      getSnapshot(): { mode?: string };
    };
  };
}

export const inject = ["slots", "locale", "layout"];

export function apply(ctx: PluginContext) {
  ctx.effect(
    () => ctx.locale.register(localeNamespace, { zh, en }),
    "dscord: dictionaries",
  );
  const t = ctx.locale.bind(localeNamespace);
  const connection = createConnectionModel(t);
  // The bundled Bot workspace shares DSCord's kernel API and identities.
  if (typeof dscordNativeFactory === "function") {
    const factory = dscordNativeFactory;
    let mounted = false;
    const unsubscribe = connection.subscribe(() => {
      if (!mounted && connection.getSnapshot().value?.nativeBundled) {
        mounted = true;
        ctx.plugin(factory(require));
      }
    });
    ctx.effect(() => unsubscribe, "dscord: native Bot interface");
  }
  ctx.effect(() => () => connection.dispose(), "dscord: connection page");
  const injectPage = () => ({ connection });

  /** DSCord's own mark, at the size DSH draws sidebar icons. */
  function SidebarIcon({ size = 16 }: { size?: number }) {
    return (
      <img
        src={mark}
        width={size}
        height={size}
        alt=""
        draggable={false}
        style={{ display: "block" }}
      />
    );
  }

  // Keep a return action available from the local Bot workspace.
  function NativeShortcutButton({ face }: { face: BotFace }) {
    const mode = useSyncExternalStore(
      face.hooks.surface.subscribe,
      () => face.hooks.surface.getSnapshot().mode,
    );
    if (mode !== "bot") return null;
    return createPortal(
      // Outside the page, so it brings the design system with it.
      <div
        className="dscord-ui"
        style={{
          position: "fixed",
          left: 56,
          bottom: 16,
          zIndex: 50,
          pointerEvents: "auto",
        }}
      >
        <style>{base}</style>
        <Button
          variant="secondary"
          type="button"
          onClick={() => {
            face.actions.setSurface("agent");
            ctx.layout.selectPanel(panelId);
          }}
        >
          {t("title")}
        </Button>
      </div>,
      document.body,
    );
  }

  function NativeShortcut() {
    const entry = useSyncExternalStore(
      (listener) => ctx.slots.subscribe("sidebar.footer.action", listener),
      () =>
        ctx.slots
          .entries("sidebar.footer.action")
          .find((item) => item.options?.id === "bot-return"),
    );
    const face = entry?.inject?.() as Partial<BotFace> | undefined;
    return face?.actions?.setSurface && face.hooks?.surface ? (
      <NativeShortcutButton face={face as BotFace} />
    ) : null;
  }

  ctx.slots.inject("main", () =>
    ctx.slots.register(
      {
        name: "main",
        key: panelId,
        locale: localeNamespace,
        inject: injectPage,
      },
      ConnectionPage,
    ),
  );
  ctx.slots.inject("sidebar.panellist", () =>
    ctx.slots.register(
      {
        name: "sidebar.panellist",
        id: panelId,
        label: () => t("title"),
        locale: localeNamespace,
        order: 20,
      },
      SidebarIcon,
    ),
  );
  ctx.slots.inject("shell.overlay", () =>
    ctx.slots.register(
      {
        name: "shell.overlay",
        id: panelId,
        order: 65,
        locale: localeNamespace,
      },
      NativeShortcut,
    ),
  );
  ctx.slots.inject("plugins.bundle.config", () =>
    ctx.slots.register(
      {
        name: "plugins.bundle.config",
        key: panelId,
        locale: localeNamespace,
        inject: injectPage,
      },
      ConnectionPage,
    ),
  );
}
