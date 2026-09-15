"use client";

import { Search, Sparkles, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ALL_SEARCHABLE_TOOLS, TOTAL_TOOLS } from "@/lib/template-data";
import { cn } from "@/lib/template-utils";

interface Props {
  open: boolean;
  onClose: () => void;
  /** When user picks a tool — by default we navigate to it. */
  onSelect?: (id: string) => void;
}

/** Full-screen search palette (⌘K) — search all 1,679 tools. */
export default function CommandPalette({ open, onClose, onSelect }: Props) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Focus input on open, reset on close.
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setQ("");
      setActive(0);
    }
  }, [open]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) {
      // Default — show 8 hot tools
      return ALL_SEARCHABLE_TOOLS.filter((t) => t.hot).slice(0, 8);
    }
    return ALL_SEARCHABLE_TOOLS.filter(
      (t) =>
        t.name.toLowerCase().includes(term) ||
        t.blurb.toLowerCase().includes(term) ||
        t.id.includes(term) ||
        t.category.short.toLowerCase().includes(term)
    ).slice(0, 40);
  }, [q]);

  const pick = (idx: number) => {
    const t = results[idx];
    if (!t) return;
    if (onSelect) {
      onSelect(t.id);
    } else {
      router.push(`/tools/${t.id}`);
    }
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(active);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="bg"
            className="fixed inset-0 z-50 bg-black/65 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            key="dlg"
            initial={{ opacity: 0, y: -20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            role="dialog"
            aria-modal="true"
            aria-label="Search tools"
            className="fixed left-1/2 top-[14vh] z-50 w-[min(680px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0e1320]/95 backdrop-blur-2xl shadow-[0_40px_80px_-20px_rgba(0,0,0,0.7)]"
          >
            <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
              <Search className="size-4 text-cyan-300" />
              <input
                ref={inputRef}
                type="text"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onKeyDown}
                placeholder={`Search ${TOTAL_TOOLS.toLocaleString()} tools…`}
                className="w-full bg-transparent text-[15px] text-white placeholder:text-white/35 outline-none"
                aria-label="Search tools"
              />
              <kbd className="key">esc</kbd>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close search"
                className="flex size-7 cursor-pointer items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.05] text-white/65 hover:bg-white/[0.1]"
              >
                <X className="size-3.5" />
              </button>
            </div>

            <ul className="max-h-[50vh] overflow-y-auto py-2">
              {results.length === 0 && (
                <li className="px-5 py-12 text-center text-[13px] text-white/45">
                  No tools found for &ldquo;{q}&rdquo;
                </li>
              )}
              {results.map((t, i) => {
                const Icon = t.icon;
                const isActive = i === active;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => pick(i)}
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors",
                        isActive ? "bg-white/[0.06]" : "hover:bg-white/[0.04]"
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-xl border bg-gradient-to-br text-white shadow-md ring-1 ring-white/20",
                          t.category.iconTile
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold">
                          {t.name}
                          {t.hot && (
                            <Sparkles className="ml-1.5 inline-block size-3 text-cyan-300" />
                          )}
                        </span>
                        <span className="block truncate text-[11.5px] text-white/45">
                          {t.blurb}
                        </span>
                      </span>
                      <span className="hidden shrink-0 rounded-full border border-white/[0.07] bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-white/55 sm:inline">
                        {t.category.short}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-2.5 text-[10.5px] text-white/40">
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="key">↑</kbd>
                  <kbd className="key">↓</kbd> to navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="key">↵</kbd> to open
                </span>
              </span>
              <span>
                <kbd className="key">esc</kbd> to close
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
