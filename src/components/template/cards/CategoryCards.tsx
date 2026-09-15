"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";

import type { Category, FlatTool } from "@/lib/template-data";
import { cn, formatNumber } from "@/lib/template-utils";

interface Props {
  cat: Category;
  onLaunch: (id: string) => void;
}

/** Generic category tile — reused for all 13 tools on the dashboard. */
export default function CategoryCard({ cat, onLaunch }: Props) {
  const router = useRouter();
  const Icon: LucideIcon = cat.icon;

  return (
    <div className="flex h-full flex-col p-5">
      {/* heading */}
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex size-10 items-center justify-center rounded-2xl text-white shadow-[0_10px_24px_-6px_rgba(34,211,238,0.55),inset_0_1px_0_rgba(255,255,255,0.4)] ring-1 ring-white/20 bg-gradient-to-br",
            cat.iconTile
          )}
        >
          <Icon className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-[14.5px] font-bold tracking-tight">
              {cat.short}
            </h3>
            <span className="tabular rounded-full border border-white/[0.07] bg-white/[0.04] px-1.5 text-[10px] font-semibold text-white/55">
              {formatNumber(cat.count)}
            </span>
          </div>
          <p className="truncate text-[10.5px] text-white/45">{cat.tagline}</p>
        </div>
      </div>

      {/* tools list */}
      <ul className="mt-3 flex flex-1 flex-col gap-1.5">
        {cat.tools.slice(0, 6).map((t) => (
          <ToolRow key={t.id} tool={t as FlatTool} cat={cat} onLaunch={onLaunch} />
        ))}
      </ul>

      {/* footer */}
      <button
        type="button"
        onClick={() => router.push(`/category/${cat.id}`)}
        className={cn(
          "mt-3 flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-white/[0.07] bg-white/[0.04] py-1.5 text-[11px] font-semibold transition-colors",
          "hover:border-white/[0.18] hover:bg-white/[0.07]",
          cat.text
        )}
      >
        Explore {formatNumber(cat.count)} {cat.short} tools
        <ArrowRight className="size-3" />
      </button>
    </div>
  );
}

function ToolRow({
  tool,
  cat,
  onLaunch,
}: {
  tool: FlatTool;
  cat: Category;
  onLaunch: (id: string) => void;
}) {
  const Icon: LucideIcon = tool.icon;
  return (
    <li>
      <button
        type="button"
        onClick={() => onLaunch(tool.id)}
        className={cn(
          "group flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-transparent px-2 py-1.5 text-left transition-colors",
          "hover:border-white/[0.08] hover:bg-white/[0.05]"
        )}
      >
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-lg text-white shadow ring-1 ring-white/15 bg-gradient-to-br",
            cat.iconTile
          )}
        >
          <Icon className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[12px] font-semibold">{tool.name}</span>
            {tool.hot && (
              <Sparkles className="size-2.5 shrink-0 text-cyan-300/90" aria-label="Popular" />
            )}
          </span>
          <span className="block truncate text-[10.5px] text-white/40">{tool.blurb}</span>
        </span>
        <ArrowRight className="size-3.5 shrink-0 text-white/25 transition-all group-hover:translate-x-0.5 group-hover:text-white/65" />
      </button>
    </li>
  );
}
