import { describe, it, expect, beforeEach } from "vitest";
import {
  STRENGTH_PRESETS,
  STRENGTH_VALUES,
  STRENGTH_LABELS,
  DEFAULT_STRENGTH,
  strengthToAlpha,
  validateStrength,
  GATE_PRESETS,
  GATE_VALUES,
  GATE_LABELS,
  DEFAULT_GATE,
  FFT_SIZE_PRESETS,
  FFT_SIZE_TO_NUMBER,
  DEFAULT_FFT_SIZE,
  isPowerOfTwo,
  dbfsToLinear,
  linearToDbfs,
  generateHanning,
  applyWindow,
  fft,
  ifft,
  computeMagnitude,
  computePhase,
  computeMagnitudeArray,
  computePhaseArray,
  magnitudePhaseToComplex,
  reconstructSamples,
  estimateNoiseFloor,
  estimateNoiseFloorMulti,
  spectralSubtract,
  applyNoiseGate,
  stft,
  overlapAdd,
  estimateWavSizeBytes,
  formatBytes,
  formatDuration,
  buildWavHeader,
  floatSamplesTo16BitPCM,
  interleaveChannels,
  encodeWav,
  computeRms,
  detectPeak,
  hasClipping,
  computeSummaryStats,
  renderReport,
  renderCsv,
  generateFilename,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type StrengthPreset,
  type GatePreset,
  type FftSizePreset,
  type HistoryEntry,
  type NoiseReducerReport,
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

describe("audio-noise-reducer strength presets", () => {
  it("has 4 strength presets", () => {
    expect(STRENGTH_PRESETS).toHaveLength(4);
    expect(STRENGTH_PRESETS).toContain("light");
    expect(STRENGTH_PRESETS).toContain("medium");
    expect(STRENGTH_PRESETS).toContain("strong");
    expect(STRENGTH_PRESETS).toContain("aggressive");
  });
  it("strength values are 25/50/75/100", () => {
    expect(STRENGTH_VALUES.light).toBe(25);
    expect(STRENGTH_VALUES.medium).toBe(50);
    expect(STRENGTH_VALUES.strong).toBe(75);
    expect(STRENGTH_VALUES.aggressive).toBe(100);
  });
  it("has 4 labels", () => {
    expect(Object.keys(STRENGTH_LABELS)).toHaveLength(4);
    expect(STRENGTH_LABELS.medium).toContain("default");
  });
  it("default strength is medium", () => {
    expect(DEFAULT_STRENGTH).toBe("medium");
  });
  it("strengthToAlpha maps 0 → 1 and 100 → 4", () => {
    expect(strengthToAlpha(0)).toBe(1);
    expect(strengthToAlpha(100)).toBe(4);
    expect(strengthToAlpha(50)).toBe(2.5);
  });
  it("strengthToAlpha clamps out-of-range", () => {
    expect(strengthToAlpha(-50)).toBe(1);
    expect(strengthToAlpha(200)).toBe(4);
  });
  it("validateStrength accepts 0..100", () => {
    expect(validateStrength(0).ok).toBe(true);
    expect(validateStrength(100).ok).toBe(true);
    expect(validateStrength(50).ok).toBe(true);
  });
  it("validateStrength rejects out-of-range and NaN", () => {
    expect(validateStrength(-1).ok).toBe(false);
    expect(validateStrength(101).ok).toBe(false);
    expect(validateStrength(Number.NaN).ok).toBe(false);
  });
});

describe("audio-noise-reducer gate presets", () => {
  it("has 4 gate presets", () => {
    expect(GATE_PRESETS).toHaveLength(4);
    expect(GATE_PRESETS).toContain("-30");
    expect(GATE_PRESETS).toContain("-60");
  });
  it("gate values match labels", () => {
    expect(GATE_VALUES["-30"]).toBe(-30);
    expect(GATE_VALUES["-40"]).toBe(-40);
    expect(GATE_VALUES["-50"]).toBe(-50);
    expect(GATE_VALUES["-60"]).toBe(-60);
  });
  it("has 4 labels", () => {
    expect(Object.keys(GATE_LABELS)).toHaveLength(4);
    expect(GATE_LABELS["-40"]).toContain("default");
  });
  it("default gate is -40", () => {
    expect(DEFAULT_GATE).toBe("-40");
  });
});

describe("audio-noise-reducer FFT size presets", () => {
  it("has 5 FFT sizes", () => {
    expect(FFT_SIZE_PRESETS).toHaveLength(5);
  });
  it("maps presets to numbers correctly", () => {
    expect(FFT_SIZE_TO_NUMBER["256"]).toBe(256);
    expect(FFT_SIZE_TO_NUMBER["1024"]).toBe(1024);
    expect(FFT_SIZE_TO_NUMBER["4096"]).toBe(4096);
  });
  it("default FFT size is 1024", () => {
    expect(DEFAULT_FFT_SIZE).toBe("1024");
  });
  it("isPowerOfTwo correctly identifies powers of 2", () => {
    expect(isPowerOfTwo(1)).toBe(true);
    expect(isPowerOfTwo(256)).toBe(true);
    expect(isPowerOfTwo(1024)).toBe(true);
    expect(isPowerOfTwo(0)).toBe(false);
    expect(isPowerOfTwo(3)).toBe(false);
    expect(isPowerOfTwo(1000)).toBe(false);
    expect(isPowerOfTwo(-4)).toBe(false);
  });
});

describe("audio-noise-reducer dBFS converters", () => {
  it("converts 0 dBFS to 1.0 linear", () => {
    expect(dbfsToLinear(0)).toBeCloseTo(1, 6);
  });
  it("converts -6 dBFS to ~0.501", () => {
    expect(dbfsToLinear(-6)).toBeCloseTo(0.5012, 3);
  });
  it("converts linear 1.0 back to 0 dBFS", () => {
    expect(linearToDbfs(1)).toBeCloseTo(0, 6);
  });
  it("linearToDbfs returns -Infinity for 0", () => {
    expect(linearToDbfs(0)).toBe(Number.NEGATIVE_INFINITY);
  });
  it("dbfsToLinear returns 0 for -Infinity", () => {
    expect(dbfsToLinear(Number.NEGATIVE_INFINITY)).toBe(0);
  });
});

describe("audio-noise-reducer Hanning window", () => {
  it("generates window of requested size", () => {
    const w = generateHanning(8);
    expect(w).toHaveLength(8);
  });
  it("first sample is 0 and middle sample peaks near 1", () => {
    const w = generateHanning(8);
    // Hanning formula: w[n] = 0.5 - 0.5*cos(2π*n/(N-1)), so w[0]=0.
    expect(w[0]).toBeCloseTo(0, 6);
    // The peak is at n=(N-1)/2 which is fractional for even N; the two middle
    // samples are equal and close to 1.
    expect(w[3]).toBeCloseTo(w[4], 6);
    expect(w[3]).toBeGreaterThan(0.9);
    expect(w[4]).toBeGreaterThan(0.9);
  });
  it("is symmetric: w[i] ≈ w[N-1-i]", () => {
    const w = generateHanning(16);
    for (let i = 0; i < 8; i++) {
      expect(w[i]).toBeCloseTo(w[15 - i], 6);
    }
  });
  it("handles size 1", () => {
    const w = generateHanning(1);
    expect(w[0]).toBe(1);
  });
  it("returns empty for size 0", () => {
    const w = generateHanning(0);
    expect(w).toHaveLength(0);
  });
  it("applyWindow element-wise multiplies", () => {
    const s = new Float32Array([1, 2, 3, 4]);
    const w = new Float32Array([0.5, 0.5, 0.5, 0.5]);
    const out = applyWindow(s, w);
    expect(Array.from(out)).toEqual([0.5, 1, 1.5, 2]);
  });
  it("applyWindow zero-pads if window shorter than signal", () => {
    const s = new Float32Array([1, 2, 3, 4]);
    const w = new Float32Array([0.5, 0.5]);
    const out = applyWindow(s, w);
    expect(Array.from(out)).toEqual([0.5, 1, 0, 0]);
  });
});

describe("audio-noise-reducer FFT/IFFT round-trip", () => {
  it("FFT of a 4-sample impulse returns the impulse (magnitude check)", () => {
    const s = new Float32Array([1, 0, 0, 0]);
    const { re, im } = fft(s);
    expect(re).toHaveLength(4);
    expect(im).toHaveLength(4);
    // FFT of impulse = [1, 1, 1, 1] (all real, magnitude 1)
    for (let i = 0; i < 4; i++) {
      expect(re[i]).toBeCloseTo(1, 5);
      expect(im[i]).toBeCloseTo(0, 5);
    }
  });
  it("FFT of a pure sine has a peak at the corresponding bin", () => {
    const N = 64;
    const sine = new Float32Array(N);
    const k = 4; // 4 cycles over N samples → bin 4
    for (let n = 0; n < N; n++) {
      sine[n] = Math.sin((2 * Math.PI * k * n) / N);
    }
    const { re, im } = fft(sine);
    const mags = computeMagnitudeArray(re, im);
    let peakBin = 0;
    let peakVal = 0;
    for (let i = 0; i < mags.length; i++) {
      if (mags[i] > peakVal) { peakVal = mags[i]; peakBin = i; }
    }
    expect(peakBin).toBe(k);
  });
  it("IFFT of FFT returns the original signal", () => {
    const N = 16;
    const orig = new Float32Array(N);
    for (let n = 0; n < N; n++) {
      orig[n] = Math.sin((2 * Math.PI * 3 * n) / N) * 0.5 + 0.1;
    }
    const { re, im } = fft(orig);
    const back = ifft(re, im);
    for (let n = 0; n < N; n++) {
      expect(back[n]).toBeCloseTo(orig[n], 4);
    }
  });
  it("FFT zero-pads to next power of two", () => {
    const s = new Float32Array([1, 2, 3]); // length 3 → N=4
    const { re, im } = fft(s);
    expect(re).toHaveLength(4);
    expect(im).toHaveLength(4);
    // FFT of [1, 2, 3, 0]: DC bin = sum = 6.
    expect(re[0]).toBeCloseTo(6, 5);
    expect(im[0]).toBeCloseTo(0, 5);
  });
});

describe("audio-noise-reducer magnitude & phase", () => {
  it("computeMagnitude returns sqrt(re²+im²)", () => {
    expect(computeMagnitude(3, 4)).toBe(5);
    expect(computeMagnitude(0, 0)).toBe(0);
  });
  it("computePhase returns atan2(im, re)", () => {
    expect(computePhase(1, 0)).toBeCloseTo(0, 5);
    expect(computePhase(0, 1)).toBeCloseTo(Math.PI / 2, 5);
    expect(computePhase(-1, 0)).toBeCloseTo(Math.PI, 5);
  });
  it("computeMagnitudeArray works element-wise", () => {
    const re = new Float32Array([3, 0]);
    const im = new Float32Array([4, 0]);
    const m = computeMagnitudeArray(re, im);
    expect(m[0]).toBe(5);
    expect(m[1]).toBe(0);
  });
  it("computePhaseArray works element-wise", () => {
    const re = new Float32Array([1, 0]);
    const im = new Float32Array([0, 1]);
    const p = computePhaseArray(re, im);
    expect(p[0]).toBeCloseTo(0, 5);
    expect(p[1]).toBeCloseTo(Math.PI / 2, 5);
  });
  it("magnitudePhaseToComplex inverts magnitude/phase", () => {
    const mag = new Float32Array([5, 0]);
    const phase = new Float32Array([Math.atan2(4, 3), 0]); // angle of (3,4)
    const { re, im } = magnitudePhaseToComplex(mag, phase);
    expect(re[0]).toBeCloseTo(3, 5);
    expect(im[0]).toBeCloseTo(4, 5);
  });
  it("reconstructSamples via IFFT returns original signal", () => {
    const N = 8;
    const orig = new Float32Array(N);
    for (let n = 0; n < N; n++) orig[n] = Math.cos((2 * Math.PI * 2 * n) / N);
    const { re, im } = fft(orig);
    const mags = computeMagnitudeArray(re, im);
    const phases = computePhaseArray(re, im);
    const back = reconstructSamples(mags, phases);
    for (let n = 0; n < N; n++) {
      expect(back[n]).toBeCloseTo(orig[n], 4);
    }
  });
});

describe("audio-noise-reducer noise floor estimation", () => {
  it("estimateNoiseFloor returns magnitude spectrum of length N", () => {
    const noise = new Float32Array(1024).map(() => Math.random() * 0.1 - 0.05);
    const floor = estimateNoiseFloor(noise, 1024);
    expect(floor).toHaveLength(1024);
    // All magnitudes should be non-negative
    for (let i = 0; i < floor.length; i++) {
      expect(floor[i]).toBeGreaterThanOrEqual(0);
    }
  });
  it("estimateNoiseFloor of zero samples returns all-zero magnitudes", () => {
    const noise = new Float32Array(1024);
    const floor = estimateNoiseFloor(noise, 1024);
    for (let i = 0; i < floor.length; i++) {
      expect(floor[i]).toBeCloseTo(0, 6);
    }
  });
  it("estimateNoiseFloorMulti averages multiple windows", () => {
    const w1 = new Float32Array(1024).fill(0);
    const w2 = new Float32Array(1024).fill(0);
    const avg = estimateNoiseFloorMulti([w1, w2], 1024);
    expect(avg).toHaveLength(1024);
    for (let i = 0; i < avg.length; i++) {
      expect(avg[i]).toBeCloseTo(0, 6);
    }
  });
  it("estimateNoiseFloorMulti returns empty for no windows", () => {
    const avg = estimateNoiseFloorMulti([], 1024);
    expect(avg).toHaveLength(0);
  });
});

describe("audio-noise-reducer spectral subtraction", () => {
  it("subtracts noise floor and clamps to 0", () => {
    const signal = new Float32Array([10, 5, 2, 0.5]);
    const noise = new Float32Array([3, 3, 3, 3]);
    const out = spectralSubtract(signal, noise, 1);
    expect(Array.from(out)).toEqual([7, 2, 0, 0]);
  });
  it("applies over-subtraction factor alpha", () => {
    const signal = new Float32Array([10, 5, 2, 0.5]);
    const noise = new Float32Array([3, 3, 3, 3]);
    // alpha = 2 → subtract 6
    const out = spectralSubtract(signal, noise, 2);
    expect(Array.from(out)).toEqual([4, 0, 0, 0]);
  });
  it("handles different lengths", () => {
    const signal = new Float32Array([10, 5, 2, 0.5, 1]);
    const noise = new Float32Array([3, 3]);
    const out = spectralSubtract(signal, noise, 1);
    // Beyond noise length, signal is kept
    expect(out[2]).toBe(2);
    expect(out[4]).toBe(1);
  });
  it("treats negative alpha as 0", () => {
    const signal = new Float32Array([10, 5]);
    const noise = new Float32Array([3, 3]);
    const out = spectralSubtract(signal, noise, -1);
    expect(Array.from(out)).toEqual([10, 5]);
  });
});

describe("audio-noise-reducer noise gate", () => {
  it("silences samples below threshold", () => {
    // threshold = -40 dBFS ≈ 0.01 linear
    const samples = new Float32Array([0.005, 0.5, -0.003, -0.8]);
    const out = applyNoiseGate(samples, -40);
    expect(out[0]).toBe(0);
    expect(out[1]).toBeCloseTo(0.5, 6);
    expect(out[2]).toBe(0);
    expect(out[3]).toBeCloseTo(-0.8, 5);
  });
  it("returns a new array (does not mutate input)", () => {
    const samples = new Float32Array([0.005, 0.5]);
    const out = applyNoiseGate(samples, -40);
    expect(out).not.toBe(samples);
    expect(samples[0]).toBeCloseTo(0.005, 5); // unchanged
  });
  it("handles high threshold (silences everything quiet)", () => {
    const samples = new Float32Array([0.1, 0.2, 0.3]);
    // -10 dBFS ≈ 0.316 linear — so 0.1, 0.2, 0.3 all below
    const out = applyNoiseGate(samples, -10);
    expect(out[0]).toBe(0);
    expect(out[1]).toBe(0);
    expect(out[2]).toBe(0);
  });
});

describe("audio-noise-reducer STFT + overlap-add", () => {
  it("STFT produces magnitudes & phases per window", () => {
    const samples = new Float32Array(2048);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin((2 * Math.PI * 4 * i) / 1024) * 0.5;
    }
    const stftResult = stft(samples, 1024, 512);
    expect(stftResult.magnitudes.length).toBeGreaterThan(0);
    expect(stftResult.phases.length).toBe(stftResult.magnitudes.length);
    expect(stftResult.fftSize).toBe(1024);
    expect(stftResult.hopSize).toBe(512);
  });
  it("overlapAdd reconstructs original signal with no spectral subtraction (50% hop)", () => {
    const N = 4096;
    const samples = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      samples[i] = Math.sin((2 * Math.PI * 8 * i) / 1024) * 0.3;
    }
    const fftSize = 1024;
    const hop = fftSize / 2; // 50% hop → perfect reconstruction for Hanning
    const stftResult = stft(samples, fftSize, hop);
    const back = overlapAdd(stftResult.magnitudes, stftResult.phases, fftSize, hop, N);
    expect(back).toHaveLength(N);
    // With Hanning + 50% overlap, reconstruction should match within tolerance.
    // Skip first and last window edges (boundary effects).
    for (let i = fftSize; i < N - fftSize; i++) {
      expect(back[i]).toBeCloseTo(samples[i], 1);
    }
  });
});

