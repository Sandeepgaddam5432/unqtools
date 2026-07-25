/**
 * Sample Rate Converter — pure logic.
 * Reference table for common audio sample rates.
 */

export interface SampleRateInfo {
  hz: number;
  khz: string;
  label: string;
  nyquist: number; // Hz (max reproducible freq)
  bitsPerSample: number[]; // common bit depths
  useCases: string[];
  quality: "low" | "medium" | "high" | "studio";
}

const RATES: SampleRateInfo[] = [
  {
    hz: 8000,
    khz: "8 kHz",
    label: "Telephony",
    nyquist: 4000,
    bitsPerSample: [8, 16],
    useCases: ["Phone calls", "VoIP", "Voice storage"],
    quality: "low",
  },
  {
    hz: 16000,
    khz: "16 kHz",
    label: "Wideband voice",
    nyquist: 8000,
    bitsPerSample: [16],
    useCases: ["VoIP", "Speech recognition", "Walkie-talkie"],
    quality: "low",
  },
  {
    hz: 22050,
    khz: "22.05 kHz",
    label: "Half CD",
    nyquist: 11025,
    bitsPerSample: [16],
    useCases: ["Low-quality audio", "Game audio (legacy)", "Streaming (legacy)"],
    quality: "medium",
  },
  {
    hz: 44100,
    khz: "44.1 kHz",
    label: "CD Quality",
    nyquist: 22050,
    bitsPerSample: [16, 24],
    useCases: ["CD audio", "Streaming", "Music distribution"],
    quality: "high",
  },
  {
    hz: 48000,
    khz: "48 kHz",
    label: "DVD / Pro audio",
    nyquist: 24000,
    bitsPerSample: [16, 24, 32],
    useCases: ["DVD", "Blu-ray", "Video production", "Pro audio"],
    quality: "high",
  },
  {
    hz: 96000,
    khz: "96 kHz",
    label: "Studio high-res",
    nyquist: 48000,
    bitsPerSample: [24, 32],
    useCases: ["Studio recording", "Mastering", "Hi-res audio"],
    quality: "studio",
  },
  {
    hz: 192000,
    khz: "192 kHz",
    label: "Studio ultra-hi-res",
    nyquist: 96000,
    bitsPerSample: [24, 32],
    useCases: ["Hi-res distribution", "Archival", "Mastering"],
    quality: "studio",
  },
];

export function getAllRates(): SampleRateInfo[] {
  return [...RATES];
}

export function getRateByHz(hz: number): SampleRateInfo | null {
  return RATES.find((r) => r.hz === hz) ?? null;
}

export function getRateByKhz(khz: number): SampleRateInfo | null {
  return RATES.find((r) => r.hz === khz * 1000) ?? null;
}

export function searchRates(query: string): SampleRateInfo[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...RATES];
  return RATES.filter((r) =>
    r.label.toLowerCase().includes(q) ||
    r.khz.toLowerCase().includes(q) ||
    String(r.hz) === q ||
    r.useCases.some((u) => u.toLowerCase().includes(q))
  );
}

export function filterByQuality(quality: SampleRateInfo["quality"]): SampleRateInfo[] {
  return RATES.filter((r) => r.quality === quality);
}

export interface ConversionResult {
  inputHz: number;
  outputHz: number;
  ratio: number;
  resampleQuality: "downsample" | "upsample" | "no-change";
  qualityNote: string;
}

export function planConversion(inputHz: number, outputHz: number): ConversionResult {
  if (inputHz <= 0 || outputHz <= 0) {
    return { inputHz, outputHz, ratio: 0, resampleQuality: "no-change", qualityNote: "Invalid sample rate." };
  }
  const ratio = outputHz / inputHz;
  let resampleQuality: ConversionResult["resampleQuality"] = "no-change";
  let qualityNote = "No resampling needed.";
  if (outputHz < inputHz) {
    resampleQuality = "downsample";
    qualityNote = `Downsampling loses frequencies above ${outputHz / 2} Hz (new Nyquist).`;
  } else if (outputHz > inputHz) {
    resampleQuality = "upsample";
    qualityNote = "Upsampling adds no new audio info; useful for processing headroom only.";
  }
  return { inputHz, outputHz, ratio, resampleQuality, qualityNote };
}

/** Compute data rate (bytes/s) for a given sample rate / bit depth / channels. */
export function computeDataRate(hz: number, bits: number, channels: number): number {
  if (hz <= 0 || bits <= 0 || channels <= 0) return 0;
  return (hz * bits * channels) / 8;
}
