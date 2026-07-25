/**
 * Image Shadows/Highlights — pure logic. No DOM/canvas access.
 * Tone-mapping curves for lifting shadows and toning down highlights.
 */

export interface PixelRGB {
  r: number;
  g: number;
  b: number;
}

/** Apply a smooth easing curve to a value 0..1. Handles reversed edges. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x >= edge0 ? 1 : 0;
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Shadow lift factor for a given luminance (0..1). 0 = no lift, 100 = full lift. */
export function shadowMask(luma: number, amount: number): number {
  // Affects only the lower half of the tonal range.
  const w = smoothstep(0.5, 0.0, luma);
  return (amount / 100) * w;
}

/** Highlight tone-down factor for a given luminance (0..1). */
export function highlightMask(luma: number, amount: number): number {
  // Affects only the upper half of the tonal range.
  const w = smoothstep(0.5, 1.0, luma);
  return (amount / 100) * w;
}

/** Convert RGB to luminance (Rec. 709). */
export function luminance(p: PixelRGB): number {
  return (0.2126 * p.r + 0.7152 * p.g + 0.0722 * p.b) / 255;
}

/** Lift shadows: brighten dark pixels without affecting highlights. */
export function liftShadow(p: PixelRGB, lift: number): PixelRGB {
  const l = luminance(p);
  const factor = 1 + lift * shadowMask(l, 100);
  return {
    r: clamp8(p.r * factor),
    g: clamp8(p.g * factor),
    b: clamp8(p.b * factor),
  };
}

/** Tone down highlights: darken bright pixels without affecting shadows. */
export function toneHighlight(p: PixelRGB, amount: number): PixelRGB {
  const l = luminance(p);
  const factor = 1 - amount * highlightMask(l, 100);
  return {
    r: clamp8(p.r * factor),
    g: clamp8(p.g * factor),
    b: clamp8(p.b * factor),
  };
}

/** Combined shadow/highlight adjustment on a single pixel. */
export function adjustPixel(
  p: PixelRGB,
  shadowAmount: number,
  highlightAmount: number,
): PixelRGB {
  let out = liftShadow(p, shadowAmount);
  out = toneHighlight(out, highlightAmount);
  return out;
}

export function clamp8(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

/** Validate an amount in 0..100. */
export function validateAmount(amount: number): number | { error: string } {
  if (typeof amount !== "number" || Number.isNaN(amount)) {
    return { error: "Amount must be a number" };
  }
  if (amount < 0 || amount > 100) return { error: "Amount must be between 0 and 100" };
  return amount;
}
