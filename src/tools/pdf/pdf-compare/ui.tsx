"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  PDFDocument,
  PDFRawStream,
  PDFStream,
  PDFArray,
  PDFDict,
  PDFName,
  decodePDFRawStream,
} from "pdf-lib";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Download,
  FileUp,
  Trash2,
  GitCompare,
  History,
  BarChart3,
  FileDiff,
  AlertTriangle,
} from "lucide-react";
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
import { formatBytes } from "../_shared/download";
import {
  COMPARISON_MODES,
  MODE_LABELS,
  DEFAULT_OPTIONS,
  parseComparePageRange,
  computePageOverlap,
  compareTextLines,
  buildPageDiff,
  compareMetadata,
  compareStructure,
  computePageCountDiff,
  computeFontUsageDiff,
  computeSummaryStats,
  renderTextDiff,
  renderHtmlDiff,
  renderCsvDiff,
  renderJsonDiff,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type CompareOptions,
  type ComparisonMode,
  type PdfSnapshot,
  type ComparisonResult,
  type PageDiff,
  type HistoryEntry,
} from "./logic";

// ---------------------------------------------------------------------------
// PDF content-stream text extraction (browser-only, pdf-lib internals)
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

/** Parse a PDF content stream and return concatenated text from Tj/TJ/'/" operators. */
function parsePdfContentStreamForText(content: string): string {
  const parts: string[] = [];
  let i = 0;
  const len = content.length;
  while (i < len) {
    const ch = content[i];
    if (ch === "(") {
      const r = consumeParenString(content, i);
      parts.push(r.text);
      i = r.end;
    } else if (ch === "<" && content[i + 1] !== "<") {
      const close = content.indexOf(">", i);
      if (close > 0) {
        const hex = content.slice(i + 1, close);
        if (/^[0-9a-fA-F\s]*$/.test(hex) && hex.trim().length > 0) {
          parts.push(decodeHexBody(hex));
        }
        i = close + 1;
      } else {
        i++;
      }
    } else if (ch === "T" && content[i + 1] === "*") {
      parts.push("\n");
      i += 2;
    } else if ((ch === "'" || ch === "\"") && parts.length > 0) {
      parts[parts.length - 1] = "\n" + parts[parts.length - 1];
      i++;
    } else if (ch === "T" && (content[i + 1] === "d" || content[i + 1] === "D")) {
      const before = content.slice(Math.max(0, i - 40), i);
      const nums = before.match(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*$/);
      if (nums) {
        const y = parseFloat(nums[2]);
        if (y < -0.5) parts.push("\n");
      }
      i += 2;
    } else {
      i++;
    }
  }
  return parts.join("").replace(/\n{3,}/g, "\n\n").trim();
}

function getStreamBytes(stream: unknown): Uint8Array {
  if (!stream) return new Uint8Array(0);
  try {
    if (stream instanceof PDFRawStream) return decodePDFRawStream(stream).decode();
    if (stream instanceof PDFStream) return stream.getContents();
  } catch {
    // ignore
  }
  return new Uint8Array(0);
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) { out.set(p, offset); offset += p.length; }
  return out;
}

interface PageLike {
  node: {
    Contents?: () => unknown;
    Resources?: () => unknown;
  };
}

/** Extract text from a single PDF page's content stream(s). */
function extractTextFromPage(page: PageLike): string {
  let contents: unknown;
  try {
    contents = page.node.Contents?.();
  } catch {
    return "";
  }
  if (!contents) return "";
  let bytes: Uint8Array;
  if (contents instanceof PDFArray) {
    const parts: Uint8Array[] = [];
    for (let i = 0; i < contents.size(); i++) {
      parts.push(getStreamBytes(contents.lookup(i)));
    }
    bytes = concatBytes(parts);
  } else {
    bytes = getStreamBytes(contents);
  }
  if (bytes.length === 0) return "";
  const text = new TextDecoder("latin1").decode(bytes);
  return parsePdfContentStreamForText(text);
}

/**
 * Collect font names referenced by a page's Resources dictionary.
 * Returns an array of font names (with leading slash stripped).
 */
