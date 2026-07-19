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
import { Download, FileUp, Trash2, FileType, History, BarChart3 } from "lucide-react";
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
  OUTPUT_FORMATS,
  FORMAT_LABELS,
  FORMAT_MIME,
  FORMAT_EXTENSIONS,
  DEFAULT_OPTIONS,
  normalizePageRangeSpec,
  resolveAllRange,
  analyzeFontSizes,
  detectParagraphs,
  analyzeTextStructure,
  computeSummaryStats,
  renderOutput,
  renderPlainText,
  renderHtml,
  renderMarkdown,
  generateDocumentXml,
  buildDocxPackage,
  getOutputFilename,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type TextItem,
  type Paragraph,
  type PageBlock,
  type DocumentStructure,
  type ConvertOptions,
  type OutputFormat,
  type HistoryEntry,
} from "./logic";

// ---------------------------------------------------------------------------
// PDF content-stream text extraction with font-size tracking
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

/**
 * Parse a PDF content stream and produce a list of text items with the
 * currently-set font size. Handles Tj, TJ, ', " operators and tracks
 * font size from Tf. Line breaks (T*, Td-with-negative-Y, ', ") split items.
 */
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
      // Td moves position; if Y is negative, it's a new line
      const before = content.slice(Math.max(0, i - 40), i);
      const nums = before.match(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*$/);
      if (nums) {
        const y = parseFloat(nums[2]);
        if (y < -0.5) flush();
      }
      i += 2;
    } else if (ch === "T" && content[i + 1] === "D") {
      // TD — same as Td but also sets leading
      const before = content.slice(Math.max(0, i - 40), i);
      const nums = before.match(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*$/);
      if (nums) {
        const y = parseFloat(nums[2]);
        if (y < -0.5) flush();
      }
      i += 2;
    } else if (ch === "T" && content[i + 1] === "m") {
      // Tm sets the text matrix — usually a new line
      flush();
      i += 2;
    } else if (ch === "T" && content[i + 1] === "f") {
      // Tf sets font and size — capture the size (last number before Tf)
      const before = content.slice(Math.max(0, i - 30), i);
      const m = before.match(/(-?\d+(?:\.\d+)?)\s*$/);
      if (m) {
        currentFontSize = parseFloat(m[1]);
      }
      i += 2;
    } else if (ch === "E" && content[i + 1] === "T") {
      // ET — end text object
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
  // Convert RawItem → TextItem (add pageNumber)
  return rawItems.map((r) => ({
    text: r.text,
    fontSize: r.fontSize,
    pageNumber,
  }));
}

// ---------------------------------------------------------------------------
// React component
// ---------------------------------------------------------------------------

