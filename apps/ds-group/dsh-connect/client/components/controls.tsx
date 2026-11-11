import { useEffect, useRef, useState } from "react";
import type { ComponentProps, KeyboardEvent } from "react";

const classes = (...names: (string | undefined)[]) =>
  names.filter(Boolean).join(" ");

/**
 * DSCord's own controls for the page inside DSH. They are plain elements carrying the design system's class
 * names, so the rules generated from ui/styles.css draw them exactly as ui/controls.tsx is drawn on the web
 * pages, whatever DSH's own controls look like.
 */
export function Button({
  variant = "default",
  size = "default",
  className,
  ...props
}: ComponentProps<"button"> & {
  variant?: "default" | "secondary" | "ghost" | "destructive";
  size?: "default" | "sm";
}) {
  return (
    <button
      data-slot="button"
      className={classes(
        "ds-button",
        `ds-button-${variant}`,
        `ds-button-size-${size}`,
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      className={classes("ds-input", className)}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={classes("ds-input ds-textarea", className)}
      {...props}
    />
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * The design system's select, drawn with the same ds-select-* classes as ui/select.tsx on the web pages. The
 * web pages build it on Base UI; here it is a plain button and list so that the page takes nothing but React
 * along. A hidden input carries the value for the form.
 */
export function Select({
  id,
  name,
  value,
  options,
  disabled,
  onValueChange,
}: {
  id?: string;
  name?: string;
  value: string;
  options: readonly SelectOption[];
  disabled?: boolean;
  onValueChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const root = useRef<HTMLSpanElement>(null);
  const listId = id ? `${id}-list` : undefined;
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  function show() {
    setHighlighted(
      Math.max(
        0,
        options.findIndex((option) => option.value === value),
      ),
    );
    setOpen(true);
  }
  function choose(index: number) {
    const option = options[index];
    if (option) onValueChange(option.value);
    setOpen(false);
  }
  function key(event: KeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        show();
      }
      return;
    }
    if (event.key === "Escape" || event.key === "Tab") setOpen(false);
    else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setHighlighted(
        (current) => (current + step + options.length) % options.length,
      );
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(highlighted);
    }
  }

  return (
    <span className="dc-select" ref={root}>
      <button
        type="button"
        id={id}
        data-slot="select"
        className="ds-select-trigger"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        data-disabled={disabled ? "" : undefined}
        data-popup-open={open ? "" : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={key}
      >
        <span className="ds-select-value">{selected?.label ?? value}</span>
        <span className="ds-select-icon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>
      {name && <input type="hidden" name={name} value={value} />}
      <div
        className="ds-select-popup"
        id={listId}
        role="listbox"
        hidden={!open}
        data-open={open ? "" : undefined}
      >
        {options.map((option, index) => (
          <div
            key={option.value}
            role="option"
            aria-selected={option.value === value}
            data-value={option.value}
            data-selected={option.value === value ? "" : undefined}
            data-highlighted={index === highlighted ? "" : undefined}
            className="ds-select-item"
            onPointerEnter={() => setHighlighted(index)}
            onClick={() => choose(index)}
          >
            <span className="ds-select-item-text">{option.label}</span>
            {option.value === value && (
              <span className="ds-select-item-indicator" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
            )}
          </div>
        ))}
      </div>
    </span>
  );
}

/** A native checkbox, so it submits and resets with its form; styles.ts draws its checked state. */
export function Checkbox(props: Omit<ComponentProps<"input">, "type">) {
  return (
    <input
      type="checkbox"
      data-slot="checkbox"
      className="ds-checkbox"
      {...props}
    />
  );
}

export function Radio(props: Omit<ComponentProps<"input">, "type">) {
  return (
    <input type="radio" data-slot="radio" className="ds-radio" {...props} />
  );
}
