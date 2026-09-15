"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/template-utils";
import {
  Search,
  ArrowRight,
  Lock,
  WifiOff,
  Zap,
  Sparkles,
  Code2,
  Type,
  Calculator,
  Image as ImageIcon,
  Layers,
  Star,
  Clock,
  Trash2,
  ChevronRight,
} from "lucide-react";
import { CATALOG, countByCategory } from "@/lib/catalog";
import { CATEGORY_LABELS, ALL_CATEGORIES, type ToolCategory } from "@/lib/tool";
import { searchTools } from "@/lib/search";
import { useFavorites, useRecentTools } from "@/hooks/use-tool-history";
import {
  CATEGORIES as TEMPLATE_CATEGORIES,
} from "@/lib/template-data";
import TemplateShell, { TemplateFooter } from "@/components/template/TemplateShell";

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

type ViewFilter = ToolCategory | "all" | "favorites" | "recent" | "ready";

export default function ToolsPage() {
  return (
    <TemplateShell footer={<TemplateFooter />}>
      <ToolsPageContent />
    </TemplateShell>
  );
}

function ToolsPageContent() {
  const [query, setQuery] = useState("");
  const [activeView, setActiveView] = useState<ViewFilter>("ready");

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const q = sp.get("q");
    if (q) setQuery(q);
    const v = sp.get("view");
    if (v === "favorites" || v === "recent" || v === "ready" || v === "all") {
      setActiveView(v);
    }
  }, []);

  const { favorites, toggle, isFavorite, clear: clearFavorites } = useFavorites();
  const { recent, clear: clearRecent } = useRecentTools();

  const counts = countByCategory();
  const activeCats = ALL_CATEGORIES.filter((c) => (counts[c] ?? 0) > 0);

  const readyCount = useMemo(
    () => CATALOG.filter((t) => t.status !== "planned").length,
    []
  );

  const idToTool = useMemo(() => new Map(CATALOG.map((t) => [t.id, t])), []);

  const filteredTools = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list: (typeof CATALOG)[number][];

    if (activeView === "favorites") {
      list = favorites
        .map((id) => idToTool.get(id))
        .filter((t): t is (typeof CATALOG)[number] => Boolean(t));
    } else if (activeView === "recent") {
      list = recent
        .map((id) => idToTool.get(id))
        .filter((t): t is (typeof CATALOG)[number] => Boolean(t));
    } else {
      list = q
        ? searchTools(query, CATALOG, 50).map((r) => r.tool)
        : Array.from(CATALOG);
      if (activeView === "ready") {
        list = list.filter((t) => t.status !== "planned");
      } else if (activeView !== "all") {
        list = list.filter((t) => t.category === activeView);
      }
    }

    if (q) {
      list = list.filter(
        (t) => t.name.toLowerCase().includes(q) || t.id.includes(q)
      );
    }
    return list;
  }, [query, activeView, favorites, recent, idToTool]);

  const [visibleCount, setVisibleCount] = useState(96);
  useEffect(() => {
    setVisibleCount(96);
  }, [query, activeView]);
  const visibleTools = useMemo(
    () => filteredTools.slice(0, visibleCount),
    [filteredTools, visibleCount]
  );
  const remainingCount = filteredTools.length - visibleCount;

  return (
    <div className="mx-auto max-w-7xl px-3 pb-32 pt-4 sm:px-6 sm:pt-6 md:pb-12">
      {/* Hero */}
      <section className="mb-8 rounded-3xl border border-white/[0.06] bg-[#0c1018]/55 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-8">
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-cyan-400/20 bg-cyan-400/[0.08] px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-cyan-300">
          <Layers className="size-3" /> Directory
        </div>
        <h1 className="text-balance text-3xl font-bold leading-tight tracking-tight sm:text-[34px]">
          Every tool you need,
          <br />
          <span className="bg-gradient-to-r from-cyan-300 via-amber-300 to-cyan-200 bg-clip-text text-transparent">
            all in your browser
          </span>
        </h1>
        <p className="mt-2 text-[13px] text-white/55 sm:text-[14.5px]">
          {CATALOG.length.toLocaleString()} fast, free, offline-capable browser tools — converters,
          calculators, generators, formatters. No uploads, no tracking, no accounts.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
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

        <div className="mt-5 max-w-xl">
          <label className="group relative flex h-11 items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] focus-within:border-white/[0.18]">
            <Search className="size-3.5 text-white/45" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder='Try “merge pdf” or “json formatter”…'
              className="w-full bg-transparent text-[13px] text-white placeholder:text-white/35 outline-none"
              aria-label="Search tools"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="cursor-pointer rounded-full px-1.5 text-[10px] font-bold text-white/45 hover:text-white/85"
              >
                clear
              </button>
            )}
          </label>
        </div>
      </section>

      {/* Category strip — secondary, mobile-friendly */}
      <section className="mb-8">
        <div className="no-scrollbar -mx-2 flex gap-1.5 overflow-x-auto px-2 pb-1">
          <button
            onClick={() => setActiveView("favorites")}
            className={cn(
              "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition-all",
              activeView === "favorites"
                ? "bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-md"
                : "border border-white/[0.07] bg-white/[0.04] text-white/60 hover:bg-white/[0.07]"
            )}
          >
            <Star className={cn("size-3.5", activeView === "favorites" && "fill-current")} />
            Favorites ({favorites.length})
          </button>
          <button
            onClick={() => setActiveView("recent")}
            className={cn(
              "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition-all",
              activeView === "recent"
                ? "bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-md"
                : "border border-white/[0.07] bg-white/[0.04] text-white/60 hover:bg-white/[0.07]"
            )}
          >
            <Clock className="size-3.5" />
            Recent ({recent.length})
          </button>
          <button
            onClick={() => setActiveView("ready")}
            className={cn(
              "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition-all",
              activeView === "ready"
                ? "bg-gradient-to-r from-cyan-400 to-blue-600 text-white shadow-md"
                : "border border-white/[0.07] bg-white/[0.04] text-white/60 hover:bg-white/[0.07]"
            )}
          >
            Ready now ({readyCount.toLocaleString()})
          </button>
          <button
            onClick={() => setActiveView("all")}
            className={cn(
              "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition-all",
              activeView === "all"
                ? "bg-gradient-to-r from-cyan-400 to-blue-600 text-white shadow-md"
                : "border border-white/[0.07] bg-white/[0.04] text-white/60 hover:bg-white/[0.07]"
            )}
          >
            All ({CATALOG.length.toLocaleString()})
          </button>
          {activeCats.map((cat) => {
            const Icon = CATEGORY_ICONS[cat] ?? Layers;
            const label = CATEGORY_LABELS[cat].split(" ")[0].replace(/[,.;:]$/, "");
            const tc = TEMPLATE_CATEGORIES.find((c) => c.id === cat);
            return (
              <button
                key={cat}
                onClick={() => setActiveView(cat)}
                className={cn(
                  "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition-all",
                  activeView === cat
                    ? `bg-gradient-to-r ${tc?.iconTile ?? "from-slate-400 to-slate-600"} text-white shadow-md`
                    : "border border-white/[0.07] bg-white/[0.04] text-white/60 hover:bg-white/[0.07]"
                )}
              >
                <Icon className="size-3.5" />
                {label} ({counts[cat] ?? 0})
              </button>
            );
          })}
        </div>
      </section>

      {/* Catalog grid */}
      <section className="rounded-3xl border border-white/[0.06] bg-[#0c1018]/55 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-6">
        {(activeView === "favorites" || activeView === "recent") && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12.5px] text-white/55">
              {activeView === "favorites"
                ? `${filteredTools.length} favorited — saved only in your browser`
                : `${filteredTools.length} recently viewed — most recent first`}
            </p>
            <button
              type="button"
              className="flex cursor-pointer items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.05] px-3 py-1.5 text-[11.5px] text-white/65 hover:bg-white/[0.1]"
              onClick={() => (activeView === "favorites" ? clearFavorites() : clearRecent())}
            >
              <Trash2 className="size-3.5" />
              Clear {activeView}
            </button>
          </div>
        )}

        {filteredTools.length === 0 ? (
          <div className="py-16 text-center">
            <Search className="mx-auto mb-4 size-12 text-white/30" />
            <p className="text-[16px] font-medium">No tools found</p>
            <p className="mt-1 text-[13px] text-white/45">
              {activeView === "favorites"
                ? "Tap the ★ on any tool card or tool page to save it here for one-tap access."
                : activeView === "recent"
                ? "Tools you open will appear here, most recent first — all stored locally."
                : "Try a different search or category."}
            </p>
          </div>
        ) : (
          <ul
            key={`${activeView}-${query}`}
            className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            {visibleTools.map((tool) => {
              const Icon = CATEGORY_ICONS[tool.category] ?? Layers;
              const fav = isFavorite(tool.id);
              const tc = TEMPLATE_CATEGORIES.find((c) => c.id === tool.category);
              const tileClass = tc?.iconTile ?? "from-slate-400 to-slate-600";
              return (
                <li key={tool.id} className="relative">
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
                      <Icon className="size-4" />
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
                    <ChevronRight className="size-3.5 shrink-0 text-white/25 transition-all group-hover:translate-x-0.5 group-hover:text-white/65" aria-hidden="true" />
                  </Link>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggle(tool.id);
                    }}
                    aria-pressed={fav}
                    aria-label={fav ? `Remove ${tool.name} from favorites` : `Add ${tool.name} to favorites`}
                    title={fav ? "Remove from favorites" : "Add to favorites"}
                    className={cn(
                      "absolute right-2 top-2 z-10 rounded-md p-1 transition-all cursor-pointer",
                      fav
                        ? "text-amber-300"
                        : "text-white/40 hover:text-amber-300"
                    )}
                  >
                    <Star className={cn("size-3.5", fav && "fill-current")} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {remainingCount > 0 && filteredTools.length > 0 && (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => setVisibleCount((c) => c + 192)}
              className="flex cursor-pointer items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.05] px-5 py-2.5 text-[12px] font-semibold text-white/75 transition-colors hover:bg-white/[0.1]"
            >
              Show more tools ({remainingCount.toLocaleString()} remaining)
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
