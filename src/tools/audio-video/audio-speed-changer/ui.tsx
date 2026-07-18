"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CopyButton,
  EmptyState,
  ShareButton,
  ClearButton,
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  SPEED_PRESETS,
  SPEED_PRESET_VALUES,
  SPEED_PRESET_LABELS,
  MIN_SPEED,
  MAX_SPEED,
  validateSpeed,
  parseSpeed,
  computeNewDuration,
  computePitchShiftSemitones,
  formatSemitones,
  estimateWavSizeBytes,
  formatBytes,
  formatTime,
  msToSamples,
  encodeWav,
  generateFilename,
  loadHistory,
  saveHistory,
  clearHistory,
  computeSummaryStats,
  buildShareUrl,
  parseShareUrl,
  resampleChannelsLinear,
  type SpeedPreset,
  type HistoryEntry,
} from "./logic";
import { Gauge, Upload, Play, History, FileAudio, Clock, HardDrive, Music } from "lucide-react";

interface DecodedAudio {
  audioBuffer: AudioBuffer;
  fileName: string;
  fileSize: number;
}

interface SpeedResult {
  blob: Blob;
  url: string;
  filename: string;
  durationSeconds: number;
  sizeBytes: number;
  sampleRate: number;
  channels: number;
  speed: number;
  preservePitch: boolean;
}

