import { describe, it, expect, beforeEach } from "vitest";
import {
  SPEED_PRESETS,
  SPEED_PRESET_VALUES,
  SPEED_PRESET_LABELS,
  MIN_SPEED,
  MAX_SPEED,
  validateSpeed,
  parseSpeed,
  computeNewDuration,
  computeDurationDelta,
  computePitchShiftSemitones,
  formatSemitones,
  semitonesToRatio,
  resampleLinear,
  resampleChannelsLinear,
  computeWsolaWindowSize,
  computeWsolaHopSize,
  estimateWavSizeBytes,
  formatBytes,
  formatTime,
  buildWavHeader,
  floatSamplesTo16BitPCM,
  interleaveChannels,
  applyFadeIn,
  applyFadeOut,
  msToSamples,
  encodeWav,
  generateFilename,
  loadHistory,
  saveHistory,
  clearHistory,
  computeSummaryStats,
  buildShareUrl,
  parseShareUrl,
  type SpeedPreset,
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

describe("audio-speed-changer presets & constants", () => {
  it("has 7 speed presets", () => {
    expect(SPEED_PRESETS).toHaveLength(7);
    expect(SPEED_PRESETS).toEqual(["0.5", "0.75", "1.0", "1.25", "1.5", "1.75", "2.0"]);
  });
  it("has 7 preset values", () => {
    expect(Object.keys(SPEED_PRESET_VALUES)).toHaveLength(7);
    expect(SPEED_PRESET_VALUES["0.5"]).toBe(0.5);
    expect(SPEED_PRESET_VALUES["2.0"]).toBe(2.0);
    expect(SPEED_PRESET_VALUES["1.25"]).toBe(1.25);
  });
  it("has 7 preset labels", () => {
    expect(Object.keys(SPEED_PRESET_LABELS)).toHaveLength(7);
    expect(SPEED_PRESET_LABELS["1.0"]).toContain("original");
  });
  it("exposes MIN_SPEED and MAX_SPEED", () => {
    expect(MIN_SPEED).toBe(0.25);
    expect(MAX_SPEED).toBe(4.0);
  });
});

describe("audio-speed-changer validateSpeed", () => {
  it("accepts 1.0", () => {
    expect(validateSpeed(1.0).ok).toBe(true);
  });
  it("accepts the min 0.25", () => {
    expect(validateSpeed(0.25).ok).toBe(true);
  });
  it("accepts the max 4.0", () => {
    expect(validateSpeed(4.0).ok).toBe(true);
  });
  it("rejects below min", () => {
    const r = validateSpeed(0.1);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("at least");
  });
  it("rejects above max", () => {
    const r = validateSpeed(5.0);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("at most");
  });
  it("rejects NaN", () => {
    const r = validateSpeed(Number.NaN);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("valid number");
  });
  it("rejects Infinity", () => {
    const r = validateSpeed(Number.POSITIVE_INFINITY);
    expect(r.ok).toBe(false);
  });
  it("rejects zero via positive check", () => {
    // 0 < MIN_SPEED so the min check catches it
    const r = validateSpeed(0);
    expect(r.ok).toBe(false);
  });
  it("rejects negative", () => {
    const r = validateSpeed(-1.0);
    expect(r.ok).toBe(false);
  });
});

describe("audio-speed-changer parseSpeed", () => {
  it("parses plain decimal", () => {
    expect(parseSpeed("1.5")).toBe(1.5);
  });
  it("parses with trailing x", () => {
    expect(parseSpeed("2.0x")).toBe(2.0);
  });
  it("parses with trailing X (uppercase)", () => {
    expect(parseSpeed("1.25X")).toBe(1.25);
  });
  it("parses percentage as ratio", () => {
    expect(parseSpeed("150%")).toBe(1.5);
    expect(parseSpeed("50%")).toBe(0.5);
  });
  it("trims whitespace", () => {
    expect(parseSpeed("  1.5  ")).toBe(1.5);
  });
  it("returns NaN for empty", () => {
    expect(Number.isNaN(parseSpeed(""))).toBe(true);
  });
  it("returns NaN for garbage", () => {
    expect(Number.isNaN(parseSpeed("fast"))).toBe(true);
  });
  it("handles non-string input", () => {
    expect(Number.isNaN(parseSpeed(null as unknown as string))).toBe(true);
  });
});

describe("audio-speed-changer duration calculators", () => {
  it("computeNewDuration halves duration at 2× speed", () => {
    expect(computeNewDuration(10, 2.0)).toBe(5);
  });
  it("computeNewDuration doubles duration at 0.5× speed", () => {
    expect(computeNewDuration(10, 0.5)).toBe(20);
  });
  it("computeNewDuration preserves duration at 1× speed", () => {
    expect(computeNewDuration(7.5, 1.0)).toBe(7.5);
  });
  it("returns 0 for non-positive speed", () => {
    expect(computeNewDuration(10, 0)).toBe(0);
    expect(computeNewDuration(10, -1)).toBe(0);
  });
  it("computeDurationDelta is positive when slowing down", () => {
    // Wait — slowing down (0.5×) makes the OUTPUT longer, so delta should be NEGATIVE
    // (delta = original - new = 10 - 20 = -10). Test it accurately.
    const delta = computeDurationDelta(10, 0.5);
    expect(delta).toBe(-10);
  });
  it("computeDurationDelta is positive when speeding up", () => {
    expect(computeDurationDelta(10, 2.0)).toBe(5);
  });
  it("computeDurationDelta is zero at 1×", () => {
    expect(computeDurationDelta(10, 1.0)).toBe(0);
  });
});

describe("audio-speed-changer pitch-shift calculator", () => {
  it("returns 0 semitones at 1× speed", () => {
    expect(computePitchShiftSemitones(1.0)).toBe(0);
  });
  it("returns +12 semitones at 2× speed (one octave up)", () => {
    expect(computePitchShiftSemitones(2.0)).toBeCloseTo(12, 5);
  });
  it("returns -12 semitones at 0.5× speed (one octave down)", () => {
    expect(computePitchShiftSemitones(0.5)).toBeCloseTo(-12, 5);
  });
  it("returns +7 semitones approx at 1.5× speed (perfect fifth up)", () => {
    // 12 * log2(1.5) = 12 * 0.5850 ≈ 7.0196
    expect(computePitchShiftSemitones(1.5)).toBeCloseTo(7.02, 1);
  });
  it("returns 0 for invalid speed", () => {
    expect(computePitchShiftSemitones(0)).toBe(0);
    expect(computePitchShiftSemitones(-1)).toBe(0);
    expect(computePitchShiftSemitones(Number.NaN)).toBe(0);
  });
  it("semitonesToRatio inverts computePitchShiftSemitones", () => {
    const semis = computePitchShiftSemitones(1.5);
    const ratio = semitonesToRatio(semis);
    expect(ratio).toBeCloseTo(1.5, 5);
  });
  it("formatSemitones handles positive, negative, and NaN", () => {
    expect(formatSemitones(12)).toBe("+12.00 st");
    expect(formatSemitones(-7.02)).toBe("-7.02 st");
    expect(formatSemitones(0)).toBe("0.00 st");
    expect(formatSemitones(Number.NaN)).toBe("0.00 st");
  });
});

describe("audio-speed-changer resampleLinear", () => {
  it("returns empty for empty input", () => {
    expect(resampleLinear(new Float32Array(0), 2.0)).toHaveLength(0);
  });
  it("returns a copy at 1× speed", () => {
    const src = new Float32Array([1, 2, 3, 4]);
    const out = resampleLinear(src, 1.0);
    expect(Array.from(out)).toEqual([1, 2, 3, 4]);
    expect(out).not.toBe(src); // different reference (copy)
  });
  it("halves sample count at 2× speed", () => {
    const src = new Float32Array([0, 10, 20, 30]);
    const out = resampleLinear(src, 2.0);
    expect(out).toHaveLength(2);
    // i=0: srcPos=0, sample = src[0] = 0
    expect(out[0]).toBe(0);
    // i=1: srcPos=2, sample = src[2] = 20
    expect(out[1]).toBe(20);
  });
  it("doubles sample count at 0.5× speed", () => {
    const src = new Float32Array([0, 4]);
    const out = resampleLinear(src, 0.5);
    expect(out).toHaveLength(4);
    // i=0: srcPos=0, sample = src[0] = 0
    expect(out[0]).toBe(0);
    // i=1: srcPos=0.5, sample = 0.5*src[0] + 0.5*src[1] = 0 + 2 = 2
    expect(out[1]).toBeCloseTo(2, 5);
    // i=2: srcPos=1.0, sample = src[1] = 4
    expect(out[2]).toBe(4);
    // i=3: srcPos=1.5, sample = src[1] = 4 (i1 clamped to length-1=1)
    expect(out[3]).toBe(4);
  });
  it("interpolates linearly between samples", () => {
    const src = new Float32Array([0, 100]);
    const out = resampleLinear(src, 0.5); // output length = 4
    // i=0: srcPos=0 → src[0]=0
    expect(out[0]).toBeCloseTo(0, 5);
    // i=1: srcPos=0.5 → 0.5*src[0] + 0.5*src[1] = 50
    expect(out[1]).toBeCloseTo(50, 5);
    // i=2: srcPos=1.0 → src[1]=100
    expect(out[2]).toBeCloseTo(100, 5);
  });
  it("returns empty for invalid speed", () => {
    expect(resampleLinear(new Float32Array([1, 2, 3]), 0)).toHaveLength(0);
    expect(resampleLinear(new Float32Array([1, 2, 3]), Number.NaN)).toHaveLength(0);
  });
  it("resampleChannelsLinear maps over channels", () => {
    const a = new Float32Array([0, 4]);
    const b = new Float32Array([0, 8]);
    const out = resampleChannelsLinear([a, b], 0.5);
    expect(out).toHaveLength(2);
    expect(out[0]).toHaveLength(4);
    expect(out[1]).toHaveLength(4);
  });
});

describe("audio-speed-changer WSOLA helpers", () => {
  it("computeWsolaWindowSize returns power of two", () => {
    const w = computeWsolaWindowSize(44100, 1.5);
    expect(w).toBeGreaterThan(0);
    expect(Math.log2(w) % 1).toBe(0); // power of two
  });
  it("computeWsolaWindowSize clamps to [256, 8192]", () => {
    expect(computeWsolaWindowSize(8000, 1.0)).toBeGreaterThanOrEqual(256);
    expect(computeWsolaWindowSize(192000, 1.0)).toBeLessThanOrEqual(8192);
  });
  it("computeWsolaWindowSize returns 1024 for invalid input", () => {
    expect(computeWsolaWindowSize(0, 1.0)).toBe(1024);
    expect(computeWsolaWindowSize(44100, 0)).toBe(1024);
  });
  it("computeWsolaHopSize is half the window", () => {
    expect(computeWsolaHopSize(1024)).toBe(512);
    expect(computeWsolaHopSize(2048)).toBe(1024);
  });
  it("computeWsolaHopSize returns at least 1", () => {
    expect(computeWsolaHopSize(0)).toBe(1);
  });
});

describe("audio-speed-changer estimateWavSizeBytes", () => {
  it("estimates size = 44 + (N/speed) * channels * 2", () => {
    // 44100 samples, 1 channel, 2× speed → 22050 samples × 1 × 2 = 44100 bytes + 44
    expect(estimateWavSizeBytes(44100, 1, 2.0)).toBe(44 + 22050 * 2);
  });
  it("handles 0.5× speed (doubles samples)", () => {
    expect(estimateWavSizeBytes(1000, 1, 0.5)).toBe(44 + 2000 * 2);
  });
  it("handles 1× speed (no change)", () => {
    expect(estimateWavSizeBytes(1000, 2, 1.0)).toBe(44 + 1000 * 2 * 2);
  });
  it("returns just header for invalid speed", () => {
    expect(estimateWavSizeBytes(1000, 1, 0)).toBe(44);
    expect(estimateWavSizeBytes(1000, 1, -1)).toBe(44);
  });
  it("returns just header for 0 samples", () => {
    expect(estimateWavSizeBytes(0, 2, 2.0)).toBe(44);
  });
});

describe("audio-speed-changer formatBytes & formatTime", () => {
  it("formats 0 bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });
  it("formats KB", () => {
    expect(formatBytes(2048)).toBe("2.00 KB");
  });
  it("formats MB", () => {
    expect(formatBytes(1_500_000)).toBe("1.43 MB");
  });
  it("formatTime formats 90 seconds", () => {
    expect(formatTime(90)).toBe("01:30.000");
  });
  it("formatTime formats 90.25", () => {
    expect(formatTime(90.25)).toBe("01:30.250");
  });
  it("formatTime clamps negative to zero", () => {
    expect(formatTime(-5)).toBe("00:00.000");
  });
});

describe("audio-speed-changer buildWavHeader", () => {
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
  it("encodes sample rate correctly", () => {
    const h = buildWavHeader(1000, 44100, 2);
    const v = new DataView(h.buffer);
    expect(v.getUint32(24, true)).toBe(44100);
  });
  it("encodes channels correctly", () => {
    const h = buildWavHeader(1000, 44100, 2);
    const v = new DataView(h.buffer);
    expect(v.getUint16(22, true)).toBe(2);
  });
  it("encodes file size = 36 + dataLength", () => {
    const h = buildWavHeader(1000, 44100, 2);
    const v = new DataView(h.buffer);
    expect(v.getUint32(4, true)).toBe(1036);
  });
});

describe("audio-speed-changer floatSamplesTo16BitPCM", () => {
  it("returns 2 bytes per sample", () => {
    expect(floatSamplesTo16BitPCM(new Float32Array([0, 1, -1]))).toHaveLength(6);
  });
  it("encodes 0 as 0", () => {
    const pcm = floatSamplesTo16BitPCM(new Float32Array([0]));
    expect(new DataView(pcm.buffer).getInt16(0, true)).toBe(0);
  });
  it("encodes 1 as 32767", () => {
    const pcm = floatSamplesTo16BitPCM(new Float32Array([1]));
    expect(new DataView(pcm.buffer).getInt16(0, true)).toBe(32767);
  });
  it("encodes -1 as -32767", () => {
    const pcm = floatSamplesTo16BitPCM(new Float32Array([-1]));
    expect(new DataView(pcm.buffer).getInt16(0, true)).toBe(-32767);
  });
  it("clamps above 1", () => {
    const pcm = floatSamplesTo16BitPCM(new Float32Array([2]));
    expect(new DataView(pcm.buffer).getInt16(0, true)).toBe(32767);
  });
  it("clamps below -1", () => {
    const pcm = floatSamplesTo16BitPCM(new Float32Array([-2]));
    expect(new DataView(pcm.buffer).getInt16(0, true)).toBe(-32767);
  });
});

describe("audio-speed-changer interleaveChannels", () => {
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

describe("audio-speed-changer fade in/out", () => {
  it("applyFadeIn scales first N samples linearly", () => {
    const s = new Float32Array([1, 1, 1, 1]);
    applyFadeIn(s, 4);
    expect(s[0]).toBeCloseTo(0, 5);
    expect(s[1]).toBeCloseTo(0.25, 5);
    expect(s[2]).toBeCloseTo(0.5, 5);
    expect(s[3]).toBeCloseTo(0.75, 5);
  });
  it("applyFadeOut scales last N samples linearly", () => {
    const s = new Float32Array([1, 1, 1, 1]);
    applyFadeOut(s, 4);
    expect(s[3]).toBeCloseTo(0, 5);
    expect(s[2]).toBeCloseTo(0.25, 5);
    expect(s[1]).toBeCloseTo(0.5, 5);
    expect(s[0]).toBeCloseTo(0.75, 5);
  });
  it("applyFadeIn clamps to array length", () => {
    const s = new Float32Array([1, 1, 1]);
    applyFadeIn(s, 10);
    expect(s[2]).toBeCloseTo(2 / 3, 5);
  });
  it("applyFadeIn handles 0 fade samples", () => {
    const s = new Float32Array([1, 1, 1]);
    applyFadeIn(s, 0);
    expect(Array.from(s)).toEqual([1, 1, 1]);
  });
  it("msToSamples converts ms to sample count", () => {
    expect(msToSamples(1000, 44100)).toBe(44100);
    expect(msToSamples(100, 44100)).toBe(4410);
    expect(msToSamples(0, 44100)).toBe(0);
  });
});

describe("audio-speed-changer encodeWav (integration)", () => {
  it("encodes single-channel samples to valid WAV", () => {
    const samples = new Float32Array(44100);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin(2 * Math.PI * 440 * i / 44100) * 0.5;
    }
    const wav = encodeWav([samples], 44100, 0, 0);
    expect(wav.length).toBe(44 + 44100 * 2);
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe("RIFF");
    expect(String.fromCharCode(...wav.slice(8, 12))).toBe("WAVE");
    const view = new DataView(wav.buffer);
    expect(view.getUint32(40, true)).toBe(44100 * 2);
  });
  it("applies fade in/out without changing length", () => {
    const samples = new Float32Array(1000);
    samples.fill(1);
    const noFade = encodeWav([samples], 44100, 0, 0);
    const withFade = encodeWav([samples], 44100, 100, 100);
    expect(noFade.length).toBe(withFade.length);
  });
  it("encodes 2 channels with correct byte count", () => {
    const a = new Float32Array(100);
    const b = new Float32Array(100);
    const wav = encodeWav([a, b], 44100, 0, 0);
    expect(wav.length).toBe(44 + 100 * 2 * 2);
  });
  it("handles empty channel array", () => {
    const wav = encodeWav([], 44100, 0, 0);
    expect(wav.length).toBe(44);
  });
  it("does not mutate input samples", () => {
    const samples = new Float32Array([1, 1, 1, 1]);
    const snapshot = Array.from(samples);
    encodeWav([samples], 44100, 2, 2);
    expect(Array.from(samples)).toEqual(snapshot);
  });
});

describe("audio-speed-changer generateFilename", () => {
  it("generates timestamped filename with speed factor", () => {
    const date = new Date(2024, 0, 5, 14, 23, 7);
    const name = generateFilename(1.5, date);
    expect(name).toContain("1.5x");
    expect(name).toContain("2024-01-05");
    expect(name).toContain("142307");
    expect(name.endsWith(".wav")).toBe(true);
  });
  it("handles 1.0× speed", () => {
    const name = generateFilename(1.0);
    expect(name).toContain("1.0x");
  });
  it("handles 2.0× speed", () => {
    const name = generateFilename(2.0);
    expect(name).toContain("2.0x");
  });
  it("handles invalid speed", () => {
    const name = generateFilename(Number.NaN);
    expect(name).toContain("1.0x"); // falls back
  });
});

describe("audio-speed-changer history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    const entry: HistoryEntry = {
      ts: 1,
      originalName: "voice.mp3",
      originalDurationMs: 10_000,
      newDurationMs: 5_000,
      speed: 2.0,
      preservePitch: false,
      pitchShiftSemitones: 12,
      outputSizeBytes: 80_000,
      sampleRate: 44100,
      channels: 1,
    };
    saveHistory(entry);
    const history = loadHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toEqual(entry);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, originalName: `f-${i}.mp3`, originalDurationMs: 1, newDurationMs: 1,
        speed: 1.0, preservePitch: false, pitchShiftSemitones: 0,
        outputSizeBytes: 1, sampleRate: 44100, channels: 1,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("orders most-recent first", () => {
    saveHistory({
      ts: 1, originalName: "a", originalDurationMs: 1, newDurationMs: 1,
      speed: 1.0, preservePitch: false, pitchShiftSemitones: 0,
      outputSizeBytes: 1, sampleRate: 44100, channels: 1,
    });
    saveHistory({
      ts: 2, originalName: "b", originalDurationMs: 1, newDurationMs: 1,
      speed: 1.0, preservePitch: false, pitchShiftSemitones: 0,
      outputSizeBytes: 1, sampleRate: 44100, channels: 1,
    });
    const history = loadHistory();
    expect(history[0].ts).toBe(2);
    expect(history[1].ts).toBe(1);
  });
  it("clears history", () => {
    saveHistory({
      ts: 1, originalName: "x", originalDurationMs: 1, newDurationMs: 1,
      speed: 1.0, preservePitch: false, pitchShiftSemitones: 0,
      outputSizeBytes: 1, sampleRate: 44100, channels: 1,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("audio-speed-changer computeSummaryStats", () => {
  it("computes stats for 2× speed without pitch preservation", () => {
    const stats = computeSummaryStats(10, 2.0, false, 100_000, 44100, 1);
    expect(stats.originalDurationSeconds).toBe(10);
    expect(stats.newDurationSeconds).toBe(5);
    expect(stats.durationDeltaSeconds).toBe(5);
    expect(stats.speed).toBe(2.0);
    expect(stats.preservePitch).toBe(false);
    expect(stats.pitchShiftSemitones).toBeCloseTo(12, 5);
    expect(stats.outputSizeBytes).toBe(100_000);
  });
  it("computes stats with pitch preservation (no semitone shift)", () => {
    const stats = computeSummaryStats(10, 1.5, true, 200_000, 44100, 2);
    expect(stats.preservePitch).toBe(true);
    expect(stats.pitchShiftSemitones).toBe(0);
    expect(stats.newDurationSeconds).toBeCloseTo(10 / 1.5, 5);
    expect(stats.channels).toBe(2);
  });
  it("handles 1× speed (no change)", () => {
    const stats = computeSummaryStats(10, 1.0, false, 44, 44100, 1);
    expect(stats.newDurationSeconds).toBe(10);
    expect(stats.durationDeltaSeconds).toBe(0);
    expect(stats.pitchShiftSemitones).toBe(0);
  });
});

describe("audio-speed-changer shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ speed: "1.5", preservePitch: true });
    expect(url).toContain("speed=1.5");
    expect(url).toContain("preserve=1");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("speed=2.0&preserve=0");
    expect(p.speed).toBe("2.0");
    expect(p.preservePitch).toBe(false);
  });
  it("parses share URL with preserve=1", () => {
    const p = parseShareUrl("speed=0.75&preserve=1");
    expect(p.speed).toBe("0.75");
    expect(p.preservePitch).toBe(true);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("strips leading # from hash", () => {
    const p = parseShareUrl("#speed=1.25&preserve=0");
    expect(p.speed).toBe("1.25");
    expect(p.preservePitch).toBe(false);
  });
  it("handles missing fields gracefully", () => {
    const p = parseShareUrl("speed=1.5");
    expect(p.speed).toBe("1.5");
    expect(p.preservePitch).toBeUndefined();
  });
  it("handles missing speed", () => {
    const p = parseShareUrl("preserve=1");
    expect(p.speed).toBeUndefined();
    expect(p.preservePitch).toBe(true);
  });
});

// Suppress unused-import lint
export type _Unused = SpeedPreset;
