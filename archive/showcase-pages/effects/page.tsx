"use client";

import React from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { SidebarNav } from "@/components/navigation/sidebar";
import { ParticleTextEffect } from "@/components/ui/particle-text-effect";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BorderBeam } from "@/components/ui/border-beam";
import { Marquee } from "@/components/ui/marquee";
import { Meteors } from "@/components/ui/meteors";
import { AnimatedBeam } from "@/components/ui/animated-beam";
import {
  Sparkles,
  Zap,
  Eye,
  Layers,
  Palette,
  Ghost,
  Sun,
  Circle,
  MonitorSmartphone,
  Server,
} from "lucide-react";

const sectionVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5 },
  },
};

// Aurora Background Component
function AuroraBackground() {
  return (
    <div className="relative w-full h-[500px] overflow-hidden rounded-2xl">
      <div className="absolute inset-0 bg-black">
        <motion.div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 20% 50%, rgba(201,100,66,0.3) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(156,135,245,0.25) 0%, transparent 50%), radial-gradient(ellipse at 40% 80%, rgba(217,119,87,0.2) 0%, transparent 50%)",
          }}
          animate={{
            background: [
              "radial-gradient(ellipse at 20% 50%, rgba(201,100,66,0.3) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(156,135,245,0.25) 0%, transparent 50%), radial-gradient(ellipse at 40% 80%, rgba(217,119,87,0.2) 0%, transparent 50%)",
              "radial-gradient(ellipse at 60% 30%, rgba(201,100,66,0.35) 0%, transparent 50%), radial-gradient(ellipse at 20% 70%, rgba(156,135,245,0.3) 0%, transparent 50%), radial-gradient(ellipse at 80% 60%, rgba(217,119,87,0.25) 0%, transparent 50%)",
              "radial-gradient(ellipse at 40% 70%, rgba(201,100,66,0.3) 0%, transparent 50%), radial-gradient(ellipse at 70% 40%, rgba(156,135,245,0.25) 0%, transparent 50%), radial-gradient(ellipse at 20% 30%, rgba(217,119,87,0.2) 0%, transparent 50%)",
              "radial-gradient(ellipse at 20% 50%, rgba(201,100,66,0.3) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(156,135,245,0.25) 0%, transparent 50%), radial-gradient(ellipse at 40% 80%, rgba(217,119,87,0.2) 0%, transparent 50%)",
            ],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        />
        {/* Aurora bands */}
        <motion.div
          className="absolute inset-0 opacity-40"
          style={{
            background:
              "linear-gradient(180deg, transparent 0%, rgba(201,100,66,0.15) 30%, rgba(156,135,245,0.1) 50%, rgba(217,119,87,0.15) 70%, transparent 100%)",
          }}
          animate={{ scaleY: [1, 1.2, 0.9, 1], opacity: [0.4, 0.6, 0.3, 0.4] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -inset-20 opacity-30"
          style={{
            background:
              "conic-gradient(from 0deg at 50% 50%, rgba(201,100,66,0.1), rgba(156,135,245,0.1), rgba(217,119,87,0.1), rgba(201,100,66,0.1))",
          }}
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center"
        >
          <h3 className="text-4xl md:text-5xl font-bold text-white mb-3">
            Aurora <span className="text-primary">Borealis</span>
          </h3>
          <p className="text-white/60 text-sm max-w-md mx-auto">
            Animated aurora effect using CSS gradients & framer-motion
          </p>
        </motion.div>
      </div>
    </div>
  );
}

// Mesh Gradient Background
function MeshGradient() {
  return (
    <div className="relative w-full h-[400px] overflow-hidden rounded-2xl">
      <div className="absolute inset-0 bg-[#0a0a0a]">
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full"
          style={{ left: "-10%", top: "-20%" }}
          animate={{
            x: [0, 100, -50, 0],
            y: [0, -80, 50, 0],
            scale: [1, 1.2, 0.9, 1],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="w-full h-full rounded-full bg-primary/30 blur-[100px]" />
        </motion.div>
        <motion.div
          className="absolute w-[500px] h-[500px] rounded-full"
          style={{ right: "-10%", bottom: "-20%" }}
          animate={{
            x: [0, -80, 60, 0],
            y: [0, 60, -40, 0],
            scale: [1.1, 0.8, 1.3, 1.1],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="w-full h-full rounded-full bg-purple-500/20 blur-[100px]" />
        </motion.div>
        <motion.div
          className="absolute w-[400px] h-[400px] rounded-full"
          style={{ left: "30%", top: "20%" }}
          animate={{
            x: [0, 50, -30, 0],
            y: [0, -50, 30, 0],
            scale: [0.9, 1.3, 1, 0.9],
          }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="w-full h-full rounded-full bg-amber-500/15 blur-[80px]" />
        </motion.div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-3xl font-bold text-white mb-2">
            Mesh <span className="text-primary">Gradient</span>
          </h3>
          <p className="text-white/50 text-sm">Fluid organic gradient animations</p>
        </div>
      </div>
    </div>
  );
}

// Glow Effects
function GlowEffects() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {[
        {
          title: "Neon Glow",
          color: "shadow-[0_0_15px_rgba(201,100,66,0.5),0_0_30px_rgba(201,100,66,0.3),0_0_60px_rgba(201,100,66,0.15)]",
          border: "border-primary/50",
          text: "text-primary",
        },
        {
          title: "Purple Glow",
          color: "shadow-[0_0_15px_rgba(156,135,245,0.5),0_0_30px_rgba(156,135,245,0.3),0_0_60px_rgba(156,135,245,0.15)]",
          border: "border-purple-400/50",
          text: "text-purple-400",
        },
        {
          title: "Emerald Glow",
          color: "shadow-[0_0_15px_rgba(52,211,153,0.5),0_0_30px_rgba(52,211,153,0.3),0_0_60px_rgba(52,211,153,0.15)]",
          border: "border-emerald-400/50",
          text: "text-emerald-400",
        },
      ].map((glow, i) => (
        <motion.div
          key={glow.title}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.15, duration: 0.5 }}
          className={`relative p-8 rounded-2xl bg-black/60 border ${glow.border} ${glow.color} flex flex-col items-center justify-center text-center min-h-[180px]`}
        >
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 }}
          >
            <Zap className={`h-8 w-8 ${glow.text} mb-3`} />
          </motion.div>
          <h4 className={`text-lg font-bold ${glow.text} mb-1`}>{glow.title}</h4>
          <p className="text-white/40 text-xs">box-shadow glow effect</p>
        </motion.div>
      ))}
    </div>
  );
}

// Dot Matrix Pattern
function DotMatrix() {
  return (
    <div className="relative w-full h-[350px] overflow-hidden rounded-2xl bg-black flex items-center justify-center">
      <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="dotPattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill="rgba(201,100,66,0.6)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dotPattern)" />
      </svg>
      <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="dotPatternLarge" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="4" cy="4" r="2" fill="rgba(156,135,245,0.5)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dotPatternLarge)" />
      </svg>
      <motion.div
        className="relative z-10 text-center"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
      >
        <motion.div
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="inline-block mb-4"
        >
          <Circle className="h-12 w-12 text-primary/40" />
        </motion.div>
        <h3 className="text-3xl font-bold text-white mb-2">
          Dot <span className="text-primary">Matrix</span>
        </h3>
        <p className="text-white/40 text-sm">SVG-based decorative dot patterns</p>
      </motion.div>
    </div>
  );
}

