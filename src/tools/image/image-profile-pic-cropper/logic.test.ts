/**
 * Profile Picture Cropper — unit tests.
 */
import { describe, it, expect } from "vitest";
import {
  PLATFORM_PRESETS, getPlatform, validateInput, baseCropRect,
  applyZoomAndOffset, calculateCrop, multiPlatformCrops,
  ruleOfThirdsPoints, circleBounds, sourceQuality, buildFilename, cropsToCsv,
} from "./logic";

describe("platform presets", () => {
  it("includes 6 platforms", () => {
    expect(PLATFORM_PRESETS.length).toBe(6);
  });
  it("Instagram is 320px circle", () => {
    const p = getPlatform("instagram");
    expect(p).toBeDefined();
    expect(p!.size).toBe(320);
    expect(p!.shape).toBe("circle");
  });
  it("YouTube is 800px", () => {
    expect(getPlatform("youtube")!.size).toBe(800);
  });
  it("TikTok is 200px", () => {
    expect(getPlatform("tiktok")!.size).toBe(200);
  });
  it("returns undefined for unknown", () => {
    expect(getPlatform("myspace")).toBeUndefined();
  });
});

describe("validateInput", () => {
  it("accepts valid input", () => {
    expect("ok" in validateInput({ srcWidth: 1000, srcHeight: 1000, platformCode: "instagram", zoom: 1, offsetX: 0, offsetY: 0 })).toBe(true);
  });
  it("errors on non-positive source", () => {
    expect("error" in validateInput({ srcWidth: 0, srcHeight: 1000, platformCode: "instagram", zoom: 1, offsetX: 0, offsetY: 0 })).toBe(true);
  });
  it("errors on unknown platform", () => {
    expect("error" in validateInput({ srcWidth: 1000, srcHeight: 1000, platformCode: "nope", zoom: 1, offsetX: 0, offsetY: 0 })).toBe(true);
  });
  it("errors on non-positive zoom", () => {
    expect("error" in validateInput({ srcWidth: 1000, srcHeight: 1000, platformCode: "instagram", zoom: 0, offsetX: 0, offsetY: 0 })).toBe(true);
  });
});

describe("baseCropRect", () => {
  it("returns centered square for landscape", () => {
    const r = baseCropRect(1000, 500);
    expect(r.width).toBe(500);
    expect(r.height).toBe(500);
    expect(r.x).toBe(250);
    expect(r.y).toBe(0);
  });
  it("returns centered square for portrait", () => {
    const r = baseCropRect(400, 800);
    expect(r.width).toBe(400);
    expect(r.height).toBe(400);
    expect(r.y).toBe(200);
  });
});

describe("applyZoomAndOffset", () => {
  it("zoom 2x halves the crop size", () => {
    const base = baseCropRect(1000, 1000);
    const r = applyZoomAndOffset(1000, 1000, base, 2, 0, 0);
    expect(r.width).toBeCloseTo(500, 0);
    expect(r.height).toBeCloseTo(500, 0);
  });
  it("offset moves crop center", () => {
    const base = baseCropRect(1000, 1000);
    const r0 = applyZoomAndOffset(1000, 1000, base, 2, 0, 0);
    const r1 = applyZoomAndOffset(1000, 1000, base, 2, 100, 0);
    expect(r1.x).not.toBe(r0.x);
  });
  it("clamps to source bounds", () => {
    const base = baseCropRect(1000, 1000);
    const r = applyZoomAndOffset(1000, 1000, base, 2, 10000, 10000);
    expect(r.x).toBeLessThanOrEqual(500);
    expect(r.y).toBeLessThanOrEqual(500);
    expect(r.x).toBeGreaterThanOrEqual(0);
  });
});

describe("calculateCrop", () => {
  it("returns integer crop rect for Instagram", () => {
    const r = calculateCrop({ srcWidth: 1000, srcHeight: 1000, platformCode: "instagram", zoom: 1, offsetX: 0, offsetY: 0 });
    if ("error" in r) throw new Error("Should not error");
    expect(Number.isInteger(r.x)).toBe(true);
    expect(r.outputSize).toBe(320);
    expect(r.shape).toBe("circle");
  });
  it("warns on high zoom", () => {
    const r = calculateCrop({ srcWidth: 1000, srcHeight: 1000, platformCode: "instagram", zoom: 5, offsetX: 0, offsetY: 0 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.warnings.some((w) => w.includes("pixelation"))).toBe(true);
  });
  it("warns when crop is small", () => {
    const r = calculateCrop({ srcWidth: 80, srcHeight: 80, platformCode: "youtube", zoom: 1, offsetX: 0, offsetY: 0 });
    if ("error" in r) throw new Error("Should not error");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe("multiPlatformCrops", () => {
  it("returns crop specs for all 6 platforms", () => {
    const crops = multiPlatformCrops(2000, 2000, 1, 0, 0);
    expect(crops.length).toBe(6);
    expect(crops[0]!.code).toBe("instagram");
  });
});

describe("ruleOfThirdsPoints", () => {
  it("returns 4 intersection points", () => {
    const pts = ruleOfThirdsPoints({ x: 0, y: 0, width: 300, height: 300 });
    expect(pts.length).toBe(4);
    expect(pts[0]).toEqual({ x: 100, y: 100 });
  });
});

describe("circleBounds", () => {
  it("computes center and radius", () => {
    const c = circleBounds({ x: 0, y: 0, width: 200, height: 200 });
    expect(c.cx).toBe(100);
    expect(c.cy).toBe(100);
    expect(c.r).toBe(100);
  });
});

describe("sourceQuality", () => {
  it("scores 100 for 2x resolution", () => {
    expect(sourceQuality(2000, 2000, 320)).toBe(100);
  });
  it("scores low for small source", () => {
    expect(sourceQuality(100, 100, 800)).toBeLessThan(60);
  });
});

describe("buildFilename", () => {
  it("includes platform code and size", () => {
    const f = buildFilename("instagram", "circle");
    expect(f).toContain("instagram");
    expect(f).toContain("320");
    expect(f.endsWith(".png")).toBe(true);
  });
});

describe("cropsToCsv", () => {
  it("includes header and all platforms", () => {
    const crops = multiPlatformCrops(2000, 2000, 1, 0, 0);
    const csv = cropsToCsv(crops);
    expect(csv.split("\n")[0]).toBe("platform,name,x,y,width,height,outputSize,shape");
    expect(csv.split("\n").length).toBe(7); // header + 6
  });
});
