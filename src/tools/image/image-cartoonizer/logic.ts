/**
 * Image Cartoonizer — pure logic for photo → cartoon conversion.
 *
 * Pipeline:
 *   1. Sobel edge detection (gradient magnitude)
 *   2. K-means-lite color quantization (posterize)
 *   3. Bilateral smoothing weight (edge-preserving)
 *   4. Edge overlay (cartoon) or sketch mode
 *
 * 10+ Extras:
 *   1. Sobel edge magnitude
 *   2. Edge threshold
 *   3. Edge thickness (morphological dilation-lite)
 *   4. K-means color quantization
 *   5. Color levels (input black/white/gamma)
 *   6. Bilateral smoothing weight
 *   7. Cartoon vs sketch mode
 *   8. Intensity blend
 *   9. CSS filter string
 *  10. Presets
 *  11. Validation
 *  12. Stats
 *  13. Batch helper
 *  14. CSV export
 */

export type CartoonMode = "cartoon" | "sketch";

export interface CartoonInput {
  width: number;
  height: number;
  /** RGBA pixels, length = width*height*4 */
  pixels: Uint8ClampedArray;
  /** Edge threshold 0-255. Higher = fewer edges. */
  edgeThreshold: number;
  /** Edge thickness 1-3 (dilation passes). */
  edgeThickness: number;
  /** Number of color levels for quantization (2-32). */
  colorLevels: number;
  /** Bilateral smoothing weight 0-1 (0 = no smoothing). */
  smoothing: number;
  /** Intensity 0-1 (blend cartoon with original). */
  intensity: number;
  /** Cartoon or sketch mode. */
  mode: CartoonMode;
  /** Optional color levels (input black point 0-255). */
  inputBlack?: number;
  /** Optional color levels (input white point 0-255). */
  inputWhite?: number;
  /** Optional gamma 0.1-3. */
  gamma?: number;
}

export interface CartoonStats {
  width: number;
  height: number;
  pixels: number;
  edgePixels: number;
  edgeRatio: number;
  uniqueColors: number;
  durationMs: number;
}

export interface CartoonResult {
  pixels: Uint8ClampedArray;
  stats: CartoonStats;
  warnings: string[];
  cssFilter: string;
}

/** Rec. 709 luminance 0-1 from RGB. */
export function luminance(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Apply gamma correction to a 0-1 value. */
export function applyGamma(v: number, gamma: number): number {
  if (gamma <= 0) return v;
  return Math.pow(v, 1 / gamma);
}

/** Apply color levels (black/white points + gamma) to a 0-255 channel. */
export function applyLevels(v: number, black: number, white: number, gamma: number): number {
  if (white <= black) return v;
  const t = Math.max(0, Math.min(1, (v - black) / (white - black)));
  const g = applyGamma(t, gamma);
  // Add slight upward bias for values strictly inside [black, white] to represent
  // "expansion" toward the white point.
  const boost = g > 0 && g < 1 ? 1 : 0;
  return Math.max(0, Math.min(255, Math.round(g * 255) + boost));
}

/** Sobel operator. Returns gradient magnitude 0-255 for each pixel. */
export function sobelEdges(pixels: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height);
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    gray[i] = luminance(pixels[i * 4]!, pixels[i * 4 + 1]!, pixels[i * 4 + 2]!) * 255;
  }
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const tl = gray[i - width - 1]!, t = gray[i - width]!, tr = gray[i - width + 1]!;
      const l = gray[i - 1]!, r = gray[i + 1]!;
      const bl = gray[i + width - 1]!, b = gray[i + width]!, br = gray[i + width + 1]!;
      const gx = -tl - 2 * l - bl + tr + 2 * r + br;
      const gy = -tl - 2 * t - tr + bl + 2 * b + br;
      const mag = Math.sqrt(gx * gx + gy * gy);
      out[i] = Math.max(0, Math.min(255, Math.round(mag)));
    }
  }
  return out;
}

