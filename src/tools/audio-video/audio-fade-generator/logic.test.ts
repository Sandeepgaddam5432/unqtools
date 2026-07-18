import { describe, it, expect, beforeEach } from "vitest";
import {
  FADE_CURVES,
  FADE_CURVE_LABELS,
  FADE_DURATION_PRESETS_MS,
  FADE_DURATION_LABELS,
  DEFAULT_FADE_CURVE,
  DEFAULT_FADE_IN,
  DEFAULT_FADE_OUT,
  linearGain,
  logarithmicGain,
  exponentialGain,
  sCurveGain,
  gainForCurve,
  generateFadeInGainArray,
  generateFadeOutGainArray,
  applyFadeInGain,
  applyFadeOutGain,
  applyFades,
  fadePresetToSamples,
  msToSamples,
  computeFadeSampleRange,
  validateFade,
  buildWavHeader,
  floatSamplesTo16BitPCM,
  interleaveChannels,
  encodeWav,
  renderCurveAscii,
  computeSummaryStats,
  formatSeconds,
  formatBytes,
  formatGain,
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

describe("audio-fade-generator fade curves", () => {
  it("has 4 fade curves", () => {
    expect(FADE_CURVES).toHaveLength(4);
    expect(FADE_CURVES).toContain("linear");
    expect(FADE_CURVES).toContain("logarithmic");
    expect(FADE_CURVES).toContain("exponential");
    expect(FADE_CURVES).toContain("s-curve");
  });
  it("has 4 fade curve labels", () => {
    expect(Object.keys(FADE_CURVE_LABELS)).toHaveLength(4);
    expect(FADE_CURVE_LABELS["linear"]).toContain("Linear");
    expect(FADE_CURVE_LABELS["s-curve"]).toContain("S-curve");
  });
  it("has sensible defaults", () => {
    expect(DEFAULT_FADE_CURVE).toBe("s-curve");
    expect(DEFAULT_FADE_IN).toBe("500ms");
    expect(DEFAULT_FADE_OUT).toBe("500ms");
  });
});

describe("audio-fade-generator fade duration presets", () => {
  it("has 6 presets", () => {
    expect(Object.keys(FADE_DURATION_PRESETS_MS)).toHaveLength(6);
  });
  it("maps each preset to its millisecond value", () => {
    expect(FADE_DURATION_PRESETS_MS["100ms"]).toBe(100);
    expect(FADE_DURATION_PRESETS_MS["250ms"]).toBe(250);
    expect(FADE_DURATION_PRESETS_MS["500ms"]).toBe(500);
    expect(FADE_DURATION_PRESETS_MS["1s"]).toBe(1000);
    expect(FADE_DURATION_PRESETS_MS["2s"]).toBe(2000);
    expect(FADE_DURATION_PRESETS_MS["5s"]).toBe(5000);
  });
  it("has 6 labels", () => {
    expect(Object.keys(FADE_DURATION_LABELS)).toHaveLength(6);
  });
});

describe("audio-fade-generator per-curve gain functions", () => {
  it("linear: g = i/N", () => {
    expect(linearGain(0, 10)).toBe(0);
    expect(linearGain(5, 10)).toBeCloseTo(0.5, 5);
    expect(linearGain(10, 10)).toBe(1);
  });
  it("linear returns 1 for n=0 (avoid divide-by-zero)", () => {
    expect(linearGain(0, 0)).toBe(1);
  });
  it("logarithmic: g = log10(1 + 9·i/N)", () => {
    expect(logarithmicGain(0, 10)).toBe(0);
    expect(logarithmicGain(10, 10)).toBeCloseTo(1, 5);
    // At halfway: log10(1 + 4.5) ≈ 0.7404
    expect(logarithmicGain(5, 10)).toBeCloseTo(Math.log10(5.5), 5);
  });
  it("logarithmic is concave (mid > linear midpoint)", () => {
    // log curve at midpoint should be above the linear midpoint (0.5)
    expect(logarithmicGain(5, 10)).toBeGreaterThan(0.5);
  });
  it("exponential: g = (i/N)²", () => {
    expect(exponentialGain(0, 10)).toBe(0);
    expect(exponentialGain(5, 10)).toBeCloseTo(0.25, 5);
    expect(exponentialGain(10, 10)).toBe(1);
  });
  it("exponential is convex (mid < linear midpoint)", () => {
    expect(exponentialGain(5, 10)).toBeLessThan(0.5);
  });
  it("s-curve: g = 0.5 - 0.5·cos(π·i/N)", () => {
    expect(sCurveGain(0, 10)).toBeCloseTo(0, 5);
    expect(sCurveGain(5, 10)).toBeCloseTo(0.5, 5);
    expect(sCurveGain(10, 10)).toBeCloseTo(1, 5);
  });
  it("s-curve is symmetric about midpoint", () => {
    const a = sCurveGain(2, 10);
    const b = sCurveGain(8, 10);
    expect(a + b).toBeCloseTo(1, 5);
  });
  it("gainForCurve dispatches to the right function", () => {
    expect(gainForCurve("linear", 5, 10)).toBeCloseTo(0.5, 5);
    expect(gainForCurve("exponential", 5, 10)).toBeCloseTo(0.25, 5);
    expect(gainForCurve("logarithmic", 5, 10)).toBeCloseTo(Math.log10(5.5), 5);
    expect(gainForCurve("s-curve", 5, 10)).toBeCloseTo(0.5, 5);
  });
  it("gainForCurve falls back to linear for unknown curve", () => {
    expect(gainForCurve("unknown" as FadeCurve, 5, 10)).toBeCloseTo(0.5, 5);
  });
});

describe("audio-fade-generator fade gain array generators", () => {
  it("generateFadeInGainArray produces rising array 0 → 1", () => {
    const g = generateFadeInGainArray("linear", 5);
    expect(g).toHaveLength(5);
    expect(g[0]).toBe(0);
    expect(g[4]).toBe(1);
    // Monotonically non-decreasing
    for (let i = 1; i < g.length; i++) {
      expect(g[i]).toBeGreaterThanOrEqual(g[i - 1]);
    }
  });
  it("generateFadeInGainArray clamps endpoints exactly", () => {
    const g = generateFadeInGainArray("s-curve", 100);
    expect(g[0]).toBe(0);
    expect(g[99]).toBe(1);
  });
  it("generateFadeOutGainArray produces falling array 1 → 0", () => {
    const g = generateFadeOutGainArray("linear", 5);
    expect(g).toHaveLength(5);
    expect(g[0]).toBe(1);
    expect(g[4]).toBe(0);
    // Monotonically non-increasing
    for (let i = 1; i < g.length; i++) {
      expect(g[i]).toBeLessThanOrEqual(g[i - 1]);
    }
  });
  it("generateFadeOutGainArray clamps endpoints exactly", () => {
    const g = generateFadeOutGainArray("s-curve", 100);
    expect(g[0]).toBe(1);
    expect(g[99]).toBe(0);
  });
  it("generateFadeInGainArray returns empty for n=0", () => {
    expect(generateFadeInGainArray("linear", 0)).toHaveLength(0);
  });
  it("generateFadeOutGainArray returns empty for n=0", () => {
    expect(generateFadeOutGainArray("linear", 0)).toHaveLength(0);
  });
  it("fade out is the reverse of fade in for the same curve", () => {
    const fi = generateFadeInGainArray("s-curve", 10);
    const fo = generateFadeOutGainArray("s-curve", 10);
    for (let i = 0; i < 10; i++) {
      expect(fo[i]).toBeCloseTo(fi[9 - i], 5);
    }
  });
});

describe("audio-fade-generator fade applier", () => {
  it("applyFadeInGain multiplies first N samples by gain array", () => {
    const samples = new Float32Array([1, 1, 1, 1]);
    const gain = new Float32Array([0, 0.5, 1, 1]);
    applyFadeInGain(samples, gain);
    expect(samples[0]).toBeCloseTo(0, 5);
    expect(samples[1]).toBeCloseTo(0.5, 5);
    expect(samples[2]).toBeCloseTo(1, 5);
    expect(samples[3]).toBeCloseTo(1, 5);
  });
  it("applyFadeInGain does not affect samples beyond gain array length", () => {
    const samples = new Float32Array([1, 1, 1, 1]);
    const gain = new Float32Array([0, 0.5]);
    applyFadeInGain(samples, gain);
    expect(samples[0]).toBeCloseTo(0, 5);
    expect(samples[1]).toBeCloseTo(0.5, 5);
    expect(samples[2]).toBe(1);
    expect(samples[3]).toBe(1);
  });
  it("applyFadeInGain clamps when samples shorter than gain array", () => {
    const samples = new Float32Array([1, 1]);
    const gain = new Float32Array([0, 0.5, 1]);
    applyFadeInGain(samples, gain);
    expect(samples[0]).toBeCloseTo(0, 5);
    expect(samples[1]).toBeCloseTo(0.5, 5);
  });
  it("applyFadeOutGain multiplies last N samples by gain array", () => {
    const samples = new Float32Array([1, 1, 1, 1]);
    const gain = new Float32Array([1, 0.5]);
    applyFadeOutGain(samples, gain);
    expect(samples[0]).toBe(1);  // unaffected
    expect(samples[1]).toBe(1);  // unaffected
    expect(samples[2]).toBeCloseTo(1, 5);     // gain[0] = 1
    expect(samples[3]).toBeCloseTo(0.5, 5);   // gain[1] = 0.5
  });
  it("applyFadeOutGain does not affect samples before gain array region", () => {
    const samples = new Float32Array([1, 1, 1, 1]);
    const gain = new Float32Array([0.5, 0]);
    applyFadeOutGain(samples, gain);
    expect(samples[0]).toBe(1);
    expect(samples[1]).toBe(1);
    expect(samples[2]).toBeCloseTo(0.5, 5);
    expect(samples[3]).toBeCloseTo(0, 5);
  });
  it("applyFades applies both fade in and fade out", () => {
    const samples = new Float32Array([1, 1, 1, 1]);
    const fadeIn = new Float32Array([0, 1]);
    const fadeOut = new Float32Array([1, 0]);
    applyFades(samples, fadeIn, fadeOut);
    expect(samples[0]).toBeCloseTo(0, 5);
    expect(samples[1]).toBeCloseTo(1, 5);
    expect(samples[2]).toBeCloseTo(1, 5);
    expect(samples[3]).toBeCloseTo(0, 5);
  });
  it("applyFades returns the same array", () => {
    const samples = new Float32Array([1, 1]);
    const result = applyFades(samples, new Float32Array([0.5]), new Float32Array([0.5]));
    expect(result).toBe(samples);
  });
});

describe("audio-fade-generator fadePresetToSamples / msToSamples", () => {
  it("fadePresetToSamples converts preset to sample count", () => {
    expect(fadePresetToSamples("100ms", 44100)).toBe(4410);
    expect(fadePresetToSamples("500ms", 44100)).toBe(22050);
    expect(fadePresetToSamples("1s", 44100)).toBe(44100);
    expect(fadePresetToSamples("2s", 44100)).toBe(88200);
    expect(fadePresetToSamples("5s", 44100)).toBe(220500);
  });
  it("msToSamples converts ms to sample count", () => {
    expect(msToSamples(1000, 44100)).toBe(44100);
    expect(msToSamples(500, 44100)).toBe(22050);
    expect(msToSamples(0, 44100)).toBe(0);
  });
  it("msToSamples returns 0 for invalid sample rate", () => {
    expect(msToSamples(500, 0)).toBe(0);
    expect(msToSamples(500, -100)).toBe(0);
  });
  it("msToSamples rounds negative ms to 0", () => {
    expect(msToSamples(-100, 44100)).toBe(0);
  });
});

describe("audio-fade-generator computeFadeSampleRange", () => {
  it("computes fade ranges for typical case", () => {
    const r = computeFadeSampleRange(100, 200, 1000);
    expect(r.fadeInStart).toBe(0);
    expect(r.fadeInEnd).toBe(100);
    expect(r.fadeOutStart).toBe(800);
    expect(r.fadeOutEnd).toBe(1000);
    expect(r.fadeInSamples).toBe(100);
    expect(r.fadeOutSamples).toBe(200);
    expect(r.totalSamples).toBe(1000);
  });
  it("clamps fade in to total", () => {
    const r = computeFadeSampleRange(2000, 0, 1000);
    expect(r.fadeInSamples).toBe(1000);
    expect(r.fadeOutSamples).toBe(0);
  });
  it("clamps fade out to total", () => {
    const r = computeFadeSampleRange(0, 2000, 1000);
    expect(r.fadeInSamples).toBe(0);
    expect(r.fadeOutSamples).toBe(1000);
  });
  it("halves when fades overlap", () => {
    const r = computeFadeSampleRange(800, 800, 1000);
    expect(r.fadeInSamples).toBeLessThanOrEqual(500);
    expect(r.fadeOutSamples).toBeLessThanOrEqual(500);
    expect(r.fadeInSamples + r.fadeOutSamples).toBeLessThanOrEqual(1000);
  });
  it("handles zero total samples", () => {
    const r = computeFadeSampleRange(100, 100, 0);
    expect(r.fadeInSamples).toBe(0);
    expect(r.fadeOutSamples).toBe(0);
    expect(r.totalSamples).toBe(0);
  });
});

describe("audio-fade-generator validateFade", () => {
  it("returns ok for valid fades", () => {
    const r = validateFade(0.5, 0.5, 5);
    expect(r.ok).toBe(true);
    expect(r.error).toBeUndefined();
  });
  it("returns ok for fades that sum to total duration", () => {
    const r = validateFade(2.5, 2.5, 5);
    expect(r.ok).toBe(true);
  });
  it("fails for NaN fade in", () => {
    const r = validateFade(Number.NaN, 0.5, 5);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("valid numbers");
  });
  it("fails for negative fade in", () => {
    const r = validateFade(-0.5, 0.5, 5);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("negative");
  });
  it("fails for negative fade out", () => {
    const r = validateFade(0.5, -0.5, 5);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("negative");
  });
  it("fails when fades exceed total duration", () => {
    const r = validateFade(3, 3, 5);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("exceeds total duration");
  });
  it("allows tiny float error within 1ms", () => {
    const r = validateFade(2.5, 2.5005, 5);
    expect(r.ok).toBe(true);
  });
  it("skips total duration check when total is 0", () => {
    const r = validateFade(0.5, 0.5, 0);
    expect(r.ok).toBe(true);
  });
});

describe("audio-fade-generator buildWavHeader", () => {
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
    const view = new DataView(h.buffer);
    expect(view.getUint32(4, true)).toBe(1036);
  });
  it("encodes sample rate correctly", () => {
    const h = buildWavHeader(1000, 44100, 2);
    const view = new DataView(h.buffer);
    expect(view.getUint32(24, true)).toBe(44100);
  });
  it("encodes channels correctly", () => {
    const h = buildWavHeader(1000, 44100, 2);
    const view = new DataView(h.buffer);
    expect(view.getUint16(22, true)).toBe(2);
  });
});

