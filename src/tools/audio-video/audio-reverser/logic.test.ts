import { describe, it, expect, beforeEach } from "vitest";
import {
  REVERSE_MODES,
  REVERSE_MODE_LABELS,
  REVERSE_MODE_DESCRIPTIONS,
  SEGMENT_PRESETS,
  DEFAULT_SEGMENTS,
  reverseSamples,
  reverseChannels,
  reverseSegments,
  reverseChannelsSegments,
  computeSegmentBoundaries,
  interleaveChannels,
  deinterleaveChannels,
  reverseInterleaved,
  reverseInterleavedChannels,
  applyFadeIn,
  applyFadeOut,
  msToSamples,
  detectClicks,
  detectClicksMulti,
  computeDuration,
  estimateWavSizeBytes,
  formatBytes,
  formatTime,
  buildWavHeader,
  floatSamplesTo16BitPCM,
  encodeWav,
  generateFilename,
  loadHistory,
  saveHistory,
  clearHistory,
  computeSummaryStats,
  buildShareUrl,
  parseShareUrl,
  type ReverseMode,
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

describe("audio-reverser modes & constants", () => {
  it("has 4 reverse modes", () => {
    expect(REVERSE_MODES).toHaveLength(4);
    expect(REVERSE_MODES).toEqual(["full", "per-channel", "segment", "interleaved"]);
  });
  it("has 4 mode labels", () => {
    expect(Object.keys(REVERSE_MODE_LABELS)).toHaveLength(4);
    expect(REVERSE_MODE_LABELS["full"]).toContain("entire buffer");
  });
  it("has 4 mode descriptions", () => {
    expect(Object.keys(REVERSE_MODE_DESCRIPTIONS)).toHaveLength(4);
    expect(REVERSE_MODE_DESCRIPTIONS["segment"].toLowerCase()).toContain("split");
  });
  it("has 5 segment presets", () => {
    expect(SEGMENT_PRESETS).toEqual([1, 2, 4, 8, 16]);
  });
  it("default segments is 1", () => {
    expect(DEFAULT_SEGMENTS).toBe(1);
  });
});

describe("audio-reverser reverseSamples", () => {
  it("reverses a Float32Array", () => {
    const out = reverseSamples(new Float32Array([1, 2, 3, 4]));
    expect(Array.from(out)).toEqual([4, 3, 2, 1]);
  });
  it("returns a new array (does not mutate input)", () => {
    const src = new Float32Array([1, 2, 3]);
    const snapshot = Array.from(src);
    const out = reverseSamples(src);
    expect(Array.from(src)).toEqual(snapshot);
    expect(out).not.toBe(src);
  });
  it("handles empty input", () => {
    expect(reverseSamples(new Float32Array(0))).toHaveLength(0);
  });
  it("handles single element", () => {
    expect(Array.from(reverseSamples(new Float32Array([42])))).toEqual([42]);
  });
});

describe("audio-reverser reverseChannels", () => {
  it("reverses each channel", () => {
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array([4, 5, 6]);
    const out = reverseChannels([a, b]);
    expect(out).toHaveLength(2);
    expect(Array.from(out[0])).toEqual([3, 2, 1]);
    expect(Array.from(out[1])).toEqual([6, 5, 4]);
  });
  it("does not mutate input", () => {
    const a = new Float32Array([1, 2, 3]);
    const snapshot = Array.from(a);
    reverseChannels([a]);
    expect(Array.from(a)).toEqual(snapshot);
  });
  it("handles empty input", () => {
    expect(reverseChannels([])).toEqual([]);
  });
});

describe("audio-reverser reverseSegments", () => {
  it("with 1 segment is equivalent to full reverse", () => {
    const src = new Float32Array([1, 2, 3, 4, 5]);
    const out = reverseSegments(src, 1);
    expect(Array.from(out)).toEqual([5, 4, 3, 2, 1]);
  });
  it("with 2 segments reverses each half", () => {
    // [1, 2, 3, 4] split into 2 segments of 2 each
    // segment 0: [1, 2] reversed → [2, 1]
    // segment 1: [3, 4] reversed → [4, 3]
    // output: [2, 1, 4, 3]
    const out = reverseSegments(new Float32Array([1, 2, 3, 4]), 2);
    expect(Array.from(out)).toEqual([2, 1, 4, 3]);
  });
  it("with 4 segments reverses each quarter", () => {
    // [1, 2, 3, 4] split into 4 segments of 1 each
    // each segment reversed = itself
    const out = reverseSegments(new Float32Array([1, 2, 3, 4]), 4);
    expect(Array.from(out)).toEqual([1, 2, 3, 4]);
  });
  it("last segment absorbs remainder when length not divisible", () => {
    // [1, 2, 3, 4, 5] split into 2 segments: first 2, last 3
    // segment 0: [1, 2] reversed → [2, 1]
    // segment 1: [3, 4, 5] reversed → [5, 4, 3]
    // output: [2, 1, 5, 4, 3]
    const out = reverseSegments(new Float32Array([1, 2, 3, 4, 5]), 2);
    expect(Array.from(out)).toEqual([2, 1, 5, 4, 3]);
  });
  it("returns empty for empty input", () => {
    expect(reverseSegments(new Float32Array(0), 4)).toHaveLength(0);
  });
  it("treats segment count < 1 as 1", () => {
    const out = reverseSegments(new Float32Array([1, 2, 3]), 0);
    expect(Array.from(out)).toEqual([3, 2, 1]);
  });
});

describe("audio-reverser reverseChannelsSegments", () => {
  it("reverses segments per channel", () => {
    const a = new Float32Array([1, 2, 3, 4]);
    const b = new Float32Array([5, 6, 7, 8]);
    const out = reverseChannelsSegments([a, b], 2);
    expect(out).toHaveLength(2);
    expect(Array.from(out[0])).toEqual([2, 1, 4, 3]);
    expect(Array.from(out[1])).toEqual([6, 5, 8, 7]);
  });
});

describe("audio-reverser computeSegmentBoundaries", () => {
  it("returns [0, N] for 1 segment", () => {
    expect(computeSegmentBoundaries(100, 1)).toEqual([0, 100]);
  });
  it("returns 3 boundaries for 2 segments", () => {
    expect(computeSegmentBoundaries(100, 2)).toEqual([0, 50, 100]);
  });
  it("returns 5 boundaries for 4 segments", () => {
    expect(computeSegmentBoundaries(100, 4)).toEqual([0, 25, 50, 75, 100]);
  });
  it("returns [] for 0 samples", () => {
    expect(computeSegmentBoundaries(0, 4)).toEqual([]);
  });
  it("treats segmentCount < 1 as 1", () => {
    expect(computeSegmentBoundaries(100, 0)).toEqual([0, 100]);
  });
});

describe("audio-reverser interleaveChannels & deinterleaveChannels", () => {
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
  it("deinterleaves 2 channels", () => {
    const interleaved = new Float32Array([1, 4, 2, 5, 3, 6]);
    const out = deinterleaveChannels(interleaved, 2);
    expect(out).toHaveLength(2);
    expect(Array.from(out[0])).toEqual([1, 2, 3]);
    expect(Array.from(out[1])).toEqual([4, 5, 6]);
  });
  it("deinterleave with 0 channels returns []", () => {
    expect(deinterleaveChannels(new Float32Array([1, 2, 3]), 0)).toEqual([]);
  });
  it("interleave then deinterleave round-trips", () => {
    const a = new Float32Array([1, 2, 3, 4]);
    const b = new Float32Array([5, 6, 7, 8]);
    const interleaved = interleaveChannels([a, b]);
    const back = deinterleaveChannels(interleaved, 2);
    expect(Array.from(back[0])).toEqual([1, 2, 3, 4]);
    expect(Array.from(back[1])).toEqual([5, 6, 7, 8]);
  });
});

describe("audio-reverser reverseInterleaved", () => {
  it("reverses mono (same as reverseSamples)", () => {
    const src = new Float32Array([1, 2, 3, 4]);
    const out = reverseInterleaved(src, 1);
    expect(Array.from(out)).toEqual([4, 3, 2, 1]);
  });
  it("reverses stereo frames preserving L/R within each frame", () => {
    // Input: frames [1,4], [2,5], [3,6] (L=1,2,3; R=4,5,6)
    // Reversed frames: [3,6], [2,5], [1,4]
    // Output interleaved: [3, 6, 2, 5, 1, 4]
    const src = new Float32Array([1, 4, 2, 5, 3, 6]);
    const out = reverseInterleaved(src, 2);
    expect(Array.from(out)).toEqual([3, 6, 2, 5, 1, 4]);
  });
  it("preserves leftover samples when length not divisible by channelCount", () => {
    // 5 samples with 2 channels → 2 frames + 1 leftover
    const src = new Float32Array([1, 4, 2, 5, 99]);
    const out = reverseInterleaved(src, 2);
    // 2 frames: [1,4],[2,5] reversed → [2,5],[1,4]
    // leftover 99 copied verbatim
    expect(Array.from(out)).toEqual([2, 5, 1, 4, 99]);
  });
  it("handles channelCount = 1 via fast path", () => {
    const src = new Float32Array([1, 2, 3]);
    const out = reverseInterleaved(src, 1);
    expect(Array.from(out)).toEqual([3, 2, 1]);
  });
});

describe("audio-reverser reverseInterleavedChannels", () => {
  it("reverses interleaved stereo and returns per-channel arrays", () => {
    // Input: L=[1,2,3], R=[4,5,6]
    // Interleaved: [1,4,2,5,3,6]
    // Reversed interleaved: [3,6,2,5,1,4]
    // De-interleaved: L=[3,2,1], R=[6,5,4]
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array([4, 5, 6]);
    const out = reverseInterleavedChannels([a, b]);
    expect(out).toHaveLength(2);
    expect(Array.from(out[0])).toEqual([3, 2, 1]);
    expect(Array.from(out[1])).toEqual([6, 5, 4]);
  });
  it("returns [] for empty input", () => {
    expect(reverseInterleavedChannels([])).toEqual([]);
  });
});

describe("audio-reverser fade in/out", () => {
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
    expect(msToSamples(5, 44100)).toBe(221); // 5 ms × 44.1 = 220.5 → 221
  });
});

