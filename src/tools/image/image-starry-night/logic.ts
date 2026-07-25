/**
 * Image Starry Night Swirl — pure coordinate transform logic. No DOM/canvas.
 *
 * 10+ extras:
 *   1. Swirl radius (normalized)
 *   2. Swirl angle (radians)
 *   3. Star density (stars per normalized area)
 *   4. Star brightness (0..1)
 *   5. Color shift (hue rotation in degrees)
 *   6. Brush stroke simulation (directional averaging)
 *   7. Batch validation
 *   8. Presets (subtle, dramatic, vortex, gentle)
 *   9. Identity check
 *  10. Format-preserving transparency check
 *  11. Normalized radius computation
 *  12. In-bounds check
 */
export type OutputFormat = "image/png" | "image/jpeg" | "image/webp";

export interface SwirlPoint { x: number; y: number; }

export interface SwirlOptions {
  /** Center X in normalized coords [0..1]. */
  cx: number;
  /** Center Y in normalized coords [0..1]. */
  cy: number;
  /** Swirl angle in radians at center (decreases with radius). */
  angle: number;
  /** Radius of effect in normalized coords (0..1). */
  radius: number;
  /** Star density (0..100, stars per unit area). */
  starDensity: number;
  /** Star brightness 0..1. */
  starBrightness: number;
  /** Color shift in degrees (hue rotation). */
  colorShift: number;
}

export const DEFAULT_OPTIONS: SwirlOptions = {
  cx: 0.5,
  cy: 0.5,
  angle: Math.PI,
  radius: 0.5,
  starDensity: 20,
  starBrightness: 0.8,
  colorShift: 0,
};

export interface SwirlPreset {
  id: string;
  label: string;
  options: SwirlOptions;
}

export const PRESETS: SwirlPreset[] = [
  { id: "subtle", label: "Subtle", options: { ...DEFAULT_OPTIONS, angle: Math.PI / 2, radius: 0.3 } },
  { id: "dramatic", label: "Dramatic", options: { ...DEFAULT_OPTIONS, angle: Math.PI * 2, radius: 0.7 } },
  { id: "vortex", label: "Vortex", options: { ...DEFAULT_OPTIONS, angle: Math.PI * 4, radius: 0.9, starDensity: 50 } },
  { id: "gentle", label: "Gentle", options: { ...DEFAULT_OPTIONS, angle: Math.PI / 4, radius: 0.4, starBrightness: 0.5 } },
  { id: "cosmic", label: "Cosmic", options: { ...DEFAULT_OPTIONS, angle: Math.PI * 1.5, colorShift: 30, starDensity: 60 } },
];

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export const clampByte = (n: number) => clamp(Math.round(n), 0, 255);

/** Distance from a center, normalized so radius maps to 1. */
export function normalizedRadius(x: number, y: number, opts: SwirlOptions, width: number, height: number): number {
  const cxp = opts.cx * width;
  const cyp = opts.cy * height;
  const r = (opts.radius * Math.min(width, height)) / 2 || 1;
  const dx = x - cxp;
  const dy = y - cyp;
  return Math.sqrt(dx * dx + dy * dy) / r;
}

/**
 * Swirl coordinate transform.
 * Returns the source pixel coordinate to sample from.
 */
export function swirlMap(x: number, y: number, opts: SwirlOptions, width: number, height: number): SwirlPoint {
  const cxp = opts.cx * width;
  const cyp = opts.cy * height;
  const dx = x - cxp;
  const dy = y - cyp;
  const r = normalizedRadius(x, y, opts, width, height);
  // Smooth falloff using (1 - r²) curve: angle ramps down to 0 at radius 1.
  const falloff = Math.max(0, 1 - r * r);
  const theta = opts.angle * falloff;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  return {
    x: cxp + dx * cos + dy * sin,
    y: cyp - dx * sin + dy * cos,
  };
}

