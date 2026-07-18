import { describe, it, expect, beforeEach } from "vitest";
import {
  GAP_PRESETS_MS,
  GAP_LABELS,
  CROSSFADE_PRESETS_MS,
  CROSSFADE_LABELS,
  formatTime,
  formatTimeHMS,
  formatBytes,
  unifySampleRate,
  unifyChannels,
  resampleLinear,
  upmixChannels,
  generateSilence,
  computeCrossfade,
  applyLinearCrossfade,
  concatenateSegments,
  computeTotalDuration,
  estimateWavSizeBytes,
  buildWavHeader,
  floatSamplesTo16BitPCM,
  interleaveChannels,
  encodeWav,
  generateFilename,
  validateMerge,
  loadHistory,
  saveHistory,
  clearHistory,
  computeSummaryStats,
  buildShareUrl,
  parseShareUrl,
  gapPresetToMs,
  crossfadePresetToMs,
  gapPresetToSamples,
  crossfadePresetToSamples,
  type GapPreset,
  type CrossfadePreset,
  type HistoryEntry,
  type SegmentInfo,
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

describe("audio-merger presets", () => {
  it("has 6 gap presets", () => {
    expect(Object.keys(GAP_PRESETS_MS)).toHaveLength(6);
    expect(GAP_PRESETS_MS["0ms"]).toBe(0);
    expect(GAP_PRESETS_MS["100ms"]).toBe(100);
    expect(GAP_PRESETS_MS["250ms"]).toBe(250);
    expect(GAP_PRESETS_MS["500ms"]).toBe(500);
    expect(GAP_PRESETS_MS["1s"]).toBe(1000);
    expect(GAP_PRESETS_MS["2s"]).toBe(2000);
  });
  it("has 6 gap labels", () => {
    expect(Object.keys(GAP_LABELS)).toHaveLength(6);
    expect(GAP_LABELS["0ms"]).toContain("None");
  });
  it("has 6 crossfade presets", () => {
    expect(Object.keys(CROSSFADE_PRESETS_MS)).toHaveLength(6);
    expect(CROSSFADE_PRESETS_MS["0ms"]).toBe(0);
    expect(CROSSFADE_PRESETS_MS["50ms"]).toBe(50);
    expect(CROSSFADE_PRESETS_MS["100ms"]).toBe(100);
    expect(CROSSFADE_PRESETS_MS["250ms"]).toBe(250);
    expect(CROSSFADE_PRESETS_MS["500ms"]).toBe(500);
    expect(CROSSFADE_PRESETS_MS["1s"]).toBe(1000);
  });
  it("has 6 crossfade labels", () => {
    expect(Object.keys(CROSSFADE_LABELS)).toHaveLength(6);
    expect(CROSSFADE_LABELS["0ms"]).toContain("None");
  });
  it("converts presets to ms and samples", () => {
    expect(gapPresetToMs("250ms")).toBe(250);
    expect(crossfadePresetToMs("100ms")).toBe(100);
    expect(gapPresetToSamples("1s", 44100)).toBe(44100);
    expect(crossfadePresetToSamples("500ms", 48000)).toBe(24000);
  });
});

describe("audio-merger format helpers", () => {
  it("formatTime formats seconds as MM:SS.ms", () => {
    expect(formatTime(0)).toBe("00:00.000");
    expect(formatTime(90)).toBe("01:30.000");
    expect(formatTime(90.25)).toBe("01:30.250");
    expect(formatTime(-5)).toBe("00:00.000");
    expect(formatTime(Number.NaN)).toBe("00:00.000");
  });
  it("formatTimeHMS formats seconds as HH:MM:SS", () => {
    expect(formatTimeHMS(0)).toBe("00:00:00");
    expect(formatTimeHMS(3723)).toBe("01:02:03");
  });
  it("formatBytes formats bytes human-readable", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(2048)).toBe("2.00 KB");
    expect(formatBytes(1_500_000)).toBe("1.43 MB");
  });
});

describe("audio-merger unifySampleRate", () => {
  it("returns max sample rate", () => {
    expect(unifySampleRate([44100, 48000, 22050])).toBe(48000);
  });
  it("returns 0 for empty list", () => {
    expect(unifySampleRate([])).toBe(0);
  });
  it("handles single value", () => {
    expect(unifySampleRate([44100])).toBe(44100);
  });
});

describe("audio-merger unifyChannels", () => {
  it("returns max channel count", () => {
    expect(unifyChannels([1, 2, 1])).toBe(2);
  });
  it("returns 0 for empty list", () => {
    expect(unifyChannels([])).toBe(0);
  });
});

