"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SidebarNav } from "@/components/navigation/sidebar";
import { Footer } from "@/components/ui/footer-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Zap,
  ShieldCheck,
  WifiOff,
  Lock,
  Code2,
  Type,
  Calculator,
  Image as ImageIcon,
  Layers,
  FileText,
  Globe,
  Sparkles,
  Search,
  Cpu,
  Database,
} from "lucide-react";
import { CATEGORY_COUNTS, TOOL_COUNT } from "@/lib/counts";
import { type ToolCategory } from "@/lib/tool";

// ===== DATA =====
// Home page intentionally does NOT import the 1700-item tool catalog.
// It only needs a total count + per-category counts + 8 hand-picked
// featured tools — all inlined below (tiny, parse-once). This keeps the
// landing page bundle small and free of a long main-thread catalog parse.

const toolCount = TOOL_COUNT;
const counts = CATEGORY_COUNTS;

// ===== CATEGORY CARDS (all categories with tools) =====
const allCategoryCards: {
  href: string;
  title: string;
  description: string;
  icon: typeof Code2;
  count: number;
}[] = [
  {
    href: "/category/seo",
    title: "SEO & Marketing",
    description: "Keyword research, schema generators, backlink analyzers, rank trackers, technical SEO audits.",
    icon: Globe,
    count: counts.seo ?? 0,
  },
  {
    href: "/category/business",
    title: "Business & Productivity",
    description: "Invoices, quotes, payroll, tax calculators, project trackers, contract templates.",
    icon: FileText,
    count: counts.business ?? 0,
  },
  {
    href: "/category/file",
    title: "File Management",
    description: "Hash checkers, metadata viewers, CSV tools, archive extractors, duplicate finders.",
    icon: Layers,
    count: counts.file ?? 0,
  },
  {
    href: "/category/pdf",
    title: "PDF & Documents",
    description: "Merge, split, compress, edit PDFs. Convert to/from HTML, Markdown, images.",
    icon: FileText,
    count: counts.pdf ?? 0,
  },
  {
    href: "/category/audio-video",
    title: "Audio & Video",
    description: "Trim, merge, convert, normalize audio. Video compressor, frame extractor, metadata editor.",
    icon: Layers,
    count: counts["audio-video"] ?? 0,
  },
  {
    href: "/category/text",
    title: "Text & Writing",
    description: "Case conversion, diff checker, ciphers, formatters, converters for any text format.",
    icon: Type,
    count: counts.text ?? 0,
  },
  {
    href: "/category/developer",
    title: "Developer & Code",
    description: "JSON formatter, Base64, hash generator, UUID, URL encoder — dev essentials.",
    icon: Code2,
    count: counts.developer ?? 0,
  },
  {
    href: "/category/calculators",
    title: "Calculators",
    description: "EMI, mortgage, SIP — full amortization schedules with CSV export.",
    icon: Calculator,
    count: counts.calculators ?? 0,
  },
  {
    href: "/category/image",
    title: "Image & Graphics",
    description: "Color picker, image compressor with bulk ZIP download, format converters.",
    icon: ImageIcon,
    count: counts.image ?? 0,
  },
  {
    href: "/category/network-security",
    title: "Network, Security & Privacy",
    description: "Password generator, JWT decoder, bcrypt hasher, TOTP, CSP evaluator, URL parser.",
    icon: ShieldCheck,
    count: counts["network-security"] ?? 0,
  },
].filter((c) => c.count > 0);

// ===== TRUST BADGES (concise, factual) =====
const trustBadges = [
  { icon: Lock, label: "100% Client-Side" },
  { icon: WifiOff, label: "Works Offline" },
  { icon: Zap, label: "No Sign-up" },
  { icon: ShieldCheck, label: "No Tracking" },
];

