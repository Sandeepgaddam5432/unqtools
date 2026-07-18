"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CopyButton,
  EmptyState,
  ShareButton,
  ClearButton,
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  FADE_CURVES,
  FADE_CURVE_LABELS,
  FADE_CURVE_DESCRIPTIONS,
  FADE_DURATION_PRESETS_MS,
  FADE_DURATION_LABELS,
  DEFAULT_FADE_CURVE,
  DEFAULT_FADE_IN,
  DEFAULT_FADE_OUT,
  generateFadeInGainArray,
  generateFadeOutGainArray,
  fadePresetToSamples,
  computeFadeSampleRange,
  validateFade,
  encodeWav,
  renderCurveAscii,
  computeSummaryStats,
  formatSeconds,
  formatBytes,
  generateFilename,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type FadeCurve,
  type FadeDurationPreset,
  type HistoryEntry,
} from "./logic";
import {
  TrendingUp, Upload, Play, History, FileAudio,
  HardDrive, Waves, Activity,
} from "lucide-react";

interface DecodedAudio {
  audioBuffer: AudioBuffer;
  fileName: string;
  fileSize: number;
}

interface FadeResult {
  blob: Blob;
  url: string;
  filename: string;
  durationSeconds: number;
  sizeBytes: number;
  sampleRate: number;
  channels: number;
}

