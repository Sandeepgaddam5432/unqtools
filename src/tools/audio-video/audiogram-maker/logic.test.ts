import { describe, it, expect } from "vitest";
import {
  DEFAULT_PARAMS, COLOR_SCHEMES, validateParams, peak, rms, computeBars,
  layoutBars, buildPlan, applyColorScheme, estimateBytes, formatDuration,
  formatBytes, generateSyntheticWaveform, renderTextPreview, canvasAspectRatio,
} from "./logic";

describe("COLOR_SCHEMES", () => {
  it("has 5 schemes", () => {
    expect(Object.keys(COLOR_SCHEMES).length).toBe(5);
  });
});

describe("validateParams", () => {
  it("accepts defaults", () => {
    expect(validateParams(DEFAULT_PARAMS).ok).toBe(true);
  });
  it("rejects low sample rate", () => {
    expect(validateParams({ ...DEFAULT_PARAMS, sampleRate: 4000 }).ok).toBe(false);
  });
  it("rejects zero duration", () => {
    expect(validateParams({ ...DEFAULT_PARAMS, durationSec: 0 }).ok).toBe(false);
  });
  it("rejects bad bar count", () => {
    expect(validateParams({ ...DEFAULT_PARAMS, barCount: 0 }).ok).toBe(false);
    expect(validateParams({ ...DEFAULT_PARAMS, barCount: 5000 }).ok).toBe(false);
  });
  it("rejects tiny canvas", () => {
    expect(validateParams({ ...DEFAULT_PARAMS, canvasWidth: 50 }).ok).toBe(false);
  });
});

describe("peak & rms", () => {
  it("peak finds max abs", () => {
    expect(peak(new Float32Array([0.1, -0.7, 0.3]))).toBe(0.7);
  });
  it("rms computes", () => {
    expect(rms(new Float32Array([1, -1, 1, -1]))).toBeCloseTo(1, 5);
  });
  it("rms 0 for empty", () => {
    expect(rms(new Float32Array(0))).toBe(0);
  });
});

describe("computeBars", () => {
  it("produces N bars", () => {
    const samples = new Float32Array(1000);
    for (let i = 0; i < 1000; i++) samples[i] = Math.sin(i * 0.1);
    const bars = computeBars(samples, 50, true);
    expect(bars.length).toBe(50);
  });
  it("normalizes when peakNormalize true", () => {
    const samples = new Float32Array(100);
    for (let i = 0; i < 100; i++) samples[i] = 0.5 * Math.sin(i * 0.5);
    const bars = computeBars(samples, 10, true);
    const max = Math.max(...bars.map((b) => b.amplitude));
    expect(max).toBeCloseTo(1, 1);
  });
  it("does not normalize when false", () => {
    const samples = new Float32Array(100);
    for (let i = 0; i < 100; i++) samples[i] = 0.5 * Math.sin(i * 0.5);
    const bars = computeBars(samples, 10, false);
    const max = Math.max(...bars.map((b) => b.amplitude));
    expect(max).toBeLessThan(1);
  });
  it("empty samples → empty bars", () => {
    expect(computeBars(new Float32Array(0), 50, true)).toEqual([]);
  });
});

describe("layoutBars", () => {
  it("assigns x positions", () => {
    const bars = computeBars(new Float32Array([0.1, 0.2, 0.3, 0.4]), 2, true);
    const laid = layoutBars(bars, 200, 4, 2);
    expect(laid.length).toBe(2);
    expect(laid[0].x).toBeGreaterThan(0);
    expect(laid[1].x).toBeGreaterThan(laid[0].x);
  });
});

describe("buildPlan", () => {
  it("builds full plan", () => {
    const samples = new Float32Array(1000);
    for (let i = 0; i < 1000; i++) samples[i] = Math.sin(i * 0.1);
    const plan = buildPlan(samples, { ...DEFAULT_PARAMS, durationSec: 0.1, barCount: 20 });
    expect(plan.bars.length).toBe(20);
    expect(plan.totalSamples).toBe(1000);
    expect(plan.samplesPerBar).toBe(50);
    expect(plan.peakAmplitude).toBeGreaterThan(0);
  });
  it("handles empty samples", () => {
    const plan = buildPlan(new Float32Array(0), DEFAULT_PARAMS);
    expect(plan.bars.length).toBe(0);
    expect(plan.peakAmplitude).toBe(0);
  });
});

describe("applyColorScheme", () => {
  it("applies scheme colors", () => {
    const p = applyColorScheme(DEFAULT_PARAMS, "warm");
    expect(p.colorScheme).toBe("warm");
    expect(p.backgroundColor).toBe(COLOR_SCHEMES.warm.background);
    expect(p.foregroundColor).toBe(COLOR_SCHEMES.warm.foreground);
  });
});

describe("estimateBytes & formatters", () => {
  it("scales with duration", () => {
    expect(estimateBytes(10, 4, 30, 1080, 1080)).toBeGreaterThan(estimateBytes(5, 4, 30, 1080, 1080));
  });
  it("formatDuration", () => {
    expect(formatDuration(0.5)).toBe("500ms");
    expect(formatDuration(65)).toContain("m");
  });
  it("formatBytes", () => {
    expect(formatBytes(2048)).toBe("2.0 KB");
  });
});

describe("generateSyntheticWaveform", () => {
  it("produces expected length", () => {
    const s = generateSyntheticWaveform(0.1, 8000);
    expect(s.length).toBe(800);
  });
  it("is deterministic with same seed", () => {
    const a = generateSyntheticWaveform(0.01, 8000, 1);
    const b = generateSyntheticWaveform(0.01, 8000, 1);
    expect(a[0]).toBe(b[0]);
  });
});

describe("renderTextPreview", () => {
  it("renders N rows", () => {
    const bars = [{ index: 0, x: 0, amplitude: 0.5 }, { index: 1, x: 0, amplitude: 1 }];
    const text = renderTextPreview(bars, 8);
    expect(text.split("\n").length).toBe(9);
  });
});

describe("canvasAspectRatio", () => {
  it("returns simplified ratio", () => {
    expect(canvasAspectRatio(1920, 1080)).toBe("16:9");
    expect(canvasAspectRatio(1080, 1080)).toBe("1:1");
  });
});
