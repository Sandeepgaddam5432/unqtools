import { describe, it, expect } from "vitest";
import {
  validateCrop, centerCropForAspect, cropToExact, corners, gridLines,
  rotateDimensions, rectStats, boundingCircle, largestSquare, fitAspect,
  ASPECT_PRESETS, batchValidate, batchToCsv, fmt,
} from "./logic";

describe("validateCrop", () => {
  it("accepts a valid in-bounds crop", () => {
    expect(validateCrop({ x: 10, y: 10, width: 100, height: 100, imageWidth: 200, imageHeight: 200 })).toEqual({
      x: 10, y: 10, width: 100, height: 100,
    });
  });
  it("clamps x and y to image bounds", () => {
    expect(validateCrop({ x: -5, y: -10, width: 50, height: 50, imageWidth: 100, imageHeight: 100 })).toEqual({
      x: 0, y: 0, width: 50, height: 50,
    });
  });
  it("clamps width when crop exceeds image", () => {
    expect(validateCrop({ x: 80, y: 80, width: 100, height: 100, imageWidth: 100, imageHeight: 100 })).toEqual({
      x: 80, y: 80, width: 20, height: 20,
    });
  });
  it("errors on non-positive width", () => {
    expect(validateCrop({ x: 0, y: 0, width: 0, height: 50, imageWidth: 100, imageHeight: 100 })).toHaveProperty("error");
  });
  it("errors when crop is fully outside the image", () => {
    expect(validateCrop({ x: 200, y: 200, width: 50, height: 50, imageWidth: 100, imageHeight: 100 })).toHaveProperty("error");
  });
  it("errors on invalid image bounds", () => {
    expect(validateCrop({ x: 0, y: 0, width: 50, height: 50, imageWidth: 0, imageHeight: 0 })).toHaveProperty("error");
  });
});

describe("centerCropForAspect", () => {
  it("centers 1:1 in landscape image", () => {
    const r = centerCropForAspect(200, 100, 1, 1);
    expect(r.width).toBe(100);
    expect(r.height).toBe(100);
    expect(r.x).toBe(50);
    expect(r.y).toBe(0);
  });
  it("centers 1:3 in portrait image", () => {
    const r = centerCropForAspect(100, 200, 1, 3);
    expect(r.height).toBe(200);
    expect(r.width).toBe(Math.round(200 / 3));
  });
  it("returns full image when aspect is 0", () => {
    const r = centerCropForAspect(200, 100, 0, 0);
    expect(r).toEqual({ x: 0, y: 0, width: 200, height: 100 });
  });
  it("provides presets", () => {
    expect(ASPECT_PRESETS.length).toBeGreaterThanOrEqual(6);
    expect(ASPECT_PRESETS.find((p) => p.label === "1:1")).toBeDefined();
  });
});

describe("cropToExact", () => {
  it("computes centered crop for exact pixel size", () => {
    expect(cropToExact(200, 200, 100, 100)).toEqual({ x: 50, y: 50, width: 100, height: 100 });
  });
  it("errors when target exceeds source", () => {
    expect(cropToExact(50, 50, 100, 100)).toHaveProperty("error");
  });
  it("errors on non-positive target", () => {
    expect(cropToExact(200, 200, 0, 100)).toHaveProperty("error");
  });
});

describe("corners", () => {
  it("computes four corners", () => {
    const c = corners({ x: 10, y: 10, width: 100, height: 50 });
    expect(c.tl).toEqual([10, 10]);
    expect(c.tr).toEqual([110, 10]);
    expect(c.br).toEqual([110, 60]);
    expect(c.bl).toEqual([10, 60]);
  });
});

describe("gridLines", () => {
  it("returns rule-of-thirds lines", () => {
    const g = gridLines({ x: 0, y: 0, width: 300, height: 300 }, 3);
    expect(g.verticals).toEqual([100, 200]);
    expect(g.horizontals).toEqual([100, 200]);
  });
  it("returns empty arrays for divisions < 1", () => {
    const g = gridLines({ x: 0, y: 0, width: 100, height: 100 }, 0);
    expect(g.verticals).toEqual([]);
  });
});

describe("rotateDimensions", () => {
  it("swaps dimensions for 90°", () => {
    expect(rotateDimensions(200, 100, 90)).toEqual({ width: 100, height: 200 });
  });
  it("swaps dimensions for 270°", () => {
    expect(rotateDimensions(200, 100, 270)).toEqual({ width: 100, height: 200 });
  });
  it("preserves dimensions for 180°", () => {
    expect(rotateDimensions(200, 100, 180)).toEqual({ width: 200, height: 100 });
  });
});

describe("rectStats", () => {
  it("computes area and aspect", () => {
    const s = rectStats({ x: 0, y: 0, width: 100, height: 50 });
    expect(s.area).toBe(5000);
    expect(s.aspect).toBeCloseTo(2, 5);
  });
});

describe("boundingCircle", () => {
  it("computes circle for crop rect", () => {
    const c = boundingCircle({ x: 0, y: 0, width: 100, height: 60 });
    expect(c.cx).toBe(50);
    expect(c.cy).toBe(30);
    expect(c.r).toBe(30);
  });
});

describe("largestSquare", () => {
  it("returns the largest square inside the rect", () => {
    const s = largestSquare({ x: 0, y: 0, width: 100, height: 60 });
    expect(s.width).toBe(60);
    expect(s.height).toBe(60);
  });
});

describe("fitAspect", () => {
  it("contains target inside source", () => {
    const r = fitAspect(200, 200, 16, 9, "contain");
    expect(r.width / r.height).toBeCloseTo(16 / 9, 3);
    expect(r.width).toBeLessThanOrEqual(200);
  });
  it("covers source with target", () => {
    const r = fitAspect(200, 200, 16, 9, "cover");
    expect(r.width / r.height).toBeCloseTo(16 / 9, 3);
    expect(r.width).toBeGreaterThanOrEqual(200);
  });
});

describe("batchValidate / batchToCsv", () => {
  it("validates each crop", () => {
    const r = batchValidate([
      { x: 0, y: 0, width: 50, height: 50, imageWidth: 100, imageHeight: 100 },
      { x: 0, y: 0, width: 0, height: 50, imageWidth: 100, imageHeight: 100 },
    ]);
    expect(r).toHaveLength(2);
    expect("error" in r[1]!.result).toBe(true);
  });
  it("renders CSV with header", () => {
    const csv = batchToCsv(batchValidate([
      { x: 0, y: 0, width: 50, height: 50, imageWidth: 100, imageHeight: 100 },
    ]));
    expect(csv.split("\n")[0]).toBe("index,x,y,width,height");
    expect(csv).toContain("50");
  });
});

describe("fmt", () => {
  it("trims precision", () => {
    expect(fmt(1.23456, 2)).toBe("1.23");
  });
  it("em-dash for NaN", () => {
    expect(fmt(NaN)).toBe("—");
  });
});
