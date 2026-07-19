import { describe, it, expect, beforeEach } from "vitest";
import {
  SIZE_PRESETS,
  PLATFORMS,
  PLATFORM_LABELS,
  OUTPUT_FORMATS,
  OUTPUT_FORMAT_LABELS,
  QUALITY_PRESETS,
  QUALITY_LABELS,
  QUALITY_VALUES,
  CROP_MODES,
  CROP_MODE_LABELS,
  listPresets,
  listPresetsByPlatform,
  getPreset,
  computeCanvasDimensions,
  computeCropRect,
  getMimeType,
  getExtension,
  getQualityValue,
  detectOrientation,
  computeAspectRatio,
  computeMetadata,
  estimateFileSize,
  scoreQuality,
  computeStats,
  renderText,
  renderCsv,
  formatBytes,
  buildZip,
  createZipBlob,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Platform,
  type Format,
  type OutputFormat,
  type QualityPreset,
  type CropMode,
  type ResizeResult,
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

// Helper to build a sample ResizeResult for tests.
function makeResult(
  platform: Platform,
  format: Format,
  width: number,
  height: number,
  estimatedSize = 100_000,
): ResizeResult {
  const preset = getPreset(format)!;
  return {
    format,
    platform,
    label: preset.label,
    width,
    height,
    outputFormat: "jpeg",
    quality: "90",
    cropMode: "fill",
    estimatedSize,
  };
}

describe("sm-image-resizer constants", () => {
  it("has 18 size presets", () => {
    expect(SIZE_PRESETS).toHaveLength(18);
  });

  it("has 6 platforms with labels", () => {
    expect(PLATFORMS).toHaveLength(6);
    expect(Object.keys(PLATFORM_LABELS)).toHaveLength(6);
    expect(PLATFORMS).toContain("instagram");
    expect(PLATFORMS).toContain("tiktok");
  });

  it("has 3 output formats", () => {
    expect(OUTPUT_FORMATS).toHaveLength(3);
    expect(Object.keys(OUTPUT_FORMAT_LABELS)).toHaveLength(3);
  });

  it("has 4 quality presets", () => {
    expect(QUALITY_PRESETS).toHaveLength(4);
    expect(Object.keys(QUALITY_VALUES)).toHaveLength(4);
    expect(Object.keys(QUALITY_LABELS)).toHaveLength(4);
  });

  it("has 2 crop modes", () => {
    expect(CROP_MODES).toHaveLength(2);
    expect(Object.keys(CROP_MODE_LABELS)).toHaveLength(2);
  });

  it("every preset has valid platform and dimensions", () => {
    for (const p of SIZE_PRESETS) {
      expect(PLATFORMS).toContain(p.platform);
      expect(p.width).toBeGreaterThan(0);
      expect(p.height).toBeGreaterThan(0);
      expect(p.label.length).toBeGreaterThan(0);
    }
  });

  it("presets cover Instagram 1080×1080 square", () => {
    const sq = getPreset("ig-square");
    expect(sq).toBeDefined();
    expect(sq!.width).toBe(1080);
    expect(sq!.height).toBe(1080);
  });

  it("presets cover YouTube thumbnail 1280×720", () => {
    const yt = getPreset("yt-thumbnail");
    expect(yt).toBeDefined();
    expect(yt!.width).toBe(1280);
    expect(yt!.height).toBe(720);
  });
});

describe("sm-image-resizer listPresets / listPresetsByPlatform", () => {
  it("listPresets returns 18 entries", () => {
    expect(listPresets()).toHaveLength(18);
  });

  it("instagram has 4 presets", () => {
    expect(listPresetsByPlatform("instagram")).toHaveLength(4);
  });

  it("twitter has 3 presets", () => {
    expect(listPresetsByPlatform("twitter")).toHaveLength(3);
  });

  it("facebook has 3 presets", () => {
    expect(listPresetsByPlatform("facebook")).toHaveLength(3);
  });

  it("linkedin has 3 presets", () => {
    expect(listPresetsByPlatform("linkedin")).toHaveLength(3);
  });

  it("youtube has 3 presets", () => {
    expect(listPresetsByPlatform("youtube")).toHaveLength(3);
  });

  it("tiktok has 2 presets", () => {
    expect(listPresetsByPlatform("tiktok")).toHaveLength(2);
  });

  it("getPreset returns undefined for unknown format", () => {
    expect(getPreset("nonexistent" as Format)).toBeUndefined();
  });
});

describe("sm-image-resizer computeCanvasDimensions", () => {
  it("returns preset width and height", () => {
    const preset = getPreset("ig-square")!;
    const dims = computeCanvasDimensions(preset);
    expect(dims.width).toBe(1080);
    expect(dims.height).toBe(1080);
  });
});

describe("sm-image-resizer computeCropRect (fill mode)", () => {
  it("crops width when source is wider than target", () => {
    // Source 2000×1000 (2:1), target 1000×1000 (1:1) — should crop width.
    const r = computeCropRect(2000, 1000, 1000, 1000, "fill");
    expect(r.sw).toBe(1000);
    expect(r.sh).toBe(1000);
    expect(r.sx).toBe(500); // centered crop
    expect(r.sy).toBe(0);
    expect(r.dw).toBe(1000);
    expect(r.dh).toBe(1000);
  });

  it("crops height when source is taller than target", () => {
    // Source 1000×2000 (1:2), target 1000×1000 (1:1) — should crop height.
    const r = computeCropRect(1000, 2000, 1000, 1000, "fill");
    expect(r.sw).toBe(1000);
    expect(r.sh).toBe(1000);
    expect(r.sx).toBe(0);
    expect(r.sy).toBe(500); // centered crop
  });

  it("does not crop when aspect ratios match", () => {
    // Source 2000×1000 (2:1), target 1000×500 (2:1) — no crop.
    const r = computeCropRect(2000, 1000, 1000, 500, "fill");
    expect(r.sw).toBe(2000);
    expect(r.sh).toBe(1000);
    expect(r.sx).toBe(0);
    expect(r.sy).toBe(0);
    expect(r.dw).toBe(1000);
    expect(r.dh).toBe(500);
  });

  it("returns zeros for zero inputs", () => {
    const r = computeCropRect(0, 0, 100, 100, "fill");
    expect(r.sw).toBe(0);
    expect(r.sh).toBe(0);
    expect(r.dw).toBe(0);
    expect(r.dh).toBe(0);
  });
});

describe("sm-image-resizer computeCropRect (fit mode)", () => {
  it("pads top/bottom when source is wider than target", () => {
    // Source 2000×1000 (2:1), target 1000×1000 (1:1) — fit scales to 1000×500.
    const r = computeCropRect(2000, 1000, 1000, 1000, "fit");
    expect(r.sw).toBe(2000); // whole source
    expect(r.sh).toBe(1000);
    expect(r.dw).toBe(1000);
    expect(r.dh).toBe(500);
    expect(r.dx).toBe(0);
    expect(r.dy).toBe(250); // centered vertical padding
  });

  it("pads left/right when source is taller than target", () => {
    // Source 1000×2000 (1:2), target 1000×1000 (1:1) — fit scales to 500×1000.
    const r = computeCropRect(1000, 2000, 1000, 1000, "fit");
    expect(r.dw).toBe(500);
    expect(r.dh).toBe(1000);
    expect(r.dx).toBe(250); // centered horizontal padding
    expect(r.dy).toBe(0);
  });

  it("no padding when aspect ratios match", () => {
    // Source 2000×1000 (2:1), target 1000×500 (2:1) — exact fit.
    const r = computeCropRect(2000, 1000, 1000, 500, "fit");
    expect(r.dw).toBe(1000);
    expect(r.dh).toBe(500);
    expect(r.dx).toBe(0);
    expect(r.dy).toBe(0);
  });
});

describe("sm-image-resizer getMimeType / getExtension / getQualityValue", () => {
  it("getMimeType returns correct MIME types", () => {
    expect(getMimeType("jpeg")).toBe("image/jpeg");
    expect(getMimeType("png")).toBe("image/png");
    expect(getMimeType("webp")).toBe("image/webp");
  });

  it("getExtension returns correct extensions", () => {
    expect(getExtension("jpeg")).toBe("jpg");
    expect(getExtension("png")).toBe("png");
    expect(getExtension("webp")).toBe("webp");
  });

  it("getQualityValue returns 0..1 values", () => {
    expect(getQualityValue("50")).toBe(0.5);
    expect(getQualityValue("75")).toBe(0.75);
    expect(getQualityValue("90")).toBe(0.9);
    expect(getQualityValue("100")).toBe(1.0);
  });
});

describe("sm-image-resizer detectOrientation", () => {
  it("detects square", () => {
    expect(detectOrientation(100, 100)).toBe("square");
  });
  it("detects landscape", () => {
    expect(detectOrientation(1920, 1080)).toBe("landscape");
  });
  it("detects portrait", () => {
    expect(detectOrientation(1080, 1920)).toBe("portrait");
  });
});

describe("sm-image-resizer computeAspectRatio", () => {
  it("computes 1:1 for square", () => {
    const ar = computeAspectRatio(1080, 1080);
    expect(ar.simplified).toBe("1:1");
    expect(ar.ratio).toBe(1);
  });

  it("computes 16:9 for 1920×1080", () => {
    const ar = computeAspectRatio(1920, 1080);
    expect(ar.simplified).toBe("16:9");
    expect(ar.ratio).toBeCloseTo(16 / 9, 2);
  });

  it("computes 9:16 for 1080×1920", () => {
    const ar = computeAspectRatio(1080, 1920);
    expect(ar.simplified).toBe("9:16");
  });

  it("computes 4:3 for 800×600", () => {
    const ar = computeAspectRatio(800, 600);
    expect(ar.simplified).toBe("4:3");
  });

  it("handles zero dimensions", () => {
    const ar = computeAspectRatio(0, 0);
    expect(ar.ratio).toBe(0);
    expect(ar.simplified).toBe("0:0");
  });
});

describe("sm-image-resizer computeMetadata", () => {
  it("builds a complete metadata object", () => {
    const m = computeMetadata(1920, 1080, 500_000, "image/jpeg");
    expect(m.width).toBe(1920);
    expect(m.height).toBe(1080);
    expect(m.fileSize).toBe(500_000);
    expect(m.format).toBe("image/jpeg");
    expect(m.orientation).toBe("landscape");
    expect(m.aspectRatio).toBe("16:9");
    expect(m.aspectRatioValue).toBeCloseTo(16 / 9, 2);
  });
});

describe("sm-image-resizer estimateFileSize", () => {
  it("returns > 0 for valid inputs", () => {
    expect(estimateFileSize(1080, 1080, "jpeg", "90")).toBeGreaterThan(0);
  });

  it("returns 0 for zero dimensions", () => {
    expect(estimateFileSize(0, 0, "jpeg", "90")).toBe(0);
  });

  it("higher quality produces larger files (jpeg)", () => {
    const q50 = estimateFileSize(1080, 1080, "jpeg", "50");
    const q100 = estimateFileSize(1080, 1080, "jpeg", "100");
    expect(q100).toBeGreaterThan(q50);
  });

  it("larger dimensions produce larger files", () => {
    const small = estimateFileSize(400, 400, "jpeg", "90");
    const large = estimateFileSize(1080, 1080, "jpeg", "90");
    expect(large).toBeGreaterThan(small);
  });

  it("webp is smaller than jpeg at same quality", () => {
    const jpg = estimateFileSize(1080, 1080, "jpeg", "90");
    const webp = estimateFileSize(1080, 1080, "webp", "90");
    expect(webp).toBeLessThan(jpg);
  });
});

describe("sm-image-resizer scoreQuality", () => {
  it("returns 0 for zero dimensions", () => {
    expect(scoreQuality(0, 0, "jpeg", "90")).toBe(0);
  });

  it("returns higher score for larger images", () => {
    const small = scoreQuality(400, 400, "jpeg", "90");
    const large = scoreQuality(1920, 1080, "jpeg", "90");
    expect(large).toBeGreaterThan(small);
  });

  it("returns higher score for png than jpeg@50", () => {
    const png = scoreQuality(1080, 1080, "png", "100");
    const jpg50 = scoreQuality(1080, 1080, "jpeg", "50");
    expect(png).toBeGreaterThan(jpg50);
  });

  it("score is between 0 and 100", () => {
    const s = scoreQuality(1080, 1080, "jpeg", "90");
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });
});

describe("sm-image-resizer computeStats", () => {
  it("computes total and per-platform counts", () => {
    const results = [
      makeResult("instagram", "ig-square", 1080, 1080, 100_000),
      makeResult("instagram", "ig-portrait", 1080, 1350, 150_000),
      makeResult("twitter", "tw-post", 1200, 675, 80_000),
    ];
    const stats = computeStats(results);
    expect(stats.total).toBe(3);
    expect(stats.byPlatform.instagram).toBe(2);
    expect(stats.byPlatform.twitter).toBe(1);
    expect(stats.byPlatform.facebook).toBe(0);
    expect(stats.totalEstimatedSize).toBe(330_000);
  });

  it("returns zero stats for empty input", () => {
    const stats = computeStats([]);
    expect(stats.total).toBe(0);
    expect(stats.totalEstimatedSize).toBe(0);
  });
});

describe("sm-image-resizer renderText", () => {
  it("returns empty string for empty input", () => {
    expect(renderText([])).toBe("");
  });

  it("includes labels and stats footer", () => {
    const results = [
      makeResult("instagram", "ig-square", 1080, 1080, 100_000),
    ];
    const text = renderText(results);
    expect(text).toContain("Instagram Square");
    expect(text).toContain("1080×1080");
    expect(text).toContain("Total outputs: 1");
    expect(text).toContain("Instagram: 1");
  });
});

describe("sm-image-resizer renderCsv", () => {
  it("renders header", () => {
    const csv = renderCsv([]);
    expect(csv).toContain("platform,format,width,height,output_format,quality,crop_mode,estimated_size_bytes");
  });

  it("renders rows", () => {
    const results = [
      makeResult("instagram", "ig-square", 1080, 1080, 100_000),
    ];
    const csv = renderCsv(results);
    expect(csv).toContain("instagram");
    expect(csv).toContain("ig-square");
    expect(csv).toContain("1080");
    expect(csv.split("\n")).toHaveLength(2);
  });
});

describe("sm-image-resizer formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(500)).toBe("500 B");
  });
  it("formats kilobytes", () => {
    expect(formatBytes(1500)).toBe("1.5 KB");
  });
  it("formats megabytes", () => {
    expect(formatBytes(1_500_000)).toBe("1.43 MB");
  });
  it("formats gigabytes", () => {
    expect(formatBytes(1_500_000_000)).toBe("1.40 GB");
  });
  it("handles zero and negative", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(-1)).toBe("0 B");
  });
});

