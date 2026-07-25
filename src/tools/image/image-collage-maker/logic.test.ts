import { describe, it, expect } from "vitest";
import {
  computeCollageLayout,
  fitContain,
  fitCover,
  computeCellViewport,
  swapIndices,
  shuffleSeeded,
  computeTextPlacement,
  dimensionsForAspect,
  serializeProject,
  parseProject,
  buildGradientCss,
  buildCollageFilename,
  validateCollageInput,
  COLLAGE_PRESETS,
  ASPECT_PRESETS,
  type CollageInput,
} from "./logic";

const baseInput = (over: Partial<CollageInput> = {}): CollageInput => ({
  imageCount: 4,
  columns: 2,
  canvasWidth: 1000,
  canvasHeight: 1000,
  gap: 10,
  borderWidth: 0,
  borderRadius: 0,
  ...over,
});

describe("computeCollageLayout", () => {
  it("computes a 2x2 grid", () => {
    const r = computeCollageLayout(baseInput());
    expect(r).toMatchObject({ rows: 2, columns: 2 });
    expect((r as { cells: unknown[] }).cells.length).toBe(4);
  });
  it("handles partial last row", () => {
    const r = computeCollageLayout(baseInput({ imageCount: 5, columns: 2 }));
    expect((r as { rows: number }).rows).toBe(3);
    expect((r as { cells: unknown[] }).cells.length).toBe(5);
  });
  it("respects gap", () => {
    const r = computeCollageLayout(baseInput({ imageCount: 2, columns: 2, canvasWidth: 220, canvasHeight: 100, gap: 20 }));
    const cell0 = (r as { cells: { x: number; width: number }[] }).cells[0];
    const cell1 = (r as { cells: { x: number; width: number }[] }).cells[1];
    expect(cell0.x).toBe(20);
    expect(cell1.x - (cell0.x + cell0.width)).toBe(20);
  });
  it("errors on non-positive image count", () => {
    expect(computeCollageLayout(baseInput({ imageCount: 0 }))).toHaveProperty("error");
  });
  it("errors on non-positive columns", () => {
    expect(computeCollageLayout(baseInput({ columns: 0 }))).toHaveProperty("error");
  });
  it("errors on negative gap", () => {
    expect(computeCollageLayout(baseInput({ gap: -1 }))).toHaveProperty("error");
  });
  it("accounts for border width", () => {
    const r = computeCollageLayout(baseInput({ borderWidth: 10 }));
    const cell0 = (r as { cells: { width: number; outerWidth: number }[] }).cells[0];
    expect(cell0.outerWidth - cell0.width).toBe(20); // 10 on each side
  });
});

describe("fitContain", () => {
  it("fits a landscape image in a square cell", () => {
    const r = fitContain(200, 100, 100, 100) as { width: number; height: number };
    expect(r.width).toBe(100);
    expect(r.height).toBe(50);
  });
  it("centers the image", () => {
    const r = fitContain(200, 100, 100, 100) as { x: number; y: number };
    expect(r.x).toBe(0);
    expect(r.y).toBe(25);
  });
  it("errors on invalid dims", () => {
    expect(fitContain(0, 100, 100, 100)).toHaveProperty("error");
  });
});

describe("fitCover", () => {
  it("covers the cell", () => {
    const r = fitCover(200, 100, 100, 100) as { width: number; height: number };
    expect(r.width).toBe(200);
    expect(r.height).toBe(100);
  });
  it("errors on invalid dims", () => {
    expect(fitCover(100, 0, 100, 100)).toHaveProperty("error");
  });
});

describe("computeCellViewport", () => {
  it("stretch mode fills cell exactly", () => {
    const v = computeCellViewport(200, 100, 50, 50, "stretch", 1, 0, 0) as { sw: number; dw: number };
    expect(v.sw).toBe(200);
    expect(v.dw).toBe(50);
  });
  it("zoom > 1 reduces source size", () => {
    const v1 = computeCellViewport(200, 200, 100, 100, "cover", 1, 0, 0) as { sw: number };
    const v2 = computeCellViewport(200, 200, 100, 100, "cover", 2, 0, 0) as { sw: number };
    expect(v2.sw).toBeLessThan(v1.sw);
  });
  it("clamps source rectangle to image bounds", () => {
    const v = computeCellViewport(200, 200, 100, 100, "cover", 2, 1, 1) as { sx: number; sy: number };
    expect(v.sx).toBeGreaterThanOrEqual(0);
    expect(v.sy).toBeGreaterThanOrEqual(0);
  });
  it("errors on invalid zoom", () => {
    expect(computeCellViewport(100, 100, 50, 50, "cover", 0, 0, 0)).toHaveProperty("error");
  });
});

