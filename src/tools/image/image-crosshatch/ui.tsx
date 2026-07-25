"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, DownloadButton } from "../../_shared";
import { hatchLayers, generateHatchLines, layerAngle, validateCrosshatchOptions } from "./logic";
import { toast } from "sonner";

export default function ImageCrosshatch() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("crosshatch.png");
  const [spacing, setSpacing] = useState(6);
  const [t1, setT1] = useState(200);
  const [t2, setT2] = useState(128);
  const [t3, setT3] = useState(64);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setImage(img); setFileName(file.name.replace(/\.[^.]+$/, "") + "-crosshatch.png"); setError(null); setPreviewUrl(null); };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const opts = { spacing, threshold1: t1, threshold2: t2, threshold3: t3 };
    const v = validateCrosshatchOptions(opts);
    if ("error" in v) { setError(v.error); return; }
    setError(null);
    const canvas = canvasRef.current;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    // Sample image into tile grid; draw hatch lines per tile per layer.
    const tmp = document.createElement("canvas");
    tmp.width = canvas.width; tmp.height = canvas.height;
    const tctx = tmp.getContext("2d");
    if (!tctx) return;
    tctx.drawImage(image, 0, 0);
    const src = tctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const tile = Math.max(8, spacing * 2);
    for (let ty = 0; ty < canvas.height; ty += tile) {
      for (let tx = 0; tx < canvas.width; tx += tile) {
        // Avg brightness over tile.
        let sum = 0, count = 0;
        for (let y = ty; y < ty + tile && y < canvas.height; y++) {
          for (let x = tx; x < tx + tile && x < canvas.width; x++) {
            const i = (y * canvas.width + x) * 4;
            sum += 0.299 * src[i]! + 0.587 * src[i + 1]! + 0.114 * src[i + 2]!;
            count++;
          }
        }
        const b = count > 0 ? sum / count : 255;
        const layers = hatchLayers(b, opts);
        for (const layer of layers) {
          const angle = layerAngle(layer);
          const dx = Math.cos(angle), dy = Math.sin(angle);
          const cx = tx + tile / 2, cy = ty + tile / 2;
          const len = tile;
          ctx.beginPath();
          ctx.moveTo(cx - dx * len, cy - dy * len);
          ctx.lineTo(cx + dx * len, cy + dy * len);
          ctx.stroke();
        }
      }
    }
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    }, "image/png");
  }, [image, spacing, t1, t2, t3, previewUrl]);

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
              <Label className="text-xs text-muted-foreground">Line spacing: {spacing}px</Label>
              <input type="range" min={2} max={32} value={spacing} onChange={(e) => setSpacing(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Layer 1 threshold: {t1}</Label>
              <input type="range" min={0} max={255} value={t1} onChange={(e) => setT1(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Layer 2 threshold: {t2}</Label>
              <input type="range" min={0} max={255} value={t2} onChange={(e) => setT2(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Layer 3 threshold: {t3}</Label>
              <input type="range" min={0} max={255} value={t3} onChange={(e) => setT3(Number(e.target.value))} className="w-full" />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" onClick={apply}>Apply crosshatch</Button>
              <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
              <DownloadButton getText={async () => ""} filename={fileName} mime="image/png" label="Download (shared)" disabled={!previewUrl} />
            </div>
          </CardContent>
        </Card>
      )}

      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            <img src={previewUrl} alt="Crosshatch preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> crosshatch rendering runs locally via the Canvas API.</p>
        </CardContent>
      </Card>
    </div>
  );
}
