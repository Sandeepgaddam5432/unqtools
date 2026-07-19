"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  PDFDocument,
  PDFRawStream,
  PDFStream,
  PDFArray,
  decodePDFRawStream,
} from "pdf-lib";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, FileUp, Trash2, Presentation, History, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import {
  ActionBar,
  ClearButton,
  CopyButton,
  DownloadButton,
  EmptyState,
  ErrorBanner,
  RunButton,
  ShareButton,
} from "../../_shared";
import { formatBytes, downloadBytes } from "../_shared/download";
import { parsePageRanges } from "../_shared/page-ranges";
import {
  DEFAULT_OPTIONS,
  FORMAT_EXTENSIONS,
  FORMAT_LABELS,
  FORMAT_MIME,
  OUTPUT_FORMATS,
  SLIDE_LAYOUTS,
  SLIDE_LAYOUT_LABELS,
  normalizePageRangeSpec,
  resolveAllRange,
  analyzeFontSizes,
  detectParagraphs,
  extractSlideContent,
  calcSlideDimensions,
  computeSummaryStats,
  scoreTitleExtraction,
  validateSpeakerNotes,
  renderOutput,
  buildPptxPackage,
  getOutputFilename,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  validateOptions,
  type TextItem,
  type Paragraph,
  type SlideContent,
  type ConvertOptions,
  type OutputFormat,
  type SlideLayout,
  type HistoryEntry,
} from "./logic";

// ---------------------------------------------------------------------------
// PDF content-stream text extraction with font-size tracking
// (reuses the same approach as pdf-to-word-converter)
// ---------------------------------------------------------------------------

function decodePdfStringBody(body: string): string {
  let out = "";
  let i = 0;
  while (i < body.length) {
    const ch = body[i];
    if (ch === "\\") {
      const next = body[i + 1];
      if (next === "n") { out += "\n"; i += 2; }
      else if (next === "r") { out += "\r"; i += 2; }
      else if (next === "t") { out += "\t"; i += 2; }
      else if (next === "b") { out += "\b"; i += 2; }
      else if (next === "f") { out += "\f"; i += 2; }
      else if (next === "(") { out += "("; i += 2; }
      else if (next === ")") { out += ")"; i += 2; }
      else if (next === "\\") { out += "\\"; i += 2; }
      else if (next === "\n") { i += 2; }
      else if (next && /[0-7]/.test(next)) {
        let octal = next;
        if (/[0-7]/.test(body[i + 2] ?? "")) octal += body[i + 2];
        if (/[0-7]/.test(body[i + 3] ?? "")) octal += body[i + 3];
        out += String.fromCharCode(parseInt(octal, 8));
        i += 1 + octal.length;
      } else {
        out += next ?? "";
        i += 2;
      }
    } else {
      out += ch;
      i++;
    }
  }
  return out;
}

function consumeParenString(content: string, start: number): { text: string; end: number } {
  let i = start + 1;
  let depth = 1;
  let body = "";
  while (i < content.length && depth > 0) {
    const ch = content[i];
    if (ch === "\\") {
      body += ch + (content[i + 1] ?? "");
      i += 2;
      continue;
    }
    if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) break;
    }
    body += ch;
    i++;
  }
  return { text: decodePdfStringBody(body), end: i + 1 };
}

function decodeHexBody(hex: string): string {
  const clean = hex.replace(/\s/g, "");
  const padded = clean.length % 2 === 0 ? clean : clean + "0";
  let out = "";
  for (let i = 0; i < padded.length; i += 2) {
    out += String.fromCharCode(parseInt(padded.slice(i, i + 2), 16));
  }
  return out;
}

interface RawItem {
  text: string;
  fontSize: number;
}

