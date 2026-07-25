"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, DownloadButton } from "../../_shared";
import { generateStatic, validateTvStaticOptions } from "./logic";
import { toast } from "sonner";

export default function ImageTvStatic() {
  const [fileName, setFileName] = useState("tv-static.png");
  const [width, setWidth] = useState(320);
  const [height, setHeight] = useState(240);
  const [intensity, setIntensity] = useState(0.2);
  const [monochrome, setMonochrome] = useState(true);
  const [seed, setSeed] = useState(42);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const apply = useCallback(() => {
    const opts = { intensity, monochrome, seed };
    const v = validateTvStaticOptions(opts);
    if ("error" in v) { setError(v.error); return; }
    setError(null);
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pixels = generateStatic(width, height, opts);
    const img = ctx.createImageData(width, height);
    const px = img.data;
    for (let i = 0; i < pixels.length; i++) {
      const p = pixels[i]!;
      px[i * 4] = p.r;
      px[i * 4 + 1] = p.g;
      px[i * 4 + 2] = p.b;
      px[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    }, "image/png");
  }, [width, height, intensity, monochrome, seed, previewUrl]);

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
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs text-muted-foreground">Width</Label><input type="number" min={16} max={1024} value={width} onChange={(e) => setWidth(Number(e.target.value))} className="w-full h-9 rounded-md border bg-background px-3 text-sm" /></div>
            <div><Label className="text-xs text-muted-foreground">Height</Label><input type="number" min={16} max={1024} value={height} onChange={(e) => setHeight(Number(e.target.value))} className="w-full h-9 rounded-md border bg-background px-3 text-sm" /></div>
          </div>
          <div><Label className="text-xs text-muted-foreground">Intensity: {Math.round(intensity * 100)}%</Label><input type="range" min={0} max={100} value={Math.round(intensity * 100)} onChange={(e) => setIntensity(Number(e.target.value) / 100)} className="w-full" /></div>
          <div><Label className="text-xs text-muted-foreground">Seed</Label><input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} className="w-full h-9 rounded-md border bg-background px-3 text-sm" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={monochrome} onChange={(e) => setMonochrome(e.target.checked)} /><span>Monochrome</span></label>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={apply}>Generate static</Button>
            <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
            <DownloadButton getText={async () => ""} filename={fileName} mime="image/png" label="Download (shared)" disabled={!previewUrl} />
          </div>
        </CardContent>
      </Card>

      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            <img src={previewUrl} alt="TV static preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> static rendering runs locally via the Canvas API.</p>
        </CardContent>
      </Card>
    </div>
  );
}
