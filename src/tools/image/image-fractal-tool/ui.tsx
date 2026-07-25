"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  escapeIterations,
  smoothEscape,
  iterToColor,
  pixelToComplex,
  validateFractalOptions,
  findPreset,
  PRESETS,
  type FractalOptions,
  type FractalPalette,
  type OutputFormat,
} from "./logic";
import { toast } from "sonner";

const PALETTES: FractalPalette[] = ["default", "fire", "ocean", "grayscale"];

export default function ImageFractalTool() {
  const [fileName, setFileName] = useState("fractal.png");
  const [size, setSize] = useState(256);
  const [opts, setOpts] = useState<FractalOptions>({
    cx: -0.5, cy: 0, zoom: 1, maxIter: 128, julia: false, jx: -0.7, jy: 0.27,
    escape: 4, palette: "default", smooth: false,
  });
  const [format, setFormat] = useState<OutputFormat>("image/png");
  const [quality, setQuality] = useState(0.9);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const apply = useCallback(() => {
    const v = validateFractalOptions(opts);
    if ("error" in v) { setError(v.error); return; }
    setError(null);
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(size, size);
    const px = img.data;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const c = pixelToComplex(x, y, size, size, opts);
        const iter = opts.smooth ? smoothEscape(c.x, c.y, opts) : escapeIterations(c.x, c.y, opts);
        const col = iterToColor(iter, opts.maxIter, opts.palette);
        const i = (y * size + x) * 4;
        px[i] = col.r; px[i + 1] = col.g; px[i + 2] = col.b; px[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    }, format, format === "image/png" ? undefined : quality);
  }, [size, opts, format, quality, previewUrl]);

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

  const applyPreset = useCallback((id: string) => {
    const p = findPreset(id);
    if (p) {
      setOpts(p.options);
      toast.success(`Preset: ${p.label}`);
    }
  }, []);

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 space-y-3">
        <div>
          <Label className="text-xs text-muted-foreground">Presets</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {PRESETS.map((p) => (
              <Button key={p.id} variant="outline" size="sm" onClick={() => applyPreset(p.id)}>{p.label}</Button>
            ))}
          </div>
        </div>
        <div><Label className="text-xs text-muted-foreground">Size: {size}px</Label><input type="range" min={64} max={512} step={32} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-full" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs text-muted-foreground">Center X</Label><input type="number" step="0.01" value={opts.cx} onChange={(e) => setOpts({ ...opts, cx: Number(e.target.value) })} className="w-full h-9 rounded-md border bg-background px-3 text-sm" /></div>
          <div><Label className="text-xs text-muted-foreground">Center Y</Label><input type="number" step="0.01" value={opts.cy} onChange={(e) => setOpts({ ...opts, cy: Number(e.target.value) })} className="w-full h-9 rounded-md border bg-background px-3 text-sm" /></div>
        </div>
        <div><Label className="text-xs text-muted-foreground">Zoom: {opts.zoom}x</Label><input type="range" min={0.1} max={100} step={0.1} value={opts.zoom} onChange={(e) => setOpts({ ...opts, zoom: Number(e.target.value) })} className="w-full" /></div>
        <div><Label className="text-xs text-muted-foreground">Max iterations: {opts.maxIter}</Label><input type="range" min={16} max={1024} step={16} value={opts.maxIter} onChange={(e) => setOpts({ ...opts, maxIter: Number(e.target.value) })} className="w-full" /></div>
        <div>
          <Label className="text-xs text-muted-foreground">Palette</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {PALETTES.map((p) => (
              <Button key={p} size="sm" variant={opts.palette === p ? "default" : "outline"} onClick={() => setOpts({ ...opts, palette: p })}>{p}</Button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={opts.julia} onChange={(e) => setOpts({ ...opts, julia: e.target.checked })} />
          Julia mode
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={opts.smooth} onChange={(e) => setOpts({ ...opts, smooth: e.target.checked })} />
          Smooth coloring
        </label>
        {opts.julia && (
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs text-muted-foreground">Julia X</Label><input type="number" step="0.01" value={opts.jx} onChange={(e) => setOpts({ ...opts, jx: Number(e.target.value) })} className="w-full h-9 rounded-md border bg-background px-3 text-sm" /></div>
            <div><Label className="text-xs text-muted-foreground">Julia Y</Label><input type="number" step="0.01" value={opts.jy} onChange={(e) => setOpts({ ...opts, jy: Number(e.target.value) })} className="w-full h-9 rounded-md border bg-background px-3 text-sm" /></div>
          </div>
        )}
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
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" onClick={apply}>Generate fractal</Button>
          <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
          <CopyButton getText={() => JSON.stringify(opts)} label="Copy settings" disabled={!previewUrl} />
          <DownloadButton getText={() => previewUrl ?? ""} filename={fileName} disabled={!previewUrl} mime={format} />
        </div>
      </CardContent></Card>
      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-2">Preview</p>
          <img src={previewUrl} alt="Fractal preview" className="max-w-full rounded-md border" />
        </CardContent></Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> fractal rendering runs locally via the Canvas API.</p></CardContent></Card>
    </div>
  );
}
