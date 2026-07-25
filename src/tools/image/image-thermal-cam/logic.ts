/**
 * Image Thermal Cam — pure logic. No DOM / canvas access.
 *
 * Maps pixel luminance (0..1) through a 5-stop thermal palette:
 * black → blue → purple → red → yellow → white.
 */
export interface ThermalOptions {
  /** Contrast boost 0..2. */
  contrast: number;
  /** Invert the palette. */
  invert: boolean;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const clampByte = (n: number) => clamp(Math.round(n), 0, 255);

/** Thermal palette stops (t, r, g, b). */
export const THERMAL_STOPS: Array<[number, number, number, number]> = [
  [0.0, 0, 0, 0],
  [0.2, 0, 0, 180],
  [0.4, 130, 0, 180],
  [0.6, 220, 40, 60],
  [0.8, 255, 200, 40],
  [1.0, 255, 255, 255],
];

/** Validate thermal options. */
export function validateThermal(opts: ThermalOptions): ThermalOptions | { error: string } {
  if (opts.contrast < 0 || opts.contrast > 2) return { error: "Contrast must be 0..2" };
  return { contrast: opts.contrast, invert: !!opts.invert };
}

/** ITU-R BT.601 luma. */
export function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Apply power-curve contrast around 0.5 midpoint. */
export function applyContrast(t: number, contrast: number): number {
  const c = clamp(contrast, 0, 2);
  if (c === 1) return t;
  return clamp(Math.pow(t, 1 / c), 0, 1);
}

/** Linear interpolate two RGB stops. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Map a normalized value (0..1) through the thermal palette. */
export function thermalColor(t: number, invert: boolean): [number, number, number] {
  const u = clamp(t, 0, 1);
  const v = invert ? 1 - u : u;
  for (let i = 0; i < THERMAL_STOPS.length - 1; i++) {
    const [t0, r0, g0, b0] = THERMAL_STOPS[i]!;
    const [t1, r1, g1, b1] = THERMAL_STOPS[i + 1]!;
    if (v >= t0 && v <= t1) {
      const localT = t1 > t0 ? (v - t0) / (t1 - t0) : 0;
      return [clampByte(lerp(r0, r1, localT)), clampByte(lerp(g0, g1, localT)), clampByte(lerp(b0, b1, localT))];
    }
  }
  return [255, 255, 255];
}

/** Map a single RGB pixel to its thermal value. */
export function thermalPixel(
  r: number,
  g: number,
  b: number,
  opts: ThermalOptions,
): [number, number, number] {
  const t = applyContrast(luma(r, g, b) / 255, opts.contrast);
  return thermalColor(t, opts.invert);
}
