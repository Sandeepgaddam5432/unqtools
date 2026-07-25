/**
 * Image Pixel Sorter — pure comparators and helpers for sorting pixels.
 */
export type SortKey = "brightness" | "hue" | "saturation" | "red" | "green" | "blue";

export interface PixelSortOptions {
  key: SortKey;
  /** Sort direction. */
  direction: "asc" | "desc";
  /** Sort along rows or columns. */
  axis: "row" | "column";
  /** Threshold below which pixels are not sorted (0-255). */
  threshold: number;
}

export type Rgb = [number, number, number];

/** ITU-R BT.601 luma. */
export function brightness(p: Rgb): number {
  return 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2];
}

/** Convert RGB (0-255) to HSL with h in degrees [0,360). */
export function rgbToHsl(p: Rgb): { h: number; s: number; l: number } {
  const r = p[0] / 255, g = p[1] / 255, b = p[2] / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { h, s, l };
}

export function hue(p: Rgb): number { return rgbToHsl(p).h; }
export function saturation(p: Rgb): number { return rgbToHsl(p).s; }

/** Comparator factory for a sort key + direction. */
export function makeComparator(key: SortKey, direction: "asc" | "desc"): (a: Rgb, b: Rgb) => number {
  const fn = key === "brightness" ? brightness
    : key === "hue" ? hue
    : key === "saturation" ? saturation
    : key === "red" ? (p: Rgb) => p[0]
    : key === "green" ? (p: Rgb) => p[1]
    : (p: Rgb) => p[2];
  const sign = direction === "asc" ? 1 : -1;
  return (a, b) => sign * (fn(a) - fn(b));
}

export function validatePixelSortOptions(o: PixelSortOptions): { ok: true } | { error: string } {
  const validKeys: SortKey[] = ["brightness", "hue", "saturation", "red", "green", "blue"];
  if (!validKeys.includes(o.key)) return { error: "Invalid sort key" };
  if (o.direction !== "asc" && o.direction !== "desc") return { error: "Invalid direction" };
  if (o.axis !== "row" && o.axis !== "column") return { error: "Invalid axis" };
  if (o.threshold < 0 || o.threshold > 255) return { error: "Threshold must be 0-255" };
  return { ok: true };
}

/** Sort a 1-D array of pixels using the given comparator. */
export function sortPixels(pixels: Rgb[], cmp: (a: Rgb, b: Rgb) => number): Rgb[] {
  return [...pixels].sort(cmp);
}
