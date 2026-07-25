"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ErrorBanner, DownloadButton } from "../../_shared";
import {
  buildGaussianKernel,
  validateSharpenOptions,
  sharpenPixel,
  localVariance,
  isIdentity,
  noiseWarning,
  haloWarning,
  preservesAlpha,
  DEFAULT_OPTIONS,
  type SharpenOptions,
  type SharpenMode,
  type OutputFormat,
  type RgbPixel,
} from "./logic";
import { toast } from "sonner";

/** Box-blur pass (1D, axis separable) for unsharp mask. */
function blurPass(data: Uint8ClampedArray, width: number, height: number, radius: number, axis: "x" | "y") {
  const tmp = new Uint8ClampedArray(data.length);
  const r = Math.max(1, Math.round(radius));
  const window = 2 * r + 1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let rAcc = 0, gAcc = 0, bAcc = 0, aAcc = 0;
      for (let k = -r; k <= r; k++) {
        const sx = axis === "x" ? Math.min(width - 1, Math.max(0, x + k)) : x;
        const sy = axis === "y" ? Math.min(height - 1, Math.max(0, y + k)) : y;
        const i = (sy * width + sx) * 4;
        rAcc += data[i]!;
        gAcc += data[i + 1]!;
        bAcc += data[i + 2]!;
        aAcc += data[i + 3]!;
      }
      const i = (y * width + x) * 4;
      tmp[i] = rAcc / window;
      tmp[i + 1] = gAcc / window;
      tmp[i + 2] = bAcc / window;
      tmp[i + 3] = aAcc / window;
    }
  }
  data.set(tmp);
}

/** Compute blurred version of an image. */
function computeBlurred(data: Uint8ClampedArray, width: number, height: number, radius: number): Uint8ClampedArray {
  const copy = new Uint8ClampedArray(data);
  blurPass(copy, width, height, radius, "x");
  blurPass(copy, width, height, radius, "y");
  return copy;
}

