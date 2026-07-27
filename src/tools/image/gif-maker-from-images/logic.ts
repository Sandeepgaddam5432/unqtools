/**
 * GIF Maker (from Images) — pure logic.
 */

export interface GifFrameOptions {
  delay: number;
  disposal: number;
  transparent: boolean;
}

export interface GifEncoderOptions {
  width: number;
  height: number;
  loopCount: number; // 0 = infinite
  background: string;
  frames: { delay: number; disposal: number }[];
}

export function defaultFrameOptions(): GifFrameOptions {
  return { delay: 100, disposal: 0, transparent: false };
}

export function defaultEncoderOptions(): GifEncoderOptions {
  return { width: 200, height: 200, loopCount: 0, background: "#ffffff", frames: [] };
}

export function calculateTotalDuration(frames: { delay: number }[]): number {
  return frames.reduce((sum, f) => sum + f.delay, 0);
}

export function calculateFps(frames: { delay: number }[]): number {
  if (frames.length === 0) return 0;
  const avg = calculateTotalDuration(frames) / frames.length;
  return avg > 0 ? Math.round(1000 / avg) : 0;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function estimateFileSize(width: number, height: number, frameCount: number, colors: number = 256): number {
  const bytesPerFrame = Math.ceil((width * height * Math.log2(colors)) / 8);
  const header = 13 + 3 * colors;
  const lzwOverhead = 0.8;
  return Math.round((header + bytesPerFrame * frameCount) * lzwOverhead);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

export function getFramePresets(): { label: string; delay: number }[] {
  return [
    { label: "Fast (50ms)", delay: 50 },
    { label: "Normal (100ms)", delay: 100 },
    { label: "Slow (200ms)", delay: 200 },
    { label: "Very slow (500ms)", delay: 500 },
    { label: "1 second", delay: 1000 },
  ];
}

export function getDisposalMethods(): { value: number; label: string }[] {
  return [
    { value: 0, label: "None (default)" },
    { value: 1, label: "Do not dispose" },
    { value: 2, label: "Restore to background" },
    { value: 3, label: "Restore to previous" },
  ];
}