// Glassmorphism Cards
function GlassmorphismShowcase() {
  const glasses = [
    { blur: "backdrop-blur-sm", label: "Blur 4px", opacity: "bg-white/5" },
    { blur: "backdrop-blur-md", label: "Blur 12px", opacity: "bg-white/10" },
    { blur: "backdrop-blur-xl", label: "Blur 24px", opacity: "bg-white/15" },
    { blur: "backdrop-blur-2xl", label: "Blur 40px", opacity: "bg-white/20" },
  ];

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-purple-900/30 to-black p-8 min-h-[400px]">
      {/* Background decorative elements */}
      <motion.div
        className="absolute w-40 h-40 rounded-full bg-primary/30 blur-[60px] top-10 left-10"
        animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
        transition={{ duration: 8, repeat: Infinity }}
      />
      <motion.div
        className="absolute w-32 h-32 rounded-full bg-purple-500/20 blur-[50px] bottom-10 right-10"
        animate={{ x: [0, -20, 0], y: [0, 30, 0] }}
        transition={{ duration: 6, repeat: Infinity }}
      />

      <div className="relative z-10">
        <h3 className="text-2xl font-bold text-white mb-6">
          <Ghost className="inline-block h-6 w-6 mr-2 text-primary" />
          Glassmorphism
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {glasses.map((glass, i) => (
            <motion.div
              key={glass.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className={`${glass.opacity} ${glass.blur} border border-white/20 rounded-xl p-6 flex flex-col items-center justify-center text-center min-h-[160px]`}
            >
              <Sun className="h-6 w-6 text-primary mb-3" />
              <p className="text-white font-semibold text-sm mb-1">{glass.label}</p>
              <p className="text-white/40 text-xs">{glass.opacity.replace("bg-white/", "opacity ")}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Floating Elements
function FloatingElements() {
  return (
    <div className="relative w-full h-[450px] overflow-hidden rounded-2xl bg-black">
      {/* Floating shapes */}
      {[
        { shape: "circle", size: 60, x: "15%", y: "20%", color: "bg-primary/30", duration: 5 },
        { shape: "square", size: 40, x: "75%", y: "15%", color: "bg-purple-500/25", duration: 7 },
        { shape: "circle", size: 30, x: "60%", y: "70%", color: "bg-emerald-500/25", duration: 4 },
        { shape: "square", size: 50, x: "25%", y: "65%", color: "bg-amber-500/25", duration: 6 },
        { shape: "circle", size: 20, x: "85%", y: "50%", color: "bg-pink-500/20", duration: 5.5 },
        { shape: "circle", size: 45, x: "45%", y: "35%", color: "bg-primary/20", duration: 8 },
        { shape: "square", size: 25, x: "10%", y: "45%", color: "bg-cyan-500/20", duration: 4.5 },
        { shape: "circle", size: 35, x: "50%", y: "80%", color: "bg-rose-500/20", duration: 6.5 },
      ].map((el, i) => (
        <motion.div
          key={i}
          className={`absolute ${el.color} ${el.shape === "circle" ? "rounded-full" : "rounded-lg rotate-45"}`}
          style={{
            width: el.size,
            height: el.size,
            left: el.x,
            top: el.y,
          }}
          animate={{
            y: [0, -25, 10, -15, 0],
            x: [0, 10, -10, 5, 0],
            rotate: el.shape === "square" ? [45, 90, 135, 180, 225, 270, 315, 360 + 45] : 0,
            scale: [1, 1.1, 0.95, 1.05, 1],
          }}
          transition={{
            duration: el.duration,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.3,
          }}
        />
      ))}

      {/* Particle dots */}
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={`dot-${i}`}
          className="absolute w-1 h-1 rounded-full bg-primary/40"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
          }}
          animate={{
            opacity: [0.2, 0.8, 0.2],
            scale: [1, 1.5, 1],
          }}
          transition={{
            duration: 2 + Math.random() * 3,
            repeat: Infinity,
            ease: "easeInOut",
            delay: Math.random() * 2,
          }}
        />
      ))}

      <div className="absolute inset-0 flex items-center justify-center z-10">
        <div className="text-center">
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sparkles className="h-10 w-10 text-primary mx-auto mb-3" />
          </motion.div>
          <h3 className="text-3xl font-bold text-white mb-2">
            Floating <span className="text-primary">Elements</span>
          </h3>
          <p className="text-white/40 text-sm max-w-sm mx-auto">
            Animated shapes and particles with framer-motion keyframe animations
          </p>
        </div>
      </div>
    </div>
  );
}

