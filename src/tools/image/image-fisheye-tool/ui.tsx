"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  mapPixel,
  bilinearSample,
  validateFisheyeOptions,
  findPreset,
  PRESETS,
  type FisheyeOptions,
  type FisheyeMode,
  type OutputFormat,
} from "./logic";
import { toast } from "sonner";

export default function ImageFisheyeTool() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("fisheye.png");
  const [opts, setOpts] = useState<FisheyeOptions>({
    strength: 0.4, zoom: 1, offsetX: 0, offsetY: 0, mode: "barrel",
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
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setImage(img); setFileName(file.name.replace(/\.[^.]+$/, "") + "-fisheye.png"); setError(null); setPreviewUrl(null); };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const v = validateFisheyeOptions(opts);
    if ("error" in v) { setError(v.error); return; }
    setError(null);
    const canvas = canvasRef.current;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0);
    const src = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const dst = ctx.createImageData(canvas.width, canvas.height);
    const s = src.data, d = dst.data, w = canvas.width, h = canvas.height;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const m = mapPixel(x, y, w, h, opts);
        const [r, g, b, a] = bilinearSample(s, w, h, m.x, m.y);
        const i = (y * w + x) * 4;
        d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a;
      }
    }
    ctx.putImageData(dst, 0, 0);
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
            <Label className="text-xs text-muted-foreground">Mode</Label>
            <div className="flex gap-1.5 mt-1">
              {(["barrel", "pincushion"] as FisheyeMode[]).map((m) => (
                <Button key={m} size="sm" variant={opts.mode === m ? "default" : "outline"} onClick={() => setOpts({ ...opts, mode: m })}>{m}</Button>
              ))}
            </div>
          </div>
          <div><Label className="text-xs text-muted-foreground">Strength: {opts.strength.toFixed(2)}</Label><input type="range" min={0} max={1} step={0.05} value={opts.strength} onChange={(e) => setOpts({ ...opts, strength: Number(e.target.value) })} className="w-full" /></div>
          <div><Label className="text-xs text-muted-foreground">Zoom: {opts.zoom.toFixed(2)}</Label><input type="range" min={0.5} max={2} step={0.05} value={opts.zoom} onChange={(e) => setOpts({ ...opts, zoom: Number(e.target.value) })} className="w-full" /></div>
          <div><Label className="text-xs text-muted-foreground">Offset X: {opts.offsetX.toFixed(2)}</Label><input type="range" min={-50} max={50} value={Math.round(opts.offsetX * 100)} onChange={(e) => setOpts({ ...opts, offsetX: Number(e.target.value) / 100 })} className="w-full" /></div>
          <div><Label className="text-xs text-muted-foreground">Offset Y: {opts.offsetY.toFixed(2)}</Label><input type="range" min={-50} max={50} value={Math.round(opts.offsetY * 100)} onChange={(e) => setOpts({ ...opts, offsetY: Number(e.target.value) / 100 })} className="w-full" /></div>
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
            <Button size="sm" onClick={apply}>Apply fisheye</Button>
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
          <img src={previewUrl} alt="Fisheye preview" className="max-w-full rounded-md border" />
        </CardContent></Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4">
        <p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> fisheye distortion runs locally via Canvas API.</p>
      </CardContent></Card>
    </div>
  );
}
