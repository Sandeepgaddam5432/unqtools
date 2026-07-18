import { describe, it, expect, beforeEach } from "vitest";
import {
  FFT_SIZE_PRESETS,
  FFT_SIZE_TO_NUMBER,
  MIN_FFT_SIZE,
  MAX_FFT_SIZE,
  WINDOW_FUNCTIONS,
  WINDOW_LABELS,
  FREQUENCY_BANDS,
  COLOR_PALETTES,
  PALETTE_LABELS,
  isPowerOfTwo,
  validateFftSize,
  generateWindow,
  applyWindow,
  binToFrequency,
  frequencyToBin,
  nyquistFrequency,
  amplitudeToDb,
  dbToAmplitude,
  computeMagnitude,
  computeMagnitudeArray,
  computeBandEnergies,
  findPeaks,
  applySmoothing,
  getPaletteColor,
  fft,
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
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
});

// ---- Constants ----

describe("spectrum-analyzer constants", () => {
  it("has 6 FFT size presets", () => {
    expect(FFT_SIZE_PRESETS).toHaveLength(6);
    expect(FFT_SIZE_PRESETS).toEqual(["256", "512", "1024", "2048", "4096", "8192"]);
  });
  it("maps presets to numbers", () => {
    expect(FFT_SIZE_TO_NUMBER["256"]).toBe(256);
    expect(FFT_SIZE_TO_NUMBER["8192"]).toBe(8192);
  });
  it("has 4 window functions", () => {
    expect(WINDOW_FUNCTIONS).toHaveLength(4);
    expect(WINDOW_FUNCTIONS).toContain("hanning");
    expect(WINDOW_FUNCTIONS).toContain("rectangular");
  });
  it("has 4 window labels", () => {
    expect(Object.keys(WINDOW_LABELS)).toHaveLength(4);
  });
  it("has 7 frequency bands", () => {
    expect(FREQUENCY_BANDS).toHaveLength(7);
    expect(FREQUENCY_BANDS[0].name).toBe("sub-bass");
    expect(FREQUENCY_BANDS[6].name).toBe("brilliance");
  });
  it("has 4 color palettes", () => {
    expect(COLOR_PALETTES).toHaveLength(4);
    expect(Object.keys(PALETTE_LABELS)).toHaveLength(4);
  });
  it("exposes min/max FFT size constants", () => {
    expect(MIN_FFT_SIZE).toBe(32);
    expect(MAX_FFT_SIZE).toBe(32768);
  });
  it("bands have non-overlapping ranges", () => {
    for (let i = 1; i < FREQUENCY_BANDS.length; i++) {
      expect(FREQUENCY_BANDS[i].minHz).toBeGreaterThanOrEqual(FREQUENCY_BANDS[i - 1].maxHz);
    }
  });
});

// ---- isPowerOfTwo & validateFftSize ----

describe("spectrum-analyzer isPowerOfTwo", () => {
  it("true for powers of two", () => {
    expect(isPowerOfTwo(1)).toBe(true);
    expect(isPowerOfTwo(2)).toBe(true);
    expect(isPowerOfTwo(256)).toBe(true);
    expect(isPowerOfTwo(8192)).toBe(true);
  });
  it("false for non-powers of two", () => {
    expect(isPowerOfTwo(3)).toBe(false);
    expect(isPowerOfTwo(100)).toBe(false);
    expect(isPowerOfTwo(1000)).toBe(false);
  });
  it("false for non-positive or non-integer", () => {
    expect(isPowerOfTwo(0)).toBe(false);
    expect(isPowerOfTwo(-2)).toBe(false);
    expect(isPowerOfTwo(2.5)).toBe(false);
    expect(isPowerOfTwo(NaN)).toBe(false);
  });
});

describe("spectrum-analyzer validateFftSize", () => {
  it("accepts 256", () => {
    expect(validateFftSize(256).ok).toBe(true);
  });
  it("accepts 8192", () => {
    expect(validateFftSize(8192).ok).toBe(true);
  });
  it("accepts 32 (min)", () => {
    expect(validateFftSize(32).ok).toBe(true);
  });
  it("accepts 32768 (max)", () => {
    expect(validateFftSize(32768).ok).toBe(true);
  });
  it("rejects non-power-of-two", () => {
    const r = validateFftSize(1000);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("power of two");
  });
  it("rejects below minimum", () => {
    const r = validateFftSize(16);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("≥");
  });
  it("rejects above maximum", () => {
    const r = validateFftSize(65536);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("≤");
  });
  it("rejects non-integer", () => {
    const r = validateFftSize(256.5);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("integer");
  });
  it("rejects NaN", () => {
    const r = validateFftSize(NaN);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("finite");
  });
});

