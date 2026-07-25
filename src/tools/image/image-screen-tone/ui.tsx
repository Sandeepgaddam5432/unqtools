"use client";

import React, { useState, useCallback, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, DownloadButton } from "../../_shared";
import {
  generateGrid,
  shouldDrawDot,
  scaledDotRadius,
  validateScreenToneOptions,
  brightness,
  dotPath,
  generateUniform,
  toSvg,
  computeStats,
  PATTERNS,
  type ScreenToneOptions,
  type DotPattern,
} from "./logic";
import { toast } from "sonner";

export default function ImageScreenTone() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("screen-tone.png");
  const [spacing, setSpacing] = useState(8);
  const [radius, setRadius] = useState(3);
  const [threshold, setThreshold] = useState(128);
  const [angle, setAngle] = useState(45);
  const [pattern, setPattern] = useState<DotPattern>("round");
  const [intensity, setIntensity] = useState(1);
  const [ellipseRatio, setEllipseRatio] = useState(1.5);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ReturnType<typeof computeStats> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const opts: ScreenToneOptions = useMemo(() => ({
    spacing, radius, threshold, angle, pattern, intensity,
    ellipseRatio: pattern === "ellipse" ? ellipseRatio : undefined,
  }), [spacing, radius, threshold, angle, pattern, intensity, ellipseRatio]);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setImage(img); setFileName(file.name.replace(/\.[^.]+$/, "") + "-screentone.png"); setError(null); setPreviewUrl(null); setStats(null); };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const v = validateScreenToneOptions(opts);
    if ("error" in v) { setError(v.error); return; }
    setError(null);
    const canvas = canvasRef.current;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const tmp = document.createElement("canvas");
    tmp.width = canvas.width; tmp.height = canvas.height;
    const tctx = tmp.getContext("2d");
    if (!tctx) return;
    tctx.drawImage(image, 0, 0);
    const src = tctx.getImageData(0, 0, canvas.width, canvas.height).data;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000";
    const dotsAll = generateGrid(canvas.width, canvas.height, opts);
    const drawn: { x: number; y: number; radius: number }[] = [];
    for (const d of dotsAll) {
      const px = Math.round(d.x);
      const py = Math.round(d.y);
      if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) continue;
      const i = (py * canvas.width + px) * 4;
      const b = brightness(src[i] ?? 0, src[i + 1] ?? 0, src[i + 2] ?? 0);
      if (!shouldDrawDot(b, opts)) continue;
      const r = scaledDotRadius(b, opts);
      drawn.push({ x: d.x, y: d.y, radius: r });
      const path = new Path2D(dotPath(d.x, d.y, r, opts));
      ctx.fill(path);
    }
    setStats(computeStats(dotsAll, drawn, opts, canvas.width * canvas.height));
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    }, "image/png");
  }, [image, opts, previewUrl]);

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = fileName; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Image downloaded");
    }, "image/png");
  }, [fileName]);

  const downloadSvg = useCallback(() => {
    const dots = generateUniform(400, 400, opts);
    const svg = toSvg(dots, 400, 400, opts);
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = fileName.replace(/\.png$/, ".svg"); a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("SVG downloaded");
  }, [opts, fileName]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Choose image</Button>
            <Button variant="ghost" size="sm" onClick={downloadSvg}>Download SVG sample</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">Pattern</Label>
          <div className="flex gap-2">
            {PATTERNS.map((p) => (
              <Button key={p.value} size="sm" variant={pattern === p.value ? "default" : "outline"} onClick={() => setPattern(p.value)}>{p.label}</Button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Spacing: {spacing}px</Label>
              <input type="range" min={2} max={32} value={spacing} onChange={(e) => setSpacing(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Radius: {radius}px</Label>
              <input type="range" min={1} max={Math.floor(spacing / 2)} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Threshold: {threshold}</Label>
              <input type="range" min={0} max={255} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Angle: {angle}°</Label>
              <input type="range" min={-90} max={90} value={angle} onChange={(e) => setAngle(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Intensity: {intensity.toFixed(2)}</Label>
              <input type="range" min={0.1} max={1} step={0.05} value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} className="w-full" />
            </div>
            {pattern === "ellipse" && (
              <div>
                <Label className="text-xs text-muted-foreground">Ellipse ratio: {ellipseRatio}</Label>
                <input type="range" min={0.5} max={3} step={0.1} value={ellipseRatio} onChange={(e) => setEllipseRatio(Number(e.target.value))} className="w-full" />
              </div>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={apply} disabled={!image}>Apply screen tone</Button>
            <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download PNG</Button>
            <DownloadButton getText={async () => ""} filename={fileName} mime="image/png" label="Download (shared)" disabled={!previewUrl} />
          </div>
        </CardContent>
      </Card>

      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            <img src={previewUrl} alt="Screen tone preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}

      {stats && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Render stats</CardTitle></CardHeader>
          <CardContent className="p-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Total dots</p><p className="font-bold">{stats.dotCount}</p></div>
              <div><p className="text-xs text-muted-foreground">Drawn</p><p className="font-bold text-emerald-600">{stats.drawnDots}</p></div>
              <div><p className="text-xs text-muted-foreground">Skipped</p><p className="font-bold">{stats.skippedDots}</p></div>
              <div><p className="text-xs text-muted-foreground">Coverage</p><p className="font-bold">{(stats.coverage * 100).toFixed(1)}%</p></div>
              <div><p className="text-xs text-muted-foreground">Avg radius</p><p className="font-bold">{stats.averageRadius.toFixed(2)}px</p></div>
              <div><p className="text-xs text-muted-foreground">Min radius</p><p className="font-bold">{stats.minRadius.toFixed(2)}px</p></div>
              <div><p className="text-xs text-muted-foreground">Max radius</p><p className="font-bold">{stats.maxRadius.toFixed(2)}px</p></div>
              <div><p className="text-xs text-muted-foreground">Render time</p><p className="font-bold">{stats.durationMs.toFixed(1)}ms</p></div>
            </div>
          </CardContent>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> screen tone rendering runs locally via the Canvas API. No image is uploaded.</p></CardContent></Card>
    </div>
  );
}
