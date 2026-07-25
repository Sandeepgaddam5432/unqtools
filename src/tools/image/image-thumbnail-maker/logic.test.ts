import { describe, it, expect } from "vitest";
import {
  computeThumbnail,
  computeThumbnails,
  thumbnailFilename,
  thumbnailFilenameDims,
  formatExtension,
  estimateTotalBytes,
  preservesAlpha,
  validateThumbnailOptions,
  batchValidate,
  isIdentity,
  nudgeValue,
  findSizePreset,
  SIZE_PRESETS,
  DEFAULT_SIZES,
  DEFAULT_OPTIONS,
} from "./logic";

describe("computeThumbnail", () => {
  it("preserves aspect ratio when not square", () => {
    const r = computeThumbnail({ originalWidth: 800, originalHeight: 400, maxSize: 200, square: false });
    if ("error" in r) throw new Error("should not error");
    expect(r.width).toBe(200);
    expect(r.height).toBe(100);
    expect(r.scale).toBeCloseTo(0.25, 4);
  });
  it("returns square dims when square", () => {
    const r = computeThumbnail({ originalWidth: 800, originalHeight: 400, maxSize: 200, square: true });
    if ("error" in r) throw new Error("should not error");
    expect(r.width).toBe(200);
    expect(r.height).toBe(200);
  });
  it("handles tall portrait", () => {
    const r = computeThumbnail({ originalWidth: 400, originalHeight: 800, maxSize: 200, square: false });
    if ("error" in r) throw new Error("should not error");
    expect(r.width).toBe(100);
    expect(r.height).toBe(200);
  });
  it("rejects non-positive dimensions", () => {
    expect("error" in computeThumbnail({ originalWidth: 0, originalHeight: 100, maxSize: 200, square: false })).toBe(true);
    expect("error" in computeThumbnail({ originalWidth: 100, originalHeight: 100, maxSize: 0, square: false })).toBe(true);
  });
});

describe("computeThumbnails", () => {
  it("computes multiple sizes", () => {
    const r = computeThumbnails(800, 600, [128, 256], false);
    if ("error" in r) throw new Error("should not error");
    expect(r.length).toBe(2);
    expect(r[0]!.width).toBe(128);
    expect(r[1]!.width).toBe(256);
  });
  it("propagates error for bad input", () => {
    expect("error" in computeThumbnails(0, 0, [128], false)).toBe(true);
  });
});

describe("thumbnailFilename + thumbnailFilenameDims", () => {
  it("builds size-based filename", () => {
    expect(thumbnailFilename("photo", 256, "png")).toBe("photo-256x256.png");
  });
  it("sanitizes base name", () => {
    expect(thumbnailFilename("my photo!", 128, "jpg")).toBe("myphoto-128x128.jpg");
  });
  it("uses default when base empty", () => {
    expect(thumbnailFilename("", 64, "png")).toBe("thumbnail-64x64.png");
  });
  it("builds dim-based filename", () => {
    expect(thumbnailFilenameDims("img", 200, 100, "png")).toBe("img-200x100.png");
  });
});

describe("formatExtension + estimateTotalBytes + preservesAlpha", () => {
  it("returns correct extensions", () => {
    expect(formatExtension("image/png")).toBe("png");
    expect(formatExtension("image/jpeg")).toBe("jpg");
    expect(formatExtension("image/webp")).toBe("webp");
  });
  it("estimateTotalBytes returns positive number", () => {
    const results = [{ width: 100, height: 100, scale: 1 }];
    expect(estimateTotalBytes(results, "image/png", 1)).toBeGreaterThan(0);
  });
  it("preservesAlpha correct", () => {
    expect(preservesAlpha("image/png")).toBe(true);
    expect(preservesAlpha("image/jpeg")).toBe(false);
  });
});

describe("validateThumbnailOptions", () => {
  it("accepts valid options", () => {
    expect(validateThumbnailOptions(DEFAULT_OPTIONS)).toEqual({ ok: true });
  });
  it("rejects empty sizes", () => {
    expect(validateThumbnailOptions({ ...DEFAULT_OPTIONS, sizes: [] })).toHaveProperty("error");
  });
  it("rejects out-of-range sizes", () => {
    expect(validateThumbnailOptions({ ...DEFAULT_OPTIONS, sizes: [4] })).toHaveProperty("error");
    expect(validateThumbnailOptions({ ...DEFAULT_OPTIONS, sizes: [5000] })).toHaveProperty("error");
  });
  it("rejects bad quality", () => {
    expect(validateThumbnailOptions({ ...DEFAULT_OPTIONS, quality: 0 })).toHaveProperty("error");
    expect(validateThumbnailOptions({ ...DEFAULT_OPTIONS, quality: 2 })).toHaveProperty("error");
  });
});

describe("batch + identity + nudge + presets", () => {
  it("batchValidate validates each file", () => {
    const r = batchValidate([{ name: "a.png" }], DEFAULT_OPTIONS);
    expect(r[0]!.result).toEqual({ ok: true });
  });
  it("isIdentity true when no sizes", () => {
    expect(isIdentity({ ...DEFAULT_OPTIONS, sizes: [] })).toBe(true);
    expect(isIdentity(DEFAULT_OPTIONS)).toBe(false);
  });
  it("nudgeValue increments by 10", () => {
    expect(nudgeValue(100, "arrowup", false)).toBe(110);
  });
  it("nudgeValue increments by 100 with shift", () => {
    expect(nudgeValue(100, "arrowup", true)).toBe(200);
  });
  it("findSizePreset returns matching", () => {
    expect(findSizePreset("m")?.size).toBe(256);
  });
  it("SIZE_PRESETS has at least 5 entries", () => {
    expect(SIZE_PRESETS.length).toBeGreaterThanOrEqual(5);
  });
  it("DEFAULT_SIZES has 5 entries", () => {
    expect(DEFAULT_SIZES.length).toBe(5);
  });
});
