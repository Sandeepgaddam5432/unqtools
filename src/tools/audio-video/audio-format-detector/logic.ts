/**
 * Audio Format Detector — pure logic.
 *
 * Pure helpers only — no DOM, no fetch, no AudioContext. The UI reads the
 * first 64 bytes of a dropped file and passes them to `detectFormat`. This
 * module contains: the magic-bytes lookup table (15+ formats), MIME type
 * lookup, file-extension lookup, container info lookup, per-format header
 * parsers (sample rate / channels / bit depth / duration), bit-depth &
 * channel-layout tables, a format comparison table, closest-match
 * suggestion, confidence scoring, text/CSV/JSON renderers, history
 * (localStorage), shareable URL, and summary stats.
 */

// ---- Format IDs ----

export type AudioFormatId =
  | "mp3"
  | "wav"
  | "flac"
  | "ogg"
  | "m4a"      // AAC in MP4 container (also covers M4B)
  | "wma"      // ASF container
  | "aiff"
  | "alac"     // ALAC inside MP4 container
  | "opus"     // Opus inside OGG container
  | "ape"      // Monkey's Audio
  | "tta"
  | "wavpack"
  | "speex"    // Speex inside OGG container
  | "amr"
  | "3gp";

export type CompressionType = "lossless" | "lossy";

export interface ContainerInfo {
  format: AudioFormatId;
  codec: string;
  container: string;
  compression: CompressionType;
  typicalUse: string;
}

export interface MagicByteRule {
  format: AudioFormatId;
  /** Display name shown in the UI. */
  label: string;
  /** Byte sequence to match at the given offset. */
  bytes: number[];
  /** Byte offset from the start of the file (default 0). */
  offset: number;
  /**
   * Optional secondary matcher for formats that need two checks (e.g. AIFF
   * needs both "FORM" at 0 and "AIFF" at 8; WMA needs the ASF GUID).
   */
  andBytes?: number[];
  andOffset?: number;
  /** Optional alternative matcher (e.g. MP3 frame sync). */
  altBytes?: number[];
  altOffset?: number;
  /** Whether the alt matcher uses a mask (e.g. MP3 frame sync 0xFFEx). */
  altMask?: number[];
  /** If true, scan all positions in first 64 bytes for `bytes` (not just at offset). */
  scan?: boolean;
}

// ---- Magic-bytes lookup table (15+ formats) ----

export const MAGIC_BYTES: MagicByteRule[] = [
  {
    format: "mp3",
    label: "MP3",
    bytes: [0x49, 0x44, 0x33], offset: 0, // "ID3"
    altBytes: [0xff, 0xe0], altOffset: 0, altMask: [0xff, 0xe0], // frame sync 0xFFEx
  },
  {
    format: "wav",
    label: "WAV",
    bytes: [0x52, 0x49, 0x46, 0x46], offset: 0, // "RIFF"
    andBytes: [0x57, 0x41, 0x56, 0x45], andOffset: 8, // "WAVE"
  },
  {
    format: "flac",
    label: "FLAC",
    bytes: [0x66, 0x4c, 0x61, 0x43], offset: 0, // "fLaC"
  },
  {
    format: "ogg",
    label: "OGG (Vorbis)",
    bytes: [0x4f, 0x67, 0x67, 0x53], offset: 0, // "OggS"
  },
  {
    format: "m4a",
    label: "M4A / AAC (MP4)",
    bytes: [0x66, 0x74, 0x79, 0x70], offset: 4, // "ftyp" at offset 4
    andBytes: [0x4d, 0x34, 0x41], andOffset: 8, // "M4A" at offset 8
  },
  {
    format: "wma",
    label: "WMA (ASF)",
    bytes: [0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11], offset: 0,
    andBytes: [0xa6, 0xd9, 0x00, 0xaa, 0x00, 0x62, 0xce, 0x6c], andOffset: 16,
  },
  {
    format: "aiff",
    label: "AIFF",
    bytes: [0x46, 0x4f, 0x52, 0x4d], offset: 0, // "FORM"
    andBytes: [0x41, 0x49, 0x46, 0x46], andOffset: 8, // "AIFF"
  },
  {
    format: "alac",
    label: "ALAC (MP4)",
    bytes: [0x66, 0x74, 0x79, 0x70], offset: 4, // "ftyp"
    andBytes: [0x6d, 0x70, 0x34, 0x32], andOffset: 8, // "mp42" (could be M4A too — ALAC detection also checks for alac atom later)
  },
  {
    format: "opus",
    label: "Opus (OGG)",
    bytes: [0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64], offset: 0, scan: true, // "OpusHead" anywhere
  },
  {
    format: "ape",
    label: "APE (Monkey's Audio)",
    bytes: [0x4d, 0x41, 0x43, 0x20], offset: 0, // "MAC "
  },
  {
    format: "tta",
    label: "TTA",
    bytes: [0x54, 0x54, 0x41, 0x31], offset: 0, // "TTA1"
  },
  {
    format: "wavpack",
    label: "WavPack",
    bytes: [0x77, 0x76, 0x70, 0x6b], offset: 0, // "wvpk"
  },
  {
    format: "speex",
    label: "Speex (OGG)",
    bytes: [0x53, 0x70, 0x65, 0x65, 0x78], offset: 0, scan: true, // "Speex" anywhere
  },
  {
    format: "amr",
    label: "AMR",
    bytes: [0x23, 0x21, 0x41, 0x4d, 0x52], offset: 0, // "#!AMR"
  },
  {
    format: "3gp",
    label: "3GP",
    bytes: [0x66, 0x74, 0x79, 0x70], offset: 4, // "ftyp"
    andBytes: [0x33, 0x67, 0x70], andOffset: 8, // "3gp"
  },
];

