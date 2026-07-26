"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  PLATFORM_PRESETS, calculateCrop, multiPlatformCrops, cropsToCsv,
  buildFilename, sourceQuality, circleBounds, ruleOfThirdsPoints,
} from "./logic";
import { toast } from "sonner";

export default function ImageProfilePicCropper() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [platform, setPlatform] = useState("instagram");
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [format, setFormat] = useState("image/png");
  const [quality, setQuality] = useState(0.92);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<ReturnType<typeof calculateCrop> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setImage(img); setError(null); };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const applyCrop = useCallback(() => {
    if (!image || !canvasRef.current) return;
    const r = calculateCrop({
      srcWidth: image.naturalWidth,
      srcHeight: image.naturalHeight,
      platformCode: platform,
      zoom, offsetX, offsetY,
    });
    if ("error" in r) { setError(r.error); return; }
    setError(null);
    setResult(r);
    const canvas = canvasRef.current;
    canvas.width = r.outputSize;
    canvas.height = r.outputSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (r.shape === "circle") {
      ctx.beginPath();
      ctx.arc(r.outputSize / 2, r.outputSize / 2, r.outputSize / 2, 0, Math.PI * 2);
      ctx.clip();
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, r.x, r.y, r.width, r.height, 0, 0, r.outputSize, r.outputSize);
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      toast.success(`Cropped to ${r.outputSize}×${r.outputSize} (${r.shape})`);
    }, format, format === "image/png" ? undefined : quality);
  }, [image, platform, zoom, offsetX, offsetY, format, quality, previewUrl]);

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = buildFilename(platform, result?.shape ?? "circle"); a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Image downloaded");
    }, format, format === "image/png" ? undefined : quality);
  }, [platform, result, format, quality]);

  const downloadAll = useCallback(() => {
    if (!image) return;
    const crops = multiPlatformCrops(image.naturalWidth, image.naturalHeight, zoom, offsetX, offsetY);
    const csv = cropsToCsv(crops);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "profile-crops.csv"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("CSV downloaded");
  }, [image, zoom, offsetX, offsetY]);

  const allCrops = image ? multiPlatformCrops(image.naturalWidth, image.naturalHeight, zoom, offsetX, offsetY) : [];
  const qScore = image && result && "outputSize" in (result ?? {})
    ? sourceQuality(image.naturalWidth, image.naturalHeight, (result as { outputSize: number }).outputSize)
    : 0;
  const csv = allCrops.length ? cropsToCsv(allCrops) : "";

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Choose image</Button>
          {image && <p className="text-xs text-muted-foreground">Source: {image.naturalWidth} × {image.naturalHeight}px</p>}
          <div className="flex flex-wrap gap-2">
            {PLATFORM_PRESETS.map((p) => (
              <Button key={p.code} size="sm" variant={platform === p.code ? "default" : "outline"} onClick={() => setPlatform(p.code)}>
                {p.name} ({p.size}px)
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div><Label className="text-xs text-muted-foreground">Zoom: {zoom.toFixed(2)}x</Label><Input type="range" min={100} max={500} value={Math.round(zoom * 100)} onChange={(e) => setZoom(Number(e.target.value) / 100)} /></div>
            <div><Label className="text-xs text-muted-foreground">Offset X</Label><Input type="number" value={offsetX} onChange={(e) => setOffsetX(Number(e.target.value))} /></div>
            <div><Label className="text-xs text-muted-foreground">Offset Y</Label><Input type="number" value={offsetY} onChange={(e) => setOffsetY(Number(e.target.value))} /></div>
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <div><Label className="text-xs text-muted-foreground">Format</Label>
              <select value={format} onChange={(e) => setFormat(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
                <option value="image/png">PNG</option>
                <option value="image/jpeg">JPEG</option>
                <option value="image/webp">WebP</option>
              </select>
            </div>
            {format !== "image/png" && (
              <div><Label className="text-xs text-muted-foreground">Quality: {Math.round(quality * 100)}%</Label>
                <Input type="range" min={10} max={100} value={Math.round(quality * 100)} onChange={(e) => setQuality(Number(e.target.value) / 100)} className="w-32" />
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={applyCrop} disabled={!image}>Crop</Button>
            <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
            <Button variant="ghost" size="sm" onClick={downloadAll} disabled={!image}>Download CSV (all platforms)</Button>
            {csv && <CopyButton getText={() => csv} label="Copy CSV" />}
          </div>
        </CardContent>
      </Card>

      {result && !"error" in result && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Crop</p><p className="font-bold">{result.x},{result.y} {result.width}×{result.height}</p></div>
              <div><p className="text-xs text-muted-foreground">Output</p><p className="font-bold">{result.outputSize}×{result.outputSize}px</p></div>
              <div><p className="text-xs text-muted-foreground">Shape</p><p className="font-bold capitalize">{result.shape}</p></div>
              <div><p className="text-xs text-muted-foreground">Quality</p><p className="font-bold">{qScore}/100</p></div>
            </div>
            {result.warnings.map((w, i) => (
              <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {w}</p>
            ))}
          </CardContent>
        </Card>
      )}

      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            <img src={previewUrl} alt="Profile pic preview" className="max-w-full rounded-md border" style={{ width: 240, height: 240 }} />
          </CardContent>
        </Card>
      )}
      {error && <ErrorBanner message={error} />}
      {csv && <DownloadButton getText={() => csv} filename="profile-crops.csv" mime="text/csv" label="Download CSV" />}
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all cropping runs locally via the Canvas API.</p></CardContent></Card>
    </div>
  );
}
