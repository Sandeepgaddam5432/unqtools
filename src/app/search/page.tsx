"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SidebarNav } from "@/components/navigation/sidebar";
import { ActionSearchBar } from "@/components/ui/action-search-bar";
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from "@/components/ui/command";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  CommandIcon,
  FileText,
  Component,
  BookOpen,
  Settings,
  LayoutDashboard,
  Palette,
  Sparkles,
  Keyboard,
  Clock,
  ArrowRight,
  Hash,
  Layers,
  Zap,
  Globe,
  Code2,
  X,
} from "lucide-react";

const sectionVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

// Global Search Bar with Autocomplete
function GlobalSearchBar() {
  const [query, setQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestions = [
    { text: "Effects Showcase", icon: Sparkles, category: "Pages" },
    { text: "Component Library", icon: Component, category: "Pages" },
    { text: "Animation System", icon: Zap, category: "Components" },
    { text: "Dashboard Layout", icon: LayoutDashboard, category: "Pages" },
    { text: "Glass Calendar", icon: Clock, category: "Components" },
    { text: "Theme Configuration", icon: Palette, category: "Docs" },
    { text: "API Integration", icon: Globe, category: "Docs" },
    { text: "Code Examples", icon: Code2, category: "Docs" },
  ];

  const filtered = query
    ? suggestions.filter((s) =>
        s.text.toLowerCase().includes(query.toLowerCase())
      )
    : suggestions;

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder="Search everything... pages, components, docs"
          className="pl-12 pr-4 py-6 text-base rounded-xl bg-background/50 border-border/50 focus-visible:ring-primary/50"
        />
        <kbd className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-border/50 bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </div>
      <AnimatePresence>
        {showSuggestions && filtered.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-xl shadow-2xl overflow-hidden z-50"
          >
            {filtered.map((item, i) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.text}
                  className="flex items-center gap-3 w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                >
                  <Icon className="h-4 w-4 text-primary flex-shrink-0" />
                  <span className="text-sm font-medium text-foreground flex-1">
                    {item.text}
                  </span>
                  <Badge variant="outline" className="text-[10px] h-5">
                    {item.category}
                  </Badge>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Filter Search
function FilterSearch() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [query, setQuery] = useState("");

  const filters = ["All", "Pages", "Components", "Docs"];

  const items = [
    { name: "Landing Page", filter: "Pages", icon: LayoutDashboard },
    { name: "Dashboard", filter: "Pages", icon: LayoutDashboard },
    { name: "Effects Page", filter: "Pages", icon: Sparkles },
    { name: "Calendar & Clock", filter: "Pages", icon: Clock },
    { name: "Glass Calendar", filter: "Components", icon: Clock },
    { name: "Action Search Bar", filter: "Components", icon: Search },
    { name: "Particle Text Effect", filter: "Components", icon: Sparkles },
    { name: "Glass Clock", filter: "Components", icon: Clock },
    { name: "Getting Started", filter: "Docs", icon: BookOpen },
    { name: "Theme Setup", filter: "Docs", icon: Palette },
    { name: "API Reference", filter: "Docs", icon: Globe },
    { name: "Component API", filter: "Docs", icon: Code2 },
  ];

  const filtered = items.filter((item) => {
    const matchFilter = activeFilter === "All" || item.filter === activeFilter;
    const matchQuery = item.name.toLowerCase().includes(query.toLowerCase());
    return matchFilter && matchQuery;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {filters.map((filter) => (
          <Button
            key={filter}
            variant={activeFilter === filter ? "default" : "outline"}
           
            onClick={() => setActiveFilter(filter)}
            className={
              activeFilter === filter
                ? "bg-primary text-primary-foreground"
                : "border-border/50"
            }
          >
            {filter}
          </Button>
        ))}
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${activeFilter.toLowerCase()}...`}
          className="pl-10 bg-background/50 border-border/50"
        />
      </div>
      <div className="space-y-1 max-h-64 overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {filtered.map((item) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.name}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group"
              >
                <Icon className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="text-sm font-medium flex-1">{item.name}</span>
                <Badge
                  variant="outline"
                  className="text-[10px] h-5 opacity-50 group-hover:opacity-100 transition-opacity"
                >
                  {item.filter}
                </Badge>
                <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Recent Searches
function RecentSearches() {
  const [recentSearches, setRecentSearches] = useState([
    "Glassmorphism effects",
    "Calendar component",
    "Animation system",
    "Theme configuration",
    "Dashboard layout",
  ]);

  const removeSearch = (index: number) => {
    setRecentSearches((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
          <Clock className="h-3.5 w-3.5" />
          Recent Searches
        </h4>
        {recentSearches.length > 0 && (
          <Button
            variant="ghost"
           
            onClick={() => setRecentSearches([])}
            className="text-xs text-muted-foreground h-6"
          >
            Clear all
          </Button>
        )}
      </div>
      <div className="space-y-1">
        <AnimatePresence>
          {recentSearches.length === 0 ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-muted-foreground/50 text-center py-4"
            >
              No recent searches
            </motion.p>
          ) : (
            recentSearches.map((search, i) => (
              <motion.div
                key={search}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20, height: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 cursor-pointer group transition-colors"
              >
                <Hash className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-sm flex-1">{search}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSearch(i);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                </button>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Search Results Page
function SearchResultsPage() {
  const results = [
    {
      title: "Glassmorphism Effects",
      description:
        "Create stunning frosted glass effects with backdrop-filter blur and transparency.",
      category: "Components",
      url: "/effects",
    },
    {
      title: "Calendar Component",
      description:
        "A beautiful glass-morphism calendar with date selection and event management.",
      category: "Components",
      url: "/calendar-clock",
    },
    {
      title: "Animation System",
      description:
        "Framer Motion powered animations with whileInView, layout animations, and spring physics.",
      category: "Docs",
      url: "/animations",
    },
    {
      title: "Search & Command Palette",
      description:
        "VS Code-style command palette with keyboard shortcuts and fuzzy search.",
      category: "Components",
      url: "/search",
    },
    {
      title: "Theme System",
      description:
        "Terracotta/copper themed design system with dark mode support and CSS variables.",
      category: "Docs",
      url: "/about",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Search className="h-4 w-4" />
        <span>About 5 results for &ldquo;glass&rdquo;</span>
      </div>
      <Separator />
      <div className="space-y-4">
        {results.map((result, i) => (
          <motion.div
            key={result.title}
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.4 }}
            className="group p-4 rounded-xl border border-border/30 hover:border-primary/30 hover:bg-muted/20 transition-all cursor-pointer"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0 overflow-x-hidden pt-16 md:pt-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-semibold group-hover:text-primary transition-colors">
                    {result.title}
                  </h4>
                  <Badge
                    variant="outline"
                    className="text-[10px] h-4 px-1.5"
                  >
                    {result.category}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {result.description}
                </p>
                <p className="text-[10px] text-primary/50 mt-1 font-mono">
                  unqwebtemplate.com{result.url}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default function SearchPage() {
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <div className="flex min-h-dvh">
      <SidebarNav />
      <main className="flex-1 overflow-y-auto overflow-x-hidden pt-16 md:pt-0">
        {/* Hero Section */}
        <div className="relative overflow-hidden bg-background py-20 section-padding">
          <motion.div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 50% 0%, rgba(201,100,66,0.08) 0%, transparent 60%)",
            }}
          />
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="relative z-10 max-w-4xl mx-auto text-center"
          >
            <Badge
              variant="outline"
              className="mb-4 border-primary/30 text-primary bg-primary/10"
            >
              <Search className="h-3 w-3 mr-1" />
              Search & Command
            </Badge>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
              Search <span className="text-primary">&amp; Command</span>
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Powerful search components with command palette, filters, and
              autocomplete. Press{" "}
              <kbd className="inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium">
                ⌘K
              </kbd>{" "}
              to try the command palette.
            </p>
          </motion.div>
        </div>

        <div className="section-padding py-6 sm:py-12 space-y-12">
          {/* Action Search Bar */}
          <motion.section
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <Card className="border-border/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Zap className="h-5 w-5 text-primary" />
                  Action Search Bar
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ActionSearchBar />
              </CardContent>
            </Card>
          </motion.section>

          {/* Command Palette Demo */}
          <motion.section
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <Card className="border-border/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CommandIcon className="h-5 w-5 text-primary" />
                  Command Palette
                  <Badge variant="outline" className="ml-2 text-[10px]">
                    Ctrl+K
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <motion.div
                    animate={{ y: [0, -5, 0] }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    <Keyboard className="h-12 w-12 text-primary/50 mx-auto mb-4" />
                  </motion.div>
                  <p className="text-muted-foreground mb-4">
                    Press{" "}
                    <kbd className="inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium">
                      ⌘K
                    </kbd>{" "}
                    or click below to open the command palette
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setCommandOpen(true)}
                    className="gap-2 border-primary/30 text-primary hover:bg-primary/10"
                  >
                    <CommandIcon className="h-4 w-4" />
                    Open Command Palette
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.section>

          {/* Global Search */}
          <motion.section
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <Card className="border-border/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Globe className="h-5 w-5 text-primary" />
                  Global Search
                </CardTitle>
              </CardHeader>
              <CardContent>
                <GlobalSearchBar />
              </CardContent>
            </Card>
          </motion.section>

          {/* Filter Search + Recent Searches */}
          <motion.section
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-border/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Layers className="h-5 w-5 text-primary" />
                    Filter Search
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <FilterSearch />
                </CardContent>
              </Card>
              <Card className="border-border/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Clock className="h-5 w-5 text-primary" />
                    Recent Searches
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RecentSearches />
                </CardContent>
              </Card>
            </div>
          </motion.section>

          {/* Search Results */}
          <motion.section
            variants={sectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            <Card className="border-border/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileText className="h-5 w-5 text-primary" />
                  Search Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <SearchResultsPage />
              </CardContent>
            </Card>
          </motion.section>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center py-8 border-t border-border/30 safe-area-bottom"
          >
            <p className="text-muted-foreground text-sm">
              Built with ❤️ by Sandeep Gaddam
            </p>
          </motion.div>
        </div>

        {/* Command Palette Dialog */}
        <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
          <CommandInput placeholder="Type a command or search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Pages">
              <CommandItem>
                <LayoutDashboard className="h-4 w-4" />
                <span>Dashboard</span>
                <CommandShortcut>⌘D</CommandShortcut>
              </CommandItem>
              <CommandItem>
                <Sparkles className="h-4 w-4" />
                <span>Effects Showcase</span>
                <CommandShortcut>⌘E</CommandShortcut>
              </CommandItem>
              <CommandItem>
                <Search className="h-4 w-4" />
                <span>Search & Command</span>
                <CommandShortcut>⌘S</CommandShortcut>
              </CommandItem>
              <CommandItem>
                <Clock className="h-4 w-4" />
                <span>Calendar & Clock</span>
                <CommandShortcut>⌘C</CommandShortcut>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Components">
              <CommandItem>
                <Component className="h-4 w-4" />
                <span>Component Library</span>
              </CommandItem>
              <CommandItem>
                <Palette className="h-4 w-4" />
                <span>Animations</span>
              </CommandItem>
              <CommandItem>
                <Layers className="h-4 w-4" />
                <span>Cards</span>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Settings">
              <CommandItem>
                <Settings className="h-4 w-4" />
                <span>Preferences</span>
                <CommandShortcut>⌘,</CommandShortcut>
              </CommandItem>
              <CommandItem>
                <Palette className="h-4 w-4" />
                <span>Toggle Theme</span>
                <CommandShortcut>⌘T</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </CommandDialog>
      </main>
    </div>
  );
}
