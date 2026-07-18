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
  EmptyState,
  ShareButton,
  ClearButton,
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  MODE_LABELS,
  SILENCE_THRESHOLD_DB,
  SILENCE_THRESHOLD_LABELS,
  SILENCE_MIN_MS,
  SILENCE_MIN_LABELS,
  formatTime,
  formatTimeHMS,
  formatBytes,
  parseTimestamps,
  computeEqualSplitPoints,
  dbToAmplitude,
  detectSilence,
  silenceRegionsToSplitPoints,
  validateSplitPoints,
  extractSegment,
  encodeWav,
  createZipBlob,
  generateSegmentFilename,
  loadHistory,
  saveHistory,
  clearHistory,
  computeSummaryStats,
  buildShareUrl,
  parseShareUrl,
  type SplitMode,
  type SilenceThresholdPreset,
  type SilenceMinDurationPreset,
  type HistoryEntry,
  type ZipFile,
} from "./logic";
import {
  Split, Upload, Play, History, FileAudio, Clock, HardDrive,
  Scissors, Package,
} from "lucide-react";

interface DecodedAudio {
  audioBuffer: AudioBuffer;
  fileName: string;
  fileSize: number;
}

interface SegmentResult {
  name: string;
  blob: Blob;
  url: string;
  durationSeconds: number;
  sizeBytes: number;
  index: number;
}

interface SplitOutput {
  segments: SegmentResult[];
  zipBlob: Blob | null;
  zipUrl: string | null;
  zipName: string;
  totalBytes: number;
}

