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
  DBFS_PRESETS,
  DBFS_PRESET_VALUES,
  DBFS_PRESET_LABELS,
  DEFAULT_TARGET_DBFS,
  MODE_LABELS,
  MODE_DESCRIPTIONS,
  dbfsToLinear,
  linearToDbfs,
  detectPeak,
  detectPeakMulti,
  computeRms,
  computeRmsMulti,
  rmsToDbfs,
  computeGainForMode,
  computePeakGain,
  computeRmsGain,
  maxSafeGain,
  maxSafeGainMulti,
  scaleSamplesMulti,
  clampSamples,
  encodeWav,
  renderReport,
  formatDbfs,
  formatGain,
  computeSummaryStats,
  generateFilename,
  formatBytes,
  formatDuration,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type NormalizationMode,
  type DbfsPreset,
  type HistoryEntry,
  type NormalizationReport,
} from "./logic";
import {
  Gauge, Upload, Download, History, Activity,
  ArrowRight, FileAudio, AlertTriangle,
} from "lucide-react";

interface DecodedAudio {
  audioBuffer: AudioBuffer;
  fileName: string;
  fileSize: number;
}

interface NormalizeResult {
  blob: Blob;
  url: string;
  filename: string;
  report: NormalizationReport;
  sizeBytes: number;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
}

