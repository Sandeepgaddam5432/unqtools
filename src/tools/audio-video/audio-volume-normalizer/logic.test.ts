import { describe, it, expect, beforeEach } from "vitest";
import {
  DBFS_PRESETS,
  DBFS_PRESET_VALUES,
  DBFS_PRESET_LABELS,
  DEFAULT_TARGET_DBFS,
  MODE_LABELS,
  MODE_DESCRIPTIONS,
  dbfsToLinear,
  linearToDbfs,
  detectPeak,
  detectPeakMulti,
  computeRms,
  computeRmsMulti,
  rmsToDbfs,
  computeTargetGain,
  computePeakGain,
  computeRmsGain,
  computeGainForMode,
  wouldClip,
  wouldClipMulti,
  maxSafeGain,
  maxSafeGainMulti,
  scaleSamples,
  scaleSamplesMulti,
  clampSamples,
  buildWavHeader,
  floatSamplesTo16BitPCM,
  interleaveChannels,
  encodeWav,
  renderReport,
  formatDbfs,
  formatGain,
  formatLinear,
  formatBytes,
  formatDuration,
  computeSummaryStats,
  generateFilename,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type NormalizationMode,
  type DbfsPreset,
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

describe("audio-volume-normalizer constants", () => {
  it("has 8 dBFS presets", () => {
    expect(DBFS_PRESETS).toHaveLength(8);
    expect(DBFS_PRESETS).toContain("-1");
    expect(DBFS_PRESETS).toContain("-23");
  });
  it("dBFS preset values match labels", () => {
    expect(DBFS_PRESET_VALUES["-1"]).toBe(-1);
    expect(DBFS_PRESET_VALUES["-23"]).toBe(-23);
    expect(DBFS_PRESET_VALUES["-16"]).toBe(-16);
  });
  it("has 8 labels", () => {
    expect(Object.keys(DBFS_PRESET_LABELS)).toHaveLength(8);
    expect(DBFS_PRESET_LABELS["-16"]).toContain("podcast");
    expect(DBFS_PRESET_LABELS["-23"]).toContain("EBU R128");
  });
  it("default target is -16 dBFS (podcast)", () => {
    expect(DEFAULT_TARGET_DBFS).toBe(-16);
  });
  it("has 3 mode labels", () => {
    expect(Object.keys(MODE_LABELS)).toHaveLength(3);
    expect(MODE_LABELS.peak).toContain("Peak");
    expect(MODE_LABELS.rms).toContain("RMS");
    expect(MODE_LABELS.loudness).toContain("EBU R128");
  });
  it("has 3 mode descriptions", () => {
    expect(Object.keys(MODE_DESCRIPTIONS)).toHaveLength(3);
    expect(MODE_DESCRIPTIONS.peak.length).toBeGreaterThan(10);
    expect(MODE_DESCRIPTIONS.rms.length).toBeGreaterThan(10);
    expect(MODE_DESCRIPTIONS.loudness.length).toBeGreaterThan(10);
  });
});

describe("audio-volume-normalizer dbfsToLinear", () => {
  it("0 dBFS → gain 1.0", () => {
    expect(dbfsToLinear(0)).toBeCloseTo(1.0, 6);
  });
  it("-6 dBFS → ~0.501", () => {
    expect(dbfsToLinear(-6)).toBeCloseTo(0.5012, 3);
  });
  it("-20 dBFS → 0.1", () => {
    expect(dbfsToLinear(-20)).toBeCloseTo(0.1, 6);
  });
  it("clamps extreme values", () => {
    // 1000 dBFS would overflow but we clamp to 20 → 10×
    expect(dbfsToLinear(1000)).toBeCloseTo(10, 6);
    // -1000 dBFS would underflow but we clamp to -200 → 1e-10 (10^(-10))
    expect(dbfsToLinear(-1000)).toBeCloseTo(1e-10, 12);
  });
  it("returns 1 for NaN input", () => {
    expect(dbfsToLinear(Number.NaN)).toBe(1);
  });
});

describe("audio-volume-normalizer linearToDbfs", () => {
  it("gain 1.0 → 0 dBFS", () => {
    expect(linearToDbfs(1.0)).toBeCloseTo(0, 6);
  });
  it("gain 0.5 → -6.02 dBFS", () => {
    expect(linearToDbfs(0.5)).toBeCloseTo(-6.0206, 3);
  });
  it("gain 2.0 → +6.02 dBFS", () => {
    expect(linearToDbfs(2.0)).toBeCloseTo(6.0206, 3);
  });
  it("gain 0 → -Infinity", () => {
    expect(linearToDbfs(0)).toBe(Number.NEGATIVE_INFINITY);
  });
  it("negative gain → -Infinity", () => {
    expect(linearToDbfs(-1)).toBe(Number.NEGATIVE_INFINITY);
  });
  it("NaN → -Infinity", () => {
    expect(linearToDbfs(Number.NaN)).toBe(Number.NEGATIVE_INFINITY);
  });
});

describe("audio-volume-normalizer detectPeak", () => {
  it("finds max positive sample", () => {
    expect(detectPeak(new Float32Array([0.1, 0.5, 0.3, -0.2]))).toBeCloseTo(0.5, 6);
  });
  it("finds max negative sample (by absolute value)", () => {
    expect(detectPeak(new Float32Array([0.1, -0.7, 0.3]))).toBeCloseTo(0.7, 6);
  });
  it("returns 0 for empty input", () => {
    expect(detectPeak(new Float32Array(0))).toBe(0);
  });
  it("returns 0 for all-zero samples", () => {
    expect(detectPeak(new Float32Array([0, 0, 0]))).toBe(0);
  });
  it("handles single sample", () => {
    expect(detectPeak(new Float32Array([0.42]))).toBeCloseTo(0.42, 6);
  });
});

describe("audio-volume-normalizer detectPeakMulti", () => {
  it("finds max across channels", () => {
    const a = new Float32Array([0.1, 0.3]);
    const b = new Float32Array([0.5, 0.2]);
    expect(detectPeakMulti([a, b])).toBeCloseTo(0.5, 6);
  });
  it("returns 0 for empty input", () => {
    expect(detectPeakMulti([])).toBe(0);
  });
  it("finds max in second channel", () => {
    const a = new Float32Array([0.1, 0.2]);
    const b = new Float32Array([0.7, 0.1]);
    expect(detectPeakMulti([a, b])).toBeCloseTo(0.7, 6);
  });
});

describe("audio-volume-normalizer computeRms", () => {
  it("returns 0 for empty input", () => {
    expect(computeRms(new Float32Array(0))).toBe(0);
  });
  it("computes RMS for constant signal", () => {
    // Constant 0.5 → RMS = 0.5
    expect(computeRms(new Float32Array([0.5, 0.5, 0.5, 0.5]))).toBeCloseTo(0.5, 6);
  });
  it("computes RMS for sine wave (≈ 0.707)", () => {
    // Full-scale sine wave has RMS = 1/√2 ≈ 0.7071
    const samples = new Float32Array(44100);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin((2 * Math.PI * 440 * i) / 44100);
    }
    expect(computeRms(samples)).toBeCloseTo(0.7071, 3);
  });
  it("returns 0 for all-zero samples", () => {
    expect(computeRms(new Float32Array([0, 0, 0]))).toBe(0);
  });
});

