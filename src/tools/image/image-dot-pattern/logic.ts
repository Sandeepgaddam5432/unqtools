/**
 * Image Halftone Dot Pattern — pure logic. No DOM/canvas.
 */
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
}

/** Compute dot radius for a single cell from average brightness (0-255). */
export function dotRadiusFromBrightness(brightness: number, opts: DotPatternOptions): number {
  const b = clamp(brightness, 0, 255) / 255; // 0 = dark, 1 = bright
  // Darker pixels → larger dots.
  const r = (1 - b) * opts.maxRadius * opts.cellSize;
  return Math.max(0, r);
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
  return {
    cx: Math.floor(r.x / opts.cellSize),
    cy: Math.floor(r.y / opts.cellSize),
  };
}

/** Cell center in image coordinates (inverse rotation). */
export function cellCenter(cx: number, cy: number, opts: DotPatternOptions): { x: number; y: number } {
  const localX = cx * opts.cellSize + opts.cellSize / 2;
  const localY = cy * opts.cellSize + opts.cellSize / 2;
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

export function validateDotOptions(opts: DotPatternOptions): { ok: true } | { error: string } {
  if (opts.cellSize < 2 || opts.cellSize > 64) return { error: "Cell size must be 2-64" };
  if (opts.maxRadius < 0.1 || opts.maxRadius > 0.7) return { error: "Max radius must be 0.1-0.7" };
  if (opts.fg < 0 || opts.fg > 255) return { error: "Foreground must be 0-255" };
  if (opts.bg < 0 || opts.bg > 255) return { error: "Background must be 0-255" };
  return { ok: true };
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
