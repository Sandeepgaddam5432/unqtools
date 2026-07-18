/**
 * Audio Spectrum Analyzer — pure logic.
 *
 * Pure helpers only — no DOM, no AudioContext. The actual decoding and
 * real-time visualization happen in ui.tsx via Web Audio API (AnalyserNode).
 * This module contains: FFT size presets & validator, window function
 * generators, bin ↔ frequency converters, band calculator, peak finder,
 * dBFS converter, magnitude calculator, smoothing applier, color palette
 * presets, FFT math (radix-2 Cooley-Tukey), text/CSV renderers, history
 * (localStorage), shareable URL, and summary stats.
 */

// ---- FFT size presets & validator ----

export type FftSizePreset = "256" | "512" | "1024" | "2048" | "4096" | "8192";

export const FFT_SIZE_PRESETS: FftSizePreset[] = [
  "256", "512", "1024", "2048", "4096", "8192",
];

export const FFT_SIZE_TO_NUMBER: Record<FftSizePreset, number> = {
  "256": 256,
  "512": 512,
  "1024": 1024,
  "2048": 2048,
  "4096": 4096,
  "8192": 8192,
};

export const MIN_FFT_SIZE = 32;
export const MAX_FFT_SIZE = 32768;

/** True iff `n` is a power of two (and a positive integer). */
export function isPowerOfTwo(n: number): boolean {
  if (!Number.isInteger(n) || n <= 0) return false;
  return (n & (n - 1)) === 0;
}

/**
 * Validate an FFT size. Must be a power of two in [MIN_FFT_SIZE, MAX_FFT_SIZE].
 */
export function validateFftSize(size: number): { ok: boolean; error?: string } {
  if (!Number.isFinite(size)) return { ok: false, error: "FFT size must be a finite number." };
  if (!Number.isInteger(size)) return { ok: false, error: "FFT size must be an integer." };
  if (!isPowerOfTwo(size)) return { ok: false, error: "FFT size must be a power of two." };
  if (size < MIN_FFT_SIZE) return { ok: false, error: `FFT size must be ≥ ${MIN_FFT_SIZE}.` };
  if (size > MAX_FFT_SIZE) return { ok: false, error: `FFT size must be ≤ ${MAX_FFT_SIZE}.` };
  return { ok: true };
}

// ---- Window function generators ----

export type WindowFunction = "hanning" | "hamming" | "blackman" | "rectangular";

export const WINDOW_FUNCTIONS: WindowFunction[] = [
  "hanning", "hamming", "blackman", "rectangular",
];

export const WINDOW_LABELS: Record<WindowFunction, string> = {
  "hanning": "Hanning",
  "hamming": "Hamming",
  "blackman": "Blackman",
  "rectangular": "Rectangular (none)",
};

/** Generate a window function array of length `size`. */
export function generateWindow(type: WindowFunction, size: number): Float32Array {
  const out = new Float32Array(size);
  if (size <= 0) return out;
  if (size === 1) {
    out[0] = 1;
    return out;
  }
  const N = size - 1;
  for (let n = 0; n < size; n++) {
    const x = (2 * Math.PI * n) / N;
    switch (type) {
      case "hanning":
        out[n] = 0.5 - 0.5 * Math.cos(x);
        break;
      case "hamming":
        out[n] = 0.54 - 0.46 * Math.cos(x);
        break;
      case "blackman":
        out[n] = 0.42 - 0.5 * Math.cos(x) + 0.08 * Math.cos(2 * x);
        break;
      case "rectangular":
        out[n] = 1;
        break;
    }
  }
  return out;
}

/** Apply a window to a signal (element-wise multiply). Returns a new array. */
export function applyWindow(signal: Float32Array, window: Float32Array): Float32Array {
  const n = Math.min(signal.length, window.length);
  const out = new Float32Array(signal.length);
  for (let i = 0; i < signal.length; i++) {
    out[i] = i < n ? signal[i] * window[i] : 0;
  }
  return out;
}

// ---- Bin ↔ frequency converters ----

/** Convert FFT bin index to frequency in Hz. */
export function binToFrequency(bin: number, sampleRate: number, fftSize: number): number {
  if (fftSize <= 0) return 0;
  return (bin * sampleRate) / fftSize;
}

/** Convert frequency in Hz to FFT bin index (rounded down). */
export function frequencyToBin(frequency: number, sampleRate: number, fftSize: number): number {
  if (sampleRate <= 0) return 0;
  return Math.max(0, Math.floor((frequency * fftSize) / sampleRate));
}

/** Nyquist frequency for a given sample rate. */
export function nyquistFrequency(sampleRate: number): number {
  return sampleRate / 2;
}

