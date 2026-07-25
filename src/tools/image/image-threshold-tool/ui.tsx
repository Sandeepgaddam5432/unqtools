"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  applyThreshold,
  applyThresholdWithIntensity,
  clampThreshold,
  validateThresholdOptions,
  otsuThreshold,
  lumaHistogram,
  thresholdStats,
  PRESETS,
  findPreset,
  DEFAULT_OPTIONS,
  type ThresholdOptions,
  type ThresholdStats,
  type ThresholdMethod,
} from "./logic";
import { toast } from "sonner";

export default function ImageThresholdTool() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("threshold.png");
  const [opts, setOpts] = useState<ThresholdOptions>(DEFAULT_OPTIONS);
  const [format, setFormat] = useState<"image/png" | "image/jpeg" | "image/webp">("image/png");
  const [quality, setQuality] = useState(0.9);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ThresholdStats | null>(null);
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
      setFileName(file.name.replace(/\.[^.]+$/, "") + "-threshold.png");
      setError(null);
      setStats(null);
    };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const t = clampThreshold(opts.threshold);
    const localOpts = { ...opts, threshold: t };
    const v = validateThresholdOptions(localOpts);
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
    for (let i = 0; i < px.length; i += 4) {
      const out = applyThresholdWithIntensity(
        { r: px[i]!, g: px[i + 1]!, b: px[i + 2]!, a: px[i + 3]! },
        localOpts,
      );
      px[i] = out.r;
      px[i + 1] = out.g;
      px[i + 2] = out.b;
    }
    ctx.putImageData(data, 0, 0);
    setStats(thresholdStats(px));
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

  const runOtsu = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const hist = lumaHistogram(data.data);
    const t = otsuThreshold(hist);
    setOpts({ ...opts, threshold: t, method: "otsu" });
    toast.success(`Otsu threshold: ${t}`);
  }, [image, opts]);

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
              <Label className="text-xs text-muted-foreground">Threshold: {opts.threshold}</Label>
              <input
                type="range"
                min={0}
                max={255}
                value={opts.threshold}
                onChange={(e) => setOpts({ ...opts, threshold: Number(e.target.value) })}
                className="w-full"
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Method</Label>
              <select
                value={opts.method}
                onChange={(e) => setOpts({ ...opts, method: e.target.value as ThresholdMethod })}
                className="h-9 rounded-md border bg-background px-3 text-sm"
              >
                <option value="binary">Binary</option>
                <option value="adaptive">Adaptive</option>
                <option value="otsu">Otsu auto</option>
                <option value="dither">Floyd-Steinberg</option>
              </select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Intensity: {Math.round(opts.intensity * 100)}%</Label>
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
              <Label className="text-xs text-muted-foreground">Window size: {opts.windowSize}</Label>
              <input
                type="range"
                min={3}
                max={49}
                step={2}
                value={opts.windowSize}
                onChange={(e) => setOpts({ ...opts, windowSize: Number(e.target.value) })}
                className="w-full"
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={opts.invert}
                onChange={(e) => setOpts({ ...opts, invert: e.target.checked })}
              />
              <span>Invert</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={opts.perChannel}
                onChange={(e) => setOpts({ ...opts, perChannel: e.target.checked })}
              />
              <span>Per-channel threshold</span>
            </label>

            <div>
              <Label className="text-xs text-muted-foreground">Presets</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {PRESETS.map((p) => (
                  <Button key={p.id} variant="outline" size="sm" onClick={() => applyPreset(p.id)}>
                    {p.label}
                  </Button>
                ))}
                <Button variant="outline" size="sm" onClick={runOtsu}>Run Otsu</Button>
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
              <Button size="sm" onClick={apply}>Apply threshold</Button>
              <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
              <CopyButton
                getText={() => JSON.stringify(opts)}
                label="Copy settings JSON"
                disabled={!previewUrl}
              />
            </div>

            {stats && (
              <div className="text-xs text-muted-foreground grid grid-cols-2 gap-1">
                <span>White pixels: {stats.white}</span>
                <span>Black pixels: {stats.black}</span>
                <span>Total: {stats.total}</span>
                <span>White ratio: {(stats.whiteRatio * 100).toFixed(1)}%</span>
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
            <img src={previewUrl} alt="Threshold preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> threshold conversion runs locally via the Canvas API.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