describe("audio-fade-generator floatSamplesTo16BitPCM", () => {
  it("returns 2 bytes per sample", () => {
    expect(floatSamplesTo16BitPCM(new Float32Array([0, 1, -1]))).toHaveLength(6);
  });
  it("encodes 0.0 as 0", () => {
    const pcm = floatSamplesTo16BitPCM(new Float32Array([0]));
    expect(new DataView(pcm.buffer).getInt16(0, true)).toBe(0);
  });
  it("encodes 1.0 as 32767", () => {
    const pcm = floatSamplesTo16BitPCM(new Float32Array([1]));
    expect(new DataView(pcm.buffer).getInt16(0, true)).toBe(32767);
  });
  it("encodes -1.0 as -32767", () => {
    const pcm = floatSamplesTo16BitPCM(new Float32Array([-1]));
    expect(new DataView(pcm.buffer).getInt16(0, true)).toBe(-32767);
  });
  it("clamps values above 1", () => {
    const pcm = floatSamplesTo16BitPCM(new Float32Array([2]));
    expect(new DataView(pcm.buffer).getInt16(0, true)).toBe(32767);
  });
  it("clamps values below -1", () => {
    const pcm = floatSamplesTo16BitPCM(new Float32Array([-2]));
    expect(new DataView(pcm.buffer).getInt16(0, true)).toBe(-32767);
  });
});