// Animated Gradient Border Card
function GradientBorderCard() {
  return (
    <div className="relative w-full overflow-hidden rounded-2xl p-[2px] bg-gradient-to-r from-primary via-purple-500 to-primary bg-[length:200%_100%] animate-[gradientShift_3s_ease-in-out_infinite]">
      <div className="bg-black rounded-2xl p-8 min-h-[200px] flex flex-col items-center justify-center text-center">
        <motion.div
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        >
          <Layers className="h-8 touch-target w-8 text-primary mb-3" />
        </motion.div>
        <h4 className="text-xl font-bold text-white mb-2">Animated Gradient Border</h4>
        <p className="text-white/40 text-sm">CSS gradient animation on border</p>
      </div>
      <style jsx>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  );
}

// Animated Beam Demo Component
function AnimatedBeamDemo() {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const fromRef = React.useRef<HTMLDivElement>(null);
  const toRef = React.useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      className="relative rounded-2xl border border-white/10 bg-black/80 p-8 overflow-hidden min-h-[280px] flex items-center justify-center"
    >
      <div className="flex items-center justify-between w-full max-w-md gap-12">
        <div
          ref={fromRef}
          className="relative z-10 flex flex-col items-center justify-center w-28 h-28 rounded-2xl border border-white/10 bg-white/5"
        >
          <MonitorSmartphone className="h-8 touch-target w-8 text-primary mb-2" />
          <span className="text-xs text-white/60 font-medium">Frontend</span>
        </div>
        <div
          ref={toRef}
          className="relative z-10 flex flex-col items-center justify-center w-28 h-28 rounded-2xl border border-white/10 bg-white/5"
        >
          <Server className="h-8 touch-target w-8 text-purple-400 mb-2" />
          <span className="text-xs text-white/60 font-medium">Backend</span>
        </div>
      </div>
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={fromRef}
        toRef={toRef}
        curvature={-40}
        pathColor="rgba(201,100,66,0.3)"
        pathWidth={3}
        gradientStartColor="#c96442"
        gradientStopColor="#d97757"
        duration={3}
      />
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={fromRef}
        toRef={toRef}
        curvature={40}
        pathColor="rgba(156,135,245,0.2)"
        pathWidth={2}
        gradientStartColor="#9c87f5"
        gradientStopColor="#c96442"
        duration={4}
        delay={0.5}
      />
    </div>
  );
}

