import { Input, Textarea } from "../../../ui/controls";
import { Select } from "../../../ui/select";
import type { Device } from "../central";
import { useTranslation } from "../locale";
import { botMessages } from "../locales/bots";
import { lacksDecision } from "../managed-bots";
import type { BotStage } from "../managed-bots";

/** What the owner decides about a Bot. An empty model follows the device; an empty device waits for the first one. */
export interface BotSetup {
  displayName: string;
  role: string;
  model: string;
  deviceId: string;
}

type Key = keyof (typeof botMessages)["en"];

const STAGE_TEXT: Record<BotStage, Key> = {
  noDevice: "stageNoDevice",
  deviceOffline: "stageDeviceOffline",
  failed: "stageFailed",
  notHere: "stageNotHere",
  starting: "stageStarting",
  offline: "stageOffline",
  connecting: "stageConnecting",
  online: "stageOnline",
  error: "stageError",
};

export function StageLabel({ stage }: { stage: BotStage }) {
  const t = useTranslation(botMessages);
  return (
    <span className="space-state bot-stage" data-stage={stage}>
      {t(STAGE_TEXT[stage])}
    </span>
  );
}

/**
 * The name, role, device and model of a Bot. The device is always shown, so it is plain where the Bot will
 * run; the models are the ones that device reported, so a model it cannot run is never offered.
 */
/** Said wherever a device is named whose Bots would run without their decision model. */
export function DecisionWarning({ device }: { device: Device | undefined }) {
  const t = useTranslation(botMessages);
  if (!lacksDecision(device)) return null;
  return (
    <p className="small bot-decision-warning" data-decision-warning>
      {t("decisionMissing")}
    </p>
  );
}

export function BotSetupFields({
  idPrefix,
  value,
  devices,
  disabled,
  onChange,
}: {
  idPrefix: string;
  value: BotSetup;
  devices: Device[];
  disabled: boolean;
  onChange(next: BotSetup): void;
}) {
  const t = useTranslation(botMessages);
  const device =
    devices.find((item) => item.id === value.deviceId) ??
    (devices.length === 1 ? devices[0] : undefined);
  const catalog = device?.models ?? null;
  const offered = new Set(
    catalog?.providers.flatMap((provider) =>
      provider.models.map((item) => item.model),
    ),
  );
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <div className="bot-setup-fields">
      <label htmlFor={id("name")}>{t("name")}</label>
      <Input
        id={id("name")}
        maxLength={80}
        autoComplete="off"
        required
        placeholder={t("namePlaceholder")}
        value={value.displayName}
        disabled={disabled}
        onChange={(event) =>
          onChange({ ...value, displayName: event.target.value })
        }
      />
      <label htmlFor={id("role")}>{t("role")}</label>
      <Textarea
        id={id("role")}
        rows={3}
        maxLength={4000}
        placeholder={t("rolePlaceholder")}
        value={value.role}
        disabled={disabled}
        onChange={(event) => onChange({ ...value, role: event.target.value })}
      />
      <label htmlFor={id("device")}>{t("device")}</label>
      <Select
        id={id("device")}
        value={value.deviceId}
        disabled={disabled || !devices.length}
        onValueChange={(deviceId) =>
          // Models belong to a device, so a choice made for another device does not carry over.
          onChange({ ...value, deviceId, model: "" })
        }
        options={[
          ...(value.deviceId ? [] : [{ value: "", label: t("deviceAuto") }]),
          ...devices.map((item) => ({
            value: item.id,
            label: `${item.label} · ${t(item.online ? "deviceOnline" : "deviceOffline")}`,
          })),
        ]}
      />
      {!devices.length && <p className="small muted">{t("deviceNone")}</p>}
      <DecisionWarning device={device} />
      <label htmlFor={id("model")}>{t("model")}</label>
      <Select
        id={id("model")}
        value={value.model}
        disabled={disabled}
        onValueChange={(model) => onChange({ ...value, model })}
        options={[
          {
            value: "",
            label: catalog?.defaultModel
              ? t("deviceDefaultNamed", { model: catalog.defaultModel })
              : t("deviceDefault"),
          },
          ...(value.model && !offered.has(value.model)
            ? [{ value: value.model, label: value.model }]
            : []),
          ...(catalog?.providers.flatMap((provider) =>
            provider.models.map((item) => ({
              value: item.model,
              group: provider.name,
              label: item.needsKey
                ? t("needsKey", { name: item.name ?? item.model })
                : (item.name ?? item.model),
            })),
          ) ?? []),
        ]}
      />
      {!device && <p className="small muted">{t("modelNoDevice")}</p>}
      {catalog?.error && (
        <p className="small muted">
          {t("modelsUnavailable", { error: catalog.error })}
        </p>
      )}
    </div>
  );
}
