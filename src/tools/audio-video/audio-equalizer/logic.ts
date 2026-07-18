/**
 * Audio Equalizer — pure logic.
 *
 * Pure helpers only — no DOM, no AudioContext. The actual decoding and
 * re-encoding happen in ui.tsx via Web Audio API (OfflineAudioContext with a
 * chain of BiquadFilterNode peaking filters). This module contains: band set
 * presets (10/5/3-band), gain presets, Q factor default, EQ preset library
 * (10+ presets), gain validator, filter chain config builder, file-size
 * estimator, WAV encoder, text + CSV report renderers, filename generator,
 * history (localStorage), shareable URL, and summary stats.
 */

// ---- Band set presets ----

export type BandSetId = "10-band" | "5-band" | "3-band";

/** 10-band ISO graphic EQ center frequencies (Hz). */
export const BANDS_10: number[] = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

/** 5-band simplified EQ center frequencies (Hz). */
export const BANDS_5: number[] = [60, 250, 1000, 4000, 12000];

/** 3-band bass/mid/treble EQ center frequencies (Hz). */
export const BANDS_3: number[] = [250, 1000, 4000];

export const BAND_SETS: Record<BandSetId, number[]> = {
  "10-band": BANDS_10,
  "5-band": BANDS_5,
  "3-band": BANDS_3,
};

export const BAND_SET_LABELS: Record<BandSetId, string> = {
  "10-band": "10-band (ISO: 31 Hz – 16 kHz)",
  "5-band": "5-band (60 Hz – 12 kHz)",
  "3-band": "3-band (Bass / Mid / Treble)",
};

export const BAND_LABELS_10: string[] = [
  "31 Hz", "62 Hz", "125 Hz", "250 Hz", "500 Hz",
  "1 kHz", "2 kHz", "4 kHz", "8 kHz", "16 kHz",
];

export const BAND_LABELS_5: string[] = [
  "60 Hz (Bass)", "250 Hz (Low-Mid)", "1 kHz (Mid)", "4 kHz (High-Mid)", "12 kHz (Treble)",
];

export const BAND_LABELS_3: string[] = [
  "250 Hz (Bass)", "1 kHz (Mid)", "4 kHz (Treble)",
];

export function getBandLabels(bandSet: BandSetId): string[] {
  if (bandSet === "10-band") return BAND_LABELS_10;
  if (bandSet === "5-band") return BAND_LABELS_5;
  return BAND_LABELS_3;
}

export function getBandFrequencies(bandSet: BandSetId): number[] {
  return BAND_SETS[bandSet];
}

/** Default band set is 10-band ISO. */
export const DEFAULT_BAND_SET: BandSetId = "10-band";

// ---- Gain presets ----

export type GainPreset = "-12" | "-6" | "-3" | "0" | "+3" | "+6" | "+12";

export const GAIN_PRESETS: GainPreset[] = [
  "-12", "-6", "-3", "0", "+3", "+6", "+12",
];

export const GAIN_PRESET_VALUES: Record<GainPreset, number> = {
  "-12": -12,
  "-6": -6,
  "-3": -3,
  "0": 0,
  "+3": 3,
  "+6": 6,
  "+12": 12,
};

export const GAIN_PRESET_LABELS: Record<GainPreset, string> = {
  "-12": "-12 dB (full cut)",
  "-6": "-6 dB",
  "-3": "-3 dB",
  "0": "0 dB (flat)",
  "+3": "+3 dB",
  "+6": "+6 dB",
  "+12": "+12 dB (full boost)",
};

/** Minimum gain in dB. */
export const MIN_GAIN_DB = -12;
/** Maximum gain in dB. */
export const MAX_GAIN_DB = 12;

/**
 * Validate a gain value. Must be a finite number in [MIN_GAIN_DB, MAX_GAIN_DB].
 */
export function validateGain(gain: number): { ok: boolean; error?: string } {
  if (!Number.isFinite(gain)) return { ok: false, error: "Gain must be a finite number." };
  if (gain < MIN_GAIN_DB) return { ok: false, error: `Gain must be ≥ ${MIN_GAIN_DB} dB.` };
  if (gain > MAX_GAIN_DB) return { ok: false, error: `Gain must be ≤ ${MAX_GAIN_DB} dB.` };
  return { ok: true };
}

/**
 * Clamp a gain value to [MIN_GAIN_DB, MAX_GAIN_DB].
 */
export function clampGain(gain: number): number {
  if (!Number.isFinite(gain)) return 0;
  return Math.max(MIN_GAIN_DB, Math.min(MAX_GAIN_DB, gain));
}

// ---- Biquad filter Q factor ----

