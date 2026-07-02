/**
 * CommandBar (⌘K) — cmdk-style fuzzy command palette for Preact.
 *
 * Features:
 *  - ⌘K / Ctrl+K to open from anywhere
 *  - Fuzzy search over the tool registry (uses src/lib/search.ts)
 *  - Keyboard nav: ↑↓ to move, Enter to open, Esc to close
 *  - Recent + favorite tools shown above results when query is empty
 *  - Glassmorphism backdrop, smooth open/close
 *  - Static-friendly: registry is inlined at build time so it works offline
 */
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { Search, Star, Clock, CornerDownLeft, Command } from "lucide-preact";
import { TOOLS } from "../lib/registry";
import { CATEGORY_LABELS, type ToolManifest } from "../lib/tool";
import { searchTools } from "../lib/search";
import { useFavorites, useRecents } from "../lib/storage";

interface CommandBarProps {
  /** Controlled open state (optional). If omitted, the bar manages its own state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface ResultRow {
  tool: ToolManifest;
  isFavorite: boolean;
  isRecent: boolean;
}

export function CommandBar({ open: controlledOpen, onOpenChange }: CommandBarProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (v: boolean) => {
    if (onOpenChange) onOpenChange(v);
    else setInternalOpen(v);
  };
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const { favorites } = useFavorites();
  const { recents } = useRecents();

  // Listen for the global "open command bar" event (from Header ⌘K)
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("unq:open-command-bar", onOpen as EventListener);
    return () => window.removeEventListener("unq:open-command-bar", onOpen as EventListener);
  }, []);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Compute results
  const results: ResultRow[] = useMemo(() => {
    if (!query.trim()) {
      // Empty query: show recents first, then favorites, then popular (alphabetical)
      const seen = new Set<string>();
      const out: ResultRow[] = [];
      for (const id of recents) {
        const t = TOOLS.find((x) => x.id === id);
        if (t && !seen.has(id)) {
          out.push({ tool: t, isFavorite: favorites.includes(id), isRecent: true });
          seen.add(id);
        }
      }
      for (const id of favorites) {
        const t = TOOLS.find((x) => x.id === id);
        if (t && !seen.has(id)) {
          out.push({ tool: t, isFavorite: true, isRecent: false });
          seen.add(id);
        }
      }
      // Fill with all tools alphabetical
      for (const t of TOOLS) {
        if (!seen.has(t.id)) {
          out.push({ tool: t, isFavorite: false, isRecent: false });
          seen.add(t.id);
        }
      }
      return out.slice(0, 24);
    }
    return searchTools(query, TOOLS, 24).map((r) => ({
      tool: r.tool,
      isFavorite: favorites.includes(r.tool.id),
      isRecent: recents.includes(r.tool.id),
    }));
  }, [query, favorites, recents]);

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = results[activeIndex];
      if (selected) {
        window.location.href = `/tools/${selected.tool.id}`;
      }
    }
  }

  // Scroll active item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.children[activeIndex] as HTMLElement | undefined;
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, results]);

  if (!open) return null;

  return (
    <div class="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6">
      {/* Backdrop with glassmorphism */}
      <div
        class="fixed inset-0 bg-black/30 backdrop-blur-md"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        class="unq-glass relative mt-[10vh] w-full max-w-xl overflow-hidden rounded-xl border border-unq-border shadow-xl sm:mt-[15vh]"
      >
        {/* Search input */}
        <div class="flex items-center gap-3 border-b border-unq-border px-4">
          <Search size={18} class="shrink-0 text-unq-text-muted" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search tools by name, category, or keyword…"
            value={query}
            onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
            onKeyDown={onKeyDown}
            class="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-unq-text-subtle"
            aria-label="Search tools"
            aria-controls="cmdbar-results"
            aria-activedescendant={results[activeIndex] ? `cmdbar-item-${activeIndex}` : undefined}
            autocomplete="off"
            spellcheck={false}
          />
          <kbd class="hidden h-6 items-center gap-0.5 rounded border border-unq-border bg-unq-surface-hover px-1.5 font-mono text-[10px] text-unq-text-muted sm:flex">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <ul
          ref={listRef}
          id="cmdbar-results"
          role="listbox"
          aria-label="Tool results"
          class="max-h-[50vh] overflow-y-auto py-2"
        >
          {results.length === 0 ? (
            <li class="px-4 py-8 text-center text-sm text-unq-text-muted">
              No tools found for “{query}”.
            </li>
          ) : (
            results.map((r, i) => (
              <li
                key={r.tool.id}
                id={`cmdbar-item-${i}`}
                role="option"
                aria-selected={i === activeIndex}
              >
                <a
                  href={`/tools/${r.tool.id}`}
                  class={`duration-fast mx-2 flex items-center gap-3 rounded-lg px-4 py-2.5 transition-colors ${
                    i === activeIndex ? "bg-unq-accent-subtle" : "hover:bg-unq-surface-hover"
                  }`}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-unq-surface-hover text-xs">
                    {r.tool.icon === "braces"
                      ? "{ }"
                      : r.tool.icon === "calculator"
                        ? "🧮"
                        : r.tool.icon === "type"
                          ? "Aa"
                          : r.tool.icon === "image"
                            ? "🖼"
                            : r.tool.icon === "home"
                              ? "🏠"
                              : r.tool.icon === "trending-up"
                                ? "📈"
                                : r.tool.icon === "binary"
                                  ? "01"
                                  : r.tool.icon === "link"
                                    ? "🔗"
                                    : r.tool.icon === "hash"
                                      ? "#"
                                      : r.tool.icon === "palette"
                                        ? "🎨"
                                        : r.tool.icon === "fingerprint"
                                          ? "🔑"
                                          : "·"}
                  </span>
                  <div class="min-w-0 flex-1">
                    <p
                      class={`truncate text-sm font-medium ${i === activeIndex ? "text-unq-text" : ""}`}
                    >
                      {r.tool.name}
                    </p>
                    <p class="truncate text-xs text-unq-text-muted">{r.tool.description}</p>
                  </div>
                  <div class="flex shrink-0 items-center gap-1.5">
                    {r.isRecent && (
                      <span title="Recently used" class="text-unq-text-subtle">
                        <Clock size={12} />
                      </span>
                    )}
                    {r.isFavorite && (
                      <span title="Favorite" class="text-unq-warning">
                        <Star size={12} fill="currentColor" />
                      </span>
                    )}
                    <span class="text-[10px] uppercase tracking-wide text-unq-text-subtle">
                      {CATEGORY_LABELS[r.tool.category].split(" ")[0]}
                    </span>
                  </div>
                </a>
              </li>
            ))
          )}
        </ul>

        {/* Footer */}
        <div class="flex items-center justify-between border-t border-unq-border px-4 py-2.5 text-xs text-unq-text-muted">
          <div class="flex items-center gap-3">
            <span class="flex items-center gap-1">
              <kbd class="inline-flex h-5 items-center rounded border border-unq-border bg-unq-surface-hover px-1 font-mono">
                ↑↓
              </kbd>
              Navigate
            </span>
            <span class="flex items-center gap-1">
              <kbd class="inline-flex h-5 items-center rounded border border-unq-border bg-unq-surface-hover px-1 font-mono">
                <CornerDownLeft size={10} />
              </kbd>
              Open
            </span>
          </div>
          <span class="hidden items-center gap-1 sm:flex">
            <Command size={10} /> + K
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook: useCommandK — registers a global ⌘K / Ctrl+K listener and returns
 * the open state + toggle function.
 */
export function useCommandK(): { open: boolean; setOpen: (v: boolean) => void } {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return { open, setOpen };
}