describe("audio-noise-reducer WAV encoder", () => {
  it("buildWavHeader returns 44 bytes with RIFF marker", () => {
    const h = buildWavHeader(1000, 44100, 2);
    expect(h).toHaveLength(44);
    expect(String.fromCharCode(...h.slice(0, 4))).toBe("RIFF");
    expect(String.fromCharCode(...h.slice(8, 12))).toBe("WAVE");
  });
  it("floatSamplesTo16BitPCM encodes 0.0 as 0", () => {
    const pcm = floatSamplesTo16BitPCM(new Float32Array([0]));
    const view = new DataView(pcm.buffer);
    expect(view.getInt16(0, true)).toBe(0);
  });
  it("floatSamplesTo16BitPCM encodes 1.0 as 32767 and clamps above", () => {
    const pcm = floatSamplesTo16BitPCM(new Float32Array([1, 2]));
    const view = new DataView(pcm.buffer);
    expect(view.getInt16(0, true)).toBe(32767);
    expect(view.getInt16(2, true)).toBe(32767);
  });
  it("interleaveChannels interleaves 2 channels", () => {
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array([4, 5, 6]);
    expect(Array.from(interleaveChannels([a, b]))).toEqual([1, 4, 2, 5, 3, 6]);
  });
  it("encodeWav produces a valid WAV blob", () => {
    const samples = new Float32Array(100);
    samples.fill(0.5);
    const wav = encodeWav([samples], 44100);
    // header (44) + 100 samples × 2 bytes
    expect(wav.length).toBe(44 + 200);
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe("RIFF");
  });
  it("encodeWav handles empty channel array", () => {
    const wav = encodeWav([], 44100);
    expect(wav.length).toBe(44);
  });
});