describe("audio-volume-normalizer computeRmsMulti", () => {
  it("averages per-channel RMS", () => {
    const a = new Float32Array([0.5, 0.5]);
    const b = new Float32Array([0.1, 0.1]);
    // RMS_a = 0.5, RMS_b = 0.1, avg = 0.3
    expect(computeRmsMulti([a, b])).toBeCloseTo(0.3, 6);
  });
  it("returns 0 for empty input", () => {
    expect(computeRmsMulti([])).toBe(0);
  });
  it("returns single channel RMS for one channel", () => {
    const a = new Float32Array([0.5, 0.5]);
    expect(computeRmsMulti([a])).toBeCloseTo(0.5, 6);
  });
});

describe("audio-volume-normalizer rmsToDbfs", () => {
  it("returns -Infinity for 0 RMS", () => {
    expect(rmsToDbfs(0)).toBe(Number.NEGATIVE_INFINITY);
  });
  it("returns 0 dBFS for RMS = 1.0", () => {
    expect(rmsToDbfs(1.0)).toBeCloseTo(0, 6);
  });
  it("returns -6.02 dBFS for RMS = 0.5", () => {
    expect(rmsToDbfs(0.5)).toBeCloseTo(-6.0206, 3);
  });
});

describe("audio-volume-normalizer computeTargetGain", () => {
  it("boosts quiet audio to target", () => {
    // Current -23 dBFS → target -16 dBFS: gain = 10^((-16 - -23)/20) = 10^(7/20) ≈ 2.239
    const gain = computeTargetGain(-23, -16);
    expect(gain).toBeCloseTo(2.2387, 3);
  });
  it("reduces loud audio to target", () => {
    // Current -6 dBFS → target -16 dBFS: gain = 10^(-10/20) ≈ 0.3162
    const gain = computeTargetGain(-6, -16);
    expect(gain).toBeCloseTo(0.3162, 3);
  });
  it("returns 1 when current equals target", () => {
    expect(computeTargetGain(-16, -16)).toBeCloseTo(1.0, 6);
  });
  it("returns 0 for -Infinity current (silent)", () => {
    expect(computeTargetGain(Number.NEGATIVE_INFINITY, -16)).toBe(0);
  });
});

