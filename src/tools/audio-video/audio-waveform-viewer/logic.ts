/**
 * Audio Waveform Viewer — pure logic.
 *
 * Pure helpers only — no DOM, no AudioContext. The actual decoding and
 * rendering happen in ui.tsx via Web Audio API and Canvas. This module
 * contains: channel selection & mono-mix, peak/RMS per-window calculators,
 * zoom-aware window sizing, silence region detection, threshold presets,
 * color presets, peak list renderer, text/CSV renderers, history
 * (localStorage), shareable URL, and summary stats.
 */

// ---- Channel view modes ----

export type ChannelView = "left" | "right" | "both" | "mono-mix";

export const CHANNEL_VIEWS: ChannelView[] = ["left", "right", "both", "mono-mix"];

export const CHANNEL_VIEW_LABELS: Record<ChannelView, string> = {
  "left": "Left channel",
  "right": "Right channel",
  "both": "Both channels",
  "mono-mix": "Mono mix (L+R)/2",
};

/**
 * Compute mono mix from channel data: (left + right) / 2.
 * If only one channel is provided, returns a copy of it.
 * If channels have different lengths, uses the shorter length.
 */
export function monoMix(channels: Float32Array[]): Float32Array {
  if (channels.length === 0) return new Float32Array(0);
  if (channels.length === 1) return channels[0].slice();
  const minLen = channels.reduce((m, c) => Math.min(m, c.length), channels[0].length);
  const out = new Float32Array(minLen);
  for (let i = 0; i < minLen; i++) {
    let sum = 0;
    for (let c = 0; c < channels.length; c++) sum += channels[c][i];
    out[i] = sum / channels.length;
  }
  return out;
}

/**
 * Select a single channel given the view mode. For "both" we return the left
 * channel (ui.tsx renders both separately by calling this twice). For
 * "mono-mix" we average all channels. For "left" or "right" we return the
 * corresponding channel if present, else the first available channel.
 */
export function selectChannel(
  channels: Float32Array[],
  view: ChannelView,
): Float32Array {
  if (channels.length === 0) return new Float32Array(0);
  switch (view) {
    case "left":
      return channels[0].slice();
    case "right":
      return channels.length > 1 ? channels[1].slice() : channels[0].slice();
    case "both":
      return channels[0].slice();
    case "mono-mix":
      return monoMix(channels);
  }
}

// ---- Zoom presets ----

export type ZoomPreset = "1" | "2" | "5" | "10" | "50" | "100";

export const ZOOM_PRESETS: ZoomPreset[] = ["1", "2", "5", "10", "50", "100"];

export const ZOOM_TO_NUMBER: Record<ZoomPreset, number> = {
  "1": 1, "2": 2, "5": 5, "10": 10, "50": 50, "100": 100,
};

export const ZOOM_LABELS: Record<ZoomPreset, string> = {
  "1": "1× (overview)",
  "2": "2×",
  "5": "5×",
  "10": "10×",
  "50": "50×",
  "100": "100× (detail)",
};

/**
 * Compute samples-per-pixel given total samples, canvas pixel width, and zoom.
 * At zoom = 1, you see the whole file: samplesPerPixel = totalSamples / pixels.
 * At higher zoom, fewer samples per pixel (more detail).
 */
export function computeWindowSize(
  totalSamples: number,
  pixels: number,
  zoom: number,
): number {
  if (pixels <= 0 || zoom <= 0) return 1;
  if (totalSamples <= 0) return 1;
  // samples per pixel at zoom N = total / (pixels * zoom), minimum 1
  const spp = totalSamples / (pixels * zoom);
  return Math.max(1, Math.floor(spp));
}

// ---- Peak / RMS per window ----

/**
 * Compute the peak amplitude (max absolute value) for each consecutive window
 * of `windowSize` samples in `samples`. Returns Float32Array of length
 * ceil(samples.length / windowSize).
 */
export function computePeakPerWindow(
  samples: Float32Array,
  windowSize: number,
): Float32Array {
  const ws = Math.max(1, Math.floor(windowSize));
  if (samples.length === 0) return new Float32Array(0);
  const numWindows = Math.ceil(samples.length / ws);
  const out = new Float32Array(numWindows);
  for (let w = 0; w < numWindows; w++) {
    const start = w * ws;
    const end = Math.min(start + ws, samples.length);
    let peak = 0;
    for (let i = start; i < end; i++) {
      const a = Math.abs(samples[i]);
      if (a > peak) peak = a;
    }
    out[w] = peak;
  }
  return out;
}

