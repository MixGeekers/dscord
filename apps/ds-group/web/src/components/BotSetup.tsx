import { Input, NativeSelect, Textarea } from "../../../ui/controls";
import type { Device } from "../central";
import { useTranslation } from "../locale";
import { botMessages } from "../locales/bots";
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
 * The name, role, model and device of a Bot. The models are the ones the chosen device reported, so a model
 * the device cannot run is never offered.
 */
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
      <label htmlFor={id("model")}>{t("model")}</label>
      <NativeSelect
        id={id("model")}
        value={value.model}
        disabled={disabled}
        onChange={(event) => onChange({ ...value, model: event.target.value })}
      >
        <option value="">
          {catalog?.defaultModel
            ? t("deviceDefaultNamed", { model: catalog.defaultModel })
            : t("deviceDefault")}
        </option>
        {value.model && !offered.has(value.model) && (
          <option value={value.model}>{value.model}</option>
        )}
        {catalog?.providers.map((provider) => (
          <optgroup key={provider.id} label={provider.name}>
            {provider.models.map((item) => (
              <option key={item.model} value={item.model}>
                {item.needsKey
                  ? t("needsKey", { name: item.name ?? item.model })
                  : (item.name ?? item.model)}
              </option>
            ))}
          </optgroup>
        ))}
      </NativeSelect>
      {!device && <p className="small muted">{t("modelNoDevice")}</p>}
      {catalog?.error && (
        <p className="small muted">
          {t("modelsUnavailable", { error: catalog.error })}
        </p>
      )}
      {devices.length > 1 && (
        <>
          <label htmlFor={id("device")}>{t("device")}</label>
          <NativeSelect
            id={id("device")}
            value={value.deviceId}
            disabled={disabled}
            onChange={(event) =>
              // Models belong to a device, so a choice made for another device does not carry over.
              onChange({ ...value, deviceId: event.target.value, model: "" })
            }
          >
            {!value.deviceId && <option value="">{t("deviceAuto")}</option>}
            {devices.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label} ·{" "}
                {t(item.online ? "deviceOnline" : "deviceOffline")}
              </option>
            ))}
          </NativeSelect>
        </>
      )}
    </div>
  );
}