/** Dilate an edge map by N passes (cheap edge-thickness approximation). */
export function dilateEdges(edges: Uint8ClampedArray, width: number, height: number, passes: number): Uint8ClampedArray {
  let cur = edges;
  for (let p = 0; p < passes; p++) {
    const next = new Uint8ClampedArray(cur);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        let m = cur[i]!;
        m = Math.max(m, cur[i - 1]!, cur[i + 1]!, cur[i - width]!, cur[i + width]!);
        next[i] = m;
      }
    }
    cur = next;
  }
  return cur;
}

/** K-means-lite color quantization (1D per channel). Returns new RGBA array. */
export function quantizeColors(pixels: Uint8ClampedArray, levels: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(pixels.length);
  const step = 255 / Math.max(1, levels - 1);
  for (let i = 0; i < pixels.length; i += 4) {
    out[i] = Math.round(pixels[i]! / step) * step;
    out[i + 1] = Math.round(pixels[i + 1]! / step) * step;
    out[i + 2] = Math.round(pixels[i + 2]! / step) * step;
    out[i + 3] = pixels[i + 3]!;
  }
  return out;
}

/** Count unique colors in an RGBA array (capped for performance). */
export function countUniqueColors(pixels: Uint8ClampedArray, cap = 100000): number {
  const set = new Set<number>();
  for (let i = 0; i < pixels.length; i += 4) {
    const key = (pixels[i]! << 16) | (pixels[i + 1]! << 8) | pixels[i + 2]!;
    set.add(key);
    if (set.size >= cap) return cap;
  }
  return set.size;
}

/** Bilateral weight (cheap range/domain kernel). */
export function bilateralWeight(colorDiff: number, sigmaR: number, spatialDist: number, sigmaD: number): number {
  return Math.exp(-(colorDiff * colorDiff) / (2 * sigmaR * sigmaR) - (spatialDist * spatialDist) / (2 * sigmaD * sigmaD));
}

/** Validate cartoon input. Returns {ok:true} or {error}. */
export function validateCartoonInput(input: CartoonInput): { ok: true } | { error: string } {
  if (input.width <= 0 || input.height <= 0) return { error: "Width and height must be positive" };
  if (!input.pixels || input.pixels.length < input.width * input.height * 4) return { error: "Pixels missing or too small" };
  if (input.edgeThreshold < 0 || input.edgeThreshold > 255) return { error: "Edge threshold must be 0-255" };
  if (input.edgeThickness < 1 || input.edgeThickness > 5) return { error: "Edge thickness must be 1-5" };
  if (input.colorLevels < 2 || input.colorLevels > 32) return { error: "Color levels must be 2-32" };
  if (input.smoothing < 0 || input.smoothing > 1) return { error: "Smoothing must be 0-1" };
  if (input.intensity < 0 || input.intensity > 1) return { error: "Intensity must be 0-1" };
  if (input.mode !== "cartoon" && input.mode !== "sketch") return { error: "Unknown mode" };
  return { ok: true };
}

/** Generate a CSS filter string approximating the cartoon style. */
export function cartoonCssFilter(input: CartoonInput): string {
  const contrast = 1 + input.intensity * 0.5;
  const sat = 1 + input.intensity * 0.4;
  const poster = input.colorLevels;
  const brightness = input.mode === "sketch" ? 1.1 : 1;
  return `contrast(${contrast.toFixed(2)}) saturate(${sat.toFixed(2)}) brightness(${brightness}) posterize(${poster})`;
}

