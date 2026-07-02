/**
 * Switch / Toggle — accessible, animated, label-aware.
 */

export interface SwitchProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  description?: string;
  id?: string;
  disabled?: boolean;
  size?: "sm" | "md";
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  id,
  disabled = false,
  size = "md",
}: SwitchProps) {
  const switchId = id ?? `sw-${Math.random().toString(36).slice(2, 9)}`;
  const dims =
    size === "sm"
      ? { track: "h-5 w-9", knob: "h-3.5 w-3.5", translate: "translate-x-4" }
      : { track: "h-6 w-11", knob: "h-4.5 w-4.5", translate: "translate-x-5" };

  // Backwards-compat alias
  if (label && !description) {
    // Used as <Toggle label="..." /> — render inline
  }

  return (
    <div class={`flex items-center gap-3 ${disabled ? "opacity-50" : ""}`}>
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        class={`relative inline-flex ${dims.track} shrink-0 items-center rounded-full transition-colors duration-150 ease-out ${
          checked ? "bg-accent" : "bg-border"
        } focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
      >
        <span
          class={`inline-block rounded-full bg-white shadow-sm transition-transform duration-150 ease-out ${
            checked ? dims.translate : "translate-x-0.5"
          } ${size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"}`}
          style={size === "sm" ? { width: "14px", height: "14px" } : undefined}
        />
      </button>
      {label && (
        <div class="flex flex-col">
          <label for={switchId} class={`cursor-pointer text-sm font-medium ${disabled ? "" : ""}`}>
            {label}
          </label>
          {description && <p class="text-xs text-fg-muted">{description}</p>}
        </div>
      )}
    </div>
  );
}

/** Alias for backwards-compat with existing tool UIs */
export const Toggle = Switch;
