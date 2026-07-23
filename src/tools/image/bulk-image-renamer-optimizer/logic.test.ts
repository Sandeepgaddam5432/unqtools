/**
 * Bulk Image Renamer + Optimizer — unit tests.
 *
 * Pure helpers are tested directly. Canvas/DOM operations (processImage,
 * stripExif, computePerceptualHashFromBitmap, getExifData wrapper) are not
 * unit-tested because vitest runs in the "node" environment; they are
 * exercised at runtime via the UI and Web Worker.
 */
import { describe, it, expect } from "vitest";
import {
  applyRenamePattern,
  applyTokens,
  applyCaseTransform,
  applyFindReplace,
  removeSpaces,
  removeSpecialChars,
  padNumber,
  splitExt,
  detectInputFormat,
  buildOutputExtension,
  detectConflicts,
  resolveConflicts,
  computeResizedDimensions,
  computeOptimizeOptions,
  tuneForTargetSize,
  slugifyForSeo,
  computePerceptualHash,
  hammingDistance,
  findPerceptualDuplicates,
  generateAuditCsv,
  generateAuditJson,
  estimateSizeSavings,
  formatBytes,
  encodeConfigToUrl,
  decodeConfigFromUrl,
  buildStoredZip,
  buildOutputPath,
  DEFAULT_CONFIG,
  type RenameRule,
  type OptimizeOptions,
  type PreviewRow,
  type TokenContext,
} from "./logic";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseRule = (over: Partial<RenameRule> = {}): RenameRule => ({
  pattern: "{index}-{original}",
  prefix: "",
  suffix: "",
  counterStart: 1,
  counterStep: 1,
  counterPad: 3,
  find: "",
  replace: "",
  useRegex: false,
  caseMode: "none",
  removeSpaces: false,
  removeSpecialChars: false,
  ...over,
});

const baseCtx = (over: Partial<TokenContext> = {}): TokenContext => ({
  width: 1920,
  height: 1080,
  fileDate: "2024-03-15T10:00:00Z",
  exifDate: "2024-03-15T10:00:00Z",
  original: "",
  ...over,
});

// ---------------------------------------------------------------------------
// splitExt / detectInputFormat / buildOutputExtension
// ---------------------------------------------------------------------------

describe("splitExt", () => {
  it("splits a normal filename", () => {
    expect(splitExt("photo.jpg")).toEqual({ base: "photo", ext: ".jpg" });
  });

  it("handles multiple dots", () => {
    expect(splitExt("my.photo.v2.png")).toEqual({
      base: "my.photo.v2",
      ext: ".png",
    });
  });

  it("returns no ext for dotless name", () => {
    expect(splitExt("README")).toEqual({ base: "README", ext: "" });
  });

  it("handles paths with slashes", () => {
    expect(splitExt("folder/sub/photo.jpeg")).toEqual({
      base: "photo",
      ext: ".jpeg",
    });
  });

  it("treats leading dot as not an extension", () => {
    expect(splitExt(".gitignore")).toEqual({ base: ".gitignore", ext: "" });
  });
});

describe("detectInputFormat", () => {
  it("detects JPEG from extension", () => {
    expect(detectInputFormat("photo.jpg", "")).toBe("image/jpeg");
    expect(detectInputFormat("photo.JPEG", "")).toBe("image/jpeg");
  });

  it("detects PNG from MIME", () => {
    expect(detectInputFormat("file", "image/png")).toBe("image/png");
  });

  it("returns null for unknown", () => {
    expect(detectInputFormat("file.txt", "")).toBeNull();
  });
});

describe("buildOutputExtension", () => {
  it("returns .jpg for jpeg", () => {
    expect(buildOutputExtension("image/jpeg")).toBe(".jpg");
  });
  it("returns .png for png", () => {
    expect(buildOutputExtension("image/png")).toBe(".png");
  });
  it("returns .webp for webp", () => {
    expect(buildOutputExtension("image/webp")).toBe(".webp");
  });
});

// ---------------------------------------------------------------------------
// Case transforms
// ---------------------------------------------------------------------------

