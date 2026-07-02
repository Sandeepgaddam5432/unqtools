/**
 * EmptyState — helpful guidance shown when output is empty.
 * Uses existing v4.0 tokens/classes only — no global CSS changes.
 */
import type { ComponentChildren } from "preact";

interface EmptyStateProps {
  icon?: string;
  title: string;
  hint?: string;
  children?: ComponentChildren;
}

export function EmptyState({ icon = "✨", title, hint, children }: EmptyStateProps) {
  return (
    <div
      class="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-8 text-center"
      style="min-height: 120px;"
    >
      <span style="font-size: 1.5rem;" aria-hidden="true">
        {icon}
      </span>
      <p class="text-sm font-medium text-fg-muted">{title}</p>
      {hint && <p class="max-w-sm text-xs text-fg-subtle">{hint}</p>}
      {children}
    </div>
  );
}
