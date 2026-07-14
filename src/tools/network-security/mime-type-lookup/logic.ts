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
