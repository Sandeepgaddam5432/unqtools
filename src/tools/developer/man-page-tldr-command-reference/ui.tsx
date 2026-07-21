"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  CopyButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  History, Search, BookOpen, ExternalLink, Star, Terminal,
  Filter, AlertCircle, ChevronRight,
} from "lucide-react";
import {
  COMMANDS,
  PLATFORMS,
  PLATFORM_LABELS,
  CATEGORY_LABELS,
  COMMAND_CATEGORIES,
  CORPUS_SNAPSHOT_DATE,
  search,
  searchByTask,
  getManUrl,
  getFavorites,
  isFavorite,
  toggleFavorite,
  groupCommands,
  computeStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  lookupWithFallback,
  type Platform,
  type CommandCategory,
  type TldrCommand,
  type HistoryEntry,
} from "./logic";

const TASK_SEARCH_HINT = /^(\bhow\b|\bdo\b|\bi\b|\bto\b|\ba\b|\bthe\b)/i;

export default function ManPageTldrCommandReference() {
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState<Platform | "">("");
  const [category, setCategory] = useState<CommandCategory | "">("");
  const [selected, setSelected] = useState<TldrCommand | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setFavorites(getFavorites());
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (parsed.commandName) {
        const r = lookupWithFallback(parsed.commandName);
        if (r.found && r.command) {
          setSelected(r.command);
          saveHistory({ ts: Date.now(), command: r.command.name });
          setHistory(loadHistory());
          toast.info(`Loaded ${r.command.name} from share link`);
        }
      }
    }
  }, []);

  // Decide whether to use task-search (multi-word "how do I...") or name-search.
  const isTaskQuery = query.trim().split(/\s+/).length >= 2 && TASK_SEARCH_HINT.test(query.trim());
  const results = useMemo(() => {
    const opts = {
      platform: platform || undefined,
      category: category || undefined,
    };
    return isTaskQuery ? searchByTask(query, opts) : search(query, opts);
  }, [query, platform, category, isTaskQuery]);

  const grouped = useMemo(() => groupCommands(results), [results]);
  const stats = useMemo(() => computeStats(), []);

  const handleSelect = useCallback((cmd: TldrCommand) => {
    setSelected(cmd);
    saveHistory({ ts: Date.now(), command: cmd.name });
    setHistory(loadHistory());
  }, []);

  const handleToggleFavorite = useCallback((name: string) => {
    const next = toggleFavorite(name);
    setFavorites(next);
    toast.success(next.includes(name) ? `Starred ${name}` : `Unstarred ${name}`);
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleClear = useCallback(() => {
    setQuery("");
    setPlatform("");
    setCategory("");
    setSelected(null);
  }, []);

  const favoriteCommands = useMemo(
    () => favorites.map((n) => COMMANDS.find((c) => c.name === n)).filter(Boolean) as TldrCommand[],
    [favorites],
  );

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Search className="h-4 w-4" /> Search
            </h3>
            <span className="text-[10px] text-muted-foreground">
              Corpus snapshot: {CORPUS_SNAPSHOT_DATE} · {stats.totalCommands} commands · {stats.totalExamples} examples
            </span>
          </div>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isTaskQuery ? "Searching by task…" : "Command name (e.g. tar) or task (e.g. 'compress a folder')…"}
            className="font-mono text-sm"
            autoFocus
          />
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as Platform | "")}
                className="h-8 text-xs rounded border bg-background px-2"
              >
                <option value="">All platforms</option>
                {PLATFORMS.map((p) => <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>)}
              </select>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as CommandCategory | "")}
                className="h-8 text-xs rounded border bg-background px-2"
              >
                <option value="">All categories</option>
                {COMMAND_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
            {isTaskQuery && (
              <Badge variant="secondary" className="text-[10px]">Task search</Badge>
            )}
            <ClearButton onClick={handleClear} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          {results.length === 0 ? (
            <EmptyState
              title={query ? `No matches for "${query}"` : "Start typing to search commands"}
              hint={query
                ? "Try a different name or task. If you know the exact command, click its man page link below."
                : "Search by command name (e.g. tar, grep, find) or by task (e.g. 'compress a folder'). The corpus is bundled — no install, no network."}
              icon={<Terminal className="h-8 w-8" />}
            />
          ) : (
            <>
              <div className="text-xs text-muted-foreground px-1">
                {results.length} command{results.length === 1 ? "" : "s"} {isTaskQuery ? "match your task" : "match"}
              </div>
              {grouped.map((g) => (
                <Card key={g.category}>
                  <CardContent className="p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[11px] uppercase tracking-wide text-muted-foreground">{g.label}</h4>
                      <Badge variant="outline" className="text-[10px]">{g.commands.length}</Badge>
                    </div>
                    <div className="space-y-1">
                      {g.commands.map((cmd) => (
                        <button
                          key={cmd.name}
                          onClick={() => handleSelect(cmd)}
                          className={`w-full text-left rounded border px-2 py-1.5 text-xs transition-colors ${
                            selected?.name === cmd.name
                              ? "border-primary bg-primary/5"
                              : "border-border hover:bg-muted/50"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-foreground">{cmd.name}</span>
                            {favorites.includes(cmd.name) && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
                            <span className="text-muted-foreground truncate flex-1">{cmd.oneLine}</span>
                            <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}

          {favoriteCommands.length > 0 && (
            <Card>
              <CardContent className="p-3 space-y-1">
                <h4 className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  <Star className="h-3 w-3" /> Favorites
                </h4>
                <div className="flex flex-wrap gap-1">
                  {favoriteCommands.map((cmd) => (
                    <Button
                      key={cmd.name}
                      variant="outline"
                      size="sm"
                      className="h-7 text-[11px] font-mono gap-1"
                      onClick={() => handleSelect(cmd)}
                    >
                      {cmd.name}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {history.length > 0 && (
            <Card>
              <CardContent className="p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                    <History className="h-3 w-3" /> Recent
                  </h4>
                  <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={handleClearHistory}>Clear</Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {history.slice(0, 10).map((h, i) => (
                    <Button
                      key={i}
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[11px] font-mono"
                      onClick={() => {
                        const cmd = COMMANDS.find((c) => c.name === h.command);
                        if (cmd) handleSelect(cmd);
                      }}
                    >
                      {h.command}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-3">
          {selected ? (
            <CommandDetail
              cmd={selected}
              isFav={favorites.includes(selected.name)}
              onToggleFav={handleToggleFavorite}
            />
          ) : (
            <EmptyState
              title="Select a command to see its TLDR page"
              hint="Each page shows a one-line description, 3–6 common examples, related commands, and a deep-link to the full man7.org man page."
              icon={<BookOpen className="h-8 w-8" />}
            />
          )}

          {query && results.length === 0 && (
            <Card>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <span className="font-medium text-foreground">Command not in TLDR corpus</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  No bundled TLDR page for &quot;{query}&quot;. You can still open the full man page (if it exists on this system), or contribute a page at <code className="font-mono">tldr-pages/tldr</code> on GitHub.
                </p>
                <a
                  href={getManUrl(query)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" /> Open man page for {query}
                </a>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Honesty clause:</strong> The TLDR corpus is a bundled community snapshot ({CORPUS_SNAPSHOT_DATE}) and may lag the latest <code className="font-mono">tldr-pages</code>. The full man-page link is the authoritative source. This reference runs entirely client-side — no ads, no tracking.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function CommandDetail({
  cmd,
  isFav,
  onToggleFav,
}: {
  cmd: TldrCommand;
  isFav: boolean;
  onToggleFav: (name: string) => void;
}) {
  const manUrl = useMemo(() => getManUrl(cmd.name), [cmd.name]);
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-mono font-semibold text-foreground">{cmd.name}</h3>
              <Badge variant="outline" className="text-[10px]">{CATEGORY_LABELS[cmd.category]}</Badge>
              {cmd.platforms.map((p) => (
                <Badge key={p} variant="secondary" className="text-[10px]">{PLATFORM_LABELS[p]}</Badge>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">{cmd.oneLine}</p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onToggleFav(cmd.name)}
            title={isFav ? "Remove from favorites" : "Add to favorites"}
          >
            <Star className={`h-4 w-4 ${isFav ? "fill-amber-400 text-amber-400" : ""}`} />
          </Button>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Examples</Label>
          {cmd.examples.map((ex, i) => (
            <div key={i} className="rounded border bg-muted/30 p-2 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <code className="text-xs font-mono text-foreground flex-1 break-all">{ex.code}</code>
                <CopyButton getText={() => ex.code} label="" size="icon-sm" />
              </div>
              <p className="text-[11px] text-muted-foreground">{ex.description}</p>
            </div>
          ))}
        </div>

        {cmd.seeAlso.length > 0 && (
          <div className="space-y-1">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">See also</Label>
            <div className="flex flex-wrap gap-1">
              {cmd.seeAlso.map((s) => (
                <Badge key={s} variant="outline" className="text-[10px] font-mono">{s}</Badge>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <a href={manUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ExternalLink className="h-3.5 w-3.5" /> Open full man page
            </Button>
          </a>
          <ShareButton getUrl={() => buildShareUrl(cmd.name)} label="Share link" />
        </div>
      </CardContent>
    </Card>
  );
}
