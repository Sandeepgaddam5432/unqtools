"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  validateCrop, centerCropForAspect, cropToExact, ASPECT_PRESETS,
  rotateDimensions, rectStats, boundingCircle, largestSquare, fmt,
} from "./logic";
import { toast } from "sonner";

type Rotation = 0 | 90 | 180 | 270;
type Shape = "rect" | "circle" | "rounded";

export default function ImageCropper() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("cropped.png");
  const [x, setX] = useState("0");
  const [y, setY] = useState("0");
  const [w, setW] = useState("");
  const [h, setH] = useState("");
  const [format, setFormat] = useState("image/png");
  const [quality, setQuality] = useState(0.9);
  const [rotation, setRotation] = useState<Rotation>(0);
  const [shape, setShape] = useState<Shape>("rect");
  const [grid, setGrid] = useState(true);
  const [exactW, setExactW] = useState("256");
  const [exactH, setExactH] = useState("256");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setX("0"); setY("0");
      setW(String(img.naturalWidth));
      setH(String(img.naturalHeight));
      setFileName(file.name.replace(/\.[^.]+$/, "") + "-cropped.png");
      setError(null);
    };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const applyAspect = (aw: number, ah: number) => {
    if (!image) return;
    const r = centerCropForAspect(image.naturalWidth, image.naturalHeight, aw, ah);
    setX(String(r.x)); setY(String(r.y));
    setW(String(r.width)); setH(String(r.height));
  };

  const applyExact = () => {
    if (!image) return;
    const r = cropToExact(image.naturalWidth, image.naturalHeight, Number(exactW), Number(exactH));
    if ("error" in r) { setError(r.error); return; }
    setX(String(r.x)); setY(String(r.y)); setW(String(r.width)); setH(String(r.height));
  };

  const stats = (() => {
    if (!w || !h) return null;
    return rectStats({ x: Number(x), y: Number(y), width: Number(w), height: Number(h) });
  })();

  const rotatedDims = (() => {
    if (!w || !h) return null;
    return rotateDimensions(Number(w), Number(h), rotation);
  })();

  const applyCrop = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const result = validateCrop({
      x: Number(x), y: Number(y), width: Number(w), height: Number(h),
      imageWidth: image.naturalWidth, imageHeight: image.naturalHeight,
    });
    if ("error" in result) { setError(result.error); return; }
    setError(null);
    const canvas = canvasRef.current;
    const cw = rotation === 90 || rotation === 270 ? result.height : result.width;
    const ch = rotation === 90 || rotation === 270 ? result.width : result.height;
    canvas.width = cw; canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (shape === "circle") {
      ctx.beginPath();
      ctx.arc(cw / 2, ch / 2, Math.min(cw, ch) / 2, 0, Math.PI * 2);
      ctx.clip();
    }
    if (rotation) { ctx.translate(cw / 2, ch / 2); ctx.rotate((rotation * Math.PI) / 180); ctx.translate(-result.width / 2, -result.height / 2); }
    ctx.drawImage(image, result.x, result.y, result.width, result.height, 0, 0, result.width, result.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(blob));
        toast.success("Crop applied");
      },
      format, format === "image/png" ? undefined : quality,
    );
  }, [image, x, y, w, h, format, quality, rotation, shape, previewUrl]);

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = fileName; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast.success("Image downloaded");
      },
      format, format === "image/png" ? undefined : quality,
    );
  }, [fileName, format, quality]);

  const csv = `Field,Value\nX,${x}\nY,${y}\nWidth,${w}\nHeight,${h}\nRotation,${rotation}\nShape,${shape}`;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Choose image</Button>
          {image && <p className="text-xs text-muted-foreground">Original: {image.naturalWidth} × {image.naturalHeight}px</p>}
        </CardContent>
      </Card>

      {image && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              {ASPECT_PRESETS.map((p) => (
                <Button key={p.label} variant="outline" size="sm" onClick={() => applyAspect(p.w, p.h)}>{p.label}</Button>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div><Label className="text-xs text-muted-foreground">X</Label><Input type="number" value={x} onChange={(e) => setX(e.target.value)} /></div>
              <div><Label className="text-xs text-muted-foreground">Y</Label><Input type="number" value={y} onChange={(e) => setY(e.target.value)} /></div>
              <div><Label className="text-xs text-muted-foreground">Width</Label><Input type="number" value={w} onChange={(e) => setW(e.target.value)} /></div>
              <div><Label className="text-xs text-muted-foreground">Height</Label><Input type="number" value={h} onChange={(e) => setH(e.target.value)} /></div>
            </div>

            <div className="flex flex-wrap gap-2 items-end">
              <div><Label className="text-xs text-muted-foreground">Rotation</Label>
                <select value={rotation} onChange={(e) => setRotation(Number(e.target.value) as Rotation)} className="h-9 rounded-md border bg-background px-3 text-sm">
                  <option value={0}>0°</option><option value={90}>90°</option><option value={180}>180°</option><option value={270}>270°</option>
                </select>
              </div>
              <div><Label className="text-xs text-muted-foreground">Shape</Label>
                <select value={shape} onChange={(e) => setShape(e.target.value as Shape)} className="h-9 rounded-md border bg-background px-3 text-sm">
                  <option value="rect">Rectangle</option><option value="circle">Circle</option><option value="rounded">Rounded</option>
                </select>
              </div>
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={grid} onChange={(e) => setGrid(e.target.checked)} /> Show grid</label>
            </div>

            <div className="flex flex-wrap gap-2 items-end">
              <div><Label className="text-xs text-muted-foreground">Exact W</Label><Input value={exactW} onChange={(e) => setExactW(e.target.value)} className="h-9 w-20" /></div>
              <div><Label className="text-xs text-muted-foreground">Exact H</Label><Input value={exactH} onChange={(e) => setExactH(e.target.value)} className="h-9 w-20" /></div>
              <Button size="sm" variant="outline" onClick={applyExact}>Apply exact</Button>
              <Button size="sm" variant="outline" onClick={() => { if (!image) return; const r = largestSquare({ x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight }); setX(String(r.x)); setY(String(r.y)); setW(String(r.width)); setH(String(r.height)); }}>Largest square</Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <div><Label className="text-xs text-muted-foreground">Format</Label>
                <select value={format} onChange={(e) => setFormat(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
                  <option value="image/png">PNG</option><option value="image/jpeg">JPEG</option><option value="image/webp">WebP</option>
                </select>
              </div>
              {format !== "image/png" && (
                <div><Label className="text-xs text-muted-foreground">Quality: {Math.round(quality * 100)}%</Label>
                  <Input type="range" min={10} max={100} value={Math.round(quality * 100)} onChange={(e) => setQuality(Number(e.target.value) / 100)} className="w-32" />
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={applyCrop}>Apply crop</Button>
              <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
              <CopyButton getText={() => csv} label="Copy CSV" />
              <DownloadButton getText={() => csv} filename="crop-spec.csv" mime="text/csv" />
            </div>
            {stats && (
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">Area: {fmt(stats.area, 0)}px²</Badge>
                <Badge variant="outline">Aspect: {fmt(stats.aspect, 3)}</Badge>
                {rotatedDims && <Badge variant="outline">Rotated: {rotatedDims.width}×{rotatedDims.height}</Badge>}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            <img src={previewUrl} alt="Cropped preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all cropping runs locally via the Canvas API.</p></CardContent></Card>
    </div>
  );
}
