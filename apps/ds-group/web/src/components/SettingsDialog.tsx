import { AvatarEditor } from "./AvatarEditor";
import { NameEditor } from "./NameEditor";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Input } from "../../../ui/controls";
import { Dialog, DialogContent, DialogTitle } from "../../../ui/overlays";
import { initializePwa } from "../../pwa.js";
import { defaultClientConfig } from "../client-config";
import type { ClientConfig } from "../client-config";
import { storageKey } from "../session";
import { useTranslation } from "../locale";
import { AppearanceControls } from "./AppearanceControls";
import { ConnectDsh } from "./ConnectDsh";
import { Icon } from "./Icons";
import { settingsMessages } from "../locales/settings";
import type {
  Api,
  PwaHandle,
  Session,
  SettingsTab,
  Participant,
} from "../types";
import { Field } from "../../../ui/form";
import { InfoList, ScrollArea, Section } from "../../../ui/layout";

export interface SettingsDialogProps {
  tab: SettingsTab | null;
  onClose(): void;
  onTab(tab: SettingsTab): void;
  session: Session | null;
  api: Api;
  config?: ClientConfig;
  onSwitchAccount(): void;
  onLogout(): void;
  logoutBusy: boolean;
  currentUser?: Participant | null;
  onProfileChanged?(): void;
  onOpenRoom(
    roomId: string,
    eventId?: string,
    expectedUserId?: string,
  ): void | Promise<void>;
  onPwaReady(handle: PwaHandle): void;
}
const tabs: SettingsTab[] = ["account", "appearance", "notifications"];

