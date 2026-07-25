"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  quantize,
  bayerThreshold,
  validateDitherOptions,
  errorDiffusion,
  floydSteinbergKernel,
  atkinsonKernel,
  jarvisKernel,
  stuckiKernel,
  thresholdDither,
  nearestPaletteColor,
  getPalette,
  ditherStats,
  PALETTES,
  type DitherMode,
  type DitherOptions,
  type OutputFormat,
} from "./logic";
import { toast } from "sonner";

const MODES: DitherMode[] = ["floyd-steinberg", "atkinson", "jarvis", "stucki", "bayer", "random", "threshold"];

export default function ImageDitherTool() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("dithered.png");
  const [opts, setOpts] = useState<DitherOptions>({ mode: "floyd-steinberg", levels: 2, threshold: 128, palette: "mono" });
  const [format, setFormat] = useState<OutputFormat>("image/png");
  const [quality, setQuality] = useState(0.9);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ onRatio: number; meanLuma: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setImage(img); setFileName(file.name.replace(/\.[^.]+$/, "") + "-dithered.png"); setError(null); setPreviewUrl(null); setStats(null); };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const v = validateDitherOptions(opts);
    if ("error" in v) { setError(v.error); return; }
    setError(null);
    const canvas = canvasRef.current;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = data.data, w = canvas.width, h = canvas.height;
    const palette = getPalette(opts.palette);
    const usePalette = opts.palette !== "mono";

    if (["floyd-steinberg", "atkinson", "jarvis", "stucki"].includes(opts.mode)) {
      const buf = new Float32Array(w * h * 3);
      for (let i = 0, j = 0; i < px.length; i += 4, j += 3) {
        buf[j] = px[i]!; buf[j + 1] = px[i + 1]!; buf[j + 2] = px[i + 2]!;
      }
      const kernel = opts.mode === "floyd-steinberg" ? floydSteinbergKernel()
        : opts.mode === "atkinson" ? atkinsonKernel()
        : opts.mode === "jarvis" ? jarvisKernel() : stuckiKernel();
      errorDiffusion(buf, w, h, opts.levels, kernel);
      for (let i = 0, j = 0; i < px.length; i += 4, j += 3) {
        if (usePalette) {
          const [r, g, b] = nearestPaletteColor(palette, buf[j]!, buf[j + 1]!, buf[j + 2]!);
          px[i] = r; px[i + 1] = g; px[i + 2] = b;
        } else {
          px[i] = buf[j]!; px[i + 1] = buf[j + 1]!; px[i + 2] = buf[j + 2]!;
        }
      }
    } else if (opts.mode === "bayer") {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const t = bayerThreshold(x, y);
          const step = 255 / Math.max(1, opts.levels - 1);
          for (let c = 0; c < 3; c++) {
            px[i + c] = quantize(px[i + c]! + step * (t - 0.5), opts.levels);
          }
          if (usePalette) {
            const [r, g, b] = nearestPaletteColor(palette, px[i]!, px[i + 1]!, px[i + 2]!);
            px[i] = r; px[i + 1] = g; px[i + 2] = b;
          }
        }
      }
    } else if (opts.mode === "random") {
      for (let i = 0; i < px.length; i += 4) {
        const step = 255 / Math.max(1, opts.levels - 1);
        for (let c = 0; c < 3; c++) {
          const noise = Math.random();
          px[i + c] = quantize(px[i + c]! + (noise - 0.5) * step, opts.levels);
        }
        if (usePalette) {
          const [r, g, b] = nearestPaletteColor(palette, px[i]!, px[i + 1]!, px[i + 2]!);
          px[i] = r; px[i + 1] = g; px[i + 2] = b;
        }
      }
    } else {
      for (let i = 0; i < px.length; i += 4) {
        const [r, g, b] = thresholdDither(px[i]!, px[i + 1]!, px[i + 2]!, opts.threshold);
        px[i] = r; px[i + 1] = g; px[i + 2] = b;
      }
    }
    setStats(ditherStats(px));
    ctx.putImageData(data, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    }, format, format === "image/png" ? undefined : quality);
  }, [image, opts, format, quality, previewUrl]);

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = fileName; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Image downloaded");
    }, format, format === "image/png" ? undefined : quality);
  }, [fileName, format, quality]);

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 space-y-3">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Choose image</Button>
      </CardContent></Card>
      {image && (
        <Card><CardContent className="p-4 space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Algorithm</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {MODES.map((m) => (
                <Button key={m} size="sm" variant={opts.mode === m ? "default" : "outline"} onClick={() => setOpts({ ...opts, mode: m })}>{m}</Button>
              ))}
            </div>
          </div>
          <div><Label className="text-xs text-muted-foreground">Levels: {opts.levels}</Label><input type="range" min={2} max={16} step={1} value={opts.levels} onChange={(e) => setOpts({ ...opts, levels: Number(e.target.value) })} className="w-full" /></div>
          {opts.mode === "threshold" && (
            <div><Label className="text-xs text-muted-foreground">Threshold: {opts.threshold}</Label><input type="range" min={0} max={255} value={opts.threshold} onChange={(e) => setOpts({ ...opts, threshold: Number(e.target.value) })} className="w-full" /></div>
          )}
          <div>
            <Label className="text-xs text-muted-foreground">Color palette</Label>
            <select value={opts.palette} onChange={(e) => setOpts({ ...opts, palette: e.target.value })} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
              {Object.keys(PALETTES).map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Format</Label>
            <select value={format} onChange={(e) => setFormat(e.target.value as OutputFormat)} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
              <option value="image/png">PNG</option>
              <option value="image/jpeg">JPEG</option>
              <option value="image/webp">WebP</option>
            </select>
          </div>
          {format !== "image/png" && (
            <div><Label className="text-xs text-muted-foreground">Quality: {Math.round(quality * 100)}%</Label><input type="range" min={10} max={100} value={Math.round(quality * 100)} onChange={(e) => setQuality(Number(e.target.value) / 100)} className="w-32" /></div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={apply}>Dither</Button>
            <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
            <CopyButton getText={() => JSON.stringify(opts)} label="Copy settings" disabled={!previewUrl} />
            <DownloadButton getText={() => previewUrl ?? ""} filename={fileName} disabled={!previewUrl} mime={format} />
          </div>
          {stats && <p className="text-xs text-muted-foreground">On-ratio: {(stats.onRatio * 100).toFixed(1)}% · Mean luma: {stats.meanLuma.toFixed(1)}</p>}
        </CardContent></Card>
      )}
      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-2">Preview</p>
          <img src={previewUrl} alt="Dithered preview" className="max-w-full rounded-md border" />
        </CardContent></Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> dithering runs locally via Canvas API.</p></CardContent></Card>
    </div>
  );
}
