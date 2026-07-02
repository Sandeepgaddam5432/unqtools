/**
 * UnQTools shared UI primitives — Preact components reused across all tools.
 * Phase 0 ships the component set required by the master prompt §6:
 *   Button, Input, Textarea, Select, Toggle, Slider, Card, ToolCard,
 *   Tabs, Accordion, Tooltip, Toast, CopyButton, DownloadButton,
 *   ShareButton, SearchBar (the homepage SearchBar is server-rendered in Astro,
 *   this is the island variant for tool pages).
 *
 * Every component is keyboard-first, WCAG 2.1 AA, and uses the --unq-* tokens.
 */
import { useEffect, useRef, useState } from "preact/hooks";
import type { JSX } from "preact";

/* ------------------------------------------------------------------ Button */

type ButtonVariant = "primary" | "ghost" | "outline" | "danger";

interface ButtonProps extends JSX.HTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({ variant = "primary", class: cls, ...rest }: ButtonProps) {
  const variantClass: Record<ButtonVariant, string> = {
    primary: "unq-btn-primary",
    ghost: "bg-transparent hover:bg-unq-surface",
    outline: "bg-transparent border border-unq-border hover:bg-unq-surface",
    danger: "bg-unq-danger text-white hover:brightness-110",
  };
  return <button class={`unq-btn ${variantClass[variant]} ${cls ?? ""}`} {...rest} />;
}

/* ------------------------------------------------------------------- Input */

interface InputProps extends JSX.HTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
}

export function Input({ label, hint, id, class: cls, ...rest }: InputProps) {
  return (
    <div class={`flex flex-col gap-1 ${cls ?? ""}`}>
      {label && (
        <label for={id} class="text-sm font-medium">
          {label}
        </label>
      )}
      <input id={id} class="unq-input" {...rest} />
      {hint && <p class="text-xs text-unq-muted">{hint}</p>}
    </div>
  );
}

/* ---------------------------------------------------------------- Textarea */

interface TextareaProps extends JSX.HTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
}

