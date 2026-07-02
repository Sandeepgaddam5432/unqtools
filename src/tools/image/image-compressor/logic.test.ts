/**
 * Image Compressor — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  detectFormat,
  formatBytes,
  computeResizedDimensions,
  buildOutputFilename,
  buildStoredZip,
  tuneForTargetSize,
} from "./logic";

describe("detectFormat", () => {
  it("detects JPG from extension", () => {
    expect(detectFormat("photo.jpg", "")).toBe("image/jpeg");
    expect(detectFormat("photo.JPEG", "")).toBe("image/jpeg");
  });

  it("detects PNG from extension", () => {
    expect(detectFormat("logo.png", "")).toBe("image/png");
  });

  it("detects WebP from extension", () => {
    expect(detectFormat("image.webp", "")).toBe("image/webp");
  });

  it("detects from MIME type when no extension match", () => {
    expect(detectFormat("file", "image/png")).toBe("image/png");
  });

  it("returns null for unknown formats", () => {
    expect(detectFormat("file.txt", "")).toBeNull();
    expect(detectFormat("file", "text/plain")).toBeNull();
  });
});

describe("formatBytes", () => {
  it("formats 0 bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats bytes", () => {
    expect(formatBytes(500)).toBe("500 B");
  });

  it("formats KB", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  it("formats MB", () => {
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
  });

  it("formats GB", () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe("1.0 GB");
  });
});

describe("computeResizedDimensions", () => {
  it("returns original when no max dimension", () => {
    expect(computeResizedDimensions(1920, 1080)).toEqual({ width: 1920, height: 1080 });
  });

  it("returns original when image smaller than max", () => {
    expect(computeResizedDimensions(800, 600, 1024)).toEqual({ width: 800, height: 600 });
  });

  it("scales landscape image by width", () => {
    const r = computeResizedDimensions(1920, 1080, 1024);
    expect(r.width).toBe(1024);
    expect(r.height).toBe(576); // 1080 × (1024/1920)
  });

  it("scales portrait image by height", () => {
    const r = computeResizedDimensions(1080, 1920, 1024);
    expect(r.height).toBe(1024);
    expect(r.width).toBe(576);
  });

  it("scales square image", () => {
    const r = computeResizedDimensions(2000, 2000, 500);
    expect(r.width).toBe(500);
    expect(r.height).toBe(500);
  });

  it("preserves aspect ratio", () => {
    const r = computeResizedDimensions(4000, 3000, 1000);
    const ratio = r.width / r.height;
    expect(ratio).toBeCloseTo(4 / 3, 2);
  });
});

describe("buildOutputFilename", () => {
  it("builds JPG output name", () => {
    expect(buildOutputFilename("photo.png", "image/jpeg")).toBe("photo-compressed.jpg");
  });

  it("builds WebP output name", () => {
    expect(buildOutputFilename("logo.png", "image/webp")).toBe("logo-compressed.webp");
  });

  it("handles files with no extension", () => {
    expect(buildOutputFilename("photo", "image/png")).toBe("photo-compressed.png");
  });

  it("handles files with multiple dots", () => {
    expect(buildOutputFilename("my.photo.v2.jpg", "image/webp")).toBe(
      "my.photo.v2-compressed.webp",
    );
  });
});

describe("buildStoredZip", () => {
  it("returns empty blob for no entries", async () => {
    const zip = await buildStoredZip([]);
    expect(zip.size).toBe(0);
  });

  it("produces a valid ZIP with correct signature", async () => {
    const entry = { name: "test.txt", blob: new Blob(["hello world"], { type: "text/plain" }) };
    const zip = await buildStoredZip([entry]);
    expect(zip.size).toBeGreaterThan(0);
    const bytes = new Uint8Array(await zip.arrayBuffer());
    // PK\x03\x04 signature
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);
  });

  it("produces a ZIP with end-of-central-directory signature at the right place", async () => {
    const entry = { name: "a.txt", blob: new Blob(["aaa"], { type: "text/plain" }) };
    const zip = await buildStoredZip([entry]);
    const bytes = new Uint8Array(await zip.arrayBuffer());
    // Last 22 bytes should be EOCD with PK\x05\x06 signature
    const eocdStart = bytes.length - 22;
    expect(bytes[eocdStart]!).toBe(0x50);
    expect(bytes[eocdStart + 1]!).toBe(0x4b);
    expect(bytes[eocdStart + 2]!).toBe(0x05);
    expect(bytes[eocdStart + 3]!).toBe(0x06);
  });

  it("handles multiple entries", async () => {
    const entries = [
      { name: "a.txt", blob: new Blob(["aaa"], { type: "text/plain" }) },
      { name: "b.txt", blob: new Blob(["bbbb"], { type: "text/plain" }) },
      { name: "c.txt", blob: new Blob(["ccccc"], { type: "text/plain" }) },
    ];
    const zip = await buildStoredZip(entries);
    expect(zip.size).toBeGreaterThan(0);
    // Verify entry count in EOCD record (offset 10, 2 bytes, little-endian)
    const bytes = new Uint8Array(await zip.arrayBuffer());
    const eocdStart = bytes.length - 22;
    const entryCount = bytes[eocdStart + 10]! | (bytes[eocdStart + 11]! << 8);
    expect(entryCount).toBe(3);
  });
});

describe("tuneForTargetSize", () => {
  it("finds a quality that fits under the target", async () => {
    // Simulate a compress function where higher quality = bigger output
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
    // Should return the smallest (lowest quality) result
    expect(result.quality).toBeLessThanOrEqual(0.2);
  });
});
