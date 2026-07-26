/**
 * Bulk Image Converter — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "bulk-image-converter",
  name: "Bulk Image Converter",
  description: "Convert multiple images between formats: PNG, JPG, WebP, AVIF, GIF, BMP. Batch processing.",
  category: "image",
  keywords: ["image converter", "bulk convert", "format converter", "png to jpg"],
  icon: "RefreshCw",
  requiresNetwork: false,
  seo: {
    title: "Bulk Image Converter — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Convert multiple images between formats: PNG, JPG, WebP, AVIF, GIF, BMP. Batch processing." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Bulk format conversion, (2) (2) PNG/JPG/WebP/AVIF/GIF/BMP, (3) (3) Quality control, (4) (4) Preserve metadata, (5) (5) Resize on convert, (6) (6) Drag-drop multiple files, (7) (7) Per-file format selection, (8) (8) Download as ZIP, (9) (9) Per-file download, (10) (10) Progress tracking, (11) (11) Error recovery, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
