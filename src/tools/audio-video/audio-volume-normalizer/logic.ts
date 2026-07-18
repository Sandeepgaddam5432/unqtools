/**
 * Audio Volume Normalizer — pure logic.
 *
 * Pure helpers only — no DOM, no AudioContext. The actual decoding, gain
 * application, and re-encoding happen in ui.tsx via Web Audio API. This
 * module contains: dBFS presets, dBFS ↔ linear gain converters, peak
 * detector, RMS calculator, target gain calculator, clipping detector,
 * clipping preventer, sample scaler, 44-byte RIFF WAV header builder,
 * Float32 to 16-bit PCM converter, text report generator, history
 * (localStorage), shareable URL, and summary stats.
 */

export type NormalizationMode = "peak" | "rms" | "loudness";

export type DbfsPreset =
  | "-1" | "-3" | "-6" | "-10" | "-14" | "-16" | "-20" | "-23";

/** 8 dBFS presets. -23 dBFS is the EBU R128 broadcast standard (LUFS). */
export const DBFS_PRESETS: DbfsPreset[] = [
  "-1", "-3", "-6", "-10", "-14", "-16", "-20", "-23",
];

export const DBFS_PRESET_VALUES: Record<DbfsPreset, number> = {
  "-1": -1,
  "-3": -3,
  "-6": -6,
  "-10": -10,
  "-14": -14,
  "-16": -16,
  "-20": -20,
  "-23": -23,
};

/** Default target dBFS — common podcast / web standard. */
export const DEFAULT_TARGET_DBFS = -16;

/** Human-readable labels for each preset. */
export const DBFS_PRESET_LABELS: Record<DbfsPreset, string> = {
  "-1": "-1 dBFS (max headroom)",
  "-3": "-3 dBFS (near max)",
  "-6": "-6 dBFS (broadcast peak)",
  "-10": "-10 dBFS (video)",
  "-14": "-14 dBFS (music streaming)",
  "-16": "-16 dBFS (podcast / web) — default",
  "-20": "-20 dBFS (cinema)",
  "-23": "-23 dBFS (EBU R128 LUFS broadcast)",
};

export const MODE_LABELS: Record<NormalizationMode, string> = {
  peak: "Peak — scale max sample to target",
  rms: "RMS — scale RMS to target",
  loudness: "Loudness — simplified EBU R128 (full-band RMS)",
};

export const MODE_DESCRIPTIONS: Record<NormalizationMode, string> = {
  peak: "Finds the maximum absolute sample value and scales it to the target dBFS. Best for maximizing headroom without changing the dynamics of the audio.",
  rms: "Computes the root-mean-square of all samples and scales it to the target dBFS. Closer to perceived loudness than peak. Best for consistent loudness across files.",
  loudness: "Approximates EBU R128 LUFS using full-band RMS (no K-weighting filter). Suitable for quick loudness matching; for production use a real LUFS meter.",
};

// ---- dBFS ↔ linear gain converters ----

/**
 * Convert dBFS to linear gain: gain = 10^(dbfs/20).
 * Returns a positive finite number (clamps extreme inputs).
 */
export function dbfsToLinear(dbfs: number): number {
  if (!Number.isFinite(dbfs)) return 1;
  // Clamp to avoid overflow (−200 dB → effectively silent, +20 dB → 10×)
  const clamped = Math.max(-200, Math.min(20, dbfs));
  return Math.pow(10, clamped / 20);
}

/**
 * Convert linear gain to dBFS: dbfs = 20 * log10(gain).
 * Returns -Infinity for gain = 0.
 */
export function linearToDbfs(gain: number): number {
  if (!Number.isFinite(gain) || gain <= 0) return Number.NEGATIVE_INFINITY;
  return 20 * Math.log10(gain);
}

// ---- Peak detector ----

/**
 * Find the maximum absolute sample value in a Float32Array.
 * Returns 0 for empty input.
 */
export function detectPeak(samples: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > peak) peak = abs;
  }
  return peak;
}

/**
 * Find the maximum absolute sample value across multiple channels.
 * Useful for multi-channel audio where clipping can occur on any channel.
 */
export function detectPeakMulti(channels: Float32Array[]): number {
  let peak = 0;
  for (const c of channels) {
    const p = detectPeak(c);
    if (p > peak) peak = p;
  }
  return peak;
}

