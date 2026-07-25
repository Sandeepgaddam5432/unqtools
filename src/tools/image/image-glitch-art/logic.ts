/**
 * Image Glitch Art — pure functions for glitch parameters and pixel ops.
 *
 * 10+ extras:
 *   1. RGB channel shift
 *   2. Pixel sort (by brightness)
 *   3. Scanlines overlay
 *   4. Slice displacement (horizontal row shifting)
 *   5. VHS noise
 *   6. Byte corruption (random byte flips)
 *   7. Deterministic seed (PRNG)
 *   8. Per-effect intensity
 *   9. Effect stacking (combined)
 *  10. Presets (vhs, datamosh, sort, corruption, scanlines)
 *  11. Batch validation
 *  12. Format-preserving transparency check
 */
export type OutputFormat = "image/png" | "image/jpeg" | "image/webp";

export type GlitchMode = "pixel-sort" | "channel-shift" | "datamosh" | "scanlines" | "vhs" | "byte-corrupt";

export interface GlitchParams {
  mode: GlitchMode;
  /** 0-100 — intensity of the effect. */
  intensity: number;
  /** 0-100 — pixel shift amount in pixels for channel-shift / datamosh. */
  shift: number;
  /** Seed for deterministic randomness. */
  seed: number;
  /** When true, all effects stack together. */
  stack: boolean;
}

export const DEFAULT_PARAMS: GlitchParams = {
  mode: "channel-shift",
  intensity: 50,
  shift: 20,
  seed: 1,
  stack: false,
};

export interface GlitchPreset {
  id: string;
  label: string;
  params: GlitchParams;
}

export const PRESETS: GlitchPreset[] = [
  { id: "vhs", label: "VHS", params: { ...DEFAULT_PARAMS, mode: "vhs", intensity: 60, shift: 10 } },
  { id: "datamosh", label: "Datamosh", params: { ...DEFAULT_PARAMS, mode: "datamosh", intensity: 80, shift: 30 } },
  { id: "sort", label: "Pixel sort", params: { ...DEFAULT_PARAMS, mode: "pixel-sort", intensity: 70 } },
  { id: "corrupt", label: "Byte corrupt", params: { ...DEFAULT_PARAMS, mode: "byte-corrupt", intensity: 40 } },
  { id: "scanlines", label: "Scanlines", params: { ...DEFAULT_PARAMS, mode: "scanlines", intensity: 50 } },
  { id: "stacked", label: "Stacked", params: { ...DEFAULT_PARAMS, stack: true, intensity: 40 } },
];

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export const clampByte = (n: number) => clamp(Math.round(n), 0, 255);

/** Simple seeded PRNG (mulberry32). Returns a function yielding [0,1). */
export function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function validateGlitchParams(p: GlitchParams): { ok: true } | { error: string } {
  const validModes: GlitchMode[] = ["pixel-sort", "channel-shift", "datamosh", "scanlines", "vhs", "byte-corrupt"];
  if (!validModes.includes(p.mode)) {
    return { error: "Unknown glitch mode" };
  }
  if (p.intensity < 0 || p.intensity > 100) return { error: "Intensity must be 0-100" };
  if (p.shift < 0 || p.shift > 100) return { error: "Shift must be 0-100" };
  if (!Number.isFinite(p.seed)) return { error: "Seed must be a number" };
  return { ok: true };
}

/** ITU-R BT.601 luma of an RGB triple. */
export function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Generate a list of row ranges to swap for datamosh, given height and intensity. */
export function datamoshBlocks(height: number, intensity: number, rng: () => number): Array<{ y0: number; y1: number; dy: number }> {
  const out: Array<{ y0: number; y1: number; dy: number }> = [];
  const count = Math.max(1, Math.round((intensity / 100) * 20));
  for (let i = 0; i < count; i++) {
    const y0 = Math.floor(rng() * height);
    const len = 1 + Math.floor(rng() * 10);
    const dy = Math.floor((rng() - 0.5) * (intensity / 100) * 40);
    out.push({ y0: Math.max(0, y0), y1: Math.min(height, y0 + len), dy });
  }
  return out;
}

/** Compute channel shift offsets in pixels for r, g, b channels. */
export function channelShiftOffsets(shift: number, rng: () => number): { r: number; g: number; b: number } {
  const s = (n: number) => Math.floor((rng() - 0.5) * 2 * n);
  return { r: s(shift), g: s(shift), b: s(shift) };
}

/** Pixel sort comparator by brightness descending. */
export function sortByBrightness(a: [number, number, number], b: [number, number, number]): number {
  return luma(b[0], b[1], b[2]) - luma(a[0], a[1], a[2]);
}

/** Generate scanline intensity (0..1) for a given y-coordinate. */
export function scanlineIntensity(y: number, intensity: number): number {
  if (y % 2 === 0) return 1; // even rows unaffected
  return 1 - (intensity / 100) * 0.5;
}

/** Apply VHS noise to a pixel value. */
export function vhsNoise(value: number, noise: number, intensity: number): number {
  const i = intensity / 100;
  return clampByte(value + (noise - 0.5) * 60 * i);
}

/** Byte corruption: randomly flip a fraction of bytes. */
export function corruptByte(value: number, rng: () => number, intensity: number): number {
  const i = intensity / 100;
  if (rng() < i * 0.1) {
    return clampByte(value ^ (1 << Math.floor(rng() * 8)));
  }
  return value;
}

/** Compute slice displacements: for each row, a horizontal shift. */
export function sliceDisplacements(height: number, shift: number, intensity: number, rng: () => number): Int16Array {
  const out = new Int16Array(height);
  const count = Math.max(1, Math.round((intensity / 100) * 20));
  for (let i = 0; i < count; i++) {
    const y0 = Math.floor(rng() * height);
    const len = 1 + Math.floor(rng() * 20);
    const dx = Math.floor((rng() - 0.5) * shift * 2);
    for (let y = y0; y < Math.min(height, y0 + len); y++) {
      out[y] = dx;
    }
  }
  return out;
}

/** True when params produce a no-op. */
export function isIdentity(p: GlitchParams): boolean {
  return p.intensity === 0 && p.shift === 0;
}

/** Batch-validate a list of files. */
export function batchValidate(
  files: { name: string }[],
  params: GlitchParams,
): { name: string; result: { ok: true } | { error: string } }[] {
  return files.map((f) => ({ name: f.name, result: validateGlitchParams(params) }));
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
export function findPreset(id: string): GlitchPreset | undefined {
  return PRESETS.find((p) => p.id === id);
}
