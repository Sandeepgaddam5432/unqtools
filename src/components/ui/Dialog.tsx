/**
 * Dialog / Modal — accessible, focus trap, ESC to close, click-outside to close.
 * Uses a portal-like approach via fixed positioning (no separate DOM tree needed).
 */
import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { X } from "lucide-preact";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: JSX.Element;
  size?: "sm" | "md" | "lg" | "xl";
  class?: string;
}

const sizeMap = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = "md",
  class: cls,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(open);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
      }
      // Focus trap
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    // Focus the first focusable element on open
    setTimeout(() => {
      const first = dialogRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      first?.focus();
    }, 0);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onOpenChange]);

  if (!mounted) return null;

  return (
    <div
      class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6"
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <div
        class="duration-normal fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      {/* Panel */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "dialog-title" : undefined}
        aria-describedby={description ? "dialog-desc" : undefined}
        class={`relative w-full ${sizeMap[size]} duration-normal bg-unq-surface-elevated mt-12 rounded-xl border border-unq-border shadow-xl transition-all sm:mt-20 ${
          open ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
        } ${cls ?? ""}`}
      >
        {(title || description) && (
          <div class="flex items-start justify-between gap-3 border-b border-unq-border p-5">
            <div>
              {title && (
                <h2 id="dialog-title" class="text-balance text-lg font-semibold">
                  {title}
                </h2>
              )}
              {description && (
                <p id="dialog-desc" class="mt-1 text-sm text-unq-text-muted">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Close dialog"
              class="rounded-md p-1.5 text-unq-text-muted transition-colors hover:bg-unq-surface-hover hover:text-unq-text"
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div class="p-5">{children}</div>
      </div>
    </div>
  );
}
