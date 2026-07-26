"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  DEFAULT_PARAMS, COLOR_SCHEMES, validateParams, buildPlan, applyColorScheme,
  estimateBytes, formatDuration, formatBytes, generateSyntheticWaveform,
  canvasAspectRatio, type AudiogramParams, type ColorScheme,
} from "./logic";

export default function AudiogramMakerUI() {
  const [params, setParams] = useState<AudiogramParams>({ ...DEFAULT_PARAMS });
  const [bitrate, setBitrate] = useState(4);
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const samples = useMemo(() => generateSyntheticWaveform(params.durationSec, params.sampleRate), [params.durationSec, params.sampleRate]);
  const plan = useMemo(() => {
    const v = validateParams(params);
    if (!v.ok) return null;
    return buildPlan(samples, params);
  }, [params, samples]);

  useEffect(() => {
    if (!plan || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    canvasRef.current.width = params.canvasWidth;
    canvasRef.current.height = params.canvasHeight;
    ctx.fillStyle = params.backgroundColor;
    ctx.fillRect(0, 0, params.canvasWidth, params.canvasHeight);
    const scheme = COLOR_SCHEMES[params.colorScheme];
    const centerY = params.canvasHeight / 2;
    const maxBarHeight = (params.canvasHeight - 100) / 2;
    plan.bars.forEach((bar, i) => {
      const h = bar.amplitude * maxBarHeight;
      const x = bar.x - params.barWidth / 2;
      // Gradient from accent to foreground
      const grad = ctx.createLinearGradient(0, centerY - h, 0, centerY + h);
      grad.addColorStop(0, scheme.foreground);
      grad.addColorStop(0.5, scheme.accent);
      grad.addColorStop(1, scheme.foreground);
      ctx.fillStyle = grad;
      ctx.fillRect(x, centerY - h, params.barWidth, h * 2);
    });
    // Title text
    ctx.fillStyle = params.foregroundColor;
    ctx.font = "bold 32px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("AUDIOGRAM", params.canvasWidth / 2, 60);
  }, [plan, params]);

  const estBytes = useMemo(() => estimateBytes(params.durationSec, bitrate, 30, params.canvasWidth, params.canvasHeight), [params, bitrate]);

  const update = useCallback(<K extends keyof AudiogramParams>(key: K, value: AudiogramParams[K]) => {
    setParams((p) => ({ ...p, [key]: value }));
  }, []);

  const downloadPng = useCallback(() => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "audiogram-preview.png";
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }, []);

  const summary = useMemo(() => {
    if (!plan) return "Invalid parameters.";
    return [
      `Duration: ${formatDuration(params.durationSec)}`,
      `Sample rate: ${params.sampleRate} Hz`,
      `Color scheme: ${params.colorScheme}`,
      `Bars: ${plan.bars.length} (width ${params.barWidth}px, gap ${params.barGap}px)`,
      `Canvas: ${params.canvasWidth}×${params.canvasHeight} (${canvasAspectRatio(params.canvasWidth, params.canvasHeight)})`,
      `Total samples: ${plan.totalSamples.toLocaleString()}`,
      `Samples per bar: ${plan.samplesPerBar}`,
      `Peak amplitude: ${plan.peakAmplitude.toFixed(3)}`,
      `RMS amplitude: ${plan.rmsAmplitude.toFixed(3)}`,
      `Estimated video size: ${formatBytes(estBytes)} at ${bitrate} Mbps + 128kbps audio`,
      plan.description,
    ].join("\n");
  }, [plan, params, estBytes, bitrate]);

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}
      {!validateParams(params).ok && <ErrorBanner message={validateParams(params).reason ?? "Invalid parameters"} />}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Duration (s)</Label>
              <Input type="number" min={0.1} step={0.5} value={params.durationSec} onChange={(e) => update("durationSec", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Sample rate</Label>
              <select className="text-xs px-2 py-1.5 rounded-md border border-input bg-background w-full" value={params.sampleRate} onChange={(e) => update("sampleRate", Number(e.target.value))}>
                <option value={22050}>22050</option>
                <option value={44100}>44100</option>
                <option value={48000}>48000</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Color scheme</Label>
              <select className="text-xs px-2 py-1.5 rounded-md border border-input bg-background w-full" value={params.colorScheme} onChange={(e) => setParams((p) => applyColorScheme(p, e.target.value as ColorScheme))}>
                {Object.entries(COLOR_SCHEMES).map(([key, s]) => (
                  <option key={key} value={key}>{s.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Bar count</Label>
              <Input type="number" min={1} max={1000} value={params.barCount} onChange={(e) => update("barCount", Math.max(1, Math.min(1000, Number(e.target.value))))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Bar width (px)</Label>
              <Input type="number" min={1} value={params.barWidth} onChange={(e) => update("barWidth", Math.max(1, Number(e.target.value)))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Bar gap (px)</Label>
              <Input type="number" min={0} value={params.barGap} onChange={(e) => update("barGap", Math.max(0, Number(e.target.value)))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Canvas width</Label>
              <Input type="number" min={100} value={params.canvasWidth} onChange={(e) => update("canvasWidth", Math.max(100, Number(e.target.value)))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Canvas height</Label>
              <Input type="number" min={100} value={params.canvasHeight} onChange={(e) => update("canvasHeight", Math.max(100, Number(e.target.value)))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Bitrate (Mbps)</Label>
              <Input type="number" min={0.5} step={0.5} value={bitrate} onChange={(e) => setBitrate(Math.max(0.1, Number(e.target.value)))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Peak normalize</Label>
              <select className="text-xs px-2 py-1.5 rounded-md border border-input bg-background w-full" value={params.peakNormalize ? "yes" : "no"} onChange={(e) => update("peakNormalize", e.target.value === "yes")}>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Preview (synthetic waveform)</p>
            <div className="flex gap-2">
              <button type="button" onClick={downloadPng} disabled={!plan} className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground disabled:opacity-50">Download PNG</button>
              <CopyButton getText={() => summary} disabled={!plan} />
              <DownloadButton getText={() => summary} filename="audiogram-plan.txt" disabled={!plan} />
            </div>
          </div>
          {plan ? (
            <canvas ref={canvasRef} className="border border-border rounded-md max-w-full" style={{ maxHeight: 480 }} />
          ) : (
            <p className="text-xs text-muted-foreground">Fix parameters to render preview.</p>
          )}
        </CardContent>
      </Card>

      {plan && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Total samples" value={plan.totalSamples.toLocaleString()} />
          <Stat label="Samples per bar" value={String(plan.samplesPerBar)} />
          <Stat label="Peak" value={plan.peakAmplitude.toFixed(3)} />
          <Stat label="RMS" value={plan.rmsAmplitude.toFixed(3)} />
          <Stat label="Est. video size" value={formatBytes(estBytes)} />
          <Stat label="Aspect" value={canvasAspectRatio(params.canvasWidth, params.canvasHeight)} />
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> preview uses a synthetic waveform. Upload your audio in production to compute real bars. Estimates assume 30fps video at the chosen bitrate plus 128 kbps audio.
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