export default function ImageSharpener() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("sharpened.png");
  const [opts, setOpts] = useState<SharpenOptions>({ ...DEFAULT_OPTIONS });
  const [format, setFormat] = useState<OutputFormat>("image/png");
  const [quality, setQuality] = useState(0.9);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [splitPreview, setSplitPreview] = useState(false);
  const [loupePos, setLoupePos] = useState<{ x: number; y: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setFileName(file.name.replace(/\.[^.]+$/, "") + "-sharpened.png");
      setOpts({ ...DEFAULT_OPTIONS });
      setLoupePos({ x: img.naturalWidth / 2, y: img.naturalHeight / 2 });
      setError(null);
    };
    img.onerror = () => setError("Could not load image.");
    img.src = url;
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    onFile(e.dataTransfer.files?.[0]);
  }, [onFile]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) onFile(f);
          break;
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onFile]);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const v = validateSharpenOptions(opts);
    if ("error" in v) {
      setError(v.error);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const canvas = canvasRef.current;
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(image, 0, 0);
      if (!isIdentity(opts)) {
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const blurred = computeBlurred(data.data, canvas.width, canvas.height, opts.radius);
        const px = data.data;
        const w = canvas.width;
        const h = canvas.height;
        const r = Math.max(1, Math.round(opts.radius));
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            // Compute local variance for edge-aware mode
            let variance = 0;
            if (opts.mode === "edge-aware") {
              const patch: number[] = [];
              for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                  const sx = Math.min(w - 1, Math.max(0, x + dx));
                  const sy = Math.min(h - 1, Math.max(0, y + dy));
                  patch.push(px[(sy * w + sx) * 4]!);
                }
              }
              variance = localVariance(patch);
            }
            const original: RgbPixel = { r: px[i]!, g: px[i + 1]!, b: px[i + 2]!, a: px[i + 3]! };
            const blurredPx = { r: blurred[i]!, g: blurred[i + 1]!, b: blurred[i + 2]! };
            const out = sharpenPixel(original, blurredPx, opts, variance);
            px[i] = out.r;
            px[i + 1] = out.g;
            px[i + 2] = out.b;
          }
        }
        ctx.putImageData(data, 0, 0);
      }
      // Split preview: redraw left half as original
      if (splitPreview) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, canvas.width / 2, canvas.height);
        ctx.clip();
        ctx.drawImage(image, 0, 0);
        ctx.restore();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2, 0);
        ctx.lineTo(canvas.width / 2, canvas.height);
        ctx.stroke();
      }
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          if (previewUrl) URL.revokeObjectURL(previewUrl);
          setPreviewUrl(URL.createObjectURL(blob));
          setBusy(false);
          toast.success("Sharpened");
        },
        format,
        format === "image/png" ? undefined : quality,
      );
    } catch {
      setError("Sharpen failed — image may be too large");
      setBusy(false);
    }
  }, [image, opts, format, quality, previewUrl, splitPreview]);

  // Live preview
  useEffect(() => {
    if (!image) return;
    const t = setTimeout(() => apply(), 150);
    return () => clearTimeout(t);
  }, [image, opts, apply]);

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    if (splitPreview && image) {
      // Re-apply without split for download
      const canvas = canvasRef.current;
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(image, 0, 0);
        if (!isIdentity(opts)) {
          const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const blurred = computeBlurred(data.data, canvas.width, canvas.height, opts.radius);
          const px = data.data;
          const w = canvas.width;
          const h = canvas.height;
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              const i = (y * w + x) * 4;
              let variance = 0;
              if (opts.mode === "edge-aware") {
                const patch: number[] = [];
                for (let dy = -1; dy <= 1; dy++) {
                  for (let dx = -1; dx <= 1; dx++) {
                    const sx = Math.min(w - 1, Math.max(0, x + dx));
                    const sy = Math.min(h - 1, Math.max(0, y + dy));
                    patch.push(px[(sy * w + sx) * 4]!);
                  }
                }
                variance = localVariance(patch);
              }
              const original: RgbPixel = { r: px[i]!, g: px[i + 1]!, b: px[i + 2]!, a: px[i + 3]! };
              const blurredPx = { r: blurred[i]!, g: blurred[i + 1]!, b: blurred[i + 2]! };
              const out = sharpenPixel(original, blurredPx, opts, variance);
              px[i] = out.r;
              px[i + 1] = out.g;
              px[i + 2] = out.b;
            }
          }
          ctx.putImageData(data, 0, 0);
        }
      }
    }
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
  }, [image, opts, fileName, format, quality, splitPreview]);

  const setOpt = useCallback((key: keyof SharpenOptions, value: number | string) => {
    setOpts((o) => ({ ...o, [key]: value }));
  }, []);

  const noise = noiseWarning(opts);
  const halo = haloWarning(opts);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-lg p-6 text-center ${dragOver ? "border-primary bg-primary/5" : "border-border"}`}
          >
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Choose image</Button>
            <p className="text-xs text-muted-foreground mt-2">or drag-drop, or paste (Ctrl+V)</p>
          </div>
          {image && (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">{image.naturalWidth} × {image.naturalHeight}</Badge>
              <Badge variant="secondary">{opts.mode}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {image && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Mode</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {(["unsharp", "highpass", "edge-aware"] as SharpenMode[]).map((m) => (
                  <Button key={m} size="sm" variant={opts.mode === m ? "default" : "outline"} onClick={() => setOpt("mode", m)}>
                    {m === "unsharp" ? "Unsharp mask" : m === "highpass" ? "High-pass" : "Edge-aware"}
                  </Button>
                ))}
              </div>
            </div>
            <div onDoubleClick={() => setOpt("amount", 0)}>
              <Label className="text-xs text-muted-foreground">Amount: {opts.amount.toFixed(2)}</Label>
              <input type="range" min={0} max={500} value={Math.round(opts.amount * 100)} onChange={(e) => setOpt("amount", Number(e.target.value) / 100)} className="w-full" />
            </div>
            <div onDoubleClick={() => setOpt("radius", 1)}>
              <Label className="text-xs text-muted-foreground">Radius: {opts.radius.toFixed(1)}</Label>
              <input type="range" min={1} max={50} value={Math.round(opts.radius * 10)} onChange={(e) => setOpt("radius", Number(e.target.value) / 10)} className="w-full" />
            </div>
            <div onDoubleClick={() => setOpt("threshold", 0)}>
              <Label className="text-xs text-muted-foreground">Threshold: {opts.threshold} (protects skin/sky)</Label>
              <input type="range" min={0} max={50} value={opts.threshold} onChange={(e) => setOpt("threshold", Number(e.target.value))} className="w-full" />
            </div>
            <div className="flex flex-wrap gap-3 items-end pt-2">
              <div>
                <Label className="text-xs text-muted-foreground">Format</Label>
                <select value={format} onChange={(e) => setFormat(e.target.value as OutputFormat)} className="h-9 rounded-md border bg-background px-3 text-sm">
                  <option value="image/png">PNG (alpha)</option>
                  <option value="image/jpeg">JPEG (small)</option>
                  <option value="image/webp">WebP</option>
                </select>
              </div>
              {format !== "image/png" && (
                <div>
                  <Label className="text-xs text-muted-foreground">Quality: {Math.round(quality * 100)}%</Label>
                  <Input type="range" min={10} max={100} value={Math.round(quality * 100)} onChange={(e) => setQuality(Number(e.target.value) / 100)} className="w-32" />
                </div>
              )}
              <div className="flex items-end gap-2 pb-1">
                <Switch checked={splitPreview} onCheckedChange={setSplitPreview} id="split3" />
                <Label htmlFor="split3" className="text-xs cursor-pointer">Split before/after</Label>
              </div>
            </div>
            {noise && <p className="text-xs text-yellow-700 dark:text-yellow-400">{noise}</p>}
            {halo && <p className="text-xs text-yellow-700 dark:text-yellow-400">{halo}</p>}
            {!preservesAlpha(format) && (
              <p className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ JPEG does not preserve transparency.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={apply} disabled={busy}>{busy ? "Sharpening…" : "Apply"}</Button>
              <Button variant="outline" size="sm" onClick={() => setOpts({ ...DEFAULT_OPTIONS })}>Reset</Button>
              <DownloadButton
                getText={async () => {
                  if (!canvasRef.current) return "";
                  return await new Promise<string>((resolve) => {
                    canvasRef.current!.toBlob(
                      (blob) => {
                        if (!blob) return resolve("");
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.readAsDataURL(blob);
                      },
                      format,
                      format === "image/png" ? undefined : quality,
                    );
                  });
                }}
                filename={fileName}
                mime={format}
                label="Download"
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
            <p className="text-xs text-muted-foreground mb-2">{splitPreview ? "Before (left) / After (right)" : "Preview"}</p>
            <img src={previewUrl} alt="Sharpened preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> sharpening runs locally via the Canvas API. Unsharp mask, high-pass, and edge-aware modes computed in-browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
