/**
 * Time-Lapse Maker — pure logic.
 * Plans time-lapse rendering by computing frame interval, output FPS,
 * total duration, and frame selection from a source video or photo series.
 */

export interface TimeLapseParams {
  sourceDurationSec: number; // total recorded duration
  sourceFps: number;
  frameIntervalSec: number; // every N seconds, take one frame
  outputFps: number;
  outputDurationSec?: number; // optional target — overrides frameInterval if set
}

export const DEFAULT_PARAMS: TimeLapseParams = {
  sourceDurationSec: 3600, // 1 hour
  sourceFps: 30,
  frameIntervalSec: 5,
  outputFps: 30,
};

export interface TimeLapsePlan {
  sourceFrames: number;
  selectedFrames: number; // frames kept
  droppedFrames: number;
  outputFrames: number;
  outputDurationSec: number;
  speedupFactor: number; // source / output
  bytesEstimate: number;
  description: string;
  recommendations: string[];
}

/** Validate params. */
export function validateParams(p: TimeLapseParams): { ok: boolean; reason?: string } {
  if (p.sourceDurationSec <= 0) return { ok: false, reason: "Source duration must be positive." };
  if (p.sourceFps < 1 || p.sourceFps > 240) return { ok: false, reason: "Source FPS must be 1..240." };
  if (p.outputFps < 1 || p.outputFps > 240) return { ok: false, reason: "Output FPS must be 1..240." };
  if (p.frameIntervalSec <= 0) return { ok: false, reason: "Frame interval must be positive." };
  return { ok: true };
}

/** Compute total source frames. */
export function sourceFrames(p: TimeLapseParams): number {
  return Math.round(p.sourceDurationSec * p.sourceFps);
}

/** Compute effective frame interval (if output duration is set, derive interval). */
export function effectiveInterval(p: TimeLapseParams): number {
  if (p.outputDurationSec && p.outputDurationSec > 0) {
    const totalOutputFrames = p.outputDurationSec * p.outputFps;
    if (totalOutputFrames <= 0) return p.frameIntervalSec;
    return p.sourceDurationSec / totalOutputFrames;
  }
  return p.frameIntervalSec;
}

/** Compute the number of frames selected (one per interval). */
export function selectedFrames(p: TimeLapseParams): number {
  const interval = effectiveInterval(p);
  return Math.max(1, Math.floor(p.sourceDurationSec / interval));
}

/** Compute output duration. */
export function outputDuration(p: TimeLapseParams): number {
  return selectedFrames(p) / p.outputFps;
}

/** Compute speedup factor (how much faster the output is than real time). */
export function speedupFactor(p: TimeLapseParams): number {
  const out = outputDuration(p);
  if (out <= 0) return 0;
  return p.sourceDurationSec / out;
}

/** Compute dropped frames. */
export function droppedFrames(p: TimeLapseParams): number {
  return Math.max(0, sourceFrames(p) - selectedFrames(p));
}

/** Recommend a frame interval based on source duration and target output. */
export function recommendInterval(sourceDurationSec: number, targetOutputSec: number, outputFps: number): number {
  const targetFrames = targetOutputSec * outputFps;
  if (targetFrames <= 0) return 1;
  return sourceDurationSec / targetFrames;
}

/** Recommend output FPS for smooth playback. */
export function recommendOutputFps(selectedFrames: number, targetDurationSec: number): number {
  if (targetDurationSec <= 0) return 30;
  const fps = Math.round(selectedFrames / targetDurationSec);
  return Math.min(60, Math.max(15, fps));
}

/** Estimate output bytes. */
export function estimateOutputBytes(durationSec: number, bitrateMbps: number): number {
  return Math.round((durationSec * bitrateMbps * 1_000_000) / 8);
}

/** Build full plan. */
export function buildPlan(p: TimeLapseParams, bitrateMbps = 4): TimeLapsePlan {
  const sf = sourceFrames(p);
  const sel = selectedFrames(p);
  const dropped = droppedFrames(p);
  const out = outputDuration(p);
  const speedup = speedupFactor(p);
  const est = estimateOutputBytes(out, bitrateMbps);
  const recommendations: string[] = [];
  if (sel < 30) recommendations.push("Very few selected frames — output may be very short.");
  if (p.frameIntervalSec > 60) recommendations.push("Large frame interval — motion may look jumpy.");
  if (p.outputFps > 30 && sel < 300) recommendations.push("High output FPS with few frames — consider lowering FPS.");
  if (speedup > 1000) recommendations.push("Extreme speedup — consider higher frame interval for smoother motion.");
  return {
    sourceFrames: sf,
    selectedFrames: sel,
    droppedFrames: dropped,
    outputFrames: sel,
    outputDurationSec: out,
    speedupFactor: speedup,
    bytesEstimate: est,
    description: `Take 1 frame every ${effectiveInterval(p).toFixed(2)}s from ${p.sourceDurationSec}s source → ${sel} frames at ${p.outputFps}fps = ${out.toFixed(2)}s output (${speedup.toFixed(1)}× speedup).`,
    recommendations,
  };
}

/** Generate an FFmpeg select-filter command. */
export function generateFfmpegCommand(p: TimeLapseParams, inputFile = "input.mp4", outputFile = "output.mp4"): string {
  const interval = effectiveInterval(p);
  // select one frame every `interval` seconds
  return `ffmpeg -i ${inputFile} -vf "select='not(mod(n\\,${Math.max(1, Math.round(interval * p.sourceFps))}))',setpts=N/${p.outputFps}/TB,fps=${p.outputFps}" -an ${outputFile}`;
}

/** Format duration. */
export function formatDuration(seconds: number): string {
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  if (seconds < 60) return `${seconds.toFixed(2)}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  if (m < 60) return `${m}m ${s.toFixed(1)}s`;
  const h = Math.floor(m / 60);
  const mm = m - h * 60;
  return `${h}h ${mm}m`;
}

/** Format bytes. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Common presets. */
export const PRESETS: Array<{ name: string; sourceDurationSec: number; frameIntervalSec: number; outputFps: number; description: string }> = [
  { name: "Cloud timelapse", sourceDurationSec: 3600, frameIntervalSec: 5, outputFps: 30, description: "1 hour of clouds → ~24s smooth video." },
  { name: "Sunset", sourceDurationSec: 1800, frameIntervalSec: 3, outputFps: 30, description: "30-min sunset → ~20s of footage." },
  { name: "Construction", sourceDurationSec: 86400, frameIntervalSec: 60, outputFps: 24, description: "1 day → 60s of construction." },
  { name: "Plant growth", sourceDurationSec: 432000, frameIntervalSec: 600, outputFps: 15, description: "5 days → 60s of growth." },
];
