"use client";

import { Search, Wrench } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ALL_SEARCHABLE_TOOLS } from "@/lib/template-data";
import type { FlatTool } from "@/lib/template-data";
import { cn } from "@/lib/template-utils";

interface Props {
  /** When a tool is picked — used by Dashboard to open the modal. */
  onSelect: (id: string) => void;
  /** Active filter id (null = all categories). */
  activeCat?: string;
}

/**
 * Directory — a long, scrollable list of every curated tool.
 * Lives below the bento grid; the user can search / filter to launch
 * inline or open the dedicated page.
 */
export default function Directory({ onSelect }: Props) {
  const [q, setQ] = useState("");
  const [deferredQ, setDeferredQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // De-bounce typing for the visible filter, but load everything instantly.
  useEffect(() => {
    const t = setTimeout(() => setDeferredQ(q), 120);
    return () => clearTimeout(t);
  }, [q]);

  const results: FlatTool[] = useMemo(() => {
    const term = deferredQ.trim().toLowerCase();
    if (!term) return ALL_SEARCHABLE_TOOLS.slice(0, 96);
    return ALL_SEARCHABLE_TOOLS.filter(
      (t) =>
        t.name.toLowerCase().includes(term) ||
        t.blurb.toLowerCase().includes(term) ||
        t.id.includes(term) ||
        t.category.label.toLowerCase().includes(term)
    ).slice(0, 96);
  }, [deferredQ]);

  return (
    <section
      id="tools"
      className="mt-10 rounded-3xl border border-white/[0.06] bg-[#0c1018]/55 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-6"
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-cyan-400/20 bg-cyan-400/[0.08] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
            <Wrench className="size-3" />
            Directory
          </div>
          <h2 className="text-[18px] font-bold tracking-tight sm:text-[20px]">
            All tools
          </h2>
          <p className="text-[11.5px] text-white/45">
            Launch inline or open the full page —{' '}
            <span className="text-white/65">nothing leaves your tab.</span>
          </p>
        </div>

        <label className="relative flex h-10 w-full max-w-sm items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] focus-within:border-white/[0.18]">
          <Search className="size-3.5 text-white/45" />
          <input
            ref={inputRef}
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter directory…"
            className="w-full bg-transparent text-[13px] text-white placeholder:text-white/35 outline-none"
            aria-label="Filter directory"
          />
          {q && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                inputRef.current?.focus();
              }}
              className="cursor-pointer rounded-full px-1.5 text-[10px] font-bold text-white/45 hover:text-white/85"
              aria-label="Clear filter"
            >
              clear
            </button>
          )}
        </label>
      </div>

      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {results.length === 0 && (
          <li className="col-span-full rounded-2xl border border-white/[0.07] bg-white/[0.04] p-6 text-center text-[13px] text-white/45">
            No tools match &ldquo;{deferredQ}&rdquo;
          </li>
        )}
        {results.map((t) => {
          const Icon = t.icon;
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onSelect(t.id)}
                className={cn(
                  "group flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-left transition-all",
                  "hover:-translate-y-0.5 hover:border-white/[0.15] hover:bg-white/[0.06]"
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg text-white shadow ring-1 ring-white/15 bg-gradient-to-br",
                    t.category.iconTile
                  )}
                  aria-hidden="true"
                >
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[12.5px] font-semibold tracking-tight">
                      {t.name}
                    </span>
                    <span className="hidden rounded-full border border-white/[0.07] bg-white/[0.04] px-1.5 text-[9.5px] font-medium uppercase text-white/55 sm:inline">
                      {t.category.short}
                    </span>
                  </span>
                  <span className="line-clamp-1 text-[10.5px] text-white/40">
                    {t.blurb}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {results.length > 0 && (
        <p className="mt-4 text-center text-[10.5px] text-white/35">
          Showing {results.length}
          {deferredQ ? " matching" : " tools"}. Type / select ⌘K to search all 1,679.
        </p>
      )}
    </section>
  );
}
