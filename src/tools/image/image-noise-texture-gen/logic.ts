/**
 * Noise Texture Generator — pure logic.
 * Implements Perlin, Simplex, and Value noise with configurable frequency,
 * octaves, persistence, lacunarity, seed, and size. Includes a seeded PRNG.
 */

export type NoiseType = "perlin" | "simplex" | "value";

export interface NoiseParams {
  type: NoiseType;
  width: number;
  height: number;
  frequency: number; // base frequency (cycles per image)
  octaves: number; // 1..8
  persistence: number; // amplitude falloff per octave (0..1)
  lacunarity: number; // frequency multiplier per octave (≥1)
  seed: number;
  threshold?: number; // 0..1, optional clip
  invert?: boolean;
}

export const DEFAULT_PARAMS: NoiseParams = {
  type: "perlin",
  width: 256,
  height: 256,
  frequency: 4,
  octaves: 4,
  persistence: 0.5,
  lacunarity: 2,
  seed: 1337,
};

/** Mulberry32 seeded PRNG. Returns a function producing floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fade function for Perlin noise (6t^5 - 15t^4 + 10t^3). */
export function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Linear interpolation. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Build a permutation table from a seed. */
export function buildPermutation(seed: number): Uint8Array {
  const rng = mulberry32(seed);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  // Fisher-Yates shuffle
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  // Duplicate to avoid wraparound
  const out = new Uint8Array(512);
  for (let i = 0; i < 512; i++) out[i] = p[i & 255];
  return out;
}

/** Gradient hash for Perlin 2D. */
function grad(hash: number, x: number, y: number): number {
  const h = hash & 7;
  const u = h < 4 ? x : y;
  const v = h < 4 ? y : x;
  return ((h & 1) ? -u : u) + ((h & 2) ? -2 * v : 2 * v);
}

/** 2D Perlin noise at (x, y) using a permutation table. Returns [-1, 1]. */
export function perlin2(p: Uint8Array, x: number, y: number): number {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const u = fade(xf);
  const v = fade(yf);
  const aa = p[p[X] + Y];
  const ab = p[p[X] + Y + 1];
  const ba = p[p[X + 1] + Y];
  const bb = p[p[X + 1] + Y + 1];
  const x1 = lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u);
  const x2 = lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u);
  return lerp(x1, x2, v);
}

/** 2D Simplex noise (approximation via skew). Returns [-1, 1]. */
export function simplex2(p: Uint8Array, x: number, y: number): number {
  // Simplex 2D uses skew to determine triangle cell
  const F2 = 0.5 * (Math.sqrt(3) - 1);
  const G2 = (3 - Math.sqrt(3)) / 6;
  const s = (x + y) * F2;
  const i = Math.floor(x + s);
  const j = Math.floor(y + s);
  const t = (i + j) * G2;
  const X0 = i - t;
  const Y0 = j - t;
  const x0 = x - X0;
  const y0 = y - Y0;
  let i1: number, j1: number;
  if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
  const x1 = x0 - i1 + G2;
  const y1 = y0 - j1 + G2;
  const x2 = x0 - 1 + 2 * G2;
  const y2 = y0 - 1 + 2 * G2;
  const ii = i & 255;
  const jj = j & 255;
  const gi0 = p[ii + p[jj]] % 12;
  const gi1 = p[ii + i1 + p[jj + j1]] % 12;
  const gi2 = p[ii + 1 + p[jj + 1]] % 12;
  const grad3 = [
    [1, 1], [-1, 1], [1, -1], [-1, -1],
    [1, 0], [-1, 0], [1, 0], [-1, 0],
    [0, 1], [0, -1], [0, 1], [0, -1],
  ];
  let n0 = 0, n1 = 0, n2 = 0;
  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 >= 0) { t0 *= t0; n0 = t0 * t0 * (grad3[gi0][0] * x0 + grad3[gi0][1] * y0); }
  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 >= 0) { t1 *= t1; n1 = t1 * t1 * (grad3[gi1][0] * x1 + grad3[gi1][1] * y1); }
  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 >= 0) { t2 *= t2; n2 = t2 * t2 * (grad3[gi2][0] * x2 + grad3[gi2][1] * y2); }
  return 70 * (n0 + n1 + n2);
}

