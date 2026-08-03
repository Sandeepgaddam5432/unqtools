"use client";

import { motion, type Transition, type Variants } from "framer-motion";
import Link from "next/link";
import { SidebarNav } from "@/components/navigation/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { CATEGORY_LABELS, type ToolCategory, type ToolManifest } from "@/lib/tool";

// ===== ANIMATION CONSTANTS (named, so JSX props stay single-brace) =====

const FADE_UP = { opacity: 0, y: 20 };
const FADE_UP_LG = { opacity: 0, y: 30 };
const SHOWN = { opacity: 1, y: 0 };
const HIDDEN = { opacity: 0 };
const VISIBLE = { opacity: 1 };
const T_BADGE: Transition = { duration: 0.6 };
const T_TITLE: Transition = { duration: 0.8, ease: [0.25, 0.4, 0.25, 1] };
const T_SUBTITLE: Transition = { duration: 0.8, delay: 0.2 };
const T_TRUST: Transition = { duration: 0.8, delay: 0.3 };
const GRID_VIEWPORT = { once: true, margin: "-50px" as const };
const HOVER_LIFT = { y: -6, transition: { duration: 0.25 } };

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

interface CategoryPageClientProps {
  category: ToolCategory;
  label: string;
  tools: ToolManifest[];
}

export function CategoryPageClient({ category, label, tools }: CategoryPageClientProps) {
  const Icon = CATEGORY_ICONS[category] ?? Layers;

  return (
    <div className="flex min-h-dvh bg-background">
      <SidebarNav />
      <main className="flex-1 overflow-y-auto overflow-x-hidden pt-12 md:pt-0">
        {/* ===== HERO ===== */}
        <section className="relative section-padding pt-2 pb-16 md:py-24">
          <div className="container mx-auto px-4 md:px-6">
            <motion.div
              initial={FADE_UP}
              animate={SHOWN}
              transition={T_BADGE}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-6"
            >
              <Icon className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm text-foreground font-medium">
                {tools.length > 0 ? `${tools.length} tools` : "Coming soon"}
              </span>
            </motion.div>
            <motion.h1
              initial={FADE_UP_LG}
              animate={SHOWN}
              transition={T_TITLE}
              className="text-4xl sm:text-5xl md:text-6xl font-bold text-foreground mb-4 tracking-tight text-balance"
            >
              {label}
            </motion.h1>
            <motion.p
              initial={FADE_UP}
              animate={SHOWN}
              transition={T_SUBTITLE}
              className="text-base sm:text-lg text-muted-foreground max-w-2xl mb-8 text-pretty"
            >
              {tools.length > 0
                ? `${tools.length} tool${tools.length === 1 ? "" : "s"} in this category — all running 100% in your browser. No uploads, no tracking, no accounts.`
                : `${label} tools are coming soon — and like every UnQTools tool, they will run 100% in your browser. No uploads, no tracking, no accounts.`}
            </motion.p>

            {/* Trust badges */}
            <motion.div
              initial={FADE_UP}
              animate={SHOWN}
              transition={T_TRUST}
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

            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link href="/tools">
                <ArrowLeft className="h-4 w-4" /> All tools
              </Link>
            </Button>
          </div>
        </section>

        {/* ===== TOOLS GRID ===== */}
        <section className="section-padding pb-24">
          <div className="container mx-auto px-4 md:px-6">
            {tools.length === 0 ? (
              <motion.div initial={HIDDEN} animate={VISIBLE} className="text-center py-24">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-6">
                  <Icon className="h-8 w-8 text-primary" />
                </div>
                <p className="text-2xl font-bold text-foreground mb-2">Coming soon</p>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-8">
                  We&apos;re building {label} tools right now — private, offline-capable,
                  and free, like everything else on UnQTools.
                </p>
                <Button asChild size="sm" className="gap-2">
                  <Link href="/tools">
                    Browse available tools <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </motion.div>
            ) : (
              <div
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6"
              >
                {tools.map((tool, index) => {
                  const ToolIcon = CATEGORY_ICONS[tool.category] ?? Layers;
                  return (
                    <div
                      key={tool.id}
                      className="unq-animate-fade-in-up"
                      style={{ animationDelay: `${Math.min(index * 30, 600)}ms` }}
                    >
                      <Link href={`/tools/${tool.id}`} className="block group">
                        <div
                          className="card-hover rounded-2xl border bg-card p-6 h-full transition-all duration-200 hover:border-primary/30 hover:-translate-y-1"
                        >
                          <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mb-3">
                            <ToolIcon className="h-5 w-5 text-primary" />
                          </div>
                          <h3 className="font-semibold mb-1">{tool.name}</h3>
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
                            <div className="flex items-center text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                              <span>Open</span>
                              <ArrowRight className="h-3.5 w-3.5 ml-1" />
                            </div>
                          </div>
                        </div>
                      </Link>
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