describe("audio-reverser detectClicks", () => {
  it("returns no clicks when all boundary samples are silent", () => {
    const samples = new Float32Array([0, 0.5, -0.3, 0]);
    const result = detectClicks(samples, [0, 3]);
    expect(result.hasClicks).toBe(false);
    expect(result.clickCount).toBe(0);
  });
  it("detects a click when boundary sample exceeds threshold", () => {
    const samples = new Float32Array([0.8, 0.1, 0.2, 0.9]);
    const result = detectClicks(samples, [0, 3]);
    expect(result.hasClicks).toBe(true);
    expect(result.clickCount).toBe(2);
  });
  it("respects custom threshold", () => {
    const samples = new Float32Array([0.1, 0.5, 0.1]);
    // Default threshold 0.05 → 0.1 > 0.05 → click
    expect(detectClicks(samples, [0]).clickCount).toBe(1);
    // Threshold 0.5 → 0.1 < 0.5 → no click
    expect(detectClicks(samples, [0], 0.5).clickCount).toBe(0);
  });
  it("ignores out-of-range boundary indices", () => {
    const samples = new Float32Array([0.5, 0.1, 0.2]);
    const result = detectClicks(samples, [-1, 0, 5, 10]);
    expect(result.clickCount).toBe(1); // only index 0 counts
  });
  it("tracks max amplitude", () => {
    const samples = new Float32Array([0.3, 0.7, 0.4, 0.2]);
    const result = detectClicks(samples, [0, 1]);
    expect(result.maxAmplitude).toBeCloseTo(0.7, 5);
  });
});

