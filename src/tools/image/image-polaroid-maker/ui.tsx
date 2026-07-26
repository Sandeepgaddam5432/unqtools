"use client";

import React, { useState, useCallback, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  generatePolaroid,
  polaroidCssFilter,
  statsToCsv,
  PRESETS,
  type CaptionPosition,
  type AspectPreset,
  type PolaroidResult,
} from "./logic";
import { toast } from "sonner";

export default function ImagePolaroidMaker() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState("polaroid.png");
  const [borderTop, setBorderTop] = useState(20);
  const [borderRight, setBorderRight] = useState(20);
  const [borderBottom, setBorderBottom] = useState(80);
  const [borderLeft, setBorderLeft] = useState(20);
  const [caption, setCaption] = useState("");
  const [captionPos, setCaptionPos] = useState<CaptionPosition>("bottom");
  const [captionFontSize, setCaptionFontSize] = useState(0); // 0 = auto
  const [captionColor, setCaptionColor] = useState("#333333");
  const [frameColor, setFrameColor] = useState("#ffffff");
  const [rotation, setRotation] = useState(0);
  const [vintage, setVintage] = useState(0);
  const [sepia, setSepia] = useState(0);
  const [vignette, setVignette] = useState(0);
  const [grain, setGrain] = useState(0);
  const [aspect, setAspect] = useState<AspectPreset>("square");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PolaroidResult | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file"); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setFileName(file.name.replace(/\.[^.]+$/, "") + "-polaroid.png");
      setError(null);
      setPreviewUrl(null);
      setResult(null);
    };
    img.onerror = () => setError("Could not load image");
    img.src = url;
  }, []);

  const applyPreset = useCallback((p: (typeof PRESETS)[number]) => {
    const v = p.value;
    setBorderTop(v.border.top);
    setBorderRight(v.border.right);
    setBorderBottom(v.border.bottom);
    setBorderLeft(v.border.left);
    setCaptionPos(v.captionPosition);
    setCaptionFontSize(v.captionFontSize);
    setCaptionColor(v.captionColor);
    setFrameColor(v.frameColor);
    setRotation(v.rotation);
    setVintage(v.vintage);
    setSepia(v.sepia);
    setVignette(v.vignette);
    setGrain(v.grain);
    setAspect(v.aspect);
  }, []);

  const apply = useCallback(() => {
    if (!image || !canvasRef.current) return;
    setError(null);
    // Output canvas size = image area + borders
    const aspectRatioVal = aspect === "square" ? 1 : aspect === "wide" ? 4 / 3 : 1.25;
    const imgAreaW = 500;
    const imgAreaH = Math.round(imgAreaW / aspectRatioVal);
    const outputW = imgAreaW + borderLeft + borderRight;
    const outputH = imgAreaH + borderTop + borderBottom;
    const r = generatePolaroid({
      width: outputW, height: outputH,
      border: { top: borderTop, right: borderRight, bottom: borderBottom, left: borderLeft },
      caption, captionPosition: captionPos, captionFontSize,
      captionColor, frameColor, rotation, vintage, sepia, vignette, grain, aspect,
    });
    if ("error" in r) { setError(r.error); return; }
    setResult(r);
    const canvas = canvasRef.current;
    canvas.width = outputW;
    canvas.height = outputH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Fill frame color
    ctx.fillStyle = frameColor;
    ctx.fillRect(0, 0, outputW, outputH);
    // Apply rotation around center
    ctx.save();
    ctx.translate(outputW / 2, outputH / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-outputW / 2, -outputH / 2);
    // Draw image into image area
    ctx.drawImage(image, r.imageArea.x, r.imageArea.y, r.imageArea.width, r.imageArea.height);
    // Vintage overlay
    if (vintage > 0) {
      ctx.fillStyle = `rgba(112, 66, 20, ${vintage * 0.3})`;
      ctx.fillRect(r.imageArea.x, r.imageArea.y, r.imageArea.width, r.imageArea.height);
    }
    // Vignette
    if (vignette > 0) {
      const grad = ctx.createRadialGradient(
        r.imageArea.x + r.imageArea.width / 2, r.imageArea.y + r.imageArea.height / 2, r.imageArea.width / 4,
        r.imageArea.x + r.imageArea.width / 2, r.imageArea.y + r.imageArea.height / 2, r.imageArea.width / 1.5,
      );
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, `rgba(0,0,0,${vignette})`);
      ctx.fillStyle = grad;
      ctx.fillRect(r.imageArea.x, r.imageArea.y, r.imageArea.width, r.imageArea.height);
    }
    ctx.restore();
    // Caption (no rotation so it stays readable)
    if (caption) {
      ctx.fillStyle = captionColor;
      ctx.font = `${r.captionFontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(caption, outputW / 2, r.captionArea.y + r.captionArea.height / 2);
    }
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
    }, "image/png");
    toast.success("Polaroid created");
  }, [image, borderTop, borderRight, borderBottom, borderLeft, caption, captionPos, captionFontSize, captionColor, frameColor, rotation, vintage, sepia, vignette, grain, aspect, previewUrl]);

  const downloadPng = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = fileName; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Downloaded");
    }, "image/png");
  }, [fileName]);

  const cssFilter = useMemo(() => polaroidCssFilter({
    width: 1, height: 1,
    border: { top: 0, right: 0, bottom: 0, left: 0 },
    caption, captionPosition: captionPos, captionFontSize, captionColor, frameColor,
    rotation, vintage, sepia, vignette, grain, aspect,
  }), [caption, captionPos, captionFontSize, captionColor, frameColor, rotation, vintage, sepia, vignette, grain, aspect]);

  const csv = useMemo(() => (result ? statsToCsv(result.stats) : ""), [result]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Choose image</Button>
            {PRESETS.map((p) => (
              <Button key={p.name} variant="ghost" size="sm" onClick={() => applyPreset(p)}>{p.name}</Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Border top: {borderTop}px</Label>
              <input type="range" min={0} max={100} value={borderTop} onChange={(e) => setBorderTop(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Border bottom: {borderBottom}px</Label>
              <input type="range" min={0} max={150} value={borderBottom} onChange={(e) => setBorderBottom(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Border left: {borderLeft}px</Label>
              <input type="range" min={0} max={100} value={borderLeft} onChange={(e) => setBorderLeft(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Border right: {borderRight}px</Label>
              <input type="range" min={0} max={100} value={borderRight} onChange={(e) => setBorderRight(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Aspect</Label>
              <div className="flex gap-2">
                {(["square", "classic", "wide"] as AspectPreset[]).map((a) => (
                  <Button key={a} size="sm" variant={aspect === a ? "default" : "outline"} onClick={() => setAspect(a)}>{a}</Button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Rotation: {rotation}°</Label>
              <input type="range" min={-45} max={45} value={rotation} onChange={(e) => setRotation(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Vintage: {vintage.toFixed(2)}</Label>
              <input type="range" min={0} max={1} step={0.05} value={vintage} onChange={(e) => setVintage(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Sepia: {sepia.toFixed(2)}</Label>
              <input type="range" min={0} max={1} step={0.05} value={sepia} onChange={(e) => setSepia(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Vignette: {vignette.toFixed(2)}</Label>
              <input type="range" min={0} max={1} step={0.05} value={vignette} onChange={(e) => setVignette(Number(e.target.value))} className="w-full" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Grain: {grain.toFixed(2)}</Label>
              <input type="range" min={0} max={1} step={0.05} value={grain} onChange={(e) => setGrain(Number(e.target.value))} className="w-full" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Caption</Label>
              <input type="text" value={caption} onChange={(e) => setCaption(e.target.value)} className="w-full h-9 rounded-md border bg-background px-3 text-sm" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Caption position</Label>
              <div className="flex gap-2">
                {(["top", "center", "bottom"] as CaptionPosition[]).map((p) => (
                  <Button key={p} size="sm" variant={captionPos === p ? "default" : "outline"} onClick={() => setCaptionPos(p)}>{p}</Button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Caption font size (0 = auto)</Label>
              <input type="number" min={0} value={captionFontSize} onChange={(e) => setCaptionFontSize(Number(e.target.value))} className="w-full h-9 rounded-md border bg-background px-3 text-sm" />
            </div>
            <div className="flex gap-3 items-end">
              <div>
                <Label className="text-xs text-muted-foreground">Caption color</Label>
                <input type="color" value={captionColor} onChange={(e) => setCaptionColor(e.target.value)} className="h-9 w-12 rounded-md border bg-background" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Frame color</Label>
                <input type="color" value={frameColor} onChange={(e) => setFrameColor(e.target.value)} className="h-9 w-12 rounded-md border bg-background" />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={apply} disabled={!image}>Create polaroid</Button>
            <Button variant="outline" size="sm" onClick={downloadPng} disabled={!previewUrl}>Download PNG</Button>
            <CopyButton getText={() => cssFilter} label="Copy CSS filter" />
            <CopyButton getText={() => csv} label="Copy CSV" disabled={!csv} />
            <DownloadButton getText={() => csv} filename="polaroid-stats.csv" mime="text/csv" label="Download CSV" disabled={!csv} />
          </div>
        </CardContent>
      </Card>

      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Preview</p>
            <img src={previewUrl} alt="Polaroid preview" className="max-w-full rounded-md border" />
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Layout</CardTitle></CardHeader>
          <CardContent className="p-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Output size</p><p className="font-bold">{result.outputWidth}×{result.outputHeight}px</p></div>
              <div><p className="text-xs text-muted-foreground">Image area</p><p className="font-bold">{result.imageArea.width}×{result.imageArea.height}px</p></div>
              <div><p className="text-xs text-muted-foreground">Caption font</p><p className="font-bold">{result.captionFontSize}px</p></div>
              <div><p className="text-xs text-muted-foreground">Aspect</p><p className="font-bold">{result.stats.aspectRatio.toFixed(3)}</p></div>
            </div>
            {result.warnings.length > 0 && <div className="mt-3 text-xs text-amber-600">{result.warnings.join(" ")}</div>}
          </CardContent>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> polaroid rendering runs locally via Canvas. No image is uploaded.</p></CardContent></Card>
    </div>
  );
}