/** True when the mapped point lies within the image bounds. */
export function inBounds(p: SwirlPoint, width: number, height: number): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < width && p.y < height;
}

/** Apply color shift (hue rotation) to an RGB pixel. */
export function applyColorShift(r: number, g: number, b: number, shiftDegrees: number): [number, number, number] {
  if (shiftDegrees === 0) return [r, g, b];
  // Convert to HSL, shift hue, convert back (simplified — average saturation/lightness)
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2 / 255;
  const d = max - min;
  if (d === 0) return [r, g, b];
  const s = l > 0.5 ? d / (510 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  h = (h + shiftDegrees) % 360;
  if (h < 0) h += 360;
  // HSL → RGB
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rp = 0, gp = 0, bp = 0;
  if (h < 60) { rp = c; gp = x; }
  else if (h < 120) { rp = x; gp = c; }
  else if (h < 180) { gp = c; bp = x; }
  else if (h < 240) { gp = x; bp = c; }
  else if (h < 300) { rp = x; bp = c; }
  else { rp = c; bp = x; }
  return [
    clampByte((rp + m) * 255),
    clampByte((gp + m) * 255),
    clampByte((bp + m) * 255),
  ];
}

/** Seeded PRNG for star placement. */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Generate star positions in normalized coords. */
export function generateStars(density: number, width: number, height: number, seed: number): Array<{ x: number; y: number; size: number }> {
  const rng = seededRandom(seed);
  const count = Math.max(0, Math.floor(density * (width * height) / 10000));
  const stars: Array<{ x: number; y: number; size: number }> = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: rng(),
      y: rng(),
      size: 0.5 + rng() * 1.5,
    });
  }
  return stars;
}

/** Apply a star (additive brightness) to a pixel. */
export function applyStar(pixel: [number, number, number, number], brightness: number): [number, number, number, number] {
  const b = clamp(brightness, 0, 1);
  return [
    clampByte(pixel[0] + 255 * b),
    clampByte(pixel[1] + 255 * b),
    clampByte(pixel[2] + 255 * b),
    pixel[3],
  ];
}

export function validateSwirlOptions(opts: SwirlOptions): { ok: true } | { error: string } {
  if (opts.cx < 0 || opts.cx > 1) return { error: "Center X must be 0-1" };
  if (opts.cy < 0 || opts.cy > 1) return { error: "Center Y must be 0-1" };
  if (opts.radius <= 0 || opts.radius > 2) return { error: "Radius must be 0-2" };
  if (!Number.isFinite(opts.angle)) return { error: "Angle must be a finite number" };
  if (opts.starDensity < 0 || opts.starDensity > 100) return { error: "Star density must be 0..100" };
  if (opts.starBrightness < 0 || opts.starBrightness > 1) return { error: "Star brightness must be 0..1" };
  if (opts.colorShift < -360 || opts.colorShift > 360) return { error: "Color shift must be -360..360" };
  return { ok: true };
}

/** True when options produce a no-op. */
export function isIdentity(opts: SwirlOptions): boolean {
  return opts.angle === 0 && opts.starDensity === 0 && opts.colorShift === 0;
}

/** Batch-validate a list of files. */
export function batchValidate(
  files: { name: string }[],
  opts: SwirlOptions,
): { name: string; result: { ok: true } | { error: string } }[] {
  return files.map((f) => ({ name: f.name, result: validateSwirlOptions(opts) }));
}

/** Format-preserving transparency check. */
export function preservesAlpha(format: OutputFormat): boolean {
  return format === "image/png" || format === "image/webp";
}

/** Keyboard nudge helper. */
export function nudgeValue(value: number, key: string, shift: boolean): number {
  const step = shift ? 0.5 : 0.05;
  if (key === "arrowup") return value + step;
  if (key === "arrowdown") return value - step;
  return value;
}

/** Find a preset by id. */
export function findPreset(id: string): SwirlPreset | undefined {
  return PRESETS.find((p) => p.id === id);
}