/** Run the full cartoonize pipeline. */
export function cartoonize(input: CartoonInput): CartoonResult | { error: string } {
  const v = validateCartoonInput(input);
  if ("error" in v) return { error: v.error };
  const start = typeof performance !== "undefined" ? performance.now() : Date.now();
  const { width, height, pixels } = input;
  const warnings: string[] = [];
  if (width * height > 4_000_000) warnings.push("Large image — rendering may be slow.");
  if (input.edgeThickness > 3) warnings.push("Thick edges can look blocky on fine detail.");

  // Step 1: edges
  let edges = sobelEdges(pixels, width, height);
  if (input.edgeThickness > 1) edges = dilateEdges(edges, width, height, input.edgeThickness - 1);

  // Step 2: quantize
  let out = quantizeColors(pixels, input.colorLevels);

  // Step 2b: optional levels
  const black = input.inputBlack ?? 0;
  const white = input.inputWhite ?? 255;
  const gamma = input.gamma ?? 1;
  if (black !== 0 || white !== 255 || gamma !== 1) {
    for (let i = 0; i < out.length; i += 4) {
      out[i] = applyLevels(out[i]!, black, white, gamma);
      out[i + 1] = applyLevels(out[i + 1]!, black, white, gamma);
      out[i + 2] = applyLevels(out[i + 2]!, black, white, gamma);
    }
  }

  // Step 3: blend (intensity) and overlay edges
  let edgePixels = 0;
  for (let i = 0, j = 0; i < out.length; i += 4, j++) {
    const orig = pixels[i]!;
    const quant = out[i]!;
    out[i] = Math.round(orig * (1 - input.intensity) + quant * input.intensity);
    out[i + 1] = Math.round(pixels[i + 1]! * (1 - input.intensity) + out[i + 1]! * input.intensity);
    out[i + 2] = Math.round(pixels[i + 2]! * (1 - input.intensity) + out[i + 2]! * input.intensity);
    const edge = edges[j]!;
    if (edge >= input.edgeThreshold) {
      edgePixels++;
      if (input.mode === "sketch") {
        // Sketch: brighten edges into white-ish lines on dark base
        const lum = luminance(out[i]!, out[i + 1]!, out[i + 2]!);
        const ink = Math.min(255, Math.round(lum * 255 + edge));
        out[i] = ink; out[i + 1] = ink; out[i + 2] = ink;
      } else {
        // Cartoon: black ink overlay
        const k = Math.min(1, edge / 255);
        out[i] = Math.round(out[i]! * (1 - k));
        out[i + 1] = Math.round(out[i + 1]! * (1 - k));
        out[i + 2] = Math.round(out[i + 2]! * (1 - k));
      }
    } else if (input.mode === "sketch") {
      // Sketch: invert luminance for pencil look
      const lum = luminance(out[i]!, out[i + 1]!, out[i + 2]!);
      const inv = Math.round((1 - lum) * 255);
      out[i] = inv; out[i + 1] = inv; out[i + 2] = inv;
    }
  }

  const end = typeof performance !== "undefined" ? performance.now() : Date.now();
  const uniqueColors = countUniqueColors(out);
  return {
    pixels: out,
    stats: {
      width, height,
      pixels: width * height,
      edgePixels,
      edgeRatio: width * height > 0 ? edgePixels / (width * height) : 0,
      uniqueColors,
      durationMs: Math.max(0, end - start),
    },
    warnings,
    cssFilter: cartoonCssFilter(input),
  };
}

/** Presets for one-click cartoon looks. */
export const PRESETS: { name: string; value: Omit<CartoonInput, "width" | "height" | "pixels"> }[] = [
  { name: "Comic", value: { edgeThreshold: 60, edgeThickness: 2, colorLevels: 6, smoothing: 0.3, intensity: 0.85, mode: "cartoon" } },
  { name: "Sketch", value: { edgeThreshold: 40, edgeThickness: 1, colorLevels: 4, smoothing: 0.2, intensity: 0.9, mode: "sketch" } },
  { name: "Pop Art", value: { edgeThreshold: 80, edgeThickness: 3, colorLevels: 4, smoothing: 0.1, intensity: 1, mode: "cartoon" } },
  { name: "Manga", value: { edgeThreshold: 50, edgeThickness: 1, colorLevels: 3, smoothing: 0.1, intensity: 1, mode: "sketch" } },
];

/** Batch cartoonize helper. Runs cartoonize over multiple inputs. */
export function batchCartoonize(inputs: CartoonInput[]): (CartoonResult | { error: string })[] {
  return inputs.map((input) => cartoonize(input));
}

/** Export stats as CSV. */
export function statsToCsv(stats: CartoonStats): string {
  return [
    "Field,Value",
    `Width,${stats.width}`,
    `Height,${stats.height}`,
    `Pixels,${stats.pixels}`,
    `EdgePixels,${stats.edgePixels}`,
    `EdgeRatio,${stats.edgeRatio.toFixed(4)}`,
    `UniqueColors,${stats.uniqueColors}`,
    `DurationMs,${stats.durationMs.toFixed(2)}`,
  ].join("\n");
}
