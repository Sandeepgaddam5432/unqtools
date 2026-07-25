"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, DownloadButton } from "../../_shared";
import { escapeIterations, iterToColor, pixelToComplex, validateFractalOptions } from "./logic";
import { toast } from "sonner";

export default function ImageFractalTool() {
  const [fileName, setFileName] = useState("fractal.png");
  const [size, setSize] = useState(256);
  const [cx, setCx] = useState(-0.5);
  const [cy, setCy] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [maxIter, setMaxIter] = useState(128);
  const [julia, setJulia] = useState(false);
  const [jx, setJx] = useState(-0.7);
  const [jy, setJy] = useState(0.27);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const apply = useCallback(() => {
    const opts = { cx, cy, zoom, maxIter, julia, jx, jy, escape: 4 };
    const v = validateFractalOptions(opts);
    if ("error" in v) { setError(v.error); return; }
    setError(null);
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(size, size);
    const px = img.data;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const c = pixelToComplex(x, y, size, size, opts);
        const iter = escapeIterations(c.x, c.y, opts);
        const col = iterToColor(iter, maxIter);
        const i = (y * size + x) * 4;
        px[i] = col.r; px[i + 1] = col.g; px[i + 2] = col.b; px[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    }, "image/png");
  }, [size, cx, cy, zoom, maxIter, julia, jx, jy, previewUrl]);

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
          <div>
            <Label className="text-xs text-muted-foreground">Size: {size}px</Label>
            <input type="range" min={64} max={512} step={32} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs text-muted-foreground">Center X</Label><input type="number" step="0.01" value={cx} onChange={(e) => setCx(Number(e.target.value))} className="w-full h-9 rounded-md border bg-background px-3 text-sm" /></div>
            <div><Label className="text-xs text-muted-foreground">Center Y</Label><input type="number" step="0.01" value={cy} onChange={(e) => setCy(Number(e.target.value))} className="w-full h-9 rounded-md border bg-background px-3 text-sm" /></div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Zoom: {zoom}x</Label>
            <input type="range" min={0.1} max={100} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Max iterations: {maxIter}</Label>
            <input type="range" min={16} max={1024} step={16} value={maxIter} onChange={(e) => setMaxIter(Number(e.target.value))} className="w-full" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={julia} onChange={(e) => setJulia(e.target.checked)} />
            <span>Julia mode</span>
          </label>
          {julia && (
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs text-muted-foreground">Julia X</Label><input type="number" step="0.01" value={jx} onChange={(e) => setJx(Number(e.target.value))} className="w-full h-9 rounded-md border bg-background px-3 text-sm" /></div>
              <div><Label className="text-xs text-muted-foreground">Julia Y</Label><input type="number" step="0.01" value={jy} onChange={(e) => setJy(Number(e.target.value))} className="w-full h-9 rounded-md border bg-background px-3 text-sm" /></div>
            </div>
          )}
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={apply}>Generate fractal</Button>
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
            <img src={previewUrl} alt="Fractal preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> fractal rendering runs locally via the Canvas API.</p>
        </CardContent>
      </Card>
    </div>
  );
}