// ---- RMS calculator ----

/**
 * Compute the root-mean-square of samples: sqrt(mean(sample^2)).
 * Returns 0 for empty input.
 */
export function computeRms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i];
    sum += v * v;
  }
  return Math.sqrt(sum / samples.length);
}

/**
 * Compute the RMS across multiple channels by averaging the per-channel
 * RMS values. This is the "loudness" approximation used by the loudness
 * mode (full-band RMS, no K-weighting).
 */
export function computeRmsMulti(channels: Float32Array[]): number {
  if (channels.length === 0) return 0;
  let sum = 0;
  for (const c of channels) {
    sum += computeRms(c);
  }
  return sum / channels.length;
}

/** Convert an RMS (linear) value to dBFS. Returns -Infinity for 0. */
export function rmsToDbfs(rms: number): number {
  return linearToDbfs(rms);
}

// ---- Target gain calculator ----

/**
 * Compute the linear gain needed to bring `currentDbfs` to `targetDbfs`.
 * gain = 10^((targetDbfs - currentDbfs) / 20).
 * Handles -Infinity (silent) current by returning 0.
 */
export function computeTargetGain(currentDbfs: number, targetDbfs: number): number {
  if (!Number.isFinite(currentDbfs)) return 0;
  return dbfsToLinear(targetDbfs - currentDbfs);
}

/**
 * Compute the linear gain needed to bring a peak (linear) value to a
 * target dBFS.
 *   target linear = 10^(targetDbfs/20)
 *   gain = target linear / current peak
 */
export function computePeakGain(currentPeak: number, targetDbfs: number): number {
  if (currentPeak <= 0) return 0;
  const targetLinear = dbfsToLinear(targetDbfs);
  return targetLinear / currentPeak;
}

/**
 * Compute the linear gain needed to bring an RMS (linear) value to a
 * target dBFS.
 */
export function computeRmsGain(currentRms: number, targetDbfs: number): number {
  if (currentRms <= 0) return 0;
  const targetLinear = dbfsToLinear(targetDbfs);
  return targetLinear / currentRms;
}

/**
 * High-level: pick the right gain function based on mode and compute.
 * `currentValue` is the peak (mode=peak) or RMS (mode=rms or loudness).
 */
export function computeGainForMode(
  mode: NormalizationMode,
  currentValue: number,
  targetDbfs: number,
): number {
  if (mode === "peak") return computePeakGain(currentValue, targetDbfs);
  return computeRmsGain(currentValue, targetDbfs);
}

// ---- Clipping detector & preventer ----

/**
 * Check whether applying `gain` to `samples` would result in clipping
 * (any sample's absolute value exceeding 1.0).
 */
export function wouldClip(samples: Float32Array, gain: number): boolean {
  const peak = detectPeak(samples);
  return peak * gain > 1.0;
}

/**
 * Check whether applying `gain` to multi-channel audio would clip on any
 * channel.
 */
export function wouldClipMulti(channels: Float32Array[], gain: number): boolean {
  const peak = detectPeakMulti(channels);
  return peak * gain > 1.0;
}

/**
 * Compute the maximum safe gain that does not cause clipping given the
 * current peak. Returns the smaller of `requestedGain` and `1 / peak`
 * (with a tiny safety margin to avoid floating-point edge cases).
 */
export function maxSafeGain(currentPeak: number, requestedGain: number): number {
  if (currentPeak <= 0) return requestedGain;
  const safe = (1 - 1e-6) / currentPeak;
  return Math.min(requestedGain, safe);
}

/**
 * Compute the maximum safe gain across multiple channels.
 */
export function maxSafeGainMulti(channels: Float32Array[], requestedGain: number): number {
  const peak = detectPeakMulti(channels);
  return maxSafeGain(peak, requestedGain);
}

// ---- Sample scaler ----

/**
 * Apply a uniform gain to all samples. Returns a NEW Float32Array — does
 * not mutate the input.
 */
export function scaleSamples(samples: Float32Array, gain: number): Float32Array {
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    out[i] = samples[i] * gain;
  }
  return out;
}

/**
 * Apply a uniform gain to multiple channels. Returns NEW Float32Arrays —
 * does not mutate the inputs.
 */
export function scaleSamplesMulti(channels: Float32Array[], gain: number): Float32Array[] {
  return channels.map((c) => scaleSamples(c, gain));
}

