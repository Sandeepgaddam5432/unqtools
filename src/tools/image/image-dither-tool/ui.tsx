"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import { quantize, bayerThreshold, validateDitherOptions, FLOYD_STEINBERG_WEIGHTS, type DitherMode } from "./logic";
import { toast } from "sonner";

export default function ImageDitherTool() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("dithered.png");
  const [mode, setMode] = useState<DitherMode>("floyd-steinberg");
  const [levels, setLevels] = useState(2);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setImage(img); setFileName(file.name.replace(/\.[^.]+$/, "") + "-dithered.png"); setError(null); setPreviewUrl(null); };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const v = validateDitherOptions({ mode, levels });
    if ("error" in v) { setError(v.error); return; }
    setError(null);
    const canvas = canvasRef.current;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = data.data, w = canvas.width, h = canvas.height;
    if (mode === "floyd-steinberg") {
      const buf = new Float32Array(w * h * 3);
      for (let i = 0, j = 0; i < px.length; i += 4, j += 3) {
        buf[j] = px[i]!; buf[j + 1] = px[i + 1]!; buf[j + 2] = px[i + 2]!;
      }
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const j = (y * w + x) * 3;
          for (let c = 0; c < 3; c++) {
            const old = buf[j + c]!;
            const nw = quantize(old, levels);
            buf[j + c] = nw;
            const err = old - nw;
            if (x + 1 < w) buf[j + 3 + c]! += err * FLOYD_STEINBERG_WEIGHTS.right;
            if (y + 1 < h) {
              if (x > 0) buf[j + (w - 1) * 3 + c]! += err * FLOYD_STEINBERG_WEIGHTS.bottomLeft;
              buf[j + w * 3 + c]! += err * FLOYD_STEINBERG_WEIGHTS.bottom;
              if (x + 1 < w) buf[j + (w + 1) * 3 + c]! += err * FLOYD_STEINBERG_WEIGHTS.bottomRight;
            }
          }
        }
      }
      for (let i = 0, j = 0; i < px.length; i += 4, j += 3) {
        px[i] = buf[j]!; px[i + 1] = buf[j + 1]!; px[i + 2] = buf[j + 2]!;
      }
    } else if (mode === "ordered") {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const t = bayerThreshold(x, y);
          const step = 255 / Math.max(1, levels - 1);
          for (let c = 0; c < 3; c++) {
            const adjusted = px[i + c]! + step * (t - 0.5);
            px[i + c] = quantize(adjusted, levels);
          }
        }
      }
    } else {
      for (let i = 0; i < px.length; i += 4) {
        const step = 255 / Math.max(1, levels - 1);
        for (let c = 0; c < 3; c++) {
          const noise = Math.random();
          const adjusted = px[i + c]! + (noise - 0.5) * step;
          px[i + c] = quantize(adjusted, levels);
        }
      }
    }
    ctx.putImageData(data, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    }, "image/png");
  }, [image, mode, levels, previewUrl]);

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

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 space-y-3">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Choose image</Button>
      </CardContent></Card>
      {image && (
        <Card><CardContent className="p-4 space-y-3">
          <div className="flex gap-2">
            {(["floyd-steinberg", "ordered", "random"] as DitherMode[]).map((m) => (
              <Button key={m} size="sm" variant={mode === m ? "default" : "outline"} onClick={() => setMode(m)}>{m}</Button>
            ))}
          </div>
          <div><Label className="text-xs text-muted-foreground">Levels: {levels}</Label><input type="range" min={2} max={8} step={1} value={levels} onChange={(e) => setLevels(Number(e.target.value))} className="w-full" /></div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={apply}>Dither</Button>
            <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
            {previewUrl && <CopyButton getText={() => previewUrl} label="Copy URL" />}
          </div>
        </CardContent></Card>
      )}
      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-2">Preview</p>
          <img src={previewUrl} alt="Dithered preview" className="max-w-full rounded-md border" />
        </CardContent></Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> dithering runs locally via Canvas API.</p></CardContent></Card>
    </div>
  );
}