/**
 * Compute the RMS (root-mean-square) amplitude for each consecutive window.
 * RMS = sqrt(sum(x^2) / N).
 */
export function computeRmsPerWindow(
  samples: Float32Array,
  windowSize: number,
): Float32Array {
  const ws = Math.max(1, Math.floor(windowSize));
  if (samples.length === 0) return new Float32Array(0);
  const numWindows = Math.ceil(samples.length / ws);
  const out = new Float32Array(numWindows);
  for (let w = 0; w < numWindows; w++) {
    const start = w * ws;
    const end = Math.min(start + ws, samples.length);
    let sumSq = 0;
    for (let i = start; i < end; i++) sumSq += samples[i] * samples[i];
    out[w] = Math.sqrt(sumSq / Math.max(1, end - start));
  }
  return out;
}

// ---- Silence detection ----

export type SilenceThresholdPreset = "-30" | "-40" | "-50" | "-60" | "-80";

export const SILENCE_THRESHOLD_PRESETS: SilenceThresholdPreset[] = [
  "-30", "-40", "-50", "-60", "-80",
];

export const SILENCE_THRESHOLD_TO_DB: Record<SilenceThresholdPreset, number> = {
  "-30": -30, "-40": -40, "-50": -50, "-60": -60, "-80": -80,
};

export const SILENCE_THRESHOLD_LABELS: Record<SilenceThresholdPreset, string> = {
  "-30": "-30 dB (loud)",
  "-40": "-40 dB",
  "-50": "-50 dB (default)",
  "-60": "-60 dB",
  "-80": "-80 dB (quiet)",
};

export type MinSilenceDurationPreset = "100ms" | "250ms" | "500ms" | "1s" | "2s";

export const MIN_SILENCE_DURATION_PRESETS: MinSilenceDurationPreset[] = [
  "100ms", "250ms", "500ms", "1s", "2s",
];

export const MIN_SILENCE_DURATION_TO_MS: Record<MinSilenceDurationPreset, number> = {
  "100ms": 100, "250ms": 250, "500ms": 500, "1s": 1000, "2s": 2000,
};

export const MIN_SILENCE_DURATION_LABELS: Record<MinSilenceDurationPreset, string> = {
  "100ms": "100 ms",
  "250ms": "250 ms",
  "500ms": "500 ms (default)",
  "1s": "1 second",
  "2s": "2 seconds",
};

/** Convert a dBFS value to linear amplitude (10^(dB/20)). */
export function dbToAmplitude(db: number): number {
  if (!Number.isFinite(db)) return 0;
  return Math.pow(10, db / 20);
}

/** Convert linear amplitude to dBFS (20 * log10(amplitude)). -Infinity for 0. */
export function amplitudeToDb(amplitude: number): number {
  if (amplitude <= 0) return Number.NEGATIVE_INFINITY;
  return 20 * Math.log10(amplitude);
}

export interface SilenceRegion {
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  startSample: number;
  endSample: number;
  peakAmplitude: number; // peak amplitude within the region
}

/**
 * Detect silence regions in `samples`. A window of `windowSize` samples is
 * silent if its peak amplitude (max abs) is below the threshold (in linear
 * amplitude). Consecutive silent windows form a region; regions shorter than
 * `minDurationMs` are discarded.
 */
export function detectSilenceRegions(
  samples: Float32Array,
  sampleRate: number,
  thresholdAmplitude: number,
  minDurationMs: number,
  windowSize?: number,
): SilenceRegion[] {
  if (samples.length === 0 || sampleRate <= 0) return [];
  // Default window = 50 ms (good trade-off for silence detection)
  const ws = Math.max(1, Math.floor(windowSize ?? (sampleRate * 0.05)));
  const minSamples = Math.max(1, Math.floor((minDurationMs / 1000) * sampleRate));

  const regions: SilenceRegion[] = [];
  let regionStart = -1;
  let regionPeak = 0;

  const numWindows = Math.ceil(samples.length / ws);
  for (let w = 0; w < numWindows; w++) {
    const start = w * ws;
    const end = Math.min(start + ws, samples.length);
    let peak = 0;
    for (let i = start; i < end; i++) {
      const a = Math.abs(samples[i]);
      if (a > peak) peak = a;
    }
    const isSilent = peak < thresholdAmplitude;
    if (isSilent) {
      if (regionStart < 0) {
        regionStart = start;
        regionPeak = peak;
      } else {
        if (peak > regionPeak) regionPeak = peak;
      }
    } else {
      if (regionStart >= 0) {
        const regionEnd = start;
        if (regionEnd - regionStart >= minSamples) {
          regions.push({
            startSample: regionStart,
            endSample: regionEnd,
            startSeconds: regionStart / sampleRate,
            endSeconds: regionEnd / sampleRate,
            durationSeconds: (regionEnd - regionStart) / sampleRate,
            peakAmplitude: regionPeak,
          });
        }
        regionStart = -1;
        regionPeak = 0;
      }
    }
  }
  // Close any trailing region
  if (regionStart >= 0) {
    const regionEnd = samples.length;
    if (regionEnd - regionStart >= minSamples) {
      regions.push({
        startSample: regionStart,
        endSample: regionEnd,
        startSeconds: regionStart / sampleRate,
        endSeconds: regionEnd / sampleRate,
        durationSeconds: (regionEnd - regionStart) / sampleRate,
        peakAmplitude: regionPeak,
      });
    }
  }
  return regions;
}

