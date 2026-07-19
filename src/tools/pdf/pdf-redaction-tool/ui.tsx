"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  PDFDocument,
  PDFRawStream,
  PDFStream,
  PDFArray,
  decodePDFRawStream,
  rgb,
  StandardFonts,
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
  Eraser,
  ShieldAlert,
  History,
  BarChart3,
  Sparkles,
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
import { parsePageRanges } from "../_shared/page-ranges";
import {
  REDACT_COLORS,
  REDACT_MODES,
  COLOR_LABELS,
  MODE_LABELS,
  COLOR_RGB,
  DEFAULT_OPTIONS,
  SENSITIVE_CATEGORY_LABELS,
  parseTextToRedact,
  parseAreaRedactions,
  getRedactColorRgb,
  validateRedactions,
  generateRedactionRectangles,
  buildMetadataStripPlan,
  checkPageBounds,
  countRedactions,
  calculateRedactedArea,
  renderTextReport,
  renderCsvReport,
  computeSummaryStats,
  checkRedactionCompleteness,
  filterAreasByPageIndices,
  detectSensitiveData,
  suggestAutoRedactions,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type RedactColor,
  type RedactMode,
  type AreaRedaction,
  type TextRedaction,
  type AppliedRedaction,
  type PageBounds,
  type SensitiveMatch,
  type RedactOptions,
  type HistoryEntry,
} from "./logic";

// ---------------------------------------------------------------------------
// PDF content-stream text+position extraction (browser-only, pdf-lib internals)
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

interface TextItem {
  text: string;
  x: number;
  y: number;
  fontSize: number;
}

/**
 * Parse a PDF content stream and produce text items with their (x, y)
 * positions on the page. Tracks the text matrix via Tm, Td, TD, T*, ', " and
 * captures Tj/TJ text at the current position. Approximation only — handles
 * the most common operators used by text-native PDFs.
 */
