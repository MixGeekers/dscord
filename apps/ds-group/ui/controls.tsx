// Adapted from shadcn/ui Base UI registry, commit 8a3536678a528cc012b9e62484290e79d0be410f (MIT).
// The product classes below map the generated controls to DS-Group semantic tokens.
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { Input as InputPrimitive } from "@base-ui/react/input";
import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import { cva, type VariantProps } from "class-variance-authority";
import { Check } from "lucide-react";
import type { ComponentProps } from "react";
import { useFormReset } from "./form-reset";
import { cn } from "./cn";

const buttonVariants = cva(
  "ds-button inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap select-none transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "ds-button-default",
        secondary: "ds-button-secondary",
        ghost: "ds-button-ghost",
        destructive: "ds-button-destructive",
      },
      size: {
        default: "ds-button-size-default",
        sm: "ds-button-size-sm",
        icon: "ds-button-size-icon",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <InputPrimitive
      data-slot="input"
      className={cn("ds-input w-full min-w-0 outline-none", className)}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "ds-input ds-textarea w-full min-w-0 outline-none",
        className,
      )}
      {...props}
    />
  );
}

export function Checkbox({
  className,
  inputRef,
  form,
  ...props
}: CheckboxPrimitive.Root.Props) {
  const { version, connectInput } = useFormReset(inputRef, form);
  return (
    <CheckboxPrimitive.Root
      key={version}
      data-slot="checkbox"
      className={cn("ds-checkbox", className)}
      inputRef={connectInput}
      form={form}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="ds-checkbox-indicator">
        <Check aria-hidden="true" size={12} strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export function RadioGroup<Value extends string>({
  className,
  inputRef,
  form,
  ...props
}: RadioGroupPrimitive.Props<Value>) {
  const { version, connectInput } = useFormReset(inputRef, form);
  return (
    <RadioGroupPrimitive
      key={version}
      data-slot="radio-group"
      className={cn("ds-radio-group", className)}
      inputRef={connectInput}
      form={form}
      {...props}
    />
  );
}

export function Radio<Value extends string>({
  className,
  ...props
}: RadioPrimitive.Root.Props<Value>) {
  return (
    <RadioPrimitive.Root
      data-slot="radio"
      className={cn("ds-radio", className)}
      {...props}
    >
      <RadioPrimitive.Indicator className="ds-radio-indicator" />
    </RadioPrimitive.Root>
  );
}

export function ColorInput({
  className,
  ...props
}: Omit<ComponentProps<"input">, "type">) {
  return (
    <input
      type="color"
      data-slot="color-input"
      className={cn("ds-color-input", className)}
      {...props}
    />
  );
}

export function FileInput({
  className,
  ...props
}: Omit<ComponentProps<"input">, "type">) {
  return (
    <input
      type="file"
      data-slot="file-input"
      className={cn("ds-file-input", className)}
      {...props}
    />
  );
}
