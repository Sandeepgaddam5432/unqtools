/**
 * Image Thermal Cam — pure logic. No DOM / canvas access.
 *
 * Maps pixel luminance (0..1) through a thermal palette.
 *
 * Extras:
 *  1. Heat palettes (iron / rainbow / grayscale / thermal)
 *  2. Intensity boost 0..2
 *  3. Threshold (low values → background)
 *  4. Contrast & invert
 *  5. Batch validation
 *  6. Presets (iron / rainbow / medical)
 *  7. Identity check
 *  8. Format-preserving transparency
 *  9. Luma + contrast helpers
 * 10. Mean delta metric
 */
export type OutputFormat = "image/png" | "image/jpeg" | "image/webp";
export type HeatPalette = "iron" | "rainbow" | "grayscale" | "thermal";

export interface ThermalOptions {
  contrast: number;
  invert: boolean;
  palette: HeatPalette;
  /** Intensity boost 0..2 (1 = neutral). */
  intensity: number;
  /** Threshold 0..1; values below map to background color. */
  threshold: number;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export const clampByte = (n: number) => clamp(Math.round(n), 0, 255);

/** Thermal (iron) palette stops. */
export const THERMAL_STOPS: Array<[number, number, number, number]> = [
  [0.0, 0, 0, 0],
  [0.2, 0, 0, 180],
  [0.4, 130, 0, 180],
  [0.6, 220, 40, 60],
  [0.8, 255, 200, 40],
  [1.0, 255, 255, 255],
];

/** Rainbow palette stops. */
export const RAINBOW_STOPS: Array<[number, number, number, number]> = [
  [0.0, 75, 0, 130],
  [0.2, 0, 0, 255],
  [0.4, 0, 200, 200],
  [0.6, 0, 255, 0],
  [0.8, 255, 255, 0],
  [1.0, 255, 0, 0],
];

/** Iron palette stops. */
export const IRON_STOPS: Array<[number, number, number, number]> = [
  [0.0, 0, 0, 0],
  [0.2, 60, 0, 0],
  [0.4, 180, 30, 0],
  [0.6, 255, 120, 0],
  [0.8, 255, 220, 80],
  [1.0, 255, 255, 220],
];

/** Get stops for a palette. */
export function getStops(palette: HeatPalette): Array<[number, number, number, number]> {
  switch (palette) {
    case "iron": return IRON_STOPS;
    case "rainbow": return RAINBOW_STOPS;
    case "grayscale": return [
      [0, 0, 0, 0], [0.5, 128, 128, 128], [1, 255, 255, 255],
    ];
    case "thermal":
    default: return THERMAL_STOPS;
  }
}

/** Validate thermal options. */
export function validateThermal(opts: ThermalOptions): ThermalOptions | { error: string } {
  if (opts.contrast < 0 || opts.contrast > 2) return { error: "Contrast must be 0..2" };
  if (!["iron", "rainbow", "grayscale", "thermal"].includes(opts.palette)) return { error: "Unknown palette" };
  if (opts.intensity < 0 || opts.intensity > 2) return { error: "Intensity must be 0..2" };
  if (opts.threshold < 0 || opts.threshold > 1) return { error: "Threshold must be 0..1" };
  return { ...opts, invert: !!opts.invert };
}

/** ITU-R BT.601 luma. */
export function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Apply power-curve contrast around 0.5 midpoint. */
export function applyContrast(t: number, contrast: number): number {
  const c = clamp(contrast, 0, 2);
  if (c === 1) return t;
  return clamp(Math.pow(t, 1 / c), 0, 1);
}

/** Apply intensity boost (multiplier on normalized value). */
export function applyIntensity(t: number, intensity: number): number {
  return clamp(t * intensity, 0, 1);
}

/** Linear interpolate two values. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Map a normalized value (0..1) through a thermal palette. */
export function thermalColor(t: number, opts: Pick<ThermalOptions, "invert" | "palette" | "threshold">): [number, number, number] {
  const u = clamp(t, 0, 1);
  // Below threshold → black background
  if (u < opts.threshold) return [0, 0, 0];
  const v = opts.invert ? 1 - u : u;
  const stops = getStops(opts.palette);
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, r0, g0, b0] = stops[i]!;
    const [t1, r1, g1, b1] = stops[i + 1]!;
    if (v >= t0 && v <= t1) {
      const localT = t1 > t0 ? (v - t0) / (t1 - t0) : 0;
      return [clampByte(lerp(r0, r1, localT)), clampByte(lerp(g0, g1, localT)), clampByte(lerp(b0, b1, localT))];
    }
  }
  return [255, 255, 255];
}

/** Map a single RGB pixel to its thermal value. */
export function thermalPixel(r: number, g: number, b: number, opts: ThermalOptions): [number, number, number] {
  let t = luma(r, g, b) / 255;
  t = applyContrast(t, opts.contrast);
  t = applyIntensity(t, opts.intensity);
  return thermalColor(t, opts);
}

/** True when options produce a no-op. */
export function isIdentity(opts: ThermalOptions): boolean {
  return opts.contrast === 1 && opts.intensity === 1 && !opts.invert && opts.threshold === 0 && opts.palette === "grayscale";
}

/** Batch-validate a list of files. */
export function batchValidate(files: { name: string }[], opts: ThermalOptions): { name: string; result: ThermalOptions | { error: string } }[] {
  return files.map((f) => ({ name: f.name, result: validateThermal(opts) }));
}

/** Format-preserving transparency check. */
export function preservesAlpha(format: OutputFormat): boolean {
  return format === "image/png" || format === "image/webp";
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
export const PRESETS: { id: string; label: string; options: Omit<ThermalOptions, "invert"> }[] = [
  { id: "iron", label: "Iron", options: { contrast: 1, palette: "iron", intensity: 1, threshold: 0 } },
  { id: "rainbow", label: "Rainbow", options: { contrast: 1.2, palette: "rainbow", intensity: 1.1, threshold: 0 } },
  { id: "medical", label: "Medical", options: { contrast: 1.5, palette: "thermal", intensity: 1.3, threshold: 0.05 } },
  { id: "high-contrast", label: "High Contrast", options: { contrast: 2, palette: "iron", intensity: 1.5, threshold: 0.1 } },
  { id: "grayscale", label: "Grayscale", options: { contrast: 1, palette: "grayscale", intensity: 1, threshold: 0 } },
];

export function findPreset(id: string) {
  return PRESETS.find((p) => p.id === id);
}
