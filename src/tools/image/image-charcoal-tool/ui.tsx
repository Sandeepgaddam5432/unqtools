"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, DownloadButton } from "../../_shared";
import { validateCharcoal, SOBEL_X, SOBEL_Y, applyKernel, luma, edgeToCharcoal } from "./logic";
import { toast } from "sonner";

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export default function ImageCharcoalTool() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("charcoal.png");
  const [strength, setStrength] = useState(0.6);
  const [texture, setTexture] = useState(0.3);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const img = new Image();
    img.onload = () => { setImage(img); setFileName(file.name.replace(/\.[^.]+$/, "") + "-charcoal.png"); setError(null); };
    img.onerror = () => setError("Could not load image");
    img.src = URL.createObjectURL(file);
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const v = validateCharcoal({ strength, texture });
    if ("error" in v) { setError(v.error); return; }
    setError(null);
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
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const gx = applyKernel(gray, x, y, w, h, SOBEL_X);
        const gy = applyKernel(gray, x, y, w, h, SOBEL_Y);
        const mag = Math.sqrt(gx * gx + gy * gy);
        const noise = Math.random();
        const c = edgeToCharcoal(mag, v.strength, v.texture, noise);
        const i = (y * w + x) * 4;
        px[i] = c; px[i + 1] = c; px[i + 2] = c;
      }
    }
    ctx.putImageData(src, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    }, "image/png");
  }, [image, strength, texture, previewUrl]);

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
              <Label className="text-xs text-muted-foreground">Stroke strength: {Math.round(strength * 100)}%</Label>
              <input type="range" min={0} max={100} value={Math.round(strength * 100)} onChange={(e) => setStrength(Number(e.target.value) / 100)} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Paper texture: {Math.round(texture * 100)}%</Label>
              <input type="range" min={0} max={100} value={Math.round(texture * 100)} onChange={(e) => setTexture(Number(e.target.value) / 100)} className="w-full" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={apply}>Apply charcoal</Button>
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
          <img src={previewUrl} alt="Charcoal preview" className="max-w-full rounded-md border" />
        </CardContent></Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Privacy:</strong> charcoal effect runs locally via the Canvas API.
        </p>
      </CardContent></Card>
    </div>
  );
}
