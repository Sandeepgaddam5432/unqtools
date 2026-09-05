"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, type Variants } from "framer-motion";
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

// ===== ANIMATION VARIANTS =====

const sectionVariants: Variants = {
  hidden: { opacity: 0, y: 60 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.25, 0.4, 0.25, 1] },
  },
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 },
  },
};

const staggerItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" },
  },
};

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
  return <ToolsPageContent />;
}

type ViewFilter = ToolCategory | "all" | "favorites" | "recent" | "ready";

function ToolsPageContent() {
  const [query, setQuery] = useState("");
  const [activeView, setActiveView] = useState<ViewFilter>("ready");

  // Apply ?q= / ?view= deep links after mount. Reading them via useSearchParams
  // during render would bail the whole grid out of static prerendering
  // (LCP regression); window.location keeps initial paint server-rendered.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const q = sp.get("q");
    if (q) setQuery(q);
    const v = sp.get("view");
    if (v === "favorites" || v === "recent" || v === "ready") setActiveView(v);
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

  // ===== RENDER WINDOWING =====
  // Rendering all 1,679 cards at once costs ~7s of main-thread work on
  // mobile (Lighthouse TBT). Render the first batch only, then grow on
  // demand. content-visibility:auto on each card skips off-screen paint.
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
    <div className="flex min-h-dvh bg-background">
      <SidebarNav />
      <main className="flex-1 overflow-y-auto overflow-x-hidden pt-12 md:pt-0">
        {/* ===== HERO ===== */}
        <section className="relative section-padding pt-2 pb-16 md:py-24">
          <div className="container mx-auto px-4 md:px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-6"
            >
              <Layers className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm text-foreground font-medium">{CATALOG.length} Tools Available</span>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.25, 0.4, 0.25, 1] }}
              className="text-4xl sm:text-5xl md:text-6xl font-bold text-foreground mb-4 tracking-tight text-balance"
            >
              Every tool you need,
              <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-amber-500 to-primary">
                all in your browser
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-base sm:text-lg text-muted-foreground max-w-2xl mb-8 text-pretty"
            >
              {CATALOG.length} fast, free, offline-capable browser tools — converters,
              calculators, generators, formatters. No uploads, no tracking, no accounts.
            </motion.p>

            {/* Trust badges */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="flex flex-wrap items-center gap-3 mb-8"
            >
              <Badge className="bg-primary/15 text-foreground border-primary/20 gap-1">
                <Lock className="h-3 w-3" /> 100% Private
              </Badge>
              <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 gap-1">
                <WifiOff className="h-3 w-3" /> Works Offline
              </Badge>
              <Badge className="bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-500/20 gap-1">
                <Zap className="h-3 w-3" /> Instant
              </Badge>
            </motion.div>

            {/* Search */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="max-w-xl"
            >
              <div className="unq-glass relative flex items-center rounded-2xl border border-border bg-card/60 shadow-lg shadow-black/[0.04] transition-all duration-200 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={`What do you want to do? e.g. “make my PDF smaller”`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-12 w-full border-0 bg-transparent pl-10 pr-4 text-base rounded-2xl focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
            </motion.div>
          </div>
        </section>

        {/* ===== CATEGORY FILTERS ===== */}
        <section className="section-padding pb-8">
          <div className="container mx-auto px-4 md:px-6">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="flex flex-wrap gap-2"
            >
              <motion.button
                variants={staggerItem}
                onClick={() => setActiveView("favorites")}
                aria-pressed={activeView === "favorites"}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer flex items-center gap-1.5 touch-target ${
                  activeView === "favorites"
                    ? "bg-gradient-to-r from-primary to-amber-500 text-primary-foreground shadow-md shadow-primary/25"
                    : "bg-muted text-foreground/80 hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                <Star className={`h-3.5 w-3.5 ${activeView === "favorites" ? "fill-current" : ""}`} />
                Favorites ({favorites.length})
              </motion.button>
              <motion.button
                variants={staggerItem}
                onClick={() => setActiveView("recent")}
                aria-pressed={activeView === "recent"}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer flex items-center gap-1.5 touch-target ${
                  activeView === "recent"
                    ? "bg-gradient-to-r from-primary to-amber-500 text-primary-foreground shadow-md shadow-primary/25"
                    : "bg-muted text-foreground/80 hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                Recent ({recent.length})
              </motion.button>
              <motion.button
                variants={staggerItem}
                onClick={() => setActiveView("ready")}
                aria-pressed={activeView === "ready"}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer touch-target ${
                  activeView === "ready"
                    ? "bg-gradient-to-r from-primary to-amber-500 text-primary-foreground shadow-md shadow-primary/25"
                    : "bg-muted text-foreground/80 hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                Ready now ({readyCount})
              </motion.button>
              <motion.button
                variants={staggerItem}
                onClick={() => setActiveView("all")}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer touch-target ${
                  activeView === "all"
                    ? "bg-gradient-to-r from-primary to-amber-500 text-primary-foreground shadow-md shadow-primary/25"
                    : "bg-muted text-foreground/80 hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                All ({CATALOG.length})
              </motion.button>
              {activeCats.map((cat) => {
                const Icon = CATEGORY_ICONS[cat] ?? Layers;
                // Strip trailing comma/punctuation for short label (e.g. "Network," → "Network")
                const label = CATEGORY_LABELS[cat].split(" ")[0].replace(/[,.;:]$/, "");
                return (
                  <motion.button
                    key={cat}
                    variants={staggerItem}
                    onClick={() => setActiveView(cat)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer flex items-center gap-1.5 touch-target ${
                      activeView === cat
                        ? "bg-gradient-to-r from-primary to-amber-500 text-primary-foreground shadow-md shadow-primary/25"
                        : "bg-muted text-foreground/80 hover:bg-muted/80 hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label} ({counts[cat] ?? 0})
                  </motion.button>
                );
              })}
            </motion.div>
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
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-24"
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
              </motion.div>
            ) : (
              // CSS-based animation — bulletproof, no JS dependency, no hydration
              // issues. Each card gets a staggered animation-delay via inline style.
              // This replaces the old framer-motion whileInView pattern which
              // failed when switching category tabs (new cards stayed invisible).
              <div
                key={`${activeView}-${query}`}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6"
              >
                {visibleTools.map((tool, index) => {
                  const Icon = CATEGORY_ICONS[tool.category] ?? Wand2;
                  const fav = isFavorite(tool.id);
                  return (
                    <div
                      key={tool.id}
                      className="unq-animate-fade-in-up relative [content-visibility:auto] [contain-intrinsic-size:auto_210px]"
                      style={{ animationDelay: `${Math.min(index * 30, 320)}ms` }}
                    >
                      <Link href={`/tools/${tool.id}`} className="block group h-full">
                        <div
                          className="card-hover rounded-2xl border bg-card p-6 h-full transition-all duration-200 hover:border-primary/30"
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
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
                                  Coming Soon
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center text-sm text-primary opacity-0 group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0">
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
                        className={`absolute top-4 right-4 z-10 rounded-lg p-1.5 transition-all cursor-pointer touch-target ${
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

            {/* Load-more: grow the render window instead of painting 1,679
                cards upfront. Keeps main-thread work small on first paint. */}
            {remainingCount > 0 && filteredTools.length > 0 && (
              <div className="flex justify-center mt-8">
                <Button
                  variant="outline"
                  size="lg"
                  className="gap-2 cursor-pointer touch-target"
                  onClick={() => setVisibleCount((c) => c + 192)}
                >
                  Show more tools ({remainingCount.toLocaleString()} remaining)
                </Button>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
