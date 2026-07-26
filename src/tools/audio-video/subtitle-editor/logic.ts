/**
 * Subtitle Editor — pure logic.
 * Parses SRT and WebVTT subtitle files into structured cue lists, supports
 * time adjustments, format conversion, search, and re-serialization.
 */

export type SubtitleFormat = "srt" | "vtt";

export interface SubtitleCue {
  index: number; // 1-based
  startTimeMs: number;
  endTimeMs: number;
  text: string;
}

export interface ParsedSubtitles {
  format: SubtitleFormat;
  cues: SubtitleCue[];
  warnings: string[];
}

/** Parse a timestamp in HH:MM:SS,mmm or HH:MM:SS.mmm format to milliseconds. */
export function parseTimestamp(ts: string): number {
  const cleaned = ts.trim();
  // SRT uses commas, VTT uses periods
  const m = /(?:(\d+):)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})/.exec(cleaned);
  if (!m) return 0;
  const hours = m[1] ? parseInt(m[1], 10) : 0;
  const minutes = parseInt(m[2], 10);
  const seconds = parseInt(m[3], 10);
  const ms = parseInt(m[4].padEnd(3, "0"), 10);
  return hours * 3600000 + minutes * 60000 + seconds * 1000 + ms;
}

/** Format milliseconds as a timestamp. */
export function formatTimestamp(ms: number, format: SubtitleFormat = "srt"): string {
  const clamped = Math.max(0, Math.floor(ms));
  const hours = Math.floor(clamped / 3600000);
  const minutes = Math.floor((clamped % 3600000) / 60000);
  const seconds = Math.floor((clamped % 60000) / 1000);
  const millis = clamped % 1000;
  const sep = format === "srt" ? "," : ".";
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}${sep}${String(millis).padStart(3, "0")}`;
}

/** Detect format from content. */
export function detectFormat(content: string): SubtitleFormat {
  if (content.trim().startsWith("WEBVTT")) return "vtt";
  return "srt";
}

/** Parse a subtitle file into cues. */
export function parseSubtitles(content: string, format?: SubtitleFormat): ParsedSubtitles {
  const fmt = format ?? detectFormat(content);
  const warnings: string[] = [];
  const cues: SubtitleCue[] = [];
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // Strip WEBVTT header
  const lines = normalized.split("\n");
  let i = 0;
  if (fmt === "vtt" && lines[0]?.startsWith("WEBVTT")) {
    i = 1;
    // Skip headers (blank line ends them)
    while (i < lines.length && lines[i].trim() !== "") i++;
    i++;
  }
  let cueIndex = 0;
  while (i < lines.length) {
    // Skip blank lines
    while (i < lines.length && lines[i].trim() === "") i++;
    if (i >= lines.length) break;
    // Optional index line (SRT) or cue identifier (VTT)
    let indexLine: string | null = null;
    let timeLine: string | null = null;
    const line = lines[i];
    if (line.includes("-->")) {
      timeLine = line;
    } else {
      indexLine = line;
      i++;
      if (i < lines.length) timeLine = lines[i];
    }
    if (!timeLine || !timeLine.includes("-->")) {
      warnings.push(`Skipped malformed cue at line ${i + 1}.`);
      i++;
      continue;
    }
    const m = /([\d:.]+)\s*-->\s*([\d:.]+)/.exec(timeLine);
    if (!m) {
      warnings.push(`Bad timestamp at line ${i + 1}.`);
      i++;
      continue;
    }
    const startMs = parseTimestamp(m[1]);
    const endMs = parseTimestamp(m[2]);
    i++;
    // Collect text lines
    const textLines: string[] = [];
    while (i < lines.length && lines[i].trim() !== "") {
      textLines.push(lines[i]);
      i++;
    }
    cueIndex++;
    cues.push({
      index: cueIndex,
      startTimeMs: startMs,
      endTimeMs: endMs,
      text: textLines.join("\n"),
    });
  }
  return { format: fmt, cues, warnings };
}

/** Serialize cues back to a subtitle string. */
export function serializeSubtitles(cues: SubtitleCue[], format: SubtitleFormat = "srt"): string {
  const lines: string[] = [];
  if (format === "vtt") lines.push("WEBVTT", "");
  for (const cue of cues) {
    if (format === "srt") lines.push(String(cue.index));
    lines.push(`${formatTimestamp(cue.startTimeMs, format)} --> ${formatTimestamp(cue.endTimeMs, format)}`);
    lines.push(cue.text);
    lines.push("");
  }
  return lines.join("\n").trim() + "\n";
}

/** Convert between formats. */
export function convertFormat(content: string, toFormat: SubtitleFormat): string {
  const parsed = parseSubtitles(content);
  return serializeSubtitles(parsed.cues, toFormat);
}

/** Apply a time offset (positive = shift later) to all cues. */
export function shiftTime(cues: SubtitleCue[], offsetMs: number): SubtitleCue[] {
  return cues.map((c) => ({
    ...c,
    startTimeMs: Math.max(0, c.startTimeMs + offsetMs),
    endTimeMs: Math.max(0, c.endTimeMs + offsetMs),
  }));
}

/** Scale all cue times by a factor (e.g., 1.1 = 10% slower). */
export function scaleTime(cues: SubtitleCue[], factor: number): SubtitleCue[] {
  return cues.map((c) => ({
    ...c,
    startTimeMs: Math.round(c.startTimeMs * factor),
    endTimeMs: Math.round(c.endTimeMs * factor),
  }));
}

/** Renumber cues from 1. */
export function renumber(cues: SubtitleCue[]): SubtitleCue[] {
  return cues.map((c, i) => ({ ...c, index: i + 1 }));
}

/** Search cues for a text query (case-insensitive). Returns matching cue indices. */
export function searchCues(cues: SubtitleCue[], query: string): number[] {
  if (!query) return [];
  const q = query.toLowerCase();
  return cues.filter((c) => c.text.toLowerCase().includes(q)).map((c) => c.index);
}

/** Replace text across all cues. */
export function replaceText(cues: SubtitleCue[], find: string, replace: string, caseSensitive = false): SubtitleCue[] {
  if (!find) return cues;
  const flags = caseSensitive ? "g" : "gi";
  const re = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags);
  return cues.map((c) => ({ ...c, text: c.text.replace(re, replace) }));
}

/** Filter cues by time range. */
export function filterByTimeRange(cues: SubtitleCue[], fromMs: number, toMs: number): SubtitleCue[] {
  return cues.filter((c) => c.startTimeMs >= fromMs && c.endTimeMs <= toMs);
}

/** Validate cues for common issues (overlaps, zero duration, out of order). */
export function validateCues(cues: SubtitleCue[]): { issues: string[]; ok: boolean } {
  const issues: string[] = [];
  for (let i = 0; i < cues.length; i++) {
    const c = cues[i];
    if (c.endTimeMs <= c.startTimeMs) {
      issues.push(`Cue ${c.index}: end ≤ start.`);
    }
    if (i > 0 && c.startTimeMs < cues[i - 1].endTimeMs) {
      issues.push(`Cue ${c.index}: overlaps previous cue.`);
    }
    if (c.text.trim() === "") {
      issues.push(`Cue ${c.index}: empty text.`);
    }
  }
  return { issues, ok: issues.length === 0 };
}

/** Format duration as mm:ss.mmm. */
export function formatDuration(ms: number): string {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

/** Compute total duration covered by cues. */
export function totalDuration(cues: SubtitleCue[]): number {
  if (cues.length === 0) return 0;
  return cues[cues.length - 1].endTimeMs - cues[0].startTimeMs;
}
