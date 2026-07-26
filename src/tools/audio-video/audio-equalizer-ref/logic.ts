/**
 * Audio Equalizer Reference — pure logic.
 * Reference for EQ bands (20Hz-20kHz), Q-factor, gain, common presets, frequency table.
 */

export interface EqBand {
  /** ISO frequency in Hz. */
  hz: number;
  /** Display label. */
  label: string;
  /** Frequency band name. */
  bandName: string;
  /** Description of perceived effect. */
  description: string;
}

const BANDS: EqBand[] = [
  { hz: 20, label: "20 Hz", bandName: "Sub-bass", description: "Lowest audible frequencies. Felt more than heard." },
  { hz: 31, label: "31 Hz", bandName: "Sub-bass", description: "Deep bass — kick drum fundamental." },
  { hz: 62, label: "62 Hz", bandName: "Bass", description: "Bass guitar, low piano notes." },
  { hz: 125, label: "125 Hz", bandName: "Bass", description: "Bass warmth; muddiness if over-boosted." },
  { hz: 250, label: "250 Hz", bandName: "Low-mid", description: "Vocal chest; can sound 'boxy' if excessive." },
  { hz: 500, label: "500 Hz", bandName: "Mid", description: "Body of most instruments; 'horn-like' if excessive." },
  { hz: 1000, label: "1 kHz", bandName: "Mid", description: "Vocal presence; telephone-like if over-emphasised." },
  { hz: 2000, label: "2 kHz", bandName: "High-mid", description: "Vocal clarity; attack of percussive instruments." },
  { hz: 4000, label: "4 kHz", bandName: "Presence", description: "Vocal intelligibility; can be harsh if excessive." },
  { hz: 8000, label: "8 kHz", bandName: "Brilliance", description: "Cymbals; 'air' and detail." },
  { hz: 16000, label: "16 kHz", bandName: "Brilliance", description: "Hi-hat shimmer; breathiness." },
  { hz: 20000, label: "20 kHz", bandName: "Brilliance", description: "Upper limit of human hearing." },
];

export function getAllBands(): EqBand[] {
  return [...BANDS];
}

export function getBandByHz(hz: number): EqBand | null {
  return BANDS.find((b) => b.hz === hz) ?? null;
}

export function getBandsByRange(minHz: number, maxHz: number): EqBand[] {
  return BANDS.filter((b) => b.hz >= minHz && b.hz <= maxHz);
}

/** Find the band nearest to a target frequency. */
export function findNearestBand(hz: number): EqBand | null {
  let best: EqBand | null = null;
  let bestDist = Infinity;
  for (const b of BANDS) {
    const d = Math.abs(b.hz - hz);
    if (d < bestDist) { bestDist = d; best = b; }
  }
  return best;
}

export interface EqPreset {
  id: string;
  label: string;
  description: string;
  /** Gains (dB) indexed by BANDS (12-band). */
  gains: number[];
  category: "music" | "vocal" | "speech" | "film";
}

const PRESETS: EqPreset[] = [
  { id: "flat", label: "Flat", description: "No EQ applied.", gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], category: "music" },
  { id: "bass-boost", label: "Bass Boost", description: "Boost low frequencies for fuller bass.", gains: [6, 6, 5, 4, 2, 0, 0, 0, 0, 0, 0, 0], category: "music" },
  { id: "treble-boost", label: "Treble Boost", description: "Boost high frequencies for brighter sound.", gains: [0, 0, 0, 0, 0, 0, 0, 2, 3, 5, 6, 6], category: "music" },
  { id: "vocal-boost", label: "Vocal Boost", description: "Boost vocal presence band (1-4 kHz).", gains: [-2, -2, -1, 0, 1, 2, 3, 4, 3, 1, 0, -1], category: "vocal" },
  { id: "loudness", label: "Loudness", description: "Classic loudness curve — boost bass & treble.", gains: [6, 5, 3, 0, -2, -2, 0, 0, 2, 4, 5, 6], category: "music" },
  { id: "rock", label: "Rock", description: "V-shape — boosted bass and treble, cut mids.", gains: [5, 4, 2, 0, -2, -2, -1, 0, 2, 3, 4, 5], category: "music" },
  { id: "pop", label: "Pop", description: "Vocal-forward with gentle bass.", gains: [-1, 0, 1, 2, 3, 3, 2, 1, 0, 1, 2, 2], category: "music" },
  { id: "jazz", label: "Jazz", description: "Warm — slight bass and treble lift, dip in mids.", gains: [3, 2, 1, 0, -1, 0, 1, 1, 2, 2, 1, 2], category: "music" },
  { id: "classical", label: "Classical", description: "Mostly flat with subtle treble lift for clarity.", gains: [0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 2], category: "music" },
  { id: "podcast", label: "Podcast / Speech", description: "Cut rumble below 100 Hz, lift presence band.", gains: [-6, -6, -4, -2, 0, 2, 4, 4, 3, 1, 0, -2], category: "speech" },
  { id: "cinema", label: "Cinema", description: "Boosted bass for impact, slight mid cut.", gains: [4, 5, 4, 2, 0, -1, 0, 1, 2, 2, 2, 2], category: "film" },
  { id: "night", label: "Night mode", description: "Compress dynamic range — cut bass & treble.", gains: [-3, -3, -2, -1, 0, 1, 1, 0, -1, -2, -3, -3], category: "film" },
];

