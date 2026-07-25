"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ErrorBanner, DownloadButton } from "../../_shared";
import { plasmaValue, normalizePlasma, plasmaToRgb, validatePlasmaOptions } from "./logic";
import { toast } from "sonner";

export default function ImagePlasmaEffect() {
  const [fileName, setFileName] = useState("plasma.png");
  const [width, setWidth] = useState(256);
  const [height, setHeight] = useState(256);
  const [a, setA] = useState(8);
  const [b, setB] = useState(8);
  const [c, setC] = useState(16);
  const [d, setD] = useState(16);
  const [hueOffset, setHueOffset] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const apply = useCallback(() => {
    const opts = { a, b, c, d, hueOffset };
    const v = validatePlasmaOptions(opts);
    if ("error" in v) { setError(v.error); return; }
    setError(null);
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(width, height);
    const px = img.data;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const v = plasmaValue(x, y, opts);
        const t = normalizePlasma(v);
        const rgb = plasmaToRgb(t, hueOffset);
        const i = (y * width + x) * 4;
        px[i] = rgb.r; px[i + 1] = rgb.g; px[i + 2] = rgb.b; px[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    }, "image/png");
  }, [width, height, a, b, c, d, hueOffset, previewUrl]);

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
            <div>
              <Label className="text-xs text-muted-foreground">Width</Label>
              <input type="number" min={16} max={1024} value={width} onChange={(e) => setWidth(Number(e.target.value))} className="w-full h-9 rounded-md border bg-background px-3 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Height</Label>
              <input type="number" min={16} max={1024} value={height} onChange={(e) => setHeight(Number(e.target.value))} className="w-full h-9 rounded-md border bg-background px-3 text-sm" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Frequency a: {a}</Label>
            <input type="range" min={1} max={64} value={a} onChange={(e) => setA(Number(e.target.value))} className="w-full" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Frequency b: {b}</Label>
            <input type="range" min={1} max={64} value={b} onChange={(e) => setB(Number(e.target.value))} className="w-full" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Frequency c: {c}</Label>
            <input type="range" min={1} max={64} value={c} onChange={(e) => setC(Number(e.target.value))} className="w-full" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Frequency d: {d}</Label>
            <input type="range" min={1} max={64} value={d} onChange={(e) => setD(Number(e.target.value))} className="w-full" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Hue offset: {hueOffset}°</Label>
            <input type="range" min={0} max={360} value={hueOffset} onChange={(e) => setHueOffset(Number(e.target.value))} className="w-full" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={apply}>Generate plasma</Button>
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
            <img src={previewUrl} alt="Plasma preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> plasma rendering runs locally via the Canvas API.</p>
        </CardContent>
      </Card>
    </div>
  );
}
