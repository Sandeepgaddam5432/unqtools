/**
 * Image Hue Rotator — pure logic. No DOM access.
 *
 * Implements RGB ↔ HSL conversion + hue rotation. The UI runs the per-pixel
 * loop; this module exposes the math primitives.
 */
export interface HueOptions {
  /** 0-360 degrees. */
  degrees: number;
}

export interface RgbPixel {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

/** Normalize an angle to [0, 360). */
export function normalizeDegrees(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  return ((deg % 360) + 360) % 360;
}

/** Convert RGB (0-255) to HSL (h: 0-360, s/l: 0-1). */
export function rgbToHsl(r: number, g: number, b: number): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
        break;
      case gn:
        h = ((bn - rn) / d + 2) * 60;
        break;
      case bn:
        h = ((rn - gn) / d + 4) * 60;
        break;
    }
  }
  return { h, s, l };
}

/** Convert HSL (h: 0-360, s/l: 0-1) to RGB (0-255). */
export function hslToRgb(hsl: Hsl): { r: number; g: number; b: number } {
  const h = ((hsl.h % 360) + 360) % 360 / 360;
  const s = hsl.s;
  const l = hsl.l;
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2 = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return {
    r: Math.round(hue2(h + 1 / 3) * 255),
    g: Math.round(hue2(h) * 255),
    b: Math.round(hue2(h - 1 / 3) * 255),
  };
}

/** Rotate hue of a pixel by the given number of degrees. */
export function rotateHue(pixel: RgbPixel, degrees: number): RgbPixel {
  const hsl = rgbToHsl(pixel.r, pixel.g, pixel.b);
  hsl.h = normalizeDegrees(hsl.h + degrees);
  const rgb = hslToRgb(hsl);
  return { r: rgb.r, g: rgb.g, b: rgb.b, a: pixel.a };
}

/** Validate hue options. */
export function validateHueOptions(opts: HueOptions): { ok: true } | { error: string } {
  if (!Number.isFinite(opts.degrees)) return { error: "Degrees must be a number" };
  return { ok: true };
}
