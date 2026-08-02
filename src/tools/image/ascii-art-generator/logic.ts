/**
 * ASCII Art Generator — pure logic.
 *
 * No DOM access is required for the dithering / filter / FIGlet / export
 * helpers — they operate on plain `ImageDataLike` objects ({ width, height,
 * data: Uint8ClampedArray }) which the UI creates from a Canvas and the test
 * suite builds inline. Browser-only side effects (canvas rasterisation for
 * PNG export, dynamic font import for FIGlet) are isolated to the two async
 * functions `asciiToPngBlob` and `textToAscii`.
 *
 * Dithering engines operate on a *cell-resolution* luminance grid (1 cell =
 * 1 character). The UI downsamples the source image to the target width
 * before calling a dithering function. `imageToAscii` is the high-level
 * orchestrator that accepts a full-resolution image and runs the whole
 * pipeline (filters → downsample → dither → ramp-map).
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

export type DitheringMode = "none" | "floyd-steinberg" | "atkinson" | "jjn" | "stucki";

export type ColorMode = "bw" | "truecolor" | "ansi256" | "ansi16" | "phosphor";

export type ProcessMode = "normal" | "grayscale" | "edge-detect";

export interface AsciiOptions {
  /** Target output width in characters (cells). */
  width: number;
  /** Character ramp from dark → light. */
  ramp: string;
  /** Dithering engine to apply. */
  dithering: DitheringMode;
  /** Brightness offset, -100..100 (0 = no change). */
  brightness?: number;
  /** Contrast multiplier, -100..100 (0 = no change). */
  contrast?: number;
  /** Gamma exponent, 0.1..3.0 (1.0 = no change). */
  gamma?: number;
  /** Invert luminance. */
  invert?: boolean;
  /** Pre-processing mode. */
  mode?: ProcessMode;
  /** Apply monospace cell aspect correction (height halved). */
  aspectCorrection?: boolean;
  /** Character cell width/height ratio. Default 0.5. */
  cellRatio?: number;
  /** Treat transparent pixels as this background luminance (0-255). */
  alphaBackground?: number;
}

export interface TextAsciiOptions {
  /** Horizontal layout: full = no smushing, fitted = trim, default = smush. */
  layout?: "full" | "fitted" | "default";
  /** Print direction (rarely used by FIGlet fonts; default 0 = left-to-right). */
  width?: number;
}

export interface ImageAsciiResult {
  ascii: string;
  widthChars: number;
  heightChars: number;
  charCount: number;
}

/* ------------------------------------------------------------------ */
/* Preset ramps                                                       */
/* ------------------------------------------------------------------ */

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
/* FIGlet fonts — curated 60+                                         */
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
    // Dynamic import of figlet itself — bundled separately, ~150KB.
    const figletModule = await import("figlet");
    const figlet = figletModule.default ?? (figletModule as unknown as { default: typeof import("figlet").default }).default;
    if (!figlet.loadedFonts().includes(fontName)) {
      // Dynamic import of the font's FLF data.
      const fontModule = await import(`figlet/importable-fonts/${fontName}.js`);
      const fontData: string = (fontModule as { default: string }).default;
      figlet.parseFont(fontName as never, fontData);
    }
    return { ok: true, output: true };
  } catch (e) {
    return { ok: false, error: `Failed to load FIGlet font "${fontName}": ${(e as Error).message}` };
  }
}

/* ------------------------------------------------------------------ */
/* Image filter primitives                                            */
/* ------------------------------------------------------------------ */

