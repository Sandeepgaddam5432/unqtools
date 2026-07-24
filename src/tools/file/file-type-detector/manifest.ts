/**
 * File Type Detector — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "file-type-detector",
  name: "File Type Detector",
  description:
    "Detect true file type from magic bytes (signature), not extension. 200+ signatures, MIME type, extension suggestion, and 10+ extras. 100% private.",
  category: "file",
  keywords: ["file type detector", "magic bytes", "file signature", "mime type", "file identifier", "true file type"],
  icon: "file-search",
  requiresNetwork: false,
  seo: {
    title: "File Type Detector — Magic Bytes + MIME + 200 Signatures | UnQTools",
    faq: [
      { q: "How does file type detection work?", a: "The tool reads the first 16-64 bytes of the file and matches against a database of 200+ magic byte signatures (e.g., PNG starts with 89 50 4E 47, PDF with 25 50 44 46). The file extension is ignored — only the actual content matters." },
      { q: "What extras does this tool have?", a: "Extras: (1) 200+ magic byte signatures, (2) MIME type per match, (3) Suggested extensions, (4) Confidence score, (5) Match against declared extension (mismatch warning), (6) Show all matching signatures, (7) Show first 64 bytes as hex dump, (8) Batch multiple files, (9) CSV export of batch results, (10) Copy individual results, (11) Detect text vs binary, (12) Show file size, (13) Detect archive types (zip, rar, 7z, tar, gz), (14) Detect image format dimensions when possible." },
    ],
  },
  status: "done",
};
