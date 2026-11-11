// Field and choice layouts. Plain elements with ds-* classes, so the DSH page can use them as they are.
import type { ReactNode } from "react";
import { clsx as cn } from "clsx";

export interface FieldProps {
  label: ReactNode;
  /** The control's id. The label points at it; the description and error are announced with it. */
  htmlFor: string;
  description?: ReactNode;
  error?: ReactNode;
  /** Marks the field as optional next to its label. */
  optional?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** A label above its control, then a description; an error replaces the description while there is one. */
export function Field({
  label,
  htmlFor,
  description,
  error,
  optional,
  className,
  children,
}: FieldProps) {
  return (
    <div data-slot="field" className={cn("ds-field", className)}>
      <label className="ds-field-label" htmlFor={htmlFor}>
        {label}
        {optional ? (
          <span className="ds-field-optional">{optional}</span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p className="ds-field-error" id={`${htmlFor}-error`} role="alert">
          {error}
        </p>
      ) : description ? (
        <p className="ds-field-description" id={`${htmlFor}-description`}>
          {description}
        </p>
      ) : null}
    </div>
  );
}

/** The id to pass as the control's aria-describedby for a Field with these props. */
export function fieldDescribedBy(
  htmlFor: string,
  { description, error }: { description?: ReactNode; error?: ReactNode },
) {
  if (error) return `${htmlFor}-error`;
  if (description) return `${htmlFor}-description`;
  return undefined;
}

/** Fields stacked with the system's spacing between them. */
export function FieldGroup({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("ds-field-group", className)}>{children}</div>;
}

/** Fields side by side while there is room, stacked when there is not. */
export function FieldRow({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("ds-field-row", className)}>{children}</div>;
}

/** A checkbox or radio with its label and an optional description; the whole row is the hit target. */
export function Choice({
  control,
  label,
  description,
  className,
}: {
  control: ReactNode;
  label: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("ds-choice", className)}>
      {control}
      <span className="ds-choice-label">{label}</span>
      {description ? (
        <span className="ds-choice-description">{description}</span>
      ) : null}
    </label>
  );
}
