/**
 * Video Merger Reference — pure logic.
 * Reference for concatenation, transitions, format compatibility, resolution matching, audio sync.
 */

export interface VideoClipSpec {
  id: string;
  label: string;
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  audioCodec: string;
  audioSampleRate: number;
  hasAudio: boolean;
}

export interface TransitionSpec {
  id: string;
  label: string;
  durationSeconds: number;
  ffmpegFilter: string;
  description: string;
}

const TRANSITIONS: TransitionSpec[] = [
  { id: "none", label: "Cut (no transition)", durationSeconds: 0, ffmpegFilter: "", description: "Hard cut from clip A to clip B." },
  { id: "fade", label: "Cross-fade", durationSeconds: 1, ffmpegFilter: "xfade=transition=fade:duration=1:offset=OFFSET", description: "Smooth cross-fade between clips." },
  { id: "dissolve", label: "Dissolve", durationSeconds: 1, ffmpegFilter: "xfade=transition=dissolve:duration=1:offset=OFFSET", description: "Gradual dissolve between clips." },
  { id: "wipeleft", label: "Wipe left", durationSeconds: 0.5, ffmpegFilter: "xfade=transition=wipeleft:duration=0.5:offset=OFFSET", description: "Wipe transition from right to left." },
  { id: "slideleft", label: "Slide left", durationSeconds: 0.5, ffmpegFilter: "xfade=transition=slideleft:duration=0.5:offset=OFFSET", description: "Slide transition from right to left." },
  { id: "circleopen", label: "Circle open", durationSeconds: 0.7, ffmpegFilter: "xfade=transition=circleopen:duration=0.7:offset=OFFSET", description: "Iris-in circle reveal." },
  { id: "radial", label: "Radial wipe", durationSeconds: 0.6, ffmpegFilter: "xfade=transition=radial:duration=0.6:offset=OFFSET", description: "Radial wipe reveal." },
  { id: "pixelize", label: "Pixelize", durationSeconds: 0.8, ffmpegFilter: "xfade=transition=pixelize:duration=0.8:offset=OFFSET", description: "Pixelation transition." },
];

export function getTransitions(): TransitionSpec[] {
  return [...TRANSITIONS];
}

export function getTransition(id: string): TransitionSpec | null {
  return TRANSITIONS.find((t) => t.id === id) ?? null;
}

export interface MergeJob {
  clips: VideoClipSpec[];
  transitionId: string;
  /** Output resolution (largest clip's resolution if "auto"). */
  outputWidth: number;
  outputHeight: number;
  outputFps: number;
  outputCodec: string;
  audioSyncMode: "auto" | "resample" | "stretch" | "trim";
}

export interface MergeResult {
  job: MergeJob;
  totalDurationSeconds: number;
  resolutionMatch: { ok: boolean; mismatches: string[] };
  codecMatch: { ok: boolean; mismatches: string[] };
  fpsMatch: { ok: boolean; mismatches: string[] };
  audioSyncWarnings: string[];
  warnings: string[];
  notes: string[];
  ffmpegCommand: string;
  estimatedSizeBytes: number;
  estimatedSizeHuman: string;
}

const OUTPUT_CODECS = [
  { id: "h264", label: "H.264 (AVC)", encoder: "libx264", bitrateKbps: 5000 },
  { id: "h265", label: "H.265 (HEVC)", encoder: "libx265", bitrateKbps: 3000 },
  { id: "vp9", label: "VP9", encoder: "libvpx-vp9", bitrateKbps: 3000 },
  { id: "av1", label: "AV1", encoder: "libsvtav1", bitrateKbps: 2000 },
];

export function getOutputCodecs() { return [...OUTPUT_CODECS]; }

