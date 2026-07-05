"use client";

import React from "react";
import { motion } from "framer-motion";
import { SidebarNav } from "@/components/navigation/sidebar";
import { BlurFade } from "@/components/ui/blur-fade";
import { MagicCard } from "@/components/ui/magic-card";
import { BorderBeam } from "@/components/ui/border-beam";
import { DotPattern } from "@/components/ui/dot-pattern";
import { GridPattern } from "@/components/ui/grid-pattern";
import { AnimatedGridPattern } from "@/components/ui/animated-grid-pattern";
import { Particles } from "@/components/ui/particles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowRight,
  Sparkles,
  Check,
  Star,
  Zap,
  Shield,
  Globe,
  Layers,
  Code2,
  Rocket,
  Heart,
  Users,
  Menu,
  Mail,
  Phone,
  MapPin,
  ChevronRight,
  Play,
  Lock,
  BarChart3,
  Cloud,
  MessageSquare,
  Twitter,
  Github,
  Linkedin,
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
  hidden: { opacity: 0, y: 25 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

// ===== BLOCK PREVIEW WRAPPER =====
function BlockPreview({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div variants={staggerItem}>
      <MagicCard
        className="rounded-xl overflow-hidden"
        gradientFrom="#c96442"
        gradientTo="#d97757"
        gradientSize={250}
      >
        <div className="bg-background rounded-xl overflow-hidden">
          {/* Preview Area */}
          <div className="relative overflow-hidden bg-muted/30 border-b border-border/50 min-h-[220px]">
            {children}
          </div>
          {/* Info Area */}
          <div className="p-5">
            <h3 className="font-semibold text-base">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              {description}
            </p>
          </div>
        </div>
      </MagicCard>
    </motion.div>
  );
}

// ===== HERO BLOCKS =====
function HeroGeometric() {
  return (
    <div className="relative p-8 flex flex-col items-center justify-center text-center min-h-[220px]">
      <GridPattern
        width={20}
        height={20}
        className="absolute inset-0 opacity-20 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]"
      />
      <Badge variant="outline" className="mb-3 text-xs border-primary/30 text-primary z-10">
        New Release
      </Badge>
      <h3 className="text-xl font-bold z-10">Build Something Amazing</h3>
      <p className="text-xs text-muted-foreground mt-2 z-10 max-w-[200px]">
        The modern platform for developers.
      </p>
      <Button size="sm" className="mt-4 z-10 h-8 text-xs">
        Get Started <ArrowRight className="ml-1 h-3 w-3" />
      </Button>
    </div>
  );
}

function HeroMinimal() {
  return (
    <div className="p-8 flex flex-col items-center justify-center text-center min-h-[220px]">
      <h3 className="text-2xl font-bold tracking-tight text-balance">
        Simple. Powerful. <span className="text-primary">Yours.</span>
      </h3>
      <p className="text-xs text-muted-foreground mt-3 max-w-[220px]">
        Everything you need, nothing you don&apos;t.
      </p>
      <div className="mt-5 flex gap-2">
        <Button size="sm" className="h-8 touch-target text-xs">
          Start Free
        </Button>
        <Button size="sm" variant="outline" className="h-8 touch-target text-xs">
          Learn More
        </Button>
      </div>
    </div>
  );
}

function HeroSplit() {
  return (
    <div className="grid grid-cols-2 min-h-[220px]">
      <div className="p-6 flex flex-col justify-center">
        <h3 className="text-lg font-bold leading-tight">
          Ship products <span className="text-primary">10x faster</span>
        </h3>
        <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
          Automated workflows, real-time collaboration, and AI assistance built in.
        </p>
        <Button size="sm" className="mt-4 h-7 text-[10px] w-fit">
          Try Now <ArrowRight className="ml-1 h-2.5 w-2.5" />
        </Button>
      </div>
      <div className="bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
        <div className="p-4 rounded-xl bg-background/60 backdrop-blur-sm border border-border/50">
          <Code2 className="h-8 touch-target w-8 text-primary" />
        </div>
      </div>
    </div>
  );
}

function HeroCentered() {
  return (
    <div className="relative p-8 flex flex-col items-center justify-center text-center min-h-[220px]">
      <DotPattern className="absolute inset-0 opacity-20" />
      <div className="relative z-10">
        <div className="flex justify-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-primary/10">
            <Zap className="h-4 w-4 text-primary" />
          </div>
          <div className="p-2 rounded-lg bg-primary/10">
            <Shield className="h-4 w-4 text-primary" />
          </div>
          <div className="p-2 rounded-lg bg-primary/10">
            <Globe className="h-4 w-4 text-primary" />
          </div>
        </div>
        <h3 className="text-xl font-bold">One Platform. Infinite Possibilities.</h3>
        <p className="text-xs text-muted-foreground mt-2">
          Unify your stack. Amplify your impact.
        </p>
        <div className="relative mt-4 inline-block">
          <Button size="sm" className="h-8 touch-target text-xs">
            Get Started
          </Button>
          <BorderBeam size={40} duration={4} colorFrom="#c96442" colorTo="#d97757" />
        </div>
      </div>
    </div>
  );
}

// ===== FEATURE BLOCKS =====
function FeatureGrid() {
  const items = [
    { icon: Zap, title: "Fast", desc: "Edge-optimized" },
    { icon: Shield, title: "Secure", desc: "E2E encrypted" },
    { icon: BarChart3, title: "Analytics", desc: "Real-time data" },
    { icon: Cloud, title: "Scalable", desc: "Auto-scaling" },
  ];
  return (
    <div className="p-6 min-h-[220px]">
      <h4 className="text-sm font-bold mb-4 text-center">Features</h4>
      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => (
          <div
            key={item.title}
            className="p-3 rounded-lg border border-border/50 bg-background hover:border-primary/30 transition-colors"
          >
            <item.icon className="h-4 w-4 text-primary mb-1.5" />
            <p className="text-xs font-semibold">{item.title}</p>
            <p className="text-[10px] text-muted-foreground">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeatureList() {
  const items = [
    { icon: Rocket, title: "Deploy in seconds" },
    { icon: Lock, title: "Enterprise security" },
    { icon: Layers, title: "Composable architecture" },
  ];
  return (
    <div className="p-6 min-h-[220px] flex flex-col justify-center">
      <h4 className="text-sm font-bold mb-4">Why Choose Us</h4>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.title} className="flex items-center gap-3">
            <div className="p-1.5 rounded-md bg-primary/10">
              <item.icon className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-xs font-medium">{item.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeatureBento() {
  return (
    <div className="p-6 min-h-[220px]">
      <div className="grid grid-cols-3 gap-2 h-full">
        <div className="col-span-2 row-span-2 rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 p-4 flex flex-col justify-end">
          <Zap className="h-5 w-5 text-primary mb-2" />
          <p className="text-xs font-bold">Lightning Fast</p>
          <p className="text-[10px] text-muted-foreground">Sub-second response times globally</p>
        </div>
        <div className="rounded-lg bg-primary/10 p-3 flex flex-col justify-center">
          <Shield className="h-4 w-4 text-primary mb-1" />
          <p className="text-[10px] font-semibold">Secure</p>
        </div>
        <div className="rounded-lg bg-primary/10 p-3 flex flex-col justify-center">
          <Globe className="h-4 w-4 text-primary mb-1" />
          <p className="text-[10px] font-semibold">Global</p>
        </div>
      </div>
    </div>
  );
}

function FeatureCards() {
  return (
    <div className="p-6 min-h-[220px]">
      <div className="space-y-2">
        {[
          { title: "Performance", value: "99.9%", desc: "Uptime guarantee" },
          { title: "Speed", value: "<50ms", desc: "Average latency" },
          { title: "Scale", value: "10M+", desc: "Requests per second" },
        ].map((item) => (
          <div key={item.title} className="flex items-center justify-between p-2.5 rounded-lg border border-border/50">
            <div>
              <p className="text-[10px] text-muted-foreground">{item.title}</p>
              <p className="text-sm font-bold text-primary">{item.value}</p>
            </div>
            <span className="text-[10px] text-muted-foreground">{item.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== CTA BLOCKS =====
function CTAGradient() {
  return (
    <div className="relative p-8 flex flex-col items-center justify-center text-center min-h-[220px] bg-gradient-to-br from-primary/20 via-primary/10 to-transparent">
      <h4 className="text-lg font-bold">Ready to Start?</h4>
      <p className="text-xs text-muted-foreground mt-2 max-w-[200px]">
        Join thousands building the future.
      </p>
      <Button size="sm" className="mt-4 h-8 text-xs">
        Get Started <ArrowRight className="ml-1 h-3 w-3" />
      </Button>
    </div>
  );
}

function CTASimple() {
  return (
    <div className="p-8 flex flex-col items-center justify-center text-center min-h-[220px] border-t-2 border-primary/30">
      <h4 className="text-lg font-bold">Start Building Today</h4>
      <p className="text-xs text-muted-foreground mt-2">Free forever for small teams.</p>
      <div className="mt-4 flex gap-2">
        <Button size="sm" className="h-8 touch-target text-xs">Sign Up Free</Button>
        <Button size="sm" variant="outline" className="h-8 touch-target text-xs">View Docs</Button>
      </div>
    </div>
  );
}

function CTANewsletter() {
  return (
    <div className="p-8 flex flex-col items-center justify-center text-center min-h-[220px]">
      <Mail className="h-6 w-6 text-primary mb-3" />
      <h4 className="text-sm font-bold">Stay in the Loop</h4>
      <p className="text-[10px] text-muted-foreground mt-1">Weekly insights, no spam.</p>
      <div className="mt-3 flex gap-2 w-full max-w-[200px]">
        <div className="flex-1 h-7 rounded-md border border-border/50 bg-background px-2 text-[10px] flex items-center text-muted-foreground">
          you@email.com
        </div>
        <Button size="sm" className="h-7 touch-target text-[10px] px-3">Go</Button>
      </div>
    </div>
  );
}

function CTAWithSocial() {
  return (
    <div className="p-8 flex flex-col items-center justify-center text-center min-h-[220px]">
      <h4 className="text-sm font-bold">Connect With Us</h4>
      <p className="text-[10px] text-muted-foreground mt-1">Follow for updates & tips</p>
      <div className="mt-4 flex gap-3">
        {[Twitter, Github, Linkedin].map((Icon, i) => (
          <div
            key={i}
            className="p-2 rounded-lg border border-border/50 hover:border-primary/30 transition-colors cursor-pointer"
          >
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        ))}
      </div>
      <Button size="sm" variant="outline" className="mt-4 h-7 text-[10px]">
        Join Community
      </Button>
    </div>
  );
}

// ===== PRICING BLOCKS =====
function PricingSimple() {
  return (
    <div className="p-6 min-h-[220px] flex flex-col items-center justify-center">
      <h4 className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Pro Plan</h4>
      <div className="text-3xl font-bold">$29<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
      <div className="mt-4 space-y-1.5">
        {["Unlimited projects", "Priority support", "API access"].map((f) => (
          <div key={f} className="flex items-center gap-1.5 text-[10px]">
            <Check className="h-3 w-3 text-primary" />
            <span>{f}</span>
          </div>
        ))}
      </div>
      <Button size="sm" className="mt-4 h-7 text-[10px]">Choose Plan</Button>
    </div>
  );
}

function PricingToggle() {
  return (
    <div className="p-6 min-h-[220px]">
      <div className="flex items-center justify-center gap-2 mb-4">
        <span className="text-[10px] font-medium">Monthly</span>
        <div className="h-4 w-8 rounded-full bg-primary relative">
          <div className="absolute right-0.5 top-0.5 h-3 w-3 rounded-full bg-white" />
        </div>
        <span className="text-[10px] font-medium text-muted-foreground">Yearly</span>
        <Badge className="text-[8px] h-4 px-1.5 bg-primary/10 text-primary border-0">-20%</Badge>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { name: "Free", price: "$0" },
          { name: "Pro", price: "$29" },
          { name: "Team", price: "$79" },
        ].map((plan) => (
          <div key={plan.name} className="text-center p-2 rounded-lg border border-border/50">
            <p className="text-[9px] text-muted-foreground">{plan.name}</p>
            <p className="text-sm font-bold">{plan.price}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PricingComparison() {
  return (
    <div className="p-6 min-h-[220px]">
      <div className="space-y-2">
        {[
          { feature: "Users", free: "1", pro: "10", ent: "∞" },
          { feature: "Storage", free: "1GB", pro: "100GB", ent: "∞" },
          { feature: "Support", free: "—", pro: "Priority", ent: "24/7" },
        ].map((row) => (
          <div key={row.feature} className="grid grid-cols-4 text-[10px]">
            <span className="font-medium">{row.feature}</span>
            <span className="text-center text-muted-foreground">{row.free}</span>
            <span className="text-center text-primary font-medium">{row.pro}</span>
            <span className="text-center text-muted-foreground">{row.ent}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== TESTIMONIAL BLOCKS =====
function TestimonialCards() {
  return (
    <div className="p-6 min-h-[220px]">
      <div className="grid grid-cols-2 gap-3 h-full">
        {[
          { name: "Alex R.", text: "Game changer for our team." },
          { name: "Sam L.", text: "Best investment we made." },
        ].map((t) => (
          <div key={t.name} className="p-3 rounded-lg border border-border/50 bg-background">
            <div className="flex gap-0.5 mb-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-2.5 w-2.5 fill-yellow-500 text-yellow-500" />
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed text-pretty">&ldquo;{t.text}&rdquo;</p>
            <p className="text-[10px] font-semibold mt-2">— {t.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TestimonialBanner() {
  return (
    <div className="p-6 min-h-[220px] flex flex-col items-center justify-center text-center">
      <div className="flex gap-0.5 mb-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className="h-4 w-4 fill-yellow-500 text-yellow-500" />
        ))}
      </div>
      <p className="text-xs leading-relaxed max-w-[220px] italic">
        &ldquo;This platform has completely transformed how we build products. 10/10 would recommend.&rdquo;
      </p>
      <div className="mt-3 flex items-center gap-2">
        <div className="h-7 touch-target w-7 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-[9px] font-bold text-primary">MK</span>
        </div>
        <div className="text-left">
          <p className="text-[10px] font-semibold">Maria K.</p>
          <p className="text-[9px] text-muted-foreground">CEO, TechCo</p>
        </div>
      </div>
    </div>
  );
}

function TestimonialGrid() {
  return (
    <div className="p-6 min-h-[220px]">
      <div className="space-y-2">
        {[
          { name: "JD", text: "Incredible DX. Shipped in half the time.", author: "Jake D." },
          { name: "LP", text: "Support team is world-class.", author: "Lisa P." },
          { name: "RW", text: "Replaced 3 tools with one.", author: "Ryan W." },
        ].map((t) => (
          <div key={t.name} className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-[8px] font-bold text-primary">{t.name}</span>
            </div>
            <div>
              <p className="text-[10px] leading-relaxed">{t.text}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">{t.author}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== FOOTER BLOCKS =====
function FooterMinimal() {
  return (
    <div className="p-6 min-h-[220px]">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
          <span className="text-[9px] font-bold text-primary">U</span>
        </div>
        <span className="text-xs font-bold">UnQWeb</span>
      </div>
      <div className="grid grid-cols-3 gap-4 mb-4">
        {["Product", "Company", "Legal"].map((col) => (
          <div key={col}>
            <p className="text-[9px] font-semibold mb-1.5">{col}</p>
            <div className="space-y-1">
              <div className="h-2 w-12 bg-muted rounded" />
              <div className="h-2 w-10 bg-muted rounded" />
              <div className="h-2 w-14 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-border/50 pt-3 flex justify-between items-center">
        <span className="text-[9px] text-muted-foreground">&copy; 2025 UnQWeb</span>
        <div className="flex gap-2">
          {[Twitter, Github, Linkedin].map((Icon, i) => (
            <Icon key={i} className="h-3 w-3 text-muted-foreground" />
          ))}
        </div>
      </div>
    </div>
  );
}

function FooterRich() {
  return (
    <div className="p-6 min-h-[220px]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-primary flex items-center justify-center">
            <span className="text-[9px] font-bold text-white">U</span>
          </div>
          <span className="text-xs font-bold">UnQWeb</span>
        </div>
        <Button size="sm" variant="outline" className="h-6 text-[9px] px-2">
          Get Started
        </Button>
      </div>
      <div className="grid grid-cols-4 gap-3 mb-4">
        {["Features", "Pricing", "Docs", "Blog", "About", "Careers", "Privacy", "Terms"].map((link) => (
          <span key={link} className="text-[9px] text-muted-foreground">{link}</span>
        ))}
      </div>
      <div className="border-t border-border/50 pt-3 flex justify-between items-center">
        <span className="text-[9px] text-muted-foreground">Built with ❤️ by Sandeep Gaddam</span>
        <div className="flex gap-2">
          {[Twitter, Github, Linkedin].map((Icon, i) => (
            <div key={i} className="p-1 rounded border border-border/50">
              <Icon className="h-2.5 w-2.5 text-muted-foreground" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FooterNewsletter() {
  return (
    <div className="p-6 min-h-[220px]">
      <div className="mb-4">
        <h4 className="text-xs font-bold mb-1">Subscribe to our newsletter</h4>
        <p className="text-[9px] text-muted-foreground">Get the latest updates delivered to your inbox.</p>
        <div className="mt-2 flex gap-1.5">
          <div className="flex-1 h-6 rounded border border-border/50 bg-background px-2 text-[9px] flex items-center text-muted-foreground">
            Email address
          </div>
          <Button size="sm" className="h-6 text-[9px] px-2">Subscribe</Button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-3">
        {["Product", "Resources", "Company"].map((col) => (
          <div key={col}>
            <p className="text-[9px] font-semibold mb-1">{col}</p>
            <div className="space-y-0.5">
              <div className="h-1.5 w-10 bg-muted rounded" />
              <div className="h-1.5 w-12 bg-muted rounded" />
              <div className="h-1.5 w-8 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-border/50 pt-2 text-center">
        <span className="text-[8px] text-muted-foreground">&copy; 2025 UnQWeb Template</span>
      </div>
    </div>
  );
}

// ===== SECTION HEADER COMPONENT =====
function SectionHeader({
  label,
  title,
  highlight,
  description,
}: {
  label: string;
  title: string;
  highlight: string;
  description?: string;
}) {
  return (
    <motion.div
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      className="mb-10"
    >
      <Badge variant="outline" className="mb-3 border-primary/30 text-primary">
        {label}
      </Badge>
      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-balance">
        {title} <span className="text-primary">{highlight}</span>
      </h2>
      {description && (
        <p className="mt-2 text-sm text-muted-foreground max-w-xl">
          {description}
        </p>
      )}
    </motion.div>
  );
}

export default function BlocksPage() {
  return (
    <div className="flex min-h-dvh">
      <SidebarNav />
      <main className="flex-1 overflow-y-auto overflow-x-hidden pt-16 md:pt-0">
        {/* ===== PAGE HEADER ===== */}
        <section className="relative pt-16 pb-12 px-6 overflow-hidden">
          <Particles
            className="absolute inset-0"
            quantity={30}
            color="#c96442"
            size={0.4}
          />
          <div className="relative z-10 max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Badge
                variant="outline"
                className="mb-4 px-4 py-1.5 border-primary/40 text-primary bg-primary/5"
              >
                <Layers className="w-3.5 h-3.5 mr-1.5" />
                Block Gallery
              </Badge>
            </motion.div>
            <BlurFade delay={0.1} inView>
              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-balance">
                Blocks & Sections{" "}
                <span className="text-primary">Gallery</span>
              </h1>
            </BlurFade>
            <BlurFade delay={0.2} inView>
              <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed text-pretty">
                A curated collection of beautifully designed, ready-to-use page
                sections. Copy, customize, and ship.
              </p>
            </BlurFade>
          </div>
        </section>

        {/* ===== HERO BLOCKS ===== */}
        <section className="py-16 px-6">
          <div className="max-w-6xl mx-auto">
            <SectionHeader
              label="Heroes"
              title="Hero"
              highlight="Blocks"
              description="Stunning hero sections to make a powerful first impression."
            />
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5"
            >
              <BlockPreview
                title="Geometric Hero"
                description="Grid pattern background with bold centered typography and badge accent."
              >
                <HeroGeometric />
              </BlockPreview>
              <BlockPreview
                title="Minimal Hero"
                description="Clean, distraction-free layout with focus on the message and dual CTAs."
              >
                <HeroMinimal />
              </BlockPreview>
              <BlockPreview
                title="Split Hero"
                description="Two-column layout with content on the left and visual/illustration on the right."
              >
                <HeroSplit />
              </BlockPreview>
              <BlockPreview
                title="Centered Hero"
                description="Dot pattern background with icon trio, animated border beam, and CTA."
              >
                <HeroCentered />
              </BlockPreview>
            </motion.div>
          </div>
        </section>

        {/* ===== FEATURE BLOCKS ===== */}
        <section className="py-16 px-6 bg-muted/15">
          <div className="max-w-6xl mx-auto">
            <SectionHeader
              label="Features"
              title="Feature"
              highlight="Blocks"
              description="Versatile feature section layouts to showcase your product capabilities."
            />
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5"
            >
              <BlockPreview
                title="Feature Grid"
                description="2x2 grid of feature cards with icons, titles, and descriptions."
              >
                <FeatureGrid />
              </BlockPreview>
              <BlockPreview
                title="Feature List"
                description="Vertical list layout with icons and clean alignment."
              >
                <FeatureList />
              </BlockPreview>
              <BlockPreview
                title="Bento Features"
                description="Asymmetric bento-style layout with varying card sizes for visual hierarchy."
              >
                <FeatureBento />
              </BlockPreview>
              <BlockPreview
                title="Feature Stats"
                description="Data-driven feature showcase with metrics and stat highlights."
              >
                <FeatureCards />
              </BlockPreview>
            </motion.div>
          </div>
        </section>

        {/* ===== CTA BLOCKS ===== */}
        <section className="py-16 px-6">
          <div className="max-w-6xl mx-auto">
            <SectionHeader
              label="CTA"
              title="Call-to-Action"
              highlight="Blocks"
              description="High-conversion CTA sections to drive user engagement."
            />
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5"
            >
              <BlockPreview
                title="Gradient CTA"
                description="Soft gradient background with centered copy and prominent action button."
              >
                <CTAGradient />
              </BlockPreview>
              <BlockPreview
                title="Simple CTA"
                description="Border-accented layout with dual buttons for primary and secondary actions."
              >
                <CTASimple />
              </BlockPreview>
              <BlockPreview
                title="Newsletter CTA"
                description="Email capture form with icon, description, and inline input field."
              >
                <CTANewsletter />
              </BlockPreview>
              <BlockPreview
                title="Social CTA"
                description="Social links and community-focused CTA with follow buttons."
              >
                <CTAWithSocial />
              </BlockPreview>
            </motion.div>
          </div>
        </section>

        {/* ===== PRICING BLOCKS ===== */}
        <section className="py-16 px-6 bg-muted/15">
          <div className="max-w-6xl mx-auto">
            <SectionHeader
              label="Pricing"
              title="Pricing"
              highlight="Blocks"
              description="Clear pricing layouts to help users choose the right plan."
            />
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-5"
            >
              <BlockPreview
                title="Simple Pricing"
                description="Single tier focus with feature list and prominent price point."
              >
                <PricingSimple />
              </BlockPreview>
              <BlockPreview
                title="Toggle Pricing"
                description="Monthly/yearly toggle with multi-tier comparison grid."
              >
                <PricingToggle />
              </BlockPreview>
              <BlockPreview
                title="Comparison Table"
                description="Feature-by-feature comparison across plan tiers."
              >
                <PricingComparison />
              </BlockPreview>
            </motion.div>
          </div>
        </section>

        {/* ===== TESTIMONIAL BLOCKS ===== */}
        <section className="py-16 px-6">
          <div className="max-w-6xl mx-auto">
            <SectionHeader
              label="Testimonials"
              title="Testimonial"
              highlight="Blocks"
              description="Social proof sections to build trust and credibility."
            />
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-5"
            >
              <BlockPreview
                title="Card Testimonials"
                description="Side-by-side testimonial cards with star ratings and quotes."
              >
                <TestimonialCards />
              </BlockPreview>
              <BlockPreview
                title="Banner Testimonial"
                description="Featured quote layout with large text, avatar, and attribution."
              >
                <TestimonialBanner />
              </BlockPreview>
              <BlockPreview
                title="List Testimonials"
                description="Compact list-style testimonials with avatars and brief quotes."
              >
                <TestimonialGrid />
              </BlockPreview>
            </motion.div>
          </div>
        </section>

        {/* ===== FOOTER BLOCKS ===== */}
        <section className="py-16 px-6 bg-muted/15">
          <div className="max-w-6xl mx-auto">
            <SectionHeader
              label="Footers"
              title="Footer"
              highlight="Blocks"
              description="Complete footer layouts with navigation, social links, and branding."
            />
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-50px" }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-5"
            >
              <BlockPreview
                title="Minimal Footer"
                description="Clean footer with logo, link columns, social icons, and copyright."
              >
                <FooterMinimal />
              </BlockPreview>
              <BlockPreview
                title="Rich Footer"
                description="Full-featured footer with CTA button, link grid, and attribution."
              >
                <FooterRich />
              </BlockPreview>
              <BlockPreview
                title="Newsletter Footer"
                description="Footer with newsletter signup, navigation columns, and subscribe form."
              >
                <FooterNewsletter />
              </BlockPreview>
            </motion.div>
          </div>
        </section>

        {/* ===== BOTTOM CTA ===== */}
        <section className="py-20 px-6 border-t border-border/50">
          <div className="max-w-2xl mx-auto text-center">
            <BlurFade inView>
              <div className="flex justify-center mb-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
              </div>
              <h2 className="text-2xl font-bold">
                Need a custom block?
              </h2>
              <p className="mt-2 text-muted-foreground">
                All blocks are fully customizable. Mix, match, and make them
                yours.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <Button>
                  Browse Components
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </BlurFade>
          </div>
        </section>
      </main>
    </div>
  );
}
