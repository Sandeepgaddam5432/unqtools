import { describe, it, expect, beforeEach } from "vitest";
import {
  FADE_PRESETS_MS,
  FADE_LABELS,
  parseTime,
  formatTime,
  formatTimeHMS,
  computeSampleRange,
  trimmedSampleCount,
  trimmedDurationSeconds,
  buildWavHeader,
  floatSamplesTo16BitPCM,
  interleaveChannels,
  applyFadeIn,
  applyFadeOut,
  fadePresetToSamples,
  computeCrossfade,
  estimateWavSizeBytes,
  formatBytes,
  validateTrim,
  generateFilename,
  loadHistory,
  saveHistory,
  clearHistory,
  computeSummaryStats,
  buildShareUrl,
  parseShareUrl,
  encodeWav,
  type FadePreset,
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

describe("audio-trimmer fade presets", () => {
  it("has 5 fade presets", () => {
    expect(Object.keys(FADE_PRESETS_MS)).toHaveLength(5);
    expect(FADE_PRESETS_MS["0ms"]).toBe(0);
    expect(FADE_PRESETS_MS["100ms"]).toBe(100);
    expect(FADE_PRESETS_MS["500ms"]).toBe(500);
    expect(FADE_PRESETS_MS["1s"]).toBe(1000);
    expect(FADE_PRESETS_MS["2s"]).toBe(2000);
  });
  it("has 5 fade labels", () => {
    expect(Object.keys(FADE_LABELS)).toHaveLength(5);
    expect(FADE_LABELS["0ms"]).toContain("None");
  });
});

describe("audio-trimmer parseTime", () => {
  it("parses plain seconds (integer)", () => {
    expect(parseTime("12")).toBe(12);
  });
  it("parses plain seconds (decimal)", () => {
    expect(parseTime("12.5")).toBe(12.5);
  });
  it("parses MM:SS", () => {
    expect(parseTime("01:30")).toBe(90);
  });
  it("parses MM:SS.ms", () => {
    expect(parseTime("01:30.250")).toBe(90.25);
  });
  it("parses HH:MM:SS", () => {
    expect(parseTime("01:02:03")).toBe(3723);
  });
  it("returns NaN for empty string", () => {
    expect(Number.isNaN(parseTime(""))).toBe(true);
  });
  it("returns NaN for garbage", () => {
    expect(Number.isNaN(parseTime("abc"))).toBe(true);
  });
  it("returns NaN for invalid MM:SS with sec >= 60", () => {
    expect(Number.isNaN(parseTime("01:75"))).toBe(true);
  });
  it("returns NaN for invalid HH:MM:SS with min >= 60", () => {
    expect(Number.isNaN(parseTime("01:75:30"))).toBe(true);
  });
  it("handles non-string input", () => {
    expect(Number.isNaN(parseTime(null as unknown as string))).toBe(true);
  });
  it("trims whitespace", () => {
    expect(parseTime("  01:30  ")).toBe(90);
  });
});

describe("audio-trimmer formatTime", () => {
  it("formats 0 seconds", () => {
    expect(formatTime(0)).toBe("00:00.000");
  });
  it("formats 90 seconds as 01:30.000", () => {
    expect(formatTime(90)).toBe("01:30.000");
  });
  it("formats 90.25 seconds as 01:30.250", () => {
    expect(formatTime(90.25)).toBe("01:30.250");
  });
  it("handles negative as zero", () => {
    expect(formatTime(-5)).toBe("00:00.000");
  });
  it("handles NaN as zero", () => {
    expect(formatTime(Number.NaN)).toBe("00:00.000");
  });
});

describe("audio-trimmer formatTimeHMS", () => {
  it("formats 0 seconds", () => {
    expect(formatTimeHMS(0)).toBe("00:00:00");
  });
  it("formats 3723 seconds as 01:02:03", () => {
    expect(formatTimeHMS(3723)).toBe("01:02:03");
  });
});

describe("audio-trimmer computeSampleRange", () => {
  it("computes start and end sample indices", () => {
    const range = computeSampleRange(1, 3, 44100, 44100 * 10);
    expect(range.startSample).toBe(44100);
    expect(range.endSample).toBe(132300);
  });
  it("clamps start to 0", () => {
    const range = computeSampleRange(-1, 3, 44100, 44100 * 10);
    expect(range.startSample).toBe(0);
  });
  it("clamps end to totalSamples", () => {
    const range = computeSampleRange(8, 15, 44100, 44100 * 10);
    expect(range.endSample).toBe(44100 * 10);
  });
  it("handles end before start (swaps effectively)", () => {
    const range = computeSampleRange(5, 1, 44100, 44100 * 10);
    // We max(start, end) so end >= start
    expect(range.endSample).toBeGreaterThanOrEqual(range.startSample);
  });
});

describe("audio-trimmer trimmedSampleCount & duration", () => {
  it("counts samples in range", () => {
    const range = computeSampleRange(1, 3, 44100, 44100 * 10);
    expect(trimmedSampleCount(range)).toBe(88200);
  });
  it("computes trimmed duration in seconds", () => {
    const range = computeSampleRange(1, 3, 44100, 44100 * 10);
    expect(trimmedDurationSeconds(range, 44100)).toBe(2);
  });
  it("returns 0 duration for 0 sample rate", () => {
    const range = computeSampleRange(1, 3, 44100, 44100 * 10);
    expect(trimmedDurationSeconds(range, 0)).toBe(0);
  });
});

describe("audio-trimmer buildWavHeader", () => {
  it("returns 44-byte header", () => {
    const header = buildWavHeader(1000, 44100, 2);
    expect(header).toHaveLength(44);
  });
  it("contains RIFF marker", () => {
    const header = buildWavHeader(1000, 44100, 2);
    const str = String.fromCharCode(...header.slice(0, 4));
    expect(str).toBe("RIFF");
  });
  it("contains WAVE marker", () => {
    const header = buildWavHeader(1000, 44100, 2);
    const str = String.fromCharCode(...header.slice(8, 12));
    expect(str).toBe("WAVE");
  });
  it("contains fmt chunk marker", () => {
    const header = buildWavHeader(1000, 44100, 2);
    const str = String.fromCharCode(...header.slice(12, 16));
    expect(str).toBe("fmt ");
  });
  it("contains data chunk marker", () => {
    const header = buildWavHeader(1000, 44100, 2);
    const str = String.fromCharCode(...header.slice(36, 40));
    expect(str).toBe("data");
  });
  it("encodes file size correctly (little-endian)", () => {
    const header = buildWavHeader(1000, 44100, 2);
    const view = new DataView(header.buffer);
    // file size = 36 + dataLength = 36 + 1000 = 1036
    expect(view.getUint32(4, true)).toBe(1036);
  });
  it("encodes sample rate correctly", () => {
    const header = buildWavHeader(1000, 44100, 2);
    const view = new DataView(header.buffer);
    expect(view.getUint32(24, true)).toBe(44100);
  });
  it("encodes channels correctly", () => {
    const header = buildWavHeader(1000, 44100, 2);
    const view = new DataView(header.buffer);
    expect(view.getUint16(22, true)).toBe(2);
  });
  it("encodes bits per sample as 16", () => {
    const header = buildWavHeader(1000, 44100, 2);
    const view = new DataView(header.buffer);
    expect(view.getUint16(34, true)).toBe(16);
  });
  it("computes byte rate = sampleRate * channels * bitsPerSample / 8", () => {
    const header = buildWavHeader(1000, 44100, 2);
    const view = new DataView(header.buffer);
    expect(view.getUint32(28, true)).toBe(44100 * 2 * 16 / 8);
  });
});

describe("audio-trimmer floatSamplesTo16BitPCM", () => {
  it("returns 2 bytes per sample", () => {
    const pcm = floatSamplesTo16BitPCM(new Float32Array([0, 1, -1]));
    expect(pcm).toHaveLength(6);
  });
  it("encodes 0.0 as 0", () => {
    const pcm = floatSamplesTo16BitPCM(new Float32Array([0]));
    const view = new DataView(pcm.buffer);
    expect(view.getInt16(0, true)).toBe(0);
  });
  it("encodes 1.0 as 32767", () => {
    const pcm = floatSamplesTo16BitPCM(new Float32Array([1]));
    const view = new DataView(pcm.buffer);
    expect(view.getInt16(0, true)).toBe(32767);
  });
  it("encodes -1.0 as -32767", () => {
    const pcm = floatSamplesTo16BitPCM(new Float32Array([-1]));
    const view = new DataView(pcm.buffer);
    expect(view.getInt16(0, true)).toBe(-32767);
  });
  it("clamps values above 1", () => {
    const pcm = floatSamplesTo16BitPCM(new Float32Array([2]));
    const view = new DataView(pcm.buffer);
    expect(view.getInt16(0, true)).toBe(32767);
  });
  it("clamps values below -1", () => {
    const pcm = floatSamplesTo16BitPCM(new Float32Array([-2]));
    const view = new DataView(pcm.buffer);
    expect(view.getInt16(0, true)).toBe(-32767);
  });
  it("encodes 0.5 as 16384 (rounded)", () => {
    const pcm = floatSamplesTo16BitPCM(new Float32Array([0.5]));
    const view = new DataView(pcm.buffer);
    expect(view.getInt16(0, true)).toBe(16384);
  });
});

describe("audio-trimmer interleaveChannels", () => {
  it("interleaves 2 channels correctly", () => {
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array([4, 5, 6]);
    const out = interleaveChannels([a, b]);
    expect(Array.from(out)).toEqual([1, 4, 2, 5, 3, 6]);
  });
  it("handles single channel", () => {
    const a = new Float32Array([1, 2, 3]);
    const out = interleaveChannels([a]);
    expect(Array.from(out)).toEqual([1, 2, 3]);
  });
  it("returns empty for empty input", () => {
    expect(interleaveChannels([])).toHaveLength(0);
  });
});

describe("audio-trimmer fade in/out", () => {
  it("applyFadeIn scales first N samples linearly", () => {
    const samples = new Float32Array([1, 1, 1, 1]);
    applyFadeIn(samples, 4);
    expect(samples[0]).toBeCloseTo(0, 5);
    expect(samples[1]).toBeCloseTo(0.25, 5);
    expect(samples[2]).toBeCloseTo(0.5, 5);
    expect(samples[3]).toBeCloseTo(0.75, 5);
  });
  it("applyFadeIn does not affect samples beyond fadeSamples", () => {
    const samples = new Float32Array([1, 1, 1, 1]);
    applyFadeIn(samples, 2);
    expect(samples[2]).toBe(1);
    expect(samples[3]).toBe(1);
  });
  it("applyFadeIn clamps to array length", () => {
    const samples = new Float32Array([1, 1, 1]);
    applyFadeIn(samples, 10);
    expect(samples[2]).toBeCloseTo(1 * (2 / 3), 5);
  });
  it("applyFadeOut scales last N samples linearly", () => {
    const samples = new Float32Array([1, 1, 1, 1]);
    applyFadeOut(samples, 4);
    expect(samples[3]).toBeCloseTo(0, 5);
    expect(samples[2]).toBeCloseTo(0.25, 5);
    expect(samples[1]).toBeCloseTo(0.5, 5);
    expect(samples[0]).toBeCloseTo(0.75, 5);
  });
  it("applyFadeOut does not affect samples before fadeSamples", () => {
    const samples = new Float32Array([1, 1, 1, 1]);
    applyFadeOut(samples, 2);
    expect(samples[0]).toBe(1);
    expect(samples[1]).toBe(1);
  });
  it("fadePresetToSamples converts ms to samples", () => {
    expect(fadePresetToSamples("100ms", 44100)).toBe(4410);
    expect(fadePresetToSamples("1s", 44100)).toBe(44100);
    expect(fadePresetToSamples("0ms", 44100)).toBe(0);
  });
});

describe("audio-trimmer computeCrossfade", () => {
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

describe("audio-trimmer estimateWavSizeBytes", () => {
  it("estimates size = 44 + samples * channels * 2", () => {
    expect(estimateWavSizeBytes(1000, 2)).toBe(44 + 1000 * 2 * 2);
  });
  it("handles single channel", () => {
    expect(estimateWavSizeBytes(1000, 1)).toBe(44 + 2000);
  });
  it("handles zero samples", () => {
    expect(estimateWavSizeBytes(0, 2)).toBe(44);
  });
});

describe("audio-trimmer formatBytes", () => {
  it("formats 0 bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });
  it("formats KB", () => {
    expect(formatBytes(2048)).toBe("2.00 KB");
  });
  it("formats MB", () => {
    expect(formatBytes(1_500_000)).toBe("1.43 MB");
  });
});

describe("audio-trimmer validateTrim", () => {
  it("returns ok for valid range", () => {
    const r = validateTrim(1, 5, 10);
    expect(r.ok).toBe(true);
    expect(r.error).toBeUndefined();
  });
  it("fails for NaN start", () => {
    const r = validateTrim(Number.NaN, 5, 10);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("valid numbers");
  });
  it("fails for negative start", () => {
    const r = validateTrim(-1, 5, 10);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("negative");
  });
  it("fails when end <= start", () => {
    const r = validateTrim(5, 5, 10);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("greater than start");
  });
  it("fails when end > total duration", () => {
    const r = validateTrim(5, 15, 10);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("exceed total duration");
  });
  it("allows end equal to total duration", () => {
    const r = validateTrim(5, 10, 10);
    expect(r.ok).toBe(true);
  });
  it("allows tiny float error within 1ms", () => {
    const r = validateTrim(5, 10.0005, 10);
    expect(r.ok).toBe(true);
  });
});

describe("audio-trimmer generateFilename", () => {
  it("generates timestamped .wav filename", () => {
    const date = new Date(2024, 0, 5, 14, 23, 7);
    expect(generateFilename(date)).toBe("trimmed-2024-01-05-142307.wav");
  });
  it("pads single-digit fields", () => {
    const date = new Date(2024, 0, 1, 1, 2, 3);
    expect(generateFilename(date)).toBe("trimmed-2024-01-01-010203.wav");
  });
});

describe("audio-trimmer history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    const entry: HistoryEntry = {
      ts: 1,
      originalName: "voice.mp3",
      originalDurationMs: 10_000,
      trimmedDurationMs: 5_000,
      outputSizeBytes: 80_000,
      startSeconds: 2,
      endSeconds: 7,
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
        ts: i,
        originalName: `f-${i}.mp3`,
        originalDurationMs: 1,
        trimmedDurationMs: 1,
        outputSizeBytes: 1,
        startSeconds: 0,
        endSeconds: 1,
        sampleRate: 44100,
        channels: 1,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears history", () => {
    saveHistory({
      ts: 1, originalName: "x", originalDurationMs: 1, trimmedDurationMs: 1,
      outputSizeBytes: 1, startSeconds: 0, endSeconds: 1, sampleRate: 44100, channels: 1,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it("orders most-recent first", () => {
    saveHistory({
      ts: 1, originalName: "a", originalDurationMs: 1, trimmedDurationMs: 1,
      outputSizeBytes: 1, startSeconds: 0, endSeconds: 1, sampleRate: 44100, channels: 1,
    });
    saveHistory({
      ts: 2, originalName: "b", originalDurationMs: 1, trimmedDurationMs: 1,
      outputSizeBytes: 1, startSeconds: 0, endSeconds: 1, sampleRate: 44100, channels: 1,
    });
    const history = loadHistory();
    expect(history[0].ts).toBe(2);
    expect(history[1].ts).toBe(1);
  });
});

describe("audio-trimmer computeSummaryStats", () => {
  it("computes stats for typical trim", () => {
    const stats = computeSummaryStats(10, 6, 529_200);
    expect(stats.originalDurationSeconds).toBe(10);
    expect(stats.trimmedDurationSeconds).toBe(6);
    expect(stats.removedSeconds).toBe(4);
    expect(stats.removedPct).toBeCloseTo(40, 5);
    expect(stats.outputSizeBytes).toBe(529_200);
  });
  it("handles zero original duration", () => {
    const stats = computeSummaryStats(0, 0, 44);
    expect(stats.removedPct).toBe(0);
  });
  it("handles trim longer than original (clamps to 0)", () => {
    const stats = computeSummaryStats(5, 10, 1000);
    expect(stats.removedSeconds).toBe(0);
    expect(stats.removedPct).toBe(0);
  });
});

describe("audio-trimmer shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      start: "01:30", end: "02:00",
      fadeIn: "100ms", fadeOut: "500ms",
    });
    expect(url).toContain("start=01%3A30");
    expect(url).toContain("end=02%3A00");
    expect(url).toContain("fadein=100ms");
    expect(url).toContain("fadeout=500ms");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("start=01%3A30&end=02%3A00&fadein=100ms&fadeout=500ms");
    expect(p.start).toBe("01:30");
    expect(p.end).toBe("02:00");
    expect(p.fadeIn).toBe("100ms");
    expect(p.fadeOut).toBe("500ms");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("ignores unknown fade values", () => {
    const p = parseShareUrl("start=5&end=10&fadein=invalid&fadeout=1s");
    expect(p.fadeIn).toBeUndefined();
    expect(p.fadeOut).toBe("1s");
  });
  it("strips leading # from hash", () => {
    const p = parseShareUrl("#start=5&end=10");
    expect(p.start).toBe("5");
  });
  it("handles missing fields gracefully", () => {
    const p = parseShareUrl("start=5");
    expect(p.start).toBe("5");
    expect(p.end).toBeUndefined();
    expect(p.fadeIn).toBeUndefined();
  });
});

describe("audio-trimmer encodeWav (integration)", () => {
  it("encodes single-channel samples to a valid WAV blob", () => {
    const samples = new Float32Array(44100); // 1 second at 44.1kHz
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin(2 * Math.PI * 440 * i / 44100) * 0.5;
    }
    const wav = encodeWav([samples], 44100, 0, 0);
    // header (44) + samples * 2 bytes
    expect(wav.length).toBe(44 + 44100 * 2);
    // RIFF marker
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe("RIFF");
    // WAVE marker
    expect(String.fromCharCode(...wav.slice(8, 12))).toBe("WAVE");
    // data length
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
    // header (44) + 100 samples * 2 channels * 2 bytes
    expect(wav.length).toBe(44 + 100 * 2 * 2);
  });
  it("handles empty channel array", () => {
    const wav = encodeWav([], 44100, 0, 0);
    expect(wav.length).toBe(44);
  });
});

// Suppress unused-import lint
export type _Unused = FadePreset;
