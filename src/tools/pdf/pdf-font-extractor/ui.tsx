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
  PDFObject,
  decodePDFRawStream,
  type PDFPage,
} from "pdf-lib";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, FileUp, Trash2, Type, History, BarChart3, AlertTriangle, Lightbulb, Package } from "lucide-react";
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
  EXTRACTION_MODES,
  MODE_LABELS,
  FORMAT_FILTERS,
  FORMAT_FILTER_LABELS,
  OUTPUT_FORMATS,
  OUTPUT_FORMAT_LABELS,
  OUTPUT_MIME,
  DEFAULT_OPTIONS,
  detectFontType,
  isCidFont,
  extractSubsetPrefix,
  normalizeFontName,
  isStandardFont,
  suggestFontExtension,
  applyFontFilters,
  computeSummaryStats,
  detectFontDuplicates,
  rankFontsByUsage,
  recommendSubsetting,
  checkFontCompatibility,
  renderTextList,
  renderJsonMetadata,
  renderCsvList,
  renderOutput,
  getOutputFilename,
  buildFontPackage,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  validateOptions,
  type FontInfo,
  type FontType,
  type FontOptions,
  type ExtractionMode,
  type FontFormatFilter,
  type OutputFormat,
  type HistoryEntry,
} from "./logic";

// ---------------------------------------------------------------------------
// PDF font enumeration & extraction (uses pdf-lib internals)
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

/** Read a PDF name value as a string (strips leading '/'). */
function nameToString(v: PDFObject | undefined): string {
  if (!v) return "";
  // PDFName.toString() returns "/Name"
  try {
    const s = v.toString();
    return s.startsWith("/") ? s.slice(1) : s;
  } catch {
    return "";
  }
}

interface RawFontEntry {
  /** Internal key (e.g. "F1") used by content-stream Tf operator. */
  key: string;
  /** Raw BaseFont name (may include subset prefix). */
  rawName: string;
  /** Subtype of the actual font (resolved through DescendantFonts for Type0). */
  subtype: string;
  /** True if fontFileSubtype is /OpenType or /CFFFont (for /FontFile3). */
  isOpenTypeFile: boolean;
  /** True if a FontDescriptor with FontFile/FontFile2/FontFile3 was found. */
  embedded: boolean;
  /** Embedded font program bytes (or null). */
  fontFileBytes: Uint8Array | null;
  /** Subtype of the font file stream (for extension suggestion). */
  fontFileSubtype: string;
}

/** Extract a single font's metadata and (optionally) its embedded font program. */
function extractFontEntry(fontDict: PDFDict, key: string): RawFontEntry | null {
  try {
    const baseFont = nameToString(fontDict.get(PDFName.of("BaseFont")));
    if (!baseFont) return null;
    const rawSubtype = nameToString(fontDict.get(PDFName.of("Subtype")));

    // For Type0 fonts, the real subtype and FontDescriptor live on the descendant CIDFont.
    let effectiveDict = fontDict;
    let effectiveSubtype = rawSubtype;
    if (rawSubtype === "Type0") {
      const descendants = fontDict.lookup(PDFName.of("DescendantFonts"));
      if (descendants instanceof PDFArray && descendants.size() > 0) {
        const first = descendants.lookup(0);
        if (first instanceof PDFDict) {
          effectiveDict = first;
          effectiveSubtype = nameToString(first.get(PDFName.of("Subtype"))) || rawSubtype;
        }
      }
    }

    // Look up FontDescriptor for embedded font programs.
    let embedded = false;
    let fontFileBytes: Uint8Array | null = null;
    let fontFileSubtype = "";
    let isOpenTypeFile = false;
    const descriptor = effectiveDict.lookup(PDFName.of("FontDescriptor"));
    if (descriptor instanceof PDFDict) {
      // Try FontFile (Type1), FontFile2 (TrueType), FontFile3 (OpenType/CFF).
      const f1 = descriptor.lookup(PDFName.of("FontFile"));
      const f2 = descriptor.lookup(PDFName.of("FontFile2"));
      const f3 = descriptor.lookup(PDFName.of("FontFile3"));
      let stream: unknown = null;
      if (f3) {
        stream = f3;
        // FontFile3 has a /Subtype entry on the stream dict.
        if (f3 instanceof PDFRawStream) {
          fontFileSubtype = nameToString(f3.dict.get(PDFName.of("Subtype")));
          if (fontFileSubtype === "OpenType") isOpenTypeFile = true;
          if (fontFileSubtype === "CIDFontType0C") isOpenTypeFile = true;
        }
      } else if (f2) {
        stream = f2;
        fontFileSubtype = "TrueType";
      } else if (f1) {
        stream = f1;
        fontFileSubtype = "Type1";
      }
      if (stream) {
        fontFileBytes = getStreamBytes(stream);
        embedded = fontFileBytes.length > 0;
      }
    }

    return {
      key,
      rawName: baseFont,
      subtype: effectiveSubtype,
      isOpenTypeFile,
      embedded,
      fontFileBytes,
      fontFileSubtype,
    };
  } catch {
    return null;
  }
}

