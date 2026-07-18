import { describe, it, expect, beforeEach } from "vitest";
import {
  MODE_LABELS,
  SILENCE_THRESHOLD_DB,
  SILENCE_THRESHOLD_LABELS,
  SILENCE_MIN_MS,
  SILENCE_MIN_LABELS,
  formatTime,
  formatTimeHMS,
  formatBytes,
  parseTime,
  parseTimestamps,
  computeEqualSplitPoints,
  dbToAmplitude,
  amplitudeToDb,
  detectSilence,
  silenceRegionsToSplitPoints,
  validateSplitPoints,
  extractSegment,
  buildWavHeader,
  floatSamplesTo16BitPCM,
  interleaveChannels,
  applyFadeIn,
  applyFadeOut,
  encodeWav,
  buildZip,
  createZipBlob,
  generateSegmentFilename,
  loadHistory,
  saveHistory,
  clearHistory,
  computeSummaryStats,
  buildShareUrl,
  parseShareUrl,
  type SplitMode,
  type SilenceThresholdPreset,
  type SilenceMinDurationPreset,
  type HistoryEntry,
  type ZipFile,
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

describe("audio-splitter modes + presets", () => {
  it("has 4 split modes", () => {
    expect(Object.keys(MODE_LABELS)).toHaveLength(4);
    expect(MODE_LABELS["equal-count"]).toContain("Equal count");
    expect(MODE_LABELS["silence"]).toContain("Silence");
    expect(MODE_LABELS["manual"]).toContain("Manual");
  });
  it("has 5 silence threshold presets", () => {
    expect(Object.keys(SILENCE_THRESHOLD_DB)).toHaveLength(5);
    expect(SILENCE_THRESHOLD_DB["-30dB"]).toBe(-30);
    expect(SILENCE_THRESHOLD_DB["-50dB"]).toBe(-50);
    expect(SILENCE_THRESHOLD_DB["-80dB"]).toBe(-80);
  });
  it("has 5 silence threshold labels", () => {
    expect(Object.keys(SILENCE_THRESHOLD_LABELS)).toHaveLength(5);
    expect(SILENCE_THRESHOLD_LABELS["-50dB"]).toContain("default");
  });
  it("has 5 min duration presets", () => {
    expect(Object.keys(SILENCE_MIN_MS)).toHaveLength(5);
    expect(SILENCE_MIN_MS["100ms"]).toBe(100);
    expect(SILENCE_MIN_MS["1s"]).toBe(1000);
    expect(SILENCE_MIN_MS["2s"]).toBe(2000);
  });
  it("has 5 min duration labels", () => {
    expect(Object.keys(SILENCE_MIN_LABELS)).toHaveLength(5);
    expect(SILENCE_MIN_LABELS["500ms"]).toContain("default");
  });
});

describe("audio-splitter format helpers", () => {
  it("formatTime formats seconds as MM:SS.ms", () => {
    expect(formatTime(0)).toBe("00:00.000");
    expect(formatTime(90.25)).toBe("01:30.250");
    expect(formatTime(-5)).toBe("00:00.000");
  });
  it("formatTimeHMS formats seconds as HH:MM:SS", () => {
    expect(formatTimeHMS(3723)).toBe("01:02:03");
  });
  it("formatBytes formats bytes human-readable", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(2048)).toBe("2.00 KB");
    expect(formatBytes(1_500_000)).toBe("1.43 MB");
  });
});

