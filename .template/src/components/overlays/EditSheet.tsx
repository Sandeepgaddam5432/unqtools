"use client";

import { ArrowDown, ArrowUp, GripVertical, Minus, Plus, RotateCcw } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import Sheet from "@/components/overlays/Sheet";
import { cn } from "@/lib/utils";

export interface WidgetMeta {
  id: string;
  name: string;
  size: string;
  icon: LucideIcon;
  tile: string;
  hidden: boolean;
}

export default function EditSheet({
  open,
  onClose,
  widgets,
  onMove,
  onToggle,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  widgets: WidgetMeta[];
  onMove: (id: string, dir: -1 | 1) => void;
  onToggle: (id: string) => void;
  onReset: () => void;
}) {
  const visible = widgets.filter((w) => !w.hidden);
  const hidden = widgets.filter((w) => w.hidden);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Edit home"
      subtitle="Reorder widgets or hide the ones you don't need — saved on this device"
      headerRight={
        <button
          type="button"
          onClick={onReset}
          className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-white/55 transition-colors hover:text-white"
        >
          <RotateCcw className="size-3" /> Reset
        </button>
      }
    >
      <div className="flex flex-col gap-5">
        <section>
          <h3 className="pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">
            On dashboard · {visible.length}
          </h3>
          <div className="flex flex-col gap-1.5">
            <AnimatePresence initial={false}>
              {visible.map((w) => (
                <motion.div
                  key={w.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2.5 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] px-2.5 py-2"
                >
                  <GripVertical className="size-4 shrink-0 text-white/20" />
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br",
                      w.tile
                    )}
                  >
                    <w.icon className="size-3.5 text-white" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-semibold">{w.name}</span>
                    <span className="block text-[9.5px] font-medium uppercase tracking-wider text-white/30">
                      {w.size}
                    </span>
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onMove(w.id, -1)}
                      aria-label="Move up"
                      className="flex size-7 cursor-pointer items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.04] text-white/60 transition-colors hover:bg-white/[0.1] hover:text-white"
                    >
                      <ArrowUp className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onMove(w.id, 1)}
                      aria-label="Move down"
                      className="flex size-7 cursor-pointer items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.04] text-white/60 transition-colors hover:bg-white/[0.1] hover:text-white"
                    >
                      <ArrowDown className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggle(w.id)}
                      aria-label="Hide widget"
                      className="flex size-7 cursor-pointer items-center justify-center rounded-lg bg-red-500/90 text-white transition-colors hover:bg-red-400"
                    >
                      <Minus className="size-3.5" strokeWidth={3} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>

        <section>
          <h3 className="pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">
            Hidden · {hidden.length}
          </h3>
          {hidden.length === 0 && (
            <p className="rounded-2xl border border-dashed border-white/[0.1] px-4 py-5 text-center text-[11.5px] text-white/30">
              Nothing hidden — remove widgets with the red badges while in edit mode.
            </p>
          )}
          <div className="flex flex-col gap-1.5">
            <AnimatePresence initial={false}>
              {hidden.map((w) => (
                <motion.div
                  key={w.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2.5 overflow-hidden rounded-2xl border border-white/[0.05] bg-white/[0.02] px-2.5 py-2 opacity-80"
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br grayscale",
                      w.tile
                    )}
                  >
                    <w.icon className="size-3.5 text-white" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-semibold text-white/70">
                      {w.name}
                    </span>
                    <span className="block text-[9.5px] font-medium uppercase tracking-wider text-white/25">
                      {w.size}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onToggle(w.id)}
                    aria-label="Add widget"
                    className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-emerald-500/90 text-white transition-colors hover:bg-emerald-400"
                  >
                    <Plus className="size-3.5" strokeWidth={3} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>
      </div>
    </Sheet>
  );
}