// ---- Standard frequency bands (7) ----

export type BandName =
  | "sub-bass"
  | "bass"
  | "low-mid"
  | "mid"
  | "high-mid"
  | "presence"
  | "brilliance";

export interface FrequencyBand {
  name: BandName;
  label: string;
  minHz: number;
  maxHz: number;
}

export const FREQUENCY_BANDS: FrequencyBand[] = [
  { name: "sub-bass", label: "Sub-bass", minHz: 20, maxHz: 60 },
  { name: "bass", label: "Bass", minHz: 60, maxHz: 250 },
  { name: "low-mid", label: "Low-mid", minHz: 250, maxHz: 500 },
  { name: "mid", label: "Mid", minHz: 500, maxHz: 2000 },
  { name: "high-mid", label: "High-mid", minHz: 2000, maxHz: 4000 },
  { name: "presence", label: "Presence", minHz: 4000, maxHz: 6000 },
  { name: "brilliance", label: "Brilliance", minHz: 6000, maxHz: 20000 },
];

// ---- dBFS & magnitude ----

/** Convert linear amplitude to dBFS (20 * log10(amplitude)). Returns -Infinity for 0. */
export function amplitudeToDb(amplitude: number): number {
  if (amplitude <= 0) return Number.NEGATIVE_INFINITY;
  return 20 * Math.log10(amplitude);
}

/** Convert dBFS back to linear amplitude. */
export function dbToAmplitude(db: number): number {
  if (!Number.isFinite(db)) return 0;
  return Math.pow(10, db / 20);
}

/** Compute magnitude from a complex (re, im) pair. */
export function computeMagnitude(re: number, im: number): number {
  return Math.sqrt(re * re + im * im);
}

/** Compute magnitude array from real & imaginary FFT output arrays. */
export function computeMagnitudeArray(
  re: Float32Array,
  im: Float32Array,
): Float32Array {
  const n = Math.min(re.length, im.length);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
  }
  return out;
}

// ---- Band energy calculator ----

export interface BandEnergy {
  name: BandName;
  label: string;
  minHz: number;
  maxHz: number;
  energy: number;       // sum of magnitudes
  energyDb: number;     // 20 * log10(energy) (may be -Infinity)
  peakFrequency: number; // Hz of strongest bin in band
  peakMagnitude: number;
  binCount: number;
}

/**
 * Compute per-band energy from FFT magnitudes. Only bins up to Nyquist are
 * considered. Bins outside the band range are skipped. Empty bands (no bins)
 * get 0 energy and -Infinity dB.
 */
export function computeBandEnergies(
  magnitudes: Float32Array,
  sampleRate: number,
  fftSize: number,
): BandEnergy[] {
  const nyquist = nyquistFrequency(sampleRate);
  const maxBin = Math.min(magnitudes.length, Math.floor(fftSize / 2));
  return FREQUENCY_BANDS.map((band) => {
    const loBin = Math.max(0, frequencyToBin(band.minHz, sampleRate, fftSize));
    const hiBin = Math.min(maxBin, frequencyToBin(band.maxHz, sampleRate, fftSize));
    let energy = 0;
    let peakMag = 0;
    let peakBin = loBin;
    let binCount = 0;
    for (let b = loBin; b <= hiBin && b < magnitudes.length; b++) {
      const m = magnitudes[b];
      energy += m;
      binCount += 1;
      if (m > peakMag) {
        peakMag = m;
        peakBin = b;
      }
    }
    return {
      name: band.name,
      label: band.label,
      minHz: band.minHz,
      maxHz: Math.min(band.maxHz, nyquist),
      energy,
      energyDb: energy > 0 ? amplitudeToDb(energy) : Number.NEGATIVE_INFINITY,
      peakFrequency: binToFrequency(peakBin, sampleRate, fftSize),
      peakMagnitude: peakMag,
      binCount,
    };
  });
}

// ---- Peak frequency finder ----

export interface PeakFrequency {
  bin: number;
  frequency: number;  // Hz
  magnitude: number;
  magnitudeDb: number;
}

/**
 * Find top-N peak frequencies in the FFT magnitudes (within first half of
 * spectrum, i.e. up to Nyquist). Local maxima only — a bin must be strictly
 * greater than both neighbors to count as a peak.
 */
