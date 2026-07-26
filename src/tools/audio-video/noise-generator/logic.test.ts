import { describe, it, expect } from "vitest";
import {
  DEFAULT_PARAMS, mulberry32, whiteNoiseSample, PinkNoiseGenerator,
  BrownNoiseGenerator, generateNoise, validateParams, peakAmplitude,
  rmsAmplitude, spectralRolloff, classifyNoise, formatDuration,
  estimateWavBytes, formatBytes, spectralDescription,
} from "./logic";

describe("mulberry32", () => {
  it("is deterministic", () => {
    const a = mulberry32(1);
    const b = mulberry32(1);
    expect(a()).toBe(b());
    expect(a()).toBe(b());
  });
  it("returns values in [0, 1)", () => {
    const r = mulberry32(99);
    for (let i = 0; i < 50; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("whiteNoiseSample", () => {
  it("returns values in [-1, 1]", () => {
    const r = mulberry32(1);
    for (let i = 0; i < 50; i++) {
      const v = whiteNoiseSample(r);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe("PinkNoiseGenerator", () => {
  it("produces values in range", () => {
    const g = new PinkNoiseGenerator(1);
    for (let i = 0; i < 50; i++) {
      const v = g.next();
      expect(v).toBeGreaterThanOrEqual(-1.5);
      expect(v).toBeLessThanOrEqual(1.5);
    }
  });
  it("is deterministic", () => {
    const a = new PinkNoiseGenerator(1);
    const b = new PinkNoiseGenerator(1);
    expect(a.next()).toBe(b.next());
  });
});

describe("BrownNoiseGenerator", () => {
  it("produces values in range", () => {
    const g = new BrownNoiseGenerator(1);
    for (let i = 0; i < 50; i++) {
      const v = g.next();
      expect(v).toBeGreaterThanOrEqual(-1.5);
      expect(v).toBeLessThanOrEqual(1.5);
    }
  });
});

describe("generateNoise", () => {
  it("white noise has expected length", () => {
    const s = generateNoise({ ...DEFAULT_PARAMS, duration: 0.1, sampleRate: 8000 });
    expect(s.length).toBe(800);
  });
  it("pink noise has expected length", () => {
    const s = generateNoise({ ...DEFAULT_PARAMS, type: "pink", duration: 0.1, sampleRate: 8000 });
    expect(s.length).toBe(800);
  });
  it("brown noise has expected length", () => {
    const s = generateNoise({ ...DEFAULT_PARAMS, type: "brown", duration: 0.1, sampleRate: 8000 });
    expect(s.length).toBe(800);
  });
  it("volume 0 produces silence", () => {
    const s = generateNoise({ ...DEFAULT_PARAMS, volume: 0, duration: 0.05 });
    let nonZero = 0;
    for (let i = 0; i < s.length; i++) if (s[i] !== 0) nonZero++;
    expect(nonZero).toBe(0);
  });
});

describe("validateParams", () => {
  it("accepts defaults", () => {
    expect(validateParams(DEFAULT_PARAMS).ok).toBe(true);
  });
  it("rejects bad volume", () => {
    expect(validateParams({ ...DEFAULT_PARAMS, volume: 2 }).ok).toBe(false);
  });
  it("rejects bad duration", () => {
    expect(validateParams({ ...DEFAULT_PARAMS, duration: -1 }).ok).toBe(false);
  });
  it("rejects low sample rate", () => {
    expect(validateParams({ ...DEFAULT_PARAMS, sampleRate: 4000 }).ok).toBe(false);
  });
});

describe("amplitude helpers", () => {
  it("peakAmplitude", () => {
    expect(peakAmplitude(new Float32Array([0.1, -0.7, 0.3]))).toBe(0.7);
  });
  it("rmsAmplitude", () => {
    expect(rmsAmplitude(new Float32Array([1, -1, 1, -1]))).toBeCloseTo(1, 5);
  });
  it("returns 0 for empty", () => {
    expect(rmsAmplitude(new Float32Array(0))).toBe(0);
  });
});

describe("spectralRolloff & classifyNoise", () => {
  it("returns 0 for empty", () => {
    expect(spectralRolloff(new Float32Array(0), 44100)).toBe(0);
  });
  it("returns a frequency in range", () => {
    const s = generateNoise({ ...DEFAULT_PARAMS, duration: 0.1, sampleRate: 8000 });
    const r = spectralRolloff(s, 8000);
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(4000);
  });
  it("classifies a noise type", () => {
    const c = classifyNoise(3500, 8000);
    expect(["white", "blue", "pink", "brown", "violet"]).toContain(c);
  });
});

describe("formatters", () => {
  it("formatDuration", () => {
    expect(formatDuration(0.5)).toBe("500ms");
    expect(formatDuration(65)).toContain("m");
  });
  it("estimateWavBytes", () => {
    expect(estimateWavBytes(1, 44100)).toBe(88244);
  });
  it("formatBytes", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
});

describe("spectralDescription", () => {
  it("returns slope and description for each type", () => {
    const types = ["white", "pink", "brown", "blue", "violet"] as const;
    for (const t of types) {
      const d = spectralDescription(t);
      expect(d.slope.length).toBeGreaterThan(0);
      expect(d.description.length).toBeGreaterThan(0);
    }
  });
});
