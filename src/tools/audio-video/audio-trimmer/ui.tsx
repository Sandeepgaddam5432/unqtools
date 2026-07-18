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
  FADE_LABELS,
  parseTime,
  formatTime,
  formatTimeHMS,
  computeSampleRange,
  trimmedSampleCount,
  trimmedDurationSeconds,
  estimateWavSizeBytes,
  formatBytes,
  validateTrim,
  generateFilename,
  loadHistory,
  saveHistory,
  clearHistory,
  computeSummaryStats,
  buildShareUrl,
  parseShareUrl,
  encodeWav,
  fadePresetToSamples,
  type FadePreset,
  type HistoryEntry,
} from "./logic";
import { Scissors, Upload, Play, History, FileAudio, Clock, HardDrive } from "lucide-react";

interface DecodedAudio {
  audioBuffer: AudioBuffer;
  fileName: string;
  fileSize: number;
}

interface TrimResult {
  blob: Blob;
  url: string;
  filename: string;
  durationSeconds: number;
  sizeBytes: number;
  sampleRate: number;
  channels: number;
}

export default function AudioTrimmer() {
  const [decoded, setDecoded] = useState<DecodedAudio | null>(null);
  const [startText, setStartText] = useState("0");
  const [endText, setEndText] = useState("");
  const [fadeIn, setFadeIn] = useState<FadePreset>("100ms");
  const [fadeOut, setFadeOut] = useState<FadePreset>("100ms");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<TrimResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.start) setStartText(p.start);
      if (p.end) setEndText(p.end);
      if (p.fadeIn) setFadeIn(p.fadeIn);
      if (p.fadeOut) setFadeOut(p.fadeOut);
      if (p.start || p.end || p.fadeIn || p.fadeOut) {
        toast.info("Loaded settings from share link");
      }
    }
    return () => {
      if (result) URL.revokeObjectURL(result.url);
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Get or create an AudioContext (lazy)
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
      setDecoded({
        audioBuffer,
        fileName: file.name,
        fileSize: file.size,
      });
      // Default end time = total duration
      const totalSec = audioBuffer.duration;
      setStartText("0");
      setEndText(formatTime(totalSec));
      toast.success(`Loaded ${file.name} (${formatTime(totalSec)})`);
    } catch (e) {
      setDecodeError(`Could not decode audio file: ${(e as Error).message}. The format may not be supported by your browser.`);
    } finally {
      setBusy(false);
    }
  }, [getAudioContext]);

  const onFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input value so the same file can be picked again
    if (e.target) e.target.value = "";
  }, [handleFile]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const totalDuration = decoded?.audioBuffer.duration ?? 0;
  const startSec = parseTime(startText);
  const endSec = parseTime(endText);
  const validRange = decoded
    ? validateTrim(startSec, endSec, totalDuration)
    : { ok: false, error: "Load an audio file first" };

  const sampleRate = decoded?.audioBuffer.sampleRate ?? 44100;
  const channels = decoded?.audioBuffer.numberOfChannels ?? 1;
  const totalSamples = decoded?.audioBuffer.length ?? 0;

  const range = useMemo(
    () => decoded
      ? computeSampleRange(startSec, endSec, sampleRate, totalSamples)
      : null,
    [decoded, startSec, endSec, sampleRate, totalSamples],
  );

  const trimmedSamples = range ? trimmedSampleCount(range) : 0;
  const trimmedDuration = range ? trimmedDurationSeconds(range, sampleRate) : 0;
  const estimatedSize = estimateWavSizeBytes(trimmedSamples, channels);

  const fadeInSamples = fadePresetToSamples(fadeIn, sampleRate);
  const fadeOutSamples = fadePresetToSamples(fadeOut, sampleRate);

  const handleTrim = useCallback(async () => {
    if (!decoded || !range) return;
    setError(null);
    if (!validRange.ok) {
      setError(validRange.error ?? "Invalid trim range");
      return;
    }
    setBusy(true);
    try {
      // Extract samples per channel between start and end
      const channelData: Float32Array[] = [];
      for (let c = 0; c < decoded.audioBuffer.numberOfChannels; c++) {
        const src = decoded.audioBuffer.getChannelData(c);
        const slice = src.subarray(range.startSample, range.endSample);
        channelData.push(slice);
      }
      // Encode WAV (applies fade in/out internally on copies)
      const wav = encodeWav(channelData, sampleRate, fadeInSamples, fadeOutSamples);
      const blob = new Blob([wav.buffer as ArrayBuffer], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      const filename = generateFilename();
      const trimResult: TrimResult = {
        blob,
        url,
        filename,
        durationSeconds: trimmedDuration,
        sizeBytes: blob.size,
        sampleRate,
        channels,
      };
      // Revoke previous result URL
      setResult((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return trimResult;
      });
      // Save history
      const entry: HistoryEntry = {
        ts: Date.now(),
        originalName: decoded.fileName,
        originalDurationMs: Math.round(totalDuration * 1000),
        trimmedDurationMs: Math.round(trimmedDuration * 1000),
        outputSizeBytes: blob.size,
        startSeconds: startSec,
        endSeconds: endSec,
        sampleRate,
        channels,
      };
      saveHistory(entry);
      setHistory(loadHistory());
      toast.success(`Trimmed to ${formatTime(trimmedDuration)} (${formatBytes(blob.size)})`);
    } catch (e) {
      setError(`Trim failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [
    decoded, range, validRange, fadeInSamples, fadeOutSamples,
    sampleRate, channels, trimmedDuration, totalDuration, startSec, endSec,
  ]);

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
    setStartText("0");
    setEndText("");
    setError(null);
    setDecodeError(null);
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
      result.durationSeconds,
      result.sizeBytes,
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
              <Stat label="HMS" value={formatTimeHMS(totalDuration)} />
              <Stat label="Sample rate" value={`${sampleRate} Hz`} />
              <Stat label="Channels" value={channels} />
            </div>
          </CardContent>
        </Card>
      )}

      {decoded && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Scissors className="h-4 w-4" /> Trim range
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="at-start" className="text-xs">Start time</Label>
                <Input
                  id="at-start"
                  value={startText}
                  onChange={(e) => setStartText(e.target.value)}
                  placeholder="e.g. 01:30.250 or 90.25 or 1:02:03"
                  className="font-mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground">
                  Parsed: {Number.isFinite(startSec) ? `${startSec.toFixed(3)}s` : "invalid"}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="at-end" className="text-xs">End time</Label>
                <Input
                  id="at-end"
                  value={endText}
                  onChange={(e) => setEndText(e.target.value)}
                  placeholder={`e.g. ${formatTime(totalDuration)}`}
                  className="font-mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground">
                  Parsed: {Number.isFinite(endSec) ? `${endSec.toFixed(3)}s` : "invalid"}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="at-fadein" className="text-xs">Fade in</Label>
                <select
                  id="at-fadein"
                  value={fadeIn}
                  onChange={(e) => setFadeIn(e.target.value as FadePreset)}
                  className="h-9 w-full text-xs rounded border bg-background px-2"
                >
                  {(Object.keys(FADE_LABELS) as FadePreset[]).map((f) => (
                    <option key={f} value={f}>{FADE_LABELS[f]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="at-fadeout" className="text-xs">Fade out</Label>
                <select
                  id="at-fadeout"
                  value={fadeOut}
                  onChange={(e) => setFadeOut(e.target.value as FadePreset)}
                  className="h-9 w-full text-xs rounded border bg-background px-2"
                >
                  {(Object.keys(FADE_LABELS) as FadePreset[]).map((f) => (
                    <option key={f} value={f}>{FADE_LABELS[f]}</option>
                  ))}
                </select>
              </div>
            </div>
            {error && <ErrorBanner message={error} />}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={handleTrim} disabled={busy || !validRange.ok} className="gap-1.5">
                <Scissors className="h-3.5 w-3.5" /> {busy ? "Trimming…" : "Trim audio"}
              </Button>
              <ShareButton getUrl={() => buildShareUrl({
                start: startText,
                end: endText,
                fadeIn,
                fadeOut,
              })} />
              <ClearButton onClick={handleReset} />
            </div>
          </CardContent>
        </Card>
      )}

      {decoded && range && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> Trim preview stats
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Trimmed duration" value={formatTime(trimmedDuration)} />
              <Stat label="Output size (est.)" value={formatBytes(estimatedSize)} />
              <Stat label="Sample range" value={`${range.startSample}–${range.endSample}`} />
              <Stat label="Trimmed samples" value={trimmedSamples} />
            </div>
            {totalDuration > 0 && (
              <div className="text-[10px] text-muted-foreground">
                Will keep {((trimmedDuration / totalDuration) * 100).toFixed(1)}% of original audio.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Play className="h-4 w-4" /> Trimmed output
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
                  <Badge variant="outline">Trimmed: {formatTime(stats.trimmedDurationSeconds)}</Badge>
                  <Badge variant="secondary">Removed: {formatTime(stats.removedSeconds)} ({stats.removedPct.toFixed(1)}%)</Badge>
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
          title="Drop an audio file to start trimming"
          hint="Drag and drop or click to browse. We decode it locally with the Web Audio API, then re-encode the trimmed range as a 16-bit PCM WAV file."
          icon={<Scissors className="h-8 w-8" />}
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
                  <Badge variant="outline" className="text-[10px]">WAV</Badge>
                  <span className="font-mono text-muted-foreground">
                    {formatTime(h.startSeconds)} → {formatTime(h.endSeconds)}
                  </span>
                  <span className="text-muted-foreground">· {formatTime(h.trimmedDurationMs / 1000)}</span>
                  <span className="text-muted-foreground">· {formatBytes(h.outputSizeBytes)}</span>
                  <span className="text-muted-foreground ml-auto truncate max-w-[180px]">{h.originalName}</span>
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
            <strong className="text-foreground">Privacy:</strong> Audio decoding,
            trimming, and WAV encoding all happen locally in your browser via the
            Web Audio API and a pure-JS RIFF encoder. No file is ever uploaded.
            History metadata is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Render the original audio file in a hidden <audio> element. We re-read the
 * File to create an object URL (avoids storing the File in state separately).
 */
function OriginalAudioPreview({ decoded }: { decoded: { audioBuffer: AudioBuffer; fileName: string; fileSize: number } }) {
  // Render the decoded AudioBuffer via an OfflineAudioContext-encoded WAV
  // so the user can preview the original without needing the File object.
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function build() {
      try {
        const { sampleRate, length, numberOfChannels } = decoded.audioBuffer;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decoded]);

  if (!url) {
    return <p className="text-xs text-muted-foreground">Preparing preview…</p>;
  }
  return <audio src={url} controls className="w-full" />;
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {icon}{label}
      </div>
      <div className="text-sm font-semibold text-foreground break-all">{value}</div>
    </div>
  );
}