describe("audio-splitter parseTime", () => {
  it("parses plain seconds", () => {
    expect(parseTime("12")).toBe(12);
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
  it("returns NaN for invalid", () => {
    expect(Number.isNaN(parseTime(""))).toBe(true);
    expect(Number.isNaN(parseTime("abc"))).toBe(true);
    expect(Number.isNaN(parseTime("01:75"))).toBe(true);
  });
});

describe("audio-splitter parseTimestamps", () => {
  it("parses comma-separated", () => {
    expect(parseTimestamps("0:00, 1:30, 3:45")).toEqual([0, 90, 225]);
  });
  it("parses newline-separated", () => {
    expect(parseTimestamps("10\n20\n30")).toEqual([10, 20, 30]);
  });
  it("parses whitespace-separated", () => {
    expect(parseTimestamps("5 10 15")).toEqual([5, 10, 15]);
  });
  it("skips invalid entries", () => {
    expect(parseTimestamps("5, abc, 10")).toEqual([5, 10]);
  });
  it("returns empty for empty input", () => {
    expect(parseTimestamps("")).toEqual([]);
  });
  it("parses semicolon-separated", () => {
    expect(parseTimestamps("1;2;3")).toEqual([1, 2, 3]);
  });
});

describe("audio-splitter computeEqualSplitPoints", () => {
  it("splits into N equal parts", () => {
    const points = computeEqualSplitPoints(44100 * 10, 44100, { count: 4 });
    expect(points).toHaveLength(3);
    expect(points[0]).toBeCloseTo(44100 * 2.5, -1);
    expect(points[1]).toBeCloseTo(44100 * 5, -1);
    expect(points[2]).toBeCloseTo(44100 * 7.5, -1);
  });
  it("splits into parts of duration X", () => {
    const points = computeEqualSplitPoints(44100 * 10, 44100, { durationSeconds: 2 });
    // 10s / 2s = 5 parts → 4 split points at 2, 4, 6, 8s
    expect(points).toHaveLength(4);
    expect(points[0]).toBe(88200);
    expect(points[1]).toBe(176400);
  });
  it("returns empty for 0 samples", () => {
    expect(computeEqualSplitPoints(0, 44100, { count: 4 })).toEqual([]);
  });
  it("returns empty for invalid sample rate", () => {
    expect(computeEqualSplitPoints(44100, 0, { count: 4 })).toEqual([]);
  });
  it("returns empty when neither count nor duration provided", () => {
    expect(computeEqualSplitPoints(44100, 44100, {})).toEqual([]);
  });
  it("returns empty for count < 2", () => {
    expect(computeEqualSplitPoints(44100, 44100, { count: 1 })).toEqual([]);
  });
  it("duration X that doesn't fit returns empty", () => {
    expect(computeEqualSplitPoints(100, 44100, { durationSeconds: 1 })).toEqual([]);
  });
});

describe("audio-splitter dbToAmplitude / amplitudeToDb", () => {
  it("converts dB to linear amplitude", () => {
    expect(dbToAmplitude(0)).toBeCloseTo(1, 5);
    expect(dbToAmplitude(-20)).toBeCloseTo(0.1, 5);
    expect(dbToAmplitude(-40)).toBeCloseTo(0.01, 5);
    expect(dbToAmplitude(Number.NEGATIVE_INFINITY)).toBe(0);
  });
  it("converts linear amplitude to dB", () => {
    expect(amplitudeToDb(1)).toBeCloseTo(0, 5);
    expect(amplitudeToDb(0.1)).toBeCloseTo(-20, 5);
    expect(amplitudeToDb(0.01)).toBeCloseTo(-40, 5);
    expect(amplitudeToDb(0)).toBe(Number.NEGATIVE_INFINITY);
  });
  it("round-trips", () => {
    const amp = 0.05;
    const db = amplitudeToDb(amp);
    expect(dbToAmplitude(db)).toBeCloseTo(amp, 5);
  });
});

describe("audio-splitter detectSilence", () => {
  it("detects a silence region in the middle", () => {
    // 100 samples: 50 loud (0.5), then 30 silent (0), then 20 loud (0.5)
    const samples = new Float32Array(100);
    for (let i = 0; i < 50; i++) samples[i] = 0.5;
    for (let i = 50; i < 80; i++) samples[i] = 0;
    for (let i = 80; i < 100; i++) samples[i] = 0.5;
    const regions = detectSilence(samples, 1000, 0.01, 10);
    expect(regions).toHaveLength(1);
    expect(regions[0]!.startSample).toBe(50);
    expect(regions[0]!.endSample).toBe(80);
    expect(regions[0]!.length).toBe(30);
  });
  it("skips silence shorter than min duration", () => {
    const samples = new Float32Array(50);
    for (let i = 0; i < 20; i++) samples[i] = 0.5;
    for (let i = 20; i < 25; i++) samples[i] = 0; // 5 samples of silence
    for (let i = 25; i < 50; i++) samples[i] = 0.5;
    const regions = detectSilence(samples, 1000, 0.01, 10);
    expect(regions).toHaveLength(0);
  });
  it("detects trailing silence at end of buffer", () => {
    const samples = new Float32Array(50);
    for (let i = 0; i < 20; i++) samples[i] = 0.5;
    for (let i = 20; i < 50; i++) samples[i] = 0; // 30 samples of silence at end
    const regions = detectSilence(samples, 1000, 0.01, 10);
    expect(regions).toHaveLength(1);
    expect(regions[0]!.startSample).toBe(20);
    expect(regions[0]!.endSample).toBe(50);
  });
  it("returns empty for all-loud signal", () => {
    const samples = new Float32Array(50);
    for (let i = 0; i < 50; i++) samples[i] = 0.5;
    expect(detectSilence(samples, 1000, 0.01, 10)).toHaveLength(0);
  });
  it("returns empty for empty input", () => {
    expect(detectSilence(new Float32Array(0), 1000, 0.01, 10)).toEqual([]);
  });
  it("handles multiple silence regions", () => {
    const samples = new Float32Array(100);
    // loud, silent, loud, silent, loud
    for (let i = 0; i < 20; i++) samples[i] = 0.5;
    for (let i = 20; i < 30; i++) samples[i] = 0;
    for (let i = 30; i < 50; i++) samples[i] = 0.5;
    for (let i = 50; i < 60; i++) samples[i] = 0;
    for (let i = 60; i < 100; i++) samples[i] = 0.5;
    const regions = detectSilence(samples, 1000, 0.01, 5);
    expect(regions).toHaveLength(2);
  });
});

describe("audio-splitter silenceRegionsToSplitPoints", () => {
  it("converts regions to midpoints", () => {
    const regions = [
      { startSample: 10, endSample: 30, length: 20, durationSeconds: 0.02 },
      { startSample: 50, endSample: 70, length: 20, durationSeconds: 0.02 },
    ];
    expect(silenceRegionsToSplitPoints(regions)).toEqual([20, 60]);
  });
  it("returns empty for no regions", () => {
    expect(silenceRegionsToSplitPoints([])).toEqual([]);
  });
});

describe("audio-splitter validateSplitPoints", () => {
  it("validates ascending points", () => {
    const r = validateSplitPoints([1, 2, 3], 10);
    expect(r.ok).toBe(true);
    expect(r.sorted).toEqual([1, 2, 3]);
  });
  it("sorts unsorted points", () => {
    const r = validateSplitPoints([3, 1, 2], 10);
    expect(r.ok).toBe(true);
    expect(r.sorted).toEqual([1, 2, 3]);
  });
  it("fails for empty list", () => {
    const r = validateSplitPoints([], 10);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("No split points");
  });
  it("fails for point at 0", () => {
    const r = validateSplitPoints([0, 1, 2], 10);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("0");
  });
  it("fails for point beyond total duration", () => {
    const r = validateSplitPoints([5, 15], 10);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("exceeds total duration");
  });
  it("fails for duplicate points", () => {
    const r = validateSplitPoints([2, 2, 5], 10);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("Duplicate");
  });
  it("fails for negative point", () => {
    const r = validateSplitPoints([-1, 5], 10);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("Invalid");
  });
  it("allows point at total duration when total is 0 (no upper bound)", () => {
    const r = validateSplitPoints([5, 10], 0);
    expect(r.ok).toBe(true);
  });
});

describe("audio-splitter extractSegment", () => {
  it("extracts a sub-array copy", () => {
    const samples = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const seg = extractSegment(samples, 2, 5);
    expect(Array.from(seg)).toEqual([3, 4, 5]);
  });
  it("clamps to array bounds", () => {
    const samples = new Float32Array([1, 2, 3]);
    const seg = extractSegment(samples, -5, 100);
    expect(Array.from(seg)).toEqual([1, 2, 3]);
  });
  it("handles equal start/end (empty result)", () => {
    const samples = new Float32Array([1, 2, 3]);
    const seg = extractSegment(samples, 2, 2);
    expect(seg.length).toBe(0);
  });
  it("returns a copy (not the same buffer)", () => {
    const samples = new Float32Array([1, 2, 3]);
    const seg = extractSegment(samples, 0, 3);
    expect(seg).not.toBe(samples);
    seg[0] = 99;
    expect(samples[0]).toBe(1);
  });
});

describe("audio-splitter WAV encoder", () => {
  it("buildWavHeader returns valid 44-byte RIFF header", () => {
    const h = buildWavHeader(1000, 44100, 2);
    expect(h).toHaveLength(44);
    expect(String.fromCharCode(...h.slice(0, 4))).toBe("RIFF");
    expect(String.fromCharCode(...h.slice(8, 12))).toBe("WAVE");
    const view = new DataView(h.buffer);
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(44100);
  });
  it("floatSamplesTo16BitPCM encodes correctly", () => {
    const pcm = floatSamplesTo16BitPCM(new Float32Array([1, -1, 0]));
    const view = new DataView(pcm.buffer);
    expect(view.getInt16(0, true)).toBe(32767);
    expect(view.getInt16(2, true)).toBe(-32767);
    expect(view.getInt16(4, true)).toBe(0);
  });
  it("interleaveChannels interleaves correctly", () => {
    const out = interleaveChannels([new Float32Array([1, 2, 3]), new Float32Array([4, 5, 6])]);
    expect(Array.from(out)).toEqual([1, 4, 2, 5, 3, 6]);
  });
  it("applyFadeIn scales first N samples", () => {
    const s = new Float32Array([1, 1, 1, 1]);
    applyFadeIn(s, 4);
    expect(s[0]).toBeCloseTo(0, 5);
    expect(s[3]).toBeCloseTo(0.75, 5);
  });
  it("applyFadeOut scales last N samples", () => {
    const s = new Float32Array([1, 1, 1, 1]);
    applyFadeOut(s, 4);
    expect(s[3]).toBeCloseTo(0, 5);
    expect(s[0]).toBeCloseTo(0.75, 5);
  });
  it("encodeWav produces valid WAV with fade", () => {
    const samples = new Float32Array(1000).fill(0.5);
    const wav = encodeWav([samples], 44100, 100, 100);
    expect(wav.length).toBe(44 + 1000 * 2);
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe("RIFF");
  });
  it("encodeWav handles empty channels", () => {
    const wav = encodeWav([], 44100);
    expect(wav.length).toBe(44);
  });
});

describe("audio-splitter ZIP builder", () => {
  it("builds a valid ZIP with EOCD signature at the end", () => {
    const files: ZipFile[] = [
      { name: "split-001.wav", data: new Uint8Array([1, 2, 3]) },
      { name: "split-002.wav", data: new Uint8Array([4, 5, 6]) },
    ];
    const zip = buildZip(files);
    // Should have EOCD signature 0x06054b50 at the end - 22 bytes
    expect(zip.length).toBeGreaterThan(22);
    const view = new DataView(zip.buffer, zip.buffer.byteLength - 22, 22);
    // Note: zip is a Uint8Array, but the buffer might be exactly zip.length
    const lastView = new DataView(zip.buffer, zip.byteOffset + zip.length - 22, 22);
    expect(lastView.getUint32(0, true)).toBe(0x06054b50);
    // 2 entries
    expect(lastView.getUint16(8, true)).toBe(2);
    expect(lastView.getUint16(10, true)).toBe(2);
  });
  it("starts with local file header signature 0x04034b50", () => {
    const zip = buildZip([{ name: "a.txt", data: new Uint8Array([1, 2, 3]) }]);
    const view = new DataView(zip.buffer, zip.byteOffset, zip.length);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
  });
  it("contains the file name in the local header", () => {
    const zip = buildZip([{ name: "hello.wav", data: new Uint8Array([10, 20]) }]);
    // Local header is 30 bytes + name length. Name should appear at offset 30.
    const nameBytes = zip.slice(30, 30 + "hello.wav".length);
    expect(String.fromCharCode(...nameBytes)).toBe("hello.wav");
  });
  it("contains the file data after the local header", () => {
    const data = new Uint8Array([10, 20, 30]);
    const zip = buildZip([{ name: "x.wav", data }]);
    const nameLen = "x.wav".length;
    const dataStart = 30 + nameLen;
    expect(zip[dataStart]).toBe(10);
    expect(zip[dataStart + 1]).toBe(20);
    expect(zip[dataStart + 2]).toBe(30);
  });
  it("handles multiple files", () => {
    const files: ZipFile[] = [
      { name: "a.wav", data: new Uint8Array([1, 2]) },
      { name: "b.wav", data: new Uint8Array([3, 4]) },
      { name: "c.wav", data: new Uint8Array([5, 6]) },
    ];
    const zip = buildZip(files);
    const view = new DataView(zip.buffer, zip.byteOffset + zip.length - 22, 22);
    expect(view.getUint16(8, true)).toBe(3);
    expect(view.getUint16(10, true)).toBe(3);
  });
  it("returns a valid empty ZIP for empty list", () => {
    const zip = buildZip([]);
    expect(zip.length).toBe(22);
    const view = new DataView(zip.buffer);
    expect(view.getUint32(0, true)).toBe(0x06054b50);
  });
  it("createZipBlob returns a Blob", async () => {
    const blob = createZipBlob([{ name: "a.wav", data: new Uint8Array([1, 2, 3]) }]);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("application/zip");
    expect(blob.size).toBeGreaterThan(22);
  });
  it("CRC32 is correctly computed (consistent across runs)", () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const zip1 = buildZip([{ name: "a.wav", data }]);
    const zip2 = buildZip([{ name: "a.wav", data }]);
    expect(Array.from(zip1)).toEqual(Array.from(zip2));
  });
});

describe("audio-splitter generateSegmentFilename", () => {
  it("generates zero-padded filename", () => {
    expect(generateSegmentFilename(0, 5)).toBe("split-001.wav");
    expect(generateSegmentFilename(1, 5)).toBe("split-002.wav");
    expect(generateSegmentFilename(4, 5)).toBe("split-005.wav");
  });
  it("keeps min 3-digit padding for >9 segments", () => {
    expect(generateSegmentFilename(0, 12)).toBe("split-001.wav");
    expect(generateSegmentFilename(11, 12)).toBe("split-012.wav");
  });
  it("widens padding for >999 segments", () => {
    expect(generateSegmentFilename(0, 1500)).toBe("split-0001.wav");
    expect(generateSegmentFilename(1499, 1500)).toBe("split-1500.wav");
  });
  it("supports custom extension and prefix", () => {
    expect(generateSegmentFilename(0, 3, ".mp3", "clip")).toBe("clip-001.mp3");
    expect(generateSegmentFilename(0, 3, "mp3", "clip")).toBe("clip-001.mp3");
  });
  it("defaults to total=1 when total is 0", () => {
    expect(generateSegmentFilename(0, 0)).toBe("split-001.wav");
  });
});

describe("audio-splitter history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    const entry: HistoryEntry = {
      ts: 1, originalName: "voice.mp3", originalDurationMs: 60_000,
      segmentCount: 4, mode: "equal-count", totalOutputBytes: 800_000,
      sampleRate: 44100, channels: 1,
    };
    saveHistory(entry);
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0]).toEqual(entry);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, originalName: "x", originalDurationMs: 1, segmentCount: 1,
        mode: "equal-count", totalOutputBytes: 1, sampleRate: 44100, channels: 1,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears history", () => {
    saveHistory({
      ts: 1, originalName: "x", originalDurationMs: 1, segmentCount: 1,
      mode: "equal-count", totalOutputBytes: 1, sampleRate: 44100, channels: 1,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it("orders most-recent first", () => {
    saveHistory({
      ts: 1, originalName: "a", originalDurationMs: 1, segmentCount: 1,
      mode: "equal-count", totalOutputBytes: 1, sampleRate: 44100, channels: 1,
    });
    saveHistory({
      ts: 2, originalName: "b", originalDurationMs: 1, segmentCount: 1,
      mode: "silence", totalOutputBytes: 1, sampleRate: 44100, channels: 1,
    });
    const h = loadHistory();
    expect(h[0]!.ts).toBe(2);
    expect(h[1]!.ts).toBe(1);
  });
});

