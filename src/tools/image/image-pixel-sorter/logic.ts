/**
 * Image Pixel Sorter — pure comparators and helpers for sorting pixels.
 *
 * Extras:
 *  1. Sort keys: brightness / hue / saturation / red / green / blue / custom
 *  2. Direction (asc / desc)
 *  3. Axis (row / column)
 *  4. Threshold (sort only within range)
 *  5. Edge modes (clamp / wrap / mirror / zero)
 *  6. Custom sort key function support
 *  7. Batch validation
 *  8. Stats (mean delta, mean luma)
 *  9. Format-preserving transparency
 * 10. RGB → HSL helper
 * 11. Identity check
 * 12. Sort presets (brightness desc, hue asc, saturation desc)
 */
export type SortKey = "brightness" | "hue" | "saturation" | "red" | "green" | "blue";
export type EdgeMode = "clamp" | "wrap" | "mirror" | "zero";
export type OutputFormat = "image/png" | "image/jpeg" | "image/webp";

export interface PixelSortOptions {
  key: SortKey;
  direction: "asc" | "desc";
  axis: "row" | "column";
  threshold: number;
  edge: EdgeMode;
  /** Lower bound (0..255). Pixels below this luma are not sorted. */
  minLuma: number;
  /** Upper bound (0..255). Pixels above this luma are not sorted. */
  maxLuma: number;
}

export type Rgb = [number, number, number];

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export const clampByte = (n: number) => clamp(Math.round(n), 0, 255);

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

/** Get the sort key value for a pixel. */
export function sortKeyValue(p: Rgb, key: SortKey): number {
  switch (key) {
    case "brightness": return brightness(p);
    case "hue": return hue(p);
    case "saturation": return saturation(p);
    case "red": return p[0];
    case "green": return p[1];
    case "blue": return p[2];
  }
}

/** Comparator factory for a sort key + direction. */
export function makeComparator(key: SortKey, direction: "asc" | "desc"): (a: Rgb, b: Rgb) => number {
  const fn = (p: Rgb) => sortKeyValue(p, key);
  const sign = direction === "asc" ? 1 : -1;
  return (a, b) => sign * (fn(a) - fn(b));
}

/** Custom comparator factory: caller provides key extractor. */
export function customComparator(keyFn: (p: Rgb) => number, direction: "asc" | "desc"): (a: Rgb, b: Rgb) => number {
  const sign = direction === "asc" ? 1 : -1;
  return (a, b) => sign * (keyFn(a) - keyFn(b));
}

/** Apply edge mode to a coordinate out of range. */
export function applyEdge(value: number, max: number, mode: EdgeMode): number {
  if (value >= 0 && value < max) return value;
  if (max <= 0) return 0;
  switch (mode) {
    case "wrap": return ((value % max) + max) % max;
    case "mirror": {
      const period = 2 * max;
      const m = ((value % period) + period) % period;
      return m >= max ? period - m - 1 : m;
    }
    case "zero": return -1;
    case "clamp":
    default: return clamp(value, 0, max - 1);
  }
}

/** Check if a pixel's luma is within sort range. */
export function shouldSort(p: Rgb, minLuma: number, maxLuma: number): boolean {
  const y = brightness(p);
  return y >= minLuma && y <= maxLuma;
}

/** Sort a 1-D array of pixels using the given comparator. */
export function sortPixels(pixels: Rgb[], cmp: (a: Rgb, b: Rgb) => number): Rgb[] {
  return [...pixels].sort(cmp);
}

/** Sort a 2-D row/column with threshold filtering. */
export function sortWithThreshold(pixels: Rgb[], cmp: (a: Rgb, b: Rgb) => number, minLuma: number, maxLuma: number): Rgb[] {
  const sortable = pixels.filter((p) => shouldSort(p, minLuma, maxLuma));
  sortable.sort(cmp);
  let idx = 0;
  return pixels.map((p) => shouldSort(p, minLuma, maxLuma) ? sortable[idx++]! : p);
}

export function validatePixelSortOptions(o: PixelSortOptions): { ok: true } | { error: string } {
  const validKeys: SortKey[] = ["brightness", "hue", "saturation", "red", "green", "blue"];
  if (!validKeys.includes(o.key)) return { error: "Invalid sort key" };
  if (o.direction !== "asc" && o.direction !== "desc") return { error: "Invalid direction" };
  if (o.axis !== "row" && o.axis !== "column") return { error: "Invalid axis" };
  if (o.threshold < 0 || o.threshold > 255) return { error: "Threshold must be 0-255" };
  if (!["clamp", "wrap", "mirror", "zero"].includes(o.edge)) return { error: "Invalid edge mode" };
  if (o.minLuma < 0 || o.minLuma > 255) return { error: "minLuma must be 0-255" };
  if (o.maxLuma < 0 || o.maxLuma > 255) return { error: "maxLuma must be 0-255" };
  if (o.minLuma > o.maxLuma) return { error: "minLuma must be <= maxLuma" };
  return { ok: true };
}

/** True when options produce a no-op (sort range excludes everything). */
export function isIdentity(o: PixelSortOptions): boolean {
  return o.minLuma > o.maxLuma;
}

/** Batch-validate a list of files. */
export function batchValidate(files: { name: string }[], opts: PixelSortOptions): { name: string; result: { ok: true } | { error: string } }[] {
  return files.map((f) => ({ name: f.name, result: validatePixelSortOptions(opts) }));
}

/** Format-preserving transparency check. */
export function preservesAlpha(format: OutputFormat): boolean {
  return format === "image/png" || format === "image/webp";
}

/** Sort presets. */
export const SORT_PRESETS: { id: string; label: string; options: Omit<PixelSortOptions, "axis" | "threshold" | "edge" | "minLuma" | "maxLuma"> }[] = [
  { id: "bright-desc", label: "Bright → Dark", options: { key: "brightness", direction: "desc" } },
  { id: "bright-asc", label: "Dark → Bright", options: { key: "brightness", direction: "asc" } },
  { id: "hue-asc", label: "Hue Ascending", options: { key: "hue", direction: "asc" } },
  { id: "saturation-desc", label: "Saturated First", options: { key: "saturation", direction: "desc" } },
  { id: "red-asc", label: "Red Ascending", options: { key: "red", direction: "asc" } },
];

export function findPreset(id: string) {
  return SORT_PRESETS.find((p) => p.id === id);
}

/** Compute mean delta between two RGBA arrays. */
export function meanDelta(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let sum = 0, n = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 4) {
    sum += Math.abs(a[i]! - b[i]!) + Math.abs(a[i + 1]! - b[i + 1]!) + Math.abs(a[i + 2]! - b[i + 2]!);
    n++;
  }
  return n === 0 ? 0 : sum / (n * 3);
}
