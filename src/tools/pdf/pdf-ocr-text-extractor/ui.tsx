"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  PDFDocument,
  PDFRawStream,
  PDFStream,
  PDFArray,
  PDFContentStream,
  decodePDFRawStream,
} from "pdf-lib";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, FileUp, Trash2, FileText, Search, History, BarChart3, Languages, Clock } from "lucide-react";
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
import { parsePageRanges } from "../_shared/page-ranges";
import {
  OUTPUT_FORMATS,
  FORMAT_LABELS,
  FORMAT_MIME,
  DEFAULT_OPTIONS,
  normalizePageRangeSpec,
  resolveAllRange,
  computeTextStats,
  computeSummaryStats,
  renderOutput,
  getOutputFilename,
  searchText,
  analyzeKeywords,
  estimateReadingTime,
  detectLanguage,
  filterEmptyPages,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ExtractedPage,
  type ExtractOptions,
  type OutputFormat,
  type HistoryEntry,
} from "./logic";

// ---------------------------------------------------------------------------
// PDF content-stream text extraction (browser-only, uses pdf-lib internals)
// ---------------------------------------------------------------------------

/** Decode escape sequences in a PDF literal string body (the part between parens). */
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

/** Consume a (...) literal string starting at index `start`. Returns text and end index. */
function consumeParenString(content: string, start: number): { text: string; end: number } {
  // content[start] === '('
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

/**
 * Naive PDF content-stream text extractor. Recognises the common
 * text-showing operators (Tj, TJ, ', ") and inserts line breaks for
 * T* / ' / " / Td-with-negative-Y. Handles WinAnsi / standard font
 * encoded literal strings.
 */
function parsePdfContentStream(content: string): string {
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

/** Read all bytes from a decoded StreamType. */
function readAllDecoded(stream: ReturnType<typeof decodePDFRawStream>): Uint8Array {
  // StreamType.decode() returns the fully decoded bytes
  return stream.decode();
}

/** Get the raw bytes of a content stream object, decoding if necessary. */
function getStreamBytes(stream: unknown): Uint8Array {
  if (!stream) return new Uint8Array(0);
  try {
    if (stream instanceof PDFRawStream) {
      return readAllDecoded(decodePDFRawStream(stream));
    }
    if (stream instanceof PDFContentStream) {
      // PDFContentStream wraps an underlying stream
      // getUnencodedContents is private but getContents exists on the underlying
      // fall through to the generic PDFStream branch
    }
    if (stream instanceof PDFStream) {
      return stream.getContents();
    }
  } catch {
    // ignore — return empty
  }
  return new Uint8Array(0);
}

/** Concatenate multiple Uint8Arrays into one. */
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

/** Extract text from a single PDF page's content stream(s). */
function extractTextFromPage(page: { node: { Contents?: () => unknown } }): string {
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
      const item = contents.lookup(i);
      parts.push(getStreamBytes(item));
    }
    bytes = concatBytes(parts);
  } else {
    bytes = getStreamBytes(contents);
  }
  if (bytes.length === 0) return "";
  const text = new TextDecoder("latin1").decode(bytes);
  return parsePdfContentStream(text);
}

// ---------------------------------------------------------------------------
// React component
// ---------------------------------------------------------------------------

