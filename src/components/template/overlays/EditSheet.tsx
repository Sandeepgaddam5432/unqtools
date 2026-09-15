"use client";

import { ArrowDown, ArrowUp, Eye, EyeOff, RotateCcw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Sheet from "./Sheet";
import { cn } from "@/lib/template-utils";

export interface WidgetMeta {
  id: string;
  name: string;
  size: string;
  icon: LucideIcon;
  tile: string;
  hidden?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  widgets: WidgetMeta[];
  onMove: (id: string, dir: -1 | 1) => void;
  onToggle: (id: string) => void;
  onReset: () => void;
}

/** Lets the user reorder and toggle widget visibility on the dashboard. */
export default function EditSheet({
  open,
  onClose,
  widgets,
  onMove,
  onToggle,
  onReset,
}: Props) {
  return (
    <Sheet open={open} onClose={onClose} title="Edit home layout">
      <div className="max-h-[80vh] overflow-y-auto px-4 pb-6 pt-3">
        <div className="mb-3 flex items-center justify-between px-1 text-[11.5px] text-white/45">
          <span>Reorder & toggle widgets</span>
          <button
            type="button"
            onClick={onReset}
            className="flex cursor-pointer items-center gap-1 rounded-full border border-white/[0.1] bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold text-white/75 transition-colors hover:bg-white/[0.1]"
          >
            <RotateCcw className="size-3" />
            Reset
          </button>
        </div>
        <ul className="flex flex-col gap-2">
          {widgets.map((w, i) => {
            const Icon = w.icon;
            return (
              <li
                key={w.id}
                className={cn(
                  "flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-2.5",
                  w.hidden && "opacity-50"
                )}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-xl text-white shadow-md ring-1 ring-white/20 bg-gradient-to-br",
                    w.tile
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">{w.name}</span>
                  <span className="block text-[10.5px] text-white/45">{w.size}</span>
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onMove(w.id, -1)}
                    disabled={i === 0}
                    aria-label="Move up"
                    className="flex size-8 cursor-pointer items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.05] text-white/65 transition-colors hover:bg-white/[0.1] disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ArrowUp className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onMove(w.id, 1)}
                    disabled={i === widgets.length - 1}
                    aria-label="Move down"
                    className="flex size-8 cursor-pointer items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.05] text-white/65 transition-colors hover:bg-white/[0.1] disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ArrowDown className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggle(w.id)}
                    aria-label={w.hidden ? "Show widget" : "Hide widget"}
                    className={cn(
                      "flex size-8 cursor-pointer items-center justify-center rounded-full border transition-colors",
                      w.hidden
                        ? "border-amber-400/30 bg-amber-400/[0.12] text-amber-300"
                        : "border-emerald-400/30 bg-emerald-400/[0.12] text-emerald-300"
                    )}
                  >
                    {w.hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </Sheet>
  );
}
