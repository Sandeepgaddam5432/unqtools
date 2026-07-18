/**
 * Audio Noise Reducer — pure logic.
 *
 * Pure helpers only — no DOM, no AudioContext. The actual decoding and
 * re-encoding happen in ui.tsx via Web Audio API. This module contains:
 * strength presets, noise-gate threshold presets, FFT size presets, Hanning
 * window generator, pure-JS radix-2 FFT + IFFT, magnitude/phase calculators,
 * noise-floor estimation, spectral subtraction, noise-gate applier,
 * reconstruction (magnitude/phase → samples), file-size estimator, WAV
 * encoder, text + CSV report renderers, filename generator, history
 * (localStorage), shareable URL, and summary stats.
 */

// ---- Strength presets ----

export type StrengthPreset = "light" | "medium" | "strong" | "aggressive";

export const STRENGTH_PRESETS: StrengthPreset[] = [
  "light", "medium", "strong", "aggressive",
];

export const STRENGTH_VALUES: Record<StrengthPreset, number> = {
  light: 25,
  medium: 50,
  strong: 75,
  aggressive: 100,
};

export const STRENGTH_LABELS: Record<StrengthPreset, string> = {
  light: "Light (25)",
  medium: "Medium (50) — default",
  strong: "Strong (75)",
  aggressive: "Aggressive (100)",
};

/** Default strength — medium. */
export const DEFAULT_STRENGTH: StrengthPreset = "medium";

/**
 * Convert a strength value (0–100) to the over-subtraction factor alpha
 * used in spectral subtraction: alpha = 1 + (strength/100) * 3, so the range
 * is [1, 4]. A value of 1 gives plain subtraction; higher values subtract
 * more than the measured noise floor (over-subtraction) to suppress musical
 * noise.
 */
export function strengthToAlpha(strength: number): number {
  const s = Math.max(0, Math.min(100, strength));
  return 1 + (s / 100) * 3;
}

/** Validate a custom strength value (0–100). */
export function validateStrength(strength: number): { ok: boolean; error?: string } {
  if (!Number.isFinite(strength)) return { ok: false, error: "Strength must be a number." };
  if (strength < 0) return { ok: false, error: "Strength must be ≥ 0." };
  if (strength > 100) return { ok: false, error: "Strength must be ≤ 100." };
  return { ok: true };
}

// ---- Noise-gate threshold presets ----

export type GatePreset = "-30" | "-40" | "-50" | "-60";

export const GATE_PRESETS: GatePreset[] = ["-30", "-40", "-50", "-60"];

export const GATE_VALUES: Record<GatePreset, number> = {
  "-30": -30,
  "-40": -40,
  "-50": -50,
  "-60": -60,
};

export const GATE_LABELS: Record<GatePreset, string> = {
  "-30": "-30 dBFS (gentle)",
  "-40": "-40 dBFS — default",
  "-50": "-50 dBFS (aggressive)",
  "-60": "-60 dBFS (deep hiss)",
};

/** Default gate threshold. */
export const DEFAULT_GATE: GatePreset = "-40";

// ---- FFT size presets ----

export type FftSizePreset = "256" | "512" | "1024" | "2048" | "4096";

export const FFT_SIZE_PRESETS: FftSizePreset[] = [
  "256", "512", "1024", "2048", "4096",
];

export const FFT_SIZE_TO_NUMBER: Record<FftSizePreset, number> = {
  "256": 256,
  "512": 512,
  "1024": 1024,
  "2048": 2048,
  "4096": 4096,
};

/** Default FFT size — 1024 samples (~23 ms at 44.1 kHz). */
export const DEFAULT_FFT_SIZE: FftSizePreset = "1024";

/** True iff `n` is a power of two (and a positive integer). */
export function isPowerOfTwo(n: number): boolean {
  if (!Number.isInteger(n) || n <= 0) return false;
  return (n & (n - 1)) === 0;
}

// ---- dBFS ↔ linear converters ----

/** Convert dBFS to linear amplitude: amplitude = 10^(dbfs/20). */
export function dbfsToLinear(dbfs: number): number {
  if (!Number.isFinite(dbfs)) return 0;
  const clamped = Math.max(-200, Math.min(20, dbfs));
  return Math.pow(10, clamped / 20);
}

/** Convert linear amplitude to dBFS: dbfs = 20 * log10(amp). -Infinity for 0. */
export function linearToDbfs(amp: number): number {
  if (!Number.isFinite(amp) || amp <= 0) return Number.NEGATIVE_INFINITY;
  return 20 * Math.log10(amp);
}

