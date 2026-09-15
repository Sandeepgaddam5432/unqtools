"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowLeft,
  Lock,
  WifiOff,
  Zap,
  Code2,
  Type,
  Calculator,
  Image as ImageIcon,
  Layers,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { type ToolCategory, type ToolManifest } from "@/lib/tool";
import { groupTools } from "@/lib/tool-groups";
import TemplateShell, { TemplateFooter } from "@/components/template/TemplateShell";
import {
  CATEGORIES as TEMPLATE_CATEGORIES,
} from "@/lib/template-data";
import { cn } from "@/lib/template-utils";

const CATEGORY_ICONS: Record<ToolCategory, typeof Code2> = {
  developer: Code2,
  text: Type,
  calculators: Calculator,
  image: ImageIcon,
  pdf: Layers,
  "audio-video": Layers,
  seo: Layers,
  "network-security": Lock,
  file: Layers,
  business: Layers,
  education: Layers,
  social: Layers,
  ai: Sparkles,
};

interface CategoryPageClientProps {
  category: ToolCategory;
  label: string;
  tools: ToolManifest[];
}

export function CategoryPageClient({ category, label, tools }: CategoryPageClientProps) {
  const Icon = CATEGORY_ICONS[category] ?? Layers;
  const grouped = groupTools(category, tools);

  // Pull style from template-data for consistency.
  const tc = TEMPLATE_CATEGORIES.find((c) => c.id === category);
  const tileClass = tc?.iconTile ?? "from-slate-400 to-slate-600";
  const tcShort = tc?.short ?? label.split(" ")[0];

  return (
    <TemplateShell footer={<TemplateFooter />}>
      <div className="mx-auto max-w-7xl px-3 pb-32 pt-4 sm:px-6 sm:pt-6 md:pb-12">
        {/* Hero card */}
        <header className="relative mb-8 overflow-hidden rounded-3xl border border-white/[0.07] bg-[#0c1018]/85 p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_18px_44px_-20px_rgba(0,0,0,0.7)] sm:p-8">
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute -right-24 -top-24 size-72 rounded-full opacity-50 blur-3xl",
              tc?.blob ?? "bg-slate-500/20"
            )}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
          />

          <div className="relative mb-5 flex flex-wrap items-center gap-3">
            <span
              className={cn(
                "flex size-12 items-center justify-center rounded-2xl text-white shadow-[0_12px_28px_-8px_rgba(34,211,238,0.6),inset_0_1px_1px_rgba(255,255,255,0.4)] ring-1 ring-white/20 bg-gradient-to-br",
                tileClass
              )}
            >
              <Icon className="size-5" />
            </span>
            <span className="rounded-full border border-white/[0.09] bg-white/[0.05] px-2.5 py-1 text-[10.5px] font-semibold text-white/75">
              {tools.length > 0 ? `${tools.length} tools` : "Coming soon"}
            </span>
          </div>

          <h1 className="relative text-balance text-3xl font-bold leading-tight tracking-tight sm:text-4xl md:text-[44px]">
            {label}
          </h1>
          <p className="relative mt-3 max-w-2xl text-[14px] text-white/55 sm:text-[15.5px]">
            {tools.length > 0
              ? `${tools.length} tool${tools.length === 1 ? "" : "s"} in this category — all running 100% in your browser. No uploads, no tracking, no accounts.`
              : `${label} tools are coming soon — and like every UnQTools tool, they will run 100% in your browser. No uploads, no tracking, no accounts.`}
          </p>

          <div className="relative mt-5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/[0.08] px-2.5 py-1 text-[10.5px] font-semibold text-emerald-300">
              <Lock className="size-3" /> 100% Private
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/20 bg-cyan-400/[0.08] px-2.5 py-1 text-[10.5px] font-semibold text-cyan-300">
              <WifiOff className="size-3" /> Works Offline
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/[0.08] px-2.5 py-1 text-[10.5px] font-semibold text-amber-300">
              <Zap className="size-3" /> Instant
            </span>
          </div>

          <Link
            href="/tools"
            className="relative mt-6 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.05] px-3.5 py-2 text-[12px] text-white/75 transition-colors hover:bg-white/[0.1]"
          >
            <ArrowLeft className="size-3.5" /> All tools
          </Link>
        </header>

        {/* Group jump links */}
        {grouped.length > 1 && (
          <section className="mb-8">
            <p className="mb-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-white/45">
              What do you want to do? Jump to a section
            </p>
            <div className="flex flex-wrap gap-1.5">
              {grouped.map((g) => {
                const gid = g.group ? g.group.id : "other";
                const total = g.items.length;
                const doneCount = g.items.filter((t) => t.status !== "planned").length;
                return (
                  <a
                    key={gid}
                    href={`#group-${gid}`}
                    className="rounded-full border border-white/[0.07] bg-white/[0.04] px-3 py-1.5 text-[11.5px] font-medium text-white/75 transition-colors hover:border-white/[0.18] hover:text-white"
                  >
                    {g.group?.label ?? "More tools"}{" "}
                    <span className="text-white/45">
                      ({doneCount} ready{total > doneCount ? ` +${total - doneCount} soon` : ""})
                    </span>
                  </a>
                );
              })}
            </div>
          </section>
        )}

        {/* Grouped tools */}
        <section className="space-y-10">
          {tools.length === 0 ? (
            <div className="rounded-3xl border border-white/[0.07] bg-[#0c1018]/55 py-16 text-center">
              <span className="mx-auto mb-5 inline-flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-500 to-slate-700 text-white shadow-md">
                <Layers className="size-6" />
              </span>
              <p className="text-[18px] font-bold">Coming soon</p>
              <p className="mx-auto mt-2 max-w-md text-[13px] text-white/45">
                We&apos;re building {label} tools right now — private, offline-capable,
                and free, like everything else on UnQTools.
              </p>
              <Link
                href="/tools"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 to-blue-600 px-4 py-2 text-[12px] font-semibold text-white shadow-md"
              >
                Browse available tools <ArrowRight className="size-3.5" />
              </Link>
            </div>
          ) : (
            grouped.map((g, gi) => {
              const gid = g.group ? g.group.id : "other";
              const doneCount = g.items.filter((t) => t.status !== "planned").length;
              const soonCount = g.items.length - doneCount;
              return (
                <div key={gid} id={`group-${gid}`} className="scroll-mt-24">
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-xl font-bold tracking-tight md:text-2xl">
                      {g.group?.label ?? "More tools"}
                    </h2>
                    <p className="text-[11px] text-white/45">
                      {doneCount} ready{soonCount > 0 ? ` · ${soonCount} coming soon` : ""}
                    </p>
                  </div>
                  {g.group && (
                    <p className="mb-5 text-[13px] text-white/55">{g.group.blurb}</p>
                  )}
                  {!g.group && (
                    <p className="mb-5 text-[13px] text-white/55">
                      Everything else in this category.
                    </p>
                  )}
                  <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {g.items.map((tool) => {
                      const ToolIcon = CATEGORY_ICONS[tool.category] ?? Layers;
                      return (
                        <li key={tool.id}>
                          <Link
                            href={`/tools/${tool.id}`}
                            className="group relative flex h-full w-full items-center gap-3 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 hover:border-white/[0.15] hover:bg-white/[0.06]"
                          >
                            <span
                              aria-hidden="true"
                              className={cn(
                                "pointer-events-none absolute -right-10 -top-12 size-24 rounded-full opacity-50 blur-3xl transition-opacity group-hover:opacity-100",
                                tc?.blob ?? "bg-slate-500/20"
                              )}
                            />
                            <span
                              className={cn(
                                "relative flex size-8 shrink-0 items-center justify-center rounded-lg text-white shadow ring-1 ring-white/15 bg-gradient-to-br",
                                tileClass
                              )}
                            >
                              <ToolIcon className="size-4" />
                            </span>
                            <span className="relative min-w-0 flex-1">
                              <span className="flex items-center gap-1.5">
                                <span className="truncate text-[12.5px] font-semibold tracking-tight">
                                  {tool.name}
                                </span>
                                {tool.status === "planned" && (
                                  <span className="hidden shrink-0 rounded-full border border-amber-400/20 bg-amber-400/[0.08] px-1.5 py-0.5 text-[9px] font-medium text-amber-300 sm:inline">
                                    Soon
                                  </span>
                                )}
                              </span>
                              <span className="line-clamp-1 text-[10.5px] text-white/45">
                                {tool.description}
                              </span>
                            </span>
                            <ChevronRight
                              className="size-3.5 shrink-0 text-white/25 transition-all group-hover:translate-x-0.5 group-hover:text-white/65"
                              aria-hidden="true"
                            />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })
          )}
        </section>

        {/* Helpful cross-category */}
        {tools.length > 0 && (
          <section className="mt-12 rounded-3xl border border-white/[0.06] bg-[#0c1018]/55 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wider text-white/45">
              Explore other categories
            </h3>
            <ul className="flex flex-wrap gap-1.5">
              {TEMPLATE_CATEGORIES.filter((c) => c.id !== category).map((c) => {
                const CIcon = c.icon;
                return (
                  <li key={c.id}>
                    <Link
                      href={`/category/${c.id}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.04] px-3 py-1.5 text-[11.5px] font-semibold text-white/75 transition-colors hover:bg-white/[0.08]"
                    >
                      <CIcon className="size-3.5" />
                      {c.short}
                      <span className="tabular text-white/45">{c.count}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </TemplateShell>
  );
}
