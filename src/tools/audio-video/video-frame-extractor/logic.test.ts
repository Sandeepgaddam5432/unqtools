import { describe, it, expect, beforeEach } from "vitest";
import {
  MODE_LABELS,
  INTERVAL_PRESETS,
  INTERVAL_LABELS,
  FORMAT_MIME,
  FORMAT_LABELS,
  FORMAT_EXTENSIONS,
  JPEG_QUALITY_VALUES,
  JPEG_QUALITY_LABELS,
  RESOLUTION_SCALE_VALUES,
  RESOLUTION_SCALE_LABELS,
  calculateScaledResolution,
  parseTimestamp,
  parseTimestampList,
  formatTime,
  formatTimeHMS,
  formatBytes,
  computeIntervalTimestamps,
  computeFrameCount,
  generateFrameFilename,
  validateTimestamp,
  validateTimestamps,
  buildZip,
  createZipBlob,
  computeSummaryStats,
  renderTextReport,
  renderCsvReport,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type ExtractionMode,
  type OutputFormat,
  type IntervalPreset,
  type JpegQualityPreset,
  type ResolutionScale,
  type FrameResult,
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

// ---- Constants ----

describe("video-frame-extractor constants", () => {
  it("has 3 extraction modes", () => {
    expect(Object.keys(MODE_LABELS)).toHaveLength(3);
    expect(MODE_LABELS.single).toBeDefined();
    expect(MODE_LABELS.sequence).toBeDefined();
    expect(MODE_LABELS.interval).toBeDefined();
  });
  it("has 6 interval presets", () => {
    expect(Object.keys(INTERVAL_PRESETS)).toHaveLength(6);
    expect(INTERVAL_PRESETS["1s"]).toBe(1);
    expect(INTERVAL_PRESETS["5min"]).toBe(300);
  });
  it("has 6 interval labels", () => {
    expect(Object.keys(INTERVAL_LABELS)).toHaveLength(6);
  });
  it("has 3 output formats", () => {
    expect(Object.keys(FORMAT_MIME)).toHaveLength(3);
    expect(FORMAT_MIME.png).toBe("image/png");
    expect(FORMAT_MIME.jpeg).toBe("image/jpeg");
    expect(FORMAT_MIME.webp).toBe("image/webp");
  });
  it("has format labels and extensions", () => {
    expect(Object.keys(FORMAT_LABELS)).toHaveLength(3);
    expect(FORMAT_EXTENSIONS.jpeg).toBe("jpg");
    expect(FORMAT_EXTENSIONS.png).toBe("png");
    expect(FORMAT_EXTENSIONS.webp).toBe("webp");
  });
  it("has 4 JPEG quality presets", () => {
    expect(Object.keys(JPEG_QUALITY_VALUES)).toHaveLength(4);
    expect(JPEG_QUALITY_VALUES["50%"]).toBe(0.5);
    expect(JPEG_QUALITY_VALUES["100%"]).toBe(1.0);
  });
  it("has 4 JPEG quality labels", () => {
    expect(Object.keys(JPEG_QUALITY_LABELS)).toHaveLength(4);
  });
  it("has 3 resolution scales", () => {
    expect(Object.keys(RESOLUTION_SCALE_VALUES)).toHaveLength(3);
    expect(RESOLUTION_SCALE_VALUES.full).toBe(1);
    expect(RESOLUTION_SCALE_VALUES.half).toBe(0.5);
    expect(RESOLUTION_SCALE_VALUES.quarter).toBe(0.25);
  });
  it("has 3 resolution scale labels", () => {
    expect(Object.keys(RESOLUTION_SCALE_LABELS)).toHaveLength(3);
  });
});

// ---- Resolution calculator ----

describe("video-frame-extractor calculateScaledResolution", () => {
  it("full = source size", () => {
    const r = calculateScaledResolution(1920, 1080, "full");
    expect(r).toEqual({ width: 1920, height: 1080 });
  });
  it("half = 50% rounded", () => {
    const r = calculateScaledResolution(1920, 1080, "half");
    expect(r).toEqual({ width: 960, height: 540 });
  });
  it("quarter = 25% rounded", () => {
    const r = calculateScaledResolution(1920, 1080, "quarter");
    expect(r).toEqual({ width: 480, height: 270 });
  });
  it("handles odd dimensions (rounds up to min 1)", () => {
    const r = calculateScaledResolution(3, 3, "quarter");
    expect(r.width).toBeGreaterThanOrEqual(1);
    expect(r.height).toBeGreaterThanOrEqual(1);
  });
  it("returns 0×0 for invalid input", () => {
    expect(calculateScaledResolution(0, 0, "full")).toEqual({ width: 0, height: 0 });
    expect(calculateScaledResolution(-100, 100, "half")).toEqual({ width: 0, height: 0 });
  });
});

// ---- Timestamp parsing ----

describe("video-frame-extractor parseTimestamp (4 formats)", () => {
  it("parses plain seconds", () => {
    expect(parseTimestamp("12")).toBe(12);
  });
  it("parses decimal seconds", () => {
    expect(parseTimestamp("12.5")).toBe(12.5);
  });
  it("parses MM:SS", () => {
    expect(parseTimestamp("01:30")).toBe(90);
  });
  it("parses MM:SS.ms", () => {
    expect(parseTimestamp("01:30.250")).toBeCloseTo(90.25, 3);
  });
  it("parses HH:MM:SS", () => {
    expect(parseTimestamp("01:02:03")).toBe(3723);
  });
  it("parses HH:MM:SS.ms", () => {
    expect(parseTimestamp("01:02:03.500")).toBeCloseTo(3723.5, 3);
  });
  it("rejects invalid MM:SS with sec >= 60", () => {
    expect(Number.isNaN(parseTimestamp("01:60"))).toBe(true);
  });
  it("rejects invalid HH:MM:SS with min >= 60", () => {
    expect(Number.isNaN(parseTimestamp("01:60:00"))).toBe(true);
  });
  it("rejects garbage", () => {
    expect(Number.isNaN(parseTimestamp("abc"))).toBe(true);
    expect(Number.isNaN(parseTimestamp(""))).toBe(true);
  });
  it("trims whitespace", () => {
    expect(parseTimestamp("  12  ")).toBe(12);
  });
});

describe("video-frame-extractor parseTimestampList", () => {
  it("parses comma-separated timestamps", () => {
    expect(parseTimestampList("0:00, 1:30, 3:45")).toEqual([0, 90, 225]);
  });
  it("parses newline-separated timestamps", () => {
    expect(parseTimestampList("10\n20\n30")).toEqual([10, 20, 30]);
  });
  it("parses whitespace-separated timestamps", () => {
    expect(parseTimestampList("5 10 15")).toEqual([5, 10, 15]);
  });
  it("parses semicolon-separated timestamps", () => {
    expect(parseTimestampList("5; 10; 15")).toEqual([5, 10, 15]);
  });
  it("sorts and dedupes", () => {
    expect(parseTimestampList("30, 10, 10, 20, 20")).toEqual([10, 20, 30]);
  });
  it("skips invalid entries", () => {
    expect(parseTimestampList("10, abc, 20, xyz, 30")).toEqual([10, 20, 30]);
  });
  it("returns empty for empty input", () => {
    expect(parseTimestampList("")).toEqual([]);
  });
});

// ---- Time formatting ----

describe("video-frame-extractor formatters", () => {
  it("formatTime formats MM:SS.ms", () => {
    expect(formatTime(90.25)).toBe("01:30.250");
  });
  it("formatTime handles zero and negative", () => {
    expect(formatTime(0)).toBe("00:00.000");
    expect(formatTime(-5)).toBe("00:00.000");
  });
  it("formatTimeHMS formats HH:MM:SS", () => {
    expect(formatTimeHMS(3661)).toBe("01:01:01");
  });
  it("formatBytes formats B/KB/MB/GB", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(1024)).toBe("1.00 KB");
    expect(formatBytes(1048576)).toBe("1.00 MB");
    expect(formatBytes(1073741824)).toBe("1.00 GB");
  });
  it("formatBytes handles 0 and negative", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(-100)).toBe("0 B");
  });
});