// ---- Hanning window ----

/**
 * Generate a Hanning window of length `size`: w[n] = 0.5 - 0.5*cos(2π n / (N-1)).
 * Returns an all-ones array if size is 1, empty for size ≤ 0.
 */
export function generateHanning(size: number): Float32Array {
  const out = new Float32Array(size);
  if (size <= 0) return out;
  if (size === 1) { out[0] = 1; return out; }
  const N = size - 1;
  for (let n = 0; n < size; n++) {
    out[n] = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / N);
  }
  return out;
}

/**
 * Apply a window to a signal (element-wise multiply). Returns a new array.
 * If the window is shorter than the signal, the signal is zero-padded.
 */
export function applyWindow(signal: Float32Array, window: Float32Array): Float32Array {
  const out = new Float32Array(signal.length);
  const n = Math.min(signal.length, window.length);
  for (let i = 0; i < signal.length; i++) {
    out[i] = i < n ? signal[i] * window[i] : 0;
  }
  return out;
}

// ---- Pure-JS radix-2 Cooley-Tukey FFT ----

/**
 * Compute the DFT of a real-valued input using a radix-2 Cooley-Tukey FFT.
 * If the input length is not a power of two, the input is zero-padded to the
 * next power of two. Returns { re, im } of length N (next power of two ≥
 * input length).
 */
export function fft(input: Float32Array): { re: Float32Array; im: Float32Array } {
  const inputLen = input.length;
  if (inputLen === 0) {
    return { re: new Float32Array(0), im: new Float32Array(0) };
  }
  let N = 1;
  while (N < inputLen) N <<= 1;
  const re = new Float32Array(N);
  const im = new Float32Array(N);
  for (let i = 0; i < inputLen; i++) re[i] = input[i];

  // Bit-reversal permutation
  let j = 0;
  for (let i = 1; i < N; i++) {
    let bit = N >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
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
 * Inverse FFT. Computes the time-domain signal from complex { re, im } arrays.
 * Returns a Float32Array of length N (same as input). The output is scaled by
 * 1/N (standard IFFT normalization). Uses the same radix-2 butterfly as `fft`
 * but with the opposite sign on the twiddle angle.
 *
 * Requires the input length to be a power of two; if not, the trailing
 * entries are processed up to the next power of two via the butterfly stages
 * (since N must be a power of two). Callers should always pass power-of-two
 * arrays (which `fft` produces).
 */
export function ifft(re: Float32Array, im: Float32Array): Float32Array {
  const N = re.length;
  if (N === 0) return new Float32Array(0);
  if (!isPowerOfTwo(N)) {
    // Fall back to direct DFT (sum) for non-power-of-two inputs.
    const out = new Float32Array(N);
    for (let n = 0; n < N; n++) {
      let sumRe = 0;
      let sumIm = 0;
      for (let k = 0; k < N; k++) {
        const angle = (2 * Math.PI * n * k) / N;
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        sumRe += re[k] * c - im[k] * s;
        sumIm += re[k] * s + im[k] * c;
      }
      out[n] = sumRe / N;
    }
    return out;
  }

  const outRe = new Float32Array(N);
  const outIm = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    outRe[i] = re[i];
    outIm[i] = im[i];
  }

  // Bit-reversal permutation
  let j = 0;
  for (let i = 1; i < N; i++) {
    let bit = N >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = outRe[i]; outRe[i] = outRe[j]; outRe[j] = tr;
      const ti = outIm[i]; outIm[i] = outIm[j]; outIm[j] = ti;
    }
  }

  // Butterfly stages (positive sign for IFFT)
  for (let len = 2; len <= N; len <<= 1) {
    const halfLen = len >> 1;
    const angle = 2 * Math.PI / len; // positive for IFFT
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);
    for (let i = 0; i < N; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < halfLen; k++) {
        const idxEven = i + k;
        const idxOdd = i + k + halfLen;
        const tRe = curRe * outRe[idxOdd] - curIm * outIm[idxOdd];
        const tIm = curRe * outIm[idxOdd] + curIm * outRe[idxOdd];
        outRe[idxOdd] = outRe[idxEven] - tRe;
        outIm[idxOdd] = outIm[idxEven] - tIm;
        outRe[idxEven] += tRe;
        outIm[idxEven] += tIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }

  // Scale by 1/N (standard IFFT normalization)
  const out = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    out[i] = outRe[i] / N;
  }
  return out;
}

