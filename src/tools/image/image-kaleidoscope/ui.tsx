"use client";

import React, { useState, useCallback, useRef, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  segmentAngle,
  toPolar,
  toCartesian,
  mapAngle,
  blendPixels,
  validateKaleidoscope,
  computeCenter,
  degToRad,
  findPreset,
  PRESETS,
  type KaleidoscopeOptions,
  type BlendMode,
  type OutputFormat,
} from "./logic";
import { toast } from "sonner";

const SEGMENTS = [2, 4, 6, 8, 12, 16];

export default function ImageKaleidoscope() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("kaleidoscope.png");
  const [opts, setOpts] = useState<KaleidoscopeOptions>({
    segments: 8, rotation: 0, mirror: true, blend: "overwrite", offsetX: 0, offsetY: 0,
  });
  const [format, setFormat] = useState<OutputFormat>("image/png");
  const [quality, setQuality] = useState(0.9);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const valid = useMemo(() => validateKaleidoscope(opts), [opts]);

  const onFile = useCallback((file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setImage(img); setFileName(file.name.replace(/\.[^.]+$/, "") + "-kaleidoscope.png"); setError(null); setPreviewUrl(null); };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    if ("error" in valid) { setError(valid.error); return; }
    setError(null);
    const size = Math.min(image.naturalWidth, image.naturalHeight);
    const canvas = canvasRef.current;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { cx, cy } = computeCenter(size, opts.offsetX, opts.offsetY);
    const rot = degToRad(opts.rotation);
    const src = document.createElement("canvas");
    src.width = size; src.height = size;
    const sctx = src.getContext("2d");
    if (!sctx) return;
    const sx = (image.naturalWidth - size) / 2;
    const sy = (image.naturalHeight - size) / 2;
    sctx.drawImage(image, sx, sy, size, size, 0, 0, size, size);
    const srcData = sctx.getImageData(0, 0, size, size);
    const out = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const p = toPolar(x, y, cx, cy);
        const srcTheta = mapAngle(p.theta, opts.segments, rot, opts.mirror);
        const sp = toCartesian(p.r, srcTheta, cx, cy);
        const sx2 = Math.round(sp.x);
        const sy2 = Math.round(sp.y);
        if (sx2 >= 0 && sx2 < size && sy2 >= 0 && sy2 < size) {
          const si = (sy2 * size + sx2) * 4;
          const di = (y * size + x) * 4;
          const a: [number, number, number] = [out.data[di]!, out.data[di + 1]!, out.data[di + 2]!];
          const b: [number, number, number] = [srcData.data[si]!, srcData.data[si + 1]!, srcData.data[si + 2]!];
          const blended = blendPixels(a, b, opts.blend);
          out.data[di] = blended[0]; out.data[di + 1] = blended[1]; out.data[di + 2] = blended[2]; out.data[di + 3] = 255;
        }
      }
    }
    ctx.putImageData(out, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      toast.success("Kaleidoscope generated");
    }, format, format === "image/png" ? undefined : quality);
  }, [image, opts, valid, format, quality, previewUrl]);

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
        <div>
          <Label className="text-xs text-muted-foreground">Presets</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {PRESETS.map((p) => (
              <Button key={p.id} variant="outline" size="sm" onClick={() => applyPreset(p.id)}>{p.label}</Button>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Segments</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {SEGMENTS.map((n) => (
              <Button key={n} variant={opts.segments === n ? "default" : "outline"} size="sm" onClick={() => setOpts({ ...opts, segments: n })}>{n}</Button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Segments: {opts.segments}</Label>
            <Input type="number" min={2} max={16} value={opts.segments} onChange={(e) => setOpts({ ...opts, segments: Number(e.target.value) || 2 })} className="w-24" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Rotation: {opts.rotation}°</Label>
            <input type="range" min={0} max={360} value={opts.rotation} onChange={(e) => setOpts({ ...opts, rotation: Number(e.target.value) })} className="w-40" />
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Offset X: {opts.offsetX.toFixed(2)}</Label>
            <input type="range" min={-50} max={50} value={Math.round(opts.offsetX * 100)} onChange={(e) => setOpts({ ...opts, offsetX: Number(e.target.value) / 100 })} className="w-40" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Offset Y: {opts.offsetY.toFixed(2)}</Label>
            <input type="range" min={-50} max={50} value={Math.round(opts.offsetY * 100)} onChange={(e) => setOpts({ ...opts, offsetY: Number(e.target.value) / 100 })} className="w-40" />
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={opts.mirror} onChange={(e) => setOpts({ ...opts, mirror: e.target.checked })} /> Mirror
          </label>
          <div>
            <Label className="text-xs text-muted-foreground">Blend</Label>
            <select value={opts.blend} onChange={(e) => setOpts({ ...opts, blend: e.target.value as BlendMode })} className="h-9 rounded-md border bg-background px-3 text-sm">
              <option value="overwrite">Overwrite</option>
              <option value="average">Average</option>
              <option value="additive">Additive</option>
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
          <Button size="sm" onClick={apply} disabled={!image}>Generate</Button>
          <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
          <CopyButton getText={() => JSON.stringify(opts)} label="Copy settings" disabled={!previewUrl} />
          <DownloadButton getText={() => previewUrl ?? ""} filename={fileName} disabled={!previewUrl} mime={format} />
        </div>
      </CardContent></Card>
      {error && <ErrorBanner message={error} />}
      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card><CardContent className="p-4">
          <img src={previewUrl} alt="Kaleidoscope preview" className="max-w-full rounded-md border" />
        </CardContent></Card>
      )}
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all processing runs locally via the Canvas API.</p></CardContent></Card>
    </div>
  );
}