// ---- Interval / frame count ----

describe("video-frame-extractor computeIntervalTimestamps", () => {
  it("computes timestamps for 60s video, 10s interval", () => {
    const ts = computeIntervalTimestamps(60, 10);
    expect(ts).toEqual([10, 20, 30, 40, 50]);
  });
  it("computes timestamps for 5s video, 1s interval", () => {
    const ts = computeIntervalTimestamps(5, 1);
    expect(ts).toEqual([1, 2, 3, 4]);
  });
  it("does NOT include t=0 by default", () => {
    const ts = computeIntervalTimestamps(10, 5);
    expect(ts).toEqual([5]);
    expect(ts).not.toContain(0);
  });
  it("includes t=0 when includeStart=true", () => {
    const ts = computeIntervalTimestamps(10, 5, { includeStart: true });
    expect(ts).toEqual([0, 5]);
  });
  it("returns empty for invalid inputs", () => {
    expect(computeIntervalTimestamps(0, 10)).toEqual([]);
    expect(computeIntervalTimestamps(10, 0)).toEqual([]);
    expect(computeIntervalTimestamps(-1, 10)).toEqual([]);
  });
  it("handles totalDuration exactly equal to a multiple of interval", () => {
    // 30s video, 10s interval → 10, 20 (NOT 30, which is == totalDuration)
    const ts = computeIntervalTimestamps(30, 10);
    expect(ts).toEqual([10, 20]);
  });
});