export function getOutputCodec(id: string) { return OUTPUT_CODECS.find((c) => c.id === id) ?? null; }

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export function planMerge(job: MergeJob): MergeResult {
  const warnings: string[] = [];
  const notes: string[] = [];
  const resolutionMismatches: string[] = [];
  const codecMismatches: string[] = [];
  const fpsMismatches: string[] = [];
  const audioSyncWarnings: string[] = [];

  if (job.clips.length === 0) warnings.push("No clips provided.");
  if (job.clips.length === 1) warnings.push("Only one clip — merge is a no-op.");

  const reference = job.clips[0];
  for (const clip of job.clips) {
    if (clip.width !== reference.width || clip.height !== reference.height) {
      resolutionMismatches.push(`${clip.id} (${clip.width}×${clip.height}) differs from first clip (${reference.width}×${reference.height}).`);
    }
    if (clip.codec !== reference.codec) codecMismatches.push(`${clip.id} (${clip.codec}) differs from first clip (${reference.codec}).`);
    if (clip.fps !== reference.fps) fpsMismatches.push(`${clip.id} (${clip.fps} fps) differs from first clip (${reference.fps} fps).`);
    if (clip.hasAudio && clip.audioSampleRate !== reference.audioSampleRate) {
      audioSyncWarnings.push(`${clip.id} audio sample rate ${clip.audioSampleRate} Hz differs from first clip ${reference.audioSampleRate} Hz — will resample.`);
    }
    if (!clip.hasAudio && reference.hasAudio) {
      audioSyncWarnings.push(`${clip.id} has no audio but first clip does — silent track will be inserted.`);
    }
  }

  const transition = getTransition(job.transitionId);
  if (!transition) warnings.push("Unknown transition.");

  // Compute total duration: sum of clip durations minus (N-1) × transition duration (if transition overlaps)
  const totalDurationSeconds = job.clips.reduce((sum, c) => sum + c.durationSeconds, 0)
    - Math.max(0, job.clips.length - 1) * (transition?.durationSeconds ?? 0);

  const outCodec = getOutputCodec(job.outputCodec);
  if (!outCodec) warnings.push("Unknown output codec.");

  const estimatedSizeBytes = Math.round(((outCodec?.bitrateKbps ?? 5000) * 1000 * totalDurationSeconds) / 8);

  if (resolutionMismatches.length > 0) notes.push("Resolution mismatch — ffmpeg will scale all clips to the output resolution. This may introduce letterboxing or quality loss.");
  if (codecMismatches.length > 0) notes.push("Codec mismatch — re-encoding all clips to a common codec is recommended before concatenation.");
  if (job.audioSyncMode === "stretch") notes.push("Audio stretch mode applies time-stretching to align audio with video.");
  if (job.audioSyncMode === "trim") notes.push("Audio trim mode trims longer audio to match shorter video.");

  // Build ffmpeg concat command
  let ffmpegCommand = "";
  if (job.clips.length > 0 && outCodec && transition) {
    if (transition.id === "none") {
      ffmpegCommand = `ffmpeg -f concat -safe 0 -i list.txt -c:v ${outCodec.encoder} -c:a aac -b:a 192k output.mp4`;
    } else {
      const offsets: number[] = [];
      let cum = 0;
      for (let i = 0; i < job.clips.length - 1; i++) {
        cum += job.clips[i].durationSeconds - transition.durationSeconds;
        offsets.push(cum);
      }
      const inputs = job.clips.map((c) => `-i clip-${c.id}.mp4`).join(" ");
      const filterParts: string[] = [];
      let prev = "[0:v][1:v]";
      let prevAudio = "[0:a][1:a]";
      for (let i = 0; i < job.clips.length - 1; i++) {
        const off = offsets[i];
        const outV = i < job.clips.length - 2 ? `v${i + 1}` : "vout";
        const outA = i < job.clips.length - 2 ? `a${i + 1}` : "aout";
        filterParts.push(`[${i === 0 ? "0" : `v${i}`}:v][${i + 1}:v]${transition.ffmpegFilter.replace("OFFSET", String(off))}[${outV}]`);
        filterParts.push(`[${i === 0 ? "0" : `a${i}`}:a][${i + 1}:a]acrossfade=d=${transition.durationSeconds}[${outA}]`);
        prev = `[${outV}:v][${i + 2}:v]`;
        prevAudio = `[${outA}:a][${i + 2}:a]`;
      }
      ffmpegCommand = `ffmpeg ${inputs} -filter_complex "${filterParts.join(";")}" -map "[vout]" -map "[aout]" -c:v ${outCodec.encoder} -c:a aac output.mp4`;
    }
  }

  return {
    job, totalDurationSeconds,
    resolutionMatch: { ok: resolutionMismatches.length === 0, mismatches: resolutionMismatches },
    codecMatch: { ok: codecMismatches.length === 0, mismatches: codecMismatches },
    fpsMatch: { ok: fpsMismatches.length === 0, mismatches: fpsMismatches },
    audioSyncWarnings,
    warnings, notes,
    ffmpegCommand,
    estimatedSizeBytes,
    estimatedSizeHuman: formatBytes(estimatedSizeBytes),
  };
}

