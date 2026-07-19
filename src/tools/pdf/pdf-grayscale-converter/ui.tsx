"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  PDFDocument,
  PDFRawStream,
  PDFStream,
  PDFContentStream,
  PDFArray,
  PDFName,
  PDFDict,
  StandardFonts,
  rgb,
  decodePDFRawStream,
  type PDFPage,
} from "pdf-lib";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, FileUp, Trash2, Contrast, History } from "lucide-react";
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
import {
  CONVERSION_METHODS,
  DITHERING_MODES,
  METHOD_LABELS,
  DEFAULT_OPTIONS,
  parseCustomWeights,
  convertWithMethod,
  applyThreshold,
  preserveBlack,
  preserveWhite,
  estimateInkUsage,
  computeInkSavings,
  analyzePageColors,
  computeSummaryStats,
  renderTextReport,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  validateOptions,
  type ConversionMethod,
  type DitheringMode,
  type ConversionOptions,
  type PageConversionStats,
  type RGBColor,
  type HistoryEntry,
} from "./logic";

// ---------------------------------------------------------------------------
// PDF content-stream reading
// ---------------------------------------------------------------------------

function getStreamBytes(stream: unknown): Uint8Array {
  if (!stream) return new Uint8Array(0);
  try {
    if (stream instanceof PDFRawStream) {
      return decodePDFRawStream(stream).decode();
    }
    if (stream instanceof PDFContentStream) {
      // Fall through to PDFStream branch
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

function readPageContent(page: PDFPage): string {
  let contents: unknown;
  try {
    contents = (page.node as unknown as { Contents?: () => unknown }).Contents?.();
  } catch {
    return "";
  }
  if (!contents) return "";
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
  if (bytes.length === 0) return "";
  return new TextDecoder("latin1").decode(bytes);
}

// ---------------------------------------------------------------------------
// Color extraction (mirror of pdf-color-separation, kept local to avoid coupling)
// ---------------------------------------------------------------------------

function cmykToRgb(c: number, m: number, y: number, k: number): RGBColor {
  return {
    r: Math.max(0, Math.min(255, Math.round(255 * (1 - c) * (1 - k)))),
    g: Math.max(0, Math.min(255, Math.round(255 * (1 - m) * (1 - k)))),
    b: Math.max(0, Math.min(255, Math.round(255 * (1 - y) * (1 - k)))),
  };
}

function num(s: string): number | null {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

/** Extract all RGB colors used on a page (rg/RG/k/K/g/G). */
function extractColorsFromContent(content: string): RGBColor[] {
  const out: RGBColor[] = [];
  let m: RegExpExecArray | null;
  const rgbRe = /(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(rg|RG)\b/g;
  while ((m = rgbRe.exec(content)) !== null) {
    const r = num(m[1]);
    const g = num(m[2]);
    const b = num(m[3]);
    if (r === null || g === null || b === null) continue;
    out.push({ r: clampByte(r * 255), g: clampByte(g * 255), b: clampByte(b * 255) });
  }
  const cmykRe = /(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+([kK])\b/g;
  while ((m = cmykRe.exec(content)) !== null) {
    const c = num(m[1]);
    const y2 = num(m[2]);
    const y3 = num(m[3]);
    const k = num(m[4]);
    if (c === null || y2 === null || y3 === null || k === null) continue;
    out.push(cmykToRgb(c, y2, y3, k));
  }
  const grayRe = /(-?\d+(?:\.\d+)?)\s+([gG])\b/g;
  while ((m = grayRe.exec(content)) !== null) {
    // Skip if this could be the tail of an rgb triplet (cheap heuristic).
    const start = m.index;
    const prev = content[start - 1] ?? " ";
    if (/[\d.\s]/.test(prev)) {
      const prev2 = content[start - 2] ?? " ";
      if (/[\d.\s]/.test(prev2)) continue;
    }
    const g = num(m[1]);
    if (g === null) continue;
    const v = clampByte(g * 255);
    out.push({ r: v, g: v, b: v });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Grayscale conversion applied to a content stream
// ---------------------------------------------------------------------------

function processColorToGray(c: RGBColor, opts: ConversionOptions): number {
  let gray = convertWithMethod(c, opts.method, opts.customWeights);
  gray = preserveBlack(c, gray, opts.preserveBlack);
  gray = preserveWhite(c, gray, opts.preserveWhite);
  if (opts.threshold >= 0 && opts.threshold <= 255) {
    gray = applyThreshold(gray, opts.threshold);
  }
  return clampByte(gray);
}

/**
 * Rewrite a content stream so every color-setting operator becomes a
 * DeviceGray equivalent. Returns the modified content and accumulates
 * before/after color lists.
 */
function rewriteContentToGrayscale(
  content: string,
  opts: ConversionOptions,
  colorsBefore: RGBColor[],
  grayAfter: number[],
): string {
  let out = content;
  // 1) CMYK fill/stroke → DeviceGray fill/stroke
  out = out.replace(
    /(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+([kK])\b/g,
    (match, cs, ms, ys, ks, op) => {
      const c = parseFloat(cs);
      const m = parseFloat(ms);
      const y = parseFloat(ys);
      const k = parseFloat(ks);
      const rgb = cmykToRgb(c, m, y, k);
      colorsBefore.push(rgb);
      const gray = processColorToGray(rgb, opts);
      grayAfter.push(gray);
      const normalized = (gray / 255).toFixed(4);
      return `${normalized} ${op.toLowerCase()}`;
    },
  );
  // 2) RGB fill/stroke → DeviceGray fill/stroke
  out = out.replace(
    /(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(rg|RG)\b/g,
    (match, rs, gs, bs, op) => {
      const r = parseFloat(rs);
      const g = parseFloat(gs);
      const b = parseFloat(bs);
      const rgb = { r: clampByte(r * 255), g: clampByte(g * 255), b: clampByte(b * 255) };
      colorsBefore.push(rgb);
      const gray = processColorToGray(rgb, opts);
      grayAfter.push(gray);
      const normalized = (gray / 255).toFixed(4);
      return `${normalized} ${op === "rg" ? "g" : "G"}`;
    },
  );
  // 3) Existing DeviceGray: apply threshold if active
  if (opts.threshold >= 0 && opts.threshold <= 255) {
    out = out.replace(
      /(-?\d+(?:\.\d+)?)\s+([gG])\b/g,
      (match, vs, op) => {
        const v = parseFloat(vs);
        const gray = clampByte(v * 255);
        const rgb: RGBColor = { r: gray, g: gray, b: gray };
        colorsBefore.push(rgb);
        const newGray = applyThreshold(gray, opts.threshold);
        grayAfter.push(newGray);
        return `${(newGray / 255).toFixed(4)} ${op}`;
      },
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// Apply grayscale to a single page (replaces content stream)
// ---------------------------------------------------------------------------

function setPageContent(doc: PDFDocument, page: PDFPage, newContent: string): void {
  const bytes = new TextEncoder().encode(newContent);
  const dict = doc.context.obj({ Length: bytes.length }) as PDFDict;
  const stream = PDFRawStream.of(dict, bytes);
  const ref = doc.context.register(stream);
  page.node.set(PDFName.of("Contents"), ref);
}

interface PageProcessingResult {
  stats: PageConversionStats;
  grayBefore: number[];
  grayAfter: number[];
}

function processPage(
  doc: PDFDocument,
  page: PDFPage,
  pageNumber: number,
  opts: ConversionOptions,
): PageProcessingResult {
  const content = readPageContent(page);
  const colorsBefore: RGBColor[] = [];
  const grayAfter: number[] = [];
  const modified = rewriteContentToGrayscale(content, opts, colorsBefore, grayAfter);
  if (modified !== content) {
    setPageContent(doc, page, modified);
  }
  const grayBefore = colorsBefore.map((c) => convertWithMethod(c, "luminance"));
  const inkBefore = estimateInkUsage(grayBefore);
  const inkAfter = estimateInkUsage(grayAfter);
  const inkSaved = computeInkSavings(inkBefore, inkAfter);
  const beforeAnalysis = analyzePageColors(colorsBefore, 10);
  const afterCounts = new Map<number, number>();
  for (const v of grayAfter) {
    afterCounts.set(v, (afterCounts.get(v) ?? 0) + 1);
  }
  const topColorsAfter = Array.from(afterCounts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  return {
    stats: {
      pageNumber,
      originalColorCount: colorsBefore.length,
      uniqueOriginalColors: beforeAnalysis.uniqueColorCount,
      grayscaleColorCount: afterCounts.size,
      inkBefore,
      inkAfter,
      inkSavedPercent: inkSaved,
      topColorsBefore: beforeAnalysis.topColors,
      topColorsAfter,
    },
    grayBefore,
    grayAfter,
  };
}

// ---------------------------------------------------------------------------
// React component
// ---------------------------------------------------------------------------

export default function PdfGrayscaleConverter() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; pageCount: number } | null>(null);
  const [opts, setOpts] = useState<ConversionOptions>(DEFAULT_OPTIONS);
  const [customWeightsStr, setCustomWeightsStr] = useState("0.299, 0.587, 0.114");
  const [result, setResult] = useState<{
    bytes: Uint8Array;
    pageStats: PageConversionStats[];
    summary: ReturnType<typeof computeSummaryStats>;
    grayBefore: number[];
    grayAfter: number[];
  } | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      setOpts((prev) => ({ ...prev, ...p }));
      if (p.customWeights) {
        setCustomWeightsStr(`${p.customWeights.r}, ${p.customWeights.g}, ${p.customWeights.b}`);
      }
      if (Object.keys(p).length > 0) toast.info("Loaded settings from share link");
    }
  }, []);

  const effectiveOpts: ConversionOptions = useMemo(() => {
    if (opts.method === "custom-weighted") {
      const w = parseCustomWeights(customWeightsStr);
      return { ...opts, customWeights: w ?? undefined };
    }
    return { ...opts, customWeights: undefined };
  }, [opts, customWeightsStr]);

  async function loadFile(f: File) {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      setFile({ name: f.name, bytes, pageCount: doc.getPageCount() });
      setResult(null);
      setError("");
    } catch {
      toast.error(`Could not read ${f.name} — it may be corrupted or password-protected.`);
    }
  }

  function reset() {
    setFile(null);
    setResult(null);
    setError("");
    setOpts(DEFAULT_OPTIONS);
    setCustomWeightsStr("0.299, 0.587, 0.114");
  }

  async function run() {
    if (!file) return;
    const valid = validateOptions(effectiveOpts);
    if (!valid.ok) {
      setError(valid.error);
      return;
    }
    setWorking(true);
    setError("");
    setResult(null);
    try {
      const doc = await PDFDocument.load(file.bytes);
      // Embed a font (needed only to satisfy pdf-lib's document state in some cases).
      await doc.embedFont(StandardFonts.Helvetica);
      const pages = doc.getPages();
      const pageStats: PageConversionStats[] = [];
      const grayBefore: number[] = [];
      const grayAfter: number[] = [];
      for (let i = 0; i < pages.length; i++) {
        const r = processPage(doc, pages[i], i + 1, effectiveOpts);
        pageStats.push(r.stats);
        grayBefore.push(...r.grayBefore);
        grayAfter.push(...r.grayAfter);
      }
      const out = await doc.save();
      const summary = computeSummaryStats(pageStats, effectiveOpts);
      setResult({ bytes: out, pageStats, summary, grayBefore, grayAfter });
      const entry: HistoryEntry = {
        ts: Date.now(),
        fileName: file.name,
        pageCount: pages.length,
        method: effectiveOpts.method,
        threshold: effectiveOpts.threshold,
        inkSavedPercent: summary.totalInkSavedPercent,
      };
      saveHistory(entry);
      setHistory(loadHistory());
      toast.success(`Converted ${pages.length} page(s) to grayscale`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong during conversion.");
    } finally {
      setWorking(false);
    }
  }

  const report = useMemo(
    () => (result ? renderTextReport(result.pageStats, result.summary) : ""),
    [result],
  );
  const csv = useMemo(() => (result ? renderCsv(result.pageStats) : ""), [result]);

  // Simple histogram (16 bins) for visualization.
  const histogram = useMemo(() => {
    if (!result) return null;
    const bins = 16;
    const width = 256 / bins;
    const before = new Array(bins).fill(0);
    const after = new Array(bins).fill(0);
    for (const v of result.grayBefore) {
      const idx = Math.max(0, Math.min(bins - 1, Math.floor(v / width)));
      before[idx] += 1;
    }
    for (const v of result.grayAfter) {
      const idx = Math.max(0, Math.min(bins - 1, Math.floor(v / width)));
      after[idx] += 1;
    }
    const max = Math.max(1, ...before, ...after);
    return { before, after, max, bins, width };
  }, [result]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {file ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
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
          <p className="text-sm font-medium text-foreground">Drop a PDF here or click to browse</p>
          <p className="mt-1 text-xs text-muted-foreground">Rewrite every color setting as grayscale using one of 5 methods.</p>
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

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Conversion method</Label>
            <div className="grid gap-2 sm:grid-cols-5">
              {CONVERSION_METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setOpts((p) => ({ ...p, method: m }))}
                  className={
                    opts.method === m
                      ? "rounded-lg border border-primary bg-primary/10 p-2 text-left text-xs font-medium"
                      : "rounded-lg border border-border p-2 text-left text-xs hover:border-primary/40 transition-colors"
                  }
                >
                  {METHOD_LABELS[m].split(" (")[0]}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground pt-1">
              {METHOD_LABELS[opts.method]}
            </p>
          </div>

          {opts.method === "custom-weighted" && (
            <div className="space-y-1.5">
              <Label htmlFor="gc-weights" className="text-xs">Custom weights (r, g, b)</Label>
              <Input
                id="gc-weights"
                value={customWeightsStr}
                onChange={(e) => setCustomWeightsStr(e.target.value)}
                placeholder="0.299, 0.587, 0.114"
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                {parseCustomWeights(customWeightsStr)
                  ? `Parsed: r=${parseCustomWeights(customWeightsStr)!.r}, g=${parseCustomWeights(customWeightsStr)!.g}, b=${parseCustomWeights(customWeightsStr)!.b}`
                  : "Enter 3 comma-separated non-negative numbers."}
              </p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="gc-threshold" className="text-xs">Threshold (-1 = off, 0–255 = B&amp;W)</Label>
              <Input
                id="gc-threshold"
                type="number"
                min={-1}
                max={255}
                value={String(opts.threshold)}
                onChange={(e) => setOpts((p) => ({ ...p, threshold: Number(e.target.value) }))}
                className="w-32"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Dithering (B&amp;W only)</Label>
              <div className="flex gap-2">
                {DITHERING_MODES.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setOpts((p) => ({ ...p, dithering: d }))}
                    className={
                      opts.dithering === d
                        ? "rounded border border-primary bg-primary/10 px-2 py-1 text-[11px]"
                        : "rounded border border-border px-2 py-1 text-[11px] hover:border-primary/40"
                    }
                  >
                    {d === "none" ? "None" : d === "floyd-steinberg" ? "Floyd-Steinberg" : "Ordered"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={opts.preserveBlack}
                onChange={(e) => setOpts((p) => ({ ...p, preserveBlack: e.target.checked }))}
                className="h-4 w-4 rounded border-border"
              />
              Preserve pure black (#000000)
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={opts.preserveWhite}
                onChange={(e) => setOpts((p) => ({ ...p, preserveWhite: e.target.checked }))}
                className="h-4 w-4 rounded border-border"
              />
              Preserve pure white (#FFFFFF)
            </label>
          </div>
        </CardContent>
      </Card>

      <ActionBar>
        <RunButton
          onClick={() => void run()}
          disabled={!file || working}
          loading={working}
          label="Convert to grayscale"
        />
        <ClearButton onClick={reset} disabled={!file && !result && !error} label="Clear" />
        <ShareButton getUrl={() => buildShareUrl(effectiveOpts)} />
      </ActionBar>

      {error && <ErrorBanner message={error} />}

      {result && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Contrast className="h-4 w-4" /> Conversion summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Pages" value={result.summary.totalPages} />
                <Stat label="Colors converted" value={result.summary.totalColorsConverted} />
                <Stat
                  label="Unique before → after"
                  value={`${result.summary.uniqueColorsBefore} → ${result.summary.uniqueColorsAfter}`}
                />
                <Stat
                  label="Avg ink saved"
                  value={`${result.summary.totalInkSavedPercent}%`}
                  highlight={result.summary.totalInkSavedPercent > 0 ? "good" : undefined}
                />
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge variant="outline" className="text-[10px]">
                  Method: {result.summary.method}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  Threshold: {result.summary.threshold < 0 ? "off" : result.summary.threshold}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  Dithering: {result.summary.dithering}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {histogram && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Histogram (before vs after)</h3>
                <div className="space-y-2">
                  {histogram.before.map((cnt, i) => {
                    const beforePct = (cnt / histogram.max) * 100;
                    const afterPct = (histogram.after[i] / histogram.max) * 100;
                    const start = Math.round(i * histogram.width);
                    const end = Math.round((i + 1) * histogram.width);
                    return (
                      <div key={i} className="grid grid-cols-[80px_1fr_1fr] items-center gap-2 text-[10px]">
                        <span className="text-muted-foreground font-mono">{start}–{end}</span>
                        <div className="h-3 rounded bg-muted overflow-hidden">
                          <div
                            className="h-full bg-sky-500"
                            style={{ width: `${beforePct}%` }}
                          />
                        </div>
                        <div className="h-3 rounded bg-muted overflow-hidden">
                          <div
                            className="h-full bg-emerald-500"
                            style={{ width: `${afterPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-4 text-[10px] text-muted-foreground pt-1">
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 bg-sky-500 rounded" /> Before
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 bg-emerald-500 rounded" /> After
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">Per-page results</h3>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() =>
                      downloadBytes(result.bytes, `grayscale-${file?.name?.replace(/\.pdf$/i, "") ?? "output"}.pdf`)
                    }
                    size="sm"
                    className="gap-1.5"
                  >
                    <Download className="h-3.5 w-3.5" /> Download PDF ({formatBytes(result.bytes.length)})
                  </Button>
                  <CopyButton getText={() => report} label="Copy report" />
                  <DownloadButton
                    getText={() => report}
                    filename="grayscale-report.txt"
                    mime="text/plain"
                    label="Download .txt"
                  />
                  <DownloadButton
                    getText={() => csv}
                    filename="grayscale-report.csv"
                    mime="text/csv"
                    label="Download CSV"
                  />
                </div>
              </div>
              <div className="max-h-72 overflow-auto space-y-1">
                {result.pageStats.map((p) => (
                  <div
                    key={p.pageNumber}
                    className="rounded border bg-background px-3 py-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Page {p.pageNumber}</span>
                      <span className="text-muted-foreground">
                        {p.originalColorCount} colors ({p.uniqueOriginalColors} unique) → {p.grayscaleColorCount} gray
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <Badge variant="outline" className="text-[10px]">Ink {p.inkBefore}% → {p.inkAfter}%</Badge>
                      <Badge
                        variant="outline"
                        className={
                          p.inkSavedPercent > 0
                            ? "text-[10px] text-emerald-600 dark:text-emerald-400"
                            : "text-[10px]"
                        }
                      >
                        Saved {p.inkSavedPercent}%
                      </Badge>
                    </div>
                    {p.topColorsBefore.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {p.topColorsBefore.slice(0, 6).map((c, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
                          >
                            <span
                              className="inline-block h-2.5 w-2.5 rounded border"
                              style={{ backgroundColor: c.hex }}
                            />
                            {c.hex} ×{c.count}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!file && !result && (
        <EmptyState
          title="Drop a PDF to convert it to grayscale"
          hint="Five methods: luminance, average, lightness, desaturate, or custom weights. Optional B&W threshold with optional dithering."
          icon={<Contrast className="h-8 w-8" />}
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
                onClick={() => {
                  clearHistory();
                  setHistory([]);
                  toast.success("History cleared");
                }}
              >
                Clear
              </Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2">{h.method}</Badge>
                  <Badge variant="outline" className="mr-2">
                    {h.threshold < 0 ? "gray" : `B&W @ ${h.threshold}`}
                  </Badge>
                  <Badge variant="outline" className="mr-2">{h.inkSavedPercent}% saved</Badge>
                  <span className="text-muted-foreground">{h.fileName}</span>
                  <span className="text-muted-foreground ml-2">· {h.pageCount}p · {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        <strong className="text-foreground">Privacy:</strong> grayscale conversion runs 100% locally in your browser — your PDF never leaves your device.
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
  highlight?: "good" | "bad";
}) {
  const color = highlight === "good"
    ? "text-emerald-600 dark:text-emerald-400"
    : highlight === "bad"
      ? "text-red-600 dark:text-red-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold ${color}`}>{value}</div>
    </div>
  );
}