describe("video-frame-extractor computeFrameCount", () => {
  it("counts frames for 60s video, 10s interval", () => {
    expect(computeFrameCount(60, 10)).toBe(5);
  });
  it("counts frames for 5s video, 1s interval", () => {
    expect(computeFrameCount(5, 1)).toBe(4);
  });
  it("returns 0 for invalid inputs", () => {
    expect(computeFrameCount(0, 10)).toBe(0);
    expect(computeFrameCount(10, 0)).toBe(0);
  });
  it("counts with includeStart", () => {
    expect(computeFrameCount(10, 5, { includeStart: true })).toBe(2);
  });
});

// ---- Filename generator ----

describe("video-frame-extractor generateFrameFilename", () => {
  it("generates zero-padded PNG filename", () => {
    expect(generateFrameFilename(0, 5, "png")).toBe("frame-001.png");
    expect(generateFrameFilename(4, 5, "png")).toBe("frame-005.png");
  });
  it("uses .jpg extension for JPEG", () => {
    expect(generateFrameFilename(0, 5, "jpeg")).toBe("frame-001.jpg");
  });
  it("uses .webp extension for WebP", () => {
    expect(generateFrameFilename(0, 5, "webp")).toBe("frame-001.webp");
  });
  it("widens padding for >999 frames", () => {
    expect(generateFrameFilename(0, 1500, "png")).toBe("frame-0001.png");
    expect(generateFrameFilename(1499, 1500, "png")).toBe("frame-1500.png");
  });
  it("respects custom prefix", () => {
    expect(generateFrameFilename(0, 5, "png", "shot")).toBe("shot-001.png");
  });
});

// ---- Validation ----

describe("video-frame-extractor validateTimestamp", () => {
  it("accepts valid timestamp within range", () => {
    expect(validateTimestamp(5, 100).ok).toBe(true);
  });
  it("rejects negative", () => {
    expect(validateTimestamp(-1, 100).ok).toBe(false);
  });
  it("rejects NaN", () => {
    expect(validateTimestamp(NaN, 100).ok).toBe(false);
  });
  it("rejects timestamp >= total duration", () => {
    const r = validateTimestamp(100, 100);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("exceeds");
  });
  it("accepts timestamp = 0", () => {
    expect(validateTimestamp(0, 100).ok).toBe(true);
  });
});

describe("video-frame-extractor validateTimestamps", () => {
  it("accepts all valid timestamps", () => {
    const r = validateTimestamps([5, 10, 20], 100);
    expect(r.ok).toBe(true);
    expect(r.valid).toEqual([5, 10, 20]);
  });
  it("rejects empty list", () => {
    expect(validateTimestamps([], 100).ok).toBe(false);
  });
  it("rejects any invalid timestamp", () => {
    const r = validateTimestamps([5, 200, 20], 100);
    expect(r.ok).toBe(false);
    expect(r.valid).toEqual([]);
  });
});

// ---- ZIP builder ----

