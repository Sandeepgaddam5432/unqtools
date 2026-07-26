import { describe, it, expect } from "vitest";
import {
  IOS_SIZES, ANDROID_SIZES, allSpecs, filterByPlatform, estimatePngSize,
  safeAreaInset, effectiveDrawSize, iosCornerRadius, androidMaskRadius,
  generateIosContentsJson, generateAndroidAdaptiveXml, formatBytes,
  estimateTotalBytes, validateSourceForMax, summarize, renderSolidIcon,
} from "./logic";

describe("IOS_SIZES", () => {
  it("includes 20, 29, 40, 60, 76, 1024", () => {
    const sizes = IOS_SIZES.map((s) => s.size);
    [20, 29, 40, 60, 76, 1024].forEach((n) => expect(sizes).toContain(n));
  });
  it("max iOS size is 1024", () => {
    expect(Math.max(...IOS_SIZES.map((s) => s.size))).toBe(1024);
  });
});

describe("ANDROID_SIZES", () => {
  it("includes 48, 72, 96, 144, 192, 512", () => {
    const sizes = ANDROID_SIZES.map((s) => s.size);
    [48, 72, 96, 144, 192, 512].forEach((n) => expect(sizes).toContain(n));
  });
});

describe("allSpecs & filterByPlatform", () => {
  it("combines iOS + Android", () => {
    expect(allSpecs().length).toBe(IOS_SIZES.length + ANDROID_SIZES.length);
  });
  it("filters to ios only", () => {
    const r = filterByPlatform(allSpecs(), "ios");
    expect(r.every((s) => s.platform === "ios")).toBe(true);
  });
  it("filters to android only", () => {
    const r = filterByPlatform(allSpecs(), "android");
    expect(r.every((s) => s.platform === "android")).toBe(true);
  });
});

describe("estimatePngSize & estimateTotalBytes", () => {
  it("scales with size", () => {
    expect(estimatePngSize(512)).toBeGreaterThan(estimatePngSize(48));
  });
  it("estimateTotalBytes is positive", () => {
    expect(estimateTotalBytes(allSpecs())).toBeGreaterThan(0);
  });
});

describe("safeAreaInset & effectiveDrawSize", () => {
  it("computes inset as fraction of size", () => {
    expect(safeAreaInset(192, 0.08)).toBe(Math.round(192 * 0.08));
  });
  it("clamps padding to 0..0.5", () => {
    expect(safeAreaInset(100, 0.9)).toBe(50);
  });
  it("effective draw is size minus 2x inset", () => {
    expect(effectiveDrawSize(100, 0.1)).toBe(100 - 2 * safeAreaInset(100, 0.1));
  });
});

describe("iosCornerRadius & androidMaskRadius", () => {
  it("iOS radius ~22% of size", () => {
    expect(iosCornerRadius(1024)).toBe(Math.round(1024 * 0.2237));
  });
  it("Android mask is circle inscribed", () => {
    expect(androidMaskRadius(192)).toBe(96);
  });
});

describe("generateIosContentsJson", () => {
  it("produces valid JSON with images array", () => {
    const json = generateIosContentsJson(IOS_SIZES);
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed.images)).toBe(true);
    expect(parsed.images.length).toBe(IOS_SIZES.length);
  });
});

describe("generateAndroidAdaptiveXml", () => {
  it("produces valid XML", () => {
    const xml = generateAndroidAdaptiveXml();
    expect(xml).toContain("<adaptive-icon");
    expect(xml).toContain("@mipmap/ic_launcher_foreground");
  });
});

describe("formatBytes", () => {
  it("formats B, KB, MB", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.00 MB");
  });
});

describe("validateSourceForMax", () => {
  it("accepts large square source", () => {
    expect(validateSourceForMax(1024, 1024, 1024).ok).toBe(true);
  });
  it("rejects too small", () => {
    expect(validateSourceForMax(500, 500, 1024).ok).toBe(false);
  });
  it("rejects non-square", () => {
    expect(validateSourceForMax(1024, 800, 1024).ok).toBe(false);
  });
});

describe("summarize", () => {
  it("returns rows with bytes", () => {
    const s = summarize(IOS_SIZES.slice(0, 3));
    expect(s.length).toBe(3);
    expect(s[0].bytes).toBeGreaterThan(0);
  });
});

describe("renderSolidIcon", () => {
  it("produces RGBA buffer", () => {
    const buf = renderSolidIcon(64);
    expect(buf.length).toBe(64 * 64 * 4);
    expect(buf[0]).toBe(80);
    expect(buf[3]).toBe(255);
  });
});
