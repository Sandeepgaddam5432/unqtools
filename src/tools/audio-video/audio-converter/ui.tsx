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
  BITRATE_PRESETS,
  BITRATE_LABELS,
  SAMPLE_RATE_PRESETS,
  SAMPLE_RATE_LABELS,
  CHANNEL_LABELS,
  FORMAT_ORDER,
  FORMAT_EXTENSIONS,
  FORMAT_LABELS,
  isFormatEncodable,
  detectEncodableFormats,
  pickDefaultOutputFormat,
  resolveSampleRate,
  resolveChannelCount,
  needsResample,
  needsChannelChange,
  estimateOutputSizeBytes,
  computeQualityScore,
  qualityLabel,
  checkFormatCompatibility,
  detectFormatFromFilename,
  generateFilename,
  formatBytes,
  formatDuration,
  computeSummaryStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  encodeWav,
  type AudioFormat,
  type BitratePreset,
  type SampleRatePreset,
  type ChannelPreset,
  type HistoryEntry,
} from "./logic";
import {
  FileAudio, Upload, Download, History, Activity,
  Gauge, HardDrive, ArrowRight,
} from "lucide-react";

interface DecodedAudio {
  audioBuffer: AudioBuffer;
  fileName: string;
  fileSize: number;
  sourceFormat: AudioFormat | "unknown";
}

interface ConvertResult {
  blob: Blob;
  url: string;
  filename: string;
  format: AudioFormat;
  sizeBytes: number;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  bitrate: number;
  fellBackToWav: boolean;
}

