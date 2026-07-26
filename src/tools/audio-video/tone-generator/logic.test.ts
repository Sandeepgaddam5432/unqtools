import { describe, it, expect } from "vitest";
import {
  DEFAULT_PARAMS, FREQ_MIN, FREQ_MAX, validateParams, waveformSample,
  adsrEnvelope, generateTone, frequencyToNote, noteToFrequency, peakAmplitude,
  rmsAmplitude, totalEnergy, formatDuration, estimatePcmBytes, formatBytes,
  generateSweep, noteRange,
} from "./logic";

describe("validateParams", () => {
  it("accepts defaults", () => {
    expect(validateParams(DEFAULT_PARAMS).ok).toBe(true);
  });
  it("rejects frequency too low", () => {
    expect(validateParams({ ...DEFAULT_PARAMS, frequency: 5 }).ok).toBe(false);
  });
  it("rejects frequency too high", () => {
    expect(validateParams({ ...DEFAULT_PARAMS, frequency: 30000 }).ok).toBe(false);
  });
  it("rejects negative volume", () => {
    expect(validateParams({ ...DEFAULT_PARAMS, volume: -0.1 }).ok).toBe(false);
  });
  it("rejects zero duration", () => {
    expect(validateParams({ ...DEFAULT_PARAMS, duration: 0 }).ok).toBe(false);
  });
});

describe("waveformSample", () => {
  it("sine at 0 is 0", () => {
    expect(waveformSample("sine", 0)).toBeCloseTo(0, 5);
  });
  it("sine at 0.25 is 1", () => {
    expect(waveformSample("sine", 0.25)).toBeCloseTo(1, 5);
  });
  it("square alternates", () => {
    expect(waveformSample("square", 0.1)).toBe(1);
    expect(waveformSample("square", 0.6)).toBe(-1);
  });
  it("triangle peaks at 0.25 and -1 at 0.75", () => {
    expect(waveformSample("triangle", 0.25)).toBeCloseTo(1, 5);
    expect(waveformSample("triangle", 0.75)).toBeCloseTo(-1, 5);
  });
  it("sawtooth ramps from -1 to 1", () => {
    expect(waveformSample("sawtooth", 0)).toBe(-1);
    expect(waveformSample("sawtooth", 0.99)).toBeCloseTo(1, 1);
  });
  it("pulse respects width", () => {
    expect(waveformSample("pulse", 0.2, 0.3)).toBe(1);
    expect(waveformSample("pulse", 0.5, 0.3)).toBe(-1);
  });
});

describe("adsrEnvelope", () => {
  it("returns 0 before 0", () => {
    expect(adsrEnvelope(-0.1, 1, 0.1, 0.1, 0.8, 0.1)).toBe(0);
  });
  it("returns 0 after end", () => {
    expect(adsrEnvelope(2, 1, 0.1, 0.1, 0.8, 0.1)).toBe(0);
  });
  it("attack ramps", () => {
    expect(adsrEnvelope(0.05, 1, 0.1, 0.1, 0.8, 0.1)).toBeCloseTo(0.5, 1);
  });
  it("sustain holds", () => {
    expect(adsrEnvelope(0.5, 1, 0.1, 0.1, 0.8, 0.1)).toBeCloseTo(0.8, 1);
  });
});

describe("generateTone", () => {
  it("returns array of expected length", () => {
    const samples = generateTone({ ...DEFAULT_PARAMS, duration: 0.1, sampleRate: 8000 });
    expect(samples.length).toBe(800);
  });
  it("returns empty for invalid params", () => {
    const samples = generateTone({ ...DEFAULT_PARAMS, frequency: 5 });
    expect(samples.length).toBe(0);
  });
  it("volume affects peak amplitude", () => {
    const loud = generateTone({ ...DEFAULT_PARAMS, volume: 1, duration: 0.05 });
    const quiet = generateTone({ ...DEFAULT_PARAMS, volume: 0.1, duration: 0.05 });
    expect(peakAmplitude(loud)).toBeGreaterThan(peakAmplitude(quiet));
  });
});

describe("frequencyToNote & noteToFrequency", () => {
  it("440 Hz → A4", () => {
    const r = frequencyToNote(440);
    expect(r.note).toBe("A");
    expect(r.octave).toBe(4);
    expect(r.cents).toBe(0);
  });
  it("round-trips", () => {
    const f = noteToFrequency("C", 4);
    const back = frequencyToNote(f);
    expect(back.note).toBe("C");
    expect(back.octave).toBe(4);
  });
  it("returns — for invalid", () => {
    expect(frequencyToNote(0).note).toBe("—");
  });
});

describe("amplitude helpers", () => {
  it("peakAmplitude finds max", () => {
    const s = new Float32Array([0.1, -0.5, 0.3]);
    expect(peakAmplitude(s)).toBe(0.5);
  });
  it("rmsAmplitude computes RMS", () => {
    const s = new Float32Array([1, -1, 1, -1]);
    expect(rmsAmplitude(s)).toBeCloseTo(1, 5);
  });
  it("totalEnergy sums squares", () => {
    const s = new Float32Array([1, 1]);
    expect(totalEnergy(s)).toBe(2);
  });
});

describe("formatters", () => {
  it("formatDuration", () => {
    expect(formatDuration(0.5)).toBe("500ms");
    expect(formatDuration(65)).toContain("m");
  });
  it("estimatePcmBytes", () => {
    expect(estimatePcmBytes(1, 44100, 1, 16)).toBe(88200);
  });
  it("formatBytes", () => {
    expect(formatBytes(2048)).toBe("2.0 KB");
  });
});

describe("generateSweep", () => {
  it("returns expected length", () => {
    const s = generateSweep(100, 1000, 0.1, 8000, 0.5);
    expect(s.length).toBe(800);
  });
  it("contains values", () => {
    const s = generateSweep(100, 1000, 0.01, 8000, 0.5);
    let nonZero = 0;
    for (let i = 0; i < s.length; i++) if (s[i] !== 0) nonZero++;
    expect(nonZero).toBeGreaterThan(0);
  });
});

describe("noteRange", () => {
  it("returns 24 notes for 2 octaves", () => {
    const r = noteRange(3, 4);
    expect(r.length).toBe(24);
  });
  it("includes A4 = 440", () => {
    const r = noteRange(4, 4);
    const a4 = r.find((n) => n.note === "A" && n.octave === 4);
    expect(a4?.freq).toBeCloseTo(440, 1);
  });
});
