import { describe, it, expect, beforeEach } from "vitest";
import {
  ORGANIZE_MODES,
  COMPRESSION_LEVELS,
  COMPRESSION_CODES,
  ORGANIZE_LABELS,
  COMPRESSION_LABELS,
  DEFAULT_OPTIONS,
  stripPdfExtension,
  sanitizeFilename,
  sanitizeBundleName,
  resolveCollisions,
  computeContentHash,
  extractFileMeta,
  organizeFiles,
  zipPathFor,
  detectDuplicates,
  markDuplicates,
  lookupCompressionLevel,
  isCompressing,
  calculateBundleSize,
  estimateZipSize,
  verifyBundle,
  generateManifest,
  generateReadme,
  computeSummaryStats,
  renderTextReport,
  renderCsvReport,
  renderJsonReport,
  crc32,
  utf8Encode,
  buildZip,
  buildBundleReport,
  buildBundleZip,
  preserveOriginalOrder,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  validateOptions,
  type BundlerOptions,
  type PdfFileMeta,
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

function makeMeta(
  name: string,
  size: number,
  pageCount: number,
  contentHash?: string,
  extra: Partial<PdfFileMeta> = {},
): PdfFileMeta {
  return {
    name,
    size,
    pageCount,
    title: extra.title ?? "",
    author: extra.author ?? "",
    subject: "",
    creator: "",
    producer: "",
    creationDate: "",
    contentHash: contentHash ?? `hash-${name}`,
    ...extra,
  };
}

function makeBytes(seed: string, len: number): Uint8Array {
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = (seed.charCodeAt(i % seed.length) + i) & 0xFF;
  }
  return bytes;
}

describe("pdf-zip-bundler constants", () => {
  it("has 4 organize modes", () => {
    expect(ORGANIZE_MODES).toHaveLength(4);
  });
  it("has 4 compression levels", () => {
    expect(COMPRESSION_LEVELS).toHaveLength(4);
  });
  it("has labels for every mode and level", () => {
    for (const m of ORGANIZE_MODES) expect(ORGANIZE_LABELS[m]).toBeTruthy();
    for (const l of COMPRESSION_LEVELS) expect(COMPRESSION_LABELS[l]).toBeTruthy();
  });
  it("maps compression levels to numeric codes", () => {
    expect(COMPRESSION_CODES.store).toBe(0);
    expect(COMPRESSION_CODES.fast).toBe(1);
    expect(COMPRESSION_CODES.normal).toBe(6);
    expect(COMPRESSION_CODES.maximum).toBe(9);
  });
  it("default options are valid", () => {
    expect(DEFAULT_OPTIONS.bundleName).toBe("pdf-bundle");
    expect(DEFAULT_OPTIONS.includeManifest).toBe(true);
    expect(DEFAULT_OPTIONS.includeReadme).toBe(false);
    expect(DEFAULT_OPTIONS.organizeBy).toBe("flat");
    expect(DEFAULT_OPTIONS.compressionLevel).toBe("store");
  });
});

describe("pdf-zip-bundler filename helpers", () => {
  it("strips .pdf extension", () => {
    expect(stripPdfExtension("report.pdf")).toBe("report");
    expect(stripPdfExtension("REPORT.PDF")).toBe("REPORT");
  });
  it("leaves non-pdf names unchanged", () => {
    expect(stripPdfExtension("report.txt")).toBe("report.txt");
  });
  it("sanitizes filenames", () => {
    expect(sanitizeFilename("a/b:c*d?.pdf")).toBe("a_b_c_d_.pdf");
  });
  it("appends .pdf if missing", () => {
    expect(sanitizeFilename("report")).toBe("report.pdf");
  });
  it("returns untitled.pdf for empty", () => {
    expect(sanitizeFilename("")).toBe("untitled.pdf");
    expect(sanitizeFilename("   ")).toBe("untitled.pdf");
  });
  it("sanitizes bundle names", () => {
    expect(sanitizeBundleName("My Bundle?")).toBe("My Bundle_");
  });
  it("removes .zip extension from bundle name", () => {
    expect(sanitizeBundleName("bundle.zip")).toBe("bundle");
  });
  it("defaults empty bundle name to pdf-bundle", () => {
    expect(sanitizeBundleName("")).toBe("pdf-bundle");
  });
});