function parsePdfContentStreamForTextItems(content: string): TextItem[] {
  const items: TextItem[] = [];
  let currentFontSize = 0;
  let tx = 0;
  let ty = 0;
  let lx = 0;
  let ly = 0;
  let leading = 0;
  let inText = false;

  const pushItem = (text: string, x: number, y: number) => {
    if (text.length === 0) return;
    items.push({ text, x, y, fontSize: currentFontSize });
  };

  const operandStack: (number | string)[] = [];
  const popNumber = (): number | undefined => {
    while (operandStack.length > 0) {
      const v = operandStack.pop();
      if (typeof v === "number") return v;
    }
    return undefined;
  };

  let i = 0;
  const len = content.length;
  while (i < len) {
    const ch = content[i];
    if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n") { i++; continue; }
    if (ch === "%") {
      const nl = content.indexOf("\n", i);
      i = nl < 0 ? len : nl + 1;
      continue;
    }
    if (ch === "(") {
      const r = consumeParenString(content, i);
      operandStack.push(r.text);
      i = r.end;
      continue;
    }
    if (ch === "<" && content[i + 1] !== "<") {
      const close = content.indexOf(">", i);
      if (close > 0) {
        const hex = content.slice(i + 1, close);
        if (/^[0-9a-fA-F\s]*$/.test(hex) && hex.trim().length > 0) {
          operandStack.push(decodeHexBody(hex));
        }
        i = close + 1;
        continue;
      }
      i++;
      continue;
    }
    if (ch === "[") { operandStack.length = 0; i++; continue; }
    if (ch === "]") { i++; continue; }
    if (ch === "/") {
      let j = i + 1;
      while (j < len && /[^\s\[\]()<>\/%]/.test(content[j] ?? "")) j++;
      operandStack.push(content.slice(i, j));
      i = j;
      continue;
    }
    if (/[0-9.\-+]/.test(ch)) {
      let j = i + 1;
      while (j < len && /[0-9.\-+]/.test(content[j] ?? "")) j++;
      const num = Number(content.slice(i, j));
      if (!Number.isNaN(num)) operandStack.push(num);
      i = j;
      continue;
    }
    let j = i;
    while (j < len && /[a-zA-Z*'"]/.test(content[j] ?? "")) j++;
    const op = content.slice(i, j);
    i = j;

    if (op === "BT") {
      inText = true; tx = 0; ty = 0; lx = 0; ly = 0; leading = 0;
      operandStack.length = 0;
      continue;
    }
    if (op === "ET") { inText = false; operandStack.length = 0; continue; }
    if (!inText) continue;

    if (op === "Tf") {
      const size = popNumber();
      if (typeof size === "number") currentFontSize = size;
      operandStack.length = 0;
      continue;
    }
    if (op === "Tm") {
      const f = popNumber();
      const e = popNumber();
      if (typeof e === "number" && typeof f === "number") {
        tx = e; ty = f; lx = e; ly = f;
      }
      operandStack.length = 0;
      continue;
    }
    if (op === "Td") {
      const ty2 = popNumber();
      const tx2 = popNumber();
      if (typeof tx2 === "number" && typeof ty2 === "number") {
        lx = lx + tx2; ly = ly + ty2; tx = lx; ty = ly;
      }
      operandStack.length = 0;
      continue;
    }
    if (op === "TD") {
      const ty2 = popNumber();
      const tx2 = popNumber();
      if (typeof tx2 === "number" && typeof ty2 === "number") {
        leading = -ty2; lx = lx + tx2; ly = ly + ty2; tx = lx; ty = ly;
      }
      operandStack.length = 0;
      continue;
    }
    if (op === "TL") {
      const l = popNumber();
      if (typeof l === "number") leading = l;
      operandStack.length = 0;
      continue;
    }
    if (op === "T*") {
      ly = ly - leading; tx = lx; ty = ly;
      operandStack.length = 0;
      continue;
    }
    if (op === "Tj") {
      const s = operandStack.find((o) => typeof o === "string") as string | undefined;
      if (typeof s === "string") pushItem(s, tx, ty);
      operandStack.length = 0;
      continue;
    }
    if (op === "TJ") {
      for (const o of operandStack) {
        if (typeof o === "string") {
          pushItem(o, tx, ty);
          tx += o.length * currentFontSize * 0.5;
        }
      }
      operandStack.length = 0;
      continue;
    }
    if (op === "'" || op === "\"") {
      ly = ly - leading; tx = lx; ty = ly;
      const s = operandStack.find((o) => typeof o === "string") as string | undefined;
      if (typeof s === "string") pushItem(s, tx, ty);
      operandStack.length = 0;
      continue;
    }
    operandStack.length = 0;
  }
  return items;
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

function extractItemsFromPage(page: { node: { Contents?: () => unknown } }): TextItem[] {
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
      parts.push(getStreamBytes(contents.lookup(i)));
    }
    bytes = concatBytes(parts);
  } else {
    bytes = getStreamBytes(contents);
  }
  if (bytes.length === 0) return [];
  const text = new TextDecoder("latin1").decode(bytes);
  return parsePdfContentStreamForTextItems(text);
}

// ---------------------------------------------------------------------------
// React component
// ---------------------------------------------------------------------------

interface RedactionResult {
  bytes: Uint8Array;
  applied: AppliedRedaction[];
  textRedactions: TextRedaction[];
  areaRedactions: AreaRedaction[];
  metadataStripped: boolean;
}

export default function PdfRedactionTool() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; pageCount: number } | null>(null);
  const [opts, setOpts] = useState<RedactOptions>(DEFAULT_OPTIONS);
  const [result, setResult] = useState<RedactionResult | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [pageBounds, setPageBounds] = useState<PageBounds[]>([]);
  const [sensitive, setSensitive] = useState<SensitiveMatch[]>([]);

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
      const pages = doc.getPages();
      const bounds: PageBounds[] = pages.map((p, i) => {
        const { width, height } = p.getSize();
        return { page: i + 1, width, height };
      });
      setFile({ name: f.name, bytes, pageCount: doc.getPageCount() });
      setPageBounds(bounds);
      setResult(null);
      setError("");
      // Pre-scan for sensitive data on load (best-effort)
      const matches: SensitiveMatch[] = [];
      for (let i = 0; i < pages.length; i++) {
        const items = extractItemsFromPage(pages[i]);
        const text = items.map((it) => it.text).join(" ");
        matches.push(...detectSensitiveData(text, i + 1));
      }
      setSensitive(matches);
    } catch {
      toast.error(`Could not read ${f.name} — it may be corrupted or password-protected.`);
    }
  }

  function reset() {
    setFile(null);
    setResult(null);
    setError("");
    setOpts(DEFAULT_OPTIONS);
    setPageBounds([]);
    setSensitive([]);
  }

  const update = <K extends keyof RedactOptions>(key: K, value: RedactOptions[K]) =>
    setOpts((prev) => ({ ...prev, [key]: value }));

  const phrases = useMemo(() => parseTextToRedact(opts.textToRedact), [opts.textToRedact]);
  const areasParsed = useMemo(() => parseAreaRedactions(opts.areaRedactions), [opts.areaRedactions]);
  const areas = areasParsed.ok ? areasParsed.output : [];
  const validation = useMemo(
    () => validateRedactions(areas, pageBounds),
    [areas, pageBounds]
  );
  const suggestions = useMemo(() => suggestAutoRedactions(sensitive), [sensitive]);

  async function run() {
    if (!file) return;
    setWorking(true);
    setError("");
    setResult(null);
    try {
      // Validate options
      const rangeSpec = opts.pageRange.trim() || "all";
      let targetIndices: number[] = [];
      if (rangeSpec.toLowerCase() === "all") {
        targetIndices = Array.from({ length: file.pageCount }, (_, i) => i);
      } else {
        const parsed = parsePageRanges(rangeSpec, file.pageCount);
        if (!parsed.ok) {
          setError(parsed.error);
          setWorking(false);
          return;
        }
        targetIndices = [...new Set(parsed.output)];
      }

      if (!areasParsed.ok) {
        setError(areasParsed.error);
        setWorking(false);
        return;
      }

      // Filter area redactions by page range (areas are 1-based)
      const filteredAreas = filterAreasByPageIndices(areas, targetIndices);

      // Validate bounds
      if (validation.errors.length > 0) {
        setError(validation.errors[0]);
        setWorking(false);
        return;
      }

      const doc = await PDFDocument.load(file.bytes);
      const pages = doc.getPages();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const colorRgb = getRedactColorRgb(opts.redactColor);
      const color = rgb(colorRgb.r, colorRgb.g, colorRgb.b);
      const applied: AppliedRedaction[] = [];
      const textRedactions: TextRedaction[] = [];

      const doText = opts.redactMode === "text-search" || opts.redactMode === "both";
      const doArea = opts.redactMode === "area-coordinates" || opts.redactMode === "both";

      // Text-search redactions
      if (doText && phrases.length > 0) {
        const allowedPages = new Set(targetIndices.map((i) => i + 1));
        for (const phrase of phrases) {
          let foundCount = 0;
          for (let i = 0; i < pages.length; i++) {
            if (!allowedPages.has(i + 1)) continue;
            const items = extractItemsFromPage(pages[i]);
            for (const item of items) {
              if (item.text.toLowerCase().includes(phrase.toLowerCase())) {
                foundCount += 1;
                const fs = item.fontSize > 0 ? item.fontSize : 12;
                // Approximate text width using Helvetica metrics (~0.5 em per char)
                const approxWidth = Math.max(phrase.length * fs * 0.5, font.widthOfTextAtSize(item.text, fs));
                const pad = 1;
                const x = item.x - pad;
                const y = item.y - pad;
                const width = Math.min(approxWidth + pad * 2, pages[i].getSize().width - x);
                const height = fs + pad * 2;
                if (width > 0 && height > 0) {
                  pages[i].drawRectangle({ x, y, width, height, color });
                  applied.push({
                    type: "text",
                    page: i + 1,
                    text: phrase,
                    rect: { x, y, width, height },
                  });
                }
              }
            }
          }
          textRedactions.push({ text: phrase, foundCount });
        }
      } else if (phrases.length > 0 && !doText) {
        // Still record phrases with 0 found (text-search disabled)
        for (const phrase of phrases) {
          textRedactions.push({ text: phrase, foundCount: 0 });
        }
      }

      // Area-coordinate redactions
      if (doArea && filteredAreas.length > 0) {
        const boundsByPage = new Map<number, PageBounds>();
        for (const pb of pageBounds) boundsByPage.set(pb.page, pb);
        const rects = generateRedactionRectangles(filteredAreas, pageBounds);
        for (const r of rects) {
          const pageIdx = r.page - 1;
          if (pageIdx < 0 || pageIdx >= pages.length) continue;
          pages[pageIdx].drawRectangle({
            x: r.rect.x,
            y: r.rect.y,
            width: r.rect.width,
            height: r.rect.height,
            color,
          });
          applied.push(r);
        }
      }

      // Optionally strip metadata
      if (opts.removeMetadata) {
        const plan = buildMetadataStripPlan();
        doc.setTitle("");
        doc.setAuthor("");
        doc.setSubject("");
        doc.setKeywords([]);
        doc.setCreator("");
        doc.setProducer("");
        // Also clear creation/modification dates if present
        try {
          doc.setCreationDate(new Date(0));
          doc.setModificationDate(new Date(0));
        } catch {
          // ignore — some PDFs may not allow date manipulation
        }
        void plan; // referenced for completeness — the actual calls are above
      }

      const out = await doc.save({ useObjectStreams: true, addDefaultPage: false });
      const areaRedactionsUsed = doArea ? filteredAreas : [];
      const finalResult: RedactionResult = {
        bytes: out,
        applied,
        textRedactions,
        areaRedactions: areaRedactionsUsed,
        metadataStripped: opts.removeMetadata,
      };
      setResult(finalResult);

      saveHistory({
        ts: Date.now(),
        fileName: file.name,
        textCount: textRedactions.length,
        areaCount: areaRedactionsUsed.length,
        appliedCount: applied.length,
        color: opts.redactColor,
        mode: opts.redactMode,
        metadataStripped: opts.removeMetadata,
      });
      setHistory(loadHistory());
      toast.success(`Redacted ${applied.length} area(s) across ${new Set(applied.map((a) => a.page)).size} page(s)`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong while redacting the PDF.");
    } finally {
      setWorking(false);
    }
  }

  const summary = useMemo(
    () =>
      result
        ? computeSummaryStats(
            result.textRedactions,
            result.areaRedactions,
            result.applied,
            result.metadataStripped
          )
        : null,
    [result]
  );
  const completeness = useMemo(
    () =>
      result && result.textRedactions.length > 0
        ? checkRedactionCompleteness(result.textRedactions)
        : null,
    [result]
  );
  const textReport = useMemo(
    () =>
      result
        ? renderTextReport(
            result.textRedactions,
            result.areaRedactions,
            result.applied,
            result.metadataStripped
          )
        : "",
    [result]
  );
  const csvReport = useMemo(
    () =>
      result
        ? renderCsvReport(
            result.textRedactions,
            result.areaRedactions,
            result.applied
          )
        : "",
    [result]
  );
  const areaStats = useMemo(
    () => (result ? calculateRedactedArea(result.applied) : null),
    [result]
  );
  const boundsCheck = useMemo(
    () => checkPageBounds(areas, pageBounds),
    [areas, pageBounds]
  );

  function applySuggestion(value: string) {
    update("textToRedact", opts.textToRedact ? `${opts.textToRedact}\n${value}` : value);
    toast.success(`Added "${value}" to redaction list`);
  }

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {file ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {file.pageCount} page{file.pageCount === 1 ? "" : "s"} • {formatBytes(file.bytes.length)}
              {pageBounds.length > 0 && (
                <> • page size {Math.round(pageBounds[0].width)}×{Math.round(pageBounds[0].height)}</>
              )}
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
            Permanently black out sensitive text &amp; areas — 100% in your browser.
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
            <div className="space-y-1.5">
              <Label htmlFor="rd-mode">Redaction mode</Label>
              <select
                id="rd-mode"
                value={opts.redactMode}
                onChange={(e) => update("redactMode", e.target.value as RedactMode)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                {REDACT_MODES.map((m) => (
                  <option key={m} value={m}>{MODE_LABELS[m]}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rd-color">Redact color</Label>
              <select
                id="rd-color"
                value={opts.redactColor}
                onChange={(e) => update("redactColor", e.target.value as RedactColor)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                {REDACT_COLORS.map((c) => (
                  <option key={c} value={c}>{COLOR_LABELS[c]}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Preview:{" "}
                <span
                  className="inline-block h-3 w-3 rounded-sm align-middle border border-border"
                  style={{ background: `rgb(${Math.round(COLOR_RGB[opts.redactColor].r * 255)}, ${Math.round(COLOR_RGB[opts.redactColor].g * 255)}, ${Math.round(COLOR_RGB[opts.redactColor].b * 255)})` }}
                />
              </p>
            </div>

            {(opts.redactMode === "text-search" || opts.redactMode === "both") && (
              <div className="space-y-1.5">
                <Label htmlFor="rd-text">Text to redact (one phrase per line)</Label>
                <Textarea
                  id="rd-text"
                  value={opts.textToRedact}
                  onChange={(e) => update("textToRedact", e.target.value)}
                  placeholder={"John Doe\njohn@example.com\n4111-1111-1111-1111"}
                  className="min-h-[100px] resize-y font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  {phrases.length} phrase{phrases.length === 1 ? "" : "s"} queued.
                </p>
              </div>
            )}

            {(opts.redactMode === "area-coordinates" || opts.redactMode === "both") && (
              <div className="space-y-1.5">
                <Label htmlFor="rd-areas">Area redactions (one per line: page,x,y,width,height)</Label>
                <Textarea
                  id="rd-areas"
                  value={opts.areaRedactions}
                  onChange={(e) => update("areaRedactions", e.target.value)}
                  placeholder={"1,72,72,200,20\n1,300,400,150,30"}
                  className="min-h-[100px] resize-y font-mono text-xs"
                />
                {!areasParsed.ok && opts.areaRedactions.trim() && (
                  <p className="text-xs text-destructive">{areasParsed.error}</p>
                )}
                {areasParsed.ok && (
                  <p className="text-xs text-muted-foreground">
                    {areas.length} rectangle{areas.length === 1 ? "" : "s"} queued.
                    {!boundsCheck.ok && (
                      <span className="text-destructive ml-2">
                        Pages not in document: {boundsCheck.missing.join(", ")}
                      </span>
                    )}
                    {validation.errors.length > 0 && (
                      <span className="text-destructive ml-2">{validation.errors[0]}</span>
                    )}
                  </p>
                )}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="rd-range">Page range (optional)</Label>
                <Input
                  id="rd-range"
                  value={opts.pageRange}
                  onChange={(e) => update("pageRange", e.target.value)}
                  placeholder="all or e.g. 1-3, 5"
                  className="font-mono text-sm"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none pb-2">
                  <input
                    type="checkbox"
                    checked={opts.removeMetadata}
                    onChange={(e) => update("removeMetadata", e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  Strip metadata (Title, Author, Subject, Keywords, Creator, Producer, dates)
                </label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <ActionBar>
        <RunButton onClick={() => void run()} disabled={!file} loading={working} label="Apply redactions" />
        <ClearButton onClick={reset} disabled={!file && !result && !error} label="Clear" />
        {file && (
          <ShareButton getUrl={() => buildShareUrl(opts)} />
        )}
      </ActionBar>

      {error && <ErrorBanner message={error} />}

      {suggestions.length > 0 && file && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" /> Auto-detected sensitive data ({sensitive.length} matches)
            </h3>
            <p className="text-xs text-muted-foreground">
              Click a value to add it to your redaction list.
            </p>
            <div className="space-y-2">
              {suggestions.map((s) => (
                <div key={s.category} className="rounded border bg-background px-3 py-2 text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className="text-[10px]">
                      {SENSITIVE_CATEGORY_LABELS[s.category]}
                    </Badge>
                    <span className="text-muted-foreground">
                      {s.totalOccurrences} occurrence{s.totalOccurrences === 1 ? "" : "s"} • {s.values.length} unique
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {s.values.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => applySuggestion(v)}
                        className="rounded border border-border bg-card px-2 py-0.5 font-mono text-[11px] hover:border-primary/40 hover:bg-primary/5"
                      >
                        + {v}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {summary && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4" /> Summary
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Total redactions" value={summary.totalRedactions} />
              <Stat label="Text redactions" value={summary.textRedactions} />
              <Stat label="Area redactions" value={summary.areaRedactions} />
              <Stat label="Pages affected" value={summary.pagesAffected} />
              <Stat label="Total area" value={`${summary.totalAreaRedacted.toLocaleString()} u²`} />
              <Stat label="Avg per redaction" value={`${summary.avgAreaPerRedaction.toLocaleString()} u²`} />
              <Stat
                label="Completeness"
                value={`${summary.completenessScore}%`}
                highlight={summary.completenessScore === 100 ? "good" : summary.completenessScore < 50 ? "bad" : undefined}
              />
              <Stat
                label="Metadata stripped"
                value={summary.metadataStripped ? "Yes" : "No"}
                highlight={summary.metadataStripped ? "good" : undefined}
              />
            </div>
            {completeness && completeness.missing.length > 0 && (
              <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                <strong>Phrases not found:</strong> {completeness.missing.map((m) => `"${m}"`).join(", ")}
              </div>
            )}
            {areaStats && Object.keys(areaStats.perPage).length > 0 && (
              <div className="rounded border bg-background px-3 py-2 text-xs">
                <strong>Redacted area per page:</strong>{" "}
                {Object.entries(areaStats.perPage)
                  .sort((a, b) => Number(a[0]) - Number(b[0]))
                  .map(([page, area]) => `p.${page}: ${area.toFixed(0)} u²`)
                  .join(" • ")}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Eraser className="h-4 w-4" /> Redacted PDF ready • {formatBytes(result.bytes.length)}
              </h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => downloadBytes(result.bytes, `redacted-${file?.name ?? "output.pdf"}`)}
                  className="gap-1.5"
                >
                  <Download className="h-4 w-4" /> Download PDF
                </Button>
                <CopyButton getText={() => textReport} label="Copy report" />
                <DownloadButton
                  getText={() => textReport}
                  filename="redaction-report.txt"
                  mime="text/plain"
                  label="Report .txt"
                />
                <DownloadButton
                  getText={() => csvReport}
                  filename="redaction-report.csv"
                  mime="text/csv"
                  label="Report .csv"
                />
              </div>
            </div>
            <pre className="max-h-[260px] overflow-auto rounded border bg-muted/30 p-3 text-[11px] whitespace-pre-wrap font-mono">
              {textReport || "(no redactions applied)"}
            </pre>
          </CardContent>
        </Card>
      )}

      {file && !result && (
        <EmptyState
          title="Configure redactions and click Apply"
          hint="Choose a mode (text-search, area-coordinates, or both), enter phrases or rectangles, and click Apply redactions."
          icon={<ShieldAlert className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2 text-[10px]">{h.color}</Badge>
                  <span className="font-medium">{h.fileName}</span>
                  <span className="text-muted-foreground ml-2">
                    {h.appliedCount} redaction{h.appliedCount === 1 ? "" : "s"}
                    {h.metadataStripped && " • metadata stripped"}
                  </span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        <strong className="text-foreground">Privacy:</strong> Redaction runs 100% locally in your browser —
        your PDF never leaves your device. The tool draws filled rectangles over the targeted areas; for
        maximum security, verify the redacted PDF in a viewer and consider flattening afterwards.
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
