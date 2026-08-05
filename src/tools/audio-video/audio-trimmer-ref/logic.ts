/**
 * Audio Trimmer Reference — pure logic.
 * Reference for time selection, fade in/out, format export, silence detection.
 */

export interface TrimSegment {
  startSeconds: number;
  endSeconds: number;
  label?: string;
}

export interface FadeConfig {
  type: "none" | "linear" | "logarithmic" | "exponential" | "s-curve";
  durationSeconds: number;
}

export interface TrimJob {
  sourceDurationSeconds: number;
  segments: TrimSegment[];
  fadeIn: FadeConfig;
  fadeOut: FadeConfig;
  outputFormat: string;
  crossfadeSeconds: number;
}

export interface TrimResult {
  job: TrimJob;
  totalOutputSeconds: number;
  segmentsRemoved: number;
  outputSegments: TrimSegment[];
  warnings: string[];
  notes: string[];
  ffmpegCommands: string[];
  estimatedOutputBytes: number;
  estimatedOutputHuman: string;
}

const SUPPORTED_FORMATS = [
  { id: "mp3", label: "MP3", ext: "mp3", bitrateKbps: 192 },
  { id: "wav", label: "WAV (PCM)", ext: "wav", bitrateKbps: 1411 },
  { id: "aac", label: "AAC", ext: "m4a", bitrateKbps: 192 },
  { id: "ogg", label: "Ogg Vorbis", ext: "ogg", bitrateKbps: 160 },
  { id: "flac", label: "FLAC", ext: "flac", bitrateKbps: 900 },
  { id: "opus", label: "Opus", ext: "opus", bitrateKbps: 128 },
];

export function getSupportedFormats() {
  return [...SUPPORTED_FORMATS];
}

export function getFormatById(id: string) {
  return SUPPORTED_FORMATS.find((f) => f.id === id) ?? null;
}

/** Format seconds as M:SS.mmm (e.g. 1:23.456). */
export function formatTimestamp(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00.000";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds - Math.floor(seconds)) * 1000);
  return `${m}:${s < 10 ? "0" : ""}${s}.${ms < 10 ? "00" : ms < 100 ? "0" : ""}${ms}`;
}