// ===== FEATURED TOOLS (most-used, hand-picked — inlined, no catalog import) =====
const featuredTools: {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  status: "done" | "planned" | "beta";
}[] = [
  {
    id: "json-formatter",
    name: "JSON Formatter",
    description: "Format, validate, minify, and sort JSON — fully in your browser.",
    category: "developer",
    status: "done",
  },
  {
    id: "uuid-generator",
    name: "UUID Generator",
    description: "Generate RFC 4122 v4 UUIDs in bulk, with optional hyphens, uppercase, and prefix options.",
    category: "developer",
    status: "done",
  },
  {
    id: "password-generator",
    name: "Password Generator",
    description: "Generate cryptographically-secure passwords, EFF passphrases, pronounceable passwords, PINs, and Diceware.",
    category: "network-security",
    status: "done",
  },
  {
    id: "color-picker",
    name: "Color Picker & Converter",
    description: "Pick colors and convert between HEX, RGB, HSL, and HSV with WCAG contrast checking.",
    category: "image",
    status: "done",
  },
  {
    id: "base64",
    name: "Base64 Encoder / Decoder",
    description: "Encode text or files to Base64, or decode Base64 back to text — UTF-8 safe with URL-safe variant.",
    category: "developer",
    status: "done",
  },
  {
    id: "hash-generator",
    name: "Hash Generator",
    description: "Generate SHA-1, SHA-256, SHA-384, and SHA-512 hashes with hex and Base64 output via Web Crypto.",
    category: "developer",
    status: "done",
  },
  {
    id: "qr-code-generator-image",
    name: "QR Code Generator",
    description: "Generate QR codes as images for URL, text, WiFi, vCard, SMS, email with custom colors and logo.",
    category: "image",
    status: "done",
  },
  {
    id: "word-character-counter",
    name: "Word & Character Counter",
    description: "Live, Unicode-correct word, character, sentence, paragraph, and line counts with reading time.",
    category: "text",
    status: "done",
  },
];

// ===== CATEGORY ICONS =====
const CATEGORY_ICONS: Record<ToolCategory, typeof Code2> = {
  developer: Code2,
  text: Type,
  calculators: Calculator,
  image: ImageIcon,
  pdf: Layers,
  "audio-video": Layers,
  seo: Globe,
  "network-security": Lock,
  file: Database,
  business: FileText,
  education: Sparkles,
  social: Globe,
  ai: Cpu,
};

// ===== STATS =====
const stats = [
  { label: "Tools", value: toolCount, suffix: "" },
  { label: "Categories", value: allCategoryCards.length, suffix: "" },
  { label: "Tests", value: "41.3K", suffix: "" },
  { label: "Privacy", value: 100, suffix: "%" },
];

// ===== PAGE COMPONENT =====