// ---- MIME types ----

export const FORMAT_MIME_TYPES: Record<AudioFormatId, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  flac: "audio/flac",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  wma: "audio/x-ms-wma",
  aiff: "audio/aiff",
  alac: "audio/mp4",
  opus: "audio/ogg",
  ape: "audio/x-ape",
  tta: "audio/x-tta",
  wavpack: "audio/x-wavpack",
  speex: "audio/ogg",
  amr: "audio/amr",
  "3gp": "audio/3gpp",
};

// ---- File extensions ----

export const FORMAT_EXTENSIONS: Record<AudioFormatId, string> = {
  mp3: "mp3",
  wav: "wav",
  flac: "flac",
  ogg: "ogg",
  m4a: "m4a",
  wma: "wma",
  aiff: "aiff",
  alac: "m4a",
  opus: "opus",
  ape: "ape",
  tta: "tta",
  wavpack: "wv",
  speex: "spx",
  amr: "amr",
  "3gp": "3gp",
};

// ---- Container info ----

export const FORMAT_CONTAINER_INFO: Record<AudioFormatId, ContainerInfo> = {
  mp3:   { format: "mp3",   codec: "MPEG-1 Audio Layer III", container: "MPEG",        compression: "lossy",     typicalUse: "Music distribution, podcasts" },
  wav:   { format: "wav",   codec: "PCM (uncompressed)",     container: "RIFF/WAVE",  compression: "lossless",  typicalUse: "Audio mastering, archival" },
  flac:  { format: "flac",  codec: "Free Lossless Audio",    container: "Native FLAC",compression: "lossless",  typicalUse: "Hi-fi music archival" },
  ogg:   { format: "ogg",   codec: "Vorbis",                 container: "Ogg",         compression: "lossy",     typicalUse: "Open-source streaming" },
  m4a:   { format: "m4a",   codec: "AAC",                    container: "MP4/M4A",     compression: "lossy",     typicalUse: "Apple ecosystem, streaming" },
  wma:   { format: "wma",   codec: "Windows Media Audio",    container: "ASF",         compression: "lossy",     typicalUse: "Windows Media ecosystem" },
  aiff:  { format: "aiff",  codec: "PCM (uncompressed)",     container: "AIFF",        compression: "lossless",  typicalUse: "Pro audio, macOS" },
  alac:  { format: "alac",  codec: "Apple Lossless",         container: "MP4",         compression: "lossless",  typicalUse: "Apple hi-fi archival" },
  opus:  { format: "opus",  codec: "Opus",                   container: "Ogg",         compression: "lossy",     typicalUse: "Real-time voice/music streaming" },
  ape:   { format: "ape",   codec: "Monkey's Audio",         container: "MAC",         compression: "lossless",  typicalUse: "High-ratio lossless archival" },
  tta:   { format: "tta",   codec: "True Audio",             container: "TTA",         compression: "lossless",  typicalUse: "Lossless compression" },
  wavpack:{format: "wavpack",codec: "WavPack",               container: "WavPack",     compression: "lossless",  typicalUse: "Hybrid lossless/lossy" },
  speex: { format: "speex", codec: "Speex",                  container: "Ogg",         compression: "lossy",     typicalUse: "Voice over IP" },
  amr:   { format: "amr",   codec: "Adaptive Multi-Rate",    container: "AMR",         compression: "lossy",     typicalUse: "Mobile voice (3GPP)" },
  "3gp": { format: "3gp",   codec: "AAC/AMR",                container: "3GP/MP4",     compression: "lossy",     typicalUse: "Mobile multimedia" },
};