describe("pdf-zip-bundler collision resolver", () => {
  it("passes through unique names", () => {
    expect(resolveCollisions(["a.pdf", "b.pdf", "c.pdf"])).toEqual(["a.pdf", "b.pdf", "c.pdf"]);
  });
  it("appends -1, -2 for collisions", () => {
    expect(resolveCollisions(["a.pdf", "a.pdf", "a.pdf"])).toEqual([
      "a.pdf", "a-1.pdf", "a-2.pdf",
    ]);
  });
  it("is case-insensitive on collisions", () => {
    expect(resolveCollisions(["A.pdf", "a.pdf"])).toEqual(["A.pdf", "a-1.pdf"]);
  });
});

describe("pdf-zip-bundler content hash", () => {
  it("returns an 8-char hex string", () => {
    const h = computeContentHash(makeBytes("abc", 100));
    expect(h).toMatch(/^[0-9a-f]{8}$/);
  });
  it("is deterministic for same bytes", () => {
    const a = computeContentHash(makeBytes("xyz", 50));
    const b = computeContentHash(makeBytes("xyz", 50));
    expect(a).toBe(b);
  });
  it("differs for different bytes", () => {
    const a = computeContentHash(makeBytes("xyz", 50));
    const b = computeContentHash(makeBytes("XYZ", 50));
    expect(a).not.toBe(b);
  });
});

describe("pdf-zip-bundler extractFileMeta", () => {
  it("extracts metadata from raw bytes + pdf info", () => {
    const bytes = makeBytes("hello", 200);
    const meta = extractFileMeta("report.pdf", bytes, {
      pageCount: 5,
      title: "Test Report",
      author: "Jane Doe",
    });
    expect(meta.name).toBe("report.pdf");
    expect(meta.size).toBe(200);
    expect(meta.pageCount).toBe(5);
    expect(meta.title).toBe("Test Report");
    expect(meta.author).toBe("Jane Doe");
    expect(meta.contentHash).toMatch(/^[0-9a-f]{8}$/);
  });
  it("handles missing optional fields", () => {
    const meta = extractFileMeta("a.pdf", makeBytes("x", 10), { pageCount: 0 });
    expect(meta.title).toBe("");
    expect(meta.author).toBe("");
    expect(meta.pageCount).toBe(0);
  });
  it("sanitizes the filename", () => {
    const meta = extractFileMeta("a/b?.pdf", makeBytes("x", 10), { pageCount: 1 });
    expect(meta.name).toBe("a_b_.pdf");
  });
});

describe("pdf-zip-bundler organizeFiles", () => {
  const metas = [
    makeMeta("c.pdf", 300, 3, "h3"),
    makeMeta("a.pdf", 100, 1, "h1"),
    makeMeta("b.pdf", 200, 2, "h2"),
  ];
  it("flat mode preserves original order", () => {
    const out = organizeFiles(metas, "flat");
    expect(out.map((m) => m.name)).toEqual(["c.pdf", "a.pdf", "b.pdf"]);
  });
  it("alphabetical mode sorts A→Z", () => {
    const out = organizeFiles(metas, "alphabetical");
    expect(out.map((m) => m.name)).toEqual(["a.pdf", "b.pdf", "c.pdf"]);
  });
  it("by-size mode sorts largest first", () => {
    const out = organizeFiles(metas, "by-size");
    expect(out.map((m) => m.size)).toEqual([300, 200, 100]);
  });
  it("by-page-count mode sorts most pages first", () => {
    const out = organizeFiles(metas, "by-page-count");
    expect(out.map((m) => m.pageCount)).toEqual([3, 2, 1]);
  });
});

