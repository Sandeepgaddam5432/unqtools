"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Search,
  Home,
  Code2,
  Type,
  Calculator,
  Image as ImageIcon,
  Layers,
  Sun,
  Moon,
  Star,
  ArrowRight,
} from "lucide-react";
import { useTheme } from "next-themes";
import { TOOLS } from "@/lib/registry";
import { searchTools } from "@/lib/search";
import { CATEGORY_LABELS, ALL_CATEGORIES, type ToolCategory } from "@/lib/tool";

// Only show categories that have at least 1 tool
const ACTIVE_CATEGORIES = ALL_CATEGORIES.filter((c) =>
  TOOLS.some((t) => t.category === c),
);

const RECENTS_KEY = "unq-cmdk-recents";
const MAX_RECENTS = 5;

function loadRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string").slice(0, MAX_RECENTS) : [];
  } catch {
    return [];
  }
}

function saveRecent(id: string) {
  try {
    const cur = loadRecents().filter((x) => x !== id);
    cur.unshift(id);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(cur.slice(0, MAX_RECENTS)));
  } catch {
    /* ignore */
  }
}

const CATEGORY_ICONS: Record<ToolCategory, typeof Code2> = {
  developer: Code2,
  text: Type,
  calculators: Calculator,
  image: ImageIcon,
  pdf: Layers,
  "audio-video": Layers,
  seo: Search,
  "network-security": Layers,
  file: Layers,
  business: Layers,
  education: Layers,
  social: Layers,
  ai: Star,
};

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [recents, setRecents] = useState<string[]>([]);

  useEffect(() => {
    if (open) setRecents(loadRecents());
  }, [open]);

  const recentTools = recents
    .map((id) => TOOLS.find((t) => t.id === id))
    .filter(Boolean) as typeof TOOLS[number][];

  function go(url: string, toolId?: string) {
    if (toolId) saveRecent(toolId);
    onOpenChange(false);
    router.push(url);
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader className="sr-only">
        <DialogTitle>Search tools and actions</DialogTitle>
        <DialogDescription>
          Search across all {TOOLS.length} tools, categories, and quick actions.
        </DialogDescription>
      </DialogHeader>
      <DialogContent className="p-0 overflow-hidden max-w-2xl">
        <Command className="rounded-lg">
          <CommandInput placeholder={`Search ${TOOLS.length} tools, categories, or actions…`} />
          <CommandList className="max-h-[400px]">
            <CommandEmpty>No results found.</CommandEmpty>

            {/* Quick actions */}
            <CommandGroup heading="Quick Actions">
              <CommandItem
                onSelect={() => toggleTheme()}
                className="cursor-pointer"
              >
                {theme === "dark" ? (
                  <Sun className="mr-2 h-4 w-4" />
                ) : (
                  <Moon className="mr-2 h-4 w-4" />
                )}
                <span>Switch to {theme === "dark" ? "light" : "dark"} theme</span>
              </CommandItem>
              <CommandItem
                onSelect={() => go("/")}
                className="cursor-pointer"
              >
                <Home className="mr-2 h-4 w-4" />
                <span>Go home</span>
              </CommandItem>
              <CommandItem
                onSelect={() => go("/tools")}
                className="cursor-pointer"
              >
                <Layers className="mr-2 h-4 w-4" />
                <span>Browse all tools ({TOOLS.length})</span>
              </CommandItem>
            </CommandGroup>

            <CommandSeparator />

            {/* Recents */}
            {recentTools.length > 0 && (
              <>
                <CommandGroup heading="Recent">
                  {recentTools.map((tool) => {
                    const Icon = CATEGORY_ICONS[tool.category] ?? Layers;
                    return (
                      <CommandItem
                        key={`recent-${tool.id}`}
                        onSelect={() => go(`/tools/${tool.id}`, tool.id)}
                        className="cursor-pointer"
                      >
                        <Icon className="mr-2 h-4 w-4 text-primary" />
                        <span>{tool.name}</span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {CATEGORY_LABELS[tool.category].split(" ")[0]}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            {/* Categories */}
            <CommandGroup heading="Categories">
              {ACTIVE_CATEGORIES.map((cat) => {
                const Icon = CATEGORY_ICONS[cat] ?? Layers;
                return (
                  <CommandItem
                    key={cat}
                    onSelect={() => go(`/category/${cat}`)}
                    className="cursor-pointer"
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    <span>{CATEGORY_LABELS[cat]}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>

            <CommandSeparator />

            {/* All tools */}
            <CommandGroup heading={`All Tools (${TOOLS.length})`}>
              {TOOLS.map((tool) => {
                const Icon = CATEGORY_ICONS[tool.category] ?? Layers;
                return (
                  <CommandItem
                    key={tool.id}
                    value={`${tool.name} ${tool.description} ${tool.keywords.join(" ")} ${tool.id}`}
                    onSelect={() => go(`/tools/${tool.id}`, tool.id)}
                    className="cursor-pointer"
                  >
                    <Icon className="mr-2 h-4 w-4 text-primary" />
                    <span>{tool.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {CATEGORY_LABELS[tool.category].split(" ")[0]}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Global ⌘K listener + command palette mount.
 * Listens for ⌘K / Ctrl+K and the custom `unq:open-command-bar` event.
 * Mount this once in the root layout.
 */
export function CommandPaletteMount() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", handler);
    const customHandler = () => setOpen(true);
    window.addEventListener("unq:open-command-bar", customHandler);
    return () => {
      document.removeEventListener("keydown", handler);
      window.removeEventListener("unq:open-command-bar", customHandler);
    };
  }, []);

  return <CommandPalette open={open} onOpenChange={setOpen} />;
}
