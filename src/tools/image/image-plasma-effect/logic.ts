/**
 * Image Plasma Effect — pure math. No DOM/canvas.
 * plasma = sin(x/a) + sin(y/b) + sin((x+y)/c) + sin(sqrt(x²+y²)/d)
 */
export interface PlasmaOptions {
  /** Frequency factors (smaller = wider bands). */
  a: number;
  b: number;
  c: number;
  d: number;
  /** Hue offset 0-360. */
  hueOffset: number;
}

/** Compute raw plasma value at (x, y). Result is in range [-4, 4]. */
export function plasmaValue(x: number, y: number, opts: PlasmaOptions): number {
  return (
    Math.sin(x / opts.a) +
    Math.sin(y / opts.b) +
    Math.sin((x + y) / opts.c) +
    Math.sin(Math.sqrt(x * x + y * y) / opts.d)
  );
}

/** Normalize plasma value to [0, 1]. */
export function normalizePlasma(v: number): number {
  return (v + 4) / 8;
}

/** Map normalized plasma value (0-1) to an RGB pixel via HSV hue cycle. */
export function plasmaToRgb(t: number, hueOffset: number): { r: number; g: number; b: number } {
  const hue = ((t * 360 + hueOffset) % 360 + 360) % 360;
  const sat = 1;
  const val = 1;
  return hsvToRgb(hue, sat, val);
}

/** Convert HSV (0-360, 0-1, 0-1) to RGB (0-255 each). */
export function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rp = 0, gp = 0, bp = 0;
  if (h < 60) { rp = c; gp = x; }
  else if (h < 120) { rp = x; gp = c; }
  else if (h < 180) { gp = c; bp = x; }
  else if (h < 240) { gp = x; bp = c; }
  else if (h < 300) { rp = x; bp = c; }
  else { rp = c; bp = x; }
  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  };
}

export function validatePlasmaOptions(opts: PlasmaOptions): { ok: true } | { error: string } {
  for (const k of ["a", "b", "c", "d"] as const) {
    if (!Number.isFinite(opts[k]) || opts[k] <= 0) return { error: `${k} must be a positive number` };
  }
  if (opts.hueOffset < 0 || opts.hueOffset > 360) return { error: "Hue offset must be 0-360" };
  return { ok: true };
}
