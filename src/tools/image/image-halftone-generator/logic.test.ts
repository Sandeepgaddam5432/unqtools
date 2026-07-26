import { describe, it, expect } from "vitest";
import {
  luminance,
  rgbToCmyk,
  generateHalftone,
  statsToCsv,
  type HalftoneInput,
} from "./logic";

function makePixels(width: number, height: number, color: [number, number, number]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = color[0];
    data[i * 4 + 1] = color[1];
    data[i * 4 + 2] = color[2];
    data[i * 4 + 3] = 255;
  }
  return data;
}

const BASE_INPUT: Omit<HalftoneInput, "width" | "height" | "pixels"> = {
  pattern: "round",
  cellSize: 8,
  angle: 0,
  minDotSize: 0.1,
  maxDotSize: 0.9,
  intensity: 1,
};

describe("luminance", () => {
  it("returns 0 for black", () => {
    expect(luminance(0, 0, 0)).toBe(0);
  });
  it("returns 1 for white", () => {
    expect(luminance(255, 255, 255)).toBeCloseTo(1, 5);
  });
  it("weights green more than red (Rec.709)", () => {
    expect(luminance(0, 255, 0)).toBeGreaterThan(luminance(255, 0, 0));
  });
  it("weights green more than blue", () => {
    expect(luminance(0, 255, 0)).toBeGreaterThan(luminance(0, 0, 255));
  });
});

describe("rgbToCmyk", () => {
  it("returns k=1 for black", () => {
    const c = rgbToCmyk(0, 0, 0);
    expect(c.k).toBe(1);
    expect(c.c).toBe(0);
    expect(c.m).toBe(0);
    expect(c.y).toBe(0);
  });
  it("returns k=0 for white", () => {
    const c = rgbToCmyk(255, 255, 255);
    expect(c.k).toBe(0);
    expect(c.c).toBe(0);
    expect(c.m).toBe(0);
    expect(c.y).toBe(0);
  });
  it("cyan dominates for pure cyan", () => {
    const c = rgbToCmyk(0, 255, 255);
    expect(c.c).toBeCloseTo(1, 5);
    expect(c.m).toBeCloseTo(0, 5);
    expect(c.y).toBeCloseTo(0, 5);
    expect(c.k).toBeCloseTo(0, 5);
  });
  it("magenta dominates for pure magenta", () => {
    const c = rgbToCmyk(255, 0, 255);
    expect(c.m).toBeCloseTo(1, 5);
  });
  it("yellow dominates for pure yellow", () => {
    const c = rgbToCmyk(255, 255, 0);
    expect(c.y).toBeCloseTo(1, 5);
  });
});

describe("generateHalftone — validation", () => {
  it("errors on non-positive width", () => {
    const r = generateHalftone({ ...BASE_INPUT, width: 0, height: 10, pixels: new Uint8ClampedArray(0) });
    expect("error" in r).toBe(true);
  });
  it("errors on missing pixels", () => {
    const r = generateHalftone({ ...BASE_INPUT, width: 10, height: 10, pixels: new Uint8ClampedArray(10) });
    expect("error" in r).toBe(true);
  });
  it("errors when cell size larger than image", () => {
    const px = makePixels(20, 20, [0, 0, 0]);
    const r = generateHalftone({ ...BASE_INPUT, width: 20, height: 20, pixels: px, cellSize: 40 });
    expect("error" in r).toBe(true);
  });
});