// ---- Bit depth lookup ----

export type BitDepthId = "8" | "16" | "24" | "32" | "32-float";

export interface BitDepthInfo {
  id: BitDepthId;
  bits: number;
  format: "int" | "float";
  label: string;
  dbRange: string;
}

export const BIT_DEPTHS: BitDepthInfo[] = [
  { id: "8",        bits: 8,  format: "int",   label: "8-bit (PCM)",         dbRange: "≈ 48 dB" },
  { id: "16",       bits: 16, format: "int",   label: "16-bit (CD quality)",dbRange: "≈ 96 dB" },
  { id: "24",       bits: 24, format: "int",   label: "24-bit (Studio)",    dbRange: "≈ 144 dB" },
  { id: "32",       bits: 32, format: "int",   label: "32-bit (integer)",   dbRange: "≈ 192 dB" },
  { id: "32-float", bits: 32, format: "float", label: "32-bit float",       dbRange: "≈ 1500 dB" },
];

export function getBitDepthInfo(id: BitDepthId): BitDepthInfo {
  return BIT_DEPTHS.find((b) => b.id === id) ?? BIT_DEPTHS[1];
}

// ---- Channel layout lookup ----

export type ChannelLayoutId = "mono" | "stereo" | "5.1" | "7.1";

export interface ChannelLayoutInfo {
  id: ChannelLayoutId;
  channels: number;
  label: string;
  description: string;
}

export const CHANNEL_LAYOUTS: ChannelLayoutInfo[] = [
  { id: "mono",   channels: 1, label: "Mono (1.0)",        description: "Single channel — voice, AM radio" },
  { id: "stereo", channels: 2, label: "Stereo (2.0)",      description: "Left + right — music, podcasts" },
  { id: "5.1",    channels: 6, label: "Surround 5.1",      description: "L,R,C,LFE,RL,RR — cinema/DVD" },
  { id: "7.1",    channels: 8, label: "Surround 7.1",      description: "L,R,C,LFE,RL,RR,SL,SR — Blu-ray" },
];

export function getChannelLayout(id: ChannelLayoutId): ChannelLayoutInfo {
  return CHANNEL_LAYOUTS.find((c) => c.id === id) ?? CHANNEL_LAYOUTS[1];
}

// ---- Format comparison table ----

export interface ComparisonRow {
  format: AudioFormatId;
  label: string;
  compression: CompressionType;
  typicalBitrate: string;
  typicalUse: string;
}

export function getComparisonTable(): ComparisonRow[] {
  return MAGIC_BYTES.map((r) => {
    const info = FORMAT_CONTAINER_INFO[r.format];
    const bitrates: Record<AudioFormatId, string> = {
      mp3: "128–320 kbps",
      wav: "1411 kbps (CD)",
      flac: "800–1000 kbps",
      ogg: "64–500 kbps",
      m4a: "64–256 kbps",
      wma: "64–192 kbps",
      aiff: "1411 kbps (CD)",
      alac: "800–1000 kbps",
      opus: "24–510 kbps",
      ape: "700–1000 kbps",
      tta: "700–1000 kbps",
      wavpack: "600–1000 kbps",
      speex: "2.4–44 kbps",
      amr: "4.75–12.2 kbps",
      "3gp": "5–64 kbps",
    };
    return {
      format: r.format,
      label: r.label,
      compression: info.compression,
      typicalBitrate: bitrates[r.format],
      typicalUse: info.typicalUse,
    };
  });
}

// ---- Detection helpers ----

function bytesAt(bytes: Uint8Array, offset: number, target: number[]): boolean {
  if (offset + target.length > bytes.length) return false;
  for (let i = 0; i < target.length; i++) {
    if (bytes[offset + i] !== target[i]) return false;
  }
  return true;
}

function bytesAtMasked(bytes: Uint8Array, offset: number, target: number[], mask: number[]): boolean {
  if (offset + target.length > bytes.length) return false;
  for (let i = 0; i < target.length; i++) {
    if ((bytes[offset + i] & mask[i]) !== target[i]) return false;
  }
  return true;
}

/** Scan for a byte sequence anywhere in the first N bytes. */
function scanFor(bytes: Uint8Array, target: number[], maxBytes = 64): boolean {
  const limit = Math.min(bytes.length, maxBytes) - target.length;
  for (let i = 0; i <= limit; i++) {
    if (bytesAt(bytes, i, target)) return true;
  }
  return false;
}