/** Parse a timestamp string (M:SS, M:SS.mmm, SSS.mmm, or plain seconds) into a number. */
export function parseTimestamp(input: string): number | null {
  const s = input.trim();
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  const m = s.match(/^(\d+):([0-5]?\d)(?:\.(\d{1,3}))?$/);
  if (!m) return null;
  const minutes = parseInt(m[1], 10);
  const seconds = parseInt(m[2], 10);
  const ms = m[3] ? parseInt(m[3].padEnd(3, "0"), 10) : 0;
  return minutes * 60 + seconds + ms / 1000;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

/** Validate a trim segment against the source duration. */
export function validateSegment(segment: TrimSegment, sourceDuration: number): { ok: boolean; error?: string } {
  if (segment.startSeconds < 0) return { ok: false, error: "Start must be ≥ 0." };
  if (segment.endSeconds > sourceDuration) return { ok: false, error: `End ${segment.endSeconds}s exceeds source duration ${sourceDuration}s.` };
  if (segment.startSeconds >= segment.endSeconds) return { ok: false, error: "Start must be < end." };
  return { ok: true };
}

/** Detect silence regions using simple threshold model. Returns array of segments to KEEP. */
export interface SilenceRegion {
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
}

/** Given silence regions and source duration, compute segments to KEEP (i.e., gaps between silences). */
export function invertSilenceRegions(silences: SilenceRegion[], sourceDuration: number): TrimSegment[] {
  if (silences.length === 0) return [{ startSeconds: 0, endSeconds: sourceDuration, label: "Full clip" }];
  const sorted = [...silences].sort((a, b) => a.startSeconds - b.startSeconds);
  const out: TrimSegment[] = [];
  let cursor = 0;
  for (const s of sorted) {
    if (s.startSeconds > cursor) {
      out.push({ startSeconds: cursor, endSeconds: s.startSeconds, label: `Keep ${out.length + 1}` });
    }
    cursor = Math.max(cursor, s.endSeconds);
  }
  if (cursor < sourceDuration) {
    out.push({ startSeconds: cursor, endSeconds: sourceDuration, label: `Keep ${out.length + 1}` });
  }
  return out;
}

/** Filter out silence regions shorter than minDurationSeconds (often noise / breath). */
export function filterShortSilences(silences: SilenceRegion[], minDurationSeconds: number): SilenceRegion[] {
  return silences.filter((s) => s.durationSeconds >= minDurationSeconds);
}

/** Plan a trim job. */
export function planTrim(job: TrimJob): TrimResult {
  const warnings: string[] = [];
  const notes: string[] = [];
  const outputSegments: TrimSegment[] = [];

  if (job.sourceDurationSeconds <= 0) warnings.push("Source duration must be > 0.");
  if (job.fadeIn.durationSeconds < 0) warnings.push("Fade-in duration must be ≥ 0.");
  if (job.fadeOut.durationSeconds < 0) warnings.push("Fade-out duration must be ≥ 0.");
  if (job.crossfadeSeconds < 0) warnings.push("Crossfade duration must be ≥ 0.");

  for (const seg of job.segments) {
    const v = validateSegment(seg, job.sourceDurationSeconds);
    if (!v.ok) warnings.push(`Segment ${formatTimestamp(seg.startSeconds)} → ${formatTimestamp(seg.endSeconds)}: ${v.error}`);
    else outputSegments.push(seg);
  }

  if (outputSegments.length === 0) warnings.push("No valid segments — output will be empty.");

  // Fade-in/out exceeding segment duration
  for (const seg of outputSegments) {
    const dur = seg.endSeconds - seg.startSeconds;
    if (job.fadeIn.durationSeconds + job.fadeOut.durationSeconds > dur) {
      warnings.push(`Fade total (${job.fadeIn.durationSeconds + job.fadeOut.durationSeconds}s) exceeds segment duration (${dur.toFixed(2)}s) at ${formatTimestamp(seg.startSeconds)}.`);
    }
  }

  const totalOutputSeconds = outputSegments.reduce((sum, s) => sum + (s.endSeconds - s.startSeconds), 0)
    - Math.max(0, outputSegments.length - 1) * job.crossfadeSeconds;
  const segmentsRemoved = Math.max(0, 1) * (outputSegments.length === 0 ? 0 : 0);

  const format = getFormatById(job.outputFormat);
  if (!format) warnings.push("Unknown output format.");
  const bitrateKbps = format?.bitrateKbps ?? 128;
  const estimatedOutputBytes = Math.round((bitrateKbps * 1000 * totalOutputSeconds) / 8);

  if (job.crossfadeSeconds > 0 && outputSegments.length > 1) {
    notes.push(`${outputSegments.length - 1} crossfades of ${job.crossfadeSeconds}s each.`);
  }
  if (job.fadeIn.type !== "none" && outputSegments.length > 0) {
    notes.push(`Fade-in: ${job.fadeIn.type} curve, ${job.fadeIn.durationSeconds}s.`);
  }

  const ffmpegCommands = outputSegments.map((seg, i) => {
    const dur = seg.endSeconds - seg.startSeconds;
    const enc = job.outputFormat === "wav" ? "pcm_s16le" : job.outputFormat === "mp3" ? "libmp3lame" : job.outputFormat === "aac" ? "aac" : job.outputFormat === "flac" ? "flac" : job.outputFormat === "opus" ? "libopus" : "libvorbis";
    const fade = job.fadeIn.type !== "none" && job.fadeIn.durationSeconds > 0
      ? `-af "afade=t=in:st=0:d=${job.fadeIn.durationSeconds},afade=t=out:st=${Math.max(0, dur - job.fadeOut.durationSeconds)}:d=${job.fadeOut.durationSeconds}"`
      : "";
    return `ffmpeg -i input.${format?.ext ?? "wav"} -ss ${seg.startSeconds} -t ${dur} -c:a ${enc} -b:a ${bitrateKbps}k ${fade} output-${i + 1}.${format?.ext ?? "wav"}`;
  });

  return {
    job, totalOutputSeconds, segmentsRemoved, outputSegments,
    warnings, notes, ffmpegCommands,
    estimatedOutputBytes, estimatedOutputHuman: formatBytes(estimatedOutputBytes),
  };
}

/** Plan batch of trim jobs. */
export function planBatch(jobs: TrimJob[]): TrimResult[] {
  return jobs.map(planTrim);
}

export function renderBatchCsv(results: TrimResult[]): string {
  const lines: string[] = ["job_index,segment_count,total_output_s,size_bytes,format"];
  results.forEach((r, i) => {
    lines.push([String(i + 1), String(r.outputSegments.length), r.totalOutputSeconds.toFixed(2), String(r.estimatedOutputBytes), r.job.outputFormat].join(","));
  });
  return lines.join("\n");
}

export function renderReport(r: TrimResult): string {
  const lines: string[] = [];
  lines.push("Audio Trim Plan");
  lines.push("================");
  lines.push(`Source duration: ${formatTimestamp(r.job.sourceDurationSeconds)} (${r.job.sourceDurationSeconds.toFixed(2)} s)`);
  lines.push(`Output format: ${r.job.outputFormat}`);
  lines.push(`Segments: ${r.outputSegments.length}`);
  lines.push(`Total output: ${formatTimestamp(r.totalOutputSeconds)} (${r.totalOutputSeconds.toFixed(2)} s)`);
  lines.push(`Estimated size: ${r.estimatedOutputHuman} (${r.estimatedOutputBytes} bytes)`);
  lines.push("");
  lines.push("Segments:");
  r.outputSegments.forEach((s, i) => {
    const dur = s.endSeconds - s.startSeconds;
    lines.push(`  ${i + 1}. ${formatTimestamp(s.startSeconds)} → ${formatTimestamp(s.endSeconds)} (${dur.toFixed(2)} s)${s.label ? ` — ${s.label}` : ""}`);
  });
  lines.push("");
  lines.push("ffmpeg commands:");
  r.ffmpegCommands.forEach((c) => { lines.push(c); lines.push(""); });
  if (r.warnings.length) { lines.push("Warnings:"); r.warnings.forEach((w) => lines.push(`  ! ${w}`)); }
  if (r.notes.length) { lines.push(""); lines.push("Notes:"); r.notes.forEach((n) => lines.push(`  • ${n}`)); }
  return lines.join("\n");
}

/** Common fade presets for quick selection. */
export const FADE_PRESETS = [
  { id: "none", label: "No fade", type: "none" as const, durationSeconds: 0 },
  { id: "short-linear", label: "Short linear (0.2s)", type: "linear" as const, durationSeconds: 0.2 },
  { id: "medium-linear", label: "Medium linear (0.5s)", type: "linear" as const, durationSeconds: 0.5 },
  { id: "long-linear", label: "Long linear (1.0s)", type: "linear" as const, durationSeconds: 1.0 },
  { id: "smooth-s", label: "S-curve smooth (0.5s)", type: "s-curve" as const, durationSeconds: 0.5 },
  { id: "expo", label: "Exponential (0.3s)", type: "exponential" as const, durationSeconds: 0.3 },
];

export function getFadePresets() {
  return [...FADE_PRESETS];
}

/** Generate a sample silence region list from a list of durations (for testing / demo). */
export function generateSilenceDemo(sourceDuration: number, gapEvery: number = 30, gapLength: number = 2): SilenceRegion[] {
  const out: SilenceRegion[] = [];
  for (let t = gapEvery; t < sourceDuration; t += gapEvery) {
    out.push({ startSeconds: t, endSeconds: Math.min(sourceDuration, t + gapLength), durationSeconds: Math.min(gapLength, sourceDuration - t) });
  }
  return out;
}

/** Detect likely silence based on a simulated amplitude array (RMS). Returns silence regions. */
export function detectSilenceFromAmplitude(samples: number[], threshold: number, minDurationSeconds: number, sampleRate: number): SilenceRegion[] {
  const out: SilenceRegion[] = [];
  let inSilence = false;
  let silenceStart = 0;
  for (let i = 0; i < samples.length; i++) {
    if (samples[i] < threshold) {
      if (!inSilence) { inSilence = true; silenceStart = i / sampleRate; }
    } else {
      if (inSilence) {
        const end = i / sampleRate;
        const dur = end - silenceStart;
        if (dur >= minDurationSeconds) out.push({ startSeconds: silenceStart, endSeconds: end, durationSeconds: dur });
        inSilence = false;
      }
    }
  }
  if (inSilence) {
    const end = samples.length / sampleRate;
    const dur = end - silenceStart;
    if (dur >= minDurationSeconds) out.push({ startSeconds: silenceStart, endSeconds: end, durationSeconds: dur });
  }
  return out;
}
