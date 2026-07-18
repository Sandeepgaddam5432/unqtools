import { describe, it, expect, beforeEach } from "vitest";
import {
  BITRATE_PRESETS,
  BITRATE_LABELS,
  FRAMERATE_PRESETS,
  FRAMERATE_LABELS,
  RESOLUTION_HEIGHTS,
  RESOLUTION_LABELS,
  FADE_PRESETS_MS,
  FADE_LABELS,
  FORMAT_MIME,
  FORMAT_EXTENSIONS,
  FORMAT_LABELS,
  FORMAT_FALLBACK_ORDER,
  parseTime,
  formatTime,
  formatTimeHMS,
  validateTrim,
  trimmedDuration,
  isFormatEncodable,
  detectEncodableFormats,
  pickDefaultOutputFormat,
  computeResolution,
  roundEven,
  fadePresetToMs,
  fadeGainAt,
  estimateFileSizeBytes,
  formatBytes,
  generateFilename,
  stripExtension,
  loadHistory,
  saveHistory,
  clearHistory,
  computeSummaryStats,
  buildShareUrl,
  parseShareUrl,
  type BitratePreset,
  type FrameRatePreset,
  type ResolutionPreset,
  type OutputFormat,
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

describe("video-trimmer presets", () => {
  it("has 4 bitrate presets with correct bps", () => {
    expect(Object.keys(BITRATE_PRESETS)).toHaveLength(4);
    expect(BITRATE_PRESETS.low).toBe(1_000_000);
    expect(BITRATE_PRESETS.medium).toBe(2_500_000);
    expect(BITRATE_PRESETS.high).toBe(5_000_000);
    expect(BITRATE_PRESETS["very-high"]).toBe(8_000_000);
  });
  it("has 4 bitrate labels", () => {
    expect(Object.keys(BITRATE_LABELS)).toHaveLength(4);
    expect(BITRATE_LABELS.low).toContain("1 Mbps");
  });
  it("has 3 frame-rate presets", () => {
    expect(Object.keys(FRAMERATE_PRESETS)).toHaveLength(3);
    expect(FRAMERATE_PRESETS["24"]).toBe(24);
    expect(FRAMERATE_PRESETS["30"]).toBe(30);
    expect(FRAMERATE_PRESETS["60"]).toBe(60);
  });
  it("has 3 frame-rate labels", () => {
    expect(Object.keys(FRAMERATE_LABELS)).toHaveLength(3);
    expect(FRAMERATE_LABELS["60"]).toContain("smooth");
  });
  it("has 4 resolution presets", () => {
    expect(Object.keys(RESOLUTION_HEIGHTS)).toHaveLength(4);
    expect(RESOLUTION_HEIGHTS["480p"]).toBe(480);
    expect(RESOLUTION_HEIGHTS["720p"]).toBe(720);
    expect(RESOLUTION_HEIGHTS["1080p"]).toBe(1080);
    expect(RESOLUTION_HEIGHTS.original).toBe(0);
  });
  it("has 4 resolution labels", () => {
    expect(Object.keys(RESOLUTION_LABELS)).toHaveLength(4);
    expect(RESOLUTION_LABELS.original).toContain("keep source");
  });
  it("has 5 fade presets with correct ms", () => {
    expect(Object.keys(FADE_PRESETS_MS)).toHaveLength(5);
    expect(FADE_PRESETS_MS["0ms"]).toBe(0);
    expect(FADE_PRESETS_MS["250ms"]).toBe(250);
    expect(FADE_PRESETS_MS["500ms"]).toBe(500);
    expect(FADE_PRESETS_MS["1s"]).toBe(1000);
    expect(FADE_PRESETS_MS["2s"]).toBe(2000);
  });
  it("has 5 fade labels", () => {
    expect(Object.keys(FADE_LABELS)).toHaveLength(5);
    expect(FADE_LABELS["0ms"]).toContain("None");
  });
  it("has 2 output formats with MIME and extension", () => {
    expect(Object.keys(FORMAT_MIME)).toHaveLength(2);
    expect(FORMAT_EXTENSIONS.webm).toBe("webm");
    expect(FORMAT_EXTENSIONS.mp4).toBe("mp4");
    expect(FORMAT_MIME.webm).toContain("vp9");
    expect(FORMAT_MIME.mp4).toContain("h264");
  });
  it("has 2 format labels and fallback order", () => {
    expect(Object.keys(FORMAT_LABELS)).toHaveLength(2);
    expect(FORMAT_FALLBACK_ORDER).toEqual(["webm", "mp4"]);
  });
});

describe("video-trimmer parseTime", () => {
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

describe("video-trimmer formatTime", () => {
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

describe("video-trimmer formatTimeHMS", () => {
  it("formats 0 seconds", () => {
    expect(formatTimeHMS(0)).toBe("00:00:00");
  });
  it("formats 3723 seconds as 01:02:03", () => {
    expect(formatTimeHMS(3723)).toBe("01:02:03");
  });
});

describe("video-trimmer validateTrim", () => {
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
  it("skips duration check when total is 0", () => {
    const r = validateTrim(1, 5, 0);
    expect(r.ok).toBe(true);
  });
});

describe("video-trimmer trimmedDuration", () => {
  it("computes positive duration", () => {
    expect(trimmedDuration(2, 8)).toBe(6);
  });
  it("returns 0 when end <= start", () => {
    expect(trimmedDuration(5, 5)).toBe(0);
    expect(trimmedDuration(8, 2)).toBe(0);
  });
});

describe("video-trimmer format support lookup", () => {
  it("returns false when MediaRecorder is undefined", () => {
    const orig = (globalThis as Record<string, unknown>).MediaRecorder;
    (globalThis as Record<string, unknown>).MediaRecorder = undefined;
    expect(isFormatEncodable("webm")).toBe(false);
    expect(isFormatEncodable("mp4")).toBe(false);
    (globalThis as Record<string, unknown>).MediaRecorder = orig;
  });
  it("uses MediaRecorder.isTypeSupported when available", () => {
    const orig = (globalThis as Record<string, unknown>).MediaRecorder;
    let calledWith: string[] = [];
    (globalThis as Record<string, unknown>).MediaRecorder = {
      isTypeSupported: (m: string) => {
        calledWith.push(m);
        return m.startsWith("video/webm");
      },
    };
    expect(isFormatEncodable("webm")).toBe(true);
    expect(isFormatEncodable("mp4")).toBe(false);
    // Should always try the codec-suffixed MIME first.
    expect(calledWith).toContain("video/webm;codecs=vp9,opus");
    // For mp4 (which fails the codec-suffixed check), the plain MIME is tried too.
    expect(calledWith).toContain("video/mp4");
    (globalThis as Record<string, unknown>).MediaRecorder = orig;
  });
  it("detectEncodableFormats filters in fallback order", () => {
    const orig = (globalThis as Record<string, unknown>).MediaRecorder;
    (globalThis as Record<string, unknown>).MediaRecorder = {
      isTypeSupported: () => true,
    };
    expect(detectEncodableFormats()).toEqual(["webm", "mp4"]);
    (globalThis as Record<string, unknown>).MediaRecorder = orig;
  });
  it("pickDefaultOutputFormat prefers webm", () => {
    expect(pickDefaultOutputFormat(["webm", "mp4"])).toBe("webm");
    expect(pickDefaultOutputFormat(["mp4"])).toBe("mp4");
    expect(pickDefaultOutputFormat([])).toBe("webm");
  });
});

describe("video-trimmer computeResolution", () => {
  it("returns source dimensions for original", () => {
    const r = computeResolution("original", 1920, 1080);
    expect(r.width).toBe(1920);
    expect(r.height).toBe(1080);
  });
  it("downscales 1080p to 720p maintaining aspect ratio", () => {
    const r = computeResolution("720p", 1920, 1080);
    expect(r.height).toBe(720);
    // 1920 / 1080 * 720 = 1280
    expect(r.width).toBe(1280);
  });
  it("downscales 1080p to 480p", () => {
    const r = computeResolution("480p", 1920, 1080);
    expect(r.height).toBe(480);
    // 1920 / 1080 * 480 = 853.33 → roundEven = 854
    expect(r.width).toBe(854);
  });
  it("does not upscale when source is smaller than target", () => {
    const r = computeResolution("1080p", 640, 360);
    expect(r.height).toBe(360);
    expect(r.width).toBe(640);
  });
  it("returns original dims when sourceHeight is 0", () => {
    const r = computeResolution("720p", 0, 0);
    expect(r.width).toBe(0);
    expect(r.height).toBe(0);
  });
  it("handles 4:3 source", () => {
    const r = computeResolution("480p", 640, 480);
    expect(r.height).toBe(480);
    // Source is already 480p — keep source (no upscale)
    expect(r.width).toBe(640);
  });
});

describe("video-trimmer roundEven", () => {
  it("returns even numbers unchanged", () => {
    expect(roundEven(4)).toBe(4);
    expect(roundEven(1280)).toBe(1280);
  });
  it("rounds odd numbers up to next even", () => {
    expect(roundEven(3)).toBe(4);
    expect(roundEven(853)).toBe(854);
  });
  it("handles 0", () => {
    expect(roundEven(0)).toBe(0);
  });
});

describe("video-trimmer fade helpers", () => {
  it("fadePresetToMs returns the right number", () => {
    expect(fadePresetToMs("0ms")).toBe(0);
    expect(fadePresetToMs("250ms")).toBe(250);
    expect(fadePresetToMs("1s")).toBe(1000);
    expect(fadePresetToMs("2s")).toBe(2000);
  });
  it("fadeGainAt returns 1 at mid-clip with no fades", () => {
    expect(fadeGainAt(5, 10, 0, 0)).toBe(1);
  });
  it("fadeGainAt ramps up during fade-in", () => {
    // 1 second fade in
    expect(fadeGainAt(0, 10, 1000, 0)).toBeCloseTo(0, 5);
    expect(fadeGainAt(0.5, 10, 1000, 0)).toBeCloseTo(0.5, 5);
    expect(fadeGainAt(1, 10, 1000, 0)).toBeCloseTo(1, 5);
    expect(fadeGainAt(2, 10, 1000, 0)).toBe(1);
  });
  it("fadeGainAt ramps down during fade-out", () => {
    // 1 second fade out at end of 10s clip
    expect(fadeGainAt(9.5, 10, 0, 1000)).toBeCloseTo(0.5, 5);
    expect(fadeGainAt(9.9, 10, 0, 1000)).toBeCloseTo(0.1, 5);
    expect(fadeGainAt(8, 10, 0, 1000)).toBe(1);
  });
  it("fadeGainAt returns 1 for 0 duration", () => {
    expect(fadeGainAt(0, 0, 1000, 1000)).toBe(1);
  });
});

describe("video-trimmer estimateFileSizeBytes", () => {
  it("estimates size = bitrate * duration / 8", () => {
    // 2.5 Mbps * 10 sec / 8 = 3_125_000 bytes
    expect(estimateFileSizeBytes(2_500_000, 10)).toBe(3_125_000);
  });
  it("returns 0 for zero bitrate", () => {
    expect(estimateFileSizeBytes(0, 10)).toBe(0);
  });
  it("returns 0 for zero duration", () => {
    expect(estimateFileSizeBytes(2_500_000, 0)).toBe(0);
  });
  it("returns 0 for negative inputs", () => {
    expect(estimateFileSizeBytes(-1, 10)).toBe(0);
    expect(estimateFileSizeBytes(2_500_000, -1)).toBe(0);
  });
});

describe("video-trimmer formatBytes", () => {
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

describe("video-trimmer stripExtension", () => {
  it("strips the last extension", () => {
    expect(stripExtension("movie.mp4")).toBe("movie");
    expect(stripExtension("clip.final.webm")).toBe("clip.final");
  });
  it("returns the input when no extension", () => {
    expect(stripExtension("movie")).toBe("movie");
  });
  it("returns empty for empty input", () => {
    expect(stripExtension("")).toBe("");
  });
  it("returns input when dot is at position 0", () => {
    expect(stripExtension(".gitignore")).toBe(".gitignore");
  });
});

describe("video-trimmer generateFilename", () => {
  it("generates timestamped filename with base name", () => {
    const date = new Date(2024, 0, 5, 14, 23, 7);
    const name = generateFilename("vacation.mp4", "webm", date);
    expect(name).toBe("vacation-trimmed-2024-01-05-142307.webm");
  });
  it("uses 'trimmed' stem when no base name", () => {
    const date = new Date(2024, 5, 1, 9, 8, 7);
    const name = generateFilename(null, "mp4", date);
    expect(name).toBe("trimmed-2024-06-01-090807.mp4");
  });
  it("pads single-digit fields", () => {
    const date = new Date(2024, 0, 1, 1, 2, 3);
    const name = generateFilename("x.mov", "webm", date);
    expect(name).toBe("x-trimmed-2024-01-01-010203.webm");
  });
  it("strips base extension before generating", () => {
    const name = generateFilename("clip.webm", "mp4");
    expect(name.startsWith("clip-trimmed-")).toBe(true);
    expect(name.endsWith(".mp4")).toBe(true);
  });
});

describe("video-trimmer history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    const entry: HistoryEntry = {
      ts: 1,
      originalName: "vacation.mp4",
      originalDurationMs: 60_000,
      trimmedDurationMs: 15_000,
      outputSizeBytes: 4_000_000,
      startSeconds: 5,
      endSeconds: 20,
      bitrate: 2_500_000,
      frameRate: 30,
      resolution: "720p",
      format: "webm",
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
        originalName: `f-${i}.mp4`,
        originalDurationMs: 1,
        trimmedDurationMs: 1,
        outputSizeBytes: 1,
        startSeconds: 0,
        endSeconds: 1,
        bitrate: 1_000_000,
        frameRate: 30,
        resolution: "480p",
        format: "webm",
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears history", () => {
    saveHistory({
      ts: 1, originalName: "x", originalDurationMs: 1, trimmedDurationMs: 1,
      outputSizeBytes: 1, startSeconds: 0, endSeconds: 1, bitrate: 1_000_000,
      frameRate: 30, resolution: "480p", format: "webm",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it("orders most-recent first", () => {
    saveHistory({
      ts: 1, originalName: "a", originalDurationMs: 1, trimmedDurationMs: 1,
      outputSizeBytes: 1, startSeconds: 0, endSeconds: 1, bitrate: 1_000_000,
      frameRate: 30, resolution: "480p", format: "webm",
    });
    saveHistory({
      ts: 2, originalName: "b", originalDurationMs: 1, trimmedDurationMs: 1,
      outputSizeBytes: 1, startSeconds: 0, endSeconds: 1, bitrate: 1_000_000,
      frameRate: 30, resolution: "480p", format: "webm",
    });
    const history = loadHistory();
    expect(history[0].ts).toBe(2);
    expect(history[1].ts).toBe(1);
  });
});

describe("video-trimmer computeSummaryStats", () => {
  it("computes stats for typical trim", () => {
    const stats = computeSummaryStats(60, 15, 4_000_000);
    expect(stats.originalDurationSeconds).toBe(60);
    expect(stats.trimmedDurationSeconds).toBe(15);
    expect(stats.removedSeconds).toBe(45);
    expect(stats.removedPct).toBeCloseTo(75, 5);
    expect(stats.outputSizeBytes).toBe(4_000_000);
  });
  it("handles zero original duration", () => {
    const stats = computeSummaryStats(0, 0, 0);
    expect(stats.removedPct).toBe(0);
  });
  it("handles trim longer than original (clamps to 0)", () => {
    const stats = computeSummaryStats(5, 10, 1000);
    expect(stats.removedSeconds).toBe(0);
    expect(stats.removedPct).toBe(0);
  });
});

describe("video-trimmer shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      start: "01:30",
      end: "02:00",
      bitrate: "medium",
      frameRate: "30",
      resolution: "720p",
      fadeIn: "500ms",
      fadeOut: "1s",
      format: "webm",
    });
    expect(url).toContain("start=01%3A30");
    expect(url).toContain("end=02%3A00");
    expect(url).toContain("bitrate=medium");
    expect(url).toContain("framerate=30");
    expect(url).toContain("resolution=720p");
    expect(url).toContain("fadein=500ms");
    expect(url).toContain("fadeout=1s");
    expect(url).toContain("format=webm");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl(
      "start=01%3A30&end=02%3A00&bitrate=medium&framerate=30&resolution=720p&fadein=500ms&fadeout=1s&format=mp4",
    );
    expect(p.start).toBe("01:30");
    expect(p.end).toBe("02:00");
    expect(p.bitrate).toBe("medium");
    expect(p.frameRate).toBe("30");
    expect(p.resolution).toBe("720p");
    expect(p.fadeIn).toBe("500ms");
    expect(p.fadeOut).toBe("1s");
    expect(p.format).toBe("mp4");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("ignores unknown preset values", () => {
    const p = parseShareUrl(
      "start=5&end=10&bitrate=invalid&framerate=90&resolution=4k&fadein=invalid&fadeout=1s&format=mkv",
    );
    expect(p.start).toBe("5");
    expect(p.end).toBe("10");
    expect(p.bitrate).toBeUndefined();
    expect(p.frameRate).toBeUndefined();
    expect(p.resolution).toBeUndefined();
    expect(p.fadeIn).toBeUndefined();
    expect(p.fadeOut).toBe("1s");
    expect(p.format).toBeUndefined();
  });
  it("strips leading # from hash", () => {
    const p = parseShareUrl("#start=5&end=10");
    expect(p.start).toBe("5");
  });
  it("handles missing fields gracefully", () => {
    const p = parseShareUrl("start=5");
    expect(p.start).toBe("5");
    expect(p.end).toBeUndefined();
    expect(p.bitrate).toBeUndefined();
  });
});

// Suppress unused-import lint by re-exporting types.
export type _Unused =
  | BitratePreset
  | FrameRatePreset
  | ResolutionPreset
  | OutputFormat
  | FadePreset;
