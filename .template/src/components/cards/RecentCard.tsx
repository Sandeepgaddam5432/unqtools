"use client";

import { ArrowRight, History } from "lucide-react";
import { motion } from "framer-motion";
import { RECENT_IDS, findTool } from "@/lib/tools-data";

export default function RecentCard({ onLaunch }: { onLaunch: (id: string) => void }) {
  const items = RECENT_IDS.map(findTool).filter((t) => t !== undefined);

  return (
    <div className="flex h-full flex-col justify-center gap-3 p-4 sm:p-5">
      <div className="flex items-center gap-2 px-1">
        <History className="size-3.5 text-white/35" />
        <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/35">
          Pinned &amp; recent
        </span>
        <span className="ml-auto hidden text-[10.5px] font-medium text-white/25 sm:block">
          one-tap launch
        </span>
      </div>

      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-1">
        {items.map((tool, i) => (
          <motion.button
            key={tool.id}
            type="button"
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + i * 0.05, type: "spring", stiffness: 300, damping: 26 }}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onLaunch(tool.id)}
            className="flex shrink-0 cursor-pointer items-center gap-2.5 rounded-2xl border border-white/[0.07] bg-white/[0.03] py-1.5 pl-1.5 pr-4 transition-colors hover:border-white/[0.14] hover:bg-white/[0.07]"
          >
            <span
              className={`flex size-8 items-center justify-center rounded-xl bg-gradient-to-br ${tool.category.iconTile} shadow-md ${tool.category.iconShadow}`}
            >
              <tool.icon className="size-3.5 text-white" />
            </span>
            <span className="text-left">
              <span className="block text-[12px] font-semibold leading-tight">{tool.name}</span>
              <span className="block text-[10px] leading-tight text-white/35">
                {tool.category.short}
              </span>
            </span>
          </motion.button>
        ))}

        <a
          href="#tools"
          className="flex shrink-0 items-center gap-1.5 rounded-2xl border border-dashed border-white/[0.12] px-4 text-[11.5px] font-semibold text-white/40 transition-colors hover:border-white/25 hover:text-white/70"
        >
          Browse all <ArrowRight className="size-3.5" />
        </a>
      </div>
    </div>
  );
}
