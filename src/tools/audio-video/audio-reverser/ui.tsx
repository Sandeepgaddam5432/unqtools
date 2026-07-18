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
  REVERSE_MODES,
  REVERSE_MODE_LABELS,
  REVERSE_MODE_DESCRIPTIONS,
  SEGMENT_PRESETS,
  DEFAULT_SEGMENTS,
  reverseChannels,
  reverseChannelsSegments,
  reverseInterleavedChannels,
  computeSegmentBoundaries,
  msToSamples,
  detectClicksMulti,
  computeDuration,
  estimateWavSizeBytes,
  formatBytes,
  formatTime,
  encodeWav,
  generateFilename,
  loadHistory,
  saveHistory,
  clearHistory,
  computeSummaryStats,
  buildShareUrl,
  parseShareUrl,
  type ReverseMode,
  type HistoryEntry,
} from "./logic";
import { Rewind, Upload, Play, History, FileAudio, Clock, HardDrive, AlertTriangle, Scissors } from "lucide-react";

interface DecodedAudio {
  audioBuffer: AudioBuffer;
  fileName: string;
  fileSize: number;
}

interface ReverseResult {
  blob: Blob;
  url: string;
  filename: string;
  durationSeconds: number;
  sizeBytes: number;
  sampleRate: number;
  channels: number;
  mode: ReverseMode;
  segments: number;
  clickCount: number;
  appliedFadeMs: number;
}