describe("video-frame-extractor buildZip", () => {
  it("builds a non-empty ZIP from one file", () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const zip = buildZip([{ name: "frame-001.png", data }]);
    expect(zip.length).toBeGreaterThan(22);
    // Local file header signature 0x04034b50 (little-endian)
    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4b);
    expect(zip[2]).toBe(0x03);
    expect(zip[3]).toBe(0x04);
  });
  it("builds a valid empty ZIP (EOCD only) when no files", () => {
    const zip = buildZip([]);
    expect(zip.length).toBe(22);
    // EOCD signature 0x06054b50 (little-endian)
    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4b);
    expect(zip[2]).toBe(0x05);
    expect(zip[3]).toBe(0x06);
  });
  it("builds a ZIP with multiple files", () => {
    const zip = buildZip([
      { name: "a.png", data: new Uint8Array([1]) },
      { name: "b.png", data: new Uint8Array([2, 3]) },
      { name: "c.png", data: new Uint8Array([4, 5, 6]) },
    ]);
    expect(zip.length).toBeGreaterThan(22);
  });
  it("createZipBlob returns a Blob with ZIP mime type", () => {
    const blob = createZipBlob([{ name: "x.png", data: new Uint8Array([1, 2]) }]);
    expect(blob.type).toBe("application/zip");
    expect(blob.size).toBeGreaterThan(0);
  });
  it("throws on file > 4 GB", () => {
    // We can't actually allocate 4 GB in a test, so mock the data length check
    const fakeFile = { name: "big.png", data: { length: 0x100000000 } as unknown as Uint8Array };
    expect(() => buildZip([fakeFile])).toThrow(/exceeds 4 GB/);
  });
});

// ---- Summary stats ----

describe("video-frame-extractor computeSummaryStats", () => {
  const frames: FrameResult[] = [
    { index: 0, timestampSeconds: 1, filename: "frame-001.png", sizeBytes: 1000, mimeType: "image/png" },
    { index: 1, timestampSeconds: 2, filename: "frame-002.png", sizeBytes: 2000, mimeType: "image/png" },
    { index: 2, timestampSeconds: 3, filename: "frame-003.png", sizeBytes: 3000, mimeType: "image/png" },
  ];
  it("computes total frames, size, avg", () => {
    const s = computeSummaryStats(frames, "interval", "png", 1920, 1080);
    expect(s.totalFrames).toBe(3);
    expect(s.totalSizeBytes).toBe(6000);
    expect(s.avgFrameSizeBytes).toBe(2000);
    expect(s.mode).toBe("interval");
    expect(s.format).toBe("png");
    expect(s.width).toBe(1920);
    expect(s.height).toBe(1080);
  });
  it("handles empty frames list", () => {
    const s = computeSummaryStats([], "single", "jpeg", 640, 480);
    expect(s.totalFrames).toBe(0);
    expect(s.totalSizeBytes).toBe(0);
    expect(s.avgFrameSizeBytes).toBe(0);
  });
});

// ---- Text + CSV reports ----

describe("video-frame-extractor renderTextReport", () => {
  const frames: FrameResult[] = [
    { index: 0, timestampSeconds: 1, filename: "frame-001.png", sizeBytes: 1000, mimeType: "image/png" },
    { index: 1, timestampSeconds: 2, filename: "frame-002.png", sizeBytes: 2000, mimeType: "image/png" },
  ];
  const summary = computeSummaryStats(frames, "interval", "png", 1920, 1080);
  it("includes source file and settings", () => {
    const txt = renderTextReport(frames, summary, "movie.mp4");
    expect(txt).toContain("movie.mp4");
    expect(txt).toContain("Interval");
    expect(txt).toContain("PNG (lossless)");
    expect(txt).toContain("1920×1080");
  });
  it("includes summary stats", () => {
    const txt = renderTextReport(frames, summary, "movie.mp4");
    expect(txt).toContain("Total frames  : 2");
    expect(txt).toContain("Total size");
  });
  it("includes frame list", () => {
    const txt = renderTextReport(frames, summary, "movie.mp4");
    expect(txt).toContain("frame-001.png");
    expect(txt).toContain("frame-002.png");
  });
  it("handles empty frame list", () => {
    const emptySummary = computeSummaryStats([], "single", "png", 1920, 1080);
    const txt = renderTextReport([], emptySummary, "x.mp4");
    expect(txt).toContain("(no frames)");
  });
});

