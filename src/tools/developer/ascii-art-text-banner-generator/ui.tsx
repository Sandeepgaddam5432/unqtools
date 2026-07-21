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
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  Type, History, FlipHorizontal, FlipVertical, WrapText,
} from "lucide-react";
import {
  FONTS,
  CHARSET_LABELS,
  PRESET_PHRASES,
  getFont,
  renderText,
  wrapAsMarkdown,
  wrapAsHtml,
  wrapAsComment,
  buildHtmlDocument,
  renderedWidth,
  renderedHeight,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type CharSet,
  type HistoryEntry,
} from "./logic";

type Wrapper = "raw" | "markdown" | "html" | "comment-c" | "comment-shell";

const WRAPPER_LABELS: Record<Wrapper, string> = {
  raw: "Plain text",
  markdown: "Markdown ```",
  html: "HTML <pre>",
  "comment-c": "/* C comment */",
  "comment-shell": "# Shell comment",
};

export default function AsciiArtTextBannerGenerator() {
  const [text, setText] = useState("HELLO");
  const [fontId, setFontId] = useState("block");
  const [charSet, setCharSet] = useState<CharSet>("raw");
  const [maxWidth, setMaxWidth] = useState(80);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [letterSpacing, setLetterSpacing] = useState(1);
  const [wrapper, setWrapper] = useState<Wrapper>("raw");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.text) setText(p.text);
      if (p.fontId) setFontId(p.fontId);
      if (p.charSet) setCharSet(p.charSet);
      if (p.width) setMaxWidth(p.width);
      if (p.flipH) setFlipH(p.flipH);
      if (p.flipV) setFlipV(p.flipV);
      if (p.text || p.fontId !== "block") toast.info("Loaded from share link");
    }
  }, []);

  const font = useMemo(() => getFont(fontId) ?? FONTS[0], [fontId]);

  const rawArt = useMemo(
    () => renderText(text, font, { charSet, maxWidth, flipH, flipV, letterSpacing }),
    [text, font, charSet, maxWidth, flipH, flipV, letterSpacing],
  );

  const wrappedArt = useMemo(() => {
    if (!rawArt) return "";
    switch (wrapper) {
      case "markdown": return wrapAsMarkdown(rawArt);
      case "html": return wrapAsHtml(rawArt);
      case "comment-c": return wrapAsComment(rawArt, "c");
      case "comment-shell": return wrapAsComment(rawArt, "shell");
      default: return rawArt;
    }
  }, [rawArt, wrapper]);

  const width = useMemo(() => renderedWidth(rawArt), [rawArt]);
  const height = useMemo(() => renderedHeight(rawArt), [rawArt]);

  const handleSaveHistory = useCallback(() => {
    if (text && rawArt) {
      saveHistory({ ts: Date.now(), text, fontId, charSet, width: maxWidth });
      setHistory(loadHistory());
    }
  }, [text, rawArt, fontId, charSet, maxWidth]);

  const handleClear = useCallback(() => {
    setText("");
    setFlipH(false);
    setFlipV(false);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleCopy = useCallback(() => {
    handleSaveHistory();
    return wrappedArt;
  }, [wrappedArt, handleSaveHistory]);

  const handleDownload = useCallback(() => {
    handleSaveHistory();
    if (wrapper === "html") {
      return buildHtmlDocument(rawArt, text || "ASCII Art");
    }
    return wrappedArt;
  }, [wrappedArt, rawArt, text, wrapper, handleSaveHistory]);

  const downloadFilename = wrapper === "html" ? "ascii-art.html" : "ascii-art.txt";
  const downloadMime = wrapper === "html" ? "text/html" : "text/plain";

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="aat-text" className="text-sm font-semibold">Text to render</Label>
            <Textarea
              id="aat-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type text to render as ASCII art (case-insensitive)…"
              className="min-h-[60px] resize-y font-mono text-sm"
            />
            <div className="flex flex-wrap gap-1">
              {PRESET_PHRASES.map((p) => (
                <Button
                  key={p}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={() => setText(p)}
                >{p}</Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Font ({FONTS.length})</Label>
              <select
                value={fontId}
                onChange={(e) => setFontId(e.target.value)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {FONTS.map((f) => (
                  <option key={f.id} value={f.id}>{f.name} ({f.height}×{f.width})</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Character set</Label>
              <select
                value={charSet}
                onChange={(e) => setCharSet(e.target.value as CharSet)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(CHARSET_LABELS) as CharSet[]).map((c) => (
                  <option key={c} value={c}>{CHARSET_LABELS[c]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Wrapper</Label>
              <select
                value={wrapper}
                onChange={(e) => setWrapper(e.target.value as Wrapper)}
                className="h-8 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(WRAPPER_LABELS) as Wrapper[]).map((w) => (
                  <option key={w} value={w}>{WRAPPER_LABELS[w]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Max width (cols)</Label>
              <Input
                type="number"
                min={20}
                max={500}
                value={maxWidth}
                onChange={(e) => setMaxWidth(parseInt(e.target.value, 10) || 80)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Letter spacing</Label>
              <Input
                type="number"
                min={0}
                max={5}
                value={letterSpacing}
                onChange={(e) => setLetterSpacing(parseInt(e.target.value, 10) || 0)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Transforms</Label>
              <div className="flex gap-2 h-8 items-center">
                <Button
                  variant={flipH ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-[11px] gap-1"
                  onClick={() => setFlipH((p) => !p)}
                ><FlipHorizontal className="h-3 w-3" /> H</Button>
                <Button
                  variant={flipV ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-[11px] gap-1"
                  onClick={() => setFlipV((p) => !p)}
                ><FlipVertical className="h-3 w-3" /> V</Button>
              </div>
            </div>
          </div>

          {font && (
            <div className="text-[10px] text-muted-foreground">
              <Badge variant="outline" className="text-[9px] mr-1">{font.id}</Badge>
              {font.description}
            </div>
          )}
        </CardContent>
      </Card>

      {rawArt ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Type className="h-4 w-4" /> Preview
              </h3>
              <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                <Badge variant="outline" className="text-[9px]"><WrapText className="h-3 w-3 mr-1" />{width} cols</Badge>
                <Badge variant="outline" className="text-[9px]">{height} rows</Badge>
                <Badge variant="outline" className="text-[9px]">{rawArt.length} chars</Badge>
              </div>
            </div>
            <div className="rounded border bg-background p-3 overflow-auto max-h-[500px]">
              <pre className="text-[11px] leading-tight font-mono whitespace-pre text-foreground">
                {rawArt}
              </pre>
            </div>
            <div className="flex flex-wrap gap-2">
              <CopyButton getText={handleCopy} label="Copy" />
              <DownloadButton
                getText={handleDownload}
                filename={downloadFilename}
                mime={downloadMime}
                label={`Download .${wrapper === "html" ? "html" : "txt"}`}
              />
              <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(text, fontId, charSet, maxWidth, flipH, flipV); }} />
              <ClearButton onClick={handleClear} />
            </div>
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="Type some text to render an ASCII art banner"
          hint="Pick from 12 bundled fonts, choose a character set overlay, set a custom width with word-wrap, flip horizontally or vertically, and download as text or HTML."
          icon={<Type className="h-8 w-8" />}
        />
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
                  <Badge variant="outline" className="mr-2 text-[9px]">{h.fontId}</Badge>
                  <Badge variant="outline" className="mr-2 text-[9px]">{h.charSet}</Badge>
                  <Badge variant="outline" className="mr-2 text-[9px]">{h.width} cols</Badge>
                  <span className="font-mono text-foreground">{h.text}</span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All rendering runs locally. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
