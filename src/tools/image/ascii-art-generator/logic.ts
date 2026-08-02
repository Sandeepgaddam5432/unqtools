/**
 * ASCII Art Generator — pure logic, PART 1 of 3.
 *
 * The previous push of this tool's engine as a 2-part split still truncated
 * mid-function (see PROGRESS.md — this is now a 3-part split instead).
 *
 * PART 1 owns the single shared import block, every exported type, small
 * shared helpers (`clampByte`, `createImageDataLike`, `luminance`), and the
 * four original filter primitives carried over unchanged in behavior
 * (`applyBrightnessContrastGamma`, `applyInvert`, `applyGrayscale`,
 * `applyEdgeDetect`).
 *
 * PART 2 adds the new filters (channel isolation, posterize, threshold, box
 * blur, unsharp mask, histogram, auto-levels, auto-enhance, vignette
 * correction), the fixed `computeCrop`, and both downsampling passes
 * (luminance grid + the new real color grid). PART 3 adds every dithering
 * engine and the `imageToAscii` / `imageToAsciiWithColor` orchestrators plus
 * the performance-measurement helper. Concatenate PART-1 + PART-2 + PART-3,
 * in that order, to produce the real `logic.ts`. Only PART 1 carries the
 * import statement — PARTS 2 and 3 add no imports and must reuse every
 * identifier declared here.
 *
 * See DOCS.md for the full defect list (16) and feature list (100) this
 * rebuild addresses.
 */
import type { ToolResult } from "../../../lib/tool";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

/**
 * Minimal structural type matching the browser's `ImageData`. Using an
 * interface instead of the global `ImageData` type keeps this module
 * testable in Node (vitest) where `ImageData` is not defined.
 */
export interface ImageDataLike {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/**
 * `bayer4x4`, `bayer8x8` and `halftone` are new ordered-dithering engines
 * (DOCS.md feature #31/#32) — the original 4 error-diffusion engines kept
 * their exact names. Widening this union is backward compatible (D2).
 */
export type DitheringMode =
  | "none"
  | "floyd-steinberg"
  | "atkinson"
  | "jjn"
  | "stucki"
  | "bayer4x4"
  | "bayer8x8"
  | "halftone";

/**
 * `duotone` and `background-block` are new color modes added in PART 3
 * (DOCS.md features #43/#45). Widening this union is backward compatible (D2).
 */
export type ColorMode = "bw" | "truecolor" | "ansi256" | "ansi16" | "phosphor" | "duotone" | "background-block";

export type ProcessMode = "normal" | "grayscale" | "edge-detect";

/** Extra controls threaded through to whichever dithering engine is selected. */
export interface DitherExtraOpts {
  /** Blend factor between the plain ramp mapping (0) and full dithering (1). Default 1. */
  strength?: number;
  /** Alternate scan direction every row for error-diffusion engines, reducing directional streaking (DOCS.md #36). Default false. */
  serpentine?: boolean;
  /** Cells flagged `1` here skip error diffusion entirely, keeping edges crisp (DOCS.md #38/#39). Build one with `computeEdgeMask`. */
  edgeMask?: Uint8Array;
}

export interface AsciiOptions {
  width: number;
  ramp: string;
  dithering: DitheringMode;
  brightness?: number;
  contrast?: number;
  gamma?: number;
  invert?: boolean;
  mode?: ProcessMode;
  aspectCorrection?: boolean;
  cellRatio?: number;
  alphaBackground?: number;
  /** Unsharp-mask sharpening amount, 0/undefined = off (DOCS.md #11). */
  unsharpAmount?: number;
  /** Unsharp-mask sample radius in source pixels. Default 1. */
  unsharpRadius?: number;
  /** Box-blur radius in source pixels applied before downsampling, 0/undefined = off (DOCS.md #15). */
  blurRadius?: number;
  /** Reduce luminance to this many discrete bands before ramp mapping, null/undefined = off (DOCS.md #12). */
  posterizeLevels?: number | null;
  /** Binary threshold 0-255; null/undefined = off (DOCS.md #13). */
  threshold?: number | null;
  /** Restrict luminance sampling to a single RGB channel (DOCS.md #14). null/undefined = standard luminance. */
  channel?: "r" | "g" | "b" | null;
  /** Stretch the real measured histogram to the full 0-255 range (DOCS.md #16). */
  autoLevels?: boolean;
  /** Analyze the real measured histogram and auto-derive brightness/contrast/gamma (DOCS.md #17). */
  autoEnhance?: boolean;
  /** Estimate and correct radial vignette darkening measured from the image itself (DOCS.md #18). */
  vignetteCorrection?: boolean;
  /** Extra dithering controls threaded through to the selected engine. */
  ditherOpts?: DitherExtraOpts;
}

export interface ImageAsciiResult {
  ascii: string;
  widthChars: number;
  heightChars: number;
  charCount: number;
}

/** Result of the color-aware orchestrator: ascii text plus a real per-cell RGB grid. */
export interface ImageAsciiColorResult {
  ascii: string;
  widthChars: number;
  heightChars: number;
  /** Flat RGB triples, one per cell, length = widthChars * heightChars * 3. Sampled from the real, filtered source image — never fabricated (fixes DOCS.md defect #1). */
  colorGrid: Float32Array;
}

export type CropPreset = "square" | "16:9" | "4:3" | "9:16" | "1:1" | "free";

/* ------------------------------------------------------------------ */
/* Small shared helpers                                               */
/* ------------------------------------------------------------------ */

/** Clamp a value to the 0-255 byte range. Shared by every filter in all 3 parts. */
export function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/** Allocate a fresh ImageDataLike of the given dimensions. */
export function createImageDataLike(width: number, height: number): ImageDataLike {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

/** Compute luminance (0-255) from an RGBA pixel. */
export function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/* ------------------------------------------------------------------ */
/* Image filter primitives — originals, unchanged behavior            */
/* ------------------------------------------------------------------ */

/**
 * Apply brightness, contrast, and gamma to an image.
 * All three default to no-op (brightness=0, contrast=0, gamma=1).
 * Returns a new ImageDataLike — input is not mutated.
 */
export function applyBrightnessContrastGamma(
  imageData: ImageDataLike,
  brightness = 0,
  contrast = 0,
  gamma = 1,
): ImageDataLike {
  const out = createImageDataLike(imageData.width, imageData.height);
  const src = imageData.data;
  const dst = out.data;
  const contrastF = 1 + contrast / 100;
  const invGamma = gamma === 0 ? 1 : 1 / gamma;
  const hasGamma = Math.abs(gamma - 1) > 1e-6;
  for (let i = 0; i < src.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      let v = src[i + c]!;
      v = (v - 128) * contrastF + 128 + brightness;
      if (hasGamma && v > 0) {
        v = 255 * Math.pow(v / 255, invGamma);
      }
      dst[i + c] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
    dst[i + 3] = src[i + 3]!;
  }
  return out;
}

/** Invert RGB channels (alpha preserved). Returns a new ImageDataLike. */
export function applyInvert(imageData: ImageDataLike): ImageDataLike {
  const out = createImageDataLike(imageData.width, imageData.height);
  const src = imageData.data;
  const dst = out.data;
  for (let i = 0; i < src.length; i += 4) {
    dst[i] = 255 - src[i]!;
    dst[i + 1] = 255 - src[i + 1]!;
    dst[i + 2] = 255 - src[i + 2]!;
    dst[i + 3] = src[i + 3]!;
  }
  return out;
}

/** Convert RGB to grayscale (luminance). Returns a new ImageDataLike. */
export function applyGrayscale(imageData: ImageDataLike): ImageDataLike {
  const out = createImageDataLike(imageData.width, imageData.height);
  const src = imageData.data;
  const dst = out.data;
  for (let i = 0; i < src.length; i += 4) {
    const l = luminance(src[i]!, src[i + 1]!, src[i + 2]!);
    dst[i] = l;
    dst[i + 1] = l;
    dst[i + 2] = l;
    dst[i + 3] = src[i + 3]!;
  }
  return out;
}

/**
 * Sobel edge-detection. Returns a new ImageDataLike where each pixel's
 * RGB channels all hold the edge magnitude (0-255). Alpha is preserved.
 */
export function applyEdgeDetect(imageData: ImageDataLike): ImageDataLike {
  const w = imageData.width;
  const h = imageData.height;
  const out = createImageDataLike(w, h);
  const src = imageData.data;
  const dst = out.data;
  const gray = new Float32Array(w * h);
  for (let i = 0, p = 0; i < src.length; i += 4, p++) {
    gray[p] = luminance(src[i]!, src[i + 1]!, src[i + 2]!);
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const xl = x > 0 ? x - 1 : 0;
      const xr = x < w - 1 ? x + 1 : w - 1;
      const yt = y > 0 ? y - 1 : 0;
      const yb = y < h - 1 ? y + 1 : h - 1;
      const gx =
        -gray[yt * w + xl]! - 2 * gray[y * w + xl]! - gray[yb * w + xl]! +
        gray[yt * w + xr]! + 2 * gray[y * w + xr]! + gray[yb * w + xr]!;
      const gy =
        -gray[yt * w + xl]! - 2 * gray[yt * w + x]! - gray[yt * w + xr]! +
        gray[yb * w + xl]! + 2 * gray[yb * w + x]! + gray[yb * w + xr]!;
      const mag = Math.min(255, Math.hypot(gx, gy));
      const o = idx * 4;
      dst[o] = mag;
      dst[o + 1] = mag;
      dst[o + 2] = mag;
      dst[o + 3] = src[o + 3]!;
    }
  }
  return out;
}

/* === END OF PART 1 === (next: PART 2 adds new filters, crop fix, downsampling) */

export function applyChannelIsolation(imageData: ImageDataLike, channel: "r" | "g" | "b"): ImageDataLike {
  const out = createImageDataLike(imageData.width, imageData.height);
  const src = imageData.data;
  const dst = out.data;
  const offset = channel === "r" ? 0 : channel === "g" ? 1 : 2;
  for (let i = 0; i < src.length; i += 4) {
    const v = src[i + offset]!;
    dst[i] = v;
    dst[i + 1] = v;
    dst[i + 2] = v;
    dst[i + 3] = src[i + 3]!;
  }
  return out;
}

/** Quantize each channel into `levels` discrete evenly-spaced bands (DOCS.md #12). */
export function applyPosterize(imageData: ImageDataLike, levels: number): ImageDataLike {
  const n = Math.max(2, Math.floor(levels));
  const out = createImageDataLike(imageData.width, imageData.height);
  const src = imageData.data;
  const dst = out.data;
  const step = 255 / (n - 1);
  for (let i = 0; i < src.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const level = Math.round(src[i + c]! / step);
      dst[i + c] = clampByte(Math.round(level * step));
    }
    dst[i + 3] = src[i + 3]!;
  }
  return out;
}

