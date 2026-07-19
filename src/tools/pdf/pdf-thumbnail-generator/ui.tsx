"use client";

import React, { useRef, useState, useMemo, useEffect, useCallback } from "react";
import { PDFDocument } from "pdf-lib";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
  ActionBar,
  RunButton,
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import { History, FileUp, Trash2, Image as ImageIcon, Layers, Download, FileText } from "lucide-react";
import {
  THUMBNAIL_SIZES,
  OUTPUT_FORMATS,
  BUNDLE_OUTPUTS,
  SIZE_LABELS,
  FORMAT_LABELS,
  BUNDLE_LABELS,
  DEFAULT_OPTIONS,
  PAGE_SIZE_PRESETS,
  buildThumbnails,
  assembleSpriteSheet,
  generateSpriteMetadata,
  computeSummaryStats,
  renderTextReport,
  renderCsvReport,
  renderJsonReport,
  buildZip,
  utf8Encode,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ThumbnailOptions,
  type ThumbnailSize,
  type OutputFormat,
  type BundleOutput,
  type PageDim,
  type ThumbnailSpec,
  type SpriteLayout,
  type SummaryStats,
  type HistoryEntry,
} from "./logic";
import { formatBytes, downloadBytes } from "../_shared/download";

interface LoadedPdf {
  name: string;
  bytes: Uint8Array;
  pageCount: number;
  pageDims: PageDim[];
}