// ---- Peak list renderer ----

export interface AmplitudePeak {
  sampleIndex: number;
  timestampSeconds: number;
  amplitude: number;
  amplitudeDb: number;
}

/**
 * Find the top-N amplitude peaks in `peaksPerWindow` (output of
 * computePeakPerWindow). Returns them sorted by amplitude descending.
 * Each peak's sampleIndex is the first sample of the window.
 */
export function findTopPeaks(
  peaksPerWindow: Float32Array,
  windowSize: number,
  sampleRate: number,
  topN: number,
): AmplitudePeak[] {
  const ws = Math.max(1, Math.floor(windowSize));
  const n = Math.max(0, Math.floor(topN));
  if (peaksPerWindow.length === 0 || n === 0) return [];
  const indexed = Array.from(peaksPerWindow).map((amp, i) => ({
    sampleIndex: i * ws,
    timestampSeconds: (i * ws) / sampleRate,
    amplitude: amp,
    amplitudeDb: amp > 0 ? amplitudeToDb(amp) : Number.NEGATIVE_INFINITY,
  }));
  indexed.sort((a, b) => b.amplitude - a.amplitude);
  return indexed.slice(0, n);
}

// ---- Color presets ----

export type WaveformColorPreset = "blue" | "green" | "red" | "purple" | "mono";

export const WAVEFORM_COLOR_PRESETS: WaveformColorPreset[] = [
  "blue", "green", "red", "purple", "mono",
];

export const WAVEFORM_COLOR_LABELS: Record<WaveformColorPreset, string> = {
  "blue": "Blue",
  "green": "Green",
  "red": "Red",
  "purple": "Purple",
  "mono": "Mono (white)",
};

/** Get the CSS color string for a waveform color preset. */
export function getWaveformColor(preset: WaveformColorPreset): {
  peak: string;
  rms: string;
  silence: string;
  background: string;
} {
  switch (preset) {
    case "blue":
      return { peak: "#3b82f6", rms: "#60a5fa", silence: "#1e3a8a", background: "#0f172a" };
    case "green":
      return { peak: "#22c55e", rms: "#4ade80", silence: "#166534", background: "#0f172a" };
    case "red":
      return { peak: "#ef4444", rms: "#f87171", silence: "#7f1d1d", background: "#0f172a" };
    case "purple":
      return { peak: "#a855f7", rms: "#c084fc", silence: "#581c87", background: "#0f172a" };
    case "mono":
      return { peak: "#ffffff", rms: "#9ca3af", silence: "#374151", background: "#0f172a" };
  }
}

// ---- Summary stats ----

export interface WaveformStats {
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  totalSamples: number;
  peakAmplitude: number;
  peakAmplitudeDb: number;
  peakTimestampSeconds: number;
  rmsAmplitude: number;
  rmsAmplitudeDb: number;
  silenceCount: number;
  silenceTotalSeconds: number;
  silencePct: number;
  peakCount: number;
}