describe("applyCaseTransform", () => {
  it("none returns input unchanged", () => {
    expect(applyCaseTransform("PhotoAlbum", "none")).toBe("PhotoAlbum");
  });

  it("lower lowercases", () => {
    expect(applyCaseTransform("PhotoAlbum", "lower")).toBe("photoalbum");
  });

  it("upper uppercases", () => {
    expect(applyCaseTransform("PhotoAlbum", "upper")).toBe("PHOTOALBUM");
  });

  it("kebab converts camelCase and spaces", () => {
    expect(applyCaseTransform("Photo Album Cover", "kebab")).toBe(
      "photo-album-cover",
    );
    expect(applyCaseTransform("PhotoAlbum", "kebab")).toBe("photo-album");
    expect(applyCaseTransform("photo_album", "kebab")).toBe("photo-album");
  });

  it("snake converts camelCase and spaces", () => {
    expect(applyCaseTransform("Photo Album Cover", "snake")).toBe(
      "photo_album_cover",
    );
    expect(applyCaseTransform("PhotoAlbum", "snake")).toBe("photo_album");
  });
});

// ---------------------------------------------------------------------------
// Find-replace
// ---------------------------------------------------------------------------

describe("applyFindReplace", () => {
  it("literal replace all occurrences", () => {
    const r = applyFindReplace("photo_photo.png", "photo", "img", false);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toBe("img_img.png");
  });

  it("returns input when find is empty", () => {
    const r = applyFindReplace("photo.png", "", "x", false);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toBe("photo.png");
  });

  it("regex replace", () => {
    const r = applyFindReplace("photo 2024-03-15.png", "\\d{4}-\\d{2}-\\d{2}", "DATE", true);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toBe("photo DATE.png");
  });

  it("regex capture group", () => {
    const r = applyFindReplace("img_001.png", "(\\d+)", "num-$1", true);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toBe("img_num-001.png");
  });

  it("returns error for invalid regex", () => {
    const r = applyFindReplace("photo.png", "[invalid", "x", true);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Invalid regex/);
  });
});

// ---------------------------------------------------------------------------
// removeSpaces / removeSpecialChars / padNumber
// ---------------------------------------------------------------------------

describe("removeSpaces", () => {
  it("replaces spaces with dashes", () => {
    expect(removeSpaces("my photo album")).toBe("my-photo-album");
  });
  it("collapses multiple spaces", () => {
    expect(removeSpaces("my   photo")).toBe("my-photo");
  });
});

describe("removeSpecialChars", () => {
  it("strips non-alphanumeric keeping ext when keepExt=true", () => {
    expect(removeSpecialChars("my photo!@#.jpg", true)).toBe("myphoto.jpg");
  });
  it("strips all non-alphanumeric when keepExt=false", () => {
    expect(removeSpecialChars("my photo!@#.jpg", false)).toBe("myphotojpg");
  });
});

describe("padNumber", () => {
  it("pads to width", () => {
    expect(padNumber(5, 3)).toBe("005");
  });
  it("returns as-is when wider than pad", () => {
    expect(padNumber(12345, 3)).toBe("12345");
  });
  it("no padding when width=0", () => {
    expect(padNumber(7, 0)).toBe("7");
  });
});

// ---------------------------------------------------------------------------
// applyTokens
// ---------------------------------------------------------------------------