function parsePdfContentStreamForItems(content: string): RawItem[] {
  const items: RawItem[] = [];
  let currentFontSize = 0;
  let pendingText = "";
  const flush = () => {
    if (pendingText) {
      items.push({ text: pendingText, fontSize: currentFontSize });
      pendingText = "";
    }
  };
  let i = 0;
  const len = content.length;
  while (i < len) {
    const ch = content[i];
    if (ch === "(") {
      const r = consumeParenString(content, i);
      pendingText += r.text;
      i = r.end;
    } else if (ch === "<" && content[i + 1] !== "<") {
      const close = content.indexOf(">", i);
      if (close > 0) {
        const hex = content.slice(i + 1, close);
        if (/^[0-9a-fA-F\s]*$/.test(hex) && hex.trim().length > 0) {
          pendingText += decodeHexBody(hex);
        }
        i = close + 1;
      } else {
        i++;
      }
    } else if (ch === "T" && content[i + 1] === "*") {
      flush();
      i += 2;
    } else if ((ch === "'" || ch === "\"") && (pendingText || items.length > 0)) {
      flush();
      i++;
    } else if (ch === "T" && content[i + 1] === "d") {
      const before = content.slice(Math.max(0, i - 40), i);
      const nums = before.match(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*$/);
      if (nums) {
        const y = parseFloat(nums[2]);
        if (y < -0.5) flush();
      }
      i += 2;
    } else if (ch === "T" && content[i + 1] === "D") {
      const before = content.slice(Math.max(0, i - 40), i);
      const nums = before.match(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*$/);
      if (nums) {
        const y = parseFloat(nums[2]);
        if (y < -0.5) flush();
      }
      i += 2;
    } else if (ch === "T" && content[i + 1] === "m") {
      flush();
      i += 2;
    } else if (ch === "T" && content[i + 1] === "f") {
      const before = content.slice(Math.max(0, i - 30), i);
      const m = before.match(/(-?\d+(?:\.\d+)?)\s*$/);
      if (m) {
        currentFontSize = parseFloat(m[1]);
      }
      i += 2;
    } else if (ch === "E" && content[i + 1] === "T") {
      flush();
      i += 2;
    } else {
      i++;
    }
  }
  flush();
  return items;
}