/**
 * Clamp any samples outside [-1, 1] to the valid range. Mutates in place.
 * Useful as a final safety net before encoding to PCM.
 */
export function clampSamples(samples: Float32Array): void {
  for (let i = 0; i < samples.length; i++) {
    if (samples[i] > 1) samples[i] = 1;
    else if (samples[i] < -1) samples[i] = -1;
  }
}

// ---- WAV header builder (44-byte RIFF) ----

/** Build a 44-byte RIFF WAV header for PCM 16-bit data. */
export function buildWavHeader(
  dataLength: number,
  sampleRate: number,
  channels: number,
  bitsPerSample = 16,
): Uint8Array {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = new Uint8Array(44);
  const view = new DataView(header.buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, "WAVE");

  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  writeString(view, 36, "data");
  view.setUint32(40, dataLength, true);

  return header;
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/** Convert Float32 samples (range -1..1) to 16-bit little-endian PCM bytes. */
export function floatSamplesTo16BitPCM(samples: Float32Array): Uint8Array {
  const out = new Uint8Array(samples.length * 2);
  const view = new DataView(out.buffer);
  for (let i = 0; i < samples.length; i++) {
    let s = samples[i];
    if (s > 1) s = 1;
    else if (s < -1) s = -1;
    const int16 = Math.round(s * 32767);
    view.setInt16(i * 2, int16, true);
  }
  return out;
}

/** Interleave multi-channel Float32 sample arrays into a single Float32Array. */
export function interleaveChannels(channels: Float32Array[]): Float32Array {
  if (channels.length === 0) return new Float32Array(0);
  const length = channels[0].length;
  const out = new Float32Array(length * channels.length);
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < channels.length; c++) {
      out[i * channels.length + c] = channels[c][i];
    }
  }
  return out;
}

/**
 * Build a complete WAV file (header + interleaved 16-bit PCM data) from
 * per-channel Float32 sample arrays. The samples should already be scaled
 * and clamped to [-1, 1] before calling this.
 */
export function encodeWav(
  channels: Float32Array[],
  sampleRate: number,
): Uint8Array {
  if (channels.length === 0) {
    return buildWavHeader(0, sampleRate, 1);
  }
  const interleaved = interleaveChannels(channels);
  const pcm = floatSamplesTo16BitPCM(interleaved);
  const header = buildWavHeader(pcm.length, sampleRate, channels.length);
  const out = new Uint8Array(header.length + pcm.length);
  out.set(header, 0);
  out.set(pcm, header.length);
  return out;
}

// ---- Text report generator ----

export interface NormalizationReport {
  mode: NormalizationMode;
  targetDbfs: number;
  inputPeakLinear: number;
  inputPeakDbfs: number;
  inputRmsLinear: number;
  inputRmsDbfs: number;
  requestedGainLinear: number;
  requestedGainDb: number;
  appliedGainLinear: number;
  appliedGainDb: number;
  outputPeakLinear: number;
  outputPeakDbfs: number;
  outputRmsLinear: number;
  outputRmsDbfs: number;
  clippedToPreventClipping: boolean;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
}

/** Format a dBFS value as a string (handles -Infinity). */
export function formatDbfs(dbfs: number): string {
  if (!Number.isFinite(dbfs)) return "−∞ dBFS";
  return `${dbfs.toFixed(2)} dBFS`;
}

/** Format a linear gain value as a string (e.g. "1.234×"). */
export function formatGain(gain: number): string {
  if (!Number.isFinite(gain)) return "—";
  return `${gain.toFixed(4)}×`;
}

/** Format a linear value (peak or RMS) as a string. */
export function formatLinear(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return value.toFixed(6);
}

