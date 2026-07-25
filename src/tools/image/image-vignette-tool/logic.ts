/**
 * Image Vignette Tool — pure math. No DOM/canvas access.
 *
 * Extras:
 *  1. Center offset (x, y)
 *  2. Inner / outer radius control
 *  3. Shape (circle / ellipse)
 *  4. Vignette color (dark or light)
 *  5. Blend modes (multiply / screen / overlay)
 *  6. Batch validation
 *  7. Presets (classic / soft / harsh / inverted)
 *  8. Identity check
 *  9. Format-preserving transparency
 * 10. Luma helper
 * 11. Mean delta metric
 */
export type OutputFormat = "image/png" | "image/jpeg" | "image/webp";
export type VignetteShape = "circle" | "ellipse";
export type BlendMode = "multiply" | "screen" | "overlay";

export interface RgbPixel {
  r: number; g: number; b: number; a: number;
}

export interface VignetteOptions {
  amount: number;
  size: number;
  feather: number;
  /** Center offset X relative to image center, -0.5..0.5. */
  offsetX: number;
  /** Center offset Y relative to image center, -0.5..0.5. */
  offsetY: number;
  shape: VignetteShape;
  /** Vignette color [r, g, b]. */
  color: [number, number, number];
  blend: BlendMode;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export const clampByte = (n: number) => clamp(Math.round(n), 0, 255);

/** Normalized distance from center (0 at center, 1 at corner). */
export function normalizedDistance(x: number, y: number, width: number, height: number): number {
  const cx = width / 2;
  const cy = height / 2;
  const dx = (x - cx) / (width / 2);
  const dy = (y - cy) / (height / 2);
  return Math.sqrt(dx * dx + dy * dy) / Math.SQRT2;
}

/** Distance with shape & center offset. */
export function distanceFromCenter(
  x: number, y: number, width: number, height: number,
  offsetX: number, offsetY: number, shape: VignetteShape,
): number {
  const cx = width / 2 + offsetX * width;
  const cy = height / 2 + offsetY * height;
  const dx = (x - cx) / (width / 2);
  const dy = (y - cy) / (height / 2);
  if (shape === "ellipse") {
    return Math.sqrt(dx * dx + dy * dy) / Math.SQRT2;
  }
  // circle: scale dy by aspect to keep circle round
  const aspect = width / height;
  return Math.sqrt(dx * dx + (dy * aspect) ** 2) / Math.SQRT2 / Math.max(1, aspect);
}

/** Compute vignette factor (0..1) for a single pixel. */
export function vignetteFactor(
  x: number, y: number, width: number, height: number, opts: VignetteOptions,
): number {
  const d = distanceFromCenter(x, y, width, height, opts.offsetX, opts.offsetY, opts.shape);
  const inner = clamp(opts.size / 100, 0, 1);
  const feather = clamp(opts.feather / 100, 0.01, 1);
  const amount = clamp(opts.amount / 100, 0, 1);
  const t = clamp((d - inner) / feather, 0, 1);
  return 1 - amount * t;
}

/** Blend two colors by a factor. */
export function blendColor(a: number, b: number, mode: BlendMode): number {
  switch (mode) {
    case "screen": return clampByte(255 - ((255 - a) * (255 - b)) / 255);
    case "overlay": return a < 128 ? clampByte((a * b) / 128) : clampByte(255 - ((255 - a) * (255 - b)) / 128);
    case "multiply":
    default: return clampByte((a * b) / 255);
  }
}

/** Apply vignette to a single pixel using the blend mode + color. */
export function applyVignette(pixel: RgbPixel, factor: number, color: [number, number, number], mode: BlendMode): RgbPixel {
  // factor 1 = full pixel; factor 0 = full vignette color
  const target: [number, number, number] = [
    color[0] * (1 - factor) + pixel.r * factor,
    color[1] * (1 - factor) + pixel.g * factor,
    color[2] * (1 - factor) + pixel.b * factor,
  ];
  return {
    r: blendColor(pixel.r, target[0], mode),
    g: blendColor(pixel.g, target[1], mode),
    b: blendColor(pixel.b, target[2], mode),
    a: pixel.a,
  };
}

export function validateVignetteOptions(opts: VignetteOptions): { ok: true } | { error: string } {
  if (opts.amount < 0 || opts.amount > 100) return { error: "Amount must be 0-100" };
  if (opts.size < 0 || opts.size > 100) return { error: "Size must be 0-100" };
  if (opts.feather < 0 || opts.feather > 100) return { error: "Feather must be 0-100" };
  if (opts.offsetX < -0.5 || opts.offsetX > 0.5) return { error: "offsetX must be -0.5..0.5" };
  if (opts.offsetY < -0.5 || opts.offsetY > 0.5) return { error: "offsetY must be -0.5..0.5" };
  if (!["circle", "ellipse"].includes(opts.shape)) return { error: "Invalid shape" };
  if (opts.color.some((c) => c < 0 || c > 255)) return { error: "Color must be 0..255" };
  if (!["multiply", "screen", "overlay"].includes(opts.blend)) return { error: "Invalid blend mode" };
  return { ok: true };
}

/** True when options produce a no-op. */
export function isIdentity(opts: VignetteOptions): boolean {
  return opts.amount === 0;
}

/** Batch-validate a list of files. */
export function batchValidate(files: { name: string }[], opts: VignetteOptions): { name: string; result: { ok: true } | { error: string } }[] {
  return files.map((f) => ({ name: f.name, result: validateVignetteOptions(opts) }));
}

/** Format-preserving transparency check. */
export function preservesAlpha(format: OutputFormat): boolean {
  return format === "image/png" || format === "image/webp";
}

/** ITU-R BT.601 luma. */
export function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
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

/** Presets. */
export const PRESETS: { id: string; label: string; options: Omit<VignetteOptions, "offsetX" | "offsetY" | "color"> & { color: [number, number, number] } }[] = [
  { id: "classic", label: "Classic", options: { amount: 80, size: 20, feather: 60, shape: "ellipse", blend: "multiply", color: [0, 0, 0] } },
  { id: "soft", label: "Soft", options: { amount: 50, size: 30, feather: 80, shape: "ellipse", blend: "multiply", color: [0, 0, 0] } },
  { id: "harsh", label: "Harsh", options: { amount: 100, size: 10, feather: 20, shape: "circle", blend: "multiply", color: [0, 0, 0] } },
  { id: "inverted", label: "Inverted (light)", options: { amount: 70, size: 20, feather: 50, shape: "ellipse", blend: "screen", color: [255, 255, 255] } },
  { id: "warm", label: "Warm glow", options: { amount: 60, size: 30, feather: 70, shape: "ellipse", blend: "overlay", color: [120, 80, 40] } },
];

export function findPreset(id: string) {
  return PRESETS.find((p) => p.id === id);
}
