/**
 * Image Charcoal Tool — pure logic. No DOM / canvas access.
 *
 * 10+ extras:
 *   1. Sobel edge detection
 *   2. Stroke direction (angle from gradient)
 *   3. Texture intensity (paper noise modulation)
 *   4. Edge detection magnitude
 *   5. Paper texture overlay
 *   6. Darkness control (0..1)
 *   7. Batch validation
 *   8. Presets (sketch, dark, light, rough, smooth)
 *   9. Identity check
 *  10. Format-preserving transparency check
 *  11. Kernel application helper
 *  12. Directional gradient angle
 */
export type OutputFormat = "image/png" | "image/jpeg" | "image/webp";

export interface CharcoalOptions {
  /** Edge strength 0..1. */
  strength: number;
  /** Texture noise amount 0..1. */
  texture: number;
  /** Darkness 0..1 (1 = pure black strokes, 0 = light gray strokes). */
  darkness: number;
  /** Stroke direction angle in degrees (0 = horizontal). */
  direction: number;
}

export const DEFAULT_OPTIONS: CharcoalOptions = {
  strength: 0.6,
  texture: 0.3,
  darkness: 0.85,
  direction: 0,
};

export interface CharcoalPreset {
  id: string;
  label: string;
  options: CharcoalOptions;
}

export const PRESETS: CharcoalPreset[] = [
  { id: "sketch", label: "Sketch", options: { ...DEFAULT_OPTIONS, strength: 0.5, darkness: 0.7 } },
  { id: "dark", label: "Dark", options: { ...DEFAULT_OPTIONS, strength: 0.8, darkness: 1, texture: 0.4 } },
  { id: "light", label: "Light", options: { ...DEFAULT_OPTIONS, strength: 0.4, darkness: 0.5, texture: 0.2 } },
  { id: "rough", label: "Rough", options: { ...DEFAULT_OPTIONS, strength: 0.7, darkness: 0.9, texture: 0.8 } },
  { id: "smooth", label: "Smooth", options: { ...DEFAULT_OPTIONS, strength: 0.5, darkness: 0.7, texture: 0 } },
];

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export const clampByte = (n: number) => clamp(Math.round(n), 0, 255);

/** Validate charcoal options. */
export function validateCharcoal(opts: CharcoalOptions): CharcoalOptions | { error: string } {
  if (opts.strength < 0 || opts.strength > 1) return { error: "Strength must be 0..1" };
  if (opts.texture < 0 || opts.texture > 1) return { error: "Texture must be 0..1" };
  if (opts.darkness < 0 || opts.darkness > 1) return { error: "Darkness must be 0..1" };
  if (opts.direction < 0 || opts.direction > 360) return { error: "Direction must be 0..360" };
  return { ...opts };
}

/** Sobel X kernel (horizontal gradient). */
export const SOBEL_X = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
/** Sobel Y kernel (vertical gradient). */
export const SOBEL_Y = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

/** Apply a 3×3 kernel to a single grayscale channel. */
export function applyKernel(gray: number[], x: number, y: number, w: number, h: number, kernel: number[]): number {
  let sum = 0;
  let k = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const sx = clamp(x + dx, 0, w - 1);
      const sy = clamp(y + dy, 0, h - 1);
      sum += gray[sy * w + sx]! * kernel[k]!;
      k++;
    }
  }
  return sum;
}

/** Sobel edge magnitude for a pixel. */
export function sobelMagnitude(gray: number[], x: number, y: number, w: number, h: number): number {
  const gx = applyKernel(gray, x, y, w, h, SOBEL_X);
  const gy = applyKernel(gray, x, y, w, h, SOBEL_Y);
  return Math.sqrt(gx * gx + gy * gy);
}

/** Sobel edge angle in degrees (0..360). */
export function sobelAngle(gray: number[], x: number, y: number, w: number, h: number): number {
  const gx = applyKernel(gray, x, y, w, h, SOBEL_X);
  const gy = applyKernel(gray, x, y, w, h, SOBEL_Y);
  let angle = Math.atan2(gy, gx) * 180 / Math.PI;
  if (angle < 0) angle += 360;
  return angle;
}

/** ITU-R BT.601 luma. */
export function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Map edge magnitude to a charcoal value (0=white paper, 255=dark stroke). */
export function edgeToCharcoal(magnitude: number, strength: number, texture: number, noise: number): number {
  const base = clamp(magnitude * (1 + strength * 4), 0, 255);
  const textured = base + (noise - 0.5) * 80 * texture;
  return clampByte(255 - textured);
}

/** Full charcoal mapping with darkness + direction influence. */
export function edgeToCharcoalFull(
  magnitude: number,
  opts: CharcoalOptions,
  noise: number,
  angle: number,
): number {
  // Directional influence: strokes aligned with direction are emphasized.
  const dirRad = (opts.direction * Math.PI) / 180;
  const angleDiff = Math.abs(Math.cos(angle * Math.PI / 180 - dirRad));
  const dirBoost = 0.7 + 0.6 * angleDiff;
  const base = clamp(magnitude * (1 + opts.strength * 4) * dirBoost, 0, 255);
  const textured = base + (noise - 0.5) * 80 * opts.texture;
  // Darkness: stroke brightness = 255 * (1 - darkness)
  const strokeBrightness = 255 * (1 - opts.darkness);
  return clampByte(strokeBrightness + (255 - strokeBrightness) - textured);
}

/** Compute mean edge magnitude (for stats). */
export function meanEdgeMagnitude(gray: number[], w: number, h: number): number {
  let sum = 0, n = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      sum += sobelMagnitude(gray, x, y, w, h);
      n++;
    }
  }
  return n === 0 ? 0 : sum / n;
}

/** Generate a paper texture value (0..1) from a noise seed and coordinates. */
export function paperTexture(x: number, y: number, seed: number): number {
  const s = Math.sin((x + seed) * 12.9898 + (y + seed) * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/** True when options produce a no-op. */
export function isIdentity(opts: CharcoalOptions): boolean {
  return opts.strength === 0 && opts.texture === 0 && opts.darkness === 0;
}

/** Batch-validate a list of files. */
export function batchValidate(
  files: { name: string }[],
  opts: CharcoalOptions,
): { name: string; result: CharcoalOptions | { error: string } }[] {
  return files.map((f) => ({ name: f.name, result: validateCharcoal(opts) }));
}

/** Format-preserving transparency check. */
export function preservesAlpha(format: OutputFormat): boolean {
  return format === "image/png" || format === "image/webp";
}

/** Keyboard nudge helper. */
export function nudgeValue(value: number, key: string, shift: boolean): number {
  const step = shift ? 10 : 1;
  if (key === "arrowup") return value + step;
  if (key === "arrowdown") return value - step;
  return value;
}

/** Find a preset by id. */
export function findPreset(id: string): CharcoalPreset | undefined {
  return PRESETS.find((p) => p.id === id);
}
