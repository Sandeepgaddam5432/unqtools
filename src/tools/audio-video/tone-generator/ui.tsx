"use client";

import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import {
  DEFAULT_PARAMS, FREQ_MIN, FREQ_MAX, validateParams, generateTone,
  frequencyToNote, formatDuration, estimatePcmBytes, formatBytes, noteRange,
  type Waveform, type ToneParams,
} from "./logic";

export default function ToneGeneratorUI() {
  const [params, setParams] = useState<ToneParams>({ ...DEFAULT_PARAMS });
  const [error, setError] = useState("");
  const [playing, setPlaying] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  const note = useMemo(() => frequencyToNote(params.frequency), [params.frequency]);
  const estBytes = useMemo(() => estimatePcmBytes(params.duration, params.sampleRate, 1, 16), [params.duration, params.sampleRate]);
  const notes = useMemo(() => noteRange(2, 6), []);

  const update = useCallback(<K extends keyof ToneParams>(key: K, value: ToneParams[K]) => {
    setParams((p) => ({ ...p, [key]: value }));
  }, []);

  const stop = useCallback(() => {
    if (oscRef.current) {
      try { oscRef.current.stop(); } catch {}
      oscRef.current.disconnect();
      oscRef.current = null;
    }
    if (gainRef.current) {
      gainRef.current.disconnect();
      gainRef.current = null;
    }
    setPlaying(false);
  }, []);

  const play = useCallback(() => {
    setError("");
    const v = validateParams(params);
    if (!v.ok) {
      setError(v.reason ?? "Invalid parameters");
      return;
    }
    stop();
    if (!audioCtxRef.current) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new Ctor();
    }
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = params.waveform === "pulse" ? "square" : (params.waveform as OscillatorType);
    osc.frequency.value = params.frequency;
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(params.volume, now + (params.attack ?? 0.01));
    gain.gain.linearRampToValueAtTime(params.volume * (params.sustain ?? 0.8), now + (params.attack ?? 0.01) + (params.decay ?? 0.05));
    gain.gain.setValueAtTime(params.volume * (params.sustain ?? 0.8), now + params.duration - (params.release ?? 0.1));
    gain.gain.linearRampToValueAtTime(0, now + params.duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + params.duration);
    osc.onended = () => {
      stop();
    };
    oscRef.current = osc;
    gainRef.current = gain;
    setPlaying(true);
  }, [params, stop]);

  useEffect(() => () => stop(), [stop]);

  const downloadWav = useCallback(() => {
    setError("");
    const v = validateParams(params);
    if (!v.ok) { setError(v.reason ?? "Invalid"); return; }
    const samples = generateTone(params);
    if (samples.length === 0) return;
    const wavBytes = encodeWav(samples, params.sampleRate);
    const blob = new Blob([wavBytes], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tone-${params.frequency}hz.wav`;
    a.click();
    URL.revokeObjectURL(url);
  }, [params]);

  const summary = useMemo(() => {
    return [
      `Frequency: ${params.frequency} Hz`,
      `Note: ${note.note}${note.octave} (${note.cents > 0 ? "+" : ""}${note.cents} cents)`,
      `Waveform: ${params.waveform}`,
      `Volume: ${(params.volume * 100).toFixed(0)}%`,
      `Duration: ${formatDuration(params.duration)}`,
      `Sample rate: ${params.sampleRate} Hz`,
      `Estimated WAV: ${formatBytes(estBytes + 44)}`,
    ].join("\n");
  }, [params, note, estBytes]);

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Frequency (Hz) — {FREQ_MIN} to {FREQ_MAX}</Label>
              <Input type="number" min={FREQ_MIN} max={FREQ_MAX} value={params.frequency} onChange={(e) => update("frequency", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Volume</Label>
              <Input type="number" min={0} max={1} step={0.01} value={params.volume} onChange={(e) => update("volume", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Duration (s)</Label>
              <Input type="number" min={0.01} step={0.1} value={params.duration} onChange={(e) => update("duration", Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Waveform</Label>
              <select className="text-xs px-2 py-1.5 rounded-md border border-input bg-background w-full" value={params.waveform} onChange={(e) => update("waveform", e.target.value as Waveform)}>
                <option value="sine">Sine</option>
                <option value="square">Square</option>
                <option value="triangle">Triangle</option>
                <option value="sawtooth">Sawtooth</option>
                <option value="pulse">Pulse</option>
              </select>
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
              <Label className="text-xs text-muted-foreground">Pulse width</Label>
              <Input type="number" min={0.01} max={0.99} step={0.05} value={params.pulseWidth ?? 0.5} onChange={(e) => update("pulseWidth", Number(e.target.value))} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={play} disabled={playing} className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground disabled:opacity-50">
              {playing ? "Playing…" : "Play"}
            </button>
            <button type="button" onClick={stop} disabled={!playing} className="text-xs px-3 py-1.5 rounded-md border border-border disabled:opacity-50">Stop</button>
            <button type="button" onClick={downloadWav} className="text-xs px-3 py-1.5 rounded-md border border-border">Download WAV</button>
            <CopyButton getText={() => summary} />
            <DownloadButton getText={() => summary} filename="tone-settings.txt" />
          </div>
          <p className="text-xs text-muted-foreground">
            Closest note: <strong>{note.note}{note.octave}</strong> ({note.cents > 0 ? "+" : ""}{note.cents} cents) · Estimated WAV: {formatBytes(estBytes + 44)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">Quick presets</p>
          <div className="flex flex-wrap gap-2">
            {notes.filter((n) => n.octave >= 3 && n.octave <= 5).slice(0, 24).map((n) => (
              <button
                key={`${n.note}-${n.octave}`}
                type="button"
                onClick={() => update("frequency", Math.round(n.freq))}
                className="text-xs px-2 py-1 rounded border border-border hover:border-primary"
              >
                {n.note}{n.octave}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> audio is generated and played locally via Web Audio API. WAV export uses 16-bit PCM encoding.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/** Encode a Float32Array of samples (-1..1) as 16-bit PCM WAV bytes. */
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
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
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
