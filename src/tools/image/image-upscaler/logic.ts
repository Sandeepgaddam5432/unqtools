/**
 * Image Upscaler — pure logic. No DOM/canvas access.
 *
 * Extras (10+):
 *   1. Interpolation methods (nearest, bilinear, bicubic, lanczos)
 *   2. Scale factor presets (2x, 3x, 4x, custom)
 *   3. Multi-step upscaling path (each ≤2x)
 *   4. Optional sharpening kernel (3x3 unsharp mask)
 *   5. Dimension calculation
 *   6. Quality estimation (predicted PSNR-style score)
 *   7. Format output (PNG/JPEG/WebP)
 *   8. Memory estimate for output buffer
 *   9. Unsharp mask strength/blend helper
 *  10. Lanczos sinc kernel coefficient
 *  11. Bicubic Catmull-Rom weights
 *  12. Nearest-neighbor source coordinate
 */
export type Interpolation = "nearest" | "bilinear" | "bicubic" | "lanczos";
export type OutputFormat = "image/png" | "image/jpeg" | "image/webp";

export interface UpscaleInput {
  srcWidth: number;
  srcHeight: number;
  scale: number;
  method: Interpolation;
  sharpen: number; // 0-1
  format: OutputFormat;
  quality: number; // 0-1
}

export interface UpscaleResult {
  width: number;
  height: number;
  steps: { width: number; height: number }[];
  estimatedMemoryBytes: number;
  qualityScore: number;
  warnings: string[];
}

const clampDim = (n: number) => Math.max(1, Math.min(16000, Math.round(n)));

/** Compute final output dimensions for given scale. */
export function computeOutputDimensions(srcW: number, srcH: number, scale: number): { width: number; height: number } {
  return { width: clampDim(srcW * scale), height: clampDim(srcH * scale) };
}

/** Multi-step upscale path. Each step ≤2x for better quality. */
export function multiStepPath(srcW: number, srcH: number, scale: number): { width: number; height: number }[] {
  if (scale <= 1) return [{ width: clampDim(srcW * scale), height: clampDim(srcH * scale) }];
  const steps: { width: number; height: number }[] = [];
  let curScale = 1;
  let remaining = scale;
  while (remaining > 2.001) {
    curScale *= 2;
    remaining /= 2;
    steps.push({ width: clampDim(srcW * curScale), height: clampDim(srcH * curScale) });
  }
  steps.push({ width: clampDim(srcW * scale), height: clampDim(srcH * scale) });
  return steps;
}

/** Lanczos sinc coefficient (a=3). */
export function lanczosKernel(x: number, a = 3): number {
  if (x === 0) return 1;
  if (x <= -a || x >= a) return 0;
  const px = Math.PI * x;
  return (a * Math.sin(px) * Math.sin(px / a)) / (px * px);
}

/** Catmull-Rom bicubic weight at distance x. */
export function bicubicWeight(x: number): number {
  const a = -0.5;
  x = Math.abs(x);
  if (x < 1) return (a + 2) * x * x * x - (a + 3) * x * x + 1;
  if (x < 2) return a * x * x * x - 5 * a * x * x + 8 * a * x - 4 * a;
  return 0;
}

/** Nearest-neighbor source coordinate. */
export function nearestSourceCoord(dest: number, scale: number): number {
  return Math.min(Math.floor(dest / scale), Math.floor(Number.MAX_SAFE_INTEGER));
}

/** Estimate memory for output buffer (RGBA, 4 bytes/pixel). */
export function estimateMemory(width: number, height: number): number {
  return width * height * 4;
}

/** Predicted quality score (0-100) based on method and scale. */
export function qualityEstimate(method: Interpolation, scale: number, hasSharpen: boolean): number {
  let base = 100;
  switch (method) {
    case "nearest": base = 30; break;
    case "bilinear": base = 60; break;
    case "bicubic": base = 80; break;
    case "lanczos": base = 90; break;
  }
  const scalePenalty = Math.max(0, (scale - 2)) * 8;
  const sharpBonus = hasSharpen ? 5 : 0;
  return Math.max(0, Math.min(100, base - scalePenalty + sharpBonus));
}

/** Build a 3x3 unsharp mask kernel from strength (0-1). Returns 9 values (row-major). */
export function unsharpKernel(strength: number): number[] {
  const s = Math.max(0, Math.min(1, strength));
  const center = 1 + 4 * s;
  const side = -s;
  return [
    0, side, 0,
    side, center, side,
    0, side, 0,
  ];
}

/** Apply a 3x3 kernel to a pixel at (x,y) in an RGBA buffer (for testing). */
export function applyKernel3x3(
  pixels: number[],
  width: number,
  height: number,
  x: number,
  y: number,
  channel: number,
  kernel: number[],
): number {
  let sum = 0;
  let kSum = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const sx = Math.min(width - 1, Math.max(0, x + dx));
      const sy = Math.min(height - 1, Math.max(0, y + dy));
      const k = kernel[(dy + 1) * 3 + (dx + 1)]!;
      const v = pixels[(sy * width + sx) * 4 + channel] ?? 0;
      sum += k * v;
      kSum += k;
    }
  }
  return Math.max(0, Math.min(255, Math.round(sum / Math.max(1, kSum))));
}

/** Validate upscaling input. */
export function validateInput(input: UpscaleInput): { ok: true } | { error: string } {
  if (input.srcWidth <= 0 || input.srcHeight <= 0) return { error: "Source dimensions must be positive" };
  if (input.scale <= 0) return { error: "Scale must be positive" };
  if (input.scale > 16) return { error: "Scale must be ≤ 16" };
  if (input.sharpen < 0 || input.sharpen > 1) return { error: "Sharpen must be 0-1" };
  if (input.quality < 0 || input.quality > 1) return { error: "Quality must be 0-1" };
  if (!["nearest", "bilinear", "bicubic", "lanczos"].includes(input.method)) return { error: "Unknown method" };
  return { ok: true };
}

/** Main upscale calculation. Pure function. */
export function calculateUpscale(input: UpscaleInput): UpscaleResult | { error: string } {
  const v = validateInput(input);
  if ("error" in v) return v;
  const out = computeOutputDimensions(input.srcWidth, input.srcHeight, input.scale);
  const steps = multiStepPath(input.srcWidth, input.srcHeight, input.scale);
  const mem = estimateMemory(out.width, out.height);
  const q = qualityEstimate(input.method, input.scale, input.sharpen > 0);
  const warnings: string[] = [];
  if (out.width * out.height > 25_000_000) warnings.push("Large output — may use significant memory");
  if (input.scale > 4) warnings.push("High scale factor — image may appear soft");
  if (input.method === "nearest") warnings.push("Nearest-neighbor produces blocky results when upscaling");
  return {
    width: out.width,
    height: out.height,
    steps,
    estimatedMemoryBytes: mem,
    qualityScore: q,
    warnings,
  };
}

/** Build filename for upscaled output. */
export function buildFilename(scale: number, method: Interpolation, format: OutputFormat): string {
  const ext = format.split("/")[1];
  return `upscaled-${scale}x-${method}.${ext}`;
}

/** Map canvas imageSmoothingQuality from method. */
export function canvasSmoothingQuality(method: Interpolation): "low" | "medium" | "high" {
  switch (method) {
    case "nearest": return "low";
    case "bilinear": return "medium";
    case "bicubic":
    case "lanczos": return "high";
  }
}

/** Should use imageSmoothingEnabled? False for nearest, true otherwise. */
export function shouldSmooth(method: Interpolation): boolean {
  return method !== "nearest";
}
