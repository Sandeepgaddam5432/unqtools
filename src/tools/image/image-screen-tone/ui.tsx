"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, DownloadButton } from "../../_shared";
import { generateGrid, shouldDrawDot, scaledDotRadius, validateScreenToneOptions } from "./logic";
import { toast } from "sonner";

export default function ImageScreenTone() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("screen-tone.png");
  const [spacing, setSpacing] = useState(8);
  const [radius, setRadius] = useState(3);
  const [threshold, setThreshold] = useState(128);
  const [angle, setAngle] = useState(45);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setImage(img); setFileName(file.name.replace(/\.[^.]+$/, "") + "-screentone.png"); setError(null); setPreviewUrl(null); };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const opts = { spacing, radius, threshold, angle };
    const v = validateScreenToneOptions(opts);
    if ("error" in v) { setError(v.error); return; }
    setError(null);
    const canvas = canvasRef.current;
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Read source brightness.
    const tmp = document.createElement("canvas");
    tmp.width = canvas.width; tmp.height = canvas.height;
    const tctx = tmp.getContext("2d");
    if (!tctx) return;
    tctx.drawImage(image, 0, 0);
    const src = tctx.getImageData(0, 0, canvas.width, canvas.height).data;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000";
    const dots = generateGrid(canvas.width, canvas.height, opts);
    for (const d of dots) {
      const px = Math.round(d.x);
      const py = Math.round(d.y);
      if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) continue;
      const i = (py * canvas.width + px) * 4;
      const b = 0.299 * src[i]! + 0.587 * src[i + 1]! + 0.114 * src[i + 2]!;
      if (!shouldDrawDot(b, opts)) continue;
      const r = scaledDotRadius(b, opts);
      ctx.beginPath();
      ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    }, "image/png");
  }, [image, spacing, radius, threshold, angle, previewUrl]);

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
              <Label className="text-xs text-muted-foreground">Dot spacing: {spacing}px</Label>
              <input type="range" min={2} max={32} value={spacing} onChange={(e) => setSpacing(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Dot radius: {radius}px</Label>
              <input type="range" min={1} max={Math.floor(spacing / 2)} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Threshold: {threshold}</Label>
              <input type="range" min={0} max={255} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Grid angle: {angle}°</Label>
              <input type="range" min={0} max={90} value={angle} onChange={(e) => setAngle(Number(e.target.value))} className="w-full" />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" onClick={apply}>Apply screen tone</Button>
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
            <img src={previewUrl} alt="Screen tone preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> screen tone rendering runs locally via the Canvas API.</p>
        </CardContent>
      </Card>
    </div>
  );
}
