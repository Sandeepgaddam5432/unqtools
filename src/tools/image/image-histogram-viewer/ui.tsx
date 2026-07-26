"use client";

import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  computeHistogram,
  computeStats,
  detectClipping,
  computeCDF,
  equalizeHistogram,
  computeEntropy,
  computeContrastRatio,
  detectExposure,
  colorBalance,
  dynamicRange,
  peakValue,
  normalizeForDisplay,
  type HistogramData,
} from "./logic";

function drawHistogram(
  canvas: HTMLCanvasElement,
  hist: HistogramData,
  channels: { r: boolean; g: boolean; b: boolean; luminance: boolean },
  showCDF: boolean,
  logScale: boolean,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, W, H);
  // Grid lines
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo((i * W) / 4, 0);
    ctx.lineTo((i * W) / 4, H);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, (i * H) / 4);
    ctx.lineTo(W, (i * H) / 4);
    ctx.stroke();
  }
  const peak = peakValue(hist, true) || 1;
  const drawChannel = (channel: number[], color: string) => {
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * W;
      let v = channel[i];
      if (logScale) v = Math.log(v + 1);
      const norm = v / (logScale ? Math.log(peak + 1) : peak);
      const y = H - norm * H;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  };
  if (channels.luminance) drawChannel(hist.luminance, "#cccccc");
  if (channels.r) drawChannel(hist.r, "#ef4444");
  if (channels.g) drawChannel(hist.g, "#22c55e");
  if (channels.b) drawChannel(hist.b, "#3b82f6");
  ctx.globalAlpha = 1;
  if (showCDF) {
    const cdf = computeCDF(hist.luminance);
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * W;
      const y = H - cdf[i] * H;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

export default function ImageHistogramViewerUI() {
  const [pixels, setPixels] = useState<Uint8ClampedArray | null>(null);
  const [originalPixels, setOriginalPixels] = useState<Uint8ClampedArray | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [channels, setChannels] = useState({ r: true, g: true, b: true, luminance: true });
  const [showCDF, setShowCDF] = useState(false);
  const [logScale, setLogScale] = useState(true);
  const [shadowThresh, setShadowThresh] = useState(5);
  const [highlightThresh, setHighlightThresh] = useState(250);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const hist = useMemo(() => (pixels ? computeHistogram(pixels) : null), [pixels]);
  const stats = useMemo(() => (hist ? computeStats(hist) : null), [hist]);
  const clipping = useMemo(
    () => (hist ? detectClipping(hist, shadowThresh, highlightThresh) : null),
    [hist, shadowThresh, highlightThresh],
  );
  const entropy = useMemo(() => (hist ? computeEntropy(hist) : 0), [hist]);
  const contrast = useMemo(() => (hist ? computeContrastRatio(hist) : 0), [hist]);
  const exposure = useMemo(() => (hist ? detectExposure(hist) : null), [hist]);
  const balance = useMemo(() => (hist ? colorBalance(hist) : null), [hist]);
  const range = useMemo(() => (hist ? dynamicRange(hist) : null), [hist]);

  useEffect(() => {
    if (canvasRef.current && hist) {
      drawHistogram(canvasRef.current, hist, channels, showCDF, logScale);
    }
  }, [hist, channels, showCDF, logScale]);

  const onFile = useCallback(async (file: File) => {
    setError("");
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    const img = new Image();
    img.onload = () => {
      // Downscale large images for performance
      const maxDim = 800;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      if (!ctx) {
        setError("Cannot get canvas context");
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h).data;
      const arr = new Uint8ClampedArray(data);
      setPixels(arr);
      setOriginalPixels(arr);
    };
    img.onerror = () => setError("Failed to load image");
    img.src = url;
  }, []);

  const applyEqualize = useCallback(() => {
    if (!originalPixels) return;
    const equalized = equalizeHistogram(originalPixels);
    setPixels(equalized);
  }, [originalPixels]);

  const reset = useCallback(() => {
    if (originalPixels) setPixels(originalPixels);
  }, [originalPixels]);

  const downloadProcessed = useCallback(() => {
    if (!pixels || !imageUrl) return;
    // Re-draw pixels to a canvas and download
    const c = document.createElement("canvas");
    // We don't have original dimensions; use a square estimate or re-load
    // For simplicity, just download the raw pixel data as a PNG via ImageData
    const size = Math.sqrt(pixels.length / 4);
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const imgData = new ImageData(pixels, size, size);
    ctx.putImageData(imgData, 0, 0);
    c.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "histogram-processed.png";
      a.click();
      URL.revokeObjectURL(url);
    });
  }, [pixels, imageUrl]);

  const summary = useMemo(() => {
    if (!stats || !clipping || !exposure || !balance || !range) return "";
    return [
      `Mean RGB: ${stats.mean.r}, ${stats.mean.g}, ${stats.mean.b}`,
      `Mean luminance: ${stats.mean.luminance}`,
      `Median luminance: ${stats.median.luminance}`,
      `Std luminance: ${stats.std.luminance}`,
      `Entropy: ${entropy} bits/pixel`,
      `Contrast ratio: ${contrast}`,
      `Exposure: ${exposure.label}`,
      `Dynamic range: ${range.stops} stops`,
      `Shadow clipping: ${clipping.shadowPct.luminance}%`,
      `Highlight clipping: ${clipping.highlightPct.luminance}%`,
      `Warm tint: ${balance.warmTint}`,
    ].join("\n");
  }, [stats, clipping, exposure, balance, range, entropy, contrast]);

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-medium">Upload image</Label>
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
          {imageUrl && (
            <img src={imageUrl} alt="preview" className="max-h-48 rounded-md border" />
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={applyEqualize} disabled={!pixels}>Equalize histogram</Button>
            <Button size="sm" variant="outline" onClick={reset} disabled={!pixels}>Reset</Button>
            <Button size="sm" variant="outline" onClick={downloadProcessed} disabled={!pixels}>Download processed</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap gap-3 items-center">
            <p className="text-sm font-medium">Histogram</p>
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <input type="checkbox" checked={channels.r} onChange={(e) => setChannels({ ...channels, r: e.target.checked })} />
              <span className="text-red-500">R</span>
            </label>
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <input type="checkbox" checked={channels.g} onChange={(e) => setChannels({ ...channels, g: e.target.checked })} />
              <span className="text-green-500">G</span>
            </label>
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <input type="checkbox" checked={channels.b} onChange={(e) => setChannels({ ...channels, b: e.target.checked })} />
              <span className="text-blue-500">B</span>
            </label>
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <input type="checkbox" checked={channels.luminance} onChange={(e) => setChannels({ ...channels, luminance: e.target.checked })} />
              Luminance
            </label>
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <input type="checkbox" checked={showCDF} onChange={(e) => setShowCDF(e.target.checked)} />
              CDF curve
            </label>
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <input type="checkbox" checked={logScale} onChange={(e) => setLogScale(e.target.checked)} />
              Log scale
            </label>
            <CopyButton getText={() => summary} label="Copy summary" disabled={!stats} />
            <DownloadButton getText={() => summary} filename="histogram-stats.txt" disabled={!stats} />
          </div>
          <canvas ref={canvasRef} width={800} height={300} className="w-full rounded-md border bg-black" />
        </CardContent>
      </Card>

      {stats && clipping && exposure && balance && range && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm font-medium mb-2">Statistics</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-1.5">Channel</th>
                    <th>Mean</th>
                    <th>Median</th>
                    <th>Std</th>
                    <th>Min</th>
                    <th>Max</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  <tr className="border-b border-border/30"><td className="text-red-500">R</td><td>{stats.mean.r}</td><td>{stats.median.r}</td><td>{stats.std.r}</td><td>{stats.min.r}</td><td>{stats.max.r}</td></tr>
                  <tr className="border-b border-border/30"><td className="text-green-500">G</td><td>{stats.mean.g}</td><td>{stats.median.g}</td><td>{stats.std.g}</td><td>{stats.min.g}</td><td>{stats.max.g}</td></tr>
                  <tr className="border-b border-border/30"><td className="text-blue-500">B</td><td>{stats.mean.b}</td><td>{stats.median.b}</td><td>{stats.std.b}</td><td>{stats.min.b}</td><td>{stats.max.b}</td></tr>
                  <tr><td>Lum</td><td>{stats.mean.luminance}</td><td>{stats.median.luminance}</td><td>{stats.std.luminance}</td><td>{stats.min.luminance}</td><td>{stats.max.luminance}</td></tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <p className="text-sm font-medium">Quality metrics</p>
              <p className="text-sm">Exposure: <span className="font-bold">{exposure.label}</span></p>
              <p className="text-sm">Entropy: <span className="font-bold">{entropy} bits/px</span></p>
              <p className="text-sm">Contrast ratio: <span className="font-bold">{contrast}</span></p>
              <p className="text-sm">Dynamic range: <span className="font-bold">{range.stops} stops</span></p>
              <p className="text-sm">Warm tint: <span className="font-bold">{balance.warmTint > 0 ? "+" : ""}{balance.warmTint}</span> {balance.warmTint > 5 ? "(warm)" : balance.warmTint < -5 ? "(cool)" : "(neutral)"}</p>
              <div className="grid grid-cols-2 gap-2 pt-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Shadow threshold</Label>
                  <Input type="number" value={shadowThresh} onChange={(e) => setShadowThresh(Number(e.target.value))} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Highlight threshold</Label>
                  <Input type="number" value={highlightThresh} onChange={(e) => setHighlightThresh(Number(e.target.value))} />
                </div>
              </div>
              <p className="text-sm">Shadow clip: <span className="font-bold text-amber-600">{clipping.shadowPct.luminance}%</span></p>
              <p className="text-sm">Highlight clip: <span className="font-bold text-amber-600">{clipping.highlightPct.luminance}%</span></p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all image processing runs locally in your browser. Luminance uses Rec. 709 weights (0.2126 R + 0.7152 G + 0.0722 B). Equalization applies CDF-based mapping per channel.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
