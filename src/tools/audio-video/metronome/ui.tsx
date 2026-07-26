"use client";

import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  DEFAULT_PARAMS, BPM_MIN, BPM_MAX, validateParams, beatPeriod, barDuration,
  tempoMarking, buildBarSchedule, buildSchedule, totalDuration, tapTempo,
  adjustBpm, timeSignature, clickSample, describeParams, type MetronomeParams,
} from "./logic";

export default function MetronomeUI() {
  const [params, setParams] = useState<MetronomeParams>({ ...DEFAULT_PARAMS });
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(-1);
  const [taps, setTaps] = useState<number[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const scheduleRef = useRef<number | null>(null);
  const nextClickTimeRef = useRef(0);
  const eventsRef = useRef<{ time: number; accent: boolean; volume: number; beat: number }[]>([]);

  const update = useCallback(<K extends keyof MetronomeParams>(key: K, value: MetronomeParams[K]) => {
    setParams((p) => ({ ...p, [key]: value }));
  }, []);

  const stop = useCallback(() => {
    if (scheduleRef.current) {
      clearInterval(scheduleRef.current);
      scheduleRef.current = null;
    }
    setPlaying(false);
    setCurrentBeat(-1);
  }, []);

  const play = useCallback(() => {
    setError("");
    const v = validateParams(params);
    if (!v.ok) { setError(v.reason ?? "Invalid"); return; }
    stop();
    if (!audioCtxRef.current) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new Ctor();
    }
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const schedule = buildBarSchedule(params);
    eventsRef.current = schedule.map((e) => ({ time: e.time, accent: e.accent, volume: e.volume, beat: e.beatIndex }));
    const barDur = barDuration(params);
    const now = ctx.currentTime + 0.1;
    nextClickTimeRef.current = now;
    let eventIdx = 0;
    let barCount = 0;
    const tick = () => {
      const ctxNow = ctx.currentTime;
      // Schedule clicks up to 100ms ahead
      while (nextClickTimeRef.current < ctxNow + 0.2) {
        const ev = eventsRef.current[eventIdx % eventsRef.current.length];
        const barOffset = Math.floor(eventIdx / eventsRef.current.length) * barDur;
        const t = now + barOffset + ev.time;
        const sample = clickSample(ev.volume, ctx.sampleRate, ev.accent ? 1500 : 1000, 30);
        const buf = ctx.createBuffer(1, sample.length, ctx.sampleRate);
        buf.getChannelData(0).set(sample);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(t);
        // Visual sync — schedule state update
        const delay = (t - ctxNow) * 1000;
        setTimeout(() => setCurrentBeat(ev.beat), Math.max(0, delay));
        nextClickTimeRef.current = t + (eventsRef.current[(eventIdx + 1) % eventsRef.current.length]?.time ?? 0) - ev.time;
        eventIdx++;
        if (eventIdx >= eventsRef.current.length) {
          barCount++;
          // Reset for next bar
          nextClickTimeRef.current = now + barCount * barDur;
        }
        if (barCount > 1000) break;
      }
    };
    tick();
    scheduleRef.current = window.setInterval(tick, 50);
    setPlaying(true);
  }, [params, stop]);

  useEffect(() => () => stop(), [stop]);

  const handleTap = useCallback(() => {
    const now = performance.now();
    const newTaps = [...taps, now].slice(-8);
    setTaps(newTaps);
    if (newTaps.length >= 2) {
      const bpm = tapTempo(newTaps);
      if (bpm > 0) update("bpm", bpm);
    }
  }, [taps, update]);

  const description = useMemo(() => describeParams(params), [params]);
  const barDur = useMemo(() => barDuration(params), [params]);
  const beatDur = useMemo(() => beatPeriod(params.bpm, params.beatUnit), [params.bpm, params.beatUnit]);

  const summary = useMemo(() => {
    return [
      ...description.split("\n"),
      `Total duration (8 bars): ${totalDuration(params, 8).toFixed(2)}s`,
    ].join("\n");
  }, [description, params]);

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">BPM ({BPM_MIN}-{BPM_MAX})</Label>
              <div className="flex gap-1">
                <button type="button" onClick={() => update("bpm", adjustBpm(params.bpm, -1))} className="px-2 py-1 border border-border rounded text-xs">−</button>
                <Input type="number" min={BPM_MIN} max={BPM_MAX} value={params.bpm} onChange={(e) => update("bpm", adjustBpm(Number(e.target.value), 0))} />
                <button type="button" onClick={() => update("bpm", adjustBpm(params.bpm, 1))} className="px-2 py-1 border border-border rounded text-xs">+</button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Beats per bar</Label>
              <Input type="number" min={1} max={16} value={params.beatsPerBar} onChange={(e) => {
                const n = Math.max(1, Math.min(16, Number(e.target.value)));
                const pattern = Array.from({ length: n }, (_, i) => i === 0);
                setParams((p) => ({ ...p, beatsPerBar: n, accentPattern: pattern }));
              }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Beat unit</Label>
              <select className="text-xs px-2 py-1.5 rounded-md border border-input bg-background w-full" value={params.beatUnit} onChange={(e) => update("beatUnit", Number(e.target.value))}>
                <option value={1}>1 (whole)</option>
                <option value={2}>2 (half)</option>
                <option value={4}>4 (quarter)</option>
                <option value={8}>8 (eighth)</option>
                <option value={16}>16 (sixteenth)</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Subdivisions</Label>
              <Input type="number" min={1} max={8} value={params.subdivisions} onChange={(e) => update("subdivisions", Math.max(1, Math.min(8, Number(e.target.value))))} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <button type="button" onClick={play} disabled={playing} className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground disabled:opacity-50">
              {playing ? "Playing…" : "Play"}
            </button>
            <button type="button" onClick={stop} disabled={!playing} className="text-xs px-3 py-1.5 rounded-md border border-border disabled:opacity-50">Stop</button>
            <button type="button" onClick={handleTap} className="text-xs px-3 py-1.5 rounded-md border border-border">Tap tempo ({taps.length})</button>
            <CopyButton getText={() => summary} />
            <DownloadButton getText={() => summary} filename="metronome-settings.txt" />
          </div>
          <p className="text-xs text-muted-foreground">
            {tempoMarking(params.bpm)} · {timeSignature(params.beatsPerBar, params.beatUnit)} · Beat period {beatDur.toFixed(3)}s · Bar {barDur.toFixed(3)}s
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">Accent pattern</p>
          <div className="flex flex-wrap gap-2">
            {params.accentPattern.map((accent, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  const pattern = [...params.accentPattern];
                  pattern[i] = !pattern[i];
                  update("accentPattern", pattern);
                }}
                className={`w-12 h-12 rounded-md border text-xs ${currentBeat === i ? "border-primary bg-primary text-primary-foreground" : accent ? "border-primary" : "border-border"}`}
              >
                {i + 1}
                <br />
                <span className="text-[10px]">{accent ? "X" : "."}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">{summary}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> clicks are synthesized locally via Web Audio API. Tap tempo averages the last 8 intervals.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
