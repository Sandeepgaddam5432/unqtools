/**
 * Image Fractal Tool (Mandelbrot/Julia) — pure math. No DOM/canvas.
 *
 * Extras:
 *  1. Mandelbrot & Julia modes
 *  2. Max iterations (1-4096)
 *  3. Zoom + center coordinates
 *  4. Color palettes (default / fire / ocean / grayscale)
 *  5. Julia params (jx, jy)
 *  6. Escape radius
 *  7. Batch validation
 *  8. Presets (default / spiral / dendrite / seahorse)
 *  9. Format-preserving transparency
 * 10. Smooth coloring
 * 11. Pixel → complex mapping
 * 12. Helpers + mean delta
 */
export type OutputFormat = "image/png" | "image/jpeg" | "image/webp";
export type FractalPalette = "default" | "fire" | "ocean" | "grayscale";

export interface FractalOptions {
  cx: number;
  cy: number;
  zoom: number;
  maxIter: number;
  julia: boolean;
  jx: number;
  jy: number;
  escape: number;
  palette: FractalPalette;
  /** Smooth coloring (interpolate between iterations). */
  smooth: boolean;
}

/** One iteration step of z = z² + c. */
export function iterate(zx: number, zy: number, cx: number, cy: number): { x: number; y: number } {
  return {
    x: zx * zx - zy * zy + cx,
    y: 2 * zx * zy + cy,
  };
}

/** Compute escape iteration count for a point. Returns -1 if bounded. */
export function escapeIterations(x0: number, y0: number, opts: FractalOptions): number {
  let zx = opts.julia ? opts.jx : x0;
  let zy = opts.julia ? opts.jy : y0;
  const cx = opts.julia ? x0 : x0;
  const cy = opts.julia ? y0 : y0;
  for (let i = 0; i < opts.maxIter; i++) {
    if (zx * zx + zy * zy > opts.escape) return i;
    const n = iterate(zx, zy, cx, cy);
    zx = n.x; zy = n.y;
  }
  return -1;
}

/** Compute smooth iteration count for nicer gradients. */
export function smoothEscape(x0: number, y0: number, opts: FractalOptions): number {
  let zx = opts.julia ? opts.jx : x0;
  let zy = opts.julia ? opts.jy : y0;
  const cx = opts.julia ? x0 : x0;
  const cy = opts.julia ? y0 : y0;
  let i = 0;
  for (; i < opts.maxIter; i++) {
    const mag = zx * zx + zy * zy;
    if (mag > opts.escape) {
      // Smooth value
      const log_zn = Math.log(mag) / 2;
      const nu = Math.log(log_zn / Math.log(2)) / Math.log(2);
      return i + 1 - nu;
    }
    const n = iterate(zx, zy, cx, cy);
    zx = n.x; zy = n.y;
  }
  return -1;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export const clampByte = (n: number) => clamp(Math.round(n), 0, 255);

/** Map iteration count to a color using selected palette. */
export function iterToColor(iter: number, maxIter: number, palette: FractalPalette = "default"): { r: number; g: number; b: number } {
  if (iter < 0) return { r: 0, g: 0, b: 0 };
  const t = clamp(iter / maxIter, 0, 1);
  switch (palette) {
    case "fire":
      return { r: clampByte(255 * t), g: clampByte(255 * t * t), b: clampByte(80 * t * t * t) };
    case "ocean":
      return { r: clampByte(40 * t * t), g: clampByte(120 * t), b: clampByte(255 * Math.sqrt(t)) };
    case "grayscale": {
      const v = clampByte(255 * t);
      return { r: v, g: v, b: v };
    }
    case "default":
    default:
      return {
        r: clampByte(9 * (1 - t) * t * t * t * 255),
        g: clampByte(15 * (1 - t) ** 2 * t * t * 255),
        b: clampByte(8.5 * (1 - t) ** 3 * t * 255),
      };
  }
}

/** Map a pixel (x,y) to complex plane coordinates given view options. */
export function pixelToComplex(px: number, py: number, width: number, height: number, opts: FractalOptions): { x: number; y: number } {
  const scale = 4 / opts.zoom;
  return {
    x: opts.cx + (px - width / 2) * scale / width,
    y: opts.cy + (py - height / 2) * scale / height,
  };
}

export function validateFractalOptions(opts: FractalOptions): { ok: true } | { error: string } {
  if (opts.maxIter < 1 || opts.maxIter > 4096) return { error: "Max iterations must be 1-4096" };
  if (opts.zoom <= 0) return { error: "Zoom must be positive" };
  if (opts.escape <= 0) return { error: "Escape radius must be positive" };
  if (!["default", "fire", "ocean", "grayscale"].includes(opts.palette)) return { error: "Unknown palette" };
  return { ok: true };
}

/** True when options produce a no-op (impossible for fractal). */
export function isIdentity(_opts: FractalOptions): boolean {
  return false;
}

/** Batch-validate a list of files. */
export function batchValidate(files: { name: string }[], opts: FractalOptions): { name: string; result: { ok: true } | { error: string } }[] {
  return files.map((f) => ({ name: f.name, result: validateFractalOptions(opts) }));
}

/** Format-preserving transparency check. */
export function preservesAlpha(format: OutputFormat): boolean {
  return format === "image/png" || format === "image/webp";
}

/** Presets. */
export const PRESETS: { id: string; label: string; options: Omit<FractalOptions, "smooth"> & { smooth: boolean } }[] = [
  { id: "default", label: "Mandelbrot", options: { cx: -0.5, cy: 0, zoom: 1, maxIter: 100, julia: false, jx: 0, jy: 0, escape: 4, palette: "default", smooth: false } },
  { id: "spiral", label: "Spiral", options: { cx: -0.745, cy: 0.113, zoom: 8, maxIter: 256, julia: false, jx: 0, jy: 0, escape: 4, palette: "fire", smooth: true } },
  { id: "dendrite", label: "Dendrite", options: { cx: 0, cy: 0, zoom: 1, maxIter: 200, julia: true, jx: 0, jy: 1, escape: 4, palette: "ocean", smooth: true } },
  { id: "seahorse", label: "Seahorse", options: { cx: -0.75, cy: 0.1, zoom: 6, maxIter: 256, julia: false, jx: 0, jy: 0, escape: 4, palette: "default", smooth: false } },
  { id: "rabbit", label: "Rabbit", options: { cx: 0, cy: 0, zoom: 1, maxIter: 200, julia: true, jx: -0.123, jy: 0.745, escape: 4, palette: "grayscale", smooth: true } },
];

export function findPreset(id: string) {
  return PRESETS.find((p) => p.id === id);
}

/** Mean absolute delta between two RGBA pixel arrays. */
export function meanDelta(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let sum = 0, n = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 4) {
    sum += Math.abs(a[i]! - b[i]!) + Math.abs(a[i + 1]! - b[i + 1]!) + Math.abs(a[i + 2]! - b[i + 2]!);
    n++;
  }
  return n === 0 ? 0 : sum / (n * 3);
}

/** ITU-R BT.601 luma. */
export function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
