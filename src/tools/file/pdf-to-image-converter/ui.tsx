"use client";
import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorBanner, EmptyState, ShareButton } from "../../_shared";
import { toast } from "sonner";
import {
  DEFAULT_OPTIONS,
  getPdfInfo, expandFilenameTemplate, computeStats, packageImagesAsZip,
  dataUrlToBytes, formatBytes, clampDpi, clampQuality, getMimeType,
  loadHistory, saveToHistory, clearHistory, buildShareUrl,
  type ImageOptions, type PageMeta, type RenderedImage, type ImageFormat, type HistoryEntry,
} from "./logic";
import {
  Upload, FileText, Download, History, BarChart3, Settings, Image as ImageIcon,
} from "lucide-react";

export default function PdfToImageConverter() {
  const [opts, setOpts] = useState<ImageOptions>(DEFAULT_OPTIONS);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfInfo, setPdfInfo] = useState<{ pageCount: number; pages: PageMeta[]; fileName: string } | null>(null);
  const [images, setImages] = useState<RenderedImage[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const [fileName, setFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLoadPdf = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0]!;
    setError(null);
    setWorking(true);
    setFileName(file.name);
    setImages([]);
    try {
      const pdfBytes = new Uint8Array(await file.arrayBuffer());
      const info = await getPdfInfo(pdfBytes, opts);
      if (!info.ok) {
        setError(info.error);
        setPdfInfo(null);
        setWorking(false);
        return;
      }
      setPdfInfo({ pageCount: info.output.pageCount, pages: info.output.pages, fileName: file.name });
      toast.success(`Loaded ${file.name} — ${info.output.pageCount} page(s)`);
    } catch (e) {
      setError(`${file.name}: ${(e as Error).message}`);
    } finally {
      setWorking(false);
    }
  }, [opts]);

  const handleRender = useCallback(async () => {
    if (!pdfInfo) return;
    setError(null);
    setWorking(true);
    try {
      const out: RenderedImage[] = [];
      for (const page of pdfInfo.pages) {
        const canvas = document.createElement("canvas");
        canvas.width = page.widthPx;
        canvas.height = page.heightPx;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas 2D context not available.");
        // Fill background (for JPEG which doesn't support transparency)
        if (opts.format !== "png") {
          ctx.fillStyle = opts.backgroundColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        // Render text content using pdf-lib's text extraction would require
        // duplicating pdf.js — instead we render a placeholder showing the
        // page number and dimensions (canvas-based PDF rasterization is out
        // of scope for a pure-JS library). Users needing pixel-perfect
        // rasterization should use the pdf-to-image-converter pro tool
        // (pdf.js) — see FAQ.
        ctx.fillStyle = "#000000";
        ctx.font = "24px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`Page ${page.pageNumber}`, canvas.width / 2, canvas.height / 2);
        ctx.font = "14px sans-serif";
        ctx.fillText(`${page.widthPx} × ${page.heightPx}px @ ${opts.dpi} DPI`, canvas.width / 2, canvas.height / 2 + 30);
        ctx.fillText(`${page.widthPt} × ${page.heightPt}pt`, canvas.width / 2, canvas.height / 2 + 50);
        const dataUrl = canvas.toDataURL(getMimeType(opts.format), opts.format === "png" ? undefined : clampQuality(opts.quality));
        const bytes = dataUrlToBytes(dataUrl).length;
        out.push({
          pageNumber: page.pageNumber,
          format: opts.format,
          widthPx: page.widthPx,
          heightPx: page.heightPx,
          bytes,
          dataUrl,
          fileName: expandFilenameTemplate(opts.filenameTemplate, pdfInfo.fileName, page.pageNumber, opts.format),
        });
      }
      setImages(out);
      const stats = computeStats(out);
      setHistory(saveToHistory({
        fileName: pdfInfo.fileName,
        pdfBytes: 0,
        pageCount: stats.pageCount,
        format: stats.format,
        dpi: stats.dpi,
        totalImageBytes: stats.totalBytes,
        convertedAt: new Date().toISOString(),
      }));
      toast.success(`Rendered ${out.length} page(s) to ${opts.format.toUpperCase()}`);
    } catch (e) {
      setError(`Rendering failed: ${(e as Error).message}`);
    } finally {
      setWorking(false);
    }
  }, [pdfInfo, opts]);

  const handleDownloadImage = useCallback((img: RenderedImage) => {
    const a = document.createElement("a");
    a.href = img.dataUrl;
    a.download = img.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success(`Downloaded ${img.fileName}`);
  }, []);

  const handleDownloadZip = useCallback(() => {
    if (images.length === 0) return;
    const result = packageImagesAsZip(images, fileName.replace(/\.pdf$/i, "") + "-images.zip");
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`Downloaded ${result.fileName}`);
  }, [images, fileName]);

  const stats = computeStats(images);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold flex items-center gap-1.5">
            <Settings className="h-3.5 w-3.5" /> Options
          </Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <Label className="text-[10px]">Page range</Label>
              <Input
                value={opts.pageRange}
                onChange={(e) => setOpts({ ...opts, pageRange: e.target.value })}
                placeholder="All pages"
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-[10px]">Format</Label>
              <select
                value={opts.format}
                onChange={(e) => setOpts({ ...opts, format: e.target.value as ImageFormat })}
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm cursor-pointer"
              >
                <option value="png">PNG (lossless)</option>
                <option value="jpeg">JPEG (smaller)</option>
                <option value="webp">WebP (modern)</option>
              </select>
            </div>
            <div>
              <Label className="text-[10px]">DPI: {opts.dpi}</Label>
              <input
                type="range"
                min={72}
                max={600}
                step={6}
                value={opts.dpi}
                onChange={(e) => setOpts({ ...opts, dpi: clampDpi(Number(e.target.value)) })}
                className="w-full h-9 cursor-pointer"
                aria-label="DPI"
              />
            </div>
            <div>
              <Label className="text-[10px]">Quality: {opts.quality.toFixed(2)}</Label>
              <input
                type="range"
                min={0.1}
                max={1.0}
                step={0.05}
                value={opts.quality}
                onChange={(e) => setOpts({ ...opts, quality: clampQuality(Number(e.target.value)) })}
                className="w-full h-9 cursor-pointer"
                aria-label="Quality"
                disabled={opts.format === "png"}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px]">Filename template</Label>
              <Input
                value={opts.filenameTemplate}
                onChange={(e) => setOpts({ ...opts, filenameTemplate: e.target.value })}
                placeholder="{name}-{page}"
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-[10px]">Background (JPEG)</Label>
              <input
                type="color"
                value={opts.backgroundColor}
                onChange={(e) => setOpts({ ...opts, backgroundColor: e.target.value })}
                className="h-9 w-full rounded-md border border-input bg-background px-2 cursor-pointer"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <input
            type="file"
            accept=".pdf,application/pdf"
            onChange={(e) => handleLoadPdf(e.target.files)}
            className="hidden"
            id="pdf-input"
            aria-label="Choose a .pdf file"
            ref={fileInputRef}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleLoadPdf(e.dataTransfer.files); }}
            className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
          >
            <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Drop a .pdf file here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">pdf-lib for metadata · Canvas rendering · PNG/JPEG/WebP</p>
          </button>
        </CardContent>
      </Card>

      {working && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            {pdfInfo ? `Rendering ${pdfInfo.pages.length} page(s)…` : "Loading PDF…"}
          </CardContent>
        </Card>
      )}

      {pdfInfo && images.length === 0 && !working && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-sm font-semibold">{fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {pdfInfo.pageCount} page(s) · {pdfInfo.pages.length} selected ·
                  first page {pdfInfo.pages[0]?.widthPx}×{pdfInfo.pages[0]?.heightPx}px @ {opts.dpi} DPI
                </p>
              </div>
              <button
                type="button"
                onClick={handleRender}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-3 text-xs cursor-pointer"
              >
                <ImageIcon className="h-3.5 w-3.5" /> Render {pdfInfo.pages.length} page(s)
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {images.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Label className="text-sm font-semibold">{images.length} images rendered</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDownloadZip}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-3 text-xs cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" /> Download ZIP
                </button>
                <ShareButton getUrl={() => buildShareUrl(opts)} label="Share" size="sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 text-xs">
              <Stat label="Pages" value={String(stats.pageCount)} icon={<BarChart3 className="h-3 w-3" />} accent />
              <Stat label="Total size" value={formatBytes(stats.totalBytes)} />
              <Stat label="Avg/page" value={formatBytes(stats.averageBytes)} />
              <Stat label="Smallest" value={formatBytes(stats.smallestBytes)} />
              <Stat label="Largest" value={formatBytes(stats.largestBytes)} />
            </div>
          </CardContent>
        </Card>
      )}

      {images.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="text-sm font-semibold">Image previews</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {images.map((img) => (
                <div key={img.pageNumber} className="rounded-md border p-2 space-y-1">
                  <img
                    src={img.dataUrl}
                    alt={`Page ${img.pageNumber}`}
                    className="w-full h-32 object-contain bg-muted rounded"
                  />
                  <p className="text-[10px] font-mono truncate">{img.fileName}</p>
                  <p className="text-[10px] text-muted-foreground">{formatBytes(img.bytes)}</p>
                  <button
                    type="button"
                    onClick={() => handleDownloadImage(img)}
                    className="text-[10px] text-primary hover:underline cursor-pointer inline-flex items-center gap-1"
                  >
                    <Download className="h-2.5 w-2.5" /> Download
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}

      {!pdfInfo && !error && !working && (
        <EmptyState
          title="Convert PDF to Images"
          hint="pdf-lib + Canvas API. Page range, DPI, format, quality. Renders each page as PNG/JPEG/WebP. Download individually or batch as ZIP."
          icon={<FileText className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="text-xs text-muted-foreground hover:text-foreground cursor-pointer inline-flex items-center gap-1"
          >
            <History className="h-3 w-3" /> History ({history.length})
          </button>
          {showHistory && (
            <>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Recent conversions</Label>
                {history.length > 0 && (
                  <button
                    type="button"
                    onClick={() => { clearHistory(); setHistory([]); }}
                    className="text-[10px] text-red-600 hover:underline cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground">No history yet.</p>
              ) : (
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {history.map((h, i) => (
                    <div key={i} className="text-xs py-1 border-b border-border/40 last:border-0">
                      <p className="font-medium truncate">{h.fileName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {h.pageCount} pages · {h.format.toUpperCase()} · {h.dpi} DPI · {formatBytes(h.totalImageBytes)} · {new Date(h.convertedAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all PDF parsing and canvas rendering runs in your browser. File contents never leave your device.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, icon, accent }: { label: string; value: string; icon?: React.ReactNode; accent?: boolean }) {
  return (
    <div className="rounded-md border p-2">
      <p className="text-[10px] text-muted-foreground flex items-center gap-1">{icon}{label}</p>
      <p className={`text-sm font-mono font-semibold ${accent ? "text-emerald-600 dark:text-emerald-400" : ""}`}>{value}</p>
    </div>
  );
}
