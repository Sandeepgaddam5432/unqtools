/**
 * Select — native <select> styled to match the design system.
 * Native is the right choice here: better mobile UX, no JS overhead,
 * keyboard-accessible out of the box.
 */
import type { JSX } from "preact";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<JSX.HTMLAttributes<HTMLSelectElement>, "size"> {
  label?: string;
  hint?: string;
  options: SelectOption[];
}

export function Select({ label, hint, options, id, class: cls, ...rest }: SelectProps) {
  const inputId = id ?? (label ? `sel-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined);
  return (
    <div class={`flex flex-col gap-1.5 ${cls ?? ""}`}>
      {label && (
        <label for={inputId} class="text-sm font-medium text-unq-text">
          {label}
        </label>
      )}
      <div class="relative">
        <select
          id={inputId}
          class="unq-input-base h-11 cursor-pointer appearance-none px-3 pr-9 text-sm"
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        <svg
          class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-unq-text-muted"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
      {hint && <p class="text-xs text-unq-text-muted">{hint}</p>}
    </div>
  );
}