describe("audio-volume-normalizer computePeakGain", () => {
  it("computes gain to bring peak to target dBFS", () => {
    // Peak 0.5 → target -6 dBFS: target linear = 10^(-6/20) = 0.5012, gain = 0.5012 / 0.5 = 1.0024
    const gain = computePeakGain(0.5, -6);
    expect(gain).toBeCloseTo(1.0024, 3);
  });
  it("returns 0 for peak = 0", () => {
    expect(computePeakGain(0, -16)).toBe(0);
  });
  it("returns 0 for negative peak", () => {
    expect(computePeakGain(-0.5, -16)).toBe(0);
  });
});

describe("audio-volume-normalizer computeRmsGain", () => {
  it("computes gain to bring RMS to target dBFS", () => {
    // RMS 0.1 → target -16 dBFS: target linear = 10^(-16/20) = 0.1585, gain = 0.1585 / 0.1 = 1.585
    const gain = computeRmsGain(0.1, -16);
    expect(gain).toBeCloseTo(1.585, 3);
  });
  it("returns 0 for RMS = 0", () => {
    expect(computeRmsGain(0, -16)).toBe(0);
  });
});

describe("audio-volume-normalizer computeGainForMode", () => {
  it("uses peak gain for peak mode", () => {
    const peak = 0.5;
    const rms = 0.1;
    expect(computeGainForMode("peak", peak, -6)).toBeCloseTo(computePeakGain(0.5, -6), 6);
    expect(computeGainForMode("peak", peak, -6)).not.toBeCloseTo(computeRmsGain(rms, -6), 6);
  });
  it("uses RMS gain for RMS mode", () => {
    const value = 0.1;
    expect(computeGainForMode("rms", value, -16)).toBeCloseTo(computeRmsGain(0.1, -16), 6);
  });
  it("uses RMS gain for loudness mode", () => {
    const value = 0.1;
    expect(computeGainForMode("loudness", value, -16)).toBeCloseTo(computeRmsGain(0.1, -16), 6);
  });
});

