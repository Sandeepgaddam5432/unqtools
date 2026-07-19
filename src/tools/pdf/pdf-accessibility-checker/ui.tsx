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
  PDFHexString,
  PDFString,
  decodePDFRawStream,
  type PDFPage,
} from "pdf-lib";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Download,
  FileUp,
  Trash2,
  Accessibility,
  History,
  AlertTriangle,
  Lightbulb,
  ShieldCheck,
  BarChart3,
  ListChecks,
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
  parsePageRanges,
} from "../_shared/page-ranges";
import {
  STANDARDS,
  STANDARD_LABELS,
  CHECK_LEVELS,
  CHECK_LEVEL_LABELS,
  CATEGORY_LABELS,
  DEFAULT_OPTIONS,
  normalizePageRangeSpec,
  resolveAllRange,
  contrastRatio,
  runAllChecks,
  filterByLevel,
  computeAllCompliance,
  compareStandards,
  computeSummaryStats,
  criticalIssues,
  generateRecommendations,
  renderTextReport,
  renderCsvReport,
  renderJsonReport,
  renderHtmlReport,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  validateOptions,
  type AccessibilityStandard,
  type CheckLevel,
  type DocumentA11yData,
  type CheckResult,
  type ComplianceResult,
  type SummaryStats,
  type HistoryEntry,
} from "./logic";

// ---------------------------------------------------------------------------
// pdf-lib helpers
// ---------------------------------------------------------------------------

function nameToString(v: PDFObject | undefined): string {
  if (!v) return "";
  try {
    const s = v.toString();
    return s.startsWith("/") ? s.slice(1) : s;
  } catch {
    return "";
  }
}

function pdfStringToString(v: PDFObject | undefined): string {
  if (!v) return "";
  try {
    if (v instanceof PDFString) return v.asString();
    if (v instanceof PDFHexString) return v.decodeText();
    if (typeof (v as unknown as { asString?: () => string }).asString === "function") {
      return (v as unknown as { asString: () => string }).asString();
    }
    const s = v.toString();
    return s.startsWith("/") ? s.slice(1) : s;
  } catch {
    return "";
  }
}

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

// ---------------------------------------------------------------------------
// Scan a PDFDocument and produce DocumentA11yData
// ---------------------------------------------------------------------------

interface RgbTriple { r: number; g: number; b: number; }

interface ContrastPair {
  pageNumber: number;
  pairsChecked: number;
  failingPairs: number;
  lowestRatio: number;
}

