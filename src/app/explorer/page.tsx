"use client";

import React, { useState, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SidebarNav } from "@/components/navigation/sidebar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MagicCard } from "@/components/ui/magic-card";
import { BorderBeam } from "@/components/ui/border-beam";
import { Marquee } from "@/components/ui/marquee";
import { Meteors } from "@/components/ui/meteors";
import { OrbitingCircles } from "@/components/ui/orbiting-circles";
import { Particles } from "@/components/ui/particles";
import { Ripple } from "@/components/ui/ripple";
import { AnimatedGridPattern } from "@/components/ui/animated-grid-pattern";
import { DotPattern } from "@/components/ui/dot-pattern";
import { GridPattern } from "@/components/ui/grid-pattern";
import { NumberTicker } from "@/components/ui/number-ticker";
import { WordRotate } from "@/components/ui/word-rotate";
import { BlurFade } from "@/components/ui/blur-fade";
import { HyperText } from "@/components/ui/hyper-text";
import { AnimatedList, AnimatedListItem } from "@/components/ui/animated-list";
import { cn } from "@/lib/utils";
import {
  Search,
  Copy,
  Check,
  Sparkles,
  Layers,
  Palette,
  MousePointerClick,
  LayoutGrid,
  Navigation,
  Type,
  Table2,
  MessageSquare,
  Box,
  Filter,
  X,
  Code2,
  Package,
  Heart,
  Zap,
  Eye,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Source = "shadcn/ui" | "Magic UI" | "Custom";
type Category =
  | "All"
  | "Animations"
  | "Backgrounds"
  | "Cards"
  | "Effects"
  | "Inputs"
  | "Layout"
  | "Navigation"
  | "Text"
  | "Data Display"
  | "Feedback"
  | "3D";

interface ComponentEntry {
  name: string;
  slug: string;
  category: Category;
  source: Source;
  importPath: string;
  importStatement: string;
}

// ─── Component Catalog ───────────────────────────────────────────────────────

const catalog: ComponentEntry[] = [
  // Animations
  { name: "Animated Beam", slug: "animated-beam", category: "Animations", source: "Magic UI", importPath: "@/components/ui/animated-beam", importStatement: `import { AnimatedBeam } from "@/components/ui/animated-beam"` },
  { name: "Blur Fade", slug: "blur-fade", category: "Animations", source: "Magic UI", importPath: "@/components/ui/blur-fade", importStatement: `import { BlurFade } from "@/components/ui/blur-fade"` },
  { name: "Border Beam", slug: "border-beam", category: "Animations", source: "Magic UI", importPath: "@/components/ui/border-beam", importStatement: `import { BorderBeam } from "@/components/ui/border-beam"` },
  { name: "Marquee", slug: "marquee", category: "Animations", source: "Magic UI", importPath: "@/components/ui/marquee", importStatement: `import { Marquee } from "@/components/ui/marquee"` },
  { name: "Meteors", slug: "meteors", category: "Animations", source: "Magic UI", importPath: "@/components/ui/meteors", importStatement: `import { Meteors } from "@/components/ui/meteors"` },
  { name: "Orbiting Circles", slug: "orbiting-circles", category: "Animations", source: "Magic UI", importPath: "@/components/ui/orbiting-circles", importStatement: `import { OrbitingCircles } from "@/components/ui/orbiting-circles"` },
  { name: "Ripple", slug: "ripple", category: "Animations", source: "Magic UI", importPath: "@/components/ui/ripple", importStatement: `import { Ripple } from "@/components/ui/ripple"` },
  { name: "Word Rotate", slug: "word-rotate", category: "Animations", source: "Magic UI", importPath: "@/components/ui/word-rotate", importStatement: `import { WordRotate } from "@/components/ui/word-rotate"` },
  { name: "Number Ticker", slug: "number-ticker", category: "Animations", source: "Magic UI", importPath: "@/components/ui/number-ticker", importStatement: `import { NumberTicker } from "@/components/ui/number-ticker"` },
  { name: "Hyper Text", slug: "hyper-text", category: "Animations", source: "Magic UI", importPath: "@/components/ui/hyper-text", importStatement: `import { HyperText } from "@/components/ui/hyper-text"` },
  { name: "Scroll Velocity", slug: "scroll-based-velocity", category: "Animations", source: "Magic UI", importPath: "@/components/ui/scroll-based-velocity", importStatement: `import { ScrollVelocityRow } from "@/components/ui/scroll-based-velocity"` },
  { name: "Animated List", slug: "animated-list", category: "Animations", source: "Magic UI", importPath: "@/components/ui/animated-list", importStatement: `import { AnimatedList } from "@/components/ui/animated-list"` },
  { name: "Cool Mode", slug: "cool-mode", category: "Animations", source: "Magic UI", importPath: "@/components/ui/cool-mode", importStatement: `import { CoolMode } from "@/components/ui/cool-mode"` },

  // Backgrounds
  { name: "Animated Grid Pattern", slug: "animated-grid-pattern", category: "Backgrounds", source: "Magic UI", importPath: "@/components/ui/animated-grid-pattern", importStatement: `import { AnimatedGridPattern } from "@/components/ui/animated-grid-pattern"` },
  { name: "Dot Pattern", slug: "dot-pattern", category: "Backgrounds", source: "Magic UI", importPath: "@/components/ui/dot-pattern", importStatement: `import { DotPattern } from "@/components/ui/dot-pattern"` },
  { name: "Flickering Grid", slug: "flickering-grid", category: "Backgrounds", source: "Magic UI", importPath: "@/components/ui/flickering-grid", importStatement: `import { FlickeringGrid } from "@/components/ui/flickering-grid"` },
  { name: "Grid Pattern", slug: "grid-pattern", category: "Backgrounds", source: "Magic UI", importPath: "@/components/ui/grid-pattern", importStatement: `import { GridPattern } from "@/components/ui/grid-pattern"` },
  { name: "Particles", slug: "particles", category: "Backgrounds", source: "Magic UI", importPath: "@/components/ui/particles", importStatement: `import { Particles } from "@/components/ui/particles"` },

  // Cards
  { name: "Magic Card", slug: "magic-card", category: "Cards", source: "Magic UI", importPath: "@/components/ui/magic-card", importStatement: `import { MagicCard } from "@/components/ui/magic-card"` },
  { name: "Card", slug: "card", category: "Cards", source: "shadcn/ui", importPath: "@/components/ui/card", importStatement: `import { Card, CardHeader, CardContent } from "@/components/ui/card"` },

  // Effects
  { name: "Shimmer Border", slug: "shimmer-border", category: "Effects", source: "Magic UI", importPath: "@/components/ui/shimmer-border", importStatement: `import { ShimmerBorder } from "@/components/ui/shimmer-border"` },
  { name: "Border Beam FX", slug: "border-beam-fx", category: "Effects", source: "Magic UI", importPath: "@/components/ui/border-beam", importStatement: `import { BorderBeam } from "@/components/ui/border-beam"` },
  { name: "Ripple FX", slug: "ripple-fx", category: "Effects", source: "Magic UI", importPath: "@/components/ui/ripple", importStatement: `import { Ripple } from "@/components/ui/ripple"` },
  { name: "Cool Mode FX", slug: "cool-mode-fx", category: "Effects", source: "Magic UI", importPath: "@/components/ui/cool-mode", importStatement: `import { CoolMode } from "@/components/ui/cool-mode"` },

  // Inputs
  { name: "Input", slug: "input", category: "Inputs", source: "shadcn/ui", importPath: "@/components/ui/input", importStatement: `import { Input } from "@/components/ui/input"` },
  { name: "Textarea", slug: "textarea", category: "Inputs", source: "shadcn/ui", importPath: "@/components/ui/textarea", importStatement: `import { Textarea } from "@/components/ui/textarea"` },
  { name: "Select", slug: "select", category: "Inputs", source: "shadcn/ui", importPath: "@/components/ui/select", importStatement: `import { Select } from "@/components/ui/select"` },
  { name: "Checkbox", slug: "checkbox", category: "Inputs", source: "shadcn/ui", importPath: "@/components/ui/checkbox", importStatement: `import { Checkbox } from "@/components/ui/checkbox"` },
  { name: "Radio Group", slug: "radio-group", category: "Inputs", source: "shadcn/ui", importPath: "@/components/ui/radio-group", importStatement: `import { RadioGroup } from "@/components/ui/radio-group"` },
  { name: "Switch", slug: "switch", category: "Inputs", source: "shadcn/ui", importPath: "@/components/ui/switch", importStatement: `import { Switch } from "@/components/ui/switch"` },
  { name: "Slider", slug: "slider", category: "Inputs", source: "shadcn/ui", importPath: "@/components/ui/slider", importStatement: `import { Slider } from "@/components/ui/slider"` },
  { name: "Toggle", slug: "toggle", category: "Inputs", source: "shadcn/ui", importPath: "@/components/ui/toggle", importStatement: `import { Toggle } from "@/components/ui/toggle"` },

  // Layout
  { name: "Accordion", slug: "accordion", category: "Layout", source: "shadcn/ui", importPath: "@/components/ui/accordion", importStatement: `import { Accordion } from "@/components/ui/accordion"` },
  { name: "Tabs", slug: "tabs", category: "Layout", source: "shadcn/ui", importPath: "@/components/ui/tabs", importStatement: `import { Tabs } from "@/components/ui/tabs"` },
  { name: "Separator", slug: "separator", category: "Layout", source: "shadcn/ui", importPath: "@/components/ui/separator", importStatement: `import { Separator } from "@/components/ui/separator"` },
  { name: "Resizable", slug: "resizable", category: "Layout", source: "shadcn/ui", importPath: "@/components/ui/resizable", importStatement: `import { ResizablePanelGroup } from "@/components/ui/resizable"` },
  { name: "Scroll Area", slug: "scroll-area", category: "Layout", source: "shadcn/ui", importPath: "@/components/ui/scroll-area", importStatement: `import { ScrollArea } from "@/components/ui/scroll-area"` },
  { name: "Collapsible", slug: "collapsible", category: "Layout", source: "shadcn/ui", importPath: "@/components/ui/collapsible", importStatement: `import { Collapsible } from "@/components/ui/collapsible"` },
  { name: "Aspect Ratio", slug: "aspect-ratio", category: "Layout", source: "shadcn/ui", importPath: "@/components/ui/aspect-ratio", importStatement: `import { AspectRatio } from "@/components/ui/aspect-ratio"` },

  // Navigation
  { name: "Navigation Menu", slug: "navigation-menu", category: "Navigation", source: "shadcn/ui", importPath: "@/components/ui/navigation-menu", importStatement: `import { NavigationMenu } from "@/components/ui/navigation-menu"` },
  { name: "Breadcrumb", slug: "breadcrumb", category: "Navigation", source: "shadcn/ui", importPath: "@/components/ui/breadcrumb", importStatement: `import { Breadcrumb } from "@/components/ui/breadcrumb"` },
  { name: "Menubar", slug: "menubar", category: "Navigation", source: "shadcn/ui", importPath: "@/components/ui/menubar", importStatement: `import { Menubar } from "@/components/ui/menubar"` },
  { name: "Pagination", slug: "pagination", category: "Navigation", source: "shadcn/ui", importPath: "@/components/ui/pagination", importStatement: `import { Pagination } from "@/components/ui/pagination"` },
  { name: "Sidebar", slug: "sidebar", category: "Navigation", source: "shadcn/ui", importPath: "@/components/ui/sidebar", importStatement: `import { Sidebar } from "@/components/ui/sidebar"` },
  { name: "Expandable Tabs", slug: "expandable-tabs", category: "Navigation", source: "Custom", importPath: "@/components/ui/expandable-tabs", importStatement: `import { ExpandableTabs } from "@/components/ui/expandable-tabs"` },

  // Text
  { name: "Hyper Text TX", slug: "hyper-text-tx", category: "Text", source: "Magic UI", importPath: "@/components/ui/hyper-text", importStatement: `import { HyperText } from "@/components/ui/hyper-text"` },
  { name: "Word Rotate TX", slug: "word-rotate-tx", category: "Text", source: "Magic UI", importPath: "@/components/ui/word-rotate", importStatement: `import { WordRotate } from "@/components/ui/word-rotate"` },
  { name: "Number Ticker TX", slug: "number-ticker-tx", category: "Text", source: "Magic UI", importPath: "@/components/ui/number-ticker", importStatement: `import { NumberTicker } from "@/components/ui/number-ticker"` },
  { name: "Terminal", slug: "terminal", category: "Text", source: "Magic UI", importPath: "@/components/ui/terminal", importStatement: `import { Terminal } from "@/components/ui/terminal"` },

  // Data Display
  { name: "Table", slug: "table", category: "Data Display", source: "shadcn/ui", importPath: "@/components/ui/table", importStatement: `import { Table } from "@/components/ui/table"` },
  { name: "Data Table", slug: "basic-data-table", category: "Data Display", source: "Custom", importPath: "@/components/ui/basic-data-table", importStatement: `import { BasicDataTable } from "@/components/ui/basic-data-table"` },
  { name: "Timeline", slug: "timeline", category: "Data Display", source: "Custom", importPath: "@/components/ui/timeline", importStatement: `import { Timeline } from "@/components/ui/timeline"` },
  { name: "Badge", slug: "badge", category: "Data Display", source: "shadcn/ui", importPath: "@/components/ui/badge", importStatement: `import { Badge } from "@/components/ui/badge"` },
  { name: "Avatar", slug: "avatar", category: "Data Display", source: "shadcn/ui", importPath: "@/components/ui/avatar", importStatement: `import { Avatar } from "@/components/ui/avatar"` },
  { name: "Carousel", slug: "carousel", category: "Data Display", source: "shadcn/ui", importPath: "@/components/ui/carousel", importStatement: `import { Carousel } from "@/components/ui/carousel"` },
  { name: "Chart", slug: "chart", category: "Data Display", source: "shadcn/ui", importPath: "@/components/ui/chart", importStatement: `import { ChartContainer } from "@/components/ui/chart"` },

  // Feedback
  { name: "Alert", slug: "alert", category: "Feedback", source: "shadcn/ui", importPath: "@/components/ui/alert", importStatement: `import { Alert } from "@/components/ui/alert"` },
  { name: "Alert Banner", slug: "alert-banner", category: "Feedback", source: "Custom", importPath: "@/components/ui/alert-banner", importStatement: `import { AlertBanner } from "@/components/ui/alert-banner"` },
  { name: "Toast", slug: "toast", category: "Feedback", source: "shadcn/ui", importPath: "@/components/ui/toast", importStatement: `import { Toast } from "@/components/ui/toast"` },
  { name: "Custom Toast", slug: "custom-toast", category: "Feedback", source: "Custom", importPath: "@/components/ui/custom-toast", importStatement: `import { CustomToast } from "@/components/ui/custom-toast"` },
  { name: "Progress", slug: "progress", category: "Feedback", source: "shadcn/ui", importPath: "@/components/ui/progress", importStatement: `import { Progress } from "@/components/ui/progress"` },
  { name: "Skeleton", slug: "skeleton", category: "Feedback", source: "shadcn/ui", importPath: "@/components/ui/skeleton", importStatement: `import { Skeleton } from "@/components/ui/skeleton"` },
  { name: "Tooltip", slug: "tooltip", category: "Feedback", source: "shadcn/ui", importPath: "@/components/ui/tooltip", importStatement: `import { Tooltip } from "@/components/ui/tooltip"` },
  { name: "Hover Card", slug: "hover-card", category: "Feedback", source: "shadcn/ui", importPath: "@/components/ui/hover-card", importStatement: `import { HoverCard } from "@/components/ui/hover-card"` },

  // 3D
  { name: "Globe", slug: "globe", category: "3D", source: "Magic UI", importPath: "@/components/ui/globe", importStatement: `import { Globe } from "@/components/ui/globe"` },
  { name: "Mac OS Dock", slug: "mac-os-dock", category: "3D", source: "Custom", importPath: "@/components/ui/mac-os-dock", importStatement: `import { MacOSDock } from "@/components/ui/mac-os-dock"` },
  { name: "Cube Loader", slug: "cube-loader", category: "3D", source: "Custom", importPath: "@/components/ui/cube-loader", importStatement: `import { CubeLoader } from "@/components/ui/cube-loader"` },

  // Custom
  { name: "AI Gen", slug: "ai-gen", category: "Effects", source: "Custom", importPath: "@/components/ui/ai-gen", importStatement: `import { AIGen } from "@/components/ui/ai-gen"` },
  { name: "API Playground", slug: "api-playground", category: "Effects", source: "Custom", importPath: "@/components/ui/api-playground", importStatement: `import { APIPlayground } from "@/components/ui/api-playground"` },
  { name: "Glass Calendar", slug: "glass-calendar", category: "Effects", source: "Custom", importPath: "@/components/ui/glass-calendar", importStatement: `import { GlassCalendar } from "@/components/ui/glass-calendar"` },
  { name: "Glass Clock", slug: "glass-clock", category: "Effects", source: "Custom", importPath: "@/components/ui/glass-clock", importStatement: `import { GlassClock } from "@/components/ui/glass-clock"` },
  { name: "Particle Text", slug: "particle-text-effect", category: "Effects", source: "Custom", importPath: "@/components/ui/particle-text-effect", importStatement: `import { ParticleTextEffect } from "@/components/ui/particle-text-effect"` },
  { name: "Action Search", slug: "action-search-bar", category: "Navigation", source: "Custom", importPath: "@/components/ui/action-search-bar", importStatement: `import { ActionSearchBar } from "@/components/ui/action-search-bar"` },
  { name: "Shamayim Toggle", slug: "shamayim-toggle-switch", category: "Inputs", source: "Custom", importPath: "@/components/ui/shamayim-toggle-switch", importStatement: `import { ShamayimToggleSwitch } from "@/components/ui/shamayim-toggle-switch"` },
  { name: "Bento Grid", slug: "bento-grid", category: "Layout", source: "Custom", importPath: "@/components/ui/bento-grid", importStatement: `import { BentoGrid } from "@/components/ui/bento-grid"` },
  { name: "Shape Hero", slug: "shape-landing-hero", category: "Layout", source: "Custom", importPath: "@/components/ui/shape-landing-hero", importStatement: `import { ShapeLandingHero } from "@/components/ui/shape-landing-hero"` },
  { name: "Animated Testimonials", slug: "animated-testimonials", category: "Data Display", source: "Custom", importPath: "@/components/ui/animated-testimonials", importStatement: `import { AnimatedTestimonials } from "@/components/ui/animated-testimonials"` },
  { name: "Glass Testimonial Swiper", slug: "glass-testimonial-swiper", category: "Data Display", source: "Custom", importPath: "@/components/ui/glass-testimonial-swiper", importStatement: `import { GlassTestimonialSwiper } from "@/components/ui/glass-testimonial-swiper"` },
  { name: "Footer Section", slug: "footer-section", category: "Layout", source: "Custom", importPath: "@/components/ui/footer-section", importStatement: `import { FooterSection } from "@/components/ui/footer-section"` },
  { name: "Stack Feature", slug: "stack-feature-section", category: "Layout", source: "Custom", importPath: "@/components/ui/stack-feature-section", importStatement: `import { StackFeatureSection } from "@/components/ui/stack-feature-section"` },
  { name: "Radial Timeline", slug: "radial-orbital-timeline", category: "Data Display", source: "Custom", importPath: "@/components/ui/radial-orbital-timeline", importStatement: `import { RadialOrbitalTimeline } from "@/components/ui/radial-orbital-timeline"` },
  { name: "Post Card", slug: "post-card", category: "Cards", source: "Custom", importPath: "@/components/ui/post-card", importStatement: `import { PostCard } from "@/components/ui/post-card"` },
];

// ─── Category icons ──────────────────────────────────────────────────────────

const categoryIcons: Record<string, React.ReactNode> = {
  All: <Layers className="h-3.5 w-3.5" />,
  Animations: <Sparkles className="h-3.5 w-3.5" />,
  Backgrounds: <Palette className="h-3.5 w-3.5" />,
  Cards: <LayoutGrid className="h-3.5 w-3.5" />,
  Effects: <MousePointerClick className="h-3.5 w-3.5" />,
  Inputs: <Type className="h-3.5 w-3.5" />,
  Layout: <LayoutGrid className="h-3.5 w-3.5" />,
  Navigation: <Navigation className="h-3.5 w-3.5" />,
  Text: <Type className="h-3.5 w-3.5" />,
  "Data Display": <Table2 className="h-3.5 w-3.5" />,
  Feedback: <MessageSquare className="h-3.5 w-3.5" />,
  "3D": <Box className="h-3.5 w-3.5" />,
};

const categories: Category[] = [
  "All",
  "Animations",
  "Backgrounds",
  "Cards",
  "Effects",
  "Inputs",
  "Layout",
  "Navigation",
  "Text",
  "Data Display",
  "Feedback",
  "3D",
];

const sources: Source[] = ["shadcn/ui", "Magic UI", "Custom"];

const sourceColors: Record<Source, string> = {
  "shadcn/ui": "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  "Magic UI": "bg-violet-500/15 text-violet-400 border-violet-500/25",
  Custom: "bg-primary/15 text-primary border-primary/25",
};

// ─── Mini Preview Components ─────────────────────────────────────────────────

function MiniPreview({ slug }: { slug: string }) {
  const previewMap: Record<string, React.ReactNode> = {
    "animated-beam": (
      <div className="relative w-full h-24 flex items-center justify-center overflow-hidden rounded-lg bg-muted/30">
        <div className="flex items-center gap-6">
          <div className="w-8 h-8 rounded-lg bg-primary/30 border border-primary/40" />
          <div className="w-16 h-0.5 bg-gradient-to-r from-primary via-violet-400 to-primary animate-pulse" />
          <div className="w-8 h-8 rounded-lg bg-violet-500/30 border border-violet-500/40" />
        </div>
      </div>
    ),
    "blur-fade": (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg">
        <BlurFade delay={0.2} duration={0.6}>
          <span className="text-sm font-semibold text-foreground/80">Fade In</span>
        </BlurFade>
      </div>
    ),
    "border-beam": (
      <div className="relative w-full h-24 flex items-center justify-center overflow-hidden rounded-lg bg-muted/30 border border-border">
        <span className="text-xs text-muted-foreground z-10">Beam Border</span>
        <BorderBeam size={40} duration={3} />
      </div>
    ),
    "marquee": (
      <div className="w-full h-24 overflow-hidden rounded-lg bg-muted/30">
        <Marquee pauseOnHover className="[--duration:15s]">
          {["React", "Next.js", "Tailwind", "Motion", "TypeScript"].map((t) => (
            <span key={t} className="text-xs font-medium text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-full border border-border/50 mx-1">
              {t}
            </span>
          ))}
        </Marquee>
      </div>
    ),
    "meteors": (
      <div className="relative w-full h-24 overflow-hidden rounded-lg bg-muted/30 flex items-center justify-center">
        <Meteors number={6} />
        <span className="text-xs text-muted-foreground z-10">Meteors</span>
      </div>
    ),
    "orbiting-circles": (
      <div className="w-full h-24 flex items-center justify-center overflow-hidden rounded-lg bg-muted/30 relative">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full bg-primary/40 border border-primary/50" />
          </div>
          <OrbitingCircles radius={30} iconSize={14} duration={12}>
            <div className="w-3.5 h-3.5 rounded-full bg-emerald-400/60" />
            <div className="w-3.5 h-3.5 rounded-full bg-violet-400/60" />
            <div className="w-3.5 h-3.5 rounded-full bg-amber-400/60" />
          </OrbitingCircles>
        </div>
      </div>
    ),
    "ripple": (
      <div className="relative w-full h-24 overflow-hidden rounded-lg bg-muted/30 flex items-center justify-center">
        <Ripple mainCircleSize={40} numCircles={4} />
        <span className="text-xs text-muted-foreground z-10">Ripple</span>
      </div>
    ),
    "word-rotate": (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg">
        <WordRotate words={["Build", "Ship", "Scale"]} className="text-lg font-bold text-foreground" duration={2000} />
      </div>
    ),
    "number-ticker": (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg">
        <span className="text-2xl font-bold text-primary">
          <NumberTicker value={42} />
        </span>
      </div>
    ),
    "hyper-text": (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg overflow-hidden">
        <HyperText className="text-lg font-bold text-foreground" animateOnHover={true} startOnView={true}>
          Hello
        </HyperText>
      </div>
    ),
    "scroll-based-velocity": (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg overflow-hidden">
        <div className="flex gap-2 animate-pulse">
          {["S", "C", "R", "O", "L", "L"].map((l) => (
            <span key={l} className="text-sm font-bold text-primary/80 w-5 h-7 flex items-center justify-center bg-primary/10 rounded border border-primary/20">
              {l}
            </span>
          ))}
        </div>
      </div>
    ),
    "animated-list": (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg overflow-hidden px-4">
        <AnimatedList delay={800}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-muted/60 rounded-md px-3 py-1.5 text-xs text-muted-foreground border border-border/40">
              Item {i}
            </div>
          ))}
        </AnimatedList>
      </div>
    ),
    "cool-mode": (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg">
        <div className="flex gap-1">
          {["🎉", "✨", "🌟", "💫"].map((e, i) => (
            <span key={i} className="text-lg animate-bounce" style={{ animationDelay: `${i * 0.15}s` }}>{e}</span>
          ))}
        </div>
      </div>
    ),
    "animated-grid-pattern": (
      <div className="relative w-full h-24 overflow-hidden rounded-lg bg-muted/30">
        <AnimatedGridPattern numSquares={12} maxOpacity={0.4} duration={2} />
      </div>
    ),
    "dot-pattern": (
      <div className="relative w-full h-24 overflow-hidden rounded-lg bg-muted/30">
        <DotPattern glow width={12} height={12} cr={1.5} className="opacity-60" />
      </div>
    ),
    "flickering-grid": (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg">
        <div className="grid grid-cols-5 gap-1">
          {Array.from({ length: 15 }).map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-sm bg-primary/40 animate-pulse"
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
      </div>
    ),
    "grid-pattern": (
      <div className="relative w-full h-24 overflow-hidden rounded-lg bg-muted/30">
        <GridPattern width={20} height={20} className="opacity-50" />
      </div>
    ),
    "particles": (
      <div className="relative w-full h-24 overflow-hidden rounded-lg bg-muted/30">
        <Particles quantity={25} size={0.5} color="#d97757" />
      </div>
    ),
    "magic-card": (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg p-3">
        <MagicCard className="w-full h-full flex items-center justify-center cursor-pointer rounded-lg" gradientSize={120}>
          <span className="text-xs font-medium text-muted-foreground z-50">Hover Me</span>
        </MagicCard>
      </div>
    ),
    card: (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg p-3">
        <div className="w-full h-full rounded-lg border border-border bg-card p-2 flex flex-col gap-1">
          <div className="h-1.5 w-12 rounded bg-primary/30" />
          <div className="h-1 w-20 rounded bg-muted-foreground/20" />
          <div className="h-1 w-16 rounded bg-muted-foreground/15" />
        </div>
      </div>
    ),
    input: (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg p-3">
        <div className="w-full h-8 rounded-md border border-border bg-background px-3 flex items-center">
          <span className="text-xs text-muted-foreground/50">Type here...</span>
        </div>
      </div>
    ),
    textarea: (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg p-3">
        <div className="w-full h-full rounded-md border border-border bg-background p-2">
          <span className="text-xs text-muted-foreground/50">Enter text...</span>
        </div>
      </div>
    ),
    select: (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg p-3">
        <div className="w-full h-8 rounded-md border border-border bg-background px-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground/50">Select...</span>
          <span className="text-xs text-muted-foreground/40">▼</span>
        </div>
      </div>
    ),
    checkbox: (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg gap-3">
        {[true, false, true].map((c, i) => (
          <div key={i} className={cn("w-5 h-5 rounded border flex items-center justify-center", c ? "bg-primary border-primary" : "border-border bg-background")}>
            {c && <span className="text-[10px] text-primary-foreground font-bold">✓</span>}
          </div>
        ))}
      </div>
    ),
    "radio-group": (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg gap-3">
        {[true, false, false].map((c, i) => (
          <div key={i} className="w-5 h-5 rounded-full border border-border flex items-center justify-center bg-background">
            {c && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
          </div>
        ))}
      </div>
    ),
    switch: (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg gap-3">
        <div className="w-9 h-5 rounded-full bg-primary flex items-center px-0.5 justify-end">
          <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
        </div>
        <div className="w-9 h-5 rounded-full bg-muted flex items-center px-0.5">
          <div className="w-4 h-4 rounded-full bg-muted-foreground/30 shadow-sm" />
        </div>
      </div>
    ),
    slider: (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg px-6">
        <div className="w-full h-1.5 rounded-full bg-muted relative">
          <div className="h-full rounded-full bg-primary w-3/5" />
          <div className="absolute top-1/2 -translate-y-1/2 left-[60%] w-3.5 h-3.5 rounded-full bg-primary border-2 border-background shadow" />
        </div>
      </div>
    ),
    toggle: (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg gap-2">
        <div className="px-3 py-1.5 rounded-md bg-primary/15 text-primary text-xs font-medium border border-primary/25">Bold</div>
        <div className="px-3 py-1.5 rounded-md bg-muted text-muted-foreground text-xs font-medium border border-border">Italic</div>
        <div className="px-3 py-1.5 rounded-md bg-muted text-muted-foreground text-xs font-medium border border-border">U</div>
      </div>
    ),
    accordion: (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg p-2">
        <div className="w-full space-y-0.5">
          {["Section 1", "Section 2", "Section 3"].map((s, i) => (
            <div key={s} className="rounded-md border border-border/50 px-3 py-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">{s}</span>
                <span className="text-[10px] text-muted-foreground/60">{i === 0 ? "−" : "+"}</span>
              </div>
              {i === 0 && <div className="h-1 w-16 rounded bg-muted-foreground/15 mt-1" />}
            </div>
          ))}
        </div>
      </div>
    ),
    tabs: (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg p-2">
        <div className="w-full">
          <div className="flex gap-0 border-b border-border/50 mb-2">
            {["Tab 1", "Tab 2", "Tab 3"].map((t, i) => (
              <div key={t} className={cn("px-3 py-1 text-[10px] border-b-2", i === 0 ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground")}>
                {t}
              </div>
            ))}
          </div>
          <div className="h-1 w-12 rounded bg-muted-foreground/15" />
        </div>
      </div>
    ),
    separator: (
      <div className="w-full h-24 flex flex-col items-center justify-center bg-muted/30 rounded-lg px-4 gap-2">
        <div className="h-1 w-8 rounded bg-muted-foreground/20" />
        <div className="w-full h-px bg-border" />
        <div className="h-1 w-8 rounded bg-muted-foreground/20" />
      </div>
    ),
    resizable: (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg p-2">
        <div className="w-full h-full flex rounded-md border border-border/50 overflow-hidden">
          <div className="w-1/2 bg-muted/40 flex items-center justify-center"><span className="text-[9px] text-muted-foreground">Panel</span></div>
          <div className="w-1 bg-border/60 cursor-col-resize" />
          <div className="w-1/2 bg-muted/20 flex items-center justify-center"><span className="text-[9px] text-muted-foreground">Panel</span></div>
        </div>
      </div>
    ),
    "scroll-area": (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg p-2">
        <div className="w-full h-full rounded-md border border-border/50 bg-background p-2 space-y-1 overflow-hidden">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="h-2 w-full rounded bg-muted-foreground/10" />
          ))}
        </div>
      </div>
    ),
    collapsible: (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg p-2">
        <div className="w-full rounded-md border border-border/50 px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground font-medium">Collapse</span>
            <span className="text-[10px] text-muted-foreground/60">▼</span>
          </div>
        </div>
      </div>
    ),
    "aspect-ratio": (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg p-2">
        <div className="w-full max-w-16 aspect-square rounded-md border border-border/50 bg-muted/40 flex items-center justify-center">
          <span className="text-[9px] text-muted-foreground">1:1</span>
        </div>
      </div>
    ),
    "navigation-menu": (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg p-2">
        <div className="flex gap-2">
          {["Home", "About", "Contact"].map((item, i) => (
            <div key={item} className={cn("px-2.5 py-1 rounded-md text-[10px]", i === 0 ? "bg-primary/15 text-primary" : "text-muted-foreground")}>
              {item}
            </div>
          ))}
        </div>
      </div>
    ),
    breadcrumb: (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span>Home</span>
          <span className="text-muted-foreground/40">/</span>
          <span>Page</span>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-foreground font-medium">Current</span>
        </div>
      </div>
    ),
    menubar: (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg p-2">
        <div className="flex gap-0.5 border border-border/50 rounded-md p-0.5">
          {["File", "Edit", "View"].map((m) => (
            <div key={m} className="px-2.5 py-1 rounded text-[10px] text-muted-foreground hover:bg-muted/60">{m}</div>
          ))}
        </div>
      </div>
    ),
    pagination: (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg">
        <div className="flex items-center gap-1">
          <div className="w-6 h-6 rounded-md border border-border/50 flex items-center justify-center text-[9px] text-muted-foreground">‹</div>
          {[1, 2, 3].map((p) => (
            <div key={p} className={cn("w-6 h-6 rounded-md flex items-center justify-center text-[9px]", p === 1 ? "bg-primary text-primary-foreground" : "border border-border/50 text-muted-foreground")}>
              {p}
            </div>
          ))}
          <div className="w-6 h-6 rounded-md border border-border/50 flex items-center justify-center text-[9px] text-muted-foreground">›</div>
        </div>
      </div>
    ),
    sidebar: (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg p-2">
        <div className="w-full h-full flex rounded-md border border-border/50 overflow-hidden">
          <div className="w-8 bg-muted/60 space-y-1.5 py-2 px-1.5">
            {[1, 2, 3].map((n) => (
              <div key={n} className={cn("h-1.5 rounded", n === 1 ? "w-5 bg-primary/40" : "w-4 bg-muted-foreground/15")} />
            ))}
          </div>
          <div className="flex-1 p-2 space-y-1">
            <div className="h-1.5 w-10 rounded bg-muted-foreground/15" />
            <div className="h-1 w-14 rounded bg-muted-foreground/10" />
          </div>
        </div>
      </div>
    ),
    "expandable-tabs": (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg">
        <div className="flex gap-1 p-1 rounded-lg bg-muted/40 border border-border/40">
          {["📋", "📊", "⚙️"].map((e, i) => (
            <div key={i} className={cn("w-7 h-7 rounded-md flex items-center justify-center text-xs", i === 0 ? "bg-primary/20 border border-primary/30" : "")}>{e}</div>
          ))}
        </div>
      </div>
    ),
    "hyper-text-tx": (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg overflow-hidden">
        <HyperText className="text-lg font-bold text-primary" animateOnHover={true} startOnView={true}>
          Text
        </HyperText>
      </div>
    ),
    "word-rotate-tx": (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg">
        <WordRotate words={["Hello", "World"]} className="text-lg font-bold text-foreground" duration={2000} />
      </div>
    ),
    "number-ticker-tx": (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg">
        <span className="text-2xl font-bold text-primary">
          <NumberTicker value={99} />
        </span>
      </div>
    ),
    terminal: (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg p-2">
        <div className="w-full h-full rounded-md bg-[#1a1a1a] border border-border/30 overflow-hidden">
          <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-white/5">
            <div className="w-2 h-2 rounded-full bg-red-500/70" />
            <div className="w-2 h-2 rounded-full bg-yellow-500/70" />
            <div className="w-2 h-2 rounded-full bg-green-500/70" />
          </div>
          <div className="px-2 py-1.5">
            <span className="text-[9px] text-green-400/80 font-mono">$ npm run dev</span>
          </div>
        </div>
      </div>
    ),
    table: (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg p-2">
        <div className="w-full h-full rounded-md border border-border/50 overflow-hidden">
          <div className="grid grid-cols-3 gap-px bg-border/30">
            {["Name", "Type", "Status"].map((h) => (
              <div key={h} className="bg-muted/50 px-2 py-1 text-[8px] font-medium text-muted-foreground">{h}</div>
            ))}
            {["Row 1", "A", "●"].map((c) => (
              <div key={c} className="bg-background px-2 py-1 text-[8px] text-muted-foreground/60">{c}</div>
            ))}
            {["Row 2", "B", "●"].map((c) => (
              <div key={c} className="bg-background px-2 py-1 text-[8px] text-muted-foreground/60">{c}</div>
            ))}
          </div>
        </div>
      </div>
    ),
    "basic-data-table": (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg p-2">
        <div className="w-full h-full rounded-md border border-border/50 bg-background p-1.5">
          <div className="flex items-center justify-between mb-1">
            <div className="h-1.5 w-12 rounded bg-primary/30" />
            <div className="h-4 w-12 rounded bg-muted/60 text-[7px] text-muted-foreground flex items-center justify-center">Filter</div>
          </div>
          <div className="space-y-0.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-1">
                <div className="h-1.5 flex-1 rounded bg-muted-foreground/10" />
                <div className="h-1.5 flex-1 rounded bg-muted-foreground/8" />
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    timeline: (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg p-3">
        <div className="flex flex-col gap-0 w-full">
          {["Step 1", "Step 2", "Step 3"].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className="flex flex-col items-center">
                <div className={cn("w-2.5 h-2.5 rounded-full border-2", i === 0 ? "bg-primary border-primary" : "border-border bg-background")} />
                {i < 2 && <div className="w-0.5 h-3 bg-border" />}
              </div>
              <span className={cn("text-[9px]", i === 0 ? "text-primary font-medium" : "text-muted-foreground")}>{s}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    badge: (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg gap-2 flex-wrap px-4">
        <Badge variant="default" className="text-[9px]">Default</Badge>
        <Badge variant="secondary" className="text-[9px]">Secondary</Badge>
        <Badge variant="outline" className="text-[9px]">Outline</Badge>
      </div>
    ),
    avatar: (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg gap-2">
        {["SG", "UN", "QW"].map((initials, i) => (
          <div key={i} className={cn("w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-semibold", i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
            {initials}
          </div>
        ))}
      </div>
    ),
    carousel: (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg p-2">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border border-border/50 flex items-center justify-center text-[8px] text-muted-foreground">‹</div>
          <div className="w-16 h-12 rounded-md bg-muted/60 border border-border/40" />
          <div className="w-4 h-4 rounded-full border border-border/50 flex items-center justify-center text-[8px] text-muted-foreground">›</div>
        </div>
      </div>
    ),
    chart: (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg p-3">
        <div className="flex items-end gap-1 w-full h-full">
          {[40, 70, 50, 90, 60, 80, 55].map((h, i) => (
            <div key={i} className="flex-1 rounded-t-sm bg-primary/40" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    ),
    alert: (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg p-3">
        <div className="w-full rounded-md border border-border/50 bg-background px-3 py-2 flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-400/60" />
          <span className="text-[9px] text-muted-foreground">Alert message</span>
        </div>
      </div>
    ),
    "alert-banner": (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg p-3">
        <div className="w-full rounded-md bg-primary/15 border border-primary/25 px-3 py-2 flex items-center gap-2">
          <span className="text-[9px] text-primary font-medium">📢 Banner Alert</span>
        </div>
      </div>
    ),
    toast: (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg p-3">
        <div className="rounded-md border border-border/50 bg-background px-3 py-2 shadow-lg flex items-center gap-2">
          <span className="text-[9px] text-muted-foreground">✓ Toast notification</span>
        </div>
      </div>
    ),
    "custom-toast": (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg p-3">
        <div className="rounded-md bg-primary/15 border border-primary/25 px-3 py-2 shadow-lg flex items-center gap-2">
          <span className="text-[9px] text-primary font-medium">⚡ Custom Toast</span>
        </div>
      </div>
    ),
    progress: (
      <div className="w-full h-24 flex flex-col items-center justify-center bg-muted/30 rounded-lg gap-2 px-4">
        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full w-3/5 rounded-full bg-primary" />
        </div>
        <span className="text-[9px] text-muted-foreground">60%</span>
      </div>
    ),
    skeleton: (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg p-3">
        <div className="w-full space-y-2">
          <div className="h-3 w-3/4 rounded bg-muted-foreground/15 animate-pulse" />
          <div className="h-3 w-1/2 rounded bg-muted-foreground/10 animate-pulse" />
          <div className="h-3 w-2/3 rounded bg-muted-foreground/12 animate-pulse" />
        </div>
      </div>
    ),
    tooltip: (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg relative">
        <div className="px-3 py-1 rounded-md border border-border/50 text-[10px] text-muted-foreground">Hover me</div>
        <div className="absolute top-3 bg-foreground text-background text-[8px] px-2 py-1 rounded shadow-lg">
          Tooltip
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-foreground rotate-45" />
        </div>
      </div>
    ),
    "hover-card": (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg relative">
        <div className="px-3 py-1 rounded-md border border-border/50 text-[10px] text-primary">@username</div>
        <div className="absolute top-2 right-4 bg-popover border border-border/50 text-[8px] px-2.5 py-1.5 rounded-md shadow-lg">
          <div className="font-medium text-foreground">User Name</div>
          <div className="text-muted-foreground">Bio text here</div>
        </div>
      </div>
    ),
    globe: (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg">
        <div className="w-16 h-16 rounded-full border-2 border-primary/30 relative overflow-hidden">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 via-transparent to-violet-500/20" />
          <div className="absolute w-full h-px bg-primary/20 top-1/2" />
          <div className="absolute h-full w-px bg-primary/20 left-1/2" />
          <div className="absolute w-1.5 h-1.5 rounded-full bg-primary/60 top-[30%] left-[40%] animate-pulse" />
          <div className="absolute w-1 h-1 rounded-full bg-violet-400/60 top-[50%] left-[65%] animate-pulse" />
        </div>
      </div>
    ),
    "mac-os-dock": (
      <div className="w-full h-24 flex items-end justify-center bg-muted/30 rounded-lg pb-3">
        <div className="flex items-end gap-1.5 p-1.5 rounded-xl bg-background/60 border border-border/30 backdrop-blur-sm">
          {["🔍", "📁", "🌐", "📧", "🎵"].map((icon, i) => (
            <div key={i} className="w-6 h-6 rounded-lg bg-muted/60 flex items-center justify-center text-[10px] transition-transform hover:scale-125" style={{ transform: `scale(${i === 2 ? 1.2 : 1})` }}>
              {icon}
            </div>
          ))}
        </div>
      </div>
    ),
    "cube-loader": (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg">
        <div className="w-8 h-8 relative animate-spin" style={{ animationDuration: "3s" }}>
          <div className="absolute inset-0 border-2 border-primary/40 rounded-sm" />
          <div className="absolute inset-1 border border-primary/20 rounded-sm rotate-45" />
        </div>
      </div>
    ),
    "ai-gen": (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg p-3">
        <div className="w-full h-full rounded-md border border-primary/30 bg-primary/5 flex items-center justify-center gap-2">
          <Sparkles className="w-4 h-4 text-primary/60" />
          <span className="text-[10px] text-primary/70 font-medium">AI Generator</span>
        </div>
      </div>
    ),
    "api-playground": (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg p-3">
        <div className="w-full h-full rounded-md border border-border/50 bg-background flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border/30">
            <span className="text-[8px] font-bold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">GET</span>
            <span className="text-[8px] text-muted-foreground font-mono">/api/data</span>
          </div>
          <div className="flex-1 px-2 py-1">
            <span className="text-[7px] text-muted-foreground/50 font-mono">{"{ status: 200 }"}</span>
          </div>
        </div>
      </div>
    ),
    "glass-calendar": (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg p-2">
        <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 backdrop-blur-sm flex flex-col items-center justify-center">
          <span className="text-[7px] text-primary/70 font-medium uppercase">Mar</span>
          <span className="text-sm font-bold text-primary">15</span>
        </div>
      </div>
    ),
    "glass-clock": (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg p-2">
        <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center relative">
          <div className="absolute w-0.5 h-3 bg-primary/70 rounded-full origin-bottom" style={{ transform: "rotate(45deg) translateY(-50%)", top: "25%", left: "48%" }} />
          <div className="absolute w-0.5 h-4 bg-primary/50 rounded-full origin-bottom" style={{ transform: "rotate(180deg) translateY(-50%)", top: "20%", left: "48%" }} />
          <div className="w-1.5 h-1.5 rounded-full bg-primary/80" />
        </div>
      </div>
    ),
    "particle-text-effect": (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg p-2">
        <div className="flex gap-0.5">
          {"PARTICLE".split("").map((l, i) => (
            <span key={i} className="text-xs font-bold text-primary/60 animate-pulse" style={{ animationDelay: `${i * 0.1}s` }}>{l}</span>
          ))}
        </div>
      </div>
    ),
    "action-search-bar": (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg p-3">
        <div className="w-full h-7 rounded-lg border border-border/50 bg-background/80 backdrop-blur-sm px-3 flex items-center gap-2 shadow-lg">
          <Search className="w-3 h-3 text-muted-foreground/60" />
          <span className="text-[9px] text-muted-foreground/50">Search commands...</span>
          <span className="ml-auto text-[8px] text-muted-foreground/40 bg-muted/60 px-1.5 py-0.5 rounded">⌘K</span>
        </div>
      </div>
    ),
    "shamayim-toggle-switch": (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg gap-3">
        <div className="w-11 h-6 rounded-full bg-gradient-to-r from-primary/30 to-violet-500/30 border border-primary/20 flex items-center px-0.5 justify-end">
          <div className="w-5 h-5 rounded-full bg-white shadow-md" />
        </div>
      </div>
    ),
    "bento-grid": (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg p-2">
        <div className="grid grid-cols-3 grid-rows-2 gap-1 w-full h-full">
          <div className="col-span-2 row-span-1 rounded-md bg-primary/15 border border-primary/20" />
          <div className="row-span-2 rounded-md bg-violet-500/15 border border-violet-500/20" />
          <div className="rounded-md bg-emerald-500/15 border border-emerald-500/20" />
          <div className="rounded-md bg-amber-500/15 border border-amber-500/20" />
        </div>
      </div>
    ),
    "shape-landing-hero": (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg p-2">
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
          <div className="absolute w-16 h-16 bg-primary/10 rounded-full blur-md" />
          <div className="absolute w-10 h-10 bg-violet-500/10 rotate-45 blur-sm" />
          <span className="text-[10px] font-bold text-foreground/60 z-10">Hero</span>
        </div>
      </div>
    ),
    "animated-testimonials": (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg p-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-[8px] font-bold text-primary">JD</div>
          <div>
            <div className="h-1 w-10 rounded bg-muted-foreground/20" />
            <div className="h-1 w-14 rounded bg-muted-foreground/10 mt-1" />
          </div>
        </div>
      </div>
    ),
    "glass-testimonial-swiper": (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg p-2">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className={cn("h-10 w-16 rounded-md backdrop-blur-sm border flex items-center justify-center", i === 1 ? "bg-primary/10 border-primary/20 scale-105" : "bg-muted/30 border-border/30 opacity-60")}>
              <span className="text-[7px] text-muted-foreground">❝</span>
            </div>
          ))}
        </div>
      </div>
    ),
    "footer-section": (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg p-2">
        <div className="w-full h-full rounded-md border-t-2 border-primary/30 bg-muted/20 pt-2 px-3">
          <div className="flex items-center justify-between">
            <div className="h-1.5 w-10 rounded bg-primary/30" />
            <div className="flex gap-1">
              {[1, 2, 3].map((n) => (
                <div key={n} className="w-2.5 h-2.5 rounded-full bg-muted-foreground/15" />
              ))}
            </div>
          </div>
        </div>
      </div>
    ),
    "stack-feature-section": (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg p-2">
        <div className="w-full h-full flex flex-col items-center justify-center gap-1">
          <div className="h-1 w-12 rounded bg-primary/30" />
          <div className="flex gap-1">
            {["⚛️", "🔷", "🎨"].map((e, i) => (
              <div key={i} className="w-6 h-6 rounded-md bg-muted/50 border border-border/30 flex items-center justify-center text-[9px]">{e}</div>
            ))}
          </div>
        </div>
      </div>
    ),
    "radial-orbital-timeline": (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg p-2">
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 rounded-full border border-border/40" />
          <div className="absolute inset-2 rounded-full border border-primary/20" />
          {[0, 60, 120, 180, 240, 300].map((deg) => (
            <div key={deg} className="absolute w-2 h-2 rounded-full bg-primary/40" style={{ top: "50%", left: "50%", transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(-22px)` }} />
          ))}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-primary/60" />
          </div>
        </div>
      </div>
    ),
    "post-card": (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg p-2">
        <div className="w-full h-full rounded-md border border-border/50 bg-background p-2 flex flex-col gap-1">
          <div className="h-1.5 w-14 rounded bg-primary/30" />
          <div className="h-1 w-full rounded bg-muted-foreground/10" />
          <div className="h-1 w-3/4 rounded bg-muted-foreground/8" />
        </div>
      </div>
    ),
    "shimmer-border": (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg">
        <div className="w-16 h-10 rounded-lg border-2 border-primary/40 animate-pulse bg-primary/5 flex items-center justify-center">
          <span className="text-[8px] text-primary/70 font-medium">Shimmer</span>
        </div>
      </div>
    ),
    "border-beam-fx": (
      <div className="relative w-full h-24 flex items-center justify-center overflow-hidden rounded-lg bg-muted/30 border border-border">
        <span className="text-xs text-muted-foreground z-10">Border Beam</span>
        <BorderBeam size={50} duration={4} colorFrom="#d97757" colorTo="#9c87f5" />
      </div>
    ),
    "ripple-fx": (
      <div className="relative w-full h-24 overflow-hidden rounded-lg bg-muted/30 flex items-center justify-center">
        <Ripple mainCircleSize={30} numCircles={3} />
        <span className="text-xs text-muted-foreground z-10">Ripple</span>
      </div>
    ),
    "cool-mode-fx": (
      <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg">
        <div className="flex gap-1">
          {["🎉", "✨", "🌟", "💫", "🎊"].map((e, i) => (
            <span key={i} className="text-sm animate-bounce" style={{ animationDelay: `${i * 0.12}s` }}>{e}</span>
          ))}
        </div>
      </div>
    ),
  };

  return (
    <div className="w-full">
      {previewMap[slug] || (
        <div className="w-full h-24 flex items-center justify-center bg-muted/30 rounded-lg">
          <div className="flex items-center gap-1.5 text-muted-foreground/50">
            <Eye className="w-3 h-3" />
            <span className="text-[10px]">Preview</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Copy Button ─────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [text]);

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={handleCopy}
      className={cn(
        "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all duration-200",
        copied
          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
          : "bg-muted/60 text-muted-foreground border border-border/50 hover:bg-muted hover:text-foreground"
      )}
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied!" : "Copy Import"}
    </motion.button>
  );
}

// ─── View Code Dialog ────────────────────────────────────────────────────────

function CodeView({ importStatement }: { importStatement: string }) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShow(!show)}
        className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-muted/60 text-muted-foreground border border-border/50 hover:bg-muted hover:text-foreground transition-all duration-200"
      >
        <Code2 className="w-3 h-3" />
        View Code
      </motion.button>
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-0 mb-2 z-50 w-64 p-2 rounded-lg bg-[#1a1a1a] border border-border/30 shadow-xl"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] text-muted-foreground font-medium">Import Statement</span>
              <button onClick={() => setShow(false)} className="text-muted-foreground/50 hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            </div>
            <code className="text-[9px] text-emerald-400/90 font-mono leading-relaxed break-all">
              {importStatement}
            </code>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Component Card ──────────────────────────────────────────────────────────

function ComponentCard({
  entry,
  index,
}: {
  entry: ComponentEntry;
  index: number;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.03, 0.3), ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <MagicCard
        className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm hover:border-primary/30 transition-colors duration-300 cursor-default"
        gradientSize={150}
        gradientFrom="#d97757"
        gradientTo="#9c87f5"
        gradientColor="#d9775720"
        gradientOpacity={0.5}
      >
        <div className="p-4 space-y-3">
          {/* Preview */}
          <div className="rounded-lg overflow-hidden">
            <MiniPreview slug={entry.slug} />
          </div>

          {/* Info */}
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors duration-200 leading-tight">
                {entry.name}
              </h3>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-medium border-primary/25 text-primary bg-primary/8">
                {entry.category}
              </Badge>
              <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-4 font-medium", sourceColors[entry.source])}>
                {entry.source}
              </Badge>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <CodeView importStatement={entry.importStatement} />
              <CopyButton text={entry.importStatement} />
            </div>
          </div>
        </div>
      </MagicCard>
    </motion.div>
  );
}

// ─── Stats Counter ───────────────────────────────────────────────────────────

function StatsBar({ total, filtered }: { total: number; filtered: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center gap-4 text-xs text-muted-foreground"
    >
      <div className="flex items-center gap-1.5">
        <Package className="w-3.5 h-3.5 text-primary/60" />
        <span><span className="font-semibold text-foreground">{filtered}</span> / {total} components</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Zap className="w-3.5 h-3.5 text-amber-400/60" />
        <span><span className="font-semibold text-foreground">{catalog.filter((c) => c.source === "Magic UI").length}</span> Magic UI</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Layers className="w-3.5 h-3.5 text-emerald-400/60" />
        <span><span className="font-semibold text-foreground">{catalog.filter((c) => c.source === "shadcn/ui").length}</span> shadcn/ui</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-primary/60" />
        <span><span className="font-semibold text-foreground">{catalog.filter((c) => c.source === "Custom").length}</span> Custom</span>
      </div>
    </motion.div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ExplorerPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<Category>("All");
  const [activeSources, setActiveSources] = useState<Source[]>([]);
  const [showSourceFilter, setShowSourceFilter] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    return catalog.filter((entry) => {
      const matchesSearch =
        search.trim() === "" ||
        entry.name.toLowerCase().includes(search.toLowerCase()) ||
        entry.slug.toLowerCase().includes(search.toLowerCase()) ||
        entry.category.toLowerCase().includes(search.toLowerCase());

      const matchesCategory =
        activeCategory === "All" || entry.category === activeCategory;

      const matchesSource =
        activeSources.length === 0 || activeSources.includes(entry.source);

      return matchesSearch && matchesCategory && matchesSource;
    });
  }, [search, activeCategory, activeSources]);

  const toggleSource = (source: Source) => {
    setActiveSources((prev) =>
      prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]
    );
  };

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: catalog.length };
    categories.forEach((cat) => {
      if (cat !== "All") {
        counts[cat] = catalog.filter((c) => c.category === cat).length;
      }
    });
    return counts;
  }, []);

  return (
    <div className="min-h-dvh flex bg-background">
      <SidebarNav />

      <main className="flex-1 min-h-dvh overflow-x-hidden pt-16 md:pt-0" ref={scrollRef}>
        {/* ── Hero Header ─────────────────────────────────────────── */}
        <div className="relative overflow-hidden border-b border-border/50">
          {/* Background pattern */}
          <div className="absolute inset-0">
            <AnimatedGridPattern
              numSquares={30}
              maxOpacity={0.15}
              duration={3}
              className="opacity-40"
            />
          </div>

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background/80 to-background" />

          <div className="relative px-6 md:px-10 pt-16 pb-10">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="max-w-4xl"
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-primary/10 border border-primary/20">
                  <Layers className="w-4 h-4 text-primary" />
                </div>
                <Badge variant="outline" className="text-[10px] px-2 py-0.5 font-medium border-primary/25 text-primary bg-primary/8">
                  65+ Components
                </Badge>
              </div>

              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
                Component{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-primary/80 to-violet-400">
                  Explorer
                </span>
              </h1>

              <p className="text-muted-foreground text-sm md:text-base max-w-2xl mb-6">
                Browse, search, and explore every component in UnQWebTemplate. Copy import statements, preview live effects, and discover the perfect building blocks for your next project.
              </p>

              <StatsBar total={catalog.length} filtered={filtered.length} />
            </motion.div>
          </div>
        </div>

        {/* ── Search & Filters ─────────────────────────────────────── */}
        <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/50">
          <div className="px-6 md:px-10 py-4 space-y-3">
            {/* Search + Source filter */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                <Input
                  placeholder="Search components..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 bg-muted/30 border-border/50 text-sm placeholder:text-muted-foreground/40 focus-visible:ring-primary/30"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="relative">
                <Button
                  variant="outline"
                 
                  onClick={() => setShowSourceFilter(!showSourceFilter)}
                  className={cn(
                    "gap-1.5 h-9 text-xs border-border/50",
                    activeSources.length > 0 && "border-primary/30 bg-primary/5 text-primary"
                  )}
                >
                  <Filter className="w-3.5 h-3.5" />
                  Source
                  {activeSources.length > 0 && (
                    <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center font-bold">
                      {activeSources.length}
                    </span>
                  )}
                </Button>

                <AnimatePresence>
                  {showSourceFilter && (
                    <motion.div
                      initial={{ opacity: 0, y: 5, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 5, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute top-full right-0 mt-2 z-50 w-48 p-2 rounded-lg bg-card border border-border/50 shadow-xl"
                    >
                      {sources.map((source) => (
                        <button
                          key={source}
                          onClick={() => toggleSource(source)}
                          className={cn(
                            "w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-all duration-150",
                            activeSources.includes(source)
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <div
                            className={cn(
                              "w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors",
                              activeSources.includes(source)
                                ? "bg-primary border-primary"
                                : "border-border bg-background"
                            )}
                          >
                            {activeSources.includes(source) && (
                              <Check className="w-2.5 h-2.5 text-primary-foreground" />
                            )}
                          </div>
                          {source}
                        </button>
                      ))}
                      {activeSources.length > 0 && (
                        <button
                          onClick={() => setActiveSources([])}
                          className="w-full mt-1 pt-1.5 border-t border-border/30 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Clear filters
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Category Tabs */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {categories.map((cat) => {
                const isActive = activeCategory === cat;
                return (
                  <motion.button
                    key={cat}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setActiveCategory(cat)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 border",
                      isActive
                        ? "bg-primary/15 text-primary border-primary/25 shadow-sm shadow-primary/10"
                        : "bg-muted/30 text-muted-foreground border-transparent hover:bg-muted/60 hover:text-foreground"
                    )}
                  >
                    {categoryIcons[cat]}
                    {cat}
                    <span
                      className={cn(
                        "text-[9px] px-1 py-0 rounded-full",
                        isActive
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground/60"
                      )}
                    >
                      {categoryCounts[cat] || 0}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Component Grid ────────────────────────────────────────── */}
        <div className="px-6 md:px-10 py-8">
          <AnimatePresence mode="popLayout">
            {filtered.length > 0 ? (
              <motion.div
                layout
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
              >
                {filtered.map((entry, index) => (
                  <ComponentCard key={entry.slug} entry={entry} index={index} />
                ))}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-20 text-center"
              >
                <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mb-4">
                  <Search className="w-7 h-7 text-muted-foreground/30" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-1">No components found</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Try adjusting your search or filters to find what you&apos;re looking for.
                </p>
                <Button
                  variant="outline"
                 
                  className="mt-4"
                  onClick={() => {
                    setSearch("");
                    setActiveCategory("All");
                    setActiveSources([]);
                  }}
                >
                  Clear all filters
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Footer ───────────────────────────────────────────────── */}
        <footer className="border-t border-border/50 mt-auto">
          <div className="px-6 md:px-10 py-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Built with</span>
                <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" />
                <span>by <span className="font-medium text-foreground">Sandeep Gaddam</span></span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                <span>UnQWebTemplate</span>
                <span>·</span>
                <span>Next.js 16</span>
                <span>·</span>
                <span>TypeScript</span>
                <span>·</span>
                <span>Tailwind CSS</span>
                <span>·</span>
                <span>shadcn/ui + Magic UI</span>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