describe("audio-reverser detectClicksMulti", () => {
  it("analyzes boundaries across multiple channels", () => {
    const a = new Float32Array([0.1, 0.5, 0.1]);
    const b = new Float32Array([0.6, 0.2, 0.1]);
    const result = detectClicksMulti([a, b], [0]);
    expect(result.clickCount).toBe(1);
    expect(result.maxAmplitude).toBeCloseTo(0.6, 5);
  });
  it("returns no clicks when all channels are silent at boundaries", () => {
    const a = new Float32Array([0, 0.5, 0]);
    const b = new Float32Array([0, 0.3, 0]);
    const result = detectClicksMulti([a, b], [0, 2]);
    expect(result.hasClicks).toBe(false);
  });
});

describe("audio-reverser computeDuration & estimateWavSizeBytes", () => {
  it("computeDuration returns input unchanged", () => {
    expect(computeDuration(10.5)).toBe(10.5);
    expect(computeDuration(0)).toBe(0);
  });
  it("estimateWavSizeBytes = 44 + samples × channels × 2", () => {
    expect(estimateWavSizeBytes(1000, 2)).toBe(44 + 1000 * 2 * 2);
  });
  it("handles single channel", () => {
    expect(estimateWavSizeBytes(1000, 1)).toBe(44 + 2000);
  });
  it("handles 0 samples", () => {
    expect(estimateWavSizeBytes(0, 2)).toBe(44);
  });
});