export function getPresets(): EqPreset[] {
  return [...PRESETS];
}

export function getPreset(id: string): EqPreset | null {
  return PRESETS.find((p) => p.id === id) ?? null;
}

export function getPresetsByCategory(cat: EqPreset["category"]): EqPreset[] {
  return PRESETS.filter((p) => p.category === cat);
}

export interface QFactorInfo {
  value: number;
  bandwidthOctaves: number;
  useCase: string;
}

/** Convert Q factor to bandwidth in octaves (and vice versa). */
export function qToBandwidth(q: number): number {
  if (q <= 0) return 0;
  // Standard formula: BW (octaves) = 2 * log2(sqrt(1 + 1/(4Q^2)) + 1/(2Q))
  return 2 * Math.log2(Math.sqrt(1 + 1 / (4 * q * q)) + 1 / (2 * q));
}

export function bandwidthToQ(bwOctaves: number): number {
  if (bwOctaves <= 0) return 0;
  return 1 / (2 * Math.sinh((bwOctaves * Math.LN2) / 2));
}

export const Q_PRESETS: QFactorInfo[] = [
  { value: 0.5, bandwidthOctaves: 2.55, useCase: "Wide band — shelving-style effect." },
  { value: 0.71, bandwidthOctaves: 1.92, useCase: "Wide band — broad tone shaping." },
  { value: 1.0, bandwidthOctaves: 1.39, useCase: "Medium band — gentle cuts/boosts." },
  { value: 1.41, bandwidthOctaves: 1.0, useCase: "1 octave — standard graphic EQ." },
  { value: 2.0, bandwidthOctaves: 0.71, useCase: "Narrow — focused corrections." },
  { value: 3.0, bandwidthOctaves: 0.48, useCase: "Tight — feedback control." },
  { value: 5.0, bandwidthOctaves: 0.29, useCase: "Very tight — surgical removal." },
  { value: 10, bandwidthOctaves: 0.14, useCase: "Notch filter — feedback destroy." },
];

export function getQPresets(): QFactorInfo[] {
  return [...Q_PRESETS];
}

export const MIN_GAIN_DB = -24;
export const MAX_GAIN_DB = 24;

export function validateGain(gain: number): { ok: boolean; error?: string } {
  if (!Number.isFinite(gain)) return { ok: false, error: "Gain must be a finite number." };
  if (gain < MIN_GAIN_DB) return { ok: false, error: `Gain must be ≥ ${MIN_GAIN_DB} dB.` };
  if (gain > MAX_GAIN_DB) return { ok: false, error: `Gain must be ≤ ${MAX_GAIN_DB} dB.` };
  return { ok: true };
}

export function clampGain(gain: number): number {
  if (!Number.isFinite(gain)) return 0;
  return Math.max(MIN_GAIN_DB, Math.min(MAX_GAIN_DB, gain));
}

export function validateQ(q: number): { ok: boolean; error?: string } {
  if (!Number.isFinite(q)) return { ok: false, error: "Q must be a finite number." };
  if (q <= 0) return { ok: false, error: "Q must be > 0." };
  if (q > 100) return { ok: false, error: "Q must be ≤ 100." };
  return { ok: true };
}

export interface EqConfig {
  presetId: string;
  q: number;
  customGains?: number[];
}

export interface EqConfigResult {
  config: EqConfig;
  preset: EqPreset | null;
  gains: number[];
  q: number;
  qInfo: QFactorInfo | null;
  totalGainChange: number;
  bandsModified: number;
  maxBoost: number;
  maxCut: number;
  warnings: string[];
  notes: string[];
}

