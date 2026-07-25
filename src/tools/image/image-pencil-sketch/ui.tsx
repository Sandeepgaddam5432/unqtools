"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  validateSketch,
  toGray,
  boxBlurGray,
  sketchPixel,
  sketchDelta,
  PRESETS,
  findPreset,
  DEFAULT_OPTIONS,
  type SketchOptions,
  type SketchMode,
} from "./logic";
import { toast } from "sonner";

const rgbToHex = (rgb: [number, number, number]) =>
  "#" + rgb.map((c) => c.toString(16).padStart(2, "0")).join("");
const hexToRgb = (hex: string): [number, number, number] => {
  const m = hex.replace("#", "");
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
};

export default function ImagePencilSketch() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("pencil-sketch.png");
  const [opts, setOpts] = useState<SketchOptions>(DEFAULT_OPTIONS);
  const [tintHex, setTintHex] = useState(rgbToHex(DEFAULT_OPTIONS.tint));
  const [format, setFormat] = useState<"image/png" | "image/jpeg" | "image/webp">("image/png");
  const [quality, setQuality] = useState(0.9);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [delta, setDelta] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file");
      return;
    }
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setFileName(file.name.replace(/\.[^.]+$/, "") + "-sketch.png");
      setError(null);
      setDelta(null);
    };
    img.onerror = () => setError("Could not load image");
    img.src = URL.createObjectURL(file);
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const finalOpts = { ...opts, tint: hexToRgb(tintHex) };
    const v = validateSketch(finalOpts);
    if ("error" in v) {
      setError(v.error);
      return;
    }
    setError(null);
    setBusy(true);
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
      const gray = toGray(px, w, h);
      const blurred = boxBlurGray(gray, w, h, v.radius);
      const original = new Uint8ClampedArray(px);
      for (let p = 0; p < gray.length; p++) {
        const x = p % w;
        const y = Math.floor(p / w);
        // Deterministic noise from coords
        const noise = (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
        const out = sketchPixel(gray[p]!, blurred[p]!, v, noise < 0 ? noise + 1 : noise);
        const i = p * 4;
        px[i] = out.r; px[i + 1] = out.g; px[i + 2] = out.b;
      }
      setDelta(sketchDelta(original, px));
      ctx.putImageData(src, 0, 0);
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          setPreviewUrl(URL.createObjectURL(blob));
          setBusy(false);
        },
        format,
        format === "image/png" ? undefined : quality,
      );
    } catch {
      setError("Sketch failed — image may be too large");
      setBusy(false);
    }
  }, [image, opts, tintHex, format, quality, previewUrl]);

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast.success("Image downloaded");
      },
      format,
      format === "image/png" ? undefined : quality,
    );
  }, [fileName, format, quality]);

  const applyPreset = useCallback((id: string) => {
    const p = findPreset(id);
    if (p) {
      setOpts(p.options);
      setTintHex(rgbToHex(p.options.tint));
      toast.success(`Preset: ${p.label}`);
    }
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Choose image</Button>
        </CardContent>
      </Card>
      {image && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Mode</Label>
              <select
                value={opts.mode}
                onChange={(e) => setOpts({ ...opts, mode: e.target.value as SketchMode })}
                className="h-9 rounded-md border bg-background px-3 text-sm"
              >
                <option value="graphite">Graphite</option>
                <option value="charcoal">Charcoal</option>
                <option value="colored">Colored</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Stroke intensity: {Math.round(opts.intensity * 100)}%</Label>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(opts.intensity * 100)}
                onChange={(e) => setOpts({ ...opts, intensity: Number(e.target.value) / 100 })}
                className="w-full"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Blur radius: {opts.radius}px</Label>
              <input
                type="range"
                min={1}
                max={20}
                value={opts.radius}
                onChange={(e) => setOpts({ ...opts, radius: Number(e.target.value) })}
                className="w-full"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Stroke darkness: {Math.round(opts.darkness * 100)}%</Label>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(opts.darkness * 100)}
                onChange={(e) => setOpts({ ...opts, darkness: Number(e.target.value) / 100 })}
                className="w-full"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Paper texture: {Math.round(opts.paperTexture * 100)}%</Label>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(opts.paperTexture * 100)}
                onChange={(e) => setOpts({ ...opts, paperTexture: Number(e.target.value) / 100 })}
                className="w-full"
              />
            </div>
            {opts.mode === "colored" && (
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Pencil color</Label>
                <input
                  type="color"
                  value={tintHex}
                  onChange={(e) => setTintHex(e.target.value)}
                  className="h-8 w-12 rounded border"
                />
              </div>
            )}
            <div>
              <Label className="text-xs text-muted-foreground">Presets</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {PRESETS.map((p) => (
                  <Button key={p.id} variant="outline" size="sm" onClick={() => applyPreset(p.id)}>
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Format</Label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as typeof format)}
                className="h-9 rounded-md border bg-background px-3 text-sm"
              >
                <option value="image/png">PNG</option>
                <option value="image/jpeg">JPEG</option>
                <option value="image/webp">WebP</option>
              </select>
            </div>
            {format !== "image/png" && (
              <div>
                <Label className="text-xs text-muted-foreground">Quality: {Math.round(quality * 100)}%</Label>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={Math.round(quality * 100)}
                  onChange={(e) => setQuality(Number(e.target.value) / 100)}
                  className="w-32"
                />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={apply} disabled={busy}>{busy ? "Sketching…" : "Apply sketch"}</Button>
              <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
              <CopyButton
                getText={() => JSON.stringify(opts)}
                label="Copy settings JSON"
                disabled={!previewUrl}
              />
            </div>
            {delta !== null && (
              <p className="text-xs text-muted-foreground">Mean pixel delta: {delta.toFixed(2)}</p>
            )}
          </CardContent>
        </Card>
      )}
      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-2">Preview</p>
          <img src={previewUrl} alt="Pencil sketch preview" className="max-w-full rounded-md border" />
        </CardContent></Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Privacy:</strong> pencil sketch runs locally via the Canvas API.
        </p>
      </CardContent></Card>
    </div>
  );
}