describe("audio-noise-reducer size/duration formatting", () => {
  it("estimateWavSizeBytes = 44 + samples × channels × 2", () => {
    expect(estimateWavSizeBytes(1000, 2)).toBe(44 + 4000);
  });
  it("formatBytes formats 0, KB, MB", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(2048)).toBe("2.00 KB");
    expect(formatBytes(1_500_000)).toBe("1.43 MB");
  });
  it("formatDuration formats M:SS", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(75)).toBe("1:15");
    expect(formatDuration(-5)).toBe("0:00");
  });
});

describe("audio-noise-reducer RMS / peak / clipping", () => {
  it("computeRms returns sqrt(mean(square))", () => {
    const s = new Float32Array([0.3, -0.4, 0.3, -0.4]);
    // mean = (0.09 + 0.16 + 0.09 + 0.16) / 4 = 0.125, sqrt = 0.3536
    expect(computeRms(s)).toBeCloseTo(0.3536, 3);
  });
  it("computeRms returns 0 for empty", () => {
    expect(computeRms(new Float32Array(0))).toBe(0);
  });
  it("detectPeak returns max abs", () => {
    const s = new Float32Array([0.1, -0.7, 0.3]);
    expect(detectPeak(s)).toBeCloseTo(0.7, 5);
  });
  it("hasClipping detects samples outside [-1, 1]", () => {
    expect(hasClipping(new Float32Array([0.5, 0.9, 0.99]))).toBe(false);
    expect(hasClipping(new Float32Array([0.5, 1.1, -0.2]))).toBe(true);
    expect(hasClipping(new Float32Array([-1.5, 0.5]))).toBe(true);
  });
});

