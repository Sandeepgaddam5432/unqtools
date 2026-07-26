"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  calculateUpscale, multiStepPath, canvasSmoothingQuality, shouldSmooth,
  unsharpKernel, buildFilename, type Interpolation, type OutputFormat,
} from "./logic";
import { toast } from "sonner";

const METHODS: Interpolation[] = ["nearest", "bilinear", "bicubic", "lanczos"];
const SCALES = [2, 3, 4];

export default function ImageUpscaler() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(2);
  const [customScale, setCustomScale] = useState("");
  const [method, setMethod] = useState<Interpolation>("lanczos");
  const [sharpen, setSharpen] = useState(0.3);
  const [format, setFormat] = useState<OutputFormat>("image/png");
  const [quality, setQuality] = useState(0.92);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<ReturnType<typeof calculateUpscale> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setImage(img); setError(null); };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const effectiveScale = customScale.trim() ? Number(customScale) : scale;

  const applyUpscale = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const r = calculateUpscale({
      srcWidth: image.naturalWidth,
      srcHeight: image.naturalHeight,
      scale: effectiveScale,
      method, sharpen, format, quality,
    });
    if ("error" in r) { setError(r.error); return; }
    setError(null);
    setResult(r);
    const canvas = canvasRef.current;
    canvas.width = r.width;
    canvas.height = r.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = shouldSmooth(method);
    ctx.imageSmoothingQuality = canvasSmoothingQuality(method);

    // Multi-step upscale for better quality
    const steps = r.steps;
    if (steps.length > 1) {
      let curCanvas: HTMLCanvasElement | HTMLImageElement = image;
      for (const step of steps) {
        const tmp = document.createElement("canvas");
        tmp.width = step.width;
        tmp.height = step.height;
        const tctx = tmp.getContext("2d")!;
        tctx.imageSmoothingEnabled = shouldSmooth(method);
        tctx.imageSmoothingQuality = canvasSmoothingQuality(method);
        tctx.drawImage(curCanvas, 0, 0, step.width, step.height);
        curCanvas = tmp;
      }
      ctx.drawImage(curCanvas, 0, 0, r.width, r.height);
    } else {
      ctx.drawImage(image, 0, 0, r.width, r.height);
    }

    // Optional sharpening via SVG filter (best-effort; falls back to identity)
    if (sharpen > 0 && method !== "nearest") {
      try {
        const k = unsharpKernel(sharpen);
        ctx.filter = `url(data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'><filter id='s'><feConvolveMatrix kernelMatrix='${k.join(" ")}' /></filter></svg>#s)`;
      } catch { /* no-op */ }
    }

    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      toast.success(`Upscaled to ${r.width}×${r.height} (${method})`);
    }, format, format === "image/png" ? undefined : quality);
  }, [image, effectiveScale, method, sharpen, format, quality, previewUrl]);

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = buildFilename(effectiveScale, method, format); a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Image downloaded");
    }, format, format === "image/png" ? undefined : quality);
  }, [effectiveScale, method, format, quality]);

  const csv = result && !"error" in result
    ? `Field,Value\nMethod,${method}\nScale,${effectiveScale}x\nSource,${image?.naturalWidth}×${image?.naturalHeight}\nOutput,${result.width}×${result.height}\nSteps,${result.steps.length}\nMemory,${(result.estimatedMemoryBytes / 1024 / 1024).toFixed(2)}MB\nQuality,${result.qualityScore}/100`
    : "";

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Choose image</Button>
          {image && <p className="text-xs text-muted-foreground">Source: {image.naturalWidth} × {image.naturalHeight}px</p>}
          <div className="flex flex-wrap gap-2">
            {SCALES.map((s) => (
              <Button key={s} size="sm" variant={scale === s && !customScale ? "default" : "outline"} onClick={() => { setScale(s); setCustomScale(""); }}>{s}x</Button>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div><Label className="text-xs text-muted-foreground">Custom scale</Label><Input type="number" min={1} max={16} step={0.5} value={customScale} onChange={(e) => setCustomScale(e.target.value)} placeholder={String(scale)} /></div>
            <div><Label className="text-xs text-muted-foreground">Method</Label>
              <select value={method} onChange={(e) => setMethod(e.target.value as Interpolation)} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div><Label className="text-xs text-muted-foreground">Format</Label>
              <select value={format} onChange={(e) => setFormat(e.target.value as OutputFormat)} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                <option value="image/png">PNG</option><option value="image/jpeg">JPEG</option><option value="image/webp">WebP</option>
              </select>
            </div>
          </div>
          <div><Label className="text-xs text-muted-foreground">Sharpen: {Math.round(sharpen * 100)}%</Label>
            <Input type="range" min={0} max={100} value={Math.round(sharpen * 100)} onChange={(e) => setSharpen(Number(e.target.value) / 100)} />
          </div>
          {format !== "image/png" && (
            <div><Label className="text-xs text-muted-foreground">Quality: {Math.round(quality * 100)}%</Label>
              <Input type="range" min={10} max={100} value={Math.round(quality * 100)} onChange={(e) => setQuality(Number(e.target.value) / 100)} />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={applyUpscale} disabled={!image}>Upscale</Button>
            <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
            {csv && <CopyButton getText={() => csv} label="Copy CSV" />}
          </div>
        </CardContent>
      </Card>

      {result && !"error" in result && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Output</p><p className="font-bold">{result.width}×{result.height}</p></div>
              <div><p className="text-xs text-muted-foreground">Steps</p><p className="font-bold">{result.steps.length}</p></div>
              <div><p className="text-xs text-muted-foreground">Memory</p><p className="font-bold">{(result.estimatedMemoryBytes / 1024 / 1024).toFixed(2)}MB</p></div>
              <div><p className="text-xs text-muted-foreground">Quality</p><p className="font-bold">{result.qualityScore}/100</p></div>
            </div>
            {result.warnings.map((w, i) => (
              <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {w}</p>
            ))}
          </CardContent>
        </Card>
      )}

      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview (scaled to fit)</p>
            <img src={previewUrl} alt="Upscaled preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      {csv && <DownloadButton getText={() => csv} filename="upscale-spec.csv" mime="text/csv" label="Download CSV" />}
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all upscaling runs locally via the Canvas API.</p></CardContent></Card>
    </div>
  );
}