// ---- Magnitude & phase ----

/** Magnitude of a complex (re, im) pair. */
export function computeMagnitude(re: number, im: number): number {
  return Math.sqrt(re * re + im * im);
}

/** Phase (radians) of a complex (re, im) pair: atan2(im, re). */
export function computePhase(re: number, im: number): number {
  return Math.atan2(im, re);
}

/** Magnitude array from real & imaginary FFT output arrays. */
export function computeMagnitudeArray(re: Float32Array, im: Float32Array): Float32Array {
  const n = Math.min(re.length, im.length);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]);
  }
  return out;
}

/** Phase array (radians) from real & imaginary FFT output arrays. */
export function computePhaseArray(re: Float32Array, im: Float32Array): Float32Array {
  const n = Math.min(re.length, im.length);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = Math.atan2(im[i], re[i]);
  }
  return out;
}

/**
 * Reconstruct complex (re, im) arrays from magnitude + phase:
 *   re = mag * cos(phase), im = mag * sin(phase).
 */
export function magnitudePhaseToComplex(
  magnitude: Float32Array,
  phase: Float32Array,
): { re: Float32Array; im: Float32Array } {
  const n = Math.min(magnitude.length, phase.length);
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    re[i] = magnitude[i] * Math.cos(phase[i]);
    im[i] = magnitude[i] * Math.sin(phase[i]);
  }
  return { re, im };
}

/**
 * Reconstruct a time-domain window (length N) from magnitude + phase by
 * converting back to complex and running the IFFT.
 */
export function reconstructSamples(magnitude: Float32Array, phase: Float32Array): Float32Array {
  const { re, im } = magnitudePhaseToComplex(magnitude, phase);
  return ifft(re, im);
}

// ---- Noise floor estimation ----

/**
 * Estimate the noise floor from a noise sample. The noise sample is a
 * Float32Array of raw PCM values (typically the first ~100 ms of audio).
 * We compute the FFT of the windowed noise sample and return its magnitude
 * spectrum (length = N, where N is the next power of two ≥ noiseSample.length
 * or `fftSize`, whichever is larger).
 *
 * Returns a magnitude spectrum Float32Array of length N.
 */
export function estimateNoiseFloor(
  noiseSample: Float32Array,
  fftSize: number,
): Float32Array {
  const size = isPowerOfTwo(fftSize) && fftSize > 0 ? fftSize : 1024;
  const segment = new Float32Array(size);
  const copyLen = Math.min(noiseSample.length, size);
  for (let i = 0; i < copyLen; i++) segment[i] = noiseSample[i];
  const window = generateHanning(size);
  const windowed = applyWindow(segment, window);
  const { re, im } = fft(windowed);
  return computeMagnitudeArray(re, im);
}

/**
 * Average noise floor across multiple noise windows. Each window is FFT'd
 * and the magnitude spectra are averaged bin-by-bin. Returns a Float32Array
 * of length N (the FFT size used).
 */
export function estimateNoiseFloorMulti(
  noiseWindows: Float32Array[],
  fftSize: number,
): Float32Array {
  if (noiseWindows.length === 0) return new Float32Array(0);
  const size = isPowerOfTwo(fftSize) && fftSize > 0 ? fftSize : 1024;
  const window = generateHanning(size);
  const acc = new Float32Array(size);
  let count = 0;
  for (const w of noiseWindows) {
    const segment = new Float32Array(size);
    const copyLen = Math.min(w.length, size);
    for (let i = 0; i < copyLen; i++) segment[i] = w[i];
    const windowed = applyWindow(segment, window);
    const { re, im } = fft(windowed);
    const mags = computeMagnitudeArray(re, im);
    for (let i = 0; i < size; i++) acc[i] += mags[i];
    count += 1;
  }
  if (count === 0) return acc;
  for (let i = 0; i < size; i++) acc[i] /= count;
  return acc;
}

// ---- Spectral subtraction ----

/**
 * Apply spectral subtraction: |Y| = max(|X| - alpha * |N|, 0).
 *   `signalMag` — magnitude spectrum of the current signal window
 *   `noiseMag`  — estimated noise floor magnitude spectrum (same length)
 *   `alpha`     — over-subtraction factor (typically 1–4)
 * Returns a new magnitude Float32Array with the noise subtracted.
 */
