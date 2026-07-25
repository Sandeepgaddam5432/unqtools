"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  vignetteFactor,
  applyVignette,
  validateVignetteOptions,
  findPreset,
  PRESETS,
  type VignetteOptions,
  type VignetteShape,
  type BlendMode,
  type OutputFormat,
} from "./logic";
import { toast } from "sonner";

const rgbToHex = (rgb: [number, number, number]) =>
  "#" + rgb.map((c) => c.toString(16).padStart(2, "0")).join("");
const hexToRgb = (hex: string): [number, number, number] => {
  const m = hex.replace("#", "");
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
};

export default function ImageVignetteTool() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("vignette.png");
  const [opts, setOpts] = useState<VignetteOptions>({
    amount: 80, size: 20, feather: 60, offsetX: 0, offsetY: 0,
    shape: "ellipse", color: [0, 0, 0], blend: "multiply",
  });
  const [colorHex, setColorHex] = useState(rgbToHex([0, 0, 0]));
  const [format, setFormat] = useState<OutputFormat>("image/png");
  const [quality, setQuality] = useState(0.9);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setImage(img); setFileName(file.name.replace(/\.[^.]+$/, "") + "-vignette.png"); setError(null); setPreviewUrl(null); };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const finalOpts = { ...opts, color: hexToRgb(colorHex) };
    const v = validateVignetteOptions(finalOpts);
    if ("error" in v) { setError(v.error); return; }
    setError(null);
    const canvas = canvasRef.current;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = data.data;
    const w = canvas.width, h = canvas.height;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const f = vignetteFactor(x, y, w, h, finalOpts);
        const out = applyVignette({ r: px[i]!, g: px[i + 1]!, b: px[i + 2]!, a: px[i + 3]! }, f, finalOpts.color, finalOpts.blend);
        px[i] = out.r; px[i + 1] = out.g; px[i + 2] = out.b;
      }
    }
    ctx.putImageData(data, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    }, format, format === "image/png" ? undefined : quality);
  }, [image, opts, colorHex, format, quality, previewUrl]);

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
      setColorHex(rgbToHex(p.options.color));
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
          <div><Label className="text-xs text-muted-foreground">Amount: {opts.amount}%</Label><input type="range" min={0} max={100} value={opts.amount} onChange={(e) => setOpts({ ...opts, amount: Number(e.target.value) })} className="w-full" /></div>
          <div><Label className="text-xs text-muted-foreground">Center size: {opts.size}%</Label><input type="range" min={0} max={100} value={opts.size} onChange={(e) => setOpts({ ...opts, size: Number(e.target.value) })} className="w-full" /></div>
          <div><Label className="text-xs text-muted-foreground">Feather: {opts.feather}%</Label><input type="range" min={0} max={100} value={opts.feather} onChange={(e) => setOpts({ ...opts, feather: Number(e.target.value) })} className="w-full" /></div>
          <div><Label className="text-xs text-muted-foreground">Offset X: {opts.offsetX.toFixed(2)}</Label><input type="range" min={-50} max={50} value={Math.round(opts.offsetX * 100)} onChange={(e) => setOpts({ ...opts, offsetX: Number(e.target.value) / 100 })} className="w-full" /></div>
          <div><Label className="text-xs text-muted-foreground">Offset Y: {opts.offsetY.toFixed(2)}</Label><input type="range" min={-50} max={50} value={Math.round(opts.offsetY * 100)} onChange={(e) => setOpts({ ...opts, offsetY: Number(e.target.value) / 100 })} className="w-full" /></div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Shape</Label>
              <select value={opts.shape} onChange={(e) => setOpts({ ...opts, shape: e.target.value as VignetteShape })} className="h-9 rounded-md border bg-background px-3 text-sm">
                <option value="ellipse">Ellipse</option>
                <option value="circle">Circle</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Blend</Label>
              <select value={opts.blend} onChange={(e) => setOpts({ ...opts, blend: e.target.value as BlendMode })} className="h-9 rounded-md border bg-background px-3 text-sm">
                <option value="multiply">Multiply</option>
                <option value="screen">Screen</option>
                <option value="overlay">Overlay</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Color</Label>
              <input type="color" value={colorHex} onChange={(e) => setColorHex(e.target.value)} className="h-8 w-12 rounded border" />
            </div>
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
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={apply}>Apply vignette</Button>
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
          <img src={previewUrl} alt="Vignette preview" className="max-w-full rounded-md border" />
        </CardContent></Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Privacy:</strong> vignette rendering runs locally via the Canvas API.
        </p>
      </CardContent></Card>
    </div>
  );
}