// ---- Window functions ----

describe("spectrum-analyzer generateWindow", () => {
  it("returns array of correct length", () => {
    expect(generateWindow("hanning", 1024)).toHaveLength(1024);
    expect(generateWindow("rectangular", 256)).toHaveLength(256);
  });
  it("rectangular is all 1s", () => {
    const w = generateWindow("rectangular", 16);
    for (let i = 0; i < 16; i++) expect(w[i]).toBe(1);
  });
  it("hanning endpoints are 0", () => {
    const w = generateWindow("hanning", 64);
    expect(w[0]).toBeCloseTo(0, 5);
    expect(w[63]).toBeCloseTo(0, 5);
  });
  it("hanning midpoint is ~1", () => {
    // Use odd size 65 so n=32 is exactly at π in the cosine argument
    const w = generateWindow("hanning", 65);
    expect(w[32]).toBeCloseTo(1, 5);
  });
  it("hamming endpoints are 0.08 (not 0)", () => {
    const w = generateWindow("hamming", 64);
    expect(w[0]).toBeCloseTo(0.08, 4);
    expect(w[63]).toBeCloseTo(0.08, 4);
  });
  it("blackman endpoints are ~0", () => {
    const w = generateWindow("blackman", 64);
    expect(w[0]).toBeCloseTo(0, 4);
    expect(w[63]).toBeCloseTo(0, 4);
  });
  it("blackman midpoint is ~1", () => {
    // Use odd size 65 so n=32 hits the exact midpoint
    const w = generateWindow("blackman", 65);
    // 0.42 - 0.5*cos(π) + 0.08*cos(2π) = 0.42 + 0.5 + 0.08 = 1.0
    expect(w[32]).toBeCloseTo(1.0, 4);
  });
  it("handles size=1 (returns [1])", () => {
    const w = generateWindow("hanning", 1);
    expect(w).toHaveLength(1);
    expect(w[0]).toBe(1);
  });
  it("handles size=0 (returns empty)", () => {
    const w = generateWindow("hanning", 0);
    expect(w).toHaveLength(0);
  });
});

describe("spectrum-analyzer applyWindow", () => {
  it("multiplies element-wise", () => {
    const signal = new Float32Array([2, 2, 2, 2]);
    const win = new Float32Array([0.5, 1, 1, 0.5]);
    const out = applyWindow(signal, win);
    expect(Array.from(out)).toEqual([1, 2, 2, 1]);
  });
  it("does not mutate input signal", () => {
    const signal = new Float32Array([1, 2, 3]);
    const win = new Float32Array([0, 0, 0]);
    applyWindow(signal, win);
    expect(Array.from(signal)).toEqual([1, 2, 3]);
  });
  it("handles mismatched lengths (zero-pads)", () => {
    const signal = new Float32Array([1, 2, 3, 4]);
    const win = new Float32Array([1, 1]);
    const out = applyWindow(signal, win);
    expect(out).toHaveLength(4);
    expect(out[0]).toBe(1);
    expect(out[1]).toBe(2);
    expect(out[2]).toBe(0);
    expect(out[3]).toBe(0);
  });
});

// ---- Bin ↔ frequency ----