describe("generateHalftone — output", () => {
  it("returns cells for a valid image", () => {
    const px = makePixels(40, 40, [0, 0, 0]);
    const r = generateHalftone({ ...BASE_INPUT, width: 40, height: 40, pixels: px });
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(r.cells.length).toBeGreaterThan(0);
    expect(r.width).toBe(40);
    expect(r.height).toBe(40);
    expect(r.cols).toBeGreaterThan(0);
    expect(r.rows).toBeGreaterThan(0);
  });

  it("returns an SVG string", () => {
    const px = makePixels(20, 20, [0, 0, 0]);
    const r = generateHalftone({ ...BASE_INPUT, width: 20, height: 20, pixels: px });
    if ("error" in r) throw new Error("unexpected error");
    expect(r.svg).toContain("<svg");
    expect(r.svg).toContain("</svg>");
  });

  it("computes LPI from cell size (96 DPI baseline)", () => {
    const px = makePixels(40, 40, [0, 0, 0]);
    const r = generateHalftone({ ...BASE_INPUT, width: 40, height: 40, pixels: px, cellSize: 8 });
    if ("error" in r) throw new Error("unexpected error");
    // 96 / 8 = 12
    expect(r.lpi).toBeCloseTo(12, 1);
  });

  it("dark images produce larger dots on average than light images", () => {
    const dark = generateHalftone({ ...BASE_INPUT, width: 40, height: 40, pixels: makePixels(40, 40, [0, 0, 0]) });
    const light = generateHalftone({ ...BASE_INPUT, width: 40, height: 40, pixels: makePixels(40, 40, [255, 255, 255]) });
    if ("error" in dark || "error" in light) throw new Error("unexpected error");
    expect(dark.stats.avgDotSize).toBeGreaterThan(light.stats.avgDotSize);
  });

  it("invert flips dark/light dots", () => {
    const invLight = generateHalftone({ ...BASE_INPUT, width: 40, height: 40, pixels: makePixels(40, 40, [255, 255, 255]), invert: true });
    const plainLight = generateHalftone({ ...BASE_INPUT, width: 40, height: 40, pixels: makePixels(40, 40, [255, 255, 255]) });
    if ("error" in invLight || "error" in plainLight) throw new Error("unexpected error");
    expect(invLight.stats.avgDotSize).toBeGreaterThan(plainLight.stats.avgDotSize);
  });

  it("warns on very small cell size", () => {
    const px = makePixels(40, 40, [0, 0, 0]);
    const r = generateHalftone({ ...BASE_INPUT, width: 40, height: 40, pixels: px, cellSize: 3 });
    if ("error" in r) throw new Error("unexpected error");
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it("CMYK color mode colors cells with channel color", () => {
    const px = makePixels(40, 40, [0, 0, 0]); // black
    const r = generateHalftone({ ...BASE_INPUT, width: 40, height: 40, pixels: px, colorMode: "cmyk" });
    if ("error" in r) throw new Error("unexpected error");
    expect(r.cells.length).toBeGreaterThan(0);
    // For pure black, K channel dominates → black color {0,0,0}
    expect(r.cells[0]!.color.r).toBe(0);
    expect(r.cells[0]!.color.g).toBe(0);
    expect(r.cells[0]!.color.b).toBe(0);
  });

  it("RGB color mode preserves source color in cells", () => {
    const px = makePixels(40, 40, [123, 200, 50]);
    const r = generateHalftone({ ...BASE_INPUT, width: 40, height: 40, pixels: px, colorMode: "rgb" });
    if ("error" in r) throw new Error("unexpected error");
    expect(r.cells[0]!.color.r).toBe(123);
    expect(r.cells[0]!.color.g).toBe(200);
    expect(r.cells[0]!.color.b).toBe(50);
  });

  it("monochrome mode uses foreground color", () => {
    const px = makePixels(40, 40, [200, 100, 50]);
    const r = generateHalftone({ ...BASE_INPUT, width: 40, height: 40, pixels: px, colorMode: "monochrome", fgColor: "#ff8800" });
    if ("error" in r) throw new Error("unexpected error");
    expect(r.cells[0]!.color.r).toBe(255);
    expect(r.cells[0]!.color.g).toBe(136);
    expect(r.cells[0]!.color.b).toBe(0);
  });

  it("stats: max ≥ avg ≥ min", () => {
    const px = makePixels(40, 40, [128, 128, 128]);
    const r = generateHalftone({ ...BASE_INPUT, width: 40, height: 40, pixels: px });
    if ("error" in r) throw new Error("unexpected error");
    expect(r.stats.maxDotSize).toBeGreaterThanOrEqual(r.stats.avgDotSize);
    expect(r.stats.avgDotSize).toBeGreaterThanOrEqual(r.stats.minDotSize);
  });
});

describe("statsToCsv", () => {
  it("produces a CSV with header row", () => {
    const px = makePixels(20, 20, [128, 128, 128]);
    const r = generateHalftone({ ...BASE_INPUT, width: 20, height: 20, pixels: px });
    if ("error" in r) throw new Error("unexpected error");
    const csv = statsToCsv(r);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("CellIndex,X,Y,Luminance,DotSize,Color");
    expect(lines.length).toBe(r.cells.length + 1);
  });
});
