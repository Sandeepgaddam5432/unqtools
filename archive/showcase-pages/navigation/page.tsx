"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SidebarNav } from "@/components/navigation/sidebar";
import { ExpandableTabs } from "@/components/ui/expandable-tabs";
import MacOSDock from "@/components/ui/mac-os-dock";
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
} from "@/components/ui/navigation-menu";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
  BreadcrumbEllipsis,
} from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Navigation,
  Home,
  LayoutDashboard,
  Component,
  Sparkles,
  CreditCard,
  FileText,
  Settings,
  Bell,
  Search,
  Menu,
  X,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  Layers,
  MapPin,
  FolderOpen,
  Heart,
  Moon,
  Sun,
  User,
  Globe,
  Zap,
  Mail,
  Star,
  Bookmark,
} from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";

// ===== ANIMATION VARIANTS =====
const sectionVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.25, 0.4, 0.25, 1] },
  },
};

// ===== DOCK APPS DATA =====
const makeSvgDataUri = (letter: string, bg: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56"><rect width="56" height="56" rx="14" fill="${bg}"/><text x="28" y="36" text-anchor="middle" font-size="22" font-weight="bold" font-family="system-ui" fill="white">${letter}</text></svg>`)}`;

const dockApps = [
  { id: "home", name: "Home", icon: makeSvgDataUri("H", "#c96442") },
  { id: "dashboard", name: "Dashboard", icon: makeSvgDataUri("D", "#10b981") },
  { id: "components", name: "Components", icon: makeSvgDataUri("C", "#8b5cf6") },
  { id: "animations", name: "Animations", icon: makeSvgDataUri("A", "#f59e0b") },
  { id: "cards", name: "Cards", icon: makeSvgDataUri("K", "#ec4899") },
  { id: "search", name: "Search", icon: makeSvgDataUri("S", "#06b6d4") },
  { id: "mail", name: "Mail", icon: makeSvgDataUri("M", "#ef4444") },
  { id: "settings", name: "Settings", icon: makeSvgDataUri("G", "#6b7280") },
];

// ===== FLOATING NAVBAR =====
function FloatingNavbar() {
  const [active, setActive] = useState("home");
  const links = [
    { id: "home", label: "Home", icon: Home },
    { id: "features", label: "Features", icon: Sparkles },
    { id: "components", label: "Components", icon: Component },
    { id: "docs", label: "Docs", icon: FileText },
    { id: "pricing", label: "Pricing", icon: CreditCard },
  ];

  return (
    <div className="relative flex justify-center">
      <motion.nav
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="inline-flex items-center gap-1 rounded-2xl border bg-background/80 backdrop-blur-xl px-2 py-1.5 shadow-lg"
      >
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = active === link.id;
          return (
            <button
              key={link.id}
              onClick={() => setActive(link.id)}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="floating-nav-active"
                  className="absolute inset-0 bg-primary/10 rounded-xl"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <Icon className="h-4 w-4 relative z-10" />
              <span className="relative z-10">{link.label}</span>
            </button>
          );
        })}
      </motion.nav>
    </div>
  );
}

// ===== SIDEBAR NAV DEMO =====
function SidebarDemo() {
  const [active, setActive] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const items = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "components", label: "Components", icon: Component },
    { id: "animations", label: "Animations", icon: Sparkles },
    { id: "cards", label: "Cards", icon: CreditCard },
    { id: "navigation", label: "Navigation", icon: Navigation },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="flex rounded-xl border overflow-hidden h-[400px]">
      {/* Sidebar */}
      <motion.div
        animate={{ width: collapsed ? 60 : 220 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="bg-muted/30 border-r flex flex-col"
      >
        {/* Logo area */}
        <div className="flex items-center gap-2 px-3 py-4 border-b">
          <div className="h-8 touch-target w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-primary font-bold text-sm">U</span>
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="font-bold text-sm whitespace-nowrap overflow-hidden"
              >
                UnQ<span className="text-primary">Web</span>
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActive(item.id)}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      className="whitespace-nowrap overflow-hidden"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="border-t p-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            {collapsed ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
          </button>
        </div>
      </motion.div>

      {/* Content area */}
      <div className="flex-1 p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Home className="h-3.5 w-3.5" />
          <ChevronRight className="h-3 w-3" />
          <span className="capitalize text-foreground font-medium">{active}</span>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <h3 className="font-semibold mb-2 capitalize">{active} Page</h3>
          <p className="text-sm text-muted-foreground">
            This is a demo sidebar navigation. Click items to switch, and toggle the collapse button.
          </p>
        </div>
      </div>
    </div>
  );
}