describe("audio-merger resampleLinear", () => {
  it("returns input unchanged when rates match", () => {
    const a = new Float32Array([1, 2, 3, 4]);
    expect(resampleLinear(a, 44100, 44100)).toBe(a);
  });
  it("returns empty for empty input", () => {
    expect(resampleLinear(new Float32Array(0), 44100, 48000).length).toBe(0);
  });
  it("returns empty for invalid rate", () => {
    expect(resampleLinear(new Float32Array([1, 2, 3]), 0, 44100).length).toBe(0);
    expect(resampleLinear(new Float32Array([1, 2, 3]), 44100, 0).length).toBe(0);
  });
  it("upsamples to a longer array (2x)", () => {
    const a = new Float32Array([0, 1]);
    const out = resampleLinear(a, 100, 200);
    expect(out.length).toBe(4);
    // Interpolated: position 0 → src 0 (0), pos 1 → src 0.5 (0.5), pos 2 → src 1 (1), pos 3 → src 1.5 (1)
    expect(out[0]).toBeCloseTo(0, 5);
    expect(out[1]).toBeCloseTo(0.5, 5);
    expect(out[2]).toBeCloseTo(1, 5);
    expect(out[3]).toBeCloseTo(1, 5);
  });
  it("downsamples to a shorter array (0.5x)", () => {
    const a = new Float32Array([0, 1, 2, 3]);
    const out = resampleLinear(a, 200, 100);
    expect(out.length).toBe(2);
    // pos 0 → src 0 (0), pos 1 → src 2 (2)
    expect(out[0]).toBeCloseTo(0, 5);
    expect(out[1]).toBeCloseTo(2, 5);
  });
});

describe("audio-merger upmixChannels", () => {
  it("duplicates last channel to reach target count", () => {
    const a = new Float32Array([1, 2, 3]);
    const out = upmixChannels([a], 2);
    expect(out).toHaveLength(2);
    expect(Array.from(out[0]!)).toEqual([1, 2, 3]);
    expect(Array.from(out[1]!)).toEqual([1, 2, 3]);
  });
  it("returns empty for empty input", () => {
    expect(upmixChannels([], 2)).toEqual([]);
  });
  it("truncates when channels already exceed target", () => {
    const a = new Float32Array([1]);
    const b = new Float32Array([2]);
    const c = new Float32Array([3]);
    const out = upmixChannels([a, b, c], 2);
    expect(out).toHaveLength(2);
    expect(out[0]).toBe(a);
    expect(out[1]).toBe(b);
  });
  it("returns unchanged when already at target", () => {
    const a = new Float32Array([1]);
    const b = new Float32Array([2]);
    const out = upmixChannels([a, b], 2);
    expect(out).toHaveLength(2);
  });
});

describe("audio-merger generateSilence", () => {
  it("generates N zero samples", () => {
    const s = generateSilence(100);
    expect(s.length).toBe(100);
    for (let i = 0; i < s.length; i++) expect(s[i]).toBe(0);
  });
  it("clamps negative to 0", () => {
    expect(generateSilence(-5).length).toBe(0);
  });
});

describe("audio-merger computeCrossfade", () => {
  it("returns requested overlap when both segments long enough", () => {
    const r = computeCrossfade(1000, 1000, 100);
    expect(r.overlapSamples).toBe(100);
    expect(r.outputLength).toBe(1900);
  });
  it("clamps overlap to shorter segment", () => {
    const r = computeCrossfade(50, 1000, 100);
    expect(r.overlapSamples).toBe(50);
    expect(r.outputLength).toBe(1000);
  });
  it("returns 0 overlap for negative crossfade request", () => {
    const r = computeCrossfade(100, 100, -10);
    expect(r.overlapSamples).toBe(0);
    expect(r.outputLength).toBe(200);
  });
});

