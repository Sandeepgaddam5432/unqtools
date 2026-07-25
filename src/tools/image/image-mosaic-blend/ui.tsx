"use client";

import React, { useState, useCallback, useRef, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  alphaBlend,
  fadeBlend,
  fadeWeights,
  blendAt,
  validateSameSize,
  validateBlendOptions,
  findPreset,
  PRESETS,
  type MosaicPixel,
  type BlendOptions,
  type BlendMode,
  type OutputFormat,
} from "./logic";
import { toast } from "sonner";

export default function ImageMosaicBlend() {
  const [images, setImages] = useState<HTMLImageElement[]>([]);
  const [fileName, setFileName] = useState("mosaic-blend.png");
  const [opts, setOpts] = useState<BlendOptions>({
    mode: "fade", weight: 0.5, feather: 10, gradientDir: "horizontal",
  });
  const [format, setFormat] = useState<OutputFormat>("image/png");
  const [quality, setQuality] = useState(0.9);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const sizes = useMemo(
    () => images.map((i) => ({ width: i.naturalWidth, height: i.naturalHeight })),
    [images],
  );
  const dim = useMemo(() => validateSameSize(sizes), [sizes]);

  const onFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const loaded: HTMLImageElement[] = [];
    let pending = files.length;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) { pending--; return; }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        loaded.push(img);
        pending--;
        if (pending === 0) { setImages((prev) => [...prev, ...loaded]); setError(null); }
      };
      img.onerror = () => { pending--; };
      img.src = url;
    });
  }, []);

  const blend = useCallback(() => {
    if (images.length === 0 || !canvasRef.current) return;
    if ("error" in dim) { setError(dim.error); return; }
    const v = validateBlendOptions(opts);
    if ("error" in v) { setError(v.error); return; }
    setError(null);
    const canvas = canvasRef.current;
    canvas.width = dim.width;
    canvas.height = dim.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pixels: Uint8ClampedArray[] = [];
    for (const img of images) {
      const off = document.createElement("canvas");
      off.width = dim.width;
      off.height = dim.height;
      const octx = off.getContext("2d");
      if (!octx) continue;
      octx.drawImage(img, 0, 0, dim.width, dim.height);
      pixels.push(octx.getImageData(0, 0, dim.width, dim.height).data);
    }
    if (pixels.length === 0) return;
    const out = ctx.createImageData(dim.width, dim.height);
    for (let i = 0; i < out.data.length; i += 4) {
      const x = (i / 4) % dim.width;
      const y = Math.floor((i / 4) / dim.width);
      let acc: MosaicPixel = { r: 0, g: 0, b: 0, a: 0 };
      for (let k = 0; k < pixels.length; k++) {
        const px: MosaicPixel = { r: pixels[k][i]!, g: pixels[k][i + 1]!, b: pixels[k][i + 2]!, a: pixels[k][i + 3]! };
        acc = k === 0 ? px : blendAt(acc, px, x, y, dim.width, dim.height, opts);
      }
      out.data[i] = acc.r; out.data[i + 1] = acc.g; out.data[i + 2] = acc.b; out.data[i + 3] = acc.a;
    }
    ctx.putImageData(out, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      toast.success("Mosaic blend complete");
    }, format, format === "image/png" ? undefined : quality);
  }, [images, dim, opts, format, quality, previewUrl]);

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
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Add images</Button>
      </CardContent></Card>
      {images.length > 0 && (
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
            <Label className="text-xs text-muted-foreground">Blend mode</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {(["alpha", "fade", "gradient", "feather"] as BlendMode[]).map((m) => (
                <Button key={m} size="sm" variant={opts.mode === m ? "default" : "outline"} onClick={() => setOpts({ ...opts, mode: m })}>{m}</Button>
              ))}
            </div>
          </div>
          {opts.mode === "fade" && (
            <div><Label className="text-xs text-muted-foreground">Weight: {Math.round(opts.weight * 100)}%</Label><input type="range" min={0} max={100} value={Math.round(opts.weight * 100)} onChange={(e) => setOpts({ ...opts, weight: Number(e.target.value) / 100 })} className="w-full" /></div>
          )}
          {opts.mode === "gradient" && (
            <div>
              <Label className="text-xs text-muted-foreground">Direction</Label>
              <div className="flex gap-1.5 mt-1">
                {(["horizontal", "vertical"] as const).map((d) => (
                  <Button key={d} size="sm" variant={opts.gradientDir === d ? "default" : "outline"} onClick={() => setOpts({ ...opts, gradientDir: d })}>{d}</Button>
                ))}
              </div>
            </div>
          )}
          {opts.mode === "feather" && (
            <div><Label className="text-xs text-muted-foreground">Feather radius: {opts.feather}px</Label><input type="range" min={0} max={200} value={opts.feather} onChange={(e) => setOpts({ ...opts, feather: Number(e.target.value) })} className="w-full" /></div>
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
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" onClick={blend}>Blend ({images.length})</Button>
            <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
            <CopyButton getText={() => JSON.stringify(opts)} label="Copy settings" disabled={!previewUrl} />
            <DownloadButton getText={() => previewUrl ?? ""} filename={fileName} disabled={!previewUrl} mime={format} />
            <Button variant="ghost" size="sm" onClick={() => { setImages([]); setPreviewUrl(null); }} disabled={images.length === 0}>Clear</Button>
          </div>
          {!("error" in dim) && <Badge variant="secondary">{dim.width}×{dim.height}px · {images.length} images</Badge>}
        </CardContent></Card>
      )}
      {error && <ErrorBanner message={error} />}
      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card><CardContent className="p-4"><img src={previewUrl} alt="Mosaic blend" className="max-w-full rounded-md border" /></CardContent></Card>
      )}
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all blending runs locally via the Canvas API.</p></CardContent></Card>
    </div>
  );
}
