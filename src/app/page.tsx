"use client";

import React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { SidebarNav } from "@/components/navigation/sidebar";
import {
  HeroGeometric,
} from "@/components/ui/shape-landing-hero";
import {
  BentoGridWithFeatures,
  type BentoFeature,
} from "@/components/ui/bento-grid";
import {
  AnimatedTestimonials,
  type Testimonial,
} from "@/components/ui/animated-testimonials";
import {
  TestimonialStack,
  type GlassTestimonial,
} from "@/components/ui/glass-testimonial-swiper";
import { ParticleTextEffect } from "@/components/ui/particle-text-effect";
import { Footer } from "@/components/ui/footer-section";
import FeatureSection from "@/components/ui/stack-feature-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Heart,
  ArrowRight,
  Component,
  Layers,
  MoonStar,
  BrainCircuit,
  MonitorSmartphone,
  CreditCard,
  Navigation,
  Zap,
  Star,
  ShieldCheck,
  WifiOff,
  Lock,
  Wand2,
  Code2,
  Type,
  Calculator,
  Image as ImageIcon,
  Globe,
} from "lucide-react";
import { TOOLS, countByCategory } from "@/lib/registry";
import { CATEGORY_LABELS, type ToolCategory } from "@/lib/tool";

// ===== ANIMATION VARIANTS =====

const sectionVariants = {
  hidden: { opacity: 0, y: 60 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.25, 0.4, 0.25, 1] },
  },
};

const fadeInVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 1, ease: "easeOut" } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

// ===== DATA =====

const toolCount = TOOLS.length;
const counts = countByCategory();

const bentoFeatures: BentoFeature[] = [
  {
    id: "private",
    title: "100% Private",
    description:
      "Every tool runs entirely in your browser. No uploads, no tracking, no accounts. Your data never leaves your device.",
    content: (
      <div className="bg-gradient-to-br from-primary/20 to-primary/5 mt-4 rounded-xl h-32 w-full flex items-center justify-center">
        <Lock className="h-12 w-12 text-primary/70" />
      </div>
    ),
    className: "col-span-1 md:col-span-3 lg:col-span-2 border-b md:border-r dark:border-neutral-800",
  },
  {
    id: "offline",
    title: "Works Offline",
    description:
      "Installable PWA — works without network after first load. All 22 tools available anytime, anywhere.",
    content: (
      <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 mt-4 rounded-xl h-32 w-full flex items-center justify-center">
        <WifiOff className="h-12 w-12 text-emerald-500/70" />
      </div>
    ),
    className: "col-span-1 md:col-span-3 lg:col-span-2 border-b lg:border-r dark:border-neutral-800",
  },
  {
    id: "tools",
    title: `${toolCount} Tools`,
    description:
      "Developer tools, text utilities, calculators, image tools — all in one place. More added regularly.",
    content: (
      <div className="bg-gradient-to-br from-amber-500/20 to-amber-500/5 mt-4 rounded-xl h-32 w-full flex items-center justify-center">
        <Layers className="h-12 w-12 text-amber-500/70" />
      </div>
    ),
    className: "col-span-1 md:col-span-3 lg:col-span-2 border-b lg:border-r-0 dark:border-neutral-800",
  },
  {
    id: "hero-visual",
    title: "",
    description: "",
    content: (
      <div className="bg-gradient-to-r from-primary/10 via-amber-500/10 to-orange-500/10 rounded-xl h-40 w-full relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(201,100,66,0.15),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(217,119,87,0.1),transparent_60%)]" />
      </div>
    ),
    className: "col-span-1 md:col-span-6 lg:col-span-6 border-b lg:border-r-0 dark:border-neutral-800",
  },
  {
    id: "framer-motion",
    title: "Cinematic UI",
    description:
      "Buttery-smooth animations powered by Framer Motion. Every interaction feels alive — calm, not flashy.",
    content: (
      <div className="bg-gradient-to-br from-rose-500/20 to-rose-500/5 mt-4 rounded-xl h-32 w-full flex items-center justify-center">
        <Sparkles className="h-12 w-12 text-rose-500/70" />
      </div>
    ),
    className: "col-span-1 md:col-span-3 lg:col-span-2 md:border-r dark:border-neutral-800",
  },
  {
    id: "ai-tools",
    title: "Open Source Stack",
    description:
      "Built on Next.js 16, React 19, Tailwind 4, shadcn/ui. Modern, fast, accessible, type-safe.",
    content: (
      <div className="bg-gradient-to-br from-primary/20 to-primary/5 mt-4 rounded-xl h-32 w-full flex items-center justify-center">
        <BrainCircuit className="h-12 w-12 text-primary/70" />
      </div>
    ),
    className: "col-span-1 md:col-span-3 lg:col-span-2 lg:border-r dark:border-neutral-800",
  },
  {
    id: "responsive",
    title: "Responsive",
    description:
      "Pixel-perfect on every screen — from 320px phones to 4K ultrawide. No compromises.",
    content: (
      <div className="bg-gradient-to-br from-teal-500/20 to-teal-500/5 mt-4 rounded-xl h-32 w-full flex items-center justify-center">
        <MonitorSmartphone className="h-12 w-12 text-teal-500/70" />
      </div>
    ),
    className: "col-span-1 md:col-span-6 lg:border-r-0 lg:col-span-2 dark:border-neutral-800",
  },
];