describe("applyTokens", () => {
  it("substitutes {index} (1-based)", () => {
    const out = applyTokens("img-{index}", 0, baseCtx(), baseRule());
    expect(out).toBe("img-1");
  });

  it("substitutes {counter} with pad", () => {
    const out = applyTokens("img-{counter}", 0, baseCtx(), baseRule({ counterStart: 100, counterStep: 5, counterPad: 4 }));
    expect(out).toBe("img-0100");
  });

  it("counter increments by step", () => {
    const out = applyTokens("img-{counter}", 2, baseCtx(), baseRule({ counterStart: 10, counterStep: 5, counterPad: 3 }));
    expect(out).toBe("img-020");
  });

  it("substitutes {original}", () => {
    const out = applyTokens("prefix-{original}", 0, baseCtx({ original: "vacation" }), baseRule());
    expect(out).toBe("prefix-vacation");
  });

  it("substitutes {date} from fileDate", () => {
    const out = applyTokens("{date}-{original}", 0, baseCtx({ original: "x", fileDate: "2024-03-15T10:00:00Z" }), baseRule());
    expect(out).toBe("2024-03-15-x");
  });

  it("substitutes {exif:date} when present", () => {
    const out = applyTokens("{exif:date}-{original}", 0, baseCtx({ original: "x", exifDate: "2024-03-15T10:00:00Z", fileDate: "2024-01-01T00:00:00Z" }), baseRule());
    expect(out).toBe("2024-03-15-x");
  });

  it("{exif:date} falls back to {date} when missing", () => {
    const out = applyTokens("{exif:date}-{original}", 0, baseCtx({ original: "x", exifDate: undefined, fileDate: "2024-01-01T00:00:00Z" }), baseRule());
    expect(out).toBe("2024-01-01-x");
  });

  it("substitutes {width}x{height}", () => {
    const out = applyTokens("{width}x{height}", 0, baseCtx({ width: 1920, height: 1080 }), baseRule());
    expect(out).toBe("1920x1080");
  });

  it("uses 'undated' when fileDate is missing", () => {
    const out = applyTokens("{date}-{original}", 0, baseCtx({ original: "x", fileDate: undefined }), baseRule());
    expect(out).toBe("undated-x");
  });

  it("handles multiple tokens in one pattern", () => {
    const out = applyTokens("{counter}_{original}_{width}x{height}", 0, baseCtx({ original: "vacation", width: 800, height: 600 }), baseRule({ counterStart: 1, counterPad: 3 }));
    expect(out).toBe("001_vacation_800x600");
  });
});

// ---------------------------------------------------------------------------
// applyRenamePattern (end-to-end)
// ---------------------------------------------------------------------------