describe("audio-noise-reducer summary stats", () => {
  it("computes input/noise/output RMS, % noise reduced", () => {
    const input = new Float32Array(1000).map((_, i) => Math.sin(i * 0.1) * 0.5 + (Math.random() - 0.5) * 0.1);
    const noise = new Float32Array(100).map(() => (Math.random() - 0.5) * 0.1);
    const output = new Float32Array(1000).map((_, i) => Math.sin(i * 0.1) * 0.4); // quieter
    const stats = computeSummaryStats(input, noise, output, 10, 5000);
    expect(stats.inputRmsDbfs).toBeLessThan(0);
    expect(stats.noiseRmsDbfs).toBeLessThan(stats.inputRmsDbfs);
    expect(stats.outputRmsDbfs).toBeLessThanOrEqual(stats.inputRmsDbfs);
    expect(stats.noiseReducedPct).toBeGreaterThanOrEqual(0);
    expect(stats.windowCount).toBe(10);
    expect(stats.outputSizeBytes).toBe(5000);
    expect(stats.totalSamples).toBe(1000);
  });
  it("clippingPrevented is true when output exceeds [-1, 1]", () => {
    const input = new Float32Array([0.5]);
    const noise = new Float32Array([0.1]);
    const output = new Float32Array([1.5]); // clips
    const stats = computeSummaryStats(input, noise, output, 1, 100);
    expect(stats.clippingPrevented).toBe(true);
  });
});