/** Walk a page's /Resources/Font dictionary and return all font entries. */
function extractPageFonts(page: PDFPage, pageNumber: number): { entries: RawFontEntry[]; pageNumber: number } {
  const entries: RawFontEntry[] = [];
  try {
    const resources = (page.node as unknown as { Resources?: () => unknown }).Resources?.();
    if (!(resources instanceof PDFDict)) return { entries, pageNumber };
    const fontDict = resources.lookup(PDFName.of("Font"));
    if (!(fontDict instanceof PDFDict)) return { entries, pageNumber };
    for (const [name, _value] of fontDict.entries()) {
      const key = nameToString(name);
      const lookedUp = fontDict.lookup(name);
      if (lookedUp instanceof PDFDict) {
        const entry = extractFontEntry(lookedUp, key);
        if (entry) entries.push(entry);
      }
      // Suppress unused
      void _value;
    }
  } catch {
    // ignore
  }
  return { entries, pageNumber };
}

/**
 * Walk a page's content stream and count characters drawn per font key.
 * Returns a map of fontKey → charCount.
 */
function countCharsByFont(page: PDFPage, knownFontKeys: Set<string>): Map<string, number> {
  const out = new Map<string, number>();
  if (knownFontKeys.size === 0) return out;
  const content = readPageContent(page);
  if (!content) return out;

  // Default current font key = first known font on the page.
  let currentFont = knownFontKeys.values().next().value ?? "";

  const len = content.length;
  let i = 0;

  // Track current font name (used after a /Name + Tf operator sequence).
  // We track the most recent /Name token seen.
  let pendingFontName: string | null = null;

  while (i < len) {
    const ch = content[i];

    // Whitespace
    if (ch === " " || ch === "\n" || ch === "\r" || ch === "\t") { i++; continue; }

    // Literal string (...)
    if (ch === "(") {
      // Count chars in this string until the matching close paren
      let j = i + 1;
      let depth = 1;
      let count = 0;
      while (j < len && depth > 0) {
        const c = content[j];
        if (c === "\\") { j += 2; count += 1; continue; }
        if (c === "(") { depth += 1; count += 1; j++; continue; }
        if (c === ")") {
          depth -= 1;
          if (depth === 0) { j++; break; }
          count += 1;
          j++;
          continue;
        }
        count += 1;
        j++;
      }
      if (currentFont && knownFontKeys.has(currentFont)) {
        out.set(currentFont, (out.get(currentFont) ?? 0) + count);
      }
      i = j;
      continue;
    }

    // Hex string <...>
    if (ch === "<" && content[i + 1] !== "<") {
      const close = content.indexOf(">", i);
      if (close > 0) {
        const hex = content.slice(i + 1, close).replace(/\s/g, "");
        const chars = Math.floor(hex.length / 2);
        if (currentFont && knownFontKeys.has(currentFont)) {
          out.set(currentFont, (out.get(currentFont) ?? 0) + chars);
        }
        i = close + 1;
        continue;
      }
    }

    // Name token /Name
    if (ch === "/") {
      let j = i + 1;
      let name = "";
      while (j < len && /[A-Za-z0-9._+-]/.test(content[j])) {
        name += content[j];
        j++;
      }
      pendingFontName = name;
      i = j;
      continue;
    }

    // Comment %...
    if (ch === "%") {
      let j = i;
      while (j < len && content[j] !== "\n") j++;
      i = j;
      continue;
    }

    // Operator detection
    // Tf — set font: /Name size Tf → switch current font
    if (ch === "T" && content[i + 1] === "f") {
      if (pendingFontName && knownFontKeys.has(pendingFontName)) {
        currentFont = pendingFontName;
      }
      pendingFontName = null;
      i += 2;
      continue;
    }
    // Tj, TJ, ', " — show text (already counted via string parse)
    if (ch === "T" && (content[i + 1] === "j" || content[i + 1] === "J")) {
      pendingFontName = null;
      i += 2;
      continue;
    }
    if (ch === "'" || ch === "\"") {
      pendingFontName = null;
      i += 1;
      continue;
    }

    // Generic letter operator — clear pending font name
    if (/[a-zA-Z*'"]/.test(ch)) {
      let j = i;
      while (j < len && /[a-zA-Z*'"]/.test(content[j])) j++;
      pendingFontName = null;
      i = j;
      continue;
    }

    // Number
    if (/[0-9.\-+]/.test(ch)) {
      let j = i;
      while (j < len && /[0-9.\-+]/.test(content[j])) j++;
      i = j;
      continue;
    }

    // Skip other punctuation
    i++;
  }

  return out;
}

interface ExtractResult {
  fonts: FontInfo[];
  zipBytes: Uint8Array | null;
  fontCount: number;
  embeddedCount: number;
}

/**
 * Enumerate all fonts across all pages and produce FontInfo records.
 * If `extract` is true, the font program bytes are included for each embedded font.
 */
async function extractAllFonts(doc: PDFDocument, extract: boolean): Promise<ExtractResult> {
  const pages = doc.getPages();
  // Map of fontKey → RawFontEntry (deduplicated across pages by rawName + embedded).
  // We track per (page × key) so we can build per-page usage and char counts.
  const pageFonts: { pageNumber: number; entries: RawFontEntry[] }[] = [];
  // Map of fontKey → FontInfo (one record per unique key on any page).
  const fontByKey = new Map<string, RawFontEntry>();

  for (let pi = 0; pi < pages.length; pi++) {
    const { entries, pageNumber } = extractPageFonts(pages[pi], pi + 1);
    pageFonts.push({ pageNumber, entries });
    for (const e of entries) {
      if (!fontByKey.has(e.key)) {
        fontByKey.set(e.key, e);
      } else {
        // Same key seen on multiple pages — keep the first; they should be identical.
        // (Could differ if /Resources is per-page; merge embedded bytes if missing.)
        const existing = fontByKey.get(e.key)!;
        if (!existing.embedded && e.embedded) {
          fontByKey.set(e.key, e);
        }
      }
    }
  }

  // Now build per-font info with usage and char counts.
  // Note: the same fontKey might be defined differently across pages. We dedupe by
  // (rawName + subtype + embedded) and report a single record.
  const unique = new Map<string, FontInfo>();
  let index = 0;
  for (const [key, entry] of fontByKey) {
    const dedupeKey = `${entry.rawName}|${entry.subtype}|${entry.embedded}`;
    if (unique.has(dedupeKey)) continue;
    const name = normalizeFontName(entry.rawName);
    const subsetPrefix = extractSubsetPrefix(entry.rawName);
    const type = detectFontType(entry.subtype, entry.isOpenTypeFile);
    const isStandard = isStandardFont(name);
    const fontFileExtension = suggestFontExtension(type, entry.fontFileSubtype);
    unique.set(dedupeKey, {
      index,
      rawName: entry.rawName,
      name,
      subsetPrefix,
      isSubset: subsetPrefix.length > 0,
      type,
      embedded: entry.embedded,
      isStandard,
      fontFileBytes: extract ? entry.fontFileBytes : null,
      fontFileExtension,
      pagesUsed: [],
      charCount: 0,
    });
    index += 1;
  }

  // Now compute per-page usage and per-font char counts.
  // We need to map (page × key) → FontInfo. Multiple keys may map to the same FontInfo (rare).
  const fontByRawKey = new Map<string, FontInfo>();
  for (const [key, entry] of fontByKey) {
    const dedupeKey = `${entry.rawName}|${entry.subtype}|${entry.embedded}`;
    const info = unique.get(dedupeKey);
    if (info) fontByRawKey.set(key, info);
  }

  for (const { pageNumber, entries } of pageFonts) {
    const knownKeys = new Set(entries.map((e) => e.key));
    const charCounts = countCharsByFont(pages[pageNumber - 1], knownKeys);
    for (const e of entries) {
      const info = fontByRawKey.get(e.key);
      if (!info) continue;
      if (!info.pagesUsed.includes(pageNumber)) {
        info.pagesUsed.push(pageNumber);
        info.pagesUsed.sort((a, b) => a - b);
      }
      info.charCount += charCounts.get(e.key) ?? 0;
    }
  }

  const fonts = Array.from(unique.values());

  // Build the ZIP if extracting.
  let zipBytes: Uint8Array | null = null;
  if (extract) {
    try {
      zipBytes = buildFontPackage(fonts);
    } catch {
      zipBytes = null;
    }
  }

  const embeddedCount = fonts.filter((f) => f.embedded).length;
  return { fonts, zipBytes, fontCount: fonts.length, embeddedCount };
}

// ---------------------------------------------------------------------------
// React component
// ---------------------------------------------------------------------------

export default function PdfFontExtractor() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; pageCount: number } | null>(null);
  const [opts, setOpts] = useState<FontOptions>(DEFAULT_OPTIONS);
  const [fonts, setFonts] = useState<FontInfo[] | null>(null);
  const [zipBytes, setZipBytes] = useState<Uint8Array | null>(null);
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
      setFonts(null);
      setZipBytes(null);
      setError("");
    } catch {
      toast.error(`Could not read ${f.name} — it may be corrupted or password-protected.`);
    }
  }

  function reset() {
    setFile(null);
    setFonts(null);
    setZipBytes(null);
    setError("");
    setOpts(DEFAULT_OPTIONS);
  }

  async function run() {
    if (!file) return;
    setWorking(true);
    setError("");
    setFonts(null);
    setZipBytes(null);
    try {
      const validation = validateOptions(opts);
      if (!validation.ok) {
        setError(validation.error);
        setWorking(false);
        return;
      }
      const doc = await PDFDocument.load(file.bytes);
      const extract = opts.extractionMode === "extract-font-files" || opts.extractionMode === "full";
      const result = await extractAllFonts(doc, extract);
      const filtered = applyFontFilters(result.fonts, opts);
      setFonts(filtered);
      setZipBytes(result.zipBytes);
      const summary = computeSummaryStats(filtered);
      saveHistory({
        ts: Date.now(),
        fileName: file.name,
        totalFonts: summary.totalFonts,
        embeddedCount: summary.embeddedCount,
        subsettedCount: summary.subsettedCount,
        extractionMode: opts.extractionMode,
      });
      setHistory(loadHistory());
      toast.success(`Found ${summary.totalFonts} font(s) — ${summary.embeddedCount} embedded`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong while extracting fonts.");
    } finally {
      setWorking(false);
    }
  }

  const summary = useMemo(() => fonts ? computeSummaryStats(fonts) : null, [fonts]);
  const duplicates = useMemo(() => fonts ? detectFontDuplicates(fonts) : [], [fonts]);
  const ranking = useMemo(() => fonts ? rankFontsByUsage(fonts, "chars") : [], [fonts]);
  const recommendations = useMemo(() => fonts ? recommendSubsetting(fonts) : [], [fonts]);
  const compatibility = useMemo(() => fonts ? checkFontCompatibility(fonts) : [], [fonts]);

  const textList = useMemo(() => fonts && summary ? renderTextList(fonts, summary) : "", [fonts, summary]);
  const jsonMetadata = useMemo(() => fonts && summary ? renderJsonMetadata(fonts, summary) : "", [fonts, summary]);
  const csvList = useMemo(() => fonts ? renderCsvList(fonts) : "", [fonts]);
  const rendered = useMemo(() => fonts && summary ? renderOutput(fonts, summary, opts.outputFormat) : "", [fonts, summary, opts.outputFormat]);

  const update = <K extends keyof FontOptions>(key: K, value: FontOptions[K]) =>
    setOpts((prev) => ({ ...prev, [key]: value }));

  function downloadZip() {
    if (!zipBytes || !file) return;
    downloadBytes(zipBytes, getOutputFilename("zip-of-fonts", file.name), "application/zip");
  }

  function downloadCurrent() {
    if (!fonts || !file) return;
    if (opts.outputFormat === "zip-of-fonts") {
      if (zipBytes) downloadZip();
      else toast.error("No ZIP available — try 'extract-font-files' or 'full' mode");
      return;
    }
    const text = opts.outputFormat === "json-metadata" ? jsonMetadata
      : opts.outputFormat === "csv-list" ? csvList
      : textList;
    const mime = OUTPUT_MIME[opts.outputFormat];
    downloadBytes(new TextEncoder().encode(text), getOutputFilename(opts.outputFormat, file.name), mime);
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
          <p className="mt-1 text-xs text-muted-foreground">List fonts, extract embedded font programs, analyze usage.</p>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="font-mode">Extraction mode</Label>
                <select
                  id="font-mode"
                  value={opts.extractionMode}
                  onChange={(e) => update("extractionMode", e.target.value as ExtractionMode)}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  {EXTRACTION_MODES.map((m) => (
                    <option key={m} value={m}>{MODE_LABELS[m]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="font-filter">Font format filter</Label>
                <select
                  id="font-filter"
                  value={opts.fontFormatFilter}
                  onChange={(e) => update("fontFormatFilter", e.target.value as FontFormatFilter)}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  {FORMAT_FILTERS.map((f) => (
                    <option key={f} value={f}>{FORMAT_FILTER_LABELS[f]}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="font-output">Output format</Label>
                <select
                  id="font-output"
                  value={opts.outputFormat}
                  onChange={(e) => update("outputFormat", e.target.value as OutputFormat)}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  {OUTPUT_FORMATS.map((f) => (
                    <option key={f} value={f}>{OUTPUT_FORMAT_LABELS[f]}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={opts.includeSubsets}
                    onChange={(e) => update("includeSubsets", e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  Include subsetted fonts
                </label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <ActionBar>
        <RunButton onClick={() => void run()} disabled={!file} loading={working} label="Extract fonts" />
        <ClearButton onClick={reset} disabled={!file && !fonts && !error} label="Clear" />
      </ActionBar>

      {error && <ErrorBanner message={error} />}

      {summary && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4" /> Summary
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Total fonts" value={summary.totalFonts} />
              <Stat label="Embedded" value={summary.embeddedCount} highlight={summary.embeddedCount > 0 ? "good" : undefined} />
              <Stat label="Not embedded" value={summary.notEmbeddedCount} highlight={summary.notEmbeddedCount > 0 ? "bad" : undefined} />
              <Stat label="Subsetted" value={summary.subsettedCount} />
              <Stat label="Standard" value={summary.standardCount} />
              <Stat label="Duplicated entries" value={summary.duplicatedCount} highlight={summary.duplicatedCount > 0 ? "bad" : undefined} />
              <Stat label="Pages with fonts" value={summary.totalPagesWithFonts} />
              <Stat label="Total chars" value={summary.totalChars.toLocaleString()} />
              <Stat label="Avg chars/font" value={summary.avgCharsPerFont.toLocaleString()} />
            </div>
            <div className="pt-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">By type</p>
              <div className="flex flex-wrap gap-1.5">
                {(["TrueType", "Type1", "OpenType", "CIDFontType0", "CIDFontType2", "Type3", "Unknown"] as FontType[])
                  .filter((t) => summary.byType[t] > 0)
                  .map((t) => (
                    <Badge key={t} variant="secondary" className="text-[11px]">
                      {t} <span className="text-muted-foreground ml-1">{summary.byType[t]}</span>
                    </Badge>
                  ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {duplicates.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" /> Font duplicates ({duplicates.length})
            </h3>
            <div className="space-y-1">
              {duplicates.map((d, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <span className="font-medium">{d.name}</span>
                  <span className="text-muted-foreground ml-2">
                    ×{d.count} • indices {d.indices.join(", ")} • {formatBytes(d.totalBytes)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {recommendations.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Lightbulb className="h-4 w-4" /> Subsetting recommendations ({recommendations.length})
            </h3>
            <div className="space-y-1.5">
              {recommendations.slice(0, 10).map((r, i) => (
                <div key={i} className="rounded border px-3 py-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-500/5 border-amber-500/40">
                  <span className="font-medium">{r.name}</span>: {r.reason}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {ranking.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Font usage ranking (by char count)</h3>
            <div className="space-y-1 max-h-[200px] overflow-auto">
              {ranking.slice(0, 10).map((r) => (
                <div key={r.index} className="flex items-center justify-between rounded border bg-background px-3 py-1.5 text-xs">
                  <span className="font-medium">{r.name}</span>
                  <span className="font-mono text-muted-foreground">
                    {r.charCount.toLocaleString()} chars • {r.pagesUsed} page(s)
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {compatibility.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Compatibility check</h3>
            <div className="space-y-1 max-h-[200px] overflow-auto">
              {compatibility.slice(0, 20).map((c) => (
                <div key={c.index} className={`rounded border px-3 py-1.5 text-xs ${
                  c.compatible ? "border-emerald-500/40 bg-emerald-500/5" : "border-red-500/40 bg-red-500/5"
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{c.name}</span>
                    <Badge variant={c.compatible ? "secondary" : "destructive"} className="text-[10px]">
                      {c.compatible ? "OK" : "RISK"}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-[10px] mt-0.5">{c.note}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {fonts && fonts.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Type className="h-4 w-4" /> Font list ({fonts.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => opts.outputFormat === "json-metadata" ? jsonMetadata
                    : opts.outputFormat === "csv-list" ? csvList
                    : textList}
                  label="Copy"
                />
                <DownloadButton
                  getText={() => opts.outputFormat === "json-metadata" ? jsonMetadata
                    : opts.outputFormat === "csv-list" ? csvList
                    : textList}
                  filename={getOutputFilename(opts.outputFormat === "zip-of-fonts" ? "json-metadata" : opts.outputFormat, file?.name ?? "output.pdf")}
                  mime={opts.outputFormat === "csv-list" ? "text/csv" : "application/json"}
                  label="Download"
                />
                {zipBytes && (
                  <Button variant="outline" size="sm" onClick={downloadZip} className="gap-1.5">
                    <Package className="h-3.5 w-3.5" /> Download ZIP
                  </Button>
                )}
                <ShareButton getUrl={() => buildShareUrl(opts)} />
              </div>
            </div>
            {opts.outputFormat === "zip-of-fonts" && zipBytes && (
              <p className="text-xs text-muted-foreground">
                {formatBytes(zipBytes.length)} ZIP ready — {fonts.filter((f) => f.fontFileBytes).length} embedded font file(s) + README.
              </p>
            )}
            <pre className="max-h-[400px] overflow-auto rounded border bg-muted/30 p-3 text-xs whitespace-pre-wrap font-mono">
              {opts.outputFormat === "zip-of-fonts"
                ? (zipBytes ? `ZIP archive ready (${formatBytes(zipBytes.length)}).\nClick "Download ZIP" above to save it.` : "(No embedded fonts to extract.)")
                : (rendered || "(empty)")}
            </pre>
          </CardContent>
        </Card>
      )}

      {fonts && fonts.length === 0 && (
        <EmptyState
          title="No fonts match the current filters"
          hint="Try changing the format filter or enabling subsetted fonts."
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { clearHistory(); setHistory([]); toast.success("History cleared"); }}
              >Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.extractionMode}</Badge>
                  <span className="font-medium">{h.fileName}</span>
                  <span className="text-muted-foreground ml-2">
                    {h.totalFonts} fonts • {h.embeddedCount} embedded • {h.subsettedCount} subsetted
                  </span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        <strong className="text-foreground">Privacy:</strong> Font extraction runs 100% locally in your browser using pdf-lib — your PDF never leaves your device.
        Only embedded font programs can be extracted; fonts that are merely referenced (and rely on the reader's installed copy) are listed but not downloaded.
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
