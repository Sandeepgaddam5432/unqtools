/**
 * Bulk Image Compressor — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "bulk-image-compressor",
  name: "Bulk Image Compressor",
  description: "Compress multiple images at once. PNG, JPG, WebP, AVIF support with quality and size targets.",
  category: "image",
  keywords: ["image compressor", "bulk compress", "image optimization", "compress images"],
  icon: "Archive",
  requiresNetwork: false,
  seo: {
    title: "Bulk Image Compressor — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Compress multiple images at once. PNG, JPG, WebP, AVIF support with quality and size targets." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Bulk image upload (drag-drop), (2) (2) PNG/JPG/WebP/AVIF support, (3) (3) Quality control (1-100), (4) (4) Target file size, (5) (5) Resize on compress, (6) (6) Preserve EXIF option, (7) (7) Before/after comparison, (8) (8) Total savings display, (9) (9) Download as ZIP, (10) (10) Per-image download, (11) (11) Batch progress, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