/** Match a single rule against the bytes. Returns confidence 0–100. */
export function matchRule(rule: MagicByteRule, bytes: Uint8Array): number {
  // Primary matcher (scan-based or fixed offset)
  const primary = rule.scan
    ? scanFor(bytes, rule.bytes)
    : bytesAt(bytes, rule.offset, rule.bytes);
  // And-clause (required with primary)
  const andOk = rule.andBytes
    ? (rule.andOffset !== undefined && bytesAt(bytes, rule.andOffset, rule.andBytes))
    : true;
  // Alternative matcher (optional)
  const altOk = rule.altBytes
    ? (rule.altOffset !== undefined && (
        rule.altMask
          ? bytesAtMasked(bytes, rule.altOffset, rule.altBytes, rule.altMask)
          : bytesAt(bytes, rule.altOffset, rule.altBytes)
      ))
    : false;

  if (primary && andOk) {
    // Strong match — confidence 100 unless alt was also expected
    return rule.altBytes ? 90 : 100;
  }
  if (primary && !rule.andBytes) {
    // Primary alone — still strong
    return rule.scan ? 80 : 90;
  }
  if (altOk) {
    // Alternative matcher alone (e.g. MP3 frame sync without ID3)
    return 75;
  }
  if (primary && !andOk && rule.andBytes) {
    // Primary matched but secondary clause did not — partial match
    return 50;
  }
  return 0;
}

export interface FormatDetectionResult {
  format: AudioFormatId | "unknown";
  label: string;
  confidence: number;            // 0–100
  mimeType: string | null;
  extension: string | null;
  containerInfo: ContainerInfo | null;
  technical: TechnicalDetails;
  magicBytesHex: string;         // first 64 bytes as hex
  closestMatches: { format: AudioFormatId; label: string; confidence: number }[];
}

export interface TechnicalDetails {
  sampleRate?: number;
  channels?: number;
  bitDepth?: number;
  durationSeconds?: number;
  /** Any extra notes extracted from the header (e.g. "MPEG-1 Layer III"). */
  notes?: string;
}

/** Detect the audio format from the first N bytes of a file. */
export function detectFormat(bytes: Uint8Array): FormatDetectionResult {
  const magicBytesHex = toHex(bytes, 64);
  let best: { rule: MagicByteRule; score: number } | null = null;
  const allMatches: { format: AudioFormatId; label: string; confidence: number }[] = [];

  for (const rule of MAGIC_BYTES) {
    const score = matchRule(rule, bytes);
    if (score > 0) {
      allMatches.push({ format: rule.format, label: rule.label, confidence: score });
      if (!best || score > best.score) best = { rule, score };
    }
  }

  // For OGG + Opus/Speex overlap: opus/speex use scan-based rules that
  // match the codec signature anywhere in the first 64 bytes. If they match
  // (score 80) we prefer them over the generic OGG rule (score 100) since
  // they're more specific. But if Opus/Speex didn't match, OGG remains the
  // result. The `best` selection already takes the higher score, so for OGG
  // + Opus we'd actually keep OGG (100 > 80). Override here:
  if (best && best.rule.format === "ogg") {
    const opusMatch = allMatches.find((m) => m.format === "opus");
    const speexMatch = allMatches.find((m) => m.format === "speex");
    if (opusMatch) best = { rule: MAGIC_BYTES.find((r) => r.format === "opus")!, score: opusMatch.confidence };
    else if (speexMatch) best = { rule: MAGIC_BYTES.find((r) => r.format === "speex")!, score: speexMatch.confidence };
  }

  if (!best) {
    return {
      format: "unknown",
      label: "Unknown format",
      confidence: 0,
      mimeType: null,
      extension: null,
      containerInfo: null,
      technical: {},
      magicBytesHex,
      closestMatches: closestMatches(bytes),
    };
  }

  const rule = best.rule;
  const format = rule.format;
  const technical = parseHeader(format, bytes);
  return {
    format,
    label: rule.label,
    confidence: best.score,
    mimeType: FORMAT_MIME_TYPES[format],
    extension: FORMAT_EXTENSIONS[format],
    containerInfo: FORMAT_CONTAINER_INFO[format],
    technical,
    magicBytesHex,
    closestMatches: allMatches
      .filter((m) => m.format !== format)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3),
  };
}

/** Closest-match suggestion for unknown formats — overlap score. */
export function closestMatches(bytes: Uint8Array): { format: AudioFormatId; label: string; confidence: number }[] {
  const out: { format: AudioFormatId; label: string; confidence: number }[] = [];
  for (const rule of MAGIC_BYTES) {
    const score = matchRule(rule, bytes);
    if (score > 0) {
      out.push({ format: rule.format, label: rule.label, confidence: score });
    }
  }
  return out.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}

