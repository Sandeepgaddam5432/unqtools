/**
 * Image Fractal Tool (Mandelbrot/Julia) — pure math. No DOM/canvas.
 */
export interface FractalOptions {
  /** Center X of view. */
  cx: number;
  /** Center Y of view. */
  cy: number;
  /** Zoom factor (1 = default view). */
  zoom: number;
  /** Maximum iterations. */
  maxIter: number;
  /** Julia mode? */
  julia: boolean;
  /** Julia constant (only used if julia=true). */
  jx: number;
  jy: number;
  /** Escape radius squared. */
  escape: number;
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
    zx = n.x;
    zy = n.y;
  }
  return -1;
}

/** Map iteration count to a color (0-255 RGB). */
export function iterToColor(iter: number, maxIter: number): { r: number; g: number; b: number } {
  if (iter < 0) return { r: 0, g: 0, b: 0 };
  const t = iter / maxIter;
  return {
    r: Math.round(9 * (1 - t) * t * t * t * 255),
    g: Math.round(15 * (1 - t) ** 2 * t * t * 255),
    b: Math.round(8.5 * (1 - t) ** 3 * t * 255),
  };
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
  return { ok: true };
}
