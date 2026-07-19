"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  SIZE_PRESETS,
  PLATFORMS,
  PLATFORM_LABELS,
  OUTPUT_FORMATS,
  OUTPUT_FORMAT_LABELS,
  QUALITY_PRESETS,
  QUALITY_LABELS,
  QUALITY_VALUES,
  CROP_MODES,
  CROP_MODE_LABELS,
  listPresetsByPlatform,
  getPreset,
  computeCropRect,
  computeMetadata,
  estimateFileSize,
  scoreQuality,
  computeStats,
  renderText,
  renderCsv,
  formatBytes,
  getMimeType,
  getExtension,
  getQualityValue,
  createZipBlob,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Platform,
  type Format,
  type OutputFormat,
  type QualityPreset,
  type CropMode,
  type SizePreset,
  type ImageMetadata,
  type ResizeResult,
  type HistoryEntry,
  type ZipFile,
} from "./logic";
import {
  Image as ImageIcon,
  Upload,
  Download,
  Package,
  History,
  RotateCw,
  CheckCircle2,
  Layers,
} from "lucide-react";

interface GeneratedOutput {
  result: ResizeResult;
  blob: Blob | null;
  url: string | null;
  qualityScore: number;
}

export default function SocialMediaImageResizer() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageMeta, setImageMeta] = useState<ImageMetadata | null>(null);
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [selectedFormats, setSelectedFormats] = useState<Format[]>(["ig-square", "tw-post"]);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("jpeg");
  const [quality, setQuality] = useState<QualityPreset>("90");
  const [cropMode, setCropMode] = useState<CropMode>("fill");
  const [outputs, setOutputs] = useState<GeneratedOutput[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.formats.length > 0) setSelectedFormats(p.formats);
      setOutputFormat(p.outputFormat);
      setQuality(p.quality);
      setCropMode(p.cropMode);
      if (p.formats.length > 0) toast.info("Loaded from share link");
    }
  }, []);

  const stats = useMemo(() => computeStats(outputs.map((o) => o.result)), [outputs]);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }
      setImageFile(file);
      setOutputs([]);
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        setImageEl(img);
        setImageMeta(
          computeMetadata(img.naturalWidth, img.naturalHeight, file.size, file.type),
        );
        URL.revokeObjectURL(url);
      };
      img.onerror = () => {
        toast.error("Could not load image");
        URL.revokeObjectURL(url);
      };
      img.src = url;
    },
    [],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const toggleFormat = (fmt: Format) => {
    setSelectedFormats((prev) =>
      prev.includes(fmt) ? prev.filter((f) => f !== fmt) : [...prev, fmt],
    );
  };

  const selectAllForPlatform = (platform: Platform) => {
    const platformFormats = listPresetsByPlatform(platform).map((p) => p.format);
    setSelectedFormats((prev) => {
      const allSelected = platformFormats.every((f) => prev.includes(f));
      if (allSelected) {
        return prev.filter((f) => !platformFormats.includes(f));
      }
      return Array.from(new Set([...prev, ...platformFormats]));
    });
  };

  const handleGenerate = useCallback(async () => {
    if (!imageEl || !imageMeta) {
      toast.error("Please upload an image first");
      return;
    }
    if (selectedFormats.length === 0) {
      toast.error("Please select at least one platform/format");
      return;
    }
    setIsProcessing(true);
    // Cleanup previous output URLs
    for (const o of outputs) {
      if (o.url) URL.revokeObjectURL(o.url);
    }
    const newOutputs: GeneratedOutput[] = [];
    try {
      for (const fmt of selectedFormats) {
        const preset = getPreset(fmt);
        if (!preset) continue;
        const crop = computeCropRect(
          imageMeta.width,
          imageMeta.height,
          preset.width,
          preset.height,
          cropMode,
        );
        const canvas = document.createElement("canvas");
        canvas.width = preset.width;
        canvas.height = preset.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        // For "fit" mode with non-png formats, fill background white.
        if (cropMode === "fit" && outputFormat === "jpeg") {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, preset.width, preset.height);
        }
        ctx.drawImage(
          imageEl,
          crop.sx, crop.sy, crop.sw, crop.sh,
          crop.dx, crop.dy, crop.dw, crop.dh,
        );
        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob(
            resolve,
            getMimeType(outputFormat),
            outputFormat === "png" ? undefined : getQualityValue(quality),
          );
        });
        const url = blob ? URL.createObjectURL(blob) : null;
        const estSize = estimateFileSize(preset.width, preset.height, outputFormat, quality);
        newOutputs.push({
          result: {
            format: preset.format,
            platform: preset.platform,
            label: preset.label,
            width: preset.width,
            height: preset.height,
            outputFormat,
            quality,
            cropMode,
            estimatedSize: estSize,
          },
          blob,
          url,
          qualityScore: scoreQuality(preset.width, preset.height, outputFormat, quality),
        });
      }
      setOutputs(newOutputs);
      toast.success(`Generated ${newOutputs.length} image(s)`);
      // Save to history
      const entry: HistoryEntry = {
        ts: Date.now(),
        fileName: imageFile?.name ?? "image",
        fileSize: imageMeta.fileSize,
        width: imageMeta.width,
        height: imageMeta.height,
        platforms: Array.from(new Set(newOutputs.map((o) => o.result.platform))),
        formats: selectedFormats,
        outputFormat,
        quality,
        cropMode,
        totalOutputs: newOutputs.length,
        totalEstimatedSize: stats.totalEstimatedSize,
      };
      saveHistory(entry);
      setHistory(loadHistory());
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate images");
    } finally {
      setIsProcessing(false);
    }
  }, [imageEl, imageMeta, imageFile, selectedFormats, outputFormat, quality, cropMode, outputs, stats.totalEstimatedSize]);

  const downloadOutput = useCallback((o: GeneratedOutput) => {
    if (!o.blob || !o.url) {
      toast.error("Image not ready");
      return;
    }
    const a = document.createElement("a");
    a.href = o.url;
    const baseName = (imageFile?.name ?? "image").replace(/\.[^.]+$/, "");
    a.download = `${baseName}-${o.result.format}.${getExtension(o.result.outputFormat)}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success(`Downloaded ${a.download}`);
  }, [imageFile]);

  const downloadAllZip = useCallback(async () => {
    if (outputs.length === 0) return;
    const files: ZipFile[] = [];
    const baseName = (imageFile?.name ?? "image").replace(/\.[^.]+$/, "");
    for (const o of outputs) {
      if (!o.blob) continue;
      const bytes = new Uint8Array(await o.blob.arrayBuffer());
      files.push({
        name: `${baseName}-${o.result.format}.${getExtension(o.result.outputFormat)}`,
        data: bytes,
      });
    }
    if (files.length === 0) return;
    const zipBlob = createZipBlob(files);
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseName}-social-${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`Downloaded ZIP (${files.length} files, ${formatBytes(zipBlob.size)})`);
  }, [outputs, imageFile]);

  const handleClear = useCallback(() => {
    setImageFile(null);
    setImageMeta(null);
    setImageEl(null);
    setOutputs([]);
    setSelectedFormats([]);
    setOutputFormat("jpeg");
    setQuality("90");
    setCropMode("fill");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      for (const o of outputs) {
        if (o.url) URL.revokeObjectURL(o.url);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label>1. Choose an image</Label>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition ${
              dragOver ? "border-primary bg-primary/5" : "border-border"
            }`}
          >
            {imageFile ? (
              <div className="flex w-full items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <div className="text-left">
                    <div className="text-sm font-medium text-foreground">{imageFile.name}</div>
                    {imageMeta && (
                      <div className="text-[11px] text-muted-foreground">
                        {imageMeta.width}×{imageMeta.height}px · {imageMeta.orientation} ·{" "}
                        {imageMeta.aspectRatio} · {formatBytes(imageMeta.fileSize)}
                      </div>
                    )}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
                  Replace
                </Button>
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground" />
                <div className="text-sm text-foreground">
                  Drag &amp; drop an image here, or{" "}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-primary hover:underline"
                  >
                    browse
                  </button>
                </div>
                <div className="text-[11px] text-muted-foreground">JPEG, PNG, WebP — up to 25 MB</div>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label>2. Pick target platforms &amp; formats ({selectedFormats.length} selected)</Label>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => setSelectedFormats(SIZE_PRESETS.map((p) => p.format))}>
                Select all
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedFormats([])}>
                Clear
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            {PLATFORMS.map((plat) => {
              const presets = listPresetsByPlatform(plat);
              const selectedForPlat = presets.filter((p) => selectedFormats.includes(p.format));
              const allSelected = selectedForPlat.length === presets.length;
              return (
                <div key={plat} className="rounded-md border bg-background p-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <button
                      type="button"
                      onClick={() => selectAllForPlatform(plat)}
                      className="flex items-center gap-1.5 text-xs font-semibold hover:text-primary"
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      {PLATFORM_LABELS[plat]}
                      <Badge variant="outline" className="text-[10px]">
                        {selectedForPlat.length}/{presets.length}
                      </Badge>
                    </button>
                    <span className="text-[10px] text-muted-foreground">
                      {allSelected ? "all selected" : "click to toggle"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {presets.map((p) => (
                      <label
                        key={p.format}
                        className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] cursor-pointer ${
                          selectedFormats.includes(p.format)
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:bg-muted"
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={selectedFormats.includes(p.format)}
                          onChange={() => toggleFormat(p.format)}
                        />
                        <span>{p.label}</span>
                        <span className="text-[10px] opacity-70">{p.width}×{p.height}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label>3. Output settings</Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Output format</Label>
              <select
                value={outputFormat}
                onChange={(e) => setOutputFormat(e.target.value as OutputFormat)}
                className="h-9 w-full text-sm rounded-md border bg-transparent px-3"
              >
                {OUTPUT_FORMATS.map((f) => (
                  <option key={f} value={f}>{OUTPUT_FORMAT_LABELS[f]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Quality</Label>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value as QualityPreset)}
                className="h-9 w-full text-sm rounded-md border bg-transparent px-3"
              >
                {QUALITY_PRESETS.map((q) => (
                  <option key={q} value={q}>{QUALITY_LABELS[q]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Crop mode</Label>
              <select
                value={cropMode}
                onChange={(e) => setCropMode(e.target.value as CropMode)}
                className="h-9 w-full text-sm rounded-md border bg-transparent px-3"
              >
                {CROP_MODES.map((m) => (
                  <option key={m} value={m}>{CROP_MODE_LABELS[m]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              onClick={handleGenerate}
              disabled={isProcessing || !imageEl || selectedFormats.length === 0}
              className="gap-1.5"
            >
              {isProcessing ? (
                <RotateCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Layers className="h-3.5 w-3.5" />
              )}
              {isProcessing ? "Generating…" : `Generate ${selectedFormats.length} image(s)`}
            </Button>
            <ShareButton
              getUrl={() => buildShareUrl(selectedFormats, outputFormat, quality, cropMode)}
              disabled={selectedFormats.length === 0}
            />
            <ClearButton onClick={handleClear} />
          </div>
        </CardContent>
      </Card>

      {outputs.length > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ImageIcon className="h-4 w-4" /> {stats.total} image(s) generated
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total outputs" value={stats.total} />
                <Stat label="Est. total size" value={formatBytes(stats.totalEstimatedSize)} />
                <Stat label="Platforms" value={Object.values(stats.byPlatform).filter((n) => n > 0).length} />
                <Stat label="Output format" value={OUTPUT_FORMAT_LABELS[outputFormat]} />
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button onClick={downloadAllZip} variant="default" size="sm" className="gap-1.5">
                  <Package className="h-3.5 w-3.5" /> Download all as ZIP
                </Button>
                <CopyButton
                  getText={() => renderText(outputs.map((o) => o.result))}
                  label="Copy report"
                />
                <DownloadButton
                  getText={() => renderText(outputs.map((o) => o.result))}
                  filename="resize-report.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => renderCsv(outputs.map((o) => o.result))}
                  filename="resize-report.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Download className="h-4 w-4" /> Generated images
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {outputs.map((o, i) => (
                  <div key={i} className="rounded-lg border bg-background p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-foreground">{o.result.label}</div>
                      <Badge variant="outline" className="text-[10px]">
                        {PLATFORM_LABELS[o.result.platform]}
                      </Badge>
                    </div>
                    {o.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={o.url}
                        alt={o.result.label}
                        className="w-full h-32 object-contain rounded bg-muted/30"
                      />
                    ) : (
                      <div className="w-full h-32 flex items-center justify-center bg-muted/30 rounded text-xs text-muted-foreground">
                        Not available
                      </div>
                    )}
                    <div className="text-[10px] text-muted-foreground space-y-0.5">
                      <div>{o.result.width}×{o.result.height}px · {o.result.outputFormat.toUpperCase()} · q{o.result.quality}</div>
                      <div>
                        ~{formatBytes(o.result.estimatedSize)} est.
                        {o.blob ? ` · ${formatBytes(o.blob.size)} actual` : ""}
                      </div>
                      <div>Quality score: <span className="font-mono">{o.qualityScore}/100</span></div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-1.5"
                      onClick={() => downloadOutput(o)}
                      disabled={!o.blob}
                    >
                      <Download className="h-3 w-3" /> Download
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : imageEl ? (
        <EmptyState
          title="Select formats and click Generate"
          hint={`Image loaded (${imageMeta?.width}×${imageMeta?.height}). Pick your target platforms above, then click Generate to produce resized images.`}
          icon={<Layers className="h-8 w-8" />}
        />
      ) : (
        <EmptyState
          title="Upload an image to start"
          hint="Drag & drop or browse for an image. The tool will generate resized versions for each selected platform/format combo. All processing runs locally in your browser."
          icon={<ImageIcon className="h-8 w-8" />}
        />
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length}/20)
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1 max-h-[200px] overflow-auto">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-foreground truncate">{h.fileName}</span>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {new Date(h.ts).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <Badge variant="outline" className="text-[10px]">{h.width}×{h.height}</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.totalOutputs} outputs</Badge>
                    <Badge variant="outline" className="text-[10px]">{formatBytes(h.totalEstimatedSize)} est.</Badge>
                    <Badge variant="outline" className="text-[10px]">{OUTPUT_FORMAT_LABELS[h.outputFormat]} q{h.quality}</Badge>
                    <Badge variant="outline" className="text-[10px]">{h.cropMode}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All image resizing runs locally in your browser via the Canvas API. Images never leave your device. History is stored in localStorage on this device only.
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
