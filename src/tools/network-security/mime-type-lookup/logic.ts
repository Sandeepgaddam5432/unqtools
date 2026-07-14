/**
 * MIME Type Lookup — pure data + lookup logic.
 *
 * Common web MIME types registered with IANA. Includes file extensions,
 * category, and whether the type is binary or text.
 */

export type MimeCategory =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "application"
  | "font"
  | "multipart"
  | "model";

export interface MimeEntry {
  mimeType: string;
  extensions: string[];        // e.g. ["html", "htm"]
  category: MimeCategory;
  isBinary: boolean;
  description: string;
  aliases?: string[];          // alternative MIME type names
}

export const MIME_TYPES: MimeEntry[] = [
  // Text
  { mimeType: "text/html", extensions: ["html", "htm"], category: "text", isBinary: false, description: "HTML document", aliases: ["application/xhtml+xml"] },
  { mimeType: "text/css", extensions: ["css"], category: "text", isBinary: false, description: "Cascading Style Sheets" },
  { mimeType: "text/plain", extensions: ["txt", "text", "log", "conf", "ini", "properties"], category: "text", isBinary: false, description: "Plain text" },
  { mimeType: "text/csv", extensions: ["csv"], category: "text", isBinary: false, description: "Comma-separated values" },
  { mimeType: "text/xml", extensions: ["xml"], category: "text", isBinary: false, description: "XML document" },
  { mimeType: "text/javascript", extensions: ["js", "mjs"], category: "text", isBinary: false, description: "JavaScript module", aliases: ["application/javascript", "application/ecmascript", "text/ecmascript"] },
  { mimeType: "text/markdown", extensions: ["md", "markdown"], category: "text", isBinary: false, description: "Markdown" },
  { mimeType: "text/yaml", extensions: ["yaml", "yml"], category: "text", isBinary: false, description: "YAML", aliases: ["application/yaml"] },
  { mimeType: "text/tab-separated-values", extensions: ["tsv"], category: "text", isBinary: false, description: "Tab-separated values" },
  { mimeType: "text/vtt", extensions: ["vtt"], category: "text", isBinary: false, description: "Web Video Text Tracks (subtitles)" },
  { mimeType: "text/calendar", extensions: ["ics", "ifb"], category: "text", isBinary: false, description: "iCalendar" },

  // Application — documents
  { mimeType: "application/json", extensions: ["json"], category: "application", isBinary: false, description: "JSON data" },
  { mimeType: "application/xml", extensions: ["xml"], category: "application", isBinary: false, description: "XML (application)" },
  { mimeType: "application/pdf", extensions: ["pdf"], category: "application", isBinary: true, description: "PDF document" },
  { mimeType: "application/zip", extensions: ["zip"], category: "application", isBinary: true, description: "ZIP archive" },
  { mimeType: "application/gzip", extensions: ["gz", "gzip"], category: "application", isBinary: true, description: "Gzip compressed", aliases: ["application/x-gzip"] },
  { mimeType: "application/x-tar", extensions: ["tar"], category: "application", isBinary: true, description: "Tar archive" },
  { mimeType: "application/x-7z-compressed", extensions: ["7z"], category: "application", isBinary: true, description: "7-Zip archive" },
  { mimeType: "application/x-rar-compressed", extensions: ["rar"], category: "application", isBinary: true, description: "RAR archive" },
  { mimeType: "application/x-bzip2", extensions: ["bz2"], category: "application", isBinary: true, description: "Bzip2 compressed" },
  { mimeType: "application/x-xz", extensions: ["xz"], category: "application", isBinary: true, description: "XZ compressed" },
  { mimeType: "application/octet-stream", extensions: ["bin", "exe", "dll", "so", "dylib"], category: "application", isBinary: true, description: "Binary data (generic fallback)" },

  // Application — Microsoft Office
  { mimeType: "application/msword", extensions: ["doc"], category: "application", isBinary: true, description: "Microsoft Word (legacy)" },
  { mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", extensions: ["docx"], category: "application", isBinary: true, description: "Microsoft Word (OOXML)" },
  { mimeType: "application/vnd.ms-excel", extensions: ["xls"], category: "application", isBinary: true, description: "Microsoft Excel (legacy)" },
  { mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", extensions: ["xlsx"], category: "application", isBinary: true, description: "Microsoft Excel (OOXML)" },
  { mimeType: "application/vnd.ms-powerpoint", extensions: ["ppt"], category: "application", isBinary: true, description: "Microsoft PowerPoint (legacy)" },
  { mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", extensions: ["pptx"], category: "application", isBinary: true, description: "Microsoft PowerPoint (OOXML)" },

  // Application — OpenDocument
  { mimeType: "application/vnd.oasis.opendocument.text", extensions: ["odt"], category: "application", isBinary: true, description: "OpenDocument Text" },
  { mimeType: "application/vnd.oasis.opendocument.spreadsheet", extensions: ["ods"], category: "application", isBinary: true, description: "OpenDocument Spreadsheet" },
  { mimeType: "application/vnd.oasis.opendocument.presentation", extensions: ["odp"], category: "application", isBinary: true, description: "OpenDocument Presentation" },

  // Application — RTF, EPUB, etc.
  { mimeType: "application/rtf", extensions: ["rtf"], category: "application", isBinary: true, description: "Rich Text Format" },
  { mimeType: "application/epub+zip", extensions: ["epub"], category: "application", isBinary: true, description: "EPUB ebook" },
  { mimeType: "application/x-mobipocket-ebook", extensions: ["mobi"], category: "application", isBinary: true, description: "Mobipocket ebook" },
  { mimeType: "application/vnd.amazon.ebook", extensions: ["azw"], category: "application", isBinary: true, description: "Amazon Kindle ebook" },

  // Application — code & config
  { mimeType: "application/typescript", extensions: ["ts"], category: "application", isBinary: false, description: "TypeScript", aliases: ["text/typescript"] },
  { mimeType: "application/json5", extensions: ["json5"], category: "application", isBinary: false, description: "JSON5 (extended JSON)" },
  { mimeType: "application/toml", extensions: ["toml"], category: "application", isBinary: false, description: "TOML config" },
  { mimeType: "application/ld+json", extensions: ["jsonld"], category: "application", isBinary: false, description: "JSON-LD (linked data)" },
  { mimeType: "application/graphql+json", extensions: ["graphql"], category: "application", isBinary: false, description: "GraphQL" },
  { mimeType: "application/wasm", extensions: ["wasm"], category: "application", isBinary: true, description: "WebAssembly" },
  { mimeType: "application/x-yaml", extensions: ["yaml", "yml"], category: "application", isBinary: false, description: "YAML (application)" },

  // Image
  { mimeType: "image/jpeg", extensions: ["jpg", "jpeg", "jpe", "jif"], category: "image", isBinary: true, description: "JPEG image" },
  { mimeType: "image/png", extensions: ["png"], category: "image", isBinary: true, description: "PNG image" },
  { mimeType: "image/gif", extensions: ["gif"], category: "image", isBinary: true, description: "GIF image (animated or static)" },
  { mimeType: "image/webp", extensions: ["webp"], category: "image", isBinary: true, description: "WebP image" },
  { mimeType: "image/svg+xml", extensions: ["svg", "svgz"], category: "image", isBinary: false, description: "SVG vector image" },
  { mimeType: "image/avif", extensions: ["avif"], category: "image", isBinary: true, description: "AVIF image (modern)" },
  { mimeType: "image/heic", extensions: ["heic", "heif"], category: "image", isBinary: true, description: "HEIC/HEIF image (Apple)" },
  { mimeType: "image/bmp", extensions: ["bmp"], category: "image", isBinary: true, description: "Bitmap image" },
  { mimeType: "image/tiff", extensions: ["tiff", "tif"], category: "image", isBinary: true, description: "TIFF image" },
  { mimeType: "image/x-icon", extensions: ["ico", "cur"], category: "image", isBinary: true, description: "Windows icon" },
  { mimeType: "image/vnd.adobe.photoshop", extensions: ["psd"], category: "image", isBinary: true, description: "Photoshop document" },

  // Audio
  { mimeType: "audio/mpeg", extensions: ["mp3"], category: "audio", isBinary: true, description: "MP3 audio", aliases: ["audio/mp3"] },
  { mimeType: "audio/mp4", extensions: ["m4a", "mp4a"], category: "audio", isBinary: true, description: "MP4 audio" },
  { mimeType: "audio/ogg", extensions: ["ogg", "oga"], category: "audio", isBinary: true, description: "Ogg Vorbis audio" },
  { mimeType: "audio/wav", extensions: ["wav"], category: "audio", isBinary: true, description: "WAV audio", aliases: ["audio/x-wav", "audio/wave"] },
  { mimeType: "audio/webm", extensions: ["weba"], category: "audio", isBinary: true, description: "WebM audio" },
  { mimeType: "audio/flac", extensions: ["flac"], category: "audio", isBinary: true, description: "FLAC lossless audio" },
  { mimeType: "audio/aac", extensions: ["aac"], category: "audio", isBinary: true, description: "AAC audio" },
  { mimeType: "audio/midi", extensions: ["mid", "midi"], category: "audio", isBinary: true, description: "MIDI", aliases: ["audio/x-midi"] },
  { mimeType: "audio/x-mpegurl", extensions: ["m3u", "m3u8"], category: "audio", isBinary: false, description: "M3U playlist" },

  // Video
  { mimeType: "video/mp4", extensions: ["mp4", "m4v"], category: "video", isBinary: true, description: "MP4 video" },
  { mimeType: "video/webm", extensions: ["webm"], category: "video", isBinary: true, description: "WebM video" },
  { mimeType: "video/ogg", extensions: ["ogv"], category: "video", isBinary: true, description: "Ogg video" },
  { mimeType: "video/x-msvideo", extensions: ["avi"], category: "video", isBinary: true, description: "AVI video" },
  { mimeType: "video/quicktime", extensions: ["mov", "qt"], category: "video", isBinary: true, description: "QuickTime video" },
  { mimeType: "video/x-matroska", extensions: ["mkv"], category: "video", isBinary: true, description: "Matroska video" },
  { mimeType: "video/mpeg", extensions: ["mpeg", "mpg"], category: "video", isBinary: true, description: "MPEG video" },
  { mimeType: "video/3gpp", extensions: ["3gp"], category: "video", isBinary: true, description: "3GP video (mobile)" },
  { mimeType: "video/x-flv", extensions: ["flv"], category: "video", isBinary: true, description: "Flash video" },

  // Font
  { mimeType: "font/woff", extensions: ["woff"], category: "font", isBinary: true, description: "WOFF font" },
  { mimeType: "font/woff2", extensions: ["woff2"], category: "font", isBinary: true, description: "WOFF2 font" },
  { mimeType: "font/ttf", extensions: ["ttf"], category: "font", isBinary: true, description: "TrueType font" },
  { mimeType: "font/otf", extensions: ["otf"], category: "font", isBinary: true, description: "OpenType font" },
  { mimeType: "application/vnd.ms-fontobject", extensions: ["eot"], category: "font", isBinary: true, description: "Embedded OpenType font (legacy)" },

  // Multipart
  { mimeType: "multipart/form-data", extensions: [], category: "multipart", isBinary: false, description: "Multipart form data (file uploads)" },
  { mimeType: "multipart/byteranges", extensions: [], category: "multipart", isBinary: false, description: "Multipart byte ranges (206 responses)" },

  // Model
  { mimeType: "model/gltf-binary", extensions: ["glb"], category: "model", isBinary: true, description: "glTF binary 3D model" },
  { mimeType: "model/gltf+json", extensions: ["gltf"], category: "model", isBinary: false, description: "glTF JSON 3D model" },
  { mimeType: "model/obj", extensions: ["obj"], category: "model", isBinary: false, description: "Wavefront OBJ 3D model" },
  { mimeType: "model/stl", extensions: ["stl"], category: "model", isBinary: true, description: "STL 3D model" },
];

/** Look up MIME type by extension (without leading dot). Returns first match or undefined. */
export function lookupByExtension(ext: string): MimeEntry | undefined {
  if (!ext) return undefined;
  const clean = ext.replace(/^\./, "").toLowerCase();
  return MIME_TYPES.find((m) => m.extensions.includes(clean));
}

/** Look up all MIME types matching an extension (since some extensions have multiple types). */
export function lookupAllByExtension(ext: string): MimeEntry[] {
  if (!ext) return [];
  const clean = ext.replace(/^\./, "").toLowerCase();
  return MIME_TYPES.filter((m) => m.extensions.includes(clean));
}

/** Look up MIME entry by MIME type string. */
export function lookupByMimeType(mime: string): MimeEntry | undefined {
  if (!mime) return undefined;
  const clean = mime.toLowerCase().split(";")[0].trim();
  return MIME_TYPES.find(
    (m) =>
      m.mimeType === clean ||
      m.aliases?.includes(clean),
  );
}

/** Look up file extension(s) for a MIME type. */
export function extensionsFor(mime: string): string[] {
  const entry = lookupByMimeType(mime);
  return entry?.extensions ?? [];
}

/** Search MIME types by query (matches MIME type, extension, or description). */
export function search(query: string): MimeEntry[] {
  if (!query || typeof query !== "string") return MIME_TYPES;
  const q = query.trim().toLowerCase();
  if (!q) return MIME_TYPES;
  return MIME_TYPES.filter(
    (m) =>
      m.mimeType.includes(q) ||
      m.description.toLowerCase().includes(q) ||
      m.extensions.some((e) => e.includes(q)) ||
      m.aliases?.some((a) => a.includes(q)),
  );
}

/** Detect MIME type from a filename. */
export function detectFromFilename(filename: string): MimeEntry | undefined {
  if (!filename) return undefined;
  const dot = filename.lastIndexOf(".");
  if (dot < 0 || dot === filename.length - 1) return undefined;
  const ext = filename.slice(dot + 1).toLowerCase();
  return lookupByExtension(ext);
}

/** Get all MIME types in a category. */
export function byCategory(category: MimeCategory): MimeEntry[] {
  return MIME_TYPES.filter((m) => m.category === category);
}

/** Total count of MIME types in the database. */
export function count(): number {
  return MIME_TYPES.length;
}

/** Category color for UI. */
export const CATEGORY_COLORS: Record<MimeCategory, string> = {
  text: "text-blue-600 dark:text-blue-400 border-blue-500/30 bg-blue-500/10",
  image: "text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  audio: "text-purple-600 dark:text-purple-400 border-purple-500/30 bg-purple-500/10",
  video: "text-pink-600 dark:text-pink-400 border-pink-500/30 bg-pink-500/10",
  application: "text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10",
  font: "text-cyan-600 dark:text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
  multipart: "text-orange-600 dark:text-orange-400 border-orange-500/30 bg-orange-500/10",
  model: "text-indigo-600 dark:text-indigo-400 border-indigo-500/30 bg-indigo-500/10",
};

// ===== v8.1 upgrade — blueprint features + 10 extras =====

// ===== IANA registration URL (blueprint feature) =====

/** Build the IANA registration URL for a MIME type. */
export function getIanaUrl(mimeType: string): string {
  // IANA registry: https://www.iana.org/assignments/media-types/<type>/<subtype>
  const clean = mimeType.toLowerCase().split(";")[0].trim();
  const [type, subtype] = clean.split("/");
  if (!type || !subtype) return "https://www.iana.org/assignments/media-types";
  return `https://www.iana.org/assignments/media-types/${type}/${subtype}`;
}

// ===== Charset detection (blueprint feature) =====

/** Detect the appropriate charset for a text MIME type. */
export function detectCharset(mimeType: string, sampleBytes?: Uint8Array): string | null {
  const clean = mimeType.toLowerCase().split(";")[0].trim();
  // Only text/* and application/json have charsets
  if (!clean.startsWith("text/") && clean !== "application/json" && clean !== "application/xml" && clean !== "application/javascript") {
    return null;
  }
  if (!sampleBytes || sampleBytes.length === 0) {
    // Default for text types
    return "utf-8";
  }
  // BOM detection
  if (sampleBytes[0] === 0xef && sampleBytes[1] === 0xbb && sampleBytes[2] === 0xbf) return "utf-8";
  if (sampleBytes[0] === 0xff && sampleBytes[1] === 0xfe) return "utf-16le";
  if (sampleBytes[0] === 0xfe && sampleBytes[1] === 0xff) return "utf-16be";
  // Heuristic: check for valid UTF-8
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    decoder.decode(sampleBytes);
    return "utf-8";
  } catch {
    // Not valid UTF-8 — assume ISO-8859-1 (Latin-1)
    return "iso-8859-1";
  }
}

// ===== Magic bytes detection (blueprint feature) =====

export interface MagicBytesMatch {
  mimeType: string;
  extension: string;
  offset: number;
  pattern: string;
}

const MAGIC_BYTES: Array<{ bytes: number[]; offset: number; mimeType: string; extension: string }> = [
  { bytes: [0x89, 0x50, 0x4e, 0x47], offset: 0, mimeType: "image/png", extension: "png" },
  { bytes: [0xff, 0xd8, 0xff], offset: 0, mimeType: "image/jpeg", extension: "jpg" },
  { bytes: [0x47, 0x49, 0x46, 0x38], offset: 0, mimeType: "image/gif", extension: "gif" },
  { bytes: [0x42, 0x4d], offset: 0, mimeType: "image/bmp", extension: "bmp" },
  { bytes: [0x25, 0x50, 0x44, 0x46], offset: 0, mimeType: "application/pdf", extension: "pdf" },
  { bytes: [0x50, 0x4b, 0x03, 0x04], offset: 0, mimeType: "application/zip", extension: "zip" },
  { bytes: [0x1f, 0x8b], offset: 0, mimeType: "application/gzip", extension: "gz" },
  { bytes: [0x37, 0x7a, 0xbc, 0xaf], offset: 0, mimeType: "application/x-7z-compressed", extension: "7z" },
  { bytes: [0x52, 0x61, 0x72, 0x21], offset: 0, mimeType: "application/x-rar-compressed", extension: "rar" },
  { bytes: [0x49, 0x44, 0x33], offset: 0, mimeType: "audio/mpeg", extension: "mp3" },
  { bytes: [0x66, 0x4c, 0x61, 0x43], offset: 0, mimeType: "audio/flac", extension: "flac" },
  { bytes: [0x4f, 0x67, 0x67, 0x53], offset: 0, mimeType: "audio/ogg", extension: "ogg" },
  { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0, mimeType: "video/webm", extension: "webm" }, // also WAV
  { bytes: [0x66, 0x74, 0x79, 0x70], offset: 4, mimeType: "video/mp4", extension: "mp4" },
  { bytes: [0x00, 0x00, 0x01, 0x00], offset: 0, mimeType: "image/x-icon", extension: "ico" },
  { bytes: [0x77, 0x4f, 0x46, 0x46], offset: 0, mimeType: "font/woff", extension: "woff" },
  { bytes: [0x77, 0x4f, 0x46, 0x32], offset: 0, mimeType: "font/woff2", extension: "woff2" },
  { bytes: [0x00, 0x01, 0x00, 0x00], offset: 0, mimeType: "font/ttf", extension: "ttf" },
  { bytes: [0x4f, 0x54, 0x54, 0x4f], offset: 0, mimeType: "font/otf", extension: "otf" },
  { bytes: [0x3c, 0x73, 0x76, 0x67], offset: 0, mimeType: "image/svg+xml", extension: "svg" },
  { bytes: [0x7b], offset: 0, mimeType: "application/json", extension: "json" },
];

/** Detect MIME type from file magic bytes. */
export function detectFromMagicBytes(bytes: Uint8Array): MagicBytesMatch | null {
  for (const magic of MAGIC_BYTES) {
    if (bytes.length < magic.offset + magic.bytes.length) continue;
    let match = true;
    for (let i = 0; i < magic.bytes.length; i++) {
      if (bytes[magic.offset + i] !== magic.bytes[i]) {
        match = false;
        break;
      }
    }
    if (match) {
      return {
        mimeType: magic.mimeType,
        extension: magic.extension,
        offset: magic.offset,
        pattern: magic.bytes.map((b) => b.toString(16).padStart(2, "0")).join(" "),
      };
    }
  }
  return null;
}

// ===== Sniffing attack warning (blueprint feature) =====

export interface SniffingWarning {
  severity: "high" | "medium" | "low";
  message: string;
  recommendation: string;
}

/** Check if a MIME type is vulnerable to MIME sniffing attacks. */
export function checkSniffingRisk(mimeType: string): SniffingWarning | null {
  const clean = mimeType.toLowerCase().split(";")[0].trim();
  if (clean === "application/octet-stream") {
    return {
      severity: "medium",
      message: "application/octet-stream is a generic binary type. Browsers may try to sniff the actual type.",
      recommendation: "Always send X-Content-Type-Options: nosniff to prevent MIME sniffing. Use a specific MIME type if possible.",
    };
  }
  if (clean === "text/plain") {
    return {
      severity: "low",
      message: "text/plain may be sniffed as HTML by browsers if it contains HTML-like content.",
      recommendation: "Send X-Content-Type-Options: nosniff. Use text/html if the content is actually HTML.",
    };
  }
  return null;
}

// ===== .htaccess AddType export (blueprint feature) =====

/** Generate Apache .htaccess AddType directives for a list of MIME types. */
export function toHtaccess(entries: MimeEntry[]): string {
  const lines = entries.map((e) => {
    const exts = e.extensions.map((ext) => `.${ext}`).join(" ");
    return `AddType ${e.mimeType} ${exts}`;
  });
  return lines.join("\n");
}

/** Generate nginx mime_types directives. */
export function toNginxMimeTypes(entries: MimeEntry[]): string {
  const lines = entries.map((e) => {
    const exts = e.extensions.map((ext) => `"${ext}"`).join(" ");
    return `  ${e.mimeType} ${exts};`;
  });
  return `types {\n${lines.join("\n")}\n}`;
}

// ===== Custom MIME type registration form (blueprint feature) =====

export interface CustomMimeType {
  mimeType: string;
  extensions: string[];
  description: string;
  isBinary: boolean;
}

/** Validate a custom MIME type registration. */
export function validateCustomMimeType(custom: CustomMimeType): string | null {
  if (!custom.mimeType || !custom.mimeType.match(/^[a-z]+\/[a-z0-9.+-]+$/i)) {
    return "MIME type must be in format 'type/subtype' (e.g. application/x-myapp).";
  }
  if (custom.extensions.length === 0) {
    return "At least one file extension is required.";
  }
  for (const ext of custom.extensions) {
    if (!ext.match(/^[a-z0-9]+$/i)) {
      return `Extension '${ext}' contains invalid characters.`;
    }
  }
  return null;
}

// ===== Extra #1: History =====

const MIME_HISTORY_KEY = "unqtools-mime-history";
const MAX_MIME_HISTORY = 30;

export interface MimeHistoryEntry {
  query: string;
  viewedAt: string;
}

export function loadMimeHistory(): MimeHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(MIME_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_MIME_HISTORY);
  } catch {
    return [];
  }
}