describe("pdf-zip-bundler zipPathFor", () => {
  const meta = makeMeta("report.pdf", 5_000_000, 12, "h1");
  it("flat mode → top-level path", () => {
    expect(zipPathFor(meta, "flat", "report.pdf")).toBe("report.pdf");
  });
  it("alphabetical mode → letter subfolder", () => {
    expect(zipPathFor(meta, "alphabetical", "report.pdf")).toBe("r/report.pdf");
  });
  it("alphabetical mode → _ subfolder for non-letter", () => {
    const meta2 = makeMeta("123.pdf", 1000, 1);
    expect(zipPathFor(meta2, "alphabetical", "123.pdf")).toBe("_/123.pdf");
  });
  it("by-size mode → large bucket for 5MB", () => {
    expect(zipPathFor(meta, "by-size", "report.pdf")).toBe("large/report.pdf");
  });
  it("by-size mode → xlarge bucket for >10MB", () => {
    const big = makeMeta("big.pdf", 20_000_000, 100);
    expect(zipPathFor(big, "by-size", "big.pdf")).toBe("xlarge/big.pdf");
  });
  it("by-page-count mode → bucket by page count", () => {
    expect(zipPathFor(meta, "by-page-count", "report.pdf")).toBe("10-49-pages/report.pdf");
    const big = makeMeta("big.pdf", 1000, 200);
    expect(zipPathFor(big, "by-page-count", "big.pdf")).toBe("100+-pages/big.pdf");
  });
});

describe("pdf-zip-bundler duplicate detection", () => {
  it("detects duplicate content hashes", () => {
    const metas = [
      makeMeta("a.pdf", 100, 1, "same"),
      makeMeta("b.pdf", 100, 1, "same"),
      makeMeta("c.pdf", 100, 1, "different"),
    ];
    const dups = detectDuplicates(metas);
    expect(dups).toHaveLength(1);
    expect(dups[0].members).toHaveLength(2);
    expect(dups[0].wastedBytes).toBe(100); // 1 duplicate × 100 bytes
  });
  it("returns empty for all-unique metas", () => {
    const metas = [makeMeta("a.pdf", 100, 1, "h1"), makeMeta("b.pdf", 100, 1, "h2")];
    expect(detectDuplicates(metas)).toEqual([]);
  });
  it("marks duplicates (first occurrence not duplicate)", () => {
    const metas = [
      makeMeta("a.pdf", 100, 1, "same"),
      makeMeta("b.pdf", 100, 1, "same"),
      makeMeta("c.pdf", 100, 1, "same"),
    ];
    const flags = markDuplicates(metas);
    expect(flags).toEqual([false, true, true]);
  });
  it("marks all-unique metas as not-duplicate", () => {
    const metas = [makeMeta("a.pdf", 100, 1, "h1"), makeMeta("b.pdf", 100, 1, "h2")];
    expect(markDuplicates(metas)).toEqual([false, false]);
  });
});

describe("pdf-zip-bundler compression lookup", () => {
  it("returns numeric code", () => {
    expect(lookupCompressionLevel("store")).toBe(0);
    expect(lookupCompressionLevel("maximum")).toBe(9);
  });
  it("isCompressing returns false for store, true otherwise", () => {
    expect(isCompressing("store")).toBe(false);
    expect(isCompressing("fast")).toBe(true);
    expect(isCompressing("normal")).toBe(true);
    expect(isCompressing("maximum")).toBe(true);
  });
});

describe("pdf-zip-bundler bundle size calculator", () => {
  it("sums file sizes", () => {
    const metas = [makeMeta("a.pdf", 100, 1), makeMeta("b.pdf", 200, 2)];
    expect(calculateBundleSize(metas)).toBe(300);
  });
  it("handles empty list", () => {
    expect(calculateBundleSize([])).toBe(0);
  });
  it("estimateZipSize adds overhead per file", () => {
    const entries = [
      { meta: makeMeta("a.pdf", 1000, 1), zipPath: "a.pdf", bundleIndex: 1, isDuplicate: false, originalIndex: 0 },
    ];
    const est = estimateZipSize(entries, 100, 50);
    // 1000 + 100 + 50 + (3 files × 76) + 22 EOCD = 1400
    expect(est).toBe(1000 + 100 + 50 + 3 * 76 + 22);
  });
});