/** Parse content stream looking for text-show + fill-color operator pairs. */
function scanPageContrast(page: PDFPage, pageNumber: number, threshold: number): ContrastPair {
  const content = readPageContent(page);
  if (!content) return { pageNumber, pairsChecked: 0, failingPairs: 0, lowestRatio: 21 };
  // Track current fill (rg/g/k) and text color, then count Tj/TJ when a fill is active.
  let currentFill: RgbTriple | null = null;
  let currentText: RgbTriple | null = null;
  let pairsChecked = 0;
  let failingPairs = 0;
  let lowest = 21;
  const len = content.length;
  let i = 0;
  // Stack of pending numeric operands.
  const operandStack: number[] = [];

  const flushOperands = () => {
    operandStack.length = 0;
  };

  while (i < len) {
    const ch = content[i];
    if (ch === " " || ch === "\n" || ch === "\r" || ch === "\t") { i++; continue; }

    // Number
    if (/[0-9.\-+]/.test(ch)) {
      let j = i;
      let num = "";
      while (j < len && /[0-9.\-+]/.test(content[j])) {
        num += content[j];
        j++;
      }
      const n = parseFloat(num);
      if (Number.isFinite(n)) operandStack.push(n);
      i = j;
      continue;
    }

    // Name token /XXX
    if (ch === "/") {
      let j = i + 1;
      while (j < len && /[A-Za-z0-9._+-]/.test(content[j])) j++;
      i = j;
      continue;
    }

    // Literal string (...)
    if (ch === "(") {
      let depth = 1;
      let j = i + 1;
      while (j < len && depth > 0) {
        if (content[j] === "\\") { j += 2; continue; }
        if (content[j] === "(") { depth += 1; j++; continue; }
        if (content[j] === ")") { depth -= 1; j++; continue; }
        j++;
      }
      // We hit a string — this is a text-show argument. Count a contrast pair.
      if (currentText && currentFill) {
        const ratio = contrastRatio(currentText, currentFill);
        pairsChecked += 1;
        if (ratio < threshold) failingPairs += 1;
        if (ratio < lowest) lowest = ratio;
      } else if (currentFill) {
        // No text color set — assume black text.
        const ratio = contrastRatio({ r: 0, g: 0, b: 0 }, currentFill);
        pairsChecked += 1;
        if (ratio < threshold) failingPairs += 1;
        if (ratio < lowest) lowest = ratio;
      }
      i = j;
      continue;
    }

    // Hex string <...>
    if (ch === "<" && content[i + 1] !== "<") {
      const close = content.indexOf(">", i);
      if (close > 0) {
        if (currentText && currentFill) {
          const ratio = contrastRatio(currentText, currentFill);
          pairsChecked += 1;
          if (ratio < threshold) failingPairs += 1;
          if (ratio < lowest) lowest = ratio;
        } else if (currentFill) {
          const ratio = contrastRatio({ r: 0, g: 0, b: 0 }, currentFill);
          pairsChecked += 1;
          if (ratio < threshold) failingPairs += 1;
          if (ratio < lowest) lowest = ratio;
        }
        i = close + 1;
        continue;
      }
    }

    // Operators
    if (ch === "r" && content[i + 1] === "g" && !/[a-zA-Z]/.test(content[i + 2] ?? "")) {
      // rg = set fill color (RGB)
      if (operandStack.length >= 3) {
        const r = operandStack[operandStack.length - 3];
        const g = operandStack[operandStack.length - 2];
        const b = operandStack[operandStack.length - 1];
        currentFill = {
          r: Math.max(0, Math.min(255, Math.round(r * 255))),
          g: Math.max(0, Math.min(255, Math.round(g * 255))),
          b: Math.max(0, Math.min(255, Math.round(b * 255))),
        };
      }
      flushOperands();
      i += 2;
      continue;
    }
    if (ch === "g" && !/[a-zA-Z]/.test(content[i + 1] ?? "")) {
      // g = set fill color (gray)
      if (operandStack.length >= 1) {
        const v = Math.max(0, Math.min(255, Math.round(operandStack[operandStack.length - 1] * 255)));
        currentFill = { r: v, g: v, b: v };
      }
      flushOperands();
      i += 1;
      continue;
    }
    if (ch === "k" && !/[a-zA-Z]/.test(content[i + 1] ?? "")) {
      // k = set fill color (CMYK) → convert to RGB
      if (operandStack.length >= 4) {
        const c = operandStack[operandStack.length - 4];
        const m = operandStack[operandStack.length - 3];
        const y = operandStack[operandStack.length - 2];
        const k = operandStack[operandStack.length - 1];
        const r = Math.round(255 * (1 - c) * (1 - k));
        const g = Math.round(255 * (1 - m) * (1 - k));
        const b = Math.round(255 * (1 - y) * (1 - k));
        currentFill = {
          r: Math.max(0, Math.min(255, r)),
          g: Math.max(0, Math.min(255, g)),
          b: Math.max(0, Math.min(255, b)),
        };
      }
      flushOperands();
      i += 1;
      continue;
    }
    // Text-show operators — already handled above via string scan.
    if (ch === "T" && (content[i + 1] === "j" || content[i + 1] === "J")) {
      flushOperands();
      i += 2;
      continue;
    }
    if (ch === "'" || ch === "\"") {
      flushOperands();
      i += 1;
      continue;
    }
    // Other letter operators — clear stack.
    if (/[a-zA-Z*'"]/.test(ch)) {
      let j = i;
      while (j < len && /[a-zA-Z*'"]/.test(content[j])) j++;
      flushOperands();
      i = j;
      continue;
    }
    // Brackets / dict markers
    if (ch === "[" || ch === "]" || ch === "{" || ch === "}" || ch === "<" || ch === ">") {
      i += 1;
      continue;
    }
    i++;
  }

  return { pageNumber, pairsChecked, failingPairs, lowestRatio: lowest === 21 ? 0 : lowest };
}

/** Count image XObjects and check for /Alt or /ActualText on each. */
function scanPageImages(page: PDFPage): { images: number; imagesWithAlt: number } {
  let images = 0;
  let imagesWithAlt = 0;
  try {
    const resources = (page.node as unknown as { Resources?: () => unknown }).Resources?.();
    if (!(resources instanceof PDFDict)) return { images: 0, imagesWithAlt: 0 };
    const xobj = resources.lookup(PDFName.of("XObject"));
    if (!(xobj instanceof PDFDict)) return { images: 0, imagesWithAlt: 0 };
    for (const [name] of xobj.entries()) {
      const lookedUp = xobj.lookup(name);
      if (!(lookedUp instanceof PDFDict)) continue;
      const sub = nameToString(lookedUp.get(PDFName.of("Subtype")));
      if (sub !== "Image") continue;
      images += 1;
      const alt = lookedUp.get(PDFName.of("Alt"));
      const actual = lookedUp.get(PDFName.of("ActualText"));
      if (alt || actual) imagesWithAlt += 1;
    }
  } catch {
    // ignore
  }
  return { images, imagesWithAlt };
}

/** Check whether a page defines a /Tabs entry. */
function pageHasTabOrder(page: PDFPage): boolean {
  try {
    const tabs = (page.node as unknown as { Tabs?: () => unknown }).Tabs?.();
    return !!tabs;
  } catch {
    return false;
  }
}

/** Count annotations on a page (used for the interactive-check detail). */
function countPageAnnotations(page: PDFPage): number {
  try {
    const annots = (page.node as unknown as { Annots?: () => unknown }).Annots?.();
    if (annots instanceof PDFArray) return annots.size();
  } catch {
    // ignore
  }
  return 0;
}

/** Walk an AcroForm fields array and count fields with /TU labels. */
function scanAcroForm(doc: PDFDocument): { count: number; withLabel: number } {
  try {
    const acroForm = (doc.catalog as unknown as { lookup: (k: PDFName) => unknown }).lookup(PDFName.of("AcroForm"));
    if (!(acroForm instanceof PDFDict)) return { count: 0, withLabel: 0 };
    const fields = acroForm.lookup(PDFName.of("Fields"));
    if (!(fields instanceof PDFArray)) return { count: 0, withLabel: 0 };
    let count = 0;
    let withLabel = 0;
    for (let i = 0; i < fields.size(); i++) {
      const field = fields.lookup(i);
      if (!(field instanceof PDFDict)) continue;
      count += 1;
      const tu = field.get(PDFName.of("TU"));
      if (tu) withLabel += 1;
    }
    return { count, withLabel };
  } catch {
    return { count: 0, withLabel: 0 };
  }
}

/** Count top-level outline items (bookmarks). */
function countOutlineItems(doc: PDFDocument): number {
  try {
    const outlines = (doc.catalog as unknown as { lookup: (k: PDFName) => unknown }).lookup(PDFName.of("Outlines"));
    if (!(outlines instanceof PDFDict)) return 0;
    const first = outlines.lookup(PDFName.of("First"));
    if (!first) return 0;
    let count = 0;
    let current: PDFObject | undefined = first;
    const seen = new Set<PDFObject>();
    while (current instanceof PDFDict && !seen.has(current)) {
      seen.add(current);
      count += 1;
      current = current.lookup(PDFName.of("Next"));
    }
    return count;
  } catch {
    return 0;
  }
}

/** Extract the full DocumentA11yData from a loaded PDFDocument. */
async function scanDocument(
  doc: PDFDocument,
  pageIndices: number[],
  contrastThreshold: number,
): Promise<DocumentA11yData> {
  const pages = doc.getPages();
  const pageCount = pages.length;

  // Document-level
  let title = "";
  let hasTitle = false;
  try {
    title = doc.getTitle() ?? "";
    hasTitle = title.trim().length > 0;
  } catch {
    title = "";
  }

  let hasLanguage = false;
  let language = "";
  try {
    const lang = (doc.catalog as unknown as { get: (k: PDFName) => PDFObject | undefined }).get(PDFName.of("Lang"));
    if (lang) {
      language = pdfStringToString(lang);
      hasLanguage = language.trim().length > 0;
    }
  } catch {
    // ignore
  }

  const structTree = (doc.catalog as unknown as { lookup: (k: PDFName) => unknown }).lookup(PDFName.of("StructTreeRoot"));
  const hasStructureTree = structTree instanceof PDFDict;

  let hasMarkInfo = false;
  let marked = false;
  try {
    const markInfo = (doc.catalog as unknown as { lookup: (k: PDFName) => unknown }).lookup(PDFName.of("MarkInfo"));
    if (markInfo instanceof PDFDict) {
      hasMarkInfo = true;
      const markedObj = markInfo.get(PDFName.of("Marked"));
      marked = markedObj ? markedObj.toString() === "/true" || markedObj.toString() === "true" : false;
    }
  } catch {
    // ignore
  }

  const outlines = (doc.catalog as unknown as { lookup: (k: PDFName) => unknown }).lookup(PDFName.of("Outlines"));
  const hasOutline = outlines instanceof PDFDict;
  const outlineCount = hasOutline ? countOutlineItems(doc) : 0;

  const metadata = (doc.catalog as unknown as { lookup: (k: PDFName) => unknown }).lookup(PDFName.of("Metadata"));
  const hasMetadata = !!metadata;

  let hasDisplayDocTitle = false;
  try {
    const viewerPrefs = (doc.catalog as unknown as { lookup: (k: PDFName) => unknown }).lookup(PDFName.of("ViewerPreferences"));
    if (viewerPrefs instanceof PDFDict) {
      const ddt = viewerPrefs.get(PDFName.of("DisplayDocTitle"));
      hasDisplayDocTitle = !!ddt && (ddt.toString() === "/true" || ddt.toString() === "true");
    }
  } catch {
    // ignore
  }

  const acroForm = (doc.catalog as unknown as { lookup: (k: PDFName) => unknown }).lookup(PDFName.of("AcroForm"));
  const hasAcroForm = acroForm instanceof PDFDict;
  const formScan = hasAcroForm ? scanAcroForm(doc) : { count: 0, withLabel: 0 };

  // Per-page scans
  let imageCount = 0;
  let imagesWithAltText = 0;
  let pagesWithTabOrder = 0;
  const contrastByPage: DocumentA11yData["contrastByPage"] = [];
  const annotationsByPage: DocumentA11yData["annotationsByPage"] = [];

  for (const idx of pageIndices) {
    if (idx < 0 || idx >= pageCount) continue;
    const page = pages[idx];
    const imgs = scanPageImages(page);
    imageCount += imgs.images;
    imagesWithAltText += imgs.imagesWithAlt;
    if (pageHasTabOrder(page)) pagesWithTabOrder += 1;
    contrastByPage.push(scanPageContrast(page, idx + 1, contrastThreshold));
    annotationsByPage.push({ pageNumber: idx + 1, count: countPageAnnotations(page) });
  }

  return {
    pageCount,
    hasTitle,
    title,
    hasLanguage,
    language,
    hasStructureTree,
    hasMarkInfo,
    marked,
    hasOutline,
    outlineCount,
    hasMetadata,
    hasDisplayDocTitle,
    hasAcroForm,
    formFieldCount: formScan.count,
    formFieldsWithLabel: formScan.withLabel,
    imageCount,
    imagesWithAltText,
    pagesWithTabOrder,
    contrastByPage,
    annotationsByPage,
  };
}

// ---------------------------------------------------------------------------
// React component
// ---------------------------------------------------------------------------

export default function PdfAccessibilityChecker() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; pageCount: number } | null>(null);
  const [opts, setOpts] = useState(DEFAULT_OPTIONS);
  const [result, setResult] = useState<{
    results: CheckResult[];
    summary: SummaryStats;
    compliance: ComplianceResult[];
    data: DocumentA11yData;
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
      const validation = validateOptions(opts, file.pageCount);
      if (!validation.ok) {
        setError(validation.error);
        setWorking(false);
        return;
      }
      const validOpts = validation.output;
      const doc = await PDFDocument.load(file.bytes);
      const pages = doc.getPages();
      const normalized = normalizePageRangeSpec(validOpts.pageRange);
      let indices: number[];
      if (normalized === "all") {
        indices = pages.map((_, i) => i);
      } else {
        const r = parsePageRanges(resolveAllRange(normalized, pages.length), pages.length);
        if (!r.ok) {
          setError(r.error);
          setWorking(false);
          return;
        }
        indices = r.output;
      }
      // WCAG AA threshold = 4.5; AAA = 7. We use 4.5 by default; AAA only matters for the report.
      const threshold = validOpts.standard === "wcag-2.1-aaa" ? 7 : 4.5;
      const data = await scanDocument(doc, indices, threshold);
      const all = runAllChecks(data);
      const filtered = filterByLevel(all, validOpts.checkLevel);
      const compliance = computeAllCompliance(filtered, validOpts.standard);
      const summary = computeSummaryStats(filtered, data.pageCount);
      setResult({ results: filtered, summary, compliance, data });
      saveHistory({
        ts: Date.now(),
        fileName: file.name,
        pageCount: data.pageCount,
        standard: validOpts.standard,
        compliancePct: summary.compliancePct,
        criticalIssues: summary.criticalIssues,
      });
      setHistory(loadHistory());
      toast.success(`Audit complete — ${summary.compliancePct}% compliant, ${summary.criticalIssues} critical issue(s)`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong while running accessibility checks.");
    } finally {
      setWorking(false);
    }
  }

  const update = <K extends keyof typeof opts>(key: K, value: (typeof opts)[K]) =>
    setOpts((prev) => ({ ...prev, [key]: value }));

  const textReport = useMemo(
    () => result ? renderTextReport(result.results, result.summary, result.compliance) : "",
    [result],
  );
  const csvReport = useMemo(() => result ? renderCsvReport(result.results) : "", [result]);
  const jsonReport = useMemo(
    () => result ? renderJsonReport(result.results, result.summary, result.compliance) : "",
    [result],
  );
  const htmlReport = useMemo(
    () => result ? renderHtmlReport(result.results, result.summary, result.compliance) : "",
    [result],
  );
  const critical = useMemo(() => result ? criticalIssues(result.results) : [], [result]);
  const recs = useMemo(
    () => result && opts.includeRecommendations ? generateRecommendations(result.results) : [],
    [result, opts.includeRecommendations],
  );
  const cmp = useMemo(() => result ? compareStandards(result.compliance) : { best: null, worst: null }, [result]);

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
          <p className="mt-1 text-xs text-muted-foreground">Runs 10+ accessibility checks against WCAG, PDF/UA, and Section 508.</p>
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="a11y-standard">Standard</Label>
                <select
                  id="a11y-standard"
                  value={opts.standard}
                  onChange={(e) => update("standard", e.target.value as AccessibilityStandard)}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  {STANDARDS.map((s) => (
                    <option key={s} value={s}>{STANDARD_LABELS[s]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="a11y-level">Check level</Label>
                <select
                  id="a11y-level"
                  value={opts.checkLevel}
                  onChange={(e) => update("checkLevel", e.target.value as CheckLevel)}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  {CHECK_LEVELS.map((l) => (
                    <option key={l} value={l}>{CHECK_LEVEL_LABELS[l]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="a11y-range">Page range (e.g. 1-3, 5, 8-10)</Label>
                <Input
                  id="a11y-range"
                  value={opts.pageRange}
                  onChange={(e) => update("pageRange", e.target.value)}
                  placeholder="all"
                  className="h-9"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={opts.includeRecommendations}
                onChange={(e) => update("includeRecommendations", e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              Include best-practice recommendations
            </label>
          </CardContent>
        </Card>
      )}

      <ActionBar>
        <RunButton onClick={() => void run()} disabled={!file} loading={working} label="Run accessibility check" />
        <ClearButton onClick={reset} disabled={!file && !result && !error} label="Clear" />
      </ActionBar>

      {error && <ErrorBanner message={error} />}

      {result && (
        <>
          <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Audit complete</p>
                <p className="text-xs text-muted-foreground">
                  {result.summary.passed}/{result.summary.totalChecks} checks passed • {result.summary.criticalIssues} critical issue(s) • {result.summary.compliancePct}% compliance
                </p>
              </div>
              <Badge variant={result.summary.compliancePct >= 80 ? "default" : result.summary.compliancePct >= 50 ? "secondary" : "destructive"}>
                {result.summary.compliancePct}% compliant
              </Badge>
            </div>
          </div>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4" /> Compliance by standard
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {result.compliance.map((c) => (
                  <div key={c.standard} className="rounded border bg-background px-3 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{STANDARD_LABELS[c.standard]}</div>
                    <div className={`text-base font-semibold ${c.compliancePct >= 80 ? "text-emerald-600 dark:text-emerald-400" : c.compliancePct >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                      {c.compliancePct}%
                    </div>
                    <div className="text-[10px] text-muted-foreground">{c.passedChecks}/{c.totalChecks} checks</div>
                  </div>
                ))}
              </div>
              {cmp.best && cmp.worst && (
                <p className="text-xs text-muted-foreground pt-2">
                  Best: <strong>{STANDARD_LABELS[cmp.best.standard]}</strong> ({cmp.best.compliancePct}%) • Worst: <strong>{STANDARD_LABELS[cmp.worst.standard]}</strong> ({cmp.worst.compliancePct}%)
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ListChecks className="h-4 w-4" /> Check results ({result.results.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Passed" value={result.summary.passed} highlight="good" />
                <Stat label="Failed" value={result.summary.failed} highlight="bad" />
                <Stat label="Warnings" value={result.summary.warnings} />
                <Stat label="Info" value={result.summary.info} />
              </div>
              <div className="space-y-1 max-h-[400px] overflow-auto pt-2">
                {result.results.map((r) => (
                  <div key={r.id} className="rounded border bg-background px-3 py-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <Badge variant={r.passed ? "default" : r.severity === "error" ? "destructive" : r.severity === "warning" ? "secondary" : "outline"} className="text-[10px]">
                        {r.passed ? "PASS" : r.severity.toUpperCase()}
                      </Badge>
                      <span className="font-mono text-foreground">{r.id}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">{CATEGORY_LABELS[r.category]}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {r.message}
                    </div>
                    {r.detail && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">Detail: {r.detail}</div>
                    )}
                    {r.recommendation && (
                      <div className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">→ {r.recommendation}</div>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton getText={() => textReport} label="Copy report" />
                <DownloadButton getText={() => textReport} filename="accessibility-report.txt" mime="text/plain" label=".txt" />
                <DownloadButton getText={() => csvReport} filename="accessibility-report.csv" mime="text/csv" label=".csv" />
                <DownloadButton getText={() => jsonReport} filename="accessibility-report.json" mime="application/json" label=".json" />
                <DownloadButton getText={() => htmlReport} filename="accessibility-report.html" mime="text/html" label=".html" />
                <ShareButton getUrl={() => buildShareUrl(opts)} />
              </div>
            </CardContent>
          </Card>

          {critical.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" /> Critical issues (must-fix before publish)
                </h3>
                <div className="space-y-1 max-h-[240px] overflow-auto">
                  {critical.map((c) => (
                    <div key={c.id} className="rounded border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive" className="text-[10px]">ERROR</Badge>
                        <span className="font-mono text-foreground">{c.id}</span>
                        <span className="text-[10px] text-muted-foreground ml-auto">{CATEGORY_LABELS[c.category]}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{c.message}</div>
                      {c.recommendation && (
                        <div className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">→ {c.recommendation}</div>
                      )}
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
                  <Lightbulb className="h-4 w-4" /> Recommendations ({recs.length})
                </h3>
                <div className="space-y-1 max-h-[200px] overflow-auto">
                  {recs.map((r, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        <Badge variant={r.severity === "error" ? "destructive" : r.severity === "warning" ? "secondary" : "outline"} className="text-[10px]">
                          {r.severity.toUpperCase()}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{CATEGORY_LABELS[r.category]}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{r.message}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {result.summary.byPage.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4" /> Issues by page
                </h3>
                <div className="space-y-1 max-h-[160px] overflow-auto">
                  {result.summary.byPage.map((p) => (
                    <div key={p.pageNumber} className="rounded border bg-background px-3 py-1.5 text-xs flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {p.pageNumber === 0 ? "Document" : `Page ${p.pageNumber}`}
                      </Badge>
                      <span className="text-muted-foreground">{p.count} issue{p.count === 1 ? "" : "s"}</span>
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
          title="Ready to audit accessibility"
          hint="Choose a standard (WCAG AA/AAA, PDF/UA-1, Section 508, or all) and click 'Run accessibility check'. The tool scans the document catalog and each page's resources, then reports compliance, critical issues, and recommendations."
          icon={<Accessibility className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{STANDARD_LABELS[h.standard]}</Badge>
                  <Badge variant={h.compliancePct >= 80 ? "default" : h.compliancePct >= 50 ? "secondary" : "destructive"} className="mr-2">
                    {h.compliancePct}%
                  </Badge>
                  <span className="text-muted-foreground">{h.pageCount} pages • {h.criticalIssues} critical</span>
                  <span className="text-muted-foreground ml-2">· {h.fileName} · {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        <strong className="text-foreground">Privacy:</strong> All accessibility checks run 100% locally in your browser using JavaScript and pdf-lib. Your PDF never leaves your device. History is stored in localStorage on this device only.
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
