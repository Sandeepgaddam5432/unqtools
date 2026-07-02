/**
 * Skeleton — shimmer loading placeholder.
 */
export interface SkeletonProps {
  class?: string;
  /** Aspect — circle for avatars, line for text, rect for general. */
  shape?: "line" | "circle" | "rect";
}

export function Skeleton({ class: cls, shape = "line" }: SkeletonProps) {
  const shapeClass =
    shape === "circle" ? "rounded-full aspect-square" : shape === "rect" ? "rounded-lg" : "rounded";
  return <div class={`skeleton ${shapeClass} ${cls ?? "h-4 w-24"}`} aria-hidden="true" />;
}

/**
 * EmptyState — friendly placeholder when there's no data (e.g. no favorites yet).
 */
import type { JSX } from "preact";

export interface EmptyStateProps {
  icon?: JSX.Element;
  title: string;
  description?: string;
  action?: JSX.Element;
  class?: string;
}

export function EmptyState({ icon, title, description, action, class: cls }: EmptyStateProps) {
  return (
    <div class={`px-4 py-12 text-center ${cls ?? ""}`}>
      {icon && (
        <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-fg-muted">
          {icon}
        </div>
      )}
      <p class="text-base font-medium">{title}</p>
      {description && (
        <p class="mx-auto mt-1 max-w-md text-pretty text-sm text-fg-muted">{description}</p>
      )}
      {action && <div class="mt-4">{action}</div>}
    </div>
  );
}
