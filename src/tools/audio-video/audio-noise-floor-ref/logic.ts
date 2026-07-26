/**
 * Audio Noise Floor Reference — pure logic.
 * dBFS scale, SNR calculation, noise floor levels for common formats.
 */

export interface NoiseFloorFormat {
  id: string;
  name: string;
  bitDepth: number;
  theoreticalFloorDbfs: number; // 6.02 * bitDepth
  typicalFloorDbfs: number; // real-world achievable
  dynamicRangeDb: number;
  notes: string;
}

export const NOISE_FLOOR_FORMATS: NoiseFloorFormat[] = [
  { id: "8bit", name: "8-bit PCM", bitDepth: 8, theoreticalFloorDbfs: -48.2, typicalFloorDbfs: -42, dynamicRangeDb: 48, notes: "Harsh, audible quantization noise." },
  { id: "16bit", name: "16-bit PCM (CD)", bitDepth: 16, theoreticalFloorDbfs: -96.3, typicalFloorDbfs: -93, dynamicRangeDb: 96, notes: "CD-quality. Inaudible noise floor for most playback." },
  { id: "24bit", name: "24-bit PCM (Studio)", bitDepth: 24, theoreticalFloorDbfs: -144.5, typicalFloorDbfs: -130, dynamicRangeDb: 144, notes: "Studio standard. Massive headroom for processing." },
  { id: "32bit-float", name: "32-bit float", bitDepth: 32, theoreticalFloorDbfs: -1528, typicalFloorDbfs: -760, dynamicRangeDb: 1528, notes: "Effectively unclippable. Used in DAWs." },
  { id: "mp3-128", name: "MP3 128 kbps", bitDepth: 0, theoreticalFloorDbfs: -90, typicalFloorDbfs: -75, dynamicRangeDb: 75, notes: "Lossy. Masking noise above 16 kHz typical." },
  { id: "mp3-320", name: "MP3 320 kbps", bitDepth: 0, theoreticalFloorDbfs: -96, typicalFloorDbfs: -88, dynamicRangeDb: 88, notes: "High-quality lossy. Near-transparent for most." },
  { id: "aac-256", name: "AAC 256 kbps", bitDepth: 0, theoreticalFloorDbfs: -96, typicalFloorDbfs: -88, dynamicRangeDb: 88, notes: "Apple Music standard. Efficient codec." },
  { id: "flac", name: "FLAC (lossless)", bitDepth: 16, theoreticalFloorDbfs: -96.3, typicalFloorDbfs: -93, dynamicRangeDb: 96, notes: "Identical to PCM source. Compressed losslessly." },
];

export function getAllFormats(): NoiseFloorFormat[] {
  return [...NOISE_FLOOR_FORMATS];
}

export function getFormatById(id: string): NoiseFloorFormat | null {
  return NOISE_FLOOR_FORMATS.find((f) => f.id === id) ?? null;
}

/** Theoretical noise floor: -6.02 × bitDepth (dBFS). */
export function theoreticalFloor(bitDepth: number): number {
  if (bitDepth <= 0) return -96; // fallback for lossy
  return -(6.02 * bitDepth);
}

/** SNR (dB) = signalLevelDbfs - noiseFloorDbfs. Signal must be louder than floor. */
export function calculateSNR(signalDbfs: number, noiseFloorDbfs: number): number {
  return signalDbfs - noiseFloorDbfs;
}

/** Convert dBFS to linear amplitude (0..1). */
export function dbfsToLinear(dbfs: number): number {
  return Math.pow(10, dbfs / 20);
}

/** Convert linear amplitude to dBFS. */
export function linearToDbfs(linear: number): number {
  if (linear <= 0) return -Infinity;
  return 20 * Math.log10(linear);
}

/** Estimate dynamic range improvement when bit-bumping from → to. */
export function dynamicRangeGain(fromBit: number, toBit: number): number {
  return (toBit - fromBit) * 6.02;
}

