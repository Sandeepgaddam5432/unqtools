import { describe, it, expect, beforeEach } from "vitest";
import {
  BITRATE_PRESETS,
  BITRATE_LABELS,
  RESOLUTION_HEIGHTS,
  RESOLUTION_LABELS,
  FRAMERATE_PRESETS,
  FRAMERATE_LABELS,
  FORMAT_MIME,
  FORMAT_EXTENSIONS,
  FORMAT_LABELS,
  FORMAT_FALLBACK_ORDER,
  CODEC_MIME,
  CODEC_LABELS,
  computeResolution,
  roundEven,
  estimateFileSizeBytes,
  formatBytes,
  computeCompressionRatio,
  computeQualityScore,
  qualityLabel,
  isFormatEncodable,
  detectEncodableFormats,
  pickDefaultOutputFormat,
  isCodecSupported,
  detectSupportedCodecs,
  stripExtension,
  generateFilename,
  computeSummaryStats,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type BitratePreset,
  type ResolutionPreset,
  type FrameRatePreset,
  type OutputFormat,
  type VideoCodec,
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

describe("video-compressor presets", () => {
  it("has 4 bitrate presets with correct bps", () => {
    expect(Object.keys(BITRATE_PRESETS)).toHaveLength(4);
    expect(BITRATE_PRESETS["very-low"]).toBe(500_000);
    expect(BITRATE_PRESETS.low).toBe(1_000_000);
    expect(BITRATE_PRESETS.medium).toBe(2_500_000);
    expect(BITRATE_PRESETS.high).toBe(5_000_000);
  });
  it("has 4 bitrate labels", () => {
    expect(Object.keys(BITRATE_LABELS)).toHaveLength(4);
    expect(BITRATE_LABELS["very-low"]).toContain("500 kbps");
    expect(BITRATE_LABELS.high).toContain("5 Mbps");
  });
  it("has 5 resolution presets with correct heights", () => {
    expect(Object.keys(RESOLUTION_HEIGHTS)).toHaveLength(5);
    expect(RESOLUTION_HEIGHTS["240p"]).toBe(240);
    expect(RESOLUTION_HEIGHTS["360p"]).toBe(360);
    expect(RESOLUTION_HEIGHTS["480p"]).toBe(480);
    expect(RESOLUTION_HEIGHTS["720p"]).toBe(720);
    expect(RESOLUTION_HEIGHTS["1080p"]).toBe(1080);
  });
  it("has 5 resolution labels", () => {
    expect(Object.keys(RESOLUTION_LABELS)).toHaveLength(5);
    expect(RESOLUTION_LABELS["720p"]).toContain("HD");
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
  it("has 4 codec MIME entries", () => {
    expect(Object.keys(CODEC_MIME)).toHaveLength(4);
    expect(CODEC_MIME.vp8).toContain("vp8");
    expect(CODEC_MIME.vp9).toContain("vp9");
    expect(CODEC_MIME.h264).toContain("h264");
    expect(CODEC_MIME.av1).toContain("av01");
  });
  it("has 4 codec labels", () => {
    expect(Object.keys(CODEC_LABELS)).toHaveLength(4);
    expect(CODEC_LABELS.h264).toContain("H.264");
  });
});

describe("video-compressor computeResolution", () => {
  it("downscales 1080p source to 720p with aspect ratio preserved", () => {
    const r = computeResolution("720p", 1920, 1080);
    expect(r.height).toBe(720);
    expect(r.width).toBe(1280);
  });
  it("downscales 1080p source to 480p", () => {
    const r = computeResolution("480p", 1920, 1080);
    expect(r.height).toBe(480);
    // 1920 / 1080 * 480 = 853.33 → roundEven = 854
    expect(r.width).toBe(854);
  });
  it("downscales 1080p source to 360p", () => {
    const r = computeResolution("360p", 1920, 1080);
    expect(r.height).toBe(360);
    // 1920 / 1080 * 360 = 640
    expect(r.width).toBe(640);
  });
  it("downscales 1080p source to 240p", () => {
    const r = computeResolution("240p", 1920, 1080);
    expect(r.height).toBe(240);
    // 1920 / 1080 * 240 = 426.67 → roundEven = 428
    expect(r.width).toBe(428);
  });
  it("does not upscale when source is smaller than target", () => {
    const r = computeResolution("1080p", 640, 360);
    expect(r.height).toBe(360);
    expect(r.width).toBe(640);
  });
  it("returns 0,0 when source dims are 0", () => {
    const r = computeResolution("720p", 0, 0);
    expect(r.width).toBe(0);
    expect(r.height).toBe(0);
  });
  it("handles 4:3 source (1440×1080 → 480p)", () => {
    const r = computeResolution("480p", 1440, 1080);
    expect(r.height).toBe(480);
    // 1440 / 1080 * 480 = 640
    expect(r.width).toBe(640);
  });
});

describe("video-compressor roundEven", () => {
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

describe("video-compressor estimateFileSizeBytes", () => {
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
  it("computes very-low bitrate size correctly", () => {
    // 500 kbps * 60 sec / 8 = 3_750_000
    expect(estimateFileSizeBytes(500_000, 60)).toBe(3_750_000);
  });
});

describe("video-compressor formatBytes", () => {
  it("formats 0 bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });
  it("formats KB", () => {
    expect(formatBytes(2048)).toBe("2.00 KB");
  });
  it("formats MB", () => {
    expect(formatBytes(1_500_000)).toBe("1.43 MB");
  });
  it("formats GB", () => {
    expect(formatBytes(1_073_741_824)).toBe("1.00 GB");
  });
});

describe("video-compressor computeCompressionRatio", () => {
  it("computes ratio of 4 for 4:1 compression", () => {
    const r = computeCompressionRatio(40_000_000, 10_000_000);
    expect(r.ratio).toBeCloseTo(4, 5);
    expect(r.reductionPct).toBeCloseTo(75, 5);
    expect(r.savedBytes).toBe(30_000_000);
  });
  it("returns 0 ratio when input is 0", () => {
    const r = computeCompressionRatio(0, 100);
    expect(r.ratio).toBe(0);
    expect(r.reductionPct).toBe(0);
    expect(r.savedBytes).toBe(0);
  });
  it("returns 0 ratio when output is 0", () => {
    const r = computeCompressionRatio(100, 0);
    expect(r.ratio).toBe(0);
    expect(r.savedBytes).toBe(0);
  });
  it("returns 0 saved bytes when output >= input (no compression)", () => {
    const r = computeCompressionRatio(100, 200);
    expect(r.savedBytes).toBe(0);
    expect(r.reductionPct).toBe(0);
  });
  it("computes 2:1 ratio correctly", () => {
    const r = computeCompressionRatio(20_000_000, 10_000_000);
    expect(r.ratio).toBeCloseTo(2, 5);
    expect(r.reductionPct).toBeCloseTo(50, 5);
  });
});

describe("video-compressor computeQualityScore", () => {
  it("returns high score for high bitrate + 1080p + 60fps", () => {
    const score = computeQualityScore({
      bitrate: 5_000_000, width: 1920, height: 1080, frameRate: 60,
    });
    // bitrateScore = 1, resScore = 1 → base = 100; +5 fps bonus = 105 → clamped 100
    expect(score).toBe(100);
  });
  it("returns low score for very-low bitrate + 240p + 24fps", () => {
    const score = computeQualityScore({
      bitrate: 500_000, width: 426, height: 240, frameRate: 24,
    });
    // bitrateScore = 0, resScore = 0 → base = 0; -3 fps = -3 → clamped 0
    expect(score).toBe(0);
  });
  it("returns mid score for medium bitrate + 720p + 30fps", () => {
    const score = computeQualityScore({
      bitrate: 2_500_000, width: 1280, height: 720, frameRate: 30,
    });
    // bitrateScore = (2.5M - 500k) / 4.5M = 0.444...
    // resScore = (720 - 240) / 840 = 0.5714...
    // base = 0.5 * 0.4444 + 0.5 * 0.5714 = 0.5079 → 50.79
    // no fps bonus (30 = 0)
    // → 51
    expect(score).toBeGreaterThanOrEqual(50);
    expect(score).toBeLessThanOrEqual(52);
  });
  it("clamps bitrate above 5Mbps", () => {
    const score = computeQualityScore({
      bitrate: 100_000_000, width: 1920, height: 1080, frameRate: 30,
    });
    expect(score).toBeLessThanOrEqual(100);
  });
  it("clamps bitrate below 500kbps", () => {
    const score = computeQualityScore({
      bitrate: 10_000, width: 1920, height: 1080, frameRate: 30,
    });
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThanOrEqual(0);
  });
  it("applies +5 bonus for 60fps", () => {
    const baseScore = computeQualityScore({
      bitrate: 1_000_000, width: 1280, height: 720, frameRate: 30,
    });
    const fpsBonus = computeQualityScore({
      bitrate: 1_000_000, width: 1280, height: 720, frameRate: 60,
    });
    expect(fpsBonus - baseScore).toBeGreaterThanOrEqual(4);
  });
});

describe("video-compressor qualityLabel", () => {
  it("labels 90+ as Excellent", () => {
    expect(qualityLabel(95)).toBe("Excellent");
  });
  it("labels 70-84 as Good", () => {
    expect(qualityLabel(75)).toBe("Good");
  });
  it("labels 50-69 as Fair", () => {
    expect(qualityLabel(60)).toBe("Fair");
  });
  it("labels 30-49 as Low", () => {
    expect(qualityLabel(40)).toBe("Low");
  });
  it("labels <30 as Poor", () => {
    expect(qualityLabel(20)).toBe("Poor");
  });
});

describe("video-compressor format support lookup", () => {
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

describe("video-compressor codec support lookup", () => {
  it("returns false when MediaRecorder is undefined", () => {
    const orig = (globalThis as Record<string, unknown>).MediaRecorder;
    (globalThis as Record<string, unknown>).MediaRecorder = undefined;
    expect(isCodecSupported("vp8")).toBe(false);
    expect(isCodecSupported("vp9")).toBe(false);
    expect(isCodecSupported("h264")).toBe(false);
    expect(isCodecSupported("av1")).toBe(false);
    (globalThis as Record<string, unknown>).MediaRecorder = orig;
  });
  it("uses MediaRecorder.isTypeSupported for codec MIME", () => {
    const orig = (globalThis as Record<string, unknown>).MediaRecorder;
    let calledWith: string[] = [];
    (globalThis as Record<string, unknown>).MediaRecorder = {
      isTypeSupported: (m: string) => {
        calledWith.push(m);
        return m.includes("vp9");
      },
    };
    expect(isCodecSupported("vp9")).toBe(true);
    expect(isCodecSupported("vp8")).toBe(false);
    expect(calledWith).toContain("video/webm;codecs=vp9");
    expect(calledWith).toContain("video/webm;codecs=vp8");
    (globalThis as Record<string, unknown>).MediaRecorder = orig;
  });
  it("detectSupportedCodecs returns only supported codecs", () => {
    const orig = (globalThis as Record<string, unknown>).MediaRecorder;
    (globalThis as Record<string, unknown>).MediaRecorder = {
      isTypeSupported: (m: string) => m.includes("vp9") || m.includes("h264"),
    };
    const supported = detectSupportedCodecs();
    expect(supported).toContain("vp9");
    expect(supported).toContain("h264");
    expect(supported).not.toContain("vp8");
    expect(supported).not.toContain("av1");
    (globalThis as Record<string, unknown>).MediaRecorder = orig;
  });
});

describe("video-compressor stripExtension", () => {
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

describe("video-compressor generateFilename", () => {
  it("generates timestamped filename with base name", () => {
    const date = new Date(2024, 0, 5, 14, 23, 7);
    const name = generateFilename("vacation.mp4", "webm", date);
    expect(name).toBe("vacation-compressed-2024-01-05-142307.webm");
  });
  it("uses 'compressed' stem when no base name", () => {
    const date = new Date(2024, 5, 1, 9, 8, 7);
    const name = generateFilename(null, "mp4", date);
    expect(name).toBe("compressed-2024-06-01-090807.mp4");
  });
  it("pads single-digit fields", () => {
    const date = new Date(2024, 0, 1, 1, 2, 3);
    const name = generateFilename("x.mov", "webm", date);
    expect(name).toBe("x-compressed-2024-01-01-010203.webm");
  });
  it("strips base extension before generating", () => {
    const name = generateFilename("clip.webm", "mp4");
    expect(name.startsWith("clip-compressed-")).toBe(true);
    expect(name.endsWith(".mp4")).toBe(true);
  });
});

describe("video-compressor computeSummaryStats", () => {
  it("computes full summary for typical compression", () => {
    const stats = computeSummaryStats(
      40_000_000, 10_000_000, 60, 75, 2_500_000, 1280, 720, 30, "webm",
    );
    expect(stats.inputSizeBytes).toBe(40_000_000);
    expect(stats.outputSizeBytes).toBe(10_000_000);
    expect(stats.savedBytes).toBe(30_000_000);
    expect(stats.reductionPct).toBeCloseTo(75, 5);
    expect(stats.ratio).toBeCloseTo(4, 5);
    expect(stats.qualityScore).toBe(75);
    expect(stats.durationSeconds).toBe(60);
    expect(stats.outputBitrate).toBe(2_500_000);
    expect(stats.outputResolution).toBe("1280×720");
    expect(stats.outputFrameRate).toBe(30);
    expect(stats.outputFormat).toBe("webm");
  });
  it("handles zero input gracefully", () => {
    const stats = computeSummaryStats(0, 0, 0, 0, 0, 0, 0, 0, "webm");
    expect(stats.savedBytes).toBe(0);
    expect(stats.ratio).toBe(0);
  });
  it("handles output >= input (no compression)", () => {
    const stats = computeSummaryStats(100, 200, 1, 50, 0, 0, 0, 0, "mp4");
    expect(stats.savedBytes).toBe(0);
    expect(stats.reductionPct).toBe(0);
  });
});

describe("video-compressor history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    const entry: HistoryEntry = {
      ts: 1,
      originalName: "vacation.mp4",
      inputSizeBytes: 40_000_000,
      outputSizeBytes: 10_000_000,
      reductionPct: 75,
      ratio: 4,
      qualityScore: 75,
      durationSeconds: 60,
      bitrate: 2_500_000,
      resolution: "1280×720",
      frameRate: 30,
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
        inputSizeBytes: 1,
        outputSizeBytes: 1,
        reductionPct: 0,
        ratio: 1,
        qualityScore: 0,
        durationSeconds: 1,
        bitrate: 500_000,
        resolution: "240p",
        frameRate: 24,
        format: "webm",
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears history", () => {
    saveHistory({
      ts: 1, originalName: "x", inputSizeBytes: 1, outputSizeBytes: 1,
      reductionPct: 0, ratio: 1, qualityScore: 0, durationSeconds: 1,
      bitrate: 500_000, resolution: "240p", frameRate: 24, format: "webm",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it("orders most-recent first", () => {
    saveHistory({
      ts: 1, originalName: "a", inputSizeBytes: 1, outputSizeBytes: 1,
      reductionPct: 0, ratio: 1, qualityScore: 0, durationSeconds: 1,
      bitrate: 500_000, resolution: "240p", frameRate: 24, format: "webm",
    });
    saveHistory({
      ts: 2, originalName: "b", inputSizeBytes: 1, outputSizeBytes: 1,
      reductionPct: 0, ratio: 1, qualityScore: 0, durationSeconds: 1,
      bitrate: 500_000, resolution: "240p", frameRate: 24, format: "webm",
    });
    const history = loadHistory();
    expect(history[0].ts).toBe(2);
    expect(history[1].ts).toBe(1);
  });
});

describe("video-compressor shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      bitrate: "medium",
      frameRate: "30",
      resolution: "720p",
      format: "webm",
    });
    expect(url).toContain("bitrate=medium");
    expect(url).toContain("framerate=30");
    expect(url).toContain("resolution=720p");
    expect(url).toContain("format=webm");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl(
      "bitrate=low&framerate=24&resolution=480p&format=mp4",
    );
    expect(p.bitrate).toBe("low");
    expect(p.frameRate).toBe("24");
    expect(p.resolution).toBe("480p");
    expect(p.format).toBe("mp4");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("ignores unknown preset values", () => {
    const p = parseShareUrl(
      "bitrate=invalid&framerate=90&resolution=4k&format=mkv",
    );
    expect(p.bitrate).toBeUndefined();
    expect(p.frameRate).toBeUndefined();
    expect(p.resolution).toBeUndefined();
    expect(p.format).toBeUndefined();
  });
  it("strips leading # from hash", () => {
    const p = parseShareUrl("#bitrate=low&resolution=480p");
    expect(p.bitrate).toBe("low");
    expect(p.resolution).toBe("480p");
  });
  it("handles missing fields gracefully", () => {
    const p = parseShareUrl("bitrate=low");
    expect(p.bitrate).toBe("low");
    expect(p.frameRate).toBeUndefined();
    expect(p.resolution).toBeUndefined();
    expect(p.format).toBeUndefined();
  });
});

// Suppress unused-import lint by re-exporting types.
export type _Unused =
  | BitratePreset
  | ResolutionPreset
  | FrameRatePreset
  | OutputFormat
  | VideoCodec;