export function SettingsDialog(props: SettingsDialogProps) {
  const { tab, session } = props;
  const t = useTranslation(settingsMessages);
  const current = useRef(props);
  current.current = props;
  const pwa = useRef<PwaHandle | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const portalRef = useCallback((element: HTMLDivElement | null) => {
    if (element) setPortalReady(true);
  }, []);
  const [config] = useState(() => props.config ?? defaultClientConfig());
  useEffect(() => {
    if (!portalReady) return;
    if (!pwa.current) {
      pwa.current = initializePwa({
        request: (route, options) => current.current.api(route, options),
        getSession: () => current.current.session,
        getOwnerScope: () =>
          current.current.session
            ? storageKey(config, "push", current.current.session)
            : "",
        homeCoreUrl: config.homeCoreUrl,
        onOpenRoom: (navigation) =>
          current.current.onOpenRoom(
            navigation.roomId,
            navigation.eventId,
            navigation.userId,
          ),
      });
      current.current.onPwaReady(pwa.current);
    }
    void pwa.current.refresh();
    return () => {
      pwa.current?.destroy?.();
      pwa.current = null;
    };
  }, [portalReady]);
  useEffect(() => {
    void pwa.current?.refresh();
  }, [session, tab]);
  return (
    <Dialog
      open={tab !== null}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <DialogContent
        id="settings-dialog"
        ref={portalRef}
        className="settings-dialog"
        aria-labelledby="settings-title"
        finalFocus={() => document.getElementById("identity-button")}
      >
        <header className="dialog-heading">
          <DialogTitle id="settings-title">{t("settings")}</DialogTitle>
          <Button
            id="close-settings"
            className="icon-button"
            variant="ghost"
            size="icon"
            type="button"
            aria-label={t("close")}
            onClick={props.onClose}
          >
            <Icon name="close" />
          </Button>
        </header>
        <nav className="settings-tabs" aria-label={t("settingsCategories")}>
          {tabs.map((name) => (
            <button
              key={name}
              type="button"
              data-settings-tab={name}
              aria-current={tab === name ? "page" : undefined}
              onClick={() => props.onTab(name)}
            >
              {t(name)}
            </button>
          ))}
        </nav>
        <ScrollArea className="dialog-scroll-region settings-panel-scroll">
          <div
            className="settings-panel"
            data-settings-panel="account"
            hidden={tab !== "account"}
          >
            {/* The avatar and name live on the central server, so they need the central sign-in. */}
            {tab === "account" &&
              session?.binding?.centralIssuer &&
              session.central?.token && (
                <Section title={t("currentAccount")}>
                  <AvatarEditor
                    key={session.user_id}
                    session={session}
                    member={
                      props.currentUser ?? {
                        id: session.user_id,
                        globalId: session.identity?.globalId ?? undefined,
                        name: session.user_id,
                        kind: "human",
                      }
                    }
                    onChanged={props.onProfileChanged}
                  />
                  <NameEditor
                    key={`name-${session.user_id}-${props.currentUser?.name ?? ""}`}
                    session={session}
                    name={props.currentUser?.name ?? ""}
                    onChanged={props.onProfileChanged}
                  />
                </Section>
              )}
            <Section title={t("identity")} description={t("identityHelp")}>
              <InfoList
                className="account-identity"
                items={[
                  {
                    label: t("userId"),
                    value: (
                      <span id="settings-account">
                        {session?.user_id || t("signedOut")}
                      </span>
                    ),
                    code: Boolean(session),
                  },
                  ...(session?.identity?.globalId
                    ? [
                        {
                          label: t("globalId"),
                          value: session.identity.globalId,
                          code: true,
                        },
                      ]
                    : []),
                  {
                    label: t("central"),
                    value:
                      session?.binding?.centralIssuer ?? t("configuredByHome"),
                  },
                  { label: t("homeCore"), value: config.homeCoreUrl },
                  {
                    label: t("homeMatrix"),
                    value:
                      session?.home?.matrixUrl ??
                      config.homeMatrixUrl ??
                      t("configuredByHome"),
                  },
                ]}
              />
            </Section>
            {session && (
              <ConnectDsh session={session} server={config.homeCoreUrl} />
            )}
          </div>
          <div
            className="settings-panel"
            data-settings-panel="notifications"
            hidden={tab !== "notifications"}
          >
            <Section title={t("deviceNotifications")}>
              <p id="push-status" className="settings-status" role="status" />
              <Field
                label={t("deviceName")}
                htmlFor="push-device-label"
                description={t("deviceNameHelp")}
              >
                <Input
                  id="push-device-label"
                  maxLength={80}
                  autoComplete="off"
                  aria-describedby="push-device-label-description"
                />
              </Field>
              <p
                id="push-feedback"
                className="settings-feedback"
                role="status"
              />
              <details className="settings-help">
                <summary>{t("mobileNotifications")}</summary>
                <p>{t("mobileHelp")}</p>
              </details>
            </Section>
          </div>
          <div
            className="settings-panel"
            data-settings-panel="appearance"
            hidden={tab !== "appearance"}
          >
            <Section title={t("appearanceLanguage")}>
              <AppearanceControls />
            </Section>
            <Section title={t("application")}>
              <InfoList
                items={[
                  {
                    label: t("installApp"),
                    value: <span id="install-status" role="status" />,
                  },
                  {
                    label: t("connection"),
                    value: <span id="offline-status" role="status" />,
                  },
                ]}
              />
              <p id="install-help" className="settings-feedback" />
            </Section>
          </div>
        </ScrollArea>
        <footer className="dialog-footer settings-dialog-footer">
          <div className="settings-actions" hidden={tab !== "account"}>
            <Button
              id="switch-account"
              variant="secondary"
              type="button"
              onClick={props.onSwitchAccount}
              disabled={props.logoutBusy}
            >
              {t("switchAccount")}
            </Button>
            {session && (
              <Button
                id="logout-button"
                variant="destructive"
                type="button"
                disabled={props.logoutBusy}
                onClick={props.onLogout}
              >
                {t(props.logoutBusy ? "signingOut" : "signOut")}
              </Button>
            )}
          </div>
          <div className="settings-actions" hidden={tab !== "notifications"}>
            <Button id="enable-push" type="button">
              {t("enableNotifications")}
            </Button>
            <Button id="disable-push" variant="secondary" type="button" hidden>
              {t("disableNotifications")}
            </Button>
            <Button id="test-push" variant="secondary" type="button">
              {t("testNotification")}
            </Button>
          </div>
          <div className="settings-actions" hidden={tab !== "appearance"}>
            <Button id="install-app" type="button">
              {t("install")}
            </Button>
            <Button id="refresh-app" variant="secondary" type="button">
              {t("reload")}
            </Button>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