export function saveMimeToHistory(query: string): MimeHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  const entry: MimeHistoryEntry = { query, viewedAt: new Date().toISOString() };
  const current = loadMimeHistory().filter((e) => e.query !== query);
  const updated = [entry, ...current].slice(0, MAX_MIME_HISTORY);
  try { localStorage.setItem(MIME_HISTORY_KEY, JSON.stringify(updated)); } catch {}
  return updated;
}

export function clearMimeHistory(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.removeItem(MIME_HISTORY_KEY); } catch {}
}

// ===== Extra #2: Favorites =====

const MIME_FAVORITES_KEY = "unqtools-mime-favorites";

export function loadMimeFavorites(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(MIME_FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function toggleMimeFavorite(mimeType: string): string[] {
  const current = loadMimeFavorites();
  const updated = current.includes(mimeType) ? current.filter((m) => m !== mimeType) : [...current, mimeType];
  if (typeof localStorage === "undefined") return updated;
  try { localStorage.setItem(MIME_FAVORITES_KEY, JSON.stringify(updated)); } catch {}
  return updated;
}

// ===== Extra #3: Category stats =====

export interface CategoryStats {
  category: MimeCategory;
  count: number;
  percentage: number;
}

/** Get statistics on MIME types per category. */
export function getCategoryStats(): CategoryStats[] {
  const total = MIME_TYPES.length;
  const counts: Record<string, number> = {};
  for (const m of MIME_TYPES) {
    counts[m.category] = (counts[m.category] ?? 0) + 1;
  }
  return Object.entries(counts).map(([category, count]) => ({
    category: category as MimeCategory,
    count,
    percentage: Math.round((count / total) * 100),
  }));
}

// ===== Extra #4: File extension analyzer =====

export interface ExtensionInfo {
  extension: string;
  mimeTypes: MimeEntry[];
  conflicting: boolean;   // true if multiple MIME types claim this extension
}

/** Analyze a file extension — which MIME types claim it. */
export function analyzeExtension(ext: string): ExtensionInfo | null {
  const clean = ext.replace(/^\./, "").toLowerCase();
  const matches = MIME_TYPES.filter((m) => m.extensions.includes(clean));
  if (matches.length === 0) return null;
  return {
    extension: clean,
    mimeTypes: matches,
    conflicting: matches.length > 1,
  };
}

// ===== Extra #5: Conflict finder =====

export interface ExtensionConflict {
  extension: string;
  mimeTypes: string[];
}

/** Find all extensions claimed by multiple MIME types. */
export function findConflicts(): ExtensionConflict[] {
  const extMap: Record<string, string[]> = {};
  for (const m of MIME_TYPES) {
    for (const ext of m.extensions) {
      if (!extMap[ext]) extMap[ext] = [];
      extMap[ext].push(m.mimeType);
    }
  }
  return Object.entries(extMap)
    .filter(([, types]) => types.length > 1)
    .map(([extension, mimeTypes]) => ({ extension, mimeTypes }))
    .sort((a, b) => a.extension.localeCompare(b.extension));
}

// ===== Extra #6: Content-Type header builder =====

export interface ContentTypeHeader {
  header: string;
  explanation: string;
}

/** Build a Content-Type header with charset for text types. */
export function buildContentTypeHeader(mimeType: string, charset?: string): ContentTypeHeader {
  const clean = mimeType.toLowerCase().split(";")[0].trim();
  const needsCharset = clean.startsWith("text/") || clean === "application/json" || clean === "application/xml" || clean === "application/javascript";
  if (needsCharset) {
    const cs = charset || "utf-8";
    return {
      header: `Content-Type: ${clean}; charset=${cs}`,
      explanation: `Text-based content should always include charset (default utf-8). Browsers may default to ISO-8859-1 without it.`,
    };
  }
  return {
    header: `Content-Type: ${clean}`,
    explanation: `Binary content — no charset needed.`,
  };
}

// ===== Extra #7: Accept header builder =====

/** Build an Accept header for a list of MIME types with quality values. */
export function buildAcceptHeader(types: { mimeType: string; quality?: number }[]): string {
  return types
    .map((t) => (t.quality !== undefined && t.quality !== 1 ? `${t.mimeType};q=${t.quality}` : t.mimeType))
    .join(", ");
}

// ===== Extra #8: Export as JSON =====

/** Export all MIME types as JSON. */
export function exportMimeTypesAsJson(): string {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    count: MIME_TYPES.length,
    mimeTypes: MIME_TYPES,
  }, null, 2);
}

// ===== Extra #9: Quiz mode =====

export interface MimeQuizQuestion {
  extension: string;
  choices: string[];
  correctIndex: number;
}

/** Generate a quiz question: given an extension, pick the right MIME type. */
export function generateMimeQuizQuestion(): MimeQuizQuestion | null {
  const withExts = MIME_TYPES.filter((m) => m.extensions.length > 0);
  if (withExts.length < 4) return null;
  const correct = withExts[Math.floor(Math.random() * withExts.length)];
  const ext = correct.extensions[0];
  const wrong = withExts
    .filter((m) => m.mimeType !== correct.mimeType && !m.extensions.includes(ext))
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map((m) => m.mimeType);
  const choices = [...wrong, correct.mimeType].sort(() => Math.random() - 0.5);
  return {
    extension: ext,
    choices,
    correctIndex: choices.indexOf(correct.mimeType),
  };
}

// ===== Extra #10: Shareable URL =====

export function buildMimeShareUrl(query: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${window.location.pathname}#mime=${encodeURIComponent(query)}`;
}

export function extractMimeFromFragment(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;
  if (!hash) return null;
  const match = hash.match(/[#&]mime=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}