describe("pdf-zip-bundler integrity verifier", () => {
  it("flags empty files", () => {
    const entries = [
      { meta: makeMeta("a.pdf", 0, 1), zipPath: "a.pdf", bundleIndex: 1, isDuplicate: false, originalIndex: 0 },
    ];
    const issues = verifyBundle(entries);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("error");
    expect(issues[0].message).toContain("empty");
  });
  it("warns on tiny files", () => {
    const entries = [
      { meta: makeMeta("a.pdf", 50, 1), zipPath: "a.pdf", bundleIndex: 1, isDuplicate: false, originalIndex: 0 },
    ];
    const issues = verifyBundle(entries);
    expect(issues.some((i) => i.severity === "warn" && i.message.includes("suspiciously small"))).toBe(true);
  });
  it("warns on zero pages", () => {
    const entries = [
      { meta: makeMeta("a.pdf", 5000, 0), zipPath: "a.pdf", bundleIndex: 1, isDuplicate: false, originalIndex: 0 },
    ];
    const issues = verifyBundle(entries);
    expect(issues.some((i) => i.message.includes("0 pages"))).toBe(true);
  });
  it("warns on duplicates", () => {
    const entries = [
      { meta: makeMeta("a.pdf", 5000, 1), zipPath: "a.pdf", bundleIndex: 1, isDuplicate: false, originalIndex: 0 },
      { meta: makeMeta("b.pdf", 5000, 1), zipPath: "b.pdf", bundleIndex: 2, isDuplicate: true, originalIndex: 1 },
    ];
    const issues = verifyBundle(entries);
    expect(issues.some((i) => i.message.includes("Duplicate"))).toBe(true);
  });
  it("returns no issues for clean files", () => {
    const entries = [
      { meta: makeMeta("a.pdf", 5000, 5), zipPath: "a.pdf", bundleIndex: 1, isDuplicate: false, originalIndex: 0 },
    ];
    expect(verifyBundle(entries)).toEqual([]);
  });
});

describe("pdf-zip-bundler manifest & README generators", () => {
  const entries = [
    { meta: makeMeta("a.pdf", 1000, 5, "h1", { title: "A" }), zipPath: "a.pdf", bundleIndex: 1, isDuplicate: false, originalIndex: 0 },
    { meta: makeMeta("b.pdf", 2000, 10, "h2", { author: "Jane" }), zipPath: "b.pdf", bundleIndex: 2, isDuplicate: false, originalIndex: 1 },
  ];
  const duplicates: never[] = [];
  const stats: ReturnType<typeof computeSummaryStats> = {
    totalFiles: 2, totalSize: 3000, totalPages: 15, uniqueFiles: 2, duplicateFiles: 0,
    duplicateGroups: 0, wastedBytes: 0, byOrganizeMode: "flat",
    compressionLevel: "store", includesManifest: true, includesReadme: false,
    estimatedZipSize: 3170, largestFileSize: 2000, smallestFileSize: 1000, avgPagesPerFile: 7.5,
  };

  it("generateManifest produces valid JSON with files array", () => {
    const json = generateManifest(entries, stats, DEFAULT_OPTIONS);
    const parsed = JSON.parse(json);
    expect(parsed.bundleName).toBe("pdf-bundle");
    expect(parsed.files).toHaveLength(2);
    expect(parsed.files[0].originalName).toBe("a.pdf");
    expect(parsed.summary.totalPages).toBe(15);
  });
  it("generateManifest includes organize + compression mode", () => {
    const json = generateManifest(entries, stats, { ...DEFAULT_OPTIONS, organizeBy: "alphabetical" });
    const parsed = JSON.parse(json);
    expect(parsed.organizeBy).toBe("alphabetical");
  });
  it("generateReadme produces text with contents", () => {
    const text = generateReadme(entries, stats, DEFAULT_OPTIONS);
    expect(text).toContain("pdf-bundle");
    expect(text).toContain("Contents:");
    expect(text).toContain("a.pdf");
    expect(text).toContain("b.pdf");
    expect(text).toContain("UnQTools");
  });
  it("generateReadme flags duplicates when present", () => {
    const dupStats = { ...stats, duplicateFiles: 1, duplicateGroups: 1, wastedBytes: 1000 };
    const text = generateReadme(entries, dupStats, DEFAULT_OPTIONS);
    expect(text).toContain("Duplicates:");
  });
});

