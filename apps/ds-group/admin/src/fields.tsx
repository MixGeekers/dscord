import { cloneElement, useId } from "react";
import type { ReactElement } from "react";
import { Checkbox } from "../../ui/controls";
import { useTranslation } from "./locale";
import { adminMessages } from "./messages";

const fileTools = ["read", "write", "edit", "read_image"];

/** Unique, trimmed entries from a newline- or comma-separated form field. */
export const lines = (value: FormDataEntryValue | null) => [
  ...new Set(
    String(value || "")
      .split(/[\n,]/)
      .map((value) => value.trim())
      .filter(Boolean),
  ),
];

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactElement<{ id?: string }>;
}) {
  const id = useId();
  return (
    <div className="admin-field">
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, { id })}
    </div>
  );
}

export function ToolFields({
  current = [],
  disabled = false,
}: {
  current?: string[];
  disabled?: boolean;
}) {
  const t = useTranslation(adminMessages);
  return (
    <fieldset className="admin-tools" disabled={disabled}>
      <legend>{t("tools")}</legend>
      {fileTools.map((tool) => (
        <label key={tool}>
          <Checkbox
            name="tools"
            value={tool}
            defaultChecked={current.includes(tool)}
            disabled={disabled}
          />
          {tool}
        </label>
      ))}
    </fieldset>
  );
}
