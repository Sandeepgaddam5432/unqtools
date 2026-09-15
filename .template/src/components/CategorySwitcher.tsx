"use client";

import { LayoutGrid } from "lucide-react";
import { motion } from "framer-motion";
import { CATEGORIES, TOTAL_TOOLS } from "@/lib/tools-data";
import { cn, formatNumber } from "@/lib/utils";

export default function CategorySwitcher({
  active,
  onChange,
}: {
  active: string;
  onChange: (id: string) => void;
}) {
  const items = [
    {
      id: "all",
      short: "All",
      count: TOTAL_TOOLS,
      icon: LayoutGrid,
      tile: "from-slate-300 to-slate-500",
      shadow: "shadow-slate-400/40",
    },
    ...CATEGORIES.map((c) => ({
      id: c.id,
      short: c.short,
      count: c.count,
      icon: c.icon,
      tile: c.iconTile,
      shadow: c.iconShadow,
    })),
  ];

  return (
    <div
      id="categories"
      className="sticky top-16 z-30 border-b border-white/[0.04] bg-[#090D16]/80 backdrop-blur-lg"
    >
      <div className="no-scrollbar mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-3 sm:px-6">
        {items.map((item) => {
          const isActive = active === item.id;
          return (
            <motion.button
              key={item.id}
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => onChange(item.id)}
              className={cn(
                "relative flex shrink-0 cursor-pointer items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 transition-colors",
                isActive ? "text-white" : "text-white/50 hover:text-white/80"
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="cat-pill-bg"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  className="absolute inset-0 rounded-full border border-white/[0.15] bg-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_6px_20px_-8px_rgba(255,255,255,0.25)]"
                />
              )}
              <span
                className={cn(
                  "relative flex size-7 items-center justify-center rounded-full transition-all",
                  isActive
                    ? `bg-gradient-to-br ${item.tile} text-white shadow-lg ${item.shadow} ring-1 ring-white/30`
                    : "bg-white/[0.06] text-white/55"
                )}
              >
                <item.icon className="size-3.5" />
              </span>
              <span className="relative text-[12.5px] font-semibold">{item.short}</span>
              <span
                className={cn(
                  "tabular relative hidden text-[10px] font-medium sm:inline",
                  isActive ? "text-white/45" : "text-white/25"
                )}
              >
                {formatNumber(item.count)}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
