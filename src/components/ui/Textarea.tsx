/**
 * Textarea — labeled, hinted, error-aware, with optional char counter.
 */
import type { JSX } from "preact";
import { useMemo } from "preact/hooks";

export interface TextareaProps extends JSX.HTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  showCount?: boolean;
  maxCount?: number;
  monospace?: boolean;
}

export function Textarea({
  label,
  hint,
  error,
  showCount = false,
  maxCount,
  monospace = false,
  id,
  class: cls,
  value,
  ...rest
}: TextareaProps) {
  const inputId = id ?? (label ? `ta-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined);
  const count = useMemo(() => {
    if (typeof value === "string") return value.length;
    return 0;
  }, [value]);

  return (
    <div class={`flex flex-col gap-1.5 ${cls ?? ""}`}>
      {(label || showCount) && (
        <div class="flex items-center justify-between">
          {label && (
            <label for={inputId} class="text-unq-text text-sm font-medium">
              {label}
            </label>
          )}
          {showCount && (
            <span
              class={`text-xs tabular-nums ${maxCount && count > maxCount ? "text-unq-danger" : "text-unq-text-muted"}`}
            >
              {count}
              {maxCount ? ` / ${maxCount}` : ""}
            </span>
          )}
        </div>
      )}
      <textarea
        id={inputId}
        value={value}
        class={`unq-input-base min-h-[160px] resize-y px-3 py-2.5 text-sm ${
          monospace ? "font-mono" : ""
        } ${error ? "focus:ring-unq-danger/30 border-unq-danger focus:border-unq-danger" : ""}`}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
      {hint && !error && <p class="text-unq-text-muted text-xs">{hint}</p>}
      {error && <p class="text-unq-danger text-xs">{error}</p>}
    </div>
  );
}
