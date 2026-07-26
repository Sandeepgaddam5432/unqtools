/**
 * Transparent PNG Maker — pure logic for background removal.
 *
 * 10+ Extras:
 *   1. Color distance (Euclidean RGB)
 *   2. Tolerance threshold
 *   3. Global vs contiguous mode (flood fill reference)
 *   4. Edge feather (alpha gradient)
 *   5. Multi-color removal
 *   6. Replacement color option
 *   7. Invert selection
 *   8. Alpha blending math
 *   9. Validation
 *  10. Stats
 *  11. Batch helper
 *  12. CSV export
 *  13. Connected-component label helper
 */

export type SelectionMode = "global" | "contiguous";

export interface TransparentPngInput {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
  /** Target colors to remove (RGB triplets). */
  targetColors: Array<[number, number, number]>;
  /** Tolerance 0-255. Higher = more pixels removed. */
  tolerance: number;
  /** Selection mode. */
  mode: SelectionMode;
  /** Feather radius in pixels (0-20). */
  feather: number;
  /** Optional replacement color. If set, removed pixels get this color instead of transparent. */
  replacementColor?: [number, number, number] | null;
  /** Invert selection: keep matched pixels, remove others. */
  invert?: boolean;
  /** Seed point for contiguous mode (x,y). */
  seed?: { x: number; y: number };
}

export interface TransparentPngStats {
  width: number;
  height: number;
  totalPixels: number;
  removedPixels: number;
  keptPixels: number;
  removedRatio: number;
  featheredPixels: number;
  durationMs: number;
}

export interface TransparentPngResult {
  pixels: Uint8ClampedArray;
  stats: TransparentPngStats;
  warnings: string[];
}

/** Euclidean distance in RGB space. */
export function colorDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

/** Max RGB channel distance (Chebyshev) — used as fallback. */
export function maxChannelDistance(a: [number, number, number], b: [number, number, number]): number {
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
}

/** True if color matches any target within tolerance. */
export function matchesAnyTarget(color: [number, number, number], targets: Array<[number, number, number]>, tolerance: number): boolean {
  const tol = Math.max(0, tolerance * Math.sqrt(3)); // tolerance 0-255 → 0-441 Euclidean
  for (const t of targets) {
    if (colorDistance(color, t) <= tol) return true;
  }
  return false;
}

/** Alpha-blend src over dst using src alpha (0-255). Returns blended RGB. */
export function alphaBlend(src: [number, number, number], srcAlpha: number, dst: [number, number, number]): [number, number, number] {
  const a = srcAlpha / 255;
  return [
    Math.round(src[0] * a + dst[0] * (1 - a)),
    Math.round(src[1] * a + dst[1] * (1 - a)),
    Math.round(src[2] * a + dst[2] * (1 - a)),
  ];
}

/** Connected-component flood fill (4-neighbor) returning the visited set. */
export function floodFill(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  seed: { x: number; y: number },
  matches: (idx: number) => boolean,
): Set<number> {
  const visited = new Set<number>();
  if (seed.x < 0 || seed.y < 0 || seed.x >= width || seed.y >= height) return visited;
  const stack: Array<{ x: number; y: number }> = [seed];
  while (stack.length > 0) {
    const p = stack.pop()!;
    if (p.x < 0 || p.y < 0 || p.x >= width || p.y >= height) continue;
    const idx = p.y * width + p.x;
    if (visited.has(idx)) continue;
    const pixIdx = idx * 4;
    if (!matches(pixIdx)) continue;
    visited.add(idx);
    stack.push({ x: p.x + 1, y: p.y });
    stack.push({ x: p.x - 1, y: p.y });
    stack.push({ x: p.x, y: p.y + 1 });
    stack.push({ x: p.x, y: p.y - 1 });
  }
  return visited;
}

/** Validate input. */
export function validateInput(input: TransparentPngInput): { ok: true } | { error: string } {
  if (input.width <= 0 || input.height <= 0) return { error: "Width and height must be positive" };
  if (!input.pixels || input.pixels.length < input.width * input.height * 4) return { error: "Pixels missing or too small" };
  if (input.targetColors.length === 0) return { error: "At least one target color required" };
  if (input.tolerance < 0 || input.tolerance > 255) return { error: "Tolerance must be 0-255" };
  if (input.feather < 0 || input.feather > 20) return { error: "Feather must be 0-20" };
  if (input.mode !== "global" && input.mode !== "contiguous") return { error: "Unknown mode" };
  if (input.mode === "contiguous" && (!input.seed || input.seed.x < 0 || input.seed.y < 0)) return { error: "Seed required for contiguous mode" };
  return { ok: true };
}

