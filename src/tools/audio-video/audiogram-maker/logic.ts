/**
 * Audiogram Maker — pure logic.
 * Plans an audiogram (waveform visualization) by computing waveform data
 * from audio samples, selecting a clip duration, color scheme, and layout.
 */

export type ColorScheme = "minimal" | "vibrant" | "mono" | "warm" | "cool";

export interface AudiogramParams {
  sampleRate: number;
  durationSec: number;
  colorScheme: ColorScheme;
  barCount: number; // bars displayed
  barWidth: number; // px
  barGap: number; // px
  canvasWidth: number;
  canvasHeight: number;
  peakNormalize: boolean;
  backgroundColor: string;
  foregroundColor: string;
}

export const DEFAULT_PARAMS: AudiogramParams = {
  sampleRate: 44100,
  durationSec: 30,
  colorScheme: "vibrant",
  barCount: 80,
  barWidth: 4,
  barGap: 2,
  canvasWidth: 1080,
  canvasHeight: 1080,
  peakNormalize: true,
  backgroundColor: "#0a0a0a",
  foregroundColor: "#ffffff",
};

export interface WaveformBar {
  index: number;
  x: number; // px center
  amplitude: number; // 0..1
}

export interface AudiogramPlan {
  bars: WaveformBar[];
  totalSamples: number;
  samplesPerBar: number;
  peakAmplitude: number;
  rmsAmplitude: number;
  colorScheme: ColorScheme;
  description: string;
}

/** Color schemes. Each defines background, foreground, accent. */
export const COLOR_SCHEMES: Record<ColorScheme, { background: string; foreground: string; accent: string; label: string }> = {
  minimal: { background: "#ffffff", foreground: "#000000", accent: "#666666", label: "Minimal" },
  vibrant: { background: "#0a0a0a", foreground: "#ff0080", accent: "#00d4ff", label: "Vibrant" },
  mono: { background: "#000000", foreground: "#ffffff", accent: "#888888", label: "Monochrome" },
  warm: { background: "#1a0f0a", foreground: "#ff6b35", accent: "#ffd23f", label: "Warm" },
  cool: { background: "#0a0f1a", foreground: "#4cc9f0", accent: "#7209b7", label: "Cool" },
};

/** Validate params. */
export function validateParams(p: AudiogramParams): { ok: boolean; reason?: string } {
  if (p.sampleRate < 8000) return { ok: false, reason: "Sample rate must be ≥8000." };
  if (p.durationSec <= 0) return { ok: false, reason: "Duration must be positive." };
  if (p.barCount < 1 || p.barCount > 1000) return { ok: false, reason: "Bar count must be 1..1000." };
  if (p.barWidth < 1) return { ok: false, reason: "Bar width must be ≥1." };
  if (p.canvasWidth < 100 || p.canvasHeight < 100) return { ok: false, reason: "Canvas must be at least 100×100." };
  return { ok: true };
}

/** Compute peak amplitude of a buffer. */
export function peak(samples: Float32Array): number {
  let p = 0;
  for (let i = 0; i < samples.length; i++) {
    const a = Math.abs(samples[i]);
    if (a > p) p = a;
  }
  return p;
}

/** Compute RMS amplitude. */
export function rms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}

/** Downsample audio samples into N bar amplitudes (peak per chunk). */
export function computeBars(samples: Float32Array, barCount: number, peakNormalize: boolean): WaveformBar[] {
  if (samples.length === 0) return [];
  const chunkSize = Math.max(1, Math.floor(samples.length / barCount));
  const bars: WaveformBar[] = [];
  let maxAmp = 0;
  for (let i = 0; i < barCount; i++) {
    const start = i * chunkSize;
    const end = Math.min(samples.length, start + chunkSize);
    let chunkPeak = 0;
    for (let j = start; j < end; j++) {
      const a = Math.abs(samples[j]);
      if (a > chunkPeak) chunkPeak = a;
    }
    bars.push({ index: i, x: 0, amplitude: chunkPeak });
    if (chunkPeak > maxAmp) maxAmp = chunkPeak;
  }
  if (peakNormalize && maxAmp > 0) {
    for (const b of bars) b.amplitude /= maxAmp;
  }
  return bars;
}

/** Compute x positions for bars given canvas width. */
export function layoutBars(bars: WaveformBar[], canvasWidth: number, barWidth: number, barGap: number): WaveformBar[] {
  const totalWidth = bars.length * barWidth + (bars.length - 1) * barGap;
  const startX = Math.max(0, (canvasWidth - totalWidth) / 2);
  return bars.map((b, i) => ({ ...b, x: startX + i * (barWidth + barGap) + barWidth / 2 }));
}

/** Build full plan. */
export function buildPlan(samples: Float32Array, p: AudiogramParams): AudiogramPlan {
  const total = samples.length;
  const perBar = total > 0 && p.barCount > 0 ? Math.floor(total / p.barCount) : 0;
  const bars = layoutBars(computeBars(samples, p.barCount, p.peakNormalize), p.canvasWidth, p.barWidth, p.barGap);
  const peakAmp = peak(samples);
  const rmsAmp = rms(samples);
  return {
    bars,
    totalSamples: total,
    samplesPerBar: perBar,
    peakAmplitude: peakAmp,
    rmsAmplitude: rmsAmp,
    colorScheme: p.colorScheme,
    description: `${p.barCount} bars across ${p.canvasWidth}px from ${p.durationSec}s of audio @ ${p.sampleRate}Hz (${total} samples).`,
  };
}

/** Apply a color scheme to params. */
export function applyColorScheme(p: AudiogramParams, scheme: ColorScheme): AudiogramParams {
  const s = COLOR_SCHEMES[scheme];
  return { ...p, colorScheme: scheme, backgroundColor: s.background, foregroundColor: s.foreground };
}

/** Estimate output video size (audio + frames). */
export function estimateBytes(durationSec: number, bitrateMbps: number, fps: number, canvasWidth: number, canvasHeight: number): number {
  const video = (durationSec * bitrateMbps * 1_000_000) / 8;
  const audio = durationSec * 128_000 / 8; // 128 kbps audio
  return Math.round(video + audio);
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

/** Generate a synthetic waveform (for preview when no audio is loaded). */
export function generateSyntheticWaveform(durationSec: number, sampleRate: number, seed = 1): Float32Array {
  const total = Math.floor(durationSec * sampleRate);
  const out = new Float32Array(total);
  let s = seed >>> 0;
  const rng = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < total; i++) {
    const t = i / sampleRate;
    // Compose a few sines + noise for a natural-looking waveform
    const env = Math.sin(2 * Math.PI * 0.5 * t) * 0.5 + 0.5;
    const wave = Math.sin(2 * Math.PI * 4 * t) * 0.4 + Math.sin(2 * Math.PI * 7 * t) * 0.2;
    const noise = (rng() - 0.5) * 0.3;
    out[i] = (wave + noise) * env;
  }
  return out;
}

/** Render a textual preview of the bars. */
export function renderTextPreview(bars: WaveformBar[], height = 12): string {
  const rows: string[] = [];
  for (let y = height; y >= 0; y--) {
    let row = "";
    for (const b of bars) {
      const barH = b.amplitude * height;
      row += barH >= y ? "█" : " ";
    }
    rows.push(row);
  }
  return rows.join("\n");
}

/** Compute aspect ratio of canvas. */
export function canvasAspectRatio(w: number, h: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const d = gcd(w, h);
  return `${w / d}:${h / d}`;
}