describe("spectrum-analyzer bin/frequency converters", () => {
  it("binToFrequency: bin 0 → 0 Hz", () => {
    expect(binToFrequency(0, 44100, 1024)).toBe(0);
  });
  it("binToFrequency: bin 1 at 44100/1024 → 43.07 Hz", () => {
    expect(binToFrequency(1, 44100, 1024)).toBeCloseTo(44100 / 1024, 3);
  });
  it("binToFrequency: bin 512 at 44100/1024 → 22050 Hz (Nyquist)", () => {
    expect(binToFrequency(512, 44100, 1024)).toBeCloseTo(22050, 3);
  });
  it("frequencyToBin: 0 Hz → bin 0", () => {
    expect(frequencyToBin(0, 44100, 1024)).toBe(0);
  });
  it("frequencyToBin: 440 Hz at 44100/1024 → bin ~10", () => {
    const bin = frequencyToBin(440, 44100, 1024);
    const freq = binToFrequency(bin, 44100, 1024);
    expect(freq).toBeLessThanOrEqual(440);
    expect(freq).toBeGreaterThan(440 - 44100 / 1024);
  });
  it("frequencyToBin: clamps negative to 0", () => {
    expect(frequencyToBin(-100, 44100, 1024)).toBe(0);
  });
  it("binToFrequency: handles 0 sample rate gracefully", () => {
    expect(binToFrequency(100, 0, 1024)).toBe(0);
  });
  it("frequencyToBin: handles 0 sample rate gracefully", () => {
    expect(frequencyToBin(1000, 0, 1024)).toBe(0);
  });
  it("nyquistFrequency: half sample rate", () => {
    expect(nyquistFrequency(44100)).toBe(22050);
    expect(nyquistFrequency(48000)).toBe(24000);
  });
});

// ---- dBFS & magnitude ----

describe("spectrum-analyzer dBFS conversion", () => {
  it("amplitudeToDb(1) = 0 dB", () => {
    expect(amplitudeToDb(1)).toBeCloseTo(0, 5);
  });
  it("amplitudeToDb(0.5) ≈ -6.02 dB", () => {
    expect(amplitudeToDb(0.5)).toBeCloseTo(-6.0206, 3);
  });
  it("amplitudeToDb(2) ≈ +6.02 dB", () => {
    expect(amplitudeToDb(2)).toBeCloseTo(6.0206, 3);
  });
  it("amplitudeToDb(0) = -Infinity", () => {
    expect(amplitudeToDb(0)).toBe(Number.NEGATIVE_INFINITY);
  });
  it("amplitudeToDb(negative) = -Infinity", () => {
    expect(amplitudeToDb(-1)).toBe(Number.NEGATIVE_INFINITY);
  });
  it("dbToAmplitude(0) = 1", () => {
    expect(dbToAmplitude(0)).toBeCloseTo(1, 5);
  });
  it("dbToAmplitude(-6) ≈ 0.5", () => {
    expect(dbToAmplitude(-6)).toBeCloseTo(0.501, 2);
  });
  it("dbToAmplitude(-Infinity) = 0", () => {
    expect(dbToAmplitude(Number.NEGATIVE_INFINITY)).toBe(0);
  });
});

describe("spectrum-analyzer computeMagnitude", () => {
  it("computeMagnitude(3, 4) = 5", () => {
    expect(computeMagnitude(3, 4)).toBe(5);
  });
  it("computeMagnitude(0, 0) = 0", () => {
    expect(computeMagnitude(0, 0)).toBe(0);
  });
  it("computeMagnitudeArray matches per-element", () => {
    const re = new Float32Array([3, 1, 0]);
    const im = new Float32Array([4, 0, 0]);
    const m = computeMagnitudeArray(re, im);
    expect(m[0]).toBeCloseTo(5, 5);
    expect(m[1]).toBeCloseTo(1, 5);
    expect(m[2]).toBeCloseTo(0, 5);
  });
  it("computeMagnitudeArray handles mismatched lengths", () => {
    const re = new Float32Array([1, 2, 3]);
    const im = new Float32Array([1, 2]);
    const m = computeMagnitudeArray(re, im);
    expect(m).toHaveLength(2);
  });
});

// ---- FFT ----

