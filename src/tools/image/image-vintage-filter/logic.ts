/**
 * Vintage Filter — pure logic.
 * Applies vintage photo presets (70s, faded, B&W) with grain, vignette, fade,
 * and split-tone effects to raw RGBA pixels.
 */

export type VintagePreset = "70s" | "faded" | "bw" | "sepia" | "polaroid";

export interface VintageParams {
  preset: VintagePreset;
  grain: number; // 0..1
  vignette: number; // 0..1
  fade: number; // 0..1 (lifts blacks)
  splitTone: { highlights: [number, number, number]; shadows: [number, number, number] };
  contrast: number; // 0.5..1.5
  brightness: number; // 0.5..1.5
}

export const DEFAULT_PARAMS: VintageParams = {
  preset: "70s",
  grain: 0.15,
  vignette: 0.3,
  fade: 0.1,
  splitTone: { highlights: [255, 220, 180], shadows: [80, 60, 100] },
  contrast: 1.1,
  brightness: 1.05,
};

export const PRESETS: Record<VintagePreset, Partial<VintageParams>> = {
  "70s": {
    contrast: 1.1,
    brightness: 1.0,
    fade: 0.12,
    splitTone: { highlights: [255, 220, 180], shadows: [80, 60, 100] },
  },
  faded: {
    contrast: 0.9,
    brightness: 1.05,
    fade: 0.25,
    splitTone: { highlights: [240, 240, 240], shadows: [120, 120, 130] },
  },
  bw: {
    contrast: 1.15,
    brightness: 1.0,
    fade: 0.05,
    splitTone: { highlights: [255, 255, 255], shadows: [0, 0, 0] },
  },
  sepia: {
    contrast: 1.05,
    brightness: 1.0,
    fade: 0.1,
    splitTone: { highlights: [255, 220, 180], shadows: [120, 80, 30] },
  },
  polaroid: {
    contrast: 0.95,
    brightness: 1.1,
    fade: 0.18,
    splitTone: { highlights: [255, 230, 200], shadows: [60, 70, 90] },
  },
};

const clamp = (n: number, lo = 0, hi = 255) => Math.max(lo, Math.min(hi, n));

/** Apply contrast & brightness adjustment. */
export function adjustContrastBrightness(r: number, g: number, b: number, contrast: number, brightness: number): [number, number, number] {
  return [
    clamp((r - 128) * contrast + 128 * brightness),
    clamp((g - 128) * contrast + 128 * brightness),
    clamp((b - 128) * contrast + 128 * brightness),
  ];
}

/** Convert to grayscale using Rec. 709 luma. */
export function toGrayscale(r: number, g: number, b: number): [number, number, number] {
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return [l, l, l];
}

/** Apply sepia tone. */
export function toSepia(r: number, g: number, b: number): [number, number, number] {
  return [
    clamp(0.393 * r + 0.769 * g + 0.189 * b),
    clamp(0.349 * r + 0.686 * g + 0.168 * b),
    clamp(0.272 * r + 0.534 * g + 0.131 * b),
  ];
}

/** Apply fade by lifting blacks toward white. */
export function applyFade(r: number, g: number, b: number, amount: number): [number, number, number] {
  const amt = Math.max(0, Math.min(1, amount));
  return [
    clamp(r + (255 - r) * amt * 0.3),
    clamp(g + (255 - g) * amt * 0.3),
    clamp(b + (255 - b) * amt * 0.3),
  ];
}

/** Apply split-tone: tint highlights with one color, shadows with another. */
export function applySplitTone(
  r: number, g: number, b: number,
  highlights: [number, number, number], shadows: [number, number, number],
): [number, number, number] {
  const l = (r + g + b) / 3 / 255; // 0..1
  // Highlights factor: above 0.5 increases
  const hl = Math.max(0, l - 0.5) * 2;
  // Shadows factor: below 0.5
  const sh = Math.max(0, 0.5 - l) * 2;
  return [
    clamp(r + (highlights[0] - 128) * 0.2 * hl + (shadows[0] - 128) * 0.2 * sh),
    clamp(g + (highlights[1] - 128) * 0.2 * hl + (shadows[1] - 128) * 0.2 * sh),
    clamp(b + (highlights[2] - 128) * 0.2 * hl + (shadows[2] - 128) * 0.2 * sh),
  ];
}

