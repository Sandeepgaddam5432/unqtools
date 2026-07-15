import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "file-metadata-stripper",
  name: "File Metadata Stripper",
  description:
    "Remove EXIF, GPS, XMP, IPTC, and PNG text chunks from JPEG, PNG, and WebP images without re-encoding pixel data. Batch process, before/after size, metadata summary, ZIP download. 100% client-side.",
  category: "file",
  keywords: [
    "exif remover", "metadata stripper", "strip exif", "remove gps",
    "xmp remover", "iptc remover", "png text chunk", "jpeg app1",
    "privacy", "image sanitizer", "file metadata stripper",
  ],
  icon: "shield-off",
  requiresNetwork: false,
  seo: {
    title: "File Metadata Stripper — Remove EXIF/GPS/XMP/IPTC | UnQTools",
    faq: [
      { q: "What metadata does this tool strip?", a: "For JPEG: APP1 EXIF segments, APP1 XMP segments, and APP13 IPTC/Photoshop segments are removed. For PNG: all tEXt, zTXt, and iTXt chunks are removed. For WebP: RIFF is preserved but EXIF/XMP ancillary chunks are stripped. The actual pixel data (JPEG entropy-coded data, PNG IDAT chunks, WebP VP8 bitstream) is never re-encoded — only the metadata segments are dropped." },
      { q: "Does stripping re-encode the image?", a: "No. We surgically remove only the metadata segments/chunks. The pixel data is copied verbatim, so image quality is 100% preserved — no JPEG recompression, no PNG re-encoding. This is faster and safer than re-exporting via canvas." },
      { q: "Which file formats are supported?", a: "JPEG (any APP-marker variant — JFIF, EXIF, SPIFF), PNG (all color types), and WebP (lossy + lossless + alpha). The tool detects format from magic bytes and refuses unsupported types." },
      { q: "What extra features does this tool have compared to others?", a: "10 extras: (1) Drag-drop multiple files. (2) Batch process — strip unlimited files at once. (3) Before/after size comparison per file. (4) Metadata summary — lists exactly which segments/chunks were removed (EXIF, XMP, IPTC, PNG tEXt, etc.). (5) ZIP download for batch results. (6) Stats panel — total files processed, total bytes saved. (7) Image preview before/after stripping. (8) Original filename preserved (with `-stripped` suffix). (9) History of stripped files (localStorage — last 10). (10) Shareable URL for re-opening the tool with preset options." },
      { q: "Is my image uploaded anywhere?", a: "No. All parsing and stripping runs in your browser. The image bytes never leave your device. Only metadata summaries (filename, sizes) are saved to local history — never the image bytes themselves." },
      { q: "Will stripping break my image?", a: "No. The JPEG stream remains a valid JPEG (SOI + frame + scan + EOI), PNG remains a valid PNG (signature + IHDR + IDAT + IEND), WebP remains valid RIFF. The output opens in every image viewer. The only change is that viewer-reported EXIF/metadata will be empty." },
    ],
  },
  status: "done",
};
