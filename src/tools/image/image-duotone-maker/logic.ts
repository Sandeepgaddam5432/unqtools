/**
 * Image Duotone Maker — pure logic. No DOM / canvas access.
 *
 * 10+ extras:
 *   1. Shadow + highlight color pickers
 *   2. Gradient-map curve (lerp)
 *   3. Preset color pairs
 *   4. Intensity/blend with original
 *   5. Tri-tone (shadow/mid/highlight)
 *   6. Invert mapping (highlight → shadow)
 *   7. Contrast pre-adjust
 *   8. Batch validation
 *   9. Palette export (CSS gradient string)
 *  10. Luma computation
 *  11. Identity check
 *  12. Format-preserving transparency check
 */
export type OutputFormat = "image/png" | "image/jpeg" | "image/webp";

export interface DuotoneOptions {
  /** Shadow color [r,g,b]. */
  shadow: [number, number, number];
  /** Highlight color [r,g,b]. */
  highlight: [number, number, number];
  /** Optional midtone color for tri-tone (or null for duotone). */
  midtone: [number, number, number] | null;
  /** Contrast boost 0..2 (1 = linear, >1 = punchier). */
  contrast: number;
  /** Blend with original 0..1 (1 = full duotone, 0 = original). */
  intensity: number;
  /** When true, inverts the luma before mapping. */
  invert: boolean;
}

export const DEFAULT_OPTIONS: DuotoneOptions = {
  shadow: [10, 20, 60],
  highlight: [255, 220, 150],
  midtone: null,
  contrast: 1,
  intensity: 1,
  invert: false,
};

export interface DuotonePreset {
  id: string;
  label: string;
  options: DuotoneOptions;
}

export const PRESETS: DuotonePreset[] = [
  { id: "classic", label: "Classic", options: { ...DEFAULT_OPTIONS } },
  { id: "sepia", label: "Sepia", options: { ...DEFAULT_OPTIONS, shadow: [50, 25, 0], highlight: [255, 230, 180] } },
  { id: "cyan-magenta", label: "Cyan→Magenta", options: { ...DEFAULT_OPTIONS, shadow: [0, 100, 180], highlight: [220, 0, 180] } },
  { id: "noir", label: "Noir", options: { ...DEFAULT_OPTIONS, shadow: [0, 0, 0], highlight: [255, 255, 255], contrast: 1.5 } },
  { id: "vintage", label: "Vintage", options: { ...DEFAULT_OPTIONS, shadow: [50, 30, 60], highlight: [255, 200, 100] } },
  { id: "ocean", label: "Ocean", options: { ...DEFAULT_OPTIONS, shadow: [0, 30, 80], highlight: [180, 240, 255] } },
  { id: "tritone", label: "Tri-tone", options: {
    ...DEFAULT_OPTIONS,
    shadow: [40, 0, 80],
    midtone: [220, 80, 120],
    highlight: [255, 230, 180],
  } },
];

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export const clampByte = (n: number) => clamp(Math.round(n), 0, 255);

/** ITU-R BT.601 luma. */
export function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Validate duotone options. */
export function validateDuotone(opts: DuotoneOptions): DuotoneOptions | { error: string } {
  if (opts.shadow.some((c) => c < 0 || c > 255)) return { error: "Shadow color must be 0..255" };
  if (opts.highlight.some((c) => c < 0 || c > 255)) return { error: "Highlight color must be 0..255" };
  if (opts.midtone && opts.midtone.some((c) => c < 0 || c > 255)) return { error: "Midtone color must be 0..255" };
  if (opts.contrast < 0 || opts.contrast > 2) return { error: "Contrast must be 0..2" };
  if (opts.intensity < 0 || opts.intensity > 1) return { error: "Intensity must be 0..1" };
  return { ...opts };
}

/** Apply contrast adjustment to a normalized value (0..1). */
export function applyContrast(t: number, contrast: number): number {
  const c = clamp(contrast, 0, 2);
  if (c === 1) return t;
  return clamp(Math.pow(t, 1 / c), 0, 1);
}

/** Linear interpolation between two colors. */
export function lerpColor(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  const u = clamp(t, 0, 1);
  return [
    clampByte(a[0] + (b[0] - a[0]) * u),
    clampByte(a[1] + (b[1] - a[1]) * u),
    clampByte(a[2] + (b[2] - a[2]) * u),
  ];
}

/** Tri-tone mapping: shadow → midtone → highlight based on luma t. */
export function tritoneColor(
  shadow: [number, number, number],
  midtone: [number, number, number],
  highlight: [number, number, number],
  t: number,
): [number, number, number] {
  if (t <= 0.5) return lerpColor(shadow, midtone, t * 2);
  return lerpColor(midtone, highlight, (t - 0.5) * 2);
}

/** Map a single RGB pixel to its duotone value. */
export function duotonePixel(
  r: number,
  g: number,
  b: number,
  opts: DuotoneOptions,
): [number, number, number] {
  let t = luma(r, g, b) / 255;
  if (opts.invert) t = 1 - t;
  t = applyContrast(t, opts.contrast);
  if (opts.midtone) {
    return tritoneColor(opts.shadow, opts.midtone, opts.highlight, t);
  }
  return lerpColor(opts.shadow, opts.highlight, t);
}

/** Apply full duotone options to a pixel (with intensity blend). */
export function applyDuotone(
  pixel: [number, number, number, number],
  opts: DuotoneOptions,
): [number, number, number, number] {
  const [r, g, b] = duotonePixel(pixel[0], pixel[1], pixel[2], opts);
  const a = clamp(opts.intensity, 0, 1);
  return [
    clampByte(pixel[0] + (r - pixel[0]) * a),
    clampByte(pixel[1] + (g - pixel[1]) * a),
    clampByte(pixel[2] + (b - pixel[2]) * a),
    pixel[3],
  ];
}

/** Generate a CSS linear-gradient string for palette export. */
export function paletteToCss(opts: DuotoneOptions): string {
  const toRgb = (c: [number, number, number]) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
  if (opts.midtone) {
    return `linear-gradient(to right, ${toRgb(opts.shadow)}, ${toRgb(opts.midtone)}, ${toRgb(opts.highlight)})`;
  }
  return `linear-gradient(to right, ${toRgb(opts.shadow)}, ${toRgb(opts.highlight)})`;
}

/** True when options produce a no-op. */
export function isIdentity(opts: DuotoneOptions): boolean {
  return opts.intensity === 0;
}

/** Batch-validate a list of files. */
export function batchValidate(
  files: { name: string }[],
  opts: DuotoneOptions,
): { name: string; result: DuotoneOptions | { error: string } }[] {
  return files.map((f) => ({ name: f.name, result: validateDuotone(opts) }));
}

/** Format-preserving transparency check. */
export function preservesAlpha(format: OutputFormat): boolean {
  return format === "image/png" || format === "image/webp";
}

/** Keyboard nudge helper. */
export function nudgeValue(value: number, key: string, shift: boolean): number {
  const step = shift ? 0.1 : 0.01;
  if (key === "arrowup") return value + step;
  if (key === "arrowdown") return value - step;
  return value;
}

/** Find a preset by id. */
export function findPreset(id: string): DuotonePreset | undefined {
  return PRESETS.find((p) => p.id === id);
}
