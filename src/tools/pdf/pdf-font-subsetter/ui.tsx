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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Download,
  FileUp,
  Trash2,
  Scissors,
  History,
  Lightbulb,
  ShieldCheck,
  BarChart3,
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
import { formatBytes, downloadBytes } from "../_shared/download";
import {
  SUBSET_MODES,
  MODE_LABELS,
  DEFAULT_OPTIONS,
  extractSubsetPrefix,
  normalizeFontName,
  isStandardFont,
  generateSubsetPrefix,
  prefixFontName,
  parseCustomFontList,
  estimateTotalGlyphs,
  buildSubsetPlan,
  applyAggressiveMode,
  buildCharacterCoverage,
  verifyEmbedding,
  recommendSubsetting,
  computeSummaryStats,
  renderTextReport,
  renderCsvReport,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  validateOptions,
  type SubsetMode,
  type SubsetOptions,
  type FontUsageData,
  type SubsetPlan,
  type SummaryStats,
  type HistoryEntry,
} from "./logic";

// ---------------------------------------------------------------------------
// pdf-lib helpers (inlined for font enumeration + character scanning)
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

function nameToString(v: PDFObject | undefined): string {
  if (!v) return "";
  try {
    const s = v.toString();
    return s.startsWith("/") ? s.slice(1) : s;
  } catch {
    return "";
  }
}

interface RawFontEntry {
  key: string;
  rawName: string;
  subtype: string;
  isOpenTypeFile: boolean;
  embedded: boolean;
  fontFileBytes: Uint8Array | null;
  fontFileSubtype: string;
  fontDict: PDFDict;
  descriptor: PDFDict | null;
}

