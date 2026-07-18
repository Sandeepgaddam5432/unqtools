/**
 * Video Metadata Viewer — pure logic.
 *
 * Pure helpers only — no DOM, no AudioContext, no <video> element. The
 * actual metadata reading happens in ui.tsx via the HTML5 <video> element
 * (loadedmetadata event). This module contains:
 *   - File type detector (magic bytes + extension) for 7 containers
 *   - MIME type lookup
 *   - Codec name lookup (9+ codecs)
 *   - Bitrate calculator (file size × 8 / duration)
 *   - Bitrate formatter (bps, kbps, Mbps, Gbps)
 *   - File size formatter (B, KB, MB, GB)
 *   - Duration formatter (HH:MM:SS.ms)
 *   - Aspect ratio calculator (16:9, 4:3, 21:9, etc.)
 *   - Resolution labeler (Full HD, 4K, 8K)
 *   - 8 common resolution presets (240p – 8K)
 *   - 10 frame-rate presets (23.976 – 240)
 *   - Container/codec compatibility checker
 *   - Text + CSV report renderers
 *   - History (localStorage, last 20)
 *   - Shareable URL (URLSearchParams)
 *   - Summary stats
 */

// ---- File types ----

export type VideoContainer =
  | "mp4"
  | "webm"
  | "ogg"
  | "mov"
  | "avi"
  | "mkv"
  | "flv"
  | "unknown";

export interface ContainerInfo {
  container: VideoContainer;
  mimeType: string;
  extensions: string[];
  description: string;
}

export const CONTAINERS: Record<Exclude<VideoContainer, "unknown">, ContainerInfo> = {
  mp4: {
    container: "mp4",
    mimeType: "video/mp4",
    extensions: ["mp4", "m4v"],
    description: "MPEG-4 Part 14 — the most common video container, used for web, mobile, and streaming.",
  },
  webm: {
    container: "webm",
    mimeType: "video/webm",
    extensions: ["webm"],
    description: "WebM — open, royalty-free container designed for the web (VP8/VP9/AV1 + Vorbis/Opus).",
  },
  ogg: {
    container: "ogg",
    mimeType: "video/ogg",
    extensions: ["ogg", "ogv"],
    description: "Ogg Video — open container, usually Theora + Vorbis.",
  },
  mov: {
    container: "mov",
    mimeType: "video/quicktime",
    extensions: ["mov", "qt"],
    description: "QuickTime Movie — Apple's container, closely related to MP4.",
  },
  avi: {
    container: "avi",
    mimeType: "video/x-msvideo",
    extensions: ["avi"],
    description: "Audio Video Interleave — Microsoft's legacy container.",
  },
  mkv: {
    container: "mkv",
    mimeType: "video/x-matroska",
    extensions: ["mkv", "mka"],
    description: "Matroska — open, flexible container that holds virtually any codec.",
  },
  flv: {
    container: "flv",
    mimeType: "video/x-flv",
    extensions: ["flv"],
    description: "Flash Video — Adobe's legacy streaming format.",
  },
};

// ---- Codecs ----

export type VideoCodec =
  | "avc1" | "avc3"      // H.264 / AVC
  | "hev1" | "hvc1"      // H.265 / HEVC
  | "vp8" | "vp09"       // VP8 / VP9
  | "av01"               // AV1
  | "theora"             // Theora
  | "unknown-video";

export type AudioCodec =
  | "mp4a"               // AAC
  | "opus"
  | "vorbis"
  | "mp3"
  | "ac-3"               // Dolby Digital
  | "ec-3"               // Dolby Digital Plus
  | "flac"
  | "unknown-audio";

export interface CodecInfo {
  codec: string;
  name: string;
  kind: "video" | "audio";
  description: string;
}