export default function EffectsPage() {
  return (
    <div className="flex min-h-dvh">
      <SidebarNav />
      <main className="flex-1 overflow-y-auto overflow-x-hidden pt-16 md:pt-0">
        {/* Hero Section */}
        <div className="relative overflow-hidden bg-black py-20 section-padding">
          <motion.div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 50% 0%, rgba(201,100,66,0.15) 0%, transparent 60%)",
            }}
          />
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="relative z-10 max-w-4xl mx-auto text-center"
          >
            <Badge variant="outline" className="mb-4 border-primary/30 text-primary bg-primary/10">
              <Eye className="h-3 w-3 mr-1" />
              Visual Showcase
            </Badge>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4">
              Visual <span className="text-primary">Effects</span>
            </h1>
            <p className="text-white/50 text-lg max-w-2xl mx-auto">
              A curated collection of stunning visual effects built with CSS, SVG, and
              framer-motion. Each effect is crafted for maximum visual impact.
            </p>
          </motion.div>
        </div>

        <div className="section-padding py-6 sm:py-12 space-y-16 bg-[#0d0d0d]">
          {/* Particle Text Effect */}
          <motion.section
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Particle Text Effect
              </h2>
              <p className="text-white/40 text-sm mt-1">
                Interactive particle system that morphs between words
              </p>
            </div>
            <Card className="bg-black/80 border-white/10 overflow-hidden">
              <CardContent className="p-0">
                <ParticleTextEffect
                  words={["EFFECTS", "PIXELS", "MOTION", "GLOW", "MAGIC"]}
                />
              </CardContent>
            </Card>
          </motion.section>

          {/* Aurora Background */}
          <motion.section
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                Aurora Background
              </h2>
              <p className="text-white/40 text-sm mt-1">
                Animated northern lights using CSS gradients & framer-motion
              </p>
            </div>
            <AuroraBackground />
          </motion.section>

          {/* Mesh Gradient */}
          <motion.section
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Layers className="h-5 w-5 text-primary" />
                Mesh Gradient
              </h2>
              <p className="text-white/40 text-sm mt-1">
                Organic fluid gradient animations with overlapping blurs
              </p>
            </div>
            <MeshGradient />
          </motion.section>

          {/* Glow Effects */}
          <motion.section
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Glow Effects
              </h2>
              <p className="text-white/40 text-sm mt-1">
                Neon and box-shadow glow effects in different colors
              </p>
            </div>
            <GlowEffects />
          </motion.section>

          {/* Dot Matrix + Gradient Border */}
          <motion.section
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Circle className="h-5 w-5 text-primary" />
                Patterns & Borders
              </h2>
              <p className="text-white/40 text-sm mt-1">
                SVG dot matrix patterns and animated gradient borders
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <DotMatrix />
              <GradientBorderCard />
            </div>
          </motion.section>

          {/* Glassmorphism */}
          <motion.section
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Ghost className="h-5 w-5 text-primary" />
                Glassmorphism
              </h2>
              <p className="text-white/40 text-sm mt-1">
                Frosted glass effect cards with different blur levels
              </p>
            </div>
            <GlassmorphismShowcase />
          </motion.section>

          {/* Floating Elements */}
          <motion.section
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Floating Elements
              </h2>
              <p className="text-white/40 text-sm mt-1">
                Animated shapes and particles with keyframe animations
              </p>
            </div>
            <FloatingElements />
          </motion.section>

          {/* Border Beam */}
          <motion.section
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Border Beam
              </h2>
              <p className="text-white/40 text-sm mt-1">
                Animated beam of light traveling along the border of a card
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="relative rounded-2xl border border-white/10 bg-black/80 p-8 overflow-hidden">
                <BorderBeam
                  size={80}
                  duration={4}
                  colorFrom="#c96442"
                  colorTo="#d97757"
                  borderWidth={2}
                />
                <div className="flex flex-col items-center justify-center text-center min-h-[160px]">
                  <Zap className="h-8 touch-target w-8 text-primary mb-3" />
                  <h4 className="text-lg font-bold text-white mb-1">Terracotta Beam</h4>
                  <p className="text-white/40 text-xs">Animated border beam in primary colors</p>
                </div>
              </div>
              <div className="relative rounded-2xl border border-white/10 bg-black/80 p-8 overflow-hidden">
                <BorderBeam
                  size={80}
                  duration={4}
                  delay={2}
                  colorFrom="#9c40ff"
                  colorTo="#ffaa40"
                  borderWidth={2}
                />
                <BorderBeam
                  size={60}
                  duration={3}
                  colorFrom="#c96442"
                  colorTo="#d97757"
                  borderWidth={1}
                  reverse
                />
                <div className="flex flex-col items-center justify-center text-center min-h-[160px]">
                  <Layers className="h-8 touch-target w-8 text-purple-400 mb-3" />
                  <h4 className="text-lg font-bold text-white mb-1">Dual Beam</h4>
                  <p className="text-white/40 text-xs">Two beams traveling in opposite directions</p>
                </div>
              </div>
            </div>
          </motion.section>

          {/* Marquee */}
          <motion.section
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Marquee
              </h2>
              <p className="text-white/40 text-sm mt-1">
                Auto-scrolling marquee with tech stack names
              </p>
            </div>
            <Card className="bg-black/80 border-white/10 overflow-hidden">
              <CardContent className="p-6 space-y-4">
                <Marquee pauseOnHover className="[--duration:30s] [--gap:1.5rem]">
                  {[
                    "Next.js", "React", "TypeScript", "Tailwind CSS", "Framer Motion",
                    "Prisma", "tRPC", "Zustand", "Vercel", "shadcn/ui",
                    "Radix UI", "Zod", "React Query", "Lucide"
                  ].map((tech) => (
                    <div
                      key={tech}
                      className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-sm text-white/70 hover:text-primary hover:border-primary/30 transition-colors cursor-default"
                    >
                      <Zap className="h-3 w-3 text-primary" />
                      {tech}
                    </div>
                  ))}
                </Marquee>
                <Marquee reverse pauseOnHover className="[--duration:25s] [--gap:1.5rem]">
                  {[
                    "Node.js", "PostgreSQL", "Redis", "Docker", "Kubernetes",
                    "GraphQL", "REST API", "AWS", "CI/CD", "Git",
                    "WebSocket", "Stripe", "Auth.js", "Edge Runtime"
                  ].map((tech) => (
                    <div
                      key={tech}
                      className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-sm text-white/70 hover:text-primary hover:border-primary/30 transition-colors cursor-default"
                    >
                      <Sparkles className="h-3 w-3 text-purple-400" />
                      {tech}
                    </div>
                  ))}
                </Marquee>
              </CardContent>
            </Card>
          </motion.section>

          {/* Meteors */}
          <motion.section
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Circle className="h-5 w-5 text-primary" />
                Meteors
              </h2>
              <p className="text-white/40 text-sm mt-1">
                Meteor shower effect on a dark card with subtle trails
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="relative rounded-2xl border border-white/10 bg-black p-8 overflow-hidden min-h-[220px]">
                <Meteors number={15} />
                <div className="relative z-10 flex flex-col items-center justify-center text-center min-h-[160px]">
                  <h4 className="text-xl font-bold text-white mb-2">Meteor Shower</h4>
                  <p className="text-white/40 text-sm max-w-xs">
                    Animated meteors streaking across the card with varying speeds and delays
                  </p>
                </div>
              </div>
              <div className="relative rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-black p-8 overflow-hidden min-h-[220px]">
                <Meteors number={25} minDelay={0.1} maxDelay={0.8} minDuration={1} maxDuration={5} />
                <div className="relative z-10 flex flex-col items-center justify-center text-center min-h-[160px]">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <h4 className="text-xl font-bold text-white mb-2">Dense Meteor Field</h4>
                  <p className="text-white/40 text-sm max-w-xs">
                    Higher density meteors with faster animation and terracotta-tinted border
                  </p>
                </div>
              </div>
            </div>
          </motion.section>

          {/* Animated Beam */}
          <motion.section
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" />
                Animated Beam
              </h2>
              <p className="text-white/40 text-sm mt-1">
                SVG beam connecting two elements with animated gradient flow
              </p>
            </div>
            <AnimatedBeamDemo />
          </motion.section>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center py-8 border-t border-white/10"
          >
            <p className="text-white/30 text-sm">
              Built with ❤️ by Sandeep Gaddam
            </p>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
