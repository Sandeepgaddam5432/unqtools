"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Home,
  LayoutDashboard,
  Wand2,
  Component,
  Sparkles,
  CreditCard,
  Navigation,
  FileText,
  Table2,
  MessageSquare,
  Loader2,
  Atom,
  Search,
  CalendarClock,
  Info,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Heart,
  Menu,
  X,
  Layers,
  Rocket,
  Megaphone,
  LayoutGrid,
  Download,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

const navSections = [
  {
    label: "Main",
    items: [
      { href: "/", label: "Landing", icon: Home },
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/explorer", label: "Explorer", icon: Layers },
      { href: "/tools", label: "AI Tools", icon: Wand2 },
    ],
  },
  {
    label: "Pages",
    items: [
      { href: "/saas", label: "SaaS Landing", icon: Rocket },
      { href: "/marketing", label: "Marketing", icon: Megaphone },
      { href: "/blocks", label: "Blocks Gallery", icon: LayoutGrid },
    ],
  },
  {
    label: "Showcase",
    items: [
      { href: "/components", label: "Components", icon: Component },
      { href: "/animations", label: "Animations", icon: Sparkles },
      { href: "/cards", label: "Cards", icon: CreditCard },
      { href: "/navigation", label: "Navigation", icon: Navigation },
      { href: "/forms", label: "Forms", icon: FileText },
      { href: "/data-display", label: "Data Display", icon: Table2 },
      { href: "/feedback", label: "Feedback", icon: MessageSquare },
      { href: "/loaders", label: "Loaders", icon: Loader2 },
      { href: "/effects", label: "Effects", icon: Atom },
      { href: "/search", label: "Search", icon: Search },
      { href: "/calendar-clock", label: "Calendar & Clock", icon: CalendarClock },
    ],
  },
  {
    label: "Info",
    items: [{ href: "/about", label: "About", icon: Info }],
  },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-border/50">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 overflow-hidden">
          <img src="/logo.svg" alt="UnQ" className="w-full h-full object-cover" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden whitespace-nowrap"
            >
              <h1 className="text-base font-bold tracking-tight">
                UnQ<span className="text-primary">Web</span>
              </h1>
              <p className="text-[10px] text-muted-foreground leading-tight">
                Template
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-6">
        {navSections.map((section) => (
          <div key={section.label}>
            <AnimatePresence>
              {!collapsed && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60"
                >
                  {section.label}
                </motion.p>
              )}
            </AnimatePresence>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 group relative",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {active && (
                      <motion.div
                        layoutId="sidebar-active"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full"
                        transition={{
                          type: "spring",
                          stiffness: 350,
                          damping: 30,
                        }}
                      />
                    )}
                    <Icon
                      className={cn(
                        "h-4 w-4 flex-shrink-0 transition-colors",
                        active
                          ? "text-primary"
                          : "text-muted-foreground group-hover:text-foreground"
                      )}
                    />
                    <AnimatePresence>
                      {!collapsed && (
                        <motion.span
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: "auto" }}
                          exit={{ opacity: 0, width: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden whitespace-nowrap"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border/50 p-3 space-y-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            setTheme(theme === "dark" ? "light" : "dark")
          }
          className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm"
              >
                {theme === "dark" ? "Light Mode" : "Dark Mode"}
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center gap-1 pt-2 text-[10px] text-muted-foreground/60"
            >
              <span>Built with</span>
              <Heart className="h-3 w-3 text-red-500 fill-red-500" />
              <span>by Sandeep Gaddam</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 md:hidden p-2 rounded-xl bg-background/80 backdrop-blur-lg border border-border shadow-lg"
        aria-label="Toggle navigation"
      >
        {mobileOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <Menu className="h-5 w-5" />
        )}
      </button>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed left-0 top-0 z-50 h-full w-72 bg-background border-r border-border md:hidden"
          >
            {sidebarContent}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 68 : 260 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="hidden md:flex flex-col fixed left-0 top-0 h-full bg-background/80 backdrop-blur-xl border-r border-border/50 z-30"
      >
        {sidebarContent}

        {/* Collapse Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-7 w-6 h-6 rounded-full bg-background border border-border shadow-sm flex items-center justify-center hover:bg-muted transition-colors cursor-pointer"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronLeft className="h-3 w-3" />
          )}
        </button>
      </motion.aside>

      {/* Spacer */}
      <motion.div
        animate={{ width: collapsed ? 68 : 260 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="hidden md:block flex-shrink-0"
      />
    </>
  );
}
