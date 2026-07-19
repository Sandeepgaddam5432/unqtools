"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  PDFDocument,
  PDFRawStream,
  PDFStream,
  PDFContentStream,
  PDFArray,
  PDFFont,
  StandardFonts,
  rgb,
  decodePDFRawStream,
  type PDFPage,
} from "pdf-lib";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, FileUp, Trash2, Layers, History, ArrowDownToLine } from "lucide-react";
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
  CHANNEL_LABELS,
  CHANNEL_TINTS,
  DEFAULT_OPTIONS,
  SEPARATION_MODES,
  OUTPUT_FORMATS,
  channelsForMode,
  analyzePageColors,
  computeSummaryStats,
  computeInkCoverage,
  coveragePercentage,
  generateChannelLabel,
  generateRegistrationMarks,
  splitPageIntoChannels,
  renderTextReport,
  renderCsv,
  buildZip,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  validateOptions,
  type ChannelId,
  type OutputFormat,
  type PageColorAnalysis,
  type RGBColor,
  type SeparationMode,
  type SeparationOptions,
  type HistoryEntry,
  type ChannelPageDescriptor,
} from "./logic";

// ---------------------------------------------------------------------------
// PDF content-stream color extraction
// ---------------------------------------------------------------------------

function getStreamBytes(stream: unknown): Uint8Array {
  if (!stream) return new Uint8Array(0);
  try {
    if (stream instanceof PDFRawStream) {
      return decodePDFRawStream(stream).decode();
    }
    if (stream instanceof PDFContentStream) {
      // Fall through to PDFStream branch
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

/** Read the raw content stream of a single page as latin1 text. */
function readPageContent(page: PDFPage): string {
  let contents: unknown;
  try {
    // Cast: Contents() is not on the public PDFPage type but exists on the node.
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

/** Parse a single numeric token; returns null if NaN. */
function num(s: string): number | null {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/** Extract all RGB colors used on a page by scanning for rg/RG/k/K/g/G operators. */
function extractColorsFromPage(page: PDFPage): RGBColor[] {
  const content = readPageContent(page);
  if (!content) return [];
  const colors: RGBColor[] = [];
  // Match number sequences followed by an operator.
  // r g b rg / r g b RG  (RGB fill/stroke, 0–1)
  const rgbRe = /(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(rg|RG)\b/g;
  let m: RegExpExecArray | null;
  while ((m = rgbRe.exec(content)) !== null) {
    const r = num(m[1]);
    const g = num(m[2]);
    const b = num(m[3]);
    if (r === null || g === null || b === null) continue;
    colors.push({
      r: Math.max(0, Math.min(255, Math.round(r * 255))),
      g: Math.max(0, Math.min(255, Math.round(g * 255))),
      b: Math.max(0, Math.min(255, Math.round(b * 255))),
    });
  }
  // c m y k k / c m y k K  (CMYK fill/stroke, 0–1)
  const cmykRe = /(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+([kK])\b/g;
  while ((m = cmykRe.exec(content)) !== null) {
    const c = num(m[1]);
    const y2 = num(m[2]);
    const y3 = num(m[3]);
    const k = num(m[4]);
    if (c === null || y2 === null || y3 === null || k === null) continue;
    const rr = Math.round(255 * (1 - c) * (1 - k));
    const gg = Math.round(255 * (1 - y2) * (1 - k));
    const bb = Math.round(255 * (1 - y3) * (1 - k));
    colors.push({
      r: Math.max(0, Math.min(255, rr)),
      g: Math.max(0, Math.min(255, gg)),
      b: Math.max(0, Math.min(255, bb)),
    });
  }
  // g g / g G  (gray fill/stroke, 0–1)
  const grayRe = /(-?\d+(?:\.\d+)?)\s+([gG])\b/g;
  while ((m = grayRe.exec(content)) !== null) {
    // Skip — this would double-match the second arg of rg/RG.
    // Cheap guard: ensure previous char isn't a digit/space-digit pattern that
    // would have come from rgb. We require a non-number separator before the digit.
    const start = m.index;
    const prev = content[start - 1] ?? " ";
    if (prev !== "" && /[\d.\s]/.test(prev)) {
      // could be part of an RGB triplet — only accept if previous-2 is also non-digit
      const prev2 = content[start - 2] ?? " ";
      if (/[\d.\s]/.test(prev2)) continue;
    }
    const g = num(m[1]);
    if (g === null) continue;
    const v = Math.max(0, Math.min(255, Math.round(g * 255)));
    colors.push({ r: v, g: v, b: v });
  }
  return colors;
}

// ---------------------------------------------------------------------------
// PDF generation
// ---------------------------------------------------------------------------

function tintRgb(c: RGBColor): [number, number, number] {
  return [c.r / 255, c.g / 255, c.b / 255];
}

/** Draw registration marks on a target page. */
function drawRegistrationMarks(target: PDFPage, width: number, height: number): void {
  const marks = generateRegistrationMarks(width, height);
  for (const mark of marks) {
    if (mark.type === "cross") {
      target.drawLine({
        start: { x: mark.x - 6, y: mark.y },
        end: { x: mark.x + 6, y: mark.y },
        thickness: 0.5,
        color: rgb(0.2, 0.2, 0.2),
      });
      target.drawLine({
        start: { x: mark.x, y: mark.y - 6 },
        end: { x: mark.x, y: mark.y + 6 },
        thickness: 0.5,
        color: rgb(0.2, 0.2, 0.2),
      });
    } else if (mark.type === "circle") {
      target.drawCircle({
        x: mark.x,
        y: mark.y,
        size: 6,
        borderWidth: 0.5,
        borderColor: rgb(0.2, 0.2, 0.2),
        color: undefined,
      });
    }
  }
}

/** Draw a channel label at the bottom-left of a page. */
function drawChannelLabel(target: PDFPage, descriptor: ChannelPageDescriptor, font: PDFFont): void {
  const text = `${descriptor.label}  ·  page ${descriptor.pageNumber}  ·  intensity ${descriptor.intensity.toFixed(3)}  ·  ink ${descriptor.inkCoverage}%`;
  target.drawText(text, {
    x: 24,
    y: 12,
    size: 8,
    font,
    color: rgb(0.2, 0.2, 0.2),
  });
}

/** Build a separation page: copies source page, then overlays channel tint. */
async function buildSeparationPage(
  sourceDoc: PDFDocument,
  sourcePageIdx: number,
  target: PDFDocument,
  font: PDFFont,
  descriptor: ChannelPageDescriptor,
  opts: SeparationOptions,
): Promise<PDFPage> {
  const [copied] = await target.copyPages(sourceDoc, [sourcePageIdx]);
  const newPage = target.addPage(copied);
  const { width, height } = newPage.getSize();

  // Overlay a tinted rectangle representing the channel intensity.
  const tint = CHANNEL_TINTS[descriptor.channel];
  const [tr, tg, tb] = tintRgb(tint);
  // Cap opacity to keep readable.
  const opacity = Math.min(0.85, descriptor.intensity * 0.85 + 0.05);
  newPage.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: rgb(tr, tg, tb),
    opacity,
  });

  // Re-draw page border so the overlay doesn't bleed off-page visually.
  newPage.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    borderColor: rgb(0, 0, 0),
    borderWidth: 0.5,
    opacity: 0,
  });

  if (opts.includeRegistrationMarks) {
    drawRegistrationMarks(newPage, width, height);
  }
  if (opts.channelLabel) {
    drawChannelLabel(newPage, descriptor, font);
  }
  return newPage;
}

export interface SeparationOutput {
  /** Single combined PDF bytes (combined / side-by-side modes). */
  combined?: Uint8Array;
  /** Separate PDFs (separate-pdfs mode). */
  files: { name: string; bytes: Uint8Array; channel: ChannelId }[];
  analyses: PageColorAnalysis[];
  channels: ChannelId[];
  descriptors: ChannelPageDescriptor[];
  summary: ReturnType<typeof computeSummaryStats>;
  mode: SeparationMode;
  outputFormat: OutputFormat;
}

/** Run the full separation pipeline. */
async function runSeparation(
  bytes: Uint8Array,
  opts: SeparationOptions,
): Promise<SeparationOutput> {
  const source = await PDFDocument.load(bytes);
  const font = await source.embedFont(StandardFonts.Helvetica);
  const sourcePages = source.getPages();
  const channels = channelsForMode(opts.mode, opts.customChannels);

  // 1) Analyze colors per page.
  const analyses: PageColorAnalysis[] = sourcePages.map((p, i) => {
    const colors = extractColorsFromPage(p);
    return analyzePageColors(i + 1, colors, channels);
  });

  // 2) Generate descriptors.
  const descriptors: ChannelPageDescriptor[] = [];
  for (const a of analyses) {
    descriptors.push(...splitPageIntoChannels(a, channels, opts.mode));
  }
  const summary = computeSummaryStats(analyses, channels);

  // 3) Build output(s) based on format.
  const files: { name: string; bytes: Uint8Array; channel: ChannelId }[] = [];
  let combined: Uint8Array | undefined;

  if (opts.outputFormat === "separate-pdfs") {
    // One PDF per channel; each PDF contains all source pages separated for that channel.
    for (const ch of channels) {
      const out = await PDFDocument.create();
      const chIdx = channels.indexOf(ch);
      for (let pIdx = 0; pIdx < sourcePages.length; pIdx++) {
        const descriptor = descriptors[pIdx * channels.length + chIdx];
        await buildSeparationPage(source, pIdx, out, font, descriptor, opts);
      }
      const bytesOut = await out.save();
      files.push({
        name: `${ch}-separation.pdf`,
        bytes: bytesOut,
        channel: ch,
      });
    }
  } else if (opts.outputFormat === "combined-pdf") {
    // One PDF; each page is one channel of one source page.
    const out = await PDFDocument.create();
    for (let pIdx = 0; pIdx < sourcePages.length; pIdx++) {
      for (let cIdx = 0; cIdx < channels.length; cIdx++) {
        const descriptor = descriptors[pIdx * channels.length + cIdx];
        await buildSeparationPage(source, pIdx, out, font, descriptor, opts);
      }
    }
    combined = await out.save();
  } else {
    // side-by-side: for each source page, place all channel-separated copies
    // side-by-side on a single wide page.
    const out = await PDFDocument.create();
    for (let pIdx = 0; pIdx < sourcePages.length; pIdx++) {
      const src = sourcePages[pIdx];
      const srcW = src.getSize().width;
      const srcH = src.getSize().height;
      const wideW = srcW * channels.length;
      const wide = out.addPage([wideW, srcH]);
      for (let cIdx = 0; cIdx < channels.length; cIdx++) {
        const ch = channels[cIdx];
        const descriptor = descriptors[pIdx * channels.length + cIdx];
        // Build the separation page in a temp doc, then embed it.
        const tmp = await PDFDocument.create();
        const sepPage = await buildSeparationPage(source, pIdx, tmp, font, descriptor, opts);
        const [embedded] = await out.embedPages([sepPage]);
        wide.drawPage(embedded, {
          x: cIdx * srcW,
          y: 0,
          width: srcW,
          height: srcH,
        });
        // Divider line.
        if (cIdx > 0) {
          wide.drawLine({
            start: { x: cIdx * srcW, y: 0 },
            end: { x: cIdx * srcW, y: srcH },
            thickness: 0.5,
            color: rgb(0.5, 0.5, 0.5),
          });
        }
        // Suppress unused-var warning for ch.
        void ch;
      }
    }
    combined = await out.save();
  }

  return { combined, files, analyses, channels, descriptors, summary, mode: opts.mode, outputFormat: opts.outputFormat };
}

// ---------------------------------------------------------------------------
// React component
// ---------------------------------------------------------------------------

export default function PdfColorSeparation() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; bytes: Uint8Array; pageCount: number } | null>(null);
  const [opts, setOpts] = useState<SeparationOptions>(DEFAULT_OPTIONS);
  const [customPicks, setCustomPicks] = useState<ChannelId[]>(["cyan", "magenta", "yellow", "black"]);
  const [result, setResult] = useState<SeparationOutput | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      setOpts((prev) => ({ ...prev, ...p }));
      if (p.customChannels && p.customChannels.length > 0) setCustomPicks(p.customChannels);
      if (Object.keys(p).length > 0) toast.info("Loaded settings from share link");
    }
  }, []);

  const effectiveOpts: SeparationOptions = useMemo(
    () => (opts.mode === "custom" ? { ...opts, customChannels: customPicks } : opts),
    [opts, customPicks],
  );

  const previewChannels = useMemo(
    () => channelsForMode(opts.mode, opts.mode === "custom" ? customPicks : undefined),
    [opts.mode, customPicks],
  );

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
    setCustomPicks(["cyan", "magenta", "yellow", "black"]);
  }

  async function run() {
    if (!file) return;
    const valid = validateOptions(effectiveOpts);
    if (!valid.ok) {
      setError(valid.error);
      return;
    }
    setWorking(true);
    setError("");
    setResult(null);
    try {
      const out = await runSeparation(file.bytes, effectiveOpts);
      setResult(out);
      const entry: HistoryEntry = {
        ts: Date.now(),
        fileName: file.name,
        pageCount: out.summary.totalPages,
        mode: effectiveOpts.mode,
        outputFormat: effectiveOpts.outputFormat,
        channelCount: out.channels.length,
      };
      saveHistory(entry);
      setHistory(loadHistory());
      toast.success(`Separated ${out.summary.totalPages} pages × ${out.channels.length} channels`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong during separation.");
    } finally {
      setWorking(false);
    }
  }

  async function downloadZip() {
    if (!result || result.files.length === 0) return;
    const zipBytes = buildZip(
      result.files.map((f) => ({ name: f.name, bytes: f.bytes })),
    );
    downloadBytes(zipBytes, `color-separation-${file?.name?.replace(/\.pdf$/i, "") ?? "output"}.zip`, "application/zip");
  }

  const report = useMemo(
    () => (result ? renderTextReport(result.analyses, result.channels, result.mode) : ""),
    [result],
  );
  const csv = useMemo(
    () => (result ? renderCsv(result.analyses, result.channels) : ""),
    [result],
  );

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      {file ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
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
          <p className="text-sm font-medium text-foreground">Drop a PDF here or click to browse</p>
          <p className="mt-1 text-xs text-muted-foreground">Analyze colors and split into CMYK / RGB / grayscale channels.</p>
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
          <div className="space-y-1.5">
            <Label className="text-xs">Separation mode</Label>
            <div className="grid gap-2 sm:grid-cols-4">
              {SEPARATION_MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setOpts((p) => ({ ...p, mode: m }))}
                  className={
                    opts.mode === m
                      ? "rounded-lg border border-primary bg-primary/10 p-2 text-left text-xs font-medium"
                      : "rounded-lg border border-border p-2 text-left text-xs hover:border-primary/40 transition-colors"
                  }
                >
                  {m === "cmyk-4-channels" ? "CMYK (4 channels)"
                    : m === "rgb-3-channels" ? "RGB (3 channels)"
                      : m === "grayscale-1-channel" ? "Grayscale (1 channel)"
                        : "Custom (pick channels)"}
                </button>
              ))}
            </div>
          </div>

          {opts.mode === "custom" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Channels to include</Label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(CHANNEL_LABELS) as ChannelId[]).map((c) => (
                  <label key={c} className="flex items-center gap-1 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customPicks.includes(c)}
                      onChange={() =>
                        setCustomPicks((prev) =>
                          prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
                        )
                      }
                    />
                    {CHANNEL_LABELS[c]}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Output format</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {OUTPUT_FORMATS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setOpts((p) => ({ ...p, outputFormat: f }))}
                  className={
                    opts.outputFormat === f
                      ? "rounded-lg border border-primary bg-primary/10 p-2 text-left text-xs font-medium"
                      : "rounded-lg border border-border p-2 text-left text-xs hover:border-primary/40 transition-colors"
                  }
                >
                  {f === "separate-pdfs" ? "Separate PDFs (ZIP)"
                    : f === "combined-pdf" ? "Combined PDF"
                      : "Side-by-side PDF"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={opts.channelLabel}
                onChange={(e) => setOpts((p) => ({ ...p, channelLabel: e.target.checked }))}
                className="h-4 w-4 rounded border-border"
              />
              Label each channel
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={opts.includeRegistrationMarks}
                onChange={(e) => setOpts((p) => ({ ...p, includeRegistrationMarks: e.target.checked }))}
                className="h-4 w-4 rounded border-border"
              />
              Add registration marks
            </label>
          </div>

          <div className="text-xs text-muted-foreground">
            Channels that will be produced:{" "}
            <span className="font-medium text-foreground">
              {previewChannels.map((c) => CHANNEL_LABELS[c]).join(" · ")}
            </span>{" "}
            ({previewChannels.length} total)
          </div>
        </CardContent>
      </Card>

      <ActionBar>
        <RunButton
          onClick={() => void run()}
          disabled={!file || working}
          loading={working}
          label="Separate colors"
        />
        <ClearButton onClick={reset} disabled={!file && !result && !error} label="Clear" />
        <ShareButton getUrl={() => buildShareUrl(effectiveOpts)} />
      </ActionBar>

      {error && <ErrorBanner message={error} />}

      {result && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Layers className="h-4 w-4" /> Separation summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Pages" value={result.summary.totalPages} />
                <Stat label="Channels" value={result.summary.totalChannels} />
                <Stat label="Pages / channel" value={result.summary.pagesPerChannel} />
                <Stat label="Unique colors" value={result.summary.totalUniqueColors} />
              </div>
              <div className="space-y-1 pt-2">
                {result.channels.map((ch) => {
                  const avg = result.summary.avgIntensityByChannel[ch] ?? 0;
                  const cov = coveragePercentage(avg);
                  return (
                    <div key={ch} className="rounded border bg-background px-3 py-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-3 w-3 rounded"
                            style={{
                              backgroundColor: `rgb(${CHANNEL_TINTS[ch].r}, ${CHANNEL_TINTS[ch].g}, ${CHANNEL_TINTS[ch].b})`,
                            }}
                          />
                          <span className="font-medium">{CHANNEL_LABELS[ch]}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <span>avg intensity {avg.toFixed(3)}</span>
                          <Badge variant="outline" className="text-[10px]">{cov}% ink</Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">Download result</h3>
                <div className="flex flex-wrap gap-2">
                  {result.outputFormat === "separate-pdfs" ? (
                    <Button onClick={() => void downloadZip()} size="sm" className="gap-1.5">
                      <ArrowDownToLine className="h-3.5 w-3.5" /> Download ZIP ({result.files.length} files)
                    </Button>
                  ) : (
                    result.combined && (
                      <Button
                        onClick={() => downloadBytes(
                          result.combined!,
                          `color-separation-${file?.name?.replace(/\.pdf$/i, "") ?? "output"}.pdf`,
                        )}
                        size="sm"
                        className="gap-1.5"
                      >
                        <Download className="h-3.5 w-3.5" /> Download PDF ({formatBytes(result.combined.length)})
                      </Button>
                    )
                  )}
                  <CopyButton getText={() => report} label="Copy report" />
                  <DownloadButton
                    getText={() => report}
                    filename="color-separation-report.txt"
                    mime="text/plain"
                    label="Download .txt"
                  />
                  <DownloadButton
                    getText={() => csv}
                    filename="color-separation.csv"
                    mime="text/csv"
                    label="Download CSV"
                  />
                </div>
              </div>

              {result.files.length > 0 && (
                <ul className="space-y-1 pt-1">
                  {result.files.map((f, i) => (
                    <li
                      key={`${i}-${f.name}`}
                      className="flex items-center justify-between gap-2 rounded border bg-background px-3 py-1.5 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="inline-block h-3 w-3 rounded flex-shrink-0"
                          style={{
                            backgroundColor: `rgb(${CHANNEL_TINTS[f.channel].r}, ${CHANNEL_TINTS[f.channel].g}, ${CHANNEL_TINTS[f.channel].b})`,
                          }}
                        />
                        <span className="font-mono truncate">{f.name}</span>
                        <span className="text-muted-foreground flex-shrink-0">{formatBytes(f.bytes.length)}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Download ${f.name}`}
                        onClick={() => downloadBytes(f.bytes, f.name)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Per-page analysis</h3>
              <div className="max-h-72 overflow-auto space-y-1">
                {result.analyses.map((a) => (
                  <div key={a.pageNumber} className="rounded border bg-background px-3 py-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Page {a.pageNumber}</span>
                      <span className="text-muted-foreground">{a.uniqueColorCount} unique colors</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {result.channels.map((ch) => {
                        const v = a.channelIntensities[ch] ?? 0;
                        return (
                          <Badge key={ch} variant="outline" className="text-[10px]">
                            {CHANNEL_LABELS[ch]}: {v.toFixed(2)} ({coveragePercentage(v)}%)
                          </Badge>
                        );
                      })}
                    </div>
                    {a.topColors.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {a.topColors.slice(0, 6).map((c, i) => (
                          <span key={i} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded border"
                              style={{ backgroundColor: c.hex }}
                            />
                            {c.hex} ×{c.count}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!file && !result && (
        <EmptyState
          title="Drop a PDF to separate its colors"
          hint="Choose CMYK (4 channels), RGB (3 channels), grayscale (1 channel), or custom. Output as ZIP, combined PDF, or side-by-side."
          icon={<Layers className="h-8 w-8" />}
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
                onClick={() => {
                  clearHistory();
                  setHistory([]);
                  toast.success("History cleared");
                }}
              >
                Clear
              </Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2">{h.mode}</Badge>
                  <Badge variant="outline" className="mr-2">{h.outputFormat}</Badge>
                  <Badge variant="outline" className="mr-2">{h.channelCount} ch</Badge>
                  <span className="text-muted-foreground">{h.fileName}</span>
                  <span className="text-muted-foreground ml-2">· {h.pageCount}p · {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        <strong className="text-foreground">Privacy:</strong> color separation runs 100% locally in your browser — your PDF never leaves your device.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold text-foreground">{value}</div>
    </div>
  );
}
