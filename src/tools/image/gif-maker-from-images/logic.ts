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

// ============================================================================
// Backward-compat stub exports (added to satisfy UI template imports).
// ============================================================================

export function getStats(input: string, output: string): {
  inputSize: number;
  outputSize: number;
} {
  return {
    inputSize: new Blob([input]).size,
    outputSize: new Blob([output]).size,
  };
}

export function validate(input: string): string[] {
  const issues: string[] = [];
  if (!input || input.trim().length === 0) {
    issues.push("Input is empty.");
  }
  return issues;
}

export function process(input: string): { output: string; error: string | null } {
  try {
    const result = calculateTotalDuration(input);
    if (typeof result === "string") {
      return { output: result, error: null };
    }
    if (result && typeof result === "object") {
      const r = result as Record<string, unknown>;
      const output =
        (typeof r.output === "string" && r.output) ||
        (typeof r.html === "string" && r.html) ||
        (typeof r.result === "string" && r.result) ||
        (typeof r.text === "string" && r.text) ||
        (typeof r.code === "string" && r.code) ||
        (typeof r.value === "string" && r.value) ||
        JSON.stringify(result, null, 2);
      const error =
        (typeof r.error === "string" && r.error) ||
        (r.ok === false && typeof r.message === "string" && r.message) ||
        null;
      return { output, error };
    }
    return { output: String(result), error: null };
  } catch (e) {
    return { output: "", error: (e as Error).message };
  }
}
