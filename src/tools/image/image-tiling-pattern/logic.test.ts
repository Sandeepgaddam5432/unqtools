import { describe, it, expect } from "vitest";
import {
  wrapOffset,
  halfDropOffset,
  brickOffset,
  mirrorFlags,
  featherDistance,
  tilesPerDim,
  validateInput,
  cssBackgroundSnippet,
  svgPatternSnippet,
  computeTilePositions,
  generateTiling,
  batchGenerateTiling,
  statsToCsv,
  type TileInput,
} from "./logic";

const BASE: TileInput = {
  tileWidth: 100, tileHeight: 100,
  layout: "grid",
  outputWidth: 500, outputHeight: 500,
  spacing: 0, bgColor: "#ffffff", feather: 0,
};

describe("wrapOffset", () => {
  it("wraps positive values", () => {
    expect(wrapOffset(120, 100)).toBe(20);
  });
  it("wraps negative values", () => {
    expect(wrapOffset(-20, 100)).toBe(80);
  });
  it("returns 0 for non-positive dim", () => {
    expect(wrapOffset(50, 0)).toBe(0);
  });
  it("returns 0 for exact multiple", () => {
    expect(wrapOffset(200, 100)).toBe(0);
  });
});

describe("halfDropOffset", () => {
  it("returns 0 for even rows", () => {
    expect(halfDropOffset(0, 100)).toBe(0);
    expect(halfDropOffset(2, 100)).toBe(0);
  });
  it("returns half tileWidth for odd rows", () => {
    expect(halfDropOffset(1, 100)).toBe(50);
    expect(halfDropOffset(3, 100)).toBe(50);
  });
});

describe("brickOffset", () => {
  it("returns 0 for even cols", () => {
    expect(brickOffset(0, 100)).toBe(0);
    expect(brickOffset(2, 100)).toBe(0);
  });
  it("returns half tileHeight for odd cols", () => {
    expect(brickOffset(1, 100)).toBe(50);
  });
});

describe("mirrorFlags", () => {
  it("returns false/false for (0,0)", () => {
    expect(mirrorFlags(0, 0)).toEqual({ mirrorH: false, mirrorV: false });
  });
  it("returns true for odd col", () => {
    expect(mirrorFlags(1, 0).mirrorH).toBe(true);
    expect(mirrorFlags(1, 0).mirrorV).toBe(false);
  });
  it("returns true for odd row", () => {
    expect(mirrorFlags(0, 1).mirrorV).toBe(true);
  });
  it("returns both true for (1,1)", () => {
    expect(mirrorFlags(1, 1)).toEqual({ mirrorH: true, mirrorV: true });
  });
});

describe("featherDistance", () => {
  it("returns 1 when far from edge", () => {
    expect(featherDistance(50, 50, 100, 100, 5)).toBe(1);
  });
  it("returns 0 at corner", () => {
    expect(featherDistance(0, 0, 100, 100, 5)).toBe(0);
  });
  it("returns 1 when feather is 0", () => {
    expect(featherDistance(0, 0, 100, 100, 0)).toBe(1);
  });
  it("linear interpolation within radius", () => {
    expect(featherDistance(2.5, 50, 100, 100, 5)).toBeCloseTo(0.5, 5);
  });
});

describe("tilesPerDim", () => {
  it("computes tiles per row", () => {
    expect(tilesPerDim(500, 100, 0)).toBe(5);
  });
  it("includes spacing", () => {
    expect(tilesPerDim(500, 100, 10)).toBe(5);
  });
  it("returns 0 for non-positive tile dim", () => {
    expect(tilesPerDim(500, 0, 0)).toBe(0);
  });
});

describe("validateInput", () => {
  it("accepts valid input", () => {
    expect(validateInput(BASE)).toEqual({ ok: true });
  });
  it("rejects non-positive tile dims", () => {
    expect(validateInput({ ...BASE, tileWidth: 0 })).toHaveProperty("error");
  });
  it("rejects bad spacing", () => {
    expect(validateInput({ ...BASE, spacing: -1 })).toHaveProperty("error");
    expect(validateInput({ ...BASE, spacing: 100 })).toHaveProperty("error");
  });
  it("rejects bad feather", () => {
    expect(validateInput({ ...BASE, feather: 50 })).toHaveProperty("error");
  });
  it("rejects unknown layout", () => {
    expect(validateInput({ ...BASE, layout: "bogus" as never })).toHaveProperty("error");
  });
});

describe("cssBackgroundSnippet", () => {
  it("includes background-size", () => {
    const css = cssBackgroundSnippet(BASE);
    expect(css).toContain("background-size: 100px 100px");
    expect(css).toContain("background-color: #ffffff");
  });
});

describe("svgPatternSnippet", () => {
  it("includes <svg> and <pattern>", () => {
    const svg = svgPatternSnippet(BASE);
    expect(svg).toContain("<svg");
    expect(svg).toContain("<pattern");
    expect(svg).toContain("</svg>");
  });
  it("half-drop layout has 2 image refs", () => {
    const svg = svgPatternSnippet({ ...BASE, layout: "half-drop" });
    const matches = svg.match(/<image/g);
    expect(matches?.length).toBe(2);
  });
  it("brick layout has 2 image refs", () => {
    const svg = svgPatternSnippet({ ...BASE, layout: "brick" });
    const matches = svg.match(/<image/g);
    expect(matches?.length).toBe(2);
  });
  it("mirror layout has 2 image refs", () => {
    const svg = svgPatternSnippet({ ...BASE, layout: "mirror" });
    const matches = svg.match(/<image/g);
    expect(matches?.length).toBe(2);
  });
});

describe("computeTilePositions", () => {
  it("generates positions for grid layout", () => {
    const pos = computeTilePositions(BASE);
    expect(pos.length).toBeGreaterThan(0);
  });
  it("half-drop positions have offsetX for odd rows", () => {
    const pos = computeTilePositions({ ...BASE, layout: "half-drop" });
    const oddRows = pos.filter((p) => p.row % 2 === 1);
    expect(oddRows.length).toBeGreaterThan(0);
    for (const p of oddRows) {
      expect(p.offsetX).toBe(50);
    }
  });
});

describe("generateTiling", () => {
  it("returns result with stats and CSS", () => {
    const r = generateTiling(BASE);
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(r.stats.totalTiles).toBeGreaterThan(0);
    expect(r.cssBackground).toContain("background");
    expect(r.svgPattern).toContain("<svg");
  });
  it("errors on bad input", () => {
    expect("error" in generateTiling({ ...BASE, tileWidth: 0 })).toBe(true);
  });
  it("warns on high feather", () => {
    const r = generateTiling({ ...BASE, feather: 20 });
    if ("error" in r) throw new Error("unexpected");
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe("batchGenerateTiling", () => {
  it("runs over multiple inputs", () => {
    const r = batchGenerateTiling([BASE, BASE]);
    expect(r.length).toBe(2);
  });
});

describe("statsToCsv", () => {
  it("produces CSV with header", () => {
    const r = generateTiling(BASE);
    if ("error" in r) throw new Error("unexpected");
    const csv = statsToCsv(r.stats);
    expect(csv.startsWith("Field,Value")).toBe(true);
    expect(csv).toContain("TotalTiles");
  });
});
