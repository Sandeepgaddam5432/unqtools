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
} from "lucide-react";

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

const bentoFeatures: BentoFeature[] = [
  {
    id: "pages",
    title: "15+ Pages",
    description: "Pre-built, production-ready pages including dashboards, authentication, settings, and more.",
    content: (
      <div className="bg-gradient-to-br from-primary/20 to-primary/5 mt-4 rounded-xl h-32 w-full flex items-center justify-center">
        <Layers className="h-12 w-12 text-primary/70" />
      </div>
    ),
    className: "col-span-1 md:col-span-3 lg:col-span-2 border-b md:border-r dark:border-neutral-800",
  },
  {
    id: "components",
    title: "30+ Components",
    description: "A rich library of reusable UI components built on shadcn/ui — from data tables to glassmorphism cards.",
    content: (
      <div className="bg-gradient-to-br from-orange-500/20 to-orange-500/5 mt-4 rounded-xl h-32 w-full flex items-center justify-center">
        <Component className="h-12 w-12 text-orange-500/70" />
      </div>
    ),
    className: "col-span-1 md:col-span-3 lg:col-span-2 border-b lg:border-r dark:border-neutral-800",
  },
  {
    id: "dark-mode",
    title: "Dark & Light Mode",
    description: "Seamless theme switching with a stunning dark mode featuring glass effects and terracotta accents.",
    content: (
      <div className="bg-gradient-to-br from-amber-500/20 to-amber-500/5 mt-4 rounded-xl h-32 w-full flex items-center justify-center">
        <MoonStar className="h-12 w-12 text-amber-500/70" />
      </div>
    ),
    className: "col-span-1 md:col-span-6 md:border-b lg:col-span-2 border-b dark:border-neutral-800",
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
    title: "Framer Motion",
    description: "Buttery-smooth animations and transitions powered by Framer Motion. Every interaction feels alive.",
    content: (
      <div className="bg-gradient-to-br from-rose-500/20 to-rose-500/5 mt-4 rounded-xl h-32 w-full flex items-center justify-center">
        <Sparkles className="h-12 w-12 text-rose-500/70" />
      </div>
    ),
    className: "col-span-1 md:col-span-3 lg:col-span-2 md:border-r dark:border-neutral-800",
  },
  {
    id: "ai-tools",
    title: "AI Tools",
    description: "Built-in AI generation studio, API playground, and command palette. The future of development is here.",
    content: (
      <div className="bg-gradient-to-br from-primary/20 to-primary/5 mt-4 rounded-xl h-32 w-full flex items-center justify-center">
        <BrainCircuit className="h-12 w-12 text-primary/70" />
      </div>
    ),
    className: "col-span-1 md:col-span-3 lg:col-span-2 lg:border-r dark:border-neutral-800",
  },
  {
    id: "responsive",
    title: "Responsive Design",
    description: "Pixel-perfect on every screen — from mobile to ultrawide. No compromises, no awkward breakpoints.",
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
    name: "Alex Rivera",
    role: "Full Stack Developer",
    company: "TechForge",
    content: "UnQWebTemplate saved me weeks of development time. The component architecture is clean, the animations are stunning, and the TypeScript support is impeccable.",
    rating: 5,
    avatar: "https://randomuser.me/api/portraits/men/32.jpg",
  },
  {
    id: 2,
    name: "Priya Sharma",
    role: "Frontend Engineer",
    company: "DesignCraft",
    content: "I've tried dozens of Next.js templates, but UnQ stands out for its attention to detail. The terracotta theme is gorgeous and the code quality is top-notch.",
    rating: 5,
    avatar: "https://randomuser.me/api/portraits/women/44.jpg",
  },
  {
    id: 3,
    name: "Marcus Chen",
    role: "Product Manager",
    company: "InnovateLabs",
    content: "Our team launched our MVP in record time thanks to UnQWebTemplate. The pre-built pages and AI tools worked right out of the box.",
    rating: 5,
    avatar: "https://randomuser.me/api/portraits/men/46.jpg",
  },
  {
    id: 4,
    name: "Elena Vasquez",
    role: "UI/UX Designer",
    company: "PixelPerfect",
    content: "The dark mode implementation is the best I've seen in any template. The glassmorphism, the animations, the color palette — everything feels intentional.",
    rating: 5,
    avatar: "https://randomuser.me/api/portraits/women/68.jpg",
  },
];