export const CODEC_LOOKUP: Record<string, CodecInfo> = {
  // Video codecs
  avc1: { codec: "avc1", name: "H.264 / AVC", kind: "video", description: "Most widely supported video codec on the web." },
  avc3: { codec: "avc3", name: "H.264 / AVC", kind: "video", description: "H.264 with in-band parameter sets." },
  hev1: { codec: "hev1", name: "H.265 / HEVC", kind: "video", description: "High Efficiency Video Coding — better compression than H.264." },
  hvc1: { codec: "hvc1", name: "H.265 / HEVC", kind: "video", description: "HEVC with out-of-band parameter sets." },
  vp8: { codec: "vp8", name: "VP8", kind: "video", description: "Open video codec by Google, predecessor to VP9." },
  "vp09": { codec: "vp09", name: "VP9", kind: "video", description: "Open, royalty-free video codec used in WebM." },
  vp9: { codec: "vp9", name: "VP9", kind: "video", description: "Open, royalty-free video codec used in WebM." },
  av01: { codec: "av01", name: "AV1", kind: "video", description: "Next-gen open codec by AOMedia — best compression, growing support." },
  theora: { codec: "theora", name: "Theora", kind: "video", description: "Open video codec, usually paired with Vorbis in Ogg." },
  // Audio codecs
  mp4a: { codec: "mp4a", name: "AAC", kind: "audio", description: "Advanced Audio Coding — standard audio codec for MP4." },
  "mp4a.40.2": { codec: "mp4a.40.2", name: "AAC-LC", kind: "audio", description: "AAC Low-Complexity profile." },
  "mp4a.40.5": { codec: "mp4a.40.5", name: "HE-AAC", kind: "audio", description: "High-Efficiency AAC (used for low-bitrate streaming)." },
  opus: { codec: "opus", name: "Opus", kind: "audio", description: "Open, low-latency audio codec — best-in-class at low bitrates." },
  vorbis: { codec: "vorbis", name: "Vorbis", kind: "audio", description: "Open audio codec, usually paired with Theora or VP8 in WebM/Ogg." },
  mp3: { codec: "mp3", name: "MP3", kind: "audio", description: "MPEG-1 Audio Layer III — universally supported." },
  "ac-3": { codec: "ac-3", name: "Dolby Digital (AC-3)", kind: "audio", description: "Dolby's surround sound codec." },
  "ec-3": { codec: "ec-3", name: "Dolby Digital Plus (E-AC-3)", kind: "audio", description: "Enhanced Dolby Digital." },
  flac: { codec: "flac", name: "FLAC", kind: "audio", description: "Free Lossless Audio Codec." },
};

/** Lookup a codec four-cc / string (e.g. "avc1.42E01E", "mp4a.40.2") to a friendly name. */
export function lookupCodec(codec: string): CodecInfo | null {
  if (!codec) return null;
  const lc = codec.toLowerCase();
  if (CODEC_LOOKUP[lc]) return CODEC_LOOKUP[lc];
  // Try prefix match: avc1.42E01E → avc1, vp09.00.10.08 → vp09
  const prefix = lc.split(".")[0];
  if (prefix && CODEC_LOOKUP[prefix]) return CODEC_LOOKUP[prefix];
  // Try second-level match: mp4a.40.2 → mp4a.40.2
  const parts = lc.split(".");
  if (parts.length >= 2) {
    const two = `${parts[0]}.${parts[1]}`;
    if (CODEC_LOOKUP[two]) return CODEC_LOOKUP[two];
  }
  return null;
}

// ---- MIME type lookup ----

/** Get the MIME type for a container. */
export function getMimeType(container: VideoContainer): string {
  if (container === "unknown") return "application/octet-stream";
  return CONTAINERS[container].mimeType;
}

/** Get the container info for an extension. */
export function getContainerByExtension(ext: string): VideoContainer {
  if (!ext) return "unknown";
  const clean = ext.toLowerCase().replace(/^\./, "");
  for (const key of Object.keys(CONTAINERS) as Exclude<VideoContainer, "unknown">[]) {
    if (CONTAINERS[key].extensions.includes(clean)) return key;
  }
  return "unknown";
}

// ---- File type detector (magic bytes + extension) ----

/**
 * Detect the video container from the file's magic bytes (first ~64 bytes).
 * Falls back to extension-based detection when magic bytes are inconclusive.
 *
 * Detection logic:
 *   - MP4 / MOV: bytes 4–7 = "ftyp"
 *   - WebM / MKV: starts with EBML header (0x1A 0x45 0xDF 0xA3)
 *   - AVI: starts with "RIFF" and bytes 8–11 = "AVI "
 *   - FLV: starts with "FLV" (0x46 0x4C 0x56)
 *   - OGG: starts with "OggS" (0x4F 0x67 0x67 0x53)
 */