/** Allocate a fresh ImageDataLike of the given dimensions. */
export function createImageDataLike(width: number, height: number): ImageDataLike {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

/** Compute luminance (0-255) from an RGBA pixel. */
export function luminance(r: number, g: number, b: number): number {
  // ITU-R BT.601 luma.
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

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
  // Brightness: add offset. Contrast: scale around 128.
  // The contrast formula uses a slope of (tan((c+100) * 0.45 deg)) but a
  // linear approximation (1 + c/100) keeps it simple and predictable.
  const brightnessF = brightness;
  const contrastF = 1 + contrast / 100;
  const invGamma = gamma === 0 ? 1 : 1 / gamma;
  const hasGamma = Math.abs(gamma - 1) > 1e-6;
  for (let i = 0; i < src.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      let v = src[i + c]!;
      v = (v - 128) * contrastF + 128 + brightnessF;
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
  // Build a grayscale buffer for the convolution.
  const gray = new Float32Array(w * h);
  for (let i = 0, p = 0; i < src.length; i += 4, p++) {
    gray[p] = luminance(src[i]!, src[i + 1]!, src[i + 2]!);
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      // Clamp neighbours at borders.
      const xl = x > 0 ? x - 1 : 0;
      const xr = x < w - 1 ? x + 1 : w - 1;
      const yt = y > 0 ? y - 1 : 0;
      const yb = y < h - 1 ? y + 1 : h - 1;
      // Sobel kernels.
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

/* ------------------------------------------------------------------ */
/* Aspect correction                                                  */
/* ------------------------------------------------------------------ */

/**
 * Compute the cell-grid dimensions from an output character width and the
 * source pixel dimensions. Monospace characters are roughly twice as tall
 * as they are wide, so without correction the output looks vertically
 * stretched. When `aspectCorrection` is true we divide the computed height
 * by `1 / cellRatio` (i.e. multiply by `cellRatio`).
 *
 * Example: a 1600×900 image at width=160 with cellRatio=0.5 → 160×45 cells
 * (instead of 160×90).
 */
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

/* ------------------------------------------------------------------ */
/* Downsampling — source image → cell-grid luminance                  */
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
          // If fully transparent, blend with background.
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

/* ------------------------------------------------------------------ */
/* Dithering engines                                                  */
/* ------------------------------------------------------------------ */

/** Map a luminance value (0-255) to a ramp character. */
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

/** No dithering — straightforward luminance → ramp mapping. */
export function noDither(imageData: ImageDataLike, ramp: string): string {
  const { width, height } = imageData;
  const grid = new Float32Array(width * height);
  const src = imageData.data;
  for (let i = 0, p = 0; i < src.length; i += 4, p++) {
    grid[p] = luminance(src[i]!, src[i + 1]!, src[i + 2]!);
  }
  return gridToAscii(grid, width, height, ramp);
}

/** Floyd–Steinberg error diffusion. */
export function ditherFloydSteinberg(imageData: ImageDataLike, ramp: string): string {
  return errorDiffusion(imageData, ramp, [
    [0, 0, 0, 0],
    [1, 0, 7 / 16],
    [-1, 1, 3 / 16],
    [0, 1, 5 / 16],
    [1, 1, 1 / 16],
  ]);
}

/** Atkinson error diffusion (only 1/8 of error distributed to 6 neighbours). */
export function ditherAtkinson(imageData: ImageDataLike, ramp: string): string {
  const w = 1 / 8;
  return errorDiffusion(imageData, ramp, [
    [0, 0, 0, 0],
    [1, 0, w], [2, 0, w],
    [-1, 1, w], [0, 1, w], [1, 1, w],
    [0, 2, w],
  ]);
}

/** Jarvis–Judice–Ninke (JJN) error diffusion — 12-tap filter. */
export function ditherJJN(imageData: ImageDataLike, ramp: string): string {
  const w = 1 / 48;
  return errorDiffusion(imageData, ramp, [
    [0, 0, 0, 0],
    [1, 0, 7 * w], [2, 0, 5 * w],
    [-2, 1, 3 * w], [-1, 1, 5 * w], [0, 1, 7 * w], [1, 1, 5 * w], [2, 1, 3 * w],
    [-2, 2, 1 * w], [-1, 2, 3 * w], [0, 2, 5 * w], [1, 2, 3 * w], [2, 2, 1 * w],
  ]);
}

/** Stucki error diffusion — similar to JJN with different weights. */
export function ditherStucki(imageData: ImageDataLike, ramp: string): string {
  const w = 1 / 42;
  return errorDiffusion(imageData, ramp, [
    [0, 0, 0, 0],
    [1, 0, 8 * w], [2, 0, 4 * w],
    [-2, 1, 2 * w], [-1, 1, 4 * w], [0, 1, 8 * w], [1, 1, 4 * w], [2, 1, 2 * w],
    [-2, 2, 1 * w], [-1, 2, 2 * w], [0, 2, 4 * w], [1, 2, 2 * w], [2, 2, 1 * w],
  ]);
}

/**
 * Generic error-diffusion helper. Each entry in `kernel` is
 * `[dx, dy, weight]`; the first entry's weight is ignored (the current pixel
 * is always the source of the error).
 *
 * The luminance buffer is mutated in-place during diffusion; we copy from
 * the source ImageData so the input is never mutated.
 */
function errorDiffusion(
  imageData: ImageDataLike,
  ramp: string,
  kernel: ReadonlyArray<readonly [number, number, number]>,
): string {
  const { width, height } = imageData;
  if (width === 0 || height === 0) return "";
  const src = imageData.data;
  // Work on a mutable Float32 luminance grid.
  const grid = new Float32Array(width * height);
  for (let i = 0, p = 0; i < src.length; i += 4, p++) {
    grid[p] = luminance(src[i]!, src[i + 1]!, src[i + 2]!);
  }
  const out: string[] = [];
  for (let y = 0; y < height; y++) {
    let line = "";
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const old = grid[idx]!;
      // Quantise to the nearest ramp level.
      const rampIdx = Math.floor((old / 256) * ramp.length);
      const clamped = rampIdx < 0 ? 0 : rampIdx >= ramp.length ? ramp.length - 1 : rampIdx;
      const newV = (clamped / (ramp.length - 1 || 1)) * 255;
      grid[idx] = newV;
      line += ramp[clamped]!;
      const err = old - newV;
      // Distribute error.
      for (const [dx, dy, weight] of kernel) {
        if (weight === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        grid[ny * width + nx]! += err * weight;
      }
    }
    out.push(line);
  }
  return out.join("\n");
}

/* ------------------------------------------------------------------ */
/* High-level orchestrator                                            */
/* ------------------------------------------------------------------ */

/**
 * Run the full image→ASCII pipeline. The input `imageData` is the source
 * image at any resolution; the function applies the configured filters,
 * downsamples to the target cell grid (correcting for the monospace cell
 * aspect ratio), and runs the requested dithering engine.
 */
export function imageToAscii(imageData: ImageDataLike, opts: AsciiOptions): ToolResult<string> {
  if (opts.width <= 0) return { ok: false, error: "Width must be a positive number" };
  if (!opts.ramp || opts.ramp.length === 0) return { ok: false, error: "Ramp must be a non-empty string" };

  // 1. Filters (operating on the full-resolution image).
  let processed = imageData;
  if (opts.mode === "grayscale") {
    processed = applyGrayscale(processed);
  } else if (opts.mode === "edge-detect") {
    processed = applyEdgeDetect(processed);
  }
  const hasBCG =
    (opts.brightness && opts.brightness !== 0) ||
    (opts.contrast && opts.contrast !== 0) ||
    (opts.gamma && Math.abs(opts.gamma - 1) > 1e-6);
  if (hasBCG) {
    processed = applyBrightnessContrastGamma(
      processed,
      opts.brightness ?? 0,
      opts.contrast ?? 0,
      opts.gamma ?? 1,
    );
  }
  if (opts.invert) {
    processed = applyInvert(processed);
  }

  // 2. Compute cell-grid dimensions.
  const cellRatio = opts.cellRatio ?? 0.5;
  const srcW = processed.width;
  const srcH = processed.height;
  const targetH = opts.aspectCorrection === false
    ? Math.max(1, Math.round((opts.width * srcH) / srcW))
    : Math.max(1, Math.round((opts.width * srcH * cellRatio) / srcW));
  const targetW = opts.width;

  // 3. Downsample to luminance grid.
  const grid = downsampleToLuminanceGrid(processed, targetW, targetH, opts.alphaBackground ?? 255);

  // 4. Dither. We feed the grid back into a synthetic ImageData so the
  //    dithering helpers can be reused directly.
  const cellImage = createImageDataLike(targetW, targetH);
  for (let i = 0, p = 0; i < cellImage.data.length; i += 4, p++) {
    const v = grid[p]!;
    cellImage.data[i] = v;
    cellImage.data[i + 1] = v;
    cellImage.data[i + 2] = v;
    cellImage.data[i + 3] = 255;
  }

  let ascii: string;
  switch (opts.dithering) {
    case "floyd-steinberg": ascii = ditherFloydSteinberg(cellImage, opts.ramp); break;
    case "atkinson": ascii = ditherAtkinson(cellImage, opts.ramp); break;
    case "jjn": ascii = ditherJJN(cellImage, opts.ramp); break;
    case "stucki": ascii = ditherStucki(cellImage, opts.ramp); break;
    case "none":
    default: ascii = noDither(cellImage, opts.ramp); break;
  }
  return { ok: true, output: ascii };
}

/* ------------------------------------------------------------------ */
/* Text→ASCII (FIGlet)                                               */
/* ------------------------------------------------------------------ */

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
/* Color conversion helpers                                          */
/* ------------------------------------------------------------------ */

/** Clamp a value to the 0-255 range. */
function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/** Convert RGB (0-255 each) to a CSS hex color string. */
function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => clamp(Math.round(n)).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/**
 * Find the nearest xterm-256 color index for an RGB triple using the
 * standard 6×6×6 color cube + 24 grayscale ramp.
 */
function rgbToXterm256(r: number, g: number, b: number): number {
  // 16 system colors omitted (we map to cube/grayscale for stability).
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
  // Simple brightness + channel-dominance heuristic.
  const l = luminance(r, g, b);
  if (l < 32) return 0; // black
  if (l > 224) return 15; // white
  const rs = r > 128 ? 1 : 0;
  const gs = g > 128 ? 1 : 0;
  const bs = b > 128 ? 1 : 0;
  const bright = l > 160 ? 8 : 0;
  // Standard ANSI: 0 black, 1 red, 2 green, 3 yellow, 4 blue, 5 magenta, 6 cyan, 7 white
  return bright | (bs << 2) | (gs << 1) | rs;
}

/* ------------------------------------------------------------------ */
/* ASCII → HTML / ANSI / SVG / PNG                                    */
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
  // For color modes, colorise each character based on its ramp position by
  // assuming the standard 10-char Classic ramp. We compute a synthetic hue.
  const lines = escaped.split("\n");
  const out = lines.map((line) => {
    let html = "";
    for (const ch of line) {
      if (ch === " ") { html += " "; continue; }
      // Pseudo-color based on character density (space-like → dark).
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
    // Grayscale ramp.
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

/**
 * Convert ASCII text to ANSI escape-coded output suitable for terminals.
 * Each character gets its foreground colour set with the appropriate escape
 * sequence for the requested color mode.
 */
export function asciiToAnsi(ascii: string, colorMode: ColorMode = "bw"): string {
  if (colorMode === "bw" || colorMode === "phosphor") {
    // Phosphor is rendered as bright-green-on-black in the terminal.
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
        buf += `\x1b[38;2;${clamp(Math.round(r))};${clamp(Math.round(g))};${clamp(Math.round(b))}m${ch}\x1b[0m`;
      } else if (colorMode === "ansi256") {
        const idx = rgbToXterm256(density * 2 % 256, density * 3 % 256, density * 5 % 256);
        buf += `\x1b[38;5;${idx}m${ch}\x1b[0m`;
      } else if (colorMode === "ansi16") {
        const idx = rgbToAnsi16(density * 2 % 256, density * 3 % 256, density * 5 % 256);
        // Map 8-15 to 30-37 (bright), 0-7 to 30-37 (normal).
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

/* ------------------------------------------------------------------ */
/* Reverse ASCII → image                                              */
/* ------------------------------------------------------------------ */

/**
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
        v = 255; // background
      } else if (rampIdx.has(ch)) {
        const idx = rampIdx.get(ch)!;
        v = 255 - Math.floor((idx / Math.max(1, ramp.length - 1)) * 255);
      } else {
        // Unknown char: mid-gray.
        v = 128;
      }
      // Fill the cell with this luminance.
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

/* ------------------------------------------------------------------ */
/* Stats                                                              */
/* ------------------------------------------------------------------ */

/** Estimate the byte size of ASCII output if copied to the clipboard. */
export function estimateClipboardSize(ascii: string): { chars: number; kb: number; lines: number } {
  // Use the iterator form so multi-byte characters (emoji, etc.) count as
  // one user-perceived character each.
  const chars = Array.from(ascii).length;
  const bytes = new TextEncoder().encode(ascii).length;
  const lines = ascii === "" ? 0 : ascii.split("\n").length;
  return { chars, kb: bytes / 1024, lines };
}

/**
 * Parse a settings object into a URL hash fragment for sharing.
 * Symmetric with `parseSettingsHash`.
 */
export function encodeSettingsHash(settings: Record<string, unknown>): string {
  try {
    const json = JSON.stringify(settings);
    // Base64 URL-safe encoding.
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

// Base64 helpers that work in both Node and browser.
function btoaSafe(s: string): string {
  if (typeof btoa === "function") return btoa(s);
  return Buffer.from(s, "utf-8").toString("base64");
}
function atobSafe(s: string): string {
  if (typeof atob === "function") return atob(s);
  return Buffer.from(s, "base64").toString("utf-8");
}

/* ------------------------------------------------------------------ */
/* Crop presets                                                       */
/* ------------------------------------------------------------------ */

export type CropPreset = "square" | "16:9" | "4:3" | "9:16" | "1:1" | "free";

/** Compute the crop rectangle for a preset on a source image. */
export function computeCrop(
  srcW: number,
  srcH: number,
  preset: CropPreset,
): { x: number; y: number; width: number; height: number } {
  if (preset === "free" || preset === "1:1" || preset === "square") {
    const side = Math.min(srcW, srcH);
    return { x: Math.floor((srcW - side) / 2), y: Math.floor((srcH - side) / 2), width: side, height: side };
  }
  const ratios: Record<string, number> = { "16:9": 16 / 9, "4:3": 4 / 3, "9:16": 9 / 16 };
  const target = ratios[preset] ?? 1;
  // Fit inside the source.
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
/* Sample gallery (procedural)                                        */
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