/**
 * Default Q factor for peaking biquad filters. Q = 1.41 ≈ 1 octave bandwidth,
 * which is the standard for graphic equalizers.
 */
export const DEFAULT_Q = 1.41;

/** Validate a Q factor. Must be a positive finite number. */
export function validateQ(q: number): { ok: boolean; error?: string } {
  if (!Number.isFinite(q)) return { ok: false, error: "Q must be a finite number." };
  if (q <= 0) return { ok: false, error: "Q must be > 0." };
  if (q > 100) return { ok: false, error: "Q must be ≤ 100." };
  return { ok: true };
}

// ---- EQ preset library ----

export type EqPresetId =
  | "flat"
  | "bass-boost"
  | "treble-boost"
  | "vocal-boost"
  | "loudness"
  | "rock"
  | "pop"
  | "jazz"
  | "classical"
  | "podcast";

export interface EqPreset {
  id: EqPresetId;
  label: string;
  description: string;
  /** Gains for the 10-band EQ (dB, indexed by BANDS_10). */
  gains: number[];
}

/**
 * 10 EQ presets, each providing gains for the 10-band EQ. These are common
 * approximations of the curves found on consumer equalizers.
 */
export const EQ_PRESETS: EqPreset[] = [
  {
    id: "flat",
    label: "Flat",
    description: "No EQ applied. All bands at 0 dB.",
    gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  {
    id: "bass-boost",
    label: "Bass Boost",
    description: "Boosts low frequencies for fuller bass.",
    gains: [8, 6, 4, 2, 0, 0, 0, 0, 0, 0],
  },
  {
    id: "treble-boost",
    label: "Treble Boost",
    description: "Boosts high frequencies for brighter sound.",
    gains: [0, 0, 0, 0, 0, 0, 2, 4, 6, 8],
  },
  {
    id: "vocal-boost",
    label: "Vocal Boost",
    description: "Boosts the 1–4 kHz range where vocals sit.",
    gains: [-2, -2, 0, 2, 4, 5, 4, 2, 0, -2],
  },
  {
    id: "loudness",
    label: "Loudness",
    description: "Classic loudness curve — boosts bass & treble.",
    gains: [6, 4, 0, -2, -2, 0, 0, 2, 4, 6],
  },
  {
    id: "rock",
    label: "Rock",
    description: "V-shape — boosted bass and treble, slightly cut mids.",
    gains: [5, 3, 1, -1, -2, -1, 1, 3, 4, 5],
  },
  {
    id: "pop",
    label: "Pop",
    description: "Slight boost in vocals & treble, gentle bass.",
    gains: [-1, 1, 3, 4, 3, 1, 0, 1, 2, 2],
  },
  {
    id: "jazz",
    label: "Jazz",
    description: "Warm — slight bass & mid cut, gentle treble lift.",
    gains: [3, 2, 0, -1, 0, 1, 2, 2, 1, 2],
  },
  {
    id: "classical",
    label: "Classical",
    description: "Mostly flat with subtle treble lift for clarity.",
    gains: [0, 0, 0, 0, 0, 0, 0, 1, 2, 2],
  },
  {
    id: "podcast",
    label: "Podcast",
    description: "Cuts rumble below 100 Hz, lifts vocal presence band.",
    gains: [-6, -4, -2, 0, 2, 4, 3, 1, 0, -2],
  },
];

/** Look up a preset by id. Returns undefined if not found. */
export function getPreset(id: EqPresetId): EqPreset | undefined {
  return EQ_PRESETS.find((p) => p.id === id);
}

/**
 * Map a 10-band preset's gains onto a different band set by nearest-frequency
 * matching. Returns gains of length matching the target band set.
 */
export function presetToBandSet(preset: EqPreset, bandSet: BandSetId): number[] {
  const targetBands = BAND_SETS[bandSet];
  return targetBands.map((f) => {
    // Find nearest frequency in the 10-band set
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < BANDS_10.length; i++) {
      const d = Math.abs(BANDS_10[i] - f);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    return preset.gains[bestIdx];
  });
}

// ---- Filter chain config builder ----

export interface FilterConfig {
  /** Center frequency in Hz. */
  frequency: number;
  /** Gain in dB. */
  gain: number;
  /** Q factor (dimensionless). */
  q: number;
}

/**
 * Build a BiquadFilterNode chain config from an array of gains (one per band)
 * and a matching array of frequencies. Returns an array of FilterConfig objects
 * suitable for setting up BiquadFilterNodes (type = "peaking") in an
 * AudioContext / OfflineAudioContext.
 *
 * The Q factor is taken from `q` (default 1.41). Frequencies with gain === 0
 * are still included in the chain (the resulting filter is effectively a no-op
 * but is included for simplicity — callers can skip them if desired).
 */
export function buildFilterChain(
  frequencies: number[],
  gains: number[],
  q: number = DEFAULT_Q,
): FilterConfig[] {
  const n = Math.min(frequencies.length, gains.length);
  const safeQ = validateQ(q).ok ? q : DEFAULT_Q;
  const out: FilterConfig[] = [];
  for (let i = 0; i < n; i++) {
    const freq = Math.max(20, Math.min(20000, frequencies[i]));
    const gain = clampGain(gains[i]);
    out.push({ frequency: freq, gain, q: safeQ });
  }
  return out;
}

/**
 * Filter the chain to only include bands that actually have non-zero gain
 * (skipping flat bands for efficiency).
 */
export function activeFiltersOnly(chain: FilterConfig[]): FilterConfig[] {
  return chain.filter((f) => Math.abs(f.gain) > 1e-9);
}

// ---- File size estimator ----

/**
 * Estimate output WAV file size:
 *   header (44 bytes) + samples × channels × 2 bytes (16-bit)
 */
export function estimateWavSizeBytes(
  sampleCount: number,
  channels: number,
  bitsPerSample = 16,
): number {
  return 44 + sampleCount * channels * (bitsPerSample / 8);
}

/** Format bytes human-readable. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

/** Format seconds as M:SS. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

/** Format a frequency in Hz (e.g. 1000 → "1.00 kHz"). */
export function formatHz(hz: number): string {
  if (!Number.isFinite(hz)) return "—";
  if (hz >= 1000) return `${(hz / 1000).toFixed(2)} kHz`;
  return `${hz.toFixed(0)} Hz`;
}

/** Format a gain in dB (e.g. 3 → "+3.00 dB", -3 → "-3.00 dB"). */
export function formatGainDb(gain: number): string {
  if (!Number.isFinite(gain)) return "—";
  return `${gain >= 0 ? "+" : ""}${gain.toFixed(2)} dB`;
}

// ---- WAV encoder (44-byte RIFF + 16-bit PCM) ----

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
 * per-channel Float32 sample arrays. Samples should already be in [-1, 1];
 * values outside this range are clamped.
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

// ---- Summary stats ----

export interface EqStats {
  /** Number of bands in the active band set. */
  bandCount: number;
  /** Number of bands whose gain is non-zero. */
  bandsModified: number;
  /** Sum of absolute gains across all bands (dB). */
  totalGainChange: number;
  /** Maximum boost (positive gain) in dB. */
  maxBoost: number;
  /** Maximum cut (negative gain) in dB. */
  maxCut: number;
  /** Name of the preset applied (or "Custom"). */
  presetName: string;
  /** Q factor used. */
  q: number;
}

/**
 * Compute summary stats from a gains array. `presetName` is the label of the
 * applied preset (or "Custom" if user-modified).
 */
export function computeSummaryStats(
  gains: number[],
  presetName: string = "Custom",
  q: number = DEFAULT_Q,
): EqStats {
  let bandsModified = 0;
  let totalGainChange = 0;
  let maxBoost = 0;
  let maxCut = 0;
  for (const g of gains) {
    if (Math.abs(g) > 1e-9) bandsModified += 1;
    totalGainChange += Math.abs(g);
    if (g > maxBoost) maxBoost = g;
    if (g < maxCut) maxCut = g;
  }
  return {
    bandCount: gains.length,
    bandsModified,
    totalGainChange,
    maxBoost,
    maxCut,
    presetName,
    q,
  };
}

/** Detect which preset (if any) matches the current gains array. */
export function detectPreset(gains: number[], bandSet: BandSetId = "10-band"): EqPreset | null {
  // Only auto-detect for 10-band
  if (bandSet !== "10-band" || gains.length !== 10) return null;
  for (const p of EQ_PRESETS) {
    if (p.gains.length === gains.length) {
      let match = true;
      for (let i = 0; i < gains.length; i++) {
        if (Math.abs(p.gains[i] - gains[i]) > 1e-9) { match = false; break; }
      }
      if (match) return p;
    }
  }
  return null;
}

// ---- Text & CSV report renderers ----

export interface EqReport {
  fileName: string;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  bandSet: BandSetId;
  presetName: string;
  q: number;
  frequencies: number[];
  gains: number[];
  stats: EqStats;
  outputSizeBytes: number;
}

/** Render an EqReport as a multi-line plain text report. */
export function renderReport(report: EqReport): string {
  const lines: string[] = [];
  lines.push("Audio Equalizer Report");
  lines.push("======================");
  lines.push("");
  lines.push(`File: ${report.fileName}`);
  lines.push(`Duration: ${formatDuration(report.durationSeconds)} (${report.durationSeconds.toFixed(3)} s)`);
  lines.push(`Sample rate: ${report.sampleRate} Hz`);
  lines.push(`Channels: ${report.channels}`);
  lines.push("");
  lines.push("EQ Settings");
  lines.push("--------------------------------");
  lines.push(`Band set: ${BAND_SET_LABELS[report.bandSet]}`);
  lines.push(`Preset: ${report.presetName}`);
  lines.push(`Q factor: ${report.q}`);
  lines.push("");
  lines.push("Per-band gains");
  lines.push("--------------------------------");
  lines.push("Band   Frequency      Gain");
  for (let i = 0; i < report.frequencies.length; i++) {
    lines.push(
      `${String(i + 1).padStart(4)}   ${formatHz(report.frequencies[i]).padStart(12)}   ${formatGainDb(report.gains[i]).padStart(10)}`,
    );
  }
  lines.push("");
  lines.push("Summary");
  lines.push("--------------------------------");
  lines.push(`Bands: ${report.stats.bandCount}`);
  lines.push(`Bands modified: ${report.stats.bandsModified}`);
  lines.push(`Total gain change: ${report.stats.totalGainChange.toFixed(2)} dB`);
  lines.push(`Max boost: ${formatGainDb(report.stats.maxBoost)}`);
  lines.push(`Max cut: ${formatGainDb(report.stats.maxCut)}`);
  lines.push(`Output WAV: ${formatBytes(report.outputSizeBytes)}`);
  return lines.join("\n");
}

/** Render per-band gains as CSV: band, frequency_hz, gain_db. */
export function renderCsv(report: EqReport): string {
  const lines: string[] = ["band,frequency_hz,gain_db"];
  for (let i = 0; i < report.frequencies.length; i++) {
    lines.push([
      String(i + 1),
      String(report.frequencies[i]),
      report.gains[i].toFixed(2),
    ].join(","));
  }
  // Append summary rows
  lines.push(`#preset,${escapeCsv(report.presetName)}`);
  lines.push(`#band_set,${report.bandSet}`);
  lines.push(`#q,${report.q}`);
  lines.push(`#bands_modified,${report.stats.bandsModified}`);
  lines.push(`#total_gain_change_db,${report.stats.totalGainChange.toFixed(4)}`);
  lines.push(`#output_size_bytes,${report.outputSizeBytes}`);
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ---- Filename generator ----

/** Generate filename: equalized-YYYY-MM-DD-HHmmss.wav. */
export function generateFilename(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mm = pad2(date.getMinutes());
  const ss = pad2(date.getSeconds());
  return `equalized-${y}-${m}-${d}-${hh}${mm}${ss}.wav`;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:audio-equalizer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  originalName: string;
  durationSeconds: number;
  bandSet: BandSetId;
  presetName: string;
  q: number;
  gains: number[];
  bandsModified: number;
  totalGainChange: number;
  outputSizeBytes: number;
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

/**
 * Encode a gains array as a compact URL param: comma-separated dB values
 * rounded to 1 decimal place (e.g. "0,0,3,0,-3").
 */
export function encodeGains(gains: number[]): string {
  return gains.map((g) => g.toFixed(1)).join(",");
}

/** Decode a gains URL param back into an array of numbers. */
export function decodeGains(s: string): number[] {
  if (!s) return [];
  return s.split(",")
    .map((v) => parseFloat(v))
    .filter((v) => Number.isFinite(v))
    .map((v) => clampGain(v));
}

export interface ShareSettings {
  bandSet: BandSetId;
  q: number;
  gains: number[];
  preset: EqPresetId | null;
}

export function buildShareUrl(settings: ShareSettings): string {
  const params = new URLSearchParams();
  params.set("bands", settings.bandSet);
  params.set("q", settings.q.toFixed(2));
  if (settings.preset) params.set("preset", settings.preset);
  params.set("gains", encodeGains(settings.gains));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareSettings> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ShareSettings> = {};
  const bands = params.get("bands");
  if (bands === "10-band" || bands === "5-band" || bands === "3-band") {
    out.bandSet = bands;
  }
  const q = params.get("q");
  if (q) {
    const qn = parseFloat(q);
    if (Number.isFinite(qn) && validateQ(qn).ok) out.q = qn;
  }
  const preset = params.get("preset");
  if (preset && getPreset(preset as EqPresetId)) {
    out.preset = preset as EqPresetId;
  }
  const gains = params.get("gains");
  if (gains) {
    const arr = decodeGains(gains);
    if (arr.length > 0) out.gains = arr;
  }
  return out;
}

// ---- Helpers ----

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