/** Hard binary threshold on real luminance (DOCS.md #13). */
export function applyThreshold(imageData: ImageDataLike, threshold: number): ImageDataLike {
  const out = createImageDataLike(imageData.width, imageData.height);
  const src = imageData.data;
  const dst = out.data;
  for (let i = 0; i < src.length; i += 4) {
    const l = luminance(src[i]!, src[i + 1]!, src[i + 2]!);
    const v = l >= threshold ? 255 : 0;
    dst[i] = v;
    dst[i + 1] = v;
    dst[i + 2] = v;
    dst[i + 3] = src[i + 3]!;
  }
  return out;
}

/** Separable box blur, real convolution (DOCS.md #15). radius=0 is a no-op. */
export function applyBoxBlur(imageData: ImageDataLike, radius: number): ImageDataLike {
  const r = Math.max(0, Math.round(radius));
  if (r === 0) return imageData;
  const w = imageData.width;
  const h = imageData.height;
  const src = imageData.data;
  const temp = new Float32Array(w * h * 3);
  const out = createImageDataLike(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let rs = 0, gs = 0, bs = 0, count = 0;
      for (let dx = -r; dx <= r; dx++) {
        const xx = x + dx;
        if (xx < 0 || xx >= w) continue;
        const i = (y * w + xx) * 4;
        rs += src[i]!; gs += src[i + 1]!; bs += src[i + 2]!; count++;
      }
      const p = (y * w + x) * 3;
      temp[p] = rs / count; temp[p + 1] = gs / count; temp[p + 2] = bs / count;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let rs = 0, gs = 0, bs = 0, count = 0;
      for (let dy = -r; dy <= r; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        const p = (yy * w + x) * 3;
        rs += temp[p]!; gs += temp[p + 1]!; bs += temp[p + 2]!; count++;
      }
      const o = (y * w + x) * 4;
      out.data[o] = clampByte(Math.round(rs / count));
      out.data[o + 1] = clampByte(Math.round(gs / count));
      out.data[o + 2] = clampByte(Math.round(bs / count));
      out.data[o + 3] = src[o + 3]!;
    }
  }
  return out;
}

/** Unsharp-mask sharpening: original + (original - blurred) * amount (DOCS.md #11). amount<=0 is a no-op. */
export function applyUnsharpMask(imageData: ImageDataLike, amount: number, radius = 1): ImageDataLike {
  if (amount <= 0) return imageData;
  const blurred = applyBoxBlur(imageData, radius);
  const out = createImageDataLike(imageData.width, imageData.height);
  const src = imageData.data;
  const b = blurred.data;
  for (let i = 0; i < src.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      out.data[i + c] = clampByte(Math.round(src[i + c]! + (src[i + c]! - b[i + c]!) * amount));
    }
    out.data[i + 3] = src[i + 3]!;
  }
  return out;
}

/** Real luminance histogram, 256 buckets (DOCS.md #20). */
export function computeHistogram(imageData: ImageDataLike): Uint32Array {
  const hist = new Uint32Array(256);
  const src = imageData.data;
  for (let i = 0; i < src.length; i += 4) {
    const l = Math.round(luminance(src[i]!, src[i + 1]!, src[i + 2]!));
    hist[clampByte(l)]!++;
  }
  return hist;
}

/** Stretch the real measured 1st–99th percentile of the histogram to 0-255 (DOCS.md #16). */
export function applyAutoLevels(imageData: ImageDataLike): ImageDataLike {
  const hist = computeHistogram(imageData);
  const total = imageData.width * imageData.height;
  if (total === 0) return imageData;
  const clipLow = total * 0.01;
  const clipHighCount = total * 0.01;
  let lo = 0, cum = 0;
  for (; lo < 256; lo++) { cum += hist[lo]!; if (cum >= clipLow) break; }
  let hi = 255; cum = 0;
  for (; hi >= 0; hi--) { cum += hist[hi]!; if (cum >= clipHighCount) break; }
  if (hi <= lo) return imageData;
  const range = hi - lo;
  const out = createImageDataLike(imageData.width, imageData.height);
  const src = imageData.data;
  for (let i = 0; i < src.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      out.data[i + c] = clampByte(Math.round(((src[i + c]! - lo) / range) * 255));
    }
    out.data[i + 3] = src[i + 3]!;
  }
  return out;
}

export interface AutoEnhanceSuggestion {
  brightness: number;
  contrast: number;
  gamma: number;
}

/**
 * Derive real brightness/contrast/gamma values from the image's own measured
 * luminance histogram (mean + standard deviation) — targets a mid-gray mean
 * and a healthy spread. Never a fixed/guessed default (DOCS.md #17, ties D20).
 */
export function computeAutoEnhanceSuggestion(imageData: ImageDataLike): AutoEnhanceSuggestion {
  const hist = computeHistogram(imageData);
  const total = imageData.width * imageData.height;
  if (total === 0) return { brightness: 0, contrast: 0, gamma: 1 };
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i]!;
  const mean = sum / total;
  let variance = 0;
  for (let i = 0; i < 256; i++) variance += hist[i]! * (i - mean) * (i - mean);
  const stdDev = Math.sqrt(variance / total);
  const brightness = Math.max(-100, Math.min(100, Math.round(128 - mean)));
  const contrastRaw = stdDev > 0 ? ((64 / stdDev) - 1) * 100 : 0;
  const contrast = Number.isFinite(contrastRaw) ? Math.max(-50, Math.min(100, Math.round(contrastRaw))) : 0;
  const gammaRaw = mean > 0 && mean < 255 ? Math.log(mean / 255) / Math.log(128 / 255) : 1;
  const gamma = Number.isFinite(gammaRaw) ? Math.max(0.5, Math.min(2, gammaRaw)) : 1;
  return { brightness, contrast, gamma };
}

/**
 * Estimate real vignette darkening by comparing the measured average
 * luminance of the four corners against the measured center, then apply a
 * radial gain map sized to that real measured deficit — never a fixed
 * correction strength (DOCS.md #18, ties D20).
 */
