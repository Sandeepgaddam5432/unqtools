"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  PDFDocument,
  PDFRawStream,
  PDFStream,
  PDFContentStream,
  PDFArray,
  PDFDict,
  PDFName,
  PDFHexString,
  PDFString,
  decodePDFRawStream,
  type PDFPage,
} from "pdf-lib";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, FileUp, Trash2, Droplet, History, BarChart3, AlertTriangle, Lightbulb } from "lucide-react";
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
  ANALYSIS_MODES,
  MODE_LABELS,
  DEFAULT_OPTIONS,
  parseInkCosts,
  normalizePageRangeSpec,
  resolveAllRange,
  analyzePage,
  computeSummaryStats,
  detectHeavyUsage,
  rankByCost,
  buildHistogram,
  generateRecommendations,
  renderTextReport,
  renderCsvReport,
  renderHtmlReport,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  validateOptions,
  rgbToHex,
  rgbToCmyk,
  type AnalysisMode,
  type InkOptions,
  type PageContentStats,
  type PageInkAnalysis,
  type ColorCoverageEntry,
  type RGBColor,
  type HistoryEntry,
  type Recommendation,
} from "./logic";

// ---------------------------------------------------------------------------
// PDF content-stream ink-coverage extraction
// ---------------------------------------------------------------------------