/** Classify SNR into quality rating. */
export function classifySNR(snr: number): { rating: string; color: string } {
  if (snr >= 96) return { rating: "Studio-grade", color: "emerald" };
  if (snr >= 60) return { rating: "High quality", color: "blue" };
  if (snr >= 40) return { rating: "Acceptable", color: "amber" };
  if (snr >= 20) return { rating: "Noisy", color: "orange" };
  return { rating: "Poor", color: "red" };
}

/** Find formats that can preserve a given SNR. */
export function findFormatsForSNR(targetSNR: number): NoiseFloorFormat[] {
  return NOISE_FLOOR_FORMATS.filter((f) => f.dynamicRangeDb >= targetSNR);
}

/** Convert measured analog noise (uV) at given reference to dBFS-ish. */
export function analogNoiseToDbfs(noiseMicrovolts: number, referenceMicrovolts: number): number {
  if (noiseMicrovolts <= 0 || referenceMicrovolts <= 0) return -Infinity;
  return 20 * Math.log10(noiseMicrovolts / referenceMicrovolts);
}

/** Recommend dither type when reducing bit depth. */
export function recommendDither(fromBit: number, toBit: number): string {
  if (toBit >= fromBit) return "No dither needed (bit-bumping is lossless)";
  if (toBit <= 8) return "TPDF dither, high-pass shaped, noise-shaped";
  if (toBit <= 16) return "TPDF dither, lightly noise-shaped";
  return "Flat TPDF dither";
}

/** Format as CSV for export. */
export function exportFormatsAsCSV(): string {
  const header = ["id", "name", "bit_depth", "theoretical_floor_dbfs", "typical_floor_dbfs", "dynamic_range_db", "notes"];
  const rows = NOISE_FLOOR_FORMATS.map((f) =>
    [f.id, `"${f.name}"`, f.bitDepth, f.theoreticalFloorDbfs, f.typicalFloorDbfs, f.dynamicRangeDb, `"${f.notes.replace(/"/g, '""')}"`].join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

/** Generate reference text card for a single format. */
export function formatCard(f: NoiseFloorFormat): string {
  return [
    `${f.name}`,
    `Bit depth:           ${f.bitDepth || "lossy"}`,
    `Theoretical floor:   ${f.theoreticalFloorDbfs.toFixed(1)} dBFS`,
    `Typical floor:       ${f.typicalFloorDbfs.toFixed(1)} dBFS`,
    `Dynamic range:       ${f.dynamicRangeDb} dB`,
    `Notes: ${f.notes}`,
  ].join("\n");
}

/** Validate SNR inputs. */
export function validateSNRInputs(signalDbfs: number, noiseFloorDbfs: number): string[] {
  const warnings: string[] = [];
  if (signalDbfs > 0) warnings.push("Signal above 0 dBFS will clip in PCM.");
  if (noiseFloorDbfs > signalDbfs) warnings.push("Noise floor is louder than the signal — measurement may be invalid.");
  if (signalDbfs < -150) warnings.push("Signal below -150 dBFS is likely measurement noise, not real audio.");
  return warnings;
}

/** Recommend a recording bit depth for a target SNR. */
export function recommendBitDepth(targetSNR: number): { bitDepth: number; format: string; reason: string } {
  if (targetSNR >= 144) return { bitDepth: 32, format: "32-bit float", reason: "Exceeds 24-bit; use float for headroom." };
  if (targetSNR >= 96) return { bitDepth: 24, format: "24-bit PCM", reason: "Covers up to 144 dB range with margin." };
  if (targetSNR >= 60) return { bitDepth: 16, format: "16-bit PCM", reason: "CD-quality. Sufficient for consumer playback." };
  return { bitDepth: 8, format: "8-bit PCM", reason: "Low SNR target. 8-bit may suffice for voice." };
}

/** Compute A-weighting correction (approx) for noise floor at given frequency. */
export function aWeightingDb(frequencyHz: number): number {
  const f2 = frequencyHz * frequencyHz;
  const ra = (12194 * 12194 * f2 * f2) / ((f2 + 20.6 * 20.6) * Math.sqrt((f2 + 107.7 * 107.7) * (f2 + 737.9 * 737.9)) * (f2 + 12194 * 12194));
  const dbA = 20 * Math.log10(ra) + 2.0;
  return dbA;
}
