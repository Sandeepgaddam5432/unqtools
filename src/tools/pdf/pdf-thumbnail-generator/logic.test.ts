import { describe, it, expect, beforeEach } from "vitest";
import {
  THUMBNAIL_SIZES,
  OUTPUT_FORMATS,
  BUNDLE_OUTPUTS,
  SIZE_MAX_PX,
  FORMAT_EXTENSIONS,
  FORMAT_MIME,
  PAGE_SIZE_PRESETS,
  DEFAULT_OPTIONS,
  normalizePageRangeSpec,
  resolveAllRange,
  resolvePageRange,
  normalizeHex,
  parseBackgroundColor,
  rgbToHex,
  detectOrientation,
  calculateAspectRatio,
  calculateThumbnailDimensions,
  lookupThumbnailSize,
  lookupOutputFormat,
  lookupBundleOutput,
  generateThumbnailFilename,
  extractPageDimensions,
  applyRotation,
  buildThumbnails,
  estimateThumbnailBytes,
  scoreThumbnailQuality,
  calculateSpriteGrid,
  assembleSpriteSheet,
  generateSpriteMetadata,
  computeSummaryStats,
  renderTextReport,
  renderCsvReport,
  renderJsonReport,
  crc32,
  utf8Encode,
  buildZip,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  validateOptions,
  buildReport,
  type ThumbnailOptions,
  type PageDim,
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

function makePage(pageNumber: number, width = 612, height = 792, rotation = 0): PageDim {
  return { pageNumber, width, height, rotation };
}

function makePages(count: number, width = 612, height = 792): PageDim[] {
  const out: PageDim[] = [];
  for (let i = 1; i <= count; i++) out.push(makePage(i, width, height));
  return out;
}

describe("pdf-thumbnail-generator constants", () => {
  it("has 5 thumbnail sizes", () => {
    expect(THUMBNAIL_SIZES).toHaveLength(5);
  });
  it("has 3 output formats", () => {
    expect(OUTPUT_FORMATS).toHaveLength(3);
  });
  it("has 3 bundle outputs", () => {
    expect(BUNDLE_OUTPUTS).toHaveLength(3);
  });
  it("maps sizes to max pixels (original = 0)", () => {
    expect(SIZE_MAX_PX["small-128"]).toBe(128);
    expect(SIZE_MAX_PX["medium-256"]).toBe(256);
    expect(SIZE_MAX_PX["large-512"]).toBe(512);
    expect(SIZE_MAX_PX["xlarge-1024"]).toBe(1024);
    expect(SIZE_MAX_PX["original"]).toBe(0);
  });
  it("maps formats to extensions and MIME types", () => {
    expect(FORMAT_EXTENSIONS.png).toBe("png");
    expect(FORMAT_EXTENSIONS.jpeg).toBe("jpg");
    expect(FORMAT_EXTENSIONS.webp).toBe("webp");
    expect(FORMAT_MIME.png).toBe("image/png");
    expect(FORMAT_MIME.jpeg).toBe("image/jpeg");
    expect(FORMAT_MIME.webp).toBe("image/webp");
  });
  it("has standard page-size presets", () => {
    expect(PAGE_SIZE_PRESETS.A4.width).toBeCloseTo(595.28);
    expect(PAGE_SIZE_PRESETS.Letter).toEqual({ width: 612, height: 792 });
  });
  it("default options are valid", () => {
    expect(DEFAULT_OPTIONS.thumbnailSize).toBe("medium-256");
    expect(DEFAULT_OPTIONS.outputFormat).toBe("png");
    expect(DEFAULT_OPTIONS.bundleOutput).toBe("zip");
    expect(DEFAULT_OPTIONS.pageRange).toBe("all");
  });
});

describe("pdf-thumbnail-generator page-range helpers", () => {
  it("normalizes page range spec", () => {
    expect(normalizePageRangeSpec("  1-3 , 5  ")).toBe("1-3 , 5");
  });
  it("resolves 'all' to 1-N", () => {
    expect(resolveAllRange("all", 10)).toBe("1-10");
  });
  it("resolves 'all' when pageCount is 0 to '1'", () => {
    expect(resolveAllRange("all", 0)).toBe("1");
  });
  it("resolves explicit range", () => {
    const r = resolvePageRange("2-4", 10);
    expect(r.ok).toBe(true);
    expect(r.indices).toEqual([1, 2, 3]);
  });
  it("resolves 'all' to all indices", () => {
    const r = resolvePageRange("all", 5);
    expect(r.ok).toBe(true);
    expect(r.indices).toEqual([0, 1, 2, 3, 4]);
  });
  it("rejects out-of-range page", () => {
    const r = resolvePageRange("99", 5);
    expect(r.ok).toBe(false);
  });
  it("rejects empty document", () => {
    const r = resolvePageRange("all", 0);
    expect(r.ok).toBe(false);
  });
});

describe("pdf-thumbnail-generator background-color parser", () => {
  it("normalizes hex with #", () => {
    expect(normalizeHex("ffffff")).toBe("#FFFFFF");
  });
  it("expands 3-digit hex", () => {
    expect(normalizeHex("#fff")).toBe("#FFFFFF");
  });
  it("falls back to white on invalid input", () => {
    expect(normalizeHex("xyz")).toBe("#FFFFFF");
  });
  it("falls back to white on empty", () => {
    expect(normalizeHex("")).toBe("#FFFFFF");
  });
  it("parses RGB components", () => {
    expect(parseBackgroundColor("#FF8800")).toEqual({ r: 255, g: 136, b: 0 });
  });
  it("converts RGB back to hex", () => {
    expect(rgbToHex({ r: 255, g: 136, b: 0 })).toBe("#FF8800");
  });
});

describe("pdf-thumbnail-generator orientation & aspect ratio", () => {
  it("detects portrait", () => {
    expect(detectOrientation(612, 792)).toBe("portrait");
  });
  it("detects landscape", () => {
    expect(detectOrientation(792, 612)).toBe("landscape");
  });
  it("detects square", () => {
    expect(detectOrientation(100, 100)).toBe("square");
  });
  it("detects square (near-equal)", () => {
    expect(detectOrientation(100.2, 100.1)).toBe("square");
  });
  it("computes aspect ratio", () => {
    expect(calculateAspectRatio(612, 792)).toBeCloseTo(0.7727, 3);
  });
  it("returns 0 for invalid dimensions", () => {
    expect(calculateAspectRatio(0, 100)).toBe(0);
  });
});

describe("pdf-thumbnail-generator thumbnail dimensions", () => {
  it("scales portrait to fit height (longest side)", () => {
    // 612×792, maxSize=256 → 256 is height
    const d = calculateThumbnailDimensions(612, 792, 256);
    expect(d.height).toBe(256);
    expect(d.width).toBeLessThan(256);
    expect(d.width).toBeGreaterThan(0);
  });
  it("scales landscape to fit width (longest side)", () => {
    // 792×612, maxSize=256 → 256 is width
    const d = calculateThumbnailDimensions(792, 612, 256);
    expect(d.width).toBe(256);
    expect(d.height).toBeLessThan(256);
  });
  it("returns original dims when maxSize=0", () => {
    const d = calculateThumbnailDimensions(612.5, 792.7, 0);
    expect(d.width).toBe(613);
    expect(d.height).toBe(793);
  });
  it("returns 0,0 for invalid input", () => {
    const d = calculateThumbnailDimensions(0, 100, 256);
    expect(d).toEqual({ width: 0, height: 0 });
  });
  it("ensures at least 1×1 for tiny inputs", () => {
    const d = calculateThumbnailDimensions(0.1, 0.1, 256);
    expect(d.width).toBeGreaterThanOrEqual(1);
    expect(d.height).toBeGreaterThanOrEqual(1);
  });
});

describe("pdf-thumbnail-generator lookup helpers", () => {
  it("lookupThumbnailSize returns max px", () => {
    expect(lookupThumbnailSize("small-128")).toBe(128);
    expect(lookupThumbnailSize("original")).toBe(0);
  });
  it("lookupOutputFormat returns extension + MIME", () => {
    expect(lookupOutputFormat("png")).toEqual({ extension: "png", mime: "image/png" });
    expect(lookupOutputFormat("jpeg")).toEqual({ extension: "jpg", mime: "image/jpeg" });
  });
  it("lookupBundleOutput defaults to zip on unknown", () => {
    expect(lookupBundleOutput("zip")).toBe("zip");
    expect(lookupBundleOutput("unknown" as never)).toBe("zip");
  });
});

describe("pdf-thumbnail-generator filename generator", () => {
  it("zero-pads to 3 digits by default", () => {
    expect(generateThumbnailFilename(1, "png")).toBe("page-001.png");
    expect(generateThumbnailFilename(42, "jpeg")).toBe("page-042.jpg");
  });
  it("extends padding for large page counts", () => {
    expect(generateThumbnailFilename(5, "png", 1000)).toBe("page-0005.png");
  });
  it("respects format extension", () => {
    expect(generateThumbnailFilename(1, "webp")).toBe("page-001.webp");
  });
});

describe("pdf-thumbnail-generator page-dim extractors", () => {
  it("extracts page dimensions", () => {
    const dims = extractPageDimensions([
      { pageNumber: 1, width: 612, height: 792, rotation: 0 },
      { pageNumber: 2, width: 792, height: 612, rotation: 90 },
    ]);
    expect(dims).toHaveLength(2);
    expect(dims[0]).toEqual({ pageNumber: 1, width: 612, height: 792, rotation: 0 });
    expect(dims[1].rotation).toBe(90);
  });
  it("normalizes negative rotations", () => {
    const dims = extractPageDimensions([{ pageNumber: 1, width: 100, height: 200, rotation: -90 }]);
    expect(dims[0].rotation).toBe(270);
  });
  it("applyRotation swaps dims on 90°", () => {
    const d = applyRotation(makePage(1, 612, 792, 90));
    expect(d.width).toBe(792);
    expect(d.height).toBe(612);
  });
  it("applyRotation leaves dims unchanged on 0°", () => {
    const d = applyRotation(makePage(1, 612, 792, 0));
    expect(d.width).toBe(612);
    expect(d.height).toBe(792);
  });
});

describe("pdf-thumbnail-generator buildThumbnails", () => {
  it("builds thumbnails for all pages", () => {
    const res = buildThumbnails(makePages(3), DEFAULT_OPTIONS);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.output).toHaveLength(3);
      expect(res.output[0].pageNumber).toBe(1);
      expect(res.output[0].filename).toBe("page-001.png");
      expect(res.output[0].mime).toBe("image/png");
      expect(res.output[0].orientation).toBe("portrait");
    }
  });
  it("respects page range", () => {
    const opts: ThumbnailOptions = { ...DEFAULT_OPTIONS, pageRange: "2-3" };
    const res = buildThumbnails(makePages(5), opts);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.output).toHaveLength(2);
      expect(res.output[0].pageNumber).toBe(2);
    }
  });
  it("errors on empty pages", () => {
    const res = buildThumbnails([], DEFAULT_OPTIONS);
    expect(res.ok).toBe(false);
  });
  it("errors on invalid range", () => {
    const opts: ThumbnailOptions = { ...DEFAULT_OPTIONS, pageRange: "99-100" };
    const res = buildThumbnails(makePages(5), opts);
    expect(res.ok).toBe(false);
  });
  it("applies rotation to dimensions", () => {
    const pages = [makePage(1, 612, 792, 90)];
    const res = buildThumbnails(pages, DEFAULT_OPTIONS);
    expect(res.ok).toBe(true);
    if (res.ok) {
      // After 90° rotation: 792×612 (landscape)
      expect(res.output[0].orientation).toBe("landscape");
      expect(res.output[0].originalWidth).toBe(792);
    }
  });
  it("uses original size when 'original' selected", () => {
    const opts: ThumbnailOptions = { ...DEFAULT_OPTIONS, thumbnailSize: "original" };
    const res = buildThumbnails([makePage(1, 612, 792)], opts);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.output[0].thumbnailWidth).toBe(612);
      expect(res.output[0].thumbnailHeight).toBe(792);
    }
  });
});

