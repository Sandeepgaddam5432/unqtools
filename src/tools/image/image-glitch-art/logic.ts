/**
 * Image Glitch Art — pure functions for glitch parameters and pixel ops.
 */
export type GlitchMode = "pixel-sort" | "channel-shift" | "datamosh";

export interface GlitchParams {
  mode: GlitchMode;
  /** 0-100 — intensity of the effect. */
  intensity: number;
  /** 0-100 — pixel shift amount in pixels for channel-shift / datamosh. */
  shift: number;
  /** Seed for deterministic randomness. */
  seed: number;
}

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
  if (!["pixel-sort", "channel-shift", "datamosh"].includes(p.mode)) {
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
