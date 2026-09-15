"use client";

import { CornerDownLeft, Search, SearchX, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { ALL_TOOLS } from "@/lib/tools-data";
import { cn } from "@/lib/utils";

export default function CommandPalette({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ALL_TOOLS.filter((t) => t.hot).slice(0, 8);
    return ALL_TOOLS.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.blurb.toLowerCase().includes(q) ||
        t.category.label.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [query]);

  useEffect(() => setIndex(0), [results.length]);

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" && results[index]) {
      e.preventDefault();
      onSelect(results[index].id);
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="relative w-full max-w-xl overflow-hidden rounded-[24px] border border-white/[0.09] bg-[#0D1322]/95 shadow-[0_40px_90px_-20px_rgba(0,0,0,0.85)] backdrop-blur-2xl"
          >
            {/* input */}
            <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3.5">
              <Search className="size-4 shrink-0 text-cyan-300" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search 1,679 offline tools…"
                className="min-w-0 flex-1 bg-transparent text-[14.5px] font-medium text-white placeholder:text-white/30 focus:outline-none"
              />
              <kbd className="key">esc</kbd>
            </div>

            {/* results */}
            <div className="max-h-[46vh] overflow-y-auto p-1.5">
              {!query && (
                <div className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-[9.5px] font-bold uppercase tracking-[0.16em] text-white/30">
                  <Sparkles className="size-3" /> Popular right now
                </div>
              )}
              {results.length === 0 && (
                <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                  <SearchX className="size-6 text-white/20" />
                  <p className="text-[12.5px] font-medium text-white/45">
                    No matches for <span className="text-white/80">&quot;{query}&quot;</span>
                  </p>
                  <p className="text-[11px] text-white/25">
                    The remaining tools live in the full suite index.
                  </p>
                </div>
              )}
              {results.map((tool, i) => (
                <button
                  key={tool.id}
                  type="button"
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => onSelect(tool.id)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors",
                    i === index ? "bg-white/[0.07]" : "bg-transparent"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-md",
                      tool.category.iconTile,
                      tool.category.iconShadow
                    )}
                  >
                    <tool.icon className="size-4 text-white" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">{tool.name}</span>
                    <span className="block truncate text-[11px] text-white/40">{tool.blurb}</span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full border px-2 py-0.5 text-[9.5px] font-semibold",
                      tool.category.chipBorder,
                      tool.category.chipBg,
                      tool.category.text
                    )}
                  >
                    {tool.category.short}
                  </span>
                  {i === index && <CornerDownLeft className="size-3.5 shrink-0 text-white/30" />}
                </button>
              ))}
            </div>

            {/* footer */}
            <div className="flex items-center gap-4 border-t border-white/[0.06] px-4 py-2.5 text-[10.5px] font-medium text-white/30">
              <span className="flex items-center gap-1.5">
                <kbd className="key">↑↓</kbd> navigate
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="key">↵</kbd> launch
              </span>
              <span className="ml-auto hidden items-center gap-1.5 sm:flex">
                <span className="size-1 rounded-full bg-emerald-300" /> indexed locally
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