describe("spectrum-analyzer fft (radix-2)", () => {
  it("returns empty for empty input", () => {
    const { re, im } = fft(new Float32Array(0));
    expect(re).toHaveLength(0);
    expect(im).toHaveLength(0);
  });
  it("returns length N for length-N power-of-two input", () => {
    const { re, im } = fft(new Float32Array(256));
    expect(re).toHaveLength(256);
    expect(im).toHaveLength(256);
  });
  it("zero-pads non-power-of-two input to next power of two", () => {
    const { re } = fft(new Float32Array(100));
    expect(re.length).toBe(128);
  });
  it("DC signal: only bin 0 has nonzero magnitude", () => {
    const input = new Float32Array(64);
    input.fill(1);
    const { re, im } = fft(input);
    const mags = computeMagnitudeArray(re, im);
    expect(mags[0]).toBeGreaterThan(60);
    for (let i = 1; i < 64; i++) {
      expect(mags[i]).toBeLessThan(1e-6);
    }
  });
  it("440 Hz sine at 44100 Hz sample rate: peak near bin 10", () => {
    const N = 1024;
    const sr = 44100;
    const freq = 440;
    const input = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      input[i] = Math.sin(2 * Math.PI * freq * i / sr);
    }
    const { re, im } = fft(input);
    const mags = computeMagnitudeArray(re, im);
    // Find max bin
    let maxBin = 0;
    let maxMag = 0;
    for (let b = 0; b < N / 2; b++) {
      if (mags[b] > maxMag) {
        maxMag = mags[b];
        maxBin = b;
      }
    }
    const expectedBin = Math.round(freq * N / sr);
    // Allow ±1 bin tolerance
    expect(Math.abs(maxBin - expectedBin)).toBeLessThanOrEqual(1);
  });
  it("fft of real input is conjugate-symmetric", () => {
    const input = new Float32Array(64);
    for (let i = 0; i < 64; i++) input[i] = Math.sin(i * 0.3) + 0.5 * Math.cos(i * 0.7);
    const { re, im } = fft(input);
    // X[k] = conj(X[N-k])
    for (let k = 1; k < 32; k++) {
      expect(re[k]).toBeCloseTo(re[64 - k], 4);
      expect(im[k]).toBeCloseTo(-im[64 - k], 4);
    }
  });
});

describe("spectrum-analyzer analyzeSegment", () => {
  it("returns one-sided magnitudes of length N/2 + 1", () => {
    const samples = new Float32Array(1024);
    samples.fill(0);
    const mags = analyzeSegment(samples, "hanning", 1024);
    expect(mags.length).toBe(513);
  });
  it("falls back to 1024 for invalid fftSize", () => {
    const samples = new Float32Array(1024);
    const mags = analyzeSegment(samples, "rectangular", 999);
    expect(mags.length).toBe(513); // 1024/2 + 1
  });
  it("zero-pads short input", () => {
    const samples = new Float32Array(100);
    const mags = analyzeSegment(samples, "hanning", 1024);
    expect(mags.length).toBe(513);
  });
  it("detects peak near input frequency", () => {
    const N = 2048;
    const sr = 44100;
    const freq = 1000;
    const samples = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      samples[i] = Math.sin(2 * Math.PI * freq * i / sr);
    }
    const mags = analyzeSegment(samples, "hanning", N);
    let maxBin = 0;
    let maxMag = 0;
    for (let b = 1; b < mags.length; b++) {
      if (mags[b] > maxMag) {
        maxMag = mags[b];
        maxBin = b;
      }
    }
    const expectedBin = Math.round(freq * N / sr);
    expect(Math.abs(maxBin - expectedBin)).toBeLessThanOrEqual(2);
  });
});

// ---- Band energies ----

describe("spectrum-analyzer computeBandEnergies", () => {
  it("returns 7 bands", () => {
    const mags = new Float32Array(513);
    const bands = computeBandEnergies(mags, 44100, 1024);
    expect(bands).toHaveLength(7);
  });
  it("empty magnitudes give 0 energy and -Infinity dB", () => {
    const mags = new Float32Array(513);
    const bands = computeBandEnergies(mags, 44100, 1024);
    for (const b of bands) {
      expect(b.energy).toBe(0);
      expect(b.energyDb).toBe(Number.NEGATIVE_INFINITY);
    }
  });
  it("computes energy by summing magnitudes in band range", () => {
    const mags = new Float32Array(513);
    // Put energy in bin ~10 (about 430 Hz at 44100/1024) → in "mid" band? No, 430 Hz is low-mid (250-500).
    // Actually 430 Hz is in low-mid (250-500 Hz).
    mags[10] = 5;
    const bands = computeBandEnergies(mags, 44100, 1024);
    const lowMid = bands.find((b) => b.name === "low-mid")!;
    expect(lowMid.energy).toBe(5);
    expect(lowMid.peakMagnitude).toBe(5);
    expect(lowMid.peakFrequency).toBeCloseTo(44100 * 10 / 1024, 2);
    expect(lowMid.binCount).toBeGreaterThanOrEqual(1);
  });
  it("clamps band max Hz to Nyquist", () => {
    const mags = new Float32Array(513);
    const bands = computeBandEnergies(mags, 8000, 1024);
    // Nyquist = 4000 Hz, so brilliance band (6k-20k) caps at 4000
    const brilliance = bands.find((b) => b.name === "brilliance")!;
    expect(brilliance.maxHz).toBe(4000);
  });
  it("each band has correct label and range from FREQUENCY_BANDS", () => {
    const mags = new Float32Array(513);
    const bands = computeBandEnergies(mags, 44100, 1024);
    expect(bands[0].label).toBe("Sub-bass");
    expect(bands[0].minHz).toBe(20);
    expect(bands[0].maxHz).toBe(60);
  });
});