function getStreamBytes(stream: unknown): Uint8Array {
  if (!stream) return new Uint8Array(0);
  try {
    if (stream instanceof PDFRawStream) {
      return decodePDFRawStream(stream).decode();
    }
    if (stream instanceof PDFContentStream) {
      // fall through
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

/** Decode a hex string body like "48656c6c6f" → "Hello". */
function decodeHexBody(hex: string): string {
  const clean = hex.replace(/\s/g, "");
  const padded = clean.length % 2 === 0 ? clean : clean + "0";
  let out = "";
  for (let i = 0; i < padded.length; i += 2) {
    out += String.fromCharCode(parseInt(padded.slice(i, i + 2), 16));
  }
  return out;
}

/** Consume a (...) literal string body starting at index `start`. Returns text and end index. */
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
  // Decode common escapes
  let decoded = "";
  let j = 0;
  while (j < body.length) {
    const ch = body[j];
    if (ch === "\\") {
      const next = body[j + 1];
      if (next === "n") { decoded += "\n"; j += 2; }
      else if (next === "r") { decoded += "\r"; j += 2; }
      else if (next === "t") { decoded += "\t"; j += 2; }
      else if (next === "b") { decoded += "\b"; j += 2; }
      else if (next === "f") { decoded += "\f"; j += 2; }
      else if (next === "(") { decoded += "("; j += 2; }
      else if (next === ")") { decoded += ")"; j += 2; }
      else if (next === "\\") { decoded += "\\"; j += 2; }
      else if (next && /[0-7]/.test(next)) {
        let octal = next;
        if (/[0-7]/.test(body[j + 2] ?? "")) octal += body[j + 2];
        if (/[0-7]/.test(body[j + 3] ?? "")) octal += body[j + 3];
        decoded += String.fromCharCode(parseInt(octal, 8));
        j += 1 + octal.length;
      } else {
        decoded += next ?? "";
        j += 2;
      }
    } else {
      decoded += ch;
      j++;
    }
  }
  return { text: decoded, end: i + 1 };
}

interface PageContentResult {
  textChars: number;
  avgFontSize: number;
  rectArea: number;
  imageArea: number;
  colorCoverages: ColorCoverageEntry[];
}

/**
 * Walk a page's content stream and accumulate ink-coverage stats.
 * Tracks current fill color (start: black), font size (default 12pt), and counts
 * text-show / rectangle / image operators.
 */
function analyzePageContent(page: PDFPage): PageContentResult {
  const content = readPageContent(page);
  if (!content) {
    return { textChars: 0, avgFontSize: 0, rectArea: 0, imageArea: 0, colorCoverages: [] };
  }

  let textChars = 0;
  let totalFontSize = 0;
  let fontSizeCount = 0;
  let rectArea = 0;
  let imageArea = 0;

  // Current fill color (start with black).
  let currentFill: RGBColor = { r: 0, g: 0, b: 0 };

  // Per-color area accumulator (keyed by hex).
  const colorArea = new Map<string, { color: RGBColor; area: number }>();

  const addColorArea = (color: RGBColor, area: number) => {
    if (area <= 0) return;
    const hex = rgbToHex(color);
    const existing = colorArea.get(hex);
    if (existing) existing.area += area;
    else colorArea.set(hex, { color: { ...color }, area });
  };

  // Approximate on-page image area when a `Do` invokes an XObject image.
  // Without parsing the CTM we conservatively estimate the image as covering
  // 1/4 of the page area (a typical photo block). This is a heuristic.
  const { width: pageW, height: pageH } = page.getSize();
  const pageArea = pageW * pageH;

  // We need to know which XObject names refer to images vs forms. Look at the
  // page's /Resources/XObject dictionary if available.
  const imageXObjects = new Set<string>();
  try {
    const resources = (page.node as unknown as { Resources?: () => unknown }).Resources?.();
    if (resources instanceof PDFDict) {
      const xobj = resources.lookup(PDFName.of("XObject"));
      if (xobj instanceof PDFDict) {
        for (const [name] of xobj.entries()) {
          const lookedUp = xobj.lookup(name);
          if (lookedUp instanceof PDFDict) {
            const subtype = lookedUp.get(PDFName.of("Subtype"));
            if (subtype === PDFName.of("Image")) {
              imageXObjects.add(name.toString());
            }
          }
        }
      }
    }
  } catch {
    // ignore
  }

  // Tokenize: walk character by character, recognizing strings, numbers, and operators.
  let i = 0;
  const len = content.length;
  // Stack of pending numeric operands (parsed lazily when an operator arrives).
  let pendingNumbers: number[] = [];

  const parseColorFromPending = (count: number): RGBColor | null => {
    if (pendingNumbers.length < count) return null;
    const slice = pendingNumbers.slice(pendingNumbers.length - count);
    if (count === 3) {
      // RGB fill (rg) — 0–1 range
      return {
        r: Math.max(0, Math.min(255, Math.round(slice[0] * 255))),
        g: Math.max(0, Math.min(255, Math.round(slice[1] * 255))),
        b: Math.max(0, Math.min(255, Math.round(slice[2] * 255))),
      };
    }
    if (count === 4) {
      // CMYK fill (k) — 0–1 range
      const [c, m, y, k] = slice;
      return {
        r: Math.max(0, Math.min(255, Math.round(255 * (1 - c) * (1 - k)))),
        g: Math.max(0, Math.min(255, Math.round(255 * (1 - m) * (1 - k)))),
        b: Math.max(0, Math.min(255, Math.round(255 * (1 - y) * (1 - k)))),
      };
    }
    if (count === 1) {
      // Gray fill (g) — 0–1 range; gray = 1 - intensity (1=white, 0=black)
      const gray = Math.max(0, Math.min(1, slice[0]));
      const v = Math.max(0, Math.min(255, Math.round((1 - gray) * 255)));
      return { r: v, g: v, b: v };
    }
    return null;
  };

  while (i < len) {
    const ch = content[i];

    // Skip whitespace
    if (ch === " " || ch === "\n" || ch === "\r" || ch === "\t") { i++; continue; }

    // Literal string (... )
    if (ch === "(") {
      const r = consumeParenString(content, i);
      textChars += r.text.length;
      // Approximate text area at current font size × 0.5 width × 1.0 height.
      const fontSize = fontSizeCount > 0 ? totalFontSize / fontSizeCount : 12;
      const area = r.text.length * fontSize * 0.5 * fontSize;
      addColorArea(currentFill, area);
      pendingNumbers = [];
      i = r.end;
      continue;
    }

    // Hex string <...>
    if (ch === "<" && content[i + 1] !== "<") {
      const close = content.indexOf(">", i);
      if (close > 0) {
        const hex = content.slice(i + 1, close);
        if (/^[0-9a-fA-F\s]*$/.test(hex) && hex.trim().length > 0) {
          const text = decodeHexBody(hex);
          textChars += text.length;
          const fontSize = fontSizeCount > 0 ? totalFontSize / fontSizeCount : 12;
          const area = text.length * fontSize * 0.5 * fontSize;
          addColorArea(currentFill, area);
        }
        pendingNumbers = [];
        i = close + 1;
        continue;
      }
    }

    // Number (possibly negative, with decimal)
    if ((ch >= "0" && ch <= "9") || ch === "-" || ch === "." || ch === "+") {
      let j = i;
      let numStr = "";
      while (j < len && /[0-9.\-+]/.test(content[j])) {
        numStr += content[j];
        j++;
      }
      const n = parseFloat(numStr);
      if (Number.isFinite(n)) pendingNumbers.push(n);
      i = j;
      continue;
    }

    // Operator detection (look ahead a couple chars)
    // rg / RG — RGB fill / stroke
    if (ch === "r" && content[i + 1] === "g") {
      const c = parseColorFromPending(3);
      if (c) currentFill = c;
      pendingNumbers = [];
      i += 2;
      continue;
    }
    if (ch === "R" && content[i + 1] === "G") {
      // stroke color — we ignore (we only track fill)
      pendingNumbers = [];
      i += 2;
      continue;
    }
    // k / K — CMYK fill / stroke
    if (ch === "k" && !/[a-zA-Z]/.test(content[i + 1] ?? " ")) {
      const c = parseColorFromPending(4);
      if (c) currentFill = c;
      pendingNumbers = [];
      i += 1;
      continue;
    }
    if (ch === "K" && !/[a-zA-Z]/.test(content[i + 1] ?? " ")) {
      pendingNumbers = [];
      i += 1;
      continue;
    }
    // g / G — gray fill / stroke
    if (ch === "g" && !/[a-zA-Z]/.test(content[i + 1] ?? " ")) {
      const c = parseColorFromPending(1);
      if (c) currentFill = c;
      pendingNumbers = [];
      i += 1;
      continue;
    }
    if (ch === "G" && !/[a-zA-Z]/.test(content[i + 1] ?? " ")) {
      pendingNumbers = [];
      i += 1;
      continue;
    }
    // sc / SC / scn / SCN — set fill/stroke color in non-stroking color space; we treat scn like a generic fill.
    // For our heuristic, we just clear pendingNumbers.
    if ((ch === "s" && (content[i + 1] === "c" || content[i + 1] === "C")) ||
        (ch === "s" && content[i + 1] === "c" && content[i + 2] === "n") ||
        (ch === "s" && content[i + 1] === "C" && content[i + 2] === "N")) {
      // Without parsing the color space, we can't accurately convert. Leave currentFill as-is.
      pendingNumbers = [];
      i += content[i + 2] === "n" || content[i + 2] === "N" ? 3 : 2;
      continue;
    }
    // cs / CS — set color space (ignored)
    if (ch === "c" && (content[i + 1] === "s" || content[i + 1] === "S")) {
      pendingNumbers = [];
      i += 2;
      continue;
    }
    // Tf — set font (operator) — operand is font name and size
    if (ch === "T" && content[i + 1] === "f") {
      // The size is the second operand; the first is a font name (usually /Name).
      // We can't easily read the name without parsing tokens, but the size is in pendingNumbers
      // AFTER the font name token. Try to extract it from the last numeric in pendingNumbers.
      if (pendingNumbers.length > 0) {
        const size = pendingNumbers[pendingNumbers.length - 1];
        if (size > 0 && size < 1000) {
          totalFontSize += size;
          fontSizeCount += 1;
        }
      }
      pendingNumbers = [];
      i += 2;
      continue;
    }
    // Tj / TJ / ' / " — show text (already counted via string parse above; just clear pendingNumbers)
    if (ch === "T" && (content[i + 1] === "j" || content[i + 1] === "J")) {
      pendingNumbers = [];
      i += 2;
      continue;
    }
    if (ch === "'" || ch === "\"") {
      pendingNumbers = [];
      i += 1;
      continue;
    }
    // re — rectangle path: x y w h re
    if (ch === "r" && content[i + 1] === "e") {
      if (pendingNumbers.length >= 4) {
        const w = pendingNumbers[pendingNumbers.length - 2];
        const h = pendingNumbers[pendingNumbers.length - 1];
        if (w > 0 && h > 0) {
          const area = w * h;
          rectArea += area;
          addColorArea(currentFill, area);
        }
      }
      pendingNumbers = [];
      i += 2;
      continue;
    }
    // f / F / f* — fill path (we don't need to do anything; color area was added at path construction)
    if (ch === "f" || (ch === "F" && content[i + 1] !== "*")) {
      pendingNumbers = [];
      i += 1;
      continue;
    }
    if (ch === "f" && content[i + 1] === "*") {
      pendingNumbers = [];
      i += 2;
      continue;
    }
    // B / B* / b / b* — fill+stroke path
    if ((ch === "B" || ch === "b") && (content[i + 1] === "*" || content[i + 1] === undefined || !/[a-zA-Z]/.test(content[i + 1] ?? " "))) {
      pendingNumbers = [];
      i += content[i + 1] === "*" ? 2 : 1;
      continue;
    }
    // n — end path without fill/stroke (consumes pendingNumbers)
    if (ch === "n" && !/[a-zA-Z]/.test(content[i + 1] ?? " ")) {
      pendingNumbers = [];
      i += 1;
      continue;
    }
    // Do — invoke XObject; if name is in imageXObjects, count image area
    if (ch === "D" && content[i + 1] === "o") {
      // Look back through content for a /Name token preceding 'Do'
      const before = content.slice(Math.max(0, i - 64), i);
      const m = before.match(/\/([A-Za-z0-9._+-]+)\s*$/);
      if (m && imageXObjects.has("/" + m[1])) {
        imageArea += pageArea * 0.25; // heuristic: assume image fills ~25% of page
        addColorArea(currentFill, pageArea * 0.25);
      }
      pendingNumbers = [];
      i += 2;
      continue;
    }
    // q / Q — save/restore graphics state
    if (ch === "q" || ch === "Q") {
      pendingNumbers = [];
      i += 1;
      continue;
    }
    // cm — graphics-state transform (consume 6 numbers)
    if (ch === "c" && content[i + 1] === "m") {
      pendingNumbers = [];
      i += 2;
      continue;
    }
    // Generic — clear pendingNumbers on any other letter operator we recognize
    if (/[a-zA-Z*'"]/.test(ch)) {
      // consume the rest of the operator name
      let j = i;
      while (j < len && /[a-zA-Z*'"]/.test(content[j])) j++;
      pendingNumbers = [];
      i = j;
      continue;
    }

    // Array / dict / name tokens
    if (ch === "[" || ch === "]" || ch === "{" || ch === "}" || ch === "/" || ch === "%") {
      // Skip name tokens — they begin with / and continue until whitespace/special
      if (ch === "/") {
        let j = i + 1;
        while (j < len && /[A-Za-z0-9._+-]/.test(content[j])) j++;
        i = j;
        continue;
      }
      if (ch === "%") {
        // comment — skip to end of line
        let j = i;
        while (j < len && content[j] !== "\n") j++;
        i = j;
        continue;
      }
      i++;
      continue;
    }

    // Default: skip
    i++;
  }

  const avgFontSize = fontSizeCount > 0 ? totalFontSize / fontSizeCount : 12;
  const colorCoverages: ColorCoverageEntry[] = Array.from(colorArea.values()).map((e) => ({
    color: e.color,
    hex: rgbToHex(e.color),
    area: e.area,
    cmyk: rgbToCmyk(e.color),
  }));

  return {
    textChars,
    avgFontSize,
    rectArea,
    imageArea,
    colorCoverages,
  };
}

/** Build PageContentStats for a single PDF page. */
function buildPageStats(page: PDFPage, pageNumber: number, includeImages: boolean): PageContentStats {
  const { width, height } = page.getSize();
  const r = analyzePageContent(page);
  return {
    pageNumber,
    width,
    height,
    textChars: r.textChars,
    avgFontSize: r.avgFontSize,
    rectArea: r.rectArea,
    imageArea: includeImages ? r.imageArea : 0,
    colorCoverages: r.colorCoverages,
  };
}

// ---------------------------------------------------------------------------
// React component
// ---------------------------------------------------------------------------

export default function PdfInkCoverageAnalyzer() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; pageCount: number } | null>(null);
  const [opts, setOpts] = useState<InkOptions>(DEFAULT_OPTIONS);
  const [pages, setPages] = useState<PageInkAnalysis[] | null>(null);
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
      setPages(null);
      setError("");
    } catch {
      toast.error(`Could not read ${f.name} — it may be corrupted or password-protected.`);
    }
  }

  function reset() {
    setFile(null);
    setPages(null);
    setError("");
    setOpts(DEFAULT_OPTIONS);
  }

  async function run() {
    if (!file) return;
    setWorking(true);
    setError("");
    setPages(null);
    try {
      const validation = validateOptions(opts, file.pageCount);
      if (!validation.ok) {
        setError(validation.error);
        setWorking(false);
        return;
      }
      const doc = await PDFDocument.load(file.bytes);
      const total = doc.getPageCount();
      const rangeSpec = normalizePageRangeSpec(opts.pageRange);
      const resolved = rangeSpec === "all" ? resolveAllRange(rangeSpec, total) : rangeSpec;
      const parsed = parsePageRanges(resolved, total);
      if (!parsed.ok) {
        setError(parsed.error);
        setWorking(false);
        return;
      }
      const pdfPages = doc.getPages();
      const cost = parseInkCosts(opts.inkCostPerMl);
      const out: PageInkAnalysis[] = [];
      for (const idx of parsed.output) {
        const stats = buildPageStats(pdfPages[idx], idx + 1, opts.includeImages);
        out.push(analyzePage(stats, cost));
      }
      setPages(out);
      const summary = computeSummaryStats(out, opts.coverageThreshold);
      saveHistory({
        ts: Date.now(),
        fileName: file.name,
        pageCount: total,
        analysisMode: opts.analysisMode,
        avgCoveragePct: summary.avgCoveragePct,
        totalCostCents: summary.totalCostCents,
      });
      setHistory(loadHistory());
      toast.success(`Analyzed ${out.length} page(s) • avg ${summary.avgCoveragePct}% coverage`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong while analyzing ink coverage.");
    } finally {
      setWorking(false);
    }
  }

  const summary = useMemo(() => pages ? computeSummaryStats(pages, opts.coverageThreshold) : null, [pages, opts.coverageThreshold]);
  const heavyPages = useMemo(() => pages ? detectHeavyUsage(pages, opts.coverageThreshold) : [], [pages, opts.coverageThreshold]);
  const ranked = useMemo(() => pages ? rankByCost(pages) : [], [pages]);
  const histogram = useMemo(() => pages ? buildHistogram(pages) : [], [pages]);
  const recommendations = useMemo(() => pages ? generateRecommendations(pages, opts.coverageThreshold) : [], [pages, opts.coverageThreshold]);

  const textReport = useMemo(() => pages && summary ? renderTextReport(pages, summary, opts.analysisMode) : "", [pages, summary, opts.analysisMode]);
  const csvReport = useMemo(() => pages ? renderCsvReport(pages) : "", [pages]);
  const htmlReport = useMemo(() => pages && summary ? renderHtmlReport(pages, summary, opts.analysisMode) : "", [pages, summary, opts.analysisMode]);

  const update = <K extends keyof InkOptions>(key: K, value: InkOptions[K]) =>
    setOpts((prev) => ({ ...prev, [key]: value }));

  function downloadHtml() {
    if (!htmlReport || !file) return;
    const blob = new Blob([htmlReport], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name.replace(/\.pdf$/i, "") + "-ink-coverage.html";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Downloaded HTML report");
  }

  function downloadCsv() {
    if (!csvReport || !file) return;
    downloadBytes(new TextEncoder().encode(csvReport), file.name.replace(/\.pdf$/i, "") + "-ink-coverage.csv", "text/csv");
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
          <p className="mt-1 text-xs text-muted-foreground">Estimate ink coverage per page, per CMYK channel, and per color.</p>
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
            <div className="space-y-1.5">
              <Label htmlFor="ink-mode">Analysis mode</Label>
              <select
                id="ink-mode"
                value={opts.analysisMode}
                onChange={(e) => update("analysisMode", e.target.value as AnalysisMode)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                {ANALYSIS_MODES.map((m) => (
                  <option key={m} value={m}>{MODE_LABELS[m]}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ink-range">Page range</Label>
                <Input
                  id="ink-range"
                  value={opts.pageRange}
                  onChange={(e) => update("pageRange", e.target.value)}
                  placeholder="all or e.g. 1-5, 8, 10-12"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ink-cost">Ink cost per ml (C,M,Y,K) in cents</Label>
                <Input
                  id="ink-cost"
                  value={opts.inkCostPerMl}
                  onChange={(e) => update("inkCostPerMl", e.target.value)}
                  placeholder="0.05,0.06,0.07,0.08"
                  className="font-mono text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ink-threshold">Heavy-usage coverage threshold (%)</Label>
                <Input
                  id="ink-threshold"
                  type="number"
                  min={0}
                  max={100}
                  value={opts.coverageThreshold}
                  onChange={(e) => update("coverageThreshold", Number(e.target.value))}
                  className="text-sm"
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={opts.includeImages}
                    onChange={(e) => update("includeImages", e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  Include images (count image ink separately)
                </label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <ActionBar>
        <RunButton onClick={() => void run()} disabled={!file} loading={working} label="Analyze ink coverage" />
        <ClearButton onClick={reset} disabled={!file && !pages && !error} label="Clear" />
      </ActionBar>

      {error && <ErrorBanner message={error} />}

      {summary && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4" /> Summary
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Pages analyzed" value={summary.totalPages} />
              <Stat label="Avg coverage" value={`${summary.avgCoveragePct}%`} />
              <Stat label="Max coverage" value={`${summary.maxCoveragePct}%`} highlight={summary.maxCoveragePct >= opts.coverageThreshold ? "bad" : undefined} />
              <Stat label="Min coverage" value={`${summary.minCoveragePct}%`} />
              <Stat label="Avg Cyan" value={`${summary.avgC}%`} />
              <Stat label="Avg Magenta" value={`${summary.avgM}%`} />
              <Stat label="Avg Yellow" value={`${summary.avgY}%`} />
              <Stat label="Avg Black" value={`${summary.avgK}%`} />
              <Stat label="Total ink volume" value={`${summary.totalInkVolumeMl.toFixed(4)} ml`} />
              <Stat label="Total cost" value={formatCents(summary.totalCostCents)} highlight="good" />
              <Stat label="Color pages" value={summary.colorPages} />
              <Stat label="Grayscale pages" value={summary.grayscalePages} />
              <Stat label="Heavy pages" value={summary.heavyPages} highlight={summary.heavyPages > 0 ? "bad" : undefined} />
            </div>
          </CardContent>
        </Card>
      )}

      {histogram.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Coverage distribution</h3>
            <div className="space-y-1">
              {histogram.map((b) => {
                const max = Math.max(1, ...histogram.map((h) => h.count));
                const pct = (b.count / max) * 100;
                return (
                  <div key={b.lower} className="grid grid-cols-[80px_1fr_40px] gap-2 items-center text-xs">
                    <span className="font-mono text-muted-foreground">{b.label}</span>
                    <div className="h-4 bg-muted rounded overflow-hidden">
                      <div className="h-full bg-primary/70" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-right font-medium">{b.count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {recommendations.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Lightbulb className="h-4 w-4" /> Ink-saving recommendations ({recommendations.length})
            </h3>
            <div className="space-y-1.5">
              {recommendations.slice(0, 20).map((r: Recommendation, i) => (
                <div key={i} className={`rounded border px-3 py-2 text-xs flex items-start gap-2 ${
                  r.severity === "critical" ? "border-red-500/40 bg-red-500/5 text-red-700 dark:text-red-300"
                  : r.severity === "warn" ? "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300"
                  : "border-blue-500/40 bg-blue-500/5 text-blue-700 dark:text-blue-300"
                }`}>
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                  <span>{r.message}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {heavyPages.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" /> Heavy-ink pages (≥ {opts.coverageThreshold}% coverage)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {heavyPages.map((p) => (
                <div key={p.pageNumber} className="rounded border bg-background px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Page {p.pageNumber}</div>
                  <div className="text-base font-semibold text-red-600 dark:text-red-400">{p.totalCoveragePct}%</div>
                  <div className="text-[10px] text-muted-foreground">cost {formatCents(p.costCents)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {ranked.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Cost by page ranking (most expensive first)</h3>
            <div className="space-y-1 max-h-[200px] overflow-auto">
              {ranked.slice(0, 10).map((p) => (
                <div key={p.pageNumber} className="flex items-center justify-between rounded border bg-background px-3 py-1.5 text-xs">
                  <span>Page {p.pageNumber}</span>
                  <span className="font-mono">
                    {p.totalCoveragePct}% • {p.inkVolumeMl.toFixed(4)} ml • {formatCents(p.costCents)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {pages && pages.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Droplet className="h-4 w-4" /> Per-page analysis ({pages.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => textReport} label="Copy text" />
                <DownloadButton
                  getText={() => textReport}
                  filename={(file?.name ?? "output.pdf").replace(/\.pdf$/i, "") + "-ink-coverage.txt"}
                  mime="text/plain"
                  label="Text"
                />
                <Button variant="outline" size="sm" onClick={downloadCsv} className="gap-1.5">
                  <Download className="h-3.5 w-3.5" /> CSV
                </Button>
                <Button variant="outline" size="sm" onClick={downloadHtml} className="gap-1.5">
                  <Download className="h-3.5 w-3.5" /> HTML
                </Button>
                <ShareButton getUrl={() => buildShareUrl(opts)} />
              </div>
            </div>
            <pre className="max-h-[400px] overflow-auto rounded border bg-muted/30 p-3 text-xs whitespace-pre-wrap font-mono">
              {textReport || "(empty)"}
            </pre>
          </CardContent>
        </Card>
      )}

      {pages && pages.length === 0 && (
        <EmptyState
          title="No pages in the selected range"
          hint="Adjust the page range and try again."
          icon={<Droplet className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.analysisMode}</Badge>
                  <span className="font-medium">{h.fileName}</span>
                  <span className="text-muted-foreground ml-2">
                    {h.pageCount} pages • avg {h.avgCoveragePct}% • {formatCents(h.totalCostCents)}
                  </span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        <strong className="text-foreground">Privacy:</strong> Ink-coverage analysis runs 100% locally in your browser using pdf-lib — your PDF never leaves your device.
        Estimates are heuristic (based on content-stream operators, not rasterization); use them as a relative guide, not an absolute billable amount.
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

function formatCents(cents: number): string {
  if (cents < 1) return `${cents.toFixed(2)}¢`;
  return `$${(cents / 100).toFixed(2)}`;
}
