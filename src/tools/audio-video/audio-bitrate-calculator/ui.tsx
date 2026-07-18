"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  SAMPLE_RATES,
  BIT_DEPTHS,
  CHANNEL_LAYOUTS,
  FORMATS,
  QUALITY_PRESETS,
  getFormat,
  getBitDepth,
  getChannelLayout,
  computeAll,
  computeEffectiveBitrate,
  estimateFileSize,
  reverseCalculateBitrate,
  computeQualityScore,
  compareFormats,
  formatBytes,
  formatBitrate,
  formatDuration,
  renderTextReport,
  renderCsvReport,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type AudioFormatId,
  type BitDepthId,
  type ChannelLayoutId,
  type QualityPreset,
  type HistoryEntry,
} from "./logic";
import { Calculator, History, ArrowRightLeft, ArrowDownToLine, Activity } from "lucide-react";

export default function AudioBitrateCalculator() {
  const [format, setFormat] = useState<AudioFormatId>("pcm");
  const [duration, setDuration] = useState("180");
  const [sampleRate, setSampleRate] = useState("44100");
  const [bitDepth, setBitDepth] = useState<BitDepthId>("16");
  const [channels, setChannels] = useState<ChannelLayoutId>("stereo");
  const [quality, setQuality] = useState<QualityPreset>("high");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Reverse-calculator mode
  const [targetSizeMB, setTargetSizeMB] = useState("5");
  const [reverseDuration, setReverseDuration] = useState("180");
  const [reverseResult, setReverseResult] = useState<number | null>(null);

  // Comparison mode
  const [compareFormatB, setCompareFormatB] = useState<AudioFormatId>("mp3");

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.format) setFormat(p.format);
      if (p.duration) setDuration(p.duration);
      if (p.sampleRate) setSampleRate(p.sampleRate);
      if (p.bitDepth) setBitDepth(p.bitDepth);
      if (p.channels) setChannels(p.channels);
      if (p.quality) setQuality(p.quality);
      if (p.format || p.duration) toast.info("Loaded from share link");
    }
  }, []);

  const durationSec = useMemo(() => {
    const n = parseFloat(duration);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }, [duration]);

  const sampleRateHz = useMemo(() => {
    const n = parseInt(sampleRate, 10);
    return Number.isFinite(n) && n > 0 ? n : 44100;
  }, [sampleRate]);

  const stats = useMemo(() => computeAll({
    format,
    durationSeconds: durationSec,
    sampleRateHz,
    bitDepth,
    channels,
    quality,
  }), [format, durationSec, sampleRateHz, bitDepth, channels, quality]);

  const textReport = useMemo(() => renderTextReport(stats), [stats]);
  const csvReport = useMemo(() => renderCsvReport(stats), [stats]);

  // Comparison stats (format B uses same params except format)
  const compareStatsB = useMemo(() => computeAll({
    format: compareFormatB,
    durationSeconds: durationSec,
    sampleRateHz,
    bitDepth,
    channels,
    quality,
  }), [compareFormatB, durationSec, sampleRateHz, bitDepth, channels, quality]);

  const comparisonRows = useMemo(
    () => compareFormats(stats, compareStatsB),
    [stats, compareStatsB],
  );

  const fmt = useMemo(() => getFormat(format), [format]);

  const handleReverse = useCallback(() => {
    const size = parseFloat(targetSizeMB);
    const dur = parseFloat(reverseDuration);
    if (!Number.isFinite(size) || !Number.isFinite(dur) || size <= 0 || dur <= 0) {
      toast.error("Enter valid target size (MB) and duration (seconds)");
      setReverseResult(null);
      return;
    }
    const kbps = reverseCalculateBitrate(size, dur);
    setReverseResult(kbps);
    toast.success(`Required bitrate: ${kbps.toFixed(1)} kbps`);
  }, [targetSizeMB, reverseDuration]);

  const handleSaveHistory = useCallback(() => {
    if (durationSec > 0) {
      saveHistory({
        ts: Date.now(),
        format,
        durationSeconds: durationSec,
        bitrateKbps: stats.bitrateKbps,
        fileSizeBytes: stats.fileSizeBytes,
        qualityScore: stats.qualityScore,
      });
      setHistory(loadHistory());
    }
  }, [durationSec, format, stats]);

  const handleClear = useCallback(() => {
    setDuration("180");
    setSampleRate("44100");
    setBitDepth("16");
    setChannels("stereo");
    setQuality("high");
    setFormat("pcm");
    setReverseResult(null);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Calculator className="h-4 w-4" /> Inputs
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="abc-format" className="text-xs">Format</Label>
              <select
                id="abc-format"
                value={format}
                onChange={(e) => setFormat(e.target.value as AudioFormatId)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {FORMATS.map((f) => (
                  <option key={f.id} value={f.id}>{f.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="abc-duration" className="text-xs">Duration (seconds)</Label>
              <Input
                id="abc-duration"
                type="number"
                min="0"
                step="0.1"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                {formatDuration(durationSec)} ({durationSec} s)
              </p>
            </div>
          </div>

          {fmt.rateDependsOnPcmParams && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="abc-sr" className="text-xs">Sample rate</Label>
                <select
                  id="abc-sr"
                  value={sampleRate}
                  onChange={(e) => setSampleRate(e.target.value)}
                  className="h-9 w-full text-xs rounded border bg-background px-2"
                >
                  {SAMPLE_RATES.map((s) => (
                    <option key={s.hz} value={s.hz}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="abc-bd" className="text-xs">Bit depth</Label>
                <select
                  id="abc-bd"
                  value={bitDepth}
                  onChange={(e) => setBitDepth(e.target.value as BitDepthId)}
                  className="h-9 w-full text-xs rounded border bg-background px-2"
                >
                  {BIT_DEPTHS.map((b) => (
                    <option key={b.id} value={b.id}>{b.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="abc-ch" className="text-xs">Channels</Label>
                <select
                  id="abc-ch"
                  value={channels}
                  onChange={(e) => setChannels(e.target.value as ChannelLayoutId)}
                  className="h-9 w-full text-xs rounded border bg-background px-2"
                >
                  {CHANNEL_LAYOUTS.map((c) => (
                    <option key={c.id} value={c.id}>{c.label} — {c.description}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {fmt.hasQualityPreset && (
            <div className="space-y-1.5">
              <Label htmlFor="abc-q" className="text-xs">Quality preset (lossy)</Label>
              <select
                id="abc-q"
                value={quality}
                onChange={(e) => setQuality(e.target.value as QualityPreset)}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {QUALITY_PRESETS.map((q) => (
                  <option key={q.id} value={q.id}>{q.label} — {q.description}</option>
                ))}
              </select>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Activity className="h-4 w-4" /> Summary stats
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <Stat label="Format" value={fmt.label} />
            <Stat label="Bitrate" value={formatBitrate(stats.bitrateBps)} />
            <Stat label="File size" value={formatBytes(stats.fileSizeBytes)} />
            <Stat label="Streaming req" value={formatBitrate(stats.streamingBps)} />
            <Stat label="Quality score" value={`${stats.qualityScore}/100`} highlight={stats.qualityScore >= 75 ? "good" : stats.qualityScore < 50 ? "bad" : undefined} />
            <Stat label="Duration" value={formatDuration(stats.durationSeconds)} />
            <Stat label="Bitrate (kbps)" value={stats.bitrateKbps.toFixed(1)} />
            <Stat label="File size (bytes)" value={stats.fileSizeBytes.toLocaleString()} />
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <CopyButton getText={() => { handleSaveHistory(); return textReport; }} label="Copy text report" />
            <DownloadButton getText={() => { handleSaveHistory(); return textReport; }} filename="audio-bitrate-report.txt" mime="text/plain" label="Download .txt" />
            <DownloadButton getText={() => csvReport} filename="audio-bitrate-report.csv" mime="text/csv" label="Download CSV" />
            <ShareButton getUrl={() => buildShareUrl({
              format, duration, sampleRate, bitDepth, channels, quality,
            })} />
            <ClearButton onClick={handleClear} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <ArrowDownToLine className="h-4 w-4" /> Reverse calculator — target file size → required bitrate
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="abc-rsize" className="text-xs">Target file size (MB)</Label>
              <Input
                id="abc-rsize"
                type="number"
                min="0"
                step="0.1"
                value={targetSizeMB}
                onChange={(e) => setTargetSizeMB(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="abc-rdur" className="text-xs">Duration (seconds)</Label>
              <Input
                id="abc-rdur"
                type="number"
                min="0"
                step="0.1"
                value={reverseDuration}
                onChange={(e) => setReverseDuration(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </div>
          <Button onClick={handleReverse} variant="outline" size="sm">Calculate required bitrate</Button>
          {reverseResult !== null && (
            <div className="rounded border bg-background px-3 py-2 text-xs">
              <span className="text-muted-foreground">Required bitrate: </span>
              <span className="font-mono font-semibold text-foreground">{reverseResult.toFixed(2)} kbps</span>
              <span className="text-muted-foreground"> ({formatBitrate(reverseResult * 1000)})</span>
              <div className="text-[10px] text-muted-foreground mt-1">
                Quality score (MP3): {computeQualityScore("mp3", reverseResult)}/100 ·
                AAC: {computeQualityScore("aac", reverseResult)}/100 ·
                Opus: {computeQualityScore("opus", reverseResult)}/100
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <ArrowRightLeft className="h-4 w-4" /> Format comparison — same duration, two formats
          </h3>
          <div className="space-y-1.5">
            <Label htmlFor="abc-cmp" className="text-xs">Compare {fmt.label} with:</Label>
            <select
              id="abc-cmp"
              value={compareFormatB}
              onChange={(e) => setCompareFormatB(e.target.value as AudioFormatId)}
              className="h-9 w-full text-xs rounded border bg-background px-2"
            >
              {FORMATS.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left">
                  <th className="py-1.5 px-2 font-medium">Property</th>
                  <th className="py-1.5 px-2 font-medium">{fmt.label} (A)</th>
                  <th className="py-1.5 px-2 font-medium">{getFormat(compareFormatB).label} (B)</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-1.5 px-2 text-muted-foreground">{row.property}</td>
                    <td className="py-1.5 px-2 font-mono">{row.formatA}</td>
                    <td className="py-1.5 px-2 font-mono">{row.formatB}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

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
                  <Badge variant="secondary" className="text-[10px]">{getFormat(h.format).label}</Badge>
                  <Badge variant="outline" className="text-[10px]">{h.bitrateKbps.toFixed(0)} kbps</Badge>
                  <span className="text-muted-foreground">{formatBytes(h.fileSizeBytes)}</span>
                  <span className="text-muted-foreground">· {formatDuration(h.durationSeconds)}</span>
                  <Badge variant="outline" className="text-[10px]">{h.qualityScore}/100</Badge>
                  <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!durationSec && (
        <EmptyState
          title="Enter a duration to calculate"
          hint="Pick a format, enter the duration in seconds, and (for PCM/FLAC/ALAC) set the sample rate, bit depth, and channels. We'll compute the bitrate, file size, streaming bandwidth, and quality score locally."
          icon={<Calculator className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All calculations run locally in
            your browser. No data is uploaded. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: "bad" | "good";
}) {
  const color = highlight === "bad"
    ? "text-red-600 dark:text-red-400"
    : highlight === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${color} break-all`}>{value}</div>
    </div>
  );
}
