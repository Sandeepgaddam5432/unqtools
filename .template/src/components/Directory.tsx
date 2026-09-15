"use client";

import { Plus } from "lucide-react";
import { motion } from "framer-motion";
import { CATEGORIES } from "@/lib/tools-data";
import { cn, formatNumber } from "@/lib/utils";

export default function Directory({
  activeCat,
  onSelect,
}: {
  activeCat: string;
  onSelect: (id: string) => void;
}) {
  const sections = activeCat === "all" ? CATEGORIES : CATEGORIES.filter((c) => c.id === activeCat);

  return (
    <section id="tools" className="scroll-mt-32">
      <div className="flex items-end justify-between gap-3 pb-5 pt-12">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">Explore the vault</h2>
          <p className="mt-1 text-[12px] text-white/40">
            {formatNumber(1679)} tools · {CATEGORIES.length} categories · 0 servers
          </p>
        </div>
        <span className="hidden rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[10.5px] font-semibold text-white/45 sm:block">
          Everything below runs offline
        </span>
      </div>

      <div className="flex flex-col gap-8">
        {sections.map((cat, si) => (
          <motion.div
            key={cat.id}
            layout
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ type: "spring", stiffness: 200, damping: 26, delay: Math.min(si * 0.05, 0.25) }}
          >
            <div className="flex items-center gap-3 pb-3">
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-xl bg-gradient-to-br shadow-md",
                  cat.iconTile,
                  cat.iconShadow
                )}
              >
                <cat.icon className="size-3.5 text-white" />
              </span>
              <h3 className="text-[14.5px] font-bold tracking-tight">{cat.label}</h3>
              <span
                className={cn(
                  "tabular rounded-full border px-2 py-0.5 text-[10px] font-bold",
                  cat.chipBorder,
                  cat.chipBg,
                  cat.text
                )}
              >
                {cat.count}
              </span>
              <span className="ml-auto hidden max-w-[24ch] truncate text-right text-[11px] text-white/30 lg:block">
                {cat.tagline}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {cat.tools.map((tool, i) => (
                <motion.button
                  key={tool.id}
                  type="button"
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-20px" }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => onSelect(tool.id)}
                  className={cn(
                    "group flex cursor-pointer items-center gap-2.5 rounded-2xl border border-white/[0.05] bg-white/[0.02] px-3 py-2.5 text-left transition-all",
                    "hover:border-white/[0.14] hover:bg-white/[0.05]"
                  )}
                >
                  <tool.icon
                    className={cn("size-4 shrink-0 transition-transform group-hover:scale-110", cat.text)}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-semibold">{tool.name}</span>
                    <span className="block truncate text-[10px] text-white/35">{tool.blurb}</span>
                  </span>
                </motion.button>
              ))}
              <div className="flex items-center gap-2 rounded-2xl border border-dashed border-white/[0.1] px-3 py-2.5 text-white/35">
                <Plus className="size-3.5" />
                <span className="text-[11.5px] font-semibold">
                  {formatNumber(cat.count - cat.tools.length)} more in suite
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
