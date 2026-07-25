"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  validateCharcoal,
  SOBEL_X,
  SOBEL_Y,
  applyKernel,
  luma,
  edgeToCharcoalFull,
  sobelAngle,
  paperTexture,
  PRESETS,
  findPreset,
  DEFAULT_OPTIONS,
  type CharcoalOptions,
} from "./logic";
import { toast } from "sonner";

export default function ImageCharcoalTool() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("charcoal.png");
  const [opts, setOpts] = useState<CharcoalOptions>(DEFAULT_OPTIONS);
  const [format, setFormat] = useState<"image/png" | "image/jpeg" | "image/webp">("image/png");
  const [quality, setQuality] = useState(0.9);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [meanEdge, setMeanEdge] = useState<number | null>(null);
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
      setFileName(file.name.replace(/\.[^.]+$/, "") + "-charcoal.png");
      setError(null);
      setMeanEdge(null);
    };
    img.onerror = () => setError("Could not load image");
    img.src = URL.createObjectURL(file);
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const v = validateCharcoal(opts);
    if ("error" in v) {
      setError(v.error);
      return;
    }
    setError(null);
    const canvas = canvasRef.current;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0);
    const src = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = src.data;
    const w = canvas.width, h = canvas.height;
    const gray: number[] = new Array(w * h);
    for (let i = 0, p = 0; i < px.length; i += 4, p++) {
      gray[p] = luma(px[i]!, px[i + 1]!, px[i + 2]!);
    }
    let edgeSum = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const gx = applyKernel(gray, x, y, w, h, SOBEL_X);
        const gy = applyKernel(gray, x, y, w, h, SOBEL_Y);
        const mag = Math.sqrt(gx * gx + gy * gy);
        edgeSum += mag;
        const angle = sobelAngle(gray, x, y, w, h);
        const noise = paperTexture(x, y, 1);
        const c = edgeToCharcoalFull(mag, v, noise, angle);
        const i = (y * w + x) * 4;
        px[i] = c; px[i + 1] = c; px[i + 2] = c;
      }
    }
    setMeanEdge(edgeSum / (w * h));
    ctx.putImageData(src, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(blob));
      },
      format,
      format === "image/png" ? undefined : quality,
    );
  }, [image, opts, format, quality, previewUrl]);

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
              <Label className="text-xs text-muted-foreground">Stroke strength: {Math.round(opts.strength * 100)}%</Label>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(opts.strength * 100)}
                onChange={(e) => setOpts({ ...opts, strength: Number(e.target.value) / 100 })}
                className="w-full"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Paper texture: {Math.round(opts.texture * 100)}%</Label>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(opts.texture * 100)}
                onChange={(e) => setOpts({ ...opts, texture: Number(e.target.value) / 100 })}
                className="w-full"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Darkness: {Math.round(opts.darkness * 100)}%</Label>
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
              <Label className="text-xs text-muted-foreground">Stroke direction: {opts.direction}°</Label>
              <input
                type="range"
                min={0}
                max={360}
                value={opts.direction}
                onChange={(e) => setOpts({ ...opts, direction: Number(e.target.value) })}
                className="w-full"
              />
            </div>
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
              <Button size="sm" onClick={apply}>Apply charcoal</Button>
              <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
              <CopyButton
                getText={() => JSON.stringify(opts)}
                label="Copy settings JSON"
                disabled={!previewUrl}
              />
            </div>
            {meanEdge !== null && (
              <p className="text-xs text-muted-foreground">Mean edge magnitude: {meanEdge.toFixed(2)}</p>
            )}
          </CardContent>
        </Card>
      )}
      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-2">Preview</p>
          <img src={previewUrl} alt="Charcoal preview" className="max-w-full rounded-md border" />
        </CardContent></Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Privacy:</strong> charcoal effect runs locally via the Canvas API.
        </p>
      </CardContent></Card>
    </div>
  );
}
