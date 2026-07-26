"use client";

import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  DEFAULT_PARAMS, generateNoise, validateParams, peakAmplitude, rmsAmplitude,
  spectralRolloff, classifyNoise, formatDuration, estimateWavBytes, formatBytes,
  spectralDescription, type NoiseType, type NoiseParams,
} from "./logic";

export default function NoiseGeneratorUI() {
  const [params, setParams] = useState<NoiseParams>({ ...DEFAULT_PARAMS });
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  const update = useCallback(<K extends keyof NoiseParams>(key: K, value: NoiseParams[K]) => {
    setParams((p) => ({ ...p, [key]: value }));
  }, []);

  const stop = useCallback(() => {
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch {}
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (gainRef.current) { gainRef.current.disconnect(); gainRef.current = null; }
    setPlaying(false);
  }, []);

  const play = useCallback(() => {
    setError("");
    const v = validateParams(params);
    if (!v.ok) { setError(v.reason ?? "Invalid"); return; }
    stop();
    const samples = generateNoise(params);
    if (!audioCtxRef.current) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new Ctor();
    }
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const buffer = ctx.createBuffer(1, samples.length, params.sampleRate);
    buffer.getChannelData(0).set(samples);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = 1;
    src.connect(gain).connect(ctx.destination);
    src.start();
    src.onended = () => { stop(); };
    sourceRef.current = src;
    gainRef.current = gain;
    setPlaying(true);
  }, [params, stop]);

  useEffect(() => () => stop(), [stop]);

  const downloadWav = useCallback(() => {
    setError("");
    const v = validateParams(params);
    if (!v.ok) { setError(v.reason ?? "Invalid"); return; }
    const samples = generateNoise(params);
    const wav = encodeWav(samples, params.sampleRate);
    const blob = new Blob([wav], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `noise-${params.type}.wav`;
    a.click();
    URL.revokeObjectURL(url);
  }, [params]);

  const samples = useMemo(() => generateNoise({ ...params, duration: 0.1 }), [params]);
  const peak = useMemo(() => peakAmplitude(samples), [samples]);
  const rms = useMemo(() => rmsAmplitude(samples), [samples]);
  const rolloff = useMemo(() => spectralRolloff(samples, params.sampleRate), [samples, params.sampleRate]);
  const classified = useMemo(() => classifyNoise(rolloff, params.sampleRate), [rolloff, params.sampleRate]);
  const desc = useMemo(() => spectralDescription(params.type), [params.type]);
  const estBytes = useMemo(() => estimateWavBytes(params.duration, params.sampleRate), [params.duration, params.sampleRate]);

  const summary = useMemo(() => {
    return [
      `Type: ${params.type}`,
      `Volume: ${(params.volume * 100).toFixed(0)}%`,
      `Duration: ${formatDuration(params.duration)}`,
      `Sample rate: ${params.sampleRate} Hz`,
      `Spectral slope: ${desc.slope}`,
      `Peak amplitude: ${peak.toFixed(3)}`,
      `RMS amplitude: ${rms.toFixed(3)}`,
      `Spectral rolloff: ${Math.round(rolloff)} Hz`,
      `Classified as: ${classified}`,
      `Estimated WAV: ${formatBytes(estBytes)}`,
    ].join("\n");
  }, [params, desc, peak, rms, rolloff, classified, estBytes]);

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Type</Label>
              <select className="text-xs px-2 py-1.5 rounded-md border border-input bg-background w-full" value={params.type} onChange={(e) => update("type", e.target.value as NoiseType)}>
                <option value="white">White</option>
                <option value="pink">Pink</option>
                <option value="brown">Brown</option>
                <option value="blue">Blue</option>
                <option value="violet">Violet</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Volume</Label>
              <Input type="number" min={0} max={1} step={0.01} value={params.volume} onChange={(e) => update("volume", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Duration (s)</Label>
              <Input type="number" min={0.1} step={0.5} value={params.duration} onChange={(e) => update("duration", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Sample rate</Label>
              <select className="text-xs px-2 py-1.5 rounded-md border border-input bg-background w-full" value={params.sampleRate} onChange={(e) => update("sampleRate", Number(e.target.value))}>
                <option value={22050}>22050</option>
                <option value={44100}>44100</option>
                <option value={48000}>48000</option>
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={play} disabled={playing} className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground disabled:opacity-50">
              {playing ? "Playing…" : "Play"}
            </button>
            <button type="button" onClick={stop} disabled={!playing} className="text-xs px-3 py-1.5 rounded-md border border-border disabled:opacity-50">Stop</button>
            <button type="button" onClick={downloadWav} className="text-xs px-3 py-1.5 rounded-md border border-border">Download WAV</button>
            <CopyButton getText={() => summary} />
            <DownloadButton getText={() => summary} filename="noise-settings.txt" />
          </div>
          <p className="text-xs text-muted-foreground">
            {desc.description} · {desc.slope} · Estimated WAV: {formatBytes(estBytes)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <p className="text-sm font-medium">Quick analysis (first 100ms)</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <Stat label="Peak amplitude" value={peak.toFixed(3)} />
            <Stat label="RMS amplitude" value={rms.toFixed(3)} />
            <Stat label="Spectral rolloff" value={`${Math.round(rolloff)} Hz`} />
            <Stat label="Classified as" value={classified} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> noise is generated locally via deterministic PRNGs. Pink uses a Voss-McCartney approximation; brown integrates white noise.
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

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return buffer;
}
