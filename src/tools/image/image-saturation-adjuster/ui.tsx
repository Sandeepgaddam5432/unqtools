"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  applyAll,
  validateSaturationOptions,
  PRESETS,
  findPreset,
  DEFAULT_OPTIONS,
  DEFAULT_BANDS,
  type SaturationOptions,
  type SaturationMode,
  type HueBand,
} from "./logic";
import { toast } from "sonner";

const BAND_LABELS = ["Red", "Orange", "Yellow", "Green", "Cyan", "Blue", "Purple", "Magenta"];

export default function ImageSaturationAdjuster() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("saturated.png");
  const [opts, setOpts] = useState<SaturationOptions>(DEFAULT_OPTIONS);
  const [format, setFormat] = useState<"image/png" | "image/jpeg" | "image/webp">("image/png");
  const [quality, setQuality] = useState(0.9);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
      setFileName(file.name.replace(/\.[^.]+$/, "") + "-saturated.png");
      setError(null);
    };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const v = validateSaturationOptions(opts);
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
      const out = applyAll(
        { r: px[i]!, g: px[i + 1]!, b: px[i + 2]!, a: px[i + 3]! },
        opts,
      );
      px[i] = out.r;
      px[i + 1] = out.g;
      px[i + 2] = out.b;
    }
    ctx.putImageData(data, 0, 0);
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

  const setBandFactor = (idx: number, factor: number) => {
    const newBands: HueBand[] = opts.bands.map((b, i) => i === idx ? { ...b, factor } : b);
    setOpts({ ...opts, bands: newBands });
  };

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
              <Label className="text-xs text-muted-foreground">Saturation: {opts.value}</Label>
              <input
                type="range"
                min={-100}
                max={100}
                value={opts.value}
                onChange={(e) => setOpts({ ...opts, value: Number(e.target.value) })}
                className="w-full"
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Mode</Label>
              <select
                value={opts.mode}
                onChange={(e) => setOpts({ ...opts, mode: e.target.value as SaturationMode })}
                className="h-9 rounded-md border bg-background px-3 text-sm"
              >
                <option value="standard">Standard</option>
                <option value="vibrance">Vibrance (skin-safe)</option>
                <option value="splash">Color splash</option>
                <option value="replace">Color replace</option>
              </select>
            </div>

            {opts.mode === "vibrance" && (
              <div>
                <Label className="text-xs text-muted-foreground">Vibrance: {opts.vibrance}</Label>
                <input
                  type="range"
                  min={-100}
                  max={100}
                  value={opts.vibrance}
                  onChange={(e) => setOpts({ ...opts, vibrance: Number(e.target.value) })}
                  className="w-full"
                />
              </div>
            )}

            {(opts.mode === "splash" || opts.mode === "replace") && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Target hue: {opts.targetHue}°</Label>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    value={opts.targetHue}
                    onChange={(e) => setOpts({ ...opts, targetHue: Number(e.target.value) })}
                    className="w-full"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Tolerance: {opts.hueTolerance}°</Label>
                  <input
                    type="range"
                    min={0}
                    max={180}
                    value={opts.hueTolerance}
                    onChange={(e) => setOpts({ ...opts, hueTolerance: Number(e.target.value) })}
                    className="w-full"
                  />
                </div>
                {opts.mode === "replace" && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Replace hue: {opts.replaceHue}°</Label>
                    <input
                      type="range"
                      min={0}
                      max={360}
                      value={opts.replaceHue}
                      onChange={(e) => setOpts({ ...opts, replaceHue: Number(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            )}

            <div>
              <Label className="text-xs text-muted-foreground">Per-hue-band saturation</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {DEFAULT_BANDS.map((b, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs w-16">{BAND_LABELS[i]}</span>
                    <input
                      type="range"
                      min={0}
                      max={2}
                      step={0.05}
                      value={opts.bands[i]?.factor ?? 1}
                      onChange={(e) => setBandFactor(i, Number(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-xs w-8">{(opts.bands[i]?.factor ?? 1).toFixed(2)}</span>
                  </div>
                ))}
              </div>
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
              <Button size="sm" onClick={apply}>Apply saturation</Button>
              <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
              <CopyButton
                getText={() => JSON.stringify(opts)}
                label="Copy settings JSON"
                disabled={!previewUrl}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            <img src={previewUrl} alt="Saturation preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> saturation adjustment runs locally via the Canvas API.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