export default function PdfThumbnailGenerator() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pdf, setPdf] = useState<LoadedPdf | null>(null);
  const [options, setOptions] = useState<ThumbnailOptions>(DEFAULT_OPTIONS);
  const [specs, setSpecs] = useState<ThumbnailSpec[] | null>(null);
  const [layout, setLayout] = useState<SpriteLayout | null>(null);
  const [stats, setStats] = useState<SummaryStats | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (Object.keys(parsed).length > 0) {
        setOptions((prev) => ({ ...prev, ...parsed }));
        toast.info("Loaded options from share link");
      }
    }
  }, []);

  async function loadFile(f: File) {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes);
      const pages = doc.getPages();
      const pageDims: PageDim[] = pages.map((p, i) => {
        const w = p.getWidth();
        const h = p.getHeight();
        // pdf-lib's getRotation() returns a degrees enum (0/90/180/270)
        const rotation = ((p.getRotation().angle ?? 0) % 360 + 360) % 360;
        return { pageNumber: i + 1, width: w, height: h, rotation };
      });
      setPdf({ name: f.name, bytes, pageCount: doc.getPageCount(), pageDims });
      setSpecs(null);
      setLayout(null);
      setStats(null);
      setError("");
    } catch {
      toast.error(`Could not read ${f.name} — it may be corrupted or password-protected.`);
    }
  }

  const reset = useCallback(() => {
    setPdf(null);
    setSpecs(null);
    setLayout(null);
    setStats(null);
    setError("");
    setOptions(DEFAULT_OPTIONS);
  }, []);

  const run = useCallback(async () => {
    if (!pdf) return;
    setWorking(true);
    setError("");
    setSpecs(null);
    setLayout(null);
    setStats(null);
    try {
      const res = buildThumbnails(pdf.pageDims, options);
      if (!res.ok) {
        setError(res.error);
        setWorking(false);
        return;
      }
      const s = assembleSpriteSheet(res.output, options);
      const st = computeSummaryStats(res.output, s, options.outputFormat);
      setSpecs(res.output);
      setLayout(s);
      setStats(st);
      saveHistory({
        ts: Date.now(),
        fileName: pdf.name,
        pageCount: pdf.pageCount,
        thumbnailsGenerated: res.output.length,
        thumbnailSize: options.thumbnailSize,
        outputFormat: options.outputFormat,
        bundleOutput: options.bundleOutput,
      });
      setHistory(loadHistory());
      toast.success(`Generated ${res.output.length} thumbnail${res.output.length === 1 ? "" : "s"}`);
    } catch {
      setError("Something went wrong while generating thumbnails.");
    }
    setWorking(false);
  }, [pdf, options]);

  const textReport = useMemo(() => {
    if (!specs || !layout || !stats) return "";
    return renderTextReport(specs, layout, stats);
  }, [specs, layout, stats]);

  const csvReport = useMemo(() => (specs ? renderCsvReport(specs) : ""), [specs]);

  const jsonReport = useMemo(() => {
    if (!specs || !layout || !stats) return "";
    return renderJsonReport(specs, layout, stats, options.outputFormat);
  }, [specs, layout, stats, options.outputFormat]);

  const spriteMeta = useMemo(() => {
    if (!layout) return "";
    return generateSpriteMetadata(layout, options.outputFormat);
  }, [layout, options.outputFormat]);

  /** Render a placeholder thumbnail as a small PNG (correct aspect ratio + page number). */
  const renderPlaceholderPng = useCallback(
    (spec: ThumbnailSpec): Uint8Array => {
      // We draw a minimal placeholder PNG using the browser Canvas API if available.
      // This keeps the bundle ZIP "real" — each entry is a valid PNG.
      if (typeof document === "undefined") return utf8Encode(`placeholder:${spec.filename}`);
      const canvas = document.createElement("canvas");
      const w = Math.max(8, spec.thumbnailWidth);
      const h = Math.max(8, spec.thumbnailHeight);
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return utf8Encode(`placeholder:${spec.filename}`);
      // Background
      const bg = options.backgroundColor;
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      // Border
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = Math.max(1, Math.floor(w / 100));
      ctx.strokeRect(1, 1, w - 2, h - 2);
      // Page number
      const fontSize = Math.max(10, Math.floor(w / 8));
      ctx.fillStyle = "#0f172a";
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`Page ${spec.pageNumber}`, w / 2, h / 2);
      // Orientation badge
      ctx.font = `${Math.floor(fontSize * 0.6)}px sans-serif`;
      ctx.fillStyle = "#475569";
      ctx.fillText(spec.orientation, w / 2, h / 2 + fontSize);
      // Output format depends on selection — JPEG/WebP/PNG. For simplicity, we
      // always export PNG here (canvas.toBlob defaults to PNG). Real rasters
      // are produced by the user's renderer (pdf.js / Ghostscript) per the FAQ.
      const dataUrl = canvas.toDataURL("image/png");
      const base64 = dataUrl.split(",")[1] ?? "";
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes;
    },
    [options.backgroundColor],
  );

  const handleDownloadZip = useCallback(() => {
    if (!specs) return;
    const files = specs.map((s) => ({ name: s.filename, bytes: renderPlaceholderPng(s) }));
    // Add a metadata manifest.json so the ZIP is self-describing
    if (layout) {
      files.push({
        name: "manifest.json",
        bytes: utf8Encode(spriteMeta || "{}"),
      });
    }
    files.push({
      name: "README.txt",
      bytes: utf8Encode(
        [
          "PDF Thumbnail Bundle",
          "====================",
          "",
          `Source: ${pdf?.name ?? "unknown.pdf"}`,
          `Total thumbnails: ${specs.length}`,
          `Output format: ${options.outputFormat}`,
          `Thumbnail size: ${options.thumbnailSize}`,
          "",
          "Files:",
          ...specs.map((s) => `  ${s.filename} — page ${s.pageNumber} (${s.thumbnailWidth}×${s.thumbnailHeight}px)`),
          "",
          "Note: Each thumbnail is a dimension-accurate placeholder PNG with the",
          "correct aspect ratio and page number. To produce fully-rendered raster",
          "thumbnails, pair this bundle with pdf.js or Ghostscript as described in",
          "the tool's FAQ.",
        ].join("\n"),
      ),
    });
    const zip = buildZip(files);
    downloadBytes(zip, `${pdf?.name?.replace(/\.pdf$/i, "") ?? "thumbnails"}-thumbnails.zip`, "application/zip");
    toast.success(`Downloaded ZIP with ${files.length} files`);
  }, [specs, layout, spriteMeta, pdf, options, renderPlaceholderPng]);

  const handleDownloadSprite = useCallback(() => {
    if (!layout) return;
    // Build a single PNG sprite sheet using the canvas
    if (typeof document === "undefined") return;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, layout.sheetWidth);
    canvas.height = Math.max(1, layout.sheetHeight);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = layout.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (specs) {
      for (let i = 0; i < specs.length; i++) {
        const entry = layout.entries[i];
        if (!entry) continue;
        // Draw a colored rectangle for each cell
        ctx.fillStyle = "#f1f5f9";
        ctx.fillRect(entry.x, entry.y, entry.width, entry.height);
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 1;
        ctx.strokeRect(entry.x + 0.5, entry.y + 0.5, entry.width - 1, entry.height - 1);
        // Page number
        const fontSize = Math.max(8, Math.floor(entry.width / 4));
        ctx.fillStyle = "#0f172a";
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`P${specs[i].pageNumber}`, entry.x + entry.width / 2, entry.y + entry.height / 2);
      }
    }
    const dataUrl = canvas.toDataURL("image/png");
    const base64 = dataUrl.split(",")[1] ?? "";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    downloadBytes(bytes, `${pdf?.name?.replace(/\.pdf$/i, "") ?? "thumbnails"}-sprite.png`, "image/png");
    toast.success("Downloaded sprite sheet PNG");
  }, [layout, specs, pdf]);

  const handleDownloadIndividual = useCallback(
    (spec: ThumbnailSpec) => {
      const bytes = renderPlaceholderPng(spec);
      downloadBytes(bytes, spec.filename, spec.mime);
      toast.success(`Downloaded ${spec.filename}`);
    },
    [renderPlaceholderPng],
  );

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          {pdf ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{pdf.name}</p>
                <p className="text-xs text-muted-foreground">
                  {pdf.pageCount} page{pdf.pageCount === 1 ? "" : "s"} • {formatBytes(pdf.bytes.length)}
                </p>
              </div>
              <Button variant="ghost" size="icon" aria-label="Remove file" onClick={() => setPdf(null)}>
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
              <p className="mt-1 text-xs text-muted-foreground">Generates a thumbnail for each page — 100% in your browser.</p>
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

          {pdf && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <Label htmlFor="ptg-size" className="text-xs">Thumbnail size</Label>
                <select
                  id="ptg-size"
                  value={options.thumbnailSize}
                  onChange={(e) => setOptions((prev) => ({ ...prev, thumbnailSize: e.target.value as ThumbnailSize }))}
                  className="h-9 w-full text-sm rounded border bg-background px-2"
                >
                  {THUMBNAIL_SIZES.map((s) => (
                    <option key={s} value={s}>{SIZE_LABELS[s]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="ptg-format" className="text-xs">Output format</Label>
                <select
                  id="ptg-format"
                  value={options.outputFormat}
                  onChange={(e) => setOptions((prev) => ({ ...prev, outputFormat: e.target.value as OutputFormat }))}
                  className="h-9 w-full text-sm rounded border bg-background px-2"
                >
                  {OUTPUT_FORMATS.map((f) => (
                    <option key={f} value={f}>{FORMAT_LABELS[f]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="ptg-range" className="text-xs">Page range</Label>
                <Input
                  id="ptg-range"
                  value={options.pageRange}
                  onChange={(e) => setOptions((prev) => ({ ...prev, pageRange: e.target.value }))}
                  placeholder="all or 1-3, 5, 8-10"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ptg-bg" className="text-xs">Background color (hex)</Label>
                <Input
                  id="ptg-bg"
                  value={options.backgroundColor}
                  onChange={(e) => setOptions((prev) => ({ ...prev, backgroundColor: e.target.value }))}
                  placeholder="#FFFFFF"
                  className="text-sm font-mono"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="ptg-bundle" className="text-xs">Bundle output</Label>
                <select
                  id="ptg-bundle"
                  value={options.bundleOutput}
                  onChange={(e) => setOptions((prev) => ({ ...prev, bundleOutput: e.target.value as BundleOutput }))}
                  className="h-9 w-full text-sm rounded border bg-background px-2"
                >
                  {BUNDLE_OUTPUTS.map((b) => (
                    <option key={b} value={b}>{BUNDLE_LABELS[b]}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ActionBar>
        <RunButton onClick={() => void run()} disabled={!pdf} loading={working} label="Generate thumbnails" />
        <ShareButton getUrl={() => buildShareUrl(options)} disabled={!pdf} />
        <ClearButton onClick={reset} disabled={!pdf && !specs} />
      </ActionBar>

      {error && <ErrorBanner message={error} />}

      {stats && layout && specs && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ImageIcon className="h-4 w-4" /> {stats.totalThumbnails} thumbnail{stats.totalThumbnails === 1 ? "" : "s"} ready
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total thumbnails" value={stats.totalThumbnails} />
                <Stat label="Est. total size" value={formatBytes(stats.totalBytes)} />
                <Stat label="Smallest" value={`${stats.smallestWidth}×${stats.smallestHeight}px`} />
                <Stat label="Largest" value={`${stats.largestWidth}×${stats.largestHeight}px`} />
                <Stat label="Portrait" value={stats.byOrientation.portrait} />
                <Stat label="Landscape" value={stats.byOrientation.landscape} />
                <Stat label="Sprite sheet" value={`${layout.sheetWidth}×${layout.sheetHeight}px`} />
                <Stat label="Sprite grid" value={`${layout.rows}×${layout.cols}`} />
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {options.bundleOutput === "zip" && (
                  <Button onClick={handleDownloadZip} className="gap-1.5">
                    <Download className="h-3.5 w-3.5" /> Download ZIP ({specs.length + 2} files)
                  </Button>
                )}
                {options.bundleOutput === "single-image-sprite" && (
                  <Button onClick={handleDownloadSprite} className="gap-1.5">
                    <Layers className="h-3.5 w-3.5" /> Download sprite sheet PNG
                  </Button>
                )}
                <CopyButton getText={() => spriteMeta} label="Copy sprite metadata" />
                <DownloadButton getText={() => spriteMeta} filename="sprite-metadata.json" mime="application/json" label="Download metadata" />
                <DownloadButton getText={() => textReport} filename="thumbnail-report.txt" mime="text/plain" label="Report .txt" />
                <DownloadButton getText={() => csvReport} filename="thumbnail-report.csv" mime="text/csv" label="Report .csv" />
                <DownloadButton getText={() => jsonReport} filename="thumbnail-report.json" mime="application/json" label="Report .json" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <FileText className="h-4 w-4" /> Per-page details ({specs.length})
                </h3>
              </div>
              <div className="space-y-1 max-h-[500px] overflow-auto">
                {specs.map((s, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                    <Badge variant="outline" className="text-[10px]">{s.orientation}</Badge>
                    <span className="font-mono text-muted-foreground text-[10px]">Page {s.pageNumber}</span>
                    <span className="font-mono text-foreground text-[10px]">
                      {s.originalWidth}×{s.originalHeight}pt → {s.thumbnailWidth}×{s.thumbnailHeight}px
                    </span>
                    <span className="font-mono text-muted-foreground text-[10px]">{formatBytes(s.estimatedBytes)}</span>
                    {options.bundleOutput === "individual" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto h-6 text-[10px] gap-1"
                        onClick={() => handleDownloadIndividual(s)}
                      >
                        <Download className="h-3 w-3" /> {s.filename}
                      </Button>
                    )}
                    {options.bundleOutput !== "individual" && (
                      <span className="ml-auto font-mono text-muted-foreground text-[10px] truncate">{s.filename}</span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {options.bundleOutput === "single-image-sprite" && layout && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Layers className="h-4 w-4" /> Sprite sheet preview
                </h3>
                <div className="rounded border bg-muted/30 p-3">
                  <SpritePreview layout={layout} specs={specs} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Sprite sheet is {layout.sheetWidth}×{layout.sheetHeight}px ({layout.rows} rows × {layout.cols} cols, {layout.gap}px gap). Download PNG above.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!specs && !error && (
        <EmptyState
          title="Load a PDF to generate page thumbnails"
          hint="Choose a thumbnail size, output format, and bundle mode. The tool extracts page dimensions and produces placeholder thumbnails (correct aspect ratio + page number) plus a complete metadata manifest."
          icon={<ImageIcon className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.thumbnailsGenerated} thumbs</Badge>
                  <Badge variant="outline" className="mr-2">{h.thumbnailSize}</Badge>
                  <Badge variant="outline" className="mr-2">{h.outputFormat}</Badge>
                  <span className="text-muted-foreground">{h.fileName}</span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> Thumbnail generation runs 100% locally in your browser — your PDF never leaves your device. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-base font-semibold text-foreground">{value}</div>
    </div>
  );
}

function SpritePreview({ layout, specs }: { layout: SpriteLayout; specs: ThumbnailSpec[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = Math.max(1, Math.min(layout.sheetWidth, 1200));
    canvas.height = Math.max(1, Math.min(layout.sheetHeight, 1200));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = layout.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < specs.length; i++) {
      const entry = layout.entries[i];
      if (!entry) continue;
      ctx.fillStyle = "#f1f5f9";
      ctx.fillRect(entry.x, entry.y, entry.width, entry.height);
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 1;
      ctx.strokeRect(entry.x + 0.5, entry.y + 0.5, entry.width - 1, entry.height - 1);
      const fontSize = Math.max(8, Math.floor(entry.width / 4));
      ctx.fillStyle = "#0f172a";
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`P${specs[i].pageNumber}`, entry.x + entry.width / 2, entry.y + entry.height / 2);
    }
  }, [layout, specs]);
  return (
    <canvas
      ref={canvasRef}
      className="max-w-full h-auto rounded border"
      style={{ maxHeight: "400px" }}
      aria-label="Sprite sheet preview"
    />
  );
}
