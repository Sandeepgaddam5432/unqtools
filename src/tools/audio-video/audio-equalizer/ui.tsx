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
  BAND_SETS,
  BAND_SET_LABELS,
  getBandLabels,
  getBandFrequencies,
  DEFAULT_BAND_SET,
  EQ_PRESETS,
  getPreset,
  presetToBandSet,
  DEFAULT_Q,
  validateQ,
  clampGain,
  validateGain,
  buildFilterChain,
  activeFiltersOnly,
  encodeWav,
  computeSummaryStats,
  detectPreset,
  renderReport,
  renderCsv,
  generateFilename,
  formatBytes,
  formatDuration,
  formatHz,
  formatGainDb,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  encodeGains,
  type BandSetId,
  type EqPreset,
  type HistoryEntry,
  type EqReport,
} from "./logic";
import {
  SlidersHorizontal, Upload, Download, History, FileAudio,
  Volume2, Activity, Music, Equal,
} from "lucide-react";

interface DecodedAudio {
  audioBuffer: AudioBuffer;
  fileName: string;
  fileSize: number;
}

interface EqResult {
  blob: Blob;
  url: string;
  filename: string;
  report: EqReport;
  sizeBytes: number;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
}

export default function AudioEqualizer() {
  const [bandSet, setBandSet] = useState<BandSetId>(DEFAULT_BAND_SET);
  const [gains10, setGains10] = useState<number[]>(EQ_PRESETS[0].gains.slice());
  const [gains5, setGains5] = useState<number[]>(() => presetToBandSet(EQ_PRESETS[0], "5-band"));
  const [gains3, setGains3] = useState<number[]>(() => presetToBandSet(EQ_PRESETS[0], "3-band"));
  const [qText, setQText] = useState(String(DEFAULT_Q));

  const [decoded, setDecoded] = useState<DecodedAudio | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<EqResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const frequencies = useMemo(() => getBandFrequencies(bandSet), [bandSet]);
  const labels = useMemo(() => getBandLabels(bandSet), [bandSet]);

  const gainsState = useMemo(() => {
    if (bandSet === "10-band") return { gains: gains10, setGains: setGains10 };
    if (bandSet === "5-band") return { gains: gains5, setGains: setGains5 };
    return { gains: gains3, setGains: setGains3 };
  }, [bandSet, gains10, gains5, gains3]);

  const gains = gainsState.gains;
  const setGains = gainsState.setGains;

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.bandSet) setBandSet(p.bandSet);
      if (p.q) setQText(String(p.q));
      // Apply preset first if specified
      if (p.preset) {
        const preset = getPreset(p.preset);
        if (preset) {
          setGains10(preset.gains.slice());
          setGains5(presetToBandSet(preset, "5-band"));
          setGains3(presetToBandSet(preset, "3-band"));
        }
      }
      // Then apply per-band gains if specified (override preset)
      if (p.gains) {
        if (p.bandSet === "10-band" && p.gains.length === 10) setGains10(p.gains);
        else if (p.bandSet === "5-band" && p.gains.length === 5) setGains5(p.gains);
        else if (p.bandSet === "3-band" && p.gains.length === 3) setGains3(p.gains);
      }
      if (p.bandSet || p.q || p.preset || p.gains) {
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

  // ---- Derived state ----
  const qNum = useMemo(() => {
    const v = parseFloat(qText);
    return Number.isFinite(v) && validateQ(v).ok ? v : DEFAULT_Q;
  }, [qText]);

  const detectedPreset = useMemo(() => detectPreset(gains10, "10-band"), [gains10]);
  const presetName = detectedPreset ? detectedPreset.label : "Custom";
  const stats = useMemo(() => computeSummaryStats(gains, presetName, qNum), [gains, presetName, qNum]);

  // ---- Preset handler ----
  const applyPreset = useCallback((preset: EqPreset) => {
    setGains10(preset.gains.slice());
    setGains5(presetToBandSet(preset, "5-band"));
    setGains3(presetToBandSet(preset, "3-band"));
    toast.success(`Applied preset: ${preset.label}`);
  }, []);

  // ---- Per-band gain setter ----
  const setBandGain = useCallback((index: number, gainDb: number) => {
    setGains((prev) => {
      const next = prev.slice();
      next[index] = clampGain(gainDb);
      return next;
    });
  }, [setGains]);

  // ---- EQ action: build BiquadFilterNode chain in OfflineAudioContext ----
  const handleEqualize = useCallback(async () => {
    if (!decoded) return;
    setError(null);
    setBusy(true);
    try {
      const { audioBuffer } = decoded;
      const sr = audioBuffer.sampleRate;
      const numChannels = audioBuffer.numberOfChannels;
      const length = audioBuffer.length;

      // Build filter chain config
      const chain = buildFilterChain(frequencies, gains, qNum);
      const active = activeFiltersOnly(chain);

      // If no active filters, skip processing (output = input)
      let outputBuffer: AudioBuffer;
      if (active.length === 0) {
        outputBuffer = audioBuffer;
      } else {
        // Use OfflineAudioContext for fast batch rendering
        const OfflineCtor = window.OfflineAudioContext ||
          (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
        const offlineCtx = new OfflineCtor(numChannels, length, sr);
        const source = offlineCtx.createBufferSource();
        source.buffer = audioBuffer;

        // Build the chain: source → filter1 → filter2 → ... → destination
        let node: AudioNode = source;
        for (const cfg of active) {
          const filter = offlineCtx.createBiquadFilter();
          filter.type = "peaking";
          filter.frequency.value = cfg.frequency;
          filter.gain.value = cfg.gain;
          filter.Q.value = cfg.q;
          node.connect(filter);
          node = filter;
        }
        node.connect(offlineCtx.destination);
        source.start(0);
        const rendered = await offlineCtx.startRendering();
        outputBuffer = rendered;
      }

      // Extract channel data and encode WAV
      const channelData: Float32Array[] = [];
      for (let c = 0; c < outputBuffer.numberOfChannels; c++) {
        channelData.push(outputBuffer.getChannelData(c).slice());
      }
      const wav = encodeWav(channelData, sr);
      const blob = new Blob([wav.buffer as ArrayBuffer], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      const filename = generateFilename();

      const report: EqReport = {
        fileName: decoded.fileName,
        durationSeconds: audioBuffer.duration,
        sampleRate: sr,
        channels: numChannels,
        bandSet,
        presetName,
        q: qNum,
        frequencies,
        gains,
        stats,
        outputSizeBytes: blob.size,
      };

      const resultInfo: EqResult = {
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
        bandSet,
        presetName,
        q: qNum,
        gains: gains.slice(),
        bandsModified: stats.bandsModified,
        totalGainChange: stats.totalGainChange,
        outputSizeBytes: blob.size,
        filename,
      };
      saveHistory(entry);
      setHistory(loadHistory());

      toast.success(`Equalized (${formatBytes(blob.size)})`);
    } catch (e) {
      setError(`Equalize failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [decoded, frequencies, gains, qNum, bandSet, presetName, stats]);

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

  const handleResetEq = useCallback(() => {
    const flat = getPreset("flat")!;
    applyPreset(flat);
  }, [applyPreset]);

  const reportText = useMemo(() => result ? renderReport(result.report) : "", [result]);
  const csvText = useMemo(() => result ? renderCsv(result.report) : "", [result]);

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
              <Stat icon={<Activity className="h-3 w-3" />} label="Duration" value={formatDuration(decoded.audioBuffer.duration)} />
              <Stat icon={<Volume2 className="h-3 w-3" />} label="Sample rate" value={`${decoded.audioBuffer.sampleRate} Hz`} />
              <Stat icon={<Music className="h-3 w-3" />} label="Channels" value={decoded.audioBuffer.numberOfChannels} />
              <Stat icon={<Activity className="h-3 w-3" />} label="Samples" value={decoded.audioBuffer.length} />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <SlidersHorizontal className="h-4 w-4" /> EQ settings
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="aeq-bandset" className="text-xs">Band set</Label>
              <select
                id="aeq-bandset"
                value={bandSet}
                onChange={(e) => setBandSet(e.target.value as BandSetId)}
                disabled={busy}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(BAND_SETS) as BandSetId[]).map((b) => (
                  <option key={b} value={b}>{BAND_SET_LABELS[b]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aeq-q" className="text-xs">Q factor (bandwidth)</Label>
              <Input
                id="aeq-q"
                type="number"
                step="0.01"
                min="0.1"
                max="100"
                value={qText}
                onChange={(e) => setQText(e.target.value)}
                disabled={busy}
                className="font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                {validateQ(qNum).ok ? `Q = ${qNum.toFixed(2)} (~${(2 / qNum).toFixed(2)} octaves)` : "Using default Q = 1.41"}
              </p>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Per-band gain ({gains.length} bands)</Label>
              <Button variant="ghost" size="sm" onClick={handleResetEq} disabled={busy} className="gap-1.5 text-xs">
                <Equal className="h-3 w-3" /> Reset to flat
              </Button>
            </div>
            <div className={`grid gap-2 ${bandSet === "10-band" ? "grid-cols-2 sm:grid-cols-5" : bandSet === "5-band" ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-3"}`}>
              {labels.map((label, i) => (
                <div key={i} className="rounded border bg-background px-2 py-2 space-y-1">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">{label}</div>
                  <div className="flex items-center gap-1">
                    <input
                      type="range"
                      min={-12}
                      max={12}
                      step={0.5}
                      value={gains[i]}
                      onChange={(e) => setBandGain(i, parseFloat(e.target.value))}
                      disabled={busy}
                      className="flex-1 h-1 accent-primary"
                      aria-label={`${label} gain`}
                    />
                  </div>
                  <Input
                    type="number"
                    min={-12}
                    max={12}
                    step={0.5}
                    value={gains[i]}
                    onChange={(e) => setBandGain(i, parseFloat(e.target.value) || 0)}
                    disabled={busy}
                    className="h-7 text-[11px] font-mono px-2"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <Label className="text-xs">Preset library</Label>
            <div className="flex flex-wrap gap-1.5">
              {EQ_PRESETS.map((p) => (
                <Button
                  key={p.id}
                  variant={detectedPreset?.id === p.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => applyPreset(p)}
                  disabled={busy}
                  className="text-[11px]"
                  title={p.description}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            {detectedPreset && (
              <p className="text-[10px] text-muted-foreground">{detectedPreset.description}</p>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-2">
            <Stat label="Preset" value={presetName} />
            <Stat label="Bands modified" value={`${stats.bandsModified} / ${stats.bandCount}`} />
            <Stat label="Total Δ gain" value={`${stats.totalGainChange.toFixed(2)} dB`} />
            <Stat label="Max boost / cut" value={`${formatGainDb(stats.maxBoost)} / ${formatGainDb(stats.maxCut)}`} />
          </div>

          {error && <ErrorBanner message={error} />}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={handleEqualize} disabled={busy || !decoded} className="gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5" /> {busy ? "Equalizing…" : "Apply EQ"}
            </Button>
            <ShareButton getUrl={() => buildShareUrl({
              bandSet,
              q: qNum,
              preset: detectedPreset?.id ?? null,
              gains,
            })} />
            <ClearButton onClick={handleReset} disabled={busy} />
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <FileAudio className="h-4 w-4" /> Equalized output
            </h3>
            <audio src={result.url} controls className="w-full" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Duration" value={formatDuration(result.durationSeconds)} />
              <Stat label="File size" value={formatBytes(result.sizeBytes)} />
              <Stat label="Format" value="WAV (PCM 16-bit)" />
              <Stat label="Filename" value={result.filename} />
            </div>
            <div className="rounded border bg-background px-3 py-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{result.report.bandSet}</Badge>
                <Badge variant="secondary">{presetName}</Badge>
                <Badge variant="outline">Q {result.report.q.toFixed(2)}</Badge>
                <Badge variant="default">{stats.bandsModified} bands modified</Badge>
                <Badge variant="outline">Δ {stats.totalGainChange.toFixed(2)} dB</Badge>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={handleDownload} className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> Download WAV
              </Button>
              <CopyButton getText={() => result.filename} label="Copy filename" />
              <DownloadButton
                getText={() => reportText}
                filename="equalizer-report.txt"
                mime="text/plain"
                label="Download report"
              />
              <DownloadButton
                getText={() => csvText}
                filename="equalizer-report.csv"
                mime="text/csv"
                label="Download CSV"
              />
              <CopyButton getText={() => reportText} label="Copy report" />
              <CopyButton getText={() => encodeGains(gains)} label="Copy gains" />
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
          title="Drop an audio file to apply EQ"
          hint="We decode it locally with the Web Audio API, build a chain of peaking BiquadFilterNodes centered on ISO-standard frequencies, render via OfflineAudioContext, and re-encode as a 16-bit PCM WAV file. Choose from 10+ presets or tweak per-band gains manually."
          icon={<SlidersHorizontal className="h-8 w-8" />}
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
                  <Badge variant="outline" className="text-[10px]">{h.bandSet}</Badge>
                  <Badge variant="secondary" className="text-[10px]">{h.presetName}</Badge>
                  <span className="text-muted-foreground">{h.bandsModified} bands · Δ {h.totalGainChange.toFixed(1)} dB</span>
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
            BiquadFilterNode processing via OfflineAudioContext, and WAV encoding
            all happen locally in your browser. No file is ever uploaded. History
            metadata is stored in localStorage on this device only.
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