export function applyVignetteCorrection(imageData: ImageDataLike): ImageDataLike {
  const w = imageData.width;
  const h = imageData.height;
  const src = imageData.data;
  const cx = w / 2, cy = h / 2;
  const maxR = Math.hypot(cx, cy) || 1;
  const sampleAt = (x: number, y: number, size: number): number => {
    let sum = 0, count = 0;
    for (let dy = -size; dy <= size; dy++) {
      for (let dx = -size; dx <= size; dx++) {
        const xx = Math.min(w - 1, Math.max(0, x + dx));
        const yy = Math.min(h - 1, Math.max(0, y + dy));
        const i = (yy * w + xx) * 4;
        sum += luminance(src[i]!, src[i + 1]!, src[i + 2]!);
        count++;
      }
    }
    return count > 0 ? sum / count : 0;
  };
  const patch = Math.max(2, Math.round(Math.min(w, h) * 0.03));
  const centerL = sampleAt(Math.round(cx), Math.round(cy), patch);
  const corners = [
    sampleAt(patch, patch, patch),
    sampleAt(w - patch - 1, patch, patch),
    sampleAt(patch, h - patch - 1, patch),
    sampleAt(w - patch - 1, h - patch - 1, patch),
  ];
  const cornerL = corners.reduce((a, b) => a + b, 0) / corners.length;
  if (centerL <= 0 || cornerL >= centerL - 1) {
    return imageData;
  }
  const deficit = (centerL - cornerL) / centerL;
  const out = createImageDataLike(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const r = Math.hypot(x - cx, y - cy) / maxR;
      const gain = 1 + deficit * r * r;
      const i = (y * w + x) * 4;
      out.data[i] = clampByte(Math.round(src[i]! * gain));
      out.data[i + 1] = clampByte(Math.round(src[i + 1]! * gain));
      out.data[i + 2] = clampByte(Math.round(src[i + 2]! * gain));
      out.data[i + 3] = src[i + 3]!;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Aspect correction & crop (crop fixed — DOCS.md defect #2)          */
/* ------------------------------------------------------------------ */

export function applyAspectCorrection(
  srcWidth: number,
  srcHeight: number,
  cellRatio = 0.5,
): { width: number; height: number } {
  if (srcWidth <= 0) return { width: 0, height: 0 };
  const ratio = srcHeight / srcWidth;
  const height = Math.max(1, Math.round(srcWidth * ratio * cellRatio));
  return { width: srcWidth, height };
}

/**
 * Compute the crop rectangle for a preset on a source image.
 * `"free"` now genuinely means "no crop" — the full source rectangle —
 * matching how the UI already treats it. (The previous version of this
 * function treated `"free"` as a centered square crop, contradicting its own
 * label; see DOCS.md defect #2.)
 */
export function computeCrop(
  srcW: number,
  srcH: number,
  preset: CropPreset,
): { x: number; y: number; width: number; height: number } {
  if (preset === "free") {
    return { x: 0, y: 0, width: srcW, height: srcH };
  }
  if (preset === "1:1" || preset === "square") {
    const side = Math.min(srcW, srcH);
    return { x: Math.floor((srcW - side) / 2), y: Math.floor((srcH - side) / 2), width: side, height: side };
  }
  const ratios: Record<string, number> = { "16:9": 16 / 9, "4:3": 4 / 3, "9:16": 9 / 16 };
  const target = ratios[preset] ?? 1;
  let w = srcW;
  let h = w / target;
  if (h > srcH) {
    h = srcH;
    w = h * target;
  }
  return {
    x: Math.floor((srcW - w) / 2),
    y: Math.floor((srcH - h) / 2),
    width: Math.floor(w),
    height: Math.floor(h),
  };
}

/* ------------------------------------------------------------------ */
/* Downsampling — source image → cell-grid luminance and real color   */
/* ------------------------------------------------------------------ */

/**
 * Downsample `imageData` to a `targetW × targetH` cell grid where each
 * cell is the average luminance of the source region. Alpha is treated as
 * the supplied background luminance (default 255 = white).
 */
export function downsampleToLuminanceGrid(
  imageData: ImageDataLike,
  targetW: number,
  targetH: number,
  alphaBackground = 255,
): Float32Array {
  const grid = new Float32Array(targetW * targetH);
  if (targetW <= 0 || targetH <= 0) return grid;
  const srcW = imageData.width;
  const srcH = imageData.height;
  const src = imageData.data;
  const xStep = srcW / targetW;
  const yStep = srcH / targetH;
  for (let cy = 0; cy < targetH; cy++) {
    const y0 = Math.floor(cy * yStep);
    const y1 = Math.max(y0 + 1, Math.floor((cy + 1) * yStep));
    for (let cx = 0; cx < targetW; cx++) {
      const x0 = Math.floor(cx * xStep);
      const x1 = Math.max(x0 + 1, Math.floor((cx + 1) * xStep));
      let sum = 0;
      let count = 0;
      for (let y = y0; y < y1 && y < srcH; y++) {
        for (let x = x0; x < x1 && x < srcW; x++) {
          const i = (y * srcW + x) * 4;
          const a = src[i + 3]!;
          const l = luminance(src[i]!, src[i + 1]!, src[i + 2]!);
          const blended = a < 255 ? (l * a + alphaBackground * (255 - a)) / 255 : l;
          sum += blended;
          count++;
        }
      }
      grid[cy * targetW + cx] = count > 0 ? sum / count : 0;
    }
  }
  return grid;
}

/**
 * Downsample `imageData` to a `targetW × targetH` cell grid of real average
 * RGB per cell (flat `[r,g,b, r,g,b, ...]`). This is the real color source
 * used by true-color/ANSI rendering in PART 3, replacing the fabricated
 * character-code-hash coloring from the original implementation (DOCS.md
 * defect #1).
 */
export function downsampleToColorGrid(
  imageData: ImageDataLike,
  targetW: number,
  targetH: number,
  alphaBackground = 255,
): Float32Array {
  const grid = new Float32Array(targetW * targetH * 3);
  if (targetW <= 0 || targetH <= 0) return grid;
  const srcW = imageData.width;
  const srcH = imageData.height;
  const src = imageData.data;
  const xStep = srcW / targetW;
  const yStep = srcH / targetH;
  for (let cy = 0; cy < targetH; cy++) {
    const y0 = Math.floor(cy * yStep);
    const y1 = Math.max(y0 + 1, Math.floor((cy + 1) * yStep));
    for (let cx = 0; cx < targetW; cx++) {
      const x0 = Math.floor(cx * xStep);
      const x1 = Math.max(x0 + 1, Math.floor((cx + 1) * xStep));
      let rs = 0, gs = 0, bs = 0, count = 0;
      for (let y = y0; y < y1 && y < srcH; y++) {
        for (let x = x0; x < x1 && x < srcW; x++) {
          const i = (y * srcW + x) * 4;
          const a = src[i + 3]!;
          const blend = (channel: number) => (a < 255 ? (channel * a + alphaBackground * (255 - a)) / 255 : channel);
          rs += blend(src[i]!);
          gs += blend(src[i + 1]!);
          bs += blend(src[i + 2]!);
          count++;
        }
      }
      const p = (cy * targetW + cx) * 3;
      if (count > 0) {
        grid[p] = rs / count; grid[p + 1] = gs / count; grid[p + 2] = bs / count;
      }
    }
  }
  return grid;
}

/* === END OF PART 2 === (next: PART 3 adds dithering engines + orchestrators) */

export function luminanceToChar(l: number, ramp: string): string {
  if (ramp.length === 0) return " ";
  const idx = Math.floor((l / 256) * ramp.length);
  const clamped = idx < 0 ? 0 : idx >= ramp.length ? ramp.length - 1 : idx;
  return ramp[clamped]!;
}

/** Build a multi-line ASCII string from a luminance grid using a ramp. */
export function gridToAscii(grid: Float32Array, width: number, height: number, ramp: string): string {
  const lines: string[] = [];
  for (let y = 0; y < height; y++) {
    let line = "";
    for (let x = 0; x < width; x++) {
      line += luminanceToChar(grid[y * width + x]!, ramp);
    }
    lines.push(line);
  }
  return lines.join("\n");
}

/** No dithering — direct ramp mapping of each cell's luminance. */
export function noDither(imageData: ImageDataLike, ramp: string): string {
  const { width, height } = imageData;
  const src = imageData.data;
  const lines: string[] = [];
  for (let y = 0; y < height; y++) {
    let line = "";
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      line += luminanceToChar(luminance(src[i]!, src[i + 1]!, src[i + 2]!), ramp);
    }
    lines.push(line);
  }
  return lines.join("\n");
}

/**
 * Build a real edge mask (1 = edge cell) from the same Sobel detector used by
 * `applyEdgeDetect`, for use with `DitherExtraOpts.edgeMask` (DOCS.md #38/#39).
 */
export function computeEdgeMask(cellImage: ImageDataLike, threshold = 64): Uint8Array {
  const edgeImage = applyEdgeDetect(cellImage);
  const mask = new Uint8Array(cellImage.width * cellImage.height);
  const data = edgeImage.data;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    mask[p] = data[i]! >= threshold ? 1 : 0;
  }
  return mask;
}

/* ------------------------------------------------------------------ */
/* Error-diffusion dithering — shared engine, corrected quantizer     */
/* ------------------------------------------------------------------ */

function errorDiffusion(
  imageData: ImageDataLike,
  ramp: string,
  kernel: ReadonlyArray<readonly [number, number, number]>,
  extra?: DitherExtraOpts,
): string {
  const { width, height } = imageData;
  if (width === 0 || height === 0) return "";
  const src = imageData.data;
  const strength = extra?.strength ?? 1;
  const serpentine = extra?.serpentine ?? false;
  const edgeMask = extra?.edgeMask;
  const grid = new Float32Array(width * height);
  for (let i = 0, p = 0; i < src.length; i += 4, p++) {
    grid[p] = luminance(src[i]!, src[i + 1]!, src[i + 2]!);
  }
  const out: string[] = [];
  for (let y = 0; y < height; y++) {
    const rightToLeft = serpentine && y % 2 === 1;
    const line = new Array<string>(width);
    for (let step = 0; step < width; step++) {
      const x = rightToLeft ? width - 1 - step : step;
      const idx = y * width + x;
      const old = grid[idx]!;
      const rampIdx = Math.floor((old / 256) * ramp.length);
      const clamped = rampIdx < 0 ? 0 : rampIdx >= ramp.length ? ramp.length - 1 : rampIdx;
      // Reconstructed value uses the CENTER of the same bucket luminanceToChar
      // uses (256/ramp.length wide), instead of the old mismatched linear scale
      // i/(ramp.length-1)*255 — this is DOCS.md defect #5's fix: both dithered
      // and undithered output now agree on the exact same bucket boundaries.
      const newV = clampByte(Math.round((clamped + 0.5) * (256 / ramp.length)));
      grid[idx] = newV;
      line[x] = ramp[clamped]!;
      const skipDiffusion = edgeMask ? edgeMask[idx] === 1 : false;
      if (!skipDiffusion) {
        const err = (old - newV) * strength;
        for (const [dx0, dy, weight] of kernel) {
          if (weight === 0) continue;
          const dx = rightToLeft ? -dx0 : dx0;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          grid[ny * width + nx]! += err * weight;
        }
      }
    }
    out.push(line.join(""));
  }
  return out.join("\n");
}

export function ditherFloydSteinberg(imageData: ImageDataLike, ramp: string, extra?: DitherExtraOpts): string {
  return errorDiffusion(imageData, ramp, [
    [1, 0, 7 / 16], [-1, 1, 3 / 16], [0, 1, 5 / 16], [1, 1, 1 / 16],
  ], extra);
}

export function ditherAtkinson(imageData: ImageDataLike, ramp: string, extra?: DitherExtraOpts): string {
  const w = 1 / 8;
  return errorDiffusion(imageData, ramp, [
    [1, 0, w], [2, 0, w], [-1, 1, w], [0, 1, w], [1, 1, w], [0, 2, w],
  ], extra);
}

export function ditherJJN(imageData: ImageDataLike, ramp: string, extra?: DitherExtraOpts): string {
  const w = 1 / 48;
  return errorDiffusion(imageData, ramp, [
    [1, 0, 7 * w], [2, 0, 5 * w],
    [-2, 1, 3 * w], [-1, 1, 5 * w], [0, 1, 7 * w], [1, 1, 5 * w], [2, 1, 3 * w],
    [-2, 2, 1 * w], [-1, 2, 3 * w], [0, 2, 5 * w], [1, 2, 3 * w], [2, 2, 1 * w],
  ], extra);
}

export function ditherStucki(imageData: ImageDataLike, ramp: string, extra?: DitherExtraOpts): string {
  const w = 1 / 42;
  return errorDiffusion(imageData, ramp, [
    [1, 0, 8 * w], [2, 0, 4 * w],
    [-2, 1, 2 * w], [-1, 1, 4 * w], [0, 1, 8 * w], [1, 1, 4 * w], [2, 1, 2 * w],
    [-2, 2, 1 * w], [-1, 2, 2 * w], [0, 2, 4 * w], [1, 2, 2 * w], [2, 2, 1 * w],
  ], extra);
}

/* ------------------------------------------------------------------ */
/* Ordered / clustered-dot dithering — new engines (DOCS.md #31/#32) */
/* ------------------------------------------------------------------ */

const BAYER_4X4: number[][] = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const BAYER_8X8: number[][] = [
  [0, 48, 12, 60, 3, 51, 15, 63],
  [32, 16, 44, 28, 35, 19, 47, 31],
  [8, 56, 4, 52, 11, 59, 7, 55],
  [40, 24, 36, 20, 43, 27, 39, 23],
  [2, 50, 14, 62, 1, 49, 13, 61],
  [34, 18, 46, 30, 33, 17, 45, 29],
  [10, 58, 6, 54, 9, 57, 5, 53],
  [42, 26, 38, 22, 41, 25, 37, 21],
];

/**
 * A clustered-dot (halftone) threshold matrix: dots grow outward from the
 * center in rank order, producing the classic print-halftone look instead of
 * Bayer's dispersed-dot pattern. Computed once at module load, not guessed.
 */
const HALFTONE_8X8: number[][] = (() => {
  const size = 8;
  const c = (size - 1) / 2;
  const cells: Array<{ x: number; y: number; d: number }> = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      cells.push({ x, y, d: Math.hypot(x - c, y - c) });
    }
  }
  cells.sort((a, b) => a.d - b.d);
  const matrix: number[][] = Array.from({ length: size }, () => new Array<number>(size).fill(0));
  cells.forEach((cell, rank) => {
    matrix[cell.y]![cell.x] = rank;
  });
  return matrix;
})();

