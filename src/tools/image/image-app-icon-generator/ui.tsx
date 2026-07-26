"use client";

import React, { useState, useRef, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  IOS_SIZES, ANDROID_SIZES, allSpecs, filterByPlatform, safeAreaInset,
  effectiveDrawSize, iosCornerRadius, generateIosContentsJson,
  generateAndroidAdaptiveXml, formatBytes, estimateTotalBytes, summarize,
  validateSourceForMax,
} from "./logic";

type PlatformFilter = "all" | "ios" | "android";

export default function ImageAppIconGeneratorUI() {
  const [file, setFile] = useState<File | null>(null);
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<PlatformFilter>("all");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);

  const specs = useMemo(() => allSpecs(), []);
  const visibleSpecs = useMemo(() => {
    if (filter === "ios") return filterByPlatform(specs, "ios");
    if (filter === "android") return filterByPlatform(specs, "android");
    return specs;
  }, [specs, filter]);

  const summary = useMemo(() => summarize(visibleSpecs), [visibleSpecs]);
  const totalBytes = useMemo(() => estimateTotalBytes(visibleSpecs), [visibleSpecs]);

  const iosJson = useMemo(() => generateIosContentsJson(IOS_SIZES), []);
  const androidXml = useMemo(() => generateAndroidAdaptiveXml(), []);

  const maxSize = useMemo(() => Math.max(...specs.map((s) => s.size)), [specs]);

  const onFile = useCallback(async (f: File) => {
    setError("");
    setFile(f);
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      setImgEl(img);
      URL.revokeObjectURL(url);
      const v = validateSourceForMax(img.width, img.height, 1024);
      if (!v.ok) setError(v.reason ?? "Invalid source");
    };
    img.onerror = () => {
      setError("Failed to load image.");
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, []);

  const drawIcon = useCallback((spec: typeof specs[number]) => {
    if (!imgEl || !previewRef.current) return;
    const c = previewRef.current;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    c.width = spec.size;
    c.height = spec.size;
    ctx.clearRect(0, 0, spec.size, spec.size);
    // Fill white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, spec.size, spec.size);
    // Compute draw region with safe-area padding
    const drawSize = effectiveDrawSize(spec.size, spec.padding);
    const offset = safeAreaInset(spec.size, spec.padding);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(imgEl, 0, 0, imgEl.width, imgEl.height, offset, offset, drawSize, drawSize);
    if (spec.rounded && spec.platform === "ios") {
      // Apply rounded mask overlay
      const r = iosCornerRadius(spec.size);
      ctx.globalCompositeOperation = "destination-in";
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.arcTo(spec.size, 0, spec.size, spec.size, r);
      ctx.arcTo(spec.size, spec.size, 0, spec.size, r);
      ctx.arcTo(0, spec.size, 0, 0, r);
      ctx.arcTo(0, 0, spec.size, 0, r);
      ctx.closePath();
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    }
  }, [imgEl]);

  const downloadAll = useCallback(() => {
    if (!imgEl || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    for (const spec of visibleSpecs) {
      canvasRef.current.width = spec.size;
      canvasRef.current.height = spec.size;
      ctx.clearRect(0, 0, spec.size, spec.size);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, spec.size, spec.size);
      const drawSize = effectiveDrawSize(spec.size, spec.padding);
      const offset = safeAreaInset(spec.size, spec.padding);
      ctx.drawImage(imgEl, 0, 0, imgEl.width, imgEl.height, offset, offset, drawSize, drawSize);
      if (spec.rounded && spec.platform === "ios") {
        const r = iosCornerRadius(spec.size);
        ctx.globalCompositeOperation = "destination-in";
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.arcTo(spec.size, 0, spec.size, spec.size, r);
        ctx.arcTo(spec.size, spec.size, 0, spec.size, r);
        ctx.arcTo(0, spec.size, 0, 0, r);
        ctx.arcTo(0, 0, spec.size, 0, r);
        ctx.closePath();
        ctx.fill();
        ctx.globalCompositeOperation = "source-over";
      }
      canvasRef.current.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = spec.name;
        a.click();
        URL.revokeObjectURL(url);
      }, "image/png");
    }
  }, [imgEl, visibleSpecs]);

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-medium">Upload source image (square, ≥1024px recommended)</Label>
          <Input
            type="file"
            accept="image/png,image/jpeg"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
          {imgEl && (
            <p className="text-xs text-muted-foreground">Source: {imgEl.width} × {imgEl.height}px — max target {maxSize}px</p>
          )}
          <div className="flex gap-2 flex-wrap items-center">
            <Label className="text-xs text-muted-foreground">Filter</Label>
            <select
              className="text-xs px-2 py-1.5 rounded-md border border-input bg-background"
              value={filter}
              onChange={(e) => setFilter(e.target.value as PlatformFilter)}
            >
              <option value="all">All platforms</option>
              <option value="ios">iOS only</option>
              <option value="android">Android only</option>
            </select>
            <button
              type="button"
              onClick={downloadAll}
              disabled={!imgEl}
              className="text-xs px-3 py-1.5 rounded-md border border-border disabled:opacity-50"
            >
              Download all ({visibleSpecs.length})
            </button>
            <CopyButton getText={() => iosJson} label="Copy iOS Contents.json" />
            <CopyButton getText={() => androidXml} label="Copy Android XML" />
            <DownloadButton getText={() => iosJson} filename="Contents.json" disabled={!imgEl} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">Sizes ({visibleSpecs.length})</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {summary.map((s) => (
              <div
                key={s.name + s.platform}
                className="rounded-md border border-border p-2 text-xs space-y-1 cursor-pointer hover:border-primary"
                onClick={() => drawIcon(visibleSpecs.find((sp) => sp.name === s.name)!)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono">{s.size}px</span>
                  <span className="text-muted-foreground">{s.platform}</span>
                </div>
                <p className="text-[10px] text-muted-foreground truncate">{s.name}</p>
                <p className="text-[10px] text-muted-foreground">{s.pretty}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Total estimated size: {formatBytes(totalBytes)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="text-sm font-medium">Preview (click a size above)</p>
          <canvas ref={previewRef} width={180} height={180} className="border border-border rounded-md" style={{ imageRendering: "pixelated" }} />
          <canvas ref={canvasRef} width={0} height={0} className="hidden" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all rendering is local. iOS icons use the standard ~22% squircle corner radius; Android adaptive icons apply an 8% safe-area padding per Material guidelines.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
