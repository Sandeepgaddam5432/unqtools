"use client";

import React, { useRef } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { SidebarNav } from "@/components/navigation/sidebar";
import { HeroGeometric } from "@/components/ui/shape-landing-hero";
import {
  AnimatedTestimonials,
  type Testimonial,
} from "@/components/ui/animated-testimonials";
import {
  TestimonialStack,
  type GlassTestimonial,
} from "@/components/ui/glass-testimonial-swiper";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WordRotate } from "@/components/ui/word-rotate";
import { NumberTicker } from "@/components/ui/number-ticker";
import { BlurFade } from "@/components/ui/blur-fade";
import { HyperText } from "@/components/ui/hyper-text";
import {
  Sparkles,
  MousePointerClick,
  Layers,
  Zap,
  Move3d,
  Wind,
  Globe,
  Palette,
  Rocket,
  Star,
  Heart,
  ArrowRight,
  ChevronRight,
  Hash,
  Type,
  AlignCenter,
} from "lucide-react";

// ===== DATA =====
const testimonials: Testimonial[] = [
  {
    id: 1,
    name: "Alex Rivera",
    role: "Full Stack Developer",
    company: "TechForge",
    content:
      "The animation system in UnQWebTemplate is breathtaking. Every transition feels intentional, every micro-interaction feels alive. It's like having a motion designer built into the framework.",
    rating: 5,
    avatar: "https://randomuser.me/api/portraits/men/32.jpg",
  },
  {
    id: 2,
    name: "Priya Sharma",
    role: "Frontend Engineer",
    company: "DesignCraft",
    content:
      "Framer Motion integration is seamless. The stagger animations, spring physics, and scroll-triggered effects make every page feel cinematic without any performance overhead.",
    rating: 5,
    avatar: "https://randomuser.me/api/portraits/women/44.jpg",
  },
  {
    id: 3,
    name: "Marcus Chen",
    role: "Motion Designer",
    company: "InnovateLabs",
    content:
      "As a motion designer, I'm incredibly impressed. The morphing cards, parallax scrolling, and particle effects rival what I'd normally build in After Effects. In a web template? Unheard of.",
    rating: 5,
    avatar: "https://randomuser.me/api/portraits/men/46.jpg",
  },
];

const glassTestimonials: GlassTestimonial[] = [
  {
    id: 1,
    initials: "AR",
    name: "Alex Rivera",
    role: "Full Stack Developer at TechForge",
    quote:
      "The animation library is incredibly polished. Spring physics, stagger effects, and morphing transitions — everything feels premium.",
    tags: [
      { text: "Framer Motion", type: "featured" },
      { text: "Animations", type: "default" },
    ],
    stats: [
      { icon: () => <Sparkles className="h-3.5 w-3.5" />, text: "60+ animations" },
      { icon: () => <Zap className="h-3.5 w-3.5" />, text: "60fps" },
    ],
    avatarGradient: "linear-gradient(135deg, #c96442, #d97757)",
  },
  {
    id: 2,
    initials: "PS",
    name: "Priya Sharma",
    role: "Frontend Engineer at DesignCraft",
    quote:
      "The parallax and scroll-triggered animations are buttery smooth. No jank, no layout shifts — just pure cinematic motion.",
    tags: [
      { text: "Scroll", type: "default" },
      { text: "Parallax", type: "featured" },
    ],
    stats: [
      { icon: () => <Move3d className="h-3.5 w-3.5" />, text: "3D effects" },
      { icon: () => <Wind className="h-3.5 w-3.5" />, text: "Smooth" },
    ],
    avatarGradient: "linear-gradient(135deg, #10b981, #059669)",
  },
  {
    id: 3,
    initials: "MC",
    name: "Marcus Chen",
    role: "Motion Designer at InnovateLabs",
    quote:
      "The morphing card animations and spring physics demo are exactly what modern web experiences need. This template gets motion right.",
    tags: [
      { text: "Morphing", type: "featured" },
      { text: "Spring", type: "default" },
    ],
    stats: [
      { icon: () => <Palette className="h-3.5 w-3.5" />, text: "Beautiful" },
      { icon: () => <Rocket className="h-3.5 w-3.5" />, text: "Fast" },
    ],
    avatarGradient: "linear-gradient(135deg, #ec4899, #d946ef)",
  },
];

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
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: [0.25, 0.4, 0.25, 1] },
  },
};

