"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  BITRATE_PRESETS,
  BITRATE_LABELS,
  DURATION_PRESETS,
  DURATION_LABELS,
  FORMAT_EXTENSIONS,
  isFormatSupported,
  detectSupportedFormats,
  pickDefaultFormat,
  formatTime,
  formatBytes,
  estimateFileSizeBytes,
  buildRecorderOptions,
  generateFilename,
  isMaxDurationReached,
  describeRecorderError,
  loadHistory,
  saveHistory,
  clearHistory,
  computeSummaryStats,
  buildShareUrl,
  parseShareUrl,
  type AudioFormat,
  type BitratePreset,
  type DurationPreset,
  type HistoryEntry,
} from "./logic";
import { Mic, Square, Pause, Play, History, Clock, HardDrive, Activity } from "lucide-react";

type RecorderStatus = "idle" | "recording" | "paused" | "stopped";

interface RecordingResult {
  blob: Blob;
  url: string;
  filename: string;
  durationMs: number;
  format: AudioFormat;
  bitrate: number;
  sizeBytes: number;
}

export default function AudioRecorder() {
  const supportedFormats = useMemo<AudioFormat[]>(() => detectSupportedFormats(), []);
  const [format, setFormat] = useState<AudioFormat>(() => pickDefaultFormat(supportedFormats));
  const [bitrate, setBitrate] = useState<BitratePreset>("medium");
  const [duration, setDuration] = useState<DurationPreset>("unlimited");
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [result, setResult] = useState<RecordingResult | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const accumulatedMsRef = useRef<number>(0);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.format && isFormatSupported(p.format)) setFormat(p.format);
      if (p.bitrate) setBitrate(p.bitrate);
      if (p.duration) setDuration(p.duration);
      if (p.format || p.bitrate || p.duration) toast.info("Loaded settings from share link");
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (autoStopTimeoutRef.current) clearTimeout(autoStopTimeoutRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const maxMs = DURATION_PRESETS[duration];
  const bitrateValue = BITRATE_PRESETS[bitrate];
  const estimatedSize = estimateFileSizeBytes(bitrateValue, maxMs > 0 ? maxMs : 60_000);
  const stats = useMemo(() => computeSummaryStats(history), [history]);

  const updateTimer = useCallback(() => {
    const now = Date.now();
    setElapsedMs(accumulatedMsRef.current + (now - startTimeRef.current));
  }, []);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const finalizeRecording = useCallback(
    (finalMs: number) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder) return;
      const chunks = chunksRef.current;
      if (chunks.length === 0) {
        setError("No audio data captured. Please try again.");
        setStatus("idle");
        stopStream();
        return;
      }
      const mimeType = recorder.mimeType || `audio/${format}`;
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const filename = generateFilename(format);
      const recording: RecordingResult = {
        blob,
        url,
        filename,
        durationMs: finalMs,
        format,
        bitrate: bitrateValue,
        sizeBytes: blob.size,
      };
      setResult(recording);
      // Save to history
      const entry: HistoryEntry = {
        ts: Date.now(),
        durationMs: finalMs,
        format,
        sizeBytes: blob.size,
        bitrate: bitrateValue,
        filename,
      };
      saveHistory(entry);
      setHistory(loadHistory());
      setStatus("stopped");
      stopStream();
      toast.success(`Recording saved (${formatBytes(blob.size)})`);
    },
    [format, bitrateValue, stopStream],
  );

  const handleStart = useCallback(async () => {
    setError(null);
    setResult(null);
    if (!isFormatSupported(format)) {
      setError(`Your browser does not support recording in ${format} format. Try a different format.`);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Your browser does not support microphone capture (MediaDevices API unavailable).");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      chunksRef.current = [];
      accumulatedMsRef.current = 0;

      const opts = buildRecorderOptions(format, bitrateValue);
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(stream, opts);
      } catch {
        // Fallback: no options
        recorder = new MediaRecorder(stream);
      }
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      recorder.onerror = () => {
        setError(describeRecorderError("UnknownError"));
        setStatus("idle");
        stopStream();
      };
      recorder.onstop = () => {
        const finalMs = elapsedMsRef.current();
        finalizeRecording(finalMs);
      };

      recorder.start(250); // collect chunks every 250ms
      startTimeRef.current = Date.now();
      setElapsedMs(0);
      setStatus("recording");

      timerIntervalRef.current = setInterval(updateTimer, 50);

      if (maxMs > 0) {
        autoStopTimeoutRef.current = setTimeout(() => {
          if (mediaRecorderRef.current?.state === "recording") {
            toast.info("Max duration reached — auto-stopping");
            handleStop();
          }
        }, maxMs);
      }
    } catch (e) {
      const err = e as DOMException;
      setError(describeRecorderError(err.name));
      setStatus("idle");
      stopStream();
    }
  }, [format, bitrateValue, maxMs, updateTimer, finalizeRecording, stopStream]);

  // elapsedMsRef reads current elapsed without causing re-render
  const elapsedMsRef = useRef<() => number>(() => 0);
  useEffect(() => {
    elapsedMsRef.current = () => {
      if (status === "recording") {
        return accumulatedMsRef.current + (Date.now() - startTimeRef.current);
      }
      return accumulatedMsRef.current;
    };
  }, [status]);

  const handlePause = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    recorder.pause();
    accumulatedMsRef.current += Date.now() - startTimeRef.current;
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = null;
    setStatus("paused");
    setElapsedMs(accumulatedMsRef.current);
  }, []);

  const handleResume = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "paused") return;
    recorder.resume();
    startTimeRef.current = Date.now();
    setStatus("recording");
    timerIntervalRef.current = setInterval(updateTimer, 50);
  }, [updateTimer]);

  const handleStop = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (autoStopTimeoutRef.current) {
      clearTimeout(autoStopTimeoutRef.current);
      autoStopTimeoutRef.current = null;
    }
    if (status === "recording") {
      accumulatedMsRef.current += Date.now() - startTimeRef.current;
    }
    setElapsedMs(accumulatedMsRef.current);

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        // ignore
      }
    } else {
      // Nothing to stop
      setStatus("idle");
      stopStream();
    }
  }, [status, stopStream]);

  const handleReset = useCallback(() => {
    if (result) {
      URL.revokeObjectURL(result.url);
    }
    setResult(null);
    setError(null);
    setStatus("idle");
    setElapsedMs(0);
    accumulatedMsRef.current = 0;
    toast.info("Reset");
  }, [result]);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

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

  const maxReached = isMaxDurationReached(elapsedMs, maxMs);
  const canStart = status === "idle" || status === "stopped";

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ar-format" className="text-xs">Format</Label>
              <select
                id="ar-format"
                value={format}
                onChange={(e) => setFormat(e.target.value as AudioFormat)}
                disabled={status === "recording" || status === "paused"}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {(["webm", "ogg", "mp3"] as AudioFormat[]).map((f) => (
                  <option key={f} value={f} disabled={!isFormatSupported(f)}>
                    {f.toUpperCase()}{!isFormatSupported(f) ? " (unsupported)" : ""}
                  </option>
                ))}
              </select>
              {supportedFormats.length === 0 && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400">
                  MediaRecorder not detected — recording may not work in this browser.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ar-bitrate" className="text-xs">Bitrate</Label>
              <select
                id="ar-bitrate"
                value={bitrate}
                onChange={(e) => setBitrate(e.target.value as BitratePreset)}
                disabled={status === "recording" || status === "paused"}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(BITRATE_LABELS) as BitratePreset[]).map((b) => (
                  <option key={b} value={b}>{BITRATE_LABELS[b]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ar-duration" className="text-xs">Max duration</Label>
              <select
                id="ar-duration"
                value={duration}
                onChange={(e) => setDuration(e.target.value as DurationPreset)}
                disabled={status === "recording" || status === "paused"}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(DURATION_LABELS) as DurationPreset[]).map((d) => (
                  <option key={d} value={d}>{DURATION_LABELS[d]}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col items-center gap-3 py-4">
            <div className={`flex items-center justify-center w-24 h-24 rounded-full border-4 transition-colors ${
              status === "recording"
                ? "border-red-500 bg-red-500/10 animate-pulse"
                : status === "paused"
                  ? "border-amber-500 bg-amber-500/10"
                  : "border-border bg-muted"
            }`}>
              <Mic className={`h-10 w-10 ${
                status === "recording"
                  ? "text-red-500"
                  : status === "paused"
                    ? "text-amber-500"
                    : "text-muted-foreground"
              }`} />
            </div>
            <div className="font-mono text-3xl font-semibold tracking-tight text-foreground tabular-nums">
              {formatTime(elapsedMs)}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant={status === "recording" ? "destructive" : status === "paused" ? "secondary" : "outline"}>
                {status === "idle" ? "Ready" : status === "recording" ? "Recording" : status === "paused" ? "Paused" : "Stopped"}
              </Badge>
              {maxMs > 0 && (
                <Badge variant="outline">Limit: {formatTime(maxMs)}</Badge>
              )}
              {maxReached && status === "recording" && (
                <Badge variant="destructive">Max reached</Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              {canStart ? (
                <Button onClick={handleStart} className="gap-1.5">
                  <Mic className="h-4 w-4" /> Start recording
                </Button>
              ) : null}
              {status === "recording" && (
                <>
                  <Button onClick={handlePause} variant="outline" className="gap-1.5">
                    <Pause className="h-4 w-4" /> Pause
                  </Button>
                  <Button onClick={handleStop} variant="destructive" className="gap-1.5">
                    <Square className="h-4 w-4" /> Stop
                  </Button>
                </>
              )}
              {status === "paused" && (
                <>
                  <Button onClick={handleResume} variant="outline" className="gap-1.5">
                    <Play className="h-4 w-4" /> Resume
                  </Button>
                  <Button onClick={handleStop} variant="destructive" className="gap-1.5">
                    <Square className="h-4 w-4" /> Stop
                  </Button>
                </>
              )}
              {result && (
                <ClearButton onClick={handleReset} label="Reset" />
              )}
            </div>
          </div>
          {error && <ErrorBanner message={error} />}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Activity className="h-4 w-4" /> Recording stats
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Stat icon={<Clock className="h-3 w-3" />} label="Elapsed" value={formatTime(elapsedMs)} />
            <Stat icon={<HardDrive className="h-3 w-3" />} label="Est. size (1 min)"
              value={formatBytes(estimateFileSizeBytes(bitrateValue, 60_000))} />
            <Stat icon={<Activity className="h-3 w-3" />} label="Bitrate" value={`${(bitrateValue / 1000).toFixed(0)} kbps`} />
            <Stat icon={<Activity className="h-3 w-3" />} label="Format" value={format.toUpperCase()} />
          </div>
        </CardContent>
      </Card>

      {result ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Preview &amp; download</h3>
            <audio src={result.url} controls className="w-full" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Duration" value={formatTime(result.durationMs)} />
              <Stat label="File size" value={formatBytes(result.sizeBytes)} />
              <Stat label="Format" value={result.format.toUpperCase()} />
              <Stat label="Filename" value={result.filename} />
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={handleDownload} className="gap-1.5">
                <HardDrive className="h-3.5 w-3.5" /> Download recording
              </Button>
              <CopyButton
                getText={() => result.filename}
                label="Copy filename"
              />
              <ShareButton getUrl={() => buildShareUrl({ format, bitrate, duration })} />
            </div>
          </CardContent>
        </Card>
      ) : status === "idle" && !error ? (
        <EmptyState
          title="Ready to record"
          hint="Select a format, bitrate, and optional max duration, then click Start. Your browser will request microphone permission."
          icon={<Mic className="h-8 w-8" />}
        />
      ) : null}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> History ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Total recordings" value={stats.totalRecordings} />
              <Stat label="Total duration" value={formatTime(stats.totalDurationMs)} />
              <Stat label="Total size" value={formatBytes(stats.totalSizeBytes)} />
              <Stat label="WebM / OGG / MP3"
                value={`${stats.byFormat.webm} / ${stats.byFormat.ogg} / ${stats.byFormat.mp3}`} />
            </div>
            <div className="space-y-1 max-h-[300px] overflow-auto">
              {history.slice(0, 10).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{h.format.toUpperCase()}</Badge>
                  <span className="font-mono text-muted-foreground">{formatTime(h.durationMs)}</span>
                  <span className="text-muted-foreground">· {formatBytes(h.sizeBytes)}</span>
                  <span className="text-muted-foreground">· {(h.bitrate / 1000).toFixed(0)} kbps</span>
                  <span className="text-muted-foreground ml-auto truncate max-w-[180px]">{h.filename}</span>
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
            <strong className="text-foreground">Privacy:</strong> Microphone audio is captured
            and encoded entirely in your browser via the MediaRecorder API. Nothing is uploaded.
            History metadata is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
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
