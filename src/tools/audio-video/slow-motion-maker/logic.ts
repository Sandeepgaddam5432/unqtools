/**
 * Slow Motion Maker — pure logic.
 * Plans slow-motion video rendering with speed factor, frame interpolation
 * references (none / dup / blend / motion-compensation), and duration
 * calculations.
 */

export type InterpolationMode = "none" | "dup" | "blend" | "mci";

export interface SlowMotionParams {
  sourceDurationSec: number;
  sourceFps: number;
  speedFactor: number; // 0.1..1.0 (slower); values <1 = slow-mo, >1 = speed-up
  interpolation: InterpolationMode;
  targetFps?: number; // optional output fps override
}

export const DEFAULT_PARAMS: SlowMotionParams = {
  sourceDurationSec: 10,
  sourceFps: 30,
  speedFactor: 0.5,
  interpolation: "blend",
};

export interface SlowMotionPlan {
  sourceFrames: number;
  outputFrames: number;
  outputDurationSec: number;
  outputFps: number;
  interpolatedFrames: number; // new frames inserted
  realTimeRatio: number; // output duration / source duration
  bytesEstimate: number;
  description: string;
  warnings: string[];
}

/** Validate params. */
export function validateParams(p: SlowMotionParams): { ok: boolean; reason?: string } {
  if (p.sourceDurationSec <= 0) return { ok: false, reason: "Source duration must be positive." };
  if (p.sourceFps < 1 || p.sourceFps > 240) return { ok: false, reason: "Source FPS must be 1..240." };
  if (p.speedFactor < 0.05 || p.speedFactor > 5) return { ok: false, reason: "Speed factor must be 0.05..5." };
  if (p.targetFps !== undefined && (p.targetFps < 1 || p.targetFps > 240)) return { ok: false, reason: "Target FPS must be 1..240." };
  return { ok: true };
}

/** Compute total source frames. */
export function sourceFrames(p: SlowMotionParams): number {
  return Math.round(p.sourceDurationSec * p.sourceFps);
}

/** Compute output frames. */
export function outputFrames(p: SlowMotionParams): number {
  const sf = sourceFrames(p);
  // Output duration = source / speedFactor
  return Math.round(sf / p.speedFactor);
}

/** Compute output duration in seconds. */
export function outputDuration(p: SlowMotionParams): number {
  return p.sourceDurationSec / p.speedFactor;
}

/** Compute output FPS. Defaults to source FPS unless overridden. */
export function outputFps(p: SlowMotionParams): number {
  return p.targetFps ?? p.sourceFps;
}

/** Compute number of interpolated frames added. */
export function interpolatedFrames(p: SlowMotionParams): number {
  const out = outputFrames(p);
  const sf = sourceFrames(p);
  return Math.max(0, out - sf);
}

/** Recommend an interpolation mode for a given speed factor. */
export function recommendInterpolation(speedFactor: number): InterpolationMode {
  if (speedFactor >= 0.75) return "none";
  if (speedFactor >= 0.5) return "dup";
  if (speedFactor >= 0.25) return "blend";
  return "mci";
}

/** Recommend a target FPS for smoother slow motion. */
export function recommendTargetFps(speedFactor: number, sourceFps: number): number {
  // Output should preserve original frame pacing: targetFps = sourceFps / speedFactor (clamped to 240)
  return Math.min(240, Math.round(sourceFps / speedFactor));
}

/** Estimate output bytes given bitrate (Mbps). */
export function estimateOutputBytes(durationSec: number, bitrateMbps: number): number {
  return Math.round((durationSec * bitrateMbps * 1_000_000) / 8);
}

/** Build full slow-motion plan. */
export function buildPlan(p: SlowMotionParams, bitrateMbps = 4): SlowMotionPlan {
  const sf = sourceFrames(p);
  const out = outputFrames(p);
  const dur = outputDuration(p);
  const fps = outputFps(p);
  const interp = interpolatedFrames(p);
  const real = dur / p.sourceDurationSec;
  const est = estimateOutputBytes(dur, bitrateMbps);
  const warnings: string[] = [];
  if (p.speedFactor < 0.25 && p.interpolation !== "mci") warnings.push("Very slow motion — motion-compensated interpolation recommended.");
  if (fps < 24) warnings.push("Output FPS <24 may look choppy.");
  if (p.interpolation === "none" && p.speedFactor < 0.75) warnings.push("No interpolation at this speed will look stuttery.");
  if (interp > sf * 5) warnings.push("Heavy interpolation — render time will be significant.");
  const interpDesc: Record<InterpolationMode, string> = {
    none: "no interpolation (frame dropping/duplication)",
    dup: "frame duplication",
    blend: "frame blending (crossfade)",
    mci: "motion-compensated interpolation",
  };
  return {
    sourceFrames: sf,
    outputFrames: out,
    outputDurationSec: dur,
    outputFps: fps,
    interpolatedFrames: interp,
    realTimeRatio: real,
    bytesEstimate: est,
    description: `Slow source ${p.sourceDurationSec}s @ ${p.sourceFps}fps by ${p.speedFactor}× (${interpDesc[p.interpolation]}) → ${dur.toFixed(2)}s @ ${fps}fps.`,
    warnings,
  };
}

/** Generate an FFmpeg command for slow motion. */
export function generateFfmpegCommand(p: SlowMotionParams, inputFile = "input.mp4", outputFile = "output.mp4"): string {
  const pts = 1 / p.speedFactor;
  const filter = p.interpolation === "mci"
    ? `minterpolate=fps=${outputFps(p)}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir`
    : p.interpolation === "blend"
      ? `tmix=frames=2,fps=${outputFps(p)}`
      : p.interpolation === "dup"
        ? `fps=${outputFps(p)}`
        : `fps=${outputFps(p)}`;
  return `ffmpeg -i ${inputFile} -filter:v "setpts=${pts.toFixed(3)}*PTS,${filter}" -filter:a "atempo=${p.speedFactor.toFixed(3)}" ${outputFile}`;
}

/** Format duration. */
export function formatDuration(seconds: number): string {
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return m > 0 ? `${m}m ${s.toFixed(1)}s` : `${s.toFixed(2)}s`;
}

/** Format bytes. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Common slow-mo presets. */
export const PRESETS: Array<{ name: string; speedFactor: number; interpolation: InterpolationMode; description: string }> = [
  { name: "Subtle (0.75×)", speedFactor: 0.75, interpolation: "none", description: "Slight slow-down for cinematic feel." },
  { name: "Half speed (0.5×)", speedFactor: 0.5, interpolation: "blend", description: "Standard slow motion with frame blending." },
  { name: "Quarter speed (0.25×)", speedFactor: 0.25, interpolation: "mci", description: "Dramatic slow-mo with motion compensation." },
  { name: "Ultra slow (0.1×)", speedFactor: 0.1, interpolation: "mci", description: "Extreme slow-mo — requires high source FPS." },
];
