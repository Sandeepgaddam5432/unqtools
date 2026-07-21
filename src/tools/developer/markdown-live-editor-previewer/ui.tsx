"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
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
  History, FileText, Moon, Sun, Eye, Code, AlertTriangle, Hash, Type,
} from "lucide-react";
import {
  SAMPLE_DOC,
  parseMarkdown,
  computeStats,
  validateMarkdown,
  exportHtml,
  loadHistory,
  saveHistory,
  clearHistory,
  loadAutosave,
  saveAutosave,
  clearAutosave,
  buildShareUrl,
  parseShareUrl,
  type HistoryEntry,
} from "./logic";

export default function MarkdownLiveEditorPreviewer() {
  const [text, setText] = useState("");
  const [dark, setDark] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [view, setView] = useState<"split" | "preview" | "source">("split");
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);

  // Load initial content (hash > autosave > empty) + history
  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.text) {
        setText(p.text);
        toast.info("Loaded from share link");
        return;
      }
    }
    const auto = loadAutosave();
    if (auto) {
      setText(auto);
      toast.info("Restored autosaved draft");
    }
  }, []);

  // Autosave on change (debounced via effect)
  useEffect(() => {
    const id = setTimeout(() => {
      saveAutosave(text);
    }, 600);
    return () => clearTimeout(id);
  }, [text]);

  const html = useMemo(() => parseMarkdown(text), [text]);
  const stats = useMemo(() => computeStats(text), [text]);
  const validation = useMemo(() => validateMarkdown(text), [text]);

  const handleSaveHistory = useCallback(() => {
    if (!text.trim()) return;
    saveHistory({
      ts: Date.now(),
      chars: stats.chars,
      words: stats.words,
      preview: text.slice(0, 120),
    });
    setHistory(loadHistory());
  }, [text, stats]);

  const handleClear = useCallback(() => {
    setText("");
    clearAutosave();
    toast.info("Cleared editor + autosave");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleShare = useCallback((): string => {
    handleSaveHistory();
    const r = buildShareUrl(text);
    if (r.tooLarge) {
      toast.error("Document too large for share link — copied markdown instead.");
      void navigator.clipboard?.writeText(text);
      return text;
    }
    return r.url;
  }, [text, handleSaveHistory]);

  const handleDownloadHtml = useCallback(() => {
    handleSaveHistory();
    return exportHtml(text, { title: "Markdown Export", dark });
  }, [text, dark, handleSaveHistory]);

  // Sync scroll: when editor scrolls, scroll preview proportionally
  const handleEditorScroll = useCallback(() => {
    if (view !== "split") return;
    const ed = editorRef.current;
    const pv = previewRef.current;
    if (!ed || !pv) return;
    const max = ed.scrollHeight - ed.clientHeight;
    if (max <= 0) return;
    const ratio = ed.scrollTop / max;
    pv.scrollTop = ratio * (pv.scrollHeight - pv.clientHeight);
  }, [view]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={view === "split" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("split")}
              className="gap-1.5"
            >
              <Eye className="h-3.5 w-3.5" /> Split
            </Button>
            <Button
              variant={view === "source" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("source")}
              className="gap-1.5"
            >
              <Code className="h-3.5 w-3.5" /> Source
            </Button>
            <Button
              variant={view === "preview" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("preview")}
              className="gap-1.5"
            >
              <FileText className="h-3.5 w-3.5" /> Preview
            </Button>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDark((d) => !d)}
                className="gap-1.5"
              >
                {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                {dark ? "Light" : "Dark"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setText(SAMPLE_DOC); toast.info("Loaded sample document"); }}
                className="gap-1.5"
              >
                <FileText className="h-3.5 w-3.5" /> Sample
              </Button>
              <ClearButton onClick={handleClear} />
            </div>
          </div>
        </CardContent>
      </Card>

      {validation.issues.length > 0 && (
        <Card>
          <CardContent className="p-3 space-y-1">
            {validation.issues.map((iss, i) => (
              <div
                key={i}
                className={`text-xs flex items-start gap-1.5 ${
                  iss.severity === "error"
                    ? "text-red-600 dark:text-red-400"
                    : "text-amber-600 dark:text-amber-400"
                }`}
              >
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <span>Line {iss.line}: {iss.message}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div
        className={`grid gap-3 ${
          view === "split" ? "lg:grid-cols-2" : "grid-cols-1"
        }`}
      >
        {(view === "split" || view === "source") && (
          <Card>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="md-editor" className="text-xs flex items-center gap-1">
                  <Code className="h-3.5 w-3.5" /> Markdown
                </Label>
                <Badge variant="outline" className="text-[10px]">{stats.lines} lines</Badge>
              </div>
              <Textarea
                id="md-editor"
                ref={editorRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onScroll={handleEditorScroll}
                placeholder="# Type your markdown here…"
                className="min-h-[420px] resize-y font-mono text-xs leading-relaxed"
                spellCheck={false}
              />
            </CardContent>
          </Card>
        )}
        {(view === "split" || view === "preview") && (
          <Card>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" /> Preview
                </Label>
                <Badge variant="outline" className="text-[10px]">
                  {dark ? "dark" : "light"}
                </Badge>
              </div>
              <div
                ref={previewRef}
                className={`min-h-[420px] max-h-[600px] overflow-auto rounded border p-4 text-sm ${dark ? "md-preview-dark" : "md-preview-light"}`}
              >
                {text.trim() ? (
                  <div dangerouslySetInnerHTML={{ __html: html }} />
                ) : (
                  <EmptyState
                    title="Preview will appear here"
                    hint="Type markdown on the left or load the sample document."
                    icon={<FileText className="h-8 w-8" />}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {text.trim() && (
        <Card>
          <CardContent className="p-3">
            <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 text-xs">
              <Stat icon={<Type className="h-3 w-3" />} label="Words" value={stats.words} />
              <Stat icon={<Hash className="h-3 w-3" />} label="Chars" value={stats.chars} />
              <Stat label="No-space" value={stats.charsNoSpaces} />
              <Stat label="Lines" value={stats.lines} />
              <Stat label="Paragraphs" value={stats.paragraphs} />
              <Stat label="Code blocks" value={stats.codeBlocks} />
              <Stat label="Read min" value={stats.readingTimeMin} />
            </div>
          </CardContent>
        </Card>
      )}

      {text.trim() && (
        <Card>
          <CardContent className="p-3">
            <div className="flex flex-wrap gap-2">
              <CopyButton getText={() => { handleSaveHistory(); return text; }} label="Copy .md" />
              <DownloadButton
                getText={() => { handleSaveHistory(); return text; }}
                filename="document.md"
                mime="text/markdown"
                label="Download .md"
              />
              <DownloadButton
                getText={handleDownloadHtml}
                filename="document.html"
                mime="text/html"
                label="Download .html"
              />
              <ShareButton getUrl={handleShare} />
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
                <button
                  key={i}
                  onClick={() => {
                    setText(loadAutosave() ?? h.preview);
                    toast.info("Loaded from history preview");
                  }}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:border-primary/40"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{h.words} words</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.chars} chars</Badge>
                    <span className="font-mono text-muted-foreground truncate flex-1 min-w-0">
                      {h.preview.slice(0, 80) || "(empty)"}
                    </span>
                    <span className="text-muted-foreground">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <style jsx global>{`
        .md-preview-light, .md-preview-dark {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
          line-height: 1.6;
        }
        .md-preview-light { color: #1f2328; }
        .md-preview-light h1, .md-preview-light h2 { border-bottom: 1px solid #d0d7de; padding-bottom: 0.3em; }
        .md-preview-light a { color: #0969da; }
        .md-preview-light code { background: rgba(175,184,193,0.2); padding: 0.15em 0.35em; border-radius: 4px; font-size: 0.9em; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
        .md-preview-light pre { background: #f6f8fa; padding: 0.75em; border-radius: 6px; overflow-x: auto; }
        .md-preview-light pre code { background: transparent; padding: 0; font-size: 0.85em; }
        .md-preview-light blockquote { border-left: 4px solid #d0d7de; padding: 0 1em; color: #57606a; margin: 0 0 1em; }
        .md-preview-light table { border-collapse: collapse; width: 100%; margin: 0 0 1em; }
        .md-preview-light th, .md-preview-light td { border: 1px solid #d0d7de; padding: 0.4em 0.7em; }
        .md-preview-light th { background: #f6f8fa; font-weight: 600; }
        .md-preview-light hr { border: none; border-top: 2px solid #d0d7de; margin: 1.5em 0; }
        .md-preview-light img { max-width: 100%; }

        .md-preview-dark { background: #0d1117; color: #c9d1d9; }
        .md-preview-dark h1, .md-preview-dark h2 { border-bottom: 1px solid #30363d; padding-bottom: 0.3em; }
        .md-preview-dark a { color: #58a6ff; }
        .md-preview-dark code { background: rgba(110,118,129,0.4); padding: 0.15em 0.35em; border-radius: 4px; font-size: 0.9em; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
        .md-preview-dark pre { background: #161b22; padding: 0.75em; border-radius: 6px; overflow-x: auto; }
        .md-preview-dark pre code { background: transparent; padding: 0; font-size: 0.85em; }
        .md-preview-dark blockquote { border-left: 4px solid #30363d; padding: 0 1em; color: #8b949e; margin: 0 0 1em; }
        .md-preview-dark table { border-collapse: collapse; width: 100%; margin: 0 0 1em; }
        .md-preview-dark th, .md-preview-dark td { border: 1px solid #30363d; padding: 0.4em 0.7em; }
        .md-preview-dark th { background: #161b22; font-weight: 600; }
        .md-preview-dark hr { border: none; border-top: 2px solid #30363d; margin: 1.5em 0; }
        .md-preview-dark img { max-width: 100%; }

        .tok-keyword { color: #cf222e; }
        .md-preview-dark .tok-keyword { color: #ff7b72; }
        .tok-string { color: #0a3069; }
        .md-preview-dark .tok-string { color: #a5d6ff; }
        .tok-number { color: #0550ae; }
        .md-preview-dark .tok-number { color: #79c0ff; }
        .tok-comment { color: #6e7781; font-style: italic; }
        .md-preview-dark .tok-comment { color: #8b949e; }
        .tok-tag { color: #116329; }
        .md-preview-dark .tok-tag { color: #7ee787; }
        .tok-variable { color: #953800; }
        .md-preview-dark .tok-variable { color: #ffa657; }
      `}</style>

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> Rendering, highlighting, and HTML
            export all run in your browser. Nothing is uploaded. Autosave writes to localStorage on
            this device only and the share link encodes content into the hash (never sent to a server).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded border bg-background px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className="text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}
