/**
 * Image Gamma Corrector — pure math. output = input^(1/gamma).
 */
export interface GammaOptions {
  /** 0.1..10.0 — gamma value. <1 brightens, >1 darkens. */
  gamma: number;
}

const clampByte = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

/** Build a 256-entry lookup table for gamma correction. */
export function buildGammaLut(gamma: number): Uint8Array {
  const lut = new Uint8Array(256);
  const inv = 1 / Math.max(1e-6, gamma);
  for (let i = 0; i < 256; i++) {
    lut[i] = clampByte(255 * Math.pow(i / 255, inv));
  }
  return lut;
}

/** Apply gamma to a single channel value (0-255). */
export function applyGammaChannel(value: number, gamma: number): number {
  const inv = 1 / Math.max(1e-6, gamma);
  return clampByte(255 * Math.pow(value / 255, inv));
}

/** Apply gamma to an RGB pixel. */
export function applyGamma(rgb: { r: number; g: number; b: number }, gamma: number): { r: number; g: number; b: number } {
  return {
    r: applyGammaChannel(rgb.r, gamma),
    g: applyGammaChannel(rgb.g, gamma),
    b: applyGammaChannel(rgb.b, gamma),
  };
}

export function validateGammaOptions(o: GammaOptions): { ok: true } | { error: string } {
  if (!Number.isFinite(o.gamma) || o.gamma < 0.1 || o.gamma > 10) {
    return { error: "Gamma must be between 0.1 and 10.0" };
  }
  return { ok: true };
}

/** sRGB ↔ linear conversion helpers (used for accurate gamma). */
export function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