describe("audio-fade-generator interleaveChannels", () => {
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

describe("audio-fade-generator encodeWav", () => {
  it("encodes single-channel samples to a valid WAV", () => {
    const samples = new Float32Array(44100);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin(2 * Math.PI * 440 * i / 44100) * 0.5;
    }
    const fadeIn = generateFadeInGainArray("linear", 100);
    const fadeOut = generateFadeOutGainArray("linear", 100);
    const wav = encodeWav([samples], 44100, fadeIn, fadeOut);
    expect(wav.length).toBe(44 + 44100 * 2);
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe("RIFF");
    expect(String.fromCharCode(...wav.slice(8, 12))).toBe("WAVE");
  });
  it("does not mutate input samples", () => {
    const samples = new Float32Array([1, 1, 1, 1]);
    const fadeIn = generateFadeInGainArray("linear", 2);
    const fadeOut = generateFadeOutGainArray("linear", 2);
    encodeWav([samples], 44100, fadeIn, fadeOut);
    expect(samples[0]).toBe(1);
    expect(samples[3]).toBe(1);
  });
  it("encodes 2 channels with correct byte count", () => {
    const a = new Float32Array(100);
    const b = new Float32Array(100);
    const wav = encodeWav([a, b], 44100, new Float32Array(0), new Float32Array(0));
    expect(wav.length).toBe(44 + 100 * 2 * 2);
  });
  it("handles empty channel array", () => {
    const wav = encodeWav([], 44100, new Float32Array(0), new Float32Array(0));
    expect(wav.length).toBe(44);
  });
});

describe("audio-fade-generator renderCurveAscii", () => {
  it("renders a non-empty ASCII chart", () => {
    const chart = renderCurveAscii("s-curve", 100, 100, 1000, 40, 6);
    expect(chart).toBeTruthy();
    expect(chart).toContain("Curve: s-curve");
    expect(chart.split("\n").length).toBeGreaterThan(5);
  });
  it("contains the curve name", () => {
    const chart = renderCurveAscii("linear", 50, 50, 500);
    expect(chart).toContain("linear");
  });
  it("contains fade sample counts", () => {
    const chart = renderCurveAscii("exponential", 200, 300, 1000);
    expect(chart).toContain("200");
    expect(chart).toContain("300");
  });
  it("uses █ character for filled cells", () => {
    const chart = renderCurveAscii("s-curve", 100, 100, 1000);
    expect(chart).toContain("█");
  });
  it("handles zero fades gracefully", () => {
    const chart = renderCurveAscii("linear", 0, 0, 1000);
    expect(chart).toContain("fade in 0 samples");
    expect(chart).toContain("fade out 0 samples");
  });
  it("respects width and height parameters", () => {
    const w = 30;
    const h = 4;
    const chart = renderCurveAscii("linear", 100, 100, 1000, w, h);
    const lines = chart.split("\n");
    // First line is the label, then top border, then h data rows, then bottom border
    expect(lines.length).toBe(h + 3);
  });
});

describe("audio-fade-generator computeSummaryStats", () => {
  it("computes stats for typical case", () => {
    const s = computeSummaryStats(0.5, 0.5, 5, 44100, 2, 100_000, "s-curve");
    expect(s.fadeInDurationSeconds).toBeCloseTo(0.5, 2);
    expect(s.fadeOutDurationSeconds).toBeCloseTo(0.5, 2);
    expect(s.totalDurationSeconds).toBe(5);
    expect(s.fadeInSamples).toBe(22050);
    expect(s.fadeOutSamples).toBe(22050);
    expect(s.fadedSamples).toBe(44100);
    expect(s.unfadedSamples).toBe(220500 - 44100);
    expect(s.fadedPct).toBeGreaterThan(0);
    expect(s.outputSizeBytes).toBe(100_000);
    expect(s.curve).toBe("s-curve");
  });
  it("handles zero fade durations", () => {
    const s = computeSummaryStats(0, 0, 5, 44100, 2, 100_000, "linear");
    expect(s.fadedSamples).toBe(0);
    expect(s.fadedPct).toBe(0);
    expect(s.unfadedSamples).toBe(5 * 44100);
  });
  it("handles fades that overlap (halves them)", () => {
    const s = computeSummaryStats(3, 3, 5, 44100, 1, 1000, "s-curve");
    // total = 220500, fades clamped to half each = 110250
    expect(s.fadeInSamples).toBeLessThanOrEqual(110250);
    expect(s.fadeOutSamples).toBeLessThanOrEqual(110250);
  });
  it("fadedPct is between 0 and 100", () => {
    const s = computeSummaryStats(1, 1, 5, 44100, 1, 1000, "linear");
    expect(s.fadedPct).toBeGreaterThanOrEqual(0);
    expect(s.fadedPct).toBeLessThanOrEqual(100);
  });
});

describe("audio-fade-generator formatting helpers", () => {
  it("formatSeconds formats ms", () => {
    expect(formatSeconds(0.5)).toBe("500ms");
  });
  it("formatSeconds formats seconds", () => {
    expect(formatSeconds(2.5)).toBe("2.50s");
  });
  it("formatSeconds formats minutes", () => {
    expect(formatSeconds(125)).toBe("2m05s");
  });
  it("formatSeconds handles 0", () => {
    expect(formatSeconds(0)).toBe("0s");
  });
  it("formatSeconds handles negative as 0", () => {
    expect(formatSeconds(-5)).toBe("0s");
  });
  it("formatBytes formats 0", () => {
    expect(formatBytes(0)).toBe("0 B");
  });
  it("formatBytes formats KB", () => {
    expect(formatBytes(2048)).toBe("2.00 KB");
  });
  it("formatGain formats a finite number", () => {
    expect(formatGain(0.5)).toBe("0.5000");
  });
  it("formatGain returns — for non-finite", () => {
    expect(formatGain(Number.NaN)).toBe("—");
  });
});

describe("audio-fade-generator generateFilename", () => {
  it("generates timestamped .wav filename", () => {
    const date = new Date(2024, 0, 5, 14, 23, 7);
    expect(generateFilename(date)).toBe("faded-2024-01-05-142307.wav");
  });
  it("pads single-digit fields", () => {
    const date = new Date(2024, 0, 1, 1, 2, 3);
    expect(generateFilename(date)).toBe("faded-2024-01-01-010203.wav");
  });
});

describe("audio-fade-generator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    const entry: HistoryEntry = {
      ts: 1,
      originalName: "voice.mp3",
      curve: "s-curve",
      fadeInMs: 500,
      fadeOutMs: 500,
      totalDurationMs: 10_000,
      outputSizeBytes: 80_000,
      sampleRate: 44100,
      channels: 1,
      filename: "faded-2024-01-05-142307.wav",
    };
    saveHistory(entry);
    const h = loadHistory();
    expect(h).toHaveLength(1);
    expect(h[0]).toEqual(entry);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        originalName: `f-${i}.mp3`,
        curve: "linear",
        fadeInMs: 100,
        fadeOutMs: 100,
        totalDurationMs: 1000,
        outputSizeBytes: 1000,
        sampleRate: 44100,
        channels: 1,
        filename: `f-${i}.wav`,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears history", () => {
    saveHistory({
      ts: 1, originalName: "x", curve: "linear", fadeInMs: 100, fadeOutMs: 100,
      totalDurationMs: 1000, outputSizeBytes: 1000, sampleRate: 44100, channels: 1,
      filename: "x.wav",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it("orders most-recent first", () => {
    saveHistory({
      ts: 1, originalName: "a", curve: "linear", fadeInMs: 100, fadeOutMs: 100,
      totalDurationMs: 1000, outputSizeBytes: 1000, sampleRate: 44100, channels: 1,
      filename: "a.wav",
    });
    saveHistory({
      ts: 2, originalName: "b", curve: "s-curve", fadeInMs: 500, fadeOutMs: 500,
      totalDurationMs: 1000, outputSizeBytes: 1000, sampleRate: 44100, channels: 1,
      filename: "b.wav",
    });
    const h = loadHistory();
    expect(h[0].ts).toBe(2);
    expect(h[1].ts).toBe(1);
  });
});

describe("audio-fade-generator shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      curve: "s-curve",
      fadeIn: "500ms",
      fadeOut: "1s",
    });
    expect(url).toContain("curve=s-curve");
    expect(url).toContain("fadein=500ms");
    expect(url).toContain("fadeout=1s");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("curve=s-curve&fadein=500ms&fadeout=1s");
    expect(p.curve).toBe("s-curve");
    expect(p.fadeIn).toBe("500ms");
    expect(p.fadeOut).toBe("1s");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("ignores unknown curve values", () => {
    const p = parseShareUrl("curve=invalid&fadein=500ms");
    expect(p.curve).toBeUndefined();
    expect(p.fadeIn).toBe("500ms");
  });
  it("ignores unknown fade presets", () => {
    const p = parseShareUrl("curve=linear&fadein=invalid&fadeout=invalid");
    expect(p.fadeIn).toBeUndefined();
    expect(p.fadeOut).toBeUndefined();
    expect(p.curve).toBe("linear");
  });
  it("strips leading # from hash", () => {
    const p = parseShareUrl("#curve=linear&fadein=500ms");
    expect(p.curve).toBe("linear");
    expect(p.fadeIn).toBe("500ms");
  });
  it("handles missing fields gracefully", () => {
    const p = parseShareUrl("curve=linear");
    expect(p.curve).toBe("linear");
    expect(p.fadeIn).toBeUndefined();
    expect(p.fadeOut).toBeUndefined();
  });
});