export function detectContainer(
  bytes: Uint8Array | ArrayBuffer,
  fallbackExtension?: string,
): VideoContainer {
  const arr = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  const len = arr.length;

  // Need at least 12 bytes for reliable magic-byte detection
  if (len >= 12) {
    // MP4 / MOV: ftyp at offset 4
    if (
      arr[4] === 0x66 && arr[5] === 0x74 &&
      arr[6] === 0x79 && arr[7] === 0x70
    ) {
      // Distinguish MP4 from MOV by reading the major brand (bytes 8-11)
      const brand = String.fromCharCode(arr[8]!, arr[9]!, arr[10]!, arr[11]!);
      if (brand === "qt  " || brand === "qt") return "mov";
      return "mp4";
    }

    // RIFF (AVI)
    if (
      arr[0] === 0x52 && arr[1] === 0x49 &&
      arr[2] === 0x46 && arr[3] === 0x46 &&
      arr[8] === 0x41 && arr[9] === 0x56 &&
      arr[10] === 0x49 && arr[11] === 0x20
    ) {
      return "avi";
    }

    // FLV
    if (arr[0] === 0x46 && arr[1] === 0x4C && arr[2] === 0x56) {
      return "flv";
    }

    // OggS
    if (
      arr[0] === 0x4F && arr[1] === 0x67 &&
      arr[2] === 0x67 && arr[3] === 0x53
    ) {
      return "ogg";
    }

    // EBML header — could be WebM or MKV. Peek at the EBML DocType.
    // WebM uses Doctype "webm"; MKV uses "matroska".
    if (
      arr[0] === 0x1A && arr[1] === 0x45 &&
      arr[2] === 0xDF && arr[3] === 0xA3
    ) {
      // Scan the first 64 bytes for the doc type string
      const maxScan = Math.min(len, 64);
      const asAscii = bytesToAscii(arr.slice(0, maxScan));
      if (asAscii.includes("matroska")) return "mkv";
      if (asAscii.includes("webm")) return "webm";
      // Default EBML → assume matroska (broader container)
      return "mkv";
    }
  }

  // Fall back to extension
  if (fallbackExtension) {
    return getContainerByExtension(fallbackExtension);
  }
  return "unknown";
}

function bytesToAscii(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) {
    s += String.fromCharCode(bytes[i]!);
  }
  return s;
}

// ---- Formatters ----

/** Format bytes as a human-readable string (B, KB, MB, GB). */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const k = 1024;
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  const v = bytes / Math.pow(k, i);
  return `${v.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

/** Format seconds as HH:MM:SS.ms (e.g. 3661.5 → "01:01:01.500"). */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const totalMs = Math.round(seconds * 1000);
  const h = Math.floor(totalMs / 3_600_000);
  const m = Math.floor((totalMs % 3_600_000) / 60_000);
  const s = Math.floor((totalMs % 60_000) / 1000);
  const ms = totalMs % 1000;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}.${pad3(ms)}`;
}

