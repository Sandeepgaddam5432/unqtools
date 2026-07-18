"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  MODE_LABELS,
  INTERVAL_PRESETS,
  INTERVAL_LABELS,
  FORMAT_MIME,
  FORMAT_LABELS,
  JPEG_QUALITY_VALUES,
  JPEG_QUALITY_LABELS,
  RESOLUTION_SCALE_VALUES,
  RESOLUTION_SCALE_LABELS,
  calculateScaledResolution,
  parseTimestamp,
  parseTimestampList,
  formatTime,
  formatTimeHMS,
  formatBytes,
  computeIntervalTimestamps,
  computeFrameCount,
  generateFrameFilename,
  validateTimestamp,
  validateTimestamps,
  createZipBlob,
  computeSummaryStats,
  renderTextReport,
  renderCsvReport,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ExtractionMode,
  type OutputFormat,
  type IntervalPreset,
  type JpegQualityPreset,
  type ResolutionScale,
  type FrameResult,
  type HistoryEntry,
  type ZipFile,
} from "./logic";
import {
  Film, Upload, History, Camera, HardDrive,
  Package, Image as ImageIcon, Gauge,
} from "lucide-react";

interface VideoInfo {
  fileName: string;
  fileSizeBytes: number;
  durationSeconds: number;
  videoWidth: number;
  videoHeight: number;
  url: string;
}

interface ExtractedFrame {
  index: number;
  timestampSeconds: number;
  filename: string;
  blob: Blob;
  url: string;
  sizeBytes: number;
  mimeType: string;
}

interface ExtractOutput {
  frames: ExtractedFrame[];
  zipBlob: Blob | null;
  zipUrl: string | null;
  zipName: string;
  totalBytes: number;
  width: number;
  height: number;
}

