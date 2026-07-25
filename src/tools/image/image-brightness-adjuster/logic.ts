/**
 * Image Brightness Adjuster — pure logic. No DOM access.
 */
export interface BrightnessOptions {
  /** -100 (full dark) to +100 (full bright). */
  value: number;
}

/** Convert a -100..+100 brightness value to a delta in [0, 255]. */
export function brightnessDelta(value: number): number {
  const v = clamp(value, -100, 100);
  return (v / 100) * 255;
}

/** Apply brightness to a single RGB pixel. */
export function applyBrightness(pixel: { r: number; g: number; b: number; a: number }, value: number): {
  r: number;
  g: number;
  b: number;
  a: number;
} {
  const delta = brightnessDelta(value);
  return {
    r: clampByte(pixel.r + delta),
    g: clampByte(pixel.g + delta),
    b: clampByte(pixel.b + delta),
    a: pixel.a,
  };
}

/** Validate brightness options. */
export function validateBrightnessOptions(opts: BrightnessOptions): { ok: true } | { error: string } {
  if (!Number.isFinite(opts.value)) return { error: "Brightness must be a number" };
  if (opts.value < -100 || opts.value > 100) return { error: "Brightness must be between -100 and 100" };
  return { ok: true };
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const clampByte = (n: number) => clamp(Math.round(n), 0, 255);