describe("audio-volume-normalizer wouldClip", () => {
  it("detects clipping when gain × peak > 1", () => {
    expect(wouldClip(new Float32Array([0.5, 0.5]), 3)).toBe(true); // 0.5 * 3 = 1.5
  });
  it("returns false when gain × peak <= 1", () => {
    expect(wouldClip(new Float32Array([0.5, 0.5]), 2)).toBe(false); // 0.5 * 2 = 1.0
  });
  it("returns false for very small gain", () => {
    expect(wouldClip(new Float32Array([0.9, 0.9]), 0.5)).toBe(false);
  });
  it("returns false for empty samples", () => {
    expect(wouldClip(new Float32Array(0), 100)).toBe(false);
  });
});

describe("audio-volume-normalizer wouldClipMulti", () => {
  it("detects clipping on any channel", () => {
    const a = new Float32Array([0.1]);
    const b = new Float32Array([0.9]);
    expect(wouldClipMulti([a, b], 2)).toBe(true); // 0.9 * 2 = 1.8
  });
  it("returns false when no channel clips", () => {
    const a = new Float32Array([0.1]);
    const b = new Float32Array([0.2]);
    expect(wouldClipMulti([a, b], 2)).toBe(false);
  });
  it("returns false for empty input", () => {
    expect(wouldClipMulti([], 100)).toBe(false);
  });
});

describe("audio-volume-normalizer maxSafeGain", () => {
  it("returns requested gain when safe", () => {
    // Peak 0.5 → safe limit ~ 2.0; requesting 1.5 → returned
    expect(maxSafeGain(0.5, 1.5)).toBeCloseTo(1.5, 6);
  });
  it("clamps to safe limit when requested would clip", () => {
    // Peak 0.5 → safe limit ~2.0; requesting 3 → returned 1.999...
    const safe = maxSafeGain(0.5, 3);
    expect(safe).toBeLessThan(2);
    expect(safe).toBeGreaterThan(1.99);
  });
  it("returns requested gain when peak is 0", () => {
    expect(maxSafeGain(0, 100)).toBe(100);
  });
  it("returns requested gain when peak is negative", () => {
    expect(maxSafeGain(-0.5, 5)).toBe(5);
  });
});

describe("audio-volume-normalizer maxSafeGainMulti", () => {
  it("uses max peak across channels", () => {
    const a = new Float32Array([0.1]);
    const b = new Float32Array([0.5]); // bigger peak
    // Safe limit ~2.0; requesting 1.5 → returned
    expect(maxSafeGainMulti([a, b], 1.5)).toBeCloseTo(1.5, 6);
  });
  it("clamps when any channel would clip", () => {
    const a = new Float32Array([0.1]);
    const b = new Float32Array([0.9]);
    // Safe limit ~1.111; requesting 2 → returned 1.111
    const safe = maxSafeGainMulti([a, b], 2);
    expect(safe).toBeLessThan(1.2);
    expect(safe).toBeGreaterThan(1.1);
  });
});

describe("audio-volume-normalizer scaleSamples", () => {
  it("applies gain uniformly", () => {
    const out = scaleSamples(new Float32Array([0.1, 0.2, 0.3]), 2);
    const arr = Array.from(out);
    expect(arr[0]).toBeCloseTo(0.2, 6);
    expect(arr[1]).toBeCloseTo(0.4, 6);
    expect(arr[2]).toBeCloseTo(0.6, 6);
  });
  it("does not mutate input", () => {
    const input = new Float32Array([0.1, 0.2]);
    const inputCopy = input.slice();
    scaleSamples(input, 5);
    expect(Array.from(input)).toEqual(Array.from(inputCopy));
  });
  it("handles gain = 0 (silence)", () => {
    const out = scaleSamples(new Float32Array([0.1, 0.2, 0.3]), 0);
    const arr = Array.from(out);
    expect(arr[0]).toBe(0);
    expect(arr[1]).toBe(0);
    expect(arr[2]).toBe(0);
  });
  it("handles empty input", () => {
    expect(scaleSamples(new Float32Array(0), 2)).toHaveLength(0);
  });
});

