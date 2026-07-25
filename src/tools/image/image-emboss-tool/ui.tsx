"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  embossKernel,
  embossKernel5,
  applyKernel,
  blendChannel,
  validateEmbossOptions,
  findPreset,
  PRESETS,
  type EmbossDirection,
  type EmbossOptions,
  type BlendMode,
  type KernelSize,
  type OutputFormat,
} from "./logic";
import { toast } from "sonner";

const DIRS: EmbossDirection[] = ["top", "bottom", "left", "right", "topleft", "topright", "bottomleft", "bottomright"];

export default function ImageEmbossTool() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("embossed.png");
  const [opts, setOpts] = useState<EmbossOptions>({
    direction: "topleft", amount: 100, depth: 3, blend: "replace", baseline: 128,
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
    img.onload = () => { setImage(img); setFileName(file.name.replace(/\.[^.]+$/, "") + "-embossed.png"); setError(null); setPreviewUrl(null); };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const v = validateEmbossOptions(opts);
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
    const k = opts.depth === 5 ? embossKernel5(opts.direction) : embossKernel(opts.direction);
    const radius = opts.depth === 5 ? 2 : 1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        for (let c = 0; c < 3; c++) {
          const center = s[(y * w + x) * 4 + c]!;
          const neighbors: number[] = [];
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dy === 0 && dx === 0) continue;
              const sx = Math.max(0, Math.min(w - 1, x + dx * (radius > 1 ? 2 : 1)));
              const sy = Math.max(0, Math.min(h - 1, y + dy * (radius > 1 ? 2 : 1)));
              neighbors.push(s[(sy * w + sx) * 4 + c]!);
            }
          }
          const emb = applyKernel(opts.depth === 5 ? embossKernel(opts.direction) : k, center, neighbors, opts.amount, opts.baseline);
          d[(y * w + x) * 4 + c] = blendChannel(center, emb, opts.blend);
        }
        d[(y * w + x) * 4 + 3] = s[(y * w + x) * 4 + 3]!;
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
            <Label className="text-xs text-muted-foreground">Presets</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {PRESETS.map((p) => (
                <Button key={p.id} variant="outline" size="sm" onClick={() => applyPreset(p.id)}>{p.label}</Button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Direction</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {DIRS.map((dir) => (
                <Button key={dir} size="sm" variant={opts.direction === dir ? "default" : "outline"} onClick={() => setOpts({ ...opts, direction: dir })}>{dir}</Button>
              ))}
            </div>
          </div>
          <div><Label className="text-xs text-muted-foreground">Amount: {opts.amount}</Label><input type="range" min={0} max={200} value={opts.amount} onChange={(e) => setOpts({ ...opts, amount: Number(e.target.value) })} className="w-full" /></div>
          <div><Label className="text-xs text-muted-foreground">Baseline: {opts.baseline}</Label><input type="range" min={0} max={255} value={opts.baseline} onChange={(e) => setOpts({ ...opts, baseline: Number(e.target.value) })} className="w-full" /></div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Depth</Label>
              <select value={opts.depth} onChange={(e) => setOpts({ ...opts, depth: Number(e.target.value) as KernelSize })} className="h-9 rounded-md border bg-background px-3 text-sm">
                <option value={3}>3x3</option>
                <option value={5}>5x5</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Blend</Label>
              <select value={opts.blend} onChange={(e) => setOpts({ ...opts, blend: e.target.value as BlendMode })} className="h-9 rounded-md border bg-background px-3 text-sm">
                <option value="replace">Replace</option>
                <option value="overlay">Overlay</option>
              </select>
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
            <Button size="sm" onClick={apply}>Emboss</Button>
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
          <img src={previewUrl} alt="Embossed preview" className="max-w-full rounded-md border" />
        </CardContent></Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> emboss runs locally via Canvas API.</p></CardContent></Card>
    </div>
  );
}
