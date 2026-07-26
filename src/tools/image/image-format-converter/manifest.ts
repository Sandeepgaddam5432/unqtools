/**
 * Image Format Converter (PNG/JPG/WebP/AVIF) — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-format-converter",
  name: "Image Format Converter (PNG/JPG/WebP/AVIF)",
  description: "Convert images between PNG, JPG, WebP, AVIF, GIF, BMP. Quality control, batch processing.",
  category: "image",
  keywords: ["image converter", "format converter", "png to webp", "jpg to png"],
  icon: "RefreshCw",
  requiresNetwork: false,
  seo: {
    title: "Image Format Converter (PNG/JPG/WebP/AVIF) — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Convert images between PNG, JPG, WebP, AVIF, GIF, BMP. Quality control, batch processing." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) PNG/JPG/WebP/AVIF/GIF/BMP, (2) (2) Quality control, (3) (3) Preserve metadata, (4) (4) Resize on convert, (5) (5) Drag-drop, (6) (6) Per-file format selection, (7) (7) Download as ZIP, (8) (8) Per-file download, (9) (9) Progress, (10) (10) Error recovery, (11) (11) Bulk conversion, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