describe("sm-image-resizer buildZip / createZipBlob", () => {
  it("returns valid empty ZIP (22-byte EOCD) for no files", () => {
    const zip = buildZip([]);
    expect(zip.length).toBe(22);
    // EOCD signature 0x06054b50
    const view = new DataView(zip.buffer);
    expect(view.getUint32(0, true)).toBe(0x06054b50);
  });

  it("builds non-empty ZIP with entries", () => {
    const files = [
      { name: "a.txt", data: new Uint8Array([65, 66, 67]) },
      { name: "b.txt", data: new Uint8Array([88, 89, 90]) },
    ];
    const zip = buildZip(files);
    expect(zip.length).toBeGreaterThan(22);
    // Should contain both filenames
    const text = new TextDecoder().decode(zip);
    expect(text).toContain("a.txt");
    expect(text).toContain("b.txt");
  });

  it("createZipBlob returns a Blob with correct MIME", () => {
    const blob = createZipBlob([{ name: "x.txt", data: new Uint8Array([1]) }]);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("application/zip");
    expect(blob.size).toBeGreaterThan(0);
  });

  it("throws on filename too long (>65535 bytes)", () => {
    const longName = "a".repeat(70_000);
    expect(() => buildZip([{ name: longName, data: new Uint8Array([1]) }])).toThrow();
  });
});

