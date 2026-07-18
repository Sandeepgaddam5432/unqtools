"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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
  RESOLUTION_LABELS,
  FRAMERATE_PRESETS,
  FRAMERATE_LABELS,
  FORMAT_LABELS,
  CODEC_LABELS,
  computeResolution,
  estimateFileSizeBytes,
  formatBytes,
  computeCompressionRatio,
  computeQualityScore,
  qualityLabel,
  isFormatEncodable,
  detectEncodableFormats,
  pickDefaultOutputFormat,
  isCodecSupported,
  detectSupportedCodecs,
  generateFilename,
  loadHistory,
  saveHistory,
  clearHistory,
  computeSummaryStats,
  buildShareUrl,
  parseShareUrl,
  type BitratePreset,
  type ResolutionPreset,
  type FrameRatePreset,
  type OutputFormat,
  type VideoCodec,
  type HistoryEntry,
} from "./logic";
import {
  Minimize2, Upload, Play, History, FileVideo, Clock, HardDrive, Film, Gauge,
} from "lucide-react";

interface LoadedVideo {
  url: string;
  fileName: string;
  fileSize: number;
  duration: number;
  videoWidth: number;
  videoHeight: number;
}

interface CompressResult {
  blob: Blob;
  url: string;
  filename: string;
  durationSeconds: number;
  sizeBytes: number;
  format: OutputFormat;
  bitrate: number;
  width: number;
  height: number;
  frameRate: number;
}