export default function AudioVolumeNormalizer() {
  const [mode, setMode] = useState<NormalizationMode>("peak");
  const [targetDbfsPreset, setTargetDbfsPreset] = useState<DbfsPreset>("-16");
  const [customTarget, setCustomTarget] = useState<string>("");
  const [useCustom, setUseCustom] = useState(false);

  const [decoded, setDecoded] = useState<DecodedAudio | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<NormalizeResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.mode) setMode(p.mode);
      if (p.targetDbfs) setTargetDbfsPreset(p.targetDbfs);
      if (p.mode || p.targetDbfs) {
        toast.info("Loaded settings from share link");
      }
    }
    return () => {
      if (result) URL.revokeObjectURL(result.url);
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  const getAudioContext = useCallback((): AudioContext => {
    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      const Ctor = window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioContextRef.current = new Ctor();
    }
    return audioContextRef.current;
  }, []);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setDecodeError(null);
    setResult(null);
    if (!file.type.startsWith("audio/") &&
      !/\.(wav|mp3|ogg|webm|m4a|aac|flac|mp4|oga)$/i.test(file.name)) {
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
      toast.success(`Loaded ${file.name} (${formatDuration(audioBuffer.duration)})`);
    } catch (e) {
      setDecodeError(
        `Could not decode audio file: ${(e as Error).message}. The format may not be supported by your browser.`,
      );
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

  // ---- Compute target dBFS from preset or custom input ----
  const targetDbfs = useMemo(() => {
    if (useCustom) {
      const n = parseFloat(customTarget);
      return Number.isFinite(n) ? n : DEFAULT_TARGET_DBFS;
    }
    return DBFS_PRESET_VALUES[targetDbfsPreset];
  }, [useCustom, customTarget, targetDbfsPreset]);

  // ---- Live input analysis (for preview stats before applying) ----
  const inputAnalysis = useMemo(() => {
    if (!decoded) return null;
    const channels: Float32Array[] = [];
    for (let c = 0; c < decoded.audioBuffer.numberOfChannels; c++) {
      channels.push(decoded.audioBuffer.getChannelData(c));
    }
    const peak = detectPeakMulti(channels);
    const rms = computeRmsMulti(channels);
    return {
      peak,
      rms,
      peakDbfs: linearToDbfs(peak),
      rmsDbfs: rmsToDbfs(rms),
    };
  }, [decoded]);

  // ---- Live gain preview (before applying) ----
  const gainPreview = useMemo(() => {
    if (!inputAnalysis) return null;
    const currentValue = mode === "peak" ? inputAnalysis.peak : inputAnalysis.rms;
    const requestedGain = computeGainForMode(mode, currentValue, targetDbfs);
    // Determine if clipping prevention will kick in
    const channels = decoded
      ? Array.from({ length: decoded.audioBuffer.numberOfChannels }, (_, c) =>
          decoded.audioBuffer.getChannelData(c),
        )
      : [];
    const safeGain = maxSafeGainMulti(channels, requestedGain);
    const willClipPrevent = safeGain < requestedGain;
    return {
      requestedGain,
      safeGain,
      willClipPrevent,
      requestedGainDb: linearToDbfs(requestedGain),
      safeGainDb: linearToDbfs(safeGain),
    };
  }, [inputAnalysis, mode, targetDbfs, decoded]);

  // ---- Normalize action ----
  const handleNormalize = useCallback(async () => {
    if (!decoded || !inputAnalysis || !gainPreview) return;
    setError(null);
    setBusy(true);
    try {
      const { audioBuffer } = decoded;
      // Get channel data
      const channelData: Float32Array[] = [];
      for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
        channelData.push(audioBuffer.getChannelData(c).slice());
      }

      // Compute gain
      const currentValue = mode === "peak" ? inputAnalysis.peak : inputAnalysis.rms;
      const requestedGain = computeGainForMode(mode, currentValue, targetDbfs);
      const appliedGain = maxSafeGainMulti(channelData, requestedGain);
      const clippedToPreventClipping = appliedGain < requestedGain;

      // Apply gain
      const scaled = scaleSamplesMulti(channelData, appliedGain);
      // Final clamp (safety net)
      for (const c of scaled) clampSamples(c);

      // Analyze output
      const outputPeak = detectPeakMulti(scaled);
      const outputRms = computeRmsMulti(scaled);
      const inputRmsLinear = inputAnalysis.rms;
      const inputRmsDbfs = inputAnalysis.rmsDbfs;
      const inputPeakLinear = inputAnalysis.peak;
      const inputPeakDbfs = inputAnalysis.peakDbfs;

      const report: NormalizationReport = {
        mode,
        targetDbfs,
        inputPeakLinear,
        inputPeakDbfs,
        inputRmsLinear,
        inputRmsDbfs,
        requestedGainLinear: requestedGain,
        requestedGainDb: linearToDbfs(requestedGain),
        appliedGainLinear: appliedGain,
        appliedGainDb: linearToDbfs(appliedGain),
        outputPeakLinear: outputPeak,
        outputPeakDbfs: linearToDbfs(outputPeak),
        outputRmsLinear: outputRms,
        outputRmsDbfs: rmsToDbfs(outputRms),
        clippedToPreventClipping,
        durationSeconds: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels,
      };

      // Encode WAV
      const wav = encodeWav(scaled, audioBuffer.sampleRate);
      const blob = new Blob([wav.buffer as ArrayBuffer], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      const filename = generateFilename();
      const resultInfo: NormalizeResult = {
        blob,
        url,
        filename,
        report,
        sizeBytes: blob.size,
        durationSeconds: audioBuffer.duration,
        sampleRate: audioBuffer.sampleRate,
        channels: audioBuffer.numberOfChannels,
      };
      setResult((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return resultInfo;
      });

      // Save history
      const entry: HistoryEntry = {
        ts: Date.now(),
        originalName: decoded.fileName,
        mode,
        targetDbfs,
        inputPeakDbfs: report.inputPeakDbfs,
        inputRmsDbfs: report.inputRmsDbfs,
        outputPeakDbfs: report.outputPeakDbfs,
        outputRmsDbfs: report.outputRmsDbfs,
        appliedGainDb: report.appliedGainDb,
        durationSeconds: audioBuffer.duration,
        outputSizeBytes: blob.size,
        clippedToPreventClipping,
        filename,
      };
      saveHistory(entry);
      setHistory(loadHistory());

      if (clippedToPreventClipping) {
        toast.warning(
          `Normalized with reduced gain to prevent clipping (${formatBytes(blob.size)})`,
        );
      } else {
        toast.success(
          `Normalized to ${formatDbfs(targetDbfs)} (${formatBytes(blob.size)})`,
        );
      }
    } catch (e) {
      setError(`Normalization failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [decoded, inputAnalysis, gainPreview, mode, targetDbfs]);

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
    if (!result) return null;
    return computeSummaryStats(result.report, result.sizeBytes);
  }, [result]);

  const reportText = useMemo(() => {
    if (!result) return "";
    return renderReport(result.report);
  }, [result]);

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
                ? `${formatBytes(decoded.fileSize)} · ${formatDuration(decoded.audioBuffer.duration)} · ${decoded.audioBuffer.sampleRate} Hz · ${decoded.audioBuffer.numberOfChannels} ch`
                : "Supports wav, mp3, ogg, webm, m4a, aac, flac"}
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.wav,.mp3,.ogg,.webm,.m4a,.aac,.flac,.mp4,.oga"
            onChange={onFileInput}
            className="hidden"
          />
          {decodeError && <ErrorBanner message={decodeError} />}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Gauge className="h-4 w-4" /> Normalization settings
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="avn-mode" className="text-xs">Mode</Label>
              <select
                id="avn-mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as NormalizationMode)}
                disabled={busy}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(MODE_LABELS) as NormalizationMode[]).map((m) => (
                  <option key={m} value={m}>{MODE_LABELS[m]}</option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground">{MODE_DESCRIPTIONS[mode]}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="avn-target" className="text-xs">Target dBFS</Label>
              {useCustom ? (
                <div className="flex gap-2">
                  <input
                    id="avn-target"
                    type="number"
                    value={customTarget}
                    onChange={(e) => setCustomTarget(e.target.value)}
                    disabled={busy}
                    placeholder="-16"
                    className="h-9 flex-1 text-xs rounded border bg-background px-2 font-mono"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setUseCustom(false)}
                    disabled={busy}
                  >Presets</Button>
                </div>
              ) : (
                <select
                  id="avn-target"
                  value={targetDbfsPreset}
                  onChange={(e) => setTargetDbfsPreset(e.target.value as DbfsPreset)}
                  disabled={busy}
                  className="h-9 w-full text-xs rounded border bg-background px-2"
                >
                  {DBFS_PRESETS.map((p) => (
                    <option key={p} value={p}>{DBFS_PRESET_LABELS[p]}</option>
                  ))}
                  <option value="-16" disabled>── Custom ──</option>
                </select>
              )}
              {!useCustom && (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-[10px]"
                  onClick={() => { setUseCustom(true); setCustomTarget(String(targetDbfs)); }}
                  disabled={busy}
                >+ Use custom dBFS value</Button>
              )}
            </div>
          </div>

          {inputAnalysis && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-2">
              <Stat icon={<Activity className="h-3 w-3" />} label="Input peak" value={formatDbfs(inputAnalysis.peakDbfs)} />
              <Stat icon={<Activity className="h-3 w-3" />} label="Input RMS" value={formatDbfs(inputAnalysis.rmsDbfs)} />
              <Stat icon={<ArrowRight className="h-3 w-3" />} label="Target" value={formatDbfs(targetDbfs)} />
              <Stat
                icon={<Gauge className="h-3 w-3" />}
                label="Gain preview"
                value={`${formatGain(gainPreview?.safeGain ?? 0)} (${formatDbfs(gainPreview?.safeGainDb ?? Number.NEGATIVE_INFINITY)})`}
              />
            </div>
          )}

          {gainPreview?.willClipPrevent && (
            <div className="rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>
                Requested gain ({formatGain(gainPreview.requestedGain)}) would clip.
                Will reduce to {formatGain(gainPreview.safeGain)} to prevent distortion.
              </span>
            </div>
          )}

          {error && <ErrorBanner message={error} />}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={handleNormalize} disabled={busy || !decoded} className="gap-1.5">
              <ArrowRight className="h-3.5 w-3.5" /> {busy ? "Normalizing…" : "Normalize"}
            </Button>
            <ShareButton getUrl={() => buildShareUrl({
              mode,
              targetDbfs: targetDbfsPreset,
            })} />
            <ClearButton onClick={handleReset} disabled={busy} />
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <FileAudio className="h-4 w-4" /> Normalized output
            </h3>
            {result.report.clippedToPreventClipping && (
              <div className="rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>Gain was reduced from {formatGain(result.report.requestedGainLinear)} to {formatGain(result.report.appliedGainLinear)} to prevent clipping.</span>
              </div>
            )}
            <audio src={result.url} controls className="w-full" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Duration" value={formatDuration(result.durationSeconds)} />
              <Stat label="File size" value={formatBytes(result.sizeBytes)} />
              <Stat label="Format" value="WAV (PCM 16-bit)" />
              <Stat label="Filename" value={result.filename} />
            </div>
            {stats && (
              <div className="rounded border bg-background px-3 py-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">In peak: {formatDbfs(stats.inputPeakDbfs)}</Badge>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <Badge variant="secondary">Out peak: {formatDbfs(stats.outputPeakDbfs)}</Badge>
                  <Badge variant="outline">In RMS: {formatDbfs(stats.inputRmsDbfs)}</Badge>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <Badge variant="secondary">Out RMS: {formatDbfs(stats.outputRmsDbfs)}</Badge>
                  <Badge variant="default">
                    Gain: {stats.appliedGainDb >= 0 ? "+" : ""}{stats.appliedGainDb.toFixed(2)} dB
                  </Badge>
                  <Badge variant="outline">
                    Δ loudness: {stats.loudnessDeltaDb >= 0 ? "+" : ""}{stats.loudnessDeltaDb.toFixed(2)} dB
                  </Badge>
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={handleDownload} className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> Download WAV
              </Button>
              <CopyButton getText={() => result.filename} label="Copy filename" />
              <DownloadButton
                getText={() => reportText}
                filename="normalization-report.txt"
                mime="text/plain"
                label="Download report"
              />
              <CopyButton getText={() => reportText} label="Copy report" />
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Text report</h3>
            <pre className="text-[11px] font-mono whitespace-pre-wrap rounded border bg-muted/40 p-3 max-h-[400px] overflow-auto">
              {reportText}
            </pre>
          </CardContent>
        </Card>
      )}

      {!decoded && !decodeError && (
        <EmptyState
          title="Drop an audio file to normalize"
          hint="We decode it locally with the Web Audio API, analyze peak/RMS levels, compute the gain needed to reach your target dBFS, apply it uniformly, and re-encode as a 16-bit PCM WAV file."
          icon={<Gauge className="h-8 w-8" />}
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
                  <Badge variant="outline" className="text-[10px]">{h.mode}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{formatDbfs(h.targetDbfs)}</Badge>
                  <span className="font-mono text-muted-foreground">
                    {formatDbfs(h.inputRmsDbfs)} → {formatDbfs(h.outputRmsDbfs)}
                  </span>
                  <span className="text-muted-foreground">
                    Gain: {h.appliedGainDb >= 0 ? "+" : ""}{h.appliedGainDb.toFixed(2)} dB
                  </span>
                  {h.clippedToPreventClipping && (
                    <Badge variant="outline" className="text-[10px] text-amber-700 dark:text-amber-300">
                      Reduced
                    </Badge>
                  )}
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
            <strong className="text-foreground">Privacy:</strong> Audio decoding,
            analysis, gain application, and WAV encoding all happen locally in
            your browser via the Web Audio API and a pure-JS RIFF encoder. No
            file is ever uploaded. History metadata is stored in localStorage
            on this device only.
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
