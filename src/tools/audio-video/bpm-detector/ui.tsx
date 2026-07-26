"use client";

import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  detectBpm, buildTempoMap, predictFutureBeats, noteDurations, tempoName,
  normalizeBpm, pruneStaleTaps, formatBpm,
} from "./logic";

export default function BpmDetectorUI() {
  const [taps, setTaps] = useState<number[]>([]);
  const [now, setNow] = useState(performance.now());
  const [error, setError] = useState("");
  const tapButtonRef = useRef<HTMLButtonElement>(null);

  // Prune stale taps every 500ms
  useEffect(() => {
    const id = setInterval(() => {
      setNow(performance.now());
      setTaps((prev) => pruneStaleTaps(prev, performance.now(), 4000));
    }, 500);
    return () => clearInterval(id);
  }, []);

  const handleTap = useCallback(() => {
    const t = performance.now();
    setTaps((prev) => [...prev, t].slice(-16));
  }, []);

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.code === "Space" && tapButtonRef.current) {
      e.preventDefault();
      handleTap();
    }
  }, [handleTap]);

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  const result = useMemo(() => detectBpm(taps), [taps]);
  const map = useMemo(() => buildTempoMap(taps), [taps]);
  const futureBeats = useMemo(() => predictFutureBeats(taps, 8), [taps]);
  const durations = useMemo(() => (result.bpm > 0 ? noteDurations(result.bpm) : null), [result.bpm]);
  const normalized = useMemo(() => (result.bpm > 0 ? normalizeBpm(result.bpm) : 0), [result.bpm]);

  const summary = useMemo(() => {
    if (taps.length < 2) return "Tap at least 2 times to detect BPM.";
    return [
      `Detected BPM: ${result.bpm}`,
      `Normalized: ${normalized} BPM (${tempoName(normalized)})`,
      `Confidence: ${(result.confidence * 100).toFixed(0)}%`,
      `Interval: ${result.intervalMs.toFixed(1)}ms`,
      `Taps recorded: ${result.tapCount}`,
      `Mean BPM: ${map.meanBpm}`,
      `Median BPM: ${map.medianBpm}`,
      `Std dev: ${map.stdBpm}`,
      `Stability: ${(map.stability * 100).toFixed(0)}%`,
      `Note durations: quarter ${durations?.quarter.toFixed(3)}s, eighth ${durations?.eighth.toFixed(3)}s`,
      `Next 8 beats (ms): ${futureBeats.map((b) => b.toFixed(0)).join(", ")}`,
    ].join("\n");
  }, [taps, result, normalized, map, durations, futureBeats]);

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-medium">Tap the button (or press Space) on each beat</Label>
          <button
            ref={tapButtonRef}
            type="button"
            onClick={handleTap}
            className="w-full h-32 rounded-xl border-2 border-primary bg-primary/10 text-primary font-bold text-2xl transition active:scale-95"
          >
            TAP
          </button>
          <p className="text-xs text-muted-foreground">Tap count: {taps.length} · Stale taps auto-pruned after 4s</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setTaps([])} className="text-xs px-3 py-1.5 rounded-md border border-border">Reset</button>
            <CopyButton getText={() => summary} disabled={taps.length < 2} />
            <DownloadButton getText={() => summary} filename="bpm-detection.txt" disabled={taps.length < 2} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="text-sm font-medium">Current detection</p>
          <p className="text-3xl font-bold">{result.bpm > 0 ? result.bpm : "—"}</p>
          <p className="text-sm text-muted-foreground">{formatBpm(result)}</p>
          {normalized > 0 && normalized !== result.bpm && (
            <p className="text-xs text-muted-foreground">Normalized (60-180): {normalized} BPM</p>
          )}
        </CardContent>
      </Card>

      {taps.length >= 2 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Confidence" value={`${(result.confidence * 100).toFixed(0)}%`} />
          <Stat label="Interval" value={`${result.intervalMs.toFixed(1)}ms`} />
          <Stat label="Mean BPM" value={String(map.meanBpm)} />
          <Stat label="Median BPM" value={String(map.medianBpm)} />
          <Stat label="Std dev" value={String(map.stdBpm)} />
          <Stat label="Stability" value={`${(map.stability * 100).toFixed(0)}%`} />
          <Stat label="Taps" value={String(taps.length)} />
          <Stat label="Tempo name" value={tempoName(result.bpm)} />
        </div>
      )}

      {durations && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-medium">Note durations at {result.bpm} BPM</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
              <div className="rounded border border-border p-2"><p className="text-muted-foreground">Whole</p><p className="font-mono">{durations.whole.toFixed(3)}s</p></div>
              <div className="rounded border border-border p-2"><p className="text-muted-foreground">Half</p><p className="font-mono">{durations.half.toFixed(3)}s</p></div>
              <div className="rounded border border-border p-2"><p className="text-muted-foreground">Quarter</p><p className="font-mono">{durations.quarter.toFixed(3)}s</p></div>
              <div className="rounded border border-border p-2"><p className="text-muted-foreground">Eighth</p><p className="font-mono">{durations.eighth.toFixed(3)}s</p></div>
              <div className="rounded border border-border p-2"><p className="text-muted-foreground">16th</p><p className="font-mono">{durations.sixteenth.toFixed(3)}s</p></div>
            </div>
          </CardContent>
        </Card>
      )}

      {futureBeats.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-medium">Predicted next beats (ms from start)</p>
            <p className="text-xs font-mono text-muted-foreground">{futureBeats.map((b) => b.toFixed(0)).join(" · ")}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> detection runs locally using only tap timestamps. Outliers ({">"}2× median) are rejected; confidence is 1 − 2·(std/mean).
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
