"use client";

import React, { useState, useCallback, useRef, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  computeLayout, applyAlignment, applyPadding, summarize,
  validateHexColor, gridLayout, layoutToCsv, totalArea, sourceArea,
  fmt, type StitchDirection, type AlignOption,
} from "./logic";
import { toast } from "sonner";

export default function ImageStitcher() {
  const [images, setImages] = useState<HTMLImageElement[]>([]);
  const [direction, setDirection] = useState<StitchDirection>("horizontal");
  const [align, setAlign] = useState<AlignOption>("center");
  const [gap, setGap] = useState("0");
  const [padding, setPadding] = useState("0");
  const [bgColor, setBgColor] = useState("#FFFFFF");
  const [useGrid, setUseGrid] = useState(false);
  const [gridCols, setGridCols] = useState("2");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const sizes = useMemo(() => images.map((i) => ({ width: i.naturalWidth, height: i.naturalHeight })), [images]);

  const layout = useMemo(() => {
    if (!sizes.length) return null;
    const g = Number(gap);
    const base = useGrid
      ? gridLayout(sizes, Number(gridCols) || 1, g)
      : computeLayout(sizes, direction, g);
    if ("error" in base) return null;
    const aligned = useGrid ? base : applyAlignment(base, direction, align);
    if ("error" in aligned) return null;
    const padded = applyPadding(aligned, Number(padding));
    if ("error" in padded) return null;
    return padded;
  }, [sizes, direction, align, gap, padding, useGrid, gridCols]);

  const summary = useMemo(() => (images.length ? summarize(sizes, direction, Number(gap)) : ""), [sizes, direction, images.length, gap]);

  const onFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const loaded: HTMLImageElement[] = [];
    let pending = files.length;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) { pending--; return; }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { loaded.push(img); pending--; if (pending === 0) { setImages((prev) => [...prev, ...loaded]); setError(null); } };
      img.onerror = () => { pending--; };
      img.src = url;
    });
  }, []);

  const stitch = useCallback(() => {
    if (images.length === 0 || !canvasRef.current || !layout) return;
    const bg = validateHexColor(bgColor);
    if ("error" in bg) { setError(bg.error); return; }
    setError(null);
    const canvas = canvasRef.current;
    canvas.width = layout.width;
    canvas.height = layout.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, layout.width, layout.height);
    images.forEach((img, i) => {
      const pos = layout.positions[i];
      if (!pos) return;
      ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, pos.x, pos.y, pos.width, pos.height);
    });
    canvas.toBlob((blob) => {
      if (!blob) return;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      toast.success("Stitch complete");
    }, "image/png");
  }, [images, layout, bgColor, previewUrl]);

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "stitched.png"; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Image downloaded");
    }, "image/png");
  }, []);

  const csv = useMemo(() => layout ? layoutToCsv(layout) : "", [layout]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
          <div className="flex flex-wrap items-end gap-3">
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Add images</Button>
            <Button size="sm" onClick={stitch} disabled={images.length === 0}>Stitch ({images.length})</Button>
            <Button variant="outline" size="sm" onClick={download} disabled={!previewUrl}>Download</Button>
            <Button variant="ghost" size="sm" onClick={() => { setImages([]); setPreviewUrl(null); }} disabled={images.length === 0}>Clear</Button>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div><Label className="text-xs text-muted-foreground">Mode</Label>
              <select value={useGrid ? "grid" : direction} onChange={(e) => {
                const v = e.target.value;
                if (v === "grid") setUseGrid(true);
                else { setUseGrid(false); setDirection(v as StitchDirection); }
              }} className="h-9 rounded-md border bg-background px-3 text-sm">
                <option value="horizontal">Horizontal</option>
                <option value="vertical">Vertical</option>
                <option value="grid">Grid</option>
              </select>
            </div>
            {!useGrid && (
              <div><Label className="text-xs text-muted-foreground">Align</Label>
                <select value={align} onChange={(e) => setAlign(e.target.value as AlignOption)} className="h-9 rounded-md border bg-background px-3 text-sm">
                  <option value="start">Start</option><option value="center">Center</option><option value="end">End</option>
                </select>
              </div>
            )}
            {useGrid && (
              <div><Label className="text-xs text-muted-foreground">Cols</Label>
                <Input type="number" min={1} value={gridCols} onChange={(e) => setGridCols(e.target.value)} className="h-9 w-16" />
              </div>
            )}
            <div><Label className="text-xs text-muted-foreground">Gap (px)</Label>
              <Input type="number" min={0} value={gap} onChange={(e) => setGap(e.target.value)} className="h-9 w-16" />
            </div>
            <div><Label className="text-xs text-muted-foreground">Padding (px)</Label>
              <Input type="number" min={0} value={padding} onChange={(e) => setPadding(e.target.value)} className="h-9 w-16" />
            </div>
            <div><Label className="text-xs text-muted-foreground">Background</Label>
              <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="h-9 w-12 rounded-md border bg-background" />
            </div>
            {layout && <CopyButton getText={() => csv} label="Copy layout" />}
            {layout && <DownloadButton getText={() => csv} filename="stitch-layout.csv" mime="text/csv" />}
          </div>
          {summary && <Badge variant="secondary">{summary}</Badge>}
          {layout && (
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">Canvas: {layout.width}×{layout.height}</Badge>
              <Badge variant="outline">Area: {fmt(totalArea(layout), 0)}px²</Badge>
              <Badge variant="outline">Source: {fmt(sourceArea(sizes), 0)}px²</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}
      <canvas ref={canvasRef} className="hidden" />
      {previewUrl && (
        <Card><CardContent className="p-4">
          <img src={previewUrl} alt="Stitched" className="max-w-full rounded-md border" />
        </CardContent></Card>
      )}
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all stitching runs locally via the Canvas API.</p></CardContent></Card>
    </div>
  );
}
