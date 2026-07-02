/**
 * Button — headless, accessible, premium feel.
 *
 * Variants: primary (accent), secondary (subtle surface), outline, ghost, danger
 * Sizes: sm, md (default, 44px touch target), lg, icon
 * Loading state with spinner, icon support via Lucide.
 */
import type { JSX } from "preact";
import { Loader2 } from "lucide-preact";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends JSX.HTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: JSX.Element;
  iconRight?: JSX.Element;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-unq-accent text-unq-accent-contrast hover:bg-unq-accent-hover shadow-sm hover:shadow-md",
  secondary:
    "bg-unq-surface-elevated text-unq-text border border-unq-border hover:bg-unq-surface-hover hover:border-unq-border-strong",
  outline:
    "bg-transparent text-unq-text border border-unq-border-strong hover:bg-unq-surface-hover",
  ghost: "bg-transparent text-unq-text-muted hover:text-unq-text hover:bg-unq-surface-hover",
  danger: "bg-unq-danger text-white hover:brightness-110 shadow-sm hover:shadow-md",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-11 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
  icon: "h-10 w-10 p-0",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  iconRight,
  class: cls,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      class={`unq-btn-base ${variantClasses[variant]} ${sizeClasses[size]} ${cls ?? ""}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <Loader2 size={size === "sm" ? 14 : 16} class="animate-spin" aria-hidden="true" />
      ) : (
        icon
      )}
      {size !== "icon" && children}
      {size !== "icon" && iconRight}
    </button>
  );
}