export default function Home() {
  const router = useRouter();
  const [heroQuery, setHeroQuery] = useState("");

  const submitHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = heroQuery.trim();
    router.push(q ? `/tools?q=${encodeURIComponent(q)}` : "/tools");
  };

  return (
    <div className="flex min-h-dvh bg-background">
      <SidebarNav />
      <main className="flex-1 overflow-y-auto overflow-x-hidden pt-12 md:pt-0">
        {/* ===== SECTION 1: HERO ===== */}
        <section className="relative section-padding pt-16 pb-20 md:pt-24 md:pb-32 overflow-hidden">
          {/* Ambient gradient background with soft glow orbs */}
          <div className="absolute inset-0 -z-10" aria-hidden="true">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.07] via-transparent to-transparent" />
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[640px] h-[640px] rounded-full bg-primary/15 blur-3xl opacity-40" />
            <div className="absolute top-32 -left-24 w-72 h-72 rounded-full bg-amber-400/10 blur-3xl" />
            <div className="absolute top-64 -right-24 w-80 h-80 rounded-full bg-rose-400/10 blur-3xl" />
            {/* Subtle dot grid */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,var(--border)_0.75px,transparent_0)] bg-[size:26px_26px] opacity-[0.35] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_75%)]" />
          </div>

          <div className="container mx-auto px-4 md:px-6 max-w-5xl">
            {/* NOTE: The hero above-the-fold content is intentionally plain
                HTML (no framer-motion / no opacity:0). This makes it visible
                in the SSR HTML immediately, so LCP ≈ FCP on slow connections.
                Below-the-fold sections keep their whileInView animations. */}
            <div className="unq-glass inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 mb-6">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm text-foreground font-medium">
                {toolCount} free browser tools — no signup, no tracking
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 tracking-tight text-balance leading-[1.05]">
              Private tools that{" "}
              <span className="unq-gradient-text">
                respect you
              </span>
            </h1>

            <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mb-8 leading-relaxed text-pretty">
              {toolCount} fast, free, offline-capable browser tools — converters,
              calculators, generators, formatters, PDF utilities, SEO tools. Everything
              runs 100% in your browser. No uploads, no accounts, no tracking.
            </p>

            {/* Hero quick-search */}
            <form
              onSubmit={submitHeroSearch}
              className="max-w-xl mb-8"
            >
              <div className="unq-glass group flex items-center gap-2 rounded-2xl border border-border bg-card/60 pl-3.5 pr-1.5 py-1.5 shadow-lg shadow-black/[0.04] transition-all duration-200 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15">
                <Search className="h-5 w-5 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  value={heroQuery}
                  onChange={(e) => setHeroQuery(e.target.value)}
                  placeholder={`Search ${toolCount} tools…`}
                  aria-label="Search tools"
                  className="h-11 w-full bg-transparent text-base text-foreground placeholder:text-muted-foreground/70 outline-none"
                />
                <Button
                  type="submit"
                  size="sm"
                  className="gap-1.5 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer"
                >
                  Search
                </Button>
              </div>
            </form>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-10">
              <Button
                asChild
                size="lg"
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-6 text-base cursor-pointer touch-target shadow-lg shadow-primary/20"
              >
                <Link href="/tools">
                  Browse {toolCount} Tools <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="gap-2 px-6 text-base cursor-pointer touch-target"
              >
                <Link href="/category/seo">Explore Categories</Link>
              </Button>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap items-center gap-3 mb-10">
              {trustBadges.map((b) => {
                const Icon = b.icon;
                return (
                  <Badge
                    key={b.label}
                    variant="outline"
                    className="gap-1.5 px-3 py-1 text-xs bg-background/50"
                  >
                    <Icon className="h-3 w-3 text-primary" />
                    {b.label}
                  </Badge>
                );
              })}
            </div>

            {/* Stats strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-8 border-t border-border/60">
              {stats.map((s) => (
                <div key={s.label} className="relative">
                  <div className="unq-gradient-text text-2xl sm:text-3xl font-bold tracking-tight">
                    {s.value}{s.suffix}
                  </div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ===== SECTION 2: FEATURED CATALOG ===== */}
        <section className="section-padding py-16 md:py-20">
          <div className="container mx-auto px-4 md:px-6 max-w-6xl">
            <div
              className="mb-10 flex items-end justify-between gap-4"
            >
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-3">
                  <Zap className="h-3.5 w-3.5 text-primary" />
                  <span className="text-sm text-primary font-medium">Popular</span>
                </div>
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground tracking-tight text-balance">
                  Most-used tools
                </h2>
                <p className="text-sm sm:text-base text-muted-foreground mt-2 max-w-xl">
                  The everyday essentials — all running instantly in your browser.
                </p>
              </div>
              <Link
                href="/tools"
                className="hidden sm:inline-flex items-center gap-1 text-sm text-primary hover:underline whitespace-nowrap"
              >
                View all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5"
            >
              {featuredTools.map((tool) => {
                const Icon = CATEGORY_ICONS[tool.category] ?? Layers;
                return (
                  <div key={tool.id}>
                    <Link href={`/tools/${tool.id}`} className="block group h-full">
                      <div className="card-hover rounded-2xl border bg-card p-5 h-full transition-all duration-200 hover:border-primary/30">
                        <div className="flex items-center justify-between mb-3">
                          <div className="unq-icon-tile h-9 w-9 rounded-lg flex items-center justify-center">
                            <Icon className="h-4.5 w-4.5 text-primary" />
                          </div>
                          {tool.status === "planned" && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
                              Coming Soon
                            </Badge>
                          )}
                        </div>
                        <h3 className="font-semibold text-sm mb-1.5 leading-tight">{tool.name}</h3>
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                          {tool.description}
                        </p>
                        <div className="flex items-center text-xs text-primary opacity-0 group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0">
                          <span>Open</span>
                          <ArrowRight className="h-3 w-3 ml-1" />
                        </div>
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ===== SECTION 3: ALL CATEGORIES ===== */}
        <section className="section-padding py-16 md:py-20 bg-muted/20">
          <div className="container mx-auto px-4 md:px-6 max-w-6xl">
            <div
              className="mb-10 text-center"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-3">
                <Layers className="h-3.5 w-3.5 text-primary" />
                <span className="text-sm text-primary font-medium">Categories</span>
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3 tracking-tight text-balance">
                Browse by category
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
                {toolCount} tools organized across {allCategoryCards.length} categories.
              </p>
            </div>

            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5"
            >
              {allCategoryCards.map((cat) => {
                const Icon = cat.icon;
                return (
                  <div key={cat.href}>
                    <Link
                      href={cat.href}
                      className="block group card-hover rounded-2xl border bg-card p-6 h-full transition-all duration-200 hover:border-primary/30"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="unq-icon-tile h-10 w-10 rounded-lg flex items-center justify-center">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <Badge variant="secondary" className="text-xs tabular-nums">
                          {cat.count}
                        </Badge>
                      </div>
                      <h3 className="font-semibold text-base mb-1.5">{cat.title}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                        {cat.description}
                      </p>
                      <div className="flex items-center text-xs text-primary opacity-0 group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0">
                        <span>Explore</span>
                        <ArrowRight className="h-3 w-3 ml-1" />
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ===== SECTION 4: WHY UNQTOOLS (clean feature grid) ===== */}
        <section className="section-padding py-16 md:py-20">
          <div className="container mx-auto px-4 md:px-6 max-w-5xl">
            <div
              className="mb-10 text-center"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-3">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                <span className="text-sm text-primary font-medium">Why UnQTools</span>
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3 tracking-tight text-balance">
                Built different, by design
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
                Every tool runs locally. Your data never leaves your device.
              </p>
            </div>

            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5"
            >
              {[
                {
                  icon: Lock,
                  title: "100% Private",
                  description: "Every tool runs entirely in your browser. No uploads, no tracking, no accounts. Your data never leaves your device.",
                  color: "text-primary",
                },
                {
                  icon: WifiOff,
                  title: "Works Offline",
                  description: "Install as a PWA and use all tools without network access. Service worker caches everything after first load.",
                  color: "text-emerald-500",
                },
                {
                  icon: Search,
                  title: "No Sign-up",
                  description: "No accounts, no email walls, no paywalls. Just open a tool and use it. Instantly.",
                  color: "text-amber-500",
                },
                {
                  icon: ShieldCheck,
                  title: "No Tracking",
                  description: "No analytics, no cookies, no fingerprinting. What you do with the tools stays between you and your browser.",
                  color: "text-rose-500",
                },
              ].map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.title} className="h-full">
                    <div className="card-hover rounded-2xl border bg-card p-6 h-full transition-all duration-200 hover:border-primary/25">
                      <div className={`unq-icon-tile h-10 w-10 rounded-lg flex items-center justify-center mb-3`}>
                        <Icon className={`h-5 w-5 ${f.color}`} />
                      </div>
                      <h3 className="font-semibold text-base mb-1.5">{f.title}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {f.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ===== SECTION 5: CTA ===== */}
        <section className="section-padding py-16 md:py-20">
          <div className="container mx-auto px-4 md:px-6 max-w-4xl">
            <div
              className="unq-glass relative overflow-hidden rounded-3xl border p-8 md:p-12 text-center"
            >
              <div aria-hidden="true" className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-[520px] rounded-full bg-primary/20 blur-3xl" />
              <h2 className="relative text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3 tracking-tight text-balance">
                Ready to get started?
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground max-w-xl mx-auto mb-6">
                Browse all {toolCount} tools — find the one you need, run it instantly,
                no setup required.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  asChild
                  size="lg"
                  className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-6 text-base cursor-pointer touch-target"
                >
                  <Link href="/tools">
                    Browse all tools <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="gap-2 px-6 text-base cursor-pointer touch-target"
                >
                  <Link href="/category/seo">Start with SEO tools</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* ===== SECTION 6: FOOTER ===== */}
        <Footer />
      </main>
    </div>
  );
}