export function planBatch(jobs: MergeJob[]): MergeResult[] {
  return jobs.map(planMerge);
}

export function renderBatchCsv(results: MergeResult[]): string {
  const lines: string[] = ["job_index,clip_count,total_duration_s,size_bytes,codec"];
  results.forEach((r, i) => {
    lines.push([String(i + 1), String(r.job.clips.length), r.totalDurationSeconds.toFixed(2), String(r.estimatedSizeBytes), r.job.outputCodec].join(","));
  });
  return lines.join("\n");
}

export function renderReport(r: MergeResult): string {
  const lines: string[] = [];
  lines.push("Video Merge Plan");
  lines.push("=================");
  lines.push(`Clips: ${r.job.clips.length}`);
  lines.push(`Output resolution: ${r.job.outputWidth}×${r.job.outputHeight}`);
  lines.push(`Output FPS: ${r.job.outputFps}`);
  lines.push(`Output codec: ${r.job.outputCodec}`);
  lines.push(`Transition: ${r.job.transitionId}`);
  lines.push(`Audio sync mode: ${r.job.audioSyncMode}`);
  lines.push(`Total duration: ${formatDuration(r.totalDurationSeconds)} (${r.totalDurationSeconds.toFixed(2)} s)`);
  lines.push(`Estimated size: ${r.estimatedSizeHuman} (${r.estimatedSizeBytes} bytes)`);
  lines.push("");
  lines.push("Clips:");
  r.job.clips.forEach((c, i) => {
    lines.push(`  ${i + 1}. ${c.id} — ${c.width}×${c.height} @ ${c.fps} fps, ${c.codec}/${c.audioCodec}, ${formatDuration(c.durationSeconds)}`);
  });
  lines.push("");
  if (r.resolutionMatch.mismatches.length || r.codecMatch.mismatches.length || r.fpsMatch.mismatches.length) {
    lines.push("Compatibility checks:");
    r.resolutionMatch.mismatches.forEach((m) => lines.push(`  ! Resolution: ${m}`));
    r.codecMatch.mismatches.forEach((m) => lines.push(`  ! Codec: ${m}`));
    r.fpsMatch.mismatches.forEach((m) => lines.push(`  ! FPS: ${m}`));
    lines.push("");
  }
  if (r.audioSyncWarnings.length) {
    lines.push("Audio sync warnings:");
    r.audioSyncWarnings.forEach((w) => lines.push(`  ! ${w}`));
    lines.push("");
  }
  lines.push("ffmpeg command:");
  lines.push(r.ffmpegCommand || "—");
  if (r.warnings.length) { lines.push(""); lines.push("Warnings:"); r.warnings.forEach((w) => lines.push(`  ! ${w}`)); }
  if (r.notes.length) { lines.push(""); lines.push("Notes:"); r.notes.forEach((n) => lines.push(`  • ${n}`)); }
  return lines.join("\n");
}

/** Quick helper to make a sample clip spec. */
export function makeClip(id: string, durationSeconds: number, width = 1920, height = 1080, fps = 30, codec = "h264", audioCodec = "aac", audioSampleRate = 48000, hasAudio = true): VideoClipSpec {
  return { id, label: id, durationSeconds, width, height, fps, codec, audioCodec, audioSampleRate, hasAudio };
}

/** Find the largest clip by resolution; useful for picking output resolution. */
export function suggestOutputResolution(clips: VideoClipSpec[]): { width: number; height: number } {
  if (clips.length === 0) return { width: 1920, height: 1080 };
  let best = clips[0];
  for (const c of clips) {
    if (c.width * c.height > best.width * best.height) best = c;
  }
  return { width: best.width, height: best.height };
}

/** Compute total audio bitrate needed for N audio channels. */
export function computeAudioBitrateKbps(channels: number, quality = "standard"): number {
  const perChannel = quality === "high" ? 96 : quality === "standard" ? 64 : 48;
  return Math.max(64, perChannel * channels);
}

/** Validate that a transition is compatible with the number of clips. */
export function validateTransitionForClips(transition: TransitionSpec, clipCount: number): { ok: boolean; error?: string } {
  if (clipCount < 2) return { ok: false, error: "Transitions require at least 2 clips." };
  return { ok: true };
}