export default function VideoCompressor() {
  const [loaded, setLoaded] = useState<LoadedVideo | null>(null);
  const [bitrate, setBitrate] = useState<BitratePreset>("medium");
  const [frameRate, setFrameRate] = useState<FrameRatePreset>("30");
  const [resolution, setResolution] = useState<ResolutionPreset>("720p");
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("webm");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<CompressResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Detect encodable formats and supported codecs once on mount.
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
      if (p.bitrate) setBitrate(p.bitrate);
      if (p.frameRate) setFrameRate(p.frameRate);
      if (p.resolution) setResolution(p.resolution);
      if (p.format) setOutputFormat(p.format);
      if (p.bitrate || p.frameRate || p.resolution || p.format) {
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
      toast.success(`Loaded ${file.name} (${formatBytes(file.size)}, ${formatDurationShort(meta.duration)})`);
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

  const targetResolution = useMemo(() => {
    if (!loaded) return { width: 0, height: 0 };
    return computeResolution(resolution, loaded.videoWidth, loaded.videoHeight);
  }, [loaded, resolution]);

  const estimatedSize = useMemo(() => {
    return estimateFileSizeBytes(BITRATE_PRESETS[bitrate], totalDuration);
  }, [bitrate, totalDuration]);

  const qualityScore = useMemo(() => {
    return computeQualityScore({
      bitrate: BITRATE_PRESETS[bitrate],
      width: targetResolution.width,
      height: targetResolution.height,
      frameRate: FRAMERATE_PRESETS[frameRate],
    });
  }, [bitrate, targetResolution, frameRate]);

  const encodableFormats = useMemo(() => detectEncodableFormats(), []);
  const supportedCodecs = useMemo(() => detectSupportedCodecs(), []);

  const handleCompress = useCallback(async () => {
    if (!loaded) return;
    setError(null);
    if (!isFormatEncodable(outputFormat)) {
      setError(`Your browser cannot encode ${outputFormat.toUpperCase()} via MediaRecorder. Try the other format.`);
      return;
    }
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      setError("Video or canvas element not ready.");
      return;
    }
    setBusy(true);
    setProgress(0);
    try {
      canvas.width = targetResolution.width;
      canvas.height = targetResolution.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not get 2D canvas context");

      video.src = loaded.url;
      video.muted = false;
      video.volume = 0;
      video.playbackRate = 1;

      await seekTo(video, 0);

      const fps = FRAMERATE_PRESETS[frameRate];
      const canvasStream = canvas.captureStream(fps);

      const AudioCtx: typeof AudioContext =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      const sourceNode = audioCtx.createMediaElementSource(video);
      const destNode = audioCtx.createMediaStreamDestination();
      sourceNode.connect(destNode);

      const combined = new MediaStream();
      for (const t of canvasStream.getVideoTracks()) combined.addTrack(t);
      for (const t of destNode.stream.getAudioTracks()) combined.addTrack(t);

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

      const finished = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: chosenMime });
          resolve(blob);
        };
      });

      recorder.start(100);
      await video.play();

      let rafId = 0;
      const startTime = performance.now();
      const totalDur = totalDuration;
      const drawFrame = () => {
        const elapsed = (performance.now() - startTime) / 1000;
        const t = Math.min(elapsed, totalDur);
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        } catch {
          // ignore draw errors mid-loop
        }
        setProgress(Math.min(100, (t / totalDur) * 100));
        if (video.currentTime >= totalDur - 0.05 || video.ended) {
          cancelAnimationFrame(rafId);
          video.pause();
          setTimeout(() => {
            if (recorder.state !== "inactive") recorder.stop();
          }, 80);
          return;
        }
        rafId = requestAnimationFrame(drawFrame);
      };
      rafId = requestAnimationFrame(drawFrame);

      const blob = await finished;
      try {
        await audioCtx.close();
      } catch {
        // ignore
      }

      const url = URL.createObjectURL(blob);
      const filename = generateFilename(loaded.fileName, outputFormat);
      const compressResult: CompressResult = {
        blob,
        url,
        filename,
        durationSeconds: totalDur,
        sizeBytes: blob.size,
        format: outputFormat,
        bitrate: BITRATE_PRESETS[bitrate],
        width: canvas.width,
        height: canvas.height,
        frameRate: fps,
      };
      setResult((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return compressResult;
      });
      const qScore = computeQualityScore({
        bitrate: BITRATE_PRESETS[bitrate],
        width: canvas.width,
        height: canvas.height,
        frameRate: fps,
      });
      const comp = computeCompressionRatio(loaded.fileSize, blob.size);
      const entry: HistoryEntry = {
        ts: Date.now(),
        originalName: loaded.fileName,
        inputSizeBytes: loaded.fileSize,
        outputSizeBytes: blob.size,
        reductionPct: comp.reductionPct,
        ratio: comp.ratio,
        qualityScore: qScore,
        durationSeconds: totalDur,
        bitrate: BITRATE_PRESETS[bitrate],
        resolution: `${canvas.width}×${canvas.height}`,
        frameRate: fps,
        format: outputFormat,
      };
      saveHistory(entry);
      setHistory(loadHistory());
      setProgress(100);
      toast.success(
        `Compressed to ${formatBytes(blob.size)} (${comp.reductionPct.toFixed(1)}% smaller, ${comp.ratio.toFixed(2)}×)`,
      );
    } catch (e) {
      setError(`Compression failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [
    loaded, outputFormat, targetResolution, bitrate, frameRate, totalDuration,
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
    const qScore = computeQualityScore({
      bitrate: result.bitrate,
      width: result.width,
      height: result.height,
      frameRate: result.frameRate,
    });
    return computeSummaryStats(
      loaded.fileSize,
      result.sizeBytes,
      result.durationSeconds,
      qScore,
      result.bitrate,
      result.width,
      result.height,
      result.frameRate,
      result.format,
    );
  }, [result, loaded]);

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
                ? `${formatBytes(loaded.fileSize)} · ${formatDurationShort(loaded.duration)} · ${loaded.videoWidth}×${loaded.videoHeight}`
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
              <Stat label="Duration" value={formatDurationShort(loaded.duration)} />
              <Stat label="Source resolution" value={`${loaded.videoWidth}×${loaded.videoHeight}`} />
              <Stat label="File size" value={formatBytes(loaded.fileSize)} />
              <Stat label="File name" value={loaded.fileName} />
            </div>
          </CardContent>
        </Card>
      )}

      {loaded && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Minimize2 className="h-4 w-4" /> Compression settings
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="vc-bitrate" className="text-xs">Bitrate</Label>
                <select
                  id="vc-bitrate"
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
                <Label htmlFor="vc-res" className="text-xs">Resolution</Label>
                <select
                  id="vc-res"
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
                <Label htmlFor="vc-fps" className="text-xs">Frame rate</Label>
                <select
                  id="vc-fps"
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
                <Label htmlFor="vc-format" className="text-xs">Output format</Label>
                <select
                  id="vc-format"
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
            {/* Codec support summary */}
            <div className="rounded border bg-background px-3 py-2 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-muted-foreground">Codec support:</span>
                {(Object.keys(CODEC_LABELS) as VideoCodec[]).map((c) => (
                  <Badge
                    key={c}
                    variant={isCodecSupported(c) ? "default" : "outline"}
                    className="text-[10px]"
                  >
                    {CODEC_LABELS[c].split(" ")[0]}: {isCodecSupported(c) ? "✓" : "—"}
                  </Badge>
                ))}
              </div>
            </div>
            {encodableFormats.length === 0 && (
              <ErrorBanner message="MediaRecorder is not available in this browser. Compression won't work." />
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
                  Encoding… {progress.toFixed(0)}%
                </p>
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={handleCompress} disabled={busy || !loaded} className="gap-1.5">
                <Minimize2 className="h-3.5 w-3.5" /> {busy ? "Compressing…" : "Compress video"}
              </Button>
              <ShareButton getUrl={() => buildShareUrl({
                bitrate,
                frameRate,
                resolution,
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
              <Gauge className="h-4 w-4" /> Compression preview stats
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Target resolution" value={`${targetResolution.width}×${targetResolution.height}`} />
              <Stat label="Target frame rate" value={`${FRAMERATE_PRESETS[frameRate]} fps`} />
              <Stat label="Output size (est.)" value={formatBytes(estimatedSize)} />
              <Stat label="Quality score" value={`${qualityScore}/100 (${qualityLabel(qualityScore)})`} />
            </div>
            {loaded.fileSize > 0 && estimatedSize > 0 && (
              <div className="text-[10px] text-muted-foreground">
                Estimated reduction: {((1 - estimatedSize / loaded.fileSize) * 100).toFixed(1)}% smaller
                (ratio ~{(loaded.fileSize / estimatedSize).toFixed(2)}×).
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {result && stats && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Play className="h-4 w-4" /> Compressed output
            </h3>
            <video src={result.url} controls className="w-full rounded" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Duration" value={formatDurationShort(result.durationSeconds)} />
              <Stat label="Output size" value={formatBytes(result.sizeBytes)} />
              <Stat label="Format" value={result.format.toUpperCase()} />
              <Stat label="Quality" value={`${stats.qualityScore}/100 (${qualityLabel(stats.qualityScore)})`} />
            </div>
            <div className="rounded border bg-background px-3 py-2 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">Input: {formatBytes(stats.inputSizeBytes)}</Badge>
                <Badge variant="outline">Output: {formatBytes(stats.outputSizeBytes)}</Badge>
                <Badge variant="secondary">Saved: {formatBytes(stats.savedBytes)} ({stats.reductionPct.toFixed(1)}%)</Badge>
                <Badge variant="default">Ratio: {stats.ratio.toFixed(2)}×</Badge>
                <Badge variant="outline">{stats.outputResolution} @ {stats.outputFrameRate}fps</Badge>
                <Badge variant="outline">{(stats.outputBitrate / 1_000_000).toFixed(2)} Mbps</Badge>
              </div>
            </div>
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
          title="Drop a video file to start compressing"
          hint="Drag and drop or click to browse. We load it into a hidden <video>, capture frames to a <canvas> at your chosen resolution, and re-encode via MediaRecorder at your chosen bitrate and frame rate. All processing is local."
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
                  <span className="text-muted-foreground">
                    {formatBytes(h.inputSizeBytes)} → {formatBytes(h.outputSizeBytes)}
                  </span>
                  <span className="text-muted-foreground">· {h.reductionPct.toFixed(0)}% smaller</span>
                  <span className="text-muted-foreground">· {h.ratio.toFixed(2)}×</span>
                  <span className="text-muted-foreground">· {h.resolution} @ {h.frameRate}fps</span>
                  <span className="text-muted-foreground">· Q{h.qualityScore}</span>
                  <span className="text-muted-foreground ml-auto truncate max-w-[140px]">{h.originalName}</span>
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
    setTimeout(() => {
      video.removeEventListener("seeked", onSeeked);
      reject(new Error("Seek timed out"));
    }, 5000);
  });
}

/** Format seconds as M:SS (e.g. 90 → "1:30"). */
function formatDurationShort(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
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