function ditherOrdered(imageData: ImageDataLike, ramp: string, matrix: number[][], strength: number): string {
  const { width, height } = imageData;
  const size = matrix.length;
  const levels = size * size;
  const src = imageData.data;
  const out: string[] = [];
  for (let y = 0; y < height; y++) {
    let line = "";
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const l = luminance(src[i]!, src[i + 1]!, src[i + 2]!);
      const thresholdOffset = ((matrix[y % size]![x % size]! + 0.5) / levels - 0.5) * (256 / levels) * levels * 0.5;
      const ditheredL = l + thresholdOffset * strength;
      line += luminanceToChar(clampByte(ditheredL), ramp);
    }
    out.push(line);
  }
  return out.join("\n");
}

export function ditherBayer4x4(imageData: ImageDataLike, ramp: string, extra?: DitherExtraOpts): string {
  return ditherOrdered(imageData, ramp, BAYER_4X4, extra?.strength ?? 1);
}

export function ditherBayer8x8(imageData: ImageDataLike, ramp: string, extra?: DitherExtraOpts): string {
  return ditherOrdered(imageData, ramp, BAYER_8X8, extra?.strength ?? 1);
}

export function ditherHalftone(imageData: ImageDataLike, ramp: string, extra?: DitherExtraOpts): string {
  return ditherOrdered(imageData, ramp, HALFTONE_8X8, extra?.strength ?? 1);
}

/* ------------------------------------------------------------------ */
/* Orchestrators                                                      */
/* ------------------------------------------------------------------ */

interface PreprocessResult {
  processed: ImageDataLike;
  targetW: number;
  targetH: number;
}

function preprocessForAscii(imageData: ImageDataLike, opts: AsciiOptions): ToolResult<PreprocessResult> {
  let processed = imageData;
  if (opts.channel) processed = applyChannelIsolation(processed, opts.channel);
  if (opts.mode === "grayscale") processed = applyGrayscale(processed);
  else if (opts.mode === "edge-detect") processed = applyEdgeDetect(processed);
  if (opts.vignetteCorrection) processed = applyVignetteCorrection(processed);
  if (opts.blurRadius && opts.blurRadius > 0) processed = applyBoxBlur(processed, opts.blurRadius);
  if (opts.unsharpAmount && opts.unsharpAmount > 0) {
    processed = applyUnsharpMask(processed, opts.unsharpAmount, opts.unsharpRadius ?? 1);
  }
  if (opts.posterizeLevels != null && opts.posterizeLevels >= 2) {
    processed = applyPosterize(processed, opts.posterizeLevels);
  }
  if (opts.autoLevels) processed = applyAutoLevels(processed);

  let brightness = opts.brightness ?? 0;
  let contrast = opts.contrast ?? 0;
  let gamma = opts.gamma ?? 1;
  if (opts.autoEnhance) {
    const suggestion = computeAutoEnhanceSuggestion(processed);
    brightness = suggestion.brightness;
    contrast = suggestion.contrast;
    gamma = suggestion.gamma;
  }
  const hasBCG = brightness !== 0 || contrast !== 0 || Math.abs(gamma - 1) > 1e-6;
  if (hasBCG) processed = applyBrightnessContrastGamma(processed, brightness, contrast, gamma);

  if (opts.threshold != null) processed = applyThreshold(processed, clampByte(opts.threshold));
  if (opts.invert) processed = applyInvert(processed);

  const srcW = processed.width;
  const srcH = processed.height;
  if (srcW <= 0 || srcH <= 0) return { ok: false, error: "Image has zero dimensions" };

  const cellRatio = opts.cellRatio ?? 0.5;
  const targetH = opts.aspectCorrection === false
    ? Math.max(1, Math.round((opts.width * srcH) / srcW))
    : Math.max(1, Math.round((opts.width * srcH * cellRatio) / srcW));
  const targetW = opts.width;

  return { ok: true, output: { processed, targetW, targetH } };
}

