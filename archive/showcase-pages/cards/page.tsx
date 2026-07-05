"use client";

import React from "react";
import { motion } from "framer-motion";
import { SidebarNav } from "@/components/navigation/sidebar";
import {
  BentoGridWithFeatures,
  type BentoFeature,
} from "@/components/ui/bento-grid";
import FeatureSection from "@/components/ui/stack-feature-section";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { MagicCard } from "@/components/ui/magic-card";
import { Meteors } from "@/components/ui/meteors";
import {
  Sparkles,
  CreditCard,
  TrendingUp,
  Users,
  Eye,
  BarChart3,
  ArrowUpRight,
  Heart,
  MessageCircle,
  Clock,
  Zap,
  Layers,
  Globe,
  Shield,
  Palette,
  Rocket,
  Star,
  BookOpen,
  ImageIcon,
  MousePointerClick,
  MonitorSmartphone,
  BrainCircuit,
  MoonStar,
  Component,
  Wand2,
  Flame,
} from "lucide-react";

// ===== ANIMATION VARIANTS =====
const sectionVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.25, 0.4, 0.25, 1] },
  },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
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

// ===== BENTO FEATURES =====
const bentoFeatures: BentoFeature[] = [
  {
    id: "glass-cards",
    title: "Glassmorphism",
    description: "Frosted glass effects with backdrop blur and translucency for a modern, layered aesthetic.",
    content: (
      <div className="mt-4 rounded-xl h-32 w-full relative overflow-hidden bg-gradient-to-br from-primary/20 to-violet-500/20">
        <div className="absolute inset-2 backdrop-blur-md bg-white/10 dark:bg-white/5 rounded-lg border border-white/20 flex items-center justify-center">
          <span className="text-white/80 text-sm font-medium">Glass Effect</span>
        </div>
      </div>
    ),
    className: "col-span-1 md:col-span-3 lg:col-span-2 border-b md:border-r dark:border-neutral-800",
  },
  {
    id: "gradient-cards",
    title: "Gradient Cards",
    description: "Vibrant gradient backgrounds that make each card pop with color and energy.",
    content: (
      <div className="mt-4 rounded-xl h-32 w-full bg-gradient-to-r from-primary via-rose-500 to-amber-500 flex items-center justify-center">
        <span className="text-white font-bold text-lg">Vibrant</span>
      </div>
    ),
    className: "col-span-1 md:col-span-3 lg:col-span-2 border-b lg:border-r dark:border-neutral-800",
  },
  {
    id: "hover-cards",
    title: "Hover Effects",
    description: "Cards that lift, scale, and glow on hover for engaging interactive feedback.",
    content: (
      <div className="mt-4 flex gap-3 justify-center">
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            whileHover={{ scale: 1.1, y: -8 }}
            className="h-24 w-20 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center cursor-pointer"
          >
            <MousePointerClick className="h-5 w-5 text-primary/60" />
          </motion.div>
        ))}
      </div>
    ),
    className: "col-span-1 md:col-span-6 md:border-b lg:col-span-2 border-b dark:border-neutral-800",
  },
  {
    id: "stats-cards",
    title: "Stats & Metrics",
    description: "Data-rich cards with icons, numbers, and trend indicators for dashboards and analytics.",
    content: (
      <div className="mt-4 grid grid-cols-2 gap-2">
        {[
          { label: "Users", value: "24.5K", icon: Users },
          { label: "Revenue", value: "$89K", icon: TrendingUp },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-lg bg-muted/50 p-3 flex items-center gap-2">
              <Icon className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-sm font-bold">{stat.value}</p>
              </div>
            </div>
          );
        })}
      </div>
    ),
    className: "col-span-1 md:col-span-6 lg:col-span-6 border-b lg:border-r-0 dark:border-neutral-800",
  },
  {
    id: "post-cards",
    title: "Content Cards",
    description: "Blog post and article cards with image placeholders, metadata, and reading time.",
    content: (
      <div className="mt-4 rounded-xl h-32 w-full bg-muted/30 border flex items-center gap-4 p-4">
        <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex-shrink-0 flex items-center justify-center">
          <BookOpen className="h-6 w-6 text-primary/50" />
        </div>
        <div className="flex-1 min-w-0 overflow-x-hidden pt-16 md:pt-0">
          <p className="text-sm font-medium truncate">Getting Started Guide</p>
          <p className="text-xs text-muted-foreground mt-1">5 min read · Tutorial</p>
        </div>
      </div>
    ),
    className: "col-span-1 md:col-span-3 lg:col-span-2 md:border-r dark:border-neutral-800",
  },
  {
    id: "interactive",
    title: "Interactive",
    description: "Cards with buttons, actions, and interactive elements that respond to user input.",
    content: (
      <div className="mt-4 flex gap-2">
        <Button size="sm" className="bg-primary hover:bg-primary/90"><Zap className="h-3 w-3 mr-1" /> Action</Button>
        <Button size="sm" variant="outline">Secondary</Button>
      </div>
    ),
    className: "col-span-1 md:col-span-3 lg:col-span-2 lg:border-r dark:border-neutral-800",
  },
  {
    id: "minimal",
    title: "Minimal Cards",
    description: "Clean, understated cards for when less is more. Elegance through simplicity.",
    content: (
      <div className="mt-4 h-24 rounded-lg border-l-2 border-primary bg-muted/20 flex items-center px-4">
        <p className="text-sm text-muted-foreground italic">Simplicity is the ultimate sophistication.</p>
      </div>
    ),
    className: "col-span-1 md:col-span-6 lg:border-r-0 lg:col-span-2 dark:border-neutral-800",
  },
];