describe("video-frame-extractor renderCsvReport", () => {
  const frames: FrameResult[] = [
    { index: 0, timestampSeconds: 1, filename: "frame-001.png", sizeBytes: 1000, mimeType: "image/png" },
    { index: 1, timestampSeconds: 2.5, filename: "frame-002.png", sizeBytes: 2000, mimeType: "image/png" },
  ];
  const summary = computeSummaryStats(frames, "interval", "png", 1920, 1080);
  it("includes header rows", () => {
    const csv = renderCsvReport(frames, summary, "movie.mp4");
    expect(csv).toContain("field,value");
    expect(csv).toContain("source_file,movie.mp4");
    expect(csv).toContain("mode,interval");
    expect(csv).toContain("format,png");
    expect(csv).toContain("total_frames,2");
  });
  it("includes per-frame rows", () => {
    const csv = renderCsvReport(frames, summary, "movie.mp4");
    expect(csv).toContain("frame_number,timestamp_seconds,timestamp_formatted,filename,size_bytes,mime_type");
    expect(csv).toContain("frame-001.png");
    expect(csv).toContain("2.500");
    expect(csv).toContain("image/png");
  });
  it("escapes commas in filenames", () => {
    const weirdFrames: FrameResult[] = [
      { index: 0, timestampSeconds: 1, filename: "my,frame.png", sizeBytes: 100, mimeType: "image/png" },
    ];
    const csv = renderCsvReport(weirdFrames, summary, "movie.mp4");
    expect(csv).toContain('"my,frame.png"');
  });
});

// ---- History ----

describe("video-frame-extractor history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, originalName: "a.mp4", mode: "single", format: "png",
      scale: "full", frameCount: 1, totalOutputBytes: 1000,
    } as HistoryEntry);
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].originalName).toBe("a.mp4");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, originalName: `f${i}.mp4`, mode: "interval", format: "png",
        scale: "half", frameCount: 10, totalOutputBytes: 5000,
      } as HistoryEntry);
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, originalName: "a.mp4", mode: "single", format: "png",
      scale: "full", frameCount: 1, totalOutputBytes: 1000,
    } as HistoryEntry);
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

// ---- Shareable URL ----

describe("video-frame-extractor shareable URL", () => {
  const sample = {
    mode: "interval" as ExtractionMode,
    timestamp: "01:30",
    timestamps: "0:00, 1:30, 3:45",
    intervalPreset: "10s" as IntervalPreset,
    customInterval: "",
    format: "jpeg" as OutputFormat,
    jpegQuality: "90%" as JpegQualityPreset,
    scale: "half" as ResolutionScale,
  };
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(sample);
    expect(url).toContain("mode=interval");
    expect(url).toContain("iv=10s");
    expect(url).toContain("fmt=jpeg");
    expect(url).toContain("q=90%25"); // % is URL-encoded
    expect(url).toContain("sc=half");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const url = buildShareUrl(sample);
    const hash = url.includes("#") ? url.slice(url.indexOf("#")) : url;
    const p = parseShareUrl(hash);
    expect(p.mode).toBe("interval");
    expect(p.intervalPreset).toBe("10s");
    expect(p.format).toBe("jpeg");
    expect(p.jpegQuality).toBe("90%");
    expect(p.scale).toBe("half");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown modes", () => {
    const p = parseShareUrl("mode=unknown");
    expect(p.mode).toBeUndefined();
  });
  it("filters unknown formats", () => {
    const p = parseShareUrl("fmt=gif");
    expect(p.format).toBeUndefined();
  });
  it("filters unknown intervals", () => {
    const p = parseShareUrl("iv=2s");
    expect(p.intervalPreset).toBeUndefined();
  });
  it("filters unknown scales", () => {
    const p = parseShareUrl("sc=tiny");
    expect(p.scale).toBeUndefined();
  });
  it("parses timestamp and timestamps fields", () => {
    const p = parseShareUrl("mode=single&t=01:30&ts=0:00,1:30");
    expect(p.timestamp).toBe("01:30");
    expect(p.timestamps).toBe("0:00,1:30");
  });
  it("parses customInterval field", () => {
    const p = parseShareUrl("civ=2.5");
    expect(p.customInterval).toBe("2.5");
  });
});

// Suppress unused-import lint
export type _Unused = HistoryEntry;
