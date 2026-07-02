/**
 * Input — labeled, hinted, error-aware.
 */
import type { JSX } from "preact";

export interface InputProps extends Omit<JSX.HTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  hint?: string;
  error?: string;
  /** Slot for an icon inside the input (left). */
  leadingIcon?: JSX.Element;
  /** Slot for a button/affix inside the input (right). */
  trailing?: JSX.Element;
}

export function Input({
  label,
  hint,
  error,
  leadingIcon,
  trailing,
  id,
  class: cls,
  ...rest
}: InputProps) {
  const inputId = id ?? (label ? `in-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined);
  const describedBy =
    [hint ? `${inputId}-hint` : null, error ? `${inputId}-error` : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div class={`flex flex-col gap-1.5 ${cls ?? ""}`}>
      {label && (
        <label for={inputId} class="text-sm font-medium text-fg">
          {label}
        </label>
      )}
      <div class="relative flex items-center">
        {leadingIcon && (
          <span class="pointer-events-none absolute left-3 text-fg-subtle" aria-hidden="true">
            {leadingIcon}
          </span>
        )}
        <input
          id={inputId}
          class={`unq-input-base h-11 px-3 text-sm ${leadingIcon ? "pl-10" : ""} ${trailing ? "pr-10" : ""} ${
            error ? "border-danger focus:border-danger focus:ring-danger/30" : ""
          }`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
        {trailing && <span class="absolute right-2 flex items-center">{trailing}</span>}
      </div>
      {hint && !error && (
        <p id={`${inputId}-hint`} class="text-xs text-fg-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${inputId}-error`} class="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