describe("pdf-zip-bundler summary stats", () => {
  it("computes summary stats correctly", () => {
    const entries = [
      { meta: makeMeta("a.pdf", 1000, 5, "h1"), zipPath: "a.pdf", bundleIndex: 1, isDuplicate: false, originalIndex: 0 },
      { meta: makeMeta("b.pdf", 2000, 10, "h1"), zipPath: "b.pdf", bundleIndex: 2, isDuplicate: true, originalIndex: 1 },
    ];
    const duplicates = [{ contentHash: "h1", size: 1000, members: [0, 1], wastedBytes: 1000 }];
    const stats = computeSummaryStats(entries, duplicates, DEFAULT_OPTIONS, 500, 200);
    expect(stats.totalFiles).toBe(2);
    expect(stats.totalSize).toBe(3000);
    expect(stats.totalPages).toBe(15);
    expect(stats.uniqueFiles).toBe(1);
    expect(stats.duplicateFiles).toBe(1);
    expect(stats.duplicateGroups).toBe(1);
    expect(stats.wastedBytes).toBe(1000);
    expect(stats.largestFileSize).toBe(2000);
    expect(stats.smallestFileSize).toBe(1000);
    expect(stats.avgPagesPerFile).toBe(7.5);
    expect(stats.estimatedZipSize).toBeGreaterThan(3000);
  });
  it("handles empty entries", () => {
    const stats = computeSummaryStats([], [], DEFAULT_OPTIONS, 0, 0);
    expect(stats.totalFiles).toBe(0);
    expect(stats.avgPagesPerFile).toBe(0);
    expect(stats.smallestFileSize).toBe(0);
  });
});

describe("pdf-zip-bundler renderers", () => {
  const entries = [
    { meta: makeMeta("a.pdf", 1000, 5, "h1", { title: "A Report" }), zipPath: "a.pdf", bundleIndex: 1, isDuplicate: false, originalIndex: 0 },
  ];
  const stats: ReturnType<typeof computeSummaryStats> = {
    totalFiles: 1, totalSize: 1000, totalPages: 5, uniqueFiles: 1, duplicateFiles: 0,
    duplicateGroups: 0, wastedBytes: 0, byOrganizeMode: "flat",
    compressionLevel: "store", includesManifest: true, includesReadme: false,
    estimatedZipSize: 1100, largestFileSize: 1000, smallestFileSize: 1000, avgPagesPerFile: 5,
  };

  it("renderTextReport includes file listing", () => {
    const text = renderTextReport(entries, [], stats, DEFAULT_OPTIONS);
    expect(text).toContain("pdf-bundle");
    expect(text).toContain("a.pdf");
    expect(text).toContain("Contents:");
  });
  it("renderCsvReport has header + 1 row", () => {
    const csv = renderCsvReport(entries);
    expect(csv).toContain("filename,size,page_count,title,author,path_in_zip,is_duplicate,content_hash");
    expect(csv.split("\n")).toHaveLength(2);
    expect(csv).toContain("a.pdf");
  });
  it("renderCsvReport escapes commas in titles", () => {
    const entries2 = [
      { meta: makeMeta("a.pdf", 1000, 5, "h1", { title: "Hello, World" }), zipPath: "a.pdf", bundleIndex: 1, isDuplicate: false, originalIndex: 0 },
    ];
    const csv = renderCsvReport(entries2);
    expect(csv).toContain('"Hello, World"');
  });
  it("renderJsonReport is valid JSON with files", () => {
    const json = renderJsonReport(entries, [], stats, DEFAULT_OPTIONS);
    const parsed = JSON.parse(json);
    expect(parsed.bundleName).toBe("pdf-bundle");
    expect(parsed.files).toHaveLength(1);
    expect(parsed.files[0].name).toBe("a.pdf");
  });
});

