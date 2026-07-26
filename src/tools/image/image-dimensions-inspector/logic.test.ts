import { describe, it, expect } from "vitest";
import {
  readUint16BE, readUint32BE, readUint32LE, detectFormat, parsePngDimensions,
  pngColorTypeName, pngHasAlpha, parseJpegDimensions, parseWebpDimensions,
  parseGifDimensions, findJpegExifSegment, megapixels, aspectRatio, formatBytes,
  isAnimated, supportsAlpha, inspectImage, formatReport,
} from "./logic";

describe("readers", () => {
  it("reads 16-bit BE", () => {
    expect(readUint16BE(new Uint8Array([0x12, 0x34]), 0)).toBe(0x1234);
  });
  it("reads 32-bit BE", () => {
    expect(readUint32BE(new Uint8Array([0x12, 0x34, 0x56, 0x78]), 0)).toBe(0x12345678);
  });
  it("reads 32-bit LE", () => {
    expect(readUint32LE(new Uint8Array([0x78, 0x56, 0x34, 0x12]), 0)).toBe(0x12345678);
  });
  it("returns 0 for out-of-range", () => {
    expect(readUint16BE(new Uint8Array(1), 5)).toBe(0);
  });
});

describe("detectFormat", () => {
  it("detects PNG", () => {
    expect(detectFormat(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe("png");
  });
  it("detects JPEG", () => {
    expect(detectFormat(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
  });
  it("detects GIF", () => {
    expect(detectFormat(new Uint8Array([0x47, 0x49, 0x46, 0x38]))).toBe("gif");
  });
  it("detects WebP", () => {
    const bytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
    expect(detectFormat(bytes)).toBe("webp");
  });
  it("returns unknown for garbage", () => {
    expect(detectFormat(new Uint8Array([1, 2, 3, 4]))).toBe("unknown");
  });
});

describe("parsePngDimensions", () => {
  it("parses width and height", () => {
    // minimal IHDR layout
    const bytes = new Uint8Array(40);
    bytes[0] = 0x89; bytes[1] = 0x50; bytes[2] = 0x4e; bytes[3] = 0x47; // sig
    bytes[12] = 0x49; bytes[13] = 0x48; bytes[14] = 0x44; bytes[15] = 0x52; // "IHDR"
    // width = 256, height = 200 at offsets 16-19, 20-23
    bytes[16] = 0; bytes[17] = 0; bytes[18] = 1; bytes[19] = 0; // 256
    bytes[20] = 0; bytes[21] = 0; bytes[22] = 0; bytes[23] = 0xc8; // 200
    bytes[24] = 8; // bitDepth
    bytes[25] = 6; // colorType truecolor+alpha
    const d = parsePngDimensions(bytes);
    expect(d.width).toBe(256);
    expect(d.height).toBe(200);
    expect(d.bitDepth).toBe(8);
    expect(d.colorType).toBe(6);
  });
});

describe("pngColorTypeName & pngHasAlpha", () => {
  it("truecolor+alpha has alpha", () => {
    expect(pngColorTypeName(6)).toBe("Truecolor + Alpha");
    expect(pngHasAlpha(6)).toBe(true);
  });
  it("grayscale no alpha", () => {
    expect(pngHasAlpha(0)).toBe(false);
  });
  it("unknown type", () => {
    expect(pngColorTypeName(99)).toBe("Unknown");
  });
});

describe("parseJpegDimensions", () => {
  it("parses from SOF0 marker", () => {
    // Construct a minimal JPEG with SOF0 marker
    const bytes = new Uint8Array(20);
    bytes[0] = 0xff; bytes[1] = 0xd8; // SOI
    bytes[2] = 0xff; bytes[3] = 0xc0; // SOF0
    bytes[4] = 0; bytes[5] = 11; // length
    bytes[6] = 8; // precision
    bytes[7] = 0; bytes[8] = 200; // height 200
    bytes[9] = 0; bytes[10] = 256 & 0xff; bytes[11] = 1; // width 256 — actually 0x0100
    bytes[9] = 1; bytes[10] = 0; // 0x0100 = 256
    const d = parseJpegDimensions(bytes);
    expect(d.height).toBe(200);
    expect(d.width).toBe(256);
  });
  it("returns zeros for empty", () => {
    expect(parseJpegDimensions(new Uint8Array(10))).toEqual({ width: 0, height: 0, bitDepth: 8 });
  });
});

describe("parseWebpDimensions", () => {
  it("parses VP8X chunk", () => {
    const bytes = new Uint8Array(40);
    bytes[12] = 0x56; bytes[13] = 0x50; bytes[14] = 0x38; bytes[15] = 0x58; // "VP8X"
    bytes[20] = 0x02; // animated flag
    bytes[24] = 0xff; bytes[25] = 0; bytes[26] = 0; // width-1 = 255 → width 256
    bytes[27] = 0xc7; bytes[28] = 0; bytes[29] = 0; // height-1 = 199 → 200
    const d = parseWebpDimensions(bytes);
    expect(d.animated).toBe(true);
    expect(d.width).toBeGreaterThan(0);
    expect(d.height).toBeGreaterThan(0);
  });
});

describe("parseGifDimensions", () => {
  it("parses GIF89a header", () => {
    const bytes = new Uint8Array([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61,
      0x00, 0x01, 0xc8, 0x00,
      0x00, 0x00, 0x00,
    ]);
    const d = parseGifDimensions(bytes);
    expect(d.width).toBe(256);
    expect(d.height).toBe(200);
  });
});

describe("findJpegExifSegment", () => {
  it("returns null when no EXIF", () => {
    expect(findJpegExifSegment(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))).toBeNull();
  });
});

describe("megapixels & aspectRatio", () => {
  it("computes MP", () => {
    expect(megapixels(1920, 1080)).toBeCloseTo(2.07, 1);
  });
  it("aspect ratio simplifies", () => {
    expect(aspectRatio(1920, 1080)).toBe("16:9");
    expect(aspectRatio(0, 0)).toBe("0:0");
  });
});

describe("formatBytes", () => {
  it("formats", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1024 * 1024)).toBe("1.00 MB");
  });
});

