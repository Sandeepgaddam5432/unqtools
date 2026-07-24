"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
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
import { TOOLS, countByCategory } from "@/lib/registry";
import { CATEGORY_LABELS, type ToolCategory } from "@/lib/tool";

// ===== ANIMATION VARIANTS =====

const sectionVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.25, 0.4, 0.25, 1] as const },
  },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
};

// ===== DATA =====

const toolCount = TOOLS.length;
const counts = countByCategory();

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

// ===== FEATURED TOOLS (most-used, hand-picked) =====
const featuredToolIds = [
  "json-formatter",
  "uuid-generator",
  "password-generator",
  "color-picker",
  "base64",
  "hash-generator",
  "qr-code-generator",
  "word-character-counter",
];
const featuredTools = TOOLS.filter((t) => featuredToolIds.includes(t.id)).slice(0, 8);

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
  { label: "Tests", value: "39.5K", suffix: "" },
  { label: "Privacy", value: 100, suffix: "%" },
];

// ===== PAGE COMPONENT =====

export default function Home() {
  return (
    <div className="flex min-h-dvh bg-background">
      <SidebarNav />
      <main className="flex-1 overflow-y-auto overflow-x-hidden pt-12 md:pt-0">
        {/* ===== SECTION 1: HERO ===== */}
        <section className="relative section-padding pt-16 pb-20 md:pt-24 md:pb-32 overflow-hidden">
          {/* Subtle gradient background */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/10 blur-3xl opacity-30" />
          </div>

          <div className="container mx-auto px-4 md:px-6 max-w-5xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-6"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm text-foreground font-medium">
                {toolCount} free browser tools — no signup, no tracking
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.25, 0.4, 0.25, 1] }}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-foreground mb-6 tracking-tight text-balance leading-[1.05]"
            >
              Private tools that{" "}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-amber-500 to-primary">
                respect you
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.15 }}
              className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mb-8 leading-relaxed text-pretty"
            >
              {toolCount} fast, free, offline-capable browser tools — converters,
              calculators, generators, formatters, PDF utilities, SEO tools. Everything
              runs 100% in your browser. No uploads, no accounts, no tracking.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-10"
            >
              <Button
                asChild
                size="lg"
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-6 text-base cursor-pointer touch-target"
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
            </motion.div>

            {/* Trust badges */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.45 }}
              className="flex flex-wrap items-center gap-3 mb-10"
            >
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
            </motion.div>

            {/* Stats strip */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-8 border-t border-border/60"
            >
              {stats.map((s) => (
                <div key={s.label}>
                  <div className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                    {s.value}{s.suffix}
                  </div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mt-1">
                    {s.label}
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ===== SECTION 2: FEATURED TOOLS ===== */}
        <section className="section-padding py-16 md:py-20">
          <div className="container mx-auto px-4 md:px-6 max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5 }}
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
            </motion.div>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5"
            >
              {featuredTools.map((tool) => {
                const Icon = CATEGORY_ICONS[tool.category] ?? Layers;
                return (
                  <motion.div key={tool.id} variants={staggerItem}>
                    <Link href={`/tools/${tool.id}`} className="block group">
                      <div className="rounded-xl border bg-card p-5 h-full transition-all duration-200 hover:border-primary/30 hover:-translate-y-1 hover:shadow-md">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mb-3">
                          <Icon className="h-4.5 w-4.5 text-primary" />
                        </div>
                        <h3 className="font-semibold text-sm mb-1.5 leading-tight">{tool.name}</h3>
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                          {tool.description}
                        </p>
                        <div className="flex items-center text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                          <span>Open</span>
                          <ArrowRight className="h-3 w-3 ml-1" />
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </section>

        {/* ===== SECTION 3: ALL CATEGORIES ===== */}
        <section className="section-padding py-16 md:py-20 bg-muted/20">
          <div className="container mx-auto px-4 md:px-6 max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5 }}
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
            </motion.div>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5"
            >
              {allCategoryCards.map((cat) => {
                const Icon = cat.icon;
                return (
                  <motion.div key={cat.href} variants={staggerItem}>
                    <Link
                      href={cat.href}
                      className="block group rounded-xl border bg-card p-6 h-full transition-all duration-200 hover:border-primary/30 hover:-translate-y-1 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {cat.count}
                        </Badge>
                      </div>
                      <h3 className="font-semibold text-base mb-1.5">{cat.title}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                        {cat.description}
                      </p>
                      <div className="flex items-center text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>Explore</span>
                        <ArrowRight className="h-3 w-3 ml-1" />
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </section>

        {/* ===== SECTION 4: WHY UNQTOOLS (clean feature grid) ===== */}
        <section className="section-padding py-16 md:py-20">
          <div className="container mx-auto px-4 md:px-6 max-w-5xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5 }}
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
            </motion.div>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
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
                  <motion.div key={f.title} variants={staggerItem}>
                    <div className="rounded-xl border bg-card p-6 h-full">
                      <div className={`h-10 w-10 rounded-lg bg-muted/50 border flex items-center justify-center mb-3`}>
                        <Icon className={`h-5 w-5 ${f.color}`} />
                      </div>
                      <h3 className="font-semibold text-base mb-1.5">{f.title}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {f.description}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </section>

        {/* ===== SECTION 5: CTA ===== */}
        <section className="section-padding py-16 md:py-20">
          <div className="container mx-auto px-4 md:px-6 max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5 }}
              className="rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-card p-8 md:p-12 text-center"
            >
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground mb-3 tracking-tight text-balance">
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
            </motion.div>
          </div>
        </section>

        {/* ===== SECTION 6: FOOTER ===== */}
        <Footer />
      </main>
    </div>
  );
}
