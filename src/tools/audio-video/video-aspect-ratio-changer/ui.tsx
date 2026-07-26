"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  computeAspect, ASPECT_RATIOS, detectClosestRatio, cropEfficiency, padWaste,
  formatDimensions, estimateRelativeSize, type AspectMode, type AspectRatio,
} from "./logic";

export default function VideoAspectRatioChangerUI() {
  const [sourceWidth, setSourceWidth] = useState(1920);
  const [sourceHeight, setSourceHeight] = useState(1080);
  const [targetRatio, setTargetRatio] = useState<AspectRatio>("9:16");
  const [mode, setMode] = useState<AspectMode>("crop");
  const [padColor, setPadColor] = useState("#000000");
  const [blurStrength, setBlurStrength] = useState(20);
  const [error, setError] = useState("");

  const result = useMemo(() => {
    return computeAspect({ sourceWidth, sourceHeight, targetRatio, mode, padColor, blurStrength });
  }, [sourceWidth, sourceHeight, targetRatio, mode, padColor, blurStrength]);

  const efficiency = useMemo(() => cropEfficiency(sourceWidth, sourceHeight, result.cropWidth, result.cropHeight), [sourceWidth, sourceHeight, result]);
  const waste = useMemo(() => padWaste(result.targetWidth, result.targetHeight, result.padWidth, result.padHeight), [result]);
  const sizeRatio = useMemo(() => estimateRelativeSize(sourceWidth, sourceHeight, result.targetWidth, result.targetHeight), [sourceWidth, sourceHeight, result]);
  const detected = useMemo(() => detectClosestRatio(sourceWidth, sourceHeight), [sourceWidth, sourceHeight]);

  const summary = useMemo(() => {
    return [
      `Source: ${formatDimensions(sourceWidth, sourceHeight)} (detected ${detected})`,
      `Target: ${targetRatio} (${mode})`,
      `Output: ${formatDimensions(result.targetWidth, result.targetHeight)}`,
      `Crop region: ${formatDimensions(result.cropWidth, result.cropHeight)} at (${result.cropX}, ${result.cropY})`,
      `Pad region: ${formatDimensions(result.padWidth, result.padHeight)} at (${result.padX}, ${result.padY})`,
      `Crop efficiency: ${efficiency}%`,
      `Pad waste: ${waste}%`,
      `Relative size: ${sizeRatio}× source`,
      result.description,
    ].join("\n");
  }, [sourceWidth, sourceHeight, detected, targetRatio, mode, result, efficiency, waste, sizeRatio]);

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Source width</Label>
              <Input type="number" min={1} value={sourceWidth} onChange={(e) => setSourceWidth(Math.max(1, Number(e.target.value)))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Source height</Label>
              <Input type="number" min={1} value={sourceHeight} onChange={(e) => setSourceHeight(Math.max(1, Number(e.target.value)))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Target ratio</Label>
              <select className="text-xs px-2 py-1.5 rounded-md border border-input bg-background w-full" value={targetRatio} onChange={(e) => setTargetRatio(e.target.value as AspectRatio)}>
                {ASPECT_RATIOS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label} — {r.common}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Mode</Label>
              <select className="text-xs px-2 py-1.5 rounded-md border border-input bg-background w-full" value={mode} onChange={(e) => setMode(e.target.value as AspectMode)}>
                <option value="crop">Crop (center)</option>
                <option value="pad">Pad (letterbox)</option>
                <option value="blur">Blur background</option>
                <option value="stretch">Stretch</option>
              </select>
            </div>
            {mode === "pad" && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Pad color</Label>
                <input type="color" value={padColor} onChange={(e) => setPadColor(e.target.value)} className="w-full h-9 rounded-md border border-input" />
              </div>
            )}
            {mode === "blur" && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Blur strength</Label>
                <Input type="number" min={0} max={50} value={blurStrength} onChange={(e) => setBlurStrength(Math.min(50, Math.max(0, Number(e.target.value))))} />
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Detected source ratio: {detected}</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Output dimensions" value={formatDimensions(result.targetWidth, result.targetHeight)} />
        <Stat label="Crop region" value={formatDimensions(result.cropWidth, result.cropHeight)} />
        <Stat label="Crop efficiency" value={`${efficiency}%`} />
        <Stat label="Relative size" value={`${sizeRatio}× source`} />
        {mode === "pad" && <Stat label="Pad waste" value={`${waste}%`} />}
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">Visual preview</p>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Source {formatDimensions(sourceWidth, sourceHeight)}</p>
              <div
                className="border-2 border-blue-500 flex items-center justify-center text-xs text-blue-500"
                style={{ width: Math.min(160, sourceWidth / Math.max(sourceHeight, sourceWidth) * 160), height: Math.min(160, sourceHeight / Math.max(sourceWidth, sourceHeight) * 160) }}
              >
                {detected}
              </div>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Target {formatDimensions(result.targetWidth, result.targetHeight)} ({mode})</p>
              <div
                className="border-2 border-green-500 relative flex items-center justify-center"
                style={{
                  width: Math.min(160, result.targetWidth / Math.max(result.targetHeight, result.targetWidth) * 160),
                  height: Math.min(160, result.targetHeight / Math.max(result.targetWidth, result.targetHeight) * 160),
                  background: mode === "pad" ? padColor : "transparent",
                }}
              >
                {mode === "blur" && <div className="absolute inset-0 bg-green-500/20 backdrop-blur-md" />}
                <span className="text-xs text-green-500 z-10">{targetRatio}</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{result.description}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="text-sm font-medium">Plan summary</p>
          <pre className="text-xs font-mono whitespace-pre-wrap">{summary}</pre>
          <div className="flex gap-2">
            <CopyButton getText={() => summary} />
            <DownloadButton getText={() => summary} filename="aspect-plan.txt" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all calculations run locally. Output dimensions are rounded to even numbers for video codec compatibility.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