export function getMimeType(format: AudioFormatId): string {
  return FORMAT_MIME_TYPES[format];
}

export function getExtension(format: AudioFormatId): string {
  return FORMAT_EXTENSIONS[format];
}

export function getContainerInfo(format: AudioFormatId): ContainerInfo {
  return FORMAT_CONTAINER_INFO[format];
}

// ---- Per-format header parsers ----

/**
 * Parse format-specific header to extract technical details. Returns partial
 * details (whatever is reliably extractable from the first 64 bytes).
 */
export function parseHeader(format: AudioFormatId, bytes: Uint8Array): TechnicalDetails {
  switch (format) {
    case "wav": return parseWavHeader(bytes);
    case "flac": return parseFlacHeader(bytes);
    case "aiff": return parseAiffHeader(bytes);
    case "mp3": return parseMp3Header(bytes);
    case "ogg":
    case "opus":
    case "speex": return parseOggHeader(bytes);
    case "amr": return { sampleRate: 8000, channels: 1, bitDepth: 16, notes: "AMR-NB (narrowband)" };
    case "ape": return { notes: "APE v1/v2 header — sample rate parsed later in stream" };
    case "tta": return parseTtaHeader(bytes);
    case "wavpack": return parseWavPackHeader(bytes);
    case "m4a":
    case "alac":
    case "3gp": return { notes: "MP4 container — codec specifics parsed from moov atom (not in first 64 bytes)" };
    case "wma": return { notes: "ASF container — codec parsed from Stream Properties Object" };
    default: return {};
  }
}

/** Parse a RIFF/WAVE header for sample rate, channels, bit depth. */
export function parseWavHeader(bytes: Uint8Array): TechnicalDetails {
  // find fmt  sub-chunk
  if (bytes.length < 44) return {};
  // Standard WAV: fmt chunk at offset 12, size 16, audio format 22, channels 22, sampleRate 24, bitsPerSample 34
  // Verify "fmt " marker at offset 12
  if (!bytesAt(bytes, 12, [0x66, 0x6d, 0x74, 0x20])) return { notes: "RIFF/WAVE but fmt chunk not at standard offset" };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const channels = view.getUint16(22, true);
  const sampleRate = view.getUint32(24, true);
  const bitsPerSample = view.getUint16(34, true);
  const audioFormat = view.getUint16(20, true); // 1 = PCM, 3 = IEEE float
  const notes = audioFormat === 1 ? "PCM integer" : audioFormat === 3 ? "IEEE float" : audioFormat === 0xfffe ? "Extensible" : `format code ${audioFormat}`;
  return { sampleRate, channels, bitDepth: bitsPerSample, notes };
}

/** Parse FLAC STREAMINFO block (starts at offset 4 with metadata block header). */
export function parseFlacHeader(bytes: Uint8Array): TechnicalDetails {
  // fLaC (4 bytes) + metadata block header (4 bytes: 1 byte type+last flag, 3 bytes length)
  if (bytes.length < 4 + 4 + 18) return { notes: "FLAC marker found but STREAMINFO truncated" };
  if (bytes[4] !== 0) return { notes: "First FLAC metadata block is not STREAMINFO" };
  // STREAMINFO is 34 bytes: min_block_size(2) max_block_size(2) min_frame_size(3) max_frame_size(3)
  //   sampleRate(20 bits) channels(3) bitsPerSample(5) totalSamples(36) md5(16)
  // We have only 64 bytes total, so we have offsets 4..33 → STREAMINFO at offset 8..41
  // Sample rate is at offset 18 (in STREAMINFO block which starts at offset 8 → absolute offset 8+10 = 18)
  // Build a 4-byte view: bytes[18..21] → sampleRate = (b0 << 12) | (b1 << 4) | (b2 >> 4)
  if (bytes.length < 22) return { notes: "FLAC STREAMINFO truncated" };
  const b0 = bytes[18];
  const b1 = bytes[19];
  const b2 = bytes[20];
  const sampleRate = (b0 << 12) | (b1 << 4) | (b2 >> 4);
  const channels = ((b2 >> 1) & 0x07) + 1;
  const bitsPerSample = (((b2 & 0x01) << 4) | (bytes[21] >> 4)) + 1;
  return { sampleRate, channels, bitDepth: bitsPerSample, notes: "FLAC STREAMINFO" };
}