const testimonials: Testimonial[] = [
  {
    id: 1,
    name: "Privacy First",
    role: "100% Client-Side",
    company: "UnQTools",
    content:
      "Every tool runs entirely in your browser. No uploads, no tracking, no accounts. Your data never leaves your device — not even for a moment.",
    rating: 5,
    avatar: "https://api.dicebear.com/7.x/shapes/svg?seed=privacy",
  },
  {
    id: 2,
    name: "Works Offline",
    role: "Installable PWA",
    company: "UnQTools",
    content:
      "Install UnQTools as a PWA and use all 22 tools without network access. The service worker caches everything after first load — metro, airplane, anywhere.",
    rating: 5,
    avatar: "https://api.dicebear.com/7.x/shapes/svg?seed=offline",
  },
  {
    id: 3,
    name: "Developer Friendly",
    role: "Open Source Stack",
    company: "UnQTools",
    content:
      "Built on Next.js 16, React 19, Tailwind CSS 4, and shadcn/ui. Every tool has unit-tested logic, strict TypeScript, and zero runtime dependencies on external APIs.",
    rating: 5,
    avatar: "https://api.dicebear.com/7.x/shapes/svg?seed=dev",
  },
  {
    id: 4,
    name: "Accessible",
    role: "WCAG 2.1 AA",
    company: "UnQTools",
    content:
      "Full keyboard navigation, screen-reader support, AA contrast in both light and dark themes, and prefers-reduced-motion respected throughout.",
    rating: 5,
    avatar: "https://api.dicebear.com/7.x/shapes/svg?seed=a11y",
  },
];

const glassTestimonials: GlassTestimonial[] = [
  {
    id: 1,
    initials: "🔒",
    name: "Privacy",
    role: "Your data stays local",
    quote: "The UUID generator and hash generator run entirely in your browser. No ads, no signup, no data collection. Everything stays private — exactly what you need for sensitive work.",
    tags: [
      { text: "100% Private", type: "featured" },
      { text: "No tracking", type: "default" },
    ],
    stats: [
      { icon: Lock, text: "Private" },
      { icon: WifiOff, text: "Offline" },
    ],
    avatarGradient: "linear-gradient(135deg, #f97316, #ef4444)",
  },
  {
    id: 2,
    initials: "📱",
    name: "Offline PWA",
    role: "Install once, use anywhere",
    quote: "Install UnQTools as a PWA and use all 22 tools without network access. The diff checker works as well offline as it does online — no compromise.",
    tags: [
      { text: "Installable", type: "featured" },
      { text: "Service Worker", type: "default" },
    ],
    stats: [
      { icon: ShieldCheck, text: "Secure" },
      { icon: Zap, text: "Fast" },
    ],
    avatarGradient: "linear-gradient(135deg, #ec4899, #d946ef)",
  },
];

// ===== CATEGORY QUICK ACCESS =====
const categoryCards: { href: string; title: string; description: string; icon: typeof Code2; gradient: string; count: number }[] = [
  {
    href: "/category/developer",
    title: "Developer",
    description: "JSON, Base64, hashes, UUIDs, URL encoding — all the dev essentials.",
    icon: Code2,
    gradient: "from-primary/20 to-rose-500/20",
    count: counts.developer ?? 0,
  },
  {
    href: "/category/text",
    title: "Text",
    description: "Case conversion, diff, big text, bold, bubble, CSV, ciphers, and more.",
    icon: Type,
    gradient: "from-amber-500/20 to-orange-500/20",
    count: counts.text ?? 0,
  },
  {
    href: "/category/calculators",
    title: "Calculators",
    description: "EMI, mortgage, SIP — full amortization schedules, CSV export.",
    icon: Calculator,
    gradient: "from-emerald-500/20 to-teal-500/20",
    count: counts.calculators ?? 0,
  },
  {
    href: "/category/image",
    title: "Image",
    description: "Color picker + converter, image compressor with bulk ZIP download.",
    icon: ImageIcon,
    gradient: "from-violet-500/20 to-purple-500/20",
    count: counts.image ?? 0,
  },
];

// ===== FEATURED TOOLS =====
const featuredToolIds = ["json-formatter", "diff-checker", "uuid-generator", "color-picker", "base64", "word-character-counter"];
const featuredTools = TOOLS.filter((t) => featuredToolIds.includes(t.id));

// ===== PAGE COMPONENT =====

