/**
 * GIF Optimizer & Compressor — pure logic.
 */

export interface OptimizationOptions {
  maxColors: number;
  removeDuplicateFrames: boolean;
  frameDropInterval: number;
  resizeWidth: number;
  lossyCompression: number;
}

export function defaultOptions(): OptimizationOptions {
  return { maxColors: 256, removeDuplicateFrames: true, frameDropInterval: 1, resizeWidth: 0, lossyCompression: 0 };
}

export interface OptimizationResult {
  originalSize: number;
  optimizedSize: number;
  savings: number;
  savingsPercent: number;
  frameCount: number;
  colorCount: number;
  warnings: string[];
}

export function calculateOptimization(originalSize: number, opts: OptimizationOptions, frameCount: number): OptimizationResult {
  const warnings: string[] = [];
  let estimatedSize = originalSize;
  if (opts.maxColors < 256) { estimatedSize *= opts.maxColors / 256; warnings.push(`Color reduction to ${opts.maxColors} colors`); }
  if (opts.removeDuplicateFrames && frameCount > 1) { const removed = Math.floor(frameCount * 0.15); estimatedSize *= 1 - removed / frameCount; warnings.push(`Removed ~${removed} duplicate frames`); }
  if (opts.frameDropInterval > 1) { const kept = Math.ceil(frameCount / opts.frameDropInterval); estimatedSize *= kept / frameCount; warnings.push(`Kept ${kept} of ${frameCount} frames`); }
  if (opts.resizeWidth > 0) { estimatedSize *= 0.5; warnings.push(`Resized to ${opts.resizeWidth}px width`); }
  if (opts.lossyCompression > 0) { estimatedSize *= 1 - opts.lossyCompression / 100; warnings.push(`Lossy compression: ${opts.lossyCompression}%`); }
  const savings = originalSize - estimatedSize;
  return { originalSize, optimizedSize: Math.round(estimatedSize), savings: Math.round(savings), savingsPercent: Math.round((savings / originalSize) * 100), frameCount, colorCount: opts.maxColors, warnings };
}

export function getColorPresets(): { label: string; value: number }[] {
  return [{ label: "256 colors (full)", value: 256 }, { label: "128 colors", value: 128 }, { label: "64 colors", value: 64 }, { label: "32 colors", value: 32 }, { label: "16 colors", value: 16 }];
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}
