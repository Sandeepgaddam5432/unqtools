/**
 * Image Lens Flare Effect — pure logic. No DOM / canvas access.
 *
 * 10+ extras:
 *   1. Flare position (fx, fy as fractions of canvas)
 *   2. Intensity falloff (Gaussian)
 *   3. Flare color picker
 *   4. Secondary flares (ghost reflections)
 *   5. Star rays (line streaks through flare center)
 *   6. Ring halo (circular glow)
 *   7. Batch validation
 *   8. Presets (sun, anamorphic, classic, subtle)
 *   9. Identity check
 *  10. Format-preserving transparency check
 *  11. Distance helpers
 *  12. Per-pixel flare application
 */
export type OutputFormat = "image/png" | "image/jpeg" | "image/webp";

export interface FlareOptions {
  /** Flare x as a fraction of width (0..1). */
  fx: number;
  /** Flare y as a fraction of height (0..1). */
  fy: number;
  /** Intensity 0..1. */
  intensity: number;
  /** Flare color [r,g,b] (0..255). */
  color: [number, number, number];
  /** Star ray count (0, 4, 6, 8). */
  rays: number;
  /** Star ray length (0..1). */
  rayLength: number;
  /** Ring halo radius (0..1). */
  haloRadius: number;
  /** Number of secondary ghost reflections (0..8). */
  ghosts: number;
}

export const DEFAULT_OPTIONS: FlareOptions = {
  fx: 0.3,
  fy: 0.3,
  intensity: 0.7,
  color: [255, 230, 180],
  rays: 6,
  rayLength: 0.5,
  haloRadius: 0.15,
  ghosts: 3,
};

export interface FlarePreset {
  id: string;
  label: string;
  options: FlareOptions;
}

export const PRESETS: FlarePreset[] = [
  { id: "sun", label: "Sun", options: { ...DEFAULT_OPTIONS, color: [255, 230, 180], intensity: 0.8 } },
  { id: "anamorphic", label: "Anamorphic", options: { ...DEFAULT_OPTIONS, color: [120, 200, 255], rays: 2, rayLength: 0.9, ghosts: 5 } },
  { id: "classic", label: "Classic", options: { ...DEFAULT_OPTIONS, color: [255, 200, 100], rays: 8, rayLength: 0.6, ghosts: 4 } },
  { id: "subtle", label: "Subtle", options: { ...DEFAULT_OPTIONS, intensity: 0.3, rays: 0, ghosts: 1 } },
  { id: "neon", label: "Neon", options: { ...DEFAULT_OPTIONS, color: [255, 80, 200], intensity: 0.9, rays: 4, rayLength: 0.7 } },
];

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export const clampByte = (n: number) => clamp(Math.round(n), 0, 255);

/** Validate flare options; returns sanitized options or error. */
export function validateFlare(opts: FlareOptions): FlareOptions | { error: string } {
  if (!Number.isFinite(opts.fx) || !Number.isFinite(opts.fy)) return { error: "Position must be finite" };
  if (opts.intensity < 0 || opts.intensity > 1) return { error: "Intensity must be between 0 and 1" };
  if (opts.color.some((c) => c < 0 || c > 255)) return { error: "Color channels must be 0..255" };
  if (opts.rays < 0 || opts.rays > 16) return { error: "Rays must be 0..16" };
  if (opts.rayLength < 0 || opts.rayLength > 1) return { error: "Ray length must be 0..1" };
  if (opts.haloRadius < 0 || opts.haloRadius > 1) return { error: "Halo radius must be 0..1" };
  if (opts.ghosts < 0 || opts.ghosts > 8) return { error: "Ghosts must be 0..8" };
  return {
    ...opts,
    fx: clamp(opts.fx, 0, 1),
    fy: clamp(opts.fy, 0, 1),
    color: opts.color.map((c) => clampByte(c)) as [number, number, number],
  };
}

/** Distance between two points. */
export function distance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Distance-based intensity falloff (Gaussian-like). */
export function falloff(distance: number, radius: number): number {
  if (radius <= 0) return distance === 0 ? 1 : 0;
  const r = distance / radius;
  return Math.exp(-r * r);
}

