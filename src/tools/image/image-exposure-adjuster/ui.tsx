"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  applyAll,
  validateExposureOptions,
  formatStops,
  computeHistogram,
  meanLuma,
  autoExposure,
  exposureDelta,
  PRESETS,
  findPreset,
  DEFAULT_OPTIONS,
  type ExposureOptions,
} from "./logic";
import { toast } from "sonner";

export default function ImageExposureAdjuster() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("exposure.png");
  const [opts, setOpts] = useState<ExposureOptions>(DEFAULT_OPTIONS);
  const [format, setFormat] = useState<"image/png" | "image/jpeg" | "image/webp">("image/png");
  const [quality, setQuality] = useState(0.9);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [histBefore, setHistBefore] = useState<{ r: number[]; g: number[]; b: number[] } | null>(null);
  const [histAfter, setHistAfter] = useState<{ r: number[]; g: number[]; b: number[] } | null>(null);
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
      setFileName(file.name.replace(/\.[^.]+$/, "") + "-exposure.png");
      setError(null);
      setHistBefore(null);
      setHistAfter(null);
      setLumaBefore(null);
      setLumaAfter(null);
      setDelta(null);
    };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const v = validateExposureOptions(opts);
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
    const hist0 = computeHistogram(px);
    const luma0 = meanLuma(px);
    setDelta(exposureDelta(px, opts));
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
    setHistBefore(hist0);
    setHistAfter(computeHistogram(px));
    setLumaBefore(luma0);
    setLumaAfter(meanLuma(px));
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
    const stops = autoExposure(data.data, 128);
    setOpts({ ...opts, stops: Math.round(stops * 100) / 100 });
    toast.success(`Auto exposure: ${formatStops(stops)}`);
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
              <Label className="text-xs text-muted-foreground">Exposure: {formatStops(opts.stops)}</Label>
              <input
                type="range"
                min={-5}
                max={5}
                step={0.05}
                value={opts.stops}
                onChange={(e) => setOpts({ ...opts, stops: Number(e.target.value) })}
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
                    min={0}
                    max={3}
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

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Highlight protect: {opts.highlightProtection}</Label>
                <input
                  type="range"
                  min={-100}
                  max={100}
                  value={opts.highlightProtection}
                  onChange={(e) => setOpts({ ...opts, highlightProtection: Number(e.target.value) })}
                  className="w-full"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Shadow protect: {opts.shadowProtection}</Label>
                <input
                  type="range"
                  min={-100}
                  max={100}
                  value={opts.shadowProtection}
                  onChange={(e) => setOpts({ ...opts, shadowProtection: Number(e.target.value) })}
                  className="w-full"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Gamma: {opts.gamma.toFixed(2)}</Label>
                <input
                  type="range"
                  min={0.1}
                  max={3}
                  step={0.05}
                  value={opts.gamma}
                  onChange={(e) => setOpts({ ...opts, gamma: Number(e.target.value) })}
                  className="w-full"
                />
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
                <Button variant="outline" size="sm" onClick={runAuto}>Auto</Button>
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
              <Button size="sm" onClick={apply}>Apply exposure</Button>
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
            <img src={previewUrl} alt="Exposure preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      {histAfter && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Histogram (after)</p>
            <HistogramView hist={histAfter} />
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> exposure adjustment runs locally via the Canvas API.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function HistogramView({ hist }: { hist: { r: number[]; g: number[]; b: number[] } }) {
  const maxR = Math.max(...hist.r, 1);
  const maxG = Math.max(...hist.g, 1);
  const maxB = Math.max(...hist.b, 1);
  const max = Math.max(maxR, maxG, maxB);
  return (
    <div className="flex items-end h-24 gap-px">
      {Array.from({ length: 64 }, (_, i) => {
        const bin = Math.floor(i * 4);
        const r = hist.r[bin] ?? 0;
        const g = hist.g[bin] ?? 0;
        const b = hist.b[bin] ?? 0;
        return (
          <div key={i} className="flex-1 flex flex-col justify-end">
            <div
              className="w-full bg-gradient-to-t from-red-500/40 via-green-500/40 to-blue-500/40"
              style={{ height: `${(Math.max(r, g, b) / max) * 100}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}