describe("pdf-zip-bundler ZIP builder", () => {
  it("computes CRC-32 correctly", () => {
    expect(crc32(utf8Encode("123456789"))).toBe(0xCBF43926);
  });
  it("builds a valid ZIP archive", () => {
    const files = [
      { name: "a.pdf", bytes: makeBytes("aaa", 100) },
      { name: "b.pdf", bytes: makeBytes("bbb", 200) },
    ];
    const zip = buildZip(files);
    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4b);
    expect(zip[2]).toBe(0x03);
    expect(zip[3]).toBe(0x04);
    const len = zip.length;
    expect(zip[len - 22]).toBe(0x50);
    expect(zip[len - 21]).toBe(0x4b);
    expect(zip[len - 20]).toBe(0x05);
    expect(zip[len - 19]).toBe(0x06);
  });
  it("accepts a compression level parameter", () => {
    const files = [{ name: "a.pdf", bytes: makeBytes("aaa", 100) }];
    // Should not throw for any level
    expect(() => buildZip(files, "store")).not.toThrow();
    expect(() => buildZip(files, "fast")).not.toThrow();
    expect(() => buildZip(files, "normal")).not.toThrow();
    expect(() => buildZip(files, "maximum")).not.toThrow();
  });
});

describe("pdf-zip-bundler buildBundleReport", () => {
  it("builds a full report with entries, duplicates, stats, manifest, readme", () => {
    const metas = [
      makeMeta("a.pdf", 1000, 5, "h1"),
      makeMeta("b.pdf", 2000, 10, "h2"),
    ];
    const res = buildBundleReport(metas, DEFAULT_OPTIONS);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.output.entries).toHaveLength(2);
      expect(res.output.duplicates).toHaveLength(0);
      expect(res.output.stats.totalFiles).toBe(2);
      expect(res.output.manifest).toContain("pdf-bundle");
      expect(res.output.readme).toBe(""); // includeReadme defaults to false
    }
  });
  it("includes readme when requested", () => {
    const metas = [makeMeta("a.pdf", 1000, 5, "h1")];
    const res = buildBundleReport(metas, { ...DEFAULT_OPTIONS, includeReadme: true });
    if (res.ok) {
      expect(res.output.readme).toContain("pdf-bundle");
    }
  });
  it("detects duplicates in build", () => {
    const metas = [
      makeMeta("a.pdf", 1000, 5, "same"),
      makeMeta("b.pdf", 1000, 5, "same"),
    ];
    const res = buildBundleReport(metas, DEFAULT_OPTIONS);
    if (res.ok) {
      expect(res.output.duplicates).toHaveLength(1);
      expect(res.output.stats.duplicateFiles).toBe(1);
      expect(res.output.entries[1].isDuplicate).toBe(true);
    }
  });
  it("errors on empty metas", () => {
    const res = buildBundleReport([], DEFAULT_OPTIONS);
    expect(res.ok).toBe(false);
  });
  it("applies organize mode in build", () => {
    const metas = [
      makeMeta("c.pdf", 300, 3, "h3"),
      makeMeta("a.pdf", 100, 1, "h1"),
      makeMeta("b.pdf", 200, 2, "h2"),
    ];
    const res = buildBundleReport(metas, { ...DEFAULT_OPTIONS, organizeBy: "alphabetical" });
    if (res.ok) {
      expect(res.output.entries.map((e) => e.meta.name)).toEqual(["a.pdf", "b.pdf", "c.pdf"]);
    }
  });
  it("resolves filename collisions in zipPath", () => {
    const metas = [
      makeMeta("dup.pdf", 1000, 5, "h1"),
      makeMeta("dup.pdf", 1000, 5, "h2"), // same name, different content
    ];
    const res = buildBundleReport(metas, DEFAULT_OPTIONS);
    if (res.ok) {
      expect(res.output.entries[0].zipPath).toBe("dup.pdf");
      expect(res.output.entries[1].zipPath).toBe("dup-1.pdf");
    }
  });
});