// ===== MORPHING CARD COMPONENT =====
function MorphingCard({ title, description, icon: Icon, gradient }: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
}) {
  const [isFlipped, setIsFlipped] = React.useState(false);

  return (
    <div
      className="relative h-72 cursor-pointer perspective-1000"
      onClick={() => setIsFlipped(!isFlipped)}
    >
      <motion.div
        className="absolute inset-0 w-full h-full"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
        style={{ transformStyle: "preserve-3d" }}
      >
        {/* Front */}
        <div
          className="absolute inset-0 rounded-2xl p-6 flex flex-col justify-between"
          style={{
            backfaceVisibility: "hidden",
            background: gradient,
          }}
        >
          <div>
            <div className="h-12 w-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center mb-4">
              <Icon className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
          </div>
          <p className="text-white/60 text-sm">Click to flip →</p>
        </div>

        {/* Back */}
        <div
          className="absolute inset-0 rounded-2xl p-6 flex flex-col justify-center bg-card border"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
          <div className="mt-4">
            <Badge variant="outline" className="text-primary border-primary/30">
              <Sparkles className="h-3 w-3 mr-1" /> Morphed
            </Badge>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ===== SPRING BUTTON COMPONENT =====
function SpringButton({ children, color }: { children: React.ReactNode; color: string }) {
  const x = useSpring(0, { stiffness: 300, damping: 15 });
  const scale = useSpring(1, { stiffness: 400, damping: 20 });

  return (
    <motion.div
      style={{ x, scale }}
      onMouseDown={() => { scale.set(0.9); }}
      onMouseUp={() => { scale.set(1); x.set(x.get() === 0 ? 8 : 0); }}
      onMouseLeave={() => { scale.set(1); x.set(0); }}
      className="px-6 py-3 rounded-xl text-white font-medium text-sm cursor-pointer shadow-lg select-none"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <div
        className="rounded-xl px-6 py-3 text-center"
        style={{ background: color }}
      >
        {children}
      </div>
    </motion.div>
  );
}

// ===== PARALLAX SECTION =====
function ParallaxSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const y1 = useTransform(scrollYProgress, [0, 1], [100, -100]);
  const y2 = useTransform(scrollYProgress, [0, 1], [50, -50]);
  const y3 = useTransform(scrollYProgress, [0, 1], [150, -150]);
  const rotate = useTransform(scrollYProgress, [0, 1], [0, 45]);
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0.3, 1, 1, 0.3]);

  const rotate2 = useTransform(scrollYProgress, [0, 1], [0, -30]);

  return (
    <div ref={ref} className="relative h-[500px] rounded-2xl overflow-hidden bg-gradient-to-b from-background via-muted/30 to-background border">
      <motion.div
        style={{ y: y1, rotate }}
        className="absolute left-[10%] top-[20%] w-32 h-32 rounded-2xl bg-primary/10 border border-primary/20"
      />
      <motion.div
        style={{ y: y2 }}
        className="absolute right-[15%] top-[10%] w-24 h-24 rounded-full bg-primary/15 border border-primary/20"
      />
      <motion.div
        style={{ y: y3, rotate: rotate2 }}
        className="absolute left-[50%] top-[40%] w-40 h-40 rounded-3xl bg-primary/8 border border-primary/15"
      />
      <motion.div
        style={{ y: y2 }}
        className="absolute right-[30%] bottom-[15%] w-20 h-20 rounded-xl bg-primary/10 border border-primary/20"
      />
      <motion.div
        style={{ opacity, y: y2 }}
        className="absolute inset-0 flex items-center justify-center"
      >
        <div className="text-center px-4">
          <h3 className="text-2xl md:text-3xl font-bold mb-2">Parallax Scroll</h3>
          <p className="text-muted-foreground max-w-md">
            Elements move at different speeds as you scroll, creating a sense of depth and dimension.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default function AnimationsShowcase() {
  return (
    <div className="flex min-h-dvh bg-background">
      <SidebarNav />
      <main className="flex-1 overflow-y-auto overflow-x-hidden pt-16 md:pt-0">
        {/* ===== HERO SECTION ===== */}
        <HeroGeometric
          badge="Animation Showcase"
          title1="Motion That"
          title2="Feels Alive"
        />
        <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center pb-16 pointer-events-none"
          style={{ position: "relative", marginTop: "-120px" }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.4, duration: 0.8 }}
            className="text-center"
          >
            <Badge className="bg-primary/10 text-primary border-primary/20 mb-4">
              <Sparkles className="h-3 w-3 mr-1" /> Powered by Framer Motion
            </Badge>
            <p className="text-muted-foreground max-w-lg mx-auto text-pretty">
              Explore stunning animations, transitions, and motion design patterns
              that bring your Next.js applications to life.
            </p>
          </motion.div>
        </div>

        <div className="section-padding py-12 space-y-12">
          {/* ===== MORPHING CARDS SECTION ===== */}
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={sectionVariants}
          >
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-8 touch-target w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <MousePointerClick className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Morphing Cards</h2>
                  <p className="text-muted-foreground text-sm">Click cards to flip with 3D transform animations</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <MorphingCard
                title="Spring Physics"
                description="Animations that feel natural with spring-based motion. Configure stiffness, damping, and mass for precise control over every interaction."
                icon={Zap}
                gradient="linear-gradient(135deg, #c96442, #d97757)"
              />
              <MorphingCard
                title="3D Transforms"
                description="Perspective-based 3D card flips with backface visibility and preserve-3d. Create immersive flip-card interactions."
                icon={Globe}
                gradient="linear-gradient(135deg, #10b981, #059669)"
              />
              <MorphingCard
                title="Layout Animations"
                description="Shared layout animations that smoothly transition elements between states. LayoutId-powered transitions that wow users."
                icon={Layers}
                gradient="linear-gradient(135deg, #ec4899, #d946ef)"
              />
            </div>
          </motion.section>

          {/* ===== STAGGER ANIMATION SECTION ===== */}
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
                    <Layers className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Stagger Animation</CardTitle>
                    <CardDescription>
                      Items animate in sequence with configurable delays for a cascading effect
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <motion.div
                  variants={staggerContainer}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  className="grid grid-cols-2 md:grid-cols-4 gap-4"
                >
                  {[
                    { icon: Sparkles, label: "Entrance", color: "from-primary/20 to-primary/5" },
                    { icon: Zap, label: "Spring", color: "from-amber-500/20 to-amber-500/5" },
                    { icon: Move3d, label: "3D Motion", color: "from-emerald-500/20 to-emerald-500/5" },
                    { icon: Wind, label: "Parallax", color: "from-rose-500/20 to-rose-500/5" },
                    { icon: Globe, label: "Orbit", color: "from-violet-500/20 to-violet-500/5" },
                    { icon: Palette, label: "Color Shift", color: "from-cyan-500/20 to-cyan-500/5" },
                    { icon: Rocket, label: "Launch", color: "from-orange-500/20 to-orange-500/5" },
                    { icon: Star, label: "Shimmer", color: "from-teal-500/20 to-teal-500/5" },
                  ].map((item, i) => {
                    const Icon = item.icon;
                    return (
                      <motion.div
                        key={i}
                        variants={staggerItem}
                        whileHover={{ scale: 1.05, y: -4 }}
                        className={`rounded-xl bg-gradient-to-br ${item.color} p-5 flex flex-col items-center gap-3 border border-border/30 cursor-pointer transition-colors hover:border-primary/30`}
                      >
                        <Icon className="h-6 w-6 text-foreground/70" />
                        <span className="text-sm font-medium">{item.label}</span>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </CardContent>
            </Card>
          </motion.section>

          {/* ===== PARALLAX SCROLL SECTION ===== */}
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={sectionVariants}
          >
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-8 touch-target w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Move3d className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Parallax Scroll</h2>
                  <p className="text-muted-foreground text-sm">Scroll-triggered depth with multi-layer parallax effects</p>
                </div>
              </div>
            </div>
            <ParallaxSection />
          </motion.section>

          {/* ===== SPRING ANIMATION SECTION ===== */}
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
                    <Zap className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Spring Physics</CardTitle>
                    <CardDescription>
                      Click the buttons to see spring-based animations with natural physics
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 mb-8">
                  <SpringButton color="linear-gradient(135deg, #c96442, #d97757)">
                    Terracotta
                  </SpringButton>
                  <SpringButton color="linear-gradient(135deg, #10b981, #059669)">
                    Emerald
                  </SpringButton>
                  <SpringButton color="linear-gradient(135deg, #ec4899, #d946ef)">
                    Rose
                  </SpringButton>
                  <SpringButton color="linear-gradient(135deg, #f59e0b, #d97706)">
                    Amber
                  </SpringButton>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { stiffness: 100, damping: 10, label: "Bouncy" },
                    { stiffness: 300, damping: 20, label: "Snappy" },
                    { stiffness: 150, damping: 25, label: "Gentle" },
                  ].map((spring, i) => (
                    <motion.div
                      key={i}
                      className="rounded-xl border bg-card p-6 text-center"
                      whileHover={{
                        scale: 1.03,
                        transition: {
                          type: "spring",
                          stiffness: spring.stiffness,
                          damping: spring.damping,
                        },
                      }}
                      whileTap={{
                        scale: 0.97,
                        transition: {
                          type: "spring",
                          stiffness: spring.stiffness,
                          damping: spring.damping,
                        },
                      }}
                    >
                      <p className="font-semibold mb-1">{spring.label}</p>
                      <p className="text-xs text-muted-foreground mb-3">
                        stiffness: {spring.stiffness} / damping: {spring.damping}
                      </p>
                      <div className="flex justify-center gap-2 text-[10px] text-muted-foreground">
                        <Badge variant="outline" className="font-mono text-[10px]">k={spring.stiffness}</Badge>
                        <Badge variant="outline" className="font-mono text-[10px]">d={spring.damping}</Badge>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.section>

          {/* ===== ANIMATED TESTIMONIALS SECTION ===== */}
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={sectionVariants}
          >
            <AnimatedTestimonials
              title="Motion Masters"
              subtitle="Developers who appreciate the art of animation share their experience with UnQWebTemplate's motion system."
              badgeText="Animation Enthusiasts"
              testimonials={testimonials}
              trustedCompanies={["Vercel", "Stripe", "Figma", "Linear"]}
              trustedCompaniesTitle="Trusted by animation-forward teams"
            />
          </motion.section>

          {/* ===== GLASS TESTIMONIAL SWIPER SECTION ===== */}
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={sectionVariants}
            className="relative w-full py-12 px-0 overflow-hidden bg-black rounded-2xl"
          >
            <div className="max-w-lg mx-auto text-center mb-10 px-6">
              <Badge className="bg-primary/10 text-primary border-primary/20 mb-4">
                <Heart className="h-3 w-3 mr-1 fill-primary" /> Swipeable
              </Badge>
              <h2 className="text-3xl font-bold text-white mb-3">Glass Testimonial Stack</h2>
              <p className="text-white/50 text-sm">Drag or swipe to navigate through glassmorphism testimonial cards</p>
            </div>
            <div className="max-w-lg mx-auto px-6" style={{ minHeight: "350px" }}>
              <TestimonialStack testimonials={glassTestimonials} />
            </div>
          </motion.section>

          {/* Word Rotate */}
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={sectionVariants}
          >
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-8 touch-target w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Type className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Word Rotate</h2>
                  <p className="text-muted-foreground text-sm">Cycling through words with smooth animated transitions</p>
                </div>
              </div>
            </div>
            <Card className="overflow-hidden border-border/50">
              <CardContent className="p-8 flex flex-col items-center justify-center text-center min-h-[280px]">
                <p className="text-muted-foreground text-sm mb-4">We build</p>
                <div className="flex items-center gap-3 text-4xl md:text-5xl font-bold">
                  <span className="text-foreground">Amazing</span>
                  <WordRotate
                    words={["Websites", "Apps", "Experiences", "Platforms", "Products"]}
                    className="text-primary text-4xl md:text-5xl font-bold"
                    duration={2000}
                  />
                </div>
                <p className="text-muted-foreground text-sm mt-4">that users love</p>
              </CardContent>
            </Card>
          </motion.section>

          {/* Number Ticker */}
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={sectionVariants}
          >
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-8 touch-target w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Hash className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Number Ticker</h2>
                  <p className="text-muted-foreground text-sm">Animated number counters that spring into view</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Components", value: 60, suffix: "+", color: "text-primary" },
                { label: "Downloads", value: 12, suffix: "K+", color: "text-emerald-500" },
                { label: "Stars", value: 8400, suffix: "", color: "text-amber-500" },
                { label: "Contributors", value: 156, suffix: "", color: "text-purple-500" },
              ].map((stat, i) => (
                <Card key={stat.label} className="border-border/50 text-center">
                  <CardContent className="p-6 flex flex-col items-center">
                    <NumberTicker
                      value={stat.value}
                      className={`text-3xl md:text-4xl font-bold tabular-nums ${stat.color}`}
                      delay={i * 0.3}
                    />
                    <p className="text-sm text-muted-foreground mt-2">{stat.label}</p>
                    {stat.suffix && (
                      <Badge variant="outline" className="mt-2 text-xs">{stat.suffix}</Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.section>

          {/* Blur Fade */}
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={sectionVariants}
          >
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-8 touch-target w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <AlignCenter className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Blur Fade</h2>
                  <p className="text-muted-foreground text-sm">Elements fade in with a blur-to-clear animation on scroll</p>
                </div>
              </div>
            </div>
            <Card className="overflow-hidden border-border/50">
              <CardContent className="p-8 space-y-6">
                <BlurFade delay={0} inView>
                  <h3 className="text-2xl font-bold text-foreground">Bring Your Content to Life</h3>
                </BlurFade>
                <BlurFade delay={0.15} inView direction="left">
                  <p className="text-muted-foreground max-w-lg">
                    BlurFade animates elements from blurred to clear, creating a cinematic reveal effect
                    that draws attention to your most important content.
                  </p>
                </BlurFade>
                <BlurFade delay={0.3} inView direction="right">
                  <div className="flex gap-3">
                    <Badge className="bg-primary/10 text-primary border-primary/20">
                      <Sparkles className="h-3 w-3 mr-1" /> Blur Reveal
                    </Badge>
                    <Badge variant="outline" className="border-primary/20 text-primary">Directional</Badge>
                    <Badge variant="outline" className="border-primary/20 text-primary">Staggered</Badge>
                  </div>
                </BlurFade>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                  {["Direction: Up", "Direction: Left", "Direction: Right"].map((label, i) => (
                    <BlurFade
                      key={label}
                      delay={0.4 + i * 0.15}
                      inView
                      direction={i === 0 ? "up" : i === 1 ? "left" : "right"}
                    >
                      <div className="rounded-xl border border-border/50 bg-muted/30 p-4 text-center">
                        <p className="text-sm font-medium text-foreground">{label}</p>
                        <p className="text-xs text-muted-foreground mt-1">Animated with blur fade</p>
                      </div>
                    </BlurFade>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.section>

          {/* HyperText */}
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={sectionVariants}
          >
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-8 touch-target w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">HyperText</h2>
                  <p className="text-muted-foreground text-sm">Text scramble animation with character-by-character reveal</p>
                </div>
              </div>
            </div>
            <Card className="overflow-hidden border-border/50">
              <CardContent className="p-8 flex flex-col items-center justify-center text-center min-h-[320px] space-y-6">
                <HyperText
                  className="text-3xl md:text-4xl font-bold text-foreground"
                  duration={1000}
                  startOnView
                  animateOnHover
                >
                  UnQWebTemplate
                </HyperText>
                <HyperText
                  className="text-xl md:text-2xl font-semibold text-primary"
                  duration={800}
                  startOnView
                  animateOnHover
                  as="h2"
                >
                  Magic UI Components
                </HyperText>
                <p className="text-sm text-muted-foreground max-w-md">
                  Hover over the text above to trigger the scramble animation again.
                  Characters randomize before resolving to the final letter.
                </p>
              </CardContent>
            </Card>
          </motion.section>

          {/* Bottom spacing */}
          <div className="h-8" />
        </div>
      </main>
    </div>
  );
}