export default function PdfToWordConverter() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; pageCount: number } | null>(null);
  const [opts, setOpts] = useState<ConvertOptions>(DEFAULT_OPTIONS);
  const [structure, setStructure] = useState<DocumentStructure | null>(null);
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
      setStructure(null);
      setError("");
    } catch {
      toast.error(`Could not read ${f.name} — it may be corrupted or password-protected.`);
    }
  }

  function reset() {
    setFile(null);
    setStructure(null);
    setError("");
    setOpts(DEFAULT_OPTIONS);
  }

  async function run() {
    if (!file) return;
    setWorking(true);
    setError("");
    setStructure(null);
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
      const allItems: TextItem[] = [];
      const itemsByPage: Map<number, TextItem[]> = new Map();
      for (const idx of parsed.output) {
        const items = extractItemsFromPage(pdfPages[idx], idx + 1);
        itemsByPage.set(idx + 1, items);
        allItems.push(...items);
      }
      const { bodyFontSize, headingFontSizes } = analyzeFontSizes(allItems);
      const pages: PageBlock[] = [];
      for (const [pageNumber, items] of itemsByPage) {
        const paragraphs: Paragraph[] = detectParagraphs(items, bodyFontSize, headingFontSizes);
        if (paragraphs.length > 0) {
          pages.push({ pageNumber, paragraphs });
        }
      }
      const built: DocumentStructure = { pages, bodyFontSize, headingFontSizes };
      setStructure(built);
      const summary = computeSummaryStats(built);
      saveHistory({
        ts: Date.now(),
        fileName: file.name,
        pageCount: total,
        paragraphCount: summary.totalParagraphs,
        headingCount: summary.totalHeadings,
        format: opts.outputFormat,
      });
      setHistory(loadHistory());
      toast.success(`Converted ${summary.totalPages} pages • ${summary.totalParagraphs} paragraphs • ${summary.totalHeadings} headings`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong while converting.");
    } finally {
      setWorking(false);
    }
  }

  const summary = useMemo(() => structure ? computeSummaryStats(structure) : null, [structure]);
  const textStructure = useMemo(() => {
    if (!structure) return null;
    const allText = structure.pages
      .flatMap((p) => p.paragraphs.map((para) => para.text))
      .join("\n\n");
    return analyzeTextStructure(allText);
  }, [structure]);
  const renderedText = useMemo(() => {
    if (!structure) return "";
    if (opts.outputFormat === "docx") {
      // For DOCX, show a preview of the document.xml
      return generateDocumentXml(structure, opts);
    }
    return renderOutput(structure, opts);
  }, [structure, opts]);

  const update = <K extends keyof ConvertOptions>(key: K, value: ConvertOptions[K]) =>
    setOpts((prev) => ({ ...prev, [key]: value }));

  function handleDownload() {
    if (!structure || !file) return;
    const filename = getOutputFilename(opts.outputFormat, file.name);
    if (opts.outputFormat === "docx") {
      const bytes = buildDocxPackage(structure, opts);
      downloadBytes(bytes, filename, FORMAT_MIME["docx"]);
    } else {
      const text = opts.outputFormat === "html"
        ? renderHtml(structure, opts)
        : opts.outputFormat === "markdown"
          ? renderMarkdown(structure, opts)
          : renderPlainText(structure, opts);
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
            Extract text & structure → DOCX / HTML / Markdown / Text.
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
              <Label htmlFor="p2w-range">Page range</Label>
              <Input
                id="p2w-range"
                value={opts.pageRange}
                onChange={(e) => update("pageRange", e.target.value)}
                placeholder="all or e.g. 1-5, 8, 10-12"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">Use "all" or specific pages. 1-based.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p2w-format">Output format</Label>
              <select
                id="p2w-format"
                value={opts.outputFormat}
                onChange={(e) => update("outputFormat", e.target.value as OutputFormat)}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                {OUTPUT_FORMATS.map((f) => (
                  <option key={f} value={f}>{FORMAT_LABELS[f]}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-4 pt-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={opts.includePageBreaks}
                  onChange={(e) => update("includePageBreaks", e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Include page breaks
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={opts.preserveHeadings}
                  onChange={(e) => update("preserveHeadings", e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Preserve headings (detect by font size)
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      <ActionBar>
        <RunButton onClick={() => void run()} disabled={!file} loading={working} label="Convert PDF" />
        <ClearButton onClick={reset} disabled={!file && !structure && !error} label="Clear" />
      </ActionBar>

      {error && <ErrorBanner message={error} />}

      {summary && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4" /> Summary
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Pages converted" value={summary.totalPages} />
              <Stat label="Paragraphs" value={summary.totalParagraphs} />
              <Stat label="Headings" value={summary.totalHeadings} highlight={summary.totalHeadings > 0 ? "good" : undefined} />
              <Stat label="Total words" value={summary.totalWords.toLocaleString()} />
              <Stat label="Avg words/page" value={summary.avgWordsPerPage.toLocaleString()} />
              <Stat label="Total chars" value={summary.totalChars.toLocaleString()} />
              <Stat label="Body font size" value={structure ? `${structure.bodyFontSize}pt` : "-"} />
              <Stat label="Heading sizes" value={structure ? structure.headingFontSizes.length : 0} />
            </div>
            {textStructure && (
              <div className="text-xs text-muted-foreground pt-1">
                <Badge variant="outline" className="text-[10px] mr-2">{textStructure.sentences} sentences</Badge>
                {structure && structure.headingFontSizes.length > 0 && (
                  <Badge variant="outline" className="text-[10px] mr-2">
                    sizes: {structure.headingFontSizes.join(", ")}pt
                  </Badge>
                )}
                <Badge variant="outline" className="text-[10px]">paragraphs: {textStructure.paragraphs}</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {structure && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FileType className="h-4 w-4" /> {opts.outputFormat === "docx" ? "DOCX preview (document.xml)" : `${FORMAT_LABELS[opts.outputFormat]} output`}
              </h3>
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => renderedText} label="Copy" />
                <Button onClick={handleDownload} className="gap-1.5" size="sm">
                  <Download className="h-3.5 w-3.5" /> Download .{FORMAT_EXTENSIONS[opts.outputFormat]}
                </Button>
                <ShareButton getUrl={() => buildShareUrl(opts)} />
              </div>
            </div>
            <pre className="max-h-[400px] overflow-auto rounded border bg-muted/30 p-3 text-xs whitespace-pre-wrap font-mono">
              {renderedText || "(empty)"}
            </pre>
          </CardContent>
        </Card>
      )}

      {structure && structure.pages.length === 0 && (
        <EmptyState
          title="No text extracted"
          hint="The selected pages may be scanned images. This tool only extracts the embedded text layer."
          icon={<FileType className="h-8 w-8" />}
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
                    {h.pageCount}p • {h.paragraphCount}¶ • {h.headingCount}H
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
        The .docx is a minimal OOXML package built in-browser (no external libraries).
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
