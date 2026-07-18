"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  EmptyState,
  ShareButton,
  ClearButton,
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  BITRATE_PRESETS,
  BITRATE_LABELS,
  FRAMERATE_PRESETS,
  FRAMERATE_LABELS,
  RESOLUTION_LABELS,
  FADE_LABELS,
  FORMAT_LABELS,
  parseTime,
  formatTime,
  formatTimeHMS,
  validateTrim,
  trimmedDuration,
  isFormatEncodable,
  detectEncodableFormats,
  pickDefaultOutputFormat,
  computeResolution,
  fadePresetToMs,
  estimateFileSizeBytes,
  formatBytes,
  generateFilename,
  loadHistory,
  saveHistory,
  clearHistory,
  computeSummaryStats,
  buildShareUrl,
  parseShareUrl,
  type BitratePreset,
  type FrameRatePreset,
  type ResolutionPreset,
  type OutputFormat,
  type FadePreset,
  type HistoryEntry,
} from "./logic";
import {
  Scissors, Upload, Play, History, FileVideo, Clock, HardDrive, Film,
} from "lucide-react";

interface LoadedVideo {
  url: string;
  fileName: string;
  fileSize: number;
  duration: number;
  videoWidth: number;
  videoHeight: number;
}

interface TrimResult {
  blob: Blob;
  url: string;
  filename: string;
  durationSeconds: number;
  sizeBytes: number;
  format: OutputFormat;
}

