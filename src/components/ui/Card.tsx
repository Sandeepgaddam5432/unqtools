/**
 * Card — surface primitive. Variants: flat (default), elevated, interactive.
 */
import type { JSX } from "preact";

export interface CardProps extends JSX.HTMLAttributes<HTMLDivElement> {
  variant?: "flat" | "elevated" | "interactive";
  padding?: "sm" | "md" | "lg";
  as?: "div" | "article" | "section";
}

const paddingMap = {
  sm: "p-3",
  md: "p-5",
  lg: "p-6 sm:p-8",
};

export function Card({
  variant = "flat",
  padding = "md",
  as: Tag = "div",
  class: cls,
  children,
  ...rest
}: CardProps) {
  const variantClass =
    variant === "elevated"
      ? "bg-unq-surface-elevated shadow-md"
      : variant === "interactive"
        ? "unq-card unq-card-interactive cursor-pointer"
        : "unq-card";
  return (
    <Tag class={`${variantClass} ${paddingMap[padding]} ${cls ?? ""}`} {...rest}>
      {children}
    </Tag>
  );
}