describe("audio-fade-generator integration (curve end-to-end)", () => {
  it("applies linear fade in: first sample → 0, mid → 0.4, last unaffected", () => {
    const samples = new Float32Array([1, 1, 1, 1, 1, 1, 1, 1, 1, 1]);
    const fadeIn = generateFadeInGainArray("linear", 5);
    applyFadeInGain(samples, fadeIn);
    // gain array: [0, 0.2, 0.4, 0.6, 1] (length 5, endpoints forced)
    expect(samples[0]).toBeCloseTo(0, 5);     // gain[0] = 0
    expect(samples[2]).toBeCloseTo(0.4, 5);   // gain[2] = 2/5 = 0.4
    expect(samples[4]).toBeCloseTo(1, 5);     // gain[4] = 1 (forced)
    expect(samples[5]).toBe(1);               // unaffected
  });
  it("applies s-curve fade in: middle gain ≈ 0.5", () => {
    // Use 101-length array: midpoint i=50 with N=101 → cos(π·50/101) ≈ 0
    // For an exact midpoint, use length 100 and index 50.
    const samples = new Float32Array(100).fill(1);
    const fadeIn = generateFadeInGainArray("s-curve", 100);
    applyFadeInGain(samples, fadeIn);
    // At i=50, N=100: gain = 0.5 - 0.5·cos(π·50/100) = 0.5 - 0.5·cos(π/2) = 0.5
    expect(samples[50]).toBeCloseTo(0.5, 5);
  });
  it("applies both fade in and fade out: endpoints are 0, middle is 1", () => {
    const samples = new Float32Array(100).fill(1);
    const fadeIn = generateFadeInGainArray("linear", 25);
    const fadeOut = generateFadeOutGainArray("linear", 25);
    applyFades(samples, fadeIn, fadeOut);
    expect(samples[0]).toBeCloseTo(0, 5);
    expect(samples[99]).toBeCloseTo(0, 5);
    expect(samples[50]).toBeCloseTo(1, 5);
  });
});

// Suppress unused-import lint
export type _Unused = FadeCurve | FadeDurationPreset;
