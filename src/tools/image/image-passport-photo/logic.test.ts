/**
 * Passport Photo Maker — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  COUNTRY_SPECS, getCountry, mmToInch, inchToMm, pixelsForSize,
  centeredCropRect, validateHeadSize, validateBackground, eyeLineY,
  headOffset, resolutionQuality, printLayout4x6, validatePhoto, buildFilename,
} from "./logic";

describe("country specs", () => {
  it("includes US, UK, EU, India, Australia, Canada", () => {
    const codes = COUNTRY_SPECS.map((c) => c.code);
    expect(codes).toEqual(expect.arrayContaining(["US", "UK", "EU", "IN", "AU", "CA"]));
  });
  it("US is 2x2 inch (51x51mm)", () => {
    const us = getCountry("US");
    expect(us).toBeDefined();
    expect(us!.width).toBe(51);
    expect(us!.height).toBe(51);
  });
  it("UK and EU are 35x45mm", () => {
    expect(getCountry("UK")!.width).toBe(35);
    expect(getCountry("UK")!.height).toBe(45);
    expect(getCountry("EU")!.height).toBe(45);
  });
  it("India is 35x35mm", () => {
    expect(getCountry("IN")!.width).toBe(35);
    expect(getCountry("IN")!.height).toBe(35);
  });
  it("Canada is 50x70mm", () => {
    const ca = getCountry("CA");
    expect(ca!.width).toBe(50);
    expect(ca!.height).toBe(70);
  });
  it("getCountry returns undefined for unknown", () => {
    expect(getCountry("XX")).toBeUndefined();
  });
});

describe("unit conversion", () => {
  it("converts mm to inch", () => {
    expect(mmToInch(25.4)).toBeCloseTo(1, 5);
  });
  it("converts inch to mm", () => {
    expect(inchToMm(2)).toBeCloseTo(50.8, 1);
  });
  it("round-trips", () => {
    expect(inchToMm(mmToInch(35))).toBeCloseTo(35, 5);
  });
});

describe("pixelsForSize", () => {
  it("computes pixels for US 2in at 300dpi", () => {
    expect(pixelsForSize(50.8, 300)).toBe(600);
  });
  it("handles 600 dpi", () => {
    expect(pixelsForSize(25.4, 600)).toBe(600);
  });
});

describe("centeredCropRect", () => {
  it("crops landscape source to portrait target", () => {
    const r = centeredCropRect(1000, 600, getCountry("UK")!, 300);
    expect(r.height).toBe(600);
    expect(r.width).toBeLessThan(1000);
    expect(r.x).toBeGreaterThan(0);
    expect(r.y).toBe(0);
  });
  it("crops portrait source to square target", () => {
    const r = centeredCropRect(400, 800, getCountry("IN")!, 300);
    expect(r.width).toBe(400);
    expect(r.height).toBeLessThanOrEqual(800);
  });
});

describe("validateHeadSize", () => {
  it("accepts head within range", () => {
    const r = validateHeadSize(30, getCountry("US")!);
    expect(r.ok).toBe(true);
  });
  it("warns when head too small", () => {
    const r = validateHeadSize(20, getCountry("US")!);
    expect(r.ok).toBe(false);
    expect(r.warning).toContain("small");
  });
  it("warns when head too large", () => {
    const r = validateHeadSize(40, getCountry("US")!);
    expect(r.ok).toBe(false);
    expect(r.warning).toContain("large");
  });
});

describe("validateBackground", () => {
  it("accepts pure white for white tone", () => {
    const r = validateBackground(255, 255, 255, "white");
    expect(r.ok).toBe(true);
  });
  it("accepts off-white for off-white tone", () => {
    const r = validateBackground(245, 245, 245, "off-white");
    expect(r.ok).toBe(true);
  });
  it("rejects dark background", () => {
    const r = validateBackground(100, 100, 100, "white");
    expect(r.ok).toBe(false);
  });
  it("rejects colored tint", () => {
    const r = validateBackground(255, 200, 200, "white");
    expect(r.ok).toBe(false);
  });
});

describe("eyeLineY", () => {
  it("computes eye line from top of frame", () => {
    const y = eyeLineY(600, getCountry("US")!);
    expect(y).toBe(240); // 600 - 60% of 600
  });
});

describe("headOffset", () => {
  it("computes offset from frame center", () => {
    const off = headOffset(520, 300, 1000, 600);
    expect(off.dx).toBe(20);
    expect(off.dy).toBe(0);
  });
});

describe("resolutionQuality", () => {
  it("scores 100 for high-res source", () => {
    const q = resolutionQuality(2000, 2000, getCountry("US")!, 300);
    expect(q).toBe(100);
  });
  it("scores low for low-res source", () => {
    const q = resolutionQuality(50, 50, getCountry("US")!, 300);
    expect(q).toBeLessThan(60);
  });
});

describe("printLayout4x6", () => {
  it("fits multiple photos on a 4x6 sheet", () => {
    const l = printLayout4x6(getCountry("US")!);
    expect(l.cols).toBeGreaterThanOrEqual(1);
    expect(l.rows).toBeGreaterThanOrEqual(1);
    expect(l.count).toBe(l.cols * l.rows);
  });
  it("yields more copies for smaller photo", () => {
    const big = printLayout4x6(getCountry("CA")!);
    const small = printLayout4x6(getCountry("IN")!);
    expect(small.count).toBeGreaterThanOrEqual(big.count);
  });
});

describe("validatePhoto", () => {
  it("returns warnings and crop", () => {
    const r = validatePhoto({
      srcWidth: 800, srcHeight: 800,
      headMm: 30, bgR: 255, bgG: 255, bgB: 255,
      spec: getCountry("US")!, dpi: 300,
    });
    expect(r.crop.width).toBeGreaterThan(0);
    expect(r.qualityScore).toBeGreaterThan(0);
    expect(r.layout.count).toBeGreaterThan(0);
  });
  it("adds error for non-positive dimensions", () => {
    const r = validatePhoto({ srcWidth: 0, srcHeight: 0, spec: getCountry("US")!, dpi: 300 });
    expect(r.errors.length).toBeGreaterThan(0);
  });
  it("warns on off-center head", () => {
    const r = validatePhoto({
      srcWidth: 1000, srcHeight: 1000,
      headCenterXPx: 900, headCenterYPx: 500,
      spec: getCountry("US")!, dpi: 300,
    });
    expect(r.warnings.some((w) => w.includes("off-center"))).toBe(true);
  });
});

describe("buildFilename", () => {
  it("builds filename with country code and dpi", () => {
    const f = buildFilename(getCountry("US")!, 300);
    expect(f).toContain("us");
    expect(f).toContain("300");
    expect(f.endsWith(".png")).toBe(true);
  });
});
