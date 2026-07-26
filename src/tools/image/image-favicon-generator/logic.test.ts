import { describe, it, expect } from "vitest";
import {
  FAVICON_SIZES, filterByPlatform, totalArea, estimatePngSize, estimateTotalBytes,
  formatBytes, generateLinkTags, generateManifestIcons, validateSize, nextPowerOfTwo,
  isPowerOfTwo, scalingFactor, fitWithin, buildCustomSpecs, renderCheckerboard, summarizeSpecs,
} from "./logic";

describe("FAVICON_SIZES", () => {
  it("includes 16, 32, 48, 64, 128, 180, 192, 512", () => {
    const sizes = FAVICON_SIZES.map((s) => s.size);
    [16, 32, 48, 64, 128, 180, 192, 512].forEach((n) => expect(sizes).toContain(n));
  });
});

describe("filterByPlatform", () => {
  it("returns only browser specs", () => {
    const r = filterByPlatform(FAVICON_SIZES, "browser");
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((s) => s.platform === "browser")).toBe(true);
  });
  it("returns only ios specs", () => {
    const r = filterByPlatform(FAVICON_SIZES, "ios");
    expect(r.every((s) => s.platform === "ios")).toBe(true);
  });
});

describe("totalArea", () => {
  it("sums squares", () => {
    const specs = [{ name: "a", size: 16, platform: "browser" as const }, { name: "b", size: 32, platform: "browser" as const }];
    expect(totalArea(specs)).toBe(16 * 16 + 32 * 32);
  });
});

describe("estimatePngSize", () => {
  it("scales with pixel count", () => {
    const small = estimatePngSize(16, 16);
    const large = estimatePngSize(512, 512);
    expect(large).toBeGreaterThan(small);
  });
  it("respects rawBytes override", () => {
    const a = estimatePngSize(16, 16, 1024);
    const b = estimatePngSize(16, 16, 2048);
    expect(b).toBeGreaterThan(a);
  });
});

describe("estimateTotalBytes & formatBytes", () => {
  it("returns positive total", () => {
    expect(estimateTotalBytes(FAVICON_SIZES)).toBeGreaterThan(0);
  });
  it("formats bytes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(2 * 1024 * 1024)).toBe("2.00 MB");
  });
});

describe("generateLinkTags", () => {
  it("produces <link> tags", () => {
    const html = generateLinkTags(FAVICON_SIZES.slice(0, 2));
    expect(html).toContain("<link");
    expect(html).toContain("sizes=\"16x16\"");
    expect(html).toContain("href=\"/favicon-16x16.png\"");
  });
});

describe("generateManifestIcons", () => {
  it("produces JSON with icons array", () => {
    const json = generateManifestIcons(FAVICON_SIZES);
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed.icons)).toBe(true);
    expect(parsed.icons.length).toBeGreaterThan(0);
  });
});

describe("validateSize", () => {
  it("accepts valid size", () => {
    expect(validateSize(64).ok).toBe(true);
  });
  it("rejects non-integer", () => {
    expect(validateSize(64.5).ok).toBe(false);
  });
  it("rejects negative", () => {
    expect(validateSize(-10).ok).toBe(false);
  });
  it("rejects too large", () => {
    expect(validateSize(4096).ok).toBe(false);
  });
});

describe("nextPowerOfTwo & isPowerOfTwo", () => {
  it("nextPowerOfTwo of 17 is 32", () => {
    expect(nextPowerOfTwo(17)).toBe(32);
  });
  it("nextPowerOfTwo of 1 is 1", () => {
    expect(nextPowerOfTwo(1)).toBe(1);
  });
  it("isPowerOfTwo detects 64", () => {
    expect(isPowerOfTwo(64)).toBe(true);
    expect(isPowerOfTwo(48)).toBe(false);
  });
});

describe("scalingFactor & fitWithin", () => {
  it("scalingFactor = target/source", () => {
    expect(scalingFactor(256, 64)).toBeCloseTo(0.25);
  });
  it("fitWithin preserves aspect", () => {
    const r = fitWithin(200, 100, 50);
    expect(r.w).toBe(50);
    expect(r.h).toBe(25);
  });
  it("fitWithin square stays square", () => {
    const r = fitWithin(100, 100, 64);
    expect(r.w).toBe(64);
    expect(r.h).toBe(64);
  });
});

describe("buildCustomSpecs", () => {
  it("returns specs with given sizes", () => {
    const specs = buildCustomSpecs([24, 96]);
    expect(specs.length).toBe(2);
    expect(specs[0].size).toBe(24);
  });
});

describe("renderCheckerboard", () => {
  it("produces RGBA buffer", () => {
    const buf = renderCheckerboard(16);
    expect(buf.length).toBe(16 * 16 * 4);
    expect(buf[3]).toBe(255);
  });
});

describe("summarizeSpecs", () => {
  it("returns summary with bytes", () => {
    const s = summarizeSpecs(FAVICON_SIZES.slice(0, 3));
    expect(s.length).toBe(3);
    expect(s[0].bytes).toBeGreaterThan(0);
    expect(typeof s[0].prettyBytes).toBe("string");
  });
});