// ===== STATS DATA =====
const statsData = [
  {
    label: "Total Revenue",
    value: "$45,231",
    change: "+20.1%",
    icon: TrendingUp,
    trend: "up" as const,
    color: "from-emerald-500/20 to-emerald-500/5",
    iconColor: "text-emerald-500",
  },
  {
    label: "Active Users",
    value: "2,350",
    change: "+180",
    icon: Users,
    trend: "up" as const,
    color: "from-primary/20 to-primary/5",
    iconColor: "text-primary",
  },
  {
    label: "Page Views",
    value: "12.5K",
    change: "+19%",
    icon: Eye,
    trend: "up" as const,
    color: "from-amber-500/20 to-amber-500/5",
    iconColor: "text-amber-500",
  },
  {
    label: "Conversion",
    value: "3.2%",
    change: "+0.4%",
    icon: BarChart3,
    trend: "up" as const,
    color: "from-violet-500/20 to-violet-500/5",
    iconColor: "text-violet-500",
  },
];

// ===== POST DATA =====
const postData = [
  {
    title: "Building Cinematic UI with Framer Motion",
    excerpt: "Learn how to create stunning animations that bring your Next.js applications to life with spring physics and scroll-triggered effects.",
    category: "Animation",
    readTime: "8 min",
    author: "Sandeep Gaddam",
    authorImg: "https://randomuser.me/api/portraits/men/32.jpg",
    gradient: "from-primary/30 to-rose-500/20",
  },
  {
    title: "The Art of Glassmorphism in Dark Mode",
    excerpt: "Master the delicate balance of backdrop blur, translucency, and border effects to create gorgeous glass cards.",
    category: "Design",
    readTime: "5 min",
    author: "Priya Sharma",
    authorImg: "https://randomuser.me/api/portraits/women/44.jpg",
    gradient: "from-emerald-500/30 to-teal-500/20",
  },
  {
    title: "Terracotta: A Color System Deep Dive",
    excerpt: "How we crafted the warm terracotta palette for UnQWebTemplate and why it works across light and dark modes.",
    category: "Color",
    readTime: "6 min",
    author: "Marcus Chen",
    authorImg: "https://randomuser.me/api/portraits/men/46.jpg",
    gradient: "from-amber-500/30 to-orange-500/20",
  },
];

