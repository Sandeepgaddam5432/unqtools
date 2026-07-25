import { describe, it, expect } from "vitest";
import { computeThumbnail, computeThumbnails, thumbnailFilename, DEFAULT_SIZES } from "./logic";

describe("computeThumbnail", () => {
  it("scales landscape by width", () => {
    const r = computeThumbnail({ originalWidth: 1000, originalHeight: 500, maxSize: 256, square: false });
    expect(r).toMatchObject({ width: 256, height: 128 });
  });

  it("scales portrait by height", () => {
    const r = computeThumbnail({ originalWidth: 500, originalHeight: 1000, maxSize: 256, square: false });
    expect(r).toMatchObject({ width: 128, height: 256 });
  });

  it("produces square thumbnails when square=true", () => {
    const r = computeThumbnail({ originalWidth: 1000, originalHeight: 500, maxSize: 128, square: true });
    expect(r).toMatchObject({ width: 128, height: 128 });
  });

  it("errors on non-positive original dims", () => {
    expect(computeThumbnail({ originalWidth: 0, originalHeight: 100, maxSize: 256, square: false })).toHaveProperty(
      "error",
    );
  });

  it("errors on non-positive max size", () => {
    expect(computeThumbnail({ originalWidth: 100, originalHeight: 100, maxSize: 0, square: false })).toHaveProperty(
      "error",
    );
  });

  it("preserves aspect ratio for non-square", () => {
    const r = computeThumbnail({ originalWidth: 1000, originalHeight: 750, maxSize: 100, square: false }) as {
      width: number;
      height: number;
    };
    expect(r.width / r.height).toBeCloseTo(1000 / 750, 2);
  });
});

describe("computeThumbnails", () => {
  it("generates all sizes", () => {
    const results = computeThumbnails(1000, 1000, DEFAULT_SIZES, false);
    expect(Array.isArray(results)).toBe(true);
    expect((results as []).length).toBe(4);
  });

  it("propagates errors", () => {
    const r = computeThumbnails(0, 0, DEFAULT_SIZES, false);
    expect(r).toHaveProperty("error");
  });
});

describe("thumbnailFilename", () => {
  it("builds a filename", () => {
    expect(thumbnailFilename("photo", 256, "png")).toBe("photo-256x256.png");
  });

  it("strips unsafe characters", () => {
    expect(thumbnailFilename("my photo!!", 128, "jpg")).toBe("myphoto-128x128.jpg");
  });

  it("defaults when empty", () => {
    expect(thumbnailFilename("", 64, "")).toBe("thumbnail-64x64.png");
  });
});

describe("DEFAULT_SIZES", () => {
  it("contains 64, 128, 256, 512", () => {
    expect(DEFAULT_SIZES).toEqual([64, 128, 256, 512]);
  });
});