// ===== SECOND SIDEBAR STYLE =====
function MinimalSidebarDemo() {
  const [active, setActive] = useState("home");
  const items = [
    { id: "home", icon: Home, label: "Home" },
    { id: "explore", icon: Globe, label: "Explore" },
    { id: "bookmarks", icon: Bookmark, label: "Bookmarks" },
    { id: "messages", icon: Mail, label: "Messages" },
    { id: "profile", icon: User, label: "Profile" },
  ];

  return (
    <div className="flex rounded-xl border overflow-hidden h-[400px]">
      <div className="w-16 bg-card flex flex-col items-center py-4 gap-2 border-r">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActive(item.id)}
              className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
              title={item.label}
            >
              {isActive && (
                <motion.div
                  layoutId="minimal-sidebar-active"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <Icon className="h-5 w-5" />
            </button>
          );
        })}
        <div className="mt-auto">
          <button className="w-10 h-10 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer">
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div className="flex-1 p-6 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Icon-only sidebar style</p>
      </div>
    </div>
  );
}

export default function NavigationShowcase() {
  const { theme, setTheme } = useTheme();
  const [dockActive, setDockActive] = useState<string[]>(["home"]);
  const [expandableTab, setExpandableTab] = useState<number | null>(0);

  return (
    <div className="flex min-h-dvh bg-background">
      <SidebarNav />
      <main className="flex-1 overflow-y-auto overflow-x-hidden pt-16 md:pt-0">
        {/* Page Header */}
        <div className="border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-20">
          <div className="px-6 md:px-10 py-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="flex items-center gap-3 mb-3">
                <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
                  <Navigation className="h-3 w-3 mr-1" /> Navigation
                </Badge>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
                Navigation Showcase
              </h1>
              <p className="text-muted-foreground text-base md:text-lg max-w-2xl">
                Explore navigation patterns from expandable tabs to macOS-style docks.
                Every pattern is accessible, responsive, and beautifully animated.
              </p>
            </motion.div>
          </div>
        </div>

        <div className="px-6 md:px-10 py-8 space-y-12">
          {/* ===== EXPANDABLE TABS SECTION ===== */}
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
                    <CardTitle>Expandable Tabs</CardTitle>
                    <CardDescription>
                      Animated tabs that expand to reveal labels when selected
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <ExpandableTabs
                    tabs={[
                      { title: "Home", icon: Home },
                      { title: "Components", icon: Component },
                      { type: "separator" as const },
                      { title: "Animations", icon: Sparkles },
                      { title: "Cards", icon: CreditCard },
                      { type: "separator" as const },
                      { title: "Settings", icon: Settings },
                    ]}
                    selectedIndex={expandableTab}
                    onChange={setExpandableTab}
                  />
                  <p className="text-sm text-muted-foreground">
                    Click any tab to see the expand animation. Labels smoothly reveal with spring physics
                    while the active indicator transitions between items.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.section>

          {/* ===== MAC OS DOCK SECTION ===== */}
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
                    <CardTitle>macOS Dock</CardTitle>
                    <CardDescription>
                      Realistic dock with fish-eye magnification effect on hover
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="flex justify-center py-8 bg-black/20 rounded-xl">
                    <MacOSDock
                      apps={dockApps}
                      onAppClick={(id) => {
                        if (dockActive.includes(id)) {
                          setDockActive(dockActive.filter((a) => a !== id));
                        } else {
                          setDockActive([...dockActive, id]);
                        }
                      }}
                      openApps={dockActive}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    Hover over the dock to see the fish-eye magnification effect. Click apps to toggle
                    their &ldquo;running&rdquo; indicator. The dock uses requestAnimationFrame for buttery-smooth animation.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.section>

          {/* ===== NAVIGATION MENU SECTION ===== */}
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
                    <Navigation className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Navigation Menu</CardTitle>
                    <CardDescription>
                      Dropdown navigation with content panels and smooth transitions
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <NavigationMenu>
                    <NavigationMenuList>
                      <NavigationMenuItem>
                        <NavigationMenuTrigger>Getting Started</NavigationMenuTrigger>
                        <NavigationMenuContent>
                          <div className="w-[400px] p-4">
                            <div className="grid grid-cols-2 gap-4">
                              {[
                                { title: "Installation", description: "Set up UnQWebTemplate in minutes", icon: Zap },
                                { title: "Configuration", description: "Customize themes and settings", icon: Settings },
                                { title: "Components", description: "Explore 30+ UI components", icon: Component },
                                { title: "Animations", description: "Framer Motion integration", icon: Sparkles },
                              ].map((item) => {
                                const Icon = item.icon;
                                return (
                                  <NavigationMenuLink key={item.title} className="flex items-start gap-3 rounded-lg p-3 hover:bg-accent transition-colors cursor-pointer">
                                    <Icon className="h-5 w-5 text-primary mt-0.5" />
                                    <div>
                                      <p className="text-sm font-medium">{item.title}</p>
                                      <p className="text-xs text-muted-foreground">{item.description}</p>
                                    </div>
                                  </NavigationMenuLink>
                                );
                              })}
                            </div>
                          </div>
                        </NavigationMenuContent>
                      </NavigationMenuItem>
                      <NavigationMenuItem>
                        <NavigationMenuTrigger>Components</NavigationMenuTrigger>
                        <NavigationMenuContent>
                          <div className="w-[300px] p-4">
                            <div className="space-y-1">
                              {[
                                "Buttons & Badges",
                                "Cards & Layouts",
                                "Forms & Inputs",
                                "Dialogs & Sheets",
                                "Data Display",
                                "Navigation",
                              ].map((item) => (
                                <NavigationMenuLink key={item} className="block rounded-lg px-3 py-2 text-sm hover:bg-accent transition-colors cursor-pointer">
                                  {item}
                                </NavigationMenuLink>
                              ))}
                            </div>
                          </div>
                        </NavigationMenuContent>
                      </NavigationMenuItem>
                      <NavigationMenuItem>
                        <NavigationMenuTrigger>Resources</NavigationMenuTrigger>
                        <NavigationMenuContent>
                          <div className="w-[250px] p-4">
                            <div className="space-y-1">
                              {["Documentation", "Examples", "Changelog", "Community"].map((item) => (
                                <NavigationMenuLink key={item} className="block rounded-lg px-3 py-2 text-sm hover:bg-accent transition-colors cursor-pointer">
                                  {item}
                                </NavigationMenuLink>
                              ))}
                            </div>
                          </div>
                        </NavigationMenuContent>
                      </NavigationMenuItem>
                    </NavigationMenuList>
                  </NavigationMenu>
                  <p className="text-sm text-muted-foreground">
                    Hover over menu items to see animated dropdown panels. The navigation menu supports
                    rich content, icons, and multi-column layouts.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.section>

          {/* ===== BREADCRUMBS SECTION ===== */}
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
                    <MapPin className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Breadcrumbs</CardTitle>
                    <CardDescription>
                      Navigation trails that show hierarchy and current location
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  {/* Simple Breadcrumb */}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-3">Simple Path</p>
                    <Breadcrumb>
                      <BreadcrumbList>
                        <BreadcrumbItem>
                          <BreadcrumbLink href="#">Home</BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                          <BreadcrumbLink href="#">Components</BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                          <BreadcrumbPage>Navigation</BreadcrumbPage>
                        </BreadcrumbItem>
                      </BreadcrumbList>
                    </Breadcrumb>
                  </div>

                  <Separator />

                  {/* Deep Breadcrumb */}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-3">Deep Hierarchy</p>
                    <Breadcrumb>
                      <BreadcrumbList>
                        <BreadcrumbItem>
                          <BreadcrumbLink href="#">Home</BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                          <BreadcrumbEllipsis />
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                          <BreadcrumbLink href="#">Navigation</BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                          <BreadcrumbPage>Breadcrumbs</BreadcrumbPage>
                        </BreadcrumbItem>
                      </BreadcrumbList>
                    </Breadcrumb>
                  </div>

                  <Separator />

                  {/* With Icons */}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-3">With Icons</p>
                    <Breadcrumb>
                      <BreadcrumbList>
                        <BreadcrumbItem>
                          <BreadcrumbLink href="#" className="flex items-center gap-1">
                            <Home className="h-3.5 w-3.5" /> Home
                          </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </BreadcrumbSeparator>
                        <BreadcrumbItem>
                          <BreadcrumbLink href="#" className="flex items-center gap-1">
                            <FolderOpen className="h-3.5 w-3.5" /> Components
                          </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </BreadcrumbSeparator>
                        <BreadcrumbItem>
                          <BreadcrumbPage className="flex items-center gap-1">
                            <Navigation className="h-3.5 w-3.5" /> Breadcrumbs
                          </BreadcrumbPage>
                        </BreadcrumbItem>
                      </BreadcrumbList>
                    </Breadcrumb>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.section>

          {/* ===== FLOATING NAVBAR SECTION ===== */}
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
                    <Globe className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Floating Navbar</CardTitle>
                    <CardDescription>
                      A centered, pill-shaped navbar with animated active indicator
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <FloatingNavbar />
                  <p className="text-sm text-muted-foreground text-center">
                    Click nav items to see the shared layout animation. The active indicator smoothly
                    transitions between items using Framer Motion&apos;s layoutId.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.section>

          {/* ===== SIDEBAR NAVIGATION DEMOS SECTION ===== */}
          <motion.section
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={sectionVariants}
          >
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-8 touch-target w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <LayoutDashboard className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Sidebar Navigation</h2>
                  <p className="text-muted-foreground text-sm">Different sidebar styles for different use cases</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Full Sidebar */}
              <Card className="overflow-hidden border-border/50">
                <CardHeader>
                  <CardTitle className="text-base">Collapsible Sidebar</CardTitle>
                  <CardDescription>Full sidebar with collapse/expand animation</CardDescription>
                </CardHeader>
                <CardContent>
                  <SidebarDemo />
                </CardContent>
              </Card>

              {/* Icon-only Sidebar */}
              <Card className="overflow-hidden border-border/50">
                <CardHeader>
                  <CardTitle className="text-base">Icon-Only Sidebar</CardTitle>
                  <CardDescription>Minimal icon sidebar with active indicator</CardDescription>
                </CardHeader>
                <CardContent>
                  <MinimalSidebarDemo />
                </CardContent>
              </Card>
            </div>
          </motion.section>

          {/* ===== TOP NAVBAR VARIANTS ===== */}
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
                    <Star className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Top Navbar Variants</CardTitle>
                    <CardDescription>
                      Different top navigation bar styles for various layouts
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Minimal Top Bar */}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-3">Minimal Top Bar</p>
                    <div className="rounded-xl border bg-card overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 border-b">
                        <div className="flex items-center gap-2">
                          <div className="h-7 touch-target w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                            <span className="text-primary font-bold text-xs">U</span>
                          </div>
                          <span className="font-semibold text-sm">UnQWeb</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Search className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground transition-colors" />
                          <Bell className="h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground transition-colors" />
                          <div className="h-7 touch-target w-7 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-3.5 w-3.5 text-primary" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Centered Nav Bar */}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-3">Centered Navigation</p>
                    <div className="rounded-xl border bg-card overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-7 touch-target w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                            <span className="text-primary font-bold text-xs">U</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {["Products", "Solutions", "Resources", "Pricing"].map((item) => (
                            <button
                              key={item}
                              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted cursor-pointer"
                            >
                              {item}
                            </button>
                          ))}
                        </div>
                        <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                          Get Started
                        </Button>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Glassmorphism Top Bar */}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-3">Glassmorphism Bar</p>
                    <div className="rounded-xl overflow-hidden bg-gradient-to-r from-primary/20 via-violet-500/20 to-rose-500/20 p-4">
                      <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/10 dark:bg-white/5 backdrop-blur-xl border border-white/20">
                        <div className="flex items-center gap-2">
                          <div className="h-7 touch-target w-7 rounded-lg bg-white/10 flex items-center justify-center">
                            <span className="text-white font-bold text-xs">U</span>
                          </div>
                          <span className="font-semibold text-sm text-white">UnQWeb</span>
                        </div>
                        <div className="flex items-center gap-4">
                          {["Home", "Features", "About"].map((item) => (
                            <button
                              key={item}
                              className="text-sm text-white/60 hover:text-white transition-colors cursor-pointer"
                            >
                              {item}
                            </button>
                          ))}
                        </div>
                        <Button
                         
                          className="bg-white/10 text-white border border-white/20 hover:bg-white/20 backdrop-blur-sm"
                        >
                          Sign In
                        </Button>
                      </div>
                    </div>
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