describe("pdf-thumbnail-generator estimateThumbnailBytes", () => {
  it("returns positive bytes for valid dims", () => {
    expect(estimateThumbnailBytes(256, 256, "png")).toBeGreaterThan(0);
  });
  it("returns 0 for invalid dims", () => {
    expect(estimateThumbnailBytes(0, 256, "png")).toBe(0);
  });
  it("PNG estimates higher than JPEG", () => {
    const png = estimateThumbnailBytes(512, 512, "png");
    const jpeg = estimateThumbnailBytes(512, 512, "jpeg");
    expect(png).toBeGreaterThan(jpeg);
  });
});

describe("pdf-thumbnail-generator scoreThumbnailQuality", () => {
  it("rewards high resolution", () => {
    const spec = {
      pageNumber: 1, originalWidth: 612, originalHeight: 792,
      thumbnailWidth: 512, thumbnailHeight: 660,
      orientation: "portrait" as const, aspectRatio: 0.77,
      filename: "page-001.png", mime: "image/png", estimatedBytes: 1000,
    };
    const s = scoreThumbnailQuality(spec, "png");
    expect(s.score).toBeGreaterThan(80);
    expect(s.reasons.length).toBeGreaterThan(0);
  });
  it("penalizes very low resolution", () => {
    const spec = {
      pageNumber: 1, originalWidth: 612, originalHeight: 792,
      thumbnailWidth: 32, thumbnailHeight: 40,
      orientation: "portrait" as const, aspectRatio: 0.77,
      filename: "page-001.png", mime: "image/png", estimatedBytes: 1000,
    };
    const s = scoreThumbnailQuality(spec, "png");
    expect(s.score).toBeLessThan(70);
  });
  it("penalizes extreme aspect ratio", () => {
    const spec = {
      pageNumber: 1, originalWidth: 100, originalHeight: 1000,
      thumbnailWidth: 100, thumbnailHeight: 1000,
      orientation: "portrait" as const, aspectRatio: 0.1,
      filename: "page-001.png", mime: "image/png", estimatedBytes: 1000,
    };
    const s = scoreThumbnailQuality(spec, "png");
    expect(s.score).toBeLessThan(100);
  });
});

