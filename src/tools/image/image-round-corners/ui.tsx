"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "../../_shared";
import { clampRadius, cornerAlpha, validateRoundedOptions } from "./logic";
import { toast } from "sonner";

export default function ImageRoundCorners() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("rounded.png");
  const [radius, setRadius] = useState(20);
  const [feather, setFeather] = useState(50);
  const [bgColor, setBgColor] = useState("#ffffff");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file");
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setFileName(file.name.replace(/\.[^.]+$/, "") + "-rounded.png");
      setError(null);
      setPreviewUrl(null);
    };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const w = image.naturalWidth;
    const h = image.naturalHeight;
    const v = validateRoundedOptions({ radius, feather }, w, h);
    if ("error" in v) { setError(v.error); return; }
    setError(null);
    const canvas = canvasRef.current;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(image, 0, 0);
    const r = clampRadius(radius, w, h);
    const f = Math.max(0.5, (feather / 100) * r);
    const data = ctx.getImageData(0, 0, w, h);
    const px = data.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const a = cornerAlpha(x, y, w, h, r, f);
        if (a < 1) {
          // blend with bg color
          const bgR = parseInt(bgColor.slice(1, 3), 16);
          const bgG = parseInt(bgColor.slice(3, 5), 16);
          const bgB = parseInt(bgColor.slice(5, 7), 16);
          px[i] = Math.round(px[i]! * a + bgR * (1 - a));
          px[i + 1] = Math.round(px[i + 1]! * a + bgG * (1 - a));
          px[i + 2] = Math.round(px[i + 2]! * a + bgB * (1 - a));
        }
      }
    }
    ctx.putImageData(data, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    }, "image/png");
  }, [image, radius, feather, bgColor, previewUrl]);

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
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
              <Label className="text-xs text-muted-foreground">Corner radius: {radius}px</Label>
              <input type="range" min={0} max={200} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Feather: {feather}%</Label>
              <input type="range" min={0} max={100} value={feather} onChange={(e) => setFeather(Number(e.target.value))} className="w-full" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Background color</Label>
              <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="h-9 w-32 rounded-md border bg-background" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={apply}>Round corners</Button>
              <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            <img src={previewUrl} alt="Rounded corners preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> corner rounding runs locally via the Canvas API.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