/** Parse an AIFF FORM/AIFF header. Sample rate is encoded as 80-bit IEEE 754 extended. */
export function parseAiffHeader(bytes: Uint8Array): TechnicalDetails {
  // FORM(4) size(4) AIFF(4) COMM chunk...
  if (bytes.length < 12) return {};
  if (!bytesAt(bytes, 8, [0x41, 0x49, 0x46, 0x46])) return { notes: "FORM found but not AIFF" };
  // COMM chunk starts at offset 12 — but we only have 64 bytes, COMM header is 26 bytes
  if (bytes.length < 12 + 4 + 4) return { notes: "AIFF container — COMM chunk truncated" };
  // Find "COMM"
  if (bytesAt(bytes, 12, [0x43, 0x4f, 0x4d, 0x4d])) {
    // COMM size (4 bytes big-endian), numChannels (2 bytes BE), numSampleFrames (4 bytes BE),
    // sampleSize (2 bytes BE), sampleRate (10 bytes IEEE 80-bit extended)
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const channels = view.getUint16(20, false); // big-endian
    const bitDepth = view.getUint16(26, false);
    const sampleRate = ieee80ToNumber(bytes.subarray(28, 38));
    return { sampleRate, channels, bitDepth, notes: "AIFF COMM" };
  }
  return { notes: "AIFF container — COMM chunk not at expected offset" };
}

/** Parse an MP3 frame header (after ID3, if any). */
export function parseMp3Header(bytes: Uint8Array): TechnicalDetails {
  // Skip ID3v2 if present
  let offset = 0;
  if (bytesAt(bytes, 0, [0x49, 0x44, 0x33])) {
    // ID3v2 size at offset 6..9 (syncsafe)
    if (bytes.length < 10) return { notes: "ID3v2 marker but truncated" };
    const sz = (bytes[6] << 21) | (bytes[7] << 14) | (bytes[8] << 7) | bytes[9];
    offset = 10 + sz;
  }
  // Find a frame sync 0xFFEx within first 64 bytes
  for (let i = offset; i < bytes.length - 4; i++) {
    if ((bytes[i] & 0xff) === 0xff && (bytes[i + 1] & 0xe0) === 0xe0) {
      // MPEG version + layer
      const versionBits = (bytes[i + 1] >> 3) & 0x03; // 00 = MPEG2.5, 01 = reserved, 10 = MPEG2, 11 = MPEG1
      const layerBits = (bytes[i + 1] >> 1) & 0x03; // 01 = Layer III, 10 = Layer II, 11 = Layer I
      const sampleRateBits = (bytes[i + 2] >> 2) & 0x03;
      const channelMode = (bytes[i + 3] >> 6) & 0x03;
      const versionLabel = versionBits === 3 ? "MPEG-1" : versionBits === 2 ? "MPEG-2" : versionBits === 0 ? "MPEG-2.5" : "reserved";
      const layerLabel = layerBits === 1 ? "Layer III" : layerBits === 2 ? "Layer II" : layerBits === 3 ? "Layer I" : "reserved";
      // Sample rate tables
      const sr1 = [44100, 48000, 32000, 0];
      const sr2 = [22050, 24000, 16000, 0];
      const sr25 = [11025, 12000, 8000, 0];
      let sampleRate = 0;
      if (versionBits === 3) sampleRate = sr1[sampleRateBits];
      else if (versionBits === 2) sampleRate = sr2[sampleRateBits];
      else if (versionBits === 0) sampleRate = sr25[sampleRateBits];
      const channels = channelMode === 3 ? 1 : 2;
      return {
        sampleRate: sampleRate > 0 ? sampleRate : undefined,
        channels,
        notes: `${versionLabel} ${layerLabel}`,
      };
    }
  }
  return { notes: "ID3 detected but no MPEG frame sync in first 64 bytes" };
}

/** Parse an OGG page header (very basic — sample rate is in the codec-specific header later). */
export function parseOggHeader(bytes: Uint8Array): TechnicalDetails {
  // OggS (4) + version (1) + flags (1) + granule (8) + serial (4) + seq (4) + checksum (4) + segments (1) + segtable
  if (bytes.length < 27) return {};
  // Look for codec identifier in second OGG page (within first 64 bytes)
  // Vorbis: "\x01vorbis"  Opus: "OpusHead"  Speex: "Speex   "
  for (let i = 0; i < bytes.length - 7; i++) {
    if (bytesAt(bytes, i, [0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64])) {
      return { notes: "OpusHead found — Opus codec, sample rate parsed later in packet" };
    }
    if (bytesAt(bytes, i, [0x53, 0x70, 0x65, 0x65, 0x78])) {
      return { notes: "Speex header found — Speex codec" };
    }
    if (bytesAt(bytes, i, [0x01, 0x76, 0x6f, 0x72, 0x62, 0x69, 0x73])) {
      return { notes: "Vorbis identification header — Vorbis codec" };
    }
  }
  return { notes: "OggS container detected" };
}