describe("pdf-thumbnail-generator sprite grid calculator", () => {
  it("computes square-ish grid by default", () => {
    const g = calculateSpriteGrid(9);
    expect(g.rows * g.cols).toBeGreaterThanOrEqual(9);
    expect(g.rows).toBeLessThanOrEqual(4);
    expect(g.cols).toBeLessThanOrEqual(4);
  });
  it("respects maxCols", () => {
    const g = calculateSpriteGrid(9, { maxCols: 3, maxRows: 0, gap: 0 });
    expect(g.cols).toBe(3);
    expect(g.rows).toBe(3);
  });
  it("respects maxRows", () => {
    const g = calculateSpriteGrid(9, { maxCols: 0, maxRows: 2, gap: 0 });
    expect(g.rows).toBe(2);
    expect(g.cols).toBeGreaterThanOrEqual(5);
  });
  it("returns 0,0 for 0 thumbnails", () => {
    const g = calculateSpriteGrid(0);
    expect(g).toEqual({ rows: 0, cols: 0 });
  });
});

describe("pdf-thumbnail-generator assembleSpriteSheet", () => {
  it("computes sheet width/height with gaps", () => {
    const res = buildThumbnails(makePages(4), DEFAULT_OPTIONS);
    if (!res.ok) throw new Error("expected ok");
    const layout = assembleSpriteSheet(res.output, DEFAULT_OPTIONS, { maxCols: 2, maxRows: 0, gap: 4 });
    expect(layout.rows).toBe(2);
    expect(layout.cols).toBe(2);
    expect(layout.sheetWidth).toBe(2 * layout.cellWidth + 3 * 4);
    expect(layout.sheetHeight).toBe(2 * layout.cellHeight + 3 * 4);
    expect(layout.entries).toHaveLength(4);
  });
  it("positions entries correctly", () => {
    const res = buildThumbnails(makePages(4), DEFAULT_OPTIONS);
    if (!res.ok) throw new Error("expected ok");
    const layout = assembleSpriteSheet(res.output, DEFAULT_OPTIONS, { maxCols: 2, maxRows: 0, gap: 4 });
    expect(layout.entries[0].row).toBe(0);
    expect(layout.entries[0].col).toBe(0);
    expect(layout.entries[0].x).toBe(4);
    expect(layout.entries[0].y).toBe(4);
    expect(layout.entries[1].col).toBe(1);
    expect(layout.entries[2].row).toBe(1);
  });
  it("includes background color in layout", () => {
    const res = buildThumbnails(makePages(2), { ...DEFAULT_OPTIONS, backgroundColor: "#FF0000" });
    if (!res.ok) throw new Error("expected ok");
    const layout = assembleSpriteSheet(res.output, { ...DEFAULT_OPTIONS, backgroundColor: "#FF0000" });
    expect(layout.background).toBe("#FF0000");
  });
});