/** Render a NormalizationReport as a multi-line plain text report. */
export function renderReport(report: NormalizationReport): string {
  const lines: string[] = [];
  lines.push("Audio Volume Normalization Report");
  lines.push("==================================");
  lines.push("");
  lines.push(`Mode: ${MODE_LABELS[report.mode]}`);
  lines.push(`Target: ${formatDbfs(report.targetDbfs)}`);
  lines.push(`Duration: ${report.durationSeconds.toFixed(3)} s`);
  lines.push(`Sample rate: ${report.sampleRate} Hz`);
  lines.push(`Channels: ${report.channels}`);
  lines.push("");
  lines.push("Input analysis:");
  lines.push(`  Peak:   ${formatLinear(report.inputPeakLinear)} (${formatDbfs(report.inputPeakDbfs)})`);
  lines.push(`  RMS:    ${formatLinear(report.inputRmsLinear)} (${formatDbfs(report.inputRmsDbfs)})`);
  lines.push("");
  lines.push("Gain:");
  lines.push(`  Requested: ${formatGain(report.requestedGainLinear)} (${formatDbfsGain(report.requestedGainDb)})`);
  lines.push(`  Applied:   ${formatGain(report.appliedGainLinear)} (${formatDbfsGain(report.appliedGainDb)})`);
  if (report.clippedToPreventClipping) {
    lines.push(`  ⚠ Reduced to prevent clipping.`);
  }
  lines.push("");
  lines.push("Output analysis:");
  lines.push(`  Peak:   ${formatLinear(report.outputPeakLinear)} (${formatDbfs(report.outputPeakDbfs)})`);
  lines.push(`  RMS:    ${formatLinear(report.outputRmsLinear)} (${formatDbfs(report.outputRmsDbfs)})`);
  lines.push("");
  lines.push("Loudness comparison (input vs output):");
  lines.push(`  Input RMS:  ${formatDbfs(report.inputRmsDbfs)}`);
  lines.push(`  Output RMS: ${formatDbfs(report.outputRmsDbfs)}`);
  const delta = report.outputRmsDbfs - report.inputRmsDbfs;
  lines.push(`  Delta:      ${delta >= 0 ? "+" : ""}${delta.toFixed(2)} dB`);
  return lines.join("\n");
}

/** Format a gain-dB value (positive = boost, negative = cut). */
function formatDbfsGain(db: number): string {
  if (!Number.isFinite(db)) return "−∞ dB";
  return `${db >= 0 ? "+" : ""}${db.toFixed(2)} dB`;
}

// ---- Byte / time formatting ----

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

// ---- Summary stats ----

export interface SummaryStats {
  inputPeakDbfs: number;
  inputRmsDbfs: number;
  outputPeakDbfs: number;
  outputRmsDbfs: number;
  appliedGainLinear: number;
  appliedGainDb: number;
  loudnessDeltaDb: number;
  outputSizeBytes: number;
  clippedToPreventClipping: boolean;
}

export function computeSummaryStats(report: NormalizationReport, outputSizeBytes: number): SummaryStats {
  return {
    inputPeakDbfs: report.inputPeakDbfs,
    inputRmsDbfs: report.inputRmsDbfs,
    outputPeakDbfs: report.outputPeakDbfs,
    outputRmsDbfs: report.outputRmsDbfs,
    appliedGainLinear: report.appliedGainLinear,
    appliedGainDb: report.appliedGainDb,
    loudnessDeltaDb: report.outputRmsDbfs - report.inputRmsDbfs,
    outputSizeBytes,
    clippedToPreventClipping: report.clippedToPreventClipping,
  };
}

// ---- Filename generator ----

/** Generate filename: normalized-YYYY-MM-DD-HHmmss.wav. */
export function generateFilename(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mm = pad2(date.getMinutes());
  const ss = pad2(date.getSeconds());
  return `normalized-${y}-${m}-${d}-${hh}${mm}${ss}.wav`;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:audio-volume-normalizer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  originalName: string;
  mode: NormalizationMode;
  targetDbfs: number;
  inputPeakDbfs: number;
  inputRmsDbfs: number;
  outputPeakDbfs: number;
  outputRmsDbfs: number;
  appliedGainDb: number;
  durationSeconds: number;
  outputSizeBytes: number;
  clippedToPreventClipping: boolean;
  filename: string;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---- Shareable URL ----

export interface ShareSettings {
  mode: NormalizationMode;
  targetDbfs: DbfsPreset;
}

export function buildShareUrl(settings: ShareSettings): string {
  const params = new URLSearchParams();
  params.set("mode", settings.mode);
  params.set("target", settings.targetDbfs);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareSettings> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ShareSettings> = {};
  const mode = params.get("mode");
  if (mode === "peak" || mode === "rms" || mode === "loudness") out.mode = mode;
  const target = params.get("target");
  if (target && target in DBFS_PRESET_VALUES) out.targetDbfs = target as DbfsPreset;
  return out;
}

// ---- Helpers ----

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