describe("audio-volume-normalizer scaleSamplesMulti", () => {
  it("applies gain to all channels", () => {
    const a = new Float32Array([0.1, 0.2]);
    const b = new Float32Array([0.3, 0.4]);
    const out = scaleSamplesMulti([a, b], 2);
    const arr0 = Array.from(out[0]);
    const arr1 = Array.from(out[1]);
    expect(arr0[0]).toBeCloseTo(0.2, 6);
    expect(arr0[1]).toBeCloseTo(0.4, 6);
    expect(arr1[0]).toBeCloseTo(0.6, 6);
    expect(arr1[1]).toBeCloseTo(0.8, 6);
  });
  it("does not mutate inputs", () => {
    const a = new Float32Array([0.1, 0.2]);
    const aCopy = a.slice();
    scaleSamplesMulti([a], 5);
    expect(Array.from(a)).toEqual(Array.from(aCopy));
  });
  it("returns empty for empty input", () => {
    expect(scaleSamplesMulti([], 2)).toEqual([]);
  });
});

describe("audio-volume-normalizer clampSamples", () => {
  it("clamps values above 1", () => {
    const samples = new Float32Array([1.5, 0.5]);
    clampSamples(samples);
    expect(samples[0]).toBe(1);
    expect(samples[1]).toBe(0.5);
  });
  it("clamps values below -1", () => {
    const samples = new Float32Array([-1.5, -0.5]);
    clampSamples(samples);
    expect(samples[0]).toBe(-1);
    expect(samples[1]).toBe(-0.5);
  });
  it("leaves in-range values unchanged", () => {
    const samples = new Float32Array([-1, 0, 1]);
    const before = Array.from(samples);
    clampSamples(samples);
    expect(Array.from(samples)).toEqual(before);
  });
  it("handles empty input", () => {
    const samples = new Float32Array(0);
    expect(() => clampSamples(samples)).not.toThrow();
  });
});

describe("audio-volume-normalizer buildWavHeader", () => {
  it("returns 44-byte header", () => {
    expect(buildWavHeader(1000, 44100, 2)).toHaveLength(44);
  });
  it("contains RIFF marker", () => {
    const h = buildWavHeader(1000, 44100, 2);
    expect(String.fromCharCode(...h.slice(0, 4))).toBe("RIFF");
  });
  it("contains WAVE marker", () => {
    const h = buildWavHeader(1000, 44100, 2);
    expect(String.fromCharCode(...h.slice(8, 12))).toBe("WAVE");
  });
  it("encodes file size correctly", () => {
    const h = buildWavHeader(1000, 44100, 2);
    const v = new DataView(h.buffer);
    expect(v.getUint32(4, true)).toBe(1036);
  });
  it("encodes sample rate at offset 24", () => {
    const h = buildWavHeader(1000, 48000, 2);
    const v = new DataView(h.buffer);
    expect(v.getUint32(24, true)).toBe(48000);
  });
});

describe("audio-volume-normalizer floatSamplesTo16BitPCM", () => {
  it("returns 2 bytes per sample", () => {
    expect(floatSamplesTo16BitPCM(new Float32Array([0, 1, -1]))).toHaveLength(6);
  });
  it("encodes 1.0 as 32767", () => {
    const v = new DataView(floatSamplesTo16BitPCM(new Float32Array([1])).buffer);
    expect(v.getInt16(0, true)).toBe(32767);
  });
  it("encodes -1.0 as -32767", () => {
    const v = new DataView(floatSamplesTo16BitPCM(new Float32Array([-1])).buffer);
    expect(v.getInt16(0, true)).toBe(-32767);
  });
  it("clamps values above 1", () => {
    const v = new DataView(floatSamplesTo16BitPCM(new Float32Array([2])).buffer);
    expect(v.getInt16(0, true)).toBe(32767);
  });
});

