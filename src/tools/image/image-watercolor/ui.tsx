"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, DownloadButton } from "../../_shared";
import { validateWatercolor, windowAverage, blendSoft } from "./logic";
import { toast } from "sonner";

export default function ImageWatercolor() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("watercolor.png");
  const [radius, setRadius] = useState(3);
  const [spread, setSpread] = useState(0.5);
  const [soften, setSoften] = useState(0.6);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const img = new Image();
    img.onload = () => { setImage(img); setFileName(file.name.replace(/\.[^.]+$/, "") + "-watercolor.png"); setError(null); };
    img.onerror = () => setError("Could not load image");
    img.src = URL.createObjectURL(file);
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const v = validateWatercolor({ radius, spread, soften });
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
      const out = new Uint8ClampedArray(px.length);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const avg = windowAverage(px, w, h, x, y, v.radius);
          const i = (y * w + x) * 4;
          // Two-pass: soften toward average, then expand spread chroma.
          const softened = blendSoft([px[i]!, px[i + 1]!, px[i + 2]!, px[i + 3]!], avg, v.soften);
          const spreaded = blendSoft(softened, avg, v.spread * 0.6);
          out[i] = spreaded[0]; out[i + 1] = spreaded[1]; out[i + 2] = spreaded[2]; out[i + 3] = spreaded[3];
        }
      }
      src.data.set(out);
      ctx.putImageData(src, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) return;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(blob));
        setBusy(false);
      }, "image/png");
    } catch {
      setError("Watercolor failed — image may be too large");
      setBusy(false);
    }
  }, [image, radius, spread, soften, previewUrl]);

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
              <Label className="text-xs text-muted-foreground">Brush radius: {radius}px</Label>
              <input type="range" min={1} max={10} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Color spread: {Math.round(spread * 100)}%</Label>
              <input type="range" min={0} max={100} value={Math.round(spread * 100)} onChange={(e) => setSpread(Number(e.target.value) / 100)} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Edge soften: {Math.round(soften * 100)}%</Label>
              <input type="range" min={0} max={100} value={Math.round(soften * 100)} onChange={(e) => setSoften(Number(e.target.value) / 100)} className="w-full" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={apply} disabled={busy}>{busy ? "Painting…" : "Apply watercolor"}</Button>
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
          <img src={previewUrl} alt="Watercolor preview" className="max-w-full rounded-md border" />
        </CardContent></Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Privacy:</strong> watercolor runs locally via the Canvas API.
        </p>
      </CardContent></Card>
    </div>
  );
}
