"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
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
} from "lucide-react";
import { TOOLS, countByCategory } from "@/lib/registry";
import { CATEGORY_LABELS, ALL_CATEGORIES, type ToolCategory } from "@/lib/tool";
import { searchTools } from "@/lib/search";

// ===== ANIMATION VARIANTS =====

const sectionVariants = {
  hidden: { opacity: 0, y: 60 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.25, 0.4, 0.25, 1] },
  },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.1 },
  },
};

const staggerItem = {
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
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<ToolCategory | "all">("all");

  const counts = countByCategory();
  const activeCats = ALL_CATEGORIES.filter((c) => (counts[c] ?? 0) > 0);

  const filteredTools = useMemo(() => {
    let list = query.trim() ? searchTools(query, TOOLS, 50).map((r) => r.tool) : Array.from(TOOLS);
    if (activeCategory !== "all") {
      list = list.filter((t) => t.category === activeCategory);
    }
    return list;
  }, [query, activeCategory]);

  return (
    <div className="flex min-h-dvh bg-background">
      <SidebarNav />
      <main className="flex-1 overflow-y-auto overflow-x-hidden pt-14 md:pt-0">
        {/* ===== HERO ===== */}
        <section className="relative section-padding pt-4 pb-16 md:py-24">
          <div className="container mx-auto px-4 md:px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-6"
            >
              <Layers className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm text-foreground font-medium">{TOOLS.length} Tools Available</span>
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
              {TOOLS.length} fast, free, offline-capable browser tools — converters,
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
              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 gap-1">
                <WifiOff className="h-3 w-3" /> Works Offline
              </Badge>
              <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 gap-1">
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
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={`Search ${TOOLS.length} tools…`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9 pr-4 h-12 text-base rounded-xl"
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
                onClick={() => setActiveCategory("all")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  activeCategory === "all"
                    ? "bg-primary text-primary-foreground dark:!bg-[#bb5435] dark:text-white"
                    : "bg-muted text-foreground/80 hover:bg-muted/80 hover:text-foreground"
                }`}
              >
                All ({TOOLS.length})
              </motion.button>
              {activeCats.map((cat) => {
                const Icon = CATEGORY_ICONS[cat] ?? Layers;
                const label = CATEGORY_LABELS[cat].split(" ")[0];
                return (
                  <motion.button
                    key={cat}
                    variants={staggerItem}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeCategory === cat
                        ? "bg-primary text-primary-foreground dark:!bg-[#bb5435] dark:text-white"
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

        {/* ===== TOOLS GRID ===== */}
        <section className="section-padding pb-24">
          <div className="container mx-auto px-4 md:px-6">
            {filteredTools.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-24"
              >
                <Search className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-lg font-medium text-foreground mb-1">No tools found</p>
                <p className="text-sm text-muted-foreground">
                  Try a different search or category.
                </p>
              </motion.div>
            ) : (
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6"
              >
                {filteredTools.map((tool) => {
                  const Icon = CATEGORY_ICONS[tool.category] ?? Wand2;
                  return (
                    <motion.div key={tool.id} variants={staggerItem}>
                      <Link href={`/tools/${tool.id}`} className="block group">
                        <motion.div
                          whileHover={{ y: -6, transition: { duration: 0.25 } }}
                          className="card-hover rounded-2xl border bg-card p-6 h-full transition-colors hover:border-primary/30"
                        >
                          <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mb-3">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <h3 className="font-semibold mb-1">{tool.name}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                            {tool.description}
                          </p>
                          <div className="flex items-center justify-between">
                            <Badge className="bg-muted text-foreground/80 border-border text-[10px] px-1.5 py-0">
                              {CATEGORY_LABELS[tool.category].split(" ")[0]}
                            </Badge>
                            <div className="flex items-center text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                              <span>Open</span>
                              <ArrowRight className="h-3.5 w-3.5 ml-1" />
                            </div>
                          </div>
                        </motion.div>
                      </Link>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
