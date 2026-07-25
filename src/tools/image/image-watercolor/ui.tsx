"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  validateWatercolor,
  windowAverage,
  watercolorPixel,
  paperNoise,
  meanDelta,
  findPreset,
  PRESETS,
  DEFAULT_OPTIONS,
  type WatercolorOptions,
  type OutputFormat,
} from "./logic";
import { toast } from "sonner";

export default function ImageWatercolor() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("watercolor.png");
  const [opts, setOpts] = useState<WatercolorOptions>(DEFAULT_OPTIONS);
  const [format, setFormat] = useState<OutputFormat>("image/png");
  const [quality, setQuality] = useState(0.9);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [delta, setDelta] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const img = new Image();
    img.onload = () => { setImage(img); setFileName(file.name.replace(/\.[^.]+$/, "") + "-watercolor.png"); setError(null); setDelta(null); };
    img.onerror = () => setError("Could not load image");
    img.src = URL.createObjectURL(file);
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const v = validateWatercolor(opts);
    if ("error" in v) { setError(v.error); return; }
    setError(null); setBusy(true);
    try {
      const canvas = canvasRef.current;
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(image, 0, 0);
      const src = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const px = src.data;
      const w = canvas.width, h = canvas.height;
      const original = new Uint8ClampedArray(px);
      const out = new Uint8ClampedArray(px.length);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const avg = windowAverage(px, w, h, x, y, v.radius);
          const i = (y * w + x) * 4;
          const noise = paperNoise(x, y, v.seed);
          const result = watercolorPixel([px[i]!, px[i + 1]!, px[i + 2]!, px[i + 3]!], avg, v, noise);
          out[i] = result[0]; out[i + 1] = result[1]; out[i + 2] = result[2]; out[i + 3] = result[3];
        }
      }
      setDelta(meanDelta(original, out));
      src.data.set(out);
      ctx.putImageData(src, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) return;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(blob));
        setBusy(false);
      }, format, format === "image/png" ? undefined : quality);
    } catch {
      setError("Watercolor failed — image may be too large");
      setBusy(false);
    }
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
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Choose image</Button>
      </CardContent></Card>
      {image && (
        <Card><CardContent className="p-4 space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Brush radius: {opts.radius}px</Label>
            <input type="range" min={1} max={10} value={opts.radius} onChange={(e) => setOpts({ ...opts, radius: Number(e.target.value) })} className="w-full" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Color spread: {Math.round(opts.spread * 100)}%</Label>
            <input type="range" min={0} max={100} value={Math.round(opts.spread * 100)} onChange={(e) => setOpts({ ...opts, spread: Number(e.target.value) / 100 })} className="w-full" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Edge soften: {Math.round(opts.soften * 100)}%</Label>
            <input type="range" min={0} max={100} value={Math.round(opts.soften * 100)} onChange={(e) => setOpts({ ...opts, soften: Number(e.target.value) / 100 })} className="w-full" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Paper texture: {Math.round(opts.paper * 100)}%</Label>
            <input type="range" min={0} max={100} value={Math.round(opts.paper * 100)} onChange={(e) => setOpts({ ...opts, paper: Number(e.target.value) / 100 })} className="w-full" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Wet/dry balance: {Math.round(opts.wet * 100)}%</Label>
            <input type="range" min={0} max={100} value={Math.round(opts.wet * 100)} onChange={(e) => setOpts({ ...opts, wet: Number(e.target.value) / 100 })} className="w-full" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Pigment density: {opts.pigment.toFixed(2)}</Label>
            <input type="range" min={0} max={200} value={Math.round(opts.pigment * 100)} onChange={(e) => setOpts({ ...opts, pigment: Number(e.target.value) / 100 })} className="w-full" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Seed: {opts.seed}</Label>
            <input type="range" min={1} max={20} value={opts.seed} onChange={(e) => setOpts({ ...opts, seed: Number(e.target.value) })} className="w-full" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Presets</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {PRESETS.map((p) => (
                <Button key={p.id} variant="outline" size="sm" onClick={() => applyPreset(p.id)}>{p.label}</Button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Format</Label>
            <select value={format} onChange={(e) => setFormat(e.target.value as OutputFormat)} className="h-9 rounded-md border bg-background px-3 text-sm">
              <option value="image/png">PNG</option>
              <option value="image/jpeg">JPEG</option>
              <option value="image/webp">WebP</option>
            </select>
          </div>
          {format !== "image/png" && (
            <div>
              <Label className="text-xs text-muted-foreground">Quality: {Math.round(quality * 100)}%</Label>
              <input type="range" min={10} max={100} value={Math.round(quality * 100)} onChange={(e) => setQuality(Number(e.target.value) / 100)} className="w-32" />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={apply} disabled={busy}>{busy ? "Painting…" : "Apply watercolor"}</Button>
            <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
            <CopyButton getText={() => JSON.stringify(opts)} label="Copy settings" disabled={!previewUrl} />
            <DownloadButton getText={() => previewUrl ?? ""} filename={fileName} disabled={!previewUrl} mime={format} />
          </div>
          {delta !== null && <p className="text-xs text-muted-foreground">Mean pixel delta: {delta.toFixed(2)}</p>}
        </CardContent></Card>
      )}
      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-2">Preview</p>
          <img src={previewUrl} alt="Watercolor preview" className="max-w-full rounded-md border" />
        </CardContent></Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Privacy:</strong> watercolor runs locally via the Canvas API.
        </p>
      </CardContent></Card>
    </div>
  );
}
