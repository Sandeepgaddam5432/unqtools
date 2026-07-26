/**
 * GIF Resizer — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "gif-resizer",
  name: "GIF Resizer",
  description: "Resize animated GIFs while preserving animation. Maintain aspect ratio or custom dimensions.",
  category: "image",
  keywords: ["gif resizer", "resize gif", "gif size", "gif resize"],
  icon: "Maximize2",
  requiresNetwork: false,
  seo: {
    title: "GIF Resizer — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Resize animated GIFs while preserving animation. Maintain aspect ratio or custom dimensions." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Resize by percentage, (2) (2) Resize to fixed dimensions, (3) (3) Maintain aspect ratio, (4) (4) Longest side, (5) (5) Bulk resize, (6) (6) Frame preservation, (7) (7) Before/after preview, (8) (8) Download resized, (9) (9) Quality preservation, (10) (10) File size display, (11) (11) Animation preview, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
