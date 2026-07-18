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
  CHANNEL_VIEWS,
  CHANNEL_VIEW_LABELS,
  ZOOM_PRESETS,
  ZOOM_TO_NUMBER,
  ZOOM_LABELS,
  SILENCE_THRESHOLD_PRESETS,
  SILENCE_THRESHOLD_TO_DB,
  SILENCE_THRESHOLD_LABELS,
  MIN_SILENCE_DURATION_PRESETS,
  MIN_SILENCE_DURATION_TO_MS,
  MIN_SILENCE_DURATION_LABELS,
  WAVEFORM_COLOR_PRESETS,
  WAVEFORM_COLOR_LABELS,
  selectChannel,
  computeWindowSize,
  computePeakPerWindow,
  computeRmsPerWindow,
  dbToAmplitude,
  amplitudeToDb,
  detectSilenceRegions,
  findTopPeaks,
  getWaveformColor,
  computeWaveformStats,
  formatTimestamp,
  formatDb,
  renderText,
  renderCsv,
  renderSilenceCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ChannelView,
  type ZoomPreset,
  type SilenceThresholdPreset,
  type MinSilenceDurationPreset,
  type WaveformColorPreset,
  type HistoryEntry,
  type WaveformAnalysis,
} from "./logic";
import { AudioWaveform, Upload, History, FileAudio, Activity, ScrollText } from "lucide-react";

interface DecodedAudio {
  audioBuffer: AudioBuffer;
  fileName: string;
  fileSize: number;
}

const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 280;

