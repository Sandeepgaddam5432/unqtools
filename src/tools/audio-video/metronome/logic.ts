/**
 * Metronome — pure logic.
 * Computes beat timing for arbitrary BPM, time signature, accent pattern,
 * and subdivision. Produces click schedules and tempo markings.
 */

export interface MetronomeParams {
  bpm: number; // 40..280
  beatsPerBar: number; // time signature numerator
  beatUnit: number; // 4 = quarter, 8 = eighth, etc.
  subdivisions: number; // 1..8 per beat
  accentPattern: boolean[]; // length == beatsPerBar
  volume: number; // 0..1
  accentVolume: number; // 0..1
}

export const DEFAULT_PARAMS: MetronomeParams = {
  bpm: 120,
  beatsPerBar: 4,
  beatUnit: 4,
  subdivisions: 1,
  accentPattern: [true, false, false, false],
  volume: 0.6,
  accentVolume: 1,
};

export const BPM_MIN = 40;
export const BPM_MAX = 280;

/** Validate metronome params. */
export function validateParams(p: MetronomeParams): { ok: boolean; reason?: string } {
  if (p.bpm < BPM_MIN || p.bpm > BPM_MAX) return { ok: false, reason: `BPM must be ${BPM_MIN}..${BPM_MAX}.` };
  if (p.beatsPerBar < 1 || p.beatsPerBar > 16) return { ok: false, reason: "Beats per bar must be 1..16." };
  if (![1, 2, 4, 8, 16].includes(p.beatUnit)) return { ok: false, reason: "Beat unit must be 1, 2, 4, 8, or 16." };
  if (p.subdivisions < 1 || p.subdivisions > 8) return { ok: false, reason: "Subdivisions must be 1..8." };
  if (p.accentPattern.length !== p.beatsPerBar) return { ok: false, reason: "Accent pattern must match beats per bar." };
  if (p.volume < 0 || p.volume > 1) return { ok: false, reason: "Volume must be 0..1." };
  return { ok: true };
}

/** Compute the period of one beat in seconds. */
export function beatPeriod(bpm: number, beatUnit: number): number {
  // Quarter note at bpm. If beatUnit is 8 (eighth), period is half of quarter.
  return 60 / bpm / (beatUnit / 4);
}

/** Compute the period of one subdivision in seconds. */
export function subdivisionPeriod(bpm: number, beatUnit: number, subdivisions: number): number {
  return beatPeriod(bpm, beatUnit) / subdivisions;
}

/** Compute total bar duration in seconds. */
export function barDuration(p: MetronomeParams): number {
  return beatPeriod(p.bpm, p.beatUnit) * p.beatsPerBar;
}

/** Italian tempo marking for a BPM. */
export function tempoMarking(bpm: number): string {
  if (bpm < 60) return "Largo";
  if (bpm < 76) return "Adagio";
  if (bpm < 108) return "Andante";
  if (bpm < 120) return "Moderato";
  if (bpm < 156) return "Allegro";
  if (bpm < 200) return "Vivace";
  return "Presto";
}

/** Generate a click schedule for one bar. Each click has time, beat index, subdivision index, accent. */
export interface ClickEvent {
  time: number; // seconds from bar start
  beatIndex: number; // 0..beatsPerBar-1
  subdivisionIndex: number; // 0..subdivisions-1
  accent: boolean;
  volume: number;
}

export function buildBarSchedule(p: MetronomeParams): ClickEvent[] {
  const events: ClickEvent[] = [];
  const subPeriod = subdivisionPeriod(p.bpm, p.beatUnit, p.subdivisions);
  for (let b = 0; b < p.beatsPerBar; b++) {
    for (let s = 0; s < p.subdivisions; s++) {
      const isOnBeat = s === 0;
      const accent = isOnBeat && p.accentPattern[b];
      const volume = accent ? p.accentVolume : isOnBeat ? p.volume : p.volume * 0.6;
      events.push({
        time: (b * p.subdivisions + s) * subPeriod,
        beatIndex: b,
        subdivisionIndex: s,
        accent,
        volume,
      });
    }
  }
  return events;
}

/** Generate a click schedule for N bars. */
export function buildSchedule(p: MetronomeParams, bars: number): ClickEvent[] {
  const barDur = barDuration(p);
  const single = buildBarSchedule(p);
  const events: ClickEvent[] = [];
  for (let bar = 0; bar < bars; bar++) {
    for (const e of single) {
      events.push({ ...e, time: e.time + bar * barDur });
    }
  }
  return events;
}

/** Compute total duration for N bars. */
export function totalDuration(p: MetronomeParams, bars: number): number {
  return barDuration(p) * bars;
}

/** Tap tempo: given a list of tap timestamps, compute average BPM. */
export function tapTempo(taps: number[]): number {
  if (taps.length < 2) return 0;
  const intervals: number[] = [];
  for (let i = 1; i < taps.length; i++) intervals.push(taps[i] - taps[i - 1]);
  const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  if (avg <= 0) return 0;
  return Math.round(60000 / avg);
}

/** Round BPM to a "nice" value (nearest integer). */
export function roundBpm(bpm: number): number {
  return Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(bpm)));
}

/** Increase/decrease BPM by delta, clamped to range. */
export function adjustBpm(bpm: number, delta: number): number {
  return Math.max(BPM_MIN, Math.min(BPM_MAX, bpm + delta));
}

/** Format a time signature as a string. */
export function timeSignature(beatsPerBar: number, beatUnit: number): string {
  return `${beatsPerBar}/${beatUnit}`;
}

/** Generate a click sample (short sine burst) at given volume. */
export function clickSample(volume: number, sampleRate: number, freq = 1000, durationMs = 30): Float32Array {
  const samples = Math.floor((durationMs / 1000) * sampleRate);
  const out = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-t * 80);
    out[i] = Math.sin(2 * Math.PI * freq * t) * env * volume;
  }
  return out;
}

/** Format duration. */
export function formatDuration(seconds: number): string {
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return m > 0 ? `${m}m ${s.toFixed(1)}s` : `${s.toFixed(2)}s`;
}

/** Describe the metronome setup. */
export function describeParams(p: MetronomeParams): string {
  return [
    `BPM: ${p.bpm} (${tempoMarking(p.bpm)})`,
    `Time signature: ${timeSignature(p.beatsPerBar, p.beatUnit)}`,
    `Subdivisions per beat: ${p.subdivisions}`,
    `Beat period: ${beatPeriod(p.bpm, p.beatUnit).toFixed(3)}s`,
    `Bar duration: ${barDuration(p).toFixed(3)}s`,
    `Accent pattern: ${p.accentPattern.map((a) => (a ? "X" : ".")).join(" ")}`,
  ].join("\n");
}