describe("isAnimated & supportsAlpha", () => {
  it("gif/webp animated", () => {
    expect(isAnimated("gif")).toBe(true);
    expect(isAnimated("webp")).toBe(true);
    expect(isAnimated("png")).toBe(false);
  });
  it("png/webp/gif alpha", () => {
    expect(supportsAlpha("png")).toBe(true);
    expect(supportsAlpha("jpeg")).toBe(false);
  });
});

describe("inspectImage", () => {
  it("inspects PNG", () => {
    const bytes = new Uint8Array(40);
    bytes[0] = 0x89; bytes[1] = 0x50; bytes[2] = 0x4e; bytes[3] = 0x47;
    bytes[12] = 0x49; bytes[13] = 0x48; bytes[14] = 0x44; bytes[15] = 0x52;
    bytes[16] = 0; bytes[17] = 0; bytes[18] = 1; bytes[19] = 0;
    bytes[20] = 0; bytes[21] = 0; bytes[22] = 0; bytes[23] = 0xc8;
    bytes[24] = 8; bytes[25] = 6;
    const info = inspectImage(bytes);
    expect(info.format).toBe("png");
    expect(info.width).toBe(256);
    expect(info.hasAlpha).toBe(true);
  });
  it("inspects JPEG", () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const info = inspectImage(bytes);
    expect(info.format).toBe("jpeg");
  });
});

describe("formatReport", () => {
  it("contains all fields", () => {
    const r = formatReport({
      format: "png", width: 100, height: 100, bitDepth: 8, hasAlpha: true,
      colorType: "Truecolor + Alpha", animated: false, frameCount: 1, sourceBytes: 2048,
    });
    expect(r).toContain("Format: PNG");
    expect(r).toContain("Dimensions: 100×100");
    expect(r).toContain("Has alpha: yes");
  });
});