describe("audio-splitter computeSummaryStats", () => {
  it("computes summary for multiple segments", () => {
    const segments = [
      { durationSeconds: 5, sizeBytes: 100 },
      { durationSeconds: 10, sizeBytes: 200 },
      { durationSeconds: 15, sizeBytes: 300 },
    ];
    const s = computeSummaryStats(segments, 30, 44100, 1);
    expect(s.segmentCount).toBe(3);
    expect(s.totalDurationSeconds).toBe(30);
    expect(s.totalOutputBytes).toBe(600);
    expect(s.avgSegmentSeconds).toBeCloseTo(10, 5);
    expect(s.minSegmentSeconds).toBe(5);
    expect(s.maxSegmentSeconds).toBe(15);
    expect(s.sampleRate).toBe(44100);
    expect(s.channels).toBe(1);
  });
  it("handles empty segments", () => {
    const s = computeSummaryStats([], 0, 44100, 1);
    expect(s.segmentCount).toBe(0);
    expect(s.avgSegmentSeconds).toBe(0);
    expect(s.minSegmentSeconds).toBe(0);
    expect(s.maxSegmentSeconds).toBe(0);
  });
  it("handles single segment", () => {
    const s = computeSummaryStats([{ durationSeconds: 5, sizeBytes: 100 }], 5, 44100, 2);
    expect(s.segmentCount).toBe(1);
    expect(s.avgSegmentSeconds).toBe(5);
    expect(s.minSegmentSeconds).toBe(5);
    expect(s.maxSegmentSeconds).toBe(5);
    expect(s.channels).toBe(2);
  });
});

