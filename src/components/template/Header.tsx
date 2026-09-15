"use client";

import { Check, Layers, Pencil, Plus, Search, ShieldCheck, Wifi, WifiOff } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useOnline } from "@/lib/template-hooks";
import { cn } from "@/lib/template-utils";

interface Props {
  editMode: boolean;
  onToggleEdit: () => void;
  onOpenSearch: () => void;
  onQuickAdd: () => void;
}

export default function Header({
  editMode,
  onToggleEdit,
  onOpenSearch,
  onQuickAdd,
}: Props) {
  const online = useOnline();

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#090D16]/70 backdrop-blur-2xl">
      {/* hairline glow under the bar */}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-400/25 to-transparent" />

      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2.5 px-4 sm:gap-3 sm:px-6">
        {/* brand */}
        <a href="#" className="flex items-center gap-2.5" aria-label="UnQTools home">
          <motion.span
            whileHover={{ rotate: -8, scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: "spring", stiffness: 420, damping: 18 }}
            className="relative flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-[0_12px_28px_-8px_rgba(34,211,238,0.6),inset_0_1px_1px_rgba(255,255,255,0.45)]"
          >
            <Layers className="size-4.5 text-white" />
          </motion.span>
          <span className="text-[17px] font-extrabold tracking-tight">
            UnQ<span className="text-cyan-300">Tools</span>
          </span>
        </a>

        {/* privacy badge */}
        <span
          className={cn(
            "ml-1 hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10.5px] font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] md:inline-flex",
            online
              ? "border-emerald-400/25 bg-emerald-400/[0.09] text-emerald-300"
              : "border-amber-400/30 bg-amber-400/[0.09] text-amber-300"
          )}
        >
          <span className="relative flex size-1.5">
            <span
              className={cn(
                "absolute inline-flex size-full animate-ping rounded-full opacity-75",
                online ? "bg-emerald-300" : "bg-amber-300"
              )}
            />
            <span
              className={cn(
                "relative inline-flex size-1.5 rounded-full",
                online ? "bg-emerald-300" : "bg-amber-300"
              )}
            />
          </span>
          {online ? (
            <>
              <ShieldCheck className="size-3" /> 100% Client-Side · Offline-Ready
            </>
          ) : (
            <>
              <WifiOff className="size-3" /> Offline Mode · Fully Functional
            </>
          )}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {/* search trigger */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={onOpenSearch}
            aria-label="Search tools"
            className="flex h-10 cursor-pointer items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.05] px-3.5 text-[12px] font-medium text-white/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_4px_12px_-6px_rgba(0,0,0,0.6)] transition-all hover:border-cyan-400/30 hover:text-white/85 hover:shadow-[0_0_24px_-6px_rgba(34,211,238,0.5)]"
          >
            <Search className="size-3.5" />
            <span className="hidden sm:inline">Search tools</span>
            <kbd className="key hidden md:inline-flex">⌘K</kbd>
          </motion.button>

          {/* quick add */}
          <motion.button
            type="button"
            whileHover={{ rotate: 90 }}
            whileTap={{ scale: 0.88 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
            onClick={onQuickAdd}
            aria-label="Quick add tool"
            className="relative hidden size-10 cursor-pointer items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 text-white shadow-[0_10px_24px_-6px_rgba(34,211,238,0.6),inset_0_1px_1px_rgba(255,255,255,0.4)] sm:flex"
          >
            <span className="pulse-ring absolute inset-1 rounded-full border border-cyan-300/50" />
            <Plus className="relative size-4" strokeWidth={2.6} />
          </motion.button>

          {/* edit toggle */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.94 }}
            onClick={onToggleEdit}
            className={cn(
              "flex h-10 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-[12px] font-semibold transition-all",
              editMode
                ? "border-white bg-white text-black shadow-[0_8px_24px_-6px_rgba(255,255,255,0.35)]"
                : "border-white/[0.1] bg-white/[0.05] text-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:border-white/25 hover:bg-white/[0.09] hover:text-white"
            )}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={editMode ? "done" : "edit"}
                initial={{ opacity: 0, y: 8, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 460, damping: 26 }}
                className="flex items-center gap-1.5"
              >
                {editMode ? (
                  <Check className="size-3.5" strokeWidth={3} />
                ) : (
                  <Pencil className="size-3.5" />
                )}
                {editMode ? "Done" : "Edit"}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </div>
      </div>
    </header>
  );
}