/** Format seconds as HH:MM:SS (no ms). */
export function formatDurationHMS(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

function pad2(n: number): string { return n < 10 ? `0${n}` : `${n}`; }
function pad3(n: number): string {
  if (n < 10) return `00${n}`;
  if (n < 100) return `0${n}`;
  return `${n}`;
}

// ---- Bitrate ----

/**
 * Calculate bitrate in bits per second.
 *   bitrate = (fileSizeBytes × 8) / durationSeconds
 * Returns 0 if duration is not finite or <= 0.
 */
export function calculateBitrate(fileSizeBytes: number, durationSeconds: number): number {
  if (!Number.isFinite(fileSizeBytes) || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return 0;
  }
  return (fileSizeBytes * 8) / durationSeconds;
}

/** Format a bitrate (in bits per second) as a human-readable string. */
export function formatBitrate(bps: number): string {
  if (!Number.isFinite(bps) || bps <= 0) return "0 bps";
  const k = 1000;
  const units = ["bps", "kbps", "Mbps", "Gbps"];
  const i = Math.min(Math.floor(Math.log(bps) / Math.log(k)), units.length - 1);
  const v = bps / Math.pow(k, i);
  return `${v.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

// ---- Aspect ratio ----

export interface AspectRatio {
  width: number;
  height: number;
  ratio: string;          // e.g. "16:9"
  decimal: number;        // e.g. 1.7778
  label: string;          // e.g. "Widescreen 16:9"
}

const COMMON_RATIOS: { ratio: string; decimal: number; label: string }[] = [
  { ratio: "1:1", decimal: 1.0, label: "Square" },
  { ratio: "4:3", decimal: 4 / 3, label: "Standard 4:3" },
  { ratio: "3:2", decimal: 3 / 2, label: "35mm Photo 3:2" },
  { ratio: "16:10", decimal: 16 / 10, label: "Widescreen 16:10" },
  { ratio: "16:9", decimal: 16 / 9, label: "Widescreen 16:9" },
  { ratio: "21:9", decimal: 21 / 9, label: "Ultrawide 21:9" },
  { ratio: "32:9", decimal: 32 / 9, label: "Super Ultrawide 32:9" },
  { ratio: "9:16", decimal: 9 / 16, label: "Vertical / Story 9:16" },
  { ratio: "2.35:1", decimal: 2.35, label: "Cinemascope 2.35:1" },
  { ratio: "2.39:1", decimal: 2.39, label: "Cinema 2.39:1" },
  { ratio: "2.40:1", decimal: 2.4, label: "Cinema 2.40:1" },
];

/**
 * Compute the aspect ratio for a width and height. Tries to match a common
 * ratio (within 2% tolerance); otherwise computes a reduced integer ratio.
 */
export function computeAspectRatio(width: number, height: number): AspectRatio {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: 0, height: 0, ratio: "unknown", decimal: 0, label: "Unknown" };
  }
  const decimal = width / height;

  // Find a common ratio match (within 2% tolerance)
  for (const r of COMMON_RATIOS) {
    if (Math.abs(decimal - r.decimal) / r.decimal < 0.02) {
      return { width, height, ratio: r.ratio, decimal, label: r.label };
    }
  }

  // Otherwise reduce by GCD
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  const g = gcd(Math.round(width), Math.round(height));
  const rw = Math.round(width) / g;
  const rh = Math.round(height) / g;
  return {
    width,
    height,
    ratio: `${rw}:${rh}`,
    decimal,
    label: `Custom ${rw}:${rh}`,
  };
}

// ---- Resolution labeler ----

export interface ResolutionPreset {
  label: string;
  shortLabel: string;
  width: number;
  height: number;
  alias: string;          // e.g. "1080p"
}

export const RESOLUTION_PRESETS: ResolutionPreset[] = [
  { label: "QVGA", shortLabel: "240p", width: 426, height: 240, alias: "240p" },
  { label: "nHD", shortLabel: "360p", width: 640, height: 360, alias: "360p" },
  { label: "SD (WVGA)", shortLabel: "480p", width: 854, height: 480, alias: "480p" },
  { label: "HD", shortLabel: "720p", width: 1280, height: 720, alias: "720p" },
  { label: "Full HD", shortLabel: "1080p", width: 1920, height: 1080, alias: "1080p" },
  { label: "QHD", shortLabel: "1440p", width: 2560, height: 1440, alias: "1440p" },
  { label: "4K UHD", shortLabel: "2160p", width: 3840, height: 2160, alias: "4K" },
  { label: "8K UHD", shortLabel: "4320p", width: 7680, height: 4320, alias: "8K" },
];

export interface ResolutionLabel {
  label: string;
  alias: string;
  width: number;
  height: number;
}

/**
 * Label a resolution by height. Looks for a preset match (within ±2 pixels
 * of height); otherwise generates a custom label like "Custom 1920×1080".
 */
export function labelResolution(width: number, height: number): ResolutionLabel {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { label: "Unknown", alias: "unknown", width: 0, height: 0 };
  }

  // Match preset by height (within ±2 px)
  for (const p of RESOLUTION_PRESETS) {
    if (Math.abs(p.height - height) <= 2 && Math.abs(p.width - width) <= Math.max(20, p.width * 0.05)) {
      return { label: p.label, alias: p.alias, width, height };
    }
  }

  // Match by height only
  for (const p of RESOLUTION_PRESETS) {
    if (Math.abs(p.height - height) <= 2) {
      return { label: `${p.label} (non-standard width)`, alias: p.alias, width, height };
    }
  }

  // Custom
  const shortAlias = height >= 2160 ? "UHD" : height >= 720 ? "HD+" : "SD";
  return {
    label: `Custom ${width}×${height}`,
    alias: shortAlias,
    width,
    height,
  };
}

// ---- Frame rate presets ----

export interface FrameRatePreset {
  fps: number;
  label: string;
  description: string;
}

export const FRAME_RATE_PRESETS: FrameRatePreset[] = [
  { fps: 23.976, label: "23.976 fps", description: "Film (NTSC)" },
  { fps: 24, label: "24 fps", description: "Cinema" },
  { fps: 25, label: "25 fps", description: "PAL TV" },
  { fps: 29.97, label: "29.97 fps", description: "NTSC TV" },
  { fps: 30, label: "30 fps", description: "Web / NTSC rounded" },
  { fps: 50, label: "50 fps", description: "PAL HD" },
  { fps: 59.94, label: "59.94 fps", description: "NTSC HD" },
  { fps: 60, label: "60 fps", description: "Web / Gaming" },
  { fps: 120, label: "120 fps", description: "High-frame-rate / slow-mo" },
  { fps: 240, label: "240 fps", description: "Slow-motion capture" },
];

/** Match a frame rate to a known preset (within 0.05 fps tolerance). Picks the closest preset. */
export function matchFrameRate(fps: number): FrameRatePreset | null {
  if (!Number.isFinite(fps) || fps <= 0) return null;
  let best: FrameRatePreset | null = null;
  let bestDelta = Infinity;
  for (const p of FRAME_RATE_PRESETS) {
    const delta = Math.abs(p.fps - fps);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = p;
    }
  }
  return bestDelta < 0.05 ? best : null;
}

/** Format a frame rate (rounds to 3 decimals, strips trailing zeros). */
export function formatFrameRate(fps: number): string {
  if (!Number.isFinite(fps) || fps <= 0) return "unknown";
  return parseFloat(fps.toFixed(3)).toString();
}

// ---- Container/codec compatibility ----

export type Compatibility = "supported" | "common" | "rare" | "unsupported";

export const COMPATIBILITY_LABELS: Record<Compatibility, string> = {
  supported: "Supported",
  common: "Common pairing",
  rare: "Rare / unusual",
  unsupported: "Not supported",
};

/**
 * Container × codec compatibility matrix.
 * - supported: codec is officially part of the container spec and widely used.
 * - common: codec is commonly used in this container in practice.
 * - rare: codec is technically possible but very unusual.
 * - unsupported: codec cannot be stored in this container.
 */
export const COMPATIBILITY_MATRIX: Record<VideoContainer, Record<string, Compatibility>> = {
  mp4: {
    avc1: "supported", avc3: "supported",
    hev1: "common", hvc1: "common",
    vp09: "rare", vp9: "rare",
    av01: "common",
    theora: "unsupported",
    mp4a: "supported",
    opus: "common",
    vorbis: "unsupported",
    mp3: "supported",
    "ac-3": "rare", "ec-3": "rare",
    flac: "common",
  },
  webm: {
    avc1: "rare", avc3: "rare",
    hev1: "unsupported", hvc1: "unsupported",
    vp8: "supported", vp09: "supported", vp9: "supported",
    av01: "supported",
    theora: "unsupported",
    mp4a: "unsupported",
    opus: "supported",
    vorbis: "supported",
    mp3: "rare",
    "ac-3": "unsupported", "ec-3": "unsupported",
    flac: "rare",
  },
  ogg: {
    avc1: "unsupported", avc3: "unsupported",
    hev1: "unsupported", hvc1: "unsupported",
    vp8: "rare", vp09: "rare", vp9: "rare",
    av01: "unsupported",
    theora: "supported",
    mp4a: "unsupported",
    opus: "supported",
    vorbis: "supported",
    mp3: "rare",
    "ac-3": "unsupported", "ec-3": "unsupported",
    flac: "common",
  },
  mov: {
    avc1: "supported", avc3: "supported",
    hev1: "supported", hvc1: "supported",
    vp09: "rare", vp9: "rare",
    av01: "common",
    theora: "unsupported",
    mp4a: "supported",
    opus: "rare",
    vorbis: "unsupported",
    mp3: "supported",
    "ac-3": "common", "ec-3": "common",
    flac: "common",
  },
  avi: {
    avc1: "rare", avc3: "rare",
    hev1: "rare", hvc1: "rare",
    vp8: "rare", vp09: "rare", vp9: "rare",
    av01: "rare",
    theora: "rare",
    mp4a: "common",
    opus: "rare",
    vorbis: "common",
    mp3: "supported",
    "ac-3": "common", "ec-3": "rare",
    flac: "rare",
  },
  mkv: {
    avc1: "supported", avc3: "supported",
    hev1: "supported", hvc1: "supported",
    vp8: "supported", vp09: "supported", vp9: "supported",
    av01: "supported",
    theora: "common",
    mp4a: "supported",
    opus: "supported",
    vorbis: "supported",
    mp3: "supported",
    "ac-3": "supported", "ec-3": "supported",
    flac: "supported",
  },
  flv: {
    avc1: "supported", avc3: "supported",
    hev1: "rare", hvc1: "rare",
    vp8: "rare", vp09: "rare", vp9: "rare",
    av01: "unsupported",
    theora: "unsupported",
    mp4a: "supported",
    opus: "unsupported",
    vorbis: "rare",
    mp3: "supported",
    "ac-3": "rare", "ec-3": "rare",
    flac: "unsupported",
  },
  unknown: {},
};

/** Check container × codec compatibility. Returns "unsupported" for unknown combos. */
export function checkCompatibility(container: VideoContainer, codec: string): Compatibility {
  if (container === "unknown") return "unsupported";
  const matrix = COMPATIBILITY_MATRIX[container];
  const prefix = codec.toLowerCase().split(".")[0];
  return matrix[prefix] ?? "unsupported";
}

// ---- Metadata type ----

export interface VideoMetadata {
  fileName: string;
  fileSizeBytes: number;
  container: VideoContainer;
  mimeType: string;
  videoWidth: number;
  videoHeight: number;
  durationSeconds: number;
  videoCodec?: string;
  audioCodec?: string;
  frameRate?: number;
}

export interface MetadataReport {
  metadata: VideoMetadata;
  bitrate: number;                   // bps
  aspectRatio: AspectRatio;
  resolutionLabel: ResolutionLabel;
  frameRatePreset: FrameRatePreset | null;
  videoCodecInfo: CodecInfo | null;
  audioCodecInfo: CodecInfo | null;
  containerInfo: ContainerInfo | null;
  videoCompatibility: Compatibility;
  audioCompatibility: Compatibility;
}

/** Build a full metadata report from raw metadata. */
export function buildReport(metadata: VideoMetadata): MetadataReport {
  const bitrate = calculateBitrate(metadata.fileSizeBytes, metadata.durationSeconds);
  const aspectRatio = computeAspectRatio(metadata.videoWidth, metadata.videoHeight);
  const resolutionLabel = labelResolution(metadata.videoWidth, metadata.videoHeight);
  const frameRatePreset = metadata.frameRate !== undefined
    ? matchFrameRate(metadata.frameRate)
    : null;
  const videoCodecInfo = metadata.videoCodec ? lookupCodec(metadata.videoCodec) : null;
  const audioCodecInfo = metadata.audioCodec ? lookupCodec(metadata.audioCodec) : null;
  const containerInfo = metadata.container !== "unknown" ? CONTAINERS[metadata.container] : null;
  const videoCompatibility = metadata.videoCodec
    ? checkCompatibility(metadata.container, metadata.videoCodec)
    : "unsupported";
  const audioCompatibility = metadata.audioCodec
    ? checkCompatibility(metadata.container, metadata.audioCodec)
    : "unsupported";
  return {
    metadata,
    bitrate,
    aspectRatio,
    resolutionLabel,
    frameRatePreset,
    videoCodecInfo,
    audioCodecInfo,
    containerInfo,
    videoCompatibility,
    audioCompatibility,
  };
}

// ---- Summary stats ----

export interface SummaryStats {
  fileSize: number;
  duration: number;
  bitrate: number;
  width: number;
  height: number;
  codecCount: number;
}

export function computeSummaryStats(report: MetadataReport): SummaryStats {
  let codecCount = 0;
  if (report.metadata.videoCodec) codecCount++;
  if (report.metadata.audioCodec) codecCount++;
  return {
    fileSize: report.metadata.fileSizeBytes,
    duration: report.metadata.durationSeconds,
    bitrate: report.bitrate,
    width: report.metadata.videoWidth,
    height: report.metadata.videoHeight,
    codecCount,
  };
}

// ---- Text report ----

export function renderTextReport(report: MetadataReport): string {
  const m = report.metadata;
  const lines: string[] = [];
  lines.push("=== Video Metadata Report ===");
  lines.push("");
  lines.push("FILE");
  lines.push(`  Name           : ${m.fileName}`);
  lines.push(`  Size           : ${formatFileSize(m.fileSizeBytes)} (${m.fileSizeBytes.toLocaleString()} bytes)`);
  lines.push("");
  lines.push("CONTAINER");
  lines.push(`  Container      : ${m.container.toUpperCase()}`);
  lines.push(`  MIME type      : ${m.mimeType}`);
  if (report.containerInfo) {
    lines.push(`  Description    : ${report.containerInfo.description}`);
  }
  lines.push("");
  lines.push("VIDEO");
  lines.push(`  Resolution     : ${m.videoWidth}×${m.videoHeight}`);
  lines.push(`  Resolution lbl : ${report.resolutionLabel.label} (${report.resolutionLabel.alias})`);
  lines.push(`  Aspect ratio   : ${report.aspectRatio.ratio} (${report.aspectRatio.label})`);
  lines.push(`  Frame rate     : ${m.frameRate !== undefined ? `${formatFrameRate(m.frameRate)} fps` : "unknown"}${report.frameRatePreset ? ` — ${report.frameRatePreset.description}` : ""}`);
  if (m.videoCodec) {
    lines.push(`  Video codec    : ${m.videoCodec}`);
    if (report.videoCodecInfo) {
      lines.push(`  Codec name     : ${report.videoCodecInfo.name}`);
      lines.push(`  Codec desc     : ${report.videoCodecInfo.description}`);
    }
    lines.push(`  Compatibility  : ${COMPATIBILITY_LABELS[report.videoCompatibility]}`);
  } else {
    lines.push("  Video codec    : unknown");
  }
  lines.push("");
  lines.push("AUDIO");
  if (m.audioCodec) {
    lines.push(`  Audio codec    : ${m.audioCodec}`);
    if (report.audioCodecInfo) {
      lines.push(`  Codec name     : ${report.audioCodecInfo.name}`);
      lines.push(`  Codec desc     : ${report.audioCodecInfo.description}`);
    }
    lines.push(`  Compatibility  : ${COMPATIBILITY_LABELS[report.audioCompatibility]}`);
  } else {
    lines.push("  Audio codec    : unknown / not detected");
  }
  lines.push("");
  lines.push("TIMING & RATE");
  lines.push(`  Duration       : ${formatDuration(m.durationSeconds)} (${formatDurationHMS(m.durationSeconds)})`);
  lines.push(`  Bitrate        : ${formatBitrate(report.bitrate)} (${Math.round(report.bitrate).toLocaleString()} bps)`);
  lines.push("");
  lines.push("=== End of report ===");
  return lines.join("\n");
}

// ---- CSV report ----

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function renderCsvReport(report: MetadataReport): string {
  const m = report.metadata;
  const rows: [string, string][] = [
    ["property", "value"],
    ["file_name", m.fileName],
    ["file_size_bytes", String(m.fileSizeBytes)],
    ["file_size_formatted", formatFileSize(m.fileSizeBytes)],
    ["container", m.container],
    ["mime_type", m.mimeType],
    ["video_width", String(m.videoWidth)],
    ["video_height", String(m.videoHeight)],
    ["resolution_label", report.resolutionLabel.label],
    ["resolution_alias", report.resolutionLabel.alias],
    ["aspect_ratio", report.aspectRatio.ratio],
    ["aspect_ratio_label", report.aspectRatio.label],
    ["frame_rate_fps", m.frameRate !== undefined ? formatFrameRate(m.frameRate) : ""],
    ["frame_rate_preset", report.frameRatePreset ? report.frameRatePreset.description : ""],
    ["video_codec", m.videoCodec ?? ""],
    ["video_codec_name", report.videoCodecInfo?.name ?? ""],
    ["video_compatibility", COMPATIBILITY_LABELS[report.videoCompatibility]],
    ["audio_codec", m.audioCodec ?? ""],
    ["audio_codec_name", report.audioCodecInfo?.name ?? ""],
    ["audio_compatibility", COMPATIBILITY_LABELS[report.audioCompatibility]],
    ["duration_seconds", m.durationSeconds.toString()],
    ["duration_formatted", formatDuration(m.durationSeconds)],
    ["duration_hms", formatDurationHMS(m.durationSeconds)],
    ["bitrate_bps", String(Math.round(report.bitrate))],
    ["bitrate_formatted", formatBitrate(report.bitrate)],
  ];
  return rows.map(([k, v]) => `${escapeCsv(k)},${escapeCsv(v)}`).join("\n");
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:video-metadata-viewer:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  fileName: string;
  fileSizeBytes: number;
  container: VideoContainer;
  durationSeconds: number;
  width: number;
  height: number;
  videoCodec?: string;
  audioCodec?: string;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---- Shareable URL ----

export interface ShareSettings {
  fileName: string;
  fileSizeBytes: number;
  container: VideoContainer;
  durationSeconds: number;
  width: number;
  height: number;
  videoCodec: string;
  audioCodec: string;
}

export function buildShareUrl(s: ShareSettings): string {
  const params = new URLSearchParams();
  if (s.fileName) params.set("name", s.fileName);
  if (s.fileSizeBytes > 0) params.set("size", String(s.fileSizeBytes));
  if (s.container && s.container !== "unknown") params.set("c", s.container);
  if (s.durationSeconds > 0) params.set("dur", String(s.durationSeconds));
  if (s.width > 0) params.set("w", String(s.width));
  if (s.height > 0) params.set("h", String(s.height));
  if (s.videoCodec) params.set("vcodec", s.videoCodec);
  if (s.audioCodec) params.set("acodec", s.audioCodec);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareSettings> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ShareSettings> = {};
  const name = params.get("name");
  if (name) out.fileName = name;
  const size = params.get("size");
  if (size !== null) {
    const n = Number(size);
    if (Number.isFinite(n) && n > 0) out.fileSizeBytes = n;
  }
  const c = params.get("c");
  if (c && (c === "mp4" || c === "webm" || c === "ogg" || c === "mov" || c === "avi" || c === "mkv" || c === "flv")) {
    out.container = c as VideoContainer;
  }
  const dur = params.get("dur");
  if (dur !== null) {
    const n = Number(dur);
    if (Number.isFinite(n) && n > 0) out.durationSeconds = n;
  }
  const w = params.get("w");
  if (w !== null) {
    const n = Number(w);
    if (Number.isFinite(n) && n > 0) out.width = n;
  }
  const h = params.get("h");
  if (h !== null) {
    const n = Number(h);
    if (Number.isFinite(n) && n > 0) out.height = n;
  }
  const vcodec = params.get("vcodec");
  if (vcodec) out.videoCodec = vcodec;
  const acodec = params.get("acodec");
  if (acodec) out.audioCodec = acodec;
  return out;
}

// ---- Filename helper (extract extension) ----

/** Get the lowercased file extension without the leading dot. */
export function getFileExtension(fileName: string): string {
  if (!fileName) return "";
  const idx = fileName.lastIndexOf(".");
  if (idx < 0 || idx === fileName.length - 1) return "";
  return fileName.slice(idx + 1).toLowerCase();
}