// ---- Peak finder ----

describe("spectrum-analyzer findPeaks", () => {
  it("finds local maxima", () => {
    const mags = new Float32Array(100);
    mags[10] = 5; // peak
    mags[50] = 8; // peak
    mags[80] = 3; // peak
    const peaks = findPeaks(mags, 44100, 256, 10);
    expect(peaks).toHaveLength(3);
    // Sorted by magnitude descending
    expect(peaks[0].bin).toBe(50);
    expect(peaks[1].bin).toBe(10);
    expect(peaks[2].bin).toBe(80);
  });
  it("limits to topN", () => {
    const mags = new Float32Array(100);
    for (let i = 5; i < 95; i += 5) mags[i] = i;
    const peaks = findPeaks(mags, 44100, 256, 3);
    expect(peaks).toHaveLength(3);
  });
  it("includes frequency in Hz and dB", () => {
    const mags = new Float32Array(100);
    mags[10] = 5;
    const peaks = findPeaks(mags, 44100, 256, 5);
    expect(peaks[0].frequency).toBeCloseTo(44100 * 10 / 256, 2);
    expect(peaks[0].magnitudeDb).toBeCloseTo(amplitudeToDb(5), 4);
  });
  it("returns empty for flat spectrum", () => {
    const mags = new Float32Array(100);
    mags.fill(5);
    const peaks = findPeaks(mags, 44100, 256, 5);
    expect(peaks).toHaveLength(0);
  });
  it("handles topN=0", () => {
    const mags = new Float32Array(100);
    mags[10] = 5;
    const peaks = findPeaks(mags, 44100, 256, 0);
    expect(peaks).toHaveLength(0);
  });
  it("skips bin 0 (DC)", () => {
    const mags = new Float32Array(100);
    mags[0] = 100;
    mags[1] = 0;
    const peaks = findPeaks(mags, 44100, 256, 5);
    expect(peaks).toHaveLength(0);
  });
});

// ---- Smoothing ----

describe("spectrum-analyzer applySmoothing", () => {
  it("returns current unchanged when smoothing=0", () => {
    const cur = new Float32Array([1, 2, 3]);
    const prev = new Float32Array([9, 9, 9]);
    const out = applySmoothing(cur, prev, 0);
    expect(Array.from(out)).toEqual([1, 2, 3]);
  });
  it("returns previous unchanged when smoothing=1", () => {
    const cur = new Float32Array([1, 2, 3]);
    const prev = new Float32Array([9, 9, 9]);
    const out = applySmoothing(cur, prev, 1);
    expect(Array.from(out)).toEqual([9, 9, 9]);
  });
  it("blends at smoothing=0.5", () => {
    const cur = new Float32Array([2, 4, 6]);
    const prev = new Float32Array([10, 20, 30]);
    const out = applySmoothing(cur, prev, 0.5);
    expect(out[0]).toBeCloseTo(6, 5);
    expect(out[1]).toBeCloseTo(12, 5);
    expect(out[2]).toBeCloseTo(18, 5);
  });
  it("handles null previous (no smoothing possible)", () => {
    const cur = new Float32Array([1, 2, 3]);
    const out = applySmoothing(cur, null, 0.7);
    expect(Array.from(out)).toEqual([1, 2, 3]);
  });
  it("clamps smoothing outside [0, 1]", () => {
    const cur = new Float32Array([1]);
    const prev = new Float32Array([10]);
    const outHigh = applySmoothing(cur, prev, 5);
    expect(outHigh[0]).toBe(10);
    const outLow = applySmoothing(cur, prev, -5);
    expect(outLow[0]).toBe(1);
  });
  it("handles mismatched lengths", () => {
    const cur = new Float32Array([1, 2, 3]);
    const prev = new Float32Array([10]);
    const out = applySmoothing(cur, prev, 0.5);
    // Index 0: 0.5*10 + 0.5*1 = 5.5
    expect(out[0]).toBeCloseTo(5.5, 4);
    // Index 1,2: no previous, just current
    expect(out[1]).toBe(2);
    expect(out[2]).toBe(3);
  });
});

