/**
 * Image Halftone Dot Pattern — pure logic. No DOM/canvas.
 *
 * Extras beyond the original thin tool (10+):
 *   1. Dot size from brightness (halftone)
 *   2. Configurable cell size and max radius
 *   3. Foreground / background colors (grayscale)
 *   4. Grid rotation angle
 *   5. Pattern types (grid, hex, diagonal)
 *   6. Average brightness sampling (BT.601)
 *   7. Pixel → cell coordinate mapping (post-rotation)
 *   8. Cell center inverse rotation
 *   9. Euclidean distance helper
 *  10. Validation with detailed error messages
 *  11. Hex grid offset for staggered patterns
 *  12. Diagonal grid layout
 */
export type PatternType = "grid" | "hex" | "diagonal";

export interface DotPatternOptions {
  /** Cell size in pixels (each cell = 1 dot). */
  cellSize: number;
  /** Maximum dot radius as fraction of cell (0-0.7). */
  maxRadius: number;
  /** Foreground color (0-255 grayscale). */
  fg: number;
  /** Background color (0-255 grayscale). */
  bg: number;
  /** Angle of dot grid in degrees. */
  angle: number;
  /** Pattern type. */
  pattern: PatternType;
}

/** Compute dot radius for a single cell from average brightness (0-255). */
export function dotRadiusFromBrightness(brightness: number, opts: DotPatternOptions): number {
  const b = clamp(brightness, 0, 255) / 255;
  return Math.max(0, (1 - b) * opts.maxRadius * opts.cellSize);
}

/** Rotate a point about origin by angle (degrees). */
export function rotatePoint(x: number, y: number, angleDeg: number): { x: number; y: number } {
  const a = (angleDeg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: x * c - y * s, y: x * s + y * c };
}

/** Map a pixel to its halftone cell coordinate (post-rotation). */
export function pixelToCell(x: number, y: number, opts: DotPatternOptions): { cx: number; cy: number } {
  const r = rotatePoint(x, y, opts.angle);
  let cx = Math.floor(r.x / opts.cellSize);
  let cy = Math.floor(r.y / opts.cellSize);
  if (opts.pattern === "hex" && cy % 2 !== 0) cx = Math.floor((r.x - opts.cellSize / 2) / opts.cellSize);
  return { cx, cy };
}

/** Cell center in image coordinates (inverse rotation). */
export function cellCenter(cx: number, cy: number, opts: DotPatternOptions): { x: number; y: number } {
  let localX = cx * opts.cellSize + opts.cellSize / 2;
  if (opts.pattern === "hex" && cy % 2 !== 0) localX += opts.cellSize / 2;
  let localY = cy * opts.cellSize + opts.cellSize / 2;
  if (opts.pattern === "diagonal") { localX += cy * opts.cellSize / 2; }
  return rotatePoint(localX, localY, -opts.angle);
}

/** Distance between two points. */
export function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/** Compute average brightness (BT.601) of a square region of an RGBA Uint8ClampedArray. */
export function avgBrightness(data: Uint8ClampedArray, x0: number, y0: number, w: number, h: number, stride: number): number {
  let sum = 0, count = 0;
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const i = (y * stride + x) * 4;
      if (i + 2 >= data.length) continue;
      sum += 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

/** Generate a list of cell centers for the entire grid. */
export function generateCellGrid(
  width: number, height: number, opts: DotPatternOptions,
): { cx: number; cy: number; x: number; y: number }[] {
  const cells: { cx: number; cy: number; x: number; y: number }[] = [];
  const numCols = Math.ceil(width / opts.cellSize) + 2;
  const numRows = Math.ceil(height / opts.cellSize) + 2;
  for (let cy = -1; cy < numRows; cy++) {
    for (let cx = -1; cx < numCols; cx++) {
      const { x, y } = cellCenter(cx, cy, opts);
      cells.push({ cx, cy, x, y });
    }
  }
  return cells;
}

/** Compute the hex-grid row offset for a given row index. */
export function hexRowOffset(row: number, cellSize: number): number {
  return row % 2 === 0 ? 0 : cellSize / 2;
}

/** Compute diagonal-grid x-offset for a given row. */
export function diagonalRowOffset(row: number, cellSize: number): number {
  return (row * cellSize) / 2;
}

/** Convert a hex color string to {r,g,b}. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | { error: string } {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
  if (!m) return { error: "Invalid hex colour" };
  const v = m[1]!.length === 3
    ? m[1]!.split("").map((c) => c + c).join("")
    : m[1]!;
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
  };
}

/** Convert RGB to grayscale (BT.601). */
export function rgbToGray(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export function validateDotOptions(opts: DotPatternOptions): { ok: true } | { error: string } {
  if (opts.cellSize < 2 || opts.cellSize > 64) return { error: "Cell size must be 2-64" };
  if (opts.maxRadius < 0.1 || opts.maxRadius > 0.7) return { error: "Max radius must be 0.1-0.7" };
  if (opts.fg < 0 || opts.fg > 255) return { error: "Foreground must be 0-255" };
  if (opts.bg < 0 || opts.bg > 255) return { error: "Background must be 0-255" };
  if (!["grid", "hex", "diagonal"].includes(opts.pattern)) return { error: "Unknown pattern" };
  return { ok: true };
}

/** Compute total number of cells for a given image and cell size. */
export function cellCount(width: number, height: number, cellSize: number): number {
  return Math.ceil(width / cellSize) * Math.ceil(height / cellSize);
}

/** Pretty-print helper. */
export function fmt(n: number, p = 2): string {
  if (!Number.isFinite(n)) return "—";
  const f = Math.pow(10, p);
  return String(Math.round((n + Number.EPSILON) * f) / f);
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