export function findPeaks(
  magnitudes: Float32Array,
  sampleRate: number,
  fftSize: number,
  topN = 5,
): PeakFrequency[] {
  const maxBin = Math.min(magnitudes.length, Math.floor(fftSize / 2));
  const peaks: PeakFrequency[] = [];
  // Skip bin 0 (DC) — usually not meaningful
  for (let b = 1; b < maxBin - 1; b++) {
    const m = magnitudes[b];
    if (m > magnitudes[b - 1] && m > magnitudes[b + 1]) {
      peaks.push({
        bin: b,
        frequency: binToFrequency(b, sampleRate, fftSize),
        magnitude: m,
        magnitudeDb: amplitudeToDb(m),
      });
    }
  }
  peaks.sort((a, b) => b.magnitude - a.magnitude);
  return peaks.slice(0, Math.max(0, topN));
}

// ---- Smoothing (exponential moving average) ----

/**
 * Apply exponential moving average smoothing for visualization.
 *   out[i] = smoothing * prev[i] + (1 - smoothing) * cur[i]
 * `smoothing` should be in [0, 1]. 0 = no smoothing, 0.99 = heavy smoothing.
 * Returns the smoothed current array.
 */
export function applySmoothing(
  current: Float32Array,
  previous: Float32Array | null,
  smoothing: number,
): Float32Array {
  const s = Math.max(0, Math.min(1, smoothing));
  const out = new Float32Array(current.length);
  for (let i = 0; i < current.length; i++) {
    if (previous && i < previous.length) {
      out[i] = s * previous[i] + (1 - s) * current[i];
    } else {
      out[i] = current[i];
    }
  }
  return out;
}

// ---- Color palette presets ----

export type ColorPalette = "rainbow" | "heat" | "cool" | "mono";

export const COLOR_PALETTES: ColorPalette[] = ["rainbow", "heat", "cool", "mono"];

export const PALETTE_LABELS: Record<ColorPalette, string> = {
  "rainbow": "Rainbow",
  "heat": "Heat",
  "cool": "Cool",
  "mono": "Mono (green)",
};

/**
 * Map a value t in [0, 1] to an [r, g, b] color via the chosen palette.
 * Values outside [0, 1] are clamped.
 */
export function getPaletteColor(palette: ColorPalette, t: number): [number, number, number] {
  const x = Math.max(0, Math.min(1, t));
  switch (palette) {
    case "rainbow": {
      // HSL hue 240° (blue) → 0° (red), so low → blue, high → red.
      const hue = (1 - x) * 240;
      return hslToRgb(hue, 1, 0.5);
    }
    case "heat": {
      // Black → red → yellow → white
      if (x < 0.33) {
        const k = x / 0.33;
        return [Math.round(255 * k), 0, 0];
      } else if (x < 0.66) {
        const k = (x - 0.33) / 0.33;
        return [255, Math.round(255 * k), 0];
      } else {
        const k = (x - 0.66) / 0.34;
        return [255, 255, Math.round(255 * k)];
      }
    }
    case "cool": {
      // Dark teal → cyan → light cyan
      return [
        Math.round(40 * x),
        Math.round(120 + 100 * x),
        Math.round(150 + 100 * x),
      ];
    }
    case "mono": {
      // Dark green → bright green
      const v = Math.round(40 + 215 * x);
      return [Math.round(20 * x), v, Math.round(60 * x)];
    }
  }
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp >= 0 && hp < 1) { r = c; g = x; }
  else if (hp < 2) { r = x; g = c; }
  else if (hp < 3) { g = c; b = x; }
  else if (hp < 4) { g = x; b = c; }
  else if (hp < 5) { r = x; b = c; }
  else { r = c; b = x; }
  const m = l - c / 2;
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

// ---- Radix-2 Cooley-Tukey FFT (pure) ----

/**
 * Compute the discrete Fourier transform of a real-valued input using a
 * radix-2 Cooley-Tukey FFT. If the input length is not a power of two, the
 * input is zero-padded to the next power of two.
 *
 * Returns { re, im } of length N (next power of two ≥ input length).
 */
export function fft(input: Float32Array): { re: Float32Array; im: Float32Array } {
  const inputLen = input.length;
  if (inputLen === 0) {
    return { re: new Float32Array(0), im: new Float32Array(0) };
  }
  // Determine N = next power of two ≥ inputLen
  let N = 1;
  while (N < inputLen) N <<= 1;
  const re = new Float32Array(N);
  const im = new Float32Array(N);
  for (let i = 0; i < inputLen; i++) re[i] = input[i];

  // Bit-reversal permutation
  let j = 0;
  for (let i = 1; i < N; i++) {
    let bit = N >> 1;
    for (; j & bit; bit >>= 1) {
      j ^= bit;
    }
    j ^= bit;
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr;
      const ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
  }

  // Butterfly stages
  for (let len = 2; len <= N; len <<= 1) {
    const halfLen = len >> 1;
    const angle = -2 * Math.PI / len;
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);
    for (let i = 0; i < N; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < halfLen; k++) {
        const idxEven = i + k;
        const idxOdd = i + k + halfLen;
        const tRe = curRe * re[idxOdd] - curIm * im[idxOdd];
        const tIm = curRe * im[idxOdd] + curIm * re[idxOdd];
        re[idxOdd] = re[idxEven] - tRe;
        im[idxOdd] = im[idxEven] - tIm;
        re[idxEven] += tRe;
        im[idxEven] += tIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }

  return { re, im };
}