/** 2D Value noise at (x, y). Returns [0, 1]. */
export function valueNoise2(p: Uint8Array, x: number, y: number): number {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const u = fade(xf);
  const v = fade(yf);
  const rng = (h: number) => (h & 255) / 255;
  const aa = rng(p[p[X] + Y]);
  const ab = rng(p[p[X] + Y + 1]);
  const ba = rng(p[p[X + 1] + Y]);
  const bb = rng(p[p[X + 1] + Y + 1]);
  return lerp(lerp(aa, ba, u), lerp(ab, bb, u), v);
}

/** Single-octave noise dispatch. */
export function noiseSample(type: NoiseType, p: Uint8Array, x: number, y: number): number {
  switch (type) {
    case "perlin": return (perlin2(p, x, y) + 1) / 2; // map to [0,1]
    case "simplex": return (simplex2(p, x, y) + 1) / 2;
    case "value": return valueNoise2(p, x, y);
  }
}

/** Fractal Brownian motion (multi-octave noise). Returns [0, 1]. */
export function fbm(params: NoiseParams, p: Uint8Array, x: number, y: number): number {
  let total = 0;
  let amp = 1;
  let freq = params.frequency;
  let max = 0;
  for (let o = 0; o < params.octaves; o++) {
    total += noiseSample(params.type, p, x * freq, y * freq) * amp;
    max += amp;
    amp *= params.persistence;
    freq *= params.lacunarity;
  }
  return max > 0 ? total / max : 0;
}

/** Render a noise texture to RGBA pixels. Returns Uint8ClampedArray. */
export function renderNoise(params: NoiseParams): Uint8ClampedArray {
  const { width, height, seed, threshold, invert } = params;
  const p = buildPermutation(seed);
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = x / width;
      const ny = y / height;
      let v = fbm(params, p, nx, ny);
      if (threshold !== undefined) v = v >= threshold ? 1 : 0;
      if (invert) v = 1 - v;
      const c = Math.round(v * 255);
      const i = (y * width + x) * 4;
      out[i] = c;
      out[i + 1] = c;
      out[i + 2] = c;
      out[i + 3] = 255;
    }
  }
  return out;
}

/** Generate a tileable noise texture by sampling on a torus. */
export function renderTileableNoise(params: NoiseParams): Uint8ClampedArray {
  const { width, height, seed, frequency, octaves, persistence, lacunarity, type, invert } = params;
  const p = buildPermutation(seed);
  const out = new Uint8ClampedArray(width * height * 4);
  const fwx = frequency * 2 * Math.PI;
  const fhy = frequency * 2 * Math.PI;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = (Math.cos((x / width) * fwx) + 1) / 2;
      const ny = (Math.cos((y / height) * fhy) + 1) / 2;
      let v = 0;
      let amp = 1;
      let freq = 1;
      let max = 0;
      for (let o = 0; o < octaves; o++) {
        v += noiseSample(type, p, nx * freq, ny * freq) * amp;
        max += amp;
        amp *= persistence;
        freq *= lacunarity;
      }
      v = max > 0 ? v / max : 0;
      if (invert) v = 1 - v;
      const c = Math.round(v * 255);
      const i = (y * width + x) * 4;
      out[i] = c;
      out[i + 1] = c;
      out[i + 2] = c;
      out[i + 3] = 255;
    }
  }
  return out;
}

/** Compute statistics of a noise buffer. */
export function noiseStats(pixels: Uint8ClampedArray): { min: number; max: number; mean: number; std: number } {
  let min = 255, max = 0, sum = 0;
  const samples: number[] = [];
  for (let i = 0; i < pixels.length; i += 4) {
    const v = pixels[i];
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
    samples.push(v);
  }
  const mean = samples.length ? sum / samples.length : 0;
  let variance = 0;
  for (const v of samples) variance += (v - mean) ** 2;
  variance = samples.length ? variance / samples.length : 0;
  return { min, max, mean: Math.round(mean * 100) / 100, std: Math.round(Math.sqrt(variance) * 100) / 100 };
}

/** Estimate PNG byte size for a noise texture (random data compresses poorly). */
export function estimatePngBytes(width: number, height: number): number {
  const raw = width * height * 4;
  return Math.round(64 + raw / 1.8);
}

/** Format bytes. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
