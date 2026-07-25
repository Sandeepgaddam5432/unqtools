"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, DownloadButton } from "../../_shared";
import { validateNeon, luma, sobelMag, isEdge, glowFalloff, blendNeon, SOBEL_X, SOBEL_Y, applyKernel } from "./logic";
import { toast } from "sonner";

export default function ImageNeonGlow() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("neon-glow.png");
  const [threshold, setThreshold] = useState(80);
  const [radius, setRadius] = useState(4);
  const [color, setColor] = useState("#ff2bd6");
  const [intensity, setIntensity] = useState(0.8);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const img = new Image();
    img.onload = () => { setImage(img); setFileName(file.name.replace(/\.[^.]+$/, "") + "-neon.png"); setError(null); };
    img.onerror = () => setError("Could not load image");
    img.src = URL.createObjectURL(file);
  }, []);

  const hexToRgb = (hex: string): [number, number, number] => {
    const m = hex.replace("#", "");
    return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
  };

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const v = validateNeon({ threshold, radius, color: hexToRgb(color), intensity });
    if ("error" in v) { setError(v.error); return; }
    setError(null); setBusy(true);
    try {
      const canvas = canvasRef.current;
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(image, 0, 0);
      const src = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const px = src.data;
      const w = canvas.width, h = canvas.height;
      const gray: number[] = new Array(w * h);
      for (let i = 0, p = 0; i < px.length; i += 4, p++) gray[p] = luma(px[i]!, px[i + 1]!, px[i + 2]!);
      const edgeMap = new Float32Array(w * h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const gx = applyKernel(gray, x, y, w, h, SOBEL_X);
          const gy = applyKernel(gray, x, y, w, h, SOBEL_Y);
          const m = Math.sqrt(gx * gx + gy * gy);
          edgeMap[y * w + x] = isEdge(m, v.threshold) ? 1 : 0;
        }
      }
      // Darken background for contrast
      for (let i = 0; i < px.length; i += 4) {
        px[i] = Math.round(px[i]! * 0.15);
        px[i + 1] = Math.round(px[i + 1]! * 0.15);
        px[i + 2] = Math.round(px[i + 2]! * 0.15);
      }
      // Add glow around each edge pixel
      const r = v.radius;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (!edgeMap[y * w + x]) continue;
          for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
              const sx = x + dx, sy = y + dy;
              if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
              const dist = Math.hypot(dx, dy);
              const amt = glowFalloff(dist, r) * v.intensity;
              if (amt < 0.02) continue;
              const i = (sy * w + sx) * 4;
              const out = blendNeon([px[i]!, px[i + 1]!, px[i + 2]!, px[i + 3]!], v.color, amt);
              px[i] = out[0]; px[i + 1] = out[1]; px[i + 2] = out[2];
            }
          }
        }
      }
      ctx.putImageData(src, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) return;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(blob));
        setBusy(false);
      }, "image/png");
    } catch {
      setError("Neon glow failed — image may be too large");
      setBusy(false);
    }
  }, [image, threshold, radius, color, intensity, previewUrl]);

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
      <Card>
        <CardContent className="p-4 space-y-3">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Choose image</Button>
        </CardContent>
      </Card>
      {image && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Edge threshold: {threshold}</Label>
              <input type="range" min={10} max={200} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Glow radius: {radius}px</Label>
              <input type="range" min={1} max={15} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Intensity: {Math.round(intensity * 100)}%</Label>
              <input type="range" min={0} max={100} value={Math.round(intensity * 100)} onChange={(e) => setIntensity(Number(e.target.value) / 100)} className="w-full" />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Color</Label>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-12 rounded border" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={apply} disabled={busy}>{busy ? "Glowing…" : "Apply neon glow"}</Button>
              <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
              <DownloadButton getText={() => previewUrl ?? ""} filename={fileName} disabled={!previewUrl} mime="image/png" />
            </div>
          </CardContent>
        </Card>
      )}
      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-2">Preview</p>
          <img src={previewUrl} alt="Neon glow preview" className="max-w-full rounded-md border" />
        </CardContent></Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Privacy:</strong> neon glow runs locally via the Canvas API.
        </p>
      </CardContent></Card>
    </div>
  );
}