const glassTestimonials: GlassTestimonial[] = [
  {
    id: 1,
    initials: "AR",
    name: "Alex Rivera",
    role: "Full Stack Developer at TechForge",
    quote: "UnQWebTemplate transformed my workflow. The component library is extensive, the animations are smooth, and the terracotta theme makes every page look premium.",
    tags: [
      { text: "FEATURED", type: "featured" },
      { text: "Enterprise", type: "default" },
    ],
    stats: [
      { icon: () => <Layers className="h-3.5 w-3.5" />, text: "15+ pages" },
      { icon: () => <Sparkles className="h-3.5 w-3.5" />, text: "Animations" },
    ],
    avatarGradient: "linear-gradient(135deg, #c96442, #d97757)",
  },
  {
    id: 2,
    initials: "PS",
    name: "Priya Sharma",
    role: "Frontend Engineer at DesignCraft",
    quote: "The code quality is exceptional. Every component is well-typed, well-documented, and easy to customize. This is how templates should be built.",
    tags: [
      { text: "TypeScript", type: "default" },
      { text: "shadcn/ui", type: "default" },
    ],
    stats: [
      { icon: () => <Component className="h-3.5 w-3.5" />, text: "30+ components" },
      { icon: () => <MonitorSmartphone className="h-3.5 w-3.5" />, text: "Responsive" },
    ],
    avatarGradient: "linear-gradient(135deg, #10b981, #059669)",
  },
  {
    id: 3,
    initials: "EV",
    name: "Elena Vasquez",
    role: "UI/UX Designer at PixelPerfect",
    quote: "As a designer, I'm incredibly picky about templates. UnQWebTemplate nails the details — the glassmorphism, the motion design, the color system.",
    tags: [
      { text: "Design", type: "featured" },
      { text: "Glassmorphism", type: "default" },
    ],
    stats: [
      { icon: () => <MoonStar className="h-3.5 w-3.5" />, text: "Dark mode" },
      { icon: () => <BrainCircuit className="h-3.5 w-3.5" />, text: "AI tools" },
    ],
    avatarGradient: "linear-gradient(135deg, #ec4899, #d946ef)",
  },
];

// ===== SHOWCASE PAGES DATA =====
const showcasePages = [
  {
    href: "/components",
    title: "Components",
    description: "30+ interactive UI components with all variants, sizes, and states.",
    icon: Component,
    gradient: "from-primary/20 to-rose-500/20",
    badge: "Interactive",
  },
  {
    href: "/animations",
    title: "Animations",
    description: "Morphing cards, parallax scroll, spring physics, and stagger effects.",
    icon: Sparkles,
    gradient: "from-amber-500/20 to-orange-500/20",
    badge: "Cinematic",
  },
  {
    href: "/cards",
    title: "Cards",
    description: "Bento grids, glassmorphism, gradient cards, stats, and post cards.",
    icon: CreditCard,
    gradient: "from-emerald-500/20 to-teal-500/20",
    badge: "Beautiful",
  },
  {
    href: "/navigation",
    title: "Navigation",
    description: "Expandable tabs, macOS dock, breadcrumbs, and floating navbars.",
    icon: Navigation,
    gradient: "from-violet-500/20 to-purple-500/20",
    badge: "Smooth",
  },
];

// ===== PAGE COMPONENT =====