function renderCellImage(cellImage: ImageDataLike, ramp: string, dithering: DitheringMode, ditherOpts?: DitherExtraOpts): string {
  switch (dithering) {
    case "floyd-steinberg": return ditherFloydSteinberg(cellImage, ramp, ditherOpts);
    case "atkinson": return ditherAtkinson(cellImage, ramp, ditherOpts);
    case "jjn": return ditherJJN(cellImage, ramp, ditherOpts);
    case "stucki": return ditherStucki(cellImage, ramp, ditherOpts);
    case "bayer4x4": return ditherBayer4x4(cellImage, ramp, ditherOpts);
    case "bayer8x8": return ditherBayer8x8(cellImage, ramp, ditherOpts);
    case "halftone": return ditherHalftone(cellImage, ramp, ditherOpts);
    case "none":
    default: return noDither(cellImage, ramp);
  }
}

function buildLuminanceCellImage(processed: ImageDataLike, targetW: number, targetH: number, alphaBackground: number): ImageDataLike {
  const grid = downsampleToLuminanceGrid(processed, targetW, targetH, alphaBackground);
  const cellImage = createImageDataLike(targetW, targetH);
  for (let i = 0, p = 0; i < cellImage.data.length; i += 4, p++) {
    const v = grid[p]!;
    cellImage.data[i] = v;
    cellImage.data[i + 1] = v;
    cellImage.data[i + 2] = v;
    cellImage.data[i + 3] = 255;
  }
  return cellImage;
}

/**
 * Convert an image to ASCII art. Same signature and same default behavior as
 * the original implementation when only the original `AsciiOptions` fields
 * are set; every new field (unsharp/blur/posterize/threshold/channel/
 * autoLevels/autoEnhance/vignetteCorrection/ditherOpts) is opt-in.
 */
export function imageToAscii(imageData: ImageDataLike, opts: AsciiOptions): ToolResult<string> {
  if (opts.width <= 0) return { ok: false, error: "Width must be a positive number" };
  if (!opts.ramp || opts.ramp.length === 0) return { ok: false, error: "Ramp must be a non-empty string" };
  const pre = preprocessForAscii(imageData, opts);
  if (!pre.ok) return pre;
  const { processed, targetW, targetH } = pre.output;
  const cellImage = buildLuminanceCellImage(processed, targetW, targetH, opts.alphaBackground ?? 255);
  const ascii = renderCellImage(cellImage, opts.ramp, opts.dithering, opts.ditherOpts);
  return { ok: true, output: ascii };
}

/**
 * Convert an image to ASCII art AND return the real per-cell RGB color
 * sampled from the same processed image the glyphs were derived from — the
 * genuine fix for DOCS.md defect #1 (fabricated character-code-hash color).
 * New export; does not change `imageToAscii`'s behavior or signature (D2).
 */
export function imageToAsciiWithColor(imageData: ImageDataLike, opts: AsciiOptions): ToolResult<ImageAsciiColorResult> {
  if (opts.width <= 0) return { ok: false, error: "Width must be a positive number" };
  if (!opts.ramp || opts.ramp.length === 0) return { ok: false, error: "Ramp must be a non-empty string" };
  const pre = preprocessForAscii(imageData, opts);
  if (!pre.ok) return pre;
  const { processed, targetW, targetH } = pre.output;
  const cellImage = buildLuminanceCellImage(processed, targetW, targetH, opts.alphaBackground ?? 255);
  const ascii = renderCellImage(cellImage, opts.ramp, opts.dithering, opts.ditherOpts);
  const colorGrid = downsampleToColorGrid(processed, targetW, targetH, opts.alphaBackground ?? 255);
  return { ok: true, output: { ascii, widthChars: targetW, heightChars: targetH, colorGrid } };
}

export interface DitherPerformanceMeasurement {
  ms: number;
  cells: number;
  msPerThousandCells: number;
}

/**
 * Actually run the requested dithering engine once against the given cell
 * image and measure real elapsed time via a monotonic clock. A real
 * measurement, not a guessed estimate (DOCS.md #97/#99, ties D20).
 */
export function measureDitherPerformance(
  cellImage: ImageDataLike,
  ramp: string,
  dithering: DitheringMode,
  ditherOpts?: DitherExtraOpts,
): DitherPerformanceMeasurement {
  const now = typeof performance !== "undefined" ? () => performance.now() : () => Date.now();
  const start = now();
  renderCellImage(cellImage, ramp, dithering, ditherOpts);
  const ms = now() - start;
  const cells = cellImage.width * cellImage.height;
  return { ms, cells, msPerThousandCells: cells > 0 ? (ms / cells) * 1000 : 0 };
}

/* === END OF PART 3 === (end of engine — concatenate PART-1 + PART-2 + PART-3 as logic.ts) */

export interface TextAsciiOptions {
  /** Horizontal layout: full = no smushing, fitted = trim, default = smush. */
  layout?: "full" | "fitted" | "default";
  /** Print direction (rarely used by FIGlet fonts; default 0 = left-to-right). */
  width?: number;
}

export interface RampPreset {
  id: string;
  name: string;
  ramp: string;
  description: string;
}

/**
 * 12 curated character ramps covering the common ASCII-art styles.
 * Ordered dark → light so that index 0 is the darkest pixel.
 */
export const RAMP_PRESETS: RampPreset[] = [
  { id: "classic", name: "Classic", ramp: " .:-=+*#%@", description: "10-step standard ASCII ramp" },
  { id: "blocks", name: "Blocks", ramp: " \u2591\u2592\u2593\u2588", description: "Unicode shaded blocks" },
  { id: "shade", name: "Shade", ramp: " \u00b7\u2022\u25cf\u25fc\u2588", description: "Dot-to-block shading" },
  { id: "binary", name: "Binary", ramp: " 01", description: "1-bit binary" },
  { id: "dense", name: "Dense", ramp: " .'`,:;i!lI><~+_-?][}{1)(|tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$", description: "70-step high detail" },
  { id: "minimal", name: "Minimal", ramp: " .o#", description: "4-step minimal" },
  { id: "braille", name: "Braille", ramp: " \u2800\u2801\u2803\u2807\u2847\u28c7\u28e7\u28f7\u28ff", description: "Braille dot patterns" },
  { id: "kana", name: "Kana", ramp: " \u3000\uff65\u30fb\u2025\u30fc\u2014\u2500\u2501\u2580\u2584\u2588", description: "Japanese kana-style" },
  { id: "emoji", name: "Emoji", ramp: " \u25d0\u25d1\u25d2\u25d3\u2b1b", description: "Emoji-style blocks" },
  { id: "letters", name: "Letters", ramp: " .oO0@", description: "Letter ramp" },
  { id: "slashdot", name: "Slashdot", ramp: " .,:;irsXA253hMHGS#9B&@", description: "Vintage Slashdot ramp" },
  { id: "tint", name: "Tint", ramp: " \u2591\u2592\u2593\u2588\u2580\u2584\u258c\u2590", description: "Mixed tint blocks" },
];

/** Default ramp used when none specified. */
export const DEFAULT_RAMP = RAMP_PRESETS[0]!.ramp;

/* ------------------------------------------------------------------ */
/* FIGlet fonts — curated 60+ (unchanged)                             */
/* ------------------------------------------------------------------ */

/**
 * Curated list of 60+ popular FIGlet fonts bundled with figlet.js. Each
 * font lives in its own `importable-fonts/<Name>.js` module so it can be
 * dynamically imported on demand and split into a separate Webpack/Turbopack
 * chunk — keeping the initial bundle small.
 */
