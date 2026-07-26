"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  DEFAULT_PARAMS, validateParams, buildPlan, recommendInterpolation,
  recommendTargetFps, generateFfmpegCommand, formatDuration, formatBytes,
  PRESETS, type InterpolationMode, type SlowMotionParams,
} from "./logic";

export default function SlowMotionMakerUI() {
  const [params, setParams] = useState<SlowMotionParams>({ ...DEFAULT_PARAMS });
  const [bitrate, setBitrate] = useState(4);
  const [error, setError] = useState("");

  const validation = useMemo(() => validateParams(params), [params]);
  const plan = useMemo(() => validation.ok ? buildPlan(params, bitrate) : null, [params, validation, bitrate]);
  const ffmpeg = useMemo(() => validation.ok ? generateFfmpegCommand(params) : "", [params, validation]);

  const update = useCallback(<K extends keyof SlowMotionParams>(key: K, value: SlowMotionParams[K]) => {
    setParams((p) => ({ ...p, [key]: value }));
  }, []);

  const applyPreset = useCallback((preset: typeof PRESETS[number]) => {
    setParams((p) => ({ ...p, speedFactor: preset.speedFactor, interpolation: preset.interpolation }));
  }, []);

  const summary = useMemo(() => {
    if (!plan) return "Invalid parameters.";
    return [
      `Source: ${formatDuration(params.sourceDurationSec)} @ ${params.sourceFps}fps`,
      `Speed: ${params.speedFactor}×`,
      `Interpolation: ${params.interpolation}`,
      `Output: ${formatDuration(plan.outputDurationSec)} @ ${plan.outputFps}fps`,
      `Frames: ${plan.sourceFrames} → ${plan.outputFrames} (${plan.interpolatedFrames} interpolated)`,
      `Real-time ratio: ${plan.realTimeRatio.toFixed(2)}×`,
      `Estimated size: ${formatBytes(plan.bytesEstimate)} at ${bitrate} Mbps`,
      plan.description,
      ...(plan.warnings.length ? ["", "Warnings:", ...plan.warnings.map((w) => `- ${w}`)] : []),
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
              <Input type="number" min={0.1} step={0.1} value={params.sourceDurationSec} onChange={(e) => update("sourceDurationSec", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Source FPS</Label>
              <Input type="number" min={1} max={240} value={params.sourceFps} onChange={(e) => update("sourceFps", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Speed factor (0.05-5)</Label>
              <Input type="number" min={0.05} max={5} step={0.05} value={params.speedFactor} onChange={(e) => update("speedFactor", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Interpolation</Label>
              <select className="text-xs px-2 py-1.5 rounded-md border border-input bg-background w-full" value={params.interpolation} onChange={(e) => update("interpolation", e.target.value as InterpolationMode)}>
                <option value="none">None (drop/dup)</option>
                <option value="dup">Duplicate</option>
                <option value="blend">Blend (crossfade)</option>
                <option value="mci">Motion-compensated</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Target FPS (optional)</Label>
              <Input type="number" min={1} max={240} value={params.targetFps ?? ""} onChange={(e) => update("targetFps", e.target.value === "" ? undefined : Number(e.target.value))} placeholder="auto" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Bitrate (Mbps)</Label>
              <Input type="number" min={0.5} step={0.5} value={bitrate} onChange={(e) => setBitrate(Math.max(0.1, Number(e.target.value)))} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => update("interpolation", recommendInterpolation(params.speedFactor))} className="text-xs px-3 py-1.5 rounded-md border border-border">Auto interpolation</button>
            <button type="button" onClick={() => update("targetFps", recommendTargetFps(params.speedFactor, params.sourceFps))} className="text-xs px-3 py-1.5 rounded-md border border-border">Auto target FPS</button>
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
                className={`text-xs p-2 rounded-md border text-left ${params.speedFactor === preset.speedFactor ? "border-primary bg-primary/5" : "border-border"}`}
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
            <Stat label="Source frames" value={String(plan.sourceFrames)} />
            <Stat label="Output frames" value={String(plan.outputFrames)} />
            <Stat label="Output duration" value={formatDuration(plan.outputDurationSec)} />
            <Stat label="Real-time ratio" value={`${plan.realTimeRatio.toFixed(2)}×`} />
            <Stat label="Interpolated frames" value={String(plan.interpolatedFrames)} />
            <Stat label="Output FPS" value={String(plan.outputFps)} />
            <Stat label="Est. size" value={formatBytes(plan.bytesEstimate)} />
            <Stat label="Speed" value={`${params.speedFactor}×`} />
          </div>

          {plan.warnings.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-1">
                <p className="text-sm font-medium text-amber-600">Warnings</p>
                {plan.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-muted-foreground">• {w}</p>
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
              <pre className="text-xs font-mono bg-muted/30 p-2 rounded-md overflow-x-auto">{ffmpeg}</pre>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Plan summary</p>
                <div className="flex gap-2">
                  <CopyButton getText={() => summary} />
                  <DownloadButton getText={() => summary} filename="slowmo-plan.txt" />
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
            <strong className="text-foreground">Privacy:</strong> all computations are local. The FFmpeg command uses setpts for time stretching and minterpolate/tmix for frame interpolation.
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