describe("audio-merger applyLinearCrossfade", () => {
  it("returns simple concatenation when overlap is 0", () => {
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array([4, 5, 6]);
    const out = applyLinearCrossfade(a, b, 0);
    expect(out.length).toBe(6);
    expect(Array.from(out)).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it("overlaps end of A with start of B with linear gains", () => {
    const a = new Float32Array([1, 1, 1, 1]);
    const b = new Float32Array([1, 1, 1, 1]);
    const out = applyLinearCrossfade(a, b, 2);
    expect(out.length).toBe(6);
    // Overlap region: out[2..3] = a[2..3] * (1→0) + b[0..1] * (0→1)
    // i=0: aGain = (2-0-1)/2 = 0.5, bGain = 1/2 = 0.5 → 0.5 + 0.5 = 1
    // i=1: aGain = (2-1-1)/2 = 0, bGain = 2/2 = 1 → 0 + 1 = 1
    expect(out[0]).toBe(1);
    expect(out[1]).toBe(1);
    expect(out[2]).toBeCloseTo(1, 5);
    expect(out[3]).toBeCloseTo(1, 5);
    expect(out[4]).toBe(1);
    expect(out[5]).toBe(1);
  });
  it("clamps overlap to shorter segment", () => {
    const a = new Float32Array([1, 1]);
    const b = new Float32Array([1, 1, 1, 1]);
    const out = applyLinearCrossfade(a, b, 10);
    expect(out.length).toBe(4); // 2 + 4 - 2 = 4
  });
  it("preserves signal in non-overlap regions", () => {
    const a = new Float32Array([0.5, 0.5, 0.5, 0.5, 0.5]);
    const b = new Float32Array([0.7, 0.7, 0.7, 0.7, 0.7]);
    const out = applyLinearCrossfade(a, b, 2);
    // First 3 samples of A (5 - 2 = 3) are unchanged
    expect(out[0]).toBeCloseTo(0.5, 5);
    expect(out[1]).toBeCloseTo(0.5, 5);
    expect(out[2]).toBeCloseTo(0.5, 5);
    // Last 3 samples of B (5 - 2 = 3) are unchanged
    expect(out[4]).toBeCloseTo(0.7, 5);
    expect(out[5]).toBeCloseTo(0.7, 5);
    expect(out[6]).toBeCloseTo(0.7, 5);
  });
});

describe("audio-merger concatenateSegments (gap mode)", () => {
  it("returns empty for empty list", () => {
    expect(concatenateSegments([], 0, 0).length).toBe(0);
  });
  it("returns a copy for single segment", () => {
    const a = new Float32Array([1, 2, 3]);
    const out = concatenateSegments([a], 0, 0);
    expect(Array.from(out)).toEqual([1, 2, 3]);
    expect(out).not.toBe(a); // must be a copy
  });
  it("appends segments with no gap when gap=0 and crossfade=0", () => {
    const a = new Float32Array([1, 2]);
    const b = new Float32Array([3, 4]);
    const out = concatenateSegments([a, b], 0, 0);
    expect(Array.from(out)).toEqual([1, 2, 3, 4]);
  });
  it("inserts silence gap between segments", () => {
    const a = new Float32Array([1, 2]);
    const b = new Float32Array([3, 4]);
    const out = concatenateSegments([a, b], 3, 0);
    expect(Array.from(out)).toEqual([1, 2, 0, 0, 0, 3, 4]);
  });
  it("inserts gap between three segments", () => {
    const a = new Float32Array([1]);
    const b = new Float32Array([2]);
    const c = new Float32Array([3]);
    const out = concatenateSegments([a, b, c], 1, 0);
    expect(Array.from(out)).toEqual([1, 0, 2, 0, 3]);
  });
});

describe("audio-merger concatenateSegments (crossfade mode)", () => {
  it("uses crossfade and ignores gap when crossfade > 0", () => {
    const a = new Float32Array([1, 1, 1, 1]);
    const b = new Float32Array([1, 1, 1, 1]);
    const out = concatenateSegments([a, b], 100, 2);
    expect(out.length).toBe(6); // 4 + 4 - 2 overlap
  });
  it("chains crossfade across three segments", () => {
    const a = new Float32Array([1, 1, 1, 1]);
    const b = new Float32Array([1, 1, 1, 1]);
    const c = new Float32Array([1, 1, 1, 1]);
    const out = concatenateSegments([a, b, c], 0, 2);
    // After first crossfade: 6 samples. After second: 6 + 4 - 2 = 8 samples
    expect(out.length).toBe(8);
  });
});

describe("audio-merger computeTotalDuration", () => {
  it("sums segment durations with no gap/crossfade", () => {
    const d = computeTotalDuration([44100, 44100, 44100], 44100, 0, 0);
    expect(d).toBe(3);
  });
  it("adds gap time for N-1 gaps", () => {
    const d = computeTotalDuration([44100, 44100, 44100], 44100, 500, 0);
    // 3 segments × 1s = 3s + 2 gaps × 0.5s = 1s → 4s
    expect(d).toBe(4);
  });
  it("subtracts crossfade time for N-1 overlaps", () => {
    const d = computeTotalDuration([44100, 44100, 44100], 44100, 0, 500);
    // 3 segments × 1s = 3s - 2 crossfades × 0.5s = 1s → 2s
    expect(d).toBe(2);
  });
  it("returns 0 for empty list", () => {
    expect(computeTotalDuration([], 44100, 0, 0)).toBe(0);
  });
  it("returns 0 for invalid sample rate", () => {
    expect(computeTotalDuration([44100], 0, 0, 0)).toBe(0);
  });
  it("handles single segment (no joins)", () => {
    expect(computeTotalDuration([44100], 44100, 500, 500)).toBe(1);
  });
});

describe("audio-merger estimateWavSizeBytes", () => {
  it("estimates size = 44 + samples × channels × 2", () => {
    expect(estimateWavSizeBytes(1000, 2)).toBe(44 + 1000 * 2 * 2);
  });
  it("handles single channel", () => {
    expect(estimateWavSizeBytes(1000, 1)).toBe(44 + 2000);
  });
  it("handles zero samples", () => {
    expect(estimateWavSizeBytes(0, 2)).toBe(44);
  });
});

describe("audio-merger WAV encoder", () => {
  it("buildWavHeader returns 44-byte RIFF header", () => {
    const header = buildWavHeader(1000, 44100, 2);
    expect(header).toHaveLength(44);
    expect(String.fromCharCode(...header.slice(0, 4))).toBe("RIFF");
    expect(String.fromCharCode(...header.slice(8, 12))).toBe("WAVE");
    expect(String.fromCharCode(...header.slice(12, 16))).toBe("fmt ");
    expect(String.fromCharCode(...header.slice(36, 40))).toBe("data");
    const view = new DataView(header.buffer);
    expect(view.getUint32(4, true)).toBe(1036);
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(44100);
    expect(view.getUint16(34, true)).toBe(16);
  });
  it("floatSamplesTo16BitPCM encodes 1.0 → 32767, -1.0 → -32767", () => {
    const pcm = floatSamplesTo16BitPCM(new Float32Array([1, -1, 0, 0.5]));
    const view = new DataView(pcm.buffer);
    expect(view.getInt16(0, true)).toBe(32767);
    expect(view.getInt16(2, true)).toBe(-32767);
    expect(view.getInt16(4, true)).toBe(0);
    expect(view.getInt16(6, true)).toBe(16384);
  });
  it("interleaveChannels interleaves correctly", () => {
    const out = interleaveChannels([new Float32Array([1, 2, 3]), new Float32Array([4, 5, 6])]);
    expect(Array.from(out)).toEqual([1, 4, 2, 5, 3, 6]);
  });
  it("encodeWav produces valid WAV file", () => {
    const samples = new Float32Array(1000);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.sin(i / 100);
    const wav = encodeWav([samples], 44100);
    expect(wav.length).toBe(44 + 1000 * 2);
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe("RIFF");
  });
  it("encodeWav handles 2 channels", () => {
    const wav = encodeWav([new Float32Array(100), new Float32Array(100)], 44100);
    expect(wav.length).toBe(44 + 100 * 2 * 2);
  });
  it("encodeWav handles empty channels (returns header only)", () => {
    const wav = encodeWav([], 44100);
    expect(wav.length).toBe(44);
  });
});

describe("audio-merger generateFilename", () => {
  it("generates timestamped .wav filename", () => {
    const date = new Date(2024, 0, 5, 14, 23, 7);
    expect(generateFilename(date)).toBe("merged-2024-01-05-142307.wav");
  });
  it("pads single-digit fields", () => {
    const date = new Date(2024, 0, 1, 1, 2, 3);
    expect(generateFilename(date)).toBe("merged-2024-01-01-010203.wav");
  });
});

describe("audio-merger validateMerge", () => {
  it("fails for empty list", () => {
    const r = validateMerge([]);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("at least one");
  });
  it("fails for single segment", () => {
    const r = validateMerge([{ fileName: "a.wav", sampleRate: 44100, channels: 1, length: 100, durationSeconds: 0.1 }]);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("at least two");
  });
  it("passes for two valid segments", () => {
    const r = validateMerge([
      { fileName: "a.wav", sampleRate: 44100, channels: 1, length: 100, durationSeconds: 0.1 },
      { fileName: "b.wav", sampleRate: 44100, channels: 1, length: 100, durationSeconds: 0.1 },
    ]);
    expect(r.ok).toBe(true);
  });
  it("fails for zero-length segment", () => {
    const r = validateMerge([
      { fileName: "a.wav", sampleRate: 44100, channels: 1, length: 0, durationSeconds: 0 },
      { fileName: "b.wav", sampleRate: 44100, channels: 1, length: 100, durationSeconds: 0.1 },
    ]);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("no audio data");
  });
  it("fails for invalid sample rate", () => {
    const r = validateMerge([
      { fileName: "a.wav", sampleRate: 0, channels: 1, length: 100, durationSeconds: 0.1 },
      { fileName: "b.wav", sampleRate: 44100, channels: 1, length: 100, durationSeconds: 0.1 },
    ]);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("sample rate");
  });
});

describe("audio-merger history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    const entry: HistoryEntry = {
      ts: 1, segmentCount: 2, totalDurationMs: 5000, outputSizeBytes: 80000,
      sampleRate: 44100, channels: 1, gapMs: 0, crossfadeMs: 0,
      fileNames: ["a.wav", "b.wav"],
    };
    saveHistory(entry);
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0]).toEqual(entry);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, segmentCount: 2, totalDurationMs: 1, outputSizeBytes: 1,
        sampleRate: 44100, channels: 1, gapMs: 0, crossfadeMs: 0,
        fileNames: ["a", "b"],
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears history", () => {
    saveHistory({
      ts: 1, segmentCount: 2, totalDurationMs: 1, outputSizeBytes: 1,
      sampleRate: 44100, channels: 1, gapMs: 0, crossfadeMs: 0, fileNames: ["a", "b"],
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it("orders most-recent first", () => {
    saveHistory({
      ts: 1, segmentCount: 2, totalDurationMs: 1, outputSizeBytes: 1,
      sampleRate: 44100, channels: 1, gapMs: 0, crossfadeMs: 0, fileNames: ["a"],
    });
    saveHistory({
      ts: 2, segmentCount: 2, totalDurationMs: 1, outputSizeBytes: 1,
      sampleRate: 44100, channels: 1, gapMs: 0, crossfadeMs: 0, fileNames: ["b"],
    });
    const h = loadHistory();
    expect(h[0]!.ts).toBe(2);
    expect(h[1]!.ts).toBe(1);
  });
});

