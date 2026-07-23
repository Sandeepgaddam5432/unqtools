/**
 * Photo Mosaic Generator — unit tests.
 *
 * Tests cover the pure helpers (color conversion, k-d tree, layout, matching,
 * stats, print dimensions, histogram, mask, manifest, starter tiles).
 * DOM-dependent async helpers (buildTileLibrary, renderMosaic*) are exercised
 * in E2E tests, not here — vitest runs in a node environment without a DOM.
 */
import { describe, it, expect } from "vitest";
import {
  rgbToLab,
  labToRgb,
  computeLabColor,
  computeAverageColor,
  computeEdgeScore,
  colorDistance,
  buildKdTree,
  nearestNeighbor,
  nearestKNeighbors,
  computeMosaicLayout,
  matchTilesToCells,
  computeRenderStats,
  tileUsageHistogram,
  computePrintDimensions,
  PAPER_SIZES_MM,
  applyMask,
  exportTileMapManifest,
  generateStarterTileData,
  hslToRgb,
  assembleTileLibrary,
  buildLibraryFromTiles,
  type RGB,
  type Lab,
  type ImageLike,
  type TileData,
  type Cell,
  type MatchResult,
  type MosaicOptions,
  type TileLibrary,
} from "./logic";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeImageLike(
  width: number,
  height: number,
  fill: RGB | ((x: number, y: number) => RGB),
): ImageLike {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const c = typeof fill === "function" ? fill(x, y) : fill;
      const i = (y * width + x) * 4;
      data[i] = c.r;
      data[i + 1] = c.g;
      data[i + 2] = c.b;
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

function makeTile(id: string, color: RGB, weight = 1): TileData {
  return {
    id,
    source: null,
    thumb: null,
    avgColor: color,
    labColor: rgbToLab(color),
    edgeScore: 0,
    weight,
    filename: `${id}.png`,
  };
}

function makeLibrary(tiles: TileData[]): TileLibrary {
  return buildLibraryFromTiles(tiles, "user");
}

// ---------------------------------------------------------------------------
// Color conversion
// ---------------------------------------------------------------------------

describe("rgbToLab", () => {
  it("converts pure white (255,255,255) to L≈100, a≈0, b≈0", () => {
    const lab = rgbToLab({ r: 255, g: 255, b: 255 });
    expect(lab.L).toBeCloseTo(100, 0);
    expect(Math.abs(lab.a)).toBeLessThan(1);
    expect(Math.abs(lab.b)).toBeLessThan(1);
  });

  it("converts pure black (0,0,0) to L≈0", () => {
    const lab = rgbToLab({ r: 0, g: 0, b: 0 });
    expect(lab.L).toBeCloseTo(0, 0);
    expect(Math.abs(lab.a)).toBeLessThan(1);
    expect(Math.abs(lab.b)).toBeLessThan(1);
  });

  it("converts pure red (255,0,0) with positive a", () => {
    const lab = rgbToLab({ r: 255, g: 0, b: 0 });
    expect(lab.L).toBeGreaterThan(40);
    expect(lab.L).toBeLessThan(60);
    expect(lab.a).toBeGreaterThan(50); // red -> high positive a (~80)
  });

  it("converts pure green (0,255,0) with negative a", () => {
    const lab = rgbToLab({ r: 0, g: 255, b: 0 });
    expect(lab.L).toBeGreaterThan(70);
    expect(lab.L).toBeLessThan(95);
    expect(lab.a).toBeLessThan(-50); // green -> negative a
  });

  it("converts pure blue (0,0,255) with negative b", () => {
    const lab = rgbToLab({ r: 0, g: 0, b: 255 });
    expect(lab.b).toBeLessThan(-50); // blue -> negative b
  });
});

describe("labToRgb", () => {
  it("roundtrips white", () => {
    const orig: RGB = { r: 255, g: 255, b: 255 };
    const rgb = labToRgb(rgbToLab(orig));
    expect(rgb.r).toBeCloseTo(255, -1);
    expect(rgb.g).toBeCloseTo(255, -1);
    expect(rgb.b).toBeCloseTo(255, -1);
  });

  it("roundtrips mid-gray", () => {
    const orig: RGB = { r: 128, g: 128, b: 128 };
    const rgb = labToRgb(rgbToLab(orig));
    expect(Math.abs(rgb.r - 128)).toBeLessThan(3);
    expect(Math.abs(rgb.g - 128)).toBeLessThan(3);
    expect(Math.abs(rgb.b - 128)).toBeLessThan(3);
  });

  it("clamps out-of-gamut values to 0-255", () => {
    const rgb = labToRgb({ L: 200, a: 0, b: 0 });
    expect(rgb.r).toBeLessThanOrEqual(255);
    expect(rgb.g).toBeLessThanOrEqual(255);
    expect(rgb.b).toBeLessThanOrEqual(255);
    expect(rgb.r).toBeGreaterThanOrEqual(0);
  });
});

describe("computeLabColor", () => {
  it("matches rgbToLab output", () => {
    const rgb: RGB = { r: 100, g: 150, b: 200 };
    expect(computeLabColor(rgb)).toEqual(rgbToLab(rgb));
  });
});

// ---------------------------------------------------------------------------
// Average color + edge score
// ---------------------------------------------------------------------------

describe("computeAverageColor", () => {
  it("returns 0,0,0 for empty image", () => {
    const img: ImageLike = { width: 0, height: 0, data: new Uint8ClampedArray(0) };
    expect(computeAverageColor(img)).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("returns the solid fill color", () => {
    const img = makeImageLike(4, 4, { r: 10, g: 20, b: 30 });
    expect(computeAverageColor(img)).toEqual({ r: 10, g: 20, b: 30 });
  });

  it("averages a two-color image", () => {
    const img = makeImageLike(2, 2, (_x, y) =>
      y === 0 ? { r: 0, g: 0, b: 0 } : { r: 100, g: 100, b: 100 },
    );
    const avg = computeAverageColor(img);
    expect(avg.r).toBe(50);
    expect(avg.g).toBe(50);
    expect(avg.b).toBe(50);
  });
});

describe("computeEdgeScore", () => {
  it("returns 0 for a solid color image", () => {
    const img = makeImageLike(10, 10, { r: 50, g: 50, b: 50 });
    expect(computeEdgeScore(img)).toBe(0);
  });

  it("returns >0 for an image with a sharp vertical edge", () => {
    const img = makeImageLike(10, 10, (x) =>
      x < 5 ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 },
    );
    expect(computeEdgeScore(img)).toBeGreaterThan(0);
  });

  it("returns 0 for tiny images (< 3px)", () => {
    const img = makeImageLike(2, 2, { r: 0, g: 0, b: 0 });
    expect(computeEdgeScore(img)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Color distance
// ---------------------------------------------------------------------------

describe("colorDistance", () => {
  it("returns 0 for identical RGB colors", () => {
    expect(colorDistance({ r: 10, g: 20, b: 30 }, { r: 10, g: 20, b: 30 }, "rgb")).toBe(0);
  });

  it("computes Euclidean RGB distance", () => {
    const d = colorDistance({ r: 0, g: 0, b: 0 }, { r: 3, g: 4, b: 0 }, "rgb");
    expect(d).toBeCloseTo(5, 5);
  });

  it("returns 0 for identical Lab colors", () => {
    const a: Lab = { L: 50, a: 10, b: -10 };
    expect(colorDistance(a, { ...a }, "lab")).toBe(0);
  });

  it("computes Lab distance", () => {
    const a: Lab = { L: 0, a: 0, b: 0 };
    const b: Lab = { L: 3, a: 4, b: 0 };
    expect(colorDistance(a, b, "lab")).toBeCloseTo(5, 5);
  });
});

// ---------------------------------------------------------------------------
// k-d tree
// ---------------------------------------------------------------------------

describe("buildKdTree", () => {
  it("returns empty tree for empty list", () => {
    const tree = buildKdTree([]);
    expect(tree.root).toBeNull();
    expect(tree.size).toBe(0);
  });

  it("builds a single-node tree", () => {
    const tree = buildKdTree([makeTile("a", { r: 10, g: 20, b: 30 })]);
    expect(tree.size).toBe(1);
    expect(tree.root).not.toBeNull();
    expect(tree.root!.tile.id).toBe("a");
    expect(tree.root!.left).toBeNull();
    expect(tree.root!.right).toBeNull();
  });

  it("builds a tree with the correct size", () => {
    const tiles = [
      makeTile("a", { r: 10, g: 20, b: 30 }),
      makeTile("b", { r: 200, g: 100, b: 50 }),
      makeTile("c", { r: 50, g: 50, b: 50 }),
    ];
    const tree = buildKdTree(tiles);
    expect(tree.size).toBe(3);
  });
});

describe("nearestNeighbor", () => {
  it("returns null for empty tree", () => {
    const tree = buildKdTree([]);
    expect(nearestNeighbor(tree, { r: 0, g: 0, b: 0 }, "rgb")).toBeNull();
  });

  it("returns the only tile for a single-node tree", () => {
    const tile = makeTile("a", { r: 10, g: 20, b: 30 });
    const tree = buildKdTree([tile]);
    expect(nearestNeighbor(tree, { r: 0, g: 0, b: 0 }, "rgb")!.id).toBe("a");
  });

  it("finds the closest of three tiles (RGB mode)", () => {
    const tiles = [
      makeTile("red", { r: 255, g: 0, b: 0 }),
      makeTile("green", { r: 0, g: 255, b: 0 }),
      makeTile("blue", { r: 0, g: 0, b: 255 }),
    ];
    const tree = buildKdTree(tiles);
    const result = nearestNeighbor(tree, { r: 250, g: 5, b: 5 }, "rgb");
    expect(result!.id).toBe("red");
  });

  it("finds the closest tile in Lab mode", () => {
    const tiles = [
      makeTile("dark-red", { r: 80, g: 0, b: 0 }),
      makeTile("light-blue", { r: 180, g: 200, b: 255 }),
    ];
    const tree = buildKdTree(tiles);
    const target = rgbToLab({ r: 170, g: 190, b: 250 });
    const result = nearestNeighbor(tree, target, "lab");
    expect(result!.id).toBe("light-blue");
  });
});

describe("nearestKNeighbors", () => {
  it("returns k sorted neighbors (ascending by distance)", () => {
    const tiles = [
      makeTile("a", { r: 0, g: 0, b: 0 }),
      makeTile("b", { r: 5, g: 5, b: 5 }),
      makeTile("c", { r: 50, g: 50, b: 50 }),
      makeTile("d", { r: 100, g: 100, b: 100 }),
    ];
    const tree = buildKdTree(tiles);
    const result = nearestKNeighbors(tree, { r: 1, g: 1, b: 1 }, "rgb", 3);
    expect(result.length).toBe(3);
    expect(result[0]!.tile.id).toBe("a");
    expect(result[1]!.tile.id).toBe("b");
    expect(result[2]!.tile.id).toBe("c");
    // Ascending
    expect(result[0]!.distance).toBeLessThanOrEqual(result[1]!.distance);
    expect(result[1]!.distance).toBeLessThanOrEqual(result[2]!.distance);
  });

  it("returns fewer than k when library is small", () => {
    const tiles = [makeTile("only", { r: 10, g: 10, b: 10 })];
    const tree = buildKdTree(tiles);
    const result = nearestKNeighbors(tree, { r: 0, g: 0, b: 0 }, "rgb", 5);
    expect(result.length).toBe(1);
  });

  it("returns empty for k=0", () => {
    const tree = buildKdTree([makeTile("a", { r: 0, g: 0, b: 0 })]);
    expect(nearestKNeighbors(tree, { r: 0, g: 0, b: 0 }, "rgb", 0)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Mosaic layout
// ---------------------------------------------------------------------------

describe("computeMosaicLayout", () => {
  it("produces the correct cell count for a square layout", () => {
    const img = makeImageLike(100, 100, { r: 0, g: 0, b: 0 });
    const { cells } = computeMosaicLayout(img, { tilesAcross: 10, tileAspect: 1 });
    expect(cells.length).toBe(100); // 10x10
  });

  it("produces ceil(rows) when height is not divisible by cellH", () => {
    const img = makeImageLike(100, 105, { r: 0, g: 0, b: 0 });
    const { cells } = computeMosaicLayout(img, { tilesAcross: 10, tileAspect: 1 });
    // cellW=10, cellH=10, rows=ceil(105/10)=11 -> 110 cells
    expect(cells.length).toBe(110);
  });

  it("respects tileAspect for non-square cells", () => {
    const img = makeImageLike(100, 100, { r: 0, g: 0, b: 0 });
    const { cells } = computeMosaicLayout(img, { tilesAcross: 10, tileAspect: 2 });
    // cellW=10, cellH=5, rows=20 -> 200 cells
    expect(cells.length).toBe(200);
    expect(cells[0]!.w).toBeCloseTo(10, 5);
    expect(cells[0]!.h).toBeCloseTo(5, 5);
  });

  it("computes per-cell target color from source pixels", () => {
    const img = makeImageLike(20, 10, (x) =>
      x < 10 ? { r: 255, g: 0, b: 0 } : { r: 0, g: 0, b: 255 },
    );
    const { cells } = computeMosaicLayout(img, { tilesAcross: 2, tileAspect: 1 });
    expect(cells.length).toBe(2);
    expect(cells[0]!.targetColor).toEqual({ r: 255, g: 0, b: 0 });
    expect(cells[1]!.targetColor).toEqual({ r: 0, g: 0, b: 255 });
  });

  it("handles single-cell layout", () => {
    const img = makeImageLike(10, 10, { r: 50, g: 60, b: 70 });
    const { cells } = computeMosaicLayout(img, { tilesAcross: 1, tileAspect: 1 });
    expect(cells.length).toBe(1);
    expect(cells[0]!.targetColor).toEqual({ r: 50, g: 60, b: 70 });
  });

  it("handles very dense layout (many cells)", () => {
    const img = makeImageLike(100, 100, { r: 0, g: 0, b: 0 });
    const { cells } = computeMosaicLayout(img, { tilesAcross: 100, tileAspect: 1 });
    expect(cells.length).toBe(10000);
  });
});

// ---------------------------------------------------------------------------
// Tile matching
// ---------------------------------------------------------------------------

describe("matchTilesToCells", () => {
  it("returns empty for empty cells", () => {
    const lib = makeLibrary([makeTile("a", { r: 0, g: 0, b: 0 })]);
    const result = matchTilesToCells([], lib, {
      matchMode: "rgb",
      minDistance: 0,
      allowRotation: false,
    });
    expect(result).toEqual([]);
  });

  it("returns empty for empty library", () => {
    const lib = makeLibrary([]);
    const cells: Cell[] = [
      {
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        w: 10,
        h: 10,
        targetColor: { r: 0, g: 0, b: 0 },
        targetLab: { L: 0, a: 0, b: 0 },
        targetEdge: 0,
        important: false,
      },
    ];
    const result = matchTilesToCells(cells, lib, {
      matchMode: "rgb",
      minDistance: 0,
      allowRotation: false,
    });
    expect(result).toEqual([]);
  });

  it("matches a single cell to the closest tile", () => {
    const lib = makeLibrary([
      makeTile("red", { r: 255, g: 0, b: 0 }),
      makeTile("blue", { r: 0, g: 0, b: 255 }),
    ]);
    const cells: Cell[] = [
      {
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        targetColor: { r: 250, g: 5, b: 5 },
        targetLab: rgbToLab({ r: 250, g: 5, b: 5 }),
        targetEdge: 0,
        important: false,
      },
    ];
    const result = matchTilesToCells(cells, lib, {
      matchMode: "rgb",
      minDistance: 0,
      allowRotation: false,
    });
    expect(result.length).toBe(1);
    expect(result[0]!.tileId).toBe("red");
  });

  it("respects min-distance to avoid immediate repeats", () => {
    const lib = makeLibrary([
      makeTile("a", { r: 0, g: 0, b: 0 }),
      makeTile("b", { r: 5, g: 5, b: 5 }),
    ]);
    // 2x2 grid, all cells target black (closest = "a")
    const cells: Cell[] = [];
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        cells.push({
          row,
          col,
          x: col,
          y: row,
          w: 1,
          h: 1,
          targetColor: { r: 0, g: 0, b: 0 },
          targetLab: rgbToLab({ r: 0, g: 0, b: 0 }),
          targetEdge: 0,
          important: false,
        });
      }
    }
    const result = matchTilesToCells(cells, lib, {
      matchMode: "rgb",
      minDistance: 2,
      allowRotation: false,
    });
    // Cell 0 -> "a". Cell 1 (adjacent) should be "b" (min-distance 2 blocks "a").
    expect(result[0]!.tileId).toBe("a");
    expect(result[1]!.tileId).toBe("b");
  });

  it("assigns rotation when allowRotation is true", () => {
    const lib = makeLibrary([makeTile("a", { r: 0, g: 0, b: 0 })]);
    const cells: Cell[] = [
      {
        row: 0,
        col: 1,
        x: 1,
        y: 0,
        w: 1,
        h: 1,
        targetColor: { r: 0, g: 0, b: 0 },
        targetLab: rgbToLab({ r: 0, g: 0, b: 0 }),
        targetEdge: 0,
        important: false,
      },
    ];
    const result = matchTilesToCells(cells, lib, {
      matchMode: "rgb",
      minDistance: 0,
      allowRotation: true,
    });
    // (row+col) % 4 = (0+1) % 4 = 1 -> rotation = 90
    expect(result[0]!.rotation).toBe(90);
  });

  it("assigns rotation = 0 when allowRotation is false", () => {
    const lib = makeLibrary([makeTile("a", { r: 0, g: 0, b: 0 })]);
    const cells: Cell[] = [
      {
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        targetColor: { r: 0, g: 0, b: 0 },
        targetLab: rgbToLab({ r: 0, g: 0, b: 0 }),
        targetEdge: 0,
        important: false,
      },
    ];
    const result = matchTilesToCells(cells, lib, {
      matchMode: "rgb",
      minDistance: 0,
      allowRotation: false,
    });
    expect(result[0]!.rotation).toBe(0);
  });

  it("populates alternatives (up to 3)", () => {
    const lib = makeLibrary([
      makeTile("a", { r: 0, g: 0, b: 0 }),
      makeTile("b", { r: 5, g: 5, b: 5 }),
      makeTile("c", { r: 10, g: 10, b: 10 }),
      makeTile("d", { r: 15, g: 15, b: 15 }),
    ]);
    const cells: Cell[] = [
      {
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        targetColor: { r: 0, g: 0, b: 0 },
        targetLab: rgbToLab({ r: 0, g: 0, b: 0 }),
        targetEdge: 0,
        important: false,
      },
    ];
    const result = matchTilesToCells(cells, lib, {
      matchMode: "rgb",
      minDistance: 0,
      allowRotation: false,
    });
    expect(result[0]!.alternatives.length).toBe(3);
    expect(result[0]!.alternatives).not.toContain("a");
  });

  it("respects per-tile weight (higher weight = preferred)", () => {
    const lib = makeLibrary([
      makeTile("close", { r: 10, g: 10, b: 10 }, 1),
      makeTile("far", { r: 30, g: 30, b: 30 }, 100), // huge weight
    ]);
    const cells: Cell[] = [
      {
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        targetColor: { r: 12, g: 12, b: 12 },
        targetLab: rgbToLab({ r: 12, g: 12, b: 12 }),
        targetEdge: 0,
        important: false,
      },
    ];
    const result = matchTilesToCells(cells, lib, {
      matchMode: "rgb",
      minDistance: 0,
      allowRotation: false,
    });
    // "close" raw dist ≈ sqrt(3*4)=3.46, effDist=3.46
    // "far" raw dist ≈ sqrt(3*18^2*... )=31.1, effDist=0.31 -> "far" wins
    expect(result[0]!.tileId).toBe("far");
  });
});

// ---------------------------------------------------------------------------
// Render stats + histogram
// ---------------------------------------------------------------------------

describe("computeRenderStats", () => {
  it("returns zeros for empty matches", () => {
    const stats = computeRenderStats([], 0);
    expect(stats.totalCells).toBe(0);
    expect(stats.uniqueTiles).toBe(0);
    expect(stats.repetitionRatio).toBe(0);
    expect(stats.mostUsedTileId).toBeNull();
  });

  it("computes unique tiles and repetition ratio", () => {
    const matches: MatchResult[] = [
      { cellIndex: 0, tileId: "a", score: 1, rotation: 0, alternatives: [] },
      { cellIndex: 1, tileId: "a", score: 1, rotation: 0, alternatives: [] },
      { cellIndex: 2, tileId: "b", score: 1, rotation: 0, alternatives: [] },
      { cellIndex: 3, tileId: "c", score: 1, rotation: 0, alternatives: [] },
    ];
    const stats = computeRenderStats(matches, 4);
    expect(stats.totalCells).toBe(4);
    expect(stats.uniqueTiles).toBe(3);
    expect(stats.repetitionRatio).toBeCloseTo(1 / 4, 5);
  });

  it("identifies most- and least-used tiles", () => {
    const matches: MatchResult[] = [
      { cellIndex: 0, tileId: "a", score: 0, rotation: 0, alternatives: [] },
      { cellIndex: 1, tileId: "a", score: 0, rotation: 0, alternatives: [] },
      { cellIndex: 2, tileId: "a", score: 0, rotation: 0, alternatives: [] },
      { cellIndex: 3, tileId: "b", score: 0, rotation: 0, alternatives: [] },
    ];
    const stats = computeRenderStats(matches, 4);
    expect(stats.mostUsedTileId).toBe("a");
    expect(stats.mostUsedCount).toBe(3);
    expect(stats.leastUsedTileId).toBe("b");
    expect(stats.leastUsedCount).toBe(1);
  });

  it("computes average match score", () => {
    const matches: MatchResult[] = [
      { cellIndex: 0, tileId: "a", score: 10, rotation: 0, alternatives: [] },
      { cellIndex: 1, tileId: "a", score: 20, rotation: 0, alternatives: [] },
    ];
    const stats = computeRenderStats(matches, 2);
    expect(stats.averageScore).toBe(15);
  });
});

describe("tileUsageHistogram", () => {
  it("returns an empty map for no matches", () => {
    expect(tileUsageHistogram([]).size).toBe(0);
  });

  it("counts and sorts by usage descending", () => {
    const matches: MatchResult[] = [
      { cellIndex: 0, tileId: "a", score: 0, rotation: 0, alternatives: [] },
      { cellIndex: 1, tileId: "a", score: 0, rotation: 0, alternatives: [] },
      { cellIndex: 2, tileId: "a", score: 0, rotation: 0, alternatives: [] },
      { cellIndex: 3, tileId: "b", score: 0, rotation: 0, alternatives: [] },
      { cellIndex: 4, tileId: "c", score: 0, rotation: 0, alternatives: [] },
      { cellIndex: 5, tileId: "c", score: 0, rotation: 0, alternatives: [] },
    ];
    const hist = tileUsageHistogram(matches);
    expect(Array.from(hist.entries())).toEqual([
      ["a", 3],
      ["c", 2],
      ["b", 1],
    ]);
  });
});

// ---------------------------------------------------------------------------
// Print dimensions
// ---------------------------------------------------------------------------

describe("computePrintDimensions", () => {
  it("computes A4 @ 300 DPI", () => {
    const dim = computePrintDimensions(300, "A4");
    // 210mm / 25.4 * 300 = 2480.31 -> 2480
    expect(dim.widthPx).toBe(2480);
    // 297mm / 25.4 * 300 = 3507.87 -> 3508
    expect(dim.heightPx).toBe(3508);
  });

  it("computes Letter @ 72 DPI", () => {
    const dim = computePrintDimensions(72, "Letter");
    // 215.9mm / 25.4 * 72 = 612
    expect(dim.widthPx).toBe(612);
    // 279.4mm / 25.4 * 72 = 792
    expect(dim.heightPx).toBe(792);
  });

  it("A3 is larger than A4", () => {
    const a4 = computePrintDimensions(300, "A4");
    const a3 = computePrintDimensions(300, "A3");
    expect(a3.widthPx).toBeGreaterThan(a4.widthPx);
    expect(a3.heightPx).toBeGreaterThan(a4.heightPx);
  });

  it("PAPER_SIZES_MM has A4, A3, Letter", () => {
    expect(PAPER_SIZES_MM.A4).toEqual({ w: 210, h: 297 });
    expect(PAPER_SIZES_MM.A3).toEqual({ w: 297, h: 420 });
    expect(PAPER_SIZES_MM.Letter).toEqual({ w: 215.9, h: 279.4 });
  });
});

// ---------------------------------------------------------------------------
// Mask regions
// ---------------------------------------------------------------------------

describe("applyMask", () => {
  it("returns all normal when mask is empty", () => {
    const cells: Cell[] = [
      {
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        w: 10,
        h: 10,
        targetColor: { r: 0, g: 0, b: 0 },
        targetLab: { L: 0, a: 0, b: 0 },
        targetEdge: 0,
        important: false,
      },
    ];
    const { important, normal } = applyMask(cells, []);
    expect(important.length).toBe(0);
    expect(normal.length).toBe(1);
  });

  it("splits cells based on region", () => {
    const cells: Cell[] = [];
    for (let i = 0; i < 4; i++) {
      cells.push({
        row: 0,
        col: i,
        x: i * 10,
        y: 0,
        w: 10,
        h: 10,
        targetColor: { r: 0, g: 0, b: 0 },
        targetLab: { L: 0, a: 0, b: 0 },
        targetEdge: 0,
        important: false,
      });
    }
    // Mask covers x=15..30 (w=15). Cell centers at x=5,15,25,35.
    // Centers 15 and 25 fall inside the mask -> 2 important, 2 normal.
    const { important, normal } = applyMask(cells, [{ x: 15, y: 0, w: 15, h: 10 }]);
    expect(important.length).toBe(2);
    expect(normal.length).toBe(2);
    expect(important.every((c) => c.important)).toBe(true);
    expect(normal.every((c) => !c.important)).toBe(true);
  });

  it("handles overlapping mask regions", () => {
    const cells: Cell[] = [
      {
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        w: 10,
        h: 10,
        targetColor: { r: 0, g: 0, b: 0 },
        targetLab: { L: 0, a: 0, b: 0 },
        targetEdge: 0,
        important: false,
      },
    ];
    const { important } = applyMask(cells, [
      { x: 0, y: 0, w: 5, h: 5 },
      { x: 5, y: 5, w: 5, h: 5 },
    ]);
    // Cell center (5,5) is in the second region
    expect(important.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// CSV manifest export
// ---------------------------------------------------------------------------

describe("exportTileMapManifest", () => {
  it("produces a CSV with header + one row per match", () => {
    const lib = makeLibrary([
      makeTile("a", { r: 0, g: 0, b: 0 }),
      makeTile("b", { r: 255, g: 255, b: 255 }),
    ]);
    const img = makeImageLike(20, 20, (x) =>
      x < 10 ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 },
    );
    const { cells } = computeMosaicLayout(img, { tilesAcross: 2, tileAspect: 1 });
    const matches = matchTilesToCells(cells, lib, {
      matchMode: "rgb",
      minDistance: 0,
      allowRotation: false,
    });
    const opts: MosaicOptions = {
      tilesAcross: 2,
      tileAspect: 1,
      blendPercent: 0,
      tintStrength: 0,
      groutSpacing: 0,
      groutColor: { r: 0, g: 0, b: 0 },
      matchMode: "rgb",
      allowRotation: false,
      minDistance: 0,
      fitMode: "crop",
      dpi: 300,
      paperSize: "A4",
    };
    const csv = exportTileMapManifest(matches, cells, opts);
    const lines = csv.split("\n");
    expect(lines.length).toBe(matches.length + 1);
    expect(lines[0]).toContain("row,col");
    expect(lines[0]).toContain("tile_id");
    expect(lines[0]).toContain("dpi");
    expect(lines[0]).toContain("paper_size");
    // First data row should reference one of the tile ids
    expect(lines[1]).toMatch(/[ab]/);
  });

  it("handles empty matches (header only)", () => {
    const opts: MosaicOptions = {
      tilesAcross: 1,
      tileAspect: 1,
      blendPercent: 0,
      tintStrength: 0,
      groutSpacing: 0,
      groutColor: { r: 0, g: 0, b: 0 },
      matchMode: "rgb",
      allowRotation: false,
      minDistance: 0,
      fitMode: "crop",
      dpi: 300,
      paperSize: "A4",
    };
    const csv = exportTileMapManifest([], [], opts);
    const lines = csv.split("\n");
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain("row");
  });
});

// ---------------------------------------------------------------------------
// Starter tiles + hslToRgb
// ---------------------------------------------------------------------------

describe("hslToRgb", () => {
  it("converts black (no saturation)", () => {
    expect(hslToRgb(0, 0, 0)).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("converts white (no saturation, full lightness)", () => {
    expect(hslToRgb(0, 0, 1)).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("converts pure red (hue=0)", () => {
    expect(hslToRgb(0, 1, 0.5)).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("converts pure green (hue=1/3)", () => {
    expect(hslToRgb(1 / 3, 1, 0.5)).toEqual({ r: 0, g: 255, b: 0 });
  });

  it("converts pure blue (hue=2/3)", () => {
    expect(hslToRgb(2 / 3, 1, 0.5)).toEqual({ r: 0, g: 0, b: 255 });
  });
});

describe("generateStarterTileData", () => {
  it("produces the requested count", () => {
    const tiles = generateStarterTileData(12);
    expect(tiles.length).toBe(12);
  });

  it("assigns unique IDs and computes Lab colors", () => {
    const tiles = generateStarterTileData(5);
    const ids = new Set(tiles.map((t) => t.id));
    expect(ids.size).toBe(5);
    for (const t of tiles) {
      expect(t.labColor).toBeDefined();
      expect(t.weight).toBe(1);
      expect(t.edgeScore).toBe(0);
    }
  });

  it("produces an empty array for count=0", () => {
    expect(generateStarterTileData(0)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// assembleTileLibrary + buildLibraryFromTiles
// ---------------------------------------------------------------------------

describe("assembleTileLibrary", () => {
  it("builds a library with computed colors and k-d trees", () => {
    const decoded = [
      {
        id: "t1",
        filename: "a.png",
        thumb: null,
        source: null,
        imageData: makeImageLike(4, 4, { r: 10, g: 20, b: 30 }),
      },
      {
        id: "t2",
        filename: "b.png",
        thumb: null,
        source: null,
        imageData: makeImageLike(4, 4, { r: 200, g: 100, b: 50 }),
      },
    ];
    const lib = assembleTileLibrary(decoded);
    expect(lib.tiles.length).toBe(2);
    expect(lib.treeRgb.size).toBe(2);
    expect(lib.treeLab.size).toBe(2);
    expect(lib.bytes).toBeGreaterThan(0);
    expect(lib.tiles[0]!.avgColor).toEqual({ r: 10, g: 20, b: 30 });
    expect(lib.tiles[1]!.avgColor).toEqual({ r: 200, g: 100, b: 50 });
  });

  it("returns empty library for no decoded tiles", () => {
    const lib = assembleTileLibrary([]);
    expect(lib.tiles).toEqual([]);
    expect(lib.treeRgb.size).toBe(0);
  });
});

describe("buildLibraryFromTiles", () => {
  it("rebuilds k-d trees from cached tiles", () => {
    const tiles = [
      makeTile("a", { r: 10, g: 20, b: 30 }),
      makeTile("b", { r: 40, g: 50, b: 60 }),
    ];
    const lib = buildLibraryFromTiles(tiles, "cache");
    expect(lib.source).toBe("cache");
    expect(lib.treeRgb.size).toBe(2);
    expect(lib.treeLab.size).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// End-to-end (pure pipeline)
// ---------------------------------------------------------------------------

describe("end-to-end pure pipeline", () => {
  it("builds a 4x4 mosaic from a 4-tile library", () => {
    const tiles = [
      makeTile("red", { r: 255, g: 0, b: 0 }),
      makeTile("green", { r: 0, g: 255, b: 0 }),
      makeTile("blue", { r: 0, g: 0, b: 255 }),
      makeTile("white", { r: 255, g: 255, b: 255 }),
    ];
    const lib = makeLibrary(tiles);
    const img = makeImageLike(40, 40, (x, y) => {
      if (x < 20 && y < 20) return { r: 255, g: 0, b: 0 };
      if (x >= 20 && y < 20) return { r: 0, g: 255, b: 0 };
      if (x < 20 && y >= 20) return { r: 0, g: 0, b: 255 };
      return { r: 255, g: 255, b: 255 };
    });
    const { cells } = computeMosaicLayout(img, { tilesAcross: 2, tileAspect: 1 });
    const matches = matchTilesToCells(cells, lib, {
      matchMode: "rgb",
      minDistance: 0,
      allowRotation: false,
    });
    expect(matches.length).toBe(4);
    // Top-left cell should match red, top-right green, etc.
    expect(matches[0]!.tileId).toBe("red");
    expect(matches[1]!.tileId).toBe("green");
    expect(matches[2]!.tileId).toBe("blue");
    expect(matches[3]!.tileId).toBe("white");
    const stats = computeRenderStats(matches, 4);
    expect(stats.uniqueTiles).toBe(4);
    expect(stats.repetitionRatio).toBe(0);
  });
});
