"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, FileUp, Trash2, History, AlertTriangle, Type } from "lucide-react";
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
  DEFAULT_OPTIONS,
  POSITION_PRESETS,
  POSITION_LABELS,
  PAGE_NUMBER_FORMATS,
  PAGE_NUMBER_FORMAT_LABELS,
  DATE_FORMATS,
  DATE_FORMAT_LABELS,
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
  substituteVariables,
  checkVariableAvailability,
  formatDate,
  parseHexColor,
  validateFontSize,
  calculateX,
  calculateY,
  pickTextForPage,
  resolvePageRange,
  computeRenders,
  computeSummaryStats,
  renderTextReport,
  renderCsvReport,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  validateOptions,
  type HeaderFooterOptions,
  type Position,
  type PageNumberFormat,
  type DateFormat,
  type PageRender,
  type SummaryStats,
  type HistoryEntry,
  type PdfMetadata,
} from "./logic";

const DEFAULT_METADATA: PdfMetadata = {
  title: "",
  author: "",
  filename: "",
  date: new Date(),
};

export default function PdfHeaderFooterAdder() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; pageCount: number } | null>(null);
  const [opts, setOpts] = useState<HeaderFooterOptions>(DEFAULT_OPTIONS);
  const [metadata, setMetadata] = useState<PdfMetadata>(DEFAULT_METADATA);
  const [result, setResult] = useState<Uint8Array | null>(null);
  const [renders, setRenders] = useState<PageRender[] | null>(null);
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

  function updateOpts<K extends keyof HeaderFooterOptions>(key: K, value: HeaderFooterOptions[K]) {
    setOpts((prev) => ({ ...prev, [key]: value }));
  }

  async function loadFile(f: File) {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      const pageCount = doc.getPageCount();
      const title = (doc.getTitle() ?? "").toString();
      const author = (doc.getAuthor() ?? "").toString();
      const filename = f.name.replace(/\.pdf$/i, "");
      setFile({ name: f.name, bytes, pageCount });
      setMetadata({ title, author, filename, date: new Date() });
      setResult(null);
      setRenders(null);
      setError("");
    } catch {
      toast.error(`Could not read ${f.name} — it may be corrupted or password-protected.`);
    }
  }

  function reset() {
    setFile(null);
    setMetadata(DEFAULT_METADATA);
    setResult(null);
    setRenders(null);
    setError("");
    setOpts(DEFAULT_OPTIONS);
  }

  /** Preview renders (without writing to PDF). */
  const previewRenders = useMemo<PageRender[] | null>(() => {
    if (!file) return null;
    const r = computeRenders(file.pageCount, opts, metadata);
    return r.ok ? r.output : null;
  }, [file, opts, metadata]);

  const previewStats = useMemo<SummaryStats | null>(() => {
    return previewRenders ? computeSummaryStats(previewRenders) : null;
  }, [previewRenders]);

  const missingVariables = useMemo<string[]>(() => {
    const out: string[] = [];
    const ctx = {
      page: 1,
      total: file?.pageCount ?? 1,
      title: metadata.title,
      author: metadata.author,
      date: formatDate(metadata.date, opts.dateFormat),
      filename: metadata.filename,
    };
    out.push(...checkVariableAvailability(opts.headerText, ctx));
    out.push(...checkVariableAvailability(opts.footerText, ctx));
    if (opts.firstPageDifferent) {
      out.push(...checkVariableAvailability(opts.firstPageHeader, ctx));
      out.push(...checkVariableAvailability(opts.firstPageFooter, ctx));
    }
    return Array.from(new Set(out));
  }, [opts, metadata, file]);

  const textReport = useMemo(
    () => (previewRenders && previewStats ? renderTextReport(previewRenders, previewStats) : ""),
    [previewRenders, previewStats],
  );
  const csvReport = useMemo(
    () => (previewRenders ? renderCsvReport(previewRenders) : ""),
    [previewRenders],
  );

  async function run() {
    if (!file) return;
    setWorking(true);
    setError("");
    setResult(null);
    setRenders(null);
    try {
      const validation = validateOptions(opts, file.pageCount);
      if (!validation.ok) {
        setError(validation.error);
        setWorking(false);
        return;
      }
      const doc = await PDFDocument.load(file.bytes);
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const fontSize = Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, opts.fontSize));
      const colorRes = parseHexColor(opts.textColor);
      const color = colorRes.ok
        ? rgb(colorRes.output.r / 255, colorRes.output.g / 255, colorRes.output.b / 255)
        : rgb(0, 0, 0);
      const rangeRes = resolvePageRange(opts.pageRange, file.pageCount);
      if (!rangeRes.ok) {
        setError(rangeRes.error);
        setWorking(false);
        return;
      }
      const inRange = rangeRes.output;
      const pages = doc.getPages();
      for (let i = 0; i < pages.length; i++) {
        if (!inRange.has(i)) continue;
        const { headerText, footerText } = pickTextForPage(i, opts);
        const ctx = {
          page: i + 1,
          total: file.pageCount,
          title: metadata.title,
          author: metadata.author,
          date: formatDate(metadata.date, opts.dateFormat),
          filename: metadata.filename,
        };
        const substitutedHeader = substituteVariables(headerText, ctx);
        const substitutedFooter = substituteVariables(footerText, ctx);
        const page = pages[i];
        const { width, height } = page.getSize();
        // Header lines (top-down)
        const headerLines = substitutedHeader ? substitutedHeader.split("\n") : [];
        headerLines.forEach((line, idx) => {
          if (!line) return;
          const textWidth = font.widthOfTextAtSize(line, fontSize);
          const x = calculateX(opts.headerPosition, width, textWidth, opts.marginTop);
          const y = calculateY("header", height, fontSize, opts.marginTop, idx);
          page.drawText(line, { x, y, size: fontSize, font, color });
        });
        // Footer lines (bottom-up)
        const footerLines = substitutedFooter ? substitutedFooter.split("\n") : [];
        footerLines.forEach((line, idx) => {
          if (!line) return;
          const textWidth = font.widthOfTextAtSize(line, fontSize);
          const x = calculateX(opts.footerPosition, width, textWidth, opts.marginBottom);
          const y = calculateY("footer", height, fontSize, opts.marginBottom, idx);
          page.drawText(line, { x, y, size: fontSize, font, color });
        });
      }
      const out = await doc.save();
      setResult(out);
      const r = computeRenders(file.pageCount, opts, metadata);
      if (r.ok) setRenders(r.output);
      const stats = r.ok ? computeSummaryStats(r.output) : null;
      saveHistory({
        ts: Date.now(),
        fileName: file.name,
        pageCount: file.pageCount,
        headerPreview: opts.headerText.slice(0, 60),
        footerPreview: opts.footerText.slice(0, 60),
        pagesProcessed: stats?.processedPages ?? 0,
      });
      setHistory(loadHistory());
      toast.success(`Header/footer added to ${stats?.processedPages ?? 0} page(s)`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong while adding the header/footer.";
      setError(msg);
    } finally {
      setWorking(false);
    }
  }

  function handleClearHistory() {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }

  const fsValidation = validateFontSize(opts.fontSize);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {file ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {file.pageCount} pages • {formatBytes(file.bytes.length)}
              {metadata.title ? ` • Title: "${metadata.title}"` : ""}
              {metadata.author ? ` • Author: ${metadata.author}` : ""}
            </p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Remove" onClick={reset}>
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
          <p className="mt-1 text-xs text-muted-foreground">Add headers/footers with variables</p>
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
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="hfa-header">Header text</Label>
              <Textarea
                id="hfa-header"
                value={opts.headerText}
                onChange={(e) => updateOpts("headerText", e.target.value)}
                placeholder={"e.g. {title}"}
                className="min-h-[60px] resize-y font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">Variables: {`{page} {total} {title} {date} {author} {filename}`}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hfa-footer">Footer text</Label>
              <Textarea
                id="hfa-footer"
                value={opts.footerText}
                onChange={(e) => updateOpts("footerText", e.target.value)}
                placeholder={"e.g. Page {page} of {total}"}
                className="min-h-[60px] resize-y font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">Leave empty to skip header or footer.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Header position</Label>
              <div className="flex gap-2">
                {POSITION_PRESETS.map((p) => (
                  <Button
                    key={p}
                    variant={opts.headerPosition === p ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateOpts("headerPosition", p as Position)}
                  >
                    {POSITION_LABELS[p]}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Footer position</Label>
              <div className="flex gap-2">
                {POSITION_PRESETS.map((p) => (
                  <Button
                    key={p}
                    variant={opts.footerPosition === p ? "default" : "outline"}
                    size="sm"
                    onClick={() => updateOpts("footerPosition", p as Position)}
                  >
                    {POSITION_LABELS[p]}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="hfa-fs">Font size (pt)</Label>
              <Input
                id="hfa-fs"
                type="number"
                min={FONT_SIZE_MIN}
                max={FONT_SIZE_MAX}
                value={opts.fontSize}
                onChange={(e) => updateOpts("fontSize", Number(e.target.value))}
                className="w-24"
              />
              {!fsValidation.ok && <p className="text-[10px] text-destructive">{fsValidation.error}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hfa-color">Text color</Label>
              <input
                id="hfa-color"
                type="color"
                value={opts.textColor}
                onChange={(e) => updateOpts("textColor", e.target.value)}
                className="h-9 w-24 cursor-pointer rounded-md border border-input bg-background p-1"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hfa-mt">Margin top (pt)</Label>
              <Input
                id="hfa-mt"
                type="number"
                min={0}
                value={opts.marginTop}
                onChange={(e) => updateOpts("marginTop", Number(e.target.value))}
                className="w-24"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hfa-mb">Margin bottom (pt)</Label>
              <Input
                id="hfa-mb"
                type="number"
                min={0}
                value={opts.marginBottom}
                onChange={(e) => updateOpts("marginBottom", Number(e.target.value))}
                className="w-24"
              />
            </div>
            <div className="flex-1 min-w-[180px] space-y-1.5">
              <Label htmlFor="hfa-pr">Page range</Label>
              <Input
                id="hfa-pr"
                value={opts.pageRange}
                onChange={(e) => updateOpts("pageRange", e.target.value)}
                placeholder="all or e.g. 1-3, 5"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="hfa-pnf">Page-number format (for {`{page}`} preview)</Label>
              <select
                id="hfa-pnf"
                value={opts.pageNumberFormat}
                onChange={(e) => updateOpts("pageNumberFormat", e.target.value as PageNumberFormat)}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
                {PAGE_NUMBER_FORMATS.map((f) => (
                  <option key={f} value={f}>{PAGE_NUMBER_FORMAT_LABELS[f]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hfa-df">Date format (for {`{date}`})</Label>
              <select
                id="hfa-df"
                value={opts.dateFormat}
                onChange={(e) => updateOpts("dateFormat", e.target.value as DateFormat)}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              >
                {DATE_FORMATS.map((f) => (
                  <option key={f} value={f}>{DATE_FORMAT_LABELS[f]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={opts.firstPageDifferent}
                onChange={(e) => updateOpts("firstPageDifferent", e.target.checked)}
              />
              First page different
            </label>
            {opts.firstPageDifferent && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="hfa-fph">First-page header</Label>
                  <Input
                    id="hfa-fph"
                    value={opts.firstPageHeader}
                    onChange={(e) => updateOpts("firstPageHeader", e.target.value)}
                    placeholder="(empty = no header on first page)"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hfa-fpf">First-page footer</Label>
                  <Input
                    id="hfa-fpf"
                    value={opts.firstPageFooter}
                    onChange={(e) => updateOpts("firstPageFooter", e.target.value)}
                    placeholder="(empty = no footer on first page)"
                  />
                </div>
              </div>
            )}
          </div>

          {missingVariables.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300/40 bg-amber-50 dark:bg-amber-950/20 p-2 text-xs text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Missing metadata for: {missingVariables.join(", ")}</p>
                <p className="text-[10px]">These placeholders will render as empty strings. Edit PDF metadata to populate them.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ActionBar>
        <RunButton onClick={() => void run()} disabled={!file || !fsValidation.ok} loading={working} label="Add header/footer" />
        <CopyButton getText={() => textReport} disabled={!previewRenders} label="Copy report" />
        <DownloadButton getText={() => csvReport} filename="header-footer-report.csv" mime="text/csv" disabled={!previewRenders} label="Download CSV" />
        <ShareButton getUrl={() => buildShareUrl(opts)} />
        <ClearButton onClick={reset} disabled={!file && !result && !error} label="Clear" />
      </ActionBar>

      {error && <ErrorBanner message={error} />}

      {previewRenders && previewStats && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Type className="h-4 w-4" /> Preview ({previewStats.processedPages} of {previewStats.totalPages} pages)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Processed" value={previewStats.processedPages} />
              <Stat label="Skipped" value={previewStats.skippedPages} />
              <Stat label="With header" value={previewStats.pagesWithHeader} />
              <Stat label="With footer" value={previewStats.pagesWithFooter} />
            </div>
            <div className="flex flex-wrap gap-2 text-[10px]">
              <Badge variant="outline">Header L/C/R: {previewStats.byHeaderPosition.left}/{previewStats.byHeaderPosition.center}/{previewStats.byHeaderPosition.right}</Badge>
              <Badge variant="outline">Footer L/C/R: {previewStats.byFooterPosition.left}/{previewStats.byFooterPosition.center}/{previewStats.byFooterPosition.right}</Badge>
            </div>
            <div className="space-y-1 max-h-[280px] overflow-auto rounded-md border bg-background p-2">
              {previewRenders.slice(0, 50).map((r) => (
                <div key={r.pageNumber} className="text-[11px] font-mono">
                  <span className="text-muted-foreground">p.{r.pageNumber}</span>
                  {r.skipped ? (
                    <span className="ml-2 text-muted-foreground italic">skipped</span>
                  ) : (
                    <>
                      {r.headerText && <span className="ml-2">↑[{r.headerPosition}] {r.headerText.slice(0, 60)}</span>}
                      {r.footerText && <span className="ml-2">↓[{r.footerPosition}] {r.footerText.slice(0, 60)}</span>}
                    </>
                  )}
                </div>
              ))}
              {previewRenders.length > 50 && (
                <p className="text-[10px] text-muted-foreground italic">… and {previewRenders.length - 50} more</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-medium">Header/footer PDF ready • {formatBytes(result.length)}</p>
          <Button
            onClick={() => downloadBytes(result, `header-footer-${file?.name ?? "output.pdf"}`)}
            className="gap-1.5"
          >
            <Download className="h-4 w-4" /> Download
          </Button>
        </div>
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
                  <Badge variant="outline" className="mr-2">{h.pagesProcessed} pages</Badge>
                  <span className="font-mono text-muted-foreground">{h.fileName}</span>
                  {h.headerPreview && <span className="ml-2">↑ {h.headerPreview}</span>}
                  {h.footerPreview && <span className="ml-2">↓ {h.footerPreview}</span>}
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        <strong className="text-foreground">Privacy:</strong> All PDF processing runs 100% locally in your browser using pdf-lib. Your PDF never leaves your device.
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
  const color =
    highlight === "bad"
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
