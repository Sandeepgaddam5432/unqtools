"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  CopyButton,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  Search, BookOpen, History, Tag, ChevronRight, Eye, Code,
} from "lucide-react";
import {
  ENTRIES,
  ENTRY_COUNT,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  FLAVOR_LABELS,
  FLAVOR_ORDER,
  searchEntries,
  groupByCategory,
  flavorMatrix,
  renderMarkdown,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type MdCategory,
  type MdEntry,
  type HistoryEntry,
} from "./logic";

export default function MarkdownSyntaxCheatsheetReference() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<MdCategory | "">("");
  const [scratch, setScratch] = useState("# Hello Markdown\n\nThis is **bold**, *italic*, and `code`.\n\n- Item\n- [ ] Task\n\n> [!NOTE]\n> Live preview.");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showSource, setShowSource] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.query) setQuery(p.query);
      if (p.category) setCategory(p.category);
      if (p.query || p.category) toast.info("Loaded from share link");
    }
  }, []);

  const results = useMemo(() => searchEntries(query, category), [query, category]);
  const grouped = useMemo(() => groupByCategory(results), [results]);
  const scratchHtml = useMemo(() => renderMarkdown(scratch), [scratch]);

  const handleShare = useCallback(() => {
    const url = buildShareUrl(query, category);
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(url).then(
        () => toast.success("Share link copied to clipboard"),
        () => toast.error("Could not copy share link"),
      );
    }
  }, [query, category]);

  const handleClear = useCallback(() => {
    setQuery("");
    setCategory("");
    toast.info("Cleared filters");
  }, []);

  const handleCardView = useCallback((id: string) => {
    setShowSource((prev) => ({ ...prev, [id]: !prev[id] }));
    saveHistory({ ts: Date.now(), query, category, entryId: id });
    setHistory(loadHistory());
  }, [query, category]);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="mdcs-search" className="flex items-center gap-1.5">
              <Search className="h-4 w-4" /> Search {ENTRY_COUNT} syntax entries
            </Label>
            <Input
              id="mdcs-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Try: bold, table, alert, footnote, code fence…"
              className="font-mono text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            <Button
              variant={category === "" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setCategory("")}
            >
              All ({ENTRIES.length})
            </Button>
            {CATEGORY_ORDER.map((c) => {
              const count = ENTRIES.filter((e) => e.category === c).length;
              return (
                <Button
                  key={c}
                  variant={category === c ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setCategory(category === c ? "" : c)}
                >
                  {CATEGORY_LABELS[c]} ({count})
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5" />
            <span>
              <strong className="text-foreground">{results.length}</strong> of {ENTRIES.length} entries
              {category && <span> in <strong className="text-foreground">{CATEGORY_LABELS[category]}</strong></span>}
              {query && <span> matching <code className="font-mono">"{query}"</code></span>}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <ShareButton getUrl={() => buildShareUrl(query, category)} />
            <ClearButton onClick={handleClear} />
          </div>
        </CardContent>
      </Card>

      {results.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No syntax entries match your search. Try clearing filters or a different query.
          </CardContent>
        </Card>
      ) : (
        CATEGORY_ORDER.map((cat) => {
          const list = grouped[cat];
          if (!list || list.length === 0) return null;
          return (
            <Card key={cat} id={`cat-${cat}`}>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5 border-b pb-2">
                  <Tag className="h-4 w-4 text-primary" />
                  {CATEGORY_LABELS[cat]}
                  <Badge variant="secondary" className="ml-1 text-[10px]">{list.length}</Badge>
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {list.map((entry) => (
                    <EntryCard
                      key={entry.id}
                      entry={entry}
                      showSource={!!showSource[entry.id]}
                      onToggleView={() => handleCardView(entry.id)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Code className="h-4 w-4" /> Scratch pad — test your own Markdown
            </h3>
            <CopyButton getText={() => scratch} label="Copy source" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Textarea
              value={scratch}
              onChange={(e) => setScratch(e.target.value)}
              className="min-h-[260px] resize-y font-mono text-xs"
              placeholder="# Type Markdown here..."
            />
            <div className="min-h-[260px] rounded border bg-background p-3 overflow-auto">
              <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <Eye className="h-3 w-3" /> Rendered preview
              </div>
              <div
                className="md-preview text-sm prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: scratchHtml }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <BookOpen className="h-4 w-4" /> Flavor-support legend
          </h3>
          <div className="flex flex-wrap gap-2">
            {FLAVOR_ORDER.map((f) => (
              <Badge key={f} variant="outline" className="text-[11px]">
                {FLAVOR_LABELS[f]}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Each card shows <span className="text-emerald-600 dark:text-emerald-400">●</span> for supported flavors and <span className="text-muted-foreground">○</span> for unsupported. Use the matrix to know if a feature works in CommonMark, GFM, GitLab, pandoc, or Obsidian.
          </p>
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recently viewed ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1 max-h-[180px] overflow-auto">
              {history.slice(0, 10).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs flex items-center gap-2">
                  <ChevronRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                  {h.entryId ? (
                    <span className="font-mono text-foreground">{h.entryId}</span>
                  ) : (
                    <span className="font-mono text-foreground">{h.query || "(empty)"}</span>
                  )}
                  <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All search, rendering, and history run locally. Your data never leaves the browser.
          </p>
        </CardContent>
      </Card>

      <style jsx global>{`
        .md-preview h1, .md-render h1 { font-size: 1.5rem; font-weight: 700; margin: 0.5rem 0; }
        .md-preview h2, .md-render h2 { font-size: 1.25rem; font-weight: 700; margin: 0.5rem 0; }
        .md-preview h3, .md-render h3 { font-size: 1.1rem; font-weight: 600; margin: 0.4rem 0; }
        .md-preview h4, .md-render h4 { font-size: 1rem; font-weight: 600; margin: 0.3rem 0; }
        .md-preview h5, .md-render h5 { font-size: 0.95rem; font-weight: 600; margin: 0.3rem 0; }
        .md-preview h6, .md-render h6 { font-size: 0.9rem; font-weight: 600; margin: 0.3rem 0; }
        .md-preview p, .md-render p { margin: 0.4rem 0; line-height: 1.55; }
        .md-preview ul, .md-render ul { list-style: disc; margin: 0.4rem 0; padding-left: 1.5rem; }
        .md-preview ol, .md-render ol { list-style: decimal; margin: 0.4rem 0; padding-left: 1.5rem; }
        .md-preview code, .md-render code { background: hsl(var(--muted)); padding: 0.1rem 0.3rem; border-radius: 3px; font-family: ui-monospace, monospace; font-size: 0.85em; }
        .md-preview pre, .md-render pre { background: hsl(var(--muted)); padding: 0.5rem; border-radius: 4px; overflow-x: auto; margin: 0.4rem 0; }
        .md-preview pre code, .md-render pre code { background: none; padding: 0; }
        .md-preview blockquote, .md-render blockquote { border-left: 3px solid hsl(var(--border)); padding-left: 0.75rem; margin: 0.4rem 0; color: hsl(var(--muted-foreground)); }
        .md-preview hr, .md-render hr { border: none; border-top: 1px solid hsl(var(--border)); margin: 0.6rem 0; }
        .md-preview table, .md-render table { border-collapse: collapse; margin: 0.4rem 0; }
        .md-preview th, .md-render th, .md-preview td, .md-render td { border: 1px solid hsl(var(--border)); padding: 0.25rem 0.5rem; }
        .md-preview th, .md-render th { background: hsl(var(--muted)); font-weight: 600; }
        .md-preview .task-list-item, .md-render .task-list-item { list-style: none; margin-left: -1rem; }
        .md-preview .md-alert, .md-render .md-alert { border-left: 4px solid hsl(var(--primary)); padding: 0.5rem 0.75rem; margin: 0.4rem 0; background: hsl(var(--muted)); border-radius: 4px; }
        .md-preview .md-alert-title, .md-render .md-alert-title { font-weight: 700; margin: 0 0 0.25rem 0; font-size: 0.85em; }
        .md-preview .md-alert-note, .md-render .md-alert-note { border-color: #0969da; }
        .md-preview .md-alert-tip, .md-render .md-alert-tip { border-color: #1a7f37; }
        .md-preview .md-alert-important, .md-render .md-alert-important { border-color: #8250df; }
        .md-preview .md-alert-warning, .md-render .md-alert-warning { border-color: #9a6700; }
        .md-preview .md-alert-caution, .md-render .md-alert-caution { border-color: #cf222e; }
      `}</style>
    </div>
  );
}

function EntryCard({
  entry,
  showSource,
  onToggleView,
}: {
  entry: MdEntry;
  showSource: boolean;
  onToggleView: () => void;
}) {
  const matrix = flavorMatrix(entry);
  const html = useMemo(() => renderMarkdown(entry.source), [entry.source]);
  return (
    <div className="rounded border bg-background p-3 space-y-2" id={entry.id}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-medium text-foreground">{entry.name}</div>
          {entry.note && <div className="text-[11px] text-muted-foreground mt-0.5">{entry.note}</div>}
        </div>
        <CopyButton getText={() => entry.source} size="icon-sm" />
      </div>
      <div className="flex flex-wrap gap-1">
        {matrix.map((m) => (
          <Badge
            key={m.flavor}
            variant="outline"
            className={`text-[9px] ${m.supported
              ? "text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700"
              : "text-muted-foreground opacity-60"}`}
            title={m.supported ? "Supported" : "Not supported"}
          >
            {m.supported ? "●" : "○"} {m.label}
          </Badge>
        ))}
      </div>
      <div className="rounded bg-muted/40 p-2 font-mono text-[11px] whitespace-pre-wrap break-words text-foreground/90">
        {entry.source}
      </div>
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[11px] gap-1"
          onClick={onToggleView}
        >
          <Eye className="h-3 w-3" />
          {showSource ? "Hide preview" : "Show preview"}
        </Button>
        {entry.tags && entry.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {entry.tags.slice(0, 3).map((t) => (
              <span key={t} className="text-[9px] text-muted-foreground">#{t}</span>
            ))}
          </div>
        )}
      </div>
      {showSource && (
        <div className="rounded border bg-background p-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Rendered output</div>
          <div className="md-render text-sm" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      )}
    </div>
  );
}
