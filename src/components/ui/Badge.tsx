/**
 * Badge / Chip — small status indicator.
 */
import type { JSX } from "preact";

type BadgeVariant = "default" | "accent" | "success" | "warning" | "danger" | "outline";

export interface BadgeProps extends JSX.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: "sm" | "md";
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-unq-surface-hover text-unq-text-muted",
  accent: "bg-unq-accent-subtle text-unq-accent",
  success: "bg-unq-success-subtle text-unq-success",
  warning: "bg-unq-warning-subtle text-unq-warning",
  danger: "bg-unq-danger-subtle text-unq-danger",
  outline: "border border-unq-border-strong text-unq-text-muted",
};

export function Badge({
  variant = "default",
  size = "sm",
  class: cls,
  children,
  ...rest
}: BadgeProps) {
  const sizeClass = size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1";
  return (
    <span
      class={`inline-flex items-center gap-1 rounded-full font-medium uppercase tracking-wide ${variantClasses[variant]} ${sizeClass} ${cls ?? ""}`}
      {...rest}
    >
      {children}
    </span>
  );
}