describe("audio-splitter shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      mode: "silence", count: 0, durationSeconds: 0,
      thresholdDb: -50, minSilenceMs: 500, manualTimestamps: "",
    });
    expect(url).toContain("mode=silence");
    expect(url).toContain("thr=-50");
    expect(url).toContain("min=500");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("mode=silence&thr=-50&min=500");
    expect(p.mode).toBe("silence");
    expect(p.thresholdDb).toBe(-50);
    expect(p.minSilenceMs).toBe(500);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("strips leading #", () => {
    const p = parseShareUrl("#mode=manual&ts=0%3A00%2C1%3A30");
    expect(p.mode).toBe("manual");
    expect(p.manualTimestamps).toBe("0:00,1:30");
  });
  it("filters unknown mode", () => {
    const p = parseShareUrl("mode=invalid");
    expect(p.mode).toBeUndefined();
  });
  it("includes count and duration when set", () => {
    const url = buildShareUrl({
      mode: "equal-count", count: 4, durationSeconds: 2,
      thresholdDb: -50, minSilenceMs: 500, manualTimestamps: "",
    });
    expect(url).toContain("count=4");
    expect(url).toContain("dur=2");
  });
});

// Suppress unused-import lint
export type _Unused = SplitMode | SilenceThresholdPreset | SilenceMinDurationPreset;
