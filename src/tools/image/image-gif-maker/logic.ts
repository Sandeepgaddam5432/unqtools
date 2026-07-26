/**
 * GIF Maker — pure logic for assembling animated GIFs from images.
 *
 * 10+ Extras:
 *   1. Frame delay calc (per-frame + global)
 *   2. Loop count (0 = infinite)
 *   3. Size constraint (max width/height)
 *   4. Quality estimation (color count vs frame count)
 *   5. Color quantization reference (palette size calc)
 *   6. Frame order (forward/reverse/shuffle)
 *   7. Batch helper (multiple GIFs)
 *   8. Stats
 *   9. Total size estimation
 *  10. Aspect ratio preservation
 *  11. Validation
 *  12. CSV export
 *  13. Frame naming convention
 *  14. Duration calc
 */

export type FrameOrder = "forward" | "reverse" | "shuffle";

export interface GifFrameInput {
  /** Frame width in pixels. */
  width: number;
  /** Frame height in pixels. */
  height: number;
  /** Per-frame delay in milliseconds. */
  delayMs: number;
  /** Estimated bytes of this frame (compressed). */
  estimatedBytes: number;
}

export interface GifInput {
  frames: GifFrameInput[];
  /** Default frame delay (used if frame's delayMs is 0). */
  defaultDelayMs: number;
  /** Loop count: 0 = infinite, N = play N times. */
  loopCount: number;
  /** Max width for the GIF. Frames will be scaled. */
  maxWidth: number;
  /** Max height for the GIF. */
  maxHeight: number;
  /** Preserve aspect ratio when scaling. */
  preserveAspect: boolean;
  /** Color palette size (2-256). */
  paletteSize: number;
  /** Frame ordering. */
  order: FrameOrder;
}

export interface GifFrameInfo {
  index: number;
  width: number;
  height: number;
  delayMs: number;
  estimatedBytes: number;
  fileName: string;
}

export interface GifStats {
  frameCount: number;
  totalDelayMs: number;
  totalDurationSec: number;
  averageDelayMs: number;
  finalWidth: number;
  finalHeight: number;
  paletteSize: number;
  estimatedTotalBytes: number;
  estimatedTotalKb: number;
  fps: number;
  loopLabel: string;
  durationMs: number;
}

export interface GifResult {
  frames: GifFrameInfo[];
  stats: GifStats;
  warnings: string[];
  qualityScore: number; // 0-100
  manifest: string;
}

/** Compute the final dimensions of the GIF respecting max constraints. */
export function computeFinalSize(width: number, height: number, maxWidth: number, maxHeight: number, preserveAspect: boolean): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  let w = width, h = height;
  const scaleW = maxWidth > 0 ? maxWidth / width : 1;
  const scaleH = maxHeight > 0 ? maxHeight / height : 1;
  const scale = Math.min(scaleW, scaleH);
  if (scale < 1) {
    w = Math.floor(width * scale);
    h = Math.floor(height * scale);
  }
  if (!preserveAspect) {
    w = maxWidth > 0 ? Math.min(maxWidth, width) : width;
    h = maxHeight > 0 ? Math.min(maxHeight, height) : height;
  }
  return { width: Math.max(1, w), height: Math.max(1, h) };
}

/** Compute average delay in ms. */
export function averageDelay(delays: number[]): number {
  if (delays.length === 0) return 0;
  return delays.reduce((s, d) => s + d, 0) / delays.length;
}

/** Compute FPS from average delay. */
export function fpsFromDelay(delayMs: number): number {
  if (delayMs <= 0) return 0;
  return 1000 / delayMs;
}

/** Estimate total GIF size in bytes (sum of frame estimates + GIF overhead). */
export function estimateTotalSize(frames: GifFrameInput[], paletteSize: number): number {
  const paletteBytes = paletteSize * 3; // RGB
  const headerBytes = 13 + 256 + 256; // GIF header + global color table
  const frameBytes = frames.reduce((s, f) => s + f.estimatedBytes, 0);
  return headerBytes + paletteBytes + frameBytes;
}

/** Quality score 0-100 based on palette size, frame count, and total size. */
export function qualityScore(paletteSize: number, frameCount: number, totalBytes: number): number {
  let score = 0;
  // Palette: more colors = better quality
  score += Math.min(50, (paletteSize / 256) * 50);
  // Frame count: more frames = smoother
  score += Math.min(30, (frameCount / 30) * 30);
  // Size penalty: very large files lose points
  const mb = totalBytes / (1024 * 1024);
  if (mb > 10) score -= 30;
  else if (mb > 5) score -= 15;
  // Base
  score += 20;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Reorder frame delays based on FrameOrder. */
export function reorderFrames<T>(frames: T[], order: FrameOrder): T[] {
  if (order === "reverse") return [...frames].reverse();
  if (order === "shuffle") {
    // Deterministic shuffle using a simple LCG
    const arr = [...frames];
    let seed = 12345;
    for (let i = arr.length - 1; i > 0; i--) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const j = seed % (i + 1);
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    }
    return arr;
  }
  return frames;
}

