"use client";

import { ArrowUpRight, History } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { ALL_SEARCHABLE_TOOLS, RECENT_IDS, type FlatTool } from "@/lib/template-data";
import { cn } from "@/lib/template-utils";

interface Props {
  onLaunch: (id: string) => void;
}

/**
 * "Pinned & Recent" strip — pulls user history (localStorage) and falls
 * back to a curated pinned list of hot tools.
 */
export default function RecentCard({ onLaunch }: Props) {
  const [historyIds, setHistoryIds] = useState<string[] | null>(null);

  // Read recent history (same key the global CommandPaletteLazy uses).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("unq:recent-tools");
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Filter to ids that still exist in the catalog.
          const valid = parsed.filter((id) =>
            ALL_SEARCHABLE_TOOLS.some((t) => t.id === id)
          );
          if (valid.length > 0) {
            setHistoryIds(valid);
            return;
          }
        }
      }
    } catch {
      /* noop */
    }
    setHistoryIds(RECENT_IDS as unknown as string[]);
  }, []);

  // Split between history (most recent) and pinned — half + half.
  const items: FlatTool[] = (() => {
    const ids = historyIds ?? (RECENT_IDS as unknown as string[]);
    const picks = ids.slice(0, 12);
    const seen = new Set<string>();
    const out: FlatTool[] = [];
    for (const id of picks) {
      if (seen.has(id)) continue;
      const t = ALL_SEARCHABLE_TOOLS.find((t) => t.id === id);
      if (t && !seen.has(t.id)) {
        out.push(t);
        seen.add(t.id);
      }
    }
    return out;
  })();

  if (items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-[12px] text-white/45">
        Recent tools will appear here as you use the app.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col p-5 sm:p-6">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-400 to-slate-600 shadow-[0_8px_18px_-6px_rgba(148,163,184,0.5),inset_0_1px_0_rgba(255,255,255,0.35)]">
          <History className="size-4 text-white" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-bold tracking-tight">Pinned &amp; Recent</h3>
          <p className="text-[11px] text-white/40">
            Jump back into the tools you reach for most
          </p>
        </div>
      </div>
      <div className="no-scrollbar -mx-1 flex flex-1 items-stretch gap-2.5 overflow-x-auto px-1">
        {items.map((t, i) => {
          const Icon = t.icon;
          return (
            <motion.button
              key={t.id}
              type="button"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onLaunch(t.id)}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.025 }}
              className={cn(
                "group relative flex w-32 shrink-0 cursor-pointer flex-col items-start gap-1.5 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.04] p-3 text-left transition-all",
                "hover:-translate-y-0.5 hover:border-white/[0.18] hover:bg-white/[0.07]"
              )}
              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)" }}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute -right-8 -top-10 size-24 rounded-full opacity-50 blur-3xl transition-opacity group-hover:opacity-100",
                  t.category.blob
                )}
              />
              <span
                className={cn(
                  "relative flex size-7 items-center justify-center rounded-lg text-white shadow ring-1 ring-white/20 bg-gradient-to-br",
                  t.category.iconTile
                )}
              >
                <Icon className="size-3.5" />
              </span>
              <span className="relative line-clamp-2 text-[11.5px] font-semibold leading-tight">
                {t.name}
              </span>
              <span className="relative -mt-0.5 inline-flex items-center gap-1 text-[10px] text-white/45">
                <ArrowUpRight className="size-3" />
                Open
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
