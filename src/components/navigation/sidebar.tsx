"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Home,
  Search,
  Info,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Heart,
  Menu,
  X,
  LayoutGrid,
  Download,
  Code2,
  Type,
  Calculator,
  Image as ImageIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { MobileHeader } from "./mobile-header";
import { ALL_CATEGORIES, CATEGORY_LABELS, type ToolCategory } from "@/lib/tool";

const CATEGORY_ICONS: Record<ToolCategory, typeof Code2> = {
  developer: Code2,
  text: Type,
  calculators: Calculator,
  image: ImageIcon,
  pdf: LayoutGrid,
  "audio-video": LayoutGrid,
  seo: LayoutGrid,
  "network-security": LayoutGrid,
  file: LayoutGrid,
  business: LayoutGrid,
  education: LayoutGrid,
  social: LayoutGrid,
  ai: LayoutGrid,
};

const navSections = [
  {
    label: "Main",
    items: [
      { href: "/", label: "Home", icon: Home },
      { href: "/tools", label: "All Tools", icon: LayoutGrid },
    ],
  },
  {
    label: "Categories",
    // v6.9: all 13 categories are always shown — empty ones render a Coming soon page.
    items: ALL_CATEGORIES.map((c) => ({
      href: `/category/${c}`,
      label: CATEGORY_LABELS[c].split(" ")[0].replace(/,$/, ""),
      icon: CATEGORY_ICONS[c] ?? LayoutGrid,
    })),
  },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const isActive = (href: string) =>
    mounted && (href === "/" ? pathname === "/" : (pathname?.startsWith(href) ?? false));

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
              initial= opacity: 0, width: 0 
              animate= opacity: 1, width: "auto" 
              exit= opacity: 0, width: 0 
              transition= duration: 0.2 
              className="overflow-hidden whitespace-nowrap"
            >
              <h1 className="text-base font-bold tracking-tight">
                UnQ<span className="text-primary">Tools</span>
              </h1>
              <p className="text-[10px] text-muted-foreground leading-tight">
                Private · Offline
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
                  initial= opacity: 0 
                  animate= opacity: 1 
                  exit= opacity: 0 
                  className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
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
                        ? "bg-primary/15 text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {active && (
                      <motion.div
                        layoutId="sidebar-active"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full"
                        transition=
                          type: "spring",
                          stiffness: 350,
                          damping: 30,
                        
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
                          initial= opacity: 0, width: 0 
                          animate= opacity: 1, width: "auto" 
                          exit= opacity: 0, width: 0 
                          transition= duration: 0.2 
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
                initial= opacity: 0 
                animate= opacity: 1 
                exit= opacity: 0 
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
              initial= opacity: 0 
              animate= opacity: 1 
              exit= opacity: 0 
              className="flex items-center justify-center gap-1 pt-2 text-[10px] text-muted-foreground"
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
      {/* Mobile Header Bar */}
      <MobileHeader menuOpen={mobileOpen} onMenuClick={() => setMobileOpen(!mobileOpen)} />

      {/* Mobile Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial= opacity: 0 
            animate= opacity: 1 
            exit= opacity: 0 
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            initial= x: -300 
            animate= x: 0 
            exit= x: -300 
            transition= type: "spring", stiffness: 300, damping: 30 
            className="fixed left-0 top-12 z-50 h-[calc(100%-3rem)] w-72 bg-background border-r border-border md:hidden"
          >
            {sidebarContent}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <motion.aside
        animate= width: collapsed ? 68 : 260 
        transition= type: "spring", stiffness: 300, damping: 30 
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
        initial= width: 260 
        animate= width: collapsed ? 68 : 260 
        transition= type: "spring", stiffness: 300, damping: 30 
        className="hidden md:block flex-shrink-0"
      />
    </>
  );
}