describe("audio-reverser formatBytes & formatTime", () => {
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

describe("audio-reverser buildWavHeader", () => {
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

describe("audio-reverser floatSamplesTo16BitPCM", () => {
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

describe("audio-reverser encodeWav (integration)", () => {
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

describe("audio-reverser generateFilename", () => {
  it("generates filename for full mode", () => {
    const date = new Date(2024, 0, 5, 14, 23, 7);
    const name = generateFilename("full", 1, date);
    expect(name).toContain("reversed-full-");
    expect(name).toContain("2024-01-05");
    expect(name).toContain("142307");
    expect(name.endsWith(".wav")).toBe(true);
  });
  it("includes segment count for segment mode with >1 segments", () => {
    const date = new Date(2024, 0, 5, 14, 23, 7);
    const name = generateFilename("segment", 4, date);
    expect(name).toContain("reversed-segment-4-");
  });
  it("omits segment count for segment mode with 1 segment", () => {
    const name = generateFilename("segment", 1);
    expect(name).toContain("reversed-segment-");
    expect(name).not.toContain("segment-1-");
  });
  it("handles per-channel mode", () => {
    const name = generateFilename("per-channel", 1);
    expect(name).toContain("reversed-per-channel-");
  });
  it("handles interleaved mode", () => {
    const name = generateFilename("interleaved", 1);
    expect(name).toContain("reversed-interleaved-");
  });
});

describe("audio-reverser history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    const entry: HistoryEntry = {
      ts: 1,
      originalName: "voice.mp3",
      durationMs: 10_000,
      mode: "full",
      segments: 1,
      channels: 1,
      sampleRate: 44100,
      outputSizeBytes: 80_000,
      clickCount: 0,
      appliedFadeMs: 5,
    };
    saveHistory(entry);
    const history = loadHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toEqual(entry);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, originalName: `f-${i}.mp3`, durationMs: 1,
        mode: "full", segments: 1, channels: 1, sampleRate: 44100,
        outputSizeBytes: 1, clickCount: 0, appliedFadeMs: 0,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("orders most-recent first", () => {
    saveHistory({
      ts: 1, originalName: "a", durationMs: 1,
      mode: "full", segments: 1, channels: 1, sampleRate: 44100,
      outputSizeBytes: 1, clickCount: 0, appliedFadeMs: 0,
    });
    saveHistory({
      ts: 2, originalName: "b", durationMs: 1,
      mode: "full", segments: 1, channels: 1, sampleRate: 44100,
      outputSizeBytes: 1, clickCount: 0, appliedFadeMs: 0,
    });
    const history = loadHistory();
    expect(history[0].ts).toBe(2);
    expect(history[1].ts).toBe(1);
  });
  it("clears history", () => {
    saveHistory({
      ts: 1, originalName: "x", durationMs: 1,
      mode: "full", segments: 1, channels: 1, sampleRate: 44100,
      outputSizeBytes: 1, clickCount: 0, appliedFadeMs: 0,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("audio-reverser computeSummaryStats", () => {
  it("computes stats for typical reverse", () => {
    const stats = computeSummaryStats(10, 2, 44100, 1, 100_000, 100_044, "full", 0, 5);
    expect(stats.durationSeconds).toBe(10);
    expect(stats.channels).toBe(2);
    expect(stats.sampleRate).toBe(44100);
    expect(stats.segmentCount).toBe(1);
    expect(stats.inputSizeBytes).toBe(100_000);
    expect(stats.outputSizeBytes).toBe(100_044);
    expect(stats.mode).toBe("full");
    expect(stats.clickCount).toBe(0);
    expect(stats.appliedFadeMs).toBe(5);
  });
  it("passes through segment mode and count", () => {
    const stats = computeSummaryStats(20, 1, 48000, 4, 200_000, 200_044, "segment", 2, 10);
    expect(stats.mode).toBe("segment");
    expect(stats.segmentCount).toBe(4);
    expect(stats.clickCount).toBe(2);
  });
});

describe("audio-reverser shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ mode: "segment", segments: 4, applyFade: true, fadeMs: 5 });
    expect(url).toContain("mode=segment");
    expect(url).toContain("segs=4");
    expect(url).toContain("fade=1");
    expect(url).toContain("fadems=5");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("builds share URL without segs for non-segment mode", () => {
    const url = buildShareUrl({ mode: "full", segments: 1, applyFade: false, fadeMs: 0 });
    expect(url).toContain("mode=full");
    expect(url).toContain("fade=0");
    expect(url).not.toContain("segs=");
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("mode=segment&segs=8&fade=1&fadems=10");
    expect(p.mode).toBe("segment");
    expect(p.segments).toBe(8);
    expect(p.applyFade).toBe(true);
    expect(p.fadeMs).toBe(10);
  });
  it("parses share URL for full mode", () => {
    const p = parseShareUrl("mode=full&fade=0");
    expect(p.mode).toBe("full");
    expect(p.applyFade).toBe(false);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown modes", () => {
    const p = parseShareUrl("mode=unknown-mode&fade=1");
    expect(p.mode).toBeUndefined();
  });
  it("strips leading # from hash", () => {
    const p = parseShareUrl("#mode=per-channel&fade=1&fadems=2");
    expect(p.mode).toBe("per-channel");
    expect(p.applyFade).toBe(true);
    expect(p.fadeMs).toBe(2);
  });
  it("handles missing fields gracefully", () => {
    const p = parseShareUrl("mode=interleaved");
    expect(p.mode).toBe("interleaved");
    expect(p.segments).toBeUndefined();
    expect(p.applyFade).toBeUndefined();
  });
});

// Suppress unused-import lint
export type _Unused = ReverseMode;
