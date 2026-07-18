"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  CopyButton,
  EmptyState,
  ShareButton,
  ClearButton,
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  GAP_LABELS,
  CROSSFADE_LABELS,
  formatTime,
  formatTimeHMS,
  formatBytes,
  unifySampleRate,
  unifyChannels,
  resampleLinear,
  upmixChannels,
  concatenateSegments,
  computeTotalDuration,
  estimateWavSizeBytes,
  encodeWav,
  generateFilename,
  validateMerge,
  loadHistory,
  saveHistory,
  clearHistory,
  computeSummaryStats,
  buildShareUrl,
  parseShareUrl,
  gapPresetToMs,
  crossfadePresetToMs,
  type GapPreset,
  type CrossfadePreset,
  type HistoryEntry,
  type SegmentInfo,
} from "./logic";
import {
  Combine, Upload, Play, History, FileAudio, Clock, HardDrive,
  ArrowUp, ArrowDown, X, Plus,
} from "lucide-react";

interface LoadedSegment {
  id: string;
  file: File;
  audioBuffer: AudioBuffer;
}

interface MergeResult {
  blob: Blob;
  url: string;
  filename: string;
  durationSeconds: number;
  sizeBytes: number;
  sampleRate: number;
  channels: number;
}

let _segmentIdCounter = 0;
function nextSegmentId(): string {
  _segmentIdCounter += 1;
  return `seg-${Date.now()}-${_segmentIdCounter}`;
}

