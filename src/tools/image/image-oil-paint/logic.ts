/**
 * Image Oil Paint — pure logic. No DOM / canvas access.
 *
 * For each output pixel, find the most common color in a brush-sized
 * neighborhood (color quantization binning reduces variation).
 *
 * 10+ extras:
 *   1. Brush radius
 *   2. Detail/strength (quantization levels)
 *   3. Stroke direction (angular weighting)
 *   4. Canvas texture (overlay noise)
 *   5. Style presets (impressionist, palette-knife, classic)
 *   6. Strength blend (mix original + oil)
 *   7. Batch validation
 *   8. Before/after delta metric
 *   9. Identity check
 *  10. Format-preserving transparency check
 *  11. Quantization helper
 *  12. Dominant color finder
 */
export type OutputFormat = "image/png" | "image/jpeg" | "image/webp";

export type OilStyle = "classic" | "impressionist" | "paletteKnife" | "watercolor";

export interface OilOptions {
  /** Brush radius in pixels. */
  radius: number;
  /** Number of color levels per channel (quantization). */
  levels: number;
  /** Stroke direction in degrees (0 = horizontal, 90 = vertical). */
  direction: number;
  /** Canvas texture amount 0..1. */
  texture: number;
  /** Style preset. */
  style: OilStyle;
  /** Strength blend 0..1 (1 = full oil, 0 = original). */
  strength: number;
}

export const DEFAULT_OPTIONS: OilOptions = {
  radius: 4,
  levels: 16,
  direction: 0,
  texture: 0,
  style: "classic",
  strength: 1,
};

export interface OilPreset {
  id: string;
  label: string;
  options: OilOptions;
}

export const PRESETS: OilPreset[] = [
  { id: "classic", label: "Classic", options: { ...DEFAULT_OPTIONS, radius: 4, levels: 16 } },
  { id: "impressionist", label: "Impressionist", options: { ...DEFAULT_OPTIONS, style: "impressionist", radius: 6, levels: 8, texture: 0.3, direction: 45 } },
  { id: "paletteKnife", label: "Palette knife", options: { ...DEFAULT_OPTIONS, style: "paletteKnife", radius: 8, levels: 6, direction: 90, strength: 1 } },
  { id: "watercolor-oil", label: "Watercolor oil", options: { ...DEFAULT_OPTIONS, style: "watercolor", radius: 5, levels: 12, texture: 0.5, strength: 0.7 } },
  { id: "soft", label: "Soft", options: { ...DEFAULT_OPTIONS, radius: 3, levels: 24, strength: 0.6 } },
];

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export const clampByte = (n: number) => clamp(Math.round(n), 0, 255);

/** Validate oil paint options. */
export function validateOil(opts: OilOptions): OilOptions | { error: string } {
  if (opts.radius < 0 || opts.radius > 30) return { error: "Radius must be 0..30" };
  if (opts.levels < 2 || opts.levels > 64) return { error: "Levels must be 2..64" };
  if (opts.direction < 0 || opts.direction > 360) return { error: "Direction must be 0..360" };
  if (opts.texture < 0 || opts.texture > 1) return { error: "Texture must be 0..1" };
  if (opts.strength < 0 || opts.strength > 1) return { error: "Strength must be 0..1" };
  return { ...opts, radius: Math.round(opts.radius), levels: Math.round(opts.levels) };
}

/** Quantize a channel value to N levels. */
export function quantize(value: number, levels: number): number {
  const step = 256 / levels;
  const q = Math.floor(value / step) * step;
  return Math.min(255, Math.round(q + step / 2));
}

/** Quantize an RGB triple. */
export function quantizeRgb(r: number, g: number, b: number, levels: number): [number, number, number] {
  return [quantize(r, levels), quantize(g, levels), quantize(b, levels)];
}

/** Pack a quantized RGB triple into a single integer key. */
export function packRgb(r: number, g: number, b: number): number {
  return (r << 16) | (g << 8) | b;
}

