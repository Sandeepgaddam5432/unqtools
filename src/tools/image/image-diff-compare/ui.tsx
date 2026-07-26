"use client";

import React, { useState, useMemo, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  runDiff, renderReport, sideBySideLayout,
  type ImageBuffer, type DiffResult,
} from "./logic";

export default function ImageDiffCompare() {
  const [imgA, setImgA] = useState<ImageBuffer | null>(null);
  const [imgB, setImgB] = useState<ImageBuffer | null>(null);
  const [threshold, setThreshold] = useState(0);
  const [ignoreAlpha, setIgnoreAlpha] = useState(false);
  const [error, setError] = useState("");
  const canvasARef = useRef<HTMLCanvasElement | null>(null);
  const canvasBRef = useRef<HTMLCanvasElement | null>(null);
  const heatCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const readFile = useCallback((file: File): Promise<ImageBuffer> => {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas not supported")); return; }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const data = new Uint8Array(imageData.data);
        URL.revokeObjectURL(url);
        resolve({ width: img.width, height: img.height, data });
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = url;
    });
  }, []);

  const handleFileA = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError("");
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setImgA(await readFile(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read image A");
    }
  }, [readFile]);

  const handleFileB = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError("");
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setImgB(await readFile(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read image B");
    }
  }, [readFile]);

  const result = useMemo<DiffResult | null>(() => {
    if (!imgA || !imgB) return null;
    try {
      return runDiff({ a: imgA, b: imgB, opts: { threshold, ignoreAlpha } });
    } catch (e) {
      queueMicrotask(() => setError(e instanceof Error ? e.message : "Diff failed"));
      return null;
    }
  }, [imgA, imgB, threshold, ignoreAlpha]);

  // Render input previews
  const renderPreview = useCallback((buffer: ImageBuffer | null, canvas: HTMLCanvasElement | null) => {
    if (!buffer || !canvas) return;
    canvas.width = buffer.width;
    canvas.height = buffer.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const imageData = new ImageData(new Uint8ClampedArray(buffer.data), buffer.width, buffer.height);
    ctx.putImageData(imageData, 0, 0);
  }, [imgA, imgB]);

  React.useEffect(() => { renderPreview(imgA, canvasARef.current); }, [imgA, renderPreview]);
  React.useEffect(() => { renderPreview(imgB, canvasBRef.current); }, [imgB, renderPreview]);

  // Render heatmap
  React.useEffect(() => {
    if (!result || !imgA || !heatCanvasRef.current) return;
    heatCanvasRef.current.width = imgA.width;
    heatCanvasRef.current.height = imgA.height;
    const ctx = heatCanvasRef.current.getContext("2d");
    if (!ctx) return;
    const imageData = new ImageData(new Uint8ClampedArray(result.heatmap), imgA.width, imgA.height);
    ctx.putImageData(imageData, 0, 0);
  }, [result, imgA]);

  const report = useMemo(() => {
    if (!result || !imgA || !imgB) return "";
    return renderReport(imgA, imgB, result.stats, { threshold, ignoreAlpha });
  }, [result, imgA, imgB, threshold, ignoreAlpha]);

  const layout = useMemo(() => {
    if (!imgA) return null;
    return sideBySideLayout(imgA.width, imgA.height, 16);
  }, [imgA]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Image A (baseline)</Label>
              <Input type="file" accept="image/*" onChange={handleFileA} />
              {imgA && (
                <canvas ref={canvasARef} className="mt-1 max-w-full h-auto rounded border" />
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Image B (compare)</Label>
              <Input type="file" accept="image/*" onChange={handleFileB} />
              {imgB && (
                <canvas ref={canvasBRef} className="mt-1 max-w-full h-auto rounded border" />
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/40">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Threshold: {threshold}</Label>
              <input type="range" min={0} max={255} value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-32" aria-label="Threshold" />
            </div>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={ignoreAlpha}
                onChange={(e) => setIgnoreAlpha(e.target.checked)} />
              Ignore alpha
            </label>
            {layout && (
              <Badge variant="outline" className="text-[10px]">
                Side-by-side: {layout.totalWidth}×{layout.totalHeight}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-[11px]">
                Diff: {result.stats.differencePercent.toFixed(2)}%
              </Badge>
              <Badge variant="outline" className="text-[11px]">
                Changed: {result.stats.changedPixels} / {result.stats.totalPixels}
              </Badge>
              <Badge variant="outline" className="text-[11px]">
                Overlay α: {result.overlayAlpha.toFixed(2)}
              </Badge>
              <div className="ml-auto flex gap-2">
                <CopyButton getText={() => report} label="Copy report" />
                <DownloadButton getText={() => report} filename="image-diff-report.txt" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Mean R" value={result.stats.mean.r.toFixed(1)} />
              <Stat label="Mean G" value={result.stats.mean.g.toFixed(1)} />
              <Stat label="Mean B" value={result.stats.mean.b.toFixed(1)} />
              <Stat label="Mean A" value={result.stats.mean.a.toFixed(1)} />
              <Stat label="Max R" value={String(result.stats.max.r)} />
              <Stat label="Max G" value={String(result.stats.max.g)} />
              <Stat label="Max B" value={String(result.stats.max.b)} />
              <Stat label="Max A" value={String(result.stats.max.a)} />
            </div>
            <div className="pt-2 border-t border-border/40">
              <Label className="text-xs text-muted-foreground">Heatmap (jet)</Label>
              <canvas ref={heatCanvasRef} className="mt-1 max-w-full h-auto rounded border" />
            </div>
            <div className="pt-2 border-t border-border/40">
              <Label className="text-xs text-muted-foreground">Histogram (256 buckets)</Label>
              <HistogramBars values={result.histogram} />
            </div>
            {result.warnings.length > 0 && (
              <div className="text-[11px] text-yellow-700 dark:text-yellow-300">
                {result.warnings.map((w, i) => (<div key={i}>⚠ {w}</div>))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!result && !error && (
        <div className="text-center py-8 text-sm text-muted-foreground rounded-lg border border-dashed">
          Load two images of the same dimensions to compare.
        </div>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> images are processed
            entirely in your browser. Nothing is uploaded.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border bg-background px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-sm text-foreground">{value}</div>
    </div>
  );
}

function HistogramBars({ values }: { values: number[] }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-px h-16 mt-1">
      {values.map((v, i) => (
        <div key={i} className="flex-1 bg-primary/60"
          style={{ height: `${(v / max) * 100}%` }} />
      ))}
    </div>
  );
}