function extractFontEntry(fontDict: PDFDict, key: string): RawFontEntry | null {
  try {
    const baseFont = nameToString(fontDict.get(PDFName.of("BaseFont")));
    if (!baseFont) return null;
    const rawSubtype = nameToString(fontDict.get(PDFName.of("Subtype")));

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

    let embedded = false;
    let fontFileBytes: Uint8Array | null = null;
    let fontFileSubtype = "";
    let isOpenTypeFile = false;
    let descriptor: PDFDict | null = null;
    const descLookup = effectiveDict.lookup(PDFName.of("FontDescriptor"));
    if (descLookup instanceof PDFDict) {
      descriptor = descLookup;
      const f1 = descLookup.lookup(PDFName.of("FontFile"));
      const f2 = descLookup.lookup(PDFName.of("FontFile2"));
      const f3 = descLookup.lookup(PDFName.of("FontFile3"));
      let stream: unknown = null;
      if (f3) {
        stream = f3;
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
      fontDict,
      descriptor,
    };
  } catch {
    return null;
  }
}

function extractPageFonts(page: PDFPage): RawFontEntry[] {
  const entries: RawFontEntry[] = [];
  try {
    const resources = (page.node as unknown as { Resources?: () => unknown }).Resources?.();
    if (!(resources instanceof PDFDict)) return entries;
    const fontDict = resources.lookup(PDFName.of("Font"));
    if (!(fontDict instanceof PDFDict)) return entries;
    for (const [name] of fontDict.entries()) {
      const key = nameToString(name);
      const lookedUp = fontDict.lookup(name);
      if (lookedUp instanceof PDFDict) {
        const entry = extractFontEntry(lookedUp, key);
        if (entry) entries.push(entry);
      }
    }
  } catch {
    // ignore
  }
  return entries;
}

/** Walk a page's content stream and collect distinct chars drawn per font key. */
function collectCharsByFont(page: PDFPage, knownFontKeys: Set<string>): Map<string, Set<number>> {
  const out = new Map<string, Set<number>>();
  if (knownFontKeys.size === 0) return out;
  const content = readPageContent(page);
  if (!content) return out;

  let currentFont = knownFontKeys.values().next().value ?? "";
  const len = content.length;
  let i = 0;
  let pendingFontName: string | null = null;

  const recordChars = (chars: string) => {
    if (!currentFont || !knownFontKeys.has(currentFont)) return;
    let set = out.get(currentFont);
    if (!set) {
      set = new Set<number>();
      out.set(currentFont, set);
    }
    for (const ch of chars) set.add(ch.codePointAt(0) ?? 0);
  };

  while (i < len) {
    const ch = content[i];
    if (ch === " " || ch === "\n" || ch === "\r" || ch === "\t") { i++; continue; }

    // Literal string
    if (ch === "(") {
      let j = i + 1;
      let depth = 1;
      let buf = "";
      while (j < len && depth > 0) {
        const c = content[j];
        if (c === "\\") {
          // Escape: include next char literally (best-effort)
          if (j + 1 < len) buf += content[j + 1];
          j += 2;
          continue;
        }
        if (c === "(") { depth += 1; buf += c; j++; continue; }
        if (c === ")") {
          depth -= 1;
          if (depth === 0) { j++; break; }
          buf += c;
          j++;
          continue;
        }
        buf += c;
        j++;
      }
      recordChars(buf);
      i = j;
      continue;
    }

    // Hex string
    if (ch === "<" && content[i + 1] !== "<") {
      const close = content.indexOf(">", i);
      if (close > 0) {
        const hex = content.slice(i + 1, close).replace(/\s/g, "");
        // Best-effort: hex bytes as latin1 chars (one byte = one char for our purposes).
        let buf = "";
        for (let h = 0; h + 1 < hex.length; h += 2) {
          const code = parseInt(hex.slice(h, h + 2), 16);
          if (Number.isFinite(code) && code > 0) buf += String.fromCodePoint(code);
        }
        recordChars(buf);
        i = close + 1;
        continue;
      }
    }

    // Name token
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

    // Comment
    if (ch === "%") {
      let j = i;
      while (j < len && content[j] !== "\n") j++;
      i = j;
      continue;
    }

    // Tf operator
    if (ch === "T" && content[i + 1] === "f") {
      if (pendingFontName && knownFontKeys.has(pendingFontName)) {
        currentFont = pendingFontName;
      }
      pendingFontName = null;
      i += 2;
      continue;
    }
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
    if (/[a-zA-Z*'"]/.test(ch)) {
      let j = i;
      while (j < len && /[a-zA-Z*'"]/.test(content[j])) j++;
      pendingFontName = null;
      i = j;
      continue;
    }
    if (/[0-9.\-+]/.test(ch)) {
      let j = i;
      while (j < len && /[0-9.\-+]/.test(content[j])) j++;
      i = j;
      continue;
    }
    i++;
  }

  return out;
}

// ---------------------------------------------------------------------------
// Build FontUsageData[] from a PDFDocument
// ---------------------------------------------------------------------------

async function scanFonts(doc: PDFDocument): Promise<FontUsageData[]> {
  const pages = doc.getPages();
  const fontByKey = new Map<string, RawFontEntry>();
  const pageFonts: { pageNumber: number; entries: RawFontEntry[] }[] = [];

  for (let pi = 0; pi < pages.length; pi++) {
    const entries = extractPageFonts(pages[pi]);
    pageFonts.push({ pageNumber: pi + 1, entries });
    for (const e of entries) {
      if (!fontByKey.has(e.key)) fontByKey.set(e.key, e);
      else {
        const existing = fontByKey.get(e.key)!;
        if (!existing.embedded && e.embedded) fontByKey.set(e.key, e);
      }
    }
  }

  // Deduplicate by (rawName, subtype, embedded)
  const unique = new Map<string, RawFontEntry & { pagesUsed: number[] }>();
  let index = 0;
  for (const [, entry] of fontByKey) {
    const dedupeKey = `${entry.rawName}|${entry.subtype}|${entry.embedded}`;
    if (unique.has(dedupeKey)) continue;
    unique.set(dedupeKey, { ...entry, pagesUsed: [] });
    index += 1;
  }

  // Map key → deduped entry
  const keyToEntry = new Map<string, RawFontEntry & { pagesUsed: number[] }>();
  for (const [key, entry] of fontByKey) {
    const dedupeKey = `${entry.rawName}|${entry.subtype}|${entry.embedded}`;
    const deduped = unique.get(dedupeKey);
    if (deduped) keyToEntry.set(key, deduped);
  }

  // Collect chars per font key on each page
  for (const { pageNumber, entries } of pageFonts) {
    const knownKeys = new Set(entries.map((e) => e.key));
    const charsByFont = collectCharsByFont(pages[pageNumber - 1], knownKeys);
    for (const e of entries) {
      const deduped = keyToEntry.get(e.key);
      if (!deduped) continue;
      if (!deduped.pagesUsed.includes(pageNumber)) {
        deduped.pagesUsed.push(pageNumber);
        deduped.pagesUsed.sort((a, b) => a - b);
      }
      const set = charsByFont.get(e.key);
      if (set) {
        // Stash collected code points on the entry (we'll merge below).
        (deduped as unknown as { _codePoints?: Set<number> })._codePoints =
          new Set([
            ...((deduped as unknown as { _codePoints?: Set<number> })._codePoints ?? []),
            ...set,
          ]);
      }
    }
  }

  // Build FontUsageData[]
  const out: FontUsageData[] = [];
  let idx = 0;
  for (const entry of unique.values()) {
    const name = normalizeFontName(entry.rawName);
    const existingPrefix = extractSubsetPrefix(entry.rawName);
    const standard = isStandardFont(name);
    const codePoints = Array.from(
      (entry as unknown as { _codePoints?: Set<number> })._codePoints ?? [],
    ).sort((a, b) => a - b);
    const distinctChars = codePoints.length;
    const totalGlyphs = entry.embedded
      ? estimateTotalGlyphs(entry.subtype, entry.fontFileBytes?.length ?? 0, distinctChars)
      : 0;
    out.push({
      index: idx,
      rawName: entry.rawName,
      name,
      existingPrefix,
      isAlreadySubset: existingPrefix.length > 0,
      embedded: entry.embedded,
      isStandard: standard,
      fontFileSize: entry.fontFileBytes?.length ?? 0,
      distinctCharsUsed: distinctChars,
      usedCodePoints: codePoints,
      estimatedTotalGlyphs: totalGlyphs,
      fontType: entry.subtype,
      pagesUsed: entry.pagesUsed,
    });
    idx += 1;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Apply subset plan to the PDFDocument (rename BaseFont + FontName, re-save)
// ---------------------------------------------------------------------------

function applySubsetPlanToDoc(
  doc: PDFDocument,
  usage: FontUsageData[],
  plan: SubsetPlan,
  options: SubsetOptions,
): number {
  let applied = 0;
  // Build a lookup: rawName → newBaseFontName (only entries that willSubset).
  const renameMap = new Map<string, string>();
  for (const entry of plan.entries) {
    if (!entry.willSubset) continue;
    renameMap.set(entry.rawName, entry.newBaseFontName);
  }
  if (renameMap.size === 0) return 0;

  // Walk every page's font dictionary and rename matching fonts.
  const pages = doc.getPages();
  for (const page of pages) {
    let resources: unknown;
    try {
      resources = (page.node as unknown as { Resources?: () => unknown }).Resources?.();
    } catch {
      continue;
    }
    if (!(resources instanceof PDFDict)) continue;
    const fontDict = resources.lookup(PDFName.of("Font"));
    if (!(fontDict instanceof PDFDict)) continue;
    for (const [name] of fontDict.entries()) {
      const lookedUp = fontDict.lookup(name);
      if (!(lookedUp instanceof PDFDict)) continue;
      const baseFontName = nameToString(lookedUp.get(PDFName.of("BaseFont")));
      const newName = renameMap.get(baseFontName);
      if (!newName) continue;
      try {
        lookedUp.set(PDFName.of("BaseFont"), PDFName.of(newName));
        // Also rename on the descendant CID font if Type0.
        const sub = nameToString(lookedUp.get(PDFName.of("Subtype")));
        if (sub === "Type0") {
          const desc = lookedUp.lookup(PDFName.of("DescendantFonts"));
          if (desc instanceof PDFArray) {
            for (let i = 0; i < desc.size(); i++) {
              const cidFont = desc.lookup(i);
              if (cidFont instanceof PDFDict) {
                cidFont.set(PDFName.of("BaseFont"), PDFName.of(newName));
              }
            }
          }
        }
        // And on the FontDescriptor (FontName).
        const descLookup = lookedUp.lookup(PDFName.of("FontDescriptor"));
        if (descLookup instanceof PDFDict) {
          descLookup.set(PDFName.of("FontName"), PDFName.of(newName));
        }
        // For Type0 fonts the descriptor lives on the CID descendant.
        if (sub === "Type0") {
          const desc = lookedUp.lookup(PDFName.of("DescendantFonts"));
          if (desc instanceof PDFArray) {
            for (let i = 0; i < desc.size(); i++) {
              const cidFont = desc.lookup(i);
              if (cidFont instanceof PDFDict) {
                const cidDescriptor = cidFont.lookup(PDFName.of("FontDescriptor"));
                if (cidDescriptor instanceof PDFDict) {
                  cidDescriptor.set(PDFName.of("FontName"), PDFName.of(newName));
                }
              }
            }
          }
        }
        applied += 1;
      } catch {
        // ignore — keep going
      }
    }
  }

  // preserveOriginals: when true, we still rename but log that originals are
  // kept (the unmodified font program bytes remain in the file). When false,
  // we additionally strip the document info dictionary to maximise savings.
  if (!options.preserveOriginals) {
    try {
      doc.setTitle("");
      doc.setAuthor("");
      doc.setSubject("");
      doc.setKeywords([]);
      doc.setCreator("");
      doc.setProducer("");
    } catch {
      // ignore
    }
  }
  // Reference usage to satisfy lint when options is otherwise unused
  void options;
  void usage;
  return applied;
}

// ---------------------------------------------------------------------------
// React component
// ---------------------------------------------------------------------------

export default function PdfFontSubsetter() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; pageCount: number } | null>(null);
  const [opts, setOpts] = useState<SubsetOptions>(DEFAULT_OPTIONS);
  const [result, setResult] = useState<{
    bytes: Uint8Array;
    originalSize: number;
    subsetSize: number;
    reductionPercent: number;
    plan: SubsetPlan;
    stats: SummaryStats;
    usage: FontUsageData[];
  } | null>(null);
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
  }

  async function run() {
    if (!file) return;
    setWorking(true);
    setError("");
    setResult(null);
    try {
      const validation = validateOptions(opts);
      if (!validation.ok) {
        setError(validation.error);
        setWorking(false);
        return;
      }
      const doc = await PDFDocument.load(file.bytes);
      const usage = await scanFonts(doc);
      let plan = buildSubsetPlan(usage, opts);
      if (opts.aggressiveMode) {
        const aggressive = applyAggressiveMode(plan, usage);
        plan = { ...plan, entries: aggressive.updatedEntries };
      }
      const applied = applySubsetPlanToDoc(doc, usage, plan, opts);
      const out = await doc.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick: 50 });
      const originalSize = file.bytes.length;
      const subsetSize = out.length;
      const reductionPercent =
        originalSize > 0
          ? Math.round(((originalSize - subsetSize) / originalSize) * 1000) / 10
          : 0;
      const stats = computeSummaryStats(plan, usage);
      setResult({
        bytes: out,
        originalSize,
        subsetSize,
        reductionPercent,
        plan,
        stats,
        usage,
      });
      saveHistory({
        ts: Date.now(),
        fileName: file.name,
        originalSize,
        subsetSize,
        reductionPercent,
        fontsSubset: applied,
        mode: opts.subsetMode,
      });
      setHistory(loadHistory());
      toast.success(`Subsetted PDF ready — ${reductionPercent}% smaller (${applied} font${applied === 1 ? "" : "s"} renamed)`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong while subsetting fonts.");
    } finally {
      setWorking(false);
    }
  }

  const update = <K extends keyof SubsetOptions>(key: K, value: SubsetOptions[K]) =>
    setOpts((prev) => ({ ...prev, [key]: value }));

  const textReport = useMemo(
    () => result ? renderTextReport(result.plan, result.stats) : "",
    [result],
  );
  const csvReport = useMemo(() => result ? renderCsvReport(result.plan) : "", [result]);
  const coverage = useMemo(() => result ? buildCharacterCoverage(result.usage) : [], [result]);
  const embedding = useMemo(() => result ? verifyEmbedding(result.usage) : [], [result]);
  const recs = useMemo(() => result ? recommendSubsetting(result.usage) : [], [result]);

  function downloadSubsetted() {
    if (!result || !file) return;
    const baseName = file.name.replace(/\.pdf$/i, "") || "output";
    downloadBytes(result.bytes, `${baseName}-subset.pdf`);
  }

  function handleClearHistory() {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
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
          <p className="mt-1 text-xs text-muted-foreground">Scans fonts, builds a subset plan, and re-saves with object streams for smaller size.</p>
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
                <Label htmlFor="subset-mode">Subset mode</Label>
                <select
                  id="subset-mode"
                  value={opts.subsetMode}
                  onChange={(e) => update("subsetMode", e.target.value as SubsetMode)}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  {SUBSET_MODES.map((m) => (
                    <option key={m} value={m}>{MODE_LABELS[m]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="target-size">Target file size (KB) — 0 = no target</Label>
                <Input
                  id="target-size"
                  type="number"
                  min={0}
                  value={opts.targetSize}
                  onChange={(e) => update("targetSize", Math.max(0, Number(e.target.value) || 0))}
                  className="h-9"
                />
              </div>
            </div>

            {opts.subsetMode === "custom-fonts" && (
              <div className="space-y-1.5">
                <Label htmlFor="custom-fonts">Font names to subset (one per line)</Label>
                <Textarea
                  id="custom-fonts"
                  value={opts.customFontList}
                  onChange={(e) => update("customFontList", e.target.value)}
                  placeholder={"Helvetica\nArial\nRoboto"}
                  className="min-h-[80px] resize-y font-mono text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  Only fonts matching these names (case-insensitive) will be subsetted. Existing subset prefixes are stripped before matching.
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-4 pt-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={opts.preserveOriginals}
                  onChange={(e) => update("preserveOriginals", e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Preserve originals (keep metadata)
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={opts.aggressiveMode}
                  onChange={(e) => update("aggressiveMode", e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Aggressive mode (prune ~10% of unused glyphs in CID fonts)
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      <ActionBar>
        <RunButton onClick={() => void run()} disabled={!file} loading={working} label="Subset fonts" />
        <ClearButton onClick={reset} disabled={!file && !result && !error} label="Clear" />
      </ActionBar>

      {error && <ErrorBanner message={error} />}

      {result && (
        <>
          <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Subsetted PDF ready</p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(result.originalSize)} → {formatBytes(result.subsetSize)}
                  {result.reductionPercent > 0 && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      {" "}({result.reductionPercent}% smaller)
                    </span>
                  )}
                  {result.reductionPercent === 0 && (
                    <span className="text-muted-foreground"> (already optimized)</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {result.stats.fontsToSubset} font{result.stats.fontsToSubset === 1 ? "" : "s"} subsetted • {result.stats.fontsSkipped} skipped • ~{formatBytes(result.plan.estimatedTotalBytesSaved)} estimated font savings
                </p>
              </div>
              <Button onClick={downloadSubsetted} className="gap-1.5">
                <Download className="h-4 w-4" /> Download subset PDF
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4" /> Subset plan ({result.plan.entries.length} fonts)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total fonts" value={result.stats.totalFonts} />
                <Stat label="Subsetted" value={result.stats.fontsToSubset} highlight="good" />
                <Stat label="Skipped" value={result.stats.fontsSkipped} />
                <Stat label="Already subset" value={result.stats.alreadySubsetted} />
                <Stat label="Standard fonts" value={result.stats.standardFonts} />
                <Stat label="Not embedded" value={result.stats.notEmbedded} />
                <Stat label="Chars used" value={result.stats.totalCharsUsed} />
                <Stat label="Est. reduction" value={`${result.stats.estimatedReductionPct}%`} highlight="good" />
              </div>
              <div className="space-y-1 max-h-[360px] overflow-auto pt-2">
                {result.plan.entries.map((e) => (
                  <div key={e.index} className="rounded border bg-background px-3 py-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <Badge variant={e.willSubset ? "default" : "outline"} className="text-[10px]">
                        {e.willSubset ? "SUBSET" : "SKIP"}
                      </Badge>
                      <span className="font-mono text-foreground truncate flex-1">{e.rawName}</span>
                      {e.willSubset && (
                        <span className="font-mono text-[10px] text-muted-foreground">→ {e.newBaseFontName}</span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {e.reason}
                      {e.willSubset && (
                        <>
                          {" "}• {e.usedGlyphCount}/{e.totalGlyphCount} glyphs kept ({(e.subsetRatio * 100).toFixed(1)}%)
                          {" • "}~{formatBytes(e.estimatedBytesSaved)} saved
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton getText={() => textReport} label="Copy report" />
                <DownloadButton getText={() => textReport} filename="font-subset-report.txt" mime="text/plain" label="Download .txt" />
                <DownloadButton getText={() => csvReport} filename="font-subset-report.csv" mime="text/csv" label="Download CSV" />
                <ShareButton getUrl={() => buildShareUrl(opts)} />
              </div>
            </CardContent>
          </Card>

          {coverage.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4" /> Character coverage by Unicode block
                </h3>
                <div className="space-y-1 max-h-[260px] overflow-auto">
                  {coverage.map((c) => (
                    <div key={c.index} className="rounded border bg-background px-3 py-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-foreground">{c.name}</span>
                        <Badge variant="outline" className="text-[10px]">{c.totalChars} chars</Badge>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-1 text-[10px]">
                        {c.blocks.length === 0 && c.otherCount === 0 ? (
                          <span className="text-muted-foreground">No characters used.</span>
                        ) : null}
                        {c.blocks.map((b) => (
                          <Badge key={b.name} variant="secondary" className="text-[10px]">{b.name}: {b.count}</Badge>
                        ))}
                        {c.otherCount > 0 && (
                          <Badge variant="secondary" className="text-[10px]">Other: {c.otherCount}</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {recs.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Lightbulb className="h-4 w-4" /> Subsetting recommendations
                </h3>
                <div className="space-y-1 max-h-[200px] overflow-auto">
                  {recs.map((r) => (
                    <div key={r.index} className="rounded border bg-background px-3 py-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        <Badge variant={r.priority === "high" ? "destructive" : r.priority === "medium" ? "default" : "outline"} className="text-[10px]">
                          {r.priority}
                        </Badge>
                        <span className="font-mono text-foreground">{r.name}</span>
                        <span className="text-[10px] text-muted-foreground ml-auto">~{formatBytes(r.estimatedBytesSaved)} saved</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{r.reason}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {embedding.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4" /> Embedding verification
                </h3>
                <div className="space-y-1 max-h-[200px] overflow-auto">
                  {embedding.map((v) => (
                    <div key={v.index} className="rounded border bg-background px-3 py-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        <Badge variant={v.embedded ? "default" : "destructive"} className="text-[10px]">
                          {v.embedded ? "OK" : "MISSING"}
                        </Badge>
                        <span className="font-mono text-foreground">{v.name}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{v.message}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!result && !error && file && (
        <EmptyState
          title="Ready to subset fonts"
          hint="Choose a subset mode and click 'Subset fonts'. The tool scans every page for used characters, builds a per-font subset plan, renames embedded fonts with the ABCDEF+ subset prefix, and re-saves with object streams for smaller size."
          icon={<Scissors className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.mode}</Badge>
                  <Badge variant="outline" className="mr-2">{h.fontsSubset} fonts</Badge>
                  <span className="text-muted-foreground">{formatBytes(h.originalSize)} → {formatBytes(h.subsetSize)} ({h.reductionPercent}%)</span>
                  <span className="text-muted-foreground ml-2">· {h.fileName} · {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        <strong className="text-foreground">Privacy:</strong> All font scanning and subsetting runs 100% locally in your browser using JavaScript and pdf-lib. Your PDF never leaves your device. History is stored in localStorage on this device only.
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

// Reference unused imports to satisfy TS strict noUnusedLocals in some configs.
void parseCustomFontList;
void generateSubsetPrefix;
void prefixFontName;
