"use client";

import React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { SidebarNav } from "@/components/navigation/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Heart,
  Github,
  Twitter,
  Linkedin,
  Mail,
  ExternalLink,
  Sparkles,
  LayoutDashboard,
  Component,
  Wand2,
  CreditCard,
  Navigation,
  FileText,
  Table2,
  MessageSquare,
  Loader2,
  Atom,
  Search,
  CalendarClock,
  Home,
  Star,
  GitFork,
  Code2,
  Zap,
  Globe,
  Shield,
  Layers,
  Palette,
  BookOpen,
} from "lucide-react";

const sectionVariants = {
  hidden: { opacity: 0, y: 50 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.6, ease: "easeOut" },
  }),
};

// Tech stack data
const techStack = [
  {
    name: "Next.js 16",
    description: "React framework with App Router, SSR, and API routes",
    icon: Globe,
    color: "text-white",
    bg: "bg-black",
  },
  {
    name: "TypeScript",
    description: "Strict type safety throughout the entire codebase",
    icon: Code2,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    name: "Tailwind CSS 4",
    description: "Utility-first CSS with custom design tokens",
    icon: Palette,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
  },
  {
    name: "shadcn/ui",
    description: "50+ accessible, composable UI components",
    icon: Layers,
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    name: "Framer Motion",
    description: "Production-ready animations and gestures",
    icon: Sparkles,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
  {
    name: "Prisma ORM",
    description: "Type-safe database client with SQLite",
    icon: Shield,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    name: "Zustand",
    description: "Lightweight state management for client",
    icon: Zap,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    name: "TanStack Query",
    description: "Server state management with caching",
    icon: Table2,
    color: "text-rose-400",
    bg: "bg-rose-500/10",
  },
];

// Pages data
const pages = [
  {
    name: "Landing",
    href: "/",
    icon: Home,
    description: "Stunning landing page with hero, features, and CTA sections",
  },
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "Analytics dashboard with charts, stats, and real-time data",
  },
  {
    name: "AI Tools",
    href: "/tools",
    icon: Wand2,
    description: "AI-powered tools playground with interactive demos",
  },
  {
    name: "Components",
    href: "/components",
    icon: Component,
    description: "Complete shadcn/ui component library showcase",
  },
  {
    name: "Animations",
    href: "/animations",
    icon: Sparkles,
    description: "Framer Motion animations, testimonials, and scroll effects",
  },
  {
    name: "Cards",
    href: "/cards",
    icon: CreditCard,
    description: "Beautiful card variants with hover effects and layouts",
  },
  {
    name: "Navigation",
    href: "/navigation",
    icon: Navigation,
    description: "Nav menus, breadcrumbs, and sidebar components",
  },
  {
    name: "Forms",
    href: "/forms",
    icon: FileText,
    description: "Form components with validation and accessibility",
  },
  {
    name: "Data Display",
    href: "/data-display",
    icon: Table2,
    description: "Tables, charts, and data visualization components",
  },
  {
    name: "Feedback",
    href: "/feedback",
    icon: MessageSquare,
    description: "Alerts, toasts, and user feedback components",
  },
  {
    name: "Loaders",
    href: "/loaders",
    icon: Loader2,
    description: "Loading spinners, skeletons, and progress indicators",
  },
  {
    name: "Effects",
    href: "/effects",
    icon: Atom,
    description: "Visual effects: particles, aurora, glow, glassmorphism",
  },
  {
    name: "Search",
    href: "/search",
    icon: Search,
    description: "Command palette, global search, and filter components",
  },
  {
    name: "Calendar & Clock",
    href: "/calendar-clock",
    icon: CalendarClock,
    description: "Glass calendar, clock, world time, and event scheduler",
  },
  {
    name: "About",
    href: "/about",
    icon: BookOpen,
    description: "This page — the story behind UnQWebTemplate",
  },
];