export default function AudioSplitter() {
  const [decoded, setDecoded] = useState<DecodedAudio | null>(null);
  const [mode, setMode] = useState<SplitMode>("equal-count");
  const [count, setCount] = useState(2);
  const [durationSeconds, setDurationSeconds] = useState(10);
  const [thresholdPreset, setThresholdPreset] = useState<SilenceThresholdPreset>("-50dB");
  const [minDurationPreset, setMinDurationPreset] = useState<SilenceMinDurationPreset>("500ms");
  const [manualText, setManualText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [output, setOutput] = useState<SplitOutput | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.mode) setMode(p.mode);
      if (typeof p.count === "number" && p.count > 0) setCount(p.count);
      if (typeof p.durationSeconds === "number" && p.durationSeconds > 0) setDurationSeconds(p.durationSeconds);
      if (typeof p.thresholdDb === "number") {
        const match = (Object.keys(SILENCE_THRESHOLD_DB) as SilenceThresholdPreset[])
          .find((k) => SILENCE_THRESHOLD_DB[k] === p.thresholdDb);
        if (match) setThresholdPreset(match);
      }
      if (typeof p.minSilenceMs === "number") {
        const match = (Object.keys(SILENCE_MIN_MS) as SilenceMinDurationPreset[])
          .find((k) => SILENCE_MIN_MS[k] === p.minSilenceMs);
        if (match) setMinDurationPreset(match);
      }
      if (p.manualTimestamps) setManualText(p.manualTimestamps);
      if (Object.keys(p).length > 0) toast.info("Loaded settings from share link");
    }
    return () => {
      if (output) {
        output.segments.forEach((s) => URL.revokeObjectURL(s.url));
        if (output.zipUrl) URL.revokeObjectURL(output.zipUrl);
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setOutput(null);
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
      setDecodeError(`Could not decode audio file: ${(e as Error).message}.`);
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

  const handleReset = useCallback(() => {
    if (output) {
      output.segments.forEach((s) => URL.revokeObjectURL(s.url));
      if (output.zipUrl) URL.revokeObjectURL(output.zipUrl);
    }
    setOutput(null);
    setDecoded(null);
    setManualText("");
    setError(null);
    setDecodeError(null);
    toast.info("Cleared");
  }, [output]);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const totalDuration = decoded?.audioBuffer.duration ?? 0;
  const sampleRate = decoded?.audioBuffer.sampleRate ?? 44100;
  const channels = decoded?.audioBuffer.numberOfChannels ?? 1;
  const totalSamples = decoded?.audioBuffer.length ?? 0;

  // Compute preview split points (for stats display) based on mode
  const previewSplitPoints = useMemo(() => {
    if (!decoded) return [];
    if (mode === "equal-count") {
      return computeEqualSplitPoints(totalSamples, sampleRate, { count });
    }
    if (mode === "equal-duration") {
      return computeEqualSplitPoints(totalSamples, sampleRate, { durationSeconds });
    }
    if (mode === "silence") {
      const thresholdDb = SILENCE_THRESHOLD_DB[thresholdPreset];
      const minMs = SILENCE_MIN_MS[minDurationPreset];
      const threshold = dbToAmplitude(thresholdDb);
      const channel0 = decoded.audioBuffer.getChannelData(0);
      const regions = detectSilence(channel0, sampleRate, threshold, minMs);
      return silenceRegionsToSplitPoints(regions);
    }
    if (mode === "manual") {
      const seconds = parseTimestamps(manualText);
      const valid = validateSplitPoints(seconds, totalDuration);
      return valid.ok ? valid.sorted.map((s) => Math.floor(s * sampleRate)) : [];
    }
    return [];
  }, [decoded, mode, count, durationSeconds, thresholdPreset, minDurationPreset, manualText, totalSamples, sampleRate, totalDuration]);

  const previewSegmentCount = previewSplitPoints.length + 1;

  const handleSplit = useCallback(async () => {
    if (!decoded) return;
    setError(null);
    setBusy(true);
    try {
      // Determine split sample points (boundaries between segments)
      let splitPointsSamples: number[] = [];

      if (mode === "equal-count") {
        splitPointsSamples = computeEqualSplitPoints(totalSamples, sampleRate, { count });
      } else if (mode === "equal-duration") {
        splitPointsSamples = computeEqualSplitPoints(totalSamples, sampleRate, { durationSeconds });
      } else if (mode === "silence") {
        const thresholdDb = SILENCE_THRESHOLD_DB[thresholdPreset];
        const minMs = SILENCE_MIN_MS[minDurationPreset];
        const threshold = dbToAmplitude(thresholdDb);
        const channel0 = decoded.audioBuffer.getChannelData(0);
        const regions = detectSilence(channel0, sampleRate, threshold, minMs);
        splitPointsSamples = silenceRegionsToSplitPoints(regions);
      } else if (mode === "manual") {
        const seconds = parseTimestamps(manualText);
        const valid = validateSplitPoints(seconds, totalDuration);
        if (!valid.ok) {
          setError(valid.error ?? "Invalid split points");
          setBusy(false);
          return;
        }
        splitPointsSamples = valid.sorted.map((s) => Math.floor(s * sampleRate));
      }

      if (splitPointsSamples.length === 0) {
        setError("No split points produced. Try different settings.");
        setBusy(false);
        return;
      }

      // Build segment boundaries: [0, p1, p2, ..., total]
      const boundaries = [0, ...splitPointsSamples, totalSamples];

      // Extract each segment from all channels and encode as WAV
      const segments: SegmentResult[] = [];
      const zipFiles: ZipFile[] = [];
      const segmentCount = boundaries.length - 1;

      for (let i = 0; i < segmentCount; i++) {
        const start = boundaries[i]!;
        const end = boundaries[i + 1]!;
        if (end <= start) continue;

        const channelData: Float32Array[] = [];
        for (let c = 0; c < decoded.audioBuffer.numberOfChannels; c++) {
          const src = decoded.audioBuffer.getChannelData(c);
          channelData.push(extractSegment(src, start, end));
        }
        // Apply 5ms fade in/out to suppress clicks at boundaries
        const fadeSamples = Math.min(Math.floor(0.005 * sampleRate), Math.floor((end - start) / 2));
        const wav = encodeWav(channelData, sampleRate, fadeSamples, fadeSamples);
        const blob = new Blob([wav.buffer as ArrayBuffer], { type: "audio/wav" });
        const url = URL.createObjectURL(blob);
        const name = generateSegmentFilename(i, segmentCount);
        segments.push({
          name, blob, url,
          durationSeconds: (end - start) / sampleRate,
          sizeBytes: blob.size,
          index: i,
        });
        zipFiles.push({ name, data: wav });
      }

      // Build ZIP if there's more than 1 segment
      let zipBlob: Blob | null = null;
      let zipUrl: string | null = null;
      const zipName = `splits-${Date.now()}.zip`;
      if (segments.length > 1) {
        zipBlob = createZipBlob(zipFiles);
        zipUrl = URL.createObjectURL(zipBlob);
      }

      const totalBytes = segments.reduce((s, x) => s + x.sizeBytes, 0);

      // Revoke previous output URLs
      if (output) {
        output.segments.forEach((s) => URL.revokeObjectURL(s.url));
        if (output.zipUrl) URL.revokeObjectURL(output.zipUrl);
      }
      setOutput({ segments, zipBlob, zipUrl, zipName, totalBytes });

      // Save history
      const entry: HistoryEntry = {
        ts: Date.now(),
        originalName: decoded.fileName,
        originalDurationMs: Math.round(totalDuration * 1000),
        segmentCount: segments.length,
        mode,
        totalOutputBytes: totalBytes,
        sampleRate,
        channels,
      };
      saveHistory(entry);
      setHistory(loadHistory());
      toast.success(`Split into ${segments.length} segments (${formatBytes(totalBytes)})`);
    } catch (e) {
      setError(`Split failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [decoded, mode, count, durationSeconds, thresholdPreset, minDurationPreset, manualText, totalSamples, sampleRate, totalDuration, channels, output]);

  const handleDownloadSegment = useCallback((seg: SegmentResult) => {
    const a = document.createElement("a");
    a.href = seg.url;
    a.download = seg.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success(`Downloaded ${seg.name}`);
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

  const stats = useMemo(() => {
    if (!output) return null;
    return computeSummaryStats(
      output.segments.map((s) => ({ durationSeconds: s.durationSeconds, sizeBytes: s.sizeBytes })),
      totalDuration,
      sampleRate,
      channels,
    );
  }, [output, totalDuration, sampleRate, channels]);

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
              dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
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
              <FileAudio className="h-4 w-4" /> Original audio
            </h3>
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
              <Split className="h-4 w-4" /> Split mode
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(Object.keys(MODE_LABELS) as SplitMode[]).map((m) => (
                <label
                  key={m}
                  className={`flex items-start gap-2 rounded border p-2 text-xs cursor-pointer transition-colors ${
                    mode === m ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="split-mode"
                    checked={mode === m}
                    onChange={() => setMode(m)}
                    className="mt-0.5"
                  />
                  <span className="text-foreground">{MODE_LABELS[m]}</span>
                </label>
              ))}
            </div>

            {mode === "equal-count" && (
              <div className="space-y-1.5">
                <Label htmlFor="as-count" className="text-xs">Number of segments</Label>
                <Input
                  id="as-count"
                  type="number"
                  min={2}
                  max={999}
                  value={count}
                  onChange={(e) => setCount(Math.max(2, parseInt(e.target.value, 10) || 2))}
                  className="font-mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground">
                  Will split into {count} equal parts of ~{formatTime(totalDuration / count)} each.
                </p>
              </div>
            )}

            {mode === "equal-duration" && (
              <div className="space-y-1.5">
                <Label htmlFor="as-dur" className="text-xs">Duration per segment (seconds)</Label>
                <Input
                  id="as-dur"
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={durationSeconds}
                  onChange={(e) => setDurationSeconds(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                  className="font-mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground">
                  Will produce ~{Math.max(1, Math.ceil(totalDuration / durationSeconds))} segments of {formatTime(durationSeconds)} each (last may be shorter).
                </p>
              </div>
            )}

            {mode === "silence" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="as-thr" className="text-xs">Silence threshold</Label>
                  <select
                    id="as-thr"
                    value={thresholdPreset}
                    onChange={(e) => setThresholdPreset(e.target.value as SilenceThresholdPreset)}
                    className="h-9 w-full text-xs rounded border bg-background px-2"
                  >
                    {(Object.keys(SILENCE_THRESHOLD_LABELS) as SilenceThresholdPreset[]).map((t) => (
                      <option key={t} value={t}>{SILENCE_THRESHOLD_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="as-min" className="text-xs">Min silence duration</Label>
                  <select
                    id="as-min"
                    value={minDurationPreset}
                    onChange={(e) => setMinDurationPreset(e.target.value as SilenceMinDurationPreset)}
                    className="h-9 w-full text-xs rounded border bg-background px-2"
                  >
                    {(Object.keys(SILENCE_MIN_LABELS) as SilenceMinDurationPreset[]).map((d) => (
                      <option key={d} value={d}>{SILENCE_MIN_LABELS[d]}</option>
                    ))}
                  </select>
                </div>
                <p className="text-[10px] text-muted-foreground sm:col-span-2">
                  Detected {previewSplitPoints.length} silence region(s) — will produce {previewSegmentCount} segments.
                </p>
              </div>
            )}

            {mode === "manual" && (
              <div className="space-y-1.5">
                <Label htmlFor="as-ts" className="text-xs">Timestamps (comma, newline, or whitespace separated)</Label>
                <Textarea
                  id="as-ts"
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder={"0:30, 1:15, 2:45\n3:00.500"}
                  className="min-h-[80px] resize-y font-mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground">
                  Parsed {parseTimestamps(manualText).length} timestamp(s). Supports formats: 90, 90.5, 01:30, 01:30.250, 01:02:03.
                </p>
              </div>
            )}

            {error && <ErrorBanner message={error} />}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={handleSplit} disabled={busy} className="gap-1.5">
                <Scissors className="h-3.5 w-3.5" /> {busy ? "Splitting…" : "Split audio"}
              </Button>
              <ShareButton getUrl={() => buildShareUrl({
                mode, count, durationSeconds,
                thresholdDb: SILENCE_THRESHOLD_DB[thresholdPreset],
                minSilenceMs: SILENCE_MIN_MS[minDurationPreset],
                manualTimestamps: manualText,
              })} />
              <ClearButton onClick={handleReset} />
            </div>
          </CardContent>
        </Card>
      )}

      {decoded && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> Split preview
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Segments" value={previewSegmentCount} />
              <Stat label="Split points" value={previewSplitPoints.length} />
              <Stat label="Avg duration" value={formatTime(totalDuration / previewSegmentCount)} />
              <Stat label="Mode" value={MODE_LABELS[mode].split("—")[0]!.trim()} />
            </div>
          </CardContent>
        </Card>
      )}

      {output && output.segments.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Play className="h-4 w-4" /> Segments ({output.segments.length})
              </h3>
              {output.zipUrl && (
                <Button onClick={handleDownloadZip} className="gap-1.5" size="sm">
                  <Package className="h-3.5 w-3.5" /> Download all as ZIP ({formatBytes(output.zipBlob!.size)})
                </Button>
              )}
            </div>
            <div className="space-y-2 max-h-[600px] overflow-auto">
              {output.segments.map((seg) => (
                <div key={seg.index} className="rounded border bg-background px-3 py-2 space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline" className="text-[10px] font-mono">#{seg.index + 1}</Badge>
                    <span className="font-mono text-foreground truncate flex-1">{seg.name}</span>
                    <span className="text-muted-foreground">{formatTime(seg.durationSeconds)}</span>
                    <span className="text-muted-foreground">{formatBytes(seg.sizeBytes)}</span>
                    <Button
                      variant="outline" size="icon"
                      className="h-7 w-7"
                      onClick={() => handleDownloadSegment(seg)}
                      title={`Download ${seg.name}`}
                    ><HardDrive className="h-3 w-3" /></Button>
                  </div>
                  <audio src={seg.url} controls className="w-full h-8" />
                </div>
              ))}
            </div>
            {stats && (
              <div className="rounded border bg-background px-3 py-2 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">{stats.segmentCount} segments</Badge>
                  <Badge variant="outline">Total: {formatTime(stats.totalDurationSeconds)}</Badge>
                  <Badge variant="secondary">Avg: {formatTime(stats.avgSegmentSeconds)}</Badge>
                  <Badge variant="outline">Min: {formatTime(stats.minSegmentSeconds)}</Badge>
                  <Badge variant="outline">Max: {formatTime(stats.maxSegmentSeconds)}</Badge>
                  <Badge variant="secondary">Output: {formatBytes(stats.totalOutputBytes)}</Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!decoded && !decodeError && (
        <EmptyState
          title="Drop an audio file to start splitting"
          hint="Drag and drop or click to browse. We decode it locally with the Web Audio API, then split based on your chosen mode (equal count, equal duration, silence detection, or manual timestamps). Each segment is encoded as a 16-bit PCM WAV and bundled into a pure-JS ZIP archive."
          icon={<Split className="h-8 w-8" />}
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
                  <Badge variant="outline" className="text-[10px]">{h.segmentCount} segs</Badge>
                  <Badge variant="outline" className="text-[10px]">{MODE_LABELS[h.mode].split("—")[0]!.trim()}</Badge>
                  <span className="font-mono text-muted-foreground">{formatTime(h.originalDurationMs / 1000)}</span>
                  <span className="text-muted-foreground">· {formatBytes(h.totalOutputBytes)}</span>
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
            <strong className="text-foreground">Privacy:</strong> Audio decoding, segment
            extraction, WAV encoding, and ZIP archive building all happen locally in your
            browser via the Web Audio API and pure-JS encoders. No file is ever uploaded.
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
