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
import { Download, FileUp, Trash2, Table, History, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import {
  ActionBar,
  ClearButton,
  CopyButton,
  EmptyState,
  ErrorBanner,
  RunButton,
  ShareButton,
} from "../../_shared";
import { formatBytes, downloadBytes } from "../_shared/download";
import { parsePageRanges } from "../_shared/page-ranges";
import {
  OUTPUT_FORMATS,
  FORMAT_LABELS,
  FORMAT_MIME,
  FORMAT_EXTENSIONS,
  DETECTION_METHODS,
  METHOD_LABELS,
  DEFAULT_OPTIONS,
  normalizePageRangeSpec,
  resolveAllRange,
  detectMultipleTables,
  computeSummaryStats,
  renderOutput,
  renderCsv,
  renderHtml,
  renderJson,
  buildXlsxPackage,
  getOutputFilename,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type TextPosition,
  type ExtractionResult,
  type DetectedTable,
  type ConvertOptions,
  type OutputFormat,
  type DetectionMethod,
  type HistoryEntry,
} from "./logic";

// ---------------------------------------------------------------------------
// PDF content-stream text+position extraction
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
  x: number;
  y: number;
  fontSize: number;
  bold?: boolean;
}

/**
 * Parse a PDF content stream and produce text items with their (x, y)
 * positions on the page. Tracks the text matrix via Tm, Td, TD, T*, ', " and
 * captures Tj/TJ text at the current position.
 */
