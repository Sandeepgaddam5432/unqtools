import { describe, it, expect, beforeEach } from "vitest";
import {
  OPTIMIZATION_LEVELS,
  LEVEL_LABELS,
  TARGET_DPI_OPTIONS,
  LEVEL_DEFAULTS,
  DEFAULT_OPTIONS,
  EMPTY_METADATA,
  STANDARD_FONT_NAMES,
  lookupLevel,
  isTargetDpi,
  normalizeTargetDpi,
  applyLevelToOptions,
  analyzeSize,
  estimateMetadataBytes,
  downsampleImage,
  downsampleAllImages,
  detectUnusedObjects,
  unusedObjectSavings,
  recompressStream,
  recompressAllStreams,
  stripMetadata,
  metadataSavings,
  planFontSubset,
  planAllFontSubsets,
  fontSubsetSavings,
  computeReduction,
  recommendOptimization,
  assessQualityImpact,
  analyzeImages,
  analyzeFonts,
  rankOptimizationPriorities,
  buildOptimizationReport,
  renderTextReport,
  renderCsvReport,
  renderJsonReport,
  formatBytes,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  validateOptions,
  type OptimizerOptions,
  type ImageInfo,
  type FontInfo,
  type StreamInfo,
  type ObjectRef,
  type PdfMetadata,
  type OptimizationLevel,
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

function makeImage(over: Partial<ImageInfo> = {}): ImageInfo {
  return {
    id: "img-1",
    width: 1000,
    height: 1000,
    originalDpi: 300,
    colorSpace: "DeviceRGB",
    filter: "DCTDecode",
    bytes: 100_000,
    ...over,
  };
}

function makeFont(over: Partial<FontInfo> = {}): FontInfo {
  return {
    id: "f-1",
    name: "Helvetica",
    isStandard: true,
    isSubsetted: false,
    bytes: 0,
    ...over,
  };
}

function makeStream(over: Partial<StreamInfo> = {}): StreamInfo {
  return {
    id: "s-1",
    type: "content",
    filter: "FlateDecode",
    bytes: 1000,
    isCompressed: true,
    ...over,
  };
}

describe("pdf-size-optimizer constants", () => {
  it("has 4 optimization levels", () => {
    expect(OPTIMIZATION_LEVELS).toHaveLength(4);
    expect(OPTIMIZATION_LEVELS).toEqual(["safe", "balanced", "aggressive", "maximum"]);
  });
  it("has labels for every level", () => {
    for (const lvl of OPTIMIZATION_LEVELS) {
      expect(LEVEL_LABELS[lvl]).toBeTruthy();
    }
  });
  it("has 4 target DPI options", () => {
    expect(TARGET_DPI_OPTIONS).toEqual([72, 96, 150, 300]);
  });
  it("has level defaults for every level", () => {
    for (const lvl of OPTIMIZATION_LEVELS) {
      const d = LEVEL_DEFAULTS[lvl];
      expect(d).toBeTruthy();
      expect(typeof d.downsampleImages).toBe("boolean");
      expect(typeof d.subsetFonts).toBe("boolean");
    }
  });
  it("safe level does not downsample or strip metadata", () => {
    expect(LEVEL_DEFAULTS.safe.downsampleImages).toBe(false);
    expect(LEVEL_DEFAULTS.safe.removeMetadata).toBe(false);
  });
  it("maximum level downsamples and strips metadata", () => {
    expect(LEVEL_DEFAULTS.maximum.downsampleImages).toBe(true);
    expect(LEVEL_DEFAULTS.maximum.removeMetadata).toBe(true);
  });
  it("default options are balanced", () => {
    expect(DEFAULT_OPTIONS.optimizationLevel).toBe("balanced");
  });
  it("has 14 standard font names", () => {
    expect(STANDARD_FONT_NAMES.size).toBe(14);
  });
});

describe("pdf-size-optimizer lookup helpers", () => {
  it("looks up level defaults", () => {
    expect(lookupLevel("safe").downsampleImages).toBe(false);
    expect(lookupLevel("maximum").removeMetadata).toBe(true);
    expect(lookupLevel("nonexistent" as OptimizationLevel)).toEqual(LEVEL_DEFAULTS.balanced);
  });
  it("isTargetDpi narrows type correctly", () => {
    expect(isTargetDpi(72)).toBe(true);
    expect(isTargetDpi(100)).toBe(false);
  });
  it("normalizeTargetDpi falls back to 150", () => {
    expect(normalizeTargetDpi(100)).toBe(150);
    expect(normalizeTargetDpi(72)).toBe(72);
  });
  it("applyLevelToOptions sets the level and overrides settings", () => {
    const opts: OptimizerOptions = { ...DEFAULT_OPTIONS };
    const applied = applyLevelToOptions(opts, "aggressive");
    expect(applied.optimizationLevel).toBe("aggressive");
    expect(applied.downsampleImages).toBe(true);
    expect(applied.removeUnusedObjects).toBe(true);
  });
});

describe("pdf-size-optimizer analyzeSize", () => {
  it("computes per-component breakdown", () => {
    const images = [makeImage({ bytes: 500_000 })];
    const fonts = [makeFont({ name: "EmbeddedFont", isStandard: false, bytes: 200_000 })];
    const streams = [makeStream({ bytes: 100_000 })];
    const meta: PdfMetadata = {
      title: "Doc", author: "Auth", subject: "Sub",
      keywords: ["a", "b"], creator: "C", producer: "P",
    };
    const b = analyzeSize(1_000_000, images, fonts, streams, meta);
    expect(b.totalBytes).toBe(1_000_000);
    expect(b.imagesBytes).toBe(500_000);
    expect(b.fontsBytes).toBe(200_000);
    expect(b.streamsBytes).toBe(100_000);
    expect(b.imagesPercent).toBe(50);
    expect(b.metadataBytes).toBeGreaterThan(0);
    expect(b.otherBytes).toBeGreaterThan(0);
  });
  it("handles empty content", () => {
    const b = analyzeSize(0, [], [], [], EMPTY_METADATA);
    expect(b.totalBytes).toBe(0);
    expect(b.imagesBytes).toBe(0);
    expect(b.imagesPercent).toBe(0);
  });
});

describe("pdf-size-optimizer estimateMetadataBytes", () => {
  it("returns 0 content bytes for empty metadata (6 fields × 10 overhead = 60 total)", () => {
    // 6 fields × 10-byte overhead each, plus 0 content bytes
    expect(estimateMetadataBytes(EMPTY_METADATA)).toBe(60);
  });
  it("accounts for unicode chars", () => {
    const meta: PdfMetadata = { ...EMPTY_METADATA, title: "日本語" };
    const bytes = estimateMetadataBytes(meta);
    // 3 chars × 3 bytes = 9 content bytes; +10 overhead for the title field
    // +50 overhead for the 5 empty fields = 69 total
    expect(bytes).toBe(69);
  });
});

describe("pdf-size-optimizer downsampleImage", () => {
  it("skips when image already at or below target DPI", () => {
    const img = makeImage({ originalDpi: 72 });
    const r = downsampleImage(img, 150);
    expect(r.skipped).toBe(true);
    expect(r.savingsBytes).toBe(0);
  });
  it("scales linearly when downsampled", () => {
    const img = makeImage({ width: 1000, height: 1000, originalDpi: 300, bytes: 100_000 });
    const r = downsampleImage(img, 150);
    expect(r.skipped).toBe(false);
    expect(r.newWidth).toBe(500);
    expect(r.newHeight).toBe(500);
    expect(r.newBytes).toBe(25_000);
    expect(r.savingsBytes).toBe(75_000);
    expect(r.savingsPercent).toBe(75);
  });
  it("uses 300 DPI assumption when original DPI unknown", () => {
    const img = makeImage({ originalDpi: 0 });
    const r = downsampleImage(img, 72);
    expect(r.skipped).toBe(false);
    expect(r.newWidth).toBe(240);
  });
  it("handles invalid dimensions", () => {
    const img = makeImage({ width: 0, height: 0 });
    const r = downsampleImage(img, 72);
    expect(r.skipped).toBe(true);
  });
});

describe("pdf-size-optimizer downsampleAllImages", () => {
  it("aggregates across images", () => {
    const images = [
      makeImage({ id: "a", originalDpi: 300, bytes: 100_000 }),
      makeImage({ id: "b", originalDpi: 72, bytes: 10_000 }),
    ];
    const r = downsampleAllImages(images, 150);
    expect(r.downsampledCount).toBe(1);
    expect(r.skippedCount).toBe(1);
    expect(r.totalSavingsBytes).toBe(75_000);
  });
});

describe("pdf-size-optimizer unused objects", () => {
  it("detects unreferenced non-catalog/page objects", () => {
    const objs: ObjectRef[] = [
      { id: 1, referenced: true, bytes: 100, type: "catalog" },
      { id: 2, referenced: true, bytes: 200, type: "page" },
      { id: 3, referenced: false, bytes: 500, type: "image" },
      { id: 4, referenced: false, bytes: 50, type: "other" },
    ];
    const unused = detectUnusedObjects(objs);
    expect(unused).toHaveLength(2);
    expect(unusedObjectSavings(unused)).toBe(550);
  });
  it("never marks catalog or page as unused", () => {
    const objs: ObjectRef[] = [
      { id: 1, referenced: false, bytes: 100, type: "catalog" },
      { id: 2, referenced: false, bytes: 200, type: "page" },
    ];
    expect(detectUnusedObjects(objs)).toHaveLength(0);
  });
});

describe("pdf-size-optimizer recompressStream", () => {
  it("skips empty streams", () => {
    const r = recompressStream(makeStream({ bytes: 0 }));
    expect(r.skipped).toBe(true);
  });
  it("gives ~3% savings for already-compressed streams", () => {
    const r = recompressStream(makeStream({ bytes: 1000, isCompressed: true }));
    expect(r.skipped).toBe(false);
    expect(r.savingsPercent).toBe(3);
    expect(r.savingsBytes).toBe(30);
  });
  it("gives ~50% savings for uncompressed streams", () => {
    const r = recompressStream(makeStream({ bytes: 1000, isCompressed: false, filter: "" }));
    expect(r.savingsPercent).toBe(50);
    expect(r.newBytes).toBe(500);
  });
  it("aggregates across streams", () => {
    const streams = [
      makeStream({ id: "a", bytes: 1000, isCompressed: true }),
      makeStream({ id: "b", bytes: 1000, isCompressed: false }),
    ];
    const r = recompressAllStreams(streams);
    expect(r.recompressedCount).toBe(2);
    expect(r.skippedCount).toBe(0);
    expect(r.totalSavingsBytes).toBe(530);
  });
});

describe("pdf-size-optimizer metadata stripper", () => {
  it("returns empty metadata", () => {
    const meta: PdfMetadata = {
      title: "X", author: "Y", subject: "Z",
      keywords: ["k"], creator: "C", producer: "P",
    };
    expect(stripMetadata(meta)).toEqual(EMPTY_METADATA);
  });
  it("metadataSavings equals estimateMetadataBytes", () => {
    const meta: PdfMetadata = { ...EMPTY_METADATA, title: "Hello" };
    expect(metadataSavings(meta)).toBe(estimateMetadataBytes(meta));
  });
});

describe("pdf-size-optimizer font subset planning", () => {
  it("skips standard fonts", () => {
    const f = makeFont({ name: "Helvetica", isStandard: true });
    expect(planFontSubset(f).skipped).toBe(true);
  });
  it("skips already-subsetted fonts", () => {
    const f = makeFont({ name: "Custom", isStandard: false, isSubsetted: true, bytes: 50_000 });
    expect(planFontSubset(f).skipped).toBe(true);
  });
  it("skips tiny embedded fonts", () => {
    const f = makeFont({ name: "Custom", isStandard: false, isSubsetted: false, bytes: 500 });
    expect(planFontSubset(f).skipped).toBe(true);
  });
  it("estimates 70% savings for embedded fonts", () => {
    const f = makeFont({ name: "Custom", isStandard: false, isSubsetted: false, bytes: 50_000 });
    const p = planFontSubset(f);
    expect(p.skipped).toBe(false);
    expect(p.savingsPercent).toBe(70);
    expect(p.estimatedSubsetBytes).toBe(15_000);
    expect(p.savingsBytes).toBe(35_000);
  });
  it("aggregates savings across fonts", () => {
    const fonts = [
      makeFont({ id: "a", name: "Custom1", isStandard: false, bytes: 50_000 }),
      makeFont({ id: "b", name: "Helvetica", isStandard: true, bytes: 0 }),
      makeFont({ id: "c", name: "Custom2", isStandard: false, bytes: 100_000 }),
    ];
    const plans = planAllFontSubsets(fonts);
    expect(plans).toHaveLength(3);
    expect(fontSubsetSavings(plans)).toBe(105_000); // 70% of 150k
  });
});

describe("pdf-size-optimizer computeReduction", () => {
  it("computes percentage correctly", () => {
    const r = computeReduction(1000, 250);
    expect(r.savingsBytes).toBe(750);
    expect(r.savingsPercent).toBe(75);
  });
  it("clamps negative savings to zero", () => {
    const r = computeReduction(100, 200);
    expect(r.savingsBytes).toBe(0);
    expect(r.savingsPercent).toBe(0);
  });
  it("handles zero original size", () => {
    const r = computeReduction(0, 0);
    expect(r.savingsPercent).toBe(0);
  });
});

describe("pdf-size-optimizer recommendOptimization", () => {
  it("recommends aggressive when images dominate", () => {
    const rec = recommendOptimization({
      totalBytes: 1_000_000,
      imageCount: 5,
      imagesBytes: 700_000,
      fontCount: 1,
      fontsBytes: 50_000,
      streamCount: 10,
      streamsBytes: 100_000,
      pageCount: 5,
    });
    expect(rec.level).toBe("aggressive");
    expect(rec.reasons.length).toBeGreaterThan(0);
  });
  it("recommends balanced when fonts are significant", () => {
    const rec = recommendOptimization({
      totalBytes: 1_000_000,
      imageCount: 0,
      imagesBytes: 0,
      fontCount: 5,
      fontsBytes: 400_000,
      streamCount: 10,
      streamsBytes: 100_000,
      pageCount: 5,
    });
    expect(rec.level).toBe("balanced");
  });
  it("defaults to safe for tiny files", () => {
    const rec = recommendOptimization({
      totalBytes: 0,
      imageCount: 0, imagesBytes: 0,
      fontCount: 0, fontsBytes: 0,
      streamCount: 0, streamsBytes: 0,
      pageCount: 0,
    });
    expect(rec.level).toBe("safe");
  });
});

describe("pdf-size-optimizer assessQualityImpact", () => {
  it("reports impacts for lossy options", () => {
    const opts: OptimizerOptions = {
      optimizationLevel: "maximum",
      downsampleImages: true,
      targetDpi: 96,
      removeUnusedObjects: true,
      removeMetadata: true,
      compressStreams: true,
      subsetFonts: true,
    };
    const impacts = assessQualityImpact(opts);
    expect(impacts.length).toBe(5);
    expect(impacts.some((s) => s.includes("96 DPI"))).toBe(true);
  });
  it("reports fewer impacts for safe options", () => {
    const opts: OptimizerOptions = {
      optimizationLevel: "safe",
      downsampleImages: false,
      targetDpi: 150,
      removeUnusedObjects: false,
      removeMetadata: false,
      compressStreams: true,
      subsetFonts: false,
    };
    const impacts = assessQualityImpact(opts);
    expect(impacts).toHaveLength(1);
    expect(impacts[0]).toContain("lossless");
  });
});

describe("pdf-size-optimizer analyzeImages / analyzeFonts", () => {
  it("summarizes image stats", () => {
    const images = [
      makeImage({ id: "a", colorSpace: "DeviceRGB", filter: "DCTDecode", bytes: 100 }),
      makeImage({ id: "b", colorSpace: "DeviceRGB", filter: "FlateDecode", bytes: 200 }),
      makeImage({ id: "c", colorSpace: "DeviceGray", filter: "DCTDecode", bytes: 50 }),
    ];
    const a = analyzeImages(images);
    expect(a.total).toBe(3);
    expect(a.totalBytes).toBe(350);
    expect(a.avgBytes).toBe(117);
    expect(a.largestBytes).toBe(200);
    expect(a.smallestBytes).toBe(50);
    expect(a.byColorSpace["DeviceRGB"]).toBe(2);
    expect(a.byColorSpace["DeviceGray"]).toBe(1);
    expect(a.byFilter["DCTDecode"]).toBe(2);
  });
  it("summarizes font stats", () => {
    const fonts = [
      makeFont({ id: "a", name: "Helvetica", isStandard: true, bytes: 0 }),
      makeFont({ id: "b", name: "Custom", isStandard: false, isSubsetted: true, bytes: 10_000 }),
      makeFont({ id: "c", name: "Other", isStandard: false, isSubsetted: false, bytes: 20_000 }),
    ];
    const a = analyzeFonts(fonts);
    expect(a.total).toBe(3);
    expect(a.embedded).toBe(2);
    expect(a.standard).toBe(1);
    expect(a.subsetted).toBe(1);
    expect(a.totalBytes).toBe(30_000);
    expect(a.largestBytes).toBe(20_000);
  });
});

describe("pdf-size-optimizer rankOptimizationPriorities", () => {
  it("orders by biggest savings first", () => {
    const images = [makeImage({ id: "a", originalDpi: 300, bytes: 500_000 })];
    const fonts = [makeFont({ id: "f", name: "Custom", isStandard: false, bytes: 100_000 })];
    const streams = [makeStream({ id: "s", bytes: 1_000, isCompressed: true })];
    const meta: PdfMetadata = { ...EMPTY_METADATA, title: "X" };
    const opts: OptimizerOptions = {
      optimizationLevel: "maximum",
      downsampleImages: true, targetDpi: 150,
      removeUnusedObjects: true, removeMetadata: true,
      compressStreams: true, subsetFonts: true,
    };
    const breakdown = analyzeSize(1_000_000, images, fonts, streams, meta);
    const items = rankOptimizationPriorities(breakdown, images, fonts, streams, meta, opts);
    expect(items.length).toBeGreaterThan(0);
    // Image downsampling (375k savings) should be #1
    expect(items[0].label).toContain("image");
    expect(items[0].savingsBytes).toBeGreaterThan(items[items.length - 1].savingsBytes);
  });
  it("returns empty when no optimizations enabled", () => {
    const opts: OptimizerOptions = {
      optimizationLevel: "safe",
      downsampleImages: false, targetDpi: 150,
      removeUnusedObjects: false, removeMetadata: false,
      compressStreams: false, subsetFonts: false,
    };
    const items = rankOptimizationPriorities(
      analyzeSize(100, [], [], [], EMPTY_METADATA),
      [], [], [], EMPTY_METADATA, opts,
    );
    expect(items).toHaveLength(0);
  });
});

describe("pdf-size-optimizer buildOptimizationReport", () => {
  it("builds a complete report", () => {
    const images = [makeImage({ id: "a", originalDpi: 300, bytes: 400_000 })];
    const fonts = [makeFont({ id: "f", name: "Custom", isStandard: false, bytes: 100_000 })];
    const streams = [makeStream({ id: "s", bytes: 50_000, isCompressed: false })];
    const meta: PdfMetadata = { ...EMPTY_METADATA, title: "Doc" };
    const opts: OptimizerOptions = {
      optimizationLevel: "aggressive",
      downsampleImages: true, targetDpi: 150,
      removeUnusedObjects: true, removeMetadata: false,
      compressStreams: true, subsetFonts: true,
    };
    const r = buildOptimizationReport(1_000_000, 500_000, images, fonts, streams, meta, [], opts);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const out = r.output;
    expect(out.originalSize).toBe(1_000_000);
    expect(out.optimizedSize).toBe(500_000);
    expect(out.savingsPercent).toBe(50);
    expect(out.componentSavings).toHaveLength(5);
    expect(out.imageCount).toBe(1);
    expect(out.fontCount).toBe(1);
    expect(out.streamCount).toBe(1);
  });
  it("rejects negative sizes", () => {
    const r = buildOptimizationReport(-1, 0, [], [], [], EMPTY_METADATA, [], DEFAULT_OPTIONS);
    expect(r.ok).toBe(false);
  });
});

describe("pdf-size-optimizer renderers", () => {
  const sample = {
    originalSize: 1_000_000,
    optimizedSize: 500_000,
    savingsBytes: 500_000,
    savingsPercent: 50,
    breakdown: {
      totalBytes: 1_000_000, imagesBytes: 400_000, fontsBytes: 100_000,
      streamsBytes: 50_000, metadataBytes: 100, otherBytes: 449_900,
      imagesPercent: 40, fontsPercent: 10, streamsPercent: 5,
      metadataPercent: 0, otherPercent: 45,
    },
    optimizedBreakdown: {
      totalBytes: 500_000, imagesBytes: 100_000, fontsBytes: 30_000,
      streamsBytes: 25_000, metadataBytes: 100, otherBytes: 344_900,
      imagesPercent: 20, fontsPercent: 6, streamsPercent: 5,
      metadataPercent: 0, otherPercent: 69,
    },
    componentSavings: [
      { component: "images" as const, originalBytes: 400_000, optimizedBytes: 100_000, savingsBytes: 300_000, savingsPercent: 75, notes: "Downsampled" },
      { component: "fonts" as const, originalBytes: 100_000, optimizedBytes: 30_000, savingsBytes: 70_000, savingsPercent: 70, notes: "Subset" },
      { component: "streams" as const, originalBytes: 50_000, optimizedBytes: 25_000, savingsBytes: 25_000, savingsPercent: 50, notes: "Recompressed" },
      { component: "metadata" as const, originalBytes: 100, optimizedBytes: 100, savingsBytes: 0, savingsPercent: 0, notes: "Preserved" },
      { component: "other" as const, originalBytes: 449_900, optimizedBytes: 344_900, savingsBytes: 105_000, savingsPercent: 23.3, notes: "Structural" },
    ],
    options: DEFAULT_OPTIONS,
    imageCount: 1, fontCount: 1, streamCount: 1, unusedObjectCount: 0,
    qualityImpacts: ["Image downsampling to 150 DPI reduces visual resolution (lossy)"],
  };

  it("renderTextReport contains summary", () => {
    const t = renderTextReport(sample);
    expect(t).toContain("Optimization Report");
    expect(t).toContain("Original size:");
    expect(t).toContain("Optimized size:");
    expect(t).toContain("images");
    expect(t).toContain("fonts");
  });
  it("renderCsvReport has header + 6 rows", () => {
    const csv = renderCsvReport(sample);
    const lines = csv.split("\n");
    expect(lines[0]).toContain("component,original_bytes,optimized_bytes");
    // 5 components + 1 total + 1 header = 7 lines
    expect(lines.length).toBe(7);
    expect(csv).toContain("TOTAL");
  });
  it("renderJsonReport is valid JSON", () => {
    const j = renderJsonReport(sample);
    const parsed = JSON.parse(j);
    expect(parsed.originalSize).toBe(1_000_000);
    expect(parsed.componentSavings).toHaveLength(5);
  });
});

describe("pdf-size-optimizer formatBytes", () => {
  it("formats bytes", () => { expect(formatBytes(500)).toBe("500 B"); });
  it("formats KB", () => { expect(formatBytes(1500)).toBe("1.5 KB"); });
  it("formats MB", () => { expect(formatBytes(2 * 1024 * 1024)).toBe("2.00 MB"); });
});

describe("pdf-size-optimizer history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, fileName: "a.pdf", originalSize: 1000, optimizedSize: 500,
      savingsPercent: 50, level: "balanced", imageCount: 1, fontCount: 1,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, fileName: "a.pdf", originalSize: 1000, optimizedSize: 500,
        savingsPercent: 50, level: "balanced", imageCount: 1, fontCount: 1,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, fileName: "a.pdf", originalSize: 1000, optimizedSize: 500,
      savingsPercent: 50, level: "balanced", imageCount: 1, fontCount: 1,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("pdf-size-optimizer shareable URL", () => {
  it("builds share URL with all params", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      optimizationLevel: "aggressive",
      downsampleImages: true, targetDpi: 150,
      removeUnusedObjects: true, removeMetadata: false,
      compressStreams: true, subsetFonts: true,
    });
    expect(url).toContain("level=aggressive");
    expect(url).toContain("downsample=true");
    expect(url).toContain("dpi=150");
    expect(url).toContain("unused=true");
    expect(url).toContain("fonts=true");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const parsed = parseShareUrl("level=maximum&downsample=true&dpi=96&meta=true&fonts=false");
    expect(parsed.optimizationLevel).toBe("maximum");
    expect(parsed.downsampleImages).toBe(true);
    expect(parsed.targetDpi).toBe(96);
    expect(parsed.removeMetadata).toBe(true);
    expect(parsed.subsetFonts).toBe(false);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("filters unknown level", () => {
    const parsed = parseShareUrl("level=invalid");
    expect(parsed.optimizationLevel).toBeUndefined();
  });
  it("filters invalid DPI", () => {
    const parsed = parseShareUrl("dpi=999");
    expect(parsed.targetDpi).toBeUndefined();
  });
});

describe("pdf-size-optimizer validateOptions", () => {
  it("returns null for valid options", () => {
    expect(validateOptions(DEFAULT_OPTIONS)).toBeNull();
  });
  it("errors on invalid level", () => {
    expect(validateOptions({ ...DEFAULT_OPTIONS, optimizationLevel: "invalid" as OptimizationLevel })).toBeTruthy();
  });
  it("errors on invalid DPI", () => {
    expect(validateOptions({ ...DEFAULT_OPTIONS, targetDpi: 999 as unknown as 150 })).toBeTruthy();
  });
});

// Suppress unused-import lint for type-only imports
export type _Unused = OptimizationLevel;
