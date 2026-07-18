import { describe, it, expect, beforeEach } from "vitest";
import {
  BITRATE_PRESETS,
  BITRATE_LABELS,
  DURATION_PRESETS,
  DURATION_LABELS,
  FORMAT_MIME,
  FORMAT_PLAIN_MIME,
  FORMAT_EXTENSIONS,
  isFormatSupported,
  detectSupportedFormats,
  pickDefaultFormat,
  formatTime,
  formatBytes,
  estimateFileSizeBytes,
  buildRecorderOptions,
  generateFilename,
  isMaxDurationReached,
  isOverHardCap,
  describeRecorderError,
  loadHistory,
  saveHistory,
  clearHistory,
  computeSummaryStats,
  buildShareUrl,
  parseShareUrl,
  type AudioFormat,
  type BitratePreset,
  type DurationPreset,
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

describe("audio-recorder constants", () => {
  it("has 4 bitrate presets", () => {
    expect(Object.keys(BITRATE_PRESETS)).toHaveLength(4);
    expect(BITRATE_PRESETS.low).toBe(64_000);
    expect(BITRATE_PRESETS.medium).toBe(128_000);
    expect(BITRATE_PRESETS.high).toBe(192_000);
    expect(BITRATE_PRESETS.lossless).toBe(320_000);
  });
  it("has 4 bitrate labels", () => {
    expect(Object.keys(BITRATE_LABELS)).toHaveLength(4);
    expect(BITRATE_LABELS.medium).toContain("128 kbps");
  });
  it("has 6 duration presets", () => {
    expect(Object.keys(DURATION_PRESETS)).toHaveLength(6);
    expect(DURATION_PRESETS["30s"]).toBe(30_000);
    expect(DURATION_PRESETS["60s"]).toBe(60_000);
    expect(DURATION_PRESETS["5min"]).toBe(5 * 60_000);
    expect(DURATION_PRESETS["10min"]).toBe(10 * 60_000);
    expect(DURATION_PRESETS["30min"]).toBe(30 * 60_000);
    expect(DURATION_PRESETS.unlimited).toBe(0);
  });
  it("has 6 duration labels", () => {
    expect(Object.keys(DURATION_LABELS)).toHaveLength(6);
    expect(DURATION_LABELS.unlimited).toBe("Unlimited");
  });
  it("maps each format to MIME, plain MIME, and extension", () => {
    const formats: AudioFormat[] = ["webm", "ogg", "mp3"];
    for (const f of formats) {
      expect(FORMAT_MIME[f]).toMatch(/^audio\//);
      expect(FORMAT_PLAIN_MIME[f]).toMatch(/^audio\//);
      expect(FORMAT_EXTENSIONS[f].length).toBeGreaterThan(0);
    }
    expect(FORMAT_MIME.webm).toContain("opus");
    expect(FORMAT_MIME.ogg).toContain("opus");
    expect(FORMAT_MIME.mp3).toBe("audio/mpeg");
  });
});

describe("audio-recorder format support", () => {
  it("isFormatSupported returns false when MediaRecorder undefined", () => {
    const orig = (globalThis as Record<string, unknown>).MediaRecorder;
    (globalThis as Record<string, unknown>).MediaRecorder = undefined;
    expect(isFormatSupported("webm")).toBe(false);
    (globalThis as Record<string, unknown>).MediaRecorder = orig;
  });
  it("isFormatSupported returns true when isTypeSupported returns true", () => {
    const orig = (globalThis as Record<string, unknown>).MediaRecorder;
    (globalThis as Record<string, unknown>).MediaRecorder = {
      isTypeSupported: (m: string) => m === "audio/webm;codecs=opus",
    };
    expect(isFormatSupported("webm")).toBe(true);
    expect(isFormatSupported("ogg")).toBe(false);
    (globalThis as Record<string, unknown>).MediaRecorder = orig;
  });
  it("detectSupportedFormats filters to supported only", () => {
    const orig = (globalThis as Record<string, unknown>).MediaRecorder;
    (globalThis as Record<string, unknown>).MediaRecorder = {
      isTypeSupported: (m: string) => m.startsWith("audio/webm") || m.startsWith("audio/ogg"),
    };
    const supported = detectSupportedFormats();
    expect(supported).toEqual(["webm", "ogg"]);
    (globalThis as Record<string, unknown>).MediaRecorder = orig;
  });
  it("pickDefaultFormat prefers webm", () => {
    expect(pickDefaultFormat(["ogg", "mp3", "webm"])).toBe("webm");
  });
  it("pickDefaultFormat falls back to ogg then mp3", () => {
    expect(pickDefaultFormat(["ogg", "mp3"])).toBe("ogg");
    expect(pickDefaultFormat(["mp3"])).toBe("mp3");
  });
  it("pickDefaultFormat returns webm for empty list", () => {
    expect(pickDefaultFormat([])).toBe("webm");
  });
});

describe("audio-recorder formatTime", () => {
  it("formats 0 ms", () => {
    expect(formatTime(0)).toBe("00:00.000");
  });
  it("formats under a minute", () => {
    expect(formatTime(5_250)).toBe("00:05.250");
  });
  it("formats minutes and seconds", () => {
    expect(formatTime(65_500)).toBe("01:05.500");
  });
  it("formats 10 minutes", () => {
    expect(formatTime(10 * 60_000)).toBe("10:00.000");
  });
  it("handles negative as zero", () => {
    expect(formatTime(-100)).toBe("00:00.000");
  });
  it("handles NaN as zero", () => {
    expect(formatTime(Number.NaN)).toBe("00:00.000");
  });
});

describe("audio-recorder formatBytes", () => {
  it("formats 0 bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });
  it("formats KB", () => {
    expect(formatBytes(2048)).toBe("2.00 KB");
  });
  it("formats MB", () => {
    expect(formatBytes(1_500_000)).toBe("1.43 MB");
  });
  it("handles negative as zero", () => {
    expect(formatBytes(-5)).toBe("0 B");
  });
});

describe("audio-recorder estimateFileSizeBytes", () => {
  it("computes size from bitrate and duration", () => {
    // 128 kbps for 10 seconds = 128000 * 10 / 8 = 160_000 bytes
    expect(estimateFileSizeBytes(128_000, 10_000)).toBe(160_000);
  });
  it("returns 0 for zero bitrate", () => {
    expect(estimateFileSizeBytes(0, 10_000)).toBe(0);
  });
  it("returns 0 for zero duration", () => {
    expect(estimateFileSizeBytes(128_000, 0)).toBe(0);
  });
  it("scales linearly with duration", () => {
    const a = estimateFileSizeBytes(192_000, 5_000);
    const b = estimateFileSizeBytes(192_000, 10_000);
    expect(b).toBe(2 * a);
  });
});

describe("audio-recorder buildRecorderOptions", () => {
  it("builds options with mime and bitrate", () => {
    const opts = buildRecorderOptions("webm", 128_000);
    expect(opts.mimeType).toBe("audio/webm;codecs=opus");
    expect(opts.audioBitsPerSecond).toBe(128_000);
  });
  it("uses mp3 mime for mp3 format", () => {
    const opts = buildRecorderOptions("mp3", 320_000);
    expect(opts.mimeType).toBe("audio/mpeg");
  });
});

describe("audio-recorder generateFilename", () => {
  it("generates timestamped filename with extension", () => {
    const date = new Date(2024, 0, 5, 14, 23, 7);
    const name = generateFilename("webm", date);
    expect(name).toBe("recording-2024-01-05-142307.webm");
  });
  it("uses ogg extension for ogg format", () => {
    const date = new Date(2024, 5, 15, 9, 5, 0);
    expect(generateFilename("ogg", date)).toBe("recording-2024-06-15-090500.ogg");
  });
  it("uses mp3 extension for mp3 format", () => {
    const date = new Date(2024, 11, 31, 23, 59, 59);
    expect(generateFilename("mp3", date)).toBe("recording-2024-12-31-235959.mp3");
  });
  it("pads single-digit fields", () => {
    const date = new Date(2024, 0, 1, 1, 2, 3);
    expect(generateFilename("webm", date)).toBe("recording-2024-01-01-010203.webm");
  });
});

describe("audio-recorder duration validation", () => {
  it("isMaxDurationReached false when unlimited", () => {
    expect(isMaxDurationReached(60_000, 0)).toBe(false);
    expect(isMaxDurationReached(99_999_999, 0)).toBe(false);
  });
  it("isMaxDurationReached true when elapsed >= max", () => {
    expect(isMaxDurationReached(30_000, 30_000)).toBe(true);
    expect(isMaxDurationReached(30_500, 30_000)).toBe(true);
  });
  it("isMaxDurationReached false when elapsed < max", () => {
    expect(isMaxDurationReached(29_999, 30_000)).toBe(false);
  });
  it("isOverHardCap respects 250ms margin", () => {
    expect(isOverHardCap(30_200, 30_000)).toBe(false);
    expect(isOverHardCap(30_250, 30_000)).toBe(true);
  });
  it("isOverHardCap false when unlimited", () => {
    expect(isOverHardCap(99_999_999, 0)).toBe(false);
  });
});

describe("audio-recorder describeRecorderError", () => {
  it("describes NotAllowedError", () => {
    expect(describeRecorderError("NotAllowedError")).toContain("permission denied");
  });
  it("describes NotFoundError", () => {
    expect(describeRecorderError("NotFoundError")).toContain("No microphone");
  });
  it("describes NotReadableError", () => {
    expect(describeRecorderError("NotReadableError")).toContain("another application");
  });
  it("describes AbortError", () => {
    expect(describeRecorderError("AbortError")).toContain("aborted");
  });
  it("describes InvalidStateError", () => {
    expect(describeRecorderError("InvalidStateError")).toContain("invalid state");
  });
  it("falls back for unknown errors", () => {
    expect(describeRecorderError("SomeUnknownError")).toContain("SomeUnknownError");
  });
});

describe("audio-recorder history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    const entry: HistoryEntry = {
      ts: 1,
      durationMs: 5_000,
      format: "webm",
      sizeBytes: 80_000,
      bitrate: 128_000,
      filename: "recording.webm",
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
        durationMs: 1_000,
        format: "webm",
        sizeBytes: 1_000,
        bitrate: 64_000,
        filename: `r-${i}.webm`,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears history", () => {
    saveHistory({
      ts: 1, durationMs: 1_000, format: "webm",
      sizeBytes: 1_000, bitrate: 64_000, filename: "x.webm",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it("orders most-recent first", () => {
    saveHistory({ ts: 1, durationMs: 1, format: "webm", sizeBytes: 1, bitrate: 64_000, filename: "a" });
    saveHistory({ ts: 2, durationMs: 1, format: "webm", sizeBytes: 1, bitrate: 64_000, filename: "b" });
    const history = loadHistory();
    expect(history[0].ts).toBe(2);
    expect(history[1].ts).toBe(1);
  });
});

describe("audio-recorder computeSummaryStats", () => {
  it("handles empty history", () => {
    const stats = computeSummaryStats([]);
    expect(stats.totalRecordings).toBe(0);
    expect(stats.totalDurationMs).toBe(0);
    expect(stats.totalSizeBytes).toBe(0);
    expect(stats.byFormat.webm).toBe(0);
  });
  it("aggregates totals across entries", () => {
    const history: HistoryEntry[] = [
      { ts: 1, durationMs: 5_000, format: "webm", sizeBytes: 80_000, bitrate: 128_000, filename: "a" },
      { ts: 2, durationMs: 10_000, format: "ogg", sizeBytes: 160_000, bitrate: 128_000, filename: "b" },
      { ts: 3, durationMs: 2_000, format: "webm", sizeBytes: 16_000, bitrate: 64_000, filename: "c" },
    ];
    const stats = computeSummaryStats(history);
    expect(stats.totalRecordings).toBe(3);
    expect(stats.totalDurationMs).toBe(17_000);
    expect(stats.totalSizeBytes).toBe(256_000);
    expect(stats.byFormat.webm).toBe(2);
    expect(stats.byFormat.ogg).toBe(1);
    expect(stats.byFormat.mp3).toBe(0);
  });
});

describe("audio-recorder shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ format: "ogg", bitrate: "high", duration: "5min" });
    expect(url).toContain("format=ogg");
    expect(url).toContain("bitrate=high");
    expect(url).toContain("duration=5min");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("format=ogg&bitrate=high&duration=5min");
    expect(p.format).toBe("ogg");
    expect(p.bitrate).toBe("high");
    expect(p.duration).toBe("5min");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("ignores unknown format values", () => {
    const p = parseShareUrl("format=wav&bitrate=medium&duration=30s");
    expect(p.format).toBeUndefined();
    expect(p.bitrate).toBe("medium");
    expect(p.duration).toBe("30s");
  });
  it("ignores unknown bitrate values", () => {
    const p = parseShareUrl("format=mp3&bitrate=ultra&duration=60s");
    expect(p.bitrate).toBeUndefined();
  });
  it("ignores unknown duration values", () => {
    const p = parseShareUrl("format=webm&bitrate=low&duration=2hr");
    expect(p.duration).toBeUndefined();
  });
  it("strips leading # from hash", () => {
    const p = parseShareUrl("#format=webm&bitrate=low&duration=30s");
    expect(p.format).toBe("webm");
  });
});

// Suppress unused-import lint
export type _Unused = AudioFormat | BitratePreset | DurationPreset;