/** Parse a TTA1 header. */
export function parseTtaHeader(bytes: Uint8Array): TechnicalDetails {
  // TTA1 (4) + format (2) + channels (2) + bitsPerSample (2) + sampleRate (4) + ...
  // → channels at offset 6, bitsPerSample at offset 8, sampleRate at offset 10
  if (bytes.length < 14) return {};
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const channels = view.getUint16(6, false);
  const bitsPerSample = view.getUint16(8, false);
  const sampleRate = view.getUint32(10, false);
  return { sampleRate, channels, bitDepth: bitsPerSample, notes: "TTA1 header" };
}

/** Parse a WavPack header. */
export function parseWavPackHeader(bytes: Uint8Array): TechnicalDetails {
  // wvpk (4) + blockSize (4) + version (2) + trackNo (1) + idxNo (1) + totalSamples (4) + blockIdx (4) + flags (4) + crc (4) + ...
  // flags field is at offset 20 (LE uint32).
  if (bytes.length < 24) return { notes: "WavPack block header (truncated)" };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const flags = view.getUint32(20, true);
  // bits 0-1: bytes per sample (0=16, 1=24, 2=32, 3=float)
  // bit 2: stereo flag (1 = stereo, 0 = mono)
  // bits 23-26: sample rate index (4-bit, 0=unknown, 1-15 map to a table)
  const bpsField = flags & 0x03;
  const bitsPerSample = bpsField === 0 ? 16 : bpsField === 1 ? 24 : bpsField === 2 ? 32 : 32;
  const isFloat = bpsField === 3;
  const channels = (flags & 0x04) ? 2 : 1;
  const rateIdx = (flags >> 23) & 0x0f;
  const sr = [-1, 6000, 8000, 9600, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000, 64000, 88200, 96000, 192000];
  const sampleRate = rateIdx > 0 && rateIdx < sr.length ? sr[rateIdx] : undefined;
  return {
    sampleRate,
    channels,
    bitDepth: bitsPerSample,
    notes: isFloat ? "WavPack float block header" : "WavPack block header",
  };
}

// ---- IEEE 80-bit extended → number (for AIFF sample rate) ----

function ieee80ToNumber(bytes: Uint8Array): number | undefined {
  if (bytes.length < 10) return undefined;
  const sign = (bytes[0] & 0x80) !== 0;
  const exponent = ((bytes[0] & 0x7f) << 8) | bytes[1];
  if (exponent === 0) return 0;
  // Mantissa: 64-bit big-endian at bytes[2..9], with explicit integer bit
  // (80-bit extended has the integer bit explicitly stored, unlike
  // double/single). We only need the high 32 bits for typical sample rates.
  const hi = ((bytes[2] << 24) | (bytes[3] << 16) | (bytes[4] << 8) | bytes[5]) >>> 0;
  // value = hi * 2^(exponent - bias - 31)
  //   because: full mantissa = hi * 2^32 + lo, and value = mantissa * 2^(exp - bias - 63)
  //   so the high 32 bits contribute hi * 2^32 * 2^(exp - bias - 63) = hi * 2^(exp - bias - 31)
  const bias = 16383;
  let value = hi * Math.pow(2, exponent - bias - 31);
  if (sign) value = -value;
  return Math.round(value);
}

// ---- Hex helpers ----

export function toHex(bytes: Uint8Array, maxBytes = 64): string {
  const out: string[] = [];
  const n = Math.min(bytes.length, maxBytes);
  for (let i = 0; i < n; i++) {
    out.push(bytes[i].toString(16).padStart(2, "0"));
  }
  return out.join(" ");
}

export function toAsciiPreview(bytes: Uint8Array, maxBytes = 64): string {
  let out = "";
  const n = Math.min(bytes.length, maxBytes);
  for (let i = 0; i < n; i++) {
    const b = bytes[i];
    out += b >= 32 && b < 127 ? String.fromCharCode(b) : ".";
  }
  return out;
}

// ---- Renderers ----

