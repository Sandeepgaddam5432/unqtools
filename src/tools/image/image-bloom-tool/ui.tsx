"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, DownloadButton } from "../../_shared";
import { validateBloom, luma, passesThreshold, addBloom } from "./logic";
import { toast } from "sonner";

function boxBlur(data: Uint8ClampedArray, w: number, h: number, r: number) {
  const tmp = new Uint8ClampedArray(data.length);
  const win = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let rr = 0, gg = 0, bb = 0;
      for (let k = -r; k <= r; k++) {
        const sx = Math.min(w - 1, Math.max(0, x + k));
        const i = (y * w + sx) * 4;
        rr += data[i]!; gg += data[i + 1]!; bb += data[i + 2]!;
      }
      const i = (y * w + x) * 4;
      tmp[i] = rr / win; tmp[i + 1] = gg / win; tmp[i + 2] = bb / win; tmp[i + 3] = data[i + 3];
    }
  }
  data.set(tmp);
}

export default function ImageBloomTool() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("bloom.png");
  const [threshold, setThreshold] = useState(180);
  const [intensity, setIntensity] = useState(0.6);
  const [radius, setRadius] = useState(8);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const img = new Image();
    img.onload = () => { setImage(img); setFileName(file.name.replace(/\.[^.]+$/, "") + "-bloom.png"); setError(null); };
    img.onerror = () => setError("Could not load image");
    img.src = URL.createObjectURL(file);
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const v = validateBloom({ threshold, intensity, radius });
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
    const bloom = new Uint8ClampedArray(px.length);
    for (let i = 0; i < px.length; i += 4) {
      if (passesThreshold(px[i]!, px[i + 1]!, px[i + 2]!, v.threshold)) {
        bloom[i] = px[i]!; bloom[i + 1] = px[i + 1]!; bloom[i + 2] = px[i + 2]!; bloom[i + 3] = 255;
      }
    }
    if (v.radius > 0) {
      boxBlur(bloom, canvas.width, canvas.height, v.radius);
      boxBlur(bloom, canvas.width, canvas.height, v.radius);
    }
    for (let i = 0; i < px.length; i += 4) {
      const out = addBloom([px[i]!, px[i + 1]!, px[i + 2]!, px[i + 3]!], [bloom[i]!, bloom[i + 1]!, bloom[i + 2]!], v.intensity);
      px[i] = out[0]; px[i + 1] = out[1]; px[i + 2] = out[2];
    }
    ctx.putImageData(src, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    }, "image/png");
  }, [image, threshold, intensity, radius, previewUrl]);

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
              <Label className="text-xs text-muted-foreground">Threshold: {threshold}</Label>
              <input type="range" min={0} max={255} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Intensity: {Math.round(intensity * 100)}%</Label>
              <input type="range" min={0} max={100} value={Math.round(intensity * 100)} onChange={(e) => setIntensity(Number(e.target.value) / 100)} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Radius: {radius}px</Label>
              <input type="range" min={0} max={30} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={apply}>Apply bloom</Button>
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
          <img src={previewUrl} alt="Bloom preview" className="max-w-full rounded-md border" />
        </CardContent></Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Privacy:</strong> bloom runs locally via the Canvas API.
        </p>
      </CardContent></Card>
    </div>
  );
}