export default function AudioReverser() {
  const [decoded, setDecoded] = useState<DecodedAudio | null>(null);
  const [mode, setMode] = useState<ReverseMode>("full");
  const [segments, setSegments] = useState<number>(DEFAULT_SEGMENTS);
  const [applyFade, setApplyFade] = useState(true);
  const [fadeMs, setFadeMs] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<ReverseResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.mode) setMode(p.mode);
      if (p.segments && p.segments > 0) setSegments(p.segments);
      if (p.applyFade !== undefined) setApplyFade(p.applyFade);
      if (p.fadeMs !== undefined && p.fadeMs >= 0) setFadeMs(p.fadeMs);
      if (p.mode || p.applyFade !== undefined) {
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

  const totalDuration = decoded?.audioBuffer.duration ?? 0;
  const sampleRate = decoded?.audioBuffer.sampleRate ?? 44100;
  const channels = decoded?.audioBuffer.numberOfChannels ?? 1;
  const totalSamples = decoded?.audioBuffer.length ?? 0;
  const newDuration = computeDuration(totalDuration);
  const estimatedSize = estimateWavSizeBytes(totalSamples, channels);

  // Compute click analysis on the source buffer (to warn the user)
  const clickAnalysis = useMemo(() => {
    if (!decoded) return null;
    const channelData: Float32Array[] = [];
    for (let c = 0; c < decoded.audioBuffer.numberOfChannels; c++) {
      channelData.push(decoded.audioBuffer.getChannelData(c));
    }
    const boundaries = computeSegmentBoundaries(
      totalSamples,
      mode === "segment" ? segments : 1,
    );
    return detectClicksMulti(channelData, boundaries);
  }, [decoded, totalSamples, mode, segments]);

  const handleReverse = useCallback(async () => {
    if (!decoded) return;
    setError(null);
    setBusy(true);
    try {
      const sourceChannels: Float32Array[] = [];
      for (let c = 0; c < decoded.audioBuffer.numberOfChannels; c++) {
        sourceChannels.push(decoded.audioBuffer.getChannelData(c).slice());
      }

      let outputChannels: Float32Array[];
      if (mode === "full" || mode === "per-channel") {
        outputChannels = reverseChannels(sourceChannels);
      } else if (mode === "segment") {
        outputChannels = reverseChannelsSegments(sourceChannels, segments);
      } else {
        // interleaved
        outputChannels = reverseInterleavedChannels(sourceChannels);
      }

      // Apply fade in/out to suppress clicks at boundaries
      const fadeSamples = applyFade ? msToSamples(fadeMs, sampleRate) : 0;
      const wav = encodeWav(outputChannels, sampleRate, fadeSamples, fadeSamples);
      const blob = new Blob([wav.buffer as ArrayBuffer], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      const filename = generateFilename(mode, segments);
      const reverseResult: ReverseResult = {
        blob,
        url,
        filename,
        durationSeconds: newDuration,
        sizeBytes: blob.size,
        sampleRate,
        channels: outputChannels.length,
        mode,
        segments: mode === "segment" ? segments : 1,
        clickCount: clickAnalysis?.clickCount ?? 0,
        appliedFadeMs: applyFade ? fadeMs : 0,
      };
      setResult((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return reverseResult;
      });
      const entry: HistoryEntry = {
        ts: Date.now(),
        originalName: decoded.fileName,
        durationMs: Math.round(totalDuration * 1000),
        mode,
        segments: reverseResult.segments,
        channels: outputChannels.length,
        sampleRate,
        outputSizeBytes: blob.size,
        clickCount: reverseResult.clickCount,
        appliedFadeMs: reverseResult.appliedFadeMs,
      };
      saveHistory(entry);
      setHistory(loadHistory());
      toast.success(`Reversed (${formatBytes(blob.size)})`);
    } catch (e) {
      setError(`Reverse failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [decoded, mode, segments, applyFade, fadeMs, sampleRate, newDuration, totalDuration, clickAnalysis]);

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
    setMode("full");
    setSegments(DEFAULT_SEGMENTS);
    setApplyFade(true);
    setFadeMs(5);
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
      result.channels,
      result.sampleRate,
      result.segments,
      decoded.fileSize,
      result.sizeBytes,
      result.mode,
      result.clickCount,
      result.appliedFadeMs,
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
              <Rewind className="h-4 w-4" /> Reverse settings
            </h3>
            <div className="space-y-1.5">
              <Label className="text-xs">Reverse mode</Label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as ReverseMode)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {REVERSE_MODES.map((m) => (
                  <option key={m} value={m}>{REVERSE_MODE_LABELS[m]}</option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground">
                {REVERSE_MODE_DESCRIPTIONS[mode]}
              </p>
            </div>
            {mode === "segment" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Segment count (presets: 1, 2, 4, 8, 16)</Label>
                <div className="flex flex-wrap gap-1.5">
                  {SEGMENT_PRESETS.map((n) => (
                    <Button
                      key={n}
                      variant={segments === n ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={() => setSegments(n)}
                    >{n} segment{n > 1 ? "s" : ""}</Button>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Label htmlFor="ar-segments-custom" className="text-[10px]">Custom:</Label>
                  <Input
                    id="ar-segments-custom"
                    type="number"
                    min={1}
                    max={1024}
                    value={segments}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      if (Number.isFinite(n) && n > 0) setSegments(n);
                    }}
                    className="h-7 w-20 text-xs font-mono"
                  />
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Click prevention</Label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyFade}
                  onChange={(e) => setApplyFade(e.target.checked)}
                />
                <span>Apply {fadeMs} ms fade in/out at boundaries</span>
              </label>
              {applyFade && (
                <div className="flex items-center gap-2 pl-6">
                  <Label htmlFor="ar-fadems" className="text-[10px]">Fade (ms):</Label>
                  <Input
                    id="ar-fadems"
                    type="number"
                    min={0}
                    max={1000}
                    value={fadeMs}
                    onChange={(e) => {
                      const n = parseFloat(e.target.value);
                      if (Number.isFinite(n) && n >= 0) setFadeMs(n);
                    }}
                    className="h-7 w-20 text-xs font-mono"
                  />
                </div>
              )}
            </div>
            {clickAnalysis && clickAnalysis.hasClicks && (
              <div className="flex items-start gap-2 rounded border border-yellow-500/30 bg-yellow-500/10 p-2 text-xs text-yellow-700 dark:text-yellow-300">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                  {clickAnalysis.clickCount} potential click(s) detected at segment boundaries
                  (max amp {clickAnalysis.maxAmplitude.toFixed(3)}).
                  {applyFade ? " Fade will be applied to suppress them." : " Enable fade to reduce clicks."}
                </span>
              </div>
            )}
            {error && <ErrorBanner message={error} />}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={handleReverse} disabled={busy} className="gap-1.5">
                <Rewind className="h-3.5 w-3.5" /> {busy ? "Reversing…" : "Reverse audio"}
              </Button>
              <ShareButton getUrl={() => buildShareUrl({ mode, segments, applyFade, fadeMs })} />
              <ClearButton onClick={handleReset} />
            </div>
          </CardContent>
        </Card>
      )}

      {decoded && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> Reverse preview stats
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Duration" value={formatTime(newDuration)} />
              <Stat label="Output size (est.)" value={formatBytes(estimatedSize)} />
              <Stat label="Channels" value={channels} />
              <Stat label="Mode" value={mode} />
            </div>
            {mode === "segment" && (
              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Scissors className="h-3 w-3" />
                Will split into {segments} segments and reverse each.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Play className="h-4 w-4" /> Reversed output
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
                  <Badge variant="outline">Mode: {stats.mode}</Badge>
                  <Badge variant="outline">Channels: {stats.channels}</Badge>
                  <Badge variant="outline">Segments: {stats.segmentCount}</Badge>
                  <Badge variant="outline">Input: {formatBytes(stats.inputSizeBytes)}</Badge>
                  <Badge variant="secondary">Output: {formatBytes(stats.outputSizeBytes)}</Badge>
                  <Badge variant={stats.clickCount > 0 ? "destructive" : "outline"}>
                    Clicks: {stats.clickCount}
                  </Badge>
                  {stats.appliedFadeMs > 0 && (
                    <Badge variant="outline">Fade: {stats.appliedFadeMs} ms</Badge>
                  )}
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
          title="Drop an audio file to reverse it"
          hint="Drag and drop or click to browse. We decode it locally with the Web Audio API, flip the sample buffer end-to-start (per-channel, segment-based, or interleaved), and re-encode as 16-bit PCM WAV."
          icon={<Rewind className="h-8 w-8" />}
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
                  <Badge variant="secondary" className="text-[10px]">{h.mode}</Badge>
                  {h.mode === "segment" && h.segments > 1 && (
                    <Badge variant="outline" className="text-[10px]">{h.segments} segs</Badge>
                  )}
                  <span className="font-mono text-muted-foreground">{formatTime(h.durationMs / 1000)}</span>
                  <span className="text-muted-foreground">· {formatBytes(h.outputSizeBytes)}</span>
                  {h.clickCount > 0 && (
                    <Badge variant="destructive" className="text-[10px]">{h.clickCount} clicks</Badge>
                  )}
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
            <strong className="text-foreground">Privacy:</strong> Audio decoding, reversing
            (full / per-channel / segment / interleaved), and WAV encoding all
            happen locally in your browser via the Web Audio API and a pure-JS
            RIFF encoder. No file is ever uploaded. Reverse metadata is stored
            in localStorage on this device only.
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