/**
 * Analyze a single windowed segment of audio. Applies the chosen window,
 * runs FFT, and returns magnitudes (one-sided, length = N/2 + 1).
 */
export function analyzeSegment(
  samples: Float32Array,
  windowType: WindowFunction,
  fftSize: number,
): Float32Array {
  const validSize = validateFftSize(fftSize).ok ? fftSize : 1024;
  // Take first fftSize samples (or zero-pad if fewer)
  const segment = new Float32Array(validSize);
  const copyLen = Math.min(samples.length, validSize);
  for (let i = 0; i < copyLen; i++) segment[i] = samples[i];
  const window = generateWindow(windowType, validSize);
  const windowed = applyWindow(segment, window);
  const { re, im } = fft(windowed);
  const mags = computeMagnitudeArray(re, im);
  // One-sided spectrum: bins 0..N/2
  return mags.subarray(0, Math.floor(validSize / 2) + 1);
}

// ---- Summary stats ----

export interface SpectrumStats {
  peakFrequencyHz: number;
  peakMagnitudeDb: number;
  totalEnergy: number;
  totalEnergyDb: number;
  spectralCentroidHz: number; // brightness centroid
  bandCount: number;
  binCount: number;
}

/** Compute summary stats from magnitudes + band energies. */
export function computeSpectrumStats(
  magnitudes: Float32Array,
  bands: BandEnergy[],
  sampleRate: number,
  fftSize: number,
): SpectrumStats {
  let totalEnergy = 0;
  let weightedSum = 0;
  let peakMag = 0;
  let peakBin = 0;
  const maxBin = Math.min(magnitudes.length, Math.floor(fftSize / 2) + 1);
  for (let b = 0; b < maxBin; b++) {
    const m = magnitudes[b];
    totalEnergy += m;
    weightedSum += m * b;
    if (m > peakMag) {
      peakMag = m;
      peakBin = b;
    }
  }
  const spectralCentroidHz = totalEnergy > 0
    ? binToFrequency(weightedSum / totalEnergy, sampleRate, fftSize)
    : 0;
  return {
    peakFrequencyHz: binToFrequency(peakBin, sampleRate, fftSize),
    peakMagnitudeDb: peakMag > 0 ? amplitudeToDb(peakMag) : Number.NEGATIVE_INFINITY,
    totalEnergy,
    totalEnergyDb: totalEnergy > 0 ? amplitudeToDb(totalEnergy) : Number.NEGATIVE_INFINITY,
    spectralCentroidHz,
    bandCount: bands.length,
    binCount: maxBin,
  };
}

// ---- Renderers ----

export interface AnalysisResult {
  fileName: string;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  fftSize: number;
  windowFunction: WindowFunction;
  bands: BandEnergy[];
  peaks: PeakFrequency[];
  stats: SpectrumStats;
}

/** Format an Hz value for display (e.g. 440 → "440 Hz", 12000 → "12.00 kHz"). */
export function formatHz(hz: number): string {
  if (!Number.isFinite(hz)) return "-∞ Hz";
  if (hz >= 1000) return `${(hz / 1000).toFixed(2)} kHz`;
  return `${hz.toFixed(1)} Hz`;
}

/** Format a dBFS value for display (-Infinity → "-∞ dB"). */
export function formatDb(db: number): string {
  if (!Number.isFinite(db)) return "-∞ dB";
  return `${db.toFixed(2)} dB`;
}