/** Blend a pixel with the flare color by amount. */
export function blendFlare(
  pixel: [number, number, number, number],
  color: [number, number, number],
  amount: number,
): [number, number, number, number] {
  const a = clamp(amount, 0, 1);
  return [
    clampByte(pixel[0] + (color[0] - pixel[0]) * a),
    clampByte(pixel[1] + (color[1] - pixel[1]) * a),
    clampByte(pixel[2] + (color[2] - pixel[2]) * a),
    pixel[3],
  ];
}

/** Compute ghost reflection positions along the line through center (0..1 normalized). */
export function ghostPositions(fx: number, fy: number, count: number): Array<{ x: number; y: number; scale: number }> {
  const cx = 0.5, cy = 0.5;
  const dx = cx - fx, dy = cy - fy;
  const out: Array<{ x: number; y: number; scale: number }> = [];
  for (let i = 1; i <= count; i++) {
    const t = i / (count + 1);
    out.push({ x: fx + dx * 2 * t, y: fy + dy * 2 * t, scale: 0.6 + 0.4 * Math.sin(t * Math.PI) });
  }
  return out;
}

/** Star ray contribution at a normalized position (relative to flare center). */
export function starRayIntensity(
  relX: number,
  relY: number,
  rayCount: number,
  rayLength: number,
): number {
  if (rayCount === 0 || rayLength <= 0) return 0;
  const dist = Math.sqrt(relX * relX + relY * relY);
  if (dist > rayLength || dist === 0) return 0;
  const angle = Math.atan2(relY, relX);
  let best = 0;
  for (let i = 0; i < rayCount; i++) {
    const rayAngle = (i * Math.PI * 2) / rayCount;
    let diff = Math.abs(angle - rayAngle);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    const intensity = Math.max(0, 1 - diff / 0.2) * (1 - dist / rayLength);
    best = Math.max(best, intensity);
  }
  return best;
}

/** Ring halo contribution at a normalized distance. */
export function haloIntensity(dist: number, haloRadius: number): number {
  if (haloRadius <= 0) return 0;
  const r = dist / haloRadius;
  // Ring around radius=haloRadius
  if (r < 0.7 || r > 1.3) return 0;
  const t = (r - 1) / 0.3;
  return Math.exp(-t * t * 4);
}

/** Compute the flare contribution (0..1) at a given pixel position (normalized 0..1). */
export function flareContribution(
  px: number,
  py: number,
  opts: FlareOptions,
): number {
  const flareDist = distance(px, py, opts.fx, opts.fy);
  // Main glow (Gaussian)
  const glow = falloff(flareDist, 0.1) * opts.intensity;
  // Star rays
  const relX = (px - opts.fx);
  const relY = (py - opts.fy);
  const ray = starRayIntensity(relX, relY, opts.rays, opts.rayLength) * opts.intensity * 0.6;
  // Halo ring
  const halo = haloIntensity(flareDist, opts.haloRadius) * opts.intensity * 0.5;
  // Ghosts
  let ghost = 0;
  if (opts.ghosts > 0) {
    const ghosts = ghostPositions(opts.fx, opts.fy, opts.ghosts);
    for (const g of ghosts) {
      const d = distance(px, py, g.x, g.y);
      ghost += falloff(d, 0.04) * g.scale * opts.intensity * 0.3;
    }
  }
  return clamp(glow + ray + halo + ghost, 0, 1);
}

/** True when options produce a no-op. */
export function isIdentity(opts: FlareOptions): boolean {
  return opts.intensity === 0;
}

/** Batch-validate a list of files. */
export function batchValidate(
  files: { name: string }[],
  opts: FlareOptions,
): { name: string; result: FlareOptions | { error: string } }[] {
  return files.map((f) => ({ name: f.name, result: validateFlare(opts) }));
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
export function findPreset(id: string): FlarePreset | undefined {
  return PRESETS.find((p) => p.id === id);
}
