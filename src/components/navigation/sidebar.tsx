"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Home,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Heart,
  LayoutGrid,
  Code2,
  Type,
  Calculator,
  Image as ImageIcon,
  FileText,
  Film,
  Globe,
  ShieldCheck,
  FolderOpen,
  Briefcase,
  GraduationCap,
  Share2,
  Sparkles,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { MobileHeader } from "./mobile-header";
import { ALL_CATEGORIES, CATEGORY_LABELS, type ToolCategory } from "@/lib/tool";
import { CATEGORY_COUNTS, TOOL_COUNT } from "@/lib/counts";

const TOOLS_COUNT = TOOL_COUNT;

const W_EXPANDED = 260;
const W_COLLAPSED = 68;

const CATEGORY_ICONS: Record<ToolCategory, typeof Code2> = {
  developer: Code2,
  text: Type,
  calculators: Calculator,
  image: ImageIcon,
  pdf: FileText,
  "audio-video": Film,
  seo: Globe,
  "network-security": ShieldCheck,
  file: FolderOpen,
  business: Briefcase,
  education: GraduationCap,
  social: Share2,
  ai: Sparkles,
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
      label: CATEGORY_LABELS[c].split(" ")[0].replace(/[,.;:]$/, ""),
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
  const counts = CATEGORY_COUNTS;
  useEffect(() => {
    setMounted(true);
  }, []);

  const isActive = (href: string) =>
    mounted && (href === "/" ? pathname === "/" : (pathname?.startsWith(href) ?? false));

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-border/50">
        <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/25 overflow-hidden shadow-sm">
          <img src="/logo.svg" alt="UnQ" width="36" height="36" className="w-full h-full object-cover" />
        </div>
        <div
          className={cn(
            "overflow-hidden whitespace-nowrap transition-[opacity,width] duration-200",
            collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
          )}
        >
          <h1 className="text-base font-bold tracking-tight">
            UnQ<span className="text-primary">Tools</span>
          </h1>
          <p className="text-[10px] text-muted-foreground leading-tight">
            Private · Offline · {TOOLS_COUNT} tools
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-6">
        {navSections.map((section) => (
          <div key={section.label}>
            <p
              className={cn(
                "px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground overflow-hidden transition-[opacity,height] duration-200",
                collapsed ? "h-0 opacity-0" : "h-auto opacity-100"
              )}
            >
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                const isCategory = item.href.startsWith("/category/");
                const count = isCategory
                  ? counts[item.href.replace("/category/", "") as ToolCategory] ?? 0
                  : null;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      // Apple sidebar row: solid accent tint when selected, hairline
                      // indicator bar; color-only transitions (200ms ease).
                      "group relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-[background-color,color] duration-200",
                      active
                        ? "bg-primary/12 text-foreground"
                        : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground"
                    )}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
                    )}
                    <Icon
                      className={cn(
                        "h-4 w-4 flex-shrink-0 transition-colors",
                        active
                          ? "text-primary"
                          : "text-muted-foreground group-hover:text-foreground"
                      )}
                    />
                    <span
                      className={cn(
                        "flex-1 overflow-hidden whitespace-nowrap transition-[opacity,width] duration-200",
                        collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
                      )}
                    >
                      {item.label}
                    </span>
                    {!collapsed && count != null && (
                      <span
                        className={cn(
                          "ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                          active
                            ? "bg-primary/15 text-primary"
                            : "bg-muted text-muted-foreground group-hover:bg-foreground/10"
                        )}
                      >
                        {count}
                      </span>
                    )}
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
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground touch-target"
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
          <span
            className={cn(
              "text-sm overflow-hidden whitespace-nowrap transition-[opacity,width] duration-200",
              collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
            )}
          >
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </span>
        </Button>
        <div
          className={cn(
            "flex items-center justify-center gap-1 pt-2 text-[10px] text-muted-foreground overflow-hidden transition-[opacity,height] duration-200",
            collapsed ? "h-0 opacity-0" : "h-auto opacity-100"
          )}
        >
          <span>Built with</span>
          <Heart className="h-3 w-3 text-red-500 fill-red-500" />
          <span>by Sandeep Gaddam</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Header Bar */}
      <MobileHeader menuOpen={mobileOpen} onMenuClick={() => setMobileOpen(!mobileOpen)} />

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="unq-animate-fade-in fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      {mobileOpen && (
        <aside className="unq-glass fixed left-0 top-12 z-50 h-[calc(100%-3rem)] w-72 border-r border-border md:hidden">
          {sidebarContent}
        </aside>
      )}

      {/* Desktop Sidebar */}
      <aside
        style={{ width: collapsed ? W_COLLAPSED : W_EXPANDED }}
        className="unq-glass hidden md:flex flex-col fixed left-0 top-0 h-full border-r border-border/50 z-30 transition-[width] duration-200"
      >
        {sidebarContent}

        {/* Collapse Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-7 w-6 h-6 rounded-full bg-card border border-border shadow-md flex items-center justify-center hover:bg-muted hover:text-primary transition-colors cursor-pointer"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronLeft className="h-3 w-3" />
          )}
        </button>
      </aside>

      {/* Spacer */}
      <div
        style={{ width: collapsed ? W_COLLAPSED : W_EXPANDED }}
        className="hidden md:block flex-shrink-0 transition-[width] duration-200"
      />
    </>
  );
}
