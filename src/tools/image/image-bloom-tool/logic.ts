/**
 * Image Bloom Tool — pure logic. No DOM / canvas access.
 *
 * 10+ extras:
 *   1. Brightness threshold mask computation
 *   2. Bloom radius / blur sigma computation
 *   3. Bloom intensity slider
 *   4. Blend modes (screen, soft-light, add, lighten)
 *   5. Tone mapping (Reinhard / ACES-style)
 *   6. Batch validation
 *   7. Presets (subtle, dreamy, neon, harsh)
 *   8. Before/after delta metric
 *   9. Identity check
 *  10. Format-preserving transparency check
 *  11. Luma computation
 *  12. Per-pixel bloom application
 */
export type OutputFormat = "image/png" | "image/jpeg" | "image/webp";

export type BlendMode = "add" | "screen" | "softLight" | "lighten";

export interface BloomOptions {
  /** Brightness threshold 0..255. Pixels brighter than this contribute to bloom. */
  threshold: number;
  /** Bloom intensity 0..1. */
  intensity: number;
  /** Blur radius in pixels. */
  radius: number;
  /** Blend mode. */
  blendMode: BlendMode;
  /** Tone mapping strength 0..1 (0 = none, 1 = full Reinhard). */
  toneMap: number;
}

export const DEFAULT_OPTIONS: BloomOptions = {
  threshold: 200,
  intensity: 0.5,
  radius: 8,
  blendMode: "screen",
  toneMap: 0,
};

export interface BloomPreset {
  id: string;
  label: string;
  options: BloomOptions;
}

export const PRESETS: BloomPreset[] = [
  { id: "subtle", label: "Subtle", options: { ...DEFAULT_OPTIONS, intensity: 0.2, radius: 4 } },
  { id: "dreamy", label: "Dreamy", options: { ...DEFAULT_OPTIONS, intensity: 0.5, radius: 16, threshold: 180 } },
  { id: "neon", label: "Neon glow", options: { ...DEFAULT_OPTIONS, intensity: 0.8, radius: 24, threshold: 220, blendMode: "add" } },
  { id: "harsh", label: "Harsh", options: { ...DEFAULT_OPTIONS, intensity: 0.9, radius: 4, threshold: 240, blendMode: "lighten" } },
  { id: "soft", label: "Soft light", options: { ...DEFAULT_OPTIONS, intensity: 0.5, radius: 12, blendMode: "softLight" } },
];

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export const clampByte = (n: number) => clamp(Math.round(n), 0, 255);

/** ITU-R BT.601 luma. */
export function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Returns true if pixel passes the brightness threshold. */
export function passesThreshold(r: number, g: number, b: number, threshold: number): boolean {
  return luma(r, g, b) >= threshold;
}

/** Effective sigma for box-blur approximation with given radius & 3 passes. */
export function effectiveSigma(radius: number): number {
  if (radius <= 0) return 0;
  return (2 * radius + 1) * Math.sqrt(3 / 12);
}

/** Validate and sanitize bloom options. */
export function validateBloom(opts: BloomOptions): BloomOptions | { error: string } {
  if (opts.threshold < 0 || opts.threshold > 255) return { error: "Threshold must be 0..255" };
  if (opts.intensity < 0 || opts.intensity > 1) return { error: "Intensity must be 0..1" };
  if (opts.radius < 0 || opts.radius > 100) return { error: "Radius must be 0..100" };
  if (opts.toneMap < 0 || opts.toneMap > 1) return { error: "Tone map must be 0..1" };
  return {
    threshold: clamp(opts.threshold, 0, 255),
    intensity: opts.intensity,
    radius: Math.round(opts.radius),
    blendMode: opts.blendMode,
    toneMap: opts.toneMap,
  };
}

/** Blend a pixel with the bloom using the configured blend mode. */
export function blendBloom(
  pixel: [number, number, number, number],
  bloom: [number, number, number],
  opts: BloomOptions,
): [number, number, number, number] {
  const a = clamp(opts.intensity, 0, 1);
  const [pr, pg, pb] = [pixel[0], pixel[1], pixel[2]];
  const [br, bg, bb] = [bloom[0] * a, bloom[1] * a, bloom[2] * a];
  let r: number, g: number, b: number;
  switch (opts.blendMode) {
    case "add":
      r = pr + br; g = pg + bg; b = pb + bb;
      break;
    case "screen":
      r = 255 - ((255 - pr) * (255 - br)) / 255;
      g = 255 - ((255 - pg) * (255 - bg)) / 255;
      b = 255 - ((255 - pb) * (255 - bb)) / 255;
      break;
    case "softLight":
      r = pr + (br - 128) * (pr / 255) * 2;
      g = pg + (bg - 128) * (pg / 255) * 2;
      b = pb + (bb - 128) * (pb / 255) * 2;
      break;
    case "lighten":
      r = Math.max(pr, br); g = Math.max(pg, bg); b = Math.max(pb, bb);
      break;
  }
  // Tone map (Reinhard)
  const tm = clamp(opts.toneMap, 0, 1);
  if (tm > 0) {
    r = r + (r / (1 + r / 255) - r) * tm;
    g = g + (g / (1 + g / 255) - g) * tm;
    b = b + (b / (1 + b / 255) - b) * tm;
  }
  return [clampByte(r), clampByte(g), clampByte(b), pixel[3]];
}

/** Additive bloom (kept for backward compatibility). */
export function addBloom(
  pixel: [number, number, number, number],
  bloom: [number, number, number],
  intensity: number,
): [number, number, number, number] {
  return blendBloom(pixel, bloom, { ...DEFAULT_OPTIONS, intensity, blendMode: "add" });
}

/** Compute the bloom mask value for a single pixel (0..255). */
export function bloomMask(r: number, g: number, b: number, threshold: number): number {
  if (!passesThreshold(r, g, b, threshold)) return 0;
  return clampByte(luma(r, g, b));
}

/** Mean absolute bloom contribution per pixel. */
export function bloomDelta(
  data: Uint8ClampedArray,
  bloomData: Uint8ClampedArray,
  opts: BloomOptions,
): number {
  let sum = 0, n = 0;
  const len = Math.min(data.length, bloomData.length);
  for (let i = 0; i < len; i += 4) {
    const out = blendBloom(
      [data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!],
      [bloomData[i]!, bloomData[i + 1]!, bloomData[i + 2]!],
      opts,
    );
    sum += Math.abs(out[0] - data[i]!) + Math.abs(out[1] - data[i + 1]!) + Math.abs(out[2] - data[i + 2]!);
    n++;
  }
  return n === 0 ? 0 : sum / (n * 3);
}

/** True when options produce a no-op. */
export function isIdentity(opts: BloomOptions): boolean {
  return opts.intensity === 0;
}

/** Batch-validate a list of files. */
export function batchValidate(
  files: { name: string }[],
  opts: BloomOptions,
): { name: string; result: BloomOptions | { error: string } }[] {
  return files.map((f) => ({ name: f.name, result: validateBloom(opts) }));
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
export function findPreset(id: string): BloomPreset | undefined {
  return PRESETS.find((p) => p.id === id);
}
