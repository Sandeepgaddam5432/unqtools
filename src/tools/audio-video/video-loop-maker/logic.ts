/**
 * Video Loop Maker — pure logic.
 * Plans video looping by computing loop counts, total duration, seamless
 * loop points (crossfade-aware), and output file size estimates.
 */

export interface LoopParams {
  sourceDurationSec: number;
  loopCount: number; // 1..100
  crossfadeSec: number; // 0..5 (overlap duration)
  trimStartSec: number; // optional trim from start
  trimEndSec: number; // optional trim from end
}

export const DEFAULT_PARAMS: LoopParams = {
  sourceDurationSec: 10,
  loopCount: 3,
  crossfadeSec: 0,
  trimStartSec: 0,
  trimEndSec: 0,
};

export interface LoopPlan {
  effectiveDurationSec: number; // after trim
  loopCount: number;
  crossfadeSec: number;
  totalDurationSec: number;
  loopPoints: number[]; // start times of each loop
  seamlessPossible: boolean;
  outputBytesEstimate: number;
  recommendations: string[];
}

/** Validate loop params. */
export function validateParams(p: LoopParams): { ok: boolean; reason?: string } {
  if (p.sourceDurationSec <= 0) return { ok: false, reason: "Source duration must be positive." };
  if (p.loopCount < 1 || p.loopCount > 100) return { ok: false, reason: "Loop count must be 1..100." };
  if (p.crossfadeSec < 0 || p.crossfadeSec > 5) return { ok: false, reason: "Crossfade must be 0..5 seconds." };
  if (p.trimStartSec < 0 || p.trimEndSec < 0) return { ok: false, reason: "Trims must be non-negative." };
  if (p.trimStartSec + p.trimEndSec >= p.sourceDurationSec) return { ok: false, reason: "Trims exceed source duration." };
  if (p.crossfadeSec * 2 >= effectiveDuration(p)) return { ok: false, reason: "Crossfade too large for trimmed duration." };
  return { ok: true };
}

/** Compute effective (trimmed) source duration. */
export function effectiveDuration(p: LoopParams): number {
  return Math.max(0, p.sourceDurationSec - p.trimStartSec - p.trimEndSec);
}

/** Compute total duration of the looped output. */
export function totalDuration(p: LoopParams): number {
  const eff = effectiveDuration(p);
  if (eff <= 0) return 0;
  // Each loop after the first overlaps by crossfadeSec
  const overlap = Math.min(p.crossfadeSec, eff) * Math.max(0, p.loopCount - 1);
  return eff * p.loopCount - overlap;
}

/** Compute start time of each loop iteration. */
export function loopStartTimes(p: LoopParams): number[] {
  const eff = effectiveDuration(p);
  const times: number[] = [0];
  for (let i = 1; i < p.loopCount; i++) {
    const prev = times[i - 1];
    times.push(prev + eff - Math.min(p.crossfadeSec, eff));
  }
  return times;
}

/** Detect if a seamless loop is possible. */
export function detectSeamlessLoop(p: LoopParams): boolean {
  // Without pixel analysis we can only check that crossfade is configured
  // and source duration is reasonable
  return p.crossfadeSec > 0 && effectiveDuration(p) > p.crossfadeSec * 2;
}

/** Estimate output file size given a bitrate (Mbps). */
export function estimateOutputBytes(durationSec: number, bitrateMbps: number): number {
  return Math.round((durationSec * bitrateMbps * 1_000_000) / 8);
}

/** Recommend an optimal crossfade duration based on source length. */
export function recommendCrossfade(sourceDurationSec: number): number {
  if (sourceDurationSec < 2) return 0;
  if (sourceDurationSec < 5) return 0.2;
  if (sourceDurationSec < 15) return 0.5;
  return 1;
}

/** Recommend loop count based on target total duration. */
export function recommendLoopCount(sourceDurationSec: number, targetDurationSec: number): number {
  if (sourceDurationSec <= 0) return 1;
  return Math.max(1, Math.round(targetDurationSec / sourceDurationSec));
}

/** Build the full loop plan. */
export function buildLoopPlan(p: LoopParams, bitrateMbps = 4): LoopPlan {
  const eff = effectiveDuration(p);
  const total = totalDuration(p);
  const loopPoints = loopStartTimes(p);
  const seamless = detectSeamlessLoop(p);
  const est = estimateOutputBytes(total, bitrateMbps);
  const recommendations: string[] = [];
  if (!seamless && p.crossfadeSec === 0) recommendations.push("Add a 0.5s crossfade for smoother transitions.");
  if (eff < 1) recommendations.push("Very short loop — may flicker.");
  if (p.loopCount > 10) recommendations.push("Many loops — consider pre-rendering a longer clip.");
  if (eff < p.crossfadeSec * 2 && p.crossfadeSec > 0) recommendations.push("Crossfade is large relative to clip length.");
  return {
    effectiveDurationSec: eff,
    loopCount: p.loopCount,
    crossfadeSec: p.crossfadeSec,
    totalDurationSec: total,
    loopPoints,
    seamlessPossible: seamless,
    outputBytesEstimate: est,
    recommendations,
  };
}

/** Format duration as mm:ss.s. */
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

/** Generate an FFmpeg command for the loop. */
export function generateFfmpegCommand(p: LoopParams, inputFile = "input.mp4", outputFile = "output.mp4"): string {
  const eff = effectiveDuration(p);
  const total = totalDuration(p);
  const trim = p.trimStartSec > 0 || p.trimEndSec > 0
    ? `-ss ${p.trimStartSec} -t ${eff} `
    : "";
  if (p.crossfadeSec > 0) {
    // Use xfade filter for crossfade loops (simplified for 2 loops)
    const cmd = `ffmpeg ${trim}-i ${inputFile} -filter_complex "` +
      `[0:v][0:v]xfade=transition=fade:duration=${p.crossfadeSec}:offset=${eff - p.crossfadeSec}[v];` +
      `[0:a][0:a]acrossfade=d=${p.crossfadeSec}[a]" -map "[v]" -map "[a]" -t ${total} ${outputFile}`;
    return cmd;
  }
  return `ffmpeg ${trim}-stream_loop ${p.loopCount - 1} -i ${inputFile} -c copy -t ${total} ${outputFile}`;
}

/** Compute the effective loop factor (total / source). */
export function loopFactor(p: LoopParams): number {
  if (p.sourceDurationSec <= 0) return 1;
  return totalDuration(p) / p.sourceDurationSec;
}
