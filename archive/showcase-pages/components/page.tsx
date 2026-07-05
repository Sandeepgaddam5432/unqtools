"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { SidebarNav } from "@/components/navigation/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  ArrowRight,
  Bell,
  Bookmark,
  ChevronRight,
  Download,
  Heart,
  Mail,
  Plus,
  Search,
  Settings,
  Share2,
  Star,
  Trash2,
  Zap,
  Sparkles,
  Component,
  Layers,
  Eye,
  MousePointerClick,
} from "lucide-react";

// Animation variants
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

export default function ComponentsShowcase() {
  const [tabValue, setTabValue] = useState("preview");

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
                  <Component className="h-3 w-3 mr-1" />
                  30+ Components
                </Badge>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
                Component Showcase
              </h1>
              <p className="text-muted-foreground text-base md:text-lg max-w-2xl">
                Every component in UnQWebTemplate, meticulously crafted with shadcn/ui.
                Interactive, accessible, and beautifully animated.
              </p>
            </motion.div>
          </div>
        </div>

        <div className="section-padding py-8 space-y-10">
          {/* ===== BUTTONS SECTION ===== */}
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
                    <CardTitle>Buttons</CardTitle>
                    <CardDescription>
                      All button variants, sizes, and icon combinations
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Variants */}
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-4">Variants</p>
                  <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    className="flex flex-wrap gap-3"
                  >
                    {[
                      { variant: "default" as const, label: "Default" },
                      { variant: "secondary" as const, label: "Secondary" },
                      { variant: "destructive" as const, label: "Destructive" },
                      { variant: "outline" as const, label: "Outline" },
                      { variant: "ghost" as const, label: "Ghost" },
                      { variant: "link" as const, label: "Link" },
                    ].map((btn) => (
                      <motion.div key={btn.variant} variants={staggerItem}>
                        <Button variant={btn.variant}>{btn.label}</Button>
                      </motion.div>
                    ))}
                  </motion.div>
                </div>

                <Separator />

                {/* Sizes */}
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-4">Sizes</p>
                  <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    className="flex flex-wrap items-center gap-3"
                  >
                    <motion.div variants={staggerItem}>
                      <Button size="sm">Small</Button>
                    </motion.div>
                    <motion.div variants={staggerItem}>
                      <Button size="default">Default</Button>
                    </motion.div>
                    <motion.div variants={staggerItem}>
                      <Button size="lg">Large</Button>
                    </motion.div>
                    <motion.div variants={staggerItem}>
                      <Button size="icon"><Star className="h-4 w-4" /></Button>
                    </motion.div>
                  </motion.div>
                </div>

                <Separator />

                {/* With Icons */}
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-4">With Icons</p>
                  <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    className="flex flex-wrap gap-3"
                  >
                    <motion.div variants={staggerItem}>
                      <Button><Mail className="h-4 w-4" /> Email</Button>
                    </motion.div>
                    <motion.div variants={staggerItem}>
                      <Button variant="secondary"><Download className="h-4 w-4" /> Download</Button>
                    </motion.div>
                    <motion.div variants={staggerItem}>
                      <Button variant="outline"><Search className="h-4 w-4" /> Search</Button>
                    </motion.div>
                    <motion.div variants={staggerItem}>
                      <Button variant="destructive"><Trash2 className="h-4 w-4" /> Delete</Button>
                    </motion.div>
                    <motion.div variants={staggerItem}>
                      <Button><Plus className="h-4 w-4" /> Add New</Button>
                    </motion.div>
                    <motion.div variants={staggerItem}>
                      <Button variant="outline">Continue <ArrowRight className="h-4 w-4" /></Button>
                    </motion.div>
                  </motion.div>
                </div>

                <Separator />

                {/* States */}
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-4">States</p>
                  <div className="flex flex-wrap gap-3">
                    <Button disabled>Disabled</Button>
                    <Button variant="outline" disabled>Disabled Outline</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.section>

          {/* ===== BADGES SECTION ===== */}
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
                    <Bookmark className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Badges</CardTitle>
                    <CardDescription>
                      Status indicators, labels, and category markers
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
                  className="flex flex-wrap gap-3"
                >
                  <motion.div variants={staggerItem}>
                    <Badge>Default</Badge>
                  </motion.div>
                  <motion.div variants={staggerItem}>
                    <Badge variant="secondary">Secondary</Badge>
                  </motion.div>
                  <motion.div variants={staggerItem}>
                    <Badge variant="destructive">Destructive</Badge>
                  </motion.div>
                  <motion.div variants={staggerItem}>
                    <Badge variant="outline">Outline</Badge>
                  </motion.div>
                  <motion.div variants={staggerItem}>
                    <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                      <Zap className="h-3 w-3 mr-1" /> Active
                    </Badge>
                  </motion.div>
                  <motion.div variants={staggerItem}>
                    <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                      <Star className="h-3 w-3 mr-1 fill-amber-500" /> Featured
                    </Badge>
                  </motion.div>
                  <motion.div variants={staggerItem}>
                    <Badge className="bg-primary/10 text-primary border-primary/20">
                      <Sparkles className="h-3 w-3 mr-1" /> New
                    </Badge>
                  </motion.div>
                </motion.div>
              </CardContent>
            </Card>
          </motion.section>

          {/* ===== CARDS SECTION ===== */}
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
                    <CardTitle>Cards</CardTitle>
                    <CardDescription>
                      Versatile card layouts with headers, content, and footers
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Simple Card */}
                  <motion.div
                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                    className="rounded-xl border bg-card p-6 shadow-sm"
                  >
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <Zap className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">Simple Card</h3>
                    <p className="text-sm text-muted-foreground">
                      A clean, minimal card with an icon, title, and description. Perfect for feature highlights.
                    </p>
                  </motion.div>

                  {/* Card with Header & Footer */}
                  <motion.div
                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                    className="rounded-xl border bg-card shadow-sm flex flex-col"
                  >
                    <div className="p-6 pb-3">
                      <h3 className="font-semibold mb-1">Header & Footer</h3>
                      <p className="text-sm text-muted-foreground">Card with structured sections</p>
                    </div>
                    <div className="px-6 py-4 flex-1">
                      <div className="h-20 rounded-lg bg-muted/50 flex items-center justify-center">
                        <Eye className="h-6 w-6 text-muted-foreground/40" />
                      </div>
                    </div>
                    <div className="px-6 py-3 border-t flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">Footer info</span>
                      <Button variant="ghost" size="sm">Action</Button>
                    </div>
                  </motion.div>

                  {/* Gradient Card */}
                  <motion.div
                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                    className="rounded-xl border bg-gradient-to-br from-primary/5 via-transparent to-primary/10 p-6 shadow-sm relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -translate-y-8 translate-x-8 blur-xl" />
                    <div className="relative">
                      <Badge className="bg-primary/10 text-primary border-primary/20 mb-3">Premium</Badge>
                      <h3 className="font-semibold mb-2">Gradient Card</h3>
                      <p className="text-sm text-muted-foreground">
                        Cards with subtle gradients and glow effects for a premium feel.
                      </p>
                    </div>
                  </motion.div>
                </div>
              </CardContent>
            </Card>
          </motion.section>

          {/* ===== AVATARS SECTION ===== */}
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
                    <Heart className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Avatars</CardTitle>
                    <CardDescription>
                      User representations with images and fallbacks
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Sizes */}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-4">Sizes</p>
                    <div className="flex items-end gap-4">
                      <div className="text-center">
                        <Avatar className="h-8 touch-target w-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">SM</AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-muted-foreground mt-1">SM</span>
                      </div>
                      <div className="text-center">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm">MD</AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-muted-foreground mt-1">MD</span>
                      </div>
                      <div className="text-center">
                        <Avatar className="h-14 w-14">
                          <AvatarFallback className="bg-primary/10 text-primary text-lg">LG</AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-muted-foreground mt-1">LG</span>
                      </div>
                      <div className="text-center">
                        <Avatar className="h-20 w-20">
                          <AvatarFallback className="bg-primary/10 text-primary text-2xl">XL</AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-muted-foreground mt-1">XL</span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* With Images & Fallbacks */}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-4">With Images & Fallbacks</p>
                    <div className="flex -space-x-3">
                      {[
                        { name: "SG", img: "https://randomuser.me/api/portraits/men/32.jpg", color: "bg-primary/10 text-primary" },
                        { name: "PS", img: "https://randomuser.me/api/portraits/women/44.jpg", color: "bg-emerald-500/10 text-emerald-500" },
                        { name: "MC", img: "https://randomuser.me/api/portraits/men/46.jpg", color: "bg-amber-500/10 text-amber-500" },
                        { name: "EV", img: "", color: "bg-rose-500/10 text-rose-500" },
                        { name: "RK", img: "", color: "bg-violet-500/10 text-violet-500" },
                      ].map((avatar, i) => (
                        <Avatar key={i} className="border-2 border-background h-10 w-10">
                          {avatar.img && <AvatarImage src={avatar.img} alt={avatar.name} />}
                          <AvatarFallback className={avatar.color}>{avatar.name}</AvatarFallback>
                        </Avatar>
                      ))}
                      <div className="flex items-center justify-center h-10 w-10 rounded-full bg-muted border-2 border-background text-xs font-medium text-muted-foreground">
                        +12
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.section>

          {/* ===== ACCORDION SECTION ===== */}
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
                    <ChevronRight className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Accordion</CardTitle>
                    <CardDescription>
                      Collapsible content sections with smooth animations
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {[
                    {
                      value: "item-1",
                      title: "What makes UnQWebTemplate different?",
                      content:
                        "UnQWebTemplate combines cinematic animations, glassmorphism effects, and a carefully curated terracotta color palette. Every component is built with accessibility and performance in mind, powered by Next.js 16 and shadcn/ui.",
                    },
                    {
                      value: "item-2",
                      title: "Is it production-ready?",
                      content:
                        "Absolutely. With 15+ pre-built pages, 30+ components, TypeScript throughout, and comprehensive dark mode support, UnQWebTemplate is designed for real-world production applications from day one.",
                    },
                    {
                      value: "item-3",
                      title: "How does the AI integration work?",
                      content:
                        "The template includes a built-in AI generation studio and API playground. These tools leverage cutting-edge AI APIs to help you generate content, images, and code directly within your application.",
                    },
                    {
                      value: "item-4",
                      title: "Can I customize the theme?",
                      content:
                        "Yes! The entire color system is built on CSS variables, making it trivial to swap the terracotta palette for any color scheme. Dark and light modes are fully supported with seamless transitions.",
                    },
                  ].map((item) => (
                    <AccordionItem key={item.value} value={item.value}>
                      <AccordionTrigger className="text-left hover:no-underline">
                        {item.title}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {item.content}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </motion.section>

          {/* ===== DIALOG SECTION ===== */}
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
                    <Share2 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Dialog</CardTitle>
                    <CardDescription>
                      Modal overlays for confirmations, forms, and detailed content
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Settings className="h-4 w-4" /> Open Dialog
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Confirm Action</DialogTitle>
                      <DialogDescription>
                        This is a beautifully styled dialog with smooth enter/exit
                        animations. Use dialogs for confirmations, forms, or focused content.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <div className="rounded-lg bg-muted/50 p-4 border">
                        <p className="text-sm text-muted-foreground">
                          Dialogs in UnQWebTemplate feature backdrop blur, smooth transitions,
                          and full keyboard accessibility. Press Escape to close.
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline">Cancel</Button>
                      <Button>Confirm</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </motion.section>

          {/* ===== TABS SECTION ===== */}
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
                    <CardTitle>Tabs</CardTitle>
                    <CardDescription>
                      Organize content into switchable panels with animated transitions
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs value={tabValue} onValueChange={setTabValue}>
                  <TabsList className="mb-4">
                    <TabsTrigger value="preview">Preview</TabsTrigger>
                    <TabsTrigger value="code">Code</TabsTrigger>
                    <TabsTrigger value="docs">Docs</TabsTrigger>
                  </TabsList>
                  <TabsContent value="preview">
                    <motion.div
                      key="preview"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                      className="rounded-lg border bg-muted/30 p-6"
                    >
                      <div className="flex items-center gap-4 mb-4">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="bg-primary/10 text-primary">UN</AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold">UnQWebTemplate</h3>
                          <p className="text-sm text-muted-foreground">Premium Next.js UI Template</p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        This is the preview panel showing a sample component layout with
                        avatar, heading, and description text.
                      </p>
                    </motion.div>
                  </TabsContent>
                  <TabsContent value="code">
                    <motion.div
                      key="code"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                      className="rounded-lg bg-muted/50 p-6 font-mono text-sm"
                    >
                      <div className="text-muted-foreground">
                        <span className="text-primary">import</span>{" "}
                        {"{ Button }"}{" "}
                        <span className="text-primary">from</span>{" "}
                        <span className="text-emerald-500">"@/components/ui/button"</span>;{"\n\n"}
                        <span className="text-primary">export default</span>{" "}
                        <span className="text-amber-500">function</span>{" "}
                        <span className="text-foreground">Page</span>() {"{"}{"\n"}
                        {"  "}{"return"} (
                        <span className="text-primary">{"<Button>"}</span>
                        Click
                        <span className="text-primary">{"</Button>"}</span>
                        );{"\n"}
                        {"}"}
                      </div>
                    </motion.div>
                  </TabsContent>
                  <TabsContent value="docs">
                    <motion.div
                      key="docs"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                      className="rounded-lg border p-6"
                    >
                      <h3 className="font-semibold mb-2">Tab Component API</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Tabs organize content across different screens, data sets, and interactions.
                      </p>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Badge variant="outline" className="font-mono">Tabs</Badge>
                          <span className="text-muted-foreground">Root container component</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Badge variant="outline" className="font-mono">TabsList</Badge>
                          <span className="text-muted-foreground">Container for tab triggers</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Badge variant="outline" className="font-mono">TabsTrigger</Badge>
                          <span className="text-muted-foreground">Button to activate a tab</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Badge variant="outline" className="font-mono">TabsContent</Badge>
                          <span className="text-muted-foreground">Panel for tab content</span>
                        </div>
                      </div>
                    </motion.div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </motion.section>

          {/* ===== COMBINED SHOWCASE ===== */}
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
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Combined Example</CardTitle>
                    <CardDescription>
                      All components working together in a real-world layout
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border bg-card p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src="https://randomuser.me/api/portraits/men/32.jpg" alt="User" />
                        <AvatarFallback className="bg-primary/10 text-primary">SG</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">Sandeep Gaddam</p>
                        <p className="text-xs text-muted-foreground">Creator of UnQWebTemplate</p>
                      </div>
                    </div>
                    <Badge className="bg-primary/10 text-primary border-primary/20">
                      <Star className="h-3 w-3 mr-1 fill-primary" /> Featured
                    </Badge>
                  </div>
                  <Separator />
                  <p className="text-sm text-muted-foreground">
                    This example combines Avatar, Badge, Separator, Button, and Card components
                    into a cohesive user card layout. Each component maintains its own
                    accessibility and styling while composing seamlessly together.
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm"><Bell className="h-3.5 w-3.5" /> Follow</Button>
                    <Button size="sm" variant="outline"><Mail className="h-3.5 w-3.5" /> Message</Button>
                  </div>
                </div>
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