function getStreamBytes(stream: unknown): Uint8Array {
  if (!stream) return new Uint8Array(0);
  try {
    if (stream instanceof PDFRawStream) {
      return decodePDFRawStream(stream).decode();
    }
    if (stream instanceof PDFStream) {
      return stream.getContents();
    }
  } catch {
    // ignore
  }
  return new Uint8Array(0);
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/** Extract TextItems (with font size) from a single PDF page. */
function extractItemsFromPage(page: { node: { Contents?: () => unknown } }, pageNumber: number): TextItem[] {
  let contents: unknown;
  try {
    contents = page.node.Contents?.();
  } catch {
    return [];
  }
  if (!contents) return [];
  let bytes: Uint8Array;
  if (contents instanceof PDFArray) {
    const parts: Uint8Array[] = [];
    for (let i = 0; i < contents.size(); i++) {
      const item = contents.lookup(i);
      parts.push(getStreamBytes(item));
    }
    bytes = concatBytes(parts);
  } else {
    bytes = getStreamBytes(contents);
  }
  if (bytes.length === 0) return [];
  const text = new TextDecoder("latin1").decode(bytes);
  const rawItems = parsePdfContentStreamForItems(text);
  return rawItems.map((r) => ({ text: r.text, fontSize: r.fontSize, pageNumber }));
}

// ---------------------------------------------------------------------------
// React component
// ---------------------------------------------------------------------------

export default function PdfToPowerPointConverter() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; pageCount: number } | null>(null);
  const [opts, setOpts] = useState<ConvertOptions>(DEFAULT_OPTIONS);
  const [slides, setSlides] = useState<SlideContent[] | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      setOpts((prev) => ({ ...prev, ...p }));
      if (Object.keys(p).length > 0) toast.info("Loaded settings from share link");
    }
  }, []);

  async function loadFile(f: File) {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      setFile({ name: f.name, bytes, pageCount: doc.getPageCount() });
      setSlides(null);
      setError("");
    } catch {
      toast.error(`Could not read ${f.name} — it may be corrupted or password-protected.`);
    }
  }

  function reset() {
    setFile(null);
    setSlides(null);
    setError("");
    setOpts(DEFAULT_OPTIONS);
  }

  async function run() {
    if (!file) return;
    setWorking(true);
    setError("");
    setSlides(null);
    try {
      const doc = await PDFDocument.load(file.bytes);
      const total = doc.getPageCount();
      const v = validateOptions(opts, total);
      if (!v.ok) {
        setError(v.error);
        setWorking(false);
        return;
      }
      const rangeSpec = normalizePageRangeSpec(opts.pageRange);
      const resolved = rangeSpec === "all" ? resolveAllRange(rangeSpec, total) : rangeSpec;
      const parsed = parsePageRanges(resolved, total);
      if (!parsed.ok) {
        setError(parsed.error);
        setWorking(false);
        return;
      }
      const pdfPages = doc.getPages();
      const allItems: TextItem[] = [];
      const itemsByPage: Map<number, TextItem[]> = new Map();
      for (const idx of parsed.output) {
        const items = extractItemsFromPage(pdfPages[idx], idx + 1);
        itemsByPage.set(idx + 1, items);
        allItems.push(...items);
      }
      const { bodyFontSize, headingFontSizes } = analyzeFontSizes(allItems);
      const built: SlideContent[] = [];
      let slideNum = 1;
      for (const [pageNumber, items] of itemsByPage) {
        const paragraphs: Paragraph[] = detectParagraphs(items, bodyFontSize, headingFontSizes);
        const slide = extractSlideContent(paragraphs, pageNumber, slideNum);
        built.push(slide);
        slideNum++;
      }
      setSlides(built);
      saveHistory({
        ts: Date.now(),
        fileName: file.name,
        pageCount: total,
        slideCount: built.length,
        layout: opts.slideLayout,
        format: opts.outputFormat,
      });
      setHistory(loadHistory());
      toast.success(`Generated ${built.length} slide${built.length === 1 ? "" : "s"} from ${file.name}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong while converting.");
    } finally {
      setWorking(false);
    }
  }

  const summary = useMemo(() => slides ? computeSummaryStats(slides, opts, file?.pageCount ?? 0) : null, [slides, opts, file]);
  const titleScore = useMemo(() => slides ? scoreTitleExtraction(slides) : null, [slides]);
  const notesValidation = useMemo(() => slides ? validateSpeakerNotes(slides) : null, [slides]);
  const firstPageAspect = useMemo(() => {
    if (!file) return null;
    // Use the file's saved first-page dimensions if available; otherwise default to 612x792 (US Letter)
    return calcSlideDimensions(612, 792, opts.preserveAspectRatio);
  }, [file, opts.preserveAspectRatio]);
  const renderedText = useMemo(() => {
    if (!slides || slides.length === 0 || !firstPageAspect) return "";
    return renderOutput(slides, opts, firstPageAspect);
  }, [slides, opts, firstPageAspect]);

  const update = <K extends keyof ConvertOptions>(key: K, value: ConvertOptions[K]) =>
    setOpts((prev) => ({ ...prev, [key]: value }));

  function handleDownload() {
    if (!slides || slides.length === 0 || !file || !firstPageAspect) return;
    const filename = getOutputFilename(opts.outputFormat, file.name);
    if (opts.outputFormat === "pptx") {
      const bytes = buildPptxPackage(slides, opts, firstPageAspect);
      downloadBytes(bytes, filename, FORMAT_MIME["pptx"]);
    } else {
      const text = renderedText;
      const blob = new Blob([text], { type: FORMAT_MIME[opts.outputFormat] });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`Downloaded ${filename}`);
    }
  }

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {file ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {file.pageCount} page{file.pageCount === 1 ? "" : "s"} • {formatBytes(file.bytes.length)}
            </p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Remove file" onClick={reset}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f) void loadFile(f);
          }}
          className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors"
        >
          <FileUp className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">Drop a PDF here or click to browse</p>
          <p className="mt-1 text-xs text-muted-foreground">
            One slide per page → .pptx / HTML deck / Marp Markdown. 100% client-side.
          </p>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        aria-label="Choose PDF"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void loadFile(f);
          e.target.value = "";
        }}
      />

      {file && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="p2p-range">Page range</Label>
                <Input
                  id="p2p-range"
                  value={opts.pageRange}
                  onChange={(e) => update("pageRange", e.target.value)}
                  placeholder="all or e.g. 1-5, 8, 10-12"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">Use "all" or specific pages. 1-based.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p2p-format">Output format</Label>
                <select
                  id="p2p-format"
                  value={opts.outputFormat}
                  onChange={(e) => update("outputFormat", e.target.value as OutputFormat)}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  {OUTPUT_FORMATS.map((f) => (
                    <option key={f} value={f}>{FORMAT_LABELS[f]}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p2p-layout">Slide layout</Label>
              <select
                id="p2p-layout"
                value={opts.slideLayout}
                onChange={(e) => update("slideLayout", e.target.value as SlideLayout)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                {SLIDE_LAYOUTS.map((l) => (
                  <option key={l} value={l}>{SLIDE_LAYOUT_LABELS[l]}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-4 pt-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={opts.includeSpeakerNotes}
                  onChange={(e) => update("includeSpeakerNotes", e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Include speaker notes (extract non-heading text)
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={opts.preserveAspectRatio}
                  onChange={(e) => update("preserveAspectRatio", e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Preserve PDF page aspect ratio (16:9 / 4:3 / custom)
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      <ActionBar>
        <RunButton onClick={() => void run()} disabled={!file} loading={working} label="Convert to slides" />
        <ClearButton onClick={reset} disabled={!file && !slides && !error} label="Clear" />
      </ActionBar>

      {error && <ErrorBanner message={error} />}

      {summary && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4" /> Summary
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Total slides" value={summary.totalSlides} />
              <Stat label="Source pages" value={summary.totalPagesInSource} />
              <Stat label="Total bullets" value={summary.totalBullets} />
              <Stat label="Total headings" value={summary.totalHeadings} highlight={summary.totalHeadings > 0 ? "good" : undefined} />
              <Stat label="Avg bullets/slide" value={summary.avgBulletsPerSlide} />
              <Stat label="Slides w/ heading title" value={summary.slidesWithHeadingTitle} />
              <Stat label="Slides w/ notes" value={summary.slidesWithNotes} highlight={summary.slidesWithNotes > 0 ? "good" : undefined} />
              <Stat label="Total text chars" value={summary.totalTextLength.toLocaleString()} />
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Badge variant="outline" className="text-[10px]">layout: {summary.layout}</Badge>
              {firstPageAspect && (
                <Badge variant="outline" className="text-[10px]">aspect: {firstPageAspect.label}</Badge>
              )}
              {titleScore && (
                <Badge variant="outline" className="text-[10px]">title quality: {titleScore.score}/100</Badge>
              )}
            </div>
            {titleScore && titleScore.reasons.length > 0 && (
              <div className="text-xs text-muted-foreground pt-1">
                {titleScore.reasons.map((r, i) => (<div key={i}>• {r}</div>))}
              </div>
            )}
            {notesValidation && !notesValidation.ok && (
              <div className="text-xs text-amber-700 dark:text-amber-300 pt-1">
                {notesValidation.warnings.map((w, i) => (<div key={i}>⚠ {w}</div>))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {slides && slides.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Presentation className="h-4 w-4" /> Slides ({slides.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => renderedText} label={`Copy ${opts.outputFormat === "pptx" ? "outline" : FORMAT_LABELS[opts.outputFormat]}`} />
                <Button onClick={handleDownload} className="gap-1.5" size="sm">
                  <Download className="h-3.5 w-3.5" /> Download .{FORMAT_EXTENSIONS[opts.outputFormat]}
                </Button>
                <ShareButton getUrl={() => buildShareUrl(opts)} />
              </div>
            </div>
            <div className="space-y-2 max-h-[420px] overflow-auto">
              {slides.map((s, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">#{s.slideNumber}</Badge>
                    <span className="font-medium text-foreground">{s.title}</span>
                    {!s.hasHeadingTitle && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">auto title</Badge>
                    )}
                    <Badge variant="outline" className="text-[10px]">p.{s.originalPage}</Badge>
                    <Badge variant="outline" className="text-[10px]">{s.bullets.length} bullets</Badge>
                    {opts.includeSpeakerNotes && s.notes && (
                      <Badge variant="outline" className="text-[10px]">{s.notes.length} chars notes</Badge>
                    )}
                  </div>
                  {s.bullets.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5 text-muted-foreground">
                      {s.bullets.slice(0, 5).map((b, j) => (
                        <li key={j} className="truncate">• {b}</li>
                      ))}
                      {s.bullets.length > 5 && (
                        <li className="text-muted-foreground/60">… and {s.bullets.length - 5} more</li>
                      )}
                    </ul>
                  )}
                </div>
              ))}
            </div>
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                View raw {opts.outputFormat === "pptx" ? "text outline (PPTX is binary — download to view in PowerPoint)" : `${FORMAT_LABELS[opts.outputFormat]} output`}
              </summary>
              <pre className="mt-2 max-h-[300px] overflow-auto rounded border bg-muted/30 p-3 text-xs whitespace-pre-wrap font-mono">
                {renderedText || "(empty)"}
              </pre>
            </details>
          </CardContent>
        </Card>
      )}

      {slides && slides.length === 0 && (
        <EmptyState
          title="No text extracted"
          hint="The selected pages may be scanned images. This tool only extracts the embedded text layer."
          icon={<Presentation className="h-8 w-8" />}
        />
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { clearHistory(); setHistory([]); toast.success("History cleared"); }}
              >Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.format}</Badge>
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.layout}</Badge>
                  <span className="font-medium">{h.fileName}</span>
                  <span className="text-muted-foreground ml-2">
                    {h.pageCount}p → {h.slideCount} slides
                  </span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        <strong className="text-foreground">Privacy:</strong> Conversion runs 100% locally — your PDF never leaves your device.
        The .pptx is a minimal OOXML package built in-browser (no external libraries).
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: "bad" | "good";
}) {
  const color = highlight === "bad"
    ? "text-red-600 dark:text-red-400"
    : highlight === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold ${color}`}>{value}</div>
    </div>
  );
}