describe("audio-noise-reducer renderers", () => {
  const makeReport = (): NoiseReducerReport => ({
    fileName: "voice.mp3",
    durationSeconds: 10,
    sampleRate: 44100,
    channels: 1,
    strength: 50,
    alpha: 2.5,
    gateThresholdDbfs: -40,
    fftSize: 1024,
    noiseEstimateSamples: 4410,
    windowCount: 200,
    hopSize: 512,
    stats: {
      inputRmsDbfs: -20,
      noiseRmsDbfs: -45,
      outputRmsDbfs: -22,
      inputPeakDbfs: -3,
      outputPeakDbfs: -3,
      noiseReducedPct: 20,
      clippingPrevented: false,
      totalSamples: 441000,
      windowCount: 200,
      outputSizeBytes: 882044,
    },
  });

  it("renderReport produces multi-line text report", () => {
    const txt = renderReport(makeReport());
    expect(txt).toContain("Audio Noise Reduction Report");
    expect(txt).toContain("voice.mp3");
    expect(txt).toContain("Strength: 50/100");
    expect(txt).toContain("Noise reduced: 20.0%");
    expect(txt).toContain("Noise gate: -40.00 dBFS");
  });
  it("renderReport flags clipping when present", () => {
    const r = makeReport();
    r.stats.clippingPrevented = true;
    const txt = renderReport(r);
    expect(txt).toContain("Clipping");
  });
  it("renderCsv produces CSV with component,value header", () => {
    const csv = renderCsv(makeReport());
    const lines = csv.split("\n");
    expect(lines[0]).toBe("component,value");
    expect(lines.length).toBeGreaterThan(10);
    // Should contain input_rms_dbfs and output_rms_dbfs rows
    expect(csv).toContain("input_rms_dbfs");
    expect(csv).toContain("output_rms_dbfs");
    expect(csv).toContain("noise_reduced_pct");
  });
  it("renderCsv escapes values with commas", () => {
    const r = makeReport();
    r.fileName = "my,audio.mp3";
    const csv = renderCsv(r);
    expect(csv).toContain('"my,audio.mp3"');
  });
});