// ---- Color palettes ----

describe("spectrum-analyzer getPaletteColor", () => {
  it("returns RGB tuples in [0, 255]", () => {
    for (const p of COLOR_PALETTES) {
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const [r, g, b] = getPaletteColor(p, t);
        expect(r).toBeGreaterThanOrEqual(0);
        expect(r).toBeLessThanOrEqual(255);
        expect(g).toBeGreaterThanOrEqual(0);
        expect(g).toBeLessThanOrEqual(255);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThanOrEqual(255);
      }
    }
  });
  it("clamps t outside [0, 1]", () => {
    const [r1] = getPaletteColor("heat", -1);
    const [r2] = getPaletteColor("heat", 0);
    expect(r1).toBe(r2);
    const [r3] = getPaletteColor("heat", 2);
    const [r4] = getPaletteColor("heat", 1);
    expect(r3).toBe(r4);
  });
  it("heat at t=0 is black", () => {
    const [r, g, b] = getPaletteColor("heat", 0);
    expect(r).toBe(0);
    expect(g).toBe(0);
    expect(b).toBe(0);
  });
  it("heat at t=1 is white", () => {
    const [r, g, b] = getPaletteColor("heat", 1);
    expect(r).toBe(255);
    expect(g).toBe(255);
    expect(b).toBe(255);
  });
  it("rectangular... mono at t=1 is bright green-ish", () => {
    const [r, g, b] = getPaletteColor("mono", 1);
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
  });
  it("cool palette has blue > red at all t", () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const [r, g, b] = getPaletteColor("cool", t);
      expect(b).toBeGreaterThan(r);
    }
  });
});

// ---- Summary stats ----

describe("spectrum-analyzer computeSpectrumStats", () => {
  it("computes peak and total energy", () => {
    const mags = new Float32Array(513);
    mags[10] = 5;
    mags[20] = 3;
    mags[30] = 1;
    const bands = computeBandEnergies(mags, 44100, 1024);
    const stats = computeSpectrumStats(mags, bands, 44100, 1024);
    expect(stats.peakFrequencyHz).toBeCloseTo(binToFrequency(10, 44100, 1024), 3);
    expect(stats.totalEnergy).toBeCloseTo(9, 5);
    expect(stats.binCount).toBe(513);
  });
  it("handles empty spectrum", () => {
    const mags = new Float32Array(513);
    const bands = computeBandEnergies(mags, 44100, 1024);
    const stats = computeSpectrumStats(mags, bands, 44100, 1024);
    expect(stats.peakMagnitudeDb).toBe(Number.NEGATIVE_INFINITY);
    expect(stats.totalEnergyDb).toBe(Number.NEGATIVE_INFINITY);
    expect(stats.spectralCentroidHz).toBe(0);
  });
  it("computes spectral centroid", () => {
    const mags = new Float32Array(513);
    mags[10] = 5; // freq ≈ 430.66 Hz
    mags[20] = 5; // freq ≈ 861.33 Hz
    const bands = computeBandEnergies(mags, 44100, 1024);
    const stats = computeSpectrumStats(mags, bands, 44100, 1024);
    // centroid = (10*5 + 20*5) / 10 = 15 bins → freq ≈ 646 Hz
    expect(stats.spectralCentroidHz).toBeCloseTo(binToFrequency(15, 44100, 1024), 1);
  });
});

// ---- Formatters ----

describe("spectrum-analyzer formatHz & formatDb", () => {
  it("formatHz formats Hz below 1000", () => {
    expect(formatHz(440)).toBe("440.0 Hz");
  });
  it("formatHz formats kHz above 1000", () => {
    expect(formatHz(12000)).toBe("12.00 kHz");
  });
  it("formatHz formats -Infinity", () => {
    expect(formatHz(Number.NEGATIVE_INFINITY)).toBe("-∞ Hz");
  });
  it("formatDb formats finite", () => {
    expect(formatDb(-6.0206)).toBe("-6.02 dB");
  });
  it("formatDb formats -Infinity", () => {
    expect(formatDb(Number.NEGATIVE_INFINITY)).toBe("-∞ dB");
  });
});

