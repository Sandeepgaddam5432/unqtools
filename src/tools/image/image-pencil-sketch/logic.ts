/**
 * Image Pencil Sketch — pure logic. No DOM / canvas access.
 *
 * Combines a grayscale pass with an inverted-blur edge map (the classic
 * "color dodge" sketch trick) to produce a pencil-drawing look.
 */
export interface SketchOptions {
  /** Edge intensity 0..1. */
  intensity: number;
  /** Blur radius used to compute the dodge base. */
  radius: number;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const clampByte = (n: number) => clamp(Math.round(n), 0, 255);

/** Validate sketch options. */
export function validateSketch(opts: SketchOptions): SketchOptions | { error: string } {
  if (opts.intensity < 0 || opts.intensity > 1) return { error: "Intensity must be 0..1" };
  if (opts.radius < 0 || opts.radius > 50) return { error: "Radius must be 0..50" };
  return { intensity: opts.intensity, radius: Math.round(opts.radius) };
}

/** ITU-R BT.601 luma. */
export function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Convert a pixel array to grayscale (1 channel per pixel). */
export function toGray(pixels: Uint8ClampedArray | number[], w: number, h: number): number[] {
  const out = new Array<number>(w * h);
  for (let i = 0, p = 0; i < pixels.length; i += 4, p++) {
    out[p] = luma(pixels[i]!, pixels[i + 1]!, pixels[i + 2]!);
  }
  return out;
}

/** Box blur on a single-channel array. */
export function boxBlurGray(gray: number[], w: number, h: number, radius: number): number[] {
  if (radius <= 0) return gray.slice();
  const out = new Array<number>(w * h);
  const win = 2 * radius + 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0, n = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const sx = clamp(x + dx, 0, w - 1);
          const sy = clamp(y + dy, 0, h - 1);
          sum += gray[sy * w + sx]!; n++;
        }
      }
      out[y * w + x] = sum / (n || 1);
    }
  }
  return out;
}

/** Color-dodge blend of base (gray) over blurred inverted top → sketch strokes. */
export function dodgeBlend(base: number, blurred: number, intensity: number): number {
  const top = 255 - blurred;
  if (top >= 255) return 255;
  const v = (base * 255) / (255 - top);
  const mixed = base + (v - base) * intensity;
  return clampByte(mixed);
}
