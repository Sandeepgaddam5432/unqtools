/**
 * Bulk Image Resizer — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "bulk-image-resizer",
  name: "Bulk Image Resizer",
  description: "Resize multiple images at once. By percentage, fixed dimensions, or longest side. Batch processing.",
  category: "image",
  keywords: ["image resizer", "bulk resize", "resize images", "batch resize"],
  icon: "Maximize2",
  requiresNetwork: false,
  seo: {
    title: "Bulk Image Resizer — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Resize multiple images at once. By percentage, fixed dimensions, or longest side. Batch processing." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Bulk image upload, (2) (2) Resize by percentage, (3) (3) Resize to fixed dimensions, (4) (4) Resize by longest side, (5) (5) Maintain aspect ratio, (6) (6) Upscale option, (7) (7) Multiple size presets, (8) (8) Download as ZIP, (9) (9) Per-image download, (10) (10) Progress tracking, (11) (11) Format conversion on resize, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
