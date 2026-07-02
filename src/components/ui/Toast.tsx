/**
 * Toast — Sonner-style notifications. Top-right (desktop) / bottom (mobile).
 * Use the `toast()` function from anywhere; the <ToastContainer /> listens.
 */
import type { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-preact";

export type ToastVariant = "info" | "success" | "warning" | "error";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

let counter = 0;
const listeners = new Set<(t: ToastItem) => void>();

export function toast(message: string, variant: ToastVariant = "info") {
  const item: ToastItem = { id: ++counter, message, variant };
  listeners.forEach((l) => l(item));
}

const variantConfig: Record<ToastVariant, { icon: JSX.Element; class: string }> = {
  info: { icon: <Info size={16} />, class: "border-unq-border" },
  success: {
    icon: <CheckCircle2 size={16} class="text-unq-success" />,
    class: "border-unq-success/40",
  },
  warning: {
    icon: <AlertTriangle size={16} class="text-unq-warning" />,
    class: "border-unq-warning/40",
  },
  error: { icon: <AlertCircle size={16} class="text-unq-danger" />, class: "border-unq-danger/40" },
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const listener = (t: ToastItem) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, 3500);
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  function dismiss(id: number) {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }

  return (
    <div
      class="pointer-events-none fixed bottom-4 left-4 right-4 z-[60] flex flex-col gap-2 sm:bottom-6 sm:left-auto sm:right-6"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const cfg = variantConfig[t.variant];
        return (
          <div
            key={t.id}
            class={`bg-unq-surface-elevated pointer-events-auto flex min-w-[260px] max-w-sm items-start gap-2.5 rounded-lg border p-3 pr-2 shadow-lg ${cfg.class} animate-[unq-slide-in_0.2s_ease-out]`}
          >
            <span class="mt-0.5 shrink-0">{cfg.icon}</span>
            <p class="flex-1 text-sm leading-snug">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              class="text-unq-text-muted hover:text-unq-text rounded p-0.5 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