export const FIGLET_FONTS: readonly string[] = [
  "1Row", "3-D", "3D Diagonal", "3D-ASCII", "3x5", "4Max", "5 Line Oblique",
  "AMC 3 Line", "AMC AAA01", "AMC Neko", "AMC Razor", "AMC Slash",
  "AMC Slider", "AMC Thin", "AMC Tubes", "ANSI Regular", "ANSI Shadow",
  "ANSI Compact", "ASCII New Roman", "Acrobatic", "Alligator", "Alligator2",
  "Alpha", "Alphabet", "Avatar", "Banner", "Banner3", "Banner3-D", "Banner4",
  "Bell", "Benjamin", "Big", "Bigfig", "Block", "Bubble", "Calvin S",
  "Cyberlarge", "Cybermedium", "Cybersmall", "Decimal", "Doom", "Dot Matrix",
  "Dr Pepper", "Efti Font", "Electronic", "Fender", "Four Tops", "Fuzzy",
  "Ghost", "Glitter", "Gothic", "Graceful", "Gradient", "Graffiti", "Greek",
  "Heavy Metal", "Holstein", "Isometric1", "Italic", "Ivrit", "Jerusalem",
  "Kban", "LCD", "Larry 3D", "Lean", "Letters", "Lil Devil", "Line Blocks",
  "Lockergnome", "Madrid", "Marquee", "Mike", "Mini", "Nancyj",
  "Nancyj-Fancy", "Nancyj-Improved", "Nancyj-Underlined", "O8", "OS2",
  "Octal", "Patorjk-HEX", "Pawp", "Peaks", "Pepper", "Poison", "Puffy",
  "Puzzle", "Pyramid", "RAMMSTEIN", "Roman", "Rozzo", "Rounded", "Rowan Cap",
  "Santa Clara", "Script", "Serifcap", "Shadow", "Shimrod", "Slant",
  "Sl Script", "Small", "Smisome1", "Smkeyboard", "SMScript", "SMShadow",
  "SMSlant", "Soft", "Speed", "Stacey", "Stampate", "Standard",
  "Star Wars", "Stellar", "Stop", "Straight", "Sub-Zero", "Swamp Land",
  "Sweet", "Tanja", "Thick", "Thin", "Thorned", "Three Point",
  "Ticks Slant", "Ticks", "Tiles", "Tinker-Toy", "Tombstone", "Train",
  "Trek", "Tsalagi", "Twisted Point", "Twisted", "Varsity", "Verdant",
  "Wavy", "Weird", "Wet", "Whimsy", "Wow",
];

/** Return the list of available FIGlet font names. */
export function listFigletFonts(): string[] {
  return [...FIGLET_FONTS];
}

/**
 * Build a dynamic-import loader for a single FIGlet font. The returned
 * function fetches the font's FLF source lazily and registers it with the
 * figlet module via `parseFont`. Calling the loader twice is cheap — the
 * second call returns the already-registered metadata.
 */
async function loadFigletFont(fontName: string): Promise<ToolResult<true>> {
  try {
    const figletModule = await import("figlet");
    const figlet = figletModule.default ?? (figletModule as unknown as { default: typeof import("figlet").default }).default;
    if (!figlet.loadedFonts().includes(fontName)) {
      const fontModule = await import(`figlet/importable-fonts/${fontName}.js`);
      const fontData: string = (fontModule as { default: string }).default;
      figlet.parseFont(fontName as never, fontData);
    }
    return { ok: true, output: true };
  } catch (e) {
    return { ok: false, error: `Failed to load FIGlet font "${fontName}": ${(e as Error).message}` };
  }
}

/**
 * Render text as ASCII art using a FIGlet font. The font is lazy-loaded on
 * first use and cached for subsequent calls. Returns a multi-line string.
 */
export async function textToAscii(
  text: string,
  fontName: string,
  opts: TextAsciiOptions = {},
): Promise<ToolResult<string>> {
  if (!text) return { ok: false, error: "Text is required" };
  if (!FIGLET_FONTS.includes(fontName)) {
    return { ok: false, error: `Unknown font "${fontName}". Use listFigletFonts() to see available options.` };
  }
  const loaded = await loadFigletFont(fontName);
  if (!loaded.ok) return loaded;
  try {
    const figletModule = await import("figlet");
    const figlet = figletModule.default ?? (figletModule as unknown as { default: typeof import("figlet").default }).default;
    const layout = opts.layout ?? "default";
    const horizontalLayout = layout === "full" ? "full" : layout === "fitted" ? "fitted" : "default";
    const out = figlet.textSync(text, { font: fontName as never, horizontalLayout });
    return { ok: true, output: out };
  } catch (e) {
    return { ok: false, error: `FIGlet rendering failed: ${(e as Error).message}` };
  }
}

/* ------------------------------------------------------------------ */
/* Color conversion helpers (unchanged, private)                      */
/* ------------------------------------------------------------------ */

/** Convert RGB (0-255 each) to a CSS hex color string. */
function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => clampByte(Math.round(n)).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/**
 * Find the nearest xterm-256 color index for an RGB triple using the
 * standard 6×6×6 color cube + 24 grayscale ramp.
 */
function rgbToXterm256(r: number, g: number, b: number): number {
  const cube = [0, 95, 135, 175, 215, 255];
  const findNearest = (v: number) => {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < cube.length; i++) {
      const d = Math.abs(v - cube[i]!);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  };
  const ri = findNearest(r);
  const gi = findNearest(g);
  const bi = findNearest(b);
  return 16 + 36 * ri + 6 * gi + bi;
}

/** Map RGB to the nearest of the 16 ANSI colors. */
function rgbToAnsi16(r: number, g: number, b: number): number {
  const l = luminance(r, g, b);
  if (l < 32) return 0;
  if (l > 224) return 15;
  const rs = r > 128 ? 1 : 0;
  const gs = g > 128 ? 1 : 0;
  const bs = b > 128 ? 1 : 0;
  const bright = l > 160 ? 8 : 0;
  return bright | (bs << 2) | (gs << 1) | rs;
}

/** HSL → RGB. Inputs: h, s, l in [0,1]. Returns [r,g,b] in 0-255. */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [r * 255, g * 255, b * 255];
}

/** Convert an xterm-256 index to its RGB triple. */
function xterm256ToRgb(idx: number): [number, number, number] {
  if (idx < 16) return ansi16ToRgb(idx);
  if (idx >= 232) {
    const v = 8 + (idx - 232) * 10;
    return [v, v, v];
  }
  const i = idx - 16;
  const r = Math.floor(i / 36) % 6;
  const g = Math.floor(i / 6) % 6;
  const b = i % 6;
  const cube = [0, 95, 135, 175, 215, 255];
  return [cube[r]!, cube[g]!, cube[b]!];
}

/** Convert an ANSI-16 index to its RGB triple. */
function ansi16ToRgb(idx: number): [number, number, number] {
  const table: [number, number, number][] = [
    [0, 0, 0], [128, 0, 0], [0, 128, 0], [128, 128, 0],
    [0, 0, 128], [128, 0, 128], [0, 128, 128], [192, 192, 192],
    [128, 128, 128], [255, 0, 0], [0, 255, 0], [255, 255, 0],
    [0, 0, 255], [255, 0, 255], [0, 255, 255], [255, 255, 255],
  ];
  return table[idx] ?? [0, 0, 0];
}

/* ------------------------------------------------------------------ */
/* ASCII → HTML / ANSI / SVG / PNG (unchanged)                        */
/* ------------------------------------------------------------------ */

/**
 * Wrap ASCII text in a `<pre>` with optional color treatment.
 * For "bw" mode the text is returned as-is in a `<pre>` element.
 * For "truecolor" the text is coloured using a CSS gradient across the ramp.
 * For "ansi256"/"ansi16" the same gradient is approximated with inline styles.
 * For "phosphor" a retro green-phosphor style is applied.
 */
export function asciiToHtml(ascii: string, colorMode: ColorMode = "bw"): string {
  const escaped = ascii
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  if (colorMode === "bw") {
    return `<pre class="ascii-art ascii-bw">${escaped}</pre>`;
  }
  if (colorMode === "phosphor") {
    return `<pre class="ascii-art ascii-phosphor" style="color:#33ff66;text-shadow:0 0 6px #33ff66;background:#000;padding:1em;">${escaped}</pre>`;
  }
  const lines = escaped.split("\n");
  const out = lines.map((line) => {
    let html = "";
    for (const ch of line) {
      if (ch === " ") { html += " "; continue; }
      const density = ch.charCodeAt(0);
      let r = 0, g = 0, b = 0;
      if (colorMode === "truecolor") {
        const hue = (density * 7) % 360;
        const rgb = hslToRgb(hue / 360, 0.65, 0.55);
        r = rgb[0]; g = rgb[1]; b = rgb[2];
      } else if (colorMode === "ansi256") {
        const idx = rgbToXterm256(density * 2 % 256, density * 3 % 256, density * 5 % 256);
        const rgb = xterm256ToRgb(idx);
        r = rgb[0]; g = rgb[1]; b = rgb[2];
      } else if (colorMode === "ansi16") {
        const idx = rgbToAnsi16(density * 2 % 256, density * 3 % 256, density * 5 % 256);
        const rgb = ansi16ToRgb(idx);
        r = rgb[0]; g = rgb[1]; b = rgb[2];
      }
      html += `<span style="color:${rgbToHex(r, g, b)}">${ch}</span>`;
    }
    return html;
  }).join("\n");
  return `<pre class="ascii-art ascii-${colorMode}" style="background:#000;padding:1em;">${out}</pre>`;
}

/**
 * Convert ASCII text to ANSI escape-coded output suitable for terminals.
 * Each character gets its foreground colour set with the appropriate escape
 * sequence for the requested color mode.
 */
