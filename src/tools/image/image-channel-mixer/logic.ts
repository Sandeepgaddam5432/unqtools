/**
 * Image Channel Mixer — pure channel mix matrix math. No DOM/canvas access.
 *
 * Extras:
 *  1. 3x3 mix matrix (R/G/B → R/G/B)
 *  2. Per-output channel control (R, G, B)
 *  3. Presets: identity / swap RB / swap RG / swap GB / grayscale / sepia / invert / zero R / zero G / zero B
 *  4. Batch validation
 *  5. Format-preserving transparency check
 *  6. Mean delta metric
 *  7. Identity detection
 *  8. Luma helper
 *  9. Channel extraction
 * 10. Matrix arithmetic (add, scale)
 * 11. Per-channel mixer API
 */
export type OutputFormat = "image/png" | "image/jpeg" | "image/webp";

export interface RgbPixel {
  r: number; g: number; b: number; a: number;
}

export interface MixMatrix {
  rr: number; gr: number; br: number;
  rg: number; gg: number; bg: number;
  rb: number; gb: number; bb: number;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
export const clampByte = (n: number) => clamp(Math.round(n), 0, 255);

/** Identity matrix (no mixing). */
export const IDENTITY_MATRIX: MixMatrix = {
  rr: 1, gr: 0, br: 0, rg: 0, gg: 1, bg: 0, rb: 0, gb: 0, bb: 1,
};

/** Swap R and B channels. */
export const SWAP_RB_MATRIX: MixMatrix = {
  rr: 0, gr: 0, br: 1, rg: 0, gg: 1, bg: 0, rb: 1, gb: 0, bb: 0,
};

/** Swap R and G channels. */
export const SWAP_RG_MATRIX: MixMatrix = {
  rr: 0, gr: 1, br: 0, rg: 1, gg: 0, bg: 0, rb: 0, gb: 0, bb: 1,
};

/** Swap G and B channels. */
export const SWAP_GB_MATRIX: MixMatrix = {
  rr: 1, gr: 0, br: 0, rg: 0, gg: 0, bg: 1, rb: 0, gb: 1, bb: 0,
};

/** Invert all channels. */
export const INVERT_MATRIX: MixMatrix = {
  rr: -1, gr: 0, br: 0, rg: 0, gg: -1, bg: 0, rb: 0, gb: 0, bb: -1,
};

/** Zero out red channel. */
export const ZERO_R_MATRIX: MixMatrix = {
  rr: 0, gr: 0, br: 0, rg: 0, gg: 1, bg: 0, rb: 0, gb: 0, bb: 1,
};

/** Zero out green channel. */
export const ZERO_G_MATRIX: MixMatrix = {
  rr: 1, gr: 0, br: 0, rg: 0, gg: 0, bg: 0, rb: 0, gb: 0, bb: 1,
};

/** Zero out blue channel. */
export const ZERO_B_MATRIX: MixMatrix = {
  rr: 1, gr: 0, br: 0, rg: 0, gg: 1, bg: 0, rb: 0, gb: 0, bb: 0,
};

/** Apply a mix matrix to a single pixel. */
export function mixPixel(pixel: RgbPixel, m: MixMatrix): RgbPixel {
  const { r, g, b, a } = pixel;
  return {
    r: clampByte(m.rr * r + m.gr * g + m.br * b),
    g: clampByte(m.rg * r + m.gg * g + m.bg * b),
    b: clampByte(m.rb * r + m.gb * g + m.bb * b),
    a,
  };
}

/** Create a grayscale mix matrix using BT.601 weights. */
export function grayscaleMatrix(): MixMatrix {
  return { rr: 0.299, gr: 0.587, br: 0.114, rg: 0.299, gg: 0.587, bg: 0.114, rb: 0.299, gb: 0.587, bb: 0.114 };
}

/** Create a sepia mix matrix (scaled to avoid saturation on white). */
export function sepiaMatrix(): MixMatrix {
  return { rr: 0.275, gr: 0.538, br: 0.132, rg: 0.244, gg: 0.480, bg: 0.118, rb: 0.190, gb: 0.374, bb: 0.092 };
}

/** Create a per-output-channel mixer: scale a specific output channel. */
export function scaleOutputChannel(channel: "r" | "g" | "b", scale: number): MixMatrix {
  const m: MixMatrix = { ...IDENTITY_MATRIX };
  if (channel === "r") { m.rr = scale; m.gr = 0; m.br = 0; }
  else if (channel === "g") { m.rg = 0; m.gg = scale; m.bg = 0; }
  else { m.rb = 0; m.gb = 0; m.bb = scale; }
  return m;
}

/** Combine two matrices by adding their coefficients. */
export function addMatrices(a: MixMatrix, b: MixMatrix): MixMatrix {
  const keys = ["rr", "gr", "br", "rg", "gg", "bg", "rb", "gb", "bb"] as const;
  const out = {} as MixMatrix;
  for (const k of keys) out[k] = a[k] + b[k];
  return out;
}

/** Scale all matrix coefficients by a factor. */
export function scaleMatrix(m: MixMatrix, scale: number): MixMatrix {
  const keys = ["rr", "gr", "br", "rg", "gg", "bg", "rb", "gb", "bb"] as const;
  const out = {} as MixMatrix;
  for (const k of keys) out[k] = m[k] * scale;
  return out;
}

/** Extract a single channel from a pixel as a grayscale pixel. */
export function extractChannel(pixel: RgbPixel, channel: "r" | "g" | "b"): RgbPixel {
  const v = pixel[channel];
  return { r: v, g: v, b: v, a: pixel.a };
}

export function validateMatrix(m: MixMatrix): { ok: true } | { error: string } {
  for (const [k, v] of Object.entries(m)) {
    if (!Number.isFinite(v)) return { error: `${k} must be a finite number` };
    if (v < -2 || v > 2) return { error: `${k} must be between -2 and 2` };
  }
  return { ok: true };
}

/** True when matrix is identity (no mixing). */
export function isIdentity(m: MixMatrix): boolean {
  return m.rr === 1 && m.gg === 1 && m.bb === 1 && m.gr === 0 && m.br === 0 && m.rg === 0 && m.bg === 0 && m.rb === 0 && m.gb === 0;
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

/** Batch-validate a list of files. */
export function batchValidate(files: { name: string }[], m: MixMatrix): { name: string; result: { ok: true } | { error: string } }[] {
  return files.map((f) => ({ name: f.name, result: validateMatrix(m) }));
}

/** Format-preserving transparency check. */
export function preservesAlpha(format: OutputFormat): boolean {
  return format === "image/png" || format === "image/webp";
}

/** Mixer presets registry. */
export const MATRIX_PRESETS: { id: string; label: string; matrix: MixMatrix }[] = [
  { id: "identity", label: "Identity", matrix: IDENTITY_MATRIX },
  { id: "swap-rb", label: "Swap R/B", matrix: SWAP_RB_MATRIX },
  { id: "swap-rg", label: "Swap R/G", matrix: SWAP_RG_MATRIX },
  { id: "swap-gb", label: "Swap G/B", matrix: SWAP_GB_MATRIX },
  { id: "grayscale", label: "Grayscale", matrix: grayscaleMatrix() },
  { id: "sepia", label: "Sepia", matrix: sepiaMatrix() },
  { id: "invert", label: "Invert", matrix: INVERT_MATRIX },
  { id: "zero-r", label: "Zero R", matrix: ZERO_R_MATRIX },
  { id: "zero-g", label: "Zero G", matrix: ZERO_G_MATRIX },
  { id: "zero-b", label: "Zero B", matrix: ZERO_B_MATRIX },
];

export function findPreset(id: string) {
  return MATRIX_PRESETS.find((p) => p.id === id);
}
