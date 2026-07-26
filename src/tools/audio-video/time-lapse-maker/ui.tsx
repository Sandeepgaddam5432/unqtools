"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  DEFAULT_PARAMS, validateParams, buildPlan, recommendInterval,
  recommendOutputFps, generateFfmpegCommand, formatDuration, formatBytes,
  PRESETS, type TimeLapseParams,
} from "./logic";

export default function TimeLapseMakerUI() {
  const [params, setParams] = useState<TimeLapseParams>({ ...DEFAULT_PARAMS });
  const [targetOutputSec, setTargetOutputSec] = useState(30);
  const [bitrate, setBitrate] = useState(4);
  const [error, setError] = useState("");

  const validation = useMemo(() => validateParams(params), [params]);
  const plan = useMemo(() => validation.ok ? buildPlan(params, bitrate) : null, [params, validation, bitrate]);
  const ffmpeg = useMemo(() => validation.ok ? generateFfmpegCommand(params) : "", [params, validation]);

  const update = useCallback(<K extends keyof TimeLapseParams>(key: K, value: TimeLapseParams[K]) => {
    setParams((p) => ({ ...p, [key]: value }));
  }, []);

  const applyPreset = useCallback((preset: typeof PRESETS[number]) => {
    setParams((p) => ({ ...p, sourceDurationSec: preset.sourceDurationSec, frameIntervalSec: preset.frameIntervalSec, outputFps: preset.outputFps, outputDurationSec: undefined }));
  }, []);

  const autoInterval = useCallback(() => {
    update("frameIntervalSec", recommendInterval(params.sourceDurationSec, targetOutputSec, params.outputFps));
    update("outputDurationSec", undefined);
  }, [params.sourceDurationSec, params.outputFps, targetOutputSec, update]);

  const summary = useMemo(() => {
    if (!plan) return "Invalid parameters.";
    return [
      `Source: ${formatDuration(params.sourceDurationSec)} @ ${params.sourceFps}fps`,
      `Frame interval: ${params.frameIntervalSec}s`,
      `Output FPS: ${params.outputFps}`,
      `Source frames: ${plan.sourceFrames.toLocaleString()}`,
      `Selected frames: ${plan.selectedFrames}`,
      `Dropped frames: ${plan.droppedFrames.toLocaleString()}`,
      `Output duration: ${formatDuration(plan.outputDurationSec)}`,
      `Speedup: ${plan.speedupFactor.toFixed(1)}×`,
      `Estimated size: ${formatBytes(plan.bytesEstimate)} at ${bitrate} Mbps`,
      plan.description,
      ...(plan.recommendations.length ? ["", "Recommendations:", ...plan.recommendations.map((r) => `- ${r}`)] : []),
      "",
      `FFmpeg: ${ffmpeg}`,
    ].join("\n");
  }, [plan, params, bitrate, ffmpeg]);

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}
      {!validation.ok && <ErrorBanner message={validation.reason ?? "Invalid parameters"} />}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Source duration (s)</Label>
              <Input type="number" min={1} value={params.sourceDurationSec} onChange={(e) => update("sourceDurationSec", Math.max(1, Number(e.target.value)))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Source FPS</Label>
              <Input type="number" min={1} max={240} value={params.sourceFps} onChange={(e) => update("sourceFps", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Frame interval (s)</Label>
              <Input type="number" min={0.1} step={0.5} value={params.frameIntervalSec} onChange={(e) => update("frameIntervalSec", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Output FPS</Label>
              <Input type="number" min={1} max={240} value={params.outputFps} onChange={(e) => update("outputFps", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Bitrate (Mbps)</Label>
              <Input type="number" min={0.5} step={0.5} value={bitrate} onChange={(e) => setBitrate(Math.max(0.1, Number(e.target.value)))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Target output (s) — for auto interval</Label>
              <Input type="number" min={1} value={targetOutputSec} onChange={(e) => setTargetOutputSec(Math.max(1, Number(e.target.value)))} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={autoInterval} className="text-xs px-3 py-1.5 rounded-md border border-border">Auto interval for target</button>
            <button type="button" onClick={() => update("outputFps", recommendOutputFps(plan?.selectedFrames ?? 100, targetOutputSec))} className="text-xs px-3 py-1.5 rounded-md border border-border">Auto FPS</button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">Presets</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => applyPreset(preset)}
                className="text-xs p-2 rounded-md border border-border text-left hover:border-primary"
              >
                <p className="font-medium">{preset.name}</p>
                <p className="text-[10px] text-muted-foreground">{preset.description}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {plan && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Source frames" value={plan.sourceFrames.toLocaleString()} />
            <Stat label="Selected frames" value={String(plan.selectedFrames)} />
            <Stat label="Dropped frames" value={plan.droppedFrames.toLocaleString()} />
            <Stat label="Output duration" value={formatDuration(plan.outputDurationSec)} />
            <Stat label="Speedup" value={`${plan.speedupFactor.toFixed(1)}×`} />
            <Stat label="Output FPS" value={String(params.outputFps)} />
            <Stat label="Est. size" value={formatBytes(plan.bytesEstimate)} />
            <Stat label="Interval" value={`${params.frameIntervalSec}s`} />
          </div>

          {plan.recommendations.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-1">
                <p className="text-sm font-medium text-amber-600">Recommendations</p>
                {plan.recommendations.map((r, i) => (
                  <p key={i} className="text-xs text-muted-foreground">• {r}</p>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">FFmpeg command</p>
                <CopyButton getText={() => ffmpeg} label="Copy command" />
              </div>
              <pre className="text-xs font-mono bg-muted/30 p-2 rounded-md overflow-x-auto break-all whitespace-pre-wrap">{ffmpeg}</pre>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Plan summary</p>
                <div className="flex gap-2">
                  <CopyButton getText={() => summary} />
                  <DownloadButton getText={() => summary} filename="timelapse-plan.txt" />
                </div>
              </div>
              <pre className="text-xs font-mono whitespace-pre-wrap">{summary}</pre>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all calculations are local. The FFmpeg command uses the select filter to pick one frame every N seconds and resamples output via setpts.
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
