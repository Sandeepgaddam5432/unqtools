/**
 * BPM Detector — pure logic.
 * Tap-tempo averaging with outlier rejection, beat prediction, and
 * tempo-map smoothing. Designed to be called from a UI that records
 * tap timestamps.
 */

export interface TapResult {
  bpm: number;
  intervalMs: number;
  confidence: number; // 0..1
  tapCount: number;
}

export interface TempoMap {
  intervals: number[]; // ms
  bpms: number[]; // bpm per interval
  meanBpm: number;
  medianBpm: number;
  stdBpm: number;
  stability: number; // 0..1 (1 = very stable)
}

/** Compute average interval from a list of tap timestamps. */
export function averageInterval(taps: number[]): number {
  if (taps.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < taps.length; i++) sum += taps[i] - taps[i - 1];
  return sum / (taps.length - 1);
}

/** Reject intervals that are >2× or <0.5× the median (outliers). */
export function rejectOutliers(taps: number[]): number[] {
  if (taps.length < 3) return taps;
  const intervals: number[] = [];
  for (let i = 1; i < taps.length; i++) intervals.push(taps[i] - taps[i - 1]);
  const sorted = [...intervals].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const filteredTaps: number[] = [taps[0]];
  for (let i = 1; i < taps.length; i++) {
    const interval = taps[i] - taps[i - 1];
    if (interval > median * 0.5 && interval < median * 2) {
      filteredTaps.push(taps[i]);
    }
  }
  return filteredTaps;
}

/** Convert milliseconds per beat to BPM. */
export function msToBpm(ms: number): number {
  if (ms <= 0) return 0;
  return Math.round(60000 / ms);
}

/** Convert BPM to ms per beat. */
export function bpmToMs(bpm: number): number {
  if (bpm <= 0) return 0;
  return 60000 / bpm;
}

/** Compute mean of an array. */
export function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/** Compute median of an array. */
export function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Compute standard deviation. */
export function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

/** Detect BPM from a list of taps. */
export function detectBpm(taps: number[]): TapResult {
  if (taps.length < 2) return { bpm: 0, intervalMs: 0, confidence: 0, tapCount: taps.length };
  const cleaned = rejectOutliers(taps);
  if (cleaned.length < 2) return { bpm: 0, intervalMs: 0, confidence: 0, tapCount: taps.length };
  const intervalMs = averageInterval(cleaned);
  const bpm = msToBpm(intervalMs);
  const intervals: number[] = [];
  for (let i = 1; i < cleaned.length; i++) intervals.push(cleaned[i] - cleaned[i - 1]);
  const std = stdDev(intervals);
  // Confidence: 1 - (std / mean) — penalize high jitter
  const cv = intervalMs > 0 ? std / intervalMs : 1;
  const confidence = Math.max(0, Math.min(1, 1 - cv * 2));
  return { bpm, intervalMs, confidence, tapCount: taps.length };
}

/** Build a tempo map from raw taps. */
export function buildTempoMap(taps: number[]): TempoMap {
  const cleaned = rejectOutliers(taps);
  const intervals: number[] = [];
  const bpms: number[] = [];
  for (let i = 1; i < cleaned.length; i++) {
    const iv = cleaned[i] - cleaned[i - 1];
    intervals.push(iv);
    bpms.push(msToBpm(iv));
  }
  return {
    intervals,
    bpms,
    meanBpm: Math.round(mean(bpms)),
    medianBpm: Math.round(median(bpms)),
    stdBpm: Math.round(stdDev(bpms) * 10) / 10,
    stability: cleaned.length > 2 ? Math.max(0, 1 - stdDev(intervals) / mean(intervals)) : 0,
  };
}

/** Predict the next beat timestamp based on average interval. */
export function predictNextBeat(taps: number[], fromTime?: number): number {
  if (taps.length < 2) return fromTime ?? 0;
  const interval = averageInterval(taps);
  return (fromTime ?? taps[taps.length - 1]) + interval;
}

/** Generate a list of predicted future beat timestamps. */
export function predictFutureBeats(taps: number[], count: number, fromTime?: number): number[] {
  if (taps.length < 2) return [];
  const interval = averageInterval(taps);
  const start = fromTime ?? taps[taps.length - 1];
  const out: number[] = [];
  for (let i = 1; i <= count; i++) out.push(start + i * interval);
  return out;
}

/** Convert BPM to musical note durations. */
export function noteDurations(bpm: number): { whole: number; half: number; quarter: number; eighth: number; sixteenth: number } {
  const quarter = 60 / bpm;
  return {
    whole: quarter * 4,
    half: quarter * 2,
    quarter,
    eighth: quarter / 2,
    sixteenth: quarter / 4,
  };
}

/** Italian tempo name. */
export function tempoName(bpm: number): string {
  if (bpm < 60) return "Largo";
  if (bpm < 76) return "Adagio";
  if (bpm < 108) return "Andante";
  if (bpm < 120) return "Moderato";
  if (bpm < 156) return "Allegro";
  if (bpm < 200) return "Vivace";
  return "Presto";
}

/** Auto-detect BPM by halving/doubling to land within a target range. */
export function normalizeBpm(bpm: number, min = 60, max = 180): number {
  let b = bpm;
  while (b < min) b *= 2;
  while (b > max) b /= 2;
  return Math.round(b);
}

/** Clear taps older than a timeout (e.g., 3 seconds). */
export function pruneStaleTaps(taps: number[], now: number, timeoutMs = 3000): number[] {
  return taps.filter((t) => now - t < timeoutMs);
}

/** Format BPM with confidence and tempo name. */
export function formatBpm(result: TapResult): string {
  if (result.bpm === 0) return "Tap to detect BPM…";
  return `${result.bpm} BPM (${tempoName(result.bpm)}) · confidence ${(result.confidence * 100).toFixed(0)}%`;
}