/** Compute summary stats from samples, silence regions, and peaks. */
export function computeWaveformStats(
  samples: Float32Array,
  sampleRate: number,
  channels: number,
  regions: SilenceRegion[],
  peaks: AmplitudePeak[],
): WaveformStats {
  const totalSamples = samples.length;
  const durationSeconds = sampleRate > 0 ? totalSamples / sampleRate : 0;
  let peakAmp = 0;
  let peakIdx = 0;
  let sumSq = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]);
    if (a > peakAmp) { peakAmp = a; peakIdx = i; }
    sumSq += samples[i] * samples[i];
  }
  const rmsAmp = samples.length > 0 ? Math.sqrt(sumSq / samples.length) : 0;
  const silenceTotal = regions.reduce((s, r) => s + r.durationSeconds, 0);
  return {
    durationSeconds,
    sampleRate,
    channels,
    totalSamples,
    peakAmplitude: peakAmp,
    peakAmplitudeDb: peakAmp > 0 ? amplitudeToDb(peakAmp) : Number.NEGATIVE_INFINITY,
    peakTimestampSeconds: peakIdx / sampleRate,
    rmsAmplitude: rmsAmp,
    rmsAmplitudeDb: rmsAmp > 0 ? amplitudeToDb(rmsAmp) : Number.NEGATIVE_INFINITY,
    silenceCount: regions.length,
    silenceTotalSeconds: silenceTotal,
    silencePct: durationSeconds > 0 ? (silenceTotal / durationSeconds) * 100 : 0,
    peakCount: peaks.length,
  };
}

// ---- Formatters ----

/** Format seconds as M:SS.mmm (e.g. 90.25 → "1:30.250"). */
export function formatTimestamp(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const totalMs = Math.round(seconds * 1000);
  const m = Math.floor(totalMs / 60_000);
  const s = Math.floor((totalMs % 60_000) / 1000);
  const ms = totalMs % 1000;
  const pad2 = (n: number) => n < 10 ? `0${n}` : `${n}`;
  const pad3 = (n: number) => n < 10 ? `00${n}` : n < 100 ? `0${n}` : `${n}`;
  return `${pad2(m)}:${pad2(s)}.${pad3(ms)}`;
}

/** Format a dBFS value for display (-Infinity → "-∞ dB"). */
export function formatDb(db: number): string {
  if (!Number.isFinite(db)) return "-∞ dB";
  return `${db.toFixed(2)} dB`;
}

// ---- Renderers ----

export interface WaveformAnalysis {
  fileName: string;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  channelView: ChannelView;
  zoom: number;
  silenceThresholdDb: number;
  minSilenceDurationMs: number;
  stats: WaveformStats;
  silenceRegions: SilenceRegion[];
  peaks: AmplitudePeak[];
}