/** Compute vignette factor at distance from center. */
export function vignetteFactor(distFromCenter: number, strength: number): number {
  // distFromCenter: 0 (center) to ~1.0 (corner)
  const amt = Math.max(0, Math.min(1, strength));
  return 1 - Math.pow(distFromCenter, 2) * amt;
}

/** Add film grain (random noise). Uses seeded rng for determinism. */
export function addGrain(r: number, g: number, b: number, amount: number, noiseValue: number): [number, number, number] {
  const amt = Math.max(0, Math.min(1, amount));
  const n = (noiseValue - 0.5) * 60 * amt;
  return [clamp(r + n), clamp(g + n), clamp(b + n)];
}

/** Simple seeded PRNG for deterministic grain. */
export function seedGrain(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Apply a preset to a single pixel. Returns RGB triplet. */
export function applyPreset(r: number, g: number, b: number, params: VintageParams): [number, number, number] {
  let out: [number, number, number] = [r, g, b];
  if (params.preset === "bw") {
    out = toGrayscale(out[0], out[1], out[2]);
  } else if (params.preset === "sepia") {
    out = toSepia(out[0], out[1], out[2]);
  }
  out = adjustContrastBrightness(out[0], out[1], out[2], params.contrast, params.brightness);
  if (params.fade > 0) out = applyFade(out[0], out[1], out[2], params.fade);
  out = applySplitTone(out[0], out[1], out[2], params.splitTone.highlights, params.splitTone.shadows);
  return out;
}

/** Process the full RGBA buffer. Returns a new Uint8ClampedArray. */
export function processImage(pixels: Uint8ClampedArray, width: number, height: number, params: VintageParams): Uint8ClampedArray {
  const out = new Uint8ClampedArray(pixels.length);
  const rng = seedGrain(1337);
  const cx = width / 2;
  const cy = height / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);
  for (let i = 0; i < pixels.length; i += 4) {
    const px = (i / 4) % width;
    const py = Math.floor(i / 4 / width);
    let r = pixels[i];
    let g = pixels[i + 1];
    let b = pixels[i + 2];
    const a = pixels[i + 3];
    [r, g, b] = applyPreset(r, g, b, params);
    // Vignette
    if (params.vignette > 0) {
      const dx = px - cx;
      const dy = py - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) / maxDist;
      const factor = vignetteFactor(dist, params.vignette);
      r = clamp(r * factor);
      g = clamp(g * factor);
      b = clamp(b * factor);
    }
    // Grain
    if (params.grain > 0) {
      [r, g, b] = addGrain(r, g, b, params.grain, rng());
    }
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
    out[i + 3] = a;
  }
  return out;
}

/** Merge a preset into params (preset values override matching fields). */
export function withPreset(preset: VintagePreset, overrides: Partial<VintageParams> = {}): VintageParams {
  const presetValues = PRESETS[preset];
  return { ...DEFAULT_PARAMS, ...presetValues, ...overrides, preset };
}

/** Estimate PNG byte size. */
export function estimatePngBytes(width: number, height: number): number {
  return Math.round(64 + (width * height * 4) / 2.5);
}

/** Format bytes. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Build a description of the current vintage settings. */
export function describeSettings(params: VintageParams): string {
  return [
    `Preset: ${params.preset}`,
    `Contrast: ${params.contrast.toFixed(2)}`,
    `Brightness: ${params.brightness.toFixed(2)}`,
    `Grain: ${(params.grain * 100).toFixed(0)}%`,
    `Vignette: ${(params.vignette * 100).toFixed(0)}%`,
    `Fade: ${(params.fade * 100).toFixed(0)}%`,
    `Highlights tint: rgb(${params.splitTone.highlights.join(", ")})`,
    `Shadows tint: rgb(${params.splitTone.shadows.join(", ")})`,
  ].join("\n");
}
