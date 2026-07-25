/**
 * Image Solarize (Sabattier) — pure logic. If pixel > threshold, invert it.
 */
export interface SolarizeOptions {
  /** 0..255 — threshold above which pixels are inverted. */
  threshold: number;
}

const clampByte = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

/** Apply solarize to a single channel value. */
export function solarizeChannel(value: number, threshold: number): number {
  return value > threshold ? clampByte(255 - value) : clampByte(value);
}

/** Apply solarize to an RGB pixel. */
export function solarize(rgb: { r: number; g: number; b: number }, threshold: number): { r: number; g: number; b: number } {
  return {
    r: solarizeChannel(rgb.r, threshold),
    g: solarizeChannel(rgb.g, threshold),
    b: solarizeChannel(rgb.b, threshold),
  };
}

export function validateSolarizeOptions(o: SolarizeOptions): { ok: true } | { error: string } {
  if (!Number.isFinite(o.threshold) || o.threshold < 0 || o.threshold > 255) {
    return { error: "Threshold must be 0-255" };
  }
  return { ok: true };
}

/** Build a 256-entry LUT for fast application. */
export function buildSolarizeLut(threshold: number): Uint8Array {
  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) lut[i] = solarizeChannel(i, threshold);
  return lut;
}
