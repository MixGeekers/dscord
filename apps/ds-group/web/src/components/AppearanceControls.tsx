import { useSyncExternalStore } from "react";
import { Button } from "../../../ui/controls";
import { Select } from "../../../ui/select";
import { useLocale, useTranslation } from "../locale";
import { settingsMessages } from "../locales/settings";
import type { LocalePreference, ThemeColor, ThemePreference } from "../types";
import { Icon } from "./Icons";

const colors: ThemeColor[] = ["indigo", "blue", "teal", "rose", "amber"];
const subscribe = (listener: () => void) => {
  window.addEventListener("ds-group:theme", listener);
  return () => window.removeEventListener("ds-group:theme", listener);
};
const snapshot = () =>
  `${window.DSGroupTheme.getPreference()}|${window.DSGroupTheme.getColor()}`;

export function AppearanceControls({ idPrefix = "" }: { idPrefix?: string }) {
  const t = useTranslation(settingsMessages);
  const locale = useLocale();
  useSyncExternalStore(subscribe, snapshot, snapshot);
  const theme = window.DSGroupTheme;

  return (
    <div className="appearance-controls">
      <div className="appearance-field">
        <label htmlFor={`${idPrefix}language-select`}>{t("language")}</label>
        <Select<LocalePreference>
          id={`${idPrefix}language-select`}
          value={locale.preference}
          onValueChange={locale.setPreference}
          options={[
            { value: "system", label: t("system") },
            { value: "zh-CN", label: "简体中文" },
            { value: "en", label: "English" },
          ]}
        />
      </div>
      <div className="appearance-field">
        <label htmlFor={`${idPrefix}theme-select`}>{t("theme")}</label>
        <Select<ThemePreference>
          id={`${idPrefix}theme-select`}
          value={theme.getPreference()}
          onValueChange={(value) => theme.setPreference(value)}
          options={[
            { value: "system", label: t("system") },
            { value: "light", label: t("light") },
            { value: "dark", label: t("dark") },
          ]}
        />
      </div>
      <fieldset className="theme-colors">
        <legend>{t("themeColor")}</legend>
        <div className="theme-swatches">
          {colors.map((color) => (
            <Button
              variant="ghost"
              key={color}
              type="button"
              className="theme-swatch"
              data-color={color}
              aria-label={t(color)}
              title={t(color)}
              aria-pressed={theme.getColor() === color}
              onClick={() => theme.setColor(color)}
            >
              {theme.getColor() === color && <Icon name="check" />}
            </Button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