export function planEqConfig(config: EqConfig): EqConfigResult {
  const warnings: string[] = [];
  const notes: string[] = [];
  const preset = getPreset(config.presetId);
  let gains: number[];

  if (config.customGains && config.customGains.length === BANDS.length) {
    gains = config.customGains.map(clampGain);
    if (!preset) notes.push("Using custom gains — no preset matched.");
  } else if (preset) {
    gains = preset.gains.map(clampGain);
  } else {
    warnings.push("Unknown preset and no custom gains — defaulting to flat.");
    gains = BANDS.map(() => 0);
  }

  const qValid = validateQ(config.q);
  if (!qValid.ok) warnings.push(qValid.error!);
  const q = qValid.ok ? config.q : 1.41;
  const qInfo = Q_PRESETS.find((p) => p.value === q) ?? null;

  const totalGainChange = gains.reduce((s, g) => s + Math.abs(g), 0);
  const bandsModified = gains.filter((g) => Math.abs(g) > 1e-9).length;
  const maxBoost = Math.max(0, ...gains);
  const maxCut = Math.min(0, ...gains);

  if (Math.abs(maxBoost) > 12) warnings.push(`Max boost ${maxBoost} dB may cause clipping — reduce or apply limiter.`);
  if (Math.abs(maxCut) > 12) warnings.push(`Max cut ${maxCut} dB may noticeably attenuate the band.`);

  return { config, preset, gains, q, qInfo, totalGainChange, bandsModified, maxBoost, maxCut, warnings, notes };
}

export function renderCsv(r: EqConfigResult): string {
  const lines: string[] = ["band,hz,gain_db"];
  r.gains.forEach((g, i) => {
    lines.push([String(i + 1), String(BANDS[i].hz), g.toFixed(2)].join(","));
  });
  lines.push(`#preset,${r.preset?.id ?? "custom"}`);
  lines.push(`#q,${r.q}`);
  lines.push(`#bands_modified,${r.bandsModified}`);
  lines.push(`#total_gain_change_db,${r.totalGainChange.toFixed(2)}`);
  return lines.join("\n");
}

export function renderReport(r: EqConfigResult): string {
  const lines: string[] = [];
  lines.push("Audio Equalizer Reference Report");
  lines.push("==================================");
  lines.push(`Preset: ${r.preset?.label ?? "Custom"} (${r.preset?.id ?? "custom"})`);
  if (r.preset) lines.push(`Description: ${r.preset.description}`);
  lines.push(`Q factor: ${r.q}${r.qInfo ? ` — bandwidth ≈ ${r.qInfo.bandwidthOctaves.toFixed(2)} octaves (${r.qInfo.useCase})` : ""}`);
  lines.push(`Bands modified: ${r.bandsModified} / ${r.gains.length}`);
  lines.push(`Total gain change: ${r.totalGainChange.toFixed(2)} dB`);
  lines.push(`Max boost: ${r.maxBoost} dB, max cut: ${r.maxCut} dB`);
  lines.push("");
  lines.push("Per-band gains:");
  r.gains.forEach((g, i) => {
    const b = BANDS[i];
    lines.push(`  ${b.label.padEnd(8)}  ${b.bandName.padEnd(12)}  ${g >= 0 ? "+" : ""}${g.toFixed(2)} dB`);
  });
  if (r.warnings.length) { lines.push(""); lines.push("Warnings:"); r.warnings.forEach((w) => lines.push(`  ! ${w}`)); }
  if (r.notes.length) { lines.push(""); lines.push("Notes:"); r.notes.forEach((n) => lines.push(`  • ${n}`)); }
  return lines.join("\n");
}

export function planBatch(configs: EqConfig[]): EqConfigResult[] {
  return configs.map(planEqConfig);
}

export function renderBatchCsv(results: EqConfigResult[]): string {
  const lines: string[] = ["index,preset,q,bands_modified,total_gain_change_db"];
  results.forEach((r, i) => {
    lines.push([String(i + 1), r.preset?.id ?? "custom", String(r.q), String(r.bandsModified), r.totalGainChange.toFixed(2)].join(","));
  });
  return lines.join("\n");
}

/** Format frequency in Hz. */
export function formatHz(hz: number): string {
  if (!Number.isFinite(hz)) return "—";
  if (hz >= 1000) return `${(hz / 1000).toFixed(2)} kHz`;
  return `${hz.toFixed(0)} Hz`;
}

/** Format gain in dB with sign. */
export function formatGainDb(gain: number): string {
  if (!Number.isFinite(gain)) return "—";
  return `${gain >= 0 ? "+" : ""}${gain.toFixed(2)} dB`;
}
