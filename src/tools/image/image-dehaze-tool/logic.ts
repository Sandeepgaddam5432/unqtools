/**
 * Image Dehaze Tool — pure logic. No DOM/canvas access.
 * Dark channel prior: estimate haze transmission and recover the scene.
 */

export interface PixelRGB {
  r: number;
  g: number;
  b: number;
}

/** Compute the dark channel value for a single pixel: min(R,G,B). */
export function darkChannelValue(p: PixelRGB): number {
  return Math.min(p.r, p.g, p.b);
}

/** Estimate atmospheric light by taking the brightest pixel of the dark channel. */
export function estimateAirlight(
  pixels: PixelRGB[],
  darks: number[],
): PixelRGB | { error: string } {
  if (pixels.length === 0 || darks.length === 0) return { error: "Need pixels" };
  if (pixels.length !== darks.length) return { error: "Mismatched arrays" };
  let maxIdx = 0;
  let maxVal = -1;
  for (let i = 0; i < darks.length; i++) {
    if (darks[i] > maxVal) {
      maxVal = darks[i];
      maxIdx = i;
    }
  }
  return pixels[maxIdx];
}

/** Estimate transmission per pixel: t = 1 - omega * min(I/A). */
export function estimateTransmission(
  p: PixelRGB,
  air: PixelRGB,
  omega = 0.95,
): number {
  const nr = p.r / Math.max(air.r, 1);
  const ng = p.g / Math.max(air.g, 1);
  const nb = p.b / Math.max(air.b, 1);
  const dark = Math.min(nr, ng, nb);
  return Math.max(0.1, 1 - omega * dark);
}

/** Recover the haze-free radiance: J = (I - A) / t + A. */
export function recoverPixel(p: PixelRGB, air: PixelRGB, t: number): PixelRGB {
  const tc = Math.max(t, 0.1);
  const r = (p.r - air.r) / tc + air.r;
  const g = (p.g - air.g) / tc + air.g;
  const b = (p.b - air.b) / tc + air.b;
  return {
    r: clamp8(r),
    g: clamp8(g),
    b: clamp8(b),
  };
}

/** Clamp a value to the 0..255 byte range. */
export function clamp8(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

/** Validate omega range (0..1). */
export function validateOmega(omega: number): number | { error: string } {
  if (typeof omega !== "number" || Number.isNaN(omega)) {
    return { error: "Omega must be a number" };
  }
  if (omega < 0 || omega > 1) return { error: "Omega must be between 0 and 1" };
  return omega;
}

/** Full dehaze pipeline for a single pixel given precomputed air + omega. */
export function dehazePixel(
  p: PixelRGB,
  air: PixelRGB,
  omega: number,
): PixelRGB {
  const t = estimateTransmission(p, air, omega);
  return recoverPixel(p, air, t);
}