export default function AboutPage() {
  return (
    <div className="flex min-h-screen">
      <SidebarNav />
      <main className="flex-1 overflow-y-auto">
        {/* ===== CINEMATIC HERO ===== */}
        <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden bg-black">
          {/* Animated background */}
          <motion.div
            className="absolute inset-0"
            animate={{
              background: [
                "radial-gradient(ellipse at 30% 20%, rgba(201,100,66,0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(156,135,245,0.1) 0%, transparent 50%)",
                "radial-gradient(ellipse at 60% 30%, rgba(201,100,66,0.2) 0%, transparent 50%), radial-gradient(ellipse at 30% 70%, rgba(156,135,245,0.15) 0%, transparent 50%)",
                "radial-gradient(ellipse at 30% 20%, rgba(201,100,66,0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(156,135,245,0.1) 0%, transparent 50%)",
              ],
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          />
          {/* Dot grid */}
          <div className="absolute inset-0 opacity-[0.03]">
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="heroDots" x="0" y="0" width="30" height="30" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1" fill="white" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#heroDots)" />
            </svg>
          </div>

          <div className="relative z-10 max-w-4xl mx-auto text-center px-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, ease: "easeOut" }}
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.8 }}
              >
                <Badge
                  variant="outline"
                  className="mb-6 border-primary/30 text-primary bg-primary/10 text-sm px-4 py-1"
                >
                  <Heart className="h-3.5 w-3.5 mr-1.5 fill-primary" />
                  Made with Passion
                </Badge>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.8 }}
                className="text-5xl md:text-7xl lg:text-8xl font-bold text-white mb-6 leading-[1.1]"
              >
                About{" "}
                <span className="bg-gradient-to-r from-primary via-primary/80 to-amber-500 bg-clip-text text-transparent">
                  UnQWeb
                </span>
                <span className="text-white">Template</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.8 }}
                className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed"
              >
                A premium Next.js web template crafted with obsessive attention to
                detail. 15 pages. 50+ components. One vision — to make the web
                beautiful.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.8 }}
                className="flex flex-wrap items-center justify-center gap-3 mt-8"
              >
                <Badge variant="outline" className="border-white/10 text-white/60 bg-white/5">
                  Next.js 16
                </Badge>
                <Badge variant="outline" className="border-white/10 text-white/60 bg-white/5">
                  TypeScript
                </Badge>
                <Badge variant="outline" className="border-white/10 text-white/60 bg-white/5">
                  Tailwind CSS 4
                </Badge>
                <Badge variant="outline" className="border-white/10 text-white/60 bg-white/5">
                  Framer Motion
                </Badge>
              </motion.div>
            </motion.div>
          </div>

          {/* Scroll indicator */}
          <motion.div
            className="absolute bottom-8 left-1/2 -translate-x-1/2"
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="w-5 h-8 rounded-full border border-white/20 flex items-start justify-center p-1.5">
              <div className="w-1 h-2 rounded-full bg-primary" />
            </div>
          </motion.div>
        </section>

        {/* ===== CREATOR SECTION ===== */}
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="py-24 px-6 md:px-12 bg-background"
        >
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-center">
              {/* Avatar - Using real image */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="lg:col-span-2 flex justify-center"
              >
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary to-amber-500 blur-2xl opacity-30 scale-110" />
                  <Avatar className="w-48 h-48 border-4 border-primary/30 shadow-2xl relative">
                    <AvatarImage
                      src="/sandeep.png"
                      alt="Sandeep Gaddam"
                    />
                    <AvatarFallback className="text-4xl font-bold bg-primary/10 text-primary">
                      SG
                    </AvatarFallback>
                  </Avatar>
                  <motion.div
                    className="absolute -bottom-2 -right-2 bg-primary text-primary-foreground rounded-full p-2 shadow-lg"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Heart className="h-4 w-4 fill-current" />
                  </motion.div>
                </div>
              </motion.div>

              {/* Bio */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="lg:col-span-3 space-y-6"
              >
                <div>
                  <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-2">
                    The Creator
                  </p>
                  <h2 className="text-3xl md:text-4xl font-bold">
                    Sandeep Gaddam
                  </h2>
                </div>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  I&apos;m a passionate full-stack developer and UI designer who
                  believes that every pixel matters. UnQWebTemplate is my love
                  letter to the web — a collection of everything I&apos;ve learned
                  about building beautiful, performant, and accessible web
                  applications.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Every animation is hand-tuned. Every color is intentional. Every
                  component is crafted to be both beautiful and functional. This
                  isn&apos;t just a template — it&apos;s a philosophy that the web
                  deserves to be gorgeous.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 border-border/50"
                    asChild
                  >
                    <a
                      href="https://github.com/sandeepgaddam"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Github className="h-4 w-4" />
                      GitHub
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 border-border/50"
                    asChild
                  >
                    <a
                      href="https://twitter.com/sandeepgaddam"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Twitter className="h-4 w-4" />
                      Twitter
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 border-border/50"
                    asChild
                  >
                    <a
                      href="https://linkedin.com/in/sandeepgaddam"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Linkedin className="h-4 w-4" />
                      LinkedIn
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 border-border/50"
                    asChild
                  >
                    <a href="mailto:hello@sandeepgaddam.dev">
                      <Mail className="h-4 w-4" />
                      Email
                    </a>
                  </Button>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.section>

        {/* ===== GITHUB SECTION ===== */}
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="py-24 px-6 md:px-12 bg-muted/30"
        >
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-2">
                  Open Source
                </p>
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  Find Me on <span className="text-primary">GitHub</span>
                </h2>
                <p className="text-muted-foreground max-w-lg mx-auto">
                  I build in public. Check out my projects, contribute, or just say hi.
                </p>
              </motion.div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* GitHub Profile Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <Card className="border-border/30 hover:border-primary/30 transition-all duration-300 group h-full">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center shadow-lg">
                        <Github className="h-7 w-7 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg group-hover:text-primary transition-colors">
                          GitHub Profile
                        </h3>
                        <p className="text-sm text-muted-foreground">@sandeepgaddam</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                      Explore all my open source projects, contributions, and code experiments. Follow me to stay updated on new releases.
                    </p>
                    <Button
                      className="w-full bg-gray-800 hover:bg-gray-700 text-white gap-2"
                      asChild
                    >
                      <a
                        href="https://github.com/sandeepgaddam5432"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Github className="h-4 w-4" />
                        Visit GitHub Profile
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>

              {/* UnQWebTemplate Repo Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.1 }}
              >
                <Card className="border-border/30 hover:border-primary/30 transition-all duration-300 group h-full">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-amber-500 flex items-center justify-center shadow-lg">
                        <Code2 className="h-7 w-7 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg group-hover:text-primary transition-colors">
                          UnQWebTemplate
                        </h3>
                        <p className="text-sm text-muted-foreground">Main Repository</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                      This very project! Star it, fork it, or use it as a starting point for your own premium web applications.
                    </p>
                    <div className="flex gap-3">
                      <Button
                        className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                        asChild
                      >
                        <a
                          href="https://github.com/sandeepgaddam5432/unqwebtemplate"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Star className="h-4 w-4" />
                          Star
                        </a>
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 gap-2 border-border/50"
                        asChild
                      >
                        <a
                          href="https://github.com/sandeepgaddam5432/unqwebtemplate/fork"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <GitFork className="h-4 w-4" />
                          Fork
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* GitHub Gists Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <Card className="border-border/30 hover:border-primary/30 transition-all duration-300 group h-full">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center shadow-lg">
                        <Code2 className="h-7 w-7 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg group-hover:text-primary transition-colors">
                          GitHub Gists
                        </h3>
                        <p className="text-sm text-muted-foreground">Snippets & Utilities</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                      Quick code snippets, utility functions, and micro-solutions I share with the community.
                    </p>
                    <Button
                      variant="outline"
                      className="w-full gap-2 border-border/50"
                      asChild
                    >
                      <a
                        href="https://gist.github.com/sandeepgaddam"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Browse Gists
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Contributions Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                <Card className="border-border/30 hover:border-primary/30 transition-all duration-300 group h-full">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center shadow-lg">
                        <GitFork className="h-7 w-7 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg group-hover:text-primary transition-colors">
                          Contributions
                        </h3>
                        <p className="text-sm text-muted-foreground">Activity & PRs</p>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                      See my recent activity, pull requests, and open source contributions across the ecosystem.
                    </p>
                    <Button
                      variant="outline"
                      className="w-full gap-2 border-border/50"
                      asChild
                    >
                      <a
                        href="https://github.com/sandeepgaddam5432?tab=repositories"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                        View All Repos
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* GitHub Stats Banner */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mt-8"
            >
              <Card className="border-border/30 bg-gradient-to-r from-gray-900/80 via-background to-gray-900/80 overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                    <a
                      href="https://github.com/sandeepgaddam5432"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block hover:scale-105 transition-transform"
                    >
                      <img
                        src="https://github-readme-stats.vercel.app/api?username=sandeepgaddam5432&show_icons=true&theme=dark&hide_border=true&bg_color=00000000&text_color=c9c9c9&icon_color=d97757&title_color=d97757"
                        alt="GitHub Stats"
                        className="w-full max-w-md"
                      />
                    </a>
                    <a
                      href="https://github.com/sandeepgaddam5432"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block hover:scale-105 transition-transform"
                    >
                      <img
                        src="https://github-readme-streak-stats.herokuapp.com/?user=sandeepgaddam5432&theme=dark&hide_border=true&background=00000000&stroke=00000000&ring=d97757&fire=d97757&currLabel=d97757"
                        alt="GitHub Streak"
                        className="w-full max-w-md"
                      />
                    </a>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </motion.section>

        {/* ===== TECH STACK ===== */}
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="py-24 px-6 md:px-12 bg-background"
        >
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-2">
                  Powered By
                </p>
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  Tech Stack
                </h2>
                <p className="text-muted-foreground max-w-lg mx-auto">
                  Built with the most modern and battle-tested technologies in the
                  React ecosystem.
                </p>
              </motion.div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {techStack.map((tech, i) => {
                const Icon = tech.icon;
                return (
                  <motion.div
                    key={tech.name}
                    custom={i}
                    variants={fadeInUp}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                  >
                    <Card className="border-border/30 hover:border-primary/30 transition-all duration-300 group h-full">
                      <CardContent className="p-6">
                        <div
                          className={`w-10 h-10 rounded-xl ${tech.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
                        >
                          <Icon className={`h-5 w-5 ${tech.color}`} />
                        </div>
                        <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                          {tech.name}
                        </h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {tech.description}
                        </p>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.section>

        {/* ===== FEATURES / PAGES ===== */}
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="py-24 px-6 md:px-12 bg-background"
        >
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-2">
                  Explore
                </p>
                <h2 className="text-3xl md:text-4xl font-bold mb-4">
                  15 Pages. Zero Compromise.
                </h2>
                <p className="text-muted-foreground max-w-lg mx-auto">
                  Every page is a showcase of what&apos;s possible when design and
                  engineering work in harmony.
                </p>
              </motion.div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {pages.map((page, i) => {
                const Icon = page.icon;
                return (
                  <motion.div
                    key={page.name}
                    custom={i}
                    variants={fadeInUp}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                  >
                    <Link href={page.href} className="block group">
                      <Card className="border-border/30 hover:border-primary/30 transition-all duration-300 h-full hover:shadow-lg hover:shadow-primary/5">
                        <CardContent className="p-5">
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                              <Icon className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-sm group-hover:text-primary transition-colors flex items-center gap-1.5">
                                {page.name}
                                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </h3>
                              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                {page.description}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.section>

        {/* ===== OPEN SOURCE ===== */}
        <motion.section
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="relative py-24 px-6 md:px-12 bg-black overflow-hidden"
        >
          {/* Background glow */}
          <div className="absolute inset-0">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px]" />
          </div>

          <div className="relative z-10 max-w-3xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <motion.div
                className="inline-flex items-center gap-2 mb-6"
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                <Star className="h-8 w-8 text-primary fill-primary" />
              </motion.div>
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
                Open Source.{" "}
                <span className="text-primary">Forever.</span>
              </h2>
              <p className="text-white/50 text-lg leading-relaxed mb-8">
                UnQWebTemplate is and will always be open source. I believe in
                building in public, sharing knowledge, and empowering developers
                around the world. Your contributions, feedback, and stars are
                what keep this project alive.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <Button
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                  asChild
                >
                  <a
                    href="https://github.com/sandeepgaddam5432/unqwebtemplate"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Github className="h-5 w-5" />
                    Star on GitHub
                  </a>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-2 border-white/20 text-white hover:bg-white/10"
                  asChild
                >
                  <a
                    href="https://github.com/sandeepgaddam5432/unqwebtemplate/fork"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <GitFork className="h-5 w-5" />
                    Fork It
                  </a>
                </Button>
              </div>

              <div className="flex items-center justify-center gap-8 mt-12 text-white/40">
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">15</p>
                  <p className="text-xs">Pages</p>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">50+</p>
                  <p className="text-xs">Components</p>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="text-center">
                  <p className="text-2xl font-bold text-white">∞</p>
                  <p className="text-xs">Possibilities</p>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* ===== FOOTER ===== */}
        <footer className="bg-background border-t border-border/30 py-12 px-6 md:px-12">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="space-y-4"
            >
              <div className="flex items-center justify-center gap-2">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 overflow-hidden">
                  <img src="/logo.svg" alt="UnQ" className="w-full h-full object-cover" />
                </div>
                <h3 className="text-lg font-bold">
                  UnQ<span className="text-primary">Web</span>Template
                </h3>
              </div>
              <p className="text-muted-foreground text-sm">
                A premium Next.js web template showcasing the art of the possible.
              </p>
              <Separator className="max-w-xs mx-auto" />
              <p className="text-sm flex items-center justify-center gap-1.5">
                Built with <Heart className="h-3.5 w-3.5 text-red-500 fill-red-500" /> by{" "}
                <span className="font-semibold text-primary">Sandeep Gaddam</span>
              </p>
              <p className="text-xs text-muted-foreground/60">
                © {new Date().getFullYear()} UnQWebTemplate. Open source under MIT License.
              </p>
            </motion.div>
          </div>
        </footer>
      </main>
    </div>
  );
}