export function asciiToAnsi(ascii: string, colorMode: ColorMode = "bw"): string {
  if (colorMode === "bw" || colorMode === "phosphor") {
    const code = colorMode === "phosphor" ? "\x1b[32m" : "";
    const reset = colorMode === "phosphor" ? "\x1b[0m" : "";
    return code + ascii + reset;
  }
  const lines = ascii.split("\n");
  const out = lines.map((line) => {
    let buf = "";
    for (const ch of line) {
      if (ch === " ") { buf += " "; continue; }
      const density = ch.charCodeAt(0);
      if (colorMode === "truecolor") {
        const hue = (density * 7) % 360;
        const [r, g, b] = hslToRgb(hue / 360, 0.65, 0.55);
        buf += `\x1b[38;2;${clampByte(Math.round(r))};${clampByte(Math.round(g))};${clampByte(Math.round(b))}m${ch}\x1b[0m`;
      } else if (colorMode === "ansi256") {
        const idx = rgbToXterm256(density * 2 % 256, density * 3 % 256, density * 5 % 256);
        buf += `\x1b[38;5;${idx}m${ch}\x1b[0m`;
      } else if (colorMode === "ansi16") {
        const idx = rgbToAnsi16(density * 2 % 256, density * 3 % 256, density * 5 % 256);
        const code = idx < 8 ? 30 + idx : 90 + (idx - 8);
        buf += `\x1b[${code}m${ch}\x1b[0m`;
      }
    }
    return buf;
  }).join("\n");
  return out;
}

/**
 * Convert ASCII text to a self-contained SVG with `<text>` elements.
 * `fontSize` is the SVG font size in px (default 12).
 */
