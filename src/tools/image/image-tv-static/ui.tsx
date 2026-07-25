"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ErrorBanner, DownloadButton } from "../../_shared";
import {
  generateStatic, generateFrames, computeStats, histogram,
  buildStaticFilename, validateTvStaticOptions, getPreset,
  type TvStaticOptions, type StaticPreset,
} from "./logic";
import { toast } from "sonner";

const PRESETS: StaticPreset[] = ["snow", "crt", "digital", "analog", "warm", "cool"];

export default function ImageTvStatic() {
  const [opts, setOpts] = useState<TvStaticOptions>(getPreset("snow"));
  const [width, setWidth] = useState(320);
  const [height, setHeight] = useState(240);
  const [animating, setAnimating] = useState(false);
  const [frame, setFrame] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [stats, setStats] = useState<{ mean: number; variance: number; min: number; max: number } | null>(null);
  const [hist, setHist] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const update = <K extends keyof TvStaticOptions>(key: K, value: TvStaticOptions[K]) =>
    setOpts((p) => ({ ...p, [key]: value }));

  const render = useCallback(() => {
    const v = validateTvStaticOptions(opts);
    if ("error" in v) { setError(v.error); return; }
    setError(null);
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pixels = generateStatic(width, height, { ...opts, seed: opts.seed + frame * 65537 });
    const img = ctx.createImageData(width, height);
    const px = img.data;
    for (let i = 0; i < pixels.length; i++) {
      const p = pixels[i]!;
      px[i * 4] = p.r;
      px[i * 4 + 1] = p.g;
      px[i * 4 + 2] = p.b;
      px[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    setStats(computeStats(pixels));
    setHist(histogram(pixels, 16));
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    }, "image/png");
  }, [opts, width, height, frame, previewUrl]);

  useEffect(() => {
    if (animating) {
      const id = setInterval(() => setFrame((f) => f + 1), 100);
      return () => clearInterval(id);
    }
  }, [animating]);

  useEffect(() => { render(); }, [render]);

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = buildStaticFilename("snow", opts.seed, frame); a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Image downloaded");
    }, "image/png");
  }, [opts.seed, frame]);

  const downloadBatch = useCallback(async () => {
    const frames = generateFrames(width, height, opts, 8);
    for (let i = 0; i < frames.length; i++) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      const img = ctx.createImageData(width, height);
      const pixels = frames[i]!;
      for (let j = 0; j < pixels.length; j++) {
        img.data[j * 4] = pixels[j]!.r;
        img.data[j * 4 + 1] = pixels[j]!.g;
        img.data[j * 4 + 2] = pixels[j]!.b;
        img.data[j * 4 + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/png"));
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = buildStaticFilename("snow", opts.seed, i); a.click();
      setTimeout(() => URL.revokeObjectURL(url), 100);
      await new Promise((r) => setTimeout(r, 200));
    }
    toast.success("Downloaded 8 frames");
  }, [width, height, opts]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button key={p} variant="outline" size="sm" onClick={() => setOpts(getPreset(p))}>{p}</Button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs text-muted-foreground">Width</Label><Input type="number" min={16} max={1024} value={width} onChange={(e) => setWidth(Number(e.target.value))} /></div>
            <div><Label className="text-xs text-muted-foreground">Height</Label><Input type="number" min={16} max={1024} value={height} onChange={(e) => setHeight(Number(e.target.value))} /></div>
          </div>
          <div><Label className="text-xs text-muted-foreground">Intensity: {Math.round(opts.intensity * 100)}%</Label><Slider value={[opts.intensity * 100]} onValueChange={(v) => update("intensity", v[0]! / 100)} min={0} max={100} step={5} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs text-muted-foreground">Brightness: {opts.brightness.toFixed(2)}</Label><Slider value={[opts.brightness * 100]} onValueChange={(v) => update("brightness", v[0]! / 100)} min={0} max={200} step={5} /></div>
            <div><Label className="text-xs text-muted-foreground">Contrast: {opts.contrast.toFixed(2)}</Label><Slider value={[(opts.contrast + 1) * 50]} onValueChange={(v) => update("contrast", v[0]! / 50 - 1)} min={0} max={100} step={5} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs text-muted-foreground">Scanlines: {Math.round(opts.scanlines * 100)}%</Label><Slider value={[opts.scanlines * 100]} onValueChange={(v) => update("scanlines", v[0]! / 100)} min={0} max={100} step={5} /></div>
            <div><Label className="text-xs text-muted-foreground">Vignette: {Math.round(opts.vignette * 100)}%</Label><Slider value={[opts.vignette * 100]} onValueChange={(v) => update("vignette", v[0]! / 100)} min={0} max={100} step={5} /></div>
          </div>
          <div><Label className="text-xs text-muted-foreground">Seed</Label><Input type="number" value={opts.seed} onChange={(e) => update("seed", Number(e.target.value))} /></div>
          <div className="flex items-center gap-2">
            <Switch checked={opts.monochrome} onCheckedChange={(v) => update("monochrome", v)} id="mono" />
            <Label htmlFor="mono" className="text-sm cursor-pointer">Monochrome</Label>
          </div>
          {!opts.monochrome && (
            <div className="flex flex-wrap items-end gap-3">
              <div><Label className="text-xs text-muted-foreground">Tint R</Label><Input type="number" min={0} max={255} value={opts.tint.r} onChange={(e) => update("tint", { ...opts.tint, r: Number(e.target.value) })} className="w-20" /></div>
              <div><Label className="text-xs text-muted-foreground">Tint G</Label><Input type="number" min={0} max={255} value={opts.tint.g} onChange={(e) => update("tint", { ...opts.tint, g: Number(e.target.value) })} className="w-20" /></div>
              <div><Label className="text-xs text-muted-foreground">Tint B</Label><Input type="number" min={0} max={255} value={opts.tint.b} onChange={(e) => update("tint", { ...opts.tint, b: Number(e.target.value) })} className="w-20" /></div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={render}>Generate</Button>
            <Button variant="outline" size="sm" onClick={() => setAnimating((a) => !a)}>{animating ? "Stop" : "Animate"}</Button>
            <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
            <DownloadButton getText={async () => { await new Promise((r) => setTimeout(r, 0)); return ""; }} filename={buildStaticFilename("snow", opts.seed, frame)} disabled={!previewUrl} mime="image/png" label="Download (shared)" />
            <Button variant="ghost" size="sm" onClick={downloadBatch}>Download 8 frames</Button>
            <Button variant="ghost" size="sm" onClick={() => setFrame((f) => f + 1)}>Next frame</Button>
          </div>
        </CardContent>
      </Card>

      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview (frame {frame})</p>
            <img src={previewUrl} alt="TV static preview" className="max-w-full rounded-md border" style={{ imageRendering: "pixelated" }} />
          </CardContent>
        </Card>
      )}
      {stats && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-medium">Statistics</p>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div>Mean: {stats.mean.toFixed(1)}</div>
              <div>Variance: {stats.variance.toFixed(1)}</div>
              <div>Min: {stats.min}</div>
              <div>Max: {stats.max}</div>
            </div>
            <div className="flex items-end gap-0.5 h-16">
              {hist.map((count, i) => (
                <div key={i} className="flex-1 bg-foreground/70 rounded-t" style={{ height: `${(count / Math.max(...hist, 1)) * 100}%` }} title={`bucket ${i}: ${count}`} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> static rendering runs locally via the Canvas API.</p>
        </CardContent>
      </Card>
    </div>
  );
}