export default function Home() {
  return (
    <div className="flex min-h-dvh bg-background">
      <SidebarNav />
      <main className="flex-1 overflow-y-auto overflow-x-hidden pt-14 md:pt-0">
        {/* ===== SECTION 1: CINEMATIC HERO ===== */}
        <section className="relative">
          <HeroGeometric
            badge="UnQTools"
            title1="Private tools"
            title2="that respect you"
            subtitle={`${toolCount} fast, free, offline-capable browser tools — converters, calculators, generators, formatters. No uploads, no tracking, no accounts. Built with ❤ by Sandeep Gaddam.`}
          />
          {/* Custom CTA overlay */}
          <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center pb-16 md:pb-24">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.4, duration: 0.8, ease: [0.25, 0.4, 0.25, 1] }}
              className="flex flex-col sm:flex-row items-center gap-4"
            >
              <Button
                asChild
                size="lg"
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-8 text-base cursor-pointer touch-target"
              >
                <Link href="/tools">
                  Browse {toolCount} Tools <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="gap-2 border-white/20 text-white/70 hover:text-white hover:border-white/40 hover:bg-white/5 bg-transparent px-8 text-base cursor-pointer touch-target"
              >
                <Link href="/category/developer">Browse Categories</Link>
              </Button>
            </motion.div>
          </div>
        </section>

        {/* ===== SECTION 2: CATEGORY QUICK ACCESS ===== */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={sectionVariants}
          className="section-padding py-24"
        >
          <div className="mb-12 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-6"
            >
              <Zap className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm text-primary font-medium">Browse by Category</span>
            </motion.div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 tracking-tight text-balance">
              Find the right tool
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
              {toolCount} tools across 4 categories — all running 100% in your browser.
            </p>
          </div>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6"
          >
            {categoryCards.map((cat) => {
              const Icon = cat.icon;
              return (
                <motion.div key={cat.href} variants={staggerItem}>
                  <Link href={cat.href} className="block group">
                    <motion.div
                      whileHover={{ y: -6, transition: { duration: 0.25 } }}
                      className="card-hover rounded-2xl border bg-card p-6 h-full transition-colors hover:border-primary/30"
                    >
                      <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${cat.gradient} flex items-center justify-center mb-4`}>
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{cat.title}</h3>
                        <Badge className="bg-primary/15 text-foreground border-primary/20 text-[10px] px-1.5 py-0">
                          {cat.count}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{cat.description}</p>
                      <div className="mt-4 flex items-center text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>Browse</span>
                        <ArrowRight className="h-3.5 w-3.5 ml-1" />
                      </div>
                    </motion.div>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        </motion.section>

        {/* ===== SECTION 3: BENTO GRID FEATURES ===== */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={sectionVariants}
          className="section-padding py-12"
        >
          <div className="mb-12 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-6"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm text-primary font-medium">Packed with Features</span>
            </motion.div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 tracking-tight text-balance">
              Everything You Need
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
              A complete toolkit with {toolCount} tools — all private, all
              offline-capable.
            </p>
          </div>
          <BentoGridWithFeatures features={bentoFeatures} />
        </motion.section>

        {/* ===== SECTION 4: STACK FEATURE SECTION ===== */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeInVariants}
          className="section-padding py-12"
        >
          <FeatureSection />
        </motion.section>

        {/* ===== SECTION 5: ANIMATED TESTIMONIALS ===== */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={sectionVariants}
        >
          <AnimatedTestimonials
            title="Why UnQTools"
            subtitle="Privacy, offline access, developer-friendly architecture, and accessibility — the principles that make UnQTools different from every other online tool site."
            badgeText="Built different"
            testimonials={testimonials}
            trustedCompanies={[]}
            trustedCompaniesTitle=""
          />
        </motion.section>

        {/* ===== SECTION 6: FEATURED TOOLS ===== */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={sectionVariants}
          className="section-padding py-24"
        >
          <div className="mb-12 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-6"
            >
              <Wand2 className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm text-primary font-medium">Featured Tools</span>
            </motion.div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 tracking-tight text-balance">
              The everyday essentials
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
              A few of the most-used tools. All run instantly in your browser — no
              signup, no uploads, no waiting.
            </p>
          </div>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
          >
            {featuredTools.map((tool) => (
              <motion.div key={tool.id} variants={staggerItem}>
                <Link href={`/tools/${tool.id}`} className="block group">
                  <motion.div
                    whileHover={{ y: -6, transition: { duration: 0.25 } }}
                    className="card-hover rounded-2xl border bg-card p-6 h-full transition-colors hover:border-primary/30"
                  >
                    <div className="h-10 w-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mb-3">
                      <Wand2 className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-1">{tool.name}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">{tool.description}</p>
                    <div className="mt-4 flex items-center text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                      <span>Open tool</span>
                      <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </div>
                  </motion.div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </motion.section>

        {/* ===== SECTION 7: GLASS TESTIMONIAL SWIPER ===== */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={sectionVariants}
          className="section-padding py-12"
        >
          <TestimonialStack testimonials={glassTestimonials} />
        </motion.section>

        {/* ===== SECTION 8: PARTICLE TEXT EFFECT ===== */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeInVariants}
          className="section-padding py-24"
        >
          <ParticleTextEffect text="PRIVATE" />
        </motion.section>

        {/* ===== SECTION 9: FOOTER ===== */}
        <Footer />
      </main>
    </div>
  );
}
