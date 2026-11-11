// Page building blocks: sections, info lists, filter chips, empty states and scroll areas.
import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import type { ComponentProps, ReactNode } from "react";
import { clsx as cn } from "clsx";

type Heading = "h2" | "h3" | "h4";

/** A titled block of a page. Consecutive sections are divided by a rule. */
export function Section({
  title,
  description,
  actions,
  as: HeadingTag = "h3",
  className,
  children,
  ...props
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  as?: Heading;
  className?: string;
  children?: ReactNode;
} & Omit<ComponentProps<"section">, "title">) {
  return (
    <section className={cn("ds-section", className)} {...props}>
      <header className="ds-section-header">
        <div className="ds-section-heading">
          <HeadingTag className="ds-section-title">{title}</HeadingTag>
          {description ? (
            <p className="ds-section-description">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="ds-section-actions">{actions}</div> : null}
      </header>
      {children ? <div className="ds-section-body">{children}</div> : null}
    </section>
  );
}

export interface InfoItem {
  label: ReactNode;
  value: ReactNode;
  /** Set in the code face: ids, addresses, keys. */
  code?: boolean;
  /** A small action after the value, such as a copy button. */
  action?: ReactNode;
}

/** Label and value pairs with the labels in one column; on a narrow screen each label sits above its value. */
export function InfoList({
  items,
  className,
  ...props
}: { items: readonly InfoItem[]; className?: string } & ComponentProps<"dl">) {
  return (
    <dl className={cn("ds-info-list", className)} {...props}>
      {items.map((item, index) => (
        <div className="ds-info-row" key={index}>
          <dt className="ds-info-label">{item.label}</dt>
          <dd className="ds-info-value">
            <span
              className={cn(
                "ds-info-value-text",
                item.code && "ds-info-value-code",
              )}
            >
              {item.value}
            </span>
            {item.action}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export interface FilterChip<Value extends string = string> {
  value: Value;
  label: ReactNode;
  /** A count after the label. */
  count?: number;
  /** Something before the label, such as a small avatar. */
  leading?: ReactNode;
  disabled?: boolean;
}

/** One choice out of a few filters, as a row of equal pills. Arrow keys move between them. */
export function FilterChips<Value extends string = string>({
  chips,
  value,
  onValueChange,
  className,
  "aria-label": label,
}: {
  chips: readonly FilterChip<Value>[];
  value: Value;
  onValueChange: (value: Value) => void;
  className?: string;
  "aria-label": string;
}) {
  return (
    <ToggleGroup
      aria-label={label}
      className={cn("ds-chip-group", className)}
      value={[value]}
      onValueChange={(next) => {
        const chosen = next[0] as Value | undefined;
        if (chosen) onValueChange(chosen);
      }}
    >
      {chips.map((chip) => (
        <Toggle
          key={chip.value}
          value={chip.value}
          disabled={chip.disabled}
          className="ds-chip"
        >
          {chip.leading ? (
            <span className="ds-avatar-slot">{chip.leading}</span>
          ) : null}
          {chip.label}
          {chip.count !== undefined ? (
            <span className="ds-chip-count">{chip.count}</span>
          ) : null}
        </Toggle>
      ))}
    </ToggleGroup>
  );
}

/** What is missing, why, and what to do about it. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  compact,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /** Less padding, for a block inside a section. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn("ds-empty", compact && "ds-empty-compact", className)}
      role="status"
    >
      {icon ? (
        <span className="ds-empty-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <p className="ds-empty-title">{title}</p>
      {description ? (
        <p className="ds-empty-description">{description}</p>
      ) : null}
      {action ? <div className="ds-empty-action">{action}</div> : null}
    </div>
  );
}

/** Scrolls vertically only and keeps room for focus rings at its edges, so nothing inside is clipped. */
export function ScrollArea({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="scroll-area"
      className={cn("ds-scroll-area", className)}
      {...props}
    />
  );
}
