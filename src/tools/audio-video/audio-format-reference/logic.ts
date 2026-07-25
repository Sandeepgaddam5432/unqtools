/**
 * Audio Format Reference — pure logic.
 * Reference table for common audio formats.
 */

export interface AudioFormatInfo {
  id: string;
  name: string;
  extension: string;
  mimeType: string;
  lossless: boolean;
  typicalBitrate: string;
  channels: "mono" | "stereo" | "multi";
  supportedBy: string[]; // browsers/platforms
  pros: string[];
  cons: string[];
  useCases: string[];
}

const FORMATS: AudioFormatInfo[] = [
  {
    id: "mp3",
    name: "MP3 (MPEG-1 Audio Layer III)",
    extension: ".mp3",
    mimeType: "audio/mpeg",
    lossless: false,
    typicalBitrate: "128–320 kbps",
    channels: "stereo",
    supportedBy: ["All browsers", "All OSes", "All devices"],
    pros: ["Universal compatibility", "Small file size", "Hardware support everywhere"],
    cons: ["Lossy compression", "Outdated encoder tech", "No metadata standard"],
    useCases: ["Music streaming", "Podcasts", "Audio books"],
  },
  {
    id: "aac",
    name: "AAC (Advanced Audio Coding)",
    extension: ".m4a",
    mimeType: "audio/aac",
    lossless: false,
    typicalBitrate: "96–256 kbps",
    channels: "multi",
    supportedBy: ["Safari", "Chrome", "iOS", "Android", "iTunes"],
    pros: ["Better quality than MP3 at same bitrate", "Apple ecosystem native", "Multi-channel"],
    cons: ["Lossy", "Licensing required for encoders", "Less ubiquitous than MP3"],
    useCases: ["Apple Music", "YouTube", "Streaming platforms"],
  },
  {
    id: "flac",
    name: "FLAC (Free Lossless Audio Codec)",
    extension: ".flac",
    mimeType: "audio/flac",
    lossless: true,
    typicalBitrate: "800–1100 kbps",
    channels: "multi",
    supportedBy: ["Chrome", "Firefox", "Edge", "Most modern players"],
    pros: ["Lossless", "Open source", "50-70% smaller than WAV"],
    cons: ["Larger than lossy formats", "Not supported by Safari <11", "Overkill for streaming"],
    useCases: ["Music archiving", "Hi-Fi playback", "Studio masters"],
  },
  {
    id: "wav",
    name: "WAV (PCM Audio)",
    extension: ".wav",
    mimeType: "audio/wav",
    lossless: true,
    typicalBitrate: "1411 kbps (CD)",
    channels: "multi",
    supportedBy: ["All browsers", "All OSes", "All audio software"],
    pros: ["Uncompressed", "Editing friendly", "Universal"],
    cons: ["Very large files", "No compression", "No metadata tags"],
    useCases: ["Audio editing", "Sound effects", "Mastering"],
  },
  {
    id: "ogg",
    name: "Ogg Vorbis",
    extension: ".ogg",
    mimeType: "audio/ogg",
    lossless: false,
    typicalBitrate: "64–500 kbps",
    channels: "multi",
    supportedBy: ["Firefox", "Chrome", "Linux", "Android"],
    pros: ["Open source", "Better than MP3 at low bitrates", "No licensing"],
    cons: ["Not in Safari", "Smaller device support", "Confused with Opus"],
    useCases: ["Web audio", "Game audio", "Open-source projects"],
  },
  {
    id: "opus",
    name: "Opus",
    extension: ".opus",
    mimeType: "audio/opus",
    lossless: false,
    typicalBitrate: "6–510 kbps",
    channels: "multi",
    supportedBy: ["Chrome", "Firefox", "Edge", "Linux", "Android 5.1+"],
    pros: ["State-of-the-art quality", "Low latency", "Highly efficient"],
    cons: ["Limited device support", "No native iOS support older", "Newer ecosystem"],
    useCases: ["VoIP", "Real-time comms", "Streaming"],
  },
];

export function getAllFormats(): AudioFormatInfo[] {
  return [...FORMATS];
}

export function getFormatById(id: string): AudioFormatInfo | null {
  return FORMATS.find((f) => f.id === id) ?? null;
}

export function getFormatByExtension(ext: string): AudioFormatInfo | null {
  const e = ext.toLowerCase().trim().replace(/^\./, "");
  return FORMATS.find((f) => f.extension.replace(/^\./, "") === e) ?? null;
}

export function getFormatByMime(mime: string): AudioFormatInfo | null {
  const m = mime.toLowerCase().split(";")[0].trim();
  return FORMATS.find((f) => f.mimeType === m) ?? null;
}

export function filterLossless(lossless: boolean): AudioFormatInfo[] {
  return FORMATS.filter((f) => f.lossless === lossless);
}

export function searchFormats(query: string): AudioFormatInfo[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...FORMATS];
  return FORMATS.filter((f) =>
    f.name.toLowerCase().includes(q) ||
    f.id.includes(q) ||
    f.extension.includes(q) ||
    f.mimeType.includes(q) ||
    f.useCases.some((u) => u.toLowerCase().includes(q))
  );
}

export interface FormatComparison {
  sizeAtBitrate: (bitrateKbps: number, seconds: number) => number; // bytes
}

/** Estimate file size in bytes for a given bitrate and duration. */
export function estimateSize(bitrateKbps: number, seconds: number): number {
  if (bitrateKbps < 0 || seconds < 0) return 0;
  return Math.round((bitrateKbps * 1000 * seconds) / 8);
}