function extractFontNamesFromPage(page: PageLike): string[] {
  let resources: unknown;
  try {
    resources = page.node.Resources?.();
  } catch {
    return [];
  }
  if (!(resources instanceof PDFDict)) return [];
  const fontDict = resources.lookup(PDFName.of("Font"));
  if (!(fontDict instanceof PDFDict)) return [];
  const out: string[] = [];
  for (const key of fontDict.keys()) {
    try {
      const fontObj = fontDict.lookup(key);
      if (fontObj instanceof PDFDict) {
        const baseName = fontObj.get(PDFName.of("BaseFont"));
        if (baseName) {
          out.push(baseName.toString().replace(/^\//, ""));
        }
      }
    } catch {
      // ignore individual font lookup errors
    }
  }
  return out;
}

/**
 * Count image XObjects referenced by a page's Resources dictionary.
 * Includes both full images (XObject with Subtype Image) and inline images
 * (BI/EI operators in the content stream — basic heuristic).
 */
function countImagesOnPage(page: PageLike): number {
  let resources: unknown;
  try {
    resources = page.node.Resources?.();
  } catch {
    return 0;
  }
  let count = 0;
  if (resources instanceof PDFDict) {
    const xobjectDict = resources.lookup(PDFName.of("XObject"));
    if (xobjectDict instanceof PDFDict) {
      for (const key of xobjectDict.keys()) {
        try {
          const obj = xobjectDict.lookup(key);
          if (obj instanceof PDFDict) {
            const subtype = obj.get(PDFName.of("Subtype"));
            if (subtype && subtype.toString() === "/Image") count += 1;
          }
        } catch {
          // ignore
        }
      }
    }
  }
  // Also count inline images via BI/EI markers in the content stream
  try {
    const contents = page.node.Contents?.();
    if (contents) {
      let bytes: Uint8Array;
      if (contents instanceof PDFArray) {
        const parts: Uint8Array[] = [];
        for (let i = 0; i < contents.size(); i++) {
          parts.push(getStreamBytes(contents.lookup(i)));
        }
        bytes = concatBytes(parts);
      } else {
        bytes = getStreamBytes(contents);
      }
      if (bytes.length > 0) {
        const text = new TextDecoder("latin1").decode(bytes);
        const inlineMatches = text.match(/\bBI\b/g);
        if (inlineMatches) count += inlineMatches.length;
      }
    }
  } catch {
    // ignore
  }
  return count;
}

// ---------------------------------------------------------------------------
// Build a PdfSnapshot from a loaded PDFDocument
// ---------------------------------------------------------------------------

/** pdf-lib's getKeywords() can return a string, an array, or undefined — coerce to a string. */
function normalizeKeywords(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "string") return value;
  return String(value);
}

async function buildSnapshot(doc: PDFDocument): Promise<PdfSnapshot> {
  const pages = doc.getPages();
  const pageTexts: string[] = [];
  const pageSizes: string[] = [];
  const fonts: string[] = [];
  const imageCounts: number[] = [];
  for (const page of pages) {
    pageTexts.push(extractTextFromPage(page));
    const { width, height } = page.getSize();
    pageSizes.push(`${Math.round(width)}x${Math.round(height)}`);
    fonts.push(...extractFontNamesFromPage(page));
    imageCounts.push(countImagesOnPage(page));
  }
  const metadata: Record<string, string> = {
    Title: doc.getTitle() ?? "",
    Author: doc.getAuthor() ?? "",
    Subject: doc.getSubject() ?? "",
    Keywords: normalizeKeywords(doc.getKeywords()),
    Creator: doc.getCreator() ?? "",
    Producer: doc.getProducer() ?? "",
    CreationDate: doc.getCreationDate()?.toISOString() ?? "",
    ModDate: doc.getModificationDate()?.toISOString() ?? "",
  };
  return {
    pageCount: pages.length,
    pageTexts,
    pageSizes,
    fonts,
    imageCounts,
    metadata,
  };
}

// ---------------------------------------------------------------------------
// React component
// ---------------------------------------------------------------------------

interface LoadedFile {
  name: string;
  bytes: Uint8Array;
  snapshot: PdfSnapshot;
}

export default function PdfCompare() {
  const inputRef1 = useRef<HTMLInputElement>(null);
  const inputRef2 = useRef<HTMLInputElement>(null);
  const [file1, setFile1] = useState<LoadedFile | null>(null);
  const [file2, setFile2] = useState<LoadedFile | null>(null);
  const [opts, setOpts] = useState<CompareOptions>(DEFAULT_OPTIONS);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (Object.keys(p).length > 0) {
        setOpts((prev) => ({ ...prev, ...p }));
        toast.info("Loaded settings from share link");
      }
    }
  }, []);

  async function loadFile(f: File, slot: 1 | 2) {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      const snapshot = await buildSnapshot(doc);
      if (slot === 1) setFile1({ name: f.name, bytes, snapshot });
      else setFile2({ name: f.name, bytes, snapshot });
      setResult(null);
      setError("");
    } catch {
      toast.error(`Could not read ${f.name} — it may be corrupted or password-protected.`);
    }
  }

  function reset() {
    setFile1(null);
    setFile2(null);
    setResult(null);
    setError("");
    setOpts(DEFAULT_OPTIONS);
  }

  const update = <K extends keyof CompareOptions>(key: K, value: CompareOptions[K]) =>
    setOpts((prev) => ({ ...prev, [key]: value }));

  async function run() {
    if (!file1 || !file2) return;
    setWorking(true);
    setError("");
    setResult(null);
    try {
      const range1 = parseComparePageRange(opts.pageRange, file1.snapshot.pageCount);
      if (!range1.ok) {
        setError(`Document 1: ${range1.error}`);
        setWorking(false);
        return;
      }
      const range2 = parseComparePageRange(opts.pageRange, file2.snapshot.pageCount);
      if (!range2.ok) {
        setError(`Document 2: ${range2.error}`);
        setWorking(false);
        return;
      }
      const overlap = computePageOverlap(range1.output, range2.output);
      // Compare position-by-position (page 3 of doc1 ↔ page 3 of doc2),
      // restricted to the overlap so we don't try to diff phantom pages.
      void overlap;

      // Per-page text diffs
      const pageDiffs: PageDiff[] = [];
      const maxPages = Math.max(range1.output.length, range2.output.length);
      for (let k = 0; k < maxPages; k++) {
        const idx1 = range1.output[k];
        const idx2 = range2.output[k];
        if (idx1 === undefined && idx2 === undefined) continue;
        const page = ((idx1 ?? idx2) ?? 0) + 1;
        const text1 = idx1 !== undefined ? file1.snapshot.pageTexts[idx1] ?? "" : "";
        const text2 = idx2 !== undefined ? file2.snapshot.pageTexts[idx2] ?? "" : "";
        // Only build a real diff when both pages exist; otherwise mark as missing
        if (idx1 !== undefined && idx2 !== undefined) {
          pageDiffs.push(buildPageDiff(page, text1, text2, true, opts));
        } else {
          pageDiffs.push(buildPageDiff(page, "", "", false, opts));
        }
      }

      const metaDiff = compareMetadata(file1.snapshot.metadata, file2.snapshot.metadata);
      const structDiff = compareStructure(file1.snapshot, file2.snapshot);
      const pageCountDiff = computePageCountDiff(
        file1.snapshot.pageCount,
        file2.snapshot.pageCount
      );
      const fontDiff = computeFontUsageDiff(
        file1.snapshot.fonts,
        file2.snapshot.fonts
      );
      const summary = computeSummaryStats(opts.comparisonMode, pageDiffs, metaDiff, structDiff);
      const comparison: ComparisonResult = {
        mode: opts.comparisonMode,
        options: opts,
        pageDiffs,
        metadataDiff: metaDiff,
        structureDiff: structDiff,
        pageCountDiff,
        fontUsageDiff: fontDiff,
        summary,
      };
      setResult(comparison);
      saveHistory({
        ts: Date.now(),
        fileName1: file1.name,
        fileName2: file2.name,
        mode: opts.comparisonMode,
        pagesCompared: summary.pagesCompared,
        overallSimilarity: summary.overallSimilarity,
        textDifferences: summary.textDifferences,
        metadataDifferences: summary.metadataDifferences,
      });
      setHistory(loadHistory());
      toast.success(
        `Compared ${summary.pagesCompared} page(s) • ${summary.overallSimilarity}% similar`
      );
      void overlap;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong while comparing the PDFs.");
    } finally {
      setWorking(false);
    }
  }

  const textReport = useMemo(
    () =>
      result
        ? renderTextDiff(
            result.pageDiffs,
            result.metadataDiff,
            result.structureDiff,
            result.pageCountDiff
          )
        : "",
    [result]
  );
  const htmlDiff = useMemo(
    () => (result ? renderHtmlDiff(result.pageDiffs) : ""),
    [result]
  );
  const csvReport = useMemo(
    () => (result ? renderCsvDiff(result.pageDiffs) : ""),
    [result]
  );
  const jsonReport = useMemo(
    () => (result ? renderJsonDiff(result) : ""),
    [result]
  );

  function renderFileSlot(
    slot: 1 | 2,
    file: LoadedFile | null,
    setFile: (f: LoadedFile | null) => void,
    inputRef: React.RefObject<HTMLInputElement | null>,
    label: string
  ) {
    return file ? (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="truncate text-sm font-medium">{file.name}</p>
          <p className="text-xs text-muted-foreground">
            {file.snapshot.pageCount} page{file.snapshot.pageCount === 1 ? "" : "s"} • {formatBytes(file.bytes.length)}
            {" • "}
            {file.snapshot.fonts.length} font ref{file.snapshot.fonts.length === 1 ? "" : "s"}
            {" • "}
            {file.snapshot.imageCounts.reduce((a, b) => a + b, 0)} image{file.snapshot.imageCounts.reduce((a, b) => a + b, 0) === 1 ? "" : "s"}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Remove ${label}`}
          onClick={() => { setFile(null); setResult(null); }}
        >
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
          if (f) void loadFile(f, slot);
        }}
        className="w-full rounded-xl border-2 border-dashed border-border p-6 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors"
      >
        <FileUp className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-sm font-medium">Drop a PDF here or click to browse</p>
      </button>
    );
  }

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <div className="grid gap-3 sm:grid-cols-2">
        {renderFileSlot(1, file1, setFile1, inputRef1, "Document 1 (original)")}
        {renderFileSlot(2, file2, setFile2, inputRef2, "Document 2 (modified)")}
      </div>
      <input
        ref={inputRef1}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        aria-label="Choose PDF 1"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void loadFile(f, 1);
          e.target.value = "";
        }}
      />
      <input
        ref={inputRef2}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        aria-label="Choose PDF 2"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void loadFile(f, 2);
          e.target.value = "";
        }}
      />

      {(file1 || file2) && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cmp-mode">Comparison mode</Label>
              <select
                id="cmp-mode"
                value={opts.comparisonMode}
                onChange={(e) => update("comparisonMode", e.target.value as ComparisonMode)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                {COMPARISON_MODES.map((m) => (
                  <option key={m} value={m}>{MODE_LABELS[m]}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5 sm:col-span-1">
                <Label htmlFor="cmp-range">Page range</Label>
                <Input
                  id="cmp-range"
                  value={opts.pageRange}
                  onChange={(e) => update("pageRange", e.target.value)}
                  placeholder="all or e.g. 1-3, 5"
                  className="font-mono text-sm"
                />
              </div>
              <div className="flex items-end gap-4 pb-2 sm:col-span-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={opts.ignoreWhitespace}
                    onChange={(e) => update("ignoreWhitespace", e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  Ignore whitespace
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={opts.ignoreCase}
                    onChange={(e) => update("ignoreCase", e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  Ignore case
                </label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <ActionBar>
        <RunButton
          onClick={() => void run()}
          disabled={!file1 || !file2}
          loading={working}
          label="Compare PDFs"
        />
        <ClearButton onClick={reset} disabled={!file1 && !file2 && !result && !error} label="Clear" />
        {(file1 || file2) && <ShareButton getUrl={() => buildShareUrl(opts)} />}
      </ActionBar>

      {error && <ErrorBanner message={error} />}

      {result && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4" /> Summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Pages compared" value={result.summary.pagesCompared} />
                <Stat
                  label="Overall similarity"
                  value={`${result.summary.overallSimilarity}%`}
                  highlight={
                    result.summary.overallSimilarity === 100
                      ? "good"
                      : result.summary.overallSimilarity < 50
                        ? "bad"
                        : undefined
                  }
                />
                <Stat label="Text differences" value={result.summary.textDifferences} highlight={result.summary.textDifferences > 0 ? "bad" : "good"} />
                <Stat label="Metadata differences" value={result.summary.metadataDifferences} highlight={result.summary.metadataDifferences > 0 ? "bad" : "good"} />
                <Stat label="Structure differences" value={result.summary.structureDifferences} highlight={result.summary.structureDifferences > 0 ? "bad" : "good"} />
                <Stat
                  label="Page count Δ"
                  value={`${result.pageCountDiff.delta >= 0 ? "+" : ""}${result.pageCountDiff.delta}`}
                  highlight={result.pageCountDiff.delta === 0 ? "good" : "bad"}
                />
                <Stat label="Mode" value={result.mode} />
                <Stat
                  label="Pages added/removed"
                  value={`+${result.pageCountDiff.added} / -${result.pageCountDiff.removed}`}
                />
              </div>
              {result.summary.significantChanges.length > 0 && (
                <div className="rounded border bg-background px-3 py-2 text-xs">
                  <strong>Pages with most differences:</strong>{" "}
                  {result.summary.significantChanges
                    .map((c) => `p.${c.page} (${c.diffCount} diffs, ${c.similarity}%)`)
                    .join(" • ")}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FileDiff className="h-4 w-4" /> Structure &amp; metadata
              </h3>
              <div className="space-y-2 text-xs">
                <div className="rounded border bg-background px-3 py-2">
                  <strong>Page count:</strong> {result.pageCountDiff.count1} → {result.pageCountDiff.count2}{" "}
                  <Badge variant={result.pageCountDiff.delta === 0 ? "outline" : "secondary"} className="ml-1 text-[10px]">
                    Δ {result.pageCountDiff.delta >= 0 ? "+" : ""}{result.pageCountDiff.delta}
                  </Badge>
                </div>
                <div className="rounded border bg-background px-3 py-2">
                  <strong>Page sizes:</strong>{" "}
                  {result.structureDiff.sizesDiffer ? (
                    <span className="text-amber-600 dark:text-amber-400">
                      differ — doc1: [{result.structureDiff.pageSizes1.join(", ")}] • doc2: [{result.structureDiff.pageSizes2.join(", ")}]
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400">identical</span>
                  )}
                </div>
                <div className="rounded border bg-background px-3 py-2">
                  <strong>Fonts:</strong>{" "}
                  {result.structureDiff.fontsDiffer ? (
                    <span className="text-amber-600 dark:text-amber-400">
                      differ — doc1: [{result.structureDiff.fonts1.join(", ") || "none"}] • doc2: [{result.structureDiff.fonts2.join(", ") || "none"}]
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400">identical</span>
                  )}
                </div>
                <div className="rounded border bg-background px-3 py-2">
                  <strong>Per-page image counts:</strong>{" "}
                  {result.structureDiff.imageCountsDiffer ? (
                    <span className="text-amber-600 dark:text-amber-400">
                      differ — doc1: [{result.structureDiff.imageCounts1.join(", ")}] • doc2: [{result.structureDiff.imageCounts2.join(", ")}]
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400">identical</span>
                  )}
                </div>
                {result.metadataDiff.differences > 0 && (
                  <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2">
                    <strong className="text-amber-700 dark:text-amber-400">Metadata differences ({result.metadataDiff.differences}):</strong>
                    <ul className="mt-1 space-y-0.5">
                      {result.metadataDiff.fields.filter((f) => !f.same).map((f) => (
                        <li key={f.field}>
                          <span className="font-mono">{f.field}:</span>{" "}
                          <code className="text-muted-foreground">{f.value1 || "(empty)"}</code> →{" "}
                          <code>{f.value2 || "(empty)"}</code>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {result.fontUsageDiff.length > 0 && (
                  <div className="rounded border bg-background px-3 py-2">
                    <strong>Font usage diff:</strong>
                    <ul className="mt-1 space-y-0.5">
                      {result.fontUsageDiff
                        .filter((f) => f.delta !== 0)
                        .map((f) => (
                          <li key={f.font}>
                            <span className="font-mono">{f.font}:</span> {f.count1} → {f.count2}{" "}
                            <Badge variant="outline" className="text-[10px]">
                              Δ {f.delta >= 0 ? "+" : ""}{f.delta}
                            </Badge>
                          </li>
                        ))}
                      {result.fontUsageDiff.every((f) => f.delta === 0) && (
                        <li className="text-muted-foreground">No font-usage changes.</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <GitCompare className="h-4 w-4" /> Per-page diff ({result.pageDiffs.length} pages)
                </h3>
                <div className="flex flex-wrap gap-2">
                  <CopyButton getText={() => textReport} label="Copy report" />
                  <DownloadButton
                    getText={() => textReport}
                    filename="pdf-comparison-report.txt"
                    mime="text/plain"
                    label="Report .txt"
                  />
                  <DownloadButton
                    getText={() => csvReport}
                    filename="pdf-comparison.csv"
                    mime="text/csv"
                    label="CSV"
                  />
                  <DownloadButton
                    getText={() => jsonReport}
                    filename="pdf-comparison.json"
                    mime="application/json"
                    label="JSON"
                  />
                </div>
              </div>
              <div className="max-h-[500px] overflow-auto rounded border bg-muted/30 p-3">
                <pre className="text-[11px] whitespace-pre-wrap font-mono">
                  {textReport || "(no differences)"}
                </pre>
              </div>
            </CardContent>
          </Card>

          {result.pageDiffs.some((p) => p.lines.length > 0) && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">HTML diff (color-coded)</h3>
                <div
                  className="pdf-html-diff max-h-[400px] overflow-auto rounded border bg-background p-3 text-[11px] font-mono"
                  dangerouslySetInnerHTML={{
                    __html: `<style>
                      .pdf-html-diff .add { color: #16a34a; }
                      .pdf-html-diff .del { color: #dc2626; }
                      .pdf-html-diff .mod { color: #d97706; }
                      .pdf-html-diff .ctx { color: #6b7280; }
                      .pdf-html-diff .missing { color: #6b7280; font-style: italic; }
                      .pdf-html-diff .same { color: #6b7280; }
                      .pdf-html-diff h4 { font-weight: 600; margin-bottom: 4px; color: #111827; }
                    </style>` + htmlDiff,
                  }}
                />
              </CardContent>
            </Card>
          )}
        </>
      )}

      {file1 && file2 && !result && (
        <EmptyState
          title="Click Compare PDFs to see the differences"
          hint="Choose a comparison mode (text-only, metadata-only, full, or structure) and click Compare."
          icon={<AlertTriangle className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.mode}</Badge>
                  <span className="font-medium">{h.fileName1}</span>
                  <span className="text-muted-foreground mx-1">→</span>
                  <span className="font-medium">{h.fileName2}</span>
                  <span className="text-muted-foreground ml-2">
                    {h.overallSimilarity}% similar • {h.pagesCompared} page{h.pagesCompared === 1 ? "" : "s"} • {h.textDifferences} text diff{h.textDifferences === 1 ? "" : "s"}
                  </span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        <strong className="text-foreground">Privacy:</strong> Comparison runs 100% locally in your browser —
        neither PDF ever leaves your device. Text comparison uses an in-browser content-stream parser;
        scanned PDFs without a text layer will report empty pages.
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