export default function VideoTrimmer() {
  const [loaded, setLoaded] = useState<LoadedVideo | null>(null);
  const [startText, setStartText] = useState("0");
  const [endText, setEndText] = useState("");
  const [bitrate, setBitrate] = useState<BitratePreset>("medium");
  const [frameRate, setFrameRate] = useState<FrameRatePreset>("30");
  const [resolution, setResolution] = useState<ResolutionPreset>("original");
  const [fadeIn, setFadeIn] = useState<FadePreset>("0ms");
  const [fadeOut, setFadeOut] = useState<FadePreset>("0ms");
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("webm");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<TrimResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Detect encodable formats once on mount.
  useEffect(() => {
    const encodable = detectEncodableFormats();
    if (encodable.length > 0) {
      setOutputFormat(pickDefaultOutputFormat(encodable));
    }
  }, []);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.start) setStartText(p.start);
      if (p.end) setEndText(p.end);
      if (p.bitrate) setBitrate(p.bitrate);
      if (p.frameRate) setFrameRate(p.frameRate);
      if (p.resolution) setResolution(p.resolution);
      if (p.fadeIn) setFadeIn(p.fadeIn);
      if (p.fadeOut) setFadeOut(p.fadeOut);
      if (p.format) setOutputFormat(p.format);
      if (p.start || p.end || p.bitrate || p.frameRate || p.resolution || p.fadeIn || p.fadeOut || p.format) {
        toast.info("Loaded settings from share link");
      }
    }
    return () => {
      if (result) URL.revokeObjectURL(result.url);
      if (loaded) URL.revokeObjectURL(loaded.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setLoadError(null);
    setResult(null);
    if (!file.type.startsWith("video/") && !/\.(mp4|webm|mov|avi|mkv|m4v|ogv)$/i.test(file.name)) {
      setLoadError("Please select a video file (mp4, webm, mov, avi, mkv, m4v, ogv).");
      return;
    }
    try {
      setBusy(true);
      const url = URL.createObjectURL(file);
      // Wait for metadata
      const meta = await new Promise<{ duration: number; videoWidth: number; videoHeight: number }>((resolve, reject) => {
        const v = document.createElement("video");
        v.preload = "metadata";
        v.src = url;
        v.onloadedmetadata = () => {
          resolve({
            duration: v.duration,
            videoWidth: v.videoWidth,
            videoHeight: v.videoHeight,
          });
        };
        v.onerror = () => reject(new Error("Could not load video metadata"));
      });
      // Revoke previous loaded URL
      setLoaded((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return null;
      });
      setLoaded({
        url,
        fileName: file.name,
        fileSize: file.size,
        duration: meta.duration,
        videoWidth: meta.videoWidth,
        videoHeight: meta.videoHeight,
      });
      setStartText("0");
      setEndText(formatTime(meta.duration));
      toast.success(`Loaded ${file.name} (${formatTime(meta.duration)})`);
    } catch (e) {
      setLoadError(`Could not load video: ${(e as Error).message}. The format may not be supported by your browser.`);
    } finally {
      setBusy(false);
    }
  }, []);

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

  const totalDuration = loaded?.duration ?? 0;
  const startSec = parseTime(startText);
  const endSec = parseTime(endText);
  const validRange = loaded
    ? validateTrim(startSec, endSec, totalDuration)
    : { ok: false, error: "Load a video file first" };

  const trimSecs = trimmedDuration(
    Number.isFinite(startSec) ? startSec : 0,
    Number.isFinite(endSec) ? endSec : 0,
  );

  const targetResolution = useMemo(() => {
    if (!loaded) return { width: 0, height: 0 };
    return computeResolution(resolution, loaded.videoWidth, loaded.videoHeight);
  }, [loaded, resolution]);

  const estimatedSize = useMemo(() => {
    return estimateFileSizeBytes(BITRATE_PRESETS[bitrate], trimSecs);
  }, [bitrate, trimSecs]);

  const encodableFormats = useMemo(() => detectEncodableFormats(), []);

  const handleTrim = useCallback(async () => {
    if (!loaded) return;
    setError(null);
    if (!validRange.ok) {
      setError(validRange.error ?? "Invalid trim range");
      return;
    }
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      setError("Video or canvas element not ready.");
      return;
    }
    if (!isFormatEncodable(outputFormat)) {
      setError(`Your browser cannot encode ${outputFormat.toUpperCase()} via MediaRecorder. Try the other format.`);
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      // Set canvas to target resolution
      canvas.width = targetResolution.width;
      canvas.height = targetResolution.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get 2D canvas context");

      // Set up video element
      video.src = loaded.url;
      video.muted = false;
      video.volume = 0; // Mute playback output but keep audio track in stream
      video.playbackRate = 1;

      // Seek to start time
      await seekTo(video, startSec);

      // Capture canvas stream at target frame rate
      const fps = FRAMERATE_PRESETS[frameRate];
      const canvasStream = canvas.captureStream(fps);

      // Capture audio from video element via Web Audio API
      const AudioCtx: typeof AudioContext =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      const sourceNode = audioCtx.createMediaElementSource(video);
      const destNode = audioCtx.createMediaStreamDestination();
      sourceNode.connect(destNode);
      // Also connect to actual audio output so user can monitor (optional)
      // sourceNode.connect(audioCtx.destination); // commented to avoid double audio

      // Combine: canvas video tracks + audio tracks
      const combined = new MediaStream();
      for (const t of canvasStream.getVideoTracks()) combined.addTrack(t);
      for (const t of destNode.stream.getAudioTracks()) combined.addTrack(t);

      // Pick a supported MIME
      const candidateMimes = [
        `video/${outputFormat === "webm" ? "webm" : "mp4"};codecs=${outputFormat === "webm" ? "vp9,opus" : "h264,aac"}`,
        outputFormat === "webm" ? "video/webm;codecs=vp8,opus" : "video/mp4",
        outputFormat === "webm" ? "video/webm" : "video/mp4",
      ];
      let chosenMime = candidateMimes[0];
      for (const m of candidateMimes) {
        try {
          if (MediaRecorder.isTypeSupported(m)) {
            chosenMime = m;
            break;
          }
        } catch {
          // continue
        }
      }

      const recorder = new MediaRecorder(combined, {
        mimeType: chosenMime,
        videoBitsPerSecond: BITRATE_PRESETS[bitrate],
        audioBitsPerSecond: 128_000,
      });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      const fadeInMs = fadePresetToMs(fadeIn);
      const fadeOutMs = fadePresetToMs(fadeOut);
      const totalTrim = endSec - startSec;

      const finished = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: chosenMime });
          resolve(blob);
        };
      });

      recorder.start(100); // collect chunks every 100ms
      await video.play();

      // Animation loop drawing frames + applying fade gain
      let rafId = 0;
      const startTime = performance.now();
      const drawFrame = () => {
        const elapsed = (performance.now() - startTime) / 1000;
        const t = Math.min(elapsed, totalTrim);
        // Draw video frame to canvas
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        } catch {
          // ignore draw errors mid-loop
        }
        // Apply fade by overlaying a black rect with computed opacity
        const gain = fadeGainAtLocal(t, totalTrim, fadeInMs, fadeOutMs);
        if (gain < 1) {
          ctx.save();
          ctx.fillStyle = `rgba(0,0,0,${1 - gain})`;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.restore();
        }
        // Update progress
        setProgress(Math.min(100, (t / totalTrim) * 100));
        // Stop condition
        if (video.currentTime >= endSec - 0.05 || video.ended) {
          cancelAnimationFrame(rafId);
          video.pause();
          // Allow last frame to flush
          setTimeout(() => {
            if (recorder.state !== "inactive") recorder.stop();
          }, 80);
          return;
        }
        rafId = requestAnimationFrame(drawFrame);
      };
      rafId = requestAnimationFrame(drawFrame);

      const blob = await finished;
      // Clean up audio context
      try {
        await audioCtx.close();
      } catch {
        // ignore
      }

      const url = URL.createObjectURL(blob);
      const filename = generateFilename(loaded.fileName, outputFormat);
      const trimResult: TrimResult = {
        blob,
        url,
        filename,
        durationSeconds: totalTrim,
        sizeBytes: blob.size,
        format: outputFormat,
      };
      setResult((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return trimResult;
      });
      const entry: HistoryEntry = {
        ts: Date.now(),
        originalName: loaded.fileName,
        originalDurationMs: Math.round(totalDuration * 1000),
        trimmedDurationMs: Math.round(totalTrim * 1000),
        outputSizeBytes: blob.size,
        startSeconds: startSec,
        endSeconds: endSec,
        bitrate: BITRATE_PRESETS[bitrate],
        frameRate: fps,
        resolution: `${canvas.width}x${canvas.height}`,
        format: outputFormat,
      };
      saveHistory(entry);
      setHistory(loadHistory());
      setProgress(100);
      toast.success(`Trimmed to ${formatTime(totalTrim)} (${formatBytes(blob.size)})`);
    } catch (e) {
      setError(`Trim failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [
    loaded, validRange, startSec, endSec, targetResolution, bitrate, frameRate,
    outputFormat, fadeIn, fadeOut, totalDuration,
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
    if (loaded) URL.revokeObjectURL(loaded.url);
    setResult(null);
    setLoaded(null);
    setStartText("0");
    setEndText("");
    setError(null);
    setLoadError(null);
    setProgress(0);
    toast.info("Cleared");
  }, [result, loaded]);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const stats = useMemo(() => {
    if (!result || !loaded) return null;
    return computeSummaryStats(
      totalDuration,
      result.durationSeconds,
      result.sizeBytes,
    );
  }, [result, loaded, totalDuration]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs">Video file</Label>
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
              {loaded ? loaded.fileName : "Drop a video file or click to browse"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {loaded
                ? `${formatBytes(loaded.fileSize)} · ${formatTime(loaded.duration)} · ${loaded.videoWidth}×${loaded.videoHeight}`
                : "Supports mp4, webm, mov, avi, mkv, m4v, ogv"}
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,.mp4,.webm,.mov,.avi,.mkv,.m4v,.ogv"
            onChange={onFileInput}
            className="hidden"
          />
          {loadError && <ErrorBanner message={loadError} />}
        </CardContent>
      </Card>

      {/* Hidden working video + canvas */}
      <video
        ref={videoRef}
        playsInline
        className="hidden"
        crossOrigin="anonymous"
      />
      <canvas ref={canvasRef} className="hidden" />

      {loaded && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <FileVideo className="h-4 w-4" /> Original preview
            </h3>
            <video src={loaded.url} controls className="w-full rounded" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Total duration" value={formatTime(totalDuration)} />
              <Stat label="HMS" value={formatTimeHMS(totalDuration)} />
              <Stat label="Source resolution" value={`${loaded.videoWidth}×${loaded.videoHeight}`} />
              <Stat label="File size" value={formatBytes(loaded.fileSize)} />
            </div>
          </CardContent>
        </Card>
      )}

      {loaded && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Scissors className="h-4 w-4" /> Trim range & encoding
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="vt-start" className="text-xs">Start time</Label>
                <Input
                  id="vt-start"
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
                <Label htmlFor="vt-end" className="text-xs">End time</Label>
                <Input
                  id="vt-end"
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="vt-bitrate" className="text-xs">Bitrate</Label>
                <select
                  id="vt-bitrate"
                  value={bitrate}
                  onChange={(e) => setBitrate(e.target.value as BitratePreset)}
                  className="h-9 w-full text-xs rounded border bg-background px-2"
                >
                  {(Object.keys(BITRATE_LABELS) as BitratePreset[]).map((b) => (
                    <option key={b} value={b}>{BITRATE_LABELS[b]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vt-fps" className="text-xs">Frame rate</Label>
                <select
                  id="vt-fps"
                  value={frameRate}
                  onChange={(e) => setFrameRate(e.target.value as FrameRatePreset)}
                  className="h-9 w-full text-xs rounded border bg-background px-2"
                >
                  {(Object.keys(FRAMERATE_LABELS) as FrameRatePreset[]).map((f) => (
                    <option key={f} value={f}>{FRAMERATE_LABELS[f]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vt-res" className="text-xs">Resolution</Label>
                <select
                  id="vt-res"
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value as ResolutionPreset)}
                  className="h-9 w-full text-xs rounded border bg-background px-2"
                >
                  {(Object.keys(RESOLUTION_LABELS) as ResolutionPreset[]).map((r) => (
                    <option key={r} value={r}>{RESOLUTION_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vt-fadein" className="text-xs">Fade in</Label>
                <select
                  id="vt-fadein"
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
                <Label htmlFor="vt-fadeout" className="text-xs">Fade out</Label>
                <select
                  id="vt-fadeout"
                  value={fadeOut}
                  onChange={(e) => setFadeOut(e.target.value as FadePreset)}
                  className="h-9 w-full text-xs rounded border bg-background px-2"
                >
                  {(Object.keys(FADE_LABELS) as FadePreset[]).map((f) => (
                    <option key={f} value={f}>{FADE_LABELS[f]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vt-format" className="text-xs">Output format</Label>
                <select
                  id="vt-format"
                  value={outputFormat}
                  onChange={(e) => setOutputFormat(e.target.value as OutputFormat)}
                  className="h-9 w-full text-xs rounded border bg-background px-2"
                >
                  {(Object.keys(FORMAT_LABELS) as OutputFormat[]).map((f) => (
                    <option key={f} value={f} disabled={!isFormatEncodable(f)}>
                      {FORMAT_LABELS[f]}{isFormatEncodable(f) ? "" : " (unsupported)"}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {encodableFormats.length === 0 && (
              <ErrorBanner message="MediaRecorder is not available in this browser. Trimming won't work." />
            )}
            {error && <ErrorBanner message={error} />}
            {busy && (
              <div className="space-y-1">
                <div className="h-2 w-full rounded bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Recording… {progress.toFixed(0)}%
                </p>
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={handleTrim} disabled={busy || !validRange.ok} className="gap-1.5">
                <Scissors className="h-3.5 w-3.5" /> {busy ? "Trimming…" : "Trim video"}
              </Button>
              <ShareButton getUrl={() => buildShareUrl({
                start: startText,
                end: endText,
                bitrate,
                frameRate,
                resolution,
                fadeIn,
                fadeOut,
                format: outputFormat,
              })} />
              <ClearButton onClick={handleReset} />
            </div>
          </CardContent>
        </Card>
      )}

      {loaded && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> Trim preview stats
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Trimmed duration" value={formatTime(trimSecs)} />
              <Stat label="Output size (est.)" value={formatBytes(estimatedSize)} />
              <Stat label="Target resolution" value={`${targetResolution.width}×${targetResolution.height}`} />
              <Stat label="Target frame rate" value={`${FRAMERATE_PRESETS[frameRate]} fps`} />
            </div>
            {totalDuration > 0 && (
              <div className="text-[10px] text-muted-foreground">
                Will keep {((trimSecs / totalDuration) * 100).toFixed(1)}% of original video.
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
            <video src={result.url} controls className="w-full rounded" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Duration" value={formatTime(result.durationSeconds)} />
              <Stat label="File size" value={formatBytes(result.sizeBytes)} />
              <Stat label="Format" value={result.format.toUpperCase()} />
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
                <HardDrive className="h-3.5 w-3.5" /> Download {result.format.toUpperCase()}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!loaded && !loadError && (
        <EmptyState
          title="Drop a video file to start trimming"
          hint="Drag and drop or click to browse. We load it into a hidden <video>, capture frames to a <canvas>, and re-encode the trimmed range via MediaRecorder as WebM (or MP4 where supported). All processing is local."
          icon={<Film className="h-8 w-8" />}
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
                  <Badge variant="outline" className="text-[10px]">{h.format.toUpperCase()}</Badge>
                  <span className="font-mono text-muted-foreground">
                    {formatTime(h.startSeconds)} → {formatTime(h.endSeconds)}
                  </span>
                  <span className="text-muted-foreground">· {formatTime(h.trimmedDurationMs / 1000)}</span>
                  <span className="text-muted-foreground">· {formatBytes(h.outputSizeBytes)}</span>
                  <span className="text-muted-foreground">· {h.resolution}</span>
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
            <strong className="text-foreground">Privacy:</strong> Video loading,
            frame capture, and re-encoding all happen locally in your browser via
            the HTML5 <code>&lt;video&gt;</code> element, <code>&lt;canvas&gt;</code>,
            and <code>MediaRecorder</code> API. No file is ever uploaded. History
            metadata is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/** Seek a video element to a given time, returning a promise. */
function seekTo(video: HTMLVideoElement, timeSeconds: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    video.addEventListener("seeked", onSeeked);
    video.currentTime = Math.max(0, timeSeconds);
    // Fallback timeout in case 'seeked' never fires
    setTimeout(() => {
      video.removeEventListener("seeked", onSeeked);
      reject(new Error("Seek timed out"));
    }, 5000);
  });
}

/**
 * Compute fade gain (0..1) at time t (seconds) within a clip of given
 * total duration. Linear fade in for fadeInMs, linear fade out for fadeOutMs.
 * Pure function mirrored from logic.ts (kept here to avoid importing
 * fadeGainAt — that helper is tested in logic.test.ts).
 */
function fadeGainAtLocal(
  t: number,
  totalDuration: number,
  fadeInMs: number,
  fadeOutMs: number,
): number {
  if (totalDuration <= 0) return 1;
  const tt = Math.max(0, Math.min(t, totalDuration));
  if (fadeInMs > 0 && tt * 1000 < fadeInMs) {
    return (tt * 1000) / fadeInMs;
  }
  const remainingMs = (totalDuration - tt) * 1000;
  if (fadeOutMs > 0 && remainingMs < fadeOutMs) {
    return Math.max(0, remainingMs / fadeOutMs);
  }
  return 1;
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