export default function AudioMerger() {
  const [segments, setSegments] = useState<LoadedSegment[]>([]);
  const [gapPreset, setGapPreset] = useState<GapPreset>("0ms");
  const [crossfadePreset, setCrossfadePreset] = useState<CrossfadePreset>("0ms");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<MergeResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (typeof p.gapMs === "number") {
        const match = (Object.keys(GAP_LABELS) as GapPreset[]).find((k) => gapPresetToMs(k) === p.gapMs);
        if (match) setGapPreset(match);
      }
      if (typeof p.crossfadeMs === "number") {
        const match = (Object.keys(CROSSFADE_LABELS) as CrossfadePreset[]).find((k) => crossfadePresetToMs(k) === p.crossfadeMs);
        if (match) setCrossfadePreset(match);
      }
      if (p.gapMs !== undefined || p.crossfadeMs !== undefined) {
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

  const getAudioContext = useCallback((): AudioContext => {
    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioContextRef.current = new Ctor();
    }
    return audioContextRef.current;
  }, []);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setError(null);
    setDecodeError(null);
    const incoming = Array.from(files).filter(
      (f) => f.type.startsWith("audio/") || /\.(wav|mp3|ogg|webm|m4a|aac|flac)$/i.test(f.name),
    );
    if (incoming.length === 0) {
      setDecodeError("Please select audio files (wav, mp3, ogg, webm, m4a, aac, flac).");
      return;
    }
    try {
      setBusy(true);
      const ctx = getAudioContext();
      const loaded: LoadedSegment[] = [];
      for (const f of incoming) {
        try {
          const arrayBuffer = await f.arrayBuffer();
          const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
          loaded.push({ id: nextSegmentId(), file: f, audioBuffer });
        } catch (e) {
          toast.error(`Could not decode ${f.name}: ${(e as Error).message}`);
        }
      }
      if (loaded.length > 0) {
        setSegments((prev) => [...prev, ...loaded]);
        toast.success(`Added ${loaded.length} file(s)`);
      }
    } finally {
      setBusy(false);
    }
  }, [getAudioContext]);

  const onFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
    if (e.target) e.target.value = "";
  }, [handleFiles]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const moveSegment = useCallback((id: string, dir: -1 | 1) => {
    setSegments((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx < 0) return prev;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
      return copy;
    });
  }, []);

  const removeSegment = useCallback((id: string) => {
    setSegments((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleClear = useCallback(() => {
    if (result) URL.revokeObjectURL(result.url);
    setResult(null);
    setSegments([]);
    setError(null);
    setDecodeError(null);
    toast.info("Cleared");
  }, [result]);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const gapMs = gapPresetToMs(gapPreset);
  const crossfadeMs = crossfadePresetToMs(crossfadePreset);

  const segmentInfos: SegmentInfo[] = useMemo(
    () => segments.map((s) => ({
      fileName: s.file.name,
      sampleRate: s.audioBuffer.sampleRate,
      channels: s.audioBuffer.numberOfChannels,
      length: s.audioBuffer.length,
      durationSeconds: s.audioBuffer.duration,
    })),
    [segments],
  );

  const targetSampleRate = useMemo(
    () => unifySampleRate(segmentInfos.map((s) => s.sampleRate)),
    [segmentInfos],
  );
  const targetChannels = useMemo(
    () => unifyChannels(segmentInfos.map((s) => s.channels)),
    [segmentInfos],
  );

  const totalDuration = useMemo(
    () => computeTotalDuration(
      segmentInfos.map((s) => s.length),
      targetSampleRate || 44100,
      gapMs,
      crossfadeMs,
    ),
    [segmentInfos, targetSampleRate, gapMs, crossfadeMs],
  );

  const estimatedSamples = Math.round(totalDuration * (targetSampleRate || 44100));
  const estimatedSize = estimateWavSizeBytes(estimatedSamples, targetChannels || 1);

  const valid = useMemo(() => validateMerge(segmentInfos), [segmentInfos]);

  const handleMerge = useCallback(async () => {
    if (!valid.ok) {
      setError(valid.error ?? "Invalid merge");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      // For each target channel, build a list of per-segment Float32Arrays (resampled + upmixed)
      const channelSegments: Float32Array[][] = Array.from({ length: targetChannels }, () => []);

      for (const seg of segments) {
        const srcRate = seg.audioBuffer.sampleRate;
        const srcChannels = seg.audioBuffer.numberOfChannels;
        const perChannel: Float32Array[] = [];
        for (let c = 0; c < srcChannels; c++) {
          const src = seg.audioBuffer.getChannelData(c);
          const resampled = srcRate === targetSampleRate ? src.slice() : resampleLinear(src, srcRate, targetSampleRate);
          perChannel.push(resampled);
        }
        const upmixed = upmixChannels(perChannel, targetChannels);
        for (let c = 0; c < targetChannels; c++) {
          channelSegments[c]!.push(upmixed[c]!);
        }
      }

      const gapSamples = Math.round((gapMs / 1000) * targetSampleRate);
      const crossfadeSamples = Math.round((crossfadeMs / 1000) * targetSampleRate);

      const mergedChannels = channelSegments.map(
        (segs) => concatenateSegments(segs, gapSamples, crossfadeSamples),
      );

      const wav = encodeWav(mergedChannels, targetSampleRate);
      const blob = new Blob([wav.buffer as ArrayBuffer], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      const filename = generateFilename();
      const mergeResult: MergeResult = {
        blob, url, filename,
        durationSeconds: totalDuration,
        sizeBytes: blob.size,
        sampleRate: targetSampleRate,
        channels: targetChannels,
      };
      setResult((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return mergeResult;
      });

      const entry: HistoryEntry = {
        ts: Date.now(),
        segmentCount: segments.length,
        totalDurationMs: Math.round(totalDuration * 1000),
        outputSizeBytes: blob.size,
        sampleRate: targetSampleRate,
        channels: targetChannels,
        gapMs, crossfadeMs,
        fileNames: segments.map((s) => s.file.name),
      };
      saveHistory(entry);
      setHistory(loadHistory());
      toast.success(`Merged ${segments.length} files → ${formatTime(totalDuration)} (${formatBytes(blob.size)})`);
    } catch (e) {
      setError(`Merge failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [valid, segments, targetChannels, targetSampleRate, gapMs, crossfadeMs, totalDuration]);

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

  const stats = useMemo(() => {
    if (!result) return null;
    return computeSummaryStats(segmentInfos, result.durationSeconds, result.sizeBytes, gapMs, crossfadeMs);
  }, [result, segmentInfos, gapMs, crossfadeMs]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs">Audio files (add multiple, drag to reorder)</Label>
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
              Drop audio files here or click to browse
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Supports wav, mp3, ogg, webm, m4a, aac, flac · Multiple files supported
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.wav,.mp3,.ogg,.webm,.m4a,.aac,.flac"
            multiple
            onChange={onFileInput}
            className="hidden"
          />
          {decodeError && <ErrorBanner message={decodeError} />}
        </CardContent>
      </Card>

      {segments.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FileAudio className="h-4 w-4" /> Segments ({segments.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add more
              </Button>
            </div>
            <div className="space-y-1 max-h-[400px] overflow-auto">
              {segments.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2 rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="text-[10px] font-mono">#{i + 1}</Badge>
                  <span className="font-mono text-muted-foreground text-[10px]">{formatTime(s.audioBuffer.duration)}</span>
                  <span className="text-muted-foreground text-[10px]">{s.audioBuffer.sampleRate}Hz</span>
                  <span className="text-muted-foreground text-[10px]">{s.audioBuffer.numberOfChannels}ch</span>
                  <span className="flex-1 font-mono text-foreground truncate">{s.file.name}</span>
                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7"
                      onClick={() => moveSegment(s.id, -1)}
                      disabled={i === 0}
                      title="Move up"
                    ><ArrowUp className="h-3 w-3" /></Button>
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7"
                      onClick={() => moveSegment(s.id, 1)}
                      disabled={i === segments.length - 1}
                      title="Move down"
                    ><ArrowDown className="h-3 w-3" /></Button>
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7"
                      onClick={() => removeSegment(s.id)}
                      title="Remove"
                    ><X className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Segments" value={segments.length} />
              <Stat label="Target rate" value={targetSampleRate || "—"} />
              <Stat label="Target channels" value={targetChannels || "—"} />
              <Stat label="Est. duration" value={formatTime(totalDuration)} />
            </div>
          </CardContent>
        </Card>
      )}

      {segments.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Combine className="h-4 w-4" /> Merge settings
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="am-gap" className="text-xs">Silence gap between segments</Label>
                <select
                  id="am-gap"
                  value={gapPreset}
                  onChange={(e) => setGapPreset(e.target.value as GapPreset)}
                  className="h-9 w-full text-xs rounded border bg-background px-2"
                >
                  {(Object.keys(GAP_LABELS) as GapPreset[]).map((g) => (
                    <option key={g} value={g}>{GAP_LABELS[g]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="am-crossfade" className="text-xs">Crossfade between segments</Label>
                <select
                  id="am-crossfade"
                  value={crossfadePreset}
                  onChange={(e) => setCrossfadePreset(e.target.value as CrossfadePreset)}
                  className="h-9 w-full text-xs rounded border bg-background px-2"
                >
                  {(Object.keys(CROSSFADE_LABELS) as CrossfadePreset[]).map((c) => (
                    <option key={c} value={c}>{CROSSFADE_LABELS[c]}</option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {crossfadeMs > 0
                ? `Crossfade is active — segments will overlap by ${crossfadeMs} ms (gaps ignored).`
                : gapMs > 0
                  ? `Gap is active — ${gapMs} ms of silence will be inserted between segments.`
                  : "No gap or crossfade — segments will be joined directly."}
            </p>
            {error && <ErrorBanner message={error} />}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={handleMerge} disabled={busy || !valid.ok} className="gap-1.5">
                <Combine className="h-3.5 w-3.5" /> {busy ? "Merging…" : `Merge ${segments.length} files`}
              </Button>
              <ShareButton getUrl={() => buildShareUrl({ gapMs, crossfadeMs })} />
              <ClearButton onClick={handleClear} />
            </div>
          </CardContent>
        </Card>
      )}

      {segments.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> Merge preview
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Output duration" value={formatTime(totalDuration)} />
              <Stat label="Output size (est.)" value={formatBytes(estimatedSize)} />
              <Stat label="HMS" value={formatTimeHMS(totalDuration)} />
              <Stat label="Format" value="WAV PCM 16" />
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Play className="h-4 w-4" /> Merged output
            </h3>
            <audio src={result.url} controls className="w-full" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Duration" value={formatTime(result.durationSeconds)} />
              <Stat label="File size" value={formatBytes(result.sizeBytes)} />
              <Stat label="Sample rate" value={`${result.sampleRate} Hz`} />
              <Stat label="Channels" value={result.channels} />
            </div>
            {stats && (
              <div className="rounded border bg-background px-3 py-2 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">{stats.segmentCount} segments</Badge>
                  <Badge variant="outline">Joined: {stats.joins}</Badge>
                  {stats.gapCount > 0 && <Badge variant="secondary">{stats.gapCount} gaps × {gapMs}ms</Badge>}
                  {stats.crossfadeCount > 0 && <Badge variant="secondary">{stats.crossfadeCount} crossfades × {crossfadeMs}ms</Badge>}
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

      {segments.length === 0 && !decodeError && (
        <EmptyState
          title="Add multiple audio files to merge"
          hint="Drag and drop or click to browse. Files are decoded locally with the Web Audio API, resampled to a common format, and concatenated with optional silence gaps or linear crossfades. Output downloads as a 16-bit PCM WAV."
          icon={<Combine className="h-8 w-8" />}
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
                  <Badge variant="outline" className="text-[10px]">{h.segmentCount} files</Badge>
                  <span className="font-mono text-muted-foreground">{formatTime(h.totalDurationMs / 1000)}</span>
                  <span className="text-muted-foreground">· {formatBytes(h.outputSizeBytes)}</span>
                  {h.gapMs > 0 && <Badge variant="outline" className="text-[10px]">gap {h.gapMs}ms</Badge>}
                  {h.crossfadeMs > 0 && <Badge variant="outline" className="text-[10px]">xfade {h.crossfadeMs}ms</Badge>}
                  <span className="text-muted-foreground ml-auto truncate max-w-[180px]">{h.fileNames.join(", ")}</span>
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
            <strong className="text-foreground">Privacy:</strong> Audio decoding, resampling,
            crossfade, and WAV encoding all happen locally in your browser via the Web Audio
            API and a pure-JS RIFF encoder. No file is ever uploaded. History metadata is
            stored in localStorage on this device only.
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
