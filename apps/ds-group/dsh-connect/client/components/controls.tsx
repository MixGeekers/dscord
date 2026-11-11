import type { ComponentProps } from "react";

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

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <span className="ds-select-wrap">
      <select
        data-slot="select"
        className={classes("ds-input ds-select", className)}
        {...props}
      />
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
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