export default function VideoFrameExtractor() {
  const [video, setVideo] = useState<VideoInfo | null>(null);
  const [mode, setMode] = useState<ExtractionMode>("single");
  const [timestamp, setTimestamp] = useState("00:01");
  const [timestamps, setTimestamps] = useState("0:00, 0:05, 0:10");
  const [intervalPreset, setIntervalPreset] = useState<IntervalPreset>("10s");
  const [customInterval, setCustomInterval] = useState("");
  const [format, setFormat] = useState<OutputFormat>("png");
  const [jpegQuality, setJpegQuality] = useState<JpegQualityPreset>("90%");
  const [scale, setScale] = useState<ResolutionScale>("full");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [output, setOutput] = useState<ExtractOutput | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.mode) setMode(p.mode);
      if (p.timestamp) setTimestamp(p.timestamp);
      if (p.timestamps) setTimestamps(p.timestamps);
      if (p.intervalPreset) setIntervalPreset(p.intervalPreset);
      if (p.customInterval) setCustomInterval(p.customInterval);
      if (p.format) setFormat(p.format);
      if (p.jpegQuality) setJpegQuality(p.jpegQuality);
      if (p.scale) setScale(p.scale);
      if (Object.keys(p).length > 0) toast.info("Loaded settings from share link");
    }
    return () => {
      if (video) URL.revokeObjectURL(video.url);
      if (output) {
        output.frames.forEach((f) => URL.revokeObjectURL(f.url));
        if (output.zipUrl) URL.revokeObjectURL(output.zipUrl);
      }
    };
  }, []);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setDecodeError(null);
    setOutput(null);
    if (!file.type.startsWith("video/") && !/\.(mp4|webm|ogg|ogv|mov|avi|mkv|flv|m4v)$/i.test(file.name)) {
      setDecodeError("Please select a video file (mp4, webm, ogg, mov, avi, mkv, flv).");
      return;
    }
    try {
      setBusy(true);
      if (video) URL.revokeObjectURL(video.url);
      const url = URL.createObjectURL(file);

      // Probe metadata via a temporary <video>
      const probe = document.createElement("video");
      probe.preload = "metadata";
      probe.src = url;

      const info = await new Promise<VideoInfo>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Timed out reading video metadata"));
        }, 15_000);
        probe.onloadedmetadata = () => {
          clearTimeout(timeout);
          resolve({
            fileName: file.name,
            fileSizeBytes: file.size,
            durationSeconds: Number.isFinite(probe.duration) ? probe.duration : 0,
            videoWidth: probe.videoWidth || 0,
            videoHeight: probe.videoHeight || 0,
            url,
          });
        };
        probe.onerror = () => {
          clearTimeout(timeout);
          reject(new Error("Could not load video. The format may be unsupported by your browser."));
        };
      });

      setVideo(info);
      toast.success(`Loaded ${info.fileName} (${formatTime(info.durationSeconds)})`);
    } catch (e) {
      setDecodeError(`Could not load video: ${(e as Error).message}`);
      URL.revokeObjectURL(URL.createObjectURL(file));
    } finally {
      setBusy(false);
    }
  }, [video]);

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

  const handleReset = useCallback(() => {
    if (video) URL.revokeObjectURL(video.url);
    if (output) {
      output.frames.forEach((f) => URL.revokeObjectURL(f.url));
      if (output.zipUrl) URL.revokeObjectURL(output.zipUrl);
    }
    setOutput(null);
    setVideo(null);
    setError(null);
    setDecodeError(null);
    toast.info("Cleared");
  }, [video, output]);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  // Compute the effective interval based on preset or custom input
  const effectiveInterval = useMemo(() => {
    if (customInterval.trim()) {
      const n = parseFloat(customInterval);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return INTERVAL_PRESETS[intervalPreset];
  }, [customInterval, intervalPreset]);

  const totalDuration = video?.durationSeconds ?? 0;
  const srcWidth = video?.videoWidth ?? 0;
  const srcHeight = video?.videoHeight ?? 0;
  const outDims = useMemo(
    () => calculateScaledResolution(srcWidth, srcHeight, scale),
    [srcWidth, srcHeight, scale],
  );

  // Preview the timestamps that will be extracted (for stats display)
  const previewTimestamps = useMemo<number[]>(() => {
    if (!video) return [];
    if (mode === "single") {
      const t = parseTimestamp(timestamp);
      return Number.isFinite(t) ? [t] : [];
    }
    if (mode === "sequence") {
      return parseTimestampList(timestamps);
    }
    if (mode === "interval") {
      return computeIntervalTimestamps(totalDuration, effectiveInterval);
    }
    return [];
  }, [video, mode, timestamp, timestamps, effectiveInterval, totalDuration]);

  const previewFrameCount = previewTimestamps.length;

  // ---- Capture helpers ----

  /** Seek a video to a timestamp and resolve when the frame is rendered. */
  const seekTo = useCallback((vid: HTMLVideoElement, t: number): Promise<void> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Timed out seeking to ${formatTime(t)}`)), 10_000);
      const onSeeked = () => {
        clearTimeout(timeout);
        // Use requestVideoFrameCallback if available for accurate frame capture
        type RVfcVideo = HTMLVideoElement & {
          requestVideoFrameCallback?: (cb: (now: number, meta: { presentedFrames: number }) => void) => number;
        };
        const v = vid as RVfcVideo;
        if (typeof v.requestVideoFrameCallback === "function") {
          v.requestVideoFrameCallback(() => resolve());
        } else {
          // Fall back to a microtask delay
          requestAnimationFrame(() => resolve());
        }
      };
      vid.addEventListener("seeked", onSeeked, { once: true });
      vid.currentTime = t;
    });
  }, []);

  /** Draw a video frame to a canvas and export as a Blob. */
  const captureFrame = useCallback(async (
    vid: HTMLVideoElement,
    outWidth: number,
    outHeight: number,
  ): Promise<Blob> => {
    const canvas = document.createElement("canvas");
    canvas.width = outWidth;
    canvas.height = outHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get canvas 2D context");
    ctx.drawImage(vid, 0, 0, outWidth, outHeight);

    const mimeType = FORMAT_MIME[format];
    const quality = format === "jpeg" ? JPEG_QUALITY_VALUES[jpegQuality] : undefined;

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error(`Canvas toBlob failed for ${mimeType}`));
        },
        mimeType,
        quality,
      );
    });
  }, [format, jpegQuality]);

  // ---- Extract handler ----

  const handleExtract = useCallback(async () => {
    if (!video) return;
    setError(null);

    // Determine the list of timestamps
    let tsList: number[] = [];
    if (mode === "single") {
      const t = parseTimestamp(timestamp);
      if (!Number.isFinite(t)) {
        setError("Invalid timestamp. Use formats: 12, 12.5, 01:30, 01:02:03.");
        return;
      }
      const r = validateTimestamp(t, totalDuration);
      if (!r.ok) {
        setError(r.error ?? "Invalid timestamp");
        return;
      }
      tsList = [t];
    } else if (mode === "sequence") {
      const parsed = parseTimestampList(timestamps);
      const r = validateTimestamps(parsed, totalDuration);
      if (!r.ok) {
        setError(r.error ?? "Invalid timestamps");
        return;
      }
      tsList = r.valid;
      if (tsList.length === 0) {
        setError("No valid timestamps provided.");
        return;
      }
    } else if (mode === "interval") {
      tsList = computeIntervalTimestamps(totalDuration, effectiveInterval);
      if (tsList.length === 0) {
        setError("No frames would be extracted. Try a shorter interval or a longer video.");
        return;
      }
    } else {
      setError("Unknown mode");
      return;
    }

    setBusy(true);
    setProgress({ done: 0, total: tsList.length });

    try {
      // Build a dedicated <video> for capture (so we can pause/seek freely)
      const vid = document.createElement("video");
      vid.preload = "auto";
      vid.src = video.url;
      vid.muted = true;
      // Some browsers require play() to be called once before seeking works reliably
      videoRef.current = vid;

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timed out loading video for capture")), 30_000);
        vid.oncanplaythrough = () => {
          clearTimeout(timeout);
          resolve();
        };
        vid.onerror = () => {
          clearTimeout(timeout);
          reject(new Error("Video element failed to load for capture"));
        };
        // Force a seeking chain to load the first frame
        vid.load();
      });

      const frames: ExtractedFrame[] = [];
      const zipFiles: ZipFile[] = [];
      const total = tsList.length;
      let totalBytes = 0;

      for (let i = 0; i < total; i++) {
        const t = tsList[i]!;
        await seekTo(vid, t);
        const blob = await captureFrame(vid, outDims.width, outDims.height);
        const filename = generateFrameFilename(i, total, format);
        const url = URL.createObjectURL(blob);
        const frame: ExtractedFrame = {
          index: i,
          timestampSeconds: t,
          filename,
          blob,
          url,
          sizeBytes: blob.size,
          mimeType: blob.type,
        };
        frames.push(frame);
        totalBytes += blob.size;
        // Read the bytes for the ZIP archive
        const arr = new Uint8Array(await blob.arrayBuffer());
        zipFiles.push({ name: filename, data: arr });
        setProgress({ done: i + 1, total });
        // Yield to the event loop so the UI can update
        await new Promise((r) => setTimeout(r, 0));
      }

      // Build ZIP if >1 frame
      let zipBlob: Blob | null = null;
      let zipUrl: string | null = null;
      const zipName = `frames-${Date.now()}.zip`;
      if (frames.length > 1) {
        zipBlob = createZipBlob(zipFiles);
        zipUrl = URL.createObjectURL(zipBlob);
      }

      // Revoke previous output URLs
      if (output) {
        output.frames.forEach((f) => URL.revokeObjectURL(f.url));
        if (output.zipUrl) URL.revokeObjectURL(output.zipUrl);
      }

      setOutput({
        frames,
        zipBlob,
        zipUrl,
        zipName,
        totalBytes,
        width: outDims.width,
        height: outDims.height,
      });

      // Save history
      const entry: HistoryEntry = {
        ts: Date.now(),
        originalName: video.fileName,
        mode,
        format,
        scale,
        frameCount: frames.length,
        totalOutputBytes: totalBytes,
      };
      saveHistory(entry);
      setHistory(loadHistory());

      toast.success(`Extracted ${frames.length} frame(s) (${formatBytes(totalBytes)})`);
    } catch (e) {
      setError(`Extraction failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }, [video, mode, timestamp, timestamps, effectiveInterval, format, jpegQuality, scale, totalDuration, outDims.width, outDims.height, output, seekTo, captureFrame]);

  const handleDownloadFrame = useCallback((frame: ExtractedFrame) => {
    const a = document.createElement("a");
    a.href = frame.url;
    a.download = frame.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success(`Downloaded ${frame.filename}`);
  }, []);

  const handleDownloadZip = useCallback(() => {
    if (!output || !output.zipUrl) return;
    const a = document.createElement("a");
    a.href = output.zipUrl;
    a.download = output.zipName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success(`Downloaded ${output.zipName}`);
  }, [output]);

  const summary = useMemo(() => {
    if (!output) return null;
    const frames: FrameResult[] = output.frames.map((f) => ({
      index: f.index,
      timestampSeconds: f.timestampSeconds,
      filename: f.filename,
      sizeBytes: f.sizeBytes,
      mimeType: f.mimeType,
    }));
    return computeSummaryStats(frames, mode, format, output.width, output.height);
  }, [output, mode, format]);

  const textReport = useMemo(() => {
    if (!output || !summary) return "";
    const frames: FrameResult[] = output.frames.map((f) => ({
      index: f.index,
      timestampSeconds: f.timestampSeconds,
      filename: f.filename,
      sizeBytes: f.sizeBytes,
      mimeType: f.mimeType,
    }));
    return renderTextReport(frames, summary, video?.fileName ?? "");
  }, [output, summary, video]);

  const csvReport = useMemo(() => {
    if (!output || !summary) return "";
    const frames: FrameResult[] = output.frames.map((f) => ({
      index: f.index,
      timestampSeconds: f.timestampSeconds,
      filename: f.filename,
      sizeBytes: f.sizeBytes,
      mimeType: f.mimeType,
    }));
    return renderCsvReport(frames, summary, video?.fileName ?? "");
  }, [output, summary, video]);

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
              dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-medium text-foreground">
              {video ? video.fileName : "Drop a video file or click to browse"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {video
                ? `${formatBytes(video.fileSizeBytes)} · ${formatTime(video.durationSeconds)} · ${video.videoWidth}×${video.videoHeight}`
                : "Supports mp4, webm, ogg, mov, avi, mkv, flv"}
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,.mp4,.webm,.ogg,.ogv,.mov,.avi,.mkv,.flv,.m4v"
            onChange={onFileInput}
            className="hidden"
          />
          {decodeError && <ErrorBanner message={decodeError} />}
        </CardContent>
      </Card>

      {video && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Film className="h-4 w-4" /> Source video
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Duration" value={formatTime(video.durationSeconds)} />
              <Stat label="HMS" value={formatTimeHMS(video.durationSeconds)} />
              <Stat label="Resolution" value={`${video.videoWidth}×${video.videoHeight}`} />
              <Stat label="Size" value={formatBytes(video.fileSizeBytes)} />
            </div>
            <video
              src={video.url}
              controls
              muted
              playsInline
              className="w-full max-h-[300px] rounded border bg-black"
            />
          </CardContent>
        </Card>
      )}

      {video && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Camera className="h-4 w-4" /> Extraction settings
            </h3>

            <div>
              <Label className="text-xs">Mode</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                {(Object.keys(MODE_LABELS) as ExtractionMode[]).map((m) => (
                  <label
                    key={m}
                    className={`flex items-start gap-2 rounded border p-2 text-xs cursor-pointer transition-colors ${
                      mode === m ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="extraction-mode"
                      checked={mode === m}
                      onChange={() => setMode(m)}
                      className="mt-0.5"
                    />
                    <span className="text-foreground">{MODE_LABELS[m]}</span>
                  </label>
                ))}
              </div>
            </div>

            {mode === "single" && (
              <div className="space-y-1.5">
                <Label htmlFor="vfe-ts" className="text-xs">Timestamp (e.g. 01:30, 90, 01:02:03)</Label>
                <Input
                  id="vfe-ts"
                  value={timestamp}
                  onChange={(e) => setTimestamp(e.target.value)}
                  placeholder="01:30"
                  className="font-mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground">
                  Supports formats: 90, 90.5, 01:30, 01:30.250, 01:02:03
                </p>
              </div>
            )}

            {mode === "sequence" && (
              <div className="space-y-1.5">
                <Label htmlFor="vfe-tsl" className="text-xs">Timestamps (comma, newline, or whitespace separated)</Label>
                <Textarea
                  id="vfe-tsl"
                  value={timestamps}
                  onChange={(e) => setTimestamps(e.target.value)}
                  placeholder={"0:00, 0:05, 0:10\n0:15 0:20"}
                  className="min-h-[80px] resize-y font-mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground">
                  Parsed {parseTimestampList(timestamps).length} timestamp(s) — duplicates within 0.01s are removed.
                </p>
              </div>
            )}

            {mode === "interval" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="vfe-iv" className="text-xs">Interval preset</Label>
                  <select
                    id="vfe-iv"
                    value={intervalPreset}
                    onChange={(e) => setIntervalPreset(e.target.value as IntervalPreset)}
                    className="h-9 w-full text-xs rounded border bg-background px-2"
                  >
                    {(Object.keys(INTERVAL_LABELS) as IntervalPreset[]).map((k) => (
                      <option key={k} value={k}>{INTERVAL_LABELS[k]}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="vfe-civ" className="text-xs">Custom interval (seconds, optional)</Label>
                  <Input
                    id="vfe-civ"
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={customInterval}
                    onChange={(e) => setCustomInterval(e.target.value)}
                    placeholder="2.5"
                    className="font-mono text-xs"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground sm:col-span-2">
                  Effective interval: {effectiveInterval}s → ~{computeFrameCount(totalDuration, effectiveInterval)} frame(s).
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="vfe-fmt" className="text-xs">Output format</Label>
                <select
                  id="vfe-fmt"
                  value={format}
                  onChange={(e) => setFormat(e.target.value as OutputFormat)}
                  className="h-9 w-full text-xs rounded border bg-background px-2"
                >
                  {(Object.keys(FORMAT_LABELS) as OutputFormat[]).map((f) => (
                    <option key={f} value={f}>{FORMAT_LABELS[f]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vfe-q" className="text-xs">JPEG quality (only for JPEG)</Label>
                <select
                  id="vfe-q"
                  value={jpegQuality}
                  onChange={(e) => setJpegQuality(e.target.value as JpegQualityPreset)}
                  className="h-9 w-full text-xs rounded border bg-background px-2"
                  disabled={format !== "jpeg"}
                >
                  {(Object.keys(JPEG_QUALITY_LABELS) as JpegQualityPreset[]).map((q) => (
                    <option key={q} value={q}>{JPEG_QUALITY_LABELS[q]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vfe-sc" className="text-xs">Resolution scale</Label>
                <select
                  id="vfe-sc"
                  value={scale}
                  onChange={(e) => setScale(e.target.value as ResolutionScale)}
                  className="h-9 w-full text-xs rounded border bg-background px-2"
                >
                  {(Object.keys(RESOLUTION_SCALE_LABELS) as ResolutionScale[]).map((s) => (
                    <option key={s} value={s}>{RESOLUTION_SCALE_LABELS[s]}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Output resolution: {outDims.width}×{outDims.height} ({Math.round(RESOLUTION_SCALE_VALUES[scale] * 100)}% of source)
            </p>

            {error && <ErrorBanner message={error} />}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={handleExtract} disabled={busy} className="gap-1.5">
                <Camera className="h-3.5 w-3.5" />
                {busy ? `Extracting…${progress ? ` (${progress.done}/${progress.total})` : ""}` : "Extract frames"}
              </Button>
              <ShareButton getUrl={() => buildShareUrl({
                mode, timestamp, timestamps, intervalPreset, customInterval, format, jpegQuality, scale,
              })} />
              <ClearButton onClick={handleReset} />
            </div>
          </CardContent>
        </Card>
      )}

      {video && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Gauge className="h-4 w-4" /> Preview
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Frames" value={previewFrameCount} />
              <Stat label="Mode" value={MODE_LABELS[mode].split("—")[0]!.trim()} />
              <Stat label="Format" value={format.toUpperCase()} />
              <Stat label="Output size" value={`${outDims.width}×${outDims.height}`} />
            </div>
          </CardContent>
        </Card>
      )}

      {output && output.frames.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ImageIcon className="h-4 w-4" /> Frames ({output.frames.length})
              </h3>
              {output.zipUrl && (
                <Button onClick={handleDownloadZip} className="gap-1.5" size="sm">
                  <Package className="h-3.5 w-3.5" /> Download all as ZIP ({formatBytes(output.zipBlob!.size)})
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[600px] overflow-auto">
              {output.frames.map((f) => (
                <div key={f.index} className="rounded border bg-background p-2 space-y-1">
                  <img
                    src={f.url}
                    alt={f.filename}
                    className="w-full h-24 object-contain rounded bg-muted"
                  />
                  <div className="flex items-center justify-between text-[10px]">
                    <Badge variant="outline" className="text-[10px] font-mono">#{f.index + 1}</Badge>
                    <span className="text-muted-foreground">{formatTime(f.timestampSeconds)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-mono text-muted-foreground truncate flex-1">{f.filename}</span>
                    <Button
                      variant="outline" size="icon"
                      className="h-6 w-6 flex-shrink-0"
                      onClick={() => handleDownloadFrame(f)}
                      title={`Download ${f.filename}`}
                    ><HardDrive className="h-3 w-3" /></Button>
                  </div>
                  <div className="text-[10px] text-muted-foreground">{formatBytes(f.sizeBytes)}</div>
                </div>
              ))}
            </div>
            {summary && (
              <div className="rounded border bg-background px-3 py-2 text-xs flex items-center gap-2 flex-wrap">
                <Badge variant="outline">{summary.totalFrames} frames</Badge>
                <Badge variant="outline">{formatBytes(summary.totalSizeBytes)}</Badge>
                <Badge variant="secondary">Avg: {formatBytes(summary.avgFrameSizeBytes)}</Badge>
                <Badge variant="outline">{summary.width}×{summary.height}</Badge>
                <Badge variant="outline">{summary.format.toUpperCase()}</Badge>
                <Badge variant="outline">{MODE_LABELS[summary.mode].split("—")[0]!.trim()}</Badge>
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              <CopyButton getText={() => textReport} label="Copy text report" />
              <DownloadButton
                getText={() => textReport}
                filename={`${video?.fileName ?? "video"}.frames.txt`}
                mime="text/plain"
                label="Download .txt"
              />
              <DownloadButton
                getText={() => csvReport}
                filename={`${video?.fileName ?? "video"}.frames.csv`}
                mime="text/csv"
                label="Download CSV"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {!video && !decodeError && (
        <EmptyState
          title="Drop a video to start extracting frames"
          hint="Drag and drop or click to browse. We load it into a <video> element, seek to your timestamps (using requestVideoFrameCallback when available), draw each frame to a Canvas, and export as PNG / JPEG / WebP. Multiple frames are bundled into a pure-JS ZIP for one-click download."
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
                  <Badge variant="outline" className="text-[10px]">{MODE_LABELS[h.mode].split("—")[0]!.trim()}</Badge>
                  <Badge variant="outline" className="text-[10px]">{h.frameCount} frames</Badge>
                  <Badge variant="outline" className="text-[10px]">{h.format.toUpperCase()}</Badge>
                  <Badge variant="outline" className="text-[10px]">{h.scale}</Badge>
                  <span className="text-muted-foreground">{formatBytes(h.totalOutputBytes)}</span>
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
            <strong className="text-foreground">Privacy:</strong> The video file is loaded locally
            via an object URL. Seeking, frame drawing, and image encoding all happen in your
            browser via the HTML5 <code className="text-[10px]">&lt;video&gt;</code> element and
            Canvas API. ZIP archive building is pure-JS (no library). No file is ever uploaded.
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