function parsePdfContentStreamForPositionalItems(content: string): RawItem[] {
  const items: RawItem[] = [];
  let currentFontSize = 0;
  // Text matrix (translation only — we ignore skew/rotation for table detection)
  let tx = 0;
  let ty = 0;
  // Text line matrix (used by Td/TD which move relative to it)
  let lx = 0;
  let ly = 0;
  let leading = 0;
  let inText = false;
  // Track bold (basic heuristic: font name contains "Bold")
  let bold = false;

  const pushItem = (text: string, x: number, y: number) => {
    if (text.length === 0) return;
    items.push({ text, x, y, fontSize: currentFontSize, bold });
  };

  // Tokenize the content stream: numbers, strings (parens), hex strings, arrays,
  // names, operators.
  let i = 0;
  const len = content.length;
  // Stack of numbers + (text) tokens for TJ arrays
  const operandStack: (number | string)[] = [];
  // Track if we're inside a TJ array
  let inArray = false;

  const popNumber = (): number | undefined => {
    while (operandStack.length > 0) {
      const v = operandStack.pop();
      if (typeof v === "number") return v;
    }
    return undefined;
  };

  while (i < len) {
    const ch = content[i];

    // Skip whitespace
    if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n") {
      i++;
      continue;
    }
    // Comments
    if (ch === "%") {
      const nl = content.indexOf("\n", i);
      i = nl < 0 ? len : nl + 1;
      continue;
    }
    // Literal string (parens)
    if (ch === "(") {
      const r = consumeParenString(content, i);
      operandStack.push(r.text);
      i = r.end;
      continue;
    }
    // Hex string <...>
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
    // Array start
    if (ch === "[") {
      inArray = true;
      operandStack.length = 0;
      i++;
      continue;
    }
    // Array end
    if (ch === "]") {
      inArray = false;
      i++;
      continue;
    }
    // Name /xxx
    if (ch === "/") {
      let j = i + 1;
      while (j < len && /[^\s\[\]()<>\/%]/.test(content[j] ?? "")) j++;
      operandStack.push(content.slice(i, j)); // keep the leading slash
      i = j;
      continue;
    }
    // Number
    if (/[0-9.\-+]/.test(ch)) {
      let j = i + 1;
      while (j < len && /[0-9.\-+]/.test(content[j] ?? "")) j++;
      const numStr = content.slice(i, j);
      const num = Number(numStr);
      if (!Number.isNaN(num)) operandStack.push(num);
      i = j;
      continue;
    }
    // Operator: read until whitespace or delimiter
    let j = i;
    while (j < len && /[a-zA-Z*'"]/.test(content[j] ?? "")) j++;
    const op = content.slice(i, j);
    i = j;

    if (op === "BT") {
      inText = true;
      tx = 0; ty = 0; lx = 0; ly = 0; leading = 0;
      operandStack.length = 0;
      continue;
    }
    if (op === "ET") {
      inText = false;
      operandStack.length = 0;
      continue;
    }
    if (!inText) continue;

    if (op === "Tf") {
      // /font size Tf
      const size = popNumber();
      const nameTok = operandStack.find((o) => typeof o === "string") as string | undefined;
      if (typeof size === "number") currentFontSize = size;
      // Bold heuristic from font name
      if (typeof nameTok === "string") {
        bold = /Bold/i.test(nameTok);
      }
      operandStack.length = 0;
      continue;
    }
    if (op === "Tm") {
      // a b c d e f Tm — last two numbers are e (x) and f (y)
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
        lx = lx + tx2;
        ly = ly + ty2;
        tx = lx;
        ty = ly;
      }
      operandStack.length = 0;
      continue;
    }
    if (op === "TD") {
      const ty2 = popNumber();
      const tx2 = popNumber();
      if (typeof tx2 === "number" && typeof ty2 === "number") {
        leading = -ty2;
        lx = lx + tx2;
        ly = ly + ty2;
        tx = lx;
        ty = ly;
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
      lx = lx;
      ly = ly - leading;
      tx = lx;
      ty = ly;
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
      // operandStack contains strings (and numbers for kerning) in order
      for (const o of operandStack) {
        if (typeof o === "string") {
          pushItem(o, tx, ty);
          // Advance x by approximate text width
          tx += o.length * currentFontSize * 0.5;
        }
      }
      operandStack.length = 0;
      continue;
    }
    if (op === "'") {
      // Move to next line then show text
      lx = lx;
      ly = ly - leading;
      tx = lx;
      ty = ly;
      const s = operandStack.find((o) => typeof o === "string") as string | undefined;
      if (typeof s === "string") pushItem(s, tx, ty);
      operandStack.length = 0;
      continue;
    }
    if (op === '"') {
      // aw ac string " — set word and char spacing, move to next line, show
      const s = operandStack.find((o) => typeof o === "string") as string | undefined;
      lx = lx;
      ly = ly - leading;
      tx = lx;
      ty = ly;
      if (typeof s === "string") pushItem(s, tx, ty);
      operandStack.length = 0;
      continue;
    }
    // Unknown operator: clear operand stack
    operandStack.length = 0;
  }

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

/** Extract positional TextItems from a single PDF page. */
function extractItemsFromPage(
  page: { node: { Contents?: () => unknown } },
  pageNumber: number,
): TextPosition[] {
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
  const rawItems = parsePdfContentStreamForPositionalItems(text);
  // The PDF coordinate system has y growing up. For table detection we want
  // items sorted top-to-bottom (descending y). The logic.ts clustering does
  // this internally, so we pass y as-is.
  return rawItems.map((r) => ({
    text: r.text,
    x: r.x,
    y: r.y,
    fontSize: r.fontSize,
    pageNumber,
    bold: r.bold,
  }));
}

// ---------------------------------------------------------------------------
// React component
// ---------------------------------------------------------------------------

export default function PdfToExcelConverter() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; pageCount: number } | null>(null);
  const [opts, setOpts] = useState<ConvertOptions>(DEFAULT_OPTIONS);
  const [result, setResult] = useState<ExtractionResult | null>(null);
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
      const tables: DetectedTable[] = [];
      for (const idx of parsed.output) {
        const items = extractItemsFromPage(pdfPages[idx], idx + 1);
        const pageTables = detectMultipleTables(items, idx + 1, opts.detectionMethod, opts.includeHeaders);
        tables.push(...pageTables);
      }
      const built: ExtractionResult = {
        tables,
        detectionMethod: opts.detectionMethod,
        outputFormat: opts.outputFormat,
        includeHeaders: opts.includeHeaders,
      };
      setResult(built);
      const summary = computeSummaryStats(built);
      saveHistory({
        ts: Date.now(),
        fileName: file.name,
        pageCount: total,
        tableCount: summary.totalTables,
        cellCount: summary.totalCells,
        format: opts.outputFormat,
      });
      setHistory(loadHistory());
      toast.success(
        `Found ${summary.totalTables} table${summary.totalTables === 1 ? "" : "s"} • ${summary.totalCells} cells • quality ${summary.avgQuality}`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong while extracting tables.");
    } finally {
      setWorking(false);
    }
  }

  const summary = useMemo(() => result ? computeSummaryStats(result) : null, [result]);
  const renderedText = useMemo(() => {
    if (!result) return "";
    if (opts.outputFormat === "xlsx") {
      // For XLSX, show a preview of the underlying sheet XML (first 4000 chars)
      return renderOutput(result);
    }
    return renderOutput(result);
  }, [result, opts.outputFormat]);

  const update = <K extends keyof ConvertOptions>(key: K, value: ConvertOptions[K]) =>
    setOpts((prev) => ({ ...prev, [key]: value }));

  function handleDownload() {
    if (!result || !file) return;
    const filename = getOutputFilename(opts.outputFormat, file.name);
    if (opts.outputFormat === "xlsx") {
      const bytes = buildXlsxPackage(result);
      downloadBytes(bytes, filename, FORMAT_MIME["xlsx"]);
    } else {
      const text = opts.outputFormat === "csv"
        ? renderCsv(result)
        : opts.outputFormat === "html-table"
          ? renderHtml(result)
          : renderJson(result);
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
            Extract tables → XLSX / CSV / HTML / JSON.
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
              <Label htmlFor="p2e-range">Page range</Label>
              <Input
                id="p2e-range"
                value={opts.pageRange}
                onChange={(e) => update("pageRange", e.target.value)}
                placeholder="all or e.g. 1-5, 8, 10-12"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">Use "all" or specific pages. 1-based.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="p2e-method">Table detection method</Label>
                <select
                  id="p2e-method"
                  value={opts.detectionMethod}
                  onChange={(e) => update("detectionMethod", e.target.value as DetectionMethod)}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  {DETECTION_METHODS.map((m) => (
                    <option key={m} value={m}>{METHOD_LABELS[m]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p2e-format">Output format</Label>
                <select
                  id="p2e-format"
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
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none pt-1">
              <input
                type="checkbox"
                checked={opts.includeHeaders}
                onChange={(e) => update("includeHeaders", e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              Treat first row of each table as headers (bold / all-text heuristic)
            </label>
          </CardContent>
        </Card>
      )}

      <ActionBar>
        <RunButton onClick={() => void run()} disabled={!file} loading={working} label="Extract Tables" />
        <ClearButton onClick={reset} disabled={!file && !result && !error} label="Clear" />
      </ActionBar>

      {error && <ErrorBanner message={error} />}

      {summary && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4" /> Summary
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Tables found" value={summary.totalTables} highlight={summary.totalTables > 0 ? "good" : "bad"} />
              <Stat label="Pages with tables" value={summary.totalPages} />
              <Stat label="Total rows" value={summary.totalRows} />
              <Stat label="Total columns" value={summary.totalColumns} />
              <Stat label="Total cells" value={summary.totalCells} />
              <Stat label="Filled cells" value={summary.filledCells} />
              <Stat label="Empty cells" value={summary.emptyCells} />
              <Stat label="Avg quality" value={`${summary.avgQuality}/100`} highlight={summary.avgQuality >= 60 ? "good" : summary.avgQuality > 0 ? "bad" : undefined} />
              <Stat label="Max rows/table" value={summary.maxRowsInTable} />
              <Stat label="Max cols/table" value={summary.maxColumnsInTable} />
              <Stat label="Avg rows/table" value={summary.avgRowsPerTable} />
              <Stat label="Avg cols/table" value={summary.avgColumnsPerTable} />
            </div>
            {result && result.tables.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {result.tables.slice(0, 8).map((t, i) => (
                  <Badge key={i} variant="outline" className="text-[10px]">
                    T{i + 1} p{t.pageNumber} • {t.rows.length}×{t.rows[0]?.length ?? 0} • q{t.quality}
                    {t.hasHeader ? " • H" : ""}
                  </Badge>
                ))}
                {result.tables.length > 8 && (
                  <Badge variant="outline" className="text-[10px]">+{result.tables.length - 8} more</Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {result && result.tables.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Table className="h-4 w-4" />
                {opts.outputFormat === "xlsx" ? "Preview (first table)" : `${FORMAT_LABELS[opts.outputFormat]} output`}
              </h3>
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => opts.outputFormat === "csv"
                    ? renderCsv(result)
                    : opts.outputFormat === "html-table"
                      ? renderHtml(result)
                      : opts.outputFormat === "json"
                        ? renderJson(result)
                        : renderCsv(result)}
                  label="Copy"
                />
                <Button onClick={handleDownload} className="gap-1.5" size="sm">
                  <Download className="h-3.5 w-3.5" /> Download .{FORMAT_EXTENSIONS[opts.outputFormat]}
                </Button>
                <ShareButton getUrl={() => buildShareUrl(opts)} />
              </div>
            </div>
            {opts.outputFormat === "xlsx" ? (
              <div className="overflow-auto rounded border bg-background max-h-[400px]">
                <table className="w-full text-xs">
                  <tbody>
                    {result.tables[0].rows.map((row, ri) => (
                      <tr key={ri} className={ri === 0 && result.tables[0].hasHeader ? "bg-primary/10 font-semibold" : ""}>
                        {row.map((cell, ci) => (
                          <td key={ci} className="border px-2 py-1 align-top whitespace-nowrap">
                            {cell.text || <span className="text-muted-foreground">·</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <pre className="max-h-[400px] overflow-auto rounded border bg-muted/30 p-3 text-xs whitespace-pre-wrap font-mono">
                {renderedText || "(empty)"}
              </pre>
            )}
          </CardContent>
        </Card>
      )}

      {result && result.tables.length === 0 && (
        <EmptyState
          title="No tables found"
          hint="The selected pages may have no tabular structure, or the text might be scanned images. Try a different detection method, or include more pages."
          icon={<Table className="h-8 w-8" />}
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
                  <span className="font-medium">{h.fileName}</span>
                  <span className="text-muted-foreground ml-2">
                    {h.pageCount}p • {h.tableCount}T • {h.cellCount}C
                  </span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        <strong className="text-foreground">Privacy:</strong> Table extraction runs 100% locally —
        your PDF never leaves your device. The .xlsx is a minimal SpreadsheetML package built in-browser
        (no external libraries).
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
