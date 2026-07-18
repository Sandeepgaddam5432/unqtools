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
  CONTAINERS,
  RESOLUTION_PRESETS,
  FRAME_RATE_PRESETS,
  COMPATIBILITY_LABELS,
  detectContainer,
  getMimeType,
  lookupCodec,
  formatFileSize,
  formatDuration,
  formatDurationHMS,
  calculateBitrate,
  formatBitrate,
  computeAspectRatio,
  labelResolution,
  matchFrameRate,
  formatFrameRate,
  checkCompatibility,
  buildReport,
  computeSummaryStats,
  renderTextReport,
  renderCsvReport,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  getFileExtension,
  type VideoContainer,
  type VideoMetadata,
  type MetadataReport,
  type HistoryEntry,
} from "./logic";
import {
  FileVideo, Upload, History, Film, Gauge, Ratio,
  HardDrive, Clock, Layers, Shield,
} from "lucide-react";

export default function VideoMetadataViewer() {
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (Object.keys(p).length > 0) {
        // Build a "synthetic" metadata from share-URL params
        const synth: VideoMetadata = {
          fileName: p.fileName ?? "shared-video",
          fileSizeBytes: p.fileSizeBytes ?? 0,
          container: p.container ?? "unknown",
          mimeType: p.container ? getMimeType(p.container) : "application/octet-stream",
          videoWidth: p.width ?? 0,
          videoHeight: p.height ?? 0,
          durationSeconds: p.durationSeconds ?? 0,
          videoCodec: p.videoCodec,
          audioCodec: p.audioCodec,
        };
        setFileName(synth.fileName);
        setFileSize(synth.fileSizeBytes);
        setMetadata(synth);
        toast.info("Loaded metadata from share link");
      }
    }
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    if (!file.type.startsWith("video/") && !/\.(mp4|webm|ogg|ogv|mov|avi|mkv|flv|m4v)$/i.test(file.name)) {
      setError("Please select a video file (mp4, webm, ogg, mov, avi, mkv, flv).");
      return;
    }
    setBusy(true);
    try {
      // Revoke previous URL
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const url = URL.createObjectURL(file);
      objectUrlRef.current = url;

      // Read magic bytes (first 64)
      const slice = file.slice(0, 64);
      const bytes = new Uint8Array(await slice.arrayBuffer());
      const ext = getFileExtension(file.name);
      const container = detectContainer(bytes, ext);
      const mimeType = getMimeType(container);

      setFileName(file.name);
      setFileSize(file.size);

      // Use a temporary <video> element to read metadata
      const video = document.createElement("video");
      video.preload = "metadata";
      video.src = url;
      videoRef.current = video;

      const meta = await new Promise<VideoMetadata>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Timed out reading video metadata"));
        }, 15_000);
        video.onloadedmetadata = () => {
          clearTimeout(timeout);
          // Try to read codec info from MediaSource or video track
          let videoCodec: string | undefined;
          let audioCodec: string | undefined;
          try {
            // Use MSE.isTypeSupported to probe common codecs? No — too unreliable.
            // Instead, try moz/wkGetUserMedia or the experimental videoTracks API.
            // Fallback: derive from container + MIME hints.
            // Some browsers expose track.kind and label but not the codec four-cc.
            // We attempt to extract from the file extension / container.
            const guesses = guessCodecsFromContainer(container, mimeType);
            videoCodec = guesses.video;
            audioCodec = guesses.audio;
          } catch {
            // ignore
          }
          // Frame rate is not reliably exposed; leave undefined unless we can read it.
          let frameRate: number | undefined;
          try {
            const vTracks = (video as unknown as { videoTracks?: { length: number; [n: number]: { frameRate?: number } } }).videoTracks;
            if (vTracks && vTracks.length > 0 && typeof vTracks[0]!.frameRate === "number") {
              frameRate = vTracks[0]!.frameRate;
            }
          } catch {
            // ignore
          }
          resolve({
            fileName: file.name,
            fileSizeBytes: file.size,
            container,
            mimeType,
            videoWidth: video.videoWidth || 0,
            videoHeight: video.videoHeight || 0,
            durationSeconds: Number.isFinite(video.duration) ? video.duration : 0,
            videoCodec,
            audioCodec,
            frameRate,
          });
        };
        video.onerror = () => {
          clearTimeout(timeout);
          reject(new Error("Could not load video metadata. The format may be unsupported by your browser."));
        };
      });

      setMetadata(meta);

      // Save history
      const entry: HistoryEntry = {
        ts: Date.now(),
        fileName: meta.fileName,
        fileSizeBytes: meta.fileSizeBytes,
        container: meta.container,
        durationSeconds: meta.durationSeconds,
        width: meta.videoWidth,
        height: meta.videoHeight,
        videoCodec: meta.videoCodec,
        audioCodec: meta.audioCodec,
      };
      saveHistory(entry);
      setHistory(loadHistory());

      toast.success(`Loaded ${meta.fileName} (${formatFileSize(meta.fileSizeBytes)})`);
    } catch (e) {
      setError(`Could not read metadata: ${(e as Error).message}`);
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

  const handleClear = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setFileName("");
    setFileSize(0);
    setMetadata(null);
    setError(null);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const report: MetadataReport | null = useMemo(
    () => metadata ? buildReport(metadata) : null,
    [metadata],
  );

  const stats = useMemo(
    () => report ? computeSummaryStats(report) : null,
    [report],
  );

  const textReport = useMemo(
    () => report ? renderTextReport(report) : "",
    [report],
  );
  const csvReport = useMemo(
    () => report ? renderCsvReport(report) : "",
    [report],
  );

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
              {fileName || "Drop a video file or click to browse"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {fileName
                ? `${formatFileSize(fileSize)}${metadata ? ` · ${metadata.container.toUpperCase()} · ${metadata.mimeType}` : ""}`
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
          {error && <ErrorBanner message={error} />}
          {busy && (
            <p className="text-xs text-muted-foreground">Reading metadata…</p>
          )}
        </CardContent>
      </Card>

      {report && stats && (
        <>
          {/* Summary stats */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Gauge className="h-4 w-4" /> Summary stats
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="File size" value={formatFileSize(stats.fileSize)} icon={<HardDrive className="h-3 w-3" />} />
                <Stat label="Duration" value={formatDuration(stats.duration)} icon={<Clock className="h-3 w-3" />} />
                <Stat label="Bitrate" value={formatBitrate(stats.bitrate)} icon={<Gauge className="h-3 w-3" />} />
                <Stat label="Resolution" value={`${stats.width}×${stats.height}`} icon={<Film className="h-3 w-3" />} />
              </div>
            </CardContent>
          </Card>

          {/* File / Container */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FileVideo className="h-4 w-4" /> File & container
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <Row label="File name" value={report.metadata.fileName} />
                <Row label="File size" value={`${formatFileSize(report.metadata.fileSizeBytes)} (${report.metadata.fileSizeBytes.toLocaleString()} B)`} />
                <Row label="Container" value={report.metadata.container.toUpperCase()} />
                <Row label="MIME type" value={report.metadata.mimeType} mono />
                {report.containerInfo && (
                  <div className="sm:col-span-2">
                    <Row label="Description" value={report.containerInfo.description} />
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 pt-2">
                {(Object.keys(CONTAINERS) as Array<keyof typeof CONTAINERS>).map((c) => (
                  <Badge
                    key={c}
                    variant={c === report.metadata.container ? "default" : "outline"}
                    className="text-[10px]"
                  >
                    {c.toUpperCase()}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Video */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Film className="h-4 w-4" /> Video stream
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <Row label="Resolution" value={`${report.metadata.videoWidth}×${report.metadata.videoHeight}`} />
                <Row label="Resolution label" value={`${report.resolutionLabel.label} (${report.resolutionLabel.alias})`} />
                <Row label="Aspect ratio" value={`${report.aspectRatio.ratio} — ${report.aspectRatio.label}`} />
                <Row
                  label="Frame rate"
                  value={
                    report.metadata.frameRate !== undefined
                      ? `${formatFrameRate(report.metadata.frameRate)} fps${report.frameRatePreset ? ` — ${report.frameRatePreset.description}` : ""}`
                      : "unknown"
                  }
                />
                {report.metadata.videoCodec && (
                  <>
                    <Row label="Video codec" value={report.metadata.videoCodec} mono />
                    <Row label="Codec name" value={report.videoCodecInfo?.name ?? "unknown"} />
                  </>
                )}
                {report.metadata.videoCodec && (
                  <Row
                    label="Container compat"
                    value={COMPATIBILITY_LABELS[report.videoCompatibility]}
                  />
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 pt-2">
                {RESOLUTION_PRESETS.map((p) => (
                  <Badge
                    key={p.alias}
                    variant={p.alias === report.resolutionLabel.alias ? "default" : "outline"}
                    className="text-[10px]"
                  >
                    {p.shortLabel}
                  </Badge>
                ))}
              </div>
              {report.metadata.frameRate !== undefined && (
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {FRAME_RATE_PRESETS.map((p) => (
                    <Badge
                      key={p.fps}
                      variant={report.frameRatePreset?.fps === p.fps ? "default" : "outline"}
                      className="text-[10px]"
                    >
                      {p.label}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Audio */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Layers className="h-4 w-4" /> Audio stream
              </h3>
              {report.metadata.audioCodec ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <Row label="Audio codec" value={report.metadata.audioCodec} mono />
                  <Row label="Codec name" value={report.audioCodecInfo?.name ?? "unknown"} />
                  <Row
                    label="Container compat"
                    value={COMPATIBILITY_LABELS[report.audioCompatibility]}
                  />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No audio codec detected (file may be video-only, or codec info is not exposed by the browser).</p>
              )}
            </CardContent>
          </Card>

          {/* Aspect + Bitrate detail */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Ratio className="h-4 w-4" /> Aspect & bitrate
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Ratio (decimal)" value={report.aspectRatio.decimal.toFixed(4)} />
                <Stat label="Bitrate (raw)" value={`${Math.round(report.bitrate).toLocaleString()} bps`} />
                <Stat label="Bitrate (fmt)" value={formatBitrate(report.bitrate)} />
                <Stat label="Duration (HMS)" value={formatDurationHMS(report.metadata.durationSeconds)} />
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Export & share</h3>
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => textReport} label="Copy text report" />
                <DownloadButton
                  getText={() => textReport}
                  filename={`${report.metadata.fileName}.metadata.txt`}
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => csvReport}
                  filename={`${report.metadata.fileName}.metadata.csv`}
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton
                  getUrl={() => buildShareUrl({
                    fileName: report.metadata.fileName,
                    fileSizeBytes: report.metadata.fileSizeBytes,
                    container: report.metadata.container,
                    durationSeconds: report.metadata.durationSeconds,
                    width: report.metadata.videoWidth,
                    height: report.metadata.videoHeight,
                    videoCodec: report.metadata.videoCodec ?? "",
                    audioCodec: report.metadata.audioCodec ?? "",
                  })}
                />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!metadata && !error && (
        <EmptyState
          title="Drop a video file to inspect its metadata"
          hint="Drag and drop or click to browse. We read metadata locally with the HTML5 <video> element (loadedmetadata event) and detect the container from magic bytes. Codec info is guessed from container where browsers don't expose four-cc codes. History is kept in localStorage."
          icon={<FileVideo className="h-8 w-8" />}
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
                  <Badge variant="outline" className="text-[10px]">{h.container.toUpperCase()}</Badge>
                  <Badge variant="outline" className="text-[10px]">{h.width}×{h.height}</Badge>
                  <Badge variant="outline" className="text-[10px]">{formatDuration(h.durationSeconds)}</Badge>
                  <span className="text-muted-foreground">{formatFileSize(h.fileSizeBytes)}</span>
                  <span className="text-muted-foreground ml-auto truncate max-w-[180px]">{h.fileName}</span>
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
            <strong className="text-foreground flex items-center gap-1">
              <Shield className="h-3 w-3" /> Privacy:
            </strong>{" "}
            The video file is loaded entirely in your browser via an object URL and the HTML5{" "}
            <code className="text-[10px]">&lt;video&gt;</code> element. No bytes are uploaded to any
            server. Container detection uses the first 64 magic bytes read locally. History
            metadata (file name, size, codec, resolution) is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ---- Helpers ----

/** Best-effort codec guess based on the detected container. */
function guessCodecsFromContainer(container: VideoContainer, _mimeType: string): { video?: string; audio?: string } {
  switch (container) {
    case "mp4":
      return { video: "avc1", audio: "mp4a" };
    case "webm":
      return { video: "vp09", audio: "opus" };
    case "ogg":
      return { video: "theora", audio: "vorbis" };
    case "mov":
      return { video: "avc1", audio: "mp4a" };
    case "avi":
      return { video: "avc1", audio: "mp3" };
    case "mkv":
      return { video: "avc1", audio: "mp4a" };
    case "flv":
      return { video: "avc1", audio: "mp4a" };
    default:
      return {};
  }
}

// ---- Small UI components ----

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

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded border bg-background px-3 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm text-foreground break-all ${mono ? "font-mono" : ""}`}>{value || "—"}</div>
    </div>
  );
}