describe("pdf-zip-bundler buildBundleZip", () => {
  it("builds ZIP with file + manifest + readme", () => {
    const metas = [
      { ...makeMeta("a.pdf", 1000, 5, "h1"), bytes: makeBytes("aaa", 1000) },
      { ...makeMeta("b.pdf", 2000, 10, "h2"), bytes: makeBytes("bbb", 2000) },
    ];
    const res = buildBundleReport(metas, { ...DEFAULT_OPTIONS, includeReadme: true });
    if (!res.ok) throw new Error("expected ok");
    const zip = buildBundleZip(
      res.output.entries.map((e) => ({ ...e, meta: { ...e.meta, bytes: metas.find((m) => m.name === e.meta.name)?.bytes } })),
      res.output.manifest,
      res.output.readme,
      { ...DEFAULT_OPTIONS, includeReadme: true },
    );
    // 2 PDFs + manifest.json + README.txt = 4 files
    // Verify local file header signature
    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4b);
    expect(zip[2]).toBe(0x03);
    expect(zip[3]).toBe(0x04);
  });
});

describe("pdf-zip-bundler preserveOriginalOrder", () => {
  it("returns originalIndex values in bundle order", () => {
    const entries = [
      { meta: makeMeta("a.pdf", 100, 1), zipPath: "a.pdf", bundleIndex: 1, isDuplicate: false, originalIndex: 5 },
      { meta: makeMeta("b.pdf", 100, 1), zipPath: "b.pdf", bundleIndex: 2, isDuplicate: false, originalIndex: 2 },
    ];
    expect(preserveOriginalOrder(entries)).toEqual([5, 2]);
  });
});

describe("pdf-zip-bundler history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1, bundleName: "test", fileCount: 3, totalSize: 6000, totalPages: 15,
      organizeBy: "flat", compressionLevel: "store",
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i, bundleName: `b${i}`, fileCount: 1, totalSize: 1000, totalPages: 5,
        organizeBy: "flat", compressionLevel: "store",
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({
      ts: 1, bundleName: "x", fileCount: 1, totalSize: 1000, totalPages: 1,
      organizeBy: "flat", compressionLevel: "store",
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("pdf-zip-bundler shareable URL", () => {
  it("builds share URL with all options", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ ...DEFAULT_OPTIONS, includeReadme: true, organizeBy: "by-size" });
    expect(url).toContain("name=pdf-bundle");
    expect(url).toContain("manifest=true");
    expect(url).toContain("readme=true");
    expect(url).toContain("organize=by-size");
    expect(url).toContain("compress=store");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const opts = parseShareUrl("name=my-bundle&manifest=true&readme=false&organize=alphabetical&compress=maximum");
    expect(opts.bundleName).toBe("my-bundle");
    expect(opts.includeManifest).toBe(true);
    expect(opts.includeReadme).toBe(false);
    expect(opts.organizeBy).toBe("alphabetical");
    expect(opts.compressionLevel).toBe("maximum");
  });
  it("filters unknown enum values", () => {
    const opts = parseShareUrl("organize=unknown&compress=unknown");
    expect(opts.organizeBy).toBeUndefined();
    expect(opts.compressionLevel).toBeUndefined();
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
});

describe("pdf-zip-bundler validation", () => {
  it("rejects empty bundle name", () => {
    expect(validateOptions({ ...DEFAULT_OPTIONS, bundleName: "" })).toBe("Bundle name cannot be empty.");
  });
  it("rejects whitespace-only bundle name", () => {
    expect(validateOptions({ ...DEFAULT_OPTIONS, bundleName: "   " })).toBe("Bundle name cannot be empty.");
  });
  it("rejects invalid organize mode", () => {
    expect(validateOptions({ ...DEFAULT_OPTIONS, organizeBy: "invalid" as never })).toBe("Invalid organize mode.");
  });
  it("rejects invalid compression level", () => {
    expect(validateOptions({ ...DEFAULT_OPTIONS, compressionLevel: "invalid" as never })).toBe("Invalid compression level.");
  });
  it("accepts valid options", () => {
    expect(validateOptions(DEFAULT_OPTIONS)).toBeNull();
  });
});
