"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  applyInvert,
  validateInvertOptions,
  toCssFilter,
  computeStats,
  inversionDelta,
  PRESETS,
  findPreset,
  DEFAULT_OPTIONS,
  type InvertOptions,
  type PixelStats,
} from "./logic";
import { toast } from "sonner";

export default function ImageColorInverter() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("inverted.png");
  const [opts, setOpts] = useState<InvertOptions>(DEFAULT_OPTIONS);
  const [format, setFormat] = useState<"image/png" | "image/jpeg" | "image/webp">("image/png");
  const [quality, setQuality] = useState(0.9);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<PixelStats | null>(null);
  const [delta, setDelta] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file");
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setFileName(file.name.replace(/\.[^.]+$/, "") + "-inverted.png");
      setError(null);
      setStats(null);
      setDelta(null);
    };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const v = validateInvertOptions(opts);
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
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = data.data;
    setDelta(inversionDelta(px));
    for (let i = 0; i < px.length; i += 4) {
      const out = applyInvert(
        { r: px[i]!, g: px[i + 1]!, b: px[i + 2]!, a: px[i + 3]! },
        opts,
      );
      px[i] = out.r;
      px[i + 1] = out.g;
      px[i + 2] = out.b;
    }
    ctx.putImageData(data, 0, 0);
    setStats(computeStats(px));
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
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            Choose image
          </Button>
        </CardContent>
      </Card>

      {image && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">
                Strength: {Math.round(opts.strength * 100)}%
              </Label>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(opts.strength * 100)}
                onChange={(e) => setOpts({ ...opts, strength: Number(e.target.value) / 100 })}
                className="w-full"
              />
            </div>

            <div className="flex flex-wrap gap-3 text-sm">
              {(["r", "g", "b"] as const).map((ch) => (
                <label key={ch} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={opts.channels[ch]}
                    onChange={(e) =>
                      setOpts({ ...opts, channels: { ...opts.channels, [ch]: e.target.checked } })
                    }
                  />
                  <span>Invert {ch.toUpperCase()}</span>
                </label>
              ))}
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={opts.selective}
                onChange={(e) => setOpts({ ...opts, selective: e.target.checked })}
              />
              <span>Selective invert (luma range)</span>
            </label>

            {opts.selective && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Luma low: {opts.lumaLow}</Label>
                  <input
                    type="range"
                    min={0}
                    max={255}
                    value={opts.lumaLow}
                    onChange={(e) => setOpts({ ...opts, lumaLow: Number(e.target.value) })}
                    className="w-full"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Luma high: {opts.lumaHigh}</Label>
                  <input
                    type="range"
                    min={0}
                    max={255}
                    value={opts.lumaHigh}
                    onChange={(e) => setOpts({ ...opts, lumaHigh: Number(e.target.value) })}
                    className="w-full"
                  />
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs text-muted-foreground">Presets</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {PRESETS.map((p) => (
                  <Button
                    key={p.id}
                    variant="outline"
                    size="sm"
                    onClick={() => applyPreset(p.id)}
                  >
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
                <Label className="text-xs text-muted-foreground">
                  Quality: {Math.round(quality * 100)}%
                </Label>
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
              <Button size="sm" onClick={apply}>Invert colors</Button>
              <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>
                Download
              </Button>
              <CopyButton
                getText={() => toCssFilter(opts)}
                label="Copy CSS filter"
                disabled={!previewUrl}
              />
            </div>

            {stats && (
              <div className="text-xs text-muted-foreground grid grid-cols-2 gap-1">
                <span>Mean R: {stats.meanR.toFixed(1)}</span>
                <span>Mean G: {stats.meanG.toFixed(1)}</span>
                <span>Mean B: {stats.meanB.toFixed(1)}</span>
                <span>Mean Luma: {stats.meanLuma.toFixed(1)}</span>
                {delta !== null && <span className="col-span-2">Inversion delta: {delta.toFixed(2)}</span>}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            <img src={previewUrl} alt="Inverted preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> inversion runs locally via the Canvas API.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