export default function Home() {
  return (
    <div className="flex min-h-dvh bg-background">
      <SidebarNav />
      <main className="flex-1 overflow-y-auto overflow-x-hidden pt-16 md:pt-0">
        {/* ===== SECTION 1: CINEMATIC HERO ===== */}
        <section className="relative">
          <HeroGeometric
            badge="UnQWebTemplate"
            title1="Craft Digital"
            title2="Masterpieces"
          />
          {/* Custom CTA overlay */}
          <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center pb-16 md:pb-24">
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.4, duration: 0.8, ease: [0.25, 0.4, 0.25, 1] }}
              className="text-white/40 text-base sm:text-lg max-w-xl text-center mb-8 px-4"
            >
              A premium Next.js 16 template with 15+ pages, 30+ components,
              AI tools, and stunning animations. Built with{" "}
              <Heart className="inline h-4 w-4 text-primary fill-primary" /> by
              Sandeep Gaddam.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.6, duration: 0.8, ease: [0.25, 0.4, 0.25, 1] }}
              className="flex flex-col sm:flex-row items-center gap-4"
            >
              <Button
                asChild
                size="lg"
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-8 text-base cursor-pointer touch-target"
              >
                <Link href="/components">
                  Explore Showcase <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="gap-2 border-white/20 text-white/70 hover:text-white hover:border-white/40 hover:bg-white/5 px-8 text-base cursor-pointer touch-target"
              >
                <Link href="/animations">View Animations</Link>
              </Button>
            </motion.div>
          </div>
        </section>

        {/* ===== SECTION 2: SHOWCASE PAGES QUICK ACCESS ===== */}
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
              <span className="text-sm text-primary font-medium">Showcase Pages</span>
            </motion.div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 tracking-tight text-balance">
              Explore Every Detail
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
              Dive deep into each aspect of UnQWebTemplate — from interactive components
              to cinematic animations and stunning card layouts.
            </p>
          </div>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6"
          >
            {showcasePages.map((page) => {
              const Icon = page.icon;
              return (
                <motion.div key={page.href} variants={staggerItem}>
                  <Link href={page.href} className="block group">
                    <motion.div
                      whileHover={{ y: -6, transition: { duration: 0.25 } }}
                      className="card-hover rounded-2xl border bg-card p-6 h-full transition-colors hover:border-primary/30"
                    >
                      <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${page.gradient} flex items-center justify-center mb-4`}>
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{page.title}</h3>
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] px-1.5 py-0">
                          {page.badge}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{page.description}</p>
                      <div className="mt-4 flex items-center text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                        <span>Explore</span>
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
              A complete toolkit with pre-built pages, rich components, AI
              integration, and cinematic animations — all production-ready.
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
            title="Loved by Developers"
            subtitle="Don't just take our word for it — hear from developers who've shipped production apps with UnQWebTemplate."
            badgeText="Trusted by builders"
            testimonials={testimonials}
            trustedCompanies={["Vercel", "Stripe", "Figma", "Linear", "Notion"]}
            trustedCompaniesTitle="Trusted by developers from leading companies"
          />
        </motion.section>

        {/* ===== SECTION 6: GLASS TESTIMONIAL SWIPER ===== */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={sectionVariants}
          className="relative w-full py-24 section-padding overflow-hidden bg-black"
        >
          <div className="max-w-lg mx-auto text-center mb-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-6"
            >
              <Heart className="h-3.5 w-3.5 text-primary fill-primary" />
              <span className="text-sm text-primary font-medium">Community Voices</span>
            </motion.div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 text-balance">What People Say</h2>
            <p className="text-white/50 text-base text-pretty">Swipe through testimonials from our community</p>
          </div>
          <div className="max-w-lg mx-auto" style={{ minHeight: "350px" }}>
            <TestimonialStack testimonials={glassTestimonials} />
          </div>
        </motion.section>

        {/* ===== SECTION 7: PARTICLE TEXT EFFECT ===== */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={sectionVariants}
          className="section-padding py-24"
        >
          <div className="max-w-4xl mx-auto text-center mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-6"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm text-primary font-medium">Interactive Effects</span>
            </motion.div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 tracking-tight text-balance">
              Mesmerizing Particle Effects
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto text-pretty">
              Canvas-powered particle text that morphs between words in real
              time. Right-click and hold to destroy particles — pure magic.
            </p>
          </div>
          <div className="max-w-4xl mx-auto">
            <ParticleTextEffect words={["UNQ", "WEB", "BUILD", "CREATE", "DESIGN"]} />
          </div>
        </motion.section>

        {/* ===== SECTION 8: CTA SECTION ===== */}
        <motion.section
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={sectionVariants}
          className="section-padding py-24"
        >
          <div className="relative max-w-4xl mx-auto rounded-3xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/10 to-orange-500/10" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(201,100,66,0.15),transparent_70%)]" />
            <div className="absolute inset-0 border border-primary/20 rounded-3xl" />
            <div className="relative px-8 py-16 md:px-16 md:py-20 text-center">
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6 tracking-tight text-balance">
                Ready to Build Something <span className="text-primary">UnQ</span>?
              </h2>
              <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-10 text-pretty">
                Stop building from scratch. Start with a template that&apos;s
                production-ready, beautifully designed, and endlessly customizable.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button
                  asChild
                  size="lg"
                  className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-8 text-base cursor-pointer touch-target"
                >
                  <Link href="/components">
                    Explore Components <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="gap-2 px-8 text-base cursor-pointer touch-target"
                >
                  <Link href="/animations">View Animations</Link>
                </Button>
              </div>
              <p className="mt-8 text-sm text-muted-foreground/60">
                Built with Next.js 16, TypeScript, Tailwind CSS & shadcn/ui
              </p>
            </div>
          </div>
        </motion.section>

        {/* ===== SECTION 9: FOOTER ===== */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={fadeInVariants}
          className="mt-auto"
        >
          <Footer />
        </motion.div>
      </main>
    </div>
  );
}
