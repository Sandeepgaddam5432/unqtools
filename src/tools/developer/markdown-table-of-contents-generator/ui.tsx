"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  History, List, ArrowRightLeft, Trash2, Link as LinkIcon,
} from "lucide-react";
import {
  PLATFORM_LABELS,
  DEFAULT_OPTIONS,
  parseAndDedupe,
  renderToc,
  generateToc,
  findTocMarker,
  insertToc,
  removeToc,
  computeStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Platform,
  type ListStyle,
  type TocOptions,
  type HistoryEntry,
} from "./logic";

const LEVELS = [1, 2, 3, 4, 5, 6] as const;

export default function MarkdownTocGenerator() {
  const [markdown, setMarkdown] = useState<string>("");
  const [options, setOptions] = useState<TocOptions>(DEFAULT_OPTIONS);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [view, setView] = useState<"toc" | "inserted">("toc");

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (Object.keys(parsed).length > 0) {
        setOptions((prev) => ({ ...prev, ...parsed }));
        toast.info("Loaded options from share link");
      }
    }
  }, []);

  const headings = useMemo(() => parseAndDedupe(markdown, options), [markdown, options]);
  const toc = useMemo(() => renderToc(headings, options), [headings, options]);
  const inserted = useMemo(() => (markdown ? insertToc(markdown, options) : ""), [markdown, options]);
  const stats = useMemo(() => computeStats(markdown, options), [markdown, options]);
  const marker = useMemo(() => findTocMarker(markdown), [markdown]);

  const output = view === "toc" ? toc : inserted;

  const handleSaveHistory = useCallback(() => {
    if (!toc) return;
    saveHistory({
      ts: Date.now(),
      platform: options.platform,
      headingCount: headings.length,
      preview: toc.split("\n").slice(0, 1).join("") || "",
    });
    setHistory(loadHistory());
  }, [toc, headings.length, options.platform]);

  const updateOption = useCallback(<K extends keyof TocOptions>(key: K, value: TocOptions[K]) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleInsertAtTop = useCallback(() => {
    if (!markdown) {
      toast.error("Paste a markdown document first");
      return;
    }
    setMarkdown(insertToc(markdown, options));
    handleSaveHistory();
    toast.success("TOC inserted into document");
  }, [markdown, options, handleSaveHistory]);

  const handleRemoveToc = useCallback(() => {
    if (!marker) {
      toast.info("No [TOC] or <!-- toc --> marker found");
      return;
    }
    setMarkdown(removeToc(markdown));
    toast.success("Removed TOC and markers");
  }, [markdown, marker]);

  const handleClear = useCallback(() => {
    setMarkdown("");
    setOptions(DEFAULT_OPTIONS);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const loadSample = useCallback(() => {
    setMarkdown(`# Sample Project

A short description of the project.

## Installation

\`\`\`bash
npm install sample
\`\`\`

## Usage

Some usage examples.

### Basic Usage

Basic example.

### Advanced Usage

Advanced example.

## Examples

First examples section.

## Examples

Duplicate examples section — should get \`-1\` suffix.

## API

API reference.

### Methods

Method docs.

## License

MIT
`);
    toast.info("Loaded sample document");
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Platform</Label>
              <select
                value={options.platform}
                onChange={(e) => updateOption("platform", e.target.value as Platform)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(PLATFORM_LABELS) as Platform[]).map((p) => (
                  <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Min level</Label>
              <select
                value={options.minLevel}
                onChange={(e) => updateOption("minLevel", Number(e.target.value) as TocOptions["minLevel"])}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {LEVELS.map((l) => <option key={l} value={l}>H{l}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Max level</Label>
              <select
                value={options.maxLevel}
                onChange={(e) => updateOption("maxLevel", Number(e.target.value) as TocOptions["maxLevel"])}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {LEVELS.map((l) => <option key={l} value={l}>H{l}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">List style</Label>
              <select
                value={options.listStyle}
                onChange={(e) => updateOption("listStyle", e.target.value as ListStyle)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                <option value="bullet">Bullet (-)</option>
                <option value="ordered">Ordered (1.)</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={options.skipFirst} onChange={(e) => updateOption("skipFirst", e.target.checked)} />
              Skip first heading
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={options.emitAnchors} onChange={(e) => updateOption("emitAnchors", e.target.checked)} />
              Emit &lt;a name&gt; anchors
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="toc-input" className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <List className="h-4 w-4" /> Markdown source
              </Label>
              <Button size="sm" variant="ghost" onClick={loadSample} className="text-[11px]">Load sample</Button>
            </div>
            <Textarea
              id="toc-input"
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              placeholder={"# My Project\n\nIntro paragraph.\n\n## Installation\n\n## Usage\n\n### Basic\n\n### Advanced\n\n## License\n"}
              className="min-h-[320px] resize-y font-mono text-xs"
            />
            {marker && (
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Badge variant="outline" className="text-[10px]">
                  {marker.kind === "bracket" ? "[TOC]" : "<!-- toc -->"} marker found at line {marker.line + 1}
                </Badge>
                <Button size="sm" variant="ghost" onClick={handleRemoveToc} className="h-6 text-[11px] gap-1">
                  <Trash2 className="h-3 w-3" /> Remove TOC
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Label className="text-sm font-semibold text-foreground">Output</Label>
                <Button size="sm" variant={view === "toc" ? "default" : "ghost"} onClick={() => setView("toc")} className="h-7 text-[11px]">
                  TOC only
                </Button>
                <Button size="sm" variant={view === "inserted" ? "default" : "ghost"} onClick={() => setView("inserted")} className="h-7 text-[11px]">
                  Inserted in doc
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" onClick={handleInsertAtTop} className="gap-1.5">
                  <ArrowRightLeft className="h-3.5 w-3.5" /> Insert into doc
                </Button>
                <CopyButton getText={() => { handleSaveHistory(); return output; }} label="Copy" />
                <DownloadButton getText={() => { handleSaveHistory(); return output; }} filename="toc.md" mime="text/markdown" label="Download" />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(options); }} />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <Stat label="Headings" value={stats.total} />
              <Stat label="Duplicates" value={stats.duplicates} />
              <Stat label="Platform" value={PLATFORM_LABELS[options.platform]} />
              <Stat label="TOC chars" value={stats.chars} />
            </div>
            {output ? (
              <pre className="rounded border bg-muted/30 p-3 text-[11px] font-mono whitespace-pre-wrap max-h-[320px] overflow-auto">{output}</pre>
            ) : (
              <EmptyState
                title="Paste a markdown document to generate a TOC"
                hint="Headings (H1–H6) become a clickable nested list with anchor links. Code fences and setext headings are handled."
                icon={<List className="h-8 w-8" />}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {stats.total > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Headings by level</h3>
            <div className="flex flex-wrap gap-2">
              {LEVELS.map((l) => (
                <Badge key={l} variant={stats.byLevel[l] > 0 ? "default" : "outline"} className="text-[11px]">
                  H{l}: {stats.byLevel[l]}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs flex items-center gap-2">
                  <LinkIcon className="h-3 w-3 text-muted-foreground" />
                  <Badge variant="outline" className="text-[10px]">{PLATFORM_LABELS[h.platform]}</Badge>
                  <Badge variant="outline" className="text-[10px]">{h.headingCount} headings</Badge>
                  <span className="font-mono text-muted-foreground truncate flex-1">{h.preview}</span>
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
            <strong className="text-foreground">Privacy:</strong> All parsing and TOC generation runs locally. Your documents never leave the browser. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border bg-background px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}
