"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "../../_shared";
import { parseHex, sampleGradient, gradientT, validateGradientOptions, type GradientDirection, type GradientStop } from "./logic";
import { toast } from "sonner";

export default function ImageGradientMaker() {
  const [width, setWidth] = useState("800");
  const [height, setHeight] = useState("600");
  const [direction, setDirection] = useState<GradientDirection>("horizontal");
  const [stops, setStops] = useState<GradientStop[]>([
    { offset: 0, color: { r: 255, g: 80, b: 120 } },
    { offset: 1, color: { r: 80, g: 120, b: 255 } },
  ]);
  const [color1, setColor1] = useState("#ff5078");
  const [color2, setColor2] = useState("#5078ff");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const apply = useCallback(() => {
    const c1 = parseHex(color1);
    const c2 = parseHex(color2);
    if (!c1 || !c2) {
      setError("Invalid hex color");
      return;
    }
    const w = Number(width);
    const h = Number(height);
    const opts = { type: "linear" as const, direction, stops: [{ offset: 0, color: c1 }, { offset: 1, color: c2 }], width: w, height: h };
    const v = validateGradientOptions(opts);
    if ("error" in v) {
      setError(v.error);
      return;
    }
    setError(null);
    setStops(opts.stops);
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const imgData = ctx.createImageData(w, h);
    const px = imgData.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const t = gradientT(x, y, w, h, direction);
        const c = sampleGradient(opts.stops, t);
        const i = (y * w + x) * 4;
        px[i] = Math.max(0, Math.min(255, Math.round(c.r)));
        px[i + 1] = Math.max(0, Math.min(255, Math.round(c.g)));
        px[i + 2] = Math.max(0, Math.min(255, Math.round(c.b)));
        px[i + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    }, "image/png");
  }, [width, height, direction, color1, color2, previewUrl]);

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "gradient.png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Image downloaded");
    }, "image/png");
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Width</Label>
              <Input type="number" value={width} onChange={(e) => setWidth(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Height</Label>
              <Input type="number" value={height} onChange={(e) => setHeight(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Start color</Label>
              <input type="color" value={color1} onChange={(e) => setColor1(e.target.value)} className="h-9 w-full rounded-md border bg-background" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">End color</Label>
              <input type="color" value={color2} onChange={(e) => setColor2(e.target.value)} className="h-9 w-full rounded-md border bg-background" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Direction</Label>
            <select value={direction} onChange={(e) => setDirection(e.target.value as GradientDirection)} className="h-9 rounded-md border bg-background px-3 text-sm">
              <option value="horizontal">Horizontal</option>
              <option value="vertical">Vertical</option>
              <option value="diagonal">Diagonal</option>
              <option value="diagonal-rev">Diagonal reverse</option>
              <option value="radial">Radial</option>
            </select>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={apply}>Generate gradient</Button>
            <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
          </div>
        </CardContent>
      </Card>

      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            <img src={previewUrl} alt="Gradient preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> gradient rendering runs locally via the Canvas API.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
