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
  default: "bg-surface-2 text-fg-muted",
  accent: "bg-accent-subtle text-accent",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
  outline: "border border-border text-fg-muted",
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