export default function AudioConverter() {
  const encodableFormats = useMemo<AudioFormat[]>(() => detectEncodableFormats(), []);
  const [outputFormat, setOutputFormat] = useState<AudioFormat>(() =>
    pickDefaultOutputFormat(encodableFormats),
  );
  const [bitrate, setBitrate] = useState<BitratePreset>("medium");
  const [sampleRate, setSampleRate] = useState<SampleRatePreset>("auto");
  const [channels, setChannels] = useState<ChannelPreset>("auto");

  const [decoded, setDecoded] = useState<DecodedAudio | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<ConvertResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.format && isFormatEncodable(p.format)) setOutputFormat(p.format);
      if (p.bitrate) setBitrate(p.bitrate);
      if (p.sampleRate) setSampleRate(p.sampleRate);
      if (p.channels) setChannels(p.channels);
      if (p.format || p.bitrate || p.sampleRate || p.channels) {
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
      const sourceFormat = detectFormatFromFilename(file.name);
      setDecoded({
        audioBuffer,
        fileName: file.name,
        fileSize: file.size,
        sourceFormat,
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

  // ---- Conversion logic (all derived values memoized for stable callback deps) ----

  const targetSampleRate = useMemo(
    () => decoded ? resolveSampleRate(sampleRate, decoded.audioBuffer.sampleRate) : 44100,
    [decoded, sampleRate],
  );
  const targetChannels = useMemo(
    () => decoded ? resolveChannelCount(channels, decoded.audioBuffer.numberOfChannels) : 1,
    [decoded, channels],
  );
  const bitrateValue = BITRATE_PRESETS[bitrate];
  const duration = decoded?.audioBuffer.duration ?? 0;
  const estimatedSize = useMemo(
    () => estimateOutputSizeBytes(outputFormat, duration, targetSampleRate, targetChannels, bitrateValue),
    [outputFormat, duration, targetSampleRate, targetChannels, bitrateValue],
  );
  const qualityScore = useMemo(
    () => computeQualityScore(outputFormat, bitrateValue, targetSampleRate, targetChannels),
    [outputFormat, bitrateValue, targetSampleRate, targetChannels],
  );
  const compatibility = useMemo(
    () => decoded ? checkFormatCompatibility(decoded.sourceFormat, outputFormat) : null,
    [decoded, outputFormat],
  );
  const needsRender = useMemo(
    () => decoded
      ? needsResample(decoded.audioBuffer.sampleRate, targetSampleRate) ||
        needsChannelChange(decoded.audioBuffer.numberOfChannels, targetChannels)
      : false,
    [decoded, targetSampleRate, targetChannels],
  );

  /**
   * Render the decoded AudioBuffer through an OfflineAudioContext at the
   * target sample rate and channel count. Returns a fresh AudioBuffer.
   */
  const renderBuffer = useCallback(
    async (source: AudioBuffer, targetRate: number, targetChannels: number): Promise<AudioBuffer> => {
      // OfflineAudioContext takes (numberOfChannels, length, sampleRate).
      const length = Math.ceil(source.duration * targetRate);
      const OfflineCtor = window.OfflineAudioContext ||
        (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
      const offline = new OfflineCtor(targetChannels, length, targetRate);
      const node = offline.createBufferSource();
      node.buffer = source;
      node.connect(offline.destination);
      node.start(0);
      return await offline.startRendering();
    },
    [],
  );

  /**
   * Encode an AudioBuffer to a non-WAV format using MediaRecorder, via a
   * MediaStreamAudioDestinationNode. Runs in real time (so it's slow for
   * long files). Returns a Promise<Blob>.
   */
  const encodeViaMediaRecorder = useCallback(
    async (buffer: AudioBuffer, format: AudioFormat, br: number): Promise<Blob> => {
      const Ctor = window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctor({ sampleRate: buffer.sampleRate });
      try {
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const dest = ctx.createMediaStreamDestination();
        // Ensure dest has the right channel count
        if (dest.channelCount !== buffer.numberOfChannels) {
          dest.channelCount = buffer.numberOfChannels;
        }
        src.connect(dest);

        // Pick a supported MIME
        const mimes = [
          format === "mp3" ? "audio/mpeg" : null,
          format === "webm" ? "audio/webm;codecs=opus" : null,
          format === "webm" ? "audio/webm" : null,
          format === "ogg" ? "audio/ogg;codecs=opus" : null,
          format === "ogg" ? "audio/ogg" : null,
          format === "m4a" ? "audio/mp4" : null,
        ].filter((m): m is string => m !== null && MediaRecorder.isTypeSupported(m));
        if (mimes.length === 0) {
          throw new Error(`No supported MediaRecorder MIME for ${format}`);
        }

        const recorder = new MediaRecorder(dest.stream, {
          mimeType: mimes[0],
          audioBitsPerSecond: br,
        });
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e: BlobEvent) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        const done = new Promise<Blob>((resolve) => {
          recorder.onstop = () => {
            resolve(new Blob(chunks, { type: mimes[0] }));
          };
        });

        recorder.start();
        src.start();
        // Wait for the source to finish playing.
        await new Promise<void>((resolve) => {
          src.onended = () => resolve();
        });
        // Give the recorder a moment to flush final chunks.
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
        if (recorder.state !== "inactive") recorder.stop();
        return await done;
      } finally {
        if (ctx.state !== "closed") {
          try { await ctx.close(); } catch { /* ignore */ }
        }
      }
    },
    [],
  );

  const handleConvert = useCallback(async () => {
    if (!decoded) return;
    setError(null);
    setBusy(true);
    try {
      let bufferToEncode: AudioBuffer = decoded.audioBuffer;
      // Render through OfflineAudioContext if sample rate or channel count differs.
      if (needsRender) {
        bufferToEncode = await renderBuffer(
          decoded.audioBuffer, targetSampleRate, targetChannels,
        );
      }

      let blob: Blob;
      let fellBackToWav = false;
      let actualFormat: AudioFormat = outputFormat;

      if (outputFormat === "wav") {
        // Pure-JS WAV encoder
        const channelData: Float32Array[] = [];
        for (let c = 0; c < bufferToEncode.numberOfChannels; c++) {
          channelData.push(bufferToEncode.getChannelData(c).slice());
        }
        const wav = encodeWav(channelData, bufferToEncode.sampleRate);
        blob = new Blob([wav.buffer as ArrayBuffer], { type: "audio/wav" });
      } else {
        try {
          blob = await encodeViaMediaRecorder(
            bufferToEncode, outputFormat, bitrateValue,
          );
        } catch (e) {
          // Fallback to WAV
          toast.warning(
            `${outputFormat.toUpperCase()} encoding failed (${(e as Error).message}). Falling back to WAV.`,
          );
          const channelData: Float32Array[] = [];
          for (let c = 0; c < bufferToEncode.numberOfChannels; c++) {
            channelData.push(bufferToEncode.getChannelData(c).slice());
          }
          const wav = encodeWav(channelData, bufferToEncode.sampleRate);
          blob = new Blob([wav.buffer as ArrayBuffer], { type: "audio/wav" });
          fellBackToWav = true;
          actualFormat = "wav";
        }
      }

      const url = URL.createObjectURL(blob);
      const filename = generateFilename(decoded.fileName, actualFormat);
      const resultInfo: ConvertResult = {
        blob,
        url,
        filename,
        format: actualFormat,
        sizeBytes: blob.size,
        durationSeconds: bufferToEncode.duration,
        sampleRate: bufferToEncode.sampleRate,
        channels: bufferToEncode.numberOfChannels,
        bitrate: outputFormat === "wav" ? 0 : bitrateValue,
        fellBackToWav,
      };
      setResult((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return resultInfo;
      });

      // Save history
      const entry: HistoryEntry = {
        ts: Date.now(),
        originalName: decoded.fileName,
        originalFormat: decoded.sourceFormat,
        outputFormat: actualFormat,
        originalSizeBytes: decoded.fileSize,
        outputSizeBytes: blob.size,
        durationSeconds: bufferToEncode.duration,
        sampleRate: bufferToEncode.sampleRate,
        channels: bufferToEncode.numberOfChannels,
        bitrate: outputFormat === "wav" ? 0 : bitrateValue,
        filename,
      };
      saveHistory(entry);
      setHistory(loadHistory());
      toast.success(
        `Converted to ${actualFormat.toUpperCase()} (${formatBytes(blob.size)})`,
      );
    } catch (e) {
      setError(`Conversion failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [
    decoded, needsRender, outputFormat, targetSampleRate, targetChannels,
    bitrateValue, renderBuffer, encodeViaMediaRecorder,
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
    if (!result || !decoded) return null;
    return computeSummaryStats(
      decoded.fileSize,
      result.sizeBytes,
      result.durationSeconds,
      result.bitrate,
      result.sampleRate,
      result.channels,
    );
  }, [result, decoded]);

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
            <FileAudio className="h-4 w-4" /> Output settings
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ac-format" className="text-xs">Format</Label>
              <select
                id="ac-format"
                value={outputFormat}
                onChange={(e) => setOutputFormat(e.target.value as AudioFormat)}
                disabled={busy}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {FORMAT_ORDER.map((f) => (
                  <option key={f} value={f} disabled={!isFormatEncodable(f)}>
                    {FORMAT_LABELS[f]}{!isFormatEncodable(f) ? " (unsupported)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ac-bitrate" className="text-xs">Bitrate (lossy)</Label>
              <select
                id="ac-bitrate"
                value={bitrate}
                onChange={(e) => setBitrate(e.target.value as BitratePreset)}
                disabled={busy || outputFormat === "wav"}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(BITRATE_LABELS) as BitratePreset[]).map((b) => (
                  <option key={b} value={b}>{BITRATE_LABELS[b]}</option>
                ))}
              </select>
              {outputFormat === "wav" && (
                <p className="text-[10px] text-muted-foreground">
                  Bitrate N/A for WAV (PCM, fixed).
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ac-samplerate" className="text-xs">Sample rate</Label>
              <select
                id="ac-samplerate"
                value={sampleRate}
                onChange={(e) => setSampleRate(e.target.value as SampleRatePreset)}
                disabled={busy}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(SAMPLE_RATE_LABELS) as SampleRatePreset[]).map((s) => (
                  <option key={s} value={s}>{SAMPLE_RATE_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ac-channels" className="text-xs">Channels</Label>
              <select
                id="ac-channels"
                value={channels}
                onChange={(e) => setChannels(e.target.value as ChannelPreset)}
                disabled={busy}
                className="h-9 w-full text-xs rounded border bg-background px-2"
              >
                {(Object.keys(CHANNEL_LABELS) as ChannelPreset[]).map((c) => (
                  <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>
                ))}
              </select>
            </div>
          </div>

          {decoded && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-2">
              <Stat icon={<Activity className="h-3 w-3" />} label="Target rate" value={`${targetSampleRate} Hz`} />
              <Stat icon={<Activity className="h-3 w-3" />} label="Target channels" value={targetChannels} />
              <Stat icon={<HardDrive className="h-3 w-3" />} label="Est. size" value={formatBytes(estimatedSize)} />
              <Stat
                icon={<Gauge className="h-3 w-3" />}
                label="Quality"
                value={`${qualityScore}/100 (${qualityLabel(qualityScore)})`}
              />
            </div>
          )}

          {compatibility && (
            <div className={`rounded border px-3 py-2 text-xs ${
              compatibility.lossless
                ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"
                : "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300"
            }`}>
              <strong>{compatibility.lossless ? "Lossless" : "Lossy"}:</strong> {compatibility.reason}
            </div>
          )}

          {error && <ErrorBanner message={error} />}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={handleConvert} disabled={busy || !decoded} className="gap-1.5">
              <ArrowRight className="h-3.5 w-3.5" /> {busy ? "Converting…" : "Convert"}
            </Button>
            <ShareButton getUrl={() => buildShareUrl({
              format: outputFormat,
              bitrate,
              sampleRate,
              channels,
            })} />
            <ClearButton onClick={handleReset} disabled={busy} />
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <FileAudio className="h-4 w-4" /> Converted output
            </h3>
            {result.fellBackToWav && (
              <div className="rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                Encoding to {outputFormat.toUpperCase()} failed — output is WAV instead.
              </div>
            )}
            <audio src={result.url} controls className="w-full" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Format" value={result.format.toUpperCase()} />
              <Stat label="Duration" value={formatDuration(result.durationSeconds)} />
              <Stat label="File size" value={formatBytes(result.sizeBytes)} />
              <Stat label="Filename" value={result.filename} />
            </div>
            {stats && (
              <div className="rounded border bg-background px-3 py-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">Original: {formatBytes(stats.originalSizeBytes)}</Badge>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <Badge variant="secondary">Output: {formatBytes(stats.outputSizeBytes)}</Badge>
                  <Badge
                    variant={stats.sizeDiffBytes < 0 ? "default" : "destructive"}
                    className={stats.sizeDiffBytes < 0 ? "bg-emerald-600 hover:bg-emerald-600" : ""}
                  >
                    {stats.sizeDiffBytes < 0 ? "−" : "+"}{formatBytes(Math.abs(stats.sizeDiffBytes))}
                    {" "}({stats.sizeDiffPct > 0 ? "+" : ""}{stats.sizeDiffPct.toFixed(1)}%)
                  </Badge>
                  <Badge variant="outline">
                    {stats.outputSampleRate} Hz · {stats.outputChannels} ch
                  </Badge>
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={handleDownload} className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> Download
              </Button>
              <CopyButton getText={() => result.filename} label="Copy filename" />
            </div>
          </CardContent>
        </Card>
      )}

      {!decoded && !decodeError && (
        <EmptyState
          title="Drop an audio file to convert"
          hint="We decode it locally with the Web Audio API, render at your chosen sample rate and channel count, then re-encode to your target format. WAV uses a pure-JS PCM encoder; WebM/OGG/MP3 use MediaRecorder."
          icon={<FileAudio className="h-8 w-8" />}
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
                  <Badge variant="outline" className="text-[10px]">{h.originalFormat.toUpperCase()}</Badge>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <Badge variant="secondary" className="text-[10px]">{h.outputFormat.toUpperCase()}</Badge>
                  <span className="font-mono text-muted-foreground">{formatDuration(h.durationSeconds)}</span>
                  <span className="text-muted-foreground">{formatBytes(h.originalSizeBytes)} → {formatBytes(h.outputSizeBytes)}</span>
                  <span className="text-muted-foreground ml-auto truncate max-w-[180px]">{h.filename}</span>
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
            resampling, and re-encoding all happen locally in your browser via
            the Web Audio API and MediaRecorder. No file is ever uploaded.
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
