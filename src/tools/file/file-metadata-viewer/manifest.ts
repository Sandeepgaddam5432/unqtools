import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "file-metadata-viewer",
  name: "File Metadata Viewer",
  description:
    "Inspect file metadata — size, type, last modified, MIME type, magic bytes, hex dump preview with offset, base64 preview, entropy, basic JPEG EXIF, and a file signature database. 100% client-side.",
  category: "file",
  keywords: [
    "file metadata", "file info", "magic bytes", "hex dump", "hex viewer",
    "file signature", "mime detection", "exif", "entropy", "base64 preview",
    "file inspection", "file metadata viewer",
  ],
  icon: "file-search",
  requiresNetwork: false,
  seo: {
    title: "File Metadata Viewer — Magic Bytes, Hex Dump, EXIF, Entropy | UnQTools",
    faq: [
      { q: "What metadata does this tool show?", a: "For each file: name, size (bytes + human-readable), MIME type (from browser), last modified date, magic bytes (first 16 bytes hex), file type detected from magic bytes, hex dump preview with offset addresses, base64 preview, Shannon entropy, and basic EXIF for JPEG images." },
      { q: "How are magic bytes used?", a: "The first few bytes of a file usually identify its format (e.g. PNG starts with 89 50 4E 47, PDF with 25 50 44 46). The tool reads these bytes and looks them up in a built-in file signature database to identify the actual format, even if the extension is wrong." },
      { q: "What is entropy and why does it matter?", a: "Shannon entropy measures how random the byte distribution is. Low entropy (< 1.0) suggests plain text or structured data. High entropy (> 7.5) suggests compressed/encrypted data. It's a quick heuristic for identifying file nature without parsing." },
      { q: "What EXIF data is shown?", a: "For JPEG files, the tool reads the APP1 segment and extracts common EXIF tags (camera make/model, date taken, orientation, GPS coordinates if present). This is a basic parser — for full EXIF use a dedicated EXIF tool." },
      { q: "What extra features does this tool have?", a: "10 extras: (1) Drag-drop file. (2) Hex viewer with byte offset addresses. (3) File type reference table (browse known signatures). (4) Copy metadata as JSON. (5) Magic bytes lookup table. (6) Base64 preview of first 1KB. (7) Shannon entropy calculation. (8) File signature database (50+ formats). (9) History (localStorage — last 10 inspected files). (10) Shareable URL with file signature reference." },
      { q: "Is my file uploaded anywhere?", a: "No. All metadata extraction runs in your browser via the File API. Your file never leaves your device. Only metadata (not file contents) is stored in localStorage history." },
      { q: "Why is there a privacy warning for some files?", a: "EXIF data in photos can contain GPS coordinates, timestamps, and camera identifiers that could identify you. We show a clear warning when sensitive EXIF is detected so you know what you're sharing if you redistribute the file." },
    ],
  },
  status: "done",
};
