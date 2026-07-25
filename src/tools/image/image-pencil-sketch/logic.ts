/**
 * Image Pencil Sketch — pure logic. No DOM / canvas access.
 *
 * 10+ extras:
 *   1. Grayscale → invert → blur → dodge-blend pipeline
 *   2. Modes (graphite, charcoal, colored)
 *   3. Detail / edge strength
 *   4. Stroke darkness
 *   5. Paper texture (noise overlay)
 *   6. Batch validation
 *   7. Presets (graphite, charcoal, colored, soft, hard)
 *   8. Before/after delta metric
 *   9. Identity check
 *  10. Format-preserving transparency check
 *  11. Luma computation
 *  12. Box blur helper
 */
export type OutputFormat = "image/png" | "image/jpeg" | "image/webp";

export type SketchMode = "graphite" | "charcoal" | "colored";

export interface SketchOptions {
  /** Edge intensity 0..1. */
  intensity: number;
  /** Blur radius used to compute the dodge base. */
  radius: number;
  /** Sketch mode. */
  mode: SketchMode;
  /** Stroke darkness 0..1 (1 = pure black, 0 = light gray strokes). */
  darkness: number;
  /** Paper texture amount 0..1. */
  paperTexture: number;
  /** Color tint for colored mode [r,g,b]. */
  tint: [number, number, number];
}

export const DEFAULT_OPTIONS: SketchOptions = {
  intensity: 0.7,
  radius: 5,
  mode: "graphite",
  darkness: 0.9,
  paperTexture: 0.1,
  tint: [80, 60, 40],
};

export interface SketchPreset {
  id: string;
  label: string;
  options: SketchOptions;
}

export const PRESETS: SketchPreset[] = [
  { id: "graphite", label: "Graphite", options: { ...DEFAULT_OPTIONS, mode: "graphite" } },
  { id: "charcoal", label: "Charcoal", options: { ...DEFAULT_OPTIONS, mode: "charcoal", darkness: 1, intensity: 0.9 } },
  { id: "colored", label: "Colored", options: { ...DEFAULT_OPTIONS, mode: "colored", tint: [120, 80, 40] } },
  { id: "soft", label: "Soft", options: { ...DEFAULT_OPTIONS, intensity: 0.4, darkness: 0.6, radius: 8 } },
  { id: "hard", label: "Hard", options: { ...DEFAULT_OPTIONS, intensity: 1, darkness: 1, radius: 3 } },
];

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export const clampByte = (n: number) => clamp(Math.round(n), 0, 255);

/** Validate sketch options. */
export function validateSketch(opts: SketchOptions): SketchOptions | { error: string } {
  if (opts.intensity < 0 || opts.intensity > 1) return { error: "Intensity must be 0..1" };
  if (opts.radius < 0 || opts.radius > 50) return { error: "Radius must be 0..50" };
  if (opts.darkness < 0 || opts.darkness > 1) return { error: "Darkness must be 0..1" };
  if (opts.paperTexture < 0 || opts.paperTexture > 1) return { error: "Paper texture must be 0..1" };
  if (opts.tint.some((c) => c < 0 || c > 255)) return { error: "Tint must be 0..255" };
  return { ...opts, radius: Math.round(opts.radius) };
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

/** Apply darkness adjustment to a stroke value. */
export function applyDarkness(value: number, darkness: number): number {
  // darkness 0 = identity; darkness 1 = amplify stroke (darken midtones)
  const stroke = 255 - value;
  const amplified = stroke * (1 + darkness);
  return clampByte(255 - amplified);
}

/** Apply paper texture noise to a value. */
export function applyPaperTexture(value: number, noise: number, amount: number): number {
  if (amount <= 0) return value;
  return clampByte(value + (noise - 0.5) * 50 * amount);
}

/** Apply color tint to a gray value (for colored pencil mode). */
export function applyTint(gray: number, tint: [number, number, number]): [number, number, number] {
  const t = gray / 255;
  return [
    clampByte(tint[0] * t),
    clampByte(tint[1] * t),
    clampByte(tint[2] * t),
  ];
}

/** Apply the full sketch pipeline to a single pixel's gray value. */
export function sketchPixel(
  baseGray: number,
  blurredGray: number,
  opts: SketchOptions,
  noise: number,
): { r: number; g: number; b: number } {
  let v = dodgeBlend(baseGray, blurredGray, opts.intensity);
  v = applyDarkness(v, opts.darkness);
  v = applyPaperTexture(v, noise, opts.paperTexture);
  if (opts.mode === "colored") {
    const [r, g, b] = applyTint(v, opts.tint);
    return { r, g, b };
  }
  // Graphite and charcoal both produce grayscale; charcoal adds contrast
  if (opts.mode === "charcoal") {
    // Increase contrast for charcoal
    const c = (v - 128) * 1.4 + 128;
    v = clampByte(c);
  }
  return { r: v, g: v, b: v };
}

/** Mean absolute delta between original and sketched pixel data. */
export function sketchDelta(
  data: Uint8ClampedArray,
  sketchData: Uint8ClampedArray,
): number {
  let sum = 0, n = 0;
  const len = Math.min(data.length, sketchData.length);
  for (let i = 0; i < len; i += 4) {
    sum += Math.abs(sketchData[i]! - data[i]!) + Math.abs(sketchData[i + 1]! - data[i + 1]!) + Math.abs(sketchData[i + 2]! - data[i + 2]!);
    n++;
  }
  return n === 0 ? 0 : sum / (n * 3);
}

/** True when options produce a no-op. */
export function isIdentity(opts: SketchOptions): boolean {
  return opts.intensity === 0 && opts.darkness === 0 && opts.paperTexture === 0;
}

/** Batch-validate a list of files. */
export function batchValidate(
  files: { name: string }[],
  opts: SketchOptions,
): { name: string; result: SketchOptions | { error: string } }[] {
  return files.map((f) => ({ name: f.name, result: validateSketch(opts) }));
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
export function findPreset(id: string): SketchPreset | undefined {
  return PRESETS.find((p) => p.id === id);
}