export default function CardsShowcase() {
  return (
    <div className="flex min-h-dvh bg-background">
      <SidebarNav />
      <main className="flex-1 overflow-y-auto overflow-x-hidden pt-16 md:pt-0">
        {/* Page Header */}
        <div className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-20">
          <div className="section-padding py-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="flex items-center gap-3 mb-3">
                <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
                  <CreditCard className="h-3 w-3 mr-1" /> Card Collection
                </Badge>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
                Card Showcase
              </h1>
              <p className="text-muted-foreground text-base md:text-lg max-w-2xl">
                From bento grids to glassmorphism, every card style you need —
                beautifully designed and endlessly customizable.
              </p>
            </motion.div>
          </div>
        </div>

        <div className="section-padding py-8 space-y-12">
          {/* ===== BENTO GRID SECTION ===== */}
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={sectionVariants}
          >
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-8 touch-target w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Layers className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Bento Grid</h2>
                  <p className="text-muted-foreground text-sm">Flexible grid layout with feature-rich cards</p>
                </div>
              </div>
            </div>
            <BentoGridWithFeatures features={bentoFeatures} />
          </motion.section>

          {/* ===== ORBIT FEATURE SECTION ===== */}
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={sectionVariants}
          >
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-8 touch-target w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Globe className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Orbit Animation</h2>
                  <p className="text-muted-foreground text-sm">Feature section with orbiting tech icons</p>
                </div>
              </div>
            </div>
            <FeatureSection />
          </motion.section>

          {/* ===== GLASSMORPHISM CARDS SECTION ===== */}
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={sectionVariants}
          >
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-8 touch-target w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Glassmorphism Cards</h2>
                  <p className="text-muted-foreground text-sm">Frosted glass effects with backdrop blur and translucency</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  title: "Frosted Glass",
                  description: "Backdrop-blur creates a soft frosted effect that lets underlying colors bleed through beautifully.",
                  icon: Sparkles,
                  gradient: "from-primary/30 to-violet-500/30",
                },
                {
                  title: "Layered Depth",
                  description: "Multiple glass layers stack to create visual depth and hierarchy, perfect for complex dashboards.",
                  icon: Layers,
                  gradient: "from-emerald-500/30 to-teal-500/30",
                },
                {
                  title: "Light Refraction",
                  description: "Border highlights and subtle gradients simulate light refraction through frosted surfaces.",
                  icon: Shield,
                  gradient: "from-amber-500/30 to-rose-500/30",
                },
              ].map((card, i) => {
                const Icon = card.icon;
                return (
                  <motion.div
                    key={i}
                    whileHover={{ y: -6, transition: { duration: 0.25 } }}
                    className="relative group"
                  >
                    {/* Gradient backdrop */}
                    <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${card.gradient} opacity-40 blur-xl group-hover:opacity-60 transition-opacity`} />
                    {/* Glass card */}
                    <div className="relative rounded-2xl border border-white/10 dark:border-white/10 backdrop-blur-xl bg-white/5 dark:bg-white/[0.03] p-6 h-full">
                      <div className="h-12 w-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center mb-4 border border-white/10">
                        <Icon className="h-6 w-6 text-white/80" />
                      </div>
                      <h3 className="text-lg font-semibold text-white mb-2">{card.title}</h3>
                      <p className="text-white/50 text-sm leading-relaxed">{card.description}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.section>

          {/* ===== GRADIENT CARDS SECTION ===== */}
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={sectionVariants}
          >
            <Card className="overflow-hidden border-border/50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-8 touch-target w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Palette className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Gradient Cards</CardTitle>
                    <CardDescription>Cards with vibrant gradient backgrounds for maximum visual impact</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {[
                    { title: "Terracotta", gradient: "from-[#c96442] to-[#d97757]", icon: Rocket },
                    { title: "Emerald", gradient: "from-emerald-500 to-teal-600", icon: Globe },
                    { title: "Sunset", gradient: "from-orange-500 to-rose-600", icon: Star },
                    { title: "Ocean", gradient: "from-cyan-500 to-blue-600", icon: Shield },
                  ].map((card, i) => {
                    const Icon = card.icon;
                    return (
                      <motion.div
                        key={i}
                        whileHover={{ scale: 1.03, rotate: 1, transition: { duration: 0.2 } }}
                        className={`rounded-2xl bg-gradient-to-br ${card.gradient} p-6 text-white relative overflow-hidden cursor-pointer`}
                      >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-12 translate-x-12" />
                        <Icon className="h-8 touch-target w-8 mb-4 opacity-80" />
                        <h3 className="text-lg font-bold">{card.title}</h3>
                        <p className="text-white/70 text-sm mt-1">Gradient card</p>
                      </motion.div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.section>

          {/* ===== HOVER EFFECT CARDS SECTION ===== */}
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={sectionVariants}
          >
            <Card className="overflow-hidden border-border/50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-8 touch-target w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <MousePointerClick className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Hover Effect Cards</CardTitle>
                    <CardDescription>Interactive cards that respond to hover with lift, scale, and glow effects</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[
                    {
                      title: "Lift Effect",
                      description: "Cards gently rise on hover with a soft shadow, creating a sense of elevation and depth.",
                      icon: ArrowUpRight,
                      effect: "lift" as const,
                    },
                    {
                      title: "Scale Effect",
                      description: "Cards smoothly scale up on hover, drawing attention to the focused element.",
                      icon: Zap,
                      effect: "scale" as const,
                    },
                    {
                      title: "Glow Effect",
                      description: "A subtle glow appears on hover, highlighting the card with a warm terracotta aura.",
                      icon: Sparkles,
                      effect: "glow" as const,
                    },
                  ].map((card, i) => {
                    const Icon = card.icon;
                    const hoverProps =
                      card.effect === "lift"
                        ? { y: -8, boxShadow: "0 20px 40px rgba(201,100,66,0.15)" }
                        : card.effect === "scale"
                        ? { scale: 1.05 }
                        : { boxShadow: "0 0 30px rgba(201,100,66,0.2)" };
                    return (
                      <motion.div
                        key={i}
                        whileHover={{
                          ...hoverProps,
                          transition: { duration: 0.25 },
                        }}
                        className="rounded-2xl border bg-card p-6 cursor-pointer transition-colors hover:border-primary/30"
                      >
                        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                          <Icon className="h-6 w-6 text-primary" />
                        </div>
                        <h3 className="font-semibold mb-2">{card.title}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed text-pretty">{card.description}</p>
                      </motion.div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.section>

          {/* ===== POST CARDS SECTION ===== */}
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={sectionVariants}
          >
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-8 touch-target w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BookOpen className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Post Cards</h2>
                  <p className="text-muted-foreground text-sm">Blog post and article cards with rich content layouts</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {postData.map((post, i) => (
                <motion.article
                  key={i}
                  whileHover={{ y: -6, transition: { duration: 0.25 } }}
                  className="rounded-2xl border bg-card overflow-hidden cursor-pointer group"
                >
                  {/* Image Placeholder */}
                  <div className={`h-48 bg-gradient-to-br ${post.gradient} relative overflow-hidden`}>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <ImageIcon className="h-12 w-12 text-white/30" />
                    </div>
                    <div className="absolute top-4 left-4">
                      <Badge className="bg-black/30 text-white border-0 backdrop-blur-sm">
                        {post.category}
                      </Badge>
                    </div>
                  </div>
                  {/* Content */}
                  <div className="p-5">
                    <h3 className="font-semibold mb-2 group-hover:text-primary transition-colors line-clamp-2">
                      {post.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {post.excerpt}
                    </p>
                    <Separator className="mb-4" />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 touch-target w-7">
                          <AvatarImage src={post.authorImg} alt={post.author} />
                          <AvatarFallback className="text-[10px]">{post.author.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-muted-foreground">{post.author}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {post.readTime}
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart className="h-3 w-3" /> {Math.floor(Math.random() * 200 + 50)}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>
          </motion.section>

          {/* ===== STATS CARDS SECTION ===== */}
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={sectionVariants}
          >
            <Card className="overflow-hidden border-border/50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-8 touch-target w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BarChart3 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Stats Cards</CardTitle>
                    <CardDescription>Data-rich metric cards with icons, values, and trend indicators</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <motion.div
                  variants={staggerContainer}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
                >
                  {statsData.map((stat, i) => {
                    const Icon = stat.icon;
                    return (
                      <motion.div
                        key={i}
                        variants={staggerItem}
                        whileHover={{ y: -4, transition: { duration: 0.2 } }}
                        className="rounded-xl border bg-card p-5"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                            <Icon className={`h-5 w-5 ${stat.iconColor}`} />
                          </div>
                          <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 text-xs">
                            <ArrowUpRight className="h-3 w-3 mr-0.5" /> {stat.change}
                          </Badge>
                        </div>
                        <p className="text-2xl font-bold">{stat.value}</p>
                        <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </CardContent>
            </Card>
          </motion.section>

          {/* ===== ADDITIONAL CARD STYLES ===== */}
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={sectionVariants}
          >
            <Card className="overflow-hidden border-border/50 bg-gradient-to-br from-primary/5 via-transparent to-primary/5">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-8 touch-target w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Component className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle>More Card Styles</CardTitle>
                    <CardDescription>Icon cards, accent cards, and notification cards</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Icon Card */}
                  <motion.div
                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                    className="rounded-xl border bg-card p-6 flex items-start gap-4"
                  >
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Zap className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Icon Card</h3>
                      <p className="text-sm text-muted-foreground">
                        Lead with an icon to visually categorize content. Great for feature lists and tool cards.
                      </p>
                    </div>
                  </motion.div>

                  {/* Accent Card */}
                  <motion.div
                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                    className="rounded-xl border-l-4 border-l-primary bg-card p-6"
                  >
                    <h3 className="font-semibold mb-1">Accent Border Card</h3>
                    <p className="text-sm text-muted-foreground">
                      A colored left border draws the eye and creates visual hierarchy without overwhelming the layout.
                    </p>
                  </motion.div>

                  {/* Notification Card */}
                  <motion.div
                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                    className="rounded-xl border bg-card p-5 flex items-center gap-4"
                  >
                    <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">New update available</p>
                      <p className="text-xs text-muted-foreground">Version 2.4.0 includes 12 new components</p>
                    </div>
                    <Button variant="ghost" size="sm">View</Button>
                  </motion.div>

                  {/* Quote Card */}
                  <motion.div
                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                    className="rounded-xl border bg-card p-6 relative"
                  >
                    <span className="absolute top-3 left-4 text-4xl text-primary/20 font-serif">&ldquo;</span>
                    <p className="text-sm text-muted-foreground italic pl-6 pt-3">
                      Good design is obvious. Great design is transparent. These cards make great design effortless.
                    </p>
                    <p className="text-xs text-primary mt-3 pl-6">— Sandeep Gaddam</p>
                  </motion.div>
                </div>
              </CardContent>
            </Card>
          </motion.section>

          {/* Magic Cards */}
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={sectionVariants}
          >
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-8 touch-target w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Wand2 className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Magic Cards</h2>
                  <p className="text-muted-foreground text-sm">Animated gradient cards with mouse tracking</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <MagicCard
                className="cursor-pointer rounded-2xl"
                gradientFrom="#c96442"
                gradientTo="#d97757"
                gradientSize={300}
              >
                <div className="p-6 flex flex-col justify-between min-h-[220px]">
                  <div>
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                      <Zap className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-lg font-bold mb-2">Terracotta Glow</h3>
                    <p className="text-sm text-muted-foreground">Mouse-tracking gradient in the signature terracotta color palette.</p>
                  </div>
                  <Badge variant="outline" className="w-fit text-xs border-primary/30 text-primary">
                    Primary
                  </Badge>
                </div>
              </MagicCard>
              <MagicCard
                className="cursor-pointer rounded-2xl"
                gradientFrom="#10b981"
                gradientTo="#059669"
                gradientSize={300}
              >
                <div className="p-6 flex flex-col justify-between min-h-[220px]">
                  <div>
                    <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4">
                      <Globe className="h-5 w-5 text-emerald-500" />
                    </div>
                    <h3 className="text-lg font-bold mb-2">Emerald Wave</h3>
                    <p className="text-sm text-muted-foreground">Fresh emerald gradient that follows your cursor movement.</p>
                  </div>
                  <Badge variant="outline" className="w-fit text-xs border-emerald-500/30 text-emerald-500">
                    Emerald
                  </Badge>
                </div>
              </MagicCard>
              <MagicCard
                className="cursor-pointer rounded-2xl"
                gradientFrom="#ec4899"
                gradientTo="#d946ef"
                gradientSize={300}
              >
                <div className="p-6 flex flex-col justify-between min-h-[220px]">
                  <div>
                    <div className="h-10 w-10 rounded-xl bg-rose-500/10 flex items-center justify-center mb-4">
                      <Star className="h-5 w-5 text-rose-500" />
                    </div>
                    <h3 className="text-lg font-bold mb-2">Rose Aurora</h3>
                    <p className="text-sm text-muted-foreground">Vibrant rose-to-fuchsia gradient with smooth tracking.</p>
                  </div>
                  <Badge variant="outline" className="w-fit text-xs border-rose-500/30 text-rose-500">
                    Rose
                  </Badge>
                </div>
              </MagicCard>
            </div>
          </motion.section>

          {/* Cards with Meteors */}
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={sectionVariants}
          >
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-8 touch-target w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Flame className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Cards with Meteors</h2>
                  <p className="text-muted-foreground text-sm">Card components with meteor shower overlay effects</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="relative rounded-2xl border border-white/10 bg-black p-8 overflow-hidden min-h-[260px]">
                <Meteors number={12} />
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Rocket className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Launch Ready</h3>
                      <p className="text-xs text-white/40">Deploy in seconds</p>
                    </div>
                  </div>
                  <p className="text-sm text-white/60 mb-4 max-w-sm">
                    Production-grade deployment with edge runtime, auto-scaling, and zero-config CI/CD pipelines.
                  </p>
                  <div className="flex gap-2">
                    <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">Vercel</Badge>
                    <Badge className="bg-white/10 text-white/60 border-white/10 text-xs">Edge</Badge>
                  </div>
                </div>
              </div>
              <div className="relative rounded-2xl border border-white/10 bg-black p-8 overflow-hidden min-h-[260px]">
                <Meteors number={20} minDelay={0.1} maxDelay={0.5} minDuration={2} maxDuration={6} />
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                      <BrainCircuit className="h-5 w-5 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">AI Powered</h3>
                      <p className="text-xs text-white/40">Intelligent automation</p>
                    </div>
                  </div>
                  <p className="text-sm text-white/60 mb-4 max-w-sm">
                    Built-in AI capabilities with streaming responses, function calling, and multi-modal support.
                  </p>
                  <div className="flex gap-2">
                    <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-xs">GPT-4</Badge>
                    <Badge className="bg-white/10 text-white/60 border-white/10 text-xs">Streaming</Badge>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          {/* Bottom spacing */}
          <div className="h-8" />
        </div>
      </main>
    </div>
  );
}
