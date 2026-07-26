"use client";

import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  DEFAULT_PARAMS, computeLayout, autoLayout, emptyCellCount, validateImages,
  estimatePngBytes, formatBytes, summarizeLayout, toCssGrid,
  type GridImage, type GridLayoutParams, type AspectRatio,
} from "./logic";

interface LoadedImage extends GridImage {
  element: HTMLImageElement;
}

export default function ImagePhotoGridUI() {
  const [images, setImages] = useState<LoadedImage[]>([]);
  const [params, setParams] = useState<GridLayoutParams>({ ...DEFAULT_PARAMS });
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const layout = useMemo(() => {
    const valid = validateImages(images);
    if (!valid.ok) return null;
    return computeLayout(images, params);
  }, [images, params]);

  const estBytes = useMemo(() => (layout ? estimatePngBytes(layout.canvasWidth, layout.canvasHeight) : 0), [layout]);
  const emptyCount = useMemo(() => emptyCellCount(images, params), [images, params]);

  useEffect(() => {
    if (!layout || !canvasRef.current) return;
    const c = canvasRef.current;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    c.width = layout.canvasWidth;
    c.height = layout.canvasHeight;
    ctx.fillStyle = layout.background;
    ctx.fillRect(0, 0, c.width, c.height);
    for (const cell of layout.cells) {
      const img = images.find((i) => i.id === cell.imageId);
      if (!img) continue;
      if (params.border > 0) {
        ctx.fillStyle = params.borderColor;
        ctx.fillRect(cell.x - params.border, cell.y - params.border, cell.width + params.border * 2, cell.height + params.border * 2);
      }
      ctx.fillStyle = layout.background;
      ctx.fillRect(cell.x, cell.y, cell.width, cell.height);
      ctx.drawImage(img.element, cell.drawX, cell.drawY, cell.drawWidth, cell.drawHeight);
    }
  }, [layout, images, params]);

  const onFiles = useCallback(async (files: FileList) => {
    setError("");
    const loaded: LoadedImage[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!f.type.startsWith("image/")) continue;
      const url = URL.createObjectURL(f);
      try {
        const el = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error("load fail"));
          img.src = url;
        });
        loaded.push({
          id: `img-${Date.now()}-${i}`,
          width: el.width,
          height: el.height,
          name: f.name,
          bytes: f.size,
          element: el,
        });
      } catch {
        setError(`Failed to load ${f.name}`);
      }
    }
    setImages((prev) => [...prev, ...loaded]);
  }, []);

  const autoArrange = useCallback(() => {
    const r = autoLayout(images.length, params.targetAspect);
    setParams((p) => ({ ...p, rows: r.rows, cols: r.cols }));
  }, [images.length, params.targetAspect]);

  const download = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "photo-grid.png";
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }, []);

  const update = useCallback(<K extends keyof GridLayoutParams>(key: K, value: GridLayoutParams[K]) => {
    setParams((p) => ({ ...p, [key]: value }));
  }, []);

  const summary = useMemo(() => (layout ? summarizeLayout(layout, images) : ""), [layout, images]);

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-medium">Upload images</Label>
          <Input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              if (e.target.files) onFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <p className="text-xs text-muted-foreground">{images.length} image(s) loaded.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Rows</Label>
              <Input type="number" min={1} value={params.rows} onChange={(e) => update("rows", Math.max(1, Number(e.target.value)))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Cols</Label>
              <Input type="number" min={1} value={params.cols} onChange={(e) => update("cols", Math.max(1, Number(e.target.value)))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Spacing (px)</Label>
              <Input type="number" min={0} value={params.spacing} onChange={(e) => update("spacing", Math.max(0, Number(e.target.value)))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Border (px)</Label>
              <Input type="number" min={0} value={params.border} onChange={(e) => update("border", Math.max(0, Number(e.target.value)))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Cell width</Label>
              <Input type="number" min={32} value={params.cellWidth} onChange={(e) => update("cellWidth", Math.max(32, Number(e.target.value)))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Aspect</Label>
              <select
                className="text-xs px-2 py-1.5 rounded-md border border-input bg-background w-full"
                value={params.targetAspect}
                onChange={(e) => update("targetAspect", e.target.value as AspectRatio)}
              >
                <option value="free">Free</option>
                <option value="1:1">1:1</option>
                <option value="4:3">4:3</option>
                <option value="3:2">3:2</option>
                <option value="16:9">16:9</option>
                <option value="9:16">9:16</option>
                <option value="3:4">3:4</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Background</Label>
              <input type="color" value={params.background} onChange={(e) => update("background", e.target.value)} className="w-full h-9 rounded-md border border-input" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Border color</Label>
              <input type="color" value={params.borderColor} onChange={(e) => update("borderColor", e.target.value)} className="w-full h-9 rounded-md border border-input" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={autoArrange} disabled={images.length === 0} className="text-xs px-3 py-1.5 rounded-md border border-border disabled:opacity-50">Auto-arrange</button>
            <button type="button" onClick={download} disabled={!layout} className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground disabled:opacity-50">Download PNG</button>
            <button type="button" onClick={() => setImages([])} className="text-xs px-3 py-1.5 rounded-md border border-border">Clear all</button>
            <CopyButton getText={() => summary} disabled={!layout} />
            <DownloadButton getText={() => summary} filename="grid-summary.txt" disabled={!layout} />
          </div>
        </CardContent>
      </Card>

      {layout && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium">Preview ({layout.canvasWidth}×{layout.canvasHeight})</p>
            <canvas ref={canvasRef} className="border border-border rounded-md max-w-full" />
            <p className="text-xs text-muted-foreground">
              Placed {layout.cells.length} of {images.length} images. {emptyCount > 0 ? `${emptyCount} empty cell(s).` : "Grid is full."} Estimated PNG: {formatBytes(estBytes)}.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all image compositing happens locally on a Canvas. Auto-arrange picks the rows/cols closest to the target aspect ratio.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