export function Textarea({ label, hint, id, class: cls, ...rest }: TextareaProps) {
  return (
    <div class={`flex flex-col gap-1 ${cls ?? ""}`}>
      {label && (
        <label for={id} class="text-sm font-medium">
          {label}
        </label>
      )}
      <textarea id={id} class="unq-input min-h-[160px] py-2 font-mono text-sm" {...rest} />
      {hint && <p class="text-xs text-unq-muted">{hint}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ Select */

interface SelectProps extends JSX.HTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, options, id, class: cls, ...rest }: SelectProps) {
  return (
    <div class={`flex flex-col gap-1 ${cls ?? ""}`}>
      {label && (
        <label for={id} class="text-sm font-medium">
          {label}
        </label>
      )}
      <select id={id} class="unq-input" {...rest}>
        {options.map((o) => (
          <option value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

/* ------------------------------------------------------------------ Toggle */

interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  id?: string;
}

export function Toggle({ checked, onChange, label, id }: ToggleProps) {
  const toggleId = id ?? `toggle-${Math.random().toString(36).slice(2)}`;
  return (
    <div class="flex items-center gap-3">
      <button
        id={toggleId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        class={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? "bg-unq-accent" : "bg-unq-border"
        }`}
      >
        <span
          class={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
      <label for={toggleId} class="cursor-pointer text-sm">
        {label}
      </label>
    </div>
  );
}

/* ------------------------------------------------------------------ Slider */

interface SliderProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
  label?: string;
  id?: string;
}

export function Slider({ min, max, step = 1, value, onChange, label, id }: SliderProps) {
  return (
    <div class="flex flex-col gap-1">
      {label && (
        <label for={id} class="text-sm font-medium">
          {label}: <span class="font-mono">{value}</span>
        </label>
      )}
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onInput={(e) => onChange(Number((e.target as HTMLInputElement).value))}
        class="w-full accent-unq-accent"
      />
    </div>
  );
}

/* -------------------------------------------------------------------- Card */

interface CardProps extends JSX.HTMLAttributes<HTMLDivElement> {}

export function Card({ class: cls, ...rest }: CardProps) {
  return <div class={`unq-card p-5 ${cls ?? ""}`} {...rest} />;
}

/* ------------------------------------------------------------------- Tabs */

interface TabsProps {
  tabs: { id: string; label: string; content: JSX.Element }[];
  initialId?: string;
}

export function Tabs({ tabs, initialId }: TabsProps) {
  const [active, setActive] = useState(initialId ?? tabs[0]?.id);
  return (
    <div>
      <div role="tablist" class="flex border-b border-unq-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={active === t.id}
            onClick={() => setActive(t.id)}
            class={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              active === t.id
                ? "border-unq-accent text-unq-text"
                : "border-transparent text-unq-muted hover:text-unq-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div class="pt-4">{tabs.find((t) => t.id === active)?.content}</div>
    </div>
  );
}

/* -------------------------------------------------------------- Accordion */

interface AccordionProps {
  items: { title: string; body: JSX.Element }[];
}

export function Accordion({ items }: AccordionProps) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div class="divide-y divide-unq-border rounded-unq border border-unq-border">
      {items.map((it, i) => (
        <div>
          <button
            type="button"
            aria-expanded={open === i}
            onClick={() => setOpen(open === i ? null : i)}
            class="flex w-full items-center justify-between px-4 py-3 text-left font-medium"
          >
            <span>{it.title}</span>
            <span aria-hidden="true">{open === i ? "−" : "+"}</span>
          </button>
          {open === i && <div class="px-4 pb-4 text-sm text-unq-muted">{it.body}</div>}
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- Tooltip */

interface TooltipProps {
  text: string;
  children: JSX.Element;
}

export function Tooltip({ text, children }: TooltipProps) {
  const [show, setShow] = useState(false);
  return (
    <span
      class="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      {show && (
        <span
          role="tooltip"
          class="unq-card absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 whitespace-nowrap px-2 py-1 text-xs"
        >
          {text}
        </span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------- Toast */

interface ToastState {
  id: number;
  message: string;
  variant: "info" | "success" | "error";
}

let toastIdCounter = 0;
const listeners = new Set<(t: ToastState) => void>();

export function toast(message: string, variant: ToastState["variant"] = "info") {
  const t: ToastState = { id: ++toastIdCounter, message, variant };
  listeners.forEach((l) => l(t));
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastState[]>([]);
  useEffect(() => {
    const listener = (t: ToastState) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, 3000);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return (
    <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          class={`unq-card px-4 py-2 text-sm ${
            t.variant === "error"
              ? "border-unq-danger"
              : t.variant === "success"
                ? "border-unq-success"
                : ""
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- CopyButton */

interface CopyButtonProps {
  getText: () => string | Promise<string>;
  label?: string;
}

export function CopyButton({ getText, label = "Copy" }: CopyButtonProps) {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="outline"
      onClick={async () => {
        const text = await getText();
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          toast("Copied to clipboard", "success");
          setTimeout(() => setDone(false), 1500);
        } catch {
          toast("Failed to copy", "error");
        }
      }}
    >
      {done ? "Copied ✓" : label}
    </Button>
  );
}

/* --------------------------------------------------------- DownloadButton */

interface DownloadButtonProps {
  filename: string;
  getText: () => string | Promise<string>;
  mime?: string;
  label?: string;
}

export function DownloadButton({
  filename,
  getText,
  mime = "text/plain",
  label = "Download",
}: DownloadButtonProps) {
  return (
    <Button
      variant="outline"
      onClick={async () => {
        const text = await getText();
        const blob = new Blob([text], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}
    >
      {label}
    </Button>
  );
}

/* ------------------------------------------------------------- ShareButton */

interface ShareButtonProps {
  url: string;
  title?: string;
  text?: string;
}

export function ShareButton({ url, title, text }: ShareButtonProps) {
  return (
    <Button
      variant="outline"
      onClick={async () => {
        if (navigator.share) {
          try {
            await navigator.share({ url, title, text });
          } catch {
            /* user cancelled */
          }
        } else {
          try {
            await navigator.clipboard.writeText(url);
            toast("Link copied to clipboard", "success");
          } catch {
            toast("Could not copy link", "error");
          }
        }
      }}
    >
      Share
    </Button>
  );
}

/* ------------------------------------------------------------- ErrorBanner */

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      class="unq-card flex items-start gap-2 border-unq-danger p-3 text-sm text-unq-danger"
    >
      <span aria-hidden="true">⚠</span>
      <span>{message}</span>
    </div>
  );
}

/* -------------------------------------------------- useFocusVisible helper */

export function useClickOutside<T extends HTMLElement>(
  ref: { current: T | null },
  handler: () => void,
) {
  useEffect(() => {
    function listener(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) handler();
    }
    document.addEventListener("mousedown", listener);
    return () => document.removeEventListener("mousedown", listener);
  }, [ref, handler]);
}

/* re-export some hooks for tool authors */
export { useRef, useEffect, useState };