describe("sm-image-resizer history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });

  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      fileName: "photo.jpg",
      fileSize: 500_000,
      width: 1920,
      height: 1080,
      platforms: ["instagram"],
      formats: ["ig-square"],
      outputFormat: "jpeg",
      quality: "90",
      cropMode: "fill",
      totalOutputs: 1,
      totalEstimatedSize: 100_000,
    });
    const h = loadHistory();
    expect(h).toHaveLength(1);
    expect(h[0].fileName).toBe("photo.jpg");
  });

  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        fileName: `f${i}.jpg`,
        fileSize: 100,
        width: 100,
        height: 100,
        platforms: [],
        formats: [],
        outputFormat: "jpeg",
        quality: "90",
        cropMode: "fill",
        totalOutputs: 0,
        totalEstimatedSize: 0,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });

  it("clears", () => {
    saveHistory({
      ts: 1, fileName: "x.jpg", fileSize: 1, width: 1, height: 1,
      platforms: [], formats: [], outputFormat: "jpeg", quality: "90",
      cropMode: "fill", totalOutputs: 0, totalEstimatedSize: 0,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("sm-image-resizer shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(["ig-square", "tw-post"], "webp", "75", "fit");
    expect(url).toContain("fmts=ig-square%2Ctw-post");
    expect(url).toContain("of=webp");
    expect(url).toContain("q=75");
    expect(url).toContain("crop=fit");
    (globalThis as Record<string, unknown>).window = origWindow;
  });

  it("omits empty formats list", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl([], "jpeg", "90", "fill");
    expect(url).not.toContain("fmts=");
    (globalThis as Record<string, unknown>).window = origWindow;
  });

  it("parses share URL back", () => {
    const parsed = parseShareUrl("fmts=ig-square%2Ctw-post&of=webp&q=75&crop=fit");
    expect(parsed.formats).toEqual(["ig-square", "tw-post"]);
    expect(parsed.outputFormat).toBe("webp");
    expect(parsed.quality).toBe("75");
    expect(parsed.cropMode).toBe("fit");
  });

  it("handles empty hash with defaults", () => {
    const parsed = parseShareUrl("");
    expect(parsed.formats).toEqual([]);
    expect(parsed.outputFormat).toBe("jpeg");
    expect(parsed.quality).toBe("90");
    expect(parsed.cropMode).toBe("fill");
  });

  it("filters unknown formats", () => {
    const parsed = parseShareUrl("fmts=ig-square%2Cunknown-format");
    expect(parsed.formats).toEqual(["ig-square"]);
  });

  it("filters unknown output format", () => {
    const parsed = parseShareUrl("of=invalid&q=90");
    expect(parsed.outputFormat).toBe("jpeg");
  });

  it("filters unknown quality", () => {
    const parsed = parseShareUrl("q=999");
    expect(parsed.quality).toBe("90");
  });

  it("treats unknown crop mode as fill", () => {
    const parsed = parseShareUrl("crop=invalid");
    expect(parsed.cropMode).toBe("fill");
  });

  it("strips leading hash", () => {
    const parsed = parseShareUrl("#of=png");
    expect(parsed.outputFormat).toBe("png");
  });
});

// Suppress unused-import lint
export type _Unused = Platform | Format | OutputFormat | QualityPreset | CropMode | ResizeResult;
