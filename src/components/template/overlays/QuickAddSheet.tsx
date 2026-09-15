"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { CATEGORIES } from "@/lib/template-data";
import { cn, formatNumber } from "@/lib/template-utils";
import Sheet from "./Sheet";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect?: (id: string) => void;
}

/** Bottom sheet: pick a category, then jump straight into it. */
export default function QuickAddSheet({ open, onClose, onSelect }: Props) {
  const router = useRouter();
  const pick = (id: string) => {
    if (onSelect) onSelect(id);
    else router.push(`/tools?q=${encodeURIComponent(id)}`);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Pick a category">
      <div className="max-h-[78vh] overflow-y-auto px-4 pb-6 pt-3">
        <p className="mb-3 px-1 text-[11.5px] text-white/45">
          Choose a category to launch tools from that area instantly.
        </p>
        <ul className="grid grid-cols-2 gap-2.5">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => pick(c.id)}
                  className={cn(
                    "group relative flex w-full cursor-pointer flex-col items-start gap-2 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3.5 text-left transition-all",
                    "hover:-translate-y-0.5 hover:border-white/[0.18] hover:bg-white/[0.07]"
                  )}
                  style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07)" }}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none absolute -right-12 -top-10 size-32 rounded-full opacity-60 blur-3xl transition-opacity group-hover:opacity-100",
                      c.blob
                    )}
                  />
                  <span
                    className={cn(
                      "relative flex size-9 items-center justify-center rounded-xl text-white shadow-md ring-1 ring-white/20 bg-gradient-to-br",
                      c.iconTile
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="relative text-[13px] font-semibold tracking-tight">
                    {c.short}
                  </span>
                  <span className="relative -mt-1.5 line-clamp-2 text-[11px] text-white/45">
                    {c.tagline}
                  </span>
                  <span className="relative tabular mt-auto flex items-center gap-1 text-[10.5px] text-white/55">
                    <Plus className="size-3" />
                    {formatNumber(c.count)} tools
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Sheet>
  );
}
