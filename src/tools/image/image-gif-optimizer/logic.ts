/**
 * GIF Optimizer — pure logic.
 * Analyzes GIF frames (timing, color count, transparency) and computes
 * optimization options (color reduction, frame removal, frame deduplication,
 * transparency threshold) with estimated output sizes.
 */

export interface GifFrameInfo {
  index: number;
  width: number;
  height: number;
  delayMs: number; // delay to next frame
  disposal: 0 | 1 | 2 | 3; // unspecified/none/background/previous
  transparentIndex: number | null;
  colorCount: number;
  transparentPixels: number;
  hash: string; // perceptual hash for deduplication
}

export interface GifAnalysis {
  width: number;
  height: number;
  frameCount: number;
  totalDurationMs: number;
  avgFps: number;
  loopCount: number; // 0 = infinite
  globalColorCount: number;
  hasTransparency: boolean;
  frames: GifFrameInfo[];
  estimatedBytesRaw: number;
  estimatedBytesOptimized: number;
  recommendations: string[];
}

export interface OptimizeOptions {
  maxColors: number; // 2..256
  removeDuplicates: boolean;
  dropSimilarFrames: boolean;
  similarityThreshold: number; // 0..1
  minDelayMs: number; // drop frames below this
  transparencyThreshold: number; // 0..255 alpha threshold
}

export const DEFAULT_OPTIONS: OptimizeOptions = {
  maxColors: 128,
  removeDuplicates: true,
  dropSimilarFrames: false,
  similarityThreshold: 0.02,
  minDelayMs: 20,
  transparencyThreshold: 128,
};

/** Compute a simple perceptual hash for RGBA pixels (downsample 8×8 grayscale + average). */
export function frameHash(pixels: Uint8ClampedArray, width: number, height: number): string {
  const samples: number[] = [];
  const cells = 8;
  const cellW = width / cells;
  const cellH = height / cells;
  for (let cy = 0; cy < cells; cy++) {
    for (let cx = 0; cx < cells; cx++) {
      let sum = 0, count = 0;
      const startX = Math.floor(cx * cellW);
      const startY = Math.floor(cy * cellH);
      const endX = Math.floor((cx + 1) * cellW);
      const endY = Math.floor((cy + 1) * cellH);
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const i = (y * width + x) * 4;
          if (i + 3 >= pixels.length) continue;
          const l = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
          sum += l;
          count++;
        }
      }
      samples.push(count > 0 ? sum / count : 0);
    }
  }
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  return samples.map((s) => (s > avg ? "1" : "0")).join("");
}

/** Hamming distance between two binary hash strings. */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return Math.max(a.length, b.length);
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

/** Estimate GIF byte size: header + color table + per-frame LZW data. */
export function estimateGifBytes(width: number, height: number, frameCount: number, colorCount: number, hasTransparency: boolean): number {
  const header = 13;
  const logicalScreen = 7;
  const globalColorTable = Math.pow(2, Math.ceil(Math.log2(Math.max(2, colorCount)))) * 3;
  const perFrame = 20 + Math.pow(2, Math.ceil(Math.log2(Math.max(2, colorCount)))) * 0 + Math.floor((width * height) / 2.5);
  const transparency = hasTransparency ? frameCount * 1 : 0;
  return Math.round(header + logicalScreen + globalColorTable + perFrame * frameCount + transparency);
}

/** Build a GifFrameInfo summary from raw RGBA pixels + timing. */
export function buildFrameInfo(
  index: number,
  width: number,
  height: number,
  pixels: Uint8ClampedArray,
  delayMs: number,
  disposal: 0 | 1 | 2 | 3 = 0,
  transparentIndex: number | null = null,
  transparencyThreshold = 128,
): GifFrameInfo {
  // Count unique colors and transparent pixels
  const colors = new Set<number>();
  let transparentPixels = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const a = pixels[i + 3];
    if (a < transparencyThreshold) {
      transparentPixels++;
      continue;
    }
    // Pack RGB into 24-bit int (lose precision but fine for counting)
    colors.add((pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2]);
  }
  return {
    index,
    width,
    height,
    delayMs,
    disposal,
    transparentIndex,
    colorCount: Math.min(256, colors.size),
    transparentPixels,
    hash: frameHash(pixels, width, height),
  };
}