export default function AudioSpeedChanger() {
  const [decoded, setDecoded] = useState<DecodedAudio | null>(null);
  const [speedPreset, setSpeedPreset] = useState<SpeedPreset>("1.5");
  const [customSpeed, setCustomSpeed] = useState<string>("");
  const [useCustom, setUseCustom] = useState(false);
  const [preservePitch, setPreservePitch] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<SpeedResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.speed) {
        const n = parseSpeed(p.speed);
        if (Number.isFinite(n)) {
          // Check if it matches a preset
          const match = SPEED_PRESETS.find((p2) => SPEED_PRESET_VALUES[p2] === n);
          if (match) {
            setSpeedPreset(match);
            setUseCustom(false);
          } else {
            setCustomSpeed(p.speed);
            setUseCustom(true);
          }
        }
      }
      if (p.preservePitch !== undefined) setPreservePitch(p.preservePitch);
      if (p.speed || p.preservePitch !== undefined) {
        toast.info("Loaded settings from share link");
      }
    }
    return () => {
      if (result) URL.revokeObjectURL(result.url);
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  const getAudioContext = useCallback((): AudioContext => {
    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioContextRef.current = new Ctor();
    }
    return audioContextRef.current;
  }, []);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setDecodeError(null);
    setResult(null);
    if (!file.type.startsWith("audio/") && !/\.(wav|mp3|ogg|webm|m4a|aac|flac)$/i.test(file.name)) {
      setDecodeError("Please select an audio file (wav, mp3, ogg, webm, m4a, aac, flac).");
      return;
    }
    try {
      setBusy(true);
      const arrayBuffer = await file.arrayBuffer();
      const ctx = getAudioContext();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      setDecoded({ audioBuffer, fileName: file.name, fileSize: file.size });
      toast.success(`Loaded ${file.name} (${formatTime(audioBuffer.duration)})`);
    } catch (e) {
      setDecodeError(`Could not decode audio file: ${(e as Error).message}. The format may not be supported by your browser.`);
    } finally {
      setBusy(false);
    }
  }, [getAudioContext]);

  const onFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (e.target) e.target.value = "";
  }, [handleFile]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  // Compute the effective speed factor from preset or custom
  const speed: number = useMemo(() => {
    if (useCustom) {
      const n = parseSpeed(customSpeed);
      return Number.isFinite(n) ? n : Number.NaN;
    }
    return SPEED_PRESET_VALUES[speedPreset];
  }, [useCustom, customSpeed, speedPreset]);

  const speedValid = useMemo(() => validateSpeed(speed), [speed]);

  const totalDuration = decoded?.audioBuffer.duration ?? 0;
  const sampleRate = decoded?.audioBuffer.sampleRate ?? 44100;
  const channels = decoded?.audioBuffer.numberOfChannels ?? 1;
  const totalSamples = decoded?.audioBuffer.length ?? 0;

  const newDuration = useMemo(
    () => Number.isFinite(speed) ? computeNewDuration(totalDuration, speed) : 0,
    [totalDuration, speed],
  );
  const pitchShift = useMemo(
    () => preservePitch ? 0 : (Number.isFinite(speed) ? computePitchShiftSemitones(speed) : 0),
    [preservePitch, speed],
  );
  const estimatedSize = useMemo(
    () => Number.isFinite(speed) ? estimateWavSizeBytes(totalSamples, channels, speed) : 44,
    [totalSamples, channels, speed],
  );

  const handleChangeSpeed = useCallback(async () => {
    if (!decoded) return;
    setError(null);
    if (!speedValid.ok) {
      setError(speedValid.error ?? "Invalid speed factor");
      return;
    }
    setBusy(true);
    try {
      let outputChannels: Float32Array[];
      let outputSampleRate: number;

      // Read source channels
      const sourceChannels: Float32Array[] = [];
      for (let c = 0; c < decoded.audioBuffer.numberOfChannels; c++) {
        sourceChannels.push(decoded.audioBuffer.getChannelData(c).slice());
      }

      if (speed === 1.0) {
        // No-op: just copy
        outputChannels = sourceChannels;
        outputSampleRate = sampleRate;
      } else if (preservePitch) {
        // Pitch-preserving mode: use OfflineAudioContext with playbackRate.
        // Render at length = ceil(N / speed). The buffer's source plays faster,
        // so the output is shorter but pitch is preserved.
        const outputLength = Math.max(1, Math.floor(decoded.audioBuffer.length / speed));
        const offlineCtx = new OfflineAudioContext(
          decoded.audioBuffer.numberOfChannels,
          outputLength,
          sampleRate,
        );
        const srcNode = offlineCtx.createBufferSource();
        srcNode.buffer = decoded.audioBuffer;
        srcNode.playbackRate.value = speed;
        srcNode.connect(offlineCtx.destination);
        srcNode.start();
        const rendered = await offlineCtx.startRendering();
        outputChannels = [];
        for (let c = 0; c < rendered.numberOfChannels; c++) {
          outputChannels.push(rendered.getChannelData(c).slice());
        }
        outputSampleRate = rendered.sampleRate;
      } else {
        // No pitch preservation: linear-interpolation resampler.
        // (Both tempo AND pitch shift together, like a tape.)
        outputChannels = resampleChannelsLinear(sourceChannels, speed);
        outputSampleRate = sampleRate;
      }

      // Apply a small fade in/out (5ms each) to avoid clicks at boundaries
      const fadeSamples = msToSamples(5, outputSampleRate);
      const wav = encodeWav(outputChannels, outputSampleRate, fadeSamples, fadeSamples);
      const blob = new Blob([wav.buffer as ArrayBuffer], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      const filename = generateFilename(speed);
      const speedResult: SpeedResult = {
        blob,
        url,
        filename,
        durationSeconds: newDuration,
        sizeBytes: blob.size,
        sampleRate: outputSampleRate,
        channels: outputChannels.length,
        speed,
        preservePitch,
      };
      setResult((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return speedResult;
      });
      const entry: HistoryEntry = {
        ts: Date.now(),
        originalName: decoded.fileName,
        originalDurationMs: Math.round(totalDuration * 1000),
        newDurationMs: Math.round(newDuration * 1000),
        speed,
        preservePitch,
        pitchShiftSemitones: pitchShift,
        outputSizeBytes: blob.size,
        sampleRate: outputSampleRate,
        channels: outputChannels.length,
      };
      saveHistory(entry);
      setHistory(loadHistory());
      toast.success(`Speed changed to ${speed}× (${formatBytes(blob.size)})`);
    } catch (e) {
      setError(`Speed change failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [decoded, speed, speedValid, preservePitch, sampleRate, totalDuration, newDuration, pitchShift]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success(`Downloaded ${result.filename}`);
  }, [result]);

  const handleReset = useCallback(() => {
    if (result) URL.revokeObjectURL(result.url);
    setResult(null);
    setDecoded(null);
    setError(null);
    setDecodeError(null);
    setCustomSpeed("");
    setUseCustom(false);
    setSpeedPreset("1.5");
    toast.info("Cleared");
  }, [result]);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const stats = useMemo(() => {
    if (!result || !decoded) return null;
    return computeSummaryStats(
      totalDuration,
      result.speed,
      result.preservePitch,
      result.sizeBytes,
      result.sampleRate,
      result.channels,
    );
  }, [result, decoded, totalDuration]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs">Audio file</Label>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors cursor-pointer ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-medium text-foreground">
              {decoded ? decoded.fileName : "Drop an audio file or click to browse"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {decoded
                ? `${formatBytes(decoded.fileSize)} · ${formatTime(decoded.audioBuffer.duration)} · ${decoded.audioBuffer.sampleRate} Hz · ${decoded.audioBuffer.numberOfChannels} ch`
                : "Supports wav, mp3, ogg, webm, m4a, aac, flac"}
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.wav,.mp3,.ogg,.webm,.m4a,.aac,.flac"
            onChange={onFileInput}
            className="hidden"
          />
          {decodeError && <ErrorBanner message={decodeError} />}
        </CardContent>
      </Card>

      {decoded && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <FileAudio className="h-4 w-4" /> Original preview
            </h3>
            <OriginalAudioPreview decoded={decoded} />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Total duration" value={formatTime(totalDuration)} />
              <Stat label="Sample rate" value={`${sampleRate} Hz`} />
              <Stat label="Channels" value={channels} />
              <Stat label="File size" value={formatBytes(decoded.fileSize)} />
            </div>
          </CardContent>
        </Card>
      )}

      {decoded && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Gauge className="h-4 w-4" /> Speed settings
            </h3>
            <div className="space-y-2">
              <Label className="text-xs">Speed presets (7 from 0.5× to 2.0×)</Label>
              <div className="flex flex-wrap gap-1.5">
                {SPEED_PRESETS.map((p) => {
                  const isActive = !useCustom && speedPreset === p;
                  return (
                    <Button
                      key={p}
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={() => { setSpeedPreset(p); setUseCustom(false); }}
                    >{SPEED_PRESET_LABELS[p]}</Button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="asc-custom" className="text-xs">
                Custom speed ({MIN_SPEED}× to {MAX_SPEED}×)
              </Label>
              <div className="flex gap-2">
                <Input
                  id="asc-custom"
                  value={customSpeed}
                  onChange={(e) => { setCustomSpeed(e.target.value); setUseCustom(true); }}
                  placeholder="e.g. 1.35 or 135%"
                  className="font-mono text-xs h-8"
                />
                <Button
                  variant={useCustom ? "default" : "outline"}
                  size="sm"
                  className="h-8"
                  onClick={() => setUseCustom((v) => !v)}
                >{useCustom ? "Using custom" : "Use custom"}</Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Parsed: {Number.isFinite(speed) ? `${speed.toFixed(3)}×` : "invalid"} · Range: {MIN_SPEED}×–{MAX_SPEED}×
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Pitch preservation</Label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={preservePitch}
                  onChange={(e) => setPreservePitch(e.target.checked)}
                />
                <span>
                  {preservePitch
                    ? "ON — keep original pitch (uses OfflineAudioContext)"
                    : "OFF — pitch shifts with speed (tape-style resampling)"}
                </span>
              </label>
              <p className="text-[10px] text-muted-foreground">
                Pitch shift: {preservePitch ? "0.00 st (preserved)" : formatSemitones(pitchShift)}
              </p>
            </div>
            {error && <ErrorBanner message={error} />}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={handleChangeSpeed} disabled={busy || !speedValid.ok} className="gap-1.5">
                <Gauge className="h-3.5 w-3.5" /> {busy ? "Processing…" : "Change speed"}
              </Button>
              <ShareButton getUrl={() => buildShareUrl({
                speed: useCustom ? customSpeed : speedPreset,
                preservePitch,
              })} />
              <ClearButton onClick={handleReset} />
            </div>
          </CardContent>
        </Card>
      )}

      {decoded && Number.isFinite(speed) && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> Speed preview stats
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Original duration" value={formatTime(totalDuration)} />
              <Stat label="New duration" value={formatTime(newDuration)} highlight={speed !== 1 ? "good" : undefined} />
              <Stat label="Speed factor" value={`${speed.toFixed(2)}×`} />
              <Stat label="Output size (est.)" value={formatBytes(estimatedSize)} />
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant="outline" className="text-[10px]">
                <Music className="h-3 w-3 mr-1" /> Pitch: {preservePitch ? "preserved" : formatSemitones(pitchShift)}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                Mode: {preservePitch ? "OfflineAudioContext" : "linear resample"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Play className="h-4 w-4" /> Speed-changed output
            </h3>
            <audio src={result.url} controls className="w-full" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Duration" value={formatTime(result.durationSeconds)} />
              <Stat label="File size" value={formatBytes(result.sizeBytes)} />
              <Stat label="Format" value="WAV (PCM 16-bit)" />
              <Stat label="Filename" value={result.filename} />
            </div>
            {stats && (
              <div className="rounded border bg-background px-3 py-2 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">Original: {formatTime(stats.originalDurationSeconds)}</Badge>
                  <Badge variant="outline">New: {formatTime(stats.newDurationSeconds)}</Badge>
                  <Badge variant="secondary">Speed: {stats.speed.toFixed(2)}×</Badge>
                  <Badge variant="outline">Pitch: {stats.preservePitch ? "preserved" : formatSemitones(stats.pitchShiftSemitones)}</Badge>
                  <Badge variant="outline">Output: {formatBytes(stats.outputSizeBytes)}</Badge>
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={handleDownload} className="gap-1.5">
                <HardDrive className="h-3.5 w-3.5" /> Download WAV
              </Button>
              <CopyButton getText={() => result.filename} label="Copy filename" />
            </div>
          </CardContent>
        </Card>
      )}

      {!decoded && !decodeError && (
        <EmptyState
          title="Drop an audio file to change its playback speed"
          hint="Drag and drop or click to browse. We decode it locally with the Web Audio API, change the speed (0.25× to 4.0×), optionally preserve pitch via OfflineAudioContext, and re-encode as 16-bit PCM WAV."
          icon={<Gauge className="h-8 w-8" />}
        />
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> History ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1 max-h-[300px] overflow-auto">
              {history.slice(0, 10).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">{h.speed}×</Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {h.preservePitch ? "pitch preserved" : `pitch ${formatSemitones(h.pitchShiftSemitones)}`}
                  </Badge>
                  <span className="font-mono text-muted-foreground">
                    {formatTime(h.originalDurationMs / 1000)} → {formatTime(h.newDurationMs / 1000)}
                  </span>
                  <span className="text-muted-foreground">· {formatBytes(h.outputSizeBytes)}</span>
                  <span className="text-muted-foreground ml-auto truncate max-w-[160px]">{h.originalName}</span>
                  <span className="text-muted-foreground">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> Audio decoding, speed
            changing (linear-interpolation resampler OR OfflineAudioContext pitch
            preservation), and WAV encoding all happen locally in your browser
            via the Web Audio API and a pure-JS RIFF encoder. No file is ever
            uploaded. Speed-change metadata is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Render the original audio file in an <audio> element by re-encoding the
 * decoded AudioBuffer to a WAV blob (so the user can preview before processing).
 */
function OriginalAudioPreview({ decoded }: { decoded: { audioBuffer: AudioBuffer; fileName: string; fileSize: number } }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function build() {
      try {
        const { sampleRate, numberOfChannels } = decoded.audioBuffer;
        const channelData: Float32Array[] = [];
        for (let c = 0; c < numberOfChannels; c++) {
          channelData.push(decoded.audioBuffer.getChannelData(c).slice());
        }
        const wav = encodeWav(channelData, sampleRate, 0, 0);
        const blob = new Blob([wav.buffer as ArrayBuffer], { type: "audio/wav" });
        if (!cancelled) {
          setUrl(URL.createObjectURL(blob));
        }
      } catch {
        // ignore
      }
    }
    build();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [decoded]);

  if (!url) {
    return <p className="text-xs text-muted-foreground">Preparing preview…</p>;
  }
  return <audio src={url} controls className="w-full" />;
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: "good" | "bad";
}) {
  const color = highlight === "good"
    ? "text-emerald-600 dark:text-emerald-400"
    : highlight === "bad"
      ? "text-red-600 dark:text-red-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${color} break-all`}>{value}</div>
    </div>
  );
}