// ---- Renderers ----

describe("spectrum-analyzer renderText", () => {
  const result = {
    fileName: "test.wav",
    durationSeconds: 10,
    sampleRate: 44100,
    channels: 2,
    fftSize: 1024,
    windowFunction: "hanning" as const,
    bands: [
      { name: "sub-bass" as const, label: "Sub-bass", minHz: 20, maxHz: 60, energy: 0, energyDb: Number.NEGATIVE_INFINITY, peakFrequency: 0, peakMagnitude: 0, binCount: 0 },
    ],
    peaks: [
      { bin: 10, frequency: 430.66, magnitude: 5, magnitudeDb: 13.98 },
    ],
    stats: {
      peakFrequencyHz: 430.66,
      peakMagnitudeDb: 13.98,
      totalEnergy: 5,
      totalEnergyDb: 13.98,
      spectralCentroidHz: 430.66,
      bandCount: 7,
      binCount: 513,
    },
  };

  it("renders header", () => {
    const text = renderText(result);
    expect(text).toContain("Audio Spectrum Analysis Report");
    expect(text).toContain("test.wav");
    expect(text).toContain("Sample rate: 44100 Hz");
    expect(text).toContain("FFT size: 1024");
    expect(text).toContain("hanning");
  });
  it("renders summary", () => {
    const text = renderText(result);
    expect(text).toContain("Spectral centroid");
    expect(text).toContain("Peak frequency");
  });
  it("renders bands section", () => {
    const text = renderText(result);
    expect(text).toContain("Frequency Bands");
    expect(text).toContain("Sub-bass");
  });
  it("renders peaks section", () => {
    const text = renderText(result);
    expect(text).toContain("Top Peak Frequencies");
    expect(text).toContain("430.7 Hz");
  });
  it("renders no-peaks message when empty", () => {
    const text = renderText({ ...result, peaks: [] });
    expect(text).toContain("no peaks found");
  });
});

describe("spectrum-analyzer renderCsv", () => {
  const result = {
    fileName: "test.wav",
    durationSeconds: 10,
    sampleRate: 44100,
    channels: 2,
    fftSize: 1024,
    windowFunction: "hanning" as const,
    bands: [
      { name: "sub-bass" as const, label: "Sub-bass", minHz: 20, maxHz: 60, energy: 5, energyDb: 13.98, peakFrequency: 50, peakMagnitude: 5, binCount: 1 },
    ],
    peaks: [],
    stats: {
      peakFrequencyHz: 50,
      peakMagnitudeDb: 13.98,
      totalEnergy: 5,
      totalEnergyDb: 13.98,
      spectralCentroidHz: 50,
      bandCount: 7,
      binCount: 513,
    },
  };

  it("renders header row", () => {
    const csv = renderCsv(result);
    expect(csv).toContain("band,range_hz,energy_db,peak_frequency_hz,peak_magnitude_db,bin_count");
  });
  it("renders band rows", () => {
    const csv = renderCsv(result);
    expect(csv).toContain("Sub-bass,20-60");
    expect(csv).toContain("13.9800");
    expect(csv).toContain("50.00");
  });
  it("renders -Infinity for empty band", () => {
    const r2 = {
      ...result,
      bands: [
        { name: "sub-bass" as const, label: "Sub-bass", minHz: 20, maxHz: 60, energy: 0, energyDb: Number.NEGATIVE_INFINITY, peakFrequency: 0, peakMagnitude: 0, binCount: 0 },
      ],
    };
    const csv = renderCsv(r2);
    expect(csv).toContain("-Infinity");
  });
});

describe("spectrum-analyzer renderPeaksCsv", () => {
  const result = {
    fileName: "test.wav",
    durationSeconds: 10,
    sampleRate: 44100,
    channels: 2,
    fftSize: 1024,
    windowFunction: "hanning" as const,
    bands: [],
    peaks: [
      { bin: 10, frequency: 430.66, magnitude: 5, magnitudeDb: 13.98 },
      { bin: 20, frequency: 861.33, magnitude: 3, magnitudeDb: 9.54 },
    ],
    stats: {
      peakFrequencyHz: 430.66,
      peakMagnitudeDb: 13.98,
      totalEnergy: 5,
      totalEnergyDb: 13.98,
      spectralCentroidHz: 430.66,
      bandCount: 7,
      binCount: 513,
    },
  };

  it("renders header", () => {
    const csv = renderPeaksCsv(result);
    expect(csv).toContain("rank,frequency_hz,magnitude,magnitude_db,bin");
  });
  it("renders peak rows", () => {
    const csv = renderPeaksCsv(result);
    expect(csv).toContain("1,430.66");
    expect(csv).toContain("2,861.33");
  });
  it("returns only header for empty peaks", () => {
    const csv = renderPeaksCsv({ ...result, peaks: [] });
    expect(csv.split("\n")).toHaveLength(1);
  });
});

