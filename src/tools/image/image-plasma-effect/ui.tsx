"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  plasmaPixel,
  validatePlasmaOptions,
  PRESETS,
  findPreset,
  DEFAULT_OPTIONS,
  type PlasmaOptions,
  type PaletteMode,
} from "./logic";
import { toast } from "sonner";

export default function ImagePlasmaEffect() {
  const [fileName, setFileName] = useState("plasma.png");
  const [width, setWidth] = useState(256);
  const [height, setHeight] = useState(256);
  const [opts, setOpts] = useState<PlasmaOptions>(DEFAULT_OPTIONS);
  const [format, setFormat] = useState<"image/png" | "image/jpeg" | "image/webp">("image/png");
  const [quality, setQuality] = useState(0.9);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const apply = useCallback(() => {
    const v = validatePlasmaOptions(opts);
    if ("error" in v) {
      setError(v.error);
      return;
    }
    setError(null);
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(width, height);
    const px = img.data;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const out = plasmaPixel(x, y, opts);
        const i = (y * width + x) * 4;
        px[i] = out.r; px[i + 1] = out.g; px[i + 2] = out.b; px[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(blob));
      },
      format,
      format === "image/png" ? undefined : quality,
    );
  }, [width, height, opts, format, quality, previewUrl]);

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
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Width</Label>
              <input
                type="number"
                min={16}
                max={1024}
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                className="w-full h-9 rounded-md border bg-background px-3 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Height</Label>
              <input
                type="number"
                min={16}
                max={1024}
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                className="w-full h-9 rounded-md border bg-background px-3 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Frequency a: {opts.a}</Label>
              <input
                type="range"
                min={1}
                max={64}
                value={opts.a}
                onChange={(e) => setOpts({ ...opts, a: Number(e.target.value) })}
                className="w-full"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Frequency b: {opts.b}</Label>
              <input
                type="range"
                min={1}
                max={64}
                value={opts.b}
                onChange={(e) => setOpts({ ...opts, b: Number(e.target.value) })}
                className="w-full"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Frequency c: {opts.c}</Label>
              <input
                type="range"
                min={1}
                max={64}
                value={opts.c}
                onChange={(e) => setOpts({ ...opts, c: Number(e.target.value) })}
                className="w-full"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Frequency d: {opts.d}</Label>
              <input
                type="range"
                min={1}
                max={64}
                value={opts.d}
                onChange={(e) => setOpts({ ...opts, d: Number(e.target.value) })}
                className="w-full"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Palette</Label>
            <select
              value={opts.palette}
              onChange={(e) => setOpts({ ...opts, palette: e.target.value as PaletteMode })}
              className="h-9 rounded-md border bg-background px-3 text-sm"
            >
              <option value="hueCycle">Hue cycle</option>
              <option value="rainbow">Rainbow</option>
              <option value="fire">Fire</option>
              <option value="ice">Ice</option>
              <option value="grayscale">Grayscale</option>
            </select>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Hue offset: {opts.hueOffset}°</Label>
            <input
              type="range"
              min={0}
              max={360}
              value={opts.hueOffset}
              onChange={(e) => setOpts({ ...opts, hueOffset: Number(e.target.value) })}
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Turbulence: {opts.turbulence}</Label>
              <input
                type="range"
                min={0}
                max={5}
                value={opts.turbulence}
                onChange={(e) => setOpts({ ...opts, turbulence: Number(e.target.value) })}
                className="w-full"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Seed: {opts.seed}</Label>
              <input
                type="number"
                min={0}
                max={100000}
                value={opts.seed}
                onChange={(e) => setOpts({ ...opts, seed: Number(e.target.value) })}
                className="w-full h-9 rounded-md border bg-background px-3 text-sm"
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
            <Button size="sm" onClick={apply}>Generate plasma</Button>
            <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
            <CopyButton
              getText={() => JSON.stringify(opts)}
              label="Copy settings JSON"
              disabled={!previewUrl}
            />
          </div>
        </CardContent>
      </Card>

      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            <img src={previewUrl} alt="Plasma preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> plasma rendering runs locally via the Canvas API.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