describe("audio-volume-normalizer interleaveChannels", () => {
  it("interleaves 2 channels", () => {
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array([4, 5, 6]);
    expect(Array.from(interleaveChannels([a, b]))).toEqual([1, 4, 2, 5, 3, 6]);
  });
  it("handles single channel", () => {
    expect(Array.from(interleaveChannels([new Float32Array([1, 2, 3])]))).toEqual([1, 2, 3]);
  });
  it("returns empty for empty input", () => {
    expect(interleaveChannels([])).toHaveLength(0);
  });
});

describe("audio-volume-normalizer encodeWav", () => {
  it("encodes single-channel samples with correct byte count", () => {
    const samples = new Float32Array(100);
    const wav = encodeWav([samples], 44100);
    expect(wav.length).toBe(44 + 100 * 2);
  });
  it("encodes 2 channels with correct byte count", () => {
    const a = new Float32Array(100);
    const b = new Float32Array(100);
    const wav = encodeWav([a, b], 44100);
    expect(wav.length).toBe(44 + 100 * 2 * 2);
  });
  it("handles empty channel array", () => {
    const wav = encodeWav([], 44100);
    expect(wav.length).toBe(44);
  });
  it("encodes channel count in header", () => {
    const wav = encodeWav([new Float32Array(10), new Float32Array(10)], 44100);
    const v = new DataView(wav.buffer);
    expect(v.getUint16(22, true)).toBe(2);
  });
});

describe("audio-volume-normalizer formatDbfs / formatGain / formatLinear", () => {
  it("formatDbfs handles -Infinity", () => {
    expect(formatDbfs(Number.NEGATIVE_INFINITY)).toBe("−∞ dBFS");
  });
  it("formatDbfs formats finite values", () => {
    expect(formatDbfs(-16)).toBe("-16.00 dBFS");
  });
  it("formatGain formats finite values", () => {
    expect(formatGain(1.5)).toBe("1.5000×");
  });
  it("formatGain handles NaN", () => {
    expect(formatGain(Number.NaN)).toBe("—");
  });
  it("formatLinear formats finite values", () => {
    expect(formatLinear(0.123456)).toBe("0.123456");
  });
  it("formatLinear handles NaN", () => {
    expect(formatLinear(Number.NaN)).toBe("—");
  });
});

describe("audio-volume-normalizer formatBytes & formatDuration", () => {
  it("formatBytes 0 → '0 B'", () => {
    expect(formatBytes(0)).toBe("0 B");
  });
  it("formatBytes formats KB", () => {
    expect(formatBytes(2048)).toBe("2.00 KB");
  });
  it("formatBytes formats MB", () => {
    expect(formatBytes(1_500_000)).toBe("1.43 MB");
  });
  it("formatDuration formats 0 as 0:00", () => {
    expect(formatDuration(0)).toBe("0:00");
  });
  it("formatDuration formats 90 as 1:30", () => {
    expect(formatDuration(90)).toBe("1:30");
  });
});