/** Run background removal. */
export function removeBackground(input: TransparentPngInput): TransparentPngResult | { error: string } {
  const v = validateInput(input);
  if ("error" in v) return { error: v.error };
  const start = typeof performance !== "undefined" ? performance.now() : Date.now();
  const { width, height, pixels } = input;
  const warnings: string[] = [];
  if (width * height > 4_000_000) warnings.push("Large image — flood fill may be slow.");
  if (input.feather > 10) warnings.push("High feather may blur detail at edges.");

  // Step 1: Build a mask of matched pixels (1 = remove, 0 = keep)
  const mask = new Uint8Array(width * height);
  const matchFn = (pixIdx: number): boolean => {
    const c: [number, number, number] = [pixels[pixIdx]!, pixels[pixIdx + 1]!, pixels[pixIdx + 2]!];
    return matchesAnyTarget(c, input.targetColors, input.tolerance);
  };

  if (input.mode === "contiguous") {
    const visited = floodFill(pixels, width, height, input.seed!, matchFn);
    for (const idx of visited) mask[idx] = 1;
  } else {
    for (let i = 0; i < width * height; i++) {
      if (matchFn(i * 4)) mask[i] = 1;
    }
  }

  // Invert if requested
  if (input.invert) {
    for (let i = 0; i < mask.length; i++) mask[i] = mask[i] === 1 ? 0 : 1;
  }

  // Step 2: Feather — compute distance-from-edge alpha gradient
  let featheredPixels = 0;
  const out = new Uint8ClampedArray(pixels);
  const r = Math.max(1, input.feather);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const isMatch = mask[idx] === 1;
      // Check if this is a boundary pixel
      let isBoundary = false;
      for (let dy = -1; dy <= 1 && !isBoundary; dy++) {
        for (let dx = -1; dx <= 1 && !isBoundary; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (mask[ny * width + nx] !== mask[idx]) isBoundary = true;
        }
      }
      const pixIdx = idx * 4;
      if (isMatch && !isBoundary) {
        // Fully remove
        if (input.replacementColor) {
          out[pixIdx] = input.replacementColor[0];
          out[pixIdx + 1] = input.replacementColor[1];
          out[pixIdx + 2] = input.replacementColor[2];
          out[pixIdx + 3] = 255;
        } else {
          out[pixIdx + 3] = 0;
        }
      } else if (isMatch && isBoundary && input.feather > 0) {
        // Feather: count matched neighbors within radius to compute alpha
        let matched = 0, total = 0;
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            total++;
            if (mask[ny * width + nx] === 1) matched++;
          }
        }
        const alpha = total > 0 ? Math.round((1 - matched / total) * 255) : 0;
        out[pixIdx + 3] = alpha;
        featheredPixels++;
      } else if (!isMatch && isBoundary && input.feather > 0) {
        // Keep side: also feather the alpha
        let matched = 0, total = 0;
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            total++;
            if (mask[ny * width + nx] === 1) matched++;
          }
        }
        const alpha = total > 0 ? Math.round((1 - matched / total) * 255) : 255;
        out[pixIdx + 3] = alpha;
        featheredPixels++;
      }
    }
  }

  let removedPixels = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i] === 1) removedPixels++;
  const end = typeof performance !== "undefined" ? performance.now() : Date.now();

  return {
    pixels: out,
    stats: {
      width, height,
      totalPixels: width * height,
      removedPixels,
      keptPixels: width * height - removedPixels,
      removedRatio: width * height > 0 ? removedPixels / (width * height) : 0,
      featheredPixels,
      durationMs: Math.max(0, end - start),
    },
    warnings,
  };
}

/** Batch helper. */
export function batchRemoveBackground(inputs: TransparentPngInput[]): (TransparentPngResult | { error: string })[] {
  return inputs.map((input) => removeBackground(input));
}

/** Stats to CSV. */
export function statsToCsv(stats: TransparentPngStats): string {
  return [
    "Field,Value",
    `Width,${stats.width}`,
    `Height,${stats.height}`,
    `TotalPixels,${stats.totalPixels}`,
    `RemovedPixels,${stats.removedPixels}`,
    `KeptPixels,${stats.keptPixels}`,
    `RemovedRatio,${stats.removedRatio.toFixed(4)}`,
    `FeatheredPixels,${stats.featheredPixels}`,
    `DurationMs,${stats.durationMs.toFixed(2)}`,
  ].join("\n");
}

/** Hex (#RRGGBB) to RGB tuple. */
export function hexToRgb(hex: string): [number, number, number] | { error: string } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return { error: "Invalid hex color" };
  return [parseInt(m[1]!.slice(0, 2), 16), parseInt(m[1]!.slice(2, 4), 16), parseInt(m[1]!.slice(4, 6), 16)];
}
