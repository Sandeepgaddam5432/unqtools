/**
 * Image Watermark Adder — pure logic. No DOM access.
 */
export type WatermarkPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "middle-center"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface WatermarkOptions {
  text: string;
  position: WatermarkPosition;
  opacity: number; // 0-1
  fontSize: number; // px
  color: string; // CSS color
  rotation: number; // degrees
  padding: number; // px
  /** Tile across the image. */
  tile: boolean;
  /** Tile spacing in px (used when tile=true). */
  tileSpacing: number;
}

export interface WatermarkPlacement {
  x: number;
  y: number;
  /** Text align to use. */
  align: "left" | "center" | "right";
}

/** Compute a single watermark placement for the given position preset. */
export function computePlacement(
  canvasWidth: number,
  canvasHeight: number,
  position: WatermarkPosition,
  padding: number,
): WatermarkPlacement {
  const p = padding;
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;
  const right = canvasWidth - p;
  const bottom = canvasHeight - p;

  const map: Record<WatermarkPosition, WatermarkPlacement> = {
    "top-left": { x: p, y: p, align: "left" },
    "top-center": { x: cx, y: p, align: "center" },
    "top-right": { x: right, y: p, align: "right" },
    "middle-left": { x: p, y: cy, align: "left" },
    "middle-center": { x: cx, y: cy, align: "center" },
    "middle-right": { x: right, y: cy, align: "right" },
    "bottom-left": { x: p, y: bottom, align: "left" },
    "bottom-center": { x: cx, y: bottom, align: "center" },
    "bottom-right": { x: right, y: bottom, align: "right" },
  };
  return map[position];
}

/** Compute a grid of placements for tiling. */
export function computeTilePlacements(
  canvasWidth: number,
  canvasHeight: number,
  spacing: number,
): WatermarkPlacement[] {
  const placements: WatermarkPlacement[] = [];
  if (spacing <= 0) return placements;
  for (let y = spacing; y < canvasHeight; y += spacing) {
    for (let x = spacing; x < canvasWidth; x += spacing) {
      placements.push({ x, y, align: "center" });
    }
  }
  return placements;
}

/** Validate watermark options. */
export function validateOptions(opts: WatermarkOptions): { ok: true } | { error: string } {
  if (!opts.text.trim()) return { error: "Watermark text is required" };
  if (opts.opacity < 0 || opts.opacity > 1) return { error: "Opacity must be between 0 and 1" };
  if (opts.fontSize <= 0) return { error: "Font size must be positive" };
  if (opts.padding < 0) return { error: "Padding must be non-negative" };
  return { ok: true };
}

export const POSITIONS: WatermarkPosition[] = [
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "middle-center",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];