export function spectralSubtract(
  signalMag: Float32Array,
  noiseMag: Float32Array,
  alpha: number,
): Float32Array {
  const n = Math.min(signalMag.length, noiseMag.length);
  const out = new Float32Array(signalMag.length);
  const a = Math.max(0, alpha);
  for (let i = 0; i < signalMag.length; i++) {
    if (i < n) {
      const v = signalMag[i] - a * noiseMag[i];
      out[i] = v > 0 ? v : 0;
    } else {
      out[i] = signalMag[i];
    }
  }
  return out;
}

// ---- Noise gate applier ----

/**
 * Apply a noise gate to a sample buffer. Any sample whose absolute value
 * (in linear amplitude) is below the threshold (converted from dBFS) is
 * silenced. Returns a NEW Float32Array — does not mutate the input.
 */
export function applyNoiseGate(samples: Float32Array, thresholdDbfs: number): Float32Array {
  const threshold = dbfsToLinear(thresholdDbfs);
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    out[i] = Math.abs(samples[i]) < threshold ? 0 : samples[i];
  }
  return out;
}

// ---- Windowing & overlap-add ----

export interface StftResult {
  /** Per-window magnitude spectra (length = numWindows × fftSize). */
  magnitudes: Float32Array[];
  /** Per-window phase spectra (radians). */
  phases: Float32Array[];
  fftSize: number;
  hopSize: number;
  totalSamples: number;
}

/**
 * Compute the STFT of a signal: split into overlapping windows of
 * `fftSize` samples with `hopSize` spacing, Hanning-window each, and run FFT.
 * Returns the magnitude & phase spectra per window.
 */
export function stft(
  samples: Float32Array,
  fftSize: number,
  hopSize: number,
): StftResult {
  const size = isPowerOfTwo(fftSize) && fftSize > 0 ? fftSize : 1024;
  const hop = Math.max(1, hopSize);
  const window = generateHanning(size);
  const magnitudes: Float32Array[] = [];
  const phases: Float32Array[] = [];
  let pos = 0;
  while (pos < samples.length) {
    const segment = new Float32Array(size);
    const copyLen = Math.min(size, samples.length - pos);
    for (let i = 0; i < copyLen; i++) segment[i] = samples[pos + i];
    const windowed = applyWindow(segment, window);
    const { re, im } = fft(windowed);
    magnitudes.push(computeMagnitudeArray(re, im));
    phases.push(computePhaseArray(re, im));
    pos += hop;
  }
  return { magnitudes, phases, fftSize: size, hopSize: hop, totalSamples: samples.length };
}

/**
 * Reconstruct a time-domain signal from per-window magnitudes and phases
 * using overlap-add with a Hanning window. The output length matches the
 * original `totalSamples` (or `numWindows * hopSize + fftSize` if larger).
 *
 * Note: with a Hanning window and 50% hop (hopSize = fftSize/2), the sum of
 * overlapping squared windows is constant, giving perfect reconstruction.
 */
export function overlapAdd(
  magnitudes: Float32Array[],
  phases: Float32Array[],
  fftSize: number,
  hopSize: number,
  totalSamples: number,
): Float32Array {
  const size = isPowerOfTwo(fftSize) && fftSize > 0 ? fftSize : 1024;
  const hop = Math.max(1, hopSize);
  const outLen = Math.max(
    totalSamples,
    (magnitudes.length - 1) * hop + size,
  );
  const out = new Float32Array(outLen);
  const norm = new Float32Array(outLen);
  const window = generateHanning(size);
  const numWindows = Math.min(magnitudes.length, phases.length);
  for (let w = 0; w < numWindows; w++) {
    const samples = reconstructSamples(magnitudes[w], phases[w]);
    // Apply Hanning window again (analysis-synthesis windowing)
    const offset = w * hop;
    for (let i = 0; i < size && offset + i < outLen; i++) {
      const win = window[i];
      out[offset + i] += samples[i] * win;
      norm[offset + i] += win * win;
    }
  }
  // Normalize by sum of squared windows
  for (let i = 0; i < outLen; i++) {
    if (norm[i] > 1e-9) out[i] /= norm[i];
  }
  // Truncate to original length
  return out.subarray(0, Math.max(0, Math.min(outLen, totalSamples)));
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
 * per-channel Float32 sample arrays. Samples are clamped before encoding.
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

export interface NoiseReducerStats {
  inputRmsDbfs: number;
  noiseRmsDbfs: number;
  outputRmsDbfs: number;
  inputPeakDbfs: number;
  outputPeakDbfs: number;
  /** Percent reduction in RMS level (0–100). */
  noiseReducedPct: number;
  /** True if samples were clipped during reconstruction. */
  clippingPrevented: boolean;
  /** Total samples processed. */
  totalSamples: number;
  /** Number of FFT windows. */
  windowCount: number;
  /** Output WAV size in bytes. */
  outputSizeBytes: number;
}

/** Compute RMS of a Float32Array. */
export function computeRms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
}