/** Recommend palette size based on actual color counts. */
export function recommendMaxColors(frames: GifFrameInfo[]): number {
  const max = Math.max(1, ...frames.map((f) => f.colorCount));
  const powers = [2, 4, 8, 16, 32, 64, 128, 256];
  for (const p of powers) if (p >= max) return p;
  return 256;
}

/** Detect duplicate frames by hash. Returns indices to drop. */
export function findDuplicateFrames(frames: GifFrameInfo[]): number[] {
  const drop: number[] = [];
  for (let i = 1; i < frames.length; i++) {
    if (frames[i].hash === frames[i - 1].hash) drop.push(i);
  }
  return drop;
}

/** Detect near-duplicate frames by hamming distance. Returns indices to drop. */
export function findSimilarFrames(frames: GifFrameInfo[], threshold = 4): number[] {
  const drop: number[] = [];
  for (let i = 1; i < frames.length; i++) {
    if (hammingDistance(frames[i].hash, frames[i - 1].hash) <= threshold) drop.push(i);
  }
  return drop;
}

/** Find frames with delay below a threshold (likely bad timing). */
export function findShortFrames(frames: GifFrameInfo[], minDelayMs = 20): number[] {
  return frames.filter((f) => f.delayMs < minDelayMs).map((f) => f.index);
}

/** Compute total duration of frames. */
export function totalDuration(frames: GifFrameInfo[]): number {
  return frames.reduce((s, f) => s + f.delayMs, 0);
}

/** Compute average FPS. */
export function averageFps(frames: GifFrameInfo[]): number {
  const total = totalDuration(frames);
  if (total === 0) return 0;
  return Math.round((frames.length / total) * 1000 * 10) / 10;
}

/** Full analysis combining all metrics. */
export function analyzeGif(
  width: number,
  height: number,
  frames: GifFrameInfo[],
  loopCount = 0,
  hasTransparency = false,
): GifAnalysis {
  const total = totalDuration(frames);
  const avgFps = averageFps(frames);
  const globalColorCount = recommendMaxColors(frames);
  const recommendations: string[] = [];
  if (globalColorCount > 128) recommendations.push("Reduce color count to 128 to halve size.");
  const dups = findDuplicateFrames(frames);
  if (dups.length > 0) recommendations.push(`Remove ${dups.length} duplicate frame(s).`);
  const shorts = findShortFrames(frames);
  if (shorts.length > 0) recommendations.push(`${shorts.length} frame(s) have very short delay (<20ms).`);
  const estRaw = estimateGifBytes(width, height, frames.length, 256, hasTransparency);
  const estOpt = estimateGifBytes(width, height, Math.max(1, frames.length - dups.length), globalColorCount, hasTransparency);
  return {
    width,
    height,
    frameCount: frames.length,
    totalDurationMs: total,
    avgFps,
    loopCount,
    globalColorCount,
    hasTransparency,
    frames,
    estimatedBytesRaw: estRaw,
    estimatedBytesOptimized: estOpt,
    recommendations,
  };
}

/** Apply optimization options; returns new frame list and estimated size. */
export function applyOptimizations(
  analysis: GifAnalysis,
  options: OptimizeOptions,
): { frames: GifFrameInfo[]; estimatedBytes: number; removedCount: number } {
  let frames = analysis.frames.slice();
  let removed = 0;
  if (options.removeDuplicates) {
    const dups = new Set(findDuplicateFrames(frames));
    frames = frames.filter((f) => !dups.has(f.index));
    removed += dups.size;
  }
  if (options.dropSimilarFrames) {
    const thresh = Math.round(options.similarityThreshold * 64); // 64 bits in hash
    const sim = new Set(findSimilarFrames(frames, thresh));
    frames = frames.filter((f) => !sim.has(f.index));
    removed += sim.size;
  }
  const colorCount = Math.min(options.maxColors, analysis.globalColorCount);
  const est = estimateGifBytes(analysis.width, analysis.height, frames.length, colorCount, analysis.hasTransparency);
  return { frames, estimatedBytes: est, removedCount: removed };
}

/** Format bytes as KB/MB. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Compute percent savings from raw to optimized. */
export function savingsPct(raw: number, optimized: number): number {
  if (raw <= 0) return 0;
  return Math.round(((raw - optimized) / raw) * 100);
}
