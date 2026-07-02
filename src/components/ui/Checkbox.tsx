/**
 * Checkbox + Radio — accessible, styled to match the design system.
 */
import { Check } from "lucide-preact";

export interface CheckboxProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  description?: string;
  id?: string;
  disabled?: boolean;
}

export function Checkbox({
  checked,
  onChange,
  label,
  description,
  id,
  disabled = false,
}: CheckboxProps) {
  const checkId = id ?? `cb-${Math.random().toString(36).slice(2, 9)}`;
  return (
    <label
      for={checkId}
      class={`flex items-start gap-2.5 ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
    >
      <span class="relative mt-0.5 inline-flex shrink-0">
        <input
          id={checkId}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange((e.currentTarget as HTMLInputElement).checked)}
          class="peer sr-only"
        />
        <span
          class={`flex h-4.5 w-4.5 items-center justify-center rounded border transition-colors ${
            checked
              ? "border-unq-accent bg-unq-accent"
              : "border-unq-border-strong bg-unq-surface peer-hover:border-unq-text-subtle"
          }`}
          style={{ width: "18px", height: "18px" }}
        >
          {checked && <Check size={12} class="text-unq-accent-contrast" strokeWidth={3} />}
        </span>
      </span>
      {(label || description) && (
        <span class="flex flex-col">
          {label && <span class="text-sm font-medium leading-tight">{label}</span>}
          {description && <span class="text-unq-text-muted mt-0.5 text-xs">{description}</span>}
        </span>
      )}
    </label>
  );
}

export interface RadioOption {
  value: string;
  label: string;
  description?: string;
}

export interface RadioGroupProps {
  name: string;
  value: string;
  onChange: (v: string) => void;
  options: RadioOption[];
  orientation?: "vertical" | "horizontal";
  class?: string;
}

export function RadioGroup({
  name,
  value,
  onChange,
  options,
  orientation = "vertical",
  class: cls,
}: RadioGroupProps) {
  return (
    <div
      role="radiogroup"
      class={`${orientation === "horizontal" ? "flex flex-wrap gap-4" : "flex flex-col gap-2"} ${cls ?? ""}`}
    >
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <label
            key={o.value}
            class={`flex cursor-pointer items-start gap-2.5 ${
              orientation === "horizontal" ? "" : ""
            }`}
          >
            <span class="relative mt-0.5 inline-flex shrink-0">
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={selected}
                onChange={() => onChange(o.value)}
                class="peer sr-only"
              />
              <span
                class={`flex h-4.5 w-4.5 items-center justify-center rounded-full border-2 transition-colors ${
                  selected
                    ? "border-unq-accent"
                    : "border-unq-border-strong peer-hover:border-unq-text-subtle"
                }`}
                style={{ width: "18px", height: "18px" }}
              >
                {selected && <span class="bg-unq-accent h-2 w-2 rounded-full" />}
              </span>
            </span>
            <span class="flex flex-col">
              <span class="text-sm font-medium leading-tight">{o.label}</span>
              {o.description && (
                <span class="text-unq-text-muted mt-0.5 text-xs">{o.description}</span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}