/** Render analysis as plain text report. */
export function renderText(r: AnalysisResult): string {
  const lines: string[] = [];
  lines.push("Audio Spectrum Analysis Report");
  lines.push("================================");
  lines.push(`File: ${r.fileName}`);
  lines.push(`Duration: ${r.durationSeconds.toFixed(3)} s`);
  lines.push(`Sample rate: ${r.sampleRate} Hz`);
  lines.push(`Channels: ${r.channels}`);
  lines.push(`FFT size: ${r.fftSize}`);
  lines.push(`Window function: ${r.windowFunction}`);
  lines.push("");
  lines.push("Summary");
  lines.push("--------------------------------");
  lines.push(`Peak frequency: ${formatHz(r.stats.peakFrequencyHz)} (${formatDb(r.stats.peakMagnitudeDb)})`);
  lines.push(`Spectral centroid: ${formatHz(r.stats.spectralCentroidHz)}`);
  lines.push(`Total energy: ${formatDb(r.stats.totalEnergyDb)}`);
  lines.push(`Bins analyzed: ${r.stats.binCount}`);
  lines.push("");
  lines.push("Frequency Bands");
  lines.push("--------------------------------");
  lines.push("Band         Range (Hz)        Energy (dB)   Peak (Hz)      Bins");
  for (const b of r.bands) {
    lines.push(
      `${b.label.padEnd(12)} ${String(b.minHz).padStart(6)}-${String(b.maxHz).padStart(6)}   ` +
      `${formatDb(b.energyDb).padStart(11)}   ${formatHz(b.peakFrequency).padStart(12)}   ${String(b.binCount).padStart(4)}`,
    );
  }
  lines.push("");
  lines.push("Top Peak Frequencies");
  lines.push("--------------------------------");
  if (r.peaks.length === 0) {
    lines.push("(no peaks found)");
  } else {
    lines.push("Rank  Frequency       Magnitude (dB)   Bin");
    r.peaks.forEach((p, i) => {
      lines.push(
        `${String(i + 1).padStart(4)}  ${formatHz(p.frequency).padStart(12)}   ` +
        `${formatDb(p.magnitudeDb).padStart(13)}   ${String(p.bin).padStart(6)}`,
      );
    });
  }
  return lines.join("\n");
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Render band energies as CSV. */
export function renderCsv(r: AnalysisResult): string {
  const lines: string[] = [];
  lines.push("band,range_hz,energy_db,peak_frequency_hz,peak_magnitude_db,bin_count");
  for (const b of r.bands) {
    lines.push([
      escapeCsv(b.label),
      `${b.minHz}-${b.maxHz}`,
      Number.isFinite(b.energyDb) ? b.energyDb.toFixed(4) : "-Infinity",
      b.peakFrequency.toFixed(2),
      Number.isFinite(b.energyDb) && b.peakMagnitude > 0 ? b.peakMagnitude.toFixed(4) : "0",
      String(b.binCount),
    ].join(","));
  }
  return lines.join("\n");
}

/** Render peak list as CSV (timestamp-like rows of frequency/magnitude). */
export function renderPeaksCsv(r: AnalysisResult): string {
  const lines: string[] = ["rank,frequency_hz,magnitude,magnitude_db,bin"];
  r.peaks.forEach((p, i) => {
    lines.push([
      String(i + 1),
      p.frequency.toFixed(2),
      p.magnitude.toFixed(4),
      Number.isFinite(p.magnitudeDb) ? p.magnitudeDb.toFixed(4) : "-Infinity",
      String(p.bin),
    ].join(","));
  });
  return lines.join("\n");
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:audio-spectrum-analyzer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  fileName: string;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  fftSize: number;
  windowFunction: WindowFunction;
  peakFrequencyHz: number;
  spectralCentroidHz: number;
  bandCount: number;
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
  fftSize: FftSizePreset;
  windowFunction: WindowFunction;
  palette: ColorPalette;
  topPeaks: number;
  smoothing: number;
}

export function buildShareUrl(settings: ShareSettings): string {
  const params = new URLSearchParams();
  params.set("fft", settings.fftSize);
  params.set("win", settings.windowFunction);
  params.set("pal", settings.palette);
  params.set("peaks", String(settings.topPeaks));
  params.set("smooth", settings.smoothing.toFixed(2));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareSettings> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ShareSettings> = {};
  const fft = params.get("fft");
  if (fft && FFT_SIZE_PRESETS.includes(fft as FftSizePreset)) out.fftSize = fft as FftSizePreset;
  const win = params.get("win");
  if (win && WINDOW_FUNCTIONS.includes(win as WindowFunction)) out.windowFunction = win as WindowFunction;
  const pal = params.get("pal");
  if (pal && COLOR_PALETTES.includes(pal as ColorPalette)) out.palette = pal as ColorPalette;
  const peaks = params.get("peaks");
  if (peaks) {
    const n = parseInt(peaks, 10);
    if (Number.isFinite(n) && n >= 1 && n <= 50) out.topPeaks = n;
  }
  const smooth = params.get("smooth");
  if (smooth) {
    const s = parseFloat(smooth);
    if (Number.isFinite(s) && s >= 0 && s <= 1) out.smoothing = s;
  }
  return out;
}