describe("swapIndices", () => {
  it("swaps two elements", () => {
    expect(swapIndices([1, 2, 3, 4], 0, 2)).toEqual([3, 2, 1, 4]);
  });
  it("does nothing when indices are equal", () => {
    expect(swapIndices([1, 2, 3], 1, 1)).toEqual([1, 2, 3]);
  });
  it("does nothing for out-of-range indices", () => {
    expect(swapIndices([1, 2, 3], 0, 10)).toEqual([1, 2, 3]);
  });
  it("does not mutate input", () => {
    const arr = [1, 2, 3];
    swapIndices(arr, 0, 1);
    expect(arr).toEqual([1, 2, 3]);
  });
});

describe("shuffleSeeded", () => {
  it("returns same elements, possibly reordered", () => {
    const out = shuffleSeeded([1, 2, 3, 4, 5], 42);
    expect(out.sort()).toEqual([1, 2, 3, 4, 5]);
  });
  it("is deterministic with same seed", () => {
    expect(shuffleSeeded([1, 2, 3, 4, 5], 99)).toEqual(shuffleSeeded([1, 2, 3, 4, 5], 99));
  });
  it("does not mutate input", () => {
    const arr = [1, 2, 3];
    shuffleSeeded(arr, 1);
    expect(arr).toEqual([1, 2, 3]);
  });
});

describe("computeTextPlacement", () => {
  it("scales 0..1 to canvas pixels", () => {
    const p = computeTextPlacement({ text: "Hi", x: 0.5, y: 0.25, fontSize: 24, color: "#fff", rotation: 0 }, 1000, 800);
    expect(p.x).toBe(500);
    expect(p.y).toBe(200);
  });
  it("converts rotation degrees to radians", () => {
    const p = computeTextPlacement({ text: "Hi", x: 0, y: 0, fontSize: 24, color: "#fff", rotation: 180 }, 100, 100);
    expect(p.rotationRad).toBeCloseTo(Math.PI, 5);
  });
});

describe("dimensionsForAspect", () => {
  it("1:1 returns square", () => {
    expect(dimensionsForAspect("1:1", 1000)).toEqual({ width: 1000, height: 1000 });
  });
  it("16:9 returns correct height", () => {
    const d = dimensionsForAspect("16:9", 1600);
    expect(d.height).toBe(900);
  });
  it("9:16 returns portrait", () => {
    const d = dimensionsForAspect("9:16", 1080);
    expect(d.height).toBe(1920);
  });
});

describe("serializeProject / parseProject", () => {
  it("round-trips a project", () => {
    const p = {
      columns: 2, canvasWidth: 1000, canvasHeight: 1000, gap: 10, borderWidth: 0, borderRadius: 0,
      bgColor: "#fff", gradient: null, aspect: "1:1" as const, text: [], imageNames: ["a.png"], flips: ["none" as const],
    };
    const json = serializeProject(p);
    const back = parseProject(json);
    expect(back).not.toBeNull();
    expect(back!.columns).toBe(2);
    expect(back!.imageNames).toEqual(["a.png"]);
  });
  it("returns null for invalid JSON", () => {
    expect(parseProject("not json")).toBeNull();
  });
});

describe("buildGradientCss", () => {
  it("builds a linear-gradient string", () => {
    expect(buildGradientCss("#fff", "#000", 45)).toBe("linear-gradient(45deg, #fff, #000)");
  });
});

describe("buildCollageFilename", () => {
  it("uses aspect in filename", () => {
    expect(buildCollageFilename("1:1", "image/png")).toBe("collage-1x1.png");
    expect(buildCollageFilename("16:9", "image/jpeg")).toBe("collage-16x9.jpg");
  });
});

describe("validateCollageInput", () => {
  it("accepts valid input", () => {
    expect(validateCollageInput(baseInput())).toEqual({ ok: true });
  });
  it("rejects too many columns", () => {
    expect(validateCollageInput(baseInput({ columns: 50 }))).toHaveProperty("error");
  });
  it("rejects too-large canvas", () => {
    expect(validateCollageInput(baseInput({ canvasWidth: 99999 }))).toHaveProperty("error");
  });
});

describe("constants", () => {
  it("provides presets", () => {
    expect(COLLAGE_PRESETS.length).toBeGreaterThan(0);
    expect(ASPECT_PRESETS.length).toBeGreaterThanOrEqual(4);
  });
});