// ---- History ----

describe("spectrum-analyzer history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    const entry: HistoryEntry = {
      ts: 1,
      fileName: "test.wav",
      durationSeconds: 10,
      sampleRate: 44100,
      channels: 2,
      fftSize: 1024,
      windowFunction: "hanning",
      peakFrequencyHz: 440,
      spectralCentroidHz: 500,
      bandCount: 7,
    };
    saveHistory(entry);
    const history = loadHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toEqual(entry);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, fileName: `f-${i}.wav`, durationSeconds: 1, sampleRate: 44100,
        channels: 1, fftSize: 1024, windowFunction: "hanning",
        peakFrequencyHz: 440, spectralCentroidHz: 440, bandCount: 7,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears history", () => {
    saveHistory({
      ts: 1, fileName: "x", durationSeconds: 1, sampleRate: 44100,
      channels: 1, fftSize: 1024, windowFunction: "hanning",
      peakFrequencyHz: 440, spectralCentroidHz: 440, bandCount: 7,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it("orders most-recent first", () => {
    saveHistory({
      ts: 1, fileName: "a", durationSeconds: 1, sampleRate: 44100,
      channels: 1, fftSize: 1024, windowFunction: "hanning",
      peakFrequencyHz: 440, spectralCentroidHz: 440, bandCount: 7,
    });
    saveHistory({
      ts: 2, fileName: "b", durationSeconds: 1, sampleRate: 44100,
      channels: 1, fftSize: 1024, windowFunction: "hanning",
      peakFrequencyHz: 440, spectralCentroidHz: 440, bandCount: 7,
    });
    const history = loadHistory();
    expect(history[0].ts).toBe(2);
    expect(history[1].ts).toBe(1);
  });
});

// ---- Shareable URL ----

describe("spectrum-analyzer shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      fftSize: "1024",
      windowFunction: "hanning",
      palette: "rainbow",
      topPeaks: 5,
      smoothing: 0.7,
    });
    expect(url).toContain("fft=1024");
    expect(url).toContain("win=hanning");
    expect(url).toContain("pal=rainbow");
    expect(url).toContain("peaks=5");
    expect(url).toContain("smooth=0.70");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("fft=2048&win=blackman&pal=heat&peaks=10&smooth=0.85");
    expect(p.fftSize).toBe("2048");
    expect(p.windowFunction).toBe("blackman");
    expect(p.palette).toBe("heat");
    expect(p.topPeaks).toBe(10);
    expect(p.smoothing).toBeCloseTo(0.85, 5);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("strips leading # from hash", () => {
    const p = parseShareUrl("#fft=512&win=hamming");
    expect(p.fftSize).toBe("512");
    expect(p.windowFunction).toBe("hamming");
  });
  it("filters unknown fft size preset", () => {
    const p = parseShareUrl("fft=9999&win=hanning");
    expect(p.fftSize).toBeUndefined();
  });
  it("filters unknown window function", () => {
    const p = parseShareUrl("fft=1024&win=bogus");
    expect(p.windowFunction).toBeUndefined();
  });
  it("filters unknown palette", () => {
    const p = parseShareUrl("fft=1024&pal=neon");
    expect(p.palette).toBeUndefined();
  });
  it("filters out-of-range topPeaks", () => {
    const p = parseShareUrl("fft=1024&peaks=999");
    expect(p.topPeaks).toBeUndefined();
  });
  it("filters out-of-range smoothing", () => {
    const p1 = parseShareUrl("fft=1024&smooth=2");
    expect(p1.smoothing).toBeUndefined();
    const p2 = parseShareUrl("fft=1024&smooth=-1");
    expect(p2.smoothing).toBeUndefined();
  });
});

// Suppress unused-import lint
export type _Unused = FftSizePreset | WindowFunction | ColorPalette;
