"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
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
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  STRENGTH_PRESETS,
  STRENGTH_VALUES,
  STRENGTH_LABELS,
  DEFAULT_STRENGTH,
  strengthToAlpha,
  GATE_PRESETS,
  GATE_VALUES,
  GATE_LABELS,
  DEFAULT_GATE,
  FFT_SIZE_PRESETS,
  FFT_SIZE_TO_NUMBER,
  DEFAULT_FFT_SIZE,
  dbfsToLinear,
  linearToDbfs,
  estimateNoiseFloor,
  spectralSubtract,
  applyNoiseGate,
  stft,
  overlapAdd,
  encodeWav,
  computeRms,
  detectPeak,
  hasClipping,
  computeSummaryStats,
  renderReport,
  renderCsv,
  generateFilename,
  formatBytes,
  formatDuration,
  formatDbfs,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type StrengthPreset,
  type GatePreset,
  type FftSizePreset,
  type HistoryEntry,
  type NoiseReducerReport,
} from "./logic";
import {
  Waves, Upload, Download, History, FileAudio,
  Volume2, Activity, AlertTriangle, AudioWaveform,
} from "lucide-react";

interface DecodedAudio {
  audioBuffer: AudioBuffer;
  fileName: string;
  fileSize: number;
}

interface DenoiseResult {
  blob: Blob;
  url: string;
  filename: string;
  report: NoiseReducerReport;
  sizeBytes: number;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
}