export default function PdfOcrTextExtractor() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; pageCount: number } | null>(null);
  const [opts, setOpts] = useState<ExtractOptions>(DEFAULT_OPTIONS);
  const [pages, setPages] = useState<ExtractedPage[] | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
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
    setSearchQuery("");
  }

  async function run() {
    if (!file) return;
    setWorking(true);
    setError("");
    setPages(null);
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
      const out: ExtractedPage[] = [];
      for (const idx of parsed.output) {
        const text = extractTextFromPage(pdfPages[idx]);
        out.push({ pageNumber: idx + 1, text, empty: !text.trim() });
      }
      setPages(out);
      const summary = computeSummaryStats(out);
      saveHistory({
        ts: Date.now(),
        fileName: file.name,
        pageCount: total,
        extractedChars: summary.totalChars,
        format: opts.outputFormat,
      });
      setHistory(loadHistory());
      toast.success(`Extracted ${summary.extractedPages}/${summary.totalPages} pages • ${summary.totalWords} words`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong while extracting text.");
    } finally {
      setWorking(false);
    }
  }

  const rendered = useMemo(() => pages ? renderOutput(pages, opts) : "", [pages, opts]);
  const summary = useMemo(() => pages ? computeSummaryStats(pages) : null, [pages]);
  const allText = useMemo(() => pages ? pages.map((p) => p.text).join("\n\n") : "", [pages]);
  const stats = useMemo(() => computeTextStats(allText), [allText]);
  const keywords = useMemo(() => pages ? analyzeKeywords(pages, 20) : [], [pages]);
  const searchResults = useMemo(
    () => pages ? searchText(pages, searchQuery) : [],
    [pages, searchQuery],
  );
  const language = useMemo(() => detectLanguage(allText), [allText]);
  const readingTime = useMemo(() => estimateReadingTime(stats.words), [stats.words]);
  const filteredEmptyCount = useMemo(
    () => pages ? pages.length - filterEmptyPages(pages).length : 0,
    [pages],
  );

  const update = <K extends keyof ExtractOptions>(key: K, value: ExtractOptions[K]) =>
    setOpts((prev) => ({ ...prev, [key]: value }));

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
            Extract embedded text — works best for digital-native PDFs.
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
              <Label htmlFor="ocr-range">Page range</Label>
              <Input
                id="ocr-range"
                value={opts.pageRange}
                onChange={(e) => update("pageRange", e.target.value)}
                placeholder="all or e.g. 1-5, 8, 10-12"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">Use "all" or specific pages. 1-based.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ocr-format">Output format</Label>
              <select
                id="ocr-format"
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
                  checked={opts.includePageNumbers}
                  onChange={(e) => update("includePageNumbers", e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Include page numbers
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={opts.preserveLineBreaks}
                  onChange={(e) => update("preserveLineBreaks", e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                Preserve line breaks
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      <ActionBar>
        <RunButton onClick={() => void run()} disabled={!file} loading={working} label="Extract text" />
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
              <Stat label="Pages extracted" value={`${summary.extractedPages} / ${summary.totalPages}`} />
              <Stat label="Empty pages" value={summary.emptyPages} highlight={summary.emptyPages > 0 ? "bad" : undefined} />
              <Stat label="Total chars" value={summary.totalChars.toLocaleString()} />
              <Stat label="Total words" value={summary.totalWords.toLocaleString()} />
              <Stat label="Avg chars/page" value={summary.avgCharsPerPage.toLocaleString()} />
              <Stat label="Avg words/page" value={summary.avgWordsPerPage.toLocaleString()} />
              <Stat label="Quality score" value={`${summary.qualityScore}%`} highlight={summary.qualityScore >= 80 ? "good" : summary.qualityScore < 50 ? "bad" : undefined} />
              <Stat label="Empty (filtered)" value={filteredEmptyCount} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <div className="rounded border bg-background px-3 py-2 text-xs flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span><strong>{readingTime}</strong> min read</span>
              </div>
              <div className="rounded border bg-background px-3 py-2 text-xs flex items-center gap-2">
                <Languages className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Language: <strong>{language}</strong></span>
              </div>
              <div className="rounded border bg-background px-3 py-2 text-xs flex items-center gap-2">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{stats.lines} lines • {stats.paragraphs} paragraphs</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {pages && pages.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="h-4 w-4" /> Extracted text ({pages.length} pages)
              </h3>
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => rendered} label="Copy" />
                <DownloadButton
                  getText={() => rendered}
                  filename={getOutputFilename(opts.outputFormat, file?.name ?? "output.pdf")}
                  mime={FORMAT_MIME[opts.outputFormat]}
                  label="Download"
                />
                <ShareButton getUrl={() => buildShareUrl(opts)} />
              </div>
            </div>
            <pre className="max-h-[400px] overflow-auto rounded border bg-muted/30 p-3 text-xs whitespace-pre-wrap font-mono">
              {rendered || "(empty)"}
            </pre>
          </CardContent>
        </Card>
      )}

      {pages && pages.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Search className="h-4 w-4" /> Search within extracted text
            </h3>
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for a word or phrase…"
              className="text-sm"
            />
            {searchQuery && (
              <div className="space-y-1 max-h-[200px] overflow-auto">
                {searchResults.length === 0 ? (
              <p className="text-xs text-muted-foreground">No matches found.</p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">{searchResults.length} match(es)</p>
                {searchResults.slice(0, 30).map((r, i) => (
                  <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                    <Badge variant="outline" className="mr-2 text-[10px]">p.{r.pageNumber}</Badge>
                    <span className="font-mono">{r.snippet}</span>
                  </div>
                ))}
              </>
            )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {keywords.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Top keywords (top 20)</h3>
            <div className="flex flex-wrap gap-1.5">
              {keywords.map((k) => (
                <Badge key={k.word} variant="secondary" className="text-[11px]">
                  {k.word} <span className="text-muted-foreground ml-1">{k.count}</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
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
                    {h.pageCount} pages • {h.extractedChars.toLocaleString()} chars
                  </span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {pages && pages.length === 0 && (
        <EmptyState
          title="No pages in the selected range"
          hint="Adjust the page range and try again."
          icon={<FileText className="h-8 w-8" />}
        />
      )}

      <p className="text-xs text-muted-foreground">
        <strong className="text-foreground">Privacy:</strong> Text extraction runs 100% locally in your browser — your PDF never leaves your device.
        Scanned PDFs (no text layer) will report empty pages; true OCR would need a large dependency like Tesseract.js.
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