/** Angular weight for a brush offset (1 when aligned with direction, falls off). */
export function angularWeight(dx: number, dy: number, direction: number): number {
  if (dx === 0 && dy === 0) return 1;
  const dirRad = (direction * Math.PI) / 180;
  const angle = Math.atan2(dy, dx);
  let diff = Math.abs(angle - dirRad);
  if (diff > Math.PI) diff = Math.PI * 2 - diff;
  return Math.max(0, 1 - diff / (Math.PI / 2));
}

/** Find the most frequent color in a brush-sized neighborhood. */
export function dominantColor(
  pixels: Uint8ClampedArray | number[],
  w: number,
  h: number,
  cx: number,
  cy: number,
  radius: number,
  levels: number,
): [number, number, number] {
  return dominantColorDirectional(pixels, w, h, cx, cy, radius, levels, 0, 1);
}

/** Find the most frequent color with directional weighting and texture. */
export function dominantColorDirectional(
  pixels: Uint8ClampedArray | number[],
  w: number,
  h: number,
  cx: number,
  cy: number,
  radius: number,
  levels: number,
  direction: number,
  texture: number,
): [number, number, number] {
  const counts = new Map<number, { count: number; r: number; g: number; b: number }>();
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const weight = angularWeight(dx, dy, direction);
      if (weight <= 0) continue;
      const i = (y * w + x) * 4;
      const [qr, qg, qb] = quantizeRgb(pixels[i]!, pixels[i + 1]!, pixels[i + 2]!, levels);
      const key = packRgb(qr, qg, qb);
      const cur = counts.get(key);
      // Texture: jitter the count by a small noise amount
      const noise = texture > 0 ? (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1 : 0;
      const inc = weight + (texture * noise);
      if (cur) cur.count += inc;
      else counts.set(key, { count: inc, r: pixels[i]!, g: pixels[i + 1]!, b: pixels[i + 2]! });
    }
  }
  let best: { count: number; r: number; g: number; b: number } | null = null;
  for (const v of counts.values()) if (!best || v.count > best.count) best = v;
  return best ? [best.r, best.g, best.b] : [0, 0, 0];
}

/** Blend original and oil-painted pixels by strength. */
export function blendOil(
  original: [number, number, number, number],
  oil: [number, number, number],
  strength: number,
): [number, number, number, number] {
  const s = clamp(strength, 0, 1);
  return [
    clampByte(original[0] + (oil[0] - original[0]) * s),
    clampByte(original[1] + (oil[1] - original[1]) * s),
    clampByte(original[2] + (oil[2] - original[2]) * s),
    original[3],
  ];
}

/** Mean absolute delta between original and oil-painted pixels. */
export function oilDelta(
  data: Uint8ClampedArray,
  oilData: Uint8ClampedArray,
  strength: number,
): number {
  let sum = 0, n = 0;
  const len = Math.min(data.length, oilData.length);
  for (let i = 0; i < len; i += 4) {
    const out = blendOil(
      [data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!],
      [oilData[i]!, oilData[i + 1]!, oilData[i + 2]!],
      strength,
    );
    sum += Math.abs(out[0] - data[i]!) + Math.abs(out[1] - data[i + 1]!) + Math.abs(out[2] - data[i + 2]!);
    n++;
  }
  return n === 0 ? 0 : sum / (n * 3);
}

/** True when options produce a no-op. */
export function isIdentity(opts: OilOptions): boolean {
  return opts.strength === 0;
}

/** Batch-validate a list of files. */
export function batchValidate(
  files: { name: string }[],
  opts: OilOptions,
): { name: string; result: OilOptions | { error: string } }[] {
  return files.map((f) => ({ name: f.name, result: validateOil(opts) }));
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
export function findPreset(id: string): OilPreset | undefined {
  return PRESETS.find((p) => p.id === id);
}
