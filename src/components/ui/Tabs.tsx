/**
 * Tabs — keyboard-navigable, ARIA-compliant.
 */
import type { JSX } from "preact";
import { useState, useRef } from "preact/hooks";

export interface TabItem {
  id: string;
  label: string;
  content: JSX.Element;
}

export interface TabsProps {
  tabs: TabItem[];
  initialId?: string;
  class?: string;
}

export function Tabs({ tabs, initialId, class: cls }: TabsProps) {
  const [active, setActive] = useState(initialId ?? tabs[0]?.id);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const idx = tabs.findIndex((t) => t.id === active);
    const next =
      e.key === "ArrowRight" ? (idx + 1) % tabs.length : (idx - 1 + tabs.length) % tabs.length;
    setActive(tabs[next]!.id);
    tabRefs.current[next]?.focus();
  }

  return (
    <div class={cls}>
      <div role="tablist" class="flex border-b border-border" onKeyDown={onKeyDown}>
        {tabs.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => (tabRefs.current[i] = el)}
            role="tab"
            aria-selected={active === t.id}
            aria-controls={`tabpanel-${t.id}`}
            id={`tab-${t.id}`}
            tabindex={active === t.id ? 0 : -1}
            onClick={() => setActive(t.id)}
            class={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors duration-150 ${
              active === t.id
                ? "border-accent text-fg"
                : "border-transparent text-fg-muted hover:text-fg"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div class="pt-4">
        {tabs.map((t) => (
          <div
            key={t.id}
            role="tabpanel"
            id={`tabpanel-${t.id}`}
            aria-labelledby={`tab-${t.id}`}
            hidden={active !== t.id}
          >
            {active === t.id && t.content}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * SegmentedControl — like Tabs but more compact, used for mutually-exclusive
 * view toggles (e.g. "Monthly | Yearly"). Single-line pill.
 */
export interface SegmentedProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  size?: "sm" | "md";
  class?: string;
}

export function Segmented({ options, value, onChange, size = "md", class: cls }: SegmentedProps) {
  return (
    <div
      role="radiogroup"
      class={`inline-flex rounded-lg border border-border bg-surface-2 p-0.5 ${cls ?? ""}`}
    >
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          class={`${size === "sm" ? "h-7 px-2.5 text-xs" : "h-9 px-3.5 text-sm"} rounded-md font-medium transition-all duration-150 ${
            value === o.value ? "bg-surface text-fg shadow-sm" : "text-fg-muted hover:text-fg"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
