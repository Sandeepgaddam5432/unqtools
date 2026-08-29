"use client";

import React, { useState, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { SidebarNav } from "@/components/navigation/sidebar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  Sparkles,
  ArrowRight,
  Lock,
  WifiOff,
  Zap,
  Wand2,
  Code2,
  Type,
  Calculator,
  Image as ImageIcon,
  Layers,
  Star,
  Clock,
  Trash2,
} from "lucide-react";
import { CATALOG, countByCategory } from "@/lib/catalog";
import { CATEGORY_LABELS, ALL_CATEGORIES, type ToolCategory } from "@/lib/tool";
import { searchTools } from "@/lib/search";
import { useFavorites, useRecentTools } from "@/hooks/use-tool-history";

// ===== CATEGORY ICONS =====
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

// ===== PAGE COMPONENT =====

export default function ToolsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh bg-background">
          <SidebarNav />
          <main className="flex-1 overflow-y-auto overflow-x-hidden pt-12 md:pt-0">
            <div className="section-padding py-24 text-center text-muted-foreground">
              Loading tools…
            </div>
          </main>
        </div>
      }
    >
      <ToolsPageContent />
    </Suspense>
  );
}

type ViewFilter = ToolCategory | "all" | "favorites" | "recent" | "ready";

function ToolsPageContent() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(() => searchParams?.get("q") ?? "");
  const [activeView, setActiveView] = useState<ViewFilter>(() => {
    const v = searchParams?.get("view");
    if (v === "favorites" || v === "recent" || v === "ready") return v;
    return "ready";
  });
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

  return (
    <div className="flex min-h-dvh bg-background">
      <SidebarNav />
      <main className="flex-1 overflow-y-auto overflow-x-hidden pt-12 md:pt-0">
        {/* ===== HERO ===== */}
        <section className="relative section-padding pt-2 pb-16 md:py-24">
          <div className="container mx-auto px-4 md:px-6">
            <div
              className="unq-animate-fade-in-up inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-6"
            >
              <Layers className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm text-foreground font-medium">{CATALOG.length} Tools Available</span>
            </div>
            <h1
              className="unq-animate-fade-in-up unq-stagger-1 text-4xl sm:text-5xl md:text-6xl font-bold text-foreground mb-4 tracking-tight text-balance"
            >
              Every tool you need,
              <br />
              <span className="unq-gradient-text">
                all in your browser
              </span>
            </h1>
            <p
              className="unq-animate-fade-in-up unq-stagger-2 text-base sm:text-lg text-muted-foreground max-w-2xl mb-8 text-pretty"
            >
              {CATALOG.length} fast, free, offline-capable browser tools — converters,
              calculators, generators, formatters. No uploads, no tracking, no accounts.
            </p>

            {/* Trust badges */}
            <div
              className="unq-animate-fade-in-up unq-stagger-3 flex flex-wrap items-center gap-3 mb-8"
            >
              <Badge className="bg-primary/15 text-foreground border-primary/20 gap-1">
                <Lock className="h-3 w-3" /> 100% Private
              </Badge>
              <Badge className="bg-primary/10 text-primary border-primary/20 gap-1">
                <WifiOff className="h-3 w-3" /> Works Offline
              </Badge>
              <Badge className="bg-primary/10 text-primary border-primary/20 gap-1">
                <Zap className="h-3 w-3" /> Instant
              </Badge>
            </div>

            {/* Search */}
            <div
              className="unq-animate-fade-in-up unq-stagger-4 max-w-xl"
            >
              <div className="unq-glass relative flex items-center rounded-2xl border border-border bg-card/60 shadow-lg shadow-black/[0.04] transition-[border-color,box-shadow] duration-200 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={`What do you want to do? e.g. “make my PDF smaller”`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-12 w-full border-0 bg-transparent pl-10 pr-4 text-base rounded-2xl focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ===== CATEGORY FILTERS ===== */}
        <section className="section-padding pb-8">
          <div className="container mx-auto px-4 md:px-6">
            <div
              className="flex flex-wrap gap-2"
            >
              <button
                onClick={() => setActiveView("favorites")}
                aria-pressed={activeView === "favorites"}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-[background-color,color,border-color,box-shadow] duration-200 cursor-pointer flex items-center gap-1.5 touch-target ${
                  activeView === "favorites"
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-muted text-foreground/80 hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                <Star className={`h-3.5 w-3.5 ${activeView === "favorites" ? "fill-current" : ""}`} />
                Favorites ({favorites.length})
              </button>
              <button
                onClick={() => setActiveView("recent")}
                aria-pressed={activeView === "recent"}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-[background-color,color,border-color,box-shadow] duration-200 cursor-pointer flex items-center gap-1.5 touch-target ${
                  activeView === "recent"
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-muted text-foreground/80 hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                Recent ({recent.length})
              </button>
              <button
                onClick={() => setActiveView("ready")}
                aria-pressed={activeView === "ready"}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-[background-color,color,border-color,box-shadow] duration-200 cursor-pointer touch-target ${
                  activeView === "ready"
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-muted text-foreground/80 hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                Ready now ({readyCount})
              </button>
              <button
                onClick={() => setActiveView("all")}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-[background-color,color,border-color,box-shadow] duration-200 cursor-pointer touch-target ${
                  activeView === "all"
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-muted text-foreground/80 hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                All ({CATALOG.length})
              </button>
              {activeCats.map((cat) => {
                const Icon = CATEGORY_ICONS[cat] ?? Layers;
                // Strip trailing comma/punctuation for short label (e.g. "Network," → "Network")
                const label = CATEGORY_LABELS[cat].split(" ")[0].replace(/[,.;:]$/, "");
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveView(cat)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-[background-color,color,border-color,box-shadow] duration-200 cursor-pointer flex items-center gap-1.5 touch-target ${
                      activeView === cat
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "bg-muted text-foreground/80 hover:bg-muted/80 hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label} ({counts[cat] ?? 0})
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* ===== CATALOG GRID ===== */}
        <section className="section-padding pb-24">
          <div className="container mx-auto px-4 md:px-6">
            {(activeView === "favorites" || activeView === "recent") && (
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <p className="text-sm text-muted-foreground">
                  {activeView === "favorites"
                    ? `${filteredTools.length} favorited tool${filteredTools.length === 1 ? "" : "s"} — saved only in your browser`
                    : `${filteredTools.length} recently viewed tool${filteredTools.length === 1 ? "" : "s"} — most recent first`}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
                  onClick={() => (activeView === "favorites" ? clearFavorites() : clearRecent())}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear {activeView}
                </Button>
              </div>
            )}

            {filteredTools.length === 0 ? (
              <div
                className="unq-animate-fade-in text-center py-24"
              >
                {activeView === "favorites" ? (
                  <>
                    <Star className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                    <p className="text-lg font-medium text-foreground mb-1">No favorites yet</p>
                    <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
                      Tap the ★ on any tool card or tool page to save it here for one-tap access.
                      Favorites never leave your browser.
                    </p>
                    <Button variant="outline" size="sm" className="gap-2 cursor-pointer" onClick={() => setActiveView("all")}>
                      Browse all tools <ArrowRight className="h-4 w-4" />
                    </Button>
                  </>
                ) : activeView === "recent" ? (
                  <>
                    <Clock className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                    <p className="text-lg font-medium text-foreground mb-1">Nothing viewed yet</p>
                    <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
                      Tools you open will appear here, most recent first — all stored locally.
                    </p>
                    <Button variant="outline" size="sm" className="gap-2 cursor-pointer" onClick={() => setActiveView("all")}>
                      Browse all tools <ArrowRight className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Search className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                    <p className="text-lg font-medium text-foreground mb-1">No tools found</p>
                    <p className="text-sm text-muted-foreground">
                      Try a different search or category.
                    </p>
                  </>
                )}
              </div>
            ) : (
              // CSS-based animation — bulletproof, no JS dependency, no hydration
              // issues. Each card gets a staggered animation-delay via inline style.
              // This replaces the old framer-motion whileInView pattern which
              // failed when switching category tabs (new cards stayed invisible).
              <div
                key={`${activeView}-${query}`}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6"
              >
                {filteredTools.map((tool, index) => {
                  const Icon = CATEGORY_ICONS[tool.category] ?? Wand2;
                  const fav = isFavorite(tool.id);
                  return (
                    <div
                      key={tool.id}
                      className="unq-animate-fade-in-up relative"
                      style={{ animationDelay: `${Math.min(index * 30, 600)}ms` }}
                    >
                      <Link href={`/tools/${tool.id}`} className="block group h-full">
                        <div
                          className="card-hover rounded-2xl border bg-card p-6 h-full"
                        >
                          <div className="unq-icon-tile h-10 w-10 rounded-xl flex items-center justify-center mb-3">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <h3 className="font-semibold mb-1 leading-tight">{tool.name}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                            {tool.description}
                          </p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <Badge className="bg-muted text-foreground/80 border-border text-[10px] px-1.5 py-0">
                                {CATEGORY_LABELS[tool.category].split(" ")[0].replace(/[,.;:]$/, "")}
                              </Badge>
                              {tool.status === "planned" && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
                                  Coming Soon
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center text-sm text-primary opacity-0 group-hover:opacity-100 transition-[opacity,transform] duration-200 [transition-timing-function:var(--ease-out)] translate-x-1 group-hover:translate-x-0">
                              <span>Open</span>
                              <ArrowRight className="h-3.5 w-3.5 ml-1" />
                            </div>
                          </div>
                        </div>
                      </Link>
                      <button
                        type="button"
                        onClick={() => toggle(tool.id)}
                        aria-pressed={fav}
                        aria-label={
                          fav
                            ? `Remove ${tool.name} from favorites`
                            : `Add ${tool.name} to favorites`
                        }
                        title={fav ? "Remove from favorites" : "Add to favorites"}
                        className={`absolute top-4 right-4 z-10 rounded-lg p-1.5 transition-[background-color,color,transform] duration-150 cursor-pointer touch-target ${
                          fav
                            ? "text-amber-500 bg-amber-500/10 hover:bg-amber-500/20"
                            : "text-muted-foreground/50 hover:text-amber-500 hover:bg-amber-500/10"
                        }`}
                      >
                        <Star className={`h-4 w-4 ${fav ? "fill-current" : ""}`} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