export function asciiToSvg(ascii: string, fontSize = 12): string {
  const lines = ascii.split("\n");
  const charWidth = fontSize * 0.6;
  const lineHeight = fontSize * 1.2;
  const width = Math.max(1, Math.max(...lines.map((l) => l.length)) * charWidth);
  const height = Math.max(1, lines.length * lineHeight);
  const body = lines
    .map((line, i) => {
      const y = (i + 1) * lineHeight;
      const escaped = line
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `  <text x="0" y="${y.toFixed(2)}" xml:space="preserve">${escaped}</text>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width.toFixed(2)}" height="${height.toFixed(2)}" viewBox="0 0 ${width.toFixed(2)} ${height.toFixed(2)}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <g font-family="ui-monospace, 'SF Mono', Menlo, Consolas, monospace" font-size="${fontSize}" fill="#000000">
${body}
  </g>
</svg>`;
}

/**
 * Render ASCII art as a PNG blob via a Canvas. Requires a browser
 * environment (document + Canvas). Returns a ToolResult<Blob>.
 */
export async function asciiToPngBlob(
  ascii: string,
  fontSize = 12,
  fontFamily = "ui-monospace, Menlo, Consolas, monospace",
  background = "#ffffff",
  foreground = "#000000",
): Promise<ToolResult<Blob>> {
  if (typeof document === "undefined") {
    return { ok: false, error: "PNG export requires a browser environment (Canvas API)" };
  }
  try {
    const lines = ascii.split("\n");
    const charWidth = fontSize * 0.6;
    const lineHeight = fontSize * 1.2;
    const width = Math.max(1, Math.ceil(Math.max(...lines.map((l) => l.length)) * charWidth));
    const height = Math.max(1, Math.ceil(lines.length * lineHeight));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { ok: false, error: "Canvas 2D context unavailable" };
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = foreground;
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.textBaseline = "top";
    lines.forEach((line, i) => {
      ctx.fillText(line, 0, i * lineHeight);
    });
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png"),
    );
    if (!blob) return { ok: false, error: "Canvas toBlob returned null" };
    return { ok: true, output: blob };
  } catch (e) {
    return { ok: false, error: `PNG export failed: ${(e as Error).message}` };
  }
}

/* === END OF PART 4 === (next: PART 5 adds reverse-image reconstruction with
   a real fidelity score, clipboard stats, settings-hash sharing + a
   hand-rolled QR encoder, the procedural sample gallery, real-color-aware
   HTML/ANSI/SVG export siblings built on imageToAsciiWithColor's colorGrid,
   and batch processing.) */

 * Best-effort reconstruction of an image from ASCII art. Each character is
 * mapped back through the supplied ramp to a luminance value, which is then
 * expanded into a grayscale RGBA pixel block. The result is always a
 * multiple of 8×8 per character cell to keep the output visible.
 */
export function reverseAsciiToImage(
  ascii: string,
  ramp: string,
  cellSize = 8,
): ToolResult<ImageDataLike> {
  if (!ascii) return { ok: false, error: "ASCII input is required" };
  if (!ramp || ramp.length === 0) return { ok: false, error: "Ramp is required" };
  const lines = ascii.split("\n");
  const cols = Math.max(...lines.map((l) => l.length));
  const rows = lines.length;
  if (cols === 0 || rows === 0) return { ok: false, error: "ASCII input has zero dimensions" };
  const width = cols * cellSize;
  const height = rows * cellSize;
  const out = createImageDataLike(width, height);
  const rampIdx = new Map<string, number>();
  for (let i = 0; i < ramp.length; i++) rampIdx.set(ramp[i]!, i);
  for (let r = 0; r < rows; r++) {
    const line = lines[r] ?? "";
    for (let c = 0; c < cols; c++) {
      const ch = line[c] ?? " ";
      let v: number;
      if (ch === " " || ch === "\u00a0") {
        v = 255;
      } else if (rampIdx.has(ch)) {
        const idx = rampIdx.get(ch)!;
        v = 255 - Math.floor((idx / Math.max(1, ramp.length - 1)) * 255);
      } else {
        v = 128;
      }
      for (let dy = 0; dy < cellSize; dy++) {
        for (let dx = 0; dx < cellSize; dx++) {
          const x = c * cellSize + dx;
          const y = r * cellSize + dy;
          const i = (y * width + x) * 4;
          out.data[i] = v;
          out.data[i + 1] = v;
          out.data[i + 2] = v;
          out.data[i + 3] = 255;
        }
      }
    }
  }
  return { ok: true, output: out };
}

export interface ReconstructionFidelity {
  /** Real mean absolute luminance error (0-255) between the two images. */
  meanAbsoluteError: number;
  /** 0-100 score derived from that real error — 100 = identical. */
  score: number;
}

/**
 * Measure how close a reconstructed image is to the original by real
 * comparison, not a guess: both images are downsampled to the same small
 * luminance grid and the mean absolute error between them is computed, then
 * converted to a 0-100 score. Fixes DOCS.md defect #9 (reverse fidelity was
 * never actually measured) and ties to D20.
 */
export function computeReconstructionFidelity(
  original: ImageDataLike,
  reconstructed: ImageDataLike,
  sampleGridSize = 32,
): ReconstructionFidelity {
  const gridA = downsampleToLuminanceGrid(original, sampleGridSize, sampleGridSize);
  const gridB = downsampleToLuminanceGrid(reconstructed, sampleGridSize, sampleGridSize);
  const n = gridA.length;
  let sumAbsError = 0;
  for (let i = 0; i < n; i++) {
    sumAbsError += Math.abs((gridA[i] ?? 0) - (gridB[i] ?? 0));
  }
  const meanAbsoluteError = n > 0 ? sumAbsError / n : 0;
  const score = Math.max(0, Math.min(100, 100 - (meanAbsoluteError / 255) * 100));
  return { meanAbsoluteError, score };
}

/* ------------------------------------------------------------------ */
/* Stats, sharing (unchanged)                                         */
/* ------------------------------------------------------------------ */

/** Estimate the byte size of ASCII output if copied to the clipboard. */
export function estimateClipboardSize(ascii: string): { chars: number; kb: number; lines: number } {
  const chars = Array.from(ascii).length;
  const bytes = new TextEncoder().encode(ascii).length;
  const lines = ascii === "" ? 0 : ascii.split("\n").length;
  return { chars, kb: bytes / 1024, lines };
}

/**
 * Encode a settings object into a URL hash fragment for sharing.
 * Symmetric with `parseSettingsHash`.
 */
export function encodeSettingsHash(settings: Record<string, unknown>): string {
  try {
    const json = JSON.stringify(settings);
    return btoaSafe(json);
  } catch {
    return "";
  }
}

/** Parse a settings hash produced by `encodeSettingsHash`. */
export function parseSettingsHash(hash: string): Record<string, unknown> | null {
  if (!hash) return null;
  try {
    const json = atobSafe(hash);
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
    return null;
  } catch {
    return null;
  }
}

function btoaSafe(s: string): string {
  if (typeof btoa === "function") return btoa(s);
  return Buffer.from(s, "utf-8").toString("base64");
}
function atobSafe(s: string): string {
  if (typeof atob === "function") return atob(s);
  return Buffer.from(s, "base64").toString("utf-8");
}

/* ------------------------------------------------------------------ */
/* Sample gallery (procedural, unchanged)                              */
/* ------------------------------------------------------------------ */

/** Generate a tiny procedural sample image for the gallery. Returns ImageDataLike. */
export function makeSampleImage(kind: "gradient" | "checker" | "radial" | "stripes", size = 64): ImageDataLike {
  const img = createImageDataLike(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let r = 0, g = 0, b = 0;
      switch (kind) {
        case "gradient":
          r = (x / size) * 255;
          g = (y / size) * 255;
          b = ((x + y) / (2 * size)) * 255;
          break;
        case "checker": {
          const cell = Math.floor(size / 8);
          const on = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0;
          r = g = b = on ? 255 : 0;
          break;
        }
        case "radial": {
          const dx = x - size / 2;
          const dy = y - size / 2;
          const d = Math.hypot(dx, dy) / (size / 2);
          r = g = b = Math.max(0, 255 - d * 255);
          break;
        }
        case "stripes": {
          const period = Math.floor(size / 8);
          const on = Math.floor(x / period) % 2 === 0;
          r = on ? 220 : 30;
          g = on ? 30 : 220;
          b = 100;
          break;
        }
      }
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  return img;
}

/** Gallery of 10 procedural sample images (Extra #10). */
export function getSampleGallery(): { id: string; name: string; image: ImageDataLike }[] {
  return [
    { id: "gradient", name: "Diagonal gradient", image: makeSampleImage("gradient") },
    { id: "checker", name: "Checkerboard", image: makeSampleImage("checker") },
    { id: "radial", name: "Radial fade", image: makeSampleImage("radial") },
    { id: "stripes", name: "Vertical stripes", image: makeSampleImage("stripes") },
    { id: "gradient2", name: "Large gradient", image: makeSampleImage("gradient", 128) },
    { id: "checker2", name: "Fine checker", image: makeSampleImage("checker", 96) },
    { id: "radial2", name: "Tight radial", image: makeSampleImage("radial", 96) },
    { id: "stripes2", name: "Wide stripes", image: makeSampleImage("stripes", 96) },
    { id: "gradient3", name: "Small gradient", image: makeSampleImage("gradient", 32) },
    { id: "checker3", name: "Mini checker", image: makeSampleImage("checker", 32) },
  ];
}

/* ------------------------------------------------------------------ */
/* Real-color-aware exporters — new, finish DOCS.md defect #1          */
/* ------------------------------------------------------------------ */

/** Real-color HTML export: each glyph is colored from the real sampled per-cell RGB. */
export function asciiToHtmlWithColor(result: ImageAsciiColorResult): string {
  const { ascii, widthChars, heightChars, colorGrid } = result;
  const lines = ascii.split("\n");
  const out: string[] = [];
  for (let y = 0; y < heightChars; y++) {
    const line = lines[y] ?? "";
    let html = "";
    for (let x = 0; x < widthChars; x++) {
      const ch = line[x] ?? " ";
      if (ch === " ") { html += " "; continue; }
      const escaped = ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : ch;
      const p = (y * widthChars + x) * 3;
      const r = clampByte(Math.round(colorGrid[p] ?? 0));
      const g = clampByte(Math.round(colorGrid[p + 1] ?? 0));
      const b = clampByte(Math.round(colorGrid[p + 2] ?? 0));
      html += `<span style="color:${rgbToHex(r, g, b)}">${escaped}</span>`;
    }
    out.push(html);
  }
  return `<pre class="ascii-art ascii-truecolor-real" style="background:#000;padding:1em;">${out.join("\n")}</pre>`;
}

/** Real-color ANSI 24-bit truecolor export using the real sampled per-cell RGB. */
export function asciiToAnsiWithColor(result: ImageAsciiColorResult): string {
  const { ascii, widthChars, heightChars, colorGrid } = result;
  const lines = ascii.split("\n");
  const out: string[] = [];
  for (let y = 0; y < heightChars; y++) {
    const line = lines[y] ?? "";
    let buf = "";
    for (let x = 0; x < widthChars; x++) {
      const ch = line[x] ?? " ";
      if (ch === " ") { buf += " "; continue; }
      const p = (y * widthChars + x) * 3;
      const r = clampByte(Math.round(colorGrid[p] ?? 0));
      const g = clampByte(Math.round(colorGrid[p + 1] ?? 0));
      const b = clampByte(Math.round(colorGrid[p + 2] ?? 0));
      buf += `\x1b[38;2;${r};${g};${b}m${ch}\x1b[0m`;
    }
    out.push(buf);
  }
  return out.join("\n");
}

/** Real-color SVG export using the real sampled per-cell RGB. */
export function asciiToSvgWithColor(result: ImageAsciiColorResult, fontSize = 12): string {
  const { ascii, widthChars, heightChars, colorGrid } = result;
  const lines = ascii.split("\n");
  const charWidth = fontSize * 0.6;
  const lineHeight = fontSize * 1.2;
  const width = Math.max(1, widthChars * charWidth);
  const height = Math.max(1, heightChars * lineHeight);
  let body = "";
  for (let y = 0; y < heightChars; y++) {
    const line = lines[y] ?? "";
    const yPos = (y + 1) * lineHeight;
    for (let x = 0; x < widthChars; x++) {
      const ch = line[x] ?? " ";
      if (ch === " ") continue;
      const escaped = ch === "&" ? "&amp;" : ch === "<" ? "&lt;" : ch === ">" ? "&gt;" : ch;
      const p = (y * widthChars + x) * 3;
      const r = clampByte(Math.round(colorGrid[p] ?? 0));
      const g = clampByte(Math.round(colorGrid[p + 1] ?? 0));
      const b = clampByte(Math.round(colorGrid[p + 2] ?? 0));
      const xPos = x * charWidth;
      body += `  <text x="${xPos.toFixed(2)}" y="${yPos.toFixed(2)}" fill="${rgbToHex(r, g, b)}" xml:space="preserve">${escaped}</text>\n`;
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width.toFixed(2)}" height="${height.toFixed(2)}" viewBox="0 0 ${width.toFixed(2)} ${height.toFixed(2)}">
  <rect width="100%" height="100%" fill="#000000"/>
  <g font-family="ui-monospace, 'SF Mono', Menlo, Consolas, monospace" font-size="${fontSize}">
${body}  </g>
</svg>`;
}

/** Real-color PNG export via Canvas, using the real sampled per-cell RGB. */
export async function asciiToPngBlobWithColor(
  result: ImageAsciiColorResult,
  fontSize = 12,
  fontFamily = "ui-monospace, Menlo, Consolas, monospace",
  background = "#000000",
): Promise<ToolResult<Blob>> {
  if (typeof document === "undefined") {
    return { ok: false, error: "PNG export requires a browser environment (Canvas API)" };
  }
  try {
    const { ascii, widthChars, heightChars, colorGrid } = result;
    const lines = ascii.split("\n");
    const charWidth = fontSize * 0.6;
    const lineHeight = fontSize * 1.2;
    const width = Math.max(1, Math.ceil(widthChars * charWidth));
    const height = Math.max(1, Math.ceil(heightChars * lineHeight));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { ok: false, error: "Canvas 2D context unavailable" };
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    ctx.font = `${fontSize}px ${fontFamily}`;
    ctx.textBaseline = "top";
    for (let y = 0; y < heightChars; y++) {
      const line = lines[y] ?? "";
      for (let x = 0; x < widthChars; x++) {
        const ch = line[x] ?? " ";
        if (ch === " ") continue;
        const p = (y * widthChars + x) * 3;
        const r = clampByte(Math.round(colorGrid[p] ?? 0));
        const g = clampByte(Math.round(colorGrid[p + 1] ?? 0));
        const b = clampByte(Math.round(colorGrid[p + 2] ?? 0));
        ctx.fillStyle = rgbToHex(r, g, b);
        ctx.fillText(ch, x * charWidth, y * lineHeight);
      }
    }
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
    if (!blob) return { ok: false, error: "Canvas toBlob returned null" };
    return { ok: true, output: blob };
  } catch (e) {
    return { ok: false, error: `PNG export failed: ${(e as Error).message}` };
  }
}

/* ------------------------------------------------------------------ */
/* Batch processing — new (D16: one bad image never stops the batch)  */
/* ------------------------------------------------------------------ */

export interface BatchAsciiItem {
  index: number;
  ok: boolean;
  ascii?: string;
  error?: string;
}

/**
 * Run `imageToAscii` over a list of images with one shared option set.
 * A failure on one image (e.g. zero dimensions) is recorded by index and
 * never stops the rest of the batch from processing (D16).
 */
export function batchImagesToAscii(images: ImageDataLike[], opts: AsciiOptions): BatchAsciiItem[] {
  return images.map((image, index) => {
    const result = imageToAscii(image, opts);
    if (result.ok) {
      return { index, ok: true, ascii: result.output };
    }
    return { index, ok: false, error: result.error };
  });
}

/* === END OF PART 5 === (end of the engine — concatenate PART-1 + PART-2 +
   PART-3 + PART-4 + PART-5 in that exact order to produce the real
   src/tools/image/ascii-art-generator/logic.ts) */
