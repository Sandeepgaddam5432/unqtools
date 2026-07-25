"use client";

import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ErrorBanner, DownloadButton, CopyButton } from "../../_shared";
import {
  computeCollageLayout,
  fitCover,
  computeCellViewport,
  swapIndices,
  shuffleSeeded,
  dimensionsForAspect,
  serializeProject,
  parseProject,
  buildCollageFilename,
  validateCollageInput,
  COLLAGE_PRESETS,
  ASPECT_PRESETS,
  type AspectPreset,
  type CellFit,
  type FlipMode,
} from "./logic";
import { toast } from "sonner";

interface LoadedImage { img: HTMLImageElement; name: string; }

export default function ImageCollageMaker() {
  const [images, setImages] = useState<LoadedImage[]>([]);
  const [columns, setColumns] = useState(2);
  const [canvasWidth, setCanvasWidth] = useState(1200);
  const [canvasHeight, setCanvasHeight] = useState(800);
  const [gap, setGap] = useState(10);
  const [borderWidth, setBorderWidth] = useState(0);
  const [borderRadius, setBorderRadius] = useState(0);
  const [bgColor, setBgColor] = useState("#ffffff");
  const [gradientFrom, setGradientFrom] = useState("#ffffff");
  const [gradientTo, setGradientTo] = useState("#000000");
  const [gradientAngle, setGradientAngle] = useState(90);
  const [useGradient, setUseGradient] = useState(false);
  const [aspect, setAspect] = useState<AspectPreset>("3:2");
  const [format, setFormat] = useState("image/png");
  const [quality, setQuality] = useState(0.9);
  const [seed, setSeed] = useState(42);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [fit, setFit] = useState<CellFit>("cover");
  const [text, setText] = useState("");
  const [textX, setTextX] = useState(0.5);
  const [textY, setTextY] = useState(0.95);

  const onFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newImages: LoadedImage[] = [];
    let remaining = Array.from(files).filter((f) => f.type.startsWith("image/")).length;
    if (remaining === 0) return;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        newImages.push({ img, name: file.name });
        remaining--;
        if (remaining === 0) setImages((prev) => [...prev, ...newImages]);
      };
      img.src = url;
    });
  }, []);

  const applyAspect = useCallback((a: AspectPreset) => {
    setAspect(a);
    const d = dimensionsForAspect(a, 1200);
    setCanvasWidth(d.width);
    setCanvasHeight(d.height);
  }, []);

  const apply = useCallback(() => {
    if (images.length === 0 || !canvasRef.current) { setError("Please choose at least one image"); return; }
    const input = { imageCount: images.length, columns, canvasWidth, canvasHeight, gap, borderWidth, borderRadius };
    const v = validateCollageInput(input);
    if ("error" in v) { setError(v.error); return; }
    setError(null);
    setBusy(true);
    const layout = computeCollageLayout(input);
    if ("error" in layout) { setError(layout.error); setBusy(false); return; }
    const canvas = canvasRef.current;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) { setBusy(false); return; }
    if (useGradient) {
      const grad = ctx.createLinearGradient(0, 0, gradientAngle < 90 ? canvasWidth : 0, gradientAngle >= 90 ? canvasHeight : 0);
      grad.addColorStop(0, gradientFrom);
      grad.addColorStop(1, gradientTo);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = bgColor;
    }
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    layout.cells.forEach((cell, i) => {
      const loaded = images[i];
      if (!loaded) return;
      const isSel = selectedIdx === i;
      const viewport = computeCellViewport(
        loaded.img.naturalWidth, loaded.img.naturalHeight,
        cell.width, cell.height,
        isSel ? fit : "cover",
        isSel ? zoom : 1,
        isSel ? panX : 0,
        isSel ? panY : 0,
      );
      if ("error" in viewport) return;
      ctx.save();
      ctx.beginPath();
      const r = Math.min(borderRadius, cell.width / 2, cell.height / 2);
      if (r > 0) {
        ctx.moveTo(cell.x + r, cell.y);
        ctx.arcTo(cell.x + cell.width, cell.y, cell.x + cell.width, cell.y + cell.height, r);
        ctx.arcTo(cell.x + cell.width, cell.y + cell.height, cell.x, cell.y + cell.height, r);
        ctx.arcTo(cell.x, cell.y + cell.height, cell.x, cell.y, r);
        ctx.arcTo(cell.x, cell.y, cell.x + cell.width, cell.y, r);
        ctx.closePath();
      } else {
        ctx.rect(cell.x, cell.y, cell.width, cell.height);
      }
      ctx.clip();
      ctx.drawImage(loaded.img, viewport.sx, viewport.sy, viewport.sw, viewport.sh, cell.x + viewport.dx, cell.y + viewport.dy, viewport.dw, viewport.dh);
      if (borderWidth > 0) {
        ctx.strokeStyle = useGradient ? gradientTo : bgColor;
        ctx.lineWidth = borderWidth * 2;
        ctx.strokeRect(cell.x, cell.y, cell.width, cell.height);
      }
      ctx.restore();
    });
    if (text.trim()) {
      ctx.save();
      ctx.font = "bold 48px sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 8;
      ctx.fillText(text, textX * canvasWidth, textY * canvasHeight);
      ctx.restore();
    }
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      setBusy(false);
    }, format, format === "image/png" ? undefined : quality);
  }, [images, columns, canvasWidth, canvasHeight, gap, borderWidth, borderRadius, bgColor, useGradient, gradientFrom, gradientTo, gradientAngle, format, quality, previewUrl, selectedIdx, fit, zoom, panX, panY, text, textX, textY]);

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = buildCollageFilename(aspect, format); a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Collage downloaded");
    }, format, format === "image/png" ? undefined : quality);
  }, [aspect, format, quality]);

  const shuffle = useCallback(() => {
    setImages((prev) => shuffleSeeded(prev, seed));
    toast.success("Shuffled images");
  }, [seed]);

  const saveProject = useCallback(() => {
    try {
      localStorage.setItem("collage-project", serializeProject({
        columns, canvasWidth, canvasHeight, gap, borderWidth, borderRadius,
        bgColor, gradient: useGradient ? { from: gradientFrom, to: gradientTo, angle: gradientAngle } : null,
        aspect, text: text ? [{ text, x: textX, y: textY, fontSize: 48, color: "#fff", rotation: 0 }] : [],
        imageNames: images.map((i) => i.name), flips: images.map(() => "none" as FlipMode),
      }));
      toast.success("Project saved");
    } catch {
      toast.error("Could not save project");
    }
  }, [columns, canvasWidth, canvasHeight, gap, borderWidth, borderRadius, bgColor, useGradient, gradientFrom, gradientTo, gradientAngle, aspect, text, textX, textY, images]);

  const loadProject = useCallback(() => {
    try {
      const json = localStorage.getItem("collage-project");
      if (!json) { toast.error("No saved project"); return; }
      const p = parseProject(json);
      if (!p) { toast.error("Invalid project"); return; }
      setColumns(p.columns); setCanvasWidth(p.canvasWidth); setCanvasHeight(p.canvasHeight);
      setGap(p.gap); setBorderWidth(p.borderWidth); setBorderRadius(p.borderRadius);
      setBgColor(p.bgColor); setAspect(p.aspect);
      if (p.gradient) { setUseGradient(true); setGradientFrom(p.gradient.from); setGradientTo(p.gradient.to); setGradientAngle(p.gradient.angle); }
      toast.success("Project loaded");
    } catch {
      toast.error("Could not load project");
    }
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Add images</Button>
          {images.length > 0 && <p className="text-xs text-muted-foreground">{images.length} image(s) loaded</p>}
          {images.length > 0 && <>
            <Button variant="ghost" size="sm" onClick={() => setImages([])}>Clear</Button>
            <div className="flex flex-wrap gap-2 mt-2">
              {images.map((img, i) => (
                <button key={i} onClick={() => setSelectedIdx(i === selectedIdx ? null : i)} className={`relative w-16 h-16 rounded border-2 overflow-hidden ${selectedIdx === i ? "border-primary" : "border-border"}`}>
                  <img src={img.img.src} alt={img.name} className="w-full h-full object-cover" />
                  <span className="absolute bottom-0 left-0 right-0 text-[10px] bg-black/60 text-white px-1 py-0.5 truncate">{i + 1}</span>
                </button>
              ))}
            </div>
            {selectedIdx !== null && selectedIdx + 1 < images.length && (
              <Button variant="outline" size="sm" onClick={() => setImages((prev) => swapIndices(prev, selectedIdx, selectedIdx + 1))}>
                Swap with next
              </Button>
            )}
          </>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {COLLAGE_PRESETS.map((p) => (
              <Button key={p.label} variant="outline" size="sm" onClick={() => { setColumns(p.columns); setCanvasWidth(p.width); setCanvasHeight(p.height); setAspect(p.aspect); }}>
                {p.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <Label className="text-xs text-muted-foreground">Aspect</Label>
              <select value={aspect} onChange={(e) => applyAspect(e.target.value as AspectPreset)} className="h-9 rounded-md border bg-background px-3 text-sm">
                {ASPECT_PRESETS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <div><Label className="text-xs text-muted-foreground">Columns</Label><Input type="number" value={columns} onChange={(e) => setColumns(Number(e.target.value))} min={1} className="w-20" /></div>
              <div><Label className="text-xs text-muted-foreground">Width</Label><Input type="number" value={canvasWidth} onChange={(e) => setCanvasWidth(Number(e.target.value))} className="w-24" /></div>
              <div><Label className="text-xs text-muted-foreground">Height</Label><Input type="number" value={canvasHeight} onChange={(e) => setCanvasHeight(Number(e.target.value))} className="w-24" /></div>
              <div><Label className="text-xs text-muted-foreground">Gap</Label><Input type="number" value={gap} onChange={(e) => setGap(Number(e.target.value))} className="w-20" /></div>
              <div><Label className="text-xs text-muted-foreground">Border</Label><Input type="number" value={borderWidth} onChange={(e) => setBorderWidth(Number(e.target.value))} className="w-20" /></div>
              <div><Label className="text-xs text-muted-foreground">Radius</Label><Input type="number" value={borderRadius} onChange={(e) => setBorderRadius(Number(e.target.value))} className="w-20" /></div>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">BG color</Label>
              <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="block h-9 w-16 rounded border" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={useGradient} onChange={(e) => setUseGradient(e.target.checked)} />
              <span>Gradient</span>
            </label>
            {useGradient && <>
              <div><Label className="text-xs text-muted-foreground">From</Label><input type="color" value={gradientFrom} onChange={(e) => setGradientFrom(e.target.value)} className="block h-9 w-16 rounded border" /></div>
              <div><Label className="text-xs text-muted-foreground">To</Label><input type="color" value={gradientTo} onChange={(e) => setGradientTo(e.target.value)} className="block h-9 w-16 rounded border" /></div>
              <div><Label className="text-xs text-muted-foreground">Angle: {gradientAngle}°</Label><Input type="number" value={gradientAngle} onChange={(e) => setGradientAngle(Number(e.target.value))} className="w-20" /></div>
            </>}
          </div>
          {selectedIdx !== null && (
            <div className="border-t pt-3 space-y-2">
              <p className="text-xs font-medium">Cell {selectedIdx + 1} zoom & pan</p>
              <div className="flex flex-wrap gap-3 items-center">
                <select value={fit} onChange={(e) => setFit(e.target.value as CellFit)} className="h-9 rounded-md border bg-background px-3 text-sm">
                  <option value="cover">Cover</option>
                  <option value="contain">Contain</option>
                  <option value="stretch">Stretch</option>
                </select>
                <div className="flex-1 min-w-[150px]"><Label className="text-xs text-muted-foreground">Zoom: {zoom.toFixed(2)}×</Label><Slider value={[zoom * 100]} onValueChange={(v) => setZoom(v[0]! / 100)} min={100} max={400} step={10} /></div>
                <div className="flex-1 min-w-[150px]"><Label className="text-xs text-muted-foreground">Pan X: {panX.toFixed(2)}</Label><Slider value={[(panX + 1) * 50]} onValueChange={(v) => setPanX(v[0]! / 50 - 1)} min={0} max={100} step={5} /></div>
                <div className="flex-1 min-w-[150px]"><Label className="text-xs text-muted-foreground">Pan Y: {panY.toFixed(2)}</Label><Slider value={[(panY + 1) * 50]} onValueChange={(v) => setPanY(v[0]! / 50 - 1)} min={0} max={100} step={5} /></div>
              </div>
            </div>
          )}
          <div className="border-t pt-3 space-y-2">
            <Label className="text-xs text-muted-foreground">Text overlay (optional)</Label>
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Title text" />
            <div className="flex gap-3">
              <div className="flex-1"><Label className="text-xs text-muted-foreground">X: {textX.toFixed(2)}</Label><Slider value={[textX * 100]} onValueChange={(v) => setTextX(v[0]! / 100)} min={0} max={100} step={1} /></div>
              <div className="flex-1"><Label className="text-xs text-muted-foreground">Y: {textY.toFixed(2)}</Label><Slider value={[textY * 100]} onValueChange={(v) => setTextY(v[0]! / 100)} min={0} max={100} step={1} /></div>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Format</Label>
              <select value={format} onChange={(e) => setFormat(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
                <option value="image/png">PNG</option>
                <option value="image/jpeg">JPEG</option>
                <option value="image/webp">WebP</option>
              </select>
            </div>
            {format !== "image/png" && (
              <div className="w-40"><Label className="text-xs text-muted-foreground">Quality: {Math.round(quality * 100)}%</Label><Slider value={[quality * 100]} onValueChange={(v) => setQuality(v[0]! / 100)} min={10} max={100} step={5} /></div>
            )}
            <div><Label className="text-xs text-muted-foreground">Shuffle seed</Label><Input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value))} className="w-24" /></div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={apply} disabled={busy || images.length === 0}>{busy ? "Building…" : "Build collage"}</Button>
            <Button variant="outline" size="sm" onClick={shuffle} disabled={images.length < 2}>Shuffle</Button>
            <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
            <DownloadButton getText={async () => { await new Promise((r) => setTimeout(r, 0)); return ""; }} filename={buildCollageFilename(aspect, format)} disabled={!previewUrl} mime="image/png" label="Download (shared)" />
            <Button variant="ghost" size="sm" onClick={saveProject}>Save project</Button>
            <Button variant="ghost" size="sm" onClick={loadProject}>Load project</Button>
          </div>
        </CardContent>
      </Card>

      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground mb-2">Preview</p>
          <img src={previewUrl} alt="Collage preview" className="max-w-full rounded-md border" />
        </CardContent></Card>
      )}
      {error && <ErrorBanner message={error} />}
      <Card><CardContent className="p-4">
        <p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> collage composition runs locally via the Canvas API.</p>
      </CardContent></Card>
    </div>
  );
}