/** Render analysis as plain text report. */
export function renderText(r: WaveformAnalysis): string {
  const lines: string[] = [];
  lines.push("Audio Waveform Analysis Report");
  lines.push("================================");
  lines.push(`File: ${r.fileName}`);
  lines.push(`Duration: ${formatTimestamp(r.durationSeconds)} (${r.durationSeconds.toFixed(3)} s)`);
  lines.push(`Sample rate: ${r.sampleRate} Hz`);
  lines.push(`Channels: ${r.channels}`);
  lines.push(`Channel view: ${r.channelView}`);
  lines.push(`Zoom: ${r.zoom}×`);
  lines.push(`Silence threshold: ${r.silenceThresholdDb} dB`);
  lines.push(`Min silence duration: ${r.minSilenceDurationMs} ms`);
  lines.push("");
  lines.push("Summary");
  lines.push("--------------------------------");
  lines.push(`Peak amplitude: ${r.stats.peakAmplitude.toFixed(4)} (${formatDb(r.stats.peakAmplitudeDb)})`);
  lines.push(`Peak timestamp: ${formatTimestamp(r.stats.peakTimestampSeconds)}`);
  lines.push(`RMS amplitude: ${r.stats.rmsAmplitude.toFixed(4)} (${formatDb(r.stats.rmsAmplitudeDb)})`);
  lines.push(`Silence regions: ${r.stats.silenceCount}`);
  lines.push(`Total silence: ${formatTimestamp(r.stats.silenceTotalSeconds)} (${r.stats.silencePct.toFixed(2)}%)`);
  lines.push(`Top peaks found: ${r.stats.peakCount}`);
  lines.push("");
  lines.push("Silence Regions");
  lines.push("--------------------------------");
  if (r.silenceRegions.length === 0) {
    lines.push("(no silence regions detected)");
  } else {
    lines.push("Start         End           Duration      Peak (dB)");
    for (const reg of r.silenceRegions) {
      lines.push(
        `${formatTimestamp(reg.startSeconds).padEnd(13)} ` +
        `${formatTimestamp(reg.endSeconds).padEnd(13)} ` +
        `${formatTimestamp(reg.durationSeconds).padEnd(13)} ` +
        `${formatDb(amplitudeToDb(reg.peakAmplitude)).padStart(11)}`,
      );
    }
  }
  lines.push("");
  lines.push("Top Amplitude Peaks");
  lines.push("--------------------------------");
  if (r.peaks.length === 0) {
    lines.push("(no peaks found)");
  } else {
    lines.push("Rank  Timestamp     Amplitude     Magnitude (dB)");
    r.peaks.forEach((p, i) => {
      lines.push(
        `${String(i + 1).padStart(4)}  ${formatTimestamp(p.timestampSeconds).padEnd(13)} ` +
        `${p.amplitude.toFixed(4).padEnd(13)} ${formatDb(p.amplitudeDb).padStart(13)}`,
      );
    });
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Render events (peaks + silence regions) as CSV.
 * Columns: timestamp, amplitude, type (peak|silence_start|silence_end).
 */
export function renderCsv(r: WaveformAnalysis): string {
  const lines: string[] = ["timestamp,amplitude,amplitude_db,type,duration_seconds"];
  for (const p of r.peaks) {
    lines.push([
      p.timestampSeconds.toFixed(4),
      p.amplitude.toFixed(4),
      Number.isFinite(p.amplitudeDb) ? p.amplitudeDb.toFixed(4) : "-Infinity",
      "peak",
      "0",
    ].join(","));
  }
  for (const reg of r.silenceRegions) {
    const db = amplitudeToDb(reg.peakAmplitude);
    lines.push([
      reg.startSeconds.toFixed(4),
      reg.peakAmplitude.toFixed(4),
      Number.isFinite(db) ? db.toFixed(4) : "-Infinity",
      "silence_start",
      reg.durationSeconds.toFixed(4),
    ].join(","));
    lines.push([
      reg.endSeconds.toFixed(4),
      reg.peakAmplitude.toFixed(4),
      Number.isFinite(db) ? db.toFixed(4) : "-Infinity",
      "silence_end",
      reg.durationSeconds.toFixed(4),
    ].join(","));
  }
  return lines.join("\n");
}

/** Render silence regions only as CSV. */
export function renderSilenceCsv(r: WaveformAnalysis): string {
  const lines: string[] = ["start_seconds,end_seconds,duration_seconds,peak_amplitude,peak_db"];
  for (const reg of r.silenceRegions) {
    const db = amplitudeToDb(reg.peakAmplitude);
    lines.push([
      reg.startSeconds.toFixed(4),
      reg.endSeconds.toFixed(4),
      reg.durationSeconds.toFixed(4),
      reg.peakAmplitude.toFixed(4),
      Number.isFinite(db) ? db.toFixed(4) : "-Infinity",
    ].join(","));
  }
  return lines.join("\n");
}

/** Escape helper exposed for tests. */
export function _escapeCsv(s: string): string {
  return escapeCsv(s);
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:audio-waveform-viewer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  fileName: string;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  channelView: ChannelView;
  zoom: number;
  silenceThresholdDb: number;
  minSilenceDurationMs: number;
  silenceCount: number;
  silencePct: number;
  peakCount: number;
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
  channelView: ChannelView;
  zoom: ZoomPreset;
  color: WaveformColorPreset;
  silenceThreshold: SilenceThresholdPreset;
  minSilenceDuration: MinSilenceDurationPreset;
  topPeaks: number;
}

export function buildShareUrl(settings: ShareSettings): string {
  const params = new URLSearchParams();
  params.set("ch", settings.channelView);
  params.set("zoom", settings.zoom);
  params.set("color", settings.color);
  params.set("sth", settings.silenceThreshold);
  params.set("msd", settings.minSilenceDuration);
  params.set("peaks", String(settings.topPeaks));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareSettings> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ShareSettings> = {};
  const ch = params.get("ch");
  if (ch && CHANNEL_VIEWS.includes(ch as ChannelView)) out.channelView = ch as ChannelView;
  const zoom = params.get("zoom");
  if (zoom && ZOOM_PRESETS.includes(zoom as ZoomPreset)) out.zoom = zoom as ZoomPreset;
  const color = params.get("color");
  if (color && WAVEFORM_COLOR_PRESETS.includes(color as WaveformColorPreset)) out.color = color as WaveformColorPreset;
  const sth = params.get("sth");
  if (sth && SILENCE_THRESHOLD_PRESETS.includes(sth as SilenceThresholdPreset)) out.silenceThreshold = sth as SilenceThresholdPreset;
  const msd = params.get("msd");
  if (msd && MIN_SILENCE_DURATION_PRESETS.includes(msd as MinSilenceDurationPreset)) out.minSilenceDuration = msd as MinSilenceDurationPreset;
  const peaks = params.get("peaks");
  if (peaks) {
    const n = parseInt(peaks, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 100) out.topPeaks = n;
  }
  return out;
}
