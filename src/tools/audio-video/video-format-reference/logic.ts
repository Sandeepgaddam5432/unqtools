/**
 * Video Format Reference — pure logic.
 * Reference table for common video container/codec formats.
 */

export interface VideoFormatInfo {
  id: string;
  name: string;
  extension: string;
  mimeType: string;
  container: string;
  codecs: string[];
  streaming: boolean;
  drm: boolean;
  supportedBy: string[];
  pros: string[];
  cons: string[];
  useCases: string[];
}

const FORMATS: VideoFormatInfo[] = [
  {
    id: "mp4",
    name: "MP4 (MPEG-4 Part 14)",
    extension: ".mp4",
    mimeType: "video/mp4",
    container: "MP4",
    codecs: ["H.264", "H.265/HEVC", "AV1", "AAC"],
    streaming: true,
    drm: true,
    supportedBy: ["Chrome", "Safari", "Firefox", "Edge", "iOS", "Android", "All modern devices"],
    pros: ["Universal compatibility", "Streaming-friendly", "DRM support"],
    cons: ["Not always open", "Patent licensing required for H.264"],
    useCases: ["Web video", "Mobile streaming", "Social media"],
  },
  {
    id: "webm",
    name: "WebM",
    extension: ".webm",
    mimeType: "video/webm",
    container: "Matroska subset",
    codecs: ["VP8", "VP9", "AV1", "Vorbis", "Opus"],
    streaming: true,
    drm: false,
    supportedBy: ["Chrome", "Firefox", "Edge", "Android"],
    pros: ["Open source", "Royalty-free", "Great for web"],
    cons: ["No Safari support for VP9", "Limited iOS support"],
    useCases: ["WebM video", "Open video", "WebRTC"],
  },
  {
    id: "avi",
    name: "AVI (Audio Video Interleave)",
    extension: ".avi",
    mimeType: "video/x-msvideo",
    container: "RIFF",
    codecs: ["MPEG-4", "DivX", "Xvid", "MP3", "AC3"],
    streaming: false,
    drm: false,
    supportedBy: ["VLC", "Windows Media Player", "Most desktop players"],
    pros: ["Simple container", "Wide codec support", "Legacy compatible"],
    cons: ["Large files", "No streaming", "Outdated", "Limited browser support"],
    useCases: ["Archival", "Legacy video", "Desktop playback"],
  },
  {
    id: "mkv",
    name: "MKV (Matroska)",
    extension: ".mkv",
    mimeType: "video/x-matroska",
    container: "Matroska",
    codecs: ["H.264", "H.265", "AV1", "VP9", "AAC", "Opus", "DTS"],
    streaming: true,
    drm: false,
    supportedBy: ["VLC", "mpv", "Plex", "Kodi", "Most modern players"],
    pros: ["Highly flexible", "Multiple audio/subtitle tracks", "Open standard"],
    cons: ["Limited browser support", "Large file sizes", "Not streaming-optimized for web"],
    useCases: ["Movie archives", "Subtitled content", "Multi-track video"],
  },
  {
    id: "mov",
    name: "MOV (QuickTime)",
    extension: ".mov",
    mimeType: "video/quicktime",
    container: "QuickTime",
    codecs: ["H.264", "H.265", "ProRes", "AAC"],
    streaming: true,
    drm: true,
    supportedBy: ["Safari", "QuickTime", "iOS", "macOS", "Adobe Premiere"],
    pros: ["Apple ecosystem native", "High quality", "Editing friendly"],
    cons: ["Large files", "Less universal than MP4", "Apple-focused"],
    useCases: ["Video editing", "Apple devices", "Pro workflows"],
  },
];

export function getAllFormats(): VideoFormatInfo[] {
  return [...FORMATS];
}

export function getFormatById(id: string): VideoFormatInfo | null {
  return FORMATS.find((f) => f.id === id) ?? null;
}

export function getFormatByExtension(ext: string): VideoFormatInfo | null {
  const e = ext.toLowerCase().trim().replace(/^\./, "");
  return FORMATS.find((f) => f.extension.replace(/^\./, "") === e) ?? null;
}

export function getFormatByMime(mime: string): VideoFormatInfo | null {
  const m = mime.toLowerCase().split(";")[0].trim();
  return FORMATS.find((f) => f.mimeType === m) ?? null;
}

export function filterStreaming(streaming: boolean): VideoFormatInfo[] {
  return FORMATS.filter((f) => f.streaming === streaming);
}

export function searchFormats(query: string): VideoFormatInfo[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...FORMATS];
  return FORMATS.filter((f) =>
    f.name.toLowerCase().includes(q) ||
    f.id.includes(q) ||
    f.extension.includes(q) ||
    f.codecs.some((c) => c.toLowerCase().includes(q)) ||
    f.useCases.some((u) => u.toLowerCase().includes(q))
  );
}

/** Estimate video file size in bytes from bitrate and duration. */
export function estimateSize(bitrateKbps: number, seconds: number): number {
  if (bitrateKbps < 0 || seconds < 0) return 0;
  return Math.round((bitrateKbps * 1000 * seconds) / 8);
}

/** Check codec compatibility with a browser (heuristic). */
export function supportsCodec(formatId: string, codec: string, browser: "chrome" | "safari" | "firefox" | "edge"): boolean {
  const f = getFormatById(formatId);
  if (!f) return false;
  const codecUpper = codec.toUpperCase();
  if (!f.codecs.some((c) => c.toUpperCase().includes(codecUpper))) return false;
  if (browser === "safari" && (codecUpper.includes("VP9") || codecUpper.includes("VP8") || codecUpper.includes("OPUS"))) return false;
  if (browser === "firefox" && (codecUpper.includes("H.265") || codecUpper.includes("HEVC") || codecUpper.includes("PRORES"))) return false;
  return true;
}