describe("pdf-thumbnail-generator generateSpriteMetadata", () => {
  it("produces valid JSON with thumbnail positions", () => {
    const res = buildThumbnails(makePages(2), DEFAULT_OPTIONS);
    if (!res.ok) throw new Error("expected ok");
    const layout = assembleSpriteSheet(res.output, DEFAULT_OPTIONS);
    const meta = generateSpriteMetadata(layout, "png");
    const parsed = JSON.parse(meta);
    expect(parsed.format).toBe("png");
    expect(parsed.thumbnails).toHaveLength(2);
    expect(parsed.thumbnails[0].page).toBe(1);
    expect(typeof parsed.thumbnails[0].x).toBe("number");
    expect(typeof parsed.thumbnails[0].y).toBe("number");
  });
});

describe("pdf-thumbnail-generator computeSummaryStats", () => {
  it("computes stats correctly", () => {
    const res = buildThumbnails(makePages(3), DEFAULT_OPTIONS);
    if (!res.ok) throw new Error("expected ok");
    const layout = assembleSpriteSheet(res.output, DEFAULT_OPTIONS);
    const stats = computeSummaryStats(res.output, layout, "png");
    expect(stats.totalThumbnails).toBe(3);
    expect(stats.totalBytes).toBeGreaterThan(0);
    expect(stats.byFormat.png).toBe(3);
    expect(stats.byFormat.jpeg).toBe(0);
    expect(stats.byOrientation.portrait).toBe(3);
    expect(stats.smallestWidth).toBeGreaterThan(0);
    expect(stats.largestWidth).toBeGreaterThan(0);
    expect(stats.sheetSize).toBe(layout.sheetWidth * layout.sheetHeight);
  });
  it("handles empty specs", () => {
    const emptyLayout: ReturnType<typeof assembleSpriteSheet> = {
      rows: 0, cols: 0, cellWidth: 0, cellHeight: 0, sheetWidth: 0, sheetHeight: 0, gap: 0, background: "#FFFFFF", entries: [],
    };
    const stats = computeSummaryStats([], emptyLayout, "png");
    expect(stats.totalThumbnails).toBe(0);
    expect(stats.smallestWidth).toBe(0);
  });
});

