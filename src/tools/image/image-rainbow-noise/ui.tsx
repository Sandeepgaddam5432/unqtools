"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  makeRng,
  baseColor,
  randomNoise,
  blendWithNoise,
  validateRainbowNoiseOptions,
  findPreset,
  PRESETS,
  type RainbowNoiseOptions,
  type ColorMode,
  type Pattern,
  type OutputFormat,
} from "./logic";
import { toast } from "sonner";

const rgbToHex = (rgb: [number, number, number]) =>
  "#" + rgb.map((c) => c.toString(16).padStart(2, "0")).join("");
const hexToRgb = (hex: string): [number, number, number] => {
  const m = hex.replace("#", "");
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
};

export default function ImageRainbowNoise() {
  const [fileName, setFileName] = useState("rainbow-noise.png");
  const [width, setWidth] = useState(256);
  const [height, setHeight] = useState(256);
  const [opts, setOpts] = useState<RainbowNoiseOptions>({
    strength: 0.5, hueOffset: 0, frequency: 100, color: "rainbow",
    pattern: "smooth", duotone: [[20, 40, 80], [200, 220, 255]], seed: 42,
  });
  const [colorA, setColorA] = useState(rgbToHex([20, 40, 80]));
  const [colorB, setColorB] = useState(rgbToHex([200, 220, 255]));
  const [format, setFormat] = useState<OutputFormat>("image/png");
  const [quality, setQuality] = useState(0.9);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const apply = useCallback(() => {
    const finalOpts: RainbowNoiseOptions = { ...opts, duotone: [hexToRgb(colorA), hexToRgb(colorB)] };
    const v = validateRainbowNoiseOptions(finalOpts);
    if ("error" in v) { setError(v.error); return; }
    setError(null);
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rng = makeRng(opts.seed);
    const img = ctx.createImageData(width, height);
    const px = img.data;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const base = baseColor(x, y, finalOpts);
        const noise = randomNoise(rng);
        const out = blendWithNoise(base, noise, opts.strength);
        const i = (y * width + x) * 4;
        px[i] = out.r; px[i + 1] = out.g; px[i + 2] = out.b; px[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    }, format, format === "image/png" ? undefined : quality);
  }, [width, height, opts, colorA, colorB, format, quality, previewUrl]);

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
      setColorA(rgbToHex(p.options.duotone[0]));
      setColorB(rgbToHex(p.options.duotone[1]));
      toast.success(`Preset: ${p.label}`);
    }
  }, []);

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 space-y-3">
        <div>
          <Label className="text-xs text-muted-foreground">Presets</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {PRESETS.map((p) => (
              <Button key={p.id} variant="outline" size="sm" onClick={() => applyPreset(p.id)}>{p.label}</Button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs text-muted-foreground">Width</Label><input type="number" min={16} max={1024} value={width} onChange={(e) => setWidth(Number(e.target.value))} className="w-full h-9 rounded-md border bg-background px-3 text-sm" /></div>
          <div><Label className="text-xs text-muted-foreground">Height</Label><input type="number" min={16} max={1024} value={height} onChange={(e) => setHeight(Number(e.target.value))} className="w-full h-9 rounded-md border bg-background px-3 text-sm" /></div>
        </div>
        <div><Label className="text-xs text-muted-foreground">Noise strength: {Math.round(opts.strength * 100)}%</Label><input type="range" min={0} max={100} value={Math.round(opts.strength * 100)} onChange={(e) => setOpts({ ...opts, strength: Number(e.target.value) / 100 })} className="w-full" /></div>
        <div><Label className="text-xs text-muted-foreground">Hue offset: {opts.hueOffset}°</Label><input type="range" min={0} max={360} value={opts.hueOffset} onChange={(e) => setOpts({ ...opts, hueOffset: Number(e.target.value) })} className="w-full" /></div>
        <div><Label className="text-xs text-muted-foreground">Frequency: {opts.frequency}px</Label><input type="range" min={10} max={500} value={opts.frequency} onChange={(e) => setOpts({ ...opts, frequency: Number(e.target.value) })} className="w-full" /></div>
        <div><Label className="text-xs text-muted-foreground">Seed</Label><input type="number" value={opts.seed} onChange={(e) => setOpts({ ...opts, seed: Number(e.target.value) })} className="w-full h-9 rounded-md border bg-background px-3 text-sm" /></div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Color mode</Label>
            <select value={opts.color} onChange={(e) => setOpts({ ...opts, color: e.target.value as ColorMode })} className="h-9 rounded-md border bg-background px-3 text-sm">
              <option value="rainbow">Rainbow</option>
              <option value="mono">Mono</option>
              <option value="duotone">Duotone</option>
            </select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Pattern</Label>
            <select value={opts.pattern} onChange={(e) => setOpts({ ...opts, pattern: e.target.value as Pattern })} className="h-9 rounded-md border bg-background px-3 text-sm">
              <option value="smooth">Smooth</option>
              <option value="striped">Striped</option>
              <option value="checkerboard">Checkerboard</option>
            </select>
          </div>
        </div>
        {opts.color === "duotone" && (
          <div className="flex items-center gap-3">
            <Label className="text-xs text-muted-foreground">Color A</Label>
            <input type="color" value={colorA} onChange={(e) => setColorA(e.target.value)} className="h-8 w-12 rounded border" />
            <Label className="text-xs text-muted-foreground">Color B</Label>
            <input type="color" value={colorB} onChange={(e) => setColorB(e.target.value)} className="h-8 w-12 rounded border" />
          </div>
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
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" onClick={apply}>Generate</Button>
          <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
          <CopyButton getText={() => JSON.stringify(opts)} label="Copy settings" disabled={!previewUrl} />
          <DownloadButton getText={() => previewUrl ?? ""} filename={fileName} disabled={!previewUrl} mime={format} />
        </div>
      </CardContent></Card>
      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-2">Preview</p>
          <img src={previewUrl} alt="Rainbow noise preview" className="max-w-full rounded-md border" />
        </CardContent></Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> noise rendering runs locally via the Canvas API.</p></CardContent></Card>
    </div>
  );
}
