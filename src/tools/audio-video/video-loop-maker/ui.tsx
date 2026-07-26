"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  DEFAULT_PARAMS, validateParams, buildLoopPlan, recommendCrossfade,
  recommendLoopCount, formatDuration, formatBytes, generateFfmpegCommand,
  type LoopParams,
} from "./logic";

export default function VideoLoopMakerUI() {
  const [params, setParams] = useState<LoopParams>({ ...DEFAULT_PARAMS });
  const [targetDuration, setTargetDuration] = useState(30);
  const [bitrate, setBitrate] = useState(4);
  const [error, setError] = useState("");

  const validation = useMemo(() => validateParams(params), [params]);
  const plan = useMemo(() => {
    if (!validation.ok) return null;
    return buildLoopPlan(params, bitrate);
  }, [params, validation, bitrate]);

  const ffmpeg = useMemo(() => validation.ok ? generateFfmpegCommand(params) : "", [params, validation]);

  const summary = useMemo(() => {
    if (!plan) return "Invalid parameters.";
    return [
      `Source duration: ${formatDuration(params.sourceDurationSec)}`,
      `Trimmed: ${formatDuration(plan.effectiveDurationSec)} (start ${params.trimStartSec}s, end ${params.trimEndSec}s)`,
      `Loops: ${plan.loopCount}`,
      `Crossfade: ${plan.crossfadeSec}s`,
      `Total output: ${formatDuration(plan.totalDurationSec)}`,
      `Seamless: ${plan.seamlessPossible ? "yes" : "no"}`,
      `Estimated size: ${formatBytes(plan.outputBytesEstimate)} at ${bitrate} Mbps`,
      `Loop start times (s): ${plan.loopPoints.map((p) => p.toFixed(2)).join(", ")}`,
      ...(plan.recommendations.length ? ["", "Recommendations:", ...plan.recommendations.map((r) => `- ${r}`)] : []),
      "",
      `FFmpeg: ${ffmpeg}`,
    ].join("\n");
  }, [plan, params, bitrate, ffmpeg]);

  const update = useCallback(<K extends keyof LoopParams>(key: K, value: LoopParams[K]) => {
    setParams((p) => ({ ...p, [key]: value }));
  }, []);

  const applyCrossfade = useCallback(() => {
    update("crossfadeSec", recommendCrossfade(params.sourceDurationSec));
  }, [params.sourceDurationSec, update]);

  const applyLoopCount = useCallback(() => {
    update("loopCount", recommendLoopCount(params.sourceDurationSec, targetDuration));
  }, [params.sourceDurationSec, targetDuration, update]);

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}
      {!validation.ok && <ErrorBanner message={validation.reason ?? "Invalid parameters"} />}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Source duration (s)</Label>
              <Input type="number" min={0.1} step={0.1} value={params.sourceDurationSec} onChange={(e) => update("sourceDurationSec", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Loop count</Label>
              <Input type="number" min={1} max={100} value={params.loopCount} onChange={(e) => update("loopCount", Math.max(1, Math.min(100, Number(e.target.value))))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Crossfade (s)</Label>
              <Input type="number" min={0} max={5} step={0.1} value={params.crossfadeSec} onChange={(e) => update("crossfadeSec", Math.max(0, Math.min(5, Number(e.target.value))))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Trim start (s)</Label>
              <Input type="number" min={0} step={0.1} value={params.trimStartSec} onChange={(e) => update("trimStartSec", Math.max(0, Number(e.target.value)))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Trim end (s)</Label>
              <Input type="number" min={0} step={0.1} value={params.trimEndSec} onChange={(e) => update("trimEndSec", Math.max(0, Number(e.target.value)))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Bitrate (Mbps)</Label>
              <Input type="number" min={0.5} step={0.5} value={bitrate} onChange={(e) => setBitrate(Math.max(0.1, Number(e.target.value)))} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <button type="button" onClick={applyCrossfade} className="text-xs px-3 py-1.5 rounded-md border border-border">Auto crossfade</button>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Target total (s)</Label>
              <Input type="number" min={1} value={targetDuration} onChange={(e) => setTargetDuration(Math.max(1, Number(e.target.value)))} className="w-24" />
              <button type="button" onClick={applyLoopCount} className="text-xs px-3 py-1.5 rounded-md border border-border">Auto loop count</button>
            </div>
          </div>
        </CardContent>
      </Card>

      {plan && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Effective duration" value={formatDuration(plan.effectiveDurationSec)} />
            <Stat label="Total output" value={formatDuration(plan.totalDurationSec)} />
            <Stat label="Seamless" value={plan.seamlessPossible ? "Yes" : "No"} />
            <Stat label="Est. size" value={formatBytes(plan.outputBytesEstimate)} />
          </div>

          <Card>
            <CardContent className="p-4 space-y-2">
              <p className="text-sm font-medium">Loop timeline</p>
              <div className="flex flex-wrap gap-1 text-xs">
                {plan.loopPoints.map((t, i) => (
                  <span key={i} className="px-2 py-1 rounded border border-border bg-muted/30 font-mono">
                    Loop {i + 1}: {t.toFixed(2)}s
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

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
              <pre className="text-xs font-mono bg-muted/30 p-2 rounded-md overflow-x-auto">{ffmpeg}</pre>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Plan summary</p>
                <div className="flex gap-2">
                  <CopyButton getText={() => summary} />
                  <DownloadButton getText={() => summary} filename="loop-plan.txt" />
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
            <strong className="text-foreground">Privacy:</strong> all computations run locally. The FFmpeg command is for reference — actual video processing requires a separate encoder.
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
