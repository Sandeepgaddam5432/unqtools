/**
 * Pixel Art Maker — unit tests for the pure logic layer.
 *
 * The export wrappers (exportPng, exportGif, exportApng, exportSpriteSheet)
 * require a browser environment (Canvas, IndexedDB) and are not exercised by
 * these tests. The pure data layer, drawing primitives, palette parsers,
 * compositing, palette swap, serialize/deserialize, and history are all
 * covered here.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  createCanvas,
  cloneCanvas,
  addLayer,
  removeLayer,
  reorderLayers,
  setLayerOpacity,
  addFrame,
  removeFrame,
  reorderFrames,
  setFrameDelay,
  setPixel,
  getPixel,
  setPixelInPlace,
  drawLine,
  drawRect,
  drawEllipse,
  floodFill,
  floodFillGlobal,
  applyMirrorX,
  applyMirrorY,
  applyPixelPerfect,
  bresenhamLine,
  compositeFrameRgba,
  parseGplPalette,
  parsePalPalette,
  parseHexPalette,
  paletteSwap,
  applyTaggedMask,
  importSpriteSheet,
  exportAsepriteJson,
  serializeProject,
  deserializeProject,
  pushHistory,
  undo,
  redo,
  hexToRgba,
  rgbaToHex,
  shadeColor,
  nearestPaletteIndex,
  colorDistance,
  stampTile,
  transformTile,
  ditherAt,
  type PixelCanvas,
  type Palette,
  _resetIdCounter,
} from "./logic";

// Palette used across many tests.
const TEST_PALETTE: Palette = {
  name: "Test4",
  colors: ["#000000", "#ff0000", "#00ff00", "#0000ff", "#ffffff"],
};

beforeEach(() => {
  _resetIdCounter();
});

// ---------------------------------------------------------------------------
// createCanvas / dimensions
// ---------------------------------------------------------------------------

describe("createCanvas", () => {
  it("creates a 1-layer 1-frame canvas of the given size", () => {
    const c = createCanvas(16, 16, TEST_PALETTE);
    expect(c.width).toBe(16);
    expect(c.height).toBe(16);
    expect(c.layers).toHaveLength(1);
    expect(c.frames).toHaveLength(1);
    expect(c.palette.colors).toEqual(TEST_PALETTE.colors);
  });

  it("initializes pixel data to fully transparent", () => {
    const c = createCanvas(4, 4);
    const frame = c.frames[0]!;
    const data = frame.layerData[c.layers[0]!.id]!;
    expect(data.length).toBe(4 * 4 * 4);
    for (let i = 0; i < data.length; i++) {
      expect(data[i]).toBe(0);
    }
  });

  it("rejects zero or negative dimensions", () => {
    expect(() => createCanvas(0, 10)).toThrow();
    expect(() => createCanvas(10, -1)).toThrow();
  });

  it("rejects oversized dimensions", () => {
    expect(() => createCanvas(2000, 10)).toThrow();
    expect(() => createCanvas(10, 2000)).toThrow();
  });

  it("creates a 1x1 canvas (smallest valid size)", () => {
    const c = createCanvas(1, 1);
    expect(c.width).toBe(1);
    expect(c.height).toBe(1);
    expect(c.frames[0]!.layerData[c.layers[0]!.id]!.length).toBe(4);
  });

  it("uses a default palette when none provided", () => {
    const c = createCanvas(8, 8);
    expect(c.palette.colors.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// Layer operations
// ---------------------------------------------------------------------------

describe("layer operations", () => {
  it("addLayer creates a new transparent layer and switches active", () => {
    const c = createCanvas(8, 8);
    const out = addLayer(c, "Background");
    expect(out.layers).toHaveLength(2);
    expect(out.layers[1]!.name).toBe("Background");
    expect(out.activeLayerId).toBe(out.layers[1]!.id);
    // New layer data exists for every frame.
    for (const f of out.frames) {
      expect(f.layerData[out.layers[1]!.id]).toBeDefined();
      expect(f.layerData[out.layers[1]!.id]!.length).toBe(8 * 8 * 4);
    }
  });

  it("removeLayer drops the layer and its pixel data", () => {
    const c = createCanvas(8, 8);
    const out = addLayer(c);
    const removedId = out.layers[1]!.id;
    const after = removeLayer(out, removedId);
    expect(after.layers).toHaveLength(1);
    expect(after.frames[0]!.layerData[removedId]).toBeUndefined();
  });

  it("removeLayer refuses to remove the last layer", () => {
    const c = createCanvas(8, 8);
    expect(() => removeLayer(c, c.layers[0]!.id)).toThrow();
  });

  it("reorderLayers reorders by id", () => {
    const c = createCanvas(8, 8);
    const c2 = addLayer(c, "L2");
    const c3 = addLayer(c2, "L3");
    const ids = c3.layers.map((l) => l.id);
    const reordered = reorderLayers(c3, [ids[2]!, ids[0]!, ids[1]!]);
    expect(reordered.layers.map((l) => l.id)).toEqual([ids[2], ids[0], ids[1]]);
  });

  it("reorderLayers rejects unknown ids", () => {
    const c = createCanvas(8, 8);
    expect(() => reorderLayers(c, ["bogus"])).toThrow();
  });

  it("setLayerOpacity clamps to [0, 1]", () => {
    const c = createCanvas(8, 8);
    const out = setLayerOpacity(c, c.layers[0]!.id, 1.5);
    expect(out.layers[0]!.opacity).toBe(1);
    const out2 = setLayerOpacity(out, out.layers[0]!.id, -0.5);
    expect(out2.layers[0]!.opacity).toBe(0);
  });

  it("cloneCanvas produces a deep copy that does not share buffers", () => {
    const c = createCanvas(4, 4, TEST_PALETTE);
    const clone = cloneCanvas(c);
    expect(clone).not.toBe(c);
    expect(clone.layers).not.toBe(c.layers);
    expect(clone.frames).not.toBe(c.frames);
    const origData = c.frames[0]!.layerData[c.layers[0]!.id]!;
    const cloneData = clone.frames[0]!.layerData[clone.layers[0]!.id]!;
    expect(cloneData).not.toBe(origData);
    cloneData[0] = 255;
    expect(origData[0]).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Frame operations
// ---------------------------------------------------------------------------

describe("frame operations", () => {
  it("addFrame copies active frame's pixel data", () => {
    const c = createCanvas(8, 8);
    const drawn = setPixel(c, c.layers[0]!.id, c.frames[0]!.id, 2, 2, [255, 0, 0, 255]);
    const withFrame = addFrame(drawn);
    expect(withFrame.frames).toHaveLength(2);
    expect(withFrame.activeFrameId).toBe(withFrame.frames[1]!.id);
    // The new frame should inherit the pixel we drew.
    const [r, g, b, a] = getPixel(withFrame, withFrame.layers[0]!.id, withFrame.frames[1]!.id, 2, 2);
    expect([r, g, b, a]).toEqual([255, 0, 0, 255]);
  });

  it("removeFrame refuses on last frame", () => {
    const c = createCanvas(8, 8);
    expect(() => removeFrame(c, c.frames[0]!.id)).toThrow();
  });

  it("reorderFrames reorders by id", () => {
    const c = createCanvas(8, 8);
    const c2 = addFrame(c);
    const c3 = addFrame(c2);
    const ids = c3.frames.map((f) => f.id);
    const reordered = reorderFrames(c3, [ids[2]!, ids[1]!, ids[0]!]);
    expect(reordered.frames.map((f) => f.id)).toEqual([ids[2], ids[1], ids[0]]);
  });

  it("setFrameDelay clamps to >= 10ms", () => {
    const c = createCanvas(8, 8);
    const out = setFrameDelay(c, c.frames[0]!.id, 5);
    expect(out.frames[0]!.delay).toBe(10);
    const out2 = setFrameDelay(out, out.frames[0]!.id, 250);
    expect(out2.frames[0]!.delay).toBe(250);
  });
});

// ---------------------------------------------------------------------------
// Pixel primitives
// ---------------------------------------------------------------------------

describe("setPixel / getPixel", () => {
  it("writes and reads a pixel within bounds", () => {
    const c = createCanvas(8, 8);
    const out = setPixel(c, c.layers[0]!.id, c.frames[0]!.id, 3, 4, [10, 20, 30, 255]);
    const [r, g, b, a] = getPixel(out, out.layers[0]!.id, out.frames[0]!.id, 3, 4);
    expect([r, g, b, a]).toEqual([10, 20, 30, 255]);
  });

  it("ignores out-of-bounds writes", () => {
    const c = createCanvas(8, 8);
    const out = setPixel(c, c.layers[0]!.id, c.frames[0]!.id, -1, 0, [10, 20, 30, 255]);
    expect(out).toBe(c); // unchanged reference
  });

  it("returns transparent for out-of-bounds reads", () => {
    const c = createCanvas(8, 8);
    const p = getPixel(c, c.layers[0]!.id, c.frames[0]!.id, -1, -1);
    expect(p).toEqual([0, 0, 0, 0]);
  });

  it("setPixelInPlace mutates data and reports change", () => {
    const c = createCanvas(4, 4);
    const changed = setPixelInPlace(c, c.layers[0]!.id, c.frames[0]!.id, 1, 1, [255, 128, 0, 255]);
    expect(changed).toBe(true);
    const [r, g, b, a] = getPixel(c, c.layers[0]!.id, c.frames[0]!.id, 1, 1);
    expect([r, g, b, a]).toEqual([255, 128, 0, 255]);
    // Writing the same color again returns false.
    const changed2 = setPixelInPlace(c, c.layers[0]!.id, c.frames[0]!.id, 1, 1, [255, 128, 0, 255]);
    expect(changed2).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Bresenham line
// ---------------------------------------------------------------------------

describe("bresenhamLine", () => {
  it("produces a horizontal line of correct length", () => {
    const pts = bresenhamLine(0, 0, 5, 0);
    expect(pts).toHaveLength(6);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[5]).toEqual({ x: 5, y: 0 });
  });

  it("produces a vertical line of correct length", () => {
    const pts = bresenhamLine(0, 0, 0, 4);
    expect(pts).toHaveLength(5);
  });

  it("produces a diagonal line of correct length", () => {
    const pts = bresenhamLine(0, 0, 4, 4);
    expect(pts).toHaveLength(5);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[4]).toEqual({ x: 4, y: 4 });
  });

  it("works for negative direction", () => {
    const pts = bresenhamLine(5, 5, 0, 0);
    expect(pts).toHaveLength(6);
    expect(pts[0]).toEqual({ x: 5, y: 5 });
    expect(pts[5]).toEqual({ x: 0, y: 0 });
  });

  it("draws a line via drawLine primitive", () => {
    const c = createCanvas(8, 8);
    const out = drawLine(c, c.layers[0]!.id, c.frames[0]!.id, 0, 0, 5, 5, [255, 255, 255, 255]);
    for (let i = 0; i <= 5; i++) {
      const [r, g, b, a] = getPixel(out, out.layers[0]!.id, out.frames[0]!.id, i, i);
      expect([r, g, b, a]).toEqual([255, 255, 255, 255]);
    }
  });
});

// ---------------------------------------------------------------------------
// Rect / ellipse
// ---------------------------------------------------------------------------

describe("drawRect", () => {
  it("fills a rectangle", () => {
    const c = createCanvas(8, 8);
    const out = drawRect(c, c.layers[0]!.id, c.frames[0]!.id, 1, 1, 4, 4, [255, 0, 0, 255], true);
    for (let y = 1; y <= 4; y++) {
      for (let x = 1; x <= 4; x++) {
        const [r] = getPixel(out, out.layers[0]!.id, out.frames[0]!.id, x, y);
        expect(r).toBe(255);
      }
    }
    // Outside is still transparent.
    const [r2] = getPixel(out, out.layers[0]!.id, out.frames[0]!.id, 0, 0);
    expect(r2).toBe(0);
  });

  it("draws only the outline when filled=false", () => {
    const c = createCanvas(8, 8);
    const out = drawRect(c, c.layers[0]!.id, c.frames[0]!.id, 1, 1, 4, 4, [255, 0, 0, 255], false);
    // Center should be empty.
    const [rCenter] = getPixel(out, out.layers[0]!.id, out.frames[0]!.id, 2, 2);
    expect(rCenter).toBe(0);
    // Corners should be filled.
    const [rCorner] = getPixel(out, out.layers[0]!.id, out.frames[0]!.id, 1, 1);
    expect(rCorner).toBe(255);
  });
});

describe("drawEllipse", () => {
  it("fills an ellipse within the bounding box", () => {
    const c = createCanvas(16, 16);
    const out = drawEllipse(c, c.layers[0]!.id, c.frames[0]!.id, 2, 2, 12, 12, [255, 0, 0, 255], true);
    // Center pixel must be filled.
    const [r] = getPixel(out, out.layers[0]!.id, out.frames[0]!.id, 7, 7);
    expect(r).toBe(255);
    // Corners of bounding box should be empty (ellipse is inscribed).
    const [rCorner] = getPixel(out, out.layers[0]!.id, out.frames[0]!.id, 2, 2);
    expect(rCorner).toBe(0);
  });

  it("outline draws perimeter only", () => {
    const c = createCanvas(16, 16);
    const out = drawEllipse(c, c.layers[0]!.id, c.frames[0]!.id, 2, 2, 12, 12, [255, 0, 0, 255], false);
    // Center should be empty.
    const [r] = getPixel(out, out.layers[0]!.id, out.frames[0]!.id, 7, 7);
    expect(r).toBe(0);
    // Top center should be filled (perimeter). With (2,2)-(12,12) the
    // ellipse center is exactly at (7,7) so the topmost painted pixel is (7,2).
    const [rTop] = getPixel(out, out.layers[0]!.id, out.frames[0]!.id, 7, 2);
    expect(rTop).toBe(255);
  });
});

// ---------------------------------------------------------------------------
// Flood fill
// ---------------------------------------------------------------------------

describe("floodFill (contiguous)", () => {
  it("fills a contiguous transparent region", () => {
    const c = createCanvas(8, 8);
    // Draw a border around (2,2)-(5,5)
    const bordered = drawRect(c, c.layers[0]!.id, c.frames[0]!.id, 2, 2, 5, 5, [0, 0, 0, 255], false);
    // Fill the interior with red.
    const filled = floodFill(bordered, bordered.layers[0]!.id, bordered.frames[0]!.id, 3, 3, [255, 0, 0, 255]);
    const [r] = getPixel(filled, filled.layers[0]!.id, filled.frames[0]!.id, 3, 3);
    expect(r).toBe(255);
    // Outside the border should still be transparent.
    const [rOutside] = getPixel(filled, filled.layers[0]!.id, filled.frames[0]!.id, 0, 0);
    expect(rOutside).toBe(0);
  });

  it("does not leak across borders of different colors", () => {
    const c = createCanvas(8, 8);
    const border = drawRect(c, c.layers[0]!.id, c.frames[0]!.id, 1, 1, 6, 6, [0, 0, 0, 255], false);
    const filled = floodFill(border, border.layers[0]!.id, border.frames[0]!.id, 3, 3, [0, 255, 0, 255]);
    // (0,0) is outside the border and should remain transparent.
    const [r] = getPixel(filled, filled.layers[0]!.id, filled.frames[0]!.id, 0, 0);
    expect(r).toBe(0);
  });

  it("is a no-op when source equals target color", () => {
    const c = createCanvas(8, 8);
    const filled = floodFill(c, c.layers[0]!.id, c.frames[0]!.id, 0, 0, [0, 0, 0, 0]);
    // No change.
    const [r, g, b, a] = getPixel(filled, filled.layers[0]!.id, filled.frames[0]!.id, 0, 0);
    expect([r, g, b, a]).toEqual([0, 0, 0, 0]);
  });

  it("fills an all-same-color canvas", () => {
    const c = createCanvas(4, 4);
    // First fill with red.
    const red = floodFill(c, c.layers[0]!.id, c.frames[0]!.id, 0, 0, [255, 0, 0, 255]);
    // Then fill the red with blue.
    const blue = floodFill(red, red.layers[0]!.id, red.frames[0]!.id, 0, 0, [0, 0, 255, 255]);
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const [, , b] = getPixel(blue, blue.layers[0]!.id, blue.frames[0]!.id, x, y);
        expect(b).toBe(255);
      }
    }
  });
});

describe("floodFillGlobal", () => {
  it("replaces all matching pixels anywhere on the layer", () => {
    const c = createCanvas(8, 8);
    // Paint two separate red spots.
    const s1 = setPixel(c, c.layers[0]!.id, c.frames[0]!.id, 0, 0, [255, 0, 0, 255]);
    const s2 = setPixel(s1, s1.layers[0]!.id, s1.frames[0]!.id, 7, 7, [255, 0, 0, 255]);
    // Global fill from (0,0) — should also catch (7,7) since they are not connected.
    const filled = floodFillGlobal(s2, s2.layers[0]!.id, s2.frames[0]!.id, 0, 0, [0, 255, 0, 255]);
    // New color is green; check green channel.
    const [, g00] = getPixel(filled, filled.layers[0]!.id, filled.frames[0]!.id, 0, 0);
    const [, g77] = getPixel(filled, filled.layers[0]!.id, filled.frames[0]!.id, 7, 7);
    expect(g00).toBe(255);
    expect(g77).toBe(255);
  });
});

// ---------------------------------------------------------------------------
// Mirror
// ---------------------------------------------------------------------------

describe("mirror symmetry", () => {
  it("applyMirrorX produces mirrored points across X axis", () => {
    const c = createCanvas(8, 8);
    const points = applyMirrorX(c, [{ x: 0, y: 0 }, { x: 1, y: 1 }]);
    // Width 8, mid = 3.5. Mirror of (0,0) = (7,0); (1,1) = (6,1).
    expect(points).toContainEqual({ x: 0, y: 0 });
    expect(points).toContainEqual({ x: 7, y: 0 });
    expect(points).toContainEqual({ x: 1, y: 1 });
    expect(points).toContainEqual({ x: 6, y: 1 });
  });

  it("applyMirrorY produces mirrored points across Y axis", () => {
    const c = createCanvas(8, 8);
    const points = applyMirrorY(c, [{ x: 0, y: 0 }]);
    expect(points).toContainEqual({ x: 0, y: 0 });
    expect(points).toContainEqual({ x: 0, y: 7 });
  });

  it("mirror deduplicates overlapping points at center", () => {
    const c = createCanvas(5, 5);
    // mid = 2; (2,2) mirrors to itself.
    const points = applyMirrorX(c, [{ x: 2, y: 2 }]);
    expect(points).toHaveLength(1);
    expect(points[0]).toEqual({ x: 2, y: 2 });
  });
});

// ---------------------------------------------------------------------------
// Pixel-perfect stroke
// ---------------------------------------------------------------------------

describe("applyPixelPerfect", () => {
  it("removes consecutive duplicates", () => {
    const out = applyPixelPerfect([
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ]);
    expect(out).toEqual([{ x: 0, y: 0 }]);
  });

  it("collapses collinear interior points on a straight line", () => {
    // A 4-point straight horizontal line should collapse to its endpoints,
    // because drawing the line from (0,0) to (3,0) covers all interior pixels.
    const out = applyPixelPerfect([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]);
    expect(out).toEqual([{ x: 0, y: 0 }, { x: 3, y: 0 }]);
  });

  it("preserves corners in a stair-step stroke (no false collapse)", () => {
    // Each corner of an L-shaped stroke is NOT on the Bresenham line between
    // its neighbors, so the algorithm must keep all 4 points.
    const out = applyPixelPerfect([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ]);
    expect(out).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ]);
  });

  it("always preserves first and last point", () => {
    const out = applyPixelPerfect([
      { x: 0, y: 0 },
      { x: 5, y: 5 },
      { x: 10, y: 10 },
    ]);
    expect(out[0]).toEqual({ x: 0, y: 0 });
    expect(out[out.length - 1]).toEqual({ x: 10, y: 10 });
  });

  it("returns input as-is for <=2 points", () => {
    expect(applyPixelPerfect([])).toEqual([]);
    expect(applyPixelPerfect([{ x: 0, y: 0 }])).toEqual([{ x: 0, y: 0 }]);
    expect(applyPixelPerfect([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Composite
// ---------------------------------------------------------------------------

describe("compositeFrameRgba", () => {
  it("returns transparent for an empty canvas", () => {
    const c = createCanvas(4, 4);
    const out = compositeFrameRgba(c, c.frames[0]!.id);
    expect(out.length).toBe(4 * 4 * 4);
    for (let i = 0; i < out.length; i++) expect(out[i]).toBe(0);
  });

  it("composites a single opaque layer unchanged", () => {
    const c = createCanvas(4, 4);
    const drawn = setPixel(c, c.layers[0]!.id, c.frames[0]!.id, 0, 0, [200, 100, 50, 255]);
    const out = compositeFrameRgba(drawn, drawn.frames[0]!.id);
    expect(out[0]).toBe(200);
    expect(out[1]).toBe(100);
    expect(out[2]).toBe(50);
    expect(out[3]).toBe(255);
  });

  it("composites two layers respecting opacity (source-over)", () => {
    let c: PixelCanvas = createCanvas(4, 4);
    // Bottom: opaque white.
    c = setPixel(c, c.layers[0]!.id, c.frames[0]!.id, 0, 0, [255, 255, 255, 255]);
    // Add top layer with 50% opacity, fill with opaque black.
    c = addLayer(c);
    c = setPixel(c, c.layers[1]!.id, c.frames[0]!.id, 0, 0, [0, 0, 0, 255]);
    c = setLayerOpacity(c, c.layers[1]!.id, 0.5);
    const out = compositeFrameRgba(c, c.frames[0]!.id);
    // Composite: white * 0.5 + black * 0.5 = 128 ish.
    expect(out[0]).toBeGreaterThanOrEqual(120);
    expect(out[0]).toBeLessThanOrEqual(135);
    expect(out[3]).toBe(255);
  });

  it("skips invisible layers", () => {
    let c: PixelCanvas = createCanvas(4, 4);
    c = setPixel(c, c.layers[0]!.id, c.frames[0]!.id, 0, 0, [255, 0, 0, 255]);
    c = addLayer(c);
    c = setPixel(c, c.layers[1]!.id, c.frames[0]!.id, 0, 0, [0, 255, 0, 255]);
    // Hide the top layer.
    const visToggle = { ...c.layers[1]!, visible: false };
    c.layers[1] = visToggle;
    const out = compositeFrameRgba(c, c.frames[0]!.id);
    expect(out[0]).toBe(255);
    expect(out[1]).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Palette parsers
// ---------------------------------------------------------------------------

describe("parseGplPalette", () => {
  it("parses a basic GPL file", () => {
    const gpl = `GIMP Palette
Name: Test
Columns: 3
#
  0   0   0  Black
255 255 255  White
255   0   0  Red
`;
    const result = parseGplPalette(gpl);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.name).toBe("Test");
      expect(result.output.colors).toEqual(["#000000", "#ffffff", "#ff0000"]);
    }
  });

  it("rejects a non-GPL file", () => {
    expect(parseGplPalette("hello world").ok).toBe(false);
  });

  it("rejects a GPL with no colors", () => {
    const gpl = `GIMP Palette
Name: Empty
# no colors here
`;
    expect(parseGplPalette(gpl).ok).toBe(false);
  });
});

describe("parsePalPalette", () => {
  it("parses hex-line PAL", () => {
    const pal = `#ff0000\n#00ff00\n#0000ff`;
    const result = parsePalPalette(pal);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.colors).toEqual(["#ff0000", "#00ff00", "#0000ff"]);
    }
  });

  it("parses JASC-PAL format", () => {
    const pal = `JASC-PAL
0100
3
0 0 0
255 255 255
128 64 32
`;
    const result = parsePalPalette(pal);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.colors).toEqual(["#000000", "#ffffff", "#804020"]);
    }
  });
});

describe("parseHexPalette", () => {
  it("parses hex lines with comments", () => {
    const hex = `; palette
#ff0000
#00ff00  ; green
// blue
#0000ff`;
    const result = parseHexPalette(hex);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.colors).toEqual(["#ff0000", "#00ff00", "#0000ff"]);
    }
  });

  it("accepts hex without #", () => {
    const result = parseHexPalette("ff8800\n88ff00");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.output.colors).toEqual(["#ff8800", "#88ff00"]);
  });

  it("rejects empty input", () => {
    expect(parseHexPalette("").ok).toBe(false);
    expect(parseHexPalette("; just a comment").ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Palette operations
// ---------------------------------------------------------------------------

describe("paletteSwap", () => {
  it("remaps colors from old palette to new palette by index", () => {
    let c = createCanvas(4, 4, {
      name: "RGB",
      colors: ["#000000", "#ff0000", "#00ff00", "#0000ff"],
    });
    // Fill bottom-left with old-palette index 1 (red).
    c = setPixel(c, c.layers[0]!.id, c.frames[0]!.id, 0, 0, [255, 0, 0, 255]);
    // Fill bottom-right with old-palette index 3 (blue).
    c = setPixel(c, c.layers[0]!.id, c.frames[0]!.id, 1, 0, [0, 0, 255, 255]);
    // Swap to a palette where index 1 is yellow and index 3 is cyan.
    const newPalette: Palette = {
      name: "Swapped",
      colors: ["#000000", "#ffff00", "#00ff00", "#00ffff"],
    };
    const swapped = paletteSwap(c, newPalette);
    const [r1, g1, b1] = getPixel(swapped, swapped.layers[0]!.id, swapped.frames[0]!.id, 0, 0);
    expect([r1, g1, b1]).toEqual([255, 255, 0]);
    const [r2, g2, b2] = getPixel(swapped, swapped.layers[0]!.id, swapped.frames[0]!.id, 1, 0);
    expect([r2, g2, b2]).toEqual([0, 255, 255]);
    expect(swapped.palette.name).toBe("Swapped");
  });

  it("preserves alpha channel", () => {
    let c = createCanvas(4, 4, { name: "P", colors: ["#ff0000"] });
    c = setPixel(c, c.layers[0]!.id, c.frames[0]!.id, 0, 0, [255, 0, 0, 128]);
    const swapped = paletteSwap(c, { name: "P2", colors: ["#00ff00"] });
    const [, , , a] = getPixel(swapped, swapped.layers[0]!.id, swapped.frames[0]!.id, 0, 0);
    expect(a).toBe(128);
  });

  it("skips fully transparent pixels", () => {
    let c = createCanvas(4, 4, { name: "P", colors: ["#ff0000", "#00ff00"] });
    c = setPixel(c, c.layers[0]!.id, c.frames[0]!.id, 0, 0, [0, 0, 0, 0]);
    const swapped = paletteSwap(c, { name: "P2", colors: ["#00ff00", "#0000ff"] });
    const [, , , a] = getPixel(swapped, swapped.layers[0]!.id, swapped.frames[0]!.id, 0, 0);
    expect(a).toBe(0);
  });
});

describe("applyTaggedMask", () => {
  it("tags a background color and makes matching pixels transparent", () => {
    let c = createCanvas(4, 4, {
      name: "Tagged",
      colors: ["#00ff00", "#ff0000"],
      tags: { 0: "background" },
    });
    // Fill the canvas with green (index 0, tagged as background).
    c = floodFill(c, c.layers[0]!.id, c.frames[0]!.id, 0, 0, [0, 255, 0, 255]);
    // Paint a red dot.
    c = setPixel(c, c.layers[0]!.id, c.frames[0]!.id, 2, 2, [255, 0, 0, 255]);
    const masked = applyTaggedMask(c);
    // (0,0) should be transparent.
    const [r0, g0, b0, a0] = getPixel(masked, masked.layers[0]!.id, masked.frames[0]!.id, 0, 0);
    expect([r0, g0, b0, a0]).toEqual([0, 255, 0, 0]);
    // (2,2) red dot remains.
    const [r2, g2, b2, a2] = getPixel(masked, masked.layers[0]!.id, masked.frames[0]!.id, 2, 2);
    expect([r2, g2, b2, a2]).toEqual([255, 0, 0, 255]);
  });

  it("no-op when no tags are set", () => {
    const c = createCanvas(4, 4);
    const out = applyTaggedMask(c);
    expect(out).toBe(c);
  });
});

// ---------------------------------------------------------------------------
// Color utilities
// ---------------------------------------------------------------------------

describe("color utilities", () => {
  it("hexToRgba parses 3-digit hex", () => {
    expect(hexToRgba("#f00")).toEqual([255, 0, 0, 255]);
  });
  it("hexToRgba parses 6-digit hex", () => {
    expect(hexToRgba("#ff8800")).toEqual([255, 136, 0, 255]);
  });
  it("hexToRgba parses 8-digit hex (with alpha)", () => {
    expect(hexToRgba("#ff880080")).toEqual([255, 136, 0, 128]);
  });
  it("rgbaToHex produces 6-digit hex", () => {
    expect(rgbaToHex(255, 136, 0)).toBe("#ff8800");
  });
  it("colorDistance is zero for equal colors", () => {
    expect(colorDistance([10, 20, 30], [10, 20, 30])).toBe(0);
  });
  it("nearestPaletteIndex finds the closest match", () => {
    const p: Palette = { name: "P", colors: ["#000000", "#ff0000", "#00ff00"] };
    expect(nearestPaletteIndex(p, [250, 0, 0])).toBe(1);
    expect(nearestPaletteIndex(p, [0, 250, 0])).toBe(2);
    expect(nearestPaletteIndex(p, [0, 0, 0])).toBe(0);
  });
  it("shadeColor produces 5 variants", () => {
    const v = shadeColor("#808080");
    expect(v.base).toBe("#808080");
    expect(v.darker2).not.toBe(v.base);
    expect(v.lighter2).not.toBe(v.base);
    // Darker2 should be darker than darker1.
    const d2 = hexToRgba(v.darker2);
    const d1 = hexToRgba(v.darker1);
    expect(d2[0]).toBeLessThan(d1[0]);
  });
});

// ---------------------------------------------------------------------------
// Sprite sheet import
// ---------------------------------------------------------------------------

describe("importSpriteSheet", () => {
  it("slices a 4x4 sheet of 2x2 frames into 4 frames", () => {
    // Build a 4x4 RGBA image.
    const width = 4;
    const height = 4;
    const data = new Uint8Array(width * height * 4);
    // Top-left frame: red. Top-right: green. Bottom-left: blue. Bottom-right: white.
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      const i = (y * width + x) * 4;
      data[i] = 255; data[i + 3] = 255;
    }
    for (let y = 0; y < 2; y++) for (let x = 2; x < 4; x++) {
      const i = (y * width + x) * 4;
      data[i + 1] = 255; data[i + 3] = 255;
    }
    for (let y = 2; y < 4; y++) for (let x = 0; x < 2; x++) {
      const i = (y * width + x) * 4;
      data[i + 2] = 255; data[i + 3] = 255;
    }
    for (let y = 2; y < 4; y++) for (let x = 2; x < 4; x++) {
      const i = (y * width + x) * 4;
      data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 255;
    }
    const result = importSpriteSheet({ width, height, data }, 2, 2);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.frames).toHaveLength(4);
      expect(result.output.width).toBe(2);
      expect(result.output.height).toBe(2);
      // Frame 0 (top-left) = red.
      const [r0] = getPixel(result.output, result.output.layers[0]!.id, result.output.frames[0]!.id, 0, 0);
      expect(r0).toBe(255);
      // Frame 1 (top-right) = green.
      const [, g1] = getPixel(result.output, result.output.layers[0]!.id, result.output.frames[1]!.id, 0, 0);
      expect(g1).toBe(255);
    }
  });

  it("rejects mismatched dimensions", () => {
    const data = new Uint8Array(4 * 4 * 4);
    expect(importSpriteSheet({ width: 4, height: 4, data }, 8, 8).ok).toBe(false);
  });

  it("rejects mismatched data length", () => {
    const data = new Uint8Array(10);
    expect(importSpriteSheet({ width: 4, height: 4, data }, 2, 2).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Aseprite JSON export
// ---------------------------------------------------------------------------

describe("exportAsepriteJson", () => {
  it("produces valid JSON with the expected structure", () => {
    const c = createCanvas(8, 8, TEST_PALETTE);
    const json = exportAsepriteJson(c, { cols: 2, rows: 1, frameWidth: 8, frameHeight: 8 });
    const parsed = JSON.parse(json);
    expect(parsed.frames).toBeDefined();
    expect(parsed.meta).toBeDefined();
    expect(parsed.meta.size.w).toBe(16);
    expect(parsed.meta.size.h).toBe(8);
    expect(parsed.meta.image).toBe("spritesheet.png");
  });

  it("includes per-frame durations", () => {
    let c = createCanvas(8, 8);
    c = addFrame(c);
    c = setFrameDelay(c, c.frames[1]!.id, 250);
    const json = exportAsepriteJson(c, { cols: 2, rows: 1, frameWidth: 8, frameHeight: 8 });
    const parsed = JSON.parse(json);
    expect(parsed.frames["0"].duration).toBe(100);
    expect(parsed.frames["1"].duration).toBe(250);
  });
});

// ---------------------------------------------------------------------------
// Project serialize / deserialize round-trip
// ---------------------------------------------------------------------------

describe("serializeProject / deserializeProject", () => {
  it("round-trips an empty canvas losslessly", () => {
    const c = createCanvas(8, 8, TEST_PALETTE);
    const json = serializeProject(c);
    const result = deserializeProject(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.output.width).toBe(c.width);
      expect(result.output.height).toBe(c.height);
      expect(result.output.frames).toHaveLength(1);
      expect(result.output.palette.colors).toEqual(c.palette.colors);
    }
  });

  it("round-trips a canvas with pixel data", () => {
    let c = createCanvas(8, 8, TEST_PALETTE);
    c = setPixel(c, c.layers[0]!.id, c.frames[0]!.id, 3, 3, [255, 0, 0, 255]);
    c = addLayer(c);
    c = addFrame(c);
    const json = serializeProject(c);
    const result = deserializeProject(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const out = result.output;
      expect(out.layers).toHaveLength(2);
      expect(out.frames).toHaveLength(2);
      const [r] = getPixel(out, out.layers[0]!.id, out.frames[0]!.id, 3, 3);
      expect(r).toBe(255);
    }
  });

  it("rejects garbage input", () => {
    expect(deserializeProject("not json").ok).toBe(false);
    expect(deserializeProject("{}").ok).toBe(false);
    expect(deserializeProject(JSON.stringify({ version: 99 })).ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// History (undo / redo)
// ---------------------------------------------------------------------------

describe("history", () => {
  it("pushHistory adds to the stack and advances the index", () => {
    const c1 = createCanvas(4, 4);
    const h1 = pushHistory({ stack: [], index: -1 }, c1);
    expect(h1.stack).toHaveLength(1);
    expect(h1.index).toBe(0);
  });

  it("undo moves index back", () => {
    const c1 = createCanvas(4, 4);
    const c2 = addLayer(c1);
    const h1 = pushHistory({ stack: [], index: -1 }, c1);
    const h2 = pushHistory(h1, c2);
    const { canvas, history } = undo(h2);
    expect(history.index).toBe(0);
    expect(canvas).toBe(c1);
  });

  it("redo moves index forward", () => {
    const c1 = createCanvas(4, 4);
    const c2 = addLayer(c1);
    const h1 = pushHistory({ stack: [], index: -1 }, c1);
    const h2 = pushHistory(h1, c2);
    const { history: h3 } = undo(h2);
    const { canvas, history } = redo(h3);
    expect(history.index).toBe(1);
    expect(canvas).toBe(c2);
  });

  it("undo is a no-op at index 0", () => {
    const c1 = createCanvas(4, 4);
    const h1 = pushHistory({ stack: [], index: -1 }, c1);
    const { canvas, history } = undo(h1);
    expect(history.index).toBe(0);
    expect(canvas).toBe(c1);
  });

  it("redo is a no-op at the top of the stack", () => {
    const c1 = createCanvas(4, 4);
    const h1 = pushHistory({ stack: [], index: -1 }, c1);
    const { canvas, history } = redo(h1);
    expect(history.index).toBe(0);
    expect(canvas).toBe(c1);
  });

  it("truncates redo history when pushing after an undo", () => {
    const c1 = createCanvas(4, 4);
    const c2 = addLayer(c1);
    const c3 = addLayer(c2);
    let h = pushHistory({ stack: [], index: -1 }, c1);
    h = pushHistory(h, c2);
    h = pushHistory(h, c3);
    const { history: u1 } = undo(h); // -> c2
    const { history: u2 } = undo(u1); // -> c1
    expect(u2.index).toBe(0);
    expect(u2.stack).toHaveLength(3);
    // Push a new canvas — should truncate c3 from the stack.
    const c4 = addLayer(c1);
    const h2 = pushHistory(u2, c4);
    expect(h2.stack).toHaveLength(2);
    expect(h2.stack[1]).toBe(c4);
  });

  it("caps stack size to max", () => {
    let h = { stack: [] as PixelCanvas[], index: -1 };
    for (let i = 0; i < 60; i++) {
      h = pushHistory(h, createCanvas(4, 4), 50);
    }
    expect(h.stack.length).toBeLessThanOrEqual(50);
  });
});

// ---------------------------------------------------------------------------
// Tile-flip brush
// ---------------------------------------------------------------------------

describe("transformTile", () => {
  const tile: [number, number, number, number][][] = [
    [[1, 0, 0, 255], [0, 0, 0, 0]],
    [[0, 0, 0, 0], [0, 1, 0, 255]],
  ];

  it("identity variant returns the same tile", () => {
    const out = transformTile(tile, 0);
    expect(out[0]![0]).toEqual([1, 0, 0, 255]);
    expect(out[1]![1]).toEqual([0, 1, 0, 255]);
  });

  it("flip-horizontal variant mirrors columns", () => {
    const out = transformTile(tile, 4);
    expect(out[0]![0]).toEqual([0, 0, 0, 0]);
    expect(out[0]![1]).toEqual([1, 0, 0, 255]);
  });

  it("rotate-180 moves (0,0) to (1,1)", () => {
    const out = transformTile(tile, 2);
    expect(out[1]![1]).toEqual([1, 0, 0, 255]);
  });
});

describe("stampTile", () => {
  it("stamps a tile at the given origin", () => {
    const c = createCanvas(8, 8);
    const tile: [number, number, number, number][][] = [
      [[255, 0, 0, 255]],
    ];
    const out = stampTile(c, c.layers[0]!.id, c.frames[0]!.id, tile, 3, 3, 0);
    const [r] = getPixel(out, out.layers[0]!.id, out.frames[0]!.id, 3, 3);
    expect(r).toBe(255);
  });

  it("drops pixels outside the canvas", () => {
    const c = createCanvas(4, 4);
    const tile: [number, number, number, number][][] = [
      [[255, 0, 0, 255], [255, 0, 0, 255]],
    ];
    // Stamp at (3, 0) — only (3,0) fits, (4,0) is out of bounds.
    const out = stampTile(c, c.layers[0]!.id, c.frames[0]!.id, tile, 3, 0, 0);
    const [r3] = getPixel(out, out.layers[0]!.id, out.frames[0]!.id, 3, 0);
    expect(r3).toBe(255);
  });
});

// ---------------------------------------------------------------------------
// Dithering
// ---------------------------------------------------------------------------

describe("ditherAt", () => {
  it("checker pattern alternates", () => {
    expect(ditherAt(0, 0, "checker")).toBe(true);
    expect(ditherAt(1, 0, "checker")).toBe(false);
    expect(ditherAt(0, 1, "checker")).toBe(false);
    expect(ditherAt(1, 1, "checker")).toBe(true);
  });

  it("bayer2 produces 2 of 4 lit pixels at threshold 0.5", () => {
    let lit = 0;
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      if (ditherAt(x, y, "bayer2", 0.5)) lit++;
    }
    // Values: 0/4=0, 2/4=0.5, 3/4=0.75, 1/4=0.25. Lit when <0.5: 0, 0.25 => 2.
    expect(lit).toBe(2);
  });

  it("bayer4 produces some lit pixels", () => {
    let lit = 0;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      if (ditherAt(x, y, "bayer4", 0.5)) lit++;
    }
    expect(lit).toBeGreaterThan(0);
    expect(lit).toBeLessThan(16);
  });
});
