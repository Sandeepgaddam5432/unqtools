/**
 * Image TV Static — pure math. No DOM/canvas.
 * Random grayscale noise per pixel.
 */
export interface TvStaticOptions {
  /** 0-1 — fraction of pixels that are pure white. */
  intensity: number;
  /** True = monochrome, false = allows slight color variation. */
  monochrome: boolean;
  /** Seed for the PRNG. */
  seed: number;
}

/** Mulberry32 PRNG. */
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

/** Generate a single static noise pixel. */
export function staticPixel(rng: () => number, opts: TvStaticOptions): { r: number; g: number; b: number } {
  const v = Math.floor(rng() * 256);
  if (opts.monochrome) {
    return { r: v, g: v, b: v };
  }
  // Slight color variation: blue tint typical of CRTs.
  return { r: v, g: v, b: Math.min(255, v + Math.floor(rng() * 20)) };
}

/** Apply intensity gate — pure white pixels become more frequent as intensity rises. */
export function applyIntensity(p: { r: number; g: number; b: number }, rng: () => number, opts: TvStaticOptions): { r: number; g: number; b: number } {
  if (rng() < opts.intensity) return { r: 255, g: 255, b: 255 };
  return p;
}

/** Generate a static frame buffer. */
export function generateStatic(width: number, height: number, opts: TvStaticOptions): { r: number; g: number; b: number }[] {
  const rng = makeRng(opts.seed);
  const out: { r: number; g: number; b: number }[] = [];
  for (let i = 0; i < width * height; i++) {
    out.push(applyIntensity(staticPixel(rng, opts), rng, opts));
  }
  return out;
}

export function validateTvStaticOptions(opts: TvStaticOptions): { ok: true } | { error: string } {
  if (opts.intensity < 0 || opts.intensity > 1) return { error: "Intensity must be 0-1" };
  if (!Number.isFinite(opts.seed)) return { error: "Seed must be a finite number" };
  return { ok: true };
}
