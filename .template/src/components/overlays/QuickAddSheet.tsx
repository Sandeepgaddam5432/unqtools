"use client";

import { Flame } from "lucide-react";
import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import Sheet from "@/components/overlays/Sheet";
import { ALL_TOOLS, CATEGORIES } from "@/lib/tools-data";
import { cn, formatNumber } from "@/lib/utils";

export default function QuickAddSheet({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const [cat, setCat] = useState("all");

  const tools = useMemo(
    () => (cat === "all" ? ALL_TOOLS : ALL_TOOLS.filter((t) => t.category.id === cat)),
    [cat]
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Quick tools"
      subtitle={`Launch any of the ${formatNumber(1679)} client-side tools instantly`}
      wide
    >
      {/* filter chips */}
      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-3">
        {[{ id: "all", short: "All", dot: "bg-white/60" }, ...CATEGORIES].map((c) => {
          const active = cat === c.id;
          const dot = "dot" in c ? c.dot : "bg-white/60";
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setCat(c.id)}
              className={cn(
                "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-semibold transition-all",
                active
                  ? "border-white/25 bg-white/[0.1] text-white"
                  : "border-white/[0.07] bg-white/[0.03] text-white/45 hover:text-white/75"
              )}
            >
              <span className={cn("size-1.5 rounded-full", dot)} />
              {c.short}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tools.map((tool, i) => (
          <motion.button
            key={tool.id}
            type="button"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.018, 0.35) }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect(tool.id)}
            className="group flex cursor-pointer flex-col items-start gap-2.5 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3 text-left transition-colors hover:border-white/[0.15] hover:bg-white/[0.06]"
          >
            <span
              className={cn(
                "flex size-9 items-center justify-center rounded-xl bg-gradient-to-br shadow-md transition-transform group-hover:-rotate-6",
                tool.category.iconTile,
                tool.category.iconShadow
              )}
            >
              <tool.icon className="size-4 text-white" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1 text-[12px] font-semibold leading-tight">
                <span className="truncate">{tool.name}</span>
                {tool.hot && <Flame className="size-3 shrink-0 text-orange-300" />}
              </span>
              <span className="mt-0.5 block text-[9.5px] font-medium uppercase tracking-wider text-white/30">
                {tool.category.short}
              </span>
            </span>
          </motion.button>
        ))}
      </div>

      <p className="pt-4 text-center text-[10.5px] text-white/30">
        Showing {tools.length} curated entries · the full grid of 1,679 ships in the suite
      </p>
    </Sheet>
  );
}