describe("audio-volume-normalizer renderReport", () => {
  it("renders a complete report", () => {
    const report = {
      mode: "peak" as NormalizationMode,
      targetDbfs: -16,
      inputPeakLinear: 0.5,
      inputPeakDbfs: -6.0206,
      inputRmsLinear: 0.1,
      inputRmsDbfs: -20,
      requestedGainLinear: 0.3162,
      requestedGainDb: -10,
      appliedGainLinear: 0.3162,
      appliedGainDb: -10,
      outputPeakLinear: 0.1585,
      outputPeakDbfs: -16,
      outputRmsLinear: 0.0316,
      outputRmsDbfs: -30,
      clippedToPreventClipping: false,
      durationSeconds: 10,
      sampleRate: 44100,
      channels: 1,
    };
    const text = renderReport(report);
    expect(text).toContain("Audio Volume Normalization Report");
    expect(text).toContain("Mode: Peak");
    expect(text).toContain("Target: -16.00 dBFS");
    expect(text).toContain("Duration: 10.000 s");
    expect(text).toContain("Sample rate: 44100 Hz");
    expect(text).toContain("Channels: 1");
    expect(text).toContain("Input analysis:");
    expect(text).toContain("Output analysis:");
    expect(text).toContain("Loudness comparison");
  });
  it("includes clipping warning when applicable", () => {
    const report = {
      mode: "rms" as NormalizationMode,
      targetDbfs: -6,
      inputPeakLinear: 0.5,
      inputPeakDbfs: -6,
      inputRmsLinear: 0.1,
      inputRmsDbfs: -20,
      requestedGainLinear: 5,
      requestedGainDb: 14,
      appliedGainLinear: 2,
      appliedGainDb: 6,
      outputPeakLinear: 1,
      outputPeakDbfs: 0,
      outputRmsLinear: 0.2,
      outputRmsDbfs: -14,
      clippedToPreventClipping: true,
      durationSeconds: 5,
      sampleRate: 44100,
      channels: 1,
    };
    const text = renderReport(report);
    expect(text).toContain("Reduced to prevent clipping");
  });
  it("handles -Infinity input RMS (silent audio)", () => {
    const report = {
      mode: "rms" as NormalizationMode,
      targetDbfs: -16,
      inputPeakLinear: 0,
      inputPeakDbfs: Number.NEGATIVE_INFINITY,
      inputRmsLinear: 0,
      inputRmsDbfs: Number.NEGATIVE_INFINITY,
      requestedGainLinear: 0,
      requestedGainDb: Number.NEGATIVE_INFINITY,
      appliedGainLinear: 0,
      appliedGainDb: Number.NEGATIVE_INFINITY,
      outputPeakLinear: 0,
      outputPeakDbfs: Number.NEGATIVE_INFINITY,
      outputRmsLinear: 0,
      outputRmsDbfs: Number.NEGATIVE_INFINITY,
      clippedToPreventClipping: false,
      durationSeconds: 5,
      sampleRate: 44100,
      channels: 1,
    };
    const text = renderReport(report);
    expect(text).toContain("−∞ dBFS");
  });
});

describe("audio-volume-normalizer computeSummaryStats", () => {
  it("computes summary from report", () => {
    const report = {
      mode: "peak" as NormalizationMode,
      targetDbfs: -16,
      inputPeakLinear: 0.5,
      inputPeakDbfs: -6,
      inputRmsLinear: 0.1,
      inputRmsDbfs: -20,
      requestedGainLinear: 0.3162,
      requestedGainDb: -10,
      appliedGainLinear: 0.3162,
      appliedGainDb: -10,
      outputPeakLinear: 0.1585,
      outputPeakDbfs: -16,
      outputRmsLinear: 0.0316,
      outputRmsDbfs: -30,
      clippedToPreventClipping: false,
      durationSeconds: 10,
      sampleRate: 44100,
      channels: 1,
    };
    const stats = computeSummaryStats(report, 1_000_000);
    expect(stats.inputPeakDbfs).toBe(-6);
    expect(stats.inputRmsDbfs).toBe(-20);
    expect(stats.outputPeakDbfs).toBe(-16);
    expect(stats.outputRmsDbfs).toBe(-30);
    expect(stats.appliedGainDb).toBe(-10);
    expect(stats.loudnessDeltaDb).toBe(-10); // -30 - (-20) = -10
    expect(stats.outputSizeBytes).toBe(1_000_000);
    expect(stats.clippedToPreventClipping).toBe(false);
  });
});

describe("audio-volume-normalizer generateFilename", () => {
  it("generates timestamped .wav filename", () => {
    const date = new Date(2024, 0, 5, 14, 23, 7);
    expect(generateFilename(date)).toBe("normalized-2024-01-05-142307.wav");
  });
  it("pads single-digit fields", () => {
    const date = new Date(2024, 0, 1, 1, 2, 3);
    expect(generateFilename(date)).toBe("normalized-2024-01-01-010203.wav");
  });
});

