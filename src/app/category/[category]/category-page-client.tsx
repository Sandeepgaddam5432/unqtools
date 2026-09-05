"use client";

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
import { type ToolCategory, type ToolManifest } from "@/lib/tool";
import { groupTools } from "@/lib/tool-groups";

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
  const grouped = groupTools(category, tools);

  return (
    <div className="flex min-h-dvh bg-background">
      <SidebarNav />
      <main className="flex-1 overflow-y-auto overflow-x-hidden pt-12 md:pt-0">
        {/* ===== HERO ===== */}
        <section className="relative section-padding pt-2 pb-16 md:py-24">
          <div className="container mx-auto px-4 md:px-6">
            <div
              className="unq-glass inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 mb-6 unq-animate-fade-in-up"
            >
              <Icon className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm text-foreground font-medium">
                {tools.length > 0 ? `${tools.length} tools` : "Coming soon"}
              </span>
            </div>
            <h1
              className="text-4xl sm:text-5xl md:text-6xl font-bold text-foreground mb-4 tracking-tight text-balance unq-animate-fade-in-up"
              style={{ animationDelay: "60ms" }}
            >
              {label}
            </h1>
            <p
              className="text-base sm:text-lg text-muted-foreground max-w-2xl mb-8 text-pretty unq-animate-fade-in-up"
              style={{ animationDelay: "200ms" }}
            >
              {tools.length > 0
                ? `${tools.length} tool${tools.length === 1 ? "" : "s"} in this category — all running 100% in your browser. No uploads, no tracking, no accounts.`
                : `${label} tools are coming soon — and like every UnQTools tool, they will run 100% in your browser. No uploads, no tracking, no accounts.`}
            </p>

            {/* Trust badges */}
            <div
              className="flex flex-wrap items-center gap-3 mb-8 unq-animate-fade-in-up"
              style={{ animationDelay: "300ms" }}
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
            </div>

            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link href="/tools">
                <ArrowLeft className="h-4 w-4" /> All tools
              </Link>
            </Button>
          </div>
        </section>

        {/* ===== GROUP JUMP LINKS ===== */}
        {grouped.length > 1 && (
          <section className="section-padding pb-0 -mt-6">
            <div className="container mx-auto px-4 md:px-6">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                What do you want to do? Jump to a section
              </p>
              <div className="flex flex-wrap gap-2">
                {grouped.map((g) => {
                  const gid = g.group ? g.group.id : "other";
                  const total = g.items.length;
                  const doneCount = g.items.filter((t) => t.status !== "planned").length;
                  return (
                    <a
                      key={gid}
                      href={`#group-${gid}`}
                      className="px-3 py-1.5 rounded-full border bg-card text-xs font-medium text-foreground/80 hover:border-primary/40 hover:text-foreground transition-colors"
                    >
                      {g.group?.label ?? "More tools"}{" "}
                      <span className="text-muted-foreground">
                        ({doneCount} ready{total > doneCount ? ` +${total - doneCount} soon` : ""})
                      </span>
                    </a>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* ===== GROUPED TOOLS ===== */}
        <section className="section-padding pb-24">
          <div className="container mx-auto px-4 md:px-6 space-y-14">
            {tools.length === 0 ? (
              <div className="text-center py-24 unq-animate-fade-in">
                <div className="unq-icon-tile h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
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
              </div>
            ) : (
              grouped.map((g, gi) => {
                const gid = g.group ? g.group.id : "other";
                const doneCount = g.items.filter((t) => t.status !== "planned").length;
                const soonCount = g.items.length - doneCount;
                return (
                  <div key={gid} id={`group-${gid}`} className="scroll-mt-24">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                      <h2 className="text-xl md:text-2xl font-bold text-foreground">
                        {g.group?.label ?? "More tools"}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {doneCount} ready{soonCount > 0 ? ` · ${soonCount} coming soon` : ""}
                      </p>
                    </div>
                    {g.group && (
                      <p className="text-sm text-muted-foreground mb-5">{g.group.blurb}</p>
                    )}
                    {!g.group && (
                      <p className="text-sm text-muted-foreground mb-5">
                        Everything else in this category.
                      </p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                      {g.items.map((tool, index) => {
                        const ToolIcon = CATEGORY_ICONS[tool.category] ?? Layers;
                        return (
                          <div
                            key={tool.id}
                            className="unq-animate-fade-in-up [content-visibility:auto] [contain-intrinsic-size:auto_210px]"
                            style={{ animationDelay: `${Math.min((gi * 7 + index) * 25, 320)}ms` }}
                          >
                            <Link href={`/tools/${tool.id}`} className="block group h-full">
                              <div className="card-hover rounded-2xl border bg-card p-6 h-full transition-all duration-200 hover:border-primary/30">
                                <div className="unq-icon-tile h-10 w-10 rounded-xl flex items-center justify-center mb-3">
                                  <ToolIcon className="h-5 w-5 text-primary" />
                                </div>
                                <h3 className="font-semibold mb-1 leading-tight">{tool.name}</h3>
                                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                                  {tool.description}
                                </p>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
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
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
