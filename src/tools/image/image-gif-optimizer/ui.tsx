"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  DEFAULT_OPTIONS, estimateGifBytes, formatBytes, savingsPct,
  type OptimizeOptions, type GifAnalysis, type GifFrameInfo,
} from "./logic";

export default function ImageGifOptimizerUI() {
  const [fileName, setFileName] = useState("");
  const [width, setWidth] = useState(480);
  const [height, setHeight] = useState(270);
  const [frameCount, setFrameCount] = useState(24);
  const [duration, setDuration] = useState(1000);
  const [colors, setColors] = useState(128);
  const [hasTransparency, setHasTransparency] = useState(false);
  const [options, setOptions] = useState<OptimizeOptions>(DEFAULT_OPTIONS);
  const [error, setError] = useState("");

  const analysis: GifAnalysis = useMemo(() => {
    const avgDelay = frameCount > 0 ? duration / frameCount : 100;
    const frames: GifFrameInfo[] = Array.from({ length: frameCount }, (_, i) => ({
      index: i,
      width,
      height,
      delayMs: avgDelay,
      disposal: 0,
      transparentIndex: null,
      colorCount: colors,
      transparentPixels: hasTransparency ? Math.floor((width * height) / 4) : 0,
      hash: i % 2 === 0 ? "0".repeat(64) : "1".repeat(64),
    }));
    const estRaw = estimateGifBytes(width, height, frameCount, 256, hasTransparency);
    const estOpt = estimateGifBytes(width, height, Math.max(1, Math.floor(frameCount / 2)), colors, hasTransparency);
    const recommendations: string[] = [];
    if (colors > 64) recommendations.push("Reduce colors to 64 for significant savings (~50%).");
    if (frameCount > 30) recommendations.push("Many frames — consider dropping similar frames.");
    if (avgDelay < 20) recommendations.push("Frame delay <20ms may render incorrectly in browsers.");
    return {
      width,
      height,
      frameCount,
      totalDurationMs: duration,
      avgFps: duration > 0 ? Math.round((frameCount / duration) * 1000 * 10) / 10 : 0,
      loopCount: 0,
      globalColorCount: colors,
      hasTransparency,
      frames,
      estimatedBytesRaw: estRaw,
      estimatedBytesOptimized: estOpt,
      recommendations,
    };
  }, [width, height, frameCount, duration, colors, hasTransparency]);

  const optimized = useMemo(() => {
    const est = estimateGifBytes(
      analysis.width,
      analysis.height,
      Math.max(1, analysis.frameCount - (options.removeDuplicates ? Math.floor(analysis.frameCount / 2) : 0)),
      Math.min(options.maxColors, analysis.globalColorCount),
      analysis.hasTransparency,
    );
    return { bytes: est, removedCount: options.removeDuplicates ? Math.floor(analysis.frameCount / 2) : 0 };
  }, [analysis, options]);

  const summary = useMemo(() => {
    return [
      `File: ${fileName || "(no file)"}`,
      `Dimensions: ${analysis.width}×${analysis.height}`,
      `Frames: ${analysis.frameCount}`,
      `Duration: ${analysis.totalDurationMs}ms`,
      `Avg FPS: ${analysis.avgFps}`,
      `Colors: ${analysis.globalColorCount}`,
      `Transparency: ${analysis.hasTransparency ? "yes" : "no"}`,
      `Raw estimate: ${formatBytes(analysis.estimatedBytesRaw)}`,
      `Optimized estimate: ${formatBytes(optimized.bytes)}`,
      `Savings: ${savingsPct(analysis.estimatedBytesRaw, optimized.bytes)}%`,
      ...analysis.recommendations.map((r) => `- ${r}`),
    ].join("\n");
  }, [fileName, analysis, optimized]);

  const onFile = useCallback((f: File) => {
    setError("");
    setFileName(f.name);
    // We don't decode the GIF in this pure-logic UI — let the user adjust metadata
    // and see estimated optimizations.
  }, []);

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-medium">Upload GIF (for analysis)</Label>
          <Input
            type="file"
            accept="image/gif"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Width (px)</Label>
              <Input type="number" value={width} onChange={(e) => setWidth(Math.max(1, Number(e.target.value)))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Height (px)</Label>
              <Input type="number" value={height} onChange={(e) => setHeight(Math.max(1, Number(e.target.value)))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Frames</Label>
              <Input type="number" value={frameCount} onChange={(e) => setFrameCount(Math.max(1, Number(e.target.value)))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Duration (ms)</Label>
              <Input type="number" value={duration} onChange={(e) => setDuration(Math.max(1, Number(e.target.value)))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Max colors</Label>
              <Input type="number" min={2} max={256} value={colors} onChange={(e) => setColors(Math.min(256, Math.max(2, Number(e.target.value))))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Transparency</Label>
              <select
                className="text-xs px-2 py-1.5 rounded-md border border-input bg-background w-full"
                value={hasTransparency ? "yes" : "no"}
                onChange={(e) => setHasTransparency(e.target.value === "yes")}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">Optimization options</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={options.removeDuplicates}
                onChange={(e) => setOptions({ ...options, removeDuplicates: e.target.checked })}
              />
              Remove duplicate frames
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={options.dropSimilarFrames}
                onChange={(e) => setOptions({ ...options, dropSimilarFrames: e.target.checked })}
              />
              Drop similar frames
            </label>
            <label className="flex items-center gap-2 text-xs">
              Max colors
              <Input
                type="number" min={2} max={256}
                value={options.maxColors}
                onChange={(e) => setOptions({ ...options, maxColors: Math.min(256, Math.max(2, Number(e.target.value))) })}
                className="w-24"
              />
            </label>
            <label className="flex items-center gap-2 text-xs">
              Min delay (ms)
              <Input
                type="number" min={0}
                value={options.minDelayMs}
                onChange={(e) => setOptions({ ...options, minDelayMs: Math.max(0, Number(e.target.value)) })}
                className="w-24"
              />
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Raw estimate</p>
            <p className="text-lg font-bold">{formatBytes(analysis.estimatedBytesRaw)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Optimized estimate</p>
            <p className="text-lg font-bold">{formatBytes(optimized.bytes)}</p>
            <p className="text-xs text-green-600">-{savingsPct(analysis.estimatedBytesRaw, optimized.bytes)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Frames removed</p>
            <p className="text-lg font-bold">{optimized.removedCount}</p>
          </CardContent>
        </Card>
      </div>

      {analysis.recommendations.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-1">
            <p className="text-sm font-medium">Recommendations</p>
            {analysis.recommendations.map((r, i) => (
              <p key={i} className="text-xs text-muted-foreground">• {r}</p>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Export summary</p>
          <div className="flex gap-2">
            <CopyButton getText={() => summary} />
            <DownloadButton getText={() => summary} filename="gif-analysis.txt" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> estimates are computed locally. GIF byte estimation uses header + global color table + LZW per-frame approximation.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