describe("audio-volume-normalizer history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    const entry: HistoryEntry = {
      ts: 1,
      originalName: "voice.mp3",
      mode: "peak",
      targetDbfs: -16,
      inputPeakDbfs: -6,
      inputRmsDbfs: -20,
      outputPeakDbfs: -16,
      outputRmsDbfs: -30,
      appliedGainDb: -10,
      durationSeconds: 10,
      outputSizeBytes: 1_000_000,
      clippedToPreventClipping: false,
      filename: "normalized.wav",
    };
    saveHistory(entry);
    const history = loadHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toEqual(entry);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        originalName: `f-${i}.mp3`,
        mode: "peak",
        targetDbfs: -16,
        inputPeakDbfs: -6,
        inputRmsDbfs: -20,
        outputPeakDbfs: -16,
        outputRmsDbfs: -30,
        appliedGainDb: -10,
        durationSeconds: 1,
        outputSizeBytes: 1,
        clippedToPreventClipping: false,
        filename: `n-${i}.wav`,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears history", () => {
    saveHistory({
      ts: 1, originalName: "x", mode: "peak", targetDbfs: -16,
      inputPeakDbfs: -6, inputRmsDbfs: -20, outputPeakDbfs: -16,
      outputRmsDbfs: -30, appliedGainDb: -10, durationSeconds: 1,
      outputSizeBytes: 1, clippedToPreventClipping: false, filename: "x.wav",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it("orders most-recent first", () => {
    saveHistory({
      ts: 1, originalName: "a", mode: "peak", targetDbfs: -16,
      inputPeakDbfs: -6, inputRmsDbfs: -20, outputPeakDbfs: -16,
      outputRmsDbfs: -30, appliedGainDb: -10, durationSeconds: 1,
      outputSizeBytes: 1, clippedToPreventClipping: false, filename: "a.wav",
    });
    saveHistory({
      ts: 2, originalName: "b", mode: "peak", targetDbfs: -16,
      inputPeakDbfs: -6, inputRmsDbfs: -20, outputPeakDbfs: -16,
      outputRmsDbfs: -30, appliedGainDb: -10, durationSeconds: 1,
      outputSizeBytes: 1, clippedToPreventClipping: false, filename: "b.wav",
    });
    const history = loadHistory();
    expect(history[0].ts).toBe(2);
    expect(history[1].ts).toBe(1);
  });
});

describe("audio-volume-normalizer shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ mode: "rms", targetDbfs: "-16" });
    expect(url).toContain("mode=rms");
    expect(url).toContain("target=-16");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("mode=rms&target=-16");
    expect(p.mode).toBe("rms");
    expect(p.targetDbfs).toBe("-16");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("ignores unknown mode", () => {
    const p = parseShareUrl("mode=invalid");
    expect(p.mode).toBeUndefined();
  });
  it("ignores unknown target", () => {
    const p = parseShareUrl("target=-999");
    expect(p.targetDbfs).toBeUndefined();
  });
  it("strips leading # from hash", () => {
    const p = parseShareUrl("#mode=peak&target=-6");
    expect(p.mode).toBe("peak");
    expect(p.targetDbfs).toBe("-6");
  });
  it("accepts all 3 modes", () => {
    expect(parseShareUrl("mode=peak").mode).toBe("peak");
    expect(parseShareUrl("mode=rms").mode).toBe("rms");
    expect(parseShareUrl("mode=loudness").mode).toBe("loudness");
  });
  it("accepts all 8 dBFS presets", () => {
    for (const target of ["-1", "-3", "-6", "-10", "-14", "-16", "-20", "-23"]) {
      const p = parseShareUrl(`target=${target}`);
      expect(p.targetDbfs).toBe(target as DbfsPreset);
    }
  });
});

// Suppress unused-import lint
export type _Unused = NormalizationMode | DbfsPreset | HistoryEntry;