export function renderTextReport(result: FormatDetectionResult): string {
  const lines: string[] = [];
  lines.push("=== Audio Format Detection Report ===");
  lines.push(`Format:       ${result.label}${result.format === "unknown" ? "" : ` (${result.format})`}`);
  lines.push(`Confidence:   ${result.confidence}%`);
  lines.push(`MIME type:    ${result.mimeType ?? "n/a"}`);
  lines.push(`Extension:    ${result.extension ?? "n/a"}`);
  if (result.containerInfo) {
    lines.push("");
    lines.push("--- Container ---");
    lines.push(`Codec:        ${result.containerInfo.codec}`);
    lines.push(`Container:    ${result.containerInfo.container}`);
    lines.push(`Compression:  ${result.containerInfo.compression}`);
    lines.push(`Typical use:  ${result.containerInfo.typicalUse}`);
  }
  if (result.technical && Object.keys(result.technical).length > 0) {
    lines.push("");
    lines.push("--- Technical details ---");
    const t = result.technical;
    if (t.sampleRate !== undefined) lines.push(`Sample rate:  ${t.sampleRate} Hz`);
    if (t.channels !== undefined) lines.push(`Channels:     ${t.channels}`);
    if (t.bitDepth !== undefined) lines.push(`Bit depth:    ${t.bitDepth} bits`);
    if (t.durationSeconds !== undefined) lines.push(`Duration:     ${t.durationSeconds.toFixed(2)} s`);
    if (t.notes) lines.push(`Notes:        ${t.notes}`);
  }
  if (result.closestMatches.length > 0) {
    lines.push("");
    lines.push("--- Closest matches ---");
    for (const m of result.closestMatches) {
      lines.push(`  ${m.label}: ${m.confidence}%`);
    }
  }
  lines.push("");
  lines.push("--- Magic bytes (first 64 bytes) ---");
  lines.push(`Hex:   ${result.magicBytesHex}`);
  lines.push(`ASCII: ${toAsciiPreview(hexToBytes(result.magicBytesHex))}`);
  return lines.join("\n");
}

export function renderCsvReport(result: FormatDetectionResult): string {
  const rows: [string, string][] = [
    ["property", "value"],
    ["format", result.label],
    ["format_id", result.format],
    ["confidence_pct", String(result.confidence)],
    ["mime_type", result.mimeType ?? ""],
    ["extension", result.extension ?? ""],
    ["codec", result.containerInfo?.codec ?? ""],
    ["container", result.containerInfo?.container ?? ""],
    ["compression", result.containerInfo?.compression ?? ""],
    ["typical_use", result.containerInfo?.typicalUse ?? ""],
    ["sample_rate_hz", result.technical.sampleRate !== undefined ? String(result.technical.sampleRate) : ""],
    ["channels", result.technical.channels !== undefined ? String(result.technical.channels) : ""],
    ["bit_depth", result.technical.bitDepth !== undefined ? String(result.technical.bitDepth) : ""],
    ["duration_seconds", result.technical.durationSeconds !== undefined ? result.technical.durationSeconds.toFixed(3) : ""],
    ["notes", result.technical.notes ?? ""],
    ["magic_bytes_hex", result.magicBytesHex],
  ];
  return rows.map(([k, v]) => `${escapeCsv(k)},${escapeCsv(v)}`).join("\n");
}

export function renderJsonReport(result: FormatDetectionResult): string {
  return JSON.stringify(result, null, 2);
}

function escapeCsv(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function hexToBytes(hex: string): Uint8Array {
  const parts = hex.split(/\s+/).filter(Boolean);
  return new Uint8Array(parts.map((p) => parseInt(p, 16)));
}

// ---- Summary stats ----

export interface SummaryStats {
  format: string;
  formatId: string;
  confidence: number;
  mimeType: string | null;
  extension: string | null;
  sampleRate: number | null;
  channels: number | null;
  bitDepth: number | null;
}

export function computeSummaryStats(result: FormatDetectionResult): SummaryStats {
  return {
    format: result.label,
    formatId: result.format,
    confidence: result.confidence,
    mimeType: result.mimeType,
    extension: result.extension,
    sampleRate: result.technical.sampleRate ?? null,
    channels: result.technical.channels ?? null,
    bitDepth: result.technical.bitDepth ?? null,
  };
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:audio-format-detector:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  fileName: string;
  fileSize: number;
  format: AudioFormatId | "unknown";
  label: string;
  confidence: number;
  mimeType: string | null;
  extension: string | null;
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
  format: string;
  confidence: string;
  mime: string;
}

export function buildShareUrl(settings: ShareSettings): string {
  const params = new URLSearchParams();
  if (settings.format) params.set("format", settings.format);
  if (settings.confidence) params.set("confidence", settings.confidence);
  if (settings.mime) params.set("mime", settings.mime);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareSettings> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ShareSettings> = {};
  const fmt = params.get("format");
  if (fmt) out.format = fmt;
  const conf = params.get("confidence");
  if (conf) out.confidence = conf;
  const mime = params.get("mime");
  if (mime) out.mime = mime;
  return out;
}