describe("pdf-thumbnail-generator renderers", () => {
  it("renderTextReport includes per-page info", () => {
    const res = buildThumbnails(makePages(2), DEFAULT_OPTIONS);
    if (!res.ok) throw new Error("expected ok");
    const layout = assembleSpriteSheet(res.output, DEFAULT_OPTIONS);
    const stats = computeSummaryStats(res.output, layout, "png");
    const text = renderTextReport(res.output, layout, stats);
    expect(text).toContain("PDF Thumbnail Generator");
    expect(text).toContain("Page   1");
    expect(text).toContain("Sprite sheet:");
  });
  it("renderCsvReport includes header", () => {
    const csv = renderCsvReport([]);
    expect(csv).toContain("page,width,height,aspect_ratio,orientation");
  });
  it("renderCsvReport includes page rows", () => {
    const res = buildThumbnails(makePages(2), DEFAULT_OPTIONS);
    if (!res.ok) throw new Error("expected ok");
    const csv = renderCsvReport(res.output);
    expect(csv.split("\n")).toHaveLength(3);
    expect(csv).toContain("page-001.png");
  });
  it("renderJsonReport is valid JSON with thumbnails", () => {
    const res = buildThumbnails(makePages(2), DEFAULT_OPTIONS);
    if (!res.ok) throw new Error("expected ok");
    const layout = assembleSpriteSheet(res.output, DEFAULT_OPTIONS);
    const stats = computeSummaryStats(res.output, layout, "png");
    const json = renderJsonReport(res.output, layout, stats, "png");
    const parsed = JSON.parse(json);
    expect(parsed.thumbnails).toHaveLength(2);
    expect(parsed.format).toBe("png");
    expect(parsed.stats.totalThumbnails).toBe(2);
  });
});