/** Generate filename for a frame. */
export function frameFileName(baseName: string, index: number, total: number): string {
  const digits = String(total).length;
  return `${baseName}_${String(index + 1).padStart(digits, "0")}.gif`;
}

/** Get human-readable loop label. */
export function loopLabel(loopCount: number): string {
  if (loopCount === 0) return "Infinite";
  return `${loopCount}×`;
}

/** Validate GIF input. */
export function validateInput(input: GifInput): { ok: true } | { error: string } {
  if (!input.frames || input.frames.length === 0) return { error: "At least one frame is required" };
  if (input.frames.length > 500) return { error: "Too many frames (max 500)" };
  if (input.defaultDelayMs < 0 || input.defaultDelayMs > 60000) return { error: "Default delay must be 0-60000ms" };
  if (input.loopCount < 0) return { error: "Loop count must be ≥ 0" };
  if (input.paletteSize < 2 || input.paletteSize > 256) return { error: "Palette size must be 2-256" };
  if (input.maxWidth < 0 || input.maxHeight < 0) return { error: "Max dimensions must be ≥ 0" };
  if (input.order !== "forward" && input.order !== "reverse" && input.order !== "shuffle") return { error: "Unknown frame order" };
  return { ok: true };
}

/** Compute the GIF result. */
export function computeGif(input: GifInput, baseName = "frame"): GifResult | { error: string } {
  const v = validateInput(input);
  if ("error" in v) return { error: v.error };
  const start = typeof performance !== "undefined" ? performance.now() : Date.now();
  const warnings: string[] = [];

  // Reorder frames
  const reordered = reorderFrames(input.frames, input.order);
  // Compute final size from first frame
  const first = reordered[0]!;
  const final = computeFinalSize(first.width, first.height, input.maxWidth, input.maxHeight, input.preserveAspect);
  if (final.width < first.width) warnings.push("Frames will be downscaled — quality may degrade.");
  if (input.paletteSize < 64) warnings.push("Small palette size will reduce color fidelity.");
  if (reordered.length > 60) warnings.push("Many frames — file size will be large.");

  const frames: GifFrameInfo[] = reordered.map((f, i) => ({
    index: i,
    width: final.width,
    height: final.height,
    delayMs: f.delayMs > 0 ? f.delayMs : input.defaultDelayMs,
    estimatedBytes: f.estimatedBytes,
    fileName: frameFileName(baseName, i, reordered.length),
  }));

  const totalDelay = frames.reduce((s, f) => s + f.delayMs, 0);
  const totalBytes = estimateTotalSize(reordered, input.paletteSize);
  const avgDelay = averageDelay(frames.map((f) => f.delayMs));
  const end = typeof performance !== "undefined" ? performance.now() : Date.now();

  const stats: GifStats = {
    frameCount: frames.length,
    totalDelayMs: totalDelay,
    totalDurationSec: totalDelay / 1000,
    averageDelayMs: Math.round(avgDelay * 100) / 100,
    finalWidth: final.width,
    finalHeight: final.height,
    paletteSize: input.paletteSize,
    estimatedTotalBytes: totalBytes,
    estimatedTotalKb: Math.round((totalBytes / 1024) * 100) / 100,
    fps: Math.round(fpsFromDelay(avgDelay) * 100) / 100,
    loopLabel: loopLabel(input.loopCount),
    durationMs: Math.max(0, end - start),
  };

  const qs = qualityScore(input.paletteSize, frames.length, totalBytes);

  const manifest = [
    "Index,FileName,Width,Height,DelayMs,EstimatedBytes",
    ...frames.map((f) => `${f.index},${f.fileName},${f.width},${f.height},${f.delayMs},${f.estimatedBytes}`),
  ].join("\n");

  return { frames, stats, warnings, qualityScore: qs, manifest };
}

/** Batch helper. */
export function batchComputeGif(inputs: GifInput[]): (GifResult | { error: string })[] {
  return inputs.map((input) => computeGif(input));
}

/** Stats to CSV. */
export function statsToCsv(stats: GifStats): string {
  return [
    "Field,Value",
    `FrameCount,${stats.frameCount}`,
    `TotalDelayMs,${stats.totalDelayMs}`,
    `TotalDurationSec,${stats.totalDurationSec.toFixed(2)}`,
    `AverageDelayMs,${stats.averageDelayMs}`,
    `FinalWidth,${stats.finalWidth}`,
    `FinalHeight,${stats.finalHeight}`,
    `PaletteSize,${stats.paletteSize}`,
    `EstimatedTotalBytes,${stats.estimatedTotalBytes}`,
    `EstimatedTotalKb,${stats.estimatedTotalKb}`,
    `FPS,${stats.fps}`,
    `Loop,${stats.loopLabel}`,
    `DurationMs,${stats.durationMs.toFixed(2)}`,
  ].join("\n");
}

/** Aspect ratio helper. */
export function aspectRatio(width: number, height: number): number {
  if (height <= 0) return 0;
  return width / height;
}
