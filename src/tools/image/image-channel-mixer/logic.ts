/**
 * Image Channel Mixer — pure channel mix matrix math. No DOM/canvas access.
 */
export interface RgbPixel {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface MixMatrix {
  /** Output R = m.rr*R + m.gr*G + m.br*B */
  rr: number; gr: number; br: number;
  /** Output G = m.rg*R + m.gg*G + m.bg*B */
  rg: number; gg: number; bg: number;
  /** Output B = m.rb*R + m.gb*G + m.bb*B */
  rb: number; gb: number; bb: number;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const clampByte = (n: number) => clamp(Math.round(n), 0, 255);

/** Identity matrix (no mixing). */
export const IDENTITY_MATRIX: MixMatrix = {
  rr: 1, gr: 0, br: 0,
  rg: 0, gg: 1, bg: 0,
  rb: 0, gb: 0, bb: 1,
};

/** Swap R and B channels. */
export const SWAP_RB_MATRIX: MixMatrix = {
  rr: 0, gr: 0, br: 1,
  rg: 0, gg: 1, bg: 0,
  rb: 1, gb: 0, bb: 0,
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
  return {
    rr: 0.299, gr: 0.587, br: 0.114,
    rg: 0.299, gg: 0.587, bg: 0.114,
    rb: 0.299, gb: 0.587, bb: 0.114,
  };
}

/** Create a sepia mix matrix (scaled to avoid saturation on white). */
export function sepiaMatrix(): MixMatrix {
  return {
    rr: 0.275, gr: 0.538, br: 0.132,
    rg: 0.244, gg: 0.480, bg: 0.118,
    rb: 0.190, gb: 0.374, bb: 0.092,
  };
}

export function validateMatrix(m: MixMatrix): { ok: true } | { error: string } {
  for (const [k, v] of Object.entries(m)) {
    if (!Number.isFinite(v)) return { error: `${k} must be a finite number` };
    if (v < -2 || v > 2) return { error: `${k} must be between -2 and 2` };
  }
  return { ok: true };
}
