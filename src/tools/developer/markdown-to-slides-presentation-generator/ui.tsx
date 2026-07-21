"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
  History, Presentation, ExternalLink, ChevronLeft, ChevronRight,
  Sparkles, FileText, Code2, StickyNote, Maximize2, BookOpen,
} from "lucide-react";
import {
  THEMES,
  TRANSITIONS,
  DEFAULT_OPTIONS,
  DEFAULT_MARKDOWN,
  splitMarkdown,
  parseDeck,
  computeStats,
  buildDeckHtml,
  buildOutline,
  renderSlideHtml,
  autoFormat,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type SplitMode,
  type ThemeName,
  type TransitionName,
  type DeckOptions,
  type HistoryEntry,
} from "./logic";

export default function MarkdownToSlidesPresentationGenerator() {
  const [markdown, setMarkdown] = useState<string>(() => DEFAULT_MARKDOWN);
  const [options, setOptions] = useState<DeckOptions>(() => ({ ...DEFAULT_OPTIONS }));
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeTab, setActiveTab] = useState<"editor" | "preview" | "outline">("editor");
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (parsed.md) {
        setMarkdown(parsed.md);
        setOptions(parsed.options);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const slides = useMemo(() => parseDeck(markdown, options), [markdown, options]);
  const stats = useMemo(() => computeStats(markdown, options), [markdown, options]);
  const outline = useMemo(() => buildOutline(markdown, options), [markdown, options]);
  const deckHtml = useMemo(() => buildDeckHtml(markdown, options), [markdown, options]);

  // Build a preview HTML for the current slide (just the rendered section, no full document)
  const currentSlideHtml = useMemo(() => {
    if (slides.length === 0) return "";
    const idx = Math.min(currentSlide, slides.length - 1);
    return renderSlideHtml(slides[idx]);
  }, [slides, currentSlide]);

  const handleFormat = useCallback(() => {
    setMarkdown((m) => autoFormat(m));
    toast.success("Auto-formatted");
  }, []);

  const handleSaveHistory = useCallback(() => {
    if (markdown.trim()) {
      saveHistory({
        ts: Date.now(),
        slideCount: stats.slideCount,
        theme: options.theme,
        preview: markdown.slice(0, 80).replace(/\n/g, " "),
      });
      setHistory(loadHistory());
    }
  }, [markdown, stats.slideCount, options.theme]);

  const handleClear = useCallback(() => {
    setMarkdown("");
    setCurrentSlide(0);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleOpenInNewTab = useCallback(() => {
    handleSaveHistory();
    const blob = new Blob([deckHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, [deckHtml, handleSaveHistory]);

  // Keyboard navigation in preview mode
  useEffect(() => {
    if (activeTab !== "preview") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        setCurrentSlide((i) => Math.min(i + 1, slides.length - 1));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        setCurrentSlide((i) => Math.max(i - 1, 0));
      } else if (e.key === "Home") {
        e.preventDefault();
        setCurrentSlide(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setCurrentSlide(slides.length - 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeTab, slides.length]);

  const updateOption = <K extends keyof DeckOptions>(key: K, value: DeckOptions[K]) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Button variant={activeTab === "editor" ? "default" : "outline"} size="sm"
              onClick={() => setActiveTab("editor")} className="gap-1.5">
              <Code2 className="h-3.5 w-3.5" /> Editor
            </Button>
            <Button variant={activeTab === "preview" ? "default" : "outline"} size="sm"
              onClick={() => setActiveTab("preview")} className="gap-1.5">
              <Presentation className="h-3.5 w-3.5" /> Preview
            </Button>
            <Button variant={activeTab === "outline" ? "default" : "outline"} size="sm"
              onClick={() => setActiveTab("outline")} className="gap-1.5">
              <BookOpen className="h-3.5 w-3.5" /> Outline
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                {stats.slideCount} slides · {stats.notesCount} notes · {stats.imagesCount} images · {stats.codeBlocksCount} code blocks
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {activeTab === "editor" && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="mds-md">Markdown source</Label>
                <Textarea
                  id="mds-md"
                  value={markdown}
                  onChange={(e) => setMarkdown(e.target.value)}
                  placeholder={"# Title slide\n\n---\n\n## Agenda\n\n1. Topic A\n2. Topic B\n\n<!-- note: Don't forget to introduce yourself. -->"}
                  className="min-h-[300px] resize-y font-mono text-xs"
                  spellCheck={false}
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="mds-split" className="text-xs">Split mode</Label>
                  <select
                    id="mds-split"
                    value={options.splitMode}
                    onChange={(e) => updateOption("splitMode", e.target.value as SplitMode)}
                    className="h-8 w-full text-xs rounded border bg-background px-2"
                  >
                    <option value="separator">--- separator (Marp)</option>
                    <option value="heading">## Headings</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="mds-theme" className="text-xs">Theme</Label>
                  <select
                    id="mds-theme"
                    value={options.theme}
                    onChange={(e) => updateOption("theme", e.target.value as ThemeName)}
                    className="h-8 w-full text-xs rounded border bg-background px-2"
                  >
                    {THEMES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="mds-trans" className="text-xs">Transition</Label>
                  <select
                    id="mds-trans"
                    value={options.transition}
                    onChange={(e) => updateOption("transition", e.target.value as TransitionName)}
                    className="h-8 w-full text-xs rounded border bg-background px-2"
                  >
                    {TRANSITIONS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="mds-title" className="text-xs">Presentation title</Label>
                  <Input
                    id="mds-title"
                    value={options.title}
                    onChange={(e) => updateOption("title", e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label htmlFor="mds-author" className="text-xs">Author</Label>
                  <Input
                    id="mds-author"
                    value={options.author}
                    onChange={(e) => updateOption("author", e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="flex items-end gap-3 pb-1">
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={options.slideNumbers}
                      onChange={(e) => updateOption("slideNumbers", e.target.checked)}
                    />
                    Slide numbers
                  </label>
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={options.progress}
                      onChange={(e) => updateOption("progress", e.target.checked)}
                    />
                    Progress bar
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return markdown; }}
                  label="Copy markdown"
                />
                <Button variant="outline" size="sm" onClick={handleFormat} className="gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Auto-format
                </Button>
                <DownloadButton
                  getText={() => { handleSaveHistory(); return deckHtml; }}
                  filename="presentation.html"
                  mime="text/html"
                  label="Download HTML"
                  disabled={!markdown.trim()}
                />
                <Button size="sm" onClick={handleOpenInNewTab} disabled={!markdown.trim()} className="gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5" /> Present in new tab
                </Button>
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(markdown, options); }} disabled={!markdown.trim()} />
                <ClearButton onClick={handleClear} disabled={!markdown.trim()} />
              </div>
            </CardContent>
          </Card>

          {slides.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <FileText className="h-4 w-4" /> Slides ({slides.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[400px] overflow-auto">
                  {slides.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => { setCurrentSlide(i); setActiveTab("preview"); }}
                      className="rounded border bg-background p-3 text-left hover:bg-accent hover:border-primary transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{s.index}</Badge>
                        <span className="text-xs font-medium text-foreground truncate">
                          {s.title || "(untitled)"}
                        </span>
                        {s.notes && (
                          <StickyNote className="h-3 w-3 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                        )}
                        {s.fragments > 0 && (
                          <Badge variant="secondary" className="text-[10px]">{s.fragments}f</Badge>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                        {s.markdown.replace(/<!--[\s\S]*?-->/g, "").trim().slice(0, 100)}
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {activeTab === "preview" && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Presentation className="h-4 w-4" /> Slide {currentSlide + 1} of {slides.length}
              </h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setCurrentSlide((i) => Math.max(0, i - 1))}
                  disabled={currentSlide === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setCurrentSlide((i) => Math.min(slides.length - 1, i + 1))}
                  disabled={currentSlide >= slides.length - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button size="sm" onClick={handleOpenInNewTab} className="gap-1.5">
                  <Maximize2 className="h-3.5 w-3.5" /> Fullscreen
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Use ← / → arrow keys to navigate. Press <kbd className="px-1 py-0.5 rounded border bg-muted text-[10px]">N</kbd> in the new-tab view to toggle speaker notes.
            </p>

            {slides.length > 0 ? (
              <div
                className="rounded border min-h-[400px] p-6 overflow-auto"
                style={{ background: themeBg(options.theme), color: themeFg(options.theme) }}
                dangerouslySetInnerHTML={{ __html: currentSlideHtml }}
              />
            ) : (
              <EmptyState
                title="No slides to preview"
                hint="Enter Markdown in the Editor tab to generate slides."
                icon={<Presentation className="h-8 w-8" />}
              />
            )}

            {slides.length > 0 && slides[Math.min(currentSlide, slides.length - 1)].notes && (
              <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
                <div className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400 mb-1">
                  <StickyNote className="h-3.5 w-3.5" /> Speaker notes
                </div>
                <pre className="whitespace-pre-wrap font-sans text-amber-900 dark:text-amber-200">
                  {slides[Math.min(currentSlide, slides.length - 1)].notes}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "outline" && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" /> Deck outline
            </h3>
            {outline.length > 0 ? (
              <ol className="space-y-1">
                {outline.map((o) => (
                  <li
                    key={o.index}
                    className="flex items-center gap-2 rounded border bg-background px-3 py-2 text-xs"
                  >
                    <Badge variant="outline" className="text-[10px]">{o.index}</Badge>
                    <span className="font-medium text-foreground flex-1 truncate">{o.title}</span>
                    {o.hasNotes && (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <StickyNote className="h-3 w-3" /> notes
                      </Badge>
                    )}
                    {o.fragmentCount > 0 && (
                      <Badge variant="outline" className="text-[10px]">{o.fragmentCount} fragments</Badge>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState
                title="No slides yet"
                hint="Enter Markdown in the Editor tab to build your outline."
                icon={<BookOpen className="h-8 w-8" />}
              />
            )}
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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{h.slideCount} slides</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.theme}</Badge>
                    <span className="font-mono text-muted-foreground truncate flex-1">{h.preview}</span>
                    <span className="text-muted-foreground text-[10px]">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All markdown parsing, slide splitting, and HTML generation runs locally in your browser. The exported HTML file is fully self-contained — no external CSS, JS, or fonts — and opens offline in any browser. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function themeBg(theme: ThemeName): string {
  const map: Record<ThemeName, string> = {
    default: "#ffffff",
    black: "#111111",
    league: "#555555",
    beige: "#f7f3de",
    blood: "#a20a0a",
    night: "#0a0a0a",
    serif: "#ffffff",
    solarized: "#fdf6e3",
  };
  return map[theme] || map.default;
}

function themeFg(theme: ThemeName): string {
  const map: Record<ThemeName, string> = {
    default: "#222222",
    black: "#eeeeee",
    league: "#ffffff",
    beige: "#333333",
    blood: "#ffffff",
    night: "#e0e0e0",
    serif: "#222222",
    solarized: "#586e75",
  };
  return map[theme] || map.default;
}
