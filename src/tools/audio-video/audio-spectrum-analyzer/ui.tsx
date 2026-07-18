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
  FFT_SIZE_PRESETS,
  FFT_SIZE_TO_NUMBER,
  WINDOW_FUNCTIONS,
  WINDOW_LABELS,
  COLOR_PALETTES,
  PALETTE_LABELS,
  binToFrequency,
  frequencyToBin,
  nyquistFrequency,
  computeBandEnergies,
  findPeaks,
  applySmoothing,
  getPaletteColor,
  analyzeSegment,
  computeSpectrumStats,
  formatHz,
  formatDb,
  renderText,
  renderCsv,
  renderPeaksCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type FftSizePreset,
  type WindowFunction,
  type ColorPalette,
  type HistoryEntry,
  type AnalysisResult,
} from "./logic";
import { BarChart3, Upload, Play, Pause, History, FileAudio, Activity } from "lucide-react";

interface DecodedAudio {
  audioBuffer: AudioBuffer;
  fileName: string;
  fileSize: number;
}

export default function AudioSpectrumAnalyzer() {
  const [decoded, setDecoded] = useState<DecodedAudio | null>(null);
  const [fftPreset, setFftPreset] = useState<FftSizePreset>("2048");
  const [windowFn, setWindowFn] = useState<WindowFunction>("hanning");
  const [palette, setPalette] = useState<ColorPalette>("rainbow");
  const [topPeaks, setTopPeaks] = useState(5);
  const [smoothing, setSmoothing] = useState(0.5);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const prevMagsRef = useRef<Float32Array | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.fftSize) setFftPreset(p.fftSize);
      if (p.windowFunction) setWindowFn(p.windowFunction);
      if (p.palette) setPalette(p.palette);
      if (p.topPeaks) setTopPeaks(p.topPeaks);
      if (p.smoothing !== undefined) setSmoothing(p.smoothing);
      const any = p.fftSize || p.windowFunction || p.palette || p.topPeaks || p.smoothing !== undefined;
      if (any) toast.info("Loaded settings from share link");
    }
    return () => {
      stopPlayback();
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
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
    setAnalysis(null);
    if (!file.type.startsWith("audio/") && !/\.(wav|mp3|ogg|webm|m4a|aac|flac)$/i.test(file.name)) {
      setDecodeError("Please select an audio file (wav, mp3, ogg, webm, m4a, aac, flac).");
      return;
    }
    try {
      setBusy(true);
      stopPlayback();
      const arrayBuffer = await file.arrayBuffer();
      const ctx = getAudioContext();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      setDecoded({ audioBuffer, fileName: file.name, fileSize: file.size });
      toast.success(`Loaded ${file.name} (${audioBuffer.duration.toFixed(2)}s)`);
    } catch (e) {
      setDecodeError(`Could not decode audio file: ${(e as Error).message}.`);
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const stopPlayback = useCallback(() => {
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch { /* ignore */ }
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    setPlaying(false);
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const startPlayback = useCallback(() => {
    if (!decoded) return;
    const ctx = getAudioContext();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    stopPlayback();
    const src = ctx.createBufferSource();
    src.buffer = decoded.audioBuffer;
    src.loop = false;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE_TO_NUMBER[fftPreset];
    analyser.smoothingTimeConstant = smoothing;
    src.connect(analyser);
    analyser.connect(ctx.destination);
    src.onended = () => {
      stopPlayback();
    };
    src.start();
    sourceRef.current = src;
    analyserRef.current = analyser;
    setPlaying(true);
    drawSpectrumLoop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decoded, fftPreset, smoothing, getAudioContext, stopPlayback]);

  const drawSpectrumLoop = useCallback(() => {
    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    if (!analyser || !canvas) return;
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;

    const bins = analyser.frequencyBinCount;
    const freqData = new Uint8Array(bins);
    const prev = prevMagsRef.current;

    const draw = () => {
      if (!analyserRef.current || !canvasRef.current) return;
      analyserRef.current.getByteFrequencyData(freqData);
      // Convert to float magnitudes in [0, 1]
      const mags = new Float32Array(bins);
      for (let i = 0; i < bins; i++) mags[i] = freqData[i] / 255;
      const smoothed = applySmoothing(mags, prev, smoothing);
      prevMagsRef.current = smoothed;
      drawSpectrumCanvas(ctx2d, canvas, smoothed, palette, decoded?.audioBuffer.sampleRate ?? 44100, analyser.fftSize);
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();
  }, [palette, smoothing, decoded]);

  const runStaticAnalysis = useCallback(() => {
    if (!decoded) return;
    setBusy(true);
    setError(null);
    try {
      const sr = decoded.audioBuffer.sampleRate;
      const channels = decoded.audioBuffer.numberOfChannels;
      const fftSize = FFT_SIZE_TO_NUMBER[fftPreset];
      // Mix to mono for analysis
      const len = decoded.audioBuffer.length;
      const mono = new Float32Array(len);
      for (let c = 0; c < channels; c++) {
        const data = decoded.audioBuffer.getChannelData(c);
        for (let i = 0; i < len; i++) mono[i] += data[i] / channels;
      }
      // Take a segment from the middle of the file (or first fftSize samples if shorter)
      let start = Math.floor(len / 2);
      if (start + fftSize > len) start = Math.max(0, len - fftSize);
      const segment = mono.subarray(start, start + fftSize);
      const mags = analyzeSegment(segment, windowFn, fftSize);
      const bands = computeBandEnergies(mags, sr, fftSize);
      const peaks = findPeaks(mags, sr, fftSize, topPeaks);
      const stats = computeSpectrumStats(mags, bands, sr, fftSize);
      const result: AnalysisResult = {
        fileName: decoded.fileName,
        durationSeconds: decoded.audioBuffer.duration,
        sampleRate: sr,
        channels,
        fftSize,
        windowFunction: windowFn,
        bands,
        peaks,
        stats,
      };
      setAnalysis(result);
      // Save history
      saveHistory({
        ts: Date.now(),
        fileName: decoded.fileName,
        durationSeconds: result.durationSeconds,
        sampleRate: sr,
        channels,
        fftSize,
        windowFunction: windowFn,
        peakFrequencyHz: stats.peakFrequencyHz,
        spectralCentroidHz: stats.spectralCentroidHz,
        bandCount: bands.length,
      });
      setHistory(loadHistory());
      toast.success(`Analyzed — peak at ${formatHz(stats.peakFrequencyHz)}`);
    } catch (e) {
      setError(`Analysis failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [decoded, fftPreset, windowFn, topPeaks]);

  const handleReset = useCallback(() => {
    stopPlayback();
    setDecoded(null);
    setAnalysis(null);
    setError(null);
    setDecodeError(null);
    prevMagsRef.current = null;
    toast.info("Cleared");
  }, [stopPlayback]);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const textReport = useMemo(() => analysis ? renderText(analysis) : "", [analysis]);
  const csvReport = useMemo(() => analysis ? renderCsv(analysis) : "", [analysis]);
  const peaksCsv = useMemo(() => analysis ? renderPeaksCsv(analysis) : "", [analysis]);

  const sampleRate = decoded?.audioBuffer.sampleRate ?? 44100;
  const fftSizeNum = FFT_SIZE_TO_NUMBER[fftPreset];
  const nyquist = nyquistFrequency(sampleRate);
  const binHz = binToFrequency(1, sampleRate, fftSizeNum);

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
              <BarChart3 className="h-4 w-4" /> Spectrum settings
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="asa-fft" className="text-xs">FFT size</Label>
                <select
                  id="asa-fft"
                  value={fftPreset}
                  onChange={(e) => setFftPreset(e.target.value as FftSizePreset)}
                  className="h-9 w-full text-xs rounded border bg-background px-2"
                >
                  {FFT_SIZE_PRESETS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="asa-win" className="text-xs">Window function</Label>
                <select
                  id="asa-win"
                  value={windowFn}
                  onChange={(e) => setWindowFn(e.target.value as WindowFunction)}
                  className="h-9 w-full text-xs rounded border bg-background px-2"
                >
                  {WINDOW_FUNCTIONS.map((w) => <option key={w} value={w}>{WINDOW_LABELS[w]}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="asa-pal" className="text-xs">Color palette</Label>
                <select
                  id="asa-pal"
                  value={palette}
                  onChange={(e) => setPalette(e.target.value as ColorPalette)}
                  className="h-9 w-full text-xs rounded border bg-background px-2"
                >
                  {COLOR_PALETTES.map((p) => <option key={p} value={p}>{PALETTE_LABELS[p]}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="asa-peaks" className="text-xs">Top peaks</Label>
                <select
                  id="asa-peaks"
                  value={topPeaks}
                  onChange={(e) => setTopPeaks(parseInt(e.target.value, 10))}
                  className="h-9 w-full text-xs rounded border bg-background px-2"
                >
                  {[3, 5, 10, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="asa-smooth" className="text-xs">Smoothing: {smoothing.toFixed(2)}</Label>
                <input
                  id="asa-smooth"
                  type="range" min={0} max={0.95} step={0.05}
                  value={smoothing}
                  onChange={(e) => setSmoothing(parseFloat(e.target.value))}
                  className="w-full h-9"
                />
              </div>
              <div className="flex items-end gap-2 text-[10px] text-muted-foreground">
                <Badge variant="outline">Nyquist: {formatHz(nyquist)}</Badge>
                <Badge variant="outline">Bin width: {binHz.toFixed(2)} Hz</Badge>
              </div>
            </div>
            {error && <ErrorBanner message={error} />}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={playing ? stopPlayback : startPlayback} disabled={busy} className="gap-1.5">
                {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {playing ? "Stop playback" : "Play & visualize"}
              </Button>
              <Button onClick={runStaticAnalysis} disabled={busy} variant="outline" className="gap-1.5">
                <Activity className="h-3.5 w-3.5" /> {busy ? "Analyzing…" : "Run static analysis"}
              </Button>
              <ShareButton getUrl={() => buildShareUrl({ fftSize: fftPreset, windowFunction: windowFn, palette, topPeaks, smoothing })} />
              <ClearButton onClick={handleReset} />
            </div>
          </CardContent>
        </Card>
      )}

      {decoded && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4" /> Real-time spectrum
            </h3>
            <canvas
              ref={canvasRef}
              width={1024}
              height={300}
              className="w-full h-[300px] rounded border bg-black"
            />
            <p className="text-[10px] text-muted-foreground">
              {playing ? "Live visualization running — click Stop to freeze." : "Press Play & visualize for a live spectrum. Static analysis below shows the FFT of one segment."}
            </p>
          </CardContent>
        </Card>
      )}

      {analysis && (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Activity className="h-4 w-4" /> Summary stats
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Peak frequency" value={formatHz(analysis.stats.peakFrequencyHz)} />
                <Stat label="Peak magnitude" value={formatDb(analysis.stats.peakMagnitudeDb)} />
                <Stat label="Spectral centroid" value={formatHz(analysis.stats.spectralCentroidHz)} />
                <Stat label="Total energy" value={formatDb(analysis.stats.totalEnergyDb)} />
                <Stat label="Bins analyzed" value={analysis.stats.binCount} />
                <Stat label="Bands" value={analysis.stats.bandCount} />
                <Stat label="FFT size" value={analysis.fftSize} />
                <Stat label="Window" value={analysis.windowFunction} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FileAudio className="h-4 w-4" /> Band energies
              </h3>
              <div className="space-y-1 max-h-[400px] overflow-auto">
                {analysis.bands.map((b) => {
                  const max = Math.max(...analysis.bands.map((x) => Number.isFinite(x.energyDb) ? x.energyDb : -100));
                  const pct = Number.isFinite(b.energyDb) && max > -100
                    ? Math.max(0, Math.min(100, ((b.energyDb - max + 60) / 60) * 100))
                    : 0;
                  return (
                    <div key={b.name} className="rounded border bg-background px-3 py-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-foreground w-20">{b.label}</span>
                        <span className="text-muted-foreground">{b.minHz}–{b.maxHz} Hz</span>
                        <Badge variant="outline" className="text-[10px]">{formatDb(b.energyDb)}</Badge>
                        <span className="text-muted-foreground ml-auto">
                          peak {formatHz(b.peakFrequency)} · {b.binCount} bins
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded mt-1 overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4" /> Top {analysis.peaks.length} peak frequencies
              </h3>
              {analysis.peaks.length === 0 ? (
                <p className="text-xs text-muted-foreground">No peaks found.</p>
              ) : (
                <div className="space-y-1">
                  {analysis.peaks.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                      <Badge variant="secondary" className="text-[10px]">#{i + 1}</Badge>
                      <span className="font-mono text-foreground">{formatHz(p.frequency)}</span>
                      <Badge variant="outline" className="text-[10px]">{formatDb(p.magnitudeDb)}</Badge>
                      <span className="text-muted-foreground ml-auto">bin {p.bin}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton getText={() => textReport} label="Copy report" />
                <DownloadButton getText={() => textReport} filename="spectrum-report.txt" mime="text/plain" label="Download .txt" />
                <DownloadButton getText={() => csvReport} filename="spectrum-bands.csv" mime="text/csv" label="Download bands CSV" />
                <DownloadButton getText={() => peaksCsv} filename="spectrum-peaks.csv" mime="text/csv" label="Download peaks CSV" />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {!decoded && !decodeError && (
        <EmptyState
          title="Drop an audio file to analyze its spectrum"
          hint="Drag and drop or click to browse. We decode it locally with the Web Audio API and run a pure-JS FFT to compute peak frequencies and per-band energies."
          icon={<BarChart3 className="h-8 w-8" />}
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
                  <Badge variant="outline" className="text-[10px]">FFT {h.fftSize}</Badge>
                  <Badge variant="outline" className="text-[10px]">{h.windowFunction}</Badge>
                  <span className="font-mono text-muted-foreground">peak {formatHz(h.peakFrequencyHz)}</span>
                  <span className="text-muted-foreground">centroid {formatHz(h.spectralCentroidHz)}</span>
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
            <strong className="text-foreground">Privacy:</strong> Audio decoding, real-time
            visualization, and FFT analysis all happen locally in your browser via the Web
            Audio API and a pure-JS radix-2 FFT. No file is ever uploaded. Analysis metadata
            in history is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/** Draw the live spectrum bars on the canvas. */
function drawSpectrumCanvas(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  mags: Float32Array,
  palette: ColorPalette,
  sampleRate: number,
  fftSize: number,
) {
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);

  const bins = mags.length;
  if (bins === 0) return;
  const barWidth = Math.max(1, w / bins);

  // Logarithmic frequency scale (more useful for music)
  // Map bin index → x position using log scale
  const minBin = 1;
  const maxBin = bins;
  const logMin = Math.log(minBin);
  const logMax = Math.log(maxBin);

  for (let x = 0; x < w; x++) {
    const t = x / w;
    // Map x to bin via log scale
    const binF = Math.exp(logMin + t * (logMax - logMin));
    const bin = Math.max(1, Math.min(bins - 1, Math.floor(binF)));
    const mag = mags[bin];
    const barHeight = Math.max(1, mag * h);
    const [r, g, b] = getPaletteColor(palette, mag);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(x, h - barHeight, barWidth, barHeight);
  }

  // Frequency grid lines (100 Hz, 1 kHz, 10 kHz)
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "10px monospace";
  for (const f of [100, 1000, 10000]) {
    const bin = frequencyToBin(f, sampleRate, fftSize);
    if (bin < 1 || bin >= bins) continue;
    const logBin = Math.log(bin);
    const t = (logBin - logMin) / (logMax - logMin);
    const x = t * w;
    if (x < 0 || x >= w) continue;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
    const label = f >= 1000 ? `${f / 1000}k` : `${f}`;
    ctx.fillText(label, x + 2, h - 4);
  }

  // dB grid lines
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  for (const db of [-6, -12, -24, -48]) {
    const y = h - (dbToAmplitudeRatio(db) * h);
    if (y < 0 || y >= h) continue;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText(`${db} dB`, 4, y - 2);
  }
}

function dbToAmplitudeRatio(db: number): number {
  // Convert dB to [0, 1] ratio (assuming 0 dB = 1.0)
  return Math.pow(10, db / 20);
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
