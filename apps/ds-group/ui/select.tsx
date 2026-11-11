// Select drawn by DSCord on Base UI: the trigger looks like an input and the list is ours, never the system menu.
// Values are strings; a hidden input carries the value for FormData under `name`.
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import type { ReactNode, Ref } from "react";
import { useFormReset } from "./form-reset";
import { clsx as cn } from "clsx";

export interface SelectOption<Value extends string = string> {
  value: Value;
  label: ReactNode;
  /** A second line under the label, in the list only. */
  description?: ReactNode;
  disabled?: boolean;
  /** Options next to each other with the same group are listed under that heading. */
  group?: string;
}

export interface SelectProps<Value extends string = string> {
  options: readonly SelectOption<Value>[];
  value?: Value;
  defaultValue?: Value;
  onValueChange?: (value: Value) => void;
  /** Shown while nothing is chosen. */
  placeholder?: ReactNode;
  /** The trigger's id, for `<label htmlFor>`. */
  id?: string;
  name?: string;
  form?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  /** Extra class on the portal, for hosts that scope their styles (the DSH page passes its scope class). */
  portalClassName?: string;
  inputRef?: Ref<HTMLInputElement>;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

/** Runs of neighbouring options that share a group. */
function groupOptions<Value extends string>(
  options: readonly SelectOption<Value>[],
) {
  const runs: { group?: string; options: SelectOption<Value>[] }[] = [];
  for (const option of options) {
    const last = runs.at(-1);
    if (last && last.group === option.group) last.options.push(option);
    else runs.push({ group: option.group, options: [option] });
  }
  return runs;
}

function renderItem<Value extends string>(option: SelectOption<Value>) {
  return (
    <SelectPrimitive.Item
      key={option.value}
      value={option.value}
      disabled={option.disabled}
      data-value={option.value}
      className="ds-select-item"
    >
      <span className="ds-select-item-text">
        <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
        {option.description ? (
          <span className="ds-select-item-description">
            {option.description}
          </span>
        ) : null}
      </span>
      <SelectPrimitive.ItemIndicator className="ds-select-item-indicator">
        <Check aria-hidden="true" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

export function Select<Value extends string = string>({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder,
  id,
  name,
  form,
  disabled,
  required,
  className,
  portalClassName,
  inputRef,
  ...aria
}: SelectProps<Value>) {
  const { version, connectInput } = useFormReset(inputRef, form);
  // A native modal <dialog> sits in the top layer, above anything on <body>; inside one, the list opens in it.
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const items = options.map((option) => ({
    value: option.value,
    label: option.label,
  }));
  return (
    <SelectPrimitive.Root<Value>
      key={version}
      items={items}
      value={value}
      defaultValue={defaultValue}
      onValueChange={(next) => {
        if (next !== null) onValueChange?.(next);
      }}
      id={id}
      name={name}
      form={form}
      disabled={disabled}
      required={required}
      inputRef={connectInput}
    >
      <SelectPrimitive.Trigger
        ref={(node: HTMLButtonElement | null) =>
          setContainer(node?.closest("dialog") ?? null)
        }
        data-slot="select"
        className={cn("ds-select-trigger", className)}
        {...aria}
      >
        <SelectPrimitive.Value
          className="ds-select-value"
          placeholder={placeholder}
        />
        <SelectPrimitive.Icon className="ds-select-icon">
          <ChevronDown aria-hidden="true" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal
        className={portalClassName}
        container={container ?? undefined}
      >
        <SelectPrimitive.Positioner
          className="ds-select-positioner"
          alignItemWithTrigger={false}
          sideOffset={4}
        >
          <SelectPrimitive.Popup className="ds-select-popup">
            <SelectPrimitive.List>
              {groupOptions(options).map((run, index) =>
                run.group === undefined ? (
                  run.options.map(renderItem)
                ) : (
                  <SelectPrimitive.Group
                    key={`${run.group}-${index}`}
                    className="ds-select-group"
                  >
                    <SelectPrimitive.GroupLabel className="ds-select-group-label">
                      {run.group}
                    </SelectPrimitive.GroupLabel>
                    {run.options.map(renderItem)}
                  </SelectPrimitive.Group>
                ),
              )}
            </SelectPrimitive.List>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
