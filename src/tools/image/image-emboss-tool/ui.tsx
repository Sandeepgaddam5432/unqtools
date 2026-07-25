"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import { embossKernel, applyKernel, validateEmbossOptions, type EmbossDirection } from "./logic";
import { toast } from "sonner";

const DIRS: EmbossDirection[] = ["top", "bottom", "left", "right", "topleft", "topright", "bottomleft", "bottomright"];

export default function ImageEmbossTool() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("embossed.png");
  const [direction, setDirection] = useState<EmbossDirection>("topleft");
  const [amount, setAmount] = useState(100);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setImage(img); setFileName(file.name.replace(/\.[^.]+$/, "") + "-embossed.png"); setError(null); setPreviewUrl(null); };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const v = validateEmbossOptions({ direction, amount });
    if ("error" in v) { setError(v.error); return; }
    setError(null);
    const canvas = canvasRef.current;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0);
    const src = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const dst = ctx.createImageData(canvas.width, canvas.height);
    const s = src.data, d = dst.data, w = canvas.width, h = canvas.height;
    const k = embossKernel(direction);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        for (let c = 0; c < 3; c++) {
          const center = s[(y * w + x) * 4 + c]!;
          const neighbors: number[] = [];
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dy === 0 && dx === 0) continue;
              const sx = Math.max(0, Math.min(w - 1, x + dx));
              const sy = Math.max(0, Math.min(h - 1, y + dy));
              neighbors.push(s[(sy * w + sx) * 4 + c]!);
            }
          }
          d[(y * w + x) * 4 + c] = applyKernel(k, center, neighbors, amount);
        }
        d[(y * w + x) * 4 + 3] = s[(y * w + x) * 4 + 3]!;
      }
    }
    ctx.putImageData(dst, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    }, "image/png");
  }, [image, direction, amount, previewUrl]);

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
          <div className="flex flex-wrap gap-2">
            {DIRS.map((dir) => (
              <Button key={dir} size="sm" variant={direction === dir ? "default" : "outline"} onClick={() => setDirection(dir)}>{dir}</Button>
            ))}
          </div>
          <div><Label className="text-xs text-muted-foreground">Amount: {amount}</Label><input type="range" min={0} max={200} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-full" /></div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={apply}>Emboss</Button>
            <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
            {previewUrl && <CopyButton getText={() => previewUrl} label="Copy URL" />}
          </div>
        </CardContent></Card>
      )}
      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-2">Preview</p>
          <img src={previewUrl} alt="Embossed preview" className="max-w-full rounded-md border" />
        </CardContent></Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> emboss runs locally via Canvas API.</p></CardContent></Card>
    </div>
  );
}
