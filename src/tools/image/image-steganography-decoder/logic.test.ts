import { describe, it, expect } from "vitest";
import {
  getImageInfo, calculateDimensions, formatBytes, formatDimensions,
  getAspectRatioString, getCommonAspectRatios, getFaviconSizes,
  getAppIconSizes, getQualityPreset, estimateBase64Size,
  getFileExtension, getMimeType, detectFormatFromBytes,
  defaultOptions,
} from "./logic";

describe("Image Steganography Decoder", () => {
  it("gets image info", () => {
    const info = getImageInfo(1920, 1080, 500000, "jpeg");
    expect(info.width).toBe(1920);
    expect(info.height).toBe(1080);
    expect(info.aspectRatio).toBeCloseTo(16/9, 2);
    expect(info.megapixels).toBeCloseTo(2.07, 1);
  });

  it("calculates dimensions with scale", () => {
    const result = calculateDimensions({ width: 1000, height: 500 }, { scale: 0.5 });
    expect(result.width).toBe(500);
    expect(result.height).toBe(250);
  });

  it("calculates dimensions with width only (maintain aspect)", () => {
    const result = calculateDimensions({ width: 1000, height: 500 }, { width: 500 });
    expect(result.width).toBe(500);
    expect(result.height).toBe(250);
  });

  it("calculates dimensions with both width and height", () => {
    const result = calculateDimensions({ width: 1000, height: 500 }, { width: 200, height: 200 });
    expect(result.width).toBe(200);
    expect(result.height).toBe(200);
  });

  it("formats bytes", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1048576)).toBe("1.00 MB");
  });

  it("formats dimensions", () => {
    expect(formatDimensions(1920, 1080)).toBe("1920 × 1080 px");
  });

  it("gets aspect ratio string", () => {
    expect(getAspectRatioString(1920, 1080)).toBe("16:9");
    expect(getAspectRatioString(1080, 1080)).toBe("1:1");
  });

  it("lists common aspect ratios", () => {
    const ratios = getCommonAspectRatios();
    expect(ratios.length).toBeGreaterThan(5);
  });

  it("gets favicon sizes", () => {
    const sizes = getFaviconSizes();
    expect(sizes).toContain(16);
    expect(sizes).toContain(512);
  });

  it("gets app icon sizes", () => {
    const sizes = getAppIconSizes();
    expect(sizes.length).toBeGreaterThan(10);
    expect(sizes.some((s) => s.platform === "iOS")).toBe(true);
    expect(sizes.some((s) => s.platform === "Android")).toBe(true);
  });

  it("gets quality preset label", () => {
    expect(getQualityPreset(0.95)).toBe("Maximum");
    expect(getQualityPreset(0.85)).toBe("High");
    expect(getQualityPreset(0.7)).toBe("Medium");
    expect(getQualityPreset(0.5)).toBe("Low");
  });

  it("estimates base64 size", () => {
    expect(estimateBase64Size(750)).toBe(1000);
  });

  it("gets file extension", () => {
    expect(getFileExtension("jpeg")).toBe("jpg");
    expect(getFileExtension("png")).toBe("png");
    expect(getFileExtension("webp")).toBe("webp");
  });

  it("gets mime type", () => {
    expect(getMimeType("png")).toBe("image/png");
    expect(getMimeType("jpeg")).toBe("image/jpeg");
  });

  it("detects format from bytes", () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    expect(detectFormatFromBytes(pngBytes)).toBe("png");
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff]);
    expect(detectFormatFromBytes(jpegBytes)).toBe("jpeg");
  });

  it("returns default options", () => {
    const opts = defaultOptions();
    expect(opts.format).toBe("png");
    expect(opts.quality).toBeGreaterThan(0);
  });

  it("returns null for unknown format bytes", () => {
    const unknown = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
    expect(detectFormatFromBytes(unknown)).toBeNull();
  });
});