export default function AudioNoiseReducer() {
  const [strength, setStrength] = useState<StrengthPreset>(DEFAULT_STRENGTH);
  const [gate, setGate] = useState<GatePreset>(DEFAULT_GATE);
  const [fftSizePreset, setFftSizePreset] = useState<FftSizePreset>(DEFAULT_FFT_SIZE);
  const [noiseMs, setNoiseMs] = useState("100");
  const [useGate, setUseGate] = useState(true);

  const [decoded, setDecoded] = useState<DecodedAudio | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<DenoiseResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.strength) setStrength(p.strength);
      if (p.gate) setGate(p.gate);
      if (p.fftSize) setFftSizePreset(p.fftSize);
      if (p.strength || p.gate || p.fftSize) {
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
      !/\.(wav|mp3|ogg|webm|m4a|aac|flac)$/i.test(file.name)) {
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

  const fftSize = FFT_SIZE_TO_NUMBER[fftSizePreset];
  const hopSize = Math.floor(fftSize / 2); // 50% overlap
  const alpha = strengthToAlpha(STRENGTH_VALUES[strength]);
  const gateThreshold = GATE_VALUES[gate];
  const noiseMsNum = Math.max(0, parseInt(noiseMs, 10) || 0);

  // ---- Live input analysis (channel 0) ----
  const inputAnalysis = useMemo(() => {
    if (!decoded) return null;
    const ch0 = decoded.audioBuffer.getChannelData(0);
    const rms = computeRms(ch0);
    const peak = detectPeak(ch0);
    return {
      rms,
      peak,
      rmsDbfs: linearToDbfs(rms),
      peakDbfs: linearToDbfs(peak),
    };
  }, [decoded]);

  const sampleRate = decoded?.audioBuffer.sampleRate ?? 44100;
  const channels = decoded?.audioBuffer.numberOfChannels ?? 1;
  const totalSamples = decoded?.audioBuffer.length ?? 0;
  const totalDuration = decoded?.audioBuffer.duration ?? 0;
  const noiseEstimateSamples = Math.min(
    totalSamples,
    Math.floor((noiseMsNum / 1000) * sampleRate),
  );

  // ---- Denoise action ----
  const handleDenoise = useCallback(async () => {
    if (!decoded) return;
    setError(null);
    setBusy(true);
    try {
      // Yield to UI before heavy synchronous work
      await new Promise((r) => setTimeout(r, 50));
      const { audioBuffer } = decoded;
      const sr = audioBuffer.sampleRate;
      const numChannels = audioBuffer.numberOfChannels;

      // Process each channel independently
      const outputChannels: Float32Array[] = [];
      let windowCount = 0;
      let inputRms = 0;
      let noiseRms = 0;
      let outputRms = 0;
      let inputPeak = 0;
      let outputPeak = 0;
      let clipping = false;

      for (let c = 0; c < numChannels; c++) {
        const ch = audioBuffer.getChannelData(c);
        const noiseSample = ch.subarray(0, noiseEstimateSamples);
        const noiseFloor = estimateNoiseFloor(noiseSample, fftSize);
        const stftResult = stft(ch, fftSize, hopSize);
        const reducedMags = stftResult.magnitudes.map((m) =>
          spectralSubtract(m, noiseFloor, alpha),
        );
        let reconstructed = overlapAdd(
          reducedMags, stftResult.phases, fftSize, hopSize, ch.length,
        );
        // Optional noise gate
        if (useGate) {
          reconstructed = applyNoiseGate(reconstructed, gateThreshold);
        }
        // Clamp for PCM encoding
        const clamped = new Float32Array(reconstructed.length);
        for (let i = 0; i < reconstructed.length; i++) {
          let v = reconstructed[i];
          if (v > 1) { v = 1; clipping = true; }
          else if (v < -1) { v = -1; clipping = true; }
          clamped[i] = v;
        }
        outputChannels.push(clamped);

        // Accumulate stats (from channel 0 for the report)
        if (c === 0) {
          windowCount = stftResult.magnitudes.length;
          inputRms = computeRms(ch);
          noiseRms = computeRms(noiseSample);
          outputRms = computeRms(clamped);
          inputPeak = detectPeak(ch);
          outputPeak = detectPeak(clamped);
        }
      }

      // Build WAV
      const wav = encodeWav(outputChannels, sr);
      const blob = new Blob([wav.buffer as ArrayBuffer], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      const filename = generateFilename();

      const stats = computeSummaryStats(
        outputChannels[0].length > 0
          ? audioBuffer.getChannelData(0)
          : new Float32Array(0),
        audioBuffer.getChannelData(0).subarray(0, noiseEstimateSamples),
        outputChannels[0],
        windowCount,
        blob.size,
      );
      // Use the stats (more thorough) but override clippingPrevented
      stats.clippingPrevented = clipping;

      const report: NoiseReducerReport = {
        fileName: decoded.fileName,
        durationSeconds: audioBuffer.duration,
        sampleRate: sr,
        channels: numChannels,
        strength: STRENGTH_VALUES[strength],
        alpha,
        gateThresholdDbfs: gateThreshold,
        fftSize,
        noiseEstimateSamples,
        windowCount,
        hopSize,
        stats: {
          ...stats,
          inputRmsDbfs: linearToDbfs(inputRms),
          noiseRmsDbfs: linearToDbfs(noiseRms),
          outputRmsDbfs: linearToDbfs(outputRms),
          inputPeakDbfs: linearToDbfs(inputPeak),
          outputPeakDbfs: linearToDbfs(outputPeak),
          clippingPrevented: clipping,
        },
      };

      const resultInfo: DenoiseResult = {
        blob,
        url,
        filename,
        report,
        sizeBytes: blob.size,
        durationSeconds: audioBuffer.duration,
        sampleRate: sr,
        channels: numChannels,
      };
      setResult((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return resultInfo;
      });

      const entry: HistoryEntry = {
        ts: Date.now(),
        originalName: decoded.fileName,
        durationSeconds: audioBuffer.duration,
        strength: STRENGTH_VALUES[strength],
        gateThresholdDbfs: gateThreshold,
        fftSize,
        noiseReducedPct: stats.noiseReducedPct,
        inputRmsDbfs: report.stats.inputRmsDbfs,
        outputRmsDbfs: report.stats.outputRmsDbfs,
        outputSizeBytes: blob.size,
        clippingPrevented: clipping,
        filename,
      };
      saveHistory(entry);
      setHistory(loadHistory());

      if (clipping) {
        toast.warning(`Denoised with clipping (${formatBytes(blob.size)})`);
      } else {
        toast.success(`Denoised (${formatBytes(blob.size)})`);
      }
    } catch (e) {
      setError(`Denoise failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [
    decoded, strength, gate, fftSizePreset, fftSize, hopSize, alpha,
    gateThreshold, useGate, noiseEstimateSamples,
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

  const reportText = useMemo(() => {
    if (!result) return "";
    return renderReport(result.report);
  }, [result]);

  const csvText = useMemo(() => {
    if (!result) return "";
    return renderCsv(result.report);
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
              <FileAudio className="h-4 w-4" /> Original preview
            </h3>
            <OriginalAudioPreview decoded={decoded} />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat icon={<Activity className="h-3 w-3" />} label="Duration" value={formatDuration(totalDuration)} />
              <Stat icon={<Volume2 className="h-3 w-3" />} label="RMS" value={formatDbfs(inputAnalysis?.rmsDbfs ?? Number.NEGATIVE_INFINITY)} />
              <Stat icon={<Volume2 className="h-3 w-3" />} label="Peak" value={formatDbfs(inputAnalysis?.peakDbfs ?? Number.NEGATIVE_INFINITY)} />
              <Stat icon={<AudioWaveform className="h-3 w-3" />} label="Sample rate" value={`${sampleRate} Hz`} />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Waves className="h-4 w-4" /> Denoise settings
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="anr-strength" className="text-xs">Strength</Label>
              <select
                id="anr-strength"
                value={strength}
                onChange={(e) => setStrength(e.target.value as StrengthPreset)}
                disabled={busy}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {STRENGTH_PRESETS.map((s) => (
                  <option key={s} value={s}>{STRENGTH_LABELS[s]}</option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground">
                Over-subtraction factor α = {alpha.toFixed(2)}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="anr-gate" className="text-xs">Noise gate threshold</Label>
              <select
                id="anr-gate"
                value={gate}
                onChange={(e) => setGate(e.target.value as GatePreset)}
                disabled={busy || !useGate}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {GATE_PRESETS.map((g) => (
                  <option key={g} value={g}>{GATE_LABELS[g]}</option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground">
                Linear threshold ≈ {dbfsToLinear(gateThreshold).toFixed(6)}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="anr-fft" className="text-xs">FFT size</Label>
              <select
                id="anr-fft"
                value={fftSizePreset}
                onChange={(e) => setFftSizePreset(e.target.value as FftSizePreset)}
                disabled={busy}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {FFT_SIZE_PRESETS.map((f) => (
                  <option key={f} value={f}>{f} samples</option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground">
                Hop size: {hopSize} (50% overlap)
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="anr-noise-ms" className="text-xs">Noise estimate (ms)</Label>
              <Input
                id="anr-noise-ms"
                type="number"
                min={0}
                max={5000}
                value={noiseMs}
                onChange={(e) => setNoiseMs(e.target.value)}
                disabled={busy}
                className="font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                ~{(noiseEstimateSamples / sampleRate).toFixed(3)} s · {noiseEstimateSamples} samples from start
              </p>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={useGate}
              onChange={(e) => setUseGate(e.target.checked)}
              disabled={busy}
            />
            <span>Apply noise gate (silence samples below threshold)</span>
          </label>

          {error && <ErrorBanner message={error} />}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={handleDenoise} disabled={busy || !decoded} className="gap-1.5">
              <Waves className="h-3.5 w-3.5" /> {busy ? "Denoising…" : "Denoise audio"}
            </Button>
            <ShareButton getUrl={() => buildShareUrl({
              strength,
              gate,
              fftSize: fftSizePreset,
            })} />
            <ClearButton onClick={handleReset} disabled={busy} />
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <FileAudio className="h-4 w-4" /> Denoised output
            </h3>
            {result.report.stats.clippingPrevented && (
              <div className="rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>Output contained samples above 1.0 — they were clamped before PCM encoding. Try a lower strength.</span>
              </div>
            )}
            <audio src={result.url} controls className="w-full" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Duration" value={formatDuration(result.durationSeconds)} />
              <Stat label="File size" value={formatBytes(result.sizeBytes)} />
              <Stat label="Format" value="WAV (PCM 16-bit)" />
              <Stat label="Filename" value={result.filename} />
            </div>
            <div className="rounded border bg-background px-3 py-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">Input RMS: {formatDbfs(result.report.stats.inputRmsDbfs)}</Badge>
                <Badge variant="outline">Noise RMS: {formatDbfs(result.report.stats.noiseRmsDbfs)}</Badge>
                <Badge variant="secondary">Output RMS: {formatDbfs(result.report.stats.outputRmsDbfs)}</Badge>
                <Badge variant="default">Reduced: {result.report.stats.noiseReducedPct.toFixed(1)}%</Badge>
                <Badge variant="outline">Windows: {result.report.windowCount}</Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={handleDownload} className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> Download WAV
              </Button>
              <CopyButton getText={() => result.filename} label="Copy filename" />
              <DownloadButton
                getText={() => reportText}
                filename="noise-reduction-report.txt"
                mime="text/plain"
                label="Download report"
              />
              <DownloadButton
                getText={() => csvText}
                filename="noise-reduction-report.csv"
                mime="text/csv"
                label="Download CSV"
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
          title="Drop an audio file to reduce noise"
          hint="We decode it locally with the Web Audio API, estimate the noise floor from the first ~100 ms, run spectral subtraction on every FFT window, optionally apply a noise gate, and re-encode as a 16-bit PCM WAV file. Pure-JS FFT and IFFT — no external libraries."
          icon={<Waves className="h-8 w-8" />}
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
                  <Badge variant="outline" className="text-[10px]">Str {h.strength}</Badge>
                  <Badge variant="outline" className="text-[10px]">{h.gateThresholdDbfs} dBFS</Badge>
                  <span className="font-mono text-muted-foreground">
                    {formatDbfs(h.inputRmsDbfs)} → {formatDbfs(h.outputRmsDbfs)}
                  </span>
                  <span className="text-muted-foreground">Reduced {h.noiseReducedPct.toFixed(1)}%</span>
                  {h.clippingPrevented && (
                    <Badge variant="outline" className="text-[10px] text-amber-700 dark:text-amber-300">Clipped</Badge>
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
            FFT analysis, spectral subtraction, noise gating, and WAV encoding all
            happen locally in your browser via the Web Audio API and a pure-JS FFT
            + RIFF encoder. No file is ever uploaded. History metadata is stored in
            localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/** Render the original audio as a preview WAV using the pure-JS encoder. */
function OriginalAudioPreview({ decoded }: { decoded: { audioBuffer: AudioBuffer; fileName: string; fileSize: number } }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function build() {
      try {
        const { sampleRate, numberOfChannels } = decoded.audioBuffer;
        const channelData: Float32Array[] = [];
        for (let c = 0; c < numberOfChannels; c++) {
          channelData.push(decoded.audioBuffer.getChannelData(c).slice());
        }
        const wav = encodeWav(channelData, sampleRate);
        const blob = new Blob([wav.buffer as ArrayBuffer], { type: "audio/wav" });
        if (!cancelled) setUrl(URL.createObjectURL(blob));
      } catch {
        // ignore
      }
    }
    build();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decoded]);

  if (!url) return <p className="text-xs text-muted-foreground">Preparing preview…</p>;
  return <audio src={url} controls className="w-full" />;
}

function Stat({
  label, value, icon,
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
