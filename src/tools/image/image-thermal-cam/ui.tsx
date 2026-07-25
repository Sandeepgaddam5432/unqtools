"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  validateThermal,
  thermalPixel,
  findPreset,
  PRESETS,
  type ThermalOptions,
  type HeatPalette,
  type OutputFormat,
} from "./logic";
import { toast } from "sonner";

const PALETTES: HeatPalette[] = ["iron", "rainbow", "grayscale", "thermal"];

export default function ImageThermalCam() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("thermal.png");
  const [opts, setOpts] = useState<ThermalOptions>({
    contrast: 1.2, invert: false, palette: "thermal", intensity: 1, threshold: 0,
  });
  const [format, setFormat] = useState<OutputFormat>("image/png");
  const [quality, setQuality] = useState(0.9);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const img = new Image();
    img.onload = () => { setImage(img); setFileName(file.name.replace(/\.[^.]+$/, "") + "-thermal.png"); setError(null); setPreviewUrl(null); };
    img.onerror = () => setError("Could not load image");
    img.src = URL.createObjectURL(file);
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const v = validateThermal(opts);
    if ("error" in v) { setError(v.error); return; }
    setError(null);
    const canvas = canvasRef.current;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0);
    const src = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = src.data;
    for (let i = 0; i < px.length; i += 4) {
      const [r, g, b] = thermalPixel(px[i]!, px[i + 1]!, px[i + 2]!, v);
      px[i] = r; px[i + 1] = g; px[i + 2] = b;
    }
    ctx.putImageData(src, 0, 0);
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

  const applyPreset = useCallback((id: string) => {
    const p = findPreset(id);
    if (p) {
      setOpts((o) => ({ ...o, ...p.options }));
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
            <Label className="text-xs text-muted-foreground">Presets</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {PRESETS.map((p) => (
                <Button key={p.id} variant="outline" size="sm" onClick={() => applyPreset(p.id)}>{p.label}</Button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Palette</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {PALETTES.map((p) => (
                <Button key={p} size="sm" variant={opts.palette === p ? "default" : "outline"} onClick={() => setOpts({ ...opts, palette: p })}>{p}</Button>
              ))}
            </div>
          </div>
          <div><Label className="text-xs text-muted-foreground">Contrast: {opts.contrast.toFixed(2)}</Label><input type="range" min={50} max={200} value={Math.round(opts.contrast * 100)} onChange={(e) => setOpts({ ...opts, contrast: Number(e.target.value) / 100 })} className="w-full" /></div>
          <div><Label className="text-xs text-muted-foreground">Intensity: {opts.intensity.toFixed(2)}</Label><input type="range" min={50} max={200} value={Math.round(opts.intensity * 100)} onChange={(e) => setOpts({ ...opts, intensity: Number(e.target.value) / 100 })} className="w-full" /></div>
          <div><Label className="text-xs text-muted-foreground">Threshold: {Math.round(opts.threshold * 100)}%</Label><input type="range" min={0} max={100} value={Math.round(opts.threshold * 100)} onChange={(e) => setOpts({ ...opts, threshold: Number(e.target.value) / 100 })} className="w-full" /></div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={opts.invert} onChange={(e) => setOpts({ ...opts, invert: e.target.checked })} />
            Invert palette (cold = bright)
          </label>
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
            <Button size="sm" onClick={apply}>Apply thermal</Button>
            <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
            <CopyButton getText={() => JSON.stringify(opts)} label="Copy settings" disabled={!previewUrl} />
            <DownloadButton getText={() => previewUrl ?? ""} filename={fileName} disabled={!previewUrl} mime={format} />
          </div>
        </CardContent></Card>
      )}
      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-2">Preview</p>
          <img src={previewUrl} alt="Thermal preview" className="max-w-full rounded-md border" />
        </CardContent></Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Privacy:</strong> thermal mapping runs locally via the Canvas API.
        </p>
      </CardContent></Card>
    </div>
  );
}