describe("audio-noise-reducer filename generator", () => {
  it("generates denoised-YYYY-MM-DD-HHmmss.wav", () => {
    const date = new Date(2024, 0, 5, 14, 23, 7);
    expect(generateFilename(date)).toBe("denoised-2024-01-05-142307.wav");
  });
  it("pads single-digit fields", () => {
    const date = new Date(2024, 0, 1, 1, 2, 3);
    expect(generateFilename(date)).toBe("denoised-2024-01-01-010203.wav");
  });
});

describe("audio-noise-reducer history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    const entry: HistoryEntry = {
      ts: 1,
      originalName: "voice.mp3",
      durationSeconds: 10,
      strength: 50,
      gateThresholdDbfs: -40,
      fftSize: 1024,
      noiseReducedPct: 20,
      inputRmsDbfs: -20,
      outputRmsDbfs: -22,
      outputSizeBytes: 882044,
      clippingPrevented: false,
      filename: "denoised-x.wav",
    };
    saveHistory(entry);
    const h = loadHistory();
    expect(h).toHaveLength(1);
    expect(h[0]).toEqual(entry);
  });
  it("caps at 20 entries", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        originalName: `f-${i}.mp3`,
        durationSeconds: 1,
        strength: 50,
        gateThresholdDbfs: -40,
        fftSize: 1024,
        noiseReducedPct: 10,
        inputRmsDbfs: -20,
        outputRmsDbfs: -22,
        outputSizeBytes: 1,
        clippingPrevented: false,
        filename: `x-${i}.wav`,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("orders most-recent first", () => {
    saveHistory({ ts: 1, originalName: "a", durationSeconds: 1, strength: 50, gateThresholdDbfs: -40, fftSize: 1024, noiseReducedPct: 1, inputRmsDbfs: -20, outputRmsDbfs: -22, outputSizeBytes: 1, clippingPrevented: false, filename: "a.wav" });
    saveHistory({ ts: 2, originalName: "b", durationSeconds: 1, strength: 50, gateThresholdDbfs: -40, fftSize: 1024, noiseReducedPct: 1, inputRmsDbfs: -20, outputRmsDbfs: -22, outputSizeBytes: 1, clippingPrevented: false, filename: "b.wav" });
    const h = loadHistory();
    expect(h[0].ts).toBe(2);
    expect(h[1].ts).toBe(1);
  });
  it("clears history", () => {
    saveHistory({ ts: 1, originalName: "x", durationSeconds: 1, strength: 50, gateThresholdDbfs: -40, fftSize: 1024, noiseReducedPct: 1, inputRmsDbfs: -20, outputRmsDbfs: -22, outputSizeBytes: 1, clippingPrevented: false, filename: "x.wav" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("audio-noise-reducer shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ strength: "strong", gate: "-50", fftSize: "2048" });
    expect(url).toContain("strength=strong");
    expect(url).toContain("gate=-50");
    expect(url).toContain("fft=2048");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("strength=medium&gate=-40&fft=1024");
    expect(p.strength).toBe("medium");
    expect(p.gate).toBe("-40");
    expect(p.fftSize).toBe("1024");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("ignores unknown strength value", () => {
    const p = parseShareUrl("strength=invalid&gate=-40&fft=1024");
    expect(p.strength).toBeUndefined();
    expect(p.gate).toBe("-40");
  });
  it("ignores unknown gate value", () => {
    const p = parseShareUrl("strength=medium&gate=invalid&fft=1024");
    expect(p.gate).toBeUndefined();
  });
  it("ignores unknown fft size", () => {
    const p = parseShareUrl("strength=medium&gate=-40&fft=12345");
    expect(p.fftSize).toBeUndefined();
  });
  it("strips leading # from hash", () => {
    const p = parseShareUrl("#strength=light&gate=-30&fft=512");
    expect(p.strength).toBe("light");
    expect(p.gate).toBe("-30");
    expect(p.fftSize).toBe("512");
  });
});

// Suppress unused-import lint for type-only imports
export type _Unused = StrengthPreset | GatePreset | FftSizePreset;
