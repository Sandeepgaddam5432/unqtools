"use client";

import React, { useState, useCallback, useRef, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  mapDrostePixel, validateDrosteOptions, spiralPath, spiralTurns,
  spiralLength, levelTransform, fmt,
} from "./logic";
import { toast } from "sonner";

export default function ImageDrosteEffect() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("droste.png");
  const [levels, setLevels] = useState(4);
  const [twist, setTwist] = useState(0.3);
  const [innerRadius, setInnerRadius] = useState(0.5);
  const [cxOffset, setCxOffset] = useState(0);
  const [cyOffset, setCyOffset] = useState(0);
  const [scale, setScale] = useState(1);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const opts = { levels, twist, innerRadius, cxOffset, cyOffset, scale };

  const spiralPreview = useMemo(() => {
    const cx = 50, cy = 50, maxR = 45;
    return spiralPath(cx, cy, maxR, twist, 60);
  }, [twist]);

  const pathD = useMemo(() => spiralPreview.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" "), [spiralPreview]);

  const turns = useMemo(() => spiralTurns(twist), [twist]);
  const length = useMemo(() => spiralLength(50, 50, 45, twist, 60), [twist]);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setImage(img); setFileName(file.name.replace(/\.[^.]+$/, "") + "-droste.png"); setError(null); setPreviewUrl(null); };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const v = validateDrosteOptions(opts);
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
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const m = mapDrostePixel(x, y, w, h, opts);
        const sx = Math.max(0, Math.min(w - 1, Math.round(m.x)));
        const sy = Math.max(0, Math.min(h - 1, Math.round(m.y)));
        const si = (sy * w + sx) * 4;
        const di = (y * w + x) * 4;
        d[di] = s[si]!; d[di + 1] = s[si + 1]!; d[di + 2] = s[si + 2]!; d[di + 3] = s[si + 3]!;
      }
    }
    ctx.putImageData(dst, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      toast.success("Droste applied");
    }, "image/png");
  }, [image, opts, previewUrl]);

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

  const csv = useMemo(() => [
    "Field,Value",
    `Levels,${levels}`,
    `Twist,${twist}`,
    `Inner radius,${innerRadius}`,
    `CX offset,${cxOffset}`,
    `CY offset,${cyOffset}`,
    `Scale,${scale}`,
    `Turns,${fmt(turns, 3)}`,
    `Spiral length,${fmt(length, 2)}`,
  ].join("\n"), [levels, twist, innerRadius, cxOffset, cyOffset, scale, turns, length]);

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4 space-y-3">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Choose image</Button>
      </CardContent></Card>

      {image && (
        <Card><CardContent className="p-4 space-y-3">
          <div><Label className="text-xs text-muted-foreground">Levels: {levels}</Label><input type="range" min={1} max={8} step={1} value={levels} onChange={(e) => setLevels(Number(e.target.value))} className="w-full" /></div>
          <div><Label className="text-xs text-muted-foreground">Twist: {twist.toFixed(2)} rad</Label><input type="range" min={-3.14} max={3.14} step={0.05} value={twist} onChange={(e) => setTwist(Number(e.target.value))} className="w-full" /></div>
          <div><Label className="text-xs text-muted-foreground">Inner radius: {innerRadius.toFixed(2)}</Label><input type="range" min={0.1} max={0.9} step={0.05} value={innerRadius} onChange={(e) => setInnerRadius(Number(e.target.value))} className="w-full" /></div>
          <div><Label className="text-xs text-muted-foreground">Center X offset: {cxOffset.toFixed(2)}</Label><input type="range" min={-0.5} max={0.5} step={0.05} value={cxOffset} onChange={(e) => setCxOffset(Number(e.target.value))} className="w-full" /></div>
          <div><Label className="text-xs text-muted-foreground">Center Y offset: {cyOffset.toFixed(2)}</Label><input type="range" min={-0.5} max={0.5} step={0.05} value={cyOffset} onChange={(e) => setCyOffset(Number(e.target.value))} className="w-full" /></div>
          <div><Label className="text-xs text-muted-foreground">Scale: {scale.toFixed(2)}</Label><input type="range" min={0.5} max={2} step={0.05} value={scale} onChange={(e) => setScale(Number(e.target.value))} className="w-full" /></div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={apply}>Apply Droste</Button>
            <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
            <CopyButton getText={() => csv} label="Copy CSV" />
            <DownloadButton getText={() => csv} filename="droste-params.csv" mime="text/csv" />
            <Button size="sm" variant="ghost" onClick={() => { setLevels(4); setTwist(0.3); setInnerRadius(0.5); setCxOffset(0); setCyOffset(0); setScale(1); }}>Reset</Button>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">Turns: {fmt(turns, 2)}</Badge>
            <Badge variant="outline">Length: {fmt(length, 1)}</Badge>
            <Badge variant="outline">Level 1: scale={fmt(levelTransform(1, opts).scale, 3)}</Badge>
          </div>
        </CardContent></Card>
      )}

      <Card><CardContent className="p-4 space-y-2">
        <Label className="text-xs text-muted-foreground">Spiral preview (twist visualization)</Label>
        <svg viewBox="0 0 100 100" className="w-48 h-48 mx-auto border rounded-md bg-background">
          <path d={pathD} stroke="currentColor" fill="none" strokeWidth="0.5" />
          <circle cx="50" cy="50" r="2" fill="currentColor" />
        </svg>
      </CardContent></Card>

      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-2">Preview</p>
          <img src={previewUrl} alt="Droste preview" className="max-w-full rounded-md border" />
        </CardContent></Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> Droste effect runs locally via Canvas API.</p></CardContent></Card>
    </div>
  );
}
