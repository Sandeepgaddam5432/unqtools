/**
 * Image Watercolor — pure logic. No DOM / canvas access.
 *
 * Extras:
 *  1. Edge softening (mean-shift style smoothing)
 *  2. Color spread (dominant chroma expansion)
 *  3. Paper texture (noise overlay)
 *  4. Wet/dry balance (controls diffusion amount)
 *  5. Pigment density (color saturation boost)
 *  6. Batch validation
 *  7. Presets (soft, vivid, sketch, dry, wet)
 *  8. Identity check
 *  9. Window average + blend helpers
 * 10. Spread weight helper
 * 11. Luma + clamp helpers
 * 12. Stats (mean delta)
 */
export type OutputFormat = "image/png" | "image/jpeg" | "image/webp";

export interface WatercolorOptions {
  /** Smoothing window radius in pixels. */
  radius: number;
  /** Color spread factor 0..1. */
  spread: number;
  /** Edge softening factor 0..1. */
  soften: number;
  /** Paper texture amount 0..1. */
  paper: number;
  /** Wet/dry balance 0..1 (1 = wet, more diffusion). */
  wet: number;
  /** Pigment density 0..2 (1 = neutral, 2 = saturated). */
  pigment: number;
  /** Paper texture seed (used for deterministic noise). */
  seed: number;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export const clampByte = (n: number) => clamp(Math.round(n), 0, 255);

export const DEFAULT_OPTIONS: WatercolorOptions = {
  radius: 3, spread: 0.5, soften: 0.6, paper: 0.2, wet: 0.5, pigment: 1.1, seed: 1,
};

export interface WatercolorPreset {
  id: string;
  label: string;
  options: WatercolorOptions;
}

export const PRESETS: WatercolorPreset[] = [
  { id: "soft", label: "Soft", options: { ...DEFAULT_OPTIONS, soften: 0.8, spread: 0.3, wet: 0.7 } },
  { id: "vivid", label: "Vivid", options: { ...DEFAULT_OPTIONS, spread: 0.8, pigment: 1.6, wet: 0.4 } },
  { id: "sketch", label: "Sketch", options: { ...DEFAULT_OPTIONS, soften: 0.3, spread: 0.2, paper: 0.5 } },
  { id: "dry", label: "Dry", options: { ...DEFAULT_OPTIONS, wet: 0.1, spread: 0.3, pigment: 1.0 } },
  { id: "wet", label: "Wet", options: { ...DEFAULT_OPTIONS, wet: 1.0, spread: 0.9, soften: 0.9 } },
];

/** Validate watercolor options. */
export function validateWatercolor(opts: WatercolorOptions): WatercolorOptions | { error: string } {
  if (opts.radius < 0 || opts.radius > 20) return { error: "Radius must be 0..20" };
  if (opts.spread < 0 || opts.spread > 1) return { error: "Spread must be 0..1" };
  if (opts.soften < 0 || opts.soften > 1) return { error: "Soften must be 0..1" };
  if (opts.paper < 0 || opts.paper > 1) return { error: "Paper must be 0..1" };
  if (opts.wet < 0 || opts.wet > 1) return { error: "Wet must be 0..1" };
  if (opts.pigment < 0 || opts.pigment > 2) return { error: "Pigment must be 0..2" };
  return { ...opts, radius: Math.round(opts.radius) };
}

/** Average color in a window. */
export function windowAverage(
  pixels: Uint8ClampedArray | number[],
  w: number, h: number, cx: number, cy: number, radius: number,
): [number, number, number] {
  let r = 0, g = 0, b = 0, n = 0;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const i = (y * w + x) * 4;
      r += pixels[i]!; g += pixels[i + 1]!; b += pixels[i + 2]!; n++;
    }
  }
  return n === 0 ? [0, 0, 0] : [r / n, g / n, b / n];
}

/** Blend a pixel toward a target by amount (soften factor). */
export function blendSoft(
  pixel: [number, number, number, number],
  target: [number, number, number],
  amount: number,
): [number, number, number, number] {
  const a = clamp(amount, 0, 1);
  return [
    clampByte(pixel[0] + (target[0] - pixel[0]) * a),
    clampByte(pixel[1] + (target[1] - pixel[1]) * a),
    clampByte(pixel[2] + (target[2] - pixel[2]) * a),
    pixel[3],
  ];
}

/** Compute color spread weight from distance to window edge (1=center, 0=edge). */
export function spreadWeight(distance: number, radius: number): number {
  if (radius <= 0) return 1;
  return clamp(1 - distance / radius, 0, 1);
}

/** Deterministic paper texture noise from coords + seed. */
export function paperNoise(x: number, y: number, seed: number): number {
  const v = Math.sin(x * 12.9898 + y * 78.233 + seed * 1.7) * 43758.5453;
  const f = v - Math.floor(v);
  return f < 0 ? f + 1 : f;
}

/** Apply paper texture to a color triplet. */
export function applyPaper([r, g, b]: [number, number, number], noise: number, amount: number): [number, number, number] {
  if (amount <= 0) return [r, g, b];
  const shift = (noise - 0.5) * 40 * amount;
  return [clampByte(r + shift), clampByte(g + shift), clampByte(b + shift)];
}

/** Apply pigment density (saturation boost) to a color triplet. */
export function applyPigment([r, g, b]: [number, number, number], pigment: number): [number, number, number] {
  if (pigment === 1) return [r, g, b];
  // ITU-R BT.601 luma
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  return [
    clampByte(y + (r - y) * pigment),
    clampByte(y + (g - y) * pigment),
    clampByte(y + (b - y) * pigment),
  ];
}

/** Apply the full watercolor pipeline to a single pixel. */
export function watercolorPixel(
  px: [number, number, number, number],
  avg: [number, number, number],
  opts: WatercolorOptions,
  noise: number,
): [number, number, number, number] {
  // Two-pass: soften toward average, then expand spread chroma scaled by wet.
  const softened = blendSoft(px, avg, opts.soften);
  const spreaded = blendSoft(softened, avg, opts.spread * 0.6 * (0.4 + opts.wet));
  let [r, g, b, a] = spreaded;
  [r, g, b] = applyPaper([r, g, b], noise, opts.paper);
  [r, g, b] = applyPigment([r, g, b], opts.pigment);
  return [r, g, b, a];
}

/** True when options produce a no-op. */
export function isIdentity(opts: WatercolorOptions): boolean {
  return opts.soften === 0 && opts.spread === 0 && opts.paper === 0 && opts.pigment === 1;
}

/** Mean absolute delta between two RGBA pixel arrays. */
export function meanDelta(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let sum = 0, n = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i += 4) {
    sum += Math.abs(a[i]! - b[i]!) + Math.abs(a[i + 1]! - b[i + 1]!) + Math.abs(a[i + 2]! - b[i + 2]!);
    n++;
  }
  return n === 0 ? 0 : sum / (n * 3);
}

/** Batch-validate a list of files. */
export function batchValidate(files: { name: string }[], opts: WatercolorOptions): { name: string; result: WatercolorOptions | { error: string } }[] {
  return files.map((f) => ({ name: f.name, result: validateWatercolor(opts) }));
}

/** Find a preset by id. */
export function findPreset(id: string): WatercolorPreset | undefined {
  return PRESETS.find((p) => p.id === id);
}

/** Format-preserving transparency check. */
export function preservesAlpha(format: OutputFormat): boolean {
  return format === "image/png" || format === "image/webp";
}

/** ITU-R BT.601 luma. */
export function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