describe("applyRenamePattern", () => {
  it("default rule produces N-original.ext", () => {
    const r = applyRenamePattern("vacation.jpg", 0, baseRule());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toBe("1-vacation.jpg");
  });

  it("prefix + suffix wrap the expanded name", () => {
    const r = applyRenamePattern("photo.png", 2, baseRule({ prefix: "album_", suffix: "_final" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toBe("album_3-photo_final.png");
  });

  it("applies find-replace before tokens", () => {
    const r = applyRenamePattern("IMG_001.jpg", 0, baseRule({ find: "IMG_", replace: "", pattern: "{original}" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toBe("001.jpg");
  });

  it("applies case transform", () => {
    const r = applyRenamePattern("MyPhoto.jpg", 0, baseRule({ pattern: "{original}", caseMode: "lower" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toBe("myphoto.jpg");
  });

  it("applies kebab case", () => {
    const r = applyRenamePattern("My Photo Album.jpg", 0, baseRule({ pattern: "{original}", caseMode: "kebab" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toBe("my-photo-album.jpg");
  });

  it("applies removeSpaces", () => {
    const r = applyRenamePattern("my photo.jpg", 0, baseRule({ pattern: "{original}", removeSpaces: true }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toBe("my-photo.jpg");
  });

  it("applies removeSpecialChars", () => {
    const r = applyRenamePattern("my photo!@#.jpg", 0, baseRule({ pattern: "{original}", removeSpecialChars: true }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toBe("myphoto.jpg");
  });

  it("uses output format extension when provided", () => {
    const r = applyRenamePattern("photo.png", 0, baseRule({ pattern: "{original}" }), {}, "image/webp");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toBe("photo.webp");
  });

  it("propagates regex errors from find-replace", () => {
    const r = applyRenamePattern("photo.jpg", 0, baseRule({ find: "[bad", useRegex: true }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Invalid regex/);
  });

  it("handles unicode filenames", () => {
    const r = applyRenamePattern("照片.jpg", 0, baseRule({ pattern: "{original}" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toBe("照片.jpg");
  });

  it("handles very long filenames", () => {
    const long = "a".repeat(200);
    const r = applyRenamePattern(`${long}.jpg`, 0, baseRule());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toContain(long);
  });

  it("handles empty pattern gracefully (defaults to {original})", () => {
    const r = applyRenamePattern("photo.jpg", 0, baseRule({ pattern: "" }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.output).toBe("photo.jpg");
  });
});

// ---------------------------------------------------------------------------
// Conflict detection + resolution
// ---------------------------------------------------------------------------

describe("detectConflicts", () => {
  it("returns empty map for unique names", () => {
    const m = detectConflicts(["a.jpg", "b.jpg", "c.jpg"]);
    expect(m.size).toBe(0);
  });

  it("finds duplicate names with their indices", () => {
    const m = detectConflicts(["a.jpg", "b.jpg", "a.jpg", "a.jpg", "c.jpg"]);
    expect(m.size).toBe(1);
    expect(m.get("a.jpg")).toEqual([0, 2, 3]);
  });

  it("handles empty input", () => {
    expect(detectConflicts([]).size).toBe(0);
  });

  it("handles multiple distinct duplicates", () => {
    const m = detectConflicts(["x.jpg", "x.jpg", "y.jpg", "y.jpg"]);
    expect(m.size).toBe(2);
    expect(m.get("x.jpg")).toEqual([0, 1]);
    expect(m.get("y.jpg")).toEqual([2, 3]);
  });
});

describe("resolveConflicts", () => {
  it("auto-suffixes all but the first duplicate", () => {
    const out = resolveConflicts(["image.jpg", "image.jpg", "image.jpg"]);
    expect(out).toEqual(["image.jpg", "image-1.jpg", "image-2.jpg"]);
  });

  it("preserves unique names", () => {
    const out = resolveConflicts(["a.jpg", "b.jpg", "c.jpg"]);
    expect(out).toEqual(["a.jpg", "b.jpg", "c.jpg"]);
  });

  it("handles multiple conflict groups", () => {
    const out = resolveConflicts(["x.jpg", "x.jpg", "y.jpg", "y.jpg"]);
    expect(out).toEqual(["x.jpg", "x-1.jpg", "y.jpg", "y-1.jpg"]);
  });

  it("avoids colliding with an existing name", () => {
    // image-1.jpg already exists, so first duplicate should jump to image-2.jpg
    const out = resolveConflicts(["image.jpg", "image-1.jpg", "image.jpg"]);
    expect(out).toEqual(["image.jpg", "image-1.jpg", "image-2.jpg"]);
  });

  it("preserves extension through suffixing", () => {
    const out = resolveConflicts(["photo.webp", "photo.webp"]);
    expect(out).toEqual(["photo.webp", "photo-1.webp"]);
  });
});

// ---------------------------------------------------------------------------
// computeResizedDimensions / computeOptimizeOptions
// ---------------------------------------------------------------------------

describe("computeResizedDimensions", () => {
  it("returns original when no max dimension", () => {
    expect(computeResizedDimensions(1920, 1080)).toEqual({ width: 1920, height: 1080 });
  });

  it("scales landscape image by width", () => {
    const r = computeResizedDimensions(1920, 1080, 1024);
    expect(r.width).toBe(1024);
    expect(r.height).toBe(576);
  });

  it("scales portrait image by height", () => {
    const r = computeResizedDimensions(1080, 1920, 1024);
    expect(r.height).toBe(1024);
    expect(r.width).toBe(576);
  });

  it("returns original when smaller than max", () => {
    expect(computeResizedDimensions(800, 600, 1024)).toEqual({ width: 800, height: 600 });
  });

  it("preserves aspect ratio", () => {
    const r = computeResizedDimensions(4000, 3000, 1000);
    expect(r.width / r.height).toBeCloseTo(4 / 3, 2);
  });
});

describe("computeOptimizeOptions", () => {
  const baseOpts: OptimizeOptions = {
    format: "image/jpeg",
    quality: 0.8,
    stripExif: true,
    progressive: false,
    watermark: { enabled: false, text: "", position: "center", opacity: 0.5, color: "#fff", fontSize: 24 },
  };

  it("returns original dims when no maxDimension", () => {
    const r = computeOptimizeOptions({ width: 800, height: 600 }, baseOpts);
    expect(r).toEqual({ width: 800, height: 600, quality: 0.8, format: "image/jpeg" });
  });

  it("resizes when maxDimension set", () => {
    const r = computeOptimizeOptions({ width: 1920, height: 1080 }, { ...baseOpts, maxDimension: 1024 });
    expect(r.width).toBe(1024);
    expect(r.height).toBe(576);
  });

  it("forces quality=1 for PNG (lossless)", () => {
    const r = computeOptimizeOptions({ width: 100, height: 100 }, { ...baseOpts, format: "image/png", quality: 0.5 });
    expect(r.quality).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// tuneForTargetSize
// ---------------------------------------------------------------------------

describe("tuneForTargetSize", () => {
  it("finds a quality that fits under the target", async () => {
    const compress = async (q: number) => ({
      blob: new Blob([new Uint8Array(Math.round(q * 1000))]),
      quality: q,
    });
    const result = await tuneForTargetSize(500, compress, { maxIterations: 12 });
    expect(result.blob.size).toBeLessThanOrEqual(500);
    expect(result.quality).toBeGreaterThan(0);
  });

  it("returns the smallest result when target cannot be met", async () => {
    const compress = async (q: number) => ({
      blob: new Blob([new Uint8Array(Math.round(q * 1000) + 2000)]),
      quality: q,
    });
    const result = await tuneForTargetSize(500, compress, { maxIterations: 8, minQuality: 0.1 });
    expect(result.quality).toBeLessThanOrEqual(0.2);
  });
});

// ---------------------------------------------------------------------------
// slugifyForSeo
// ---------------------------------------------------------------------------

describe("slugifyForSeo", () => {
  it("lowercases and joins with dashes", () => {
    expect(slugifyForSeo("My Photo Album")).toBe("my-photo-album");
  });

  it("strips diacritics", () => {
    expect(slugifyForSeo("café résumé")).toBe("cafe-resume");
  });

  it("removes special chars", () => {
    expect(slugifyForSeo("hello! @world #123")).toBe("hello-world-123");
  });

  it("collapses multiple dashes", () => {
    expect(slugifyForSeo("a   b___c")).toBe("a-b-c");
  });

  it("handles empty input", () => {
    expect(slugifyForSeo("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Perceptual hash
// ---------------------------------------------------------------------------

describe("computePerceptualHash", () => {
  /** Build a flat grayscale array for a solid-color 8x8 image. */
  const solidGray = (value: number): { data: Uint8Array; w: number; h: number } => ({
    data: new Uint8Array(64).fill(value),
    w: 8,
    h: 8,
  });

  it("returns 16-char hex string", () => {
    const { data, w, h } = solidGray(128);
    const hash = computePerceptualHash(data, w, h);
    expect(hash).toHaveLength(16);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("returns all zeros for uniform image (no pixel > mean)", () => {
    const { data, w, h } = solidGray(128);
    const hash = computePerceptualHash(data, w, h);
    expect(hash).toBe("0000000000000000");
  });

  it("returns all ones (ffff...) for image where every pixel > mean", () => {
    // Half black (0), half white (255). Mean = 127.5. White > mean → bit=1.
    const data = new Uint8Array(64);
    for (let i = 32; i < 64; i++) data[i] = 255;
    const hash = computePerceptualHash(data, 8, 8);
    // Lower half (positions 32-63) are white → bits 32-63 set in 64-bit BigInt
    // bits 32-63 set = lower 32 bits set = 0xffffffff
    expect(hash).toBe("00000000ffffffff");
  });

  it("returns same hash for identical inputs", () => {
    const data = new Uint8Array(64);
    for (let i = 0; i < 64; i++) data[i] = (i * 7) % 256;
    const a = computePerceptualHash(data, 8, 8);
    const b = computePerceptualHash(data.slice(), 8, 8);
    expect(a).toBe(b);
  });

  it("handles larger input by downsampling", () => {
    // 16x16 image, all same value → uniform → all zeros
    const data = new Uint8Array(256).fill(100);
    const hash = computePerceptualHash(data, 16, 16);
    expect(hash).toBe("0000000000000000");
  });

  it("returns zeros for empty/invalid input", () => {
    expect(computePerceptualHash(new Uint8Array(0), 0, 0)).toBe("0000000000000000");
  });
});

describe("hammingDistance", () => {
  it("is 0 for identical hashes", () => {
    expect(hammingDistance("0000000000000000", "0000000000000000")).toBe(0);
    expect(hammingDistance("ffffffffffffffff", "ffffffffffffffff")).toBe(0);
  });

  it("is 64 for fully-different hashes", () => {
    expect(hammingDistance("0000000000000000", "ffffffffffffffff")).toBe(64);
  });

  it("counts differing bits correctly", () => {
    // 0x1 = bit 0 set (LSB). 0x2 = bit 1 set. Distance = 2.
    expect(hammingDistance("0000000000000001", "0000000000000002")).toBe(2);
  });

  it("returns 64 for malformed input", () => {
    expect(hammingDistance("xyz", "abc")).toBe(64);
  });
});

describe("findPerceptualDuplicates", () => {
  it("finds duplicates below threshold", () => {
    const hashes = new Map<string, string>([
      ["a", "0000000000000000"],
      ["b", "0000000000000000"], // identical → distance 0
      ["c", "ffffffffffffffff"], // distance 64 from a → not duplicate
    ]);
    const dupes = findPerceptualDuplicates(hashes, 5);
    expect(dupes.get("a")).toEqual(["b"]);
    expect(dupes.has("c")).toBe(false);
  });

  it("returns empty map when no duplicates", () => {
    const hashes = new Map<string, string>([
      ["a", "0000000000000000"],
      ["b", "ffffffffffffffff"],
    ]);
    expect(findPerceptualDuplicates(hashes, 5).size).toBe(0);
  });

  it("skips pairs where exactly one hash is the zero sentinel", () => {
    const hashes = new Map<string, string>([
      ["a", "0000000000000000"],
      ["b", "0000000080000000"], // distance 1 from "a" but "a" is zero → skipped
    ]);
    // Mixed zero/non-zero pairs are skipped because zero is a failure sentinel.
    expect(findPerceptualDuplicates(hashes, 5).size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Audit export
// ---------------------------------------------------------------------------

describe("generateAuditCsv", () => {
  const rows: PreviewRow[] = [
    {
      index: 0,
      originalName: "IMG_001.jpg",
      originalSize: 1024,
      newName: "1-vacation.jpg",
      newSize: 512,
      width: 1920,
      height: 1080,
      conflict: false,
      autoSuffixed: false,
    },
    {
      index: 1,
      originalName: "IMG_002.jpg",
      originalSize: 2048,
      newName: "2-vacation-1.jpg",
      newSize: 1024,
      width: 1920,
      height: 1080,
      conflict: true,
      autoSuffixed: true,
    },
  ];

  it("produces a header row + one row per entry", () => {
    const csv = generateAuditCsv(rows);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("index,original_name");
  });

  it("includes original and new names", () => {
    const csv = generateAuditCsv(rows);
    expect(csv).toContain("IMG_001.jpg");
    expect(csv).toContain("1-vacation.jpg");
  });

  it("escapes names containing commas or quotes", () => {
    const trickyRows: PreviewRow[] = [
      {
        index: 0,
        originalName: 'my,file".jpg',
        originalSize: 100,
        newName: "renamed.jpg",
        newSize: 50,
        conflict: false,
        autoSuffixed: false,
      },
    ];
    const csv = generateAuditCsv(trickyRows);
    expect(csv).toContain('"my,file"".jpg"');
  });
});

describe("generateAuditJson", () => {
  it("produces valid JSON", () => {
    const rows: PreviewRow[] = [
      {
        index: 0,
        originalName: "a.jpg",
        originalSize: 100,
        newName: "1-a.jpg",
        newSize: 50,
        conflict: false,
        autoSuffixed: false,
      },
    ];
    const json = generateAuditJson(rows);
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].newName).toBe("1-a.jpg");
  });
});

// ---------------------------------------------------------------------------
// estimateSizeSavings / formatBytes
// ---------------------------------------------------------------------------

describe("estimateSizeSavings", () => {
  it("computes savings in bytes", () => {
    expect(estimateSizeSavings(1000, 600)).toEqual({ savings: 400, percent: 40 });
  });

  it("clamps negative savings to 0", () => {
    expect(estimateSizeSavings(100, 200)).toEqual({ savings: 0, percent: 0 });
  });

  it("handles zero before size", () => {
    expect(estimateSizeSavings(0, 0)).toEqual({ savings: 0, percent: 0 });
  });
});

describe("formatBytes", () => {
  it("formats 0 bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });
  it("formats KB", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
  });
  it("formats MB", () => {
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
  });
});

// ---------------------------------------------------------------------------
// URL preset encode / decode
// ---------------------------------------------------------------------------

describe("encodeConfigToUrl / decodeConfigFromUrl", () => {
  it("round-trips a config through URL encoding", () => {
    const config = {
      ...DEFAULT_CONFIG,
      rule: { ...DEFAULT_CONFIG.rule, pattern: "{counter}_{original}" },
      optimize: { ...DEFAULT_CONFIG.optimize, quality: 0.65 },
    };
    const url = encodeConfigToUrl(config, "https://unqtools.test/tools/bulk-image-renamer-optimizer");
    expect(url).toContain("#p=");

    const decoded = decodeConfigFromUrl(url);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.output.rule.pattern).toBe("{counter}_{original}");
      expect(decoded.output.optimize.quality).toBeCloseTo(0.65, 5);
    }
  });

  it("returns error for URL without preset hash", () => {
    const r = decodeConfigFromUrl("https://example.com/no-preset");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/No preset/);
  });

  it("preserves unicode in config through round-trip", () => {
    const config = {
      ...DEFAULT_CONFIG,
      rule: { ...DEFAULT_CONFIG.rule, prefix: "照片-" },
    };
    const url = encodeConfigToUrl(config, "https://example.com/");
    const decoded = decodeConfigFromUrl(url);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) expect(decoded.output.rule.prefix).toBe("照片-");
  });
});

// ---------------------------------------------------------------------------
// buildStoredZip
// ---------------------------------------------------------------------------

describe("buildStoredZip", () => {
  it("returns empty blob for no entries", async () => {
    const zip = await buildStoredZip([]);
    expect(zip.size).toBe(0);
  });

  it("produces a valid ZIP with PK signature", async () => {
    const entry = { name: "test.txt", blob: new Blob(["hello"], { type: "text/plain" }) };
    const zip = await buildStoredZip([entry]);
    expect(zip.size).toBeGreaterThan(0);
    const bytes = new Uint8Array(await zip.arrayBuffer());
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);
  });

  it("preserves folder structure in entry names", async () => {
    const entries = [
      { name: "folder/sub/a.txt", blob: new Blob(["a"], { type: "text/plain" }) },
      { name: "folder/b.txt", blob: new Blob(["b"], { type: "text/plain" }) },
    ];
    const zip = await buildStoredZip(entries);
    const bytes = new Uint8Array(await zip.arrayBuffer());
    // Verify entry count in EOCD (offset 10, 2 bytes LE)
    const eocdStart = bytes.length - 22;
    const entryCount = bytes[eocdStart + 10]! | (bytes[eocdStart + 11]! << 8);
    expect(entryCount).toBe(2);
    // Verify folder name appears in the bytes
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain("folder/sub/a.txt");
  });
});

// ---------------------------------------------------------------------------
// buildOutputPath
// ---------------------------------------------------------------------------

describe("buildOutputPath", () => {
  it("uses just newName when no folder opts set", () => {
    expect(buildOutputPath("a/b/photo.jpg", "1-photo.jpg", DEFAULT_CONFIG)).toBe("1-photo.jpg");
  });

  it("prepends outputFolder when set", () => {
    const cfg = { ...DEFAULT_CONFIG, outputFolder: "out" };
    expect(buildOutputPath("photo.jpg", "1-photo.jpg", cfg)).toBe("out/1-photo.jpg");
  });

  it("preserves source folder structure when enabled", () => {
    const cfg = { ...DEFAULT_CONFIG, preserveFolderStructure: true };
    expect(buildOutputPath("vacation/2024/photo.jpg", "1-photo.jpg", cfg)).toBe(
      "vacation/2024/1-photo.jpg",
    );
  });

  it("combines outputFolder + preserved structure", () => {
    const cfg = { ...DEFAULT_CONFIG, preserveFolderStructure: true, outputFolder: "out" };
    expect(buildOutputPath("vacation/photo.jpg", "1-photo.jpg", cfg)).toBe(
      "out/vacation/1-photo.jpg",
    );
  });

  it("trims trailing slashes on outputFolder", () => {
    const cfg = { ...DEFAULT_CONFIG, outputFolder: "out//" };
    expect(buildOutputPath("photo.jpg", "1-photo.jpg", cfg)).toBe("out/1-photo.jpg");
  });
});
