"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  applyGammaPerPixel,
  validateGammaOptions,
  gammaCurve,
  autoGamma,
  gammaDelta,
  PRESETS,
  findPreset,
  DEFAULT_OPTIONS,
  type GammaOptions,
} from "./logic";
import { toast } from "sonner";

export default function ImageGammaCorrector() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("gamma.png");
  const [opts, setOpts] = useState<GammaOptions>(DEFAULT_OPTIONS);
  const [format, setFormat] = useState<"image/png" | "image/jpeg" | "image/webp">("image/png");
  const [quality, setQuality] = useState(0.9);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lumaBefore, setLumaBefore] = useState<number | null>(null);
  const [lumaAfter, setLumaAfter] = useState<number | null>(null);
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
      setFileName(file.name.replace(/\.[^.]+$/, "") + "-gamma.png");
      setError(null);
      setLumaBefore(null);
      setLumaAfter(null);
      setDelta(null);
    };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const v = validateGammaOptions(opts);
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
    let sum0 = 0, n = 0;
    for (let i = 0; i < px.length; i += 4) {
      sum0 += 0.299 * px[i]! + 0.587 * px[i + 1]! + 0.114 * px[i + 2]!;
      n++;
    }
    const luma0 = n === 0 ? 0 : sum0 / n;
    setDelta(gammaDelta(px, opts));
    for (let i = 0; i < px.length; i += 4) {
      const out = applyGammaPerPixel(
        { r: px[i]!, g: px[i + 1]!, b: px[i + 2]!, a: px[i + 3]! },
        opts,
      );
      px[i] = out.r;
      px[i + 1] = out.g;
      px[i + 2] = out.b;
    }
    ctx.putImageData(data, 0, 0);
    let sum1 = 0;
    for (let i = 0; i < px.length; i += 4) {
      sum1 += 0.299 * px[i]! + 0.587 * px[i + 1]! + 0.114 * px[i + 2]!;
    }
    setLumaBefore(luma0);
    setLumaAfter(n === 0 ? 0 : sum1 / n);
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

  const runAuto = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const g = autoGamma(data.data, 128);
    setOpts({ ...opts, gamma: Math.round(g * 100) / 100 });
    toast.success(`Auto gamma: ${g.toFixed(2)}`);
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

  const curve = gammaCurve(opts.gamma, 64);

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
              <Label className="text-xs text-muted-foreground">Gamma: {opts.gamma.toFixed(2)}</Label>
              <input
                type="range"
                min={0.1}
                max={10}
                step={0.05}
                value={opts.gamma}
                onChange={(e) => setOpts({ ...opts, gamma: Number(e.target.value) })}
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              {(["r", "g", "b"] as const).map((ch) => (
                <div key={ch}>
                  <Label className="text-xs text-muted-foreground">
                    {ch.toUpperCase()} x{opts.channels[ch].toFixed(2)}
                  </Label>
                  <input
                    type="range"
                    min={0.1}
                    max={10}
                    step={0.05}
                    value={opts.channels[ch]}
                    onChange={(e) =>
                      setOpts({ ...opts, channels: { ...opts.channels, [ch]: Number(e.target.value) } })
                    }
                    className="w-full"
                  />
                </div>
              ))}
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Presets</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {PRESETS.map((p) => (
                  <Button key={p.id} variant="outline" size="sm" onClick={() => applyPreset(p.id)}>
                    {p.label}
                  </Button>
                ))}
                <Button variant="outline" size="sm" onClick={runAuto}>Auto</Button>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Curve (gamma {opts.gamma.toFixed(2)})</Label>
              <div className="relative h-32 w-full border rounded-md bg-muted/30 mt-1">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
                  <line x1="0" y1="100" x2="100" y2="0" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2,2" className="text-muted-foreground/50" />
                  <polyline
                    points={curve.map((p) => `${p.x * 100},${100 - p.y * 100}`).join(" ")}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="text-primary"
                  />
                </svg>
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
              <Button size="sm" onClick={apply}>Apply gamma</Button>
              <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
              <CopyButton
                getText={() => JSON.stringify(opts)}
                label="Copy settings JSON"
                disabled={!previewUrl}
              />
            </div>

            {lumaBefore !== null && lumaAfter !== null && (
              <div className="text-xs text-muted-foreground grid grid-cols-2 gap-1">
                <span>Luma before: {lumaBefore.toFixed(1)}</span>
                <span>Luma after: {lumaAfter.toFixed(1)}</span>
                {delta !== null && <span className="col-span-2">Mean pixel delta: {delta.toFixed(2)}</span>}
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
            <img src={previewUrl} alt="Gamma preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> gamma correction runs locally via the Canvas API.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