/** Compute peak (max abs) of a Float32Array. */
export function detectPeak(samples: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > peak) peak = abs;
  }
  return peak;
}

/** Detect whether any sample exceeds [-1, 1] (would clip on PCM encoding). */
export function hasClipping(samples: Float32Array): boolean {
  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i]) > 1) return true;
  }
  return false;
}

/**
 * Compute summary stats from the input, noise-only, and output sample buffers.
 * `inputSamples` — full original audio (or channel 0).
 * `noiseSamples` — the leading noise region (typically first 100 ms).
 * `outputSamples` — denoised output (or channel 0).
 * `windowCount` — number of FFT windows used.
 * `outputSizeBytes` — final WAV byte count.
 */
export function computeSummaryStats(
  inputSamples: Float32Array,
  noiseSamples: Float32Array,
  outputSamples: Float32Array,
  windowCount: number,
  outputSizeBytes: number,
): NoiseReducerStats {
  const inputRms = computeRms(inputSamples);
  const noiseRms = computeRms(noiseSamples);
  const outputRms = computeRms(outputSamples);
  const inputPeak = detectPeak(inputSamples);
  const outputPeak = detectPeak(outputSamples);
  const inputRmsDbfs = linearToDbfs(inputRms);
  const noiseRmsDbfs = linearToDbfs(noiseRms);
  const outputRmsDbfs = linearToDbfs(outputRms);
  // Noise reduced = drop from input RMS to output RMS, as a percentage of input.
  let noiseReducedPct = 0;
  if (inputRms > 0) {
    const drop = inputRms - outputRms;
    noiseReducedPct = drop > 0 ? (drop / inputRms) * 100 : 0;
  }
  return {
    inputRmsDbfs,
    noiseRmsDbfs,
    outputRmsDbfs,
    inputPeakDbfs: linearToDbfs(inputPeak),
    outputPeakDbfs: linearToDbfs(outputPeak),
    noiseReducedPct,
    clippingPrevented: hasClipping(outputSamples),
    totalSamples: outputSamples.length,
    windowCount,
    outputSizeBytes,
  };
}

// ---- Text & CSV report renderers ----

export interface NoiseReducerReport {
  fileName: string;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  strength: number;
  alpha: number;
  gateThresholdDbfs: number;
  fftSize: number;
  noiseEstimateSamples: number;
  windowCount: number;
  hopSize: number;
  stats: NoiseReducerStats;
}

/** Format a dBFS value (handles -Infinity). */
export function formatDbfs(dbfs: number): string {
  if (!Number.isFinite(dbfs)) return "−∞ dBFS";
  return `${dbfs.toFixed(2)} dBFS`;
}

/** Render a NoiseReducerReport as a multi-line plain text report. */
export function renderReport(report: NoiseReducerReport): string {
  const s = report.stats;
  const lines: string[] = [];
  lines.push("Audio Noise Reduction Report");
  lines.push("=============================");
  lines.push("");
  lines.push(`File: ${report.fileName}`);
  lines.push(`Duration: ${formatDuration(report.durationSeconds)} (${report.durationSeconds.toFixed(3)} s)`);
  lines.push(`Sample rate: ${report.sampleRate} Hz`);
  lines.push(`Channels: ${report.channels}`);
  lines.push("");
  lines.push("Settings");
  lines.push("--------------------------------");
  lines.push(`Strength: ${report.strength}/100 (alpha = ${report.alpha.toFixed(2)})`);
  lines.push(`Noise gate: ${formatDbfs(report.gateThresholdDbfs)}`);
  lines.push(`FFT size: ${report.fftSize} samples`);
  lines.push(`Hop size: ${report.hopSize} samples (50% overlap)`);
  lines.push(`Noise estimate: ${report.noiseEstimateSamples} samples (~${(report.noiseEstimateSamples / report.sampleRate).toFixed(3)} s)`);
  lines.push(`Windows processed: ${report.windowCount}`);
  lines.push("");
  lines.push("Level analysis");
  lines.push("--------------------------------");
  lines.push(`Input  RMS: ${formatDbfs(s.inputRmsDbfs)}`);
  lines.push(`Noise  RMS: ${formatDbfs(s.noiseRmsDbfs)}`);
  lines.push(`Output RMS: ${formatDbfs(s.outputRmsDbfs)}`);
  lines.push(`Input  peak: ${formatDbfs(s.inputPeakDbfs)}`);
  lines.push(`Output peak: ${formatDbfs(s.outputPeakDbfs)}`);
  lines.push(`Noise reduced: ${s.noiseReducedPct.toFixed(1)}% (RMS drop)`);
  if (s.clippingPrevented) {
    lines.push(`⚠ Clipping detected — output was clamped before PCM encoding.`);
  }
  lines.push("");
  lines.push(`Output WAV: ${formatBytes(s.outputSizeBytes)}`);
  return lines.join("\n");
}