describe("pdf-thumbnail-generator ZIP builder", () => {
  it("computes CRC-32 correctly", () => {
    // CRC-32 of "123456789" is 0xCBF43926
    expect(crc32(utf8Encode("123456789"))).toBe(0xCBF43926);
  });
  it("builds a valid ZIP archive", () => {
    const files = [
      { name: "page-001.png", bytes: utf8Encode("dummy-png-1") },
      { name: "page-002.png", bytes: utf8Encode("dummy-png-2") },
    ];
    const zip = buildZip(files);
    // Local file header signature 0x04034b50
    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4b);
    expect(zip[2]).toBe(0x03);
    expect(zip[3]).toBe(0x04);
    // End-of-central-directory signature 0x06054b50 near end
    const len = zip.length;
    expect(zip[len - 22]).toBe(0x50);
    expect(zip[len - 21]).toBe(0x4b);
    expect(zip[len - 20]).toBe(0x05);
    expect(zip[len - 19]).toBe(0x06);
  });
  it("handles empty file list", () => {
    const zip = buildZip([]);
    expect(zip.length).toBeGreaterThan(0);
  });
});

describe("pdf-thumbnail-generator history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, fileName: "test.pdf", pageCount: 5, thumbnailsGenerated: 5,
      thumbnailSize: "medium-256", outputFormat: "png", bundleOutput: "zip",
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, fileName: `t${i}.pdf`, pageCount: 1, thumbnailsGenerated: 1,
        thumbnailSize: "small-128", outputFormat: "png", bundleOutput: "zip",
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, fileName: "test.pdf", pageCount: 1, thumbnailsGenerated: 1,
      thumbnailSize: "small-128", outputFormat: "png", bundleOutput: "zip",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("pdf-thumbnail-generator shareable URL", () => {
  it("builds share URL with all options", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl(DEFAULT_OPTIONS);
    expect(url).toContain("size=medium-256");
    expect(url).toContain("format=png");
    expect(url).toContain("bundle=zip");
    expect(url).toContain("range=all");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const opts = parseShareUrl("size=large-512&format=jpeg&range=1-3&bg=%23FF0000&bundle=individual");
    expect(opts.thumbnailSize).toBe("large-512");
    expect(opts.outputFormat).toBe("jpeg");
    expect(opts.pageRange).toBe("1-3");
    expect(opts.backgroundColor).toBe("#FF0000");
    expect(opts.bundleOutput).toBe("individual");
  });
  it("filters unknown enum values", () => {
    const opts = parseShareUrl("size=unknown&format=unknown&bundle=unknown");
    expect(opts.thumbnailSize).toBeUndefined();
    expect(opts.outputFormat).toBeUndefined();
    expect(opts.bundleOutput).toBeUndefined();
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
});

describe("pdf-thumbnail-generator validation & report", () => {
  it("validateOptions rejects bad size", () => {
    const err = validateOptions({ ...DEFAULT_OPTIONS, thumbnailSize: "bad" as never });
    expect(err).toBe("Invalid thumbnail size.");
  });
  it("validateOptions rejects bad format", () => {
    const err = validateOptions({ ...DEFAULT_OPTIONS, outputFormat: "bad" as never });
    expect(err).toBe("Invalid output format.");
  });
  it("validateOptions accepts defaults", () => {
    expect(validateOptions(DEFAULT_OPTIONS)).toBeNull();
  });
  it("buildReport returns full report", () => {
    const res = buildReport(makePages(3), DEFAULT_OPTIONS);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.output.pages).toHaveLength(3);
      expect(res.output.spriteLayout.entries).toHaveLength(3);
      expect(res.output.stats.totalThumbnails).toBe(3);
    }
  });
  it("buildReport errors on invalid options", () => {
    const res = buildReport(makePages(3), { ...DEFAULT_OPTIONS, outputFormat: "bad" as never });
    expect(res.ok).toBe(false);
  });
  it("buildReport errors on empty pages", () => {
    const res = buildReport([], DEFAULT_OPTIONS);
    expect(res.ok).toBe(false);
  });
});