describe("audio-merger computeSummaryStats", () => {
  const segments: SegmentInfo[] = [
    { fileName: "a.wav", sampleRate: 44100, channels: 1, length: 44100, durationSeconds: 1 },
    { fileName: "b.wav", sampleRate: 48000, channels: 2, length: 44100, durationSeconds: 1 },
  ];
  it("computes stats with crossfade", () => {
    const s = computeSummaryStats(segments, 1.5, 200_000, 0, 100);
    expect(s.segmentCount).toBe(2);
    expect(s.sampleRate).toBe(48000);
    expect(s.channels).toBe(2);
    expect(s.crossfadeCount).toBe(1);
    expect(s.gapCount).toBe(0);
    expect(s.joins).toBe(1);
  });
  it("computes stats with gap", () => {
    const s = computeSummaryStats(segments, 2.5, 200_000, 500, 0);
    expect(s.gapCount).toBe(1);
    expect(s.crossfadeCount).toBe(0);
  });
  it("computes stats with no gap or crossfade", () => {
    const s = computeSummaryStats(segments, 2.0, 200_000, 0, 0);
    expect(s.gapCount).toBe(0);
    expect(s.crossfadeCount).toBe(0);
    expect(s.joins).toBe(1);
  });
  it("handles empty segments", () => {
    const s = computeSummaryStats([], 0, 0, 0, 0);
    expect(s.segmentCount).toBe(0);
    expect(s.sampleRate).toBe(0);
    expect(s.channels).toBe(0);
  });
});

describe("audio-merger shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ gapMs: 100, crossfadeMs: 250 });
    expect(url).toContain("gap=100");
    expect(url).toContain("crossfade=250");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("gap=100&crossfade=250");
    expect(p.gapMs).toBe(100);
    expect(p.crossfadeMs).toBe(250);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("strips leading #", () => {
    const p = parseShareUrl("#gap=500&crossfade=0");
    expect(p.gapMs).toBe(500);
    expect(p.crossfadeMs).toBe(0);
  });
  it("ignores invalid numeric values", () => {
    const p = parseShareUrl("gap=abc&crossfade=-5");
    expect(p.gapMs).toBeUndefined();
    expect(p.crossfadeMs).toBeUndefined();
  });
});

// Suppress unused-import lint
export type _Unused = GapPreset | CrossfadePreset;