/** Render report as CSV: component, value. */
export function renderCsv(report: NoiseReducerReport): string {
  const s = report.stats;
  const rows: [string, string][] = [
    ["file", report.fileName],
    ["duration_seconds", report.durationSeconds.toFixed(3)],
    ["sample_rate_hz", String(report.sampleRate)],
    ["channels", String(report.channels)],
    ["strength", String(report.strength)],
    ["alpha", report.alpha.toFixed(4)],
    ["gate_threshold_dbfs", String(report.gateThresholdDbfs)],
    ["fft_size", String(report.fftSize)],
    ["hop_size", String(report.hopSize)],
    ["noise_estimate_samples", String(report.noiseEstimateSamples)],
    ["window_count", String(report.windowCount)],
    ["input_rms_dbfs", Number.isFinite(s.inputRmsDbfs) ? s.inputRmsDbfs.toFixed(4) : "-Infinity"],
    ["noise_rms_dbfs", Number.isFinite(s.noiseRmsDbfs) ? s.noiseRmsDbfs.toFixed(4) : "-Infinity"],
    ["output_rms_dbfs", Number.isFinite(s.outputRmsDbfs) ? s.outputRmsDbfs.toFixed(4) : "-Infinity"],
    ["input_peak_dbfs", Number.isFinite(s.inputPeakDbfs) ? s.inputPeakDbfs.toFixed(4) : "-Infinity"],
    ["output_peak_dbfs", Number.isFinite(s.outputPeakDbfs) ? s.outputPeakDbfs.toFixed(4) : "-Infinity"],
    ["noise_reduced_pct", s.noiseReducedPct.toFixed(4)],
    ["clipping_prevented", s.clippingPrevented ? "true" : "false"],
    ["output_size_bytes", String(s.outputSizeBytes)],
  ];
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return ["component,value", ...rows.map(([k, v]) => `${esc(k)},${esc(v)}`)].join("\n");
}

// ---- Filename generator ----

/** Generate filename: denoised-YYYY-MM-DD-HHmmss.wav. */
export function generateFilename(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mm = pad2(date.getMinutes());
  const ss = pad2(date.getSeconds());
  return `denoised-${y}-${m}-${d}-${hh}${mm}${ss}.wav`;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:audio-noise-reducer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  originalName: string;
  durationSeconds: number;
  strength: number;
  gateThresholdDbfs: number;
  fftSize: number;
  noiseReducedPct: number;
  inputRmsDbfs: number;
  outputRmsDbfs: number;
  outputSizeBytes: number;
  clippingPrevented: boolean;
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
  strength: StrengthPreset;
  gate: GatePreset;
  fftSize: FftSizePreset;
}

export function buildShareUrl(settings: ShareSettings): string {
  const params = new URLSearchParams();
  params.set("strength", settings.strength);
  params.set("gate", settings.gate);
  params.set("fft", settings.fftSize);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareSettings> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ShareSettings> = {};
  const strength = params.get("strength");
  if (strength && STRENGTH_PRESETS.includes(strength as StrengthPreset)) {
    out.strength = strength as StrengthPreset;
  }
  const gate = params.get("gate");
  if (gate && GATE_PRESETS.includes(gate as GatePreset)) {
    out.gate = gate as GatePreset;
  }
  const fft = params.get("fft");
  if (fft && FFT_SIZE_PRESETS.includes(fft as FftSizePreset)) {
    out.fftSize = fft as FftSizePreset;
  }
  return out;
}

// ---- Helpers ----

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