export default function AudioFadeGenerator() {
  const [decoded, setDecoded] = useState<DecodedAudio | null>(null);
  const [curve, setCurve] = useState<FadeCurve>(DEFAULT_FADE_CURVE);
  const [fadeInPreset, setFadeInPreset] = useState<FadeDurationPreset>(DEFAULT_FADE_IN);
  const [fadeOutPreset, setFadeOutPreset] = useState<FadeDurationPreset>(DEFAULT_FADE_OUT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<FadeResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.curve) setCurve(p.curve);
      if (p.fadeIn) setFadeInPreset(p.fadeIn);
      if (p.fadeOut) setFadeOutPreset(p.fadeOut);
      if (p.curve || p.fadeIn || p.fadeOut) {
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
      toast.success(`Loaded ${file.name} (${formatSeconds(audioBuffer.duration)})`);
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

  const totalDuration = decoded?.audioBuffer.duration ?? 0;
  const sampleRate = decoded?.audioBuffer.sampleRate ?? 44100;
  const channels = decoded?.audioBuffer.numberOfChannels ?? 1;
  const totalSamples = decoded?.audioBuffer.length ?? 0;

  const fadeInMs = FADE_DURATION_PRESETS_MS[fadeInPreset];
  const fadeOutMs = FADE_DURATION_PRESETS_MS[fadeOutPreset];
  const fadeInSeconds = fadeInMs / 1000;
  const fadeOutSeconds = fadeOutMs / 1000;
  const fadeInSamples = fadePresetToSamples(fadeInPreset, sampleRate);
  const fadeOutSamples = fadePresetToSamples(fadeOutPreset, sampleRate);

  const validation = useMemo(
    () => decoded ? validateFade(fadeInSeconds, fadeOutSeconds, totalDuration) : null,
    [decoded, fadeInSeconds, fadeOutSeconds, totalDuration],
  );

  const range = useMemo(
    () => computeFadeSampleRange(fadeInSamples, fadeOutSamples, totalSamples),
    [fadeInSamples, fadeOutSamples, totalSamples],
  );

  const curveAscii = useMemo(
    () => renderCurveAscii(curve, fadeInSamples, fadeOutSamples, Math.max(1, totalSamples), 60, 8),
    [curve, fadeInSamples, fadeOutSamples, totalSamples],
  );

  const handleApplyFades = useCallback(async () => {
    if (!decoded) return;
    setError(null);
    if (validation && !validation.ok) {
      setError(validation.error ?? "Invalid fade settings");
      return;
    }
    setBusy(true);
    try {
      const channelData: Float32Array[] = [];
      for (let c = 0; c < decoded.audioBuffer.numberOfChannels; c++) {
        channelData.push(decoded.audioBuffer.getChannelData(c).slice());
      }
      // Build gain arrays at full length
      const fiGain = generateFadeInGainArray(curve, range.fadeInSamples);
      const foGain = generateFadeOutGainArray(curve, range.fadeOutSamples);
      const wav = encodeWav(channelData, sampleRate, fiGain, foGain);
      const blob = new Blob([wav.buffer as ArrayBuffer], { type: "audio/wav" });
      const url = URL.createObjectURL(blob);
      const filename = generateFilename();
      const resultInfo: FadeResult = {
        blob,
        url,
        filename,
        durationSeconds: totalDuration,
        sizeBytes: blob.size,
        sampleRate,
        channels,
      };
      setResult((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return resultInfo;
      });
      const entry: HistoryEntry = {
        ts: Date.now(),
        originalName: decoded.fileName,
        curve,
        fadeInMs,
        fadeOutMs,
        totalDurationMs: Math.round(totalDuration * 1000),
        outputSizeBytes: blob.size,
        sampleRate,
        channels,
        filename,
      };
      saveHistory(entry);
      setHistory(loadHistory());
      toast.success(`Applied ${curve} fades (${formatBytes(blob.size)})`);
    } catch (e) {
      setError(`Fade application failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [
    decoded, validation, curve, range, sampleRate, channels,
    totalDuration, fadeInMs, fadeOutMs,
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

  const stats = useMemo(() => {
    if (!result) return null;
    return computeSummaryStats(
      fadeInSeconds,
      fadeOutSeconds,
      totalDuration,
      sampleRate,
      channels,
      result.sizeBytes,
      curve,
    );
  }, [result, fadeInSeconds, fadeOutSeconds, totalDuration, sampleRate, channels, curve]);

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
                ? `${formatBytes(decoded.fileSize)} · ${formatSeconds(decoded.audioBuffer.duration)} · ${decoded.audioBuffer.sampleRate} Hz · ${decoded.audioBuffer.numberOfChannels} ch`
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

      {decoded && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <FileAudio className="h-4 w-4" /> Original preview
            </h3>
            <OriginalAudioPreview decoded={decoded} />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Total duration" value={formatSeconds(totalDuration)} />
              <Stat label="Sample rate" value={`${sampleRate} Hz`} />
              <Stat label="Channels" value={channels} />
              <Stat label="Total samples" value={totalSamples} />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4" /> Fade settings
          </h3>
          <div className="space-y-1.5">
            <Label htmlFor="afg-curve" className="text-xs">Fade curve</Label>
            <select
              id="afg-curve"
              value={curve}
              onChange={(e) => setCurve(e.target.value as FadeCurve)}
              disabled={busy}
              className="h-9 w-full text-xs rounded border bg-background px-2"
            >
              {FADE_CURVES.map((c) => (
                <option key={c} value={c}>{FADE_CURVE_LABELS[c]}</option>
              ))}
            </select>
            <p className="text-[10px] text-muted-foreground">{FADE_CURVE_DESCRIPTIONS[curve]}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="afg-fadein" className="text-xs">Fade in</Label>
              <select
                id="afg-fadein"
                value={fadeInPreset}
                onChange={(e) => setFadeInPreset(e.target.value as FadeDurationPreset)}
                disabled={busy}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(FADE_DURATION_LABELS) as FadeDurationPreset[]).map((p) => (
                  <option key={p} value={p}>{FADE_DURATION_LABELS[p]}</option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground">
                {fadeInSamples.toLocaleString()} samples · {formatSeconds(fadeInSeconds)}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="afg-fadeout" className="text-xs">Fade out</Label>
              <select
                id="afg-fadeout"
                value={fadeOutPreset}
                onChange={(e) => setFadeOutPreset(e.target.value as FadeDurationPreset)}
                disabled={busy}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(FADE_DURATION_LABELS) as FadeDurationPreset[]).map((p) => (
                  <option key={p} value={p}>{FADE_DURATION_LABELS[p]}</option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground">
                {fadeOutSamples.toLocaleString()} samples · {formatSeconds(fadeOutSeconds)}
              </p>
            </div>
          </div>
          {validation && !validation.ok && (
            <div className="rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              {validation.error}
            </div>
          )}
          {error && <ErrorBanner message={error} />}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={handleApplyFades} disabled={busy || !decoded} className="gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" /> {busy ? "Applying…" : "Apply fades"}
            </Button>
            <ShareButton getUrl={() => buildShareUrl({
              curve,
              fadeIn: fadeInPreset,
              fadeOut: fadeOutPreset,
            })} />
            <ClearButton onClick={handleReset} disabled={busy} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <Activity className="h-4 w-4" /> Curve visualizer
          </h3>
          <pre className="text-[10px] font-mono whitespace-pre overflow-auto rounded border bg-muted/40 p-3">
{curveAscii}
          </pre>
          <p className="text-[10px] text-muted-foreground">
            ASCII chart showing the gain envelope across the entire buffer. The left
            edge shows the fade in (rising from 0 to 1), the right edge shows the
            fade out (falling from 1 to 0), and the middle is the unfaded section.
          </p>
        </CardContent>
      </Card>

      {decoded && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Waves className="h-4 w-4" /> Fade preview stats
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Fade in samples" value={range.fadeInSamples.toLocaleString()} />
              <Stat label="Fade out samples" value={range.fadeOutSamples.toLocaleString()} />
              <Stat label="Unfaded samples" value={range.totalSamples - range.fadeInSamples - range.fadeOutSamples} />
              <Stat label="Curve" value={curve} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 text-xs">
              <Stat label="Fade in region" value={`0 – ${range.fadeInEnd.toLocaleString()}`} />
              <Stat label="Fade out region" value={`${range.fadeOutStart.toLocaleString()} – ${range.fadeOutEnd.toLocaleString()}`} />
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Play className="h-4 w-4" /> Faded output
            </h3>
            <audio src={result.url} controls className="w-full" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Duration" value={formatSeconds(result.durationSeconds)} />
              <Stat label="File size" value={formatBytes(result.sizeBytes)} />
              <Stat label="Format" value="WAV (PCM 16-bit)" />
              <Stat label="Filename" value={result.filename} />
            </div>
            {stats && (
              <div className="rounded border bg-background px-3 py-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">Curve: {stats.curve}</Badge>
                  <Badge variant="outline">Fade in: {formatSeconds(stats.fadeInDurationSeconds)}</Badge>
                  <Badge variant="outline">Fade out: {formatSeconds(stats.fadeOutDurationSeconds)}</Badge>
                  <Badge variant="secondary">Faded samples: {stats.fadedSamples.toLocaleString()}</Badge>
                  <Badge variant="outline">Faded: {stats.fadedPct.toFixed(1)}%</Badge>
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

      {!decoded && !decodeError && (
        <EmptyState
          title="Drop an audio file to apply fades"
          hint="We decode it locally with the Web Audio API, generate a gain envelope for the fade in (0 → 1) and fade out (1 → 0) regions using your chosen curve, multiply each sample by its gain value, and re-encode as a 16-bit PCM WAV file."
          icon={<TrendingUp className="h-8 w-8" />}
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
                  <Badge variant="outline" className="text-[10px]">{h.curve}</Badge>
                  <span className="font-mono text-muted-foreground">
                    in {formatSeconds(h.fadeInMs / 1000)} · out {formatSeconds(h.fadeOutMs / 1000)}
                  </span>
                  <span className="text-muted-foreground">· {formatBytes(h.outputSizeBytes)}</span>
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
            gain envelope generation, fade application, and WAV encoding all happen
            locally in your browser via the Web Audio API and a pure-JS RIFF
            encoder. No file is ever uploaded. History metadata is stored in
            localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/** Preview the original audio by re-encoding it as a WAV without fades. */
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
        // No fades for the preview (pass empty arrays)
        const empty = new Float32Array(0);
        const wav = encodeWav(channelData, sampleRate, empty, empty);
        const blob = new Blob([wav.buffer as ArrayBuffer], { type: "audio/wav" });
        if (!cancelled) {
          setUrl(URL.createObjectURL(blob));
        }
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

  if (!url) {
    return <p className="text-xs text-muted-foreground">Preparing preview…</p>;
  }
  return <audio src={url} controls className="w-full" />;
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