export default function AudioWaveformViewer() {
  const [decoded, setDecoded] = useState<DecodedAudio | null>(null);
  const [channelView, setChannelView] = useState<ChannelView>("mono-mix");
  const [zoomPreset, setZoomPreset] = useState<ZoomPreset>("1");
  const [colorPreset, setColorPreset] = useState<WaveformColorPreset>("blue");
  const [silenceThresholdPreset, setSilenceThresholdPreset] = useState<SilenceThresholdPreset>("-50");
  const [minSilencePreset, setMinSilencePreset] = useState<MinSilenceDurationPreset>("500ms");
  const [topPeaks, setTopPeaks] = useState(10);
  const [scrollPct, setScrollPct] = useState(0); // 0..1
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [analysis, setAnalysis] = useState<WaveformAnalysis | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.channelView) setChannelView(p.channelView);
      if (p.zoom) setZoomPreset(p.zoom);
      if (p.color) setColorPreset(p.color);
      if (p.silenceThreshold) setSilenceThresholdPreset(p.silenceThreshold);
      if (p.minSilenceDuration) setMinSilencePreset(p.minSilenceDuration);
      if (p.topPeaks) setTopPeaks(p.topPeaks);
      const any = p.channelView || p.zoom || p.color || p.silenceThreshold || p.minSilenceDuration || p.topPeaks;
      if (any) toast.info("Loaded settings from share link");
    }
    return () => {
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
    setAnalysis(null);
    setScrollPct(0);
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
      // Auto-pick mono-mix for multi-channel, left for single-channel
      setChannelView(audioBuffer.numberOfChannels > 1 ? "mono-mix" : "left");
      toast.success(`Loaded ${file.name} (${audioBuffer.duration.toFixed(2)}s)`);
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

  // Build channel data for selected view
  const channelsData = useMemo<Float32Array[]>(() => {
    if (!decoded) return [];
    const out: Float32Array[] = [];
    const ab = decoded.audioBuffer;
    const all: Float32Array[] = [];
    for (let c = 0; c < ab.numberOfChannels; c++) all.push(ab.getChannelData(c));
    if (channelView === "both") {
      out.push(selectChannel(all, "left"));
      out.push(selectChannel(all, "right"));
    } else {
      out.push(selectChannel(all, channelView));
    }
    return out;
  }, [decoded, channelView]);

  const zoom = ZOOM_TO_NUMBER[zoomPreset];
  const sampleRate = decoded?.audioBuffer.sampleRate ?? 44100;
  const totalSamples = channelsData[0]?.length ?? 0;
  const windowSize = useMemo(
    () => computeWindowSize(totalSamples, CANVAS_WIDTH, zoom),
    [totalSamples, zoom],
  );
  const thresholdDb = SILENCE_THRESHOLD_TO_DB[silenceThresholdPreset];
  const thresholdAmp = dbToAmplitude(thresholdDb);
  const minSilenceMs = MIN_SILENCE_DURATION_TO_MS[minSilencePreset];

  // Compute per-window peaks & RMS for each channel
  const perWindow = useMemo(() => {
    if (channelsData.length === 0 || windowSize <= 0) return [];
    return channelsData.map((c) => ({
      peaks: computePeakPerWindow(c, windowSize),
      rms: computeRmsPerWindow(c, windowSize),
    }));
  }, [channelsData, windowSize]);

  // Compute silence regions on the first (or only) channel
  const silenceRegions = useMemo(() => {
    if (channelsData.length === 0) return [];
    return detectSilenceRegions(channelsData[0], sampleRate, thresholdAmp, minSilenceMs);
  }, [channelsData, sampleRate, thresholdAmp, minSilenceMs]);

  // Find top peaks from the first channel's per-window peaks
  const topPeaksList = useMemo(() => {
    if (perWindow.length === 0) return [];
    return findTopPeaks(perWindow[0].peaks, windowSize, sampleRate, topPeaks);
  }, [perWindow, windowSize, sampleRate, topPeaks]);

  // Summary stats
  const stats = useMemo(() => {
    if (channelsData.length === 0 || !decoded) return null;
    return computeWaveformStats(
      channelsData[0],
      sampleRate,
      decoded.audioBuffer.numberOfChannels,
      silenceRegions,
      topPeaksList,
    );
  }, [channelsData, sampleRate, decoded, silenceRegions, topPeaksList]);

  // Draw the waveform on canvas whenever inputs change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || perWindow.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawWaveform(
      ctx,
      canvas.width,
      canvas.height,
      perWindow,
      silenceRegions,
      sampleRate,
      windowSize,
      getWaveformColor(colorPreset),
      scrollPct,
      channelView === "both",
    );
  }, [perWindow, silenceRegions, sampleRate, windowSize, colorPreset, scrollPct, channelView]);

  // Build analysis result for export
  const analysisResult: WaveformAnalysis | null = useMemo(() => {
    if (!decoded || !stats) return null;
    return {
      fileName: decoded.fileName,
      durationSeconds: decoded.audioBuffer.duration,
      sampleRate,
      channels: decoded.audioBuffer.numberOfChannels,
      channelView,
      zoom,
      silenceThresholdDb: thresholdDb,
      minSilenceDurationMs: minSilenceMs,
      stats,
      silenceRegions,
      peaks: topPeaksList,
    };
  }, [decoded, stats, sampleRate, channelView, zoom, thresholdDb, minSilenceMs, silenceRegions, topPeaksList]);

  // Save history when analysis is computed (debounced via effect)
  useEffect(() => {
    if (!analysisResult || !stats) return;
    const entry: HistoryEntry = {
      ts: Date.now(),
      fileName: analysisResult.fileName,
      durationSeconds: analysisResult.durationSeconds,
      sampleRate: analysisResult.sampleRate,
      channels: analysisResult.channels,
      channelView: analysisResult.channelView,
      zoom: analysisResult.zoom,
      silenceThresholdDb: analysisResult.silenceThresholdDb,
      minSilenceDurationMs: analysisResult.minSilenceDurationMs,
      silenceCount: stats.silenceCount,
      silencePct: stats.silencePct,
      peakCount: stats.peakCount,
    };
    saveHistory(entry);
    setHistory(loadHistory());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisResult?.fileName, channelView, zoomPreset, silenceThresholdPreset, minSilencePreset, topPeaks]);

  const handleReset = useCallback(() => {
    setDecoded(null);
    setAnalysis(null);
    setError(null);
    setDecodeError(null);
    setScrollPct(0);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const textReport = useMemo(() => analysisResult ? renderText(analysisResult) : "", [analysisResult]);
  const csvReport = useMemo(() => analysisResult ? renderCsv(analysisResult) : "", [analysisResult]);
  const silenceCsv = useMemo(() => analysisResult ? renderSilenceCsv(analysisResult) : "", [analysisResult]);

  const visibleSamples = CANVAS_WIDTH * windowSize;
  const maxScroll = Math.max(0, totalSamples - visibleSamples);
  const scrollSamples = Math.floor(scrollPct * maxScroll);
  const scrollSeconds = scrollSamples / sampleRate;
  const visibleDurationSeconds = visibleSamples / sampleRate;

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
                ? `${(decoded.fileSize / 1024 / 1024).toFixed(2)} MB · ${decoded.audioBuffer.duration.toFixed(2)}s · ${sampleRate} Hz · ${decoded.audioBuffer.numberOfChannels} ch`
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
              <AudioWaveform className="h-4 w-4" /> Waveform settings
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="awv-ch" className="text-xs">Channel view</Label>
                <select
                  id="awv-ch"
                  value={channelView}
                  onChange={(e) => setChannelView(e.target.value as ChannelView)}
                  className="h-9 w-full text-xs rounded border bg-background px-2"
                  disabled={decoded.audioBuffer.numberOfChannels < 2}
                >
                  {CHANNEL_VIEWS.map((c) => <option key={c} value={c}>{CHANNEL_VIEW_LABELS[c]}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="awv-zoom" className="text-xs">Zoom</Label>
                <select
                  id="awv-zoom"
                  value={zoomPreset}
                  onChange={(e) => setZoomPreset(e.target.value as ZoomPreset)}
                  className="h-9 w-full text-xs rounded border bg-background px-2"
                >
                  {ZOOM_PRESETS.map((z) => <option key={z} value={z}>{ZOOM_LABELS[z]}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="awv-color" className="text-xs">Color preset</Label>
                <select
                  id="awv-color"
                  value={colorPreset}
                  onChange={(e) => setColorPreset(e.target.value as WaveformColorPreset)}
                  className="h-9 w-full text-xs rounded border bg-background px-2"
                >
                  {WAVEFORM_COLOR_PRESETS.map((c) => <option key={c} value={c}>{WAVEFORM_COLOR_LABELS[c]}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="awv-sth" className="text-xs">Silence threshold</Label>
                <select
                  id="awv-sth"
                  value={silenceThresholdPreset}
                  onChange={(e) => setSilenceThresholdPreset(e.target.value as SilenceThresholdPreset)}
                  className="h-9 w-full text-xs rounded border bg-background px-2"
                >
                  {SILENCE_THRESHOLD_PRESETS.map((s) => <option key={s} value={s}>{SILENCE_THRESHOLD_LABELS[s]}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="awv-msd" className="text-xs">Min silence duration</Label>
                <select
                  id="awv-msd"
                  value={minSilencePreset}
                  onChange={(e) => setMinSilencePreset(e.target.value as MinSilenceDurationPreset)}
                  className="h-9 w-full text-xs rounded border bg-background px-2"
                >
                  {MIN_SILENCE_DURATION_PRESETS.map((m) => <option key={m} value={m}>{MIN_SILENCE_DURATION_LABELS[m]}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="awv-peaks" className="text-xs">Top peaks</Label>
                <select
                  id="awv-peaks"
                  value={topPeaks}
                  onChange={(e) => setTopPeaks(parseInt(e.target.value, 10))}
                  className="h-9 w-full text-xs rounded border bg-background px-2"
                >
                  {[3, 5, 10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <ShareButton getUrl={() => buildShareUrl({
                channelView, zoom: zoomPreset, color: colorPreset,
                silenceThreshold: silenceThresholdPreset, minSilenceDuration: minSilencePreset, topPeaks,
              })} />
              <ClearButton onClick={handleReset} />
            </div>
          </CardContent>
        </Card>
      )}

      {decoded && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <AudioWaveform className="h-4 w-4" /> Waveform
              </h3>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <Badge variant="outline">Window: {windowSize} samples</Badge>
                <Badge variant="outline">Visible: {visibleDurationSeconds.toFixed(2)}s</Badge>
                <Badge variant="outline">@ {formatTimestamp(scrollSeconds)}</Badge>
              </div>
            </div>
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="w-full h-[280px] rounded border"
            />
            {maxScroll > 0 && (
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Scroll / pan</Label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.001}
                  value={scrollPct}
                  onChange={(e) => setScrollPct(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">
              Showing {perWindow.length} channel(s) · {totalSamples.toLocaleString()} total samples ·
              {" "}{perWindow[0]?.peaks.length ?? 0} windows rendered
            </p>
          </CardContent>
        </Card>
      )}

      {stats && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Activity className="h-4 w-4" /> Summary stats
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Duration" value={formatTimestamp(stats.durationSeconds)} />
              <Stat label="Sample rate" value={`${stats.sampleRate} Hz`} />
              <Stat label="Channels" value={stats.channels} />
              <Stat label="Total samples" value={stats.totalSamples.toLocaleString()} />
              <Stat label="Peak amplitude" value={stats.peakAmplitude.toFixed(4)} />
              <Stat label="Peak (dB)" value={formatDb(stats.peakAmplitudeDb)} />
              <Stat label="Peak timestamp" value={formatTimestamp(stats.peakTimestampSeconds)} />
              <Stat label="RMS (dB)" value={formatDb(stats.rmsAmplitudeDb)} />
              <Stat label="Silence regions" value={stats.silenceCount} />
              <Stat label="Total silence" value={formatTimestamp(stats.silenceTotalSeconds)} />
              <Stat label="Silence %" value={`${stats.silencePct.toFixed(2)}%`} />
              <Stat label="Peaks found" value={stats.peakCount} />
            </div>
          </CardContent>
        </Card>
      )}

      {silenceRegions.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <ScrollText className="h-4 w-4" /> Silence regions ({silenceRegions.length})
            </h3>
            <div className="space-y-1 max-h-[300px] overflow-auto">
              {silenceRegions.slice(0, 50).map((r, i) => (
                <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">#{i + 1}</Badge>
                  <span className="font-mono text-foreground">{formatTimestamp(r.startSeconds)} → {formatTimestamp(r.endSeconds)}</span>
                  <Badge variant="secondary" className="text-[10px]">{formatTimestamp(r.durationSeconds)}</Badge>
                  <span className="text-muted-foreground ml-auto">peak {formatDb(amplitudeToDb(r.peakAmplitude))}</span>
                </div>
              ))}
              {silenceRegions.length > 50 && (
                <p className="text-[10px] text-muted-foreground">Showing first 50 of {silenceRegions.length}.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {topPeaksList.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <FileAudio className="h-4 w-4" /> Top {topPeaksList.length} amplitude peaks
            </h3>
            <div className="space-y-1 max-h-[300px] overflow-auto">
              {topPeaksList.map((p, i) => (
                <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">#{i + 1}</Badge>
                  <span className="font-mono text-foreground">{formatTimestamp(p.timestampSeconds)}</span>
                  <Badge variant="outline" className="text-[10px]">amp {p.amplitude.toFixed(4)}</Badge>
                  <Badge variant="outline" className="text-[10px]">{formatDb(p.amplitudeDb)}</Badge>
                  <span className="text-muted-foreground ml-auto">sample {p.sampleIndex.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <CopyButton getText={() => textReport} label="Copy report" />
              <DownloadButton getText={() => textReport} filename="waveform-report.txt" mime="text/plain" label="Download .txt" />
              <DownloadButton getText={() => csvReport} filename="waveform-events.csv" mime="text/csv" label="Download events CSV" />
              <DownloadButton getText={() => silenceCsv} filename="waveform-silence.csv" mime="text/csv" label="Download silence CSV" />
            </div>
          </CardContent>
        </Card>
      )}

      {!decoded && !decodeError && (
        <EmptyState
          title="Drop an audio file to view its waveform"
          hint="Drag and drop or click to browse. We decode it locally with the Web Audio API and render peak/RMS amplitudes per pixel column for fast zoomable visualization."
          icon={<AudioWaveform className="h-8 w-8" />}
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
                  <Badge variant="outline" className="text-[10px]">{h.channelView}</Badge>
                  <Badge variant="outline" className="text-[10px]">{h.zoom}×</Badge>
                  <span className="font-mono text-muted-foreground">{formatTimestamp(h.durationSeconds)}</span>
                  <span className="text-muted-foreground">{h.silenceCount} silences ({h.silencePct.toFixed(1)}%)</span>
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
            <strong className="text-foreground">Privacy:</strong> Audio decoding and
            waveform rendering all happen locally in your browser via the Web Audio
            API and Canvas API. No file is ever uploaded. Analysis metadata in
            history is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/** Draw the waveform on a canvas: peak envelope + RMS fill + silence overlays. */
function drawWaveform(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  perWindow: { peaks: Float32Array; rms: Float32Array }[],
  silenceRegions: { startSample: number; endSample: number }[],
  sampleRate: number,
  windowSize: number,
  colors: { peak: string; rms: string; silence: string; background: string },
  scrollPct: number,
  isBothChannels: boolean,
) {
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, width, height);

  if (perWindow.length === 0) return;
  void sampleRate;

  const totalWindows = perWindow[0].peaks.length;
  const windowsPerPixel = Math.max(1, Math.ceil(totalWindows / width));
  const visibleWindows = width * windowsPerPixel;
  const maxScrollWindows = Math.max(0, totalWindows - visibleWindows);
  const startWindow = Math.floor(scrollPct * maxScrollWindows);

  const channels = perWindow.length;
  const channelHeight = isBothChannels ? Math.floor(height / 2) : height;

  // Helper: map absolute sample index → canvas x
  const sampleToX = (sample: number): number => {
    const win = sample / Math.max(1, windowSize);
    return (win - startWindow) / windowsPerPixel;
  };

  for (let ch = 0; ch < channels; ch++) {
    const peaks = perWindow[ch].peaks;
    const rms = perWindow[ch].rms;
    const centerY = isBothChannels
      ? (ch === 0 ? channelHeight / 2 : channelHeight + channelHeight / 2)
      : height / 2;
    const halfH = (isBothChannels ? channelHeight : height) / 2;
    const top = isBothChannels ? (ch === 0 ? 0 : channelHeight) : 0;

    // Draw silence regions as colored bands
    ctx.fillStyle = colors.silence;
    for (const reg of silenceRegions) {
      const x1 = Math.floor(sampleToX(reg.startSample));
      const x2 = Math.ceil(sampleToX(reg.endSample));
      if (x2 < 0 || x1 > width) continue;
      const x = Math.max(0, x1);
      const w = Math.min(width, x2) - x;
      if (w > 0) {
        ctx.fillRect(x, top, w, channelHeight);
      }
    }

    // Draw RMS fill (lighter color)
    ctx.fillStyle = colors.rms;
    for (let x = 0; x < width; x++) {
      const wStart = startWindow + x * windowsPerPixel;
      const wEnd = Math.min(totalWindows, wStart + windowsPerPixel);
      if (wStart >= totalWindows) break;
      let maxRms = 0;
      for (let w = wStart; w < wEnd; w++) {
        if (rms[w] > maxRms) maxRms = rms[w];
      }
      const h = maxRms * halfH;
      ctx.fillRect(x, centerY - h, 1, Math.max(1, h * 2));
    }

    // Draw peak outline (brighter)
    ctx.fillStyle = colors.peak;
    for (let x = 0; x < width; x++) {
      const wStart = startWindow + x * windowsPerPixel;
      const wEnd = Math.min(totalWindows, wStart + windowsPerPixel);
      if (wStart >= totalWindows) break;
      let maxPeak = 0;
      for (let w = wStart; w < wEnd; w++) {
        if (peaks[w] > maxPeak) maxPeak = peaks[w];
      }
      const h = maxPeak * halfH;
      ctx.fillRect(x, centerY - h, 1, 1);
      ctx.fillRect(x, centerY + h - 1, 1, 1);
    }

    // Center line
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
  }

  // Channel labels for "both" mode
  if (isBothChannels) {
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "10px monospace";
    ctx.fillText("L", 4, 12);
    ctx.fillText("R", 4, channelHeight + 12);
  }
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
