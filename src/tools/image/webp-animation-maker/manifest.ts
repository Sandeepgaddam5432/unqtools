/**
 * WebP Animation Maker — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "webp-animation-maker",
  name: "WebP Animation Maker",
  description: "Create animated WebP files from multiple images. Smaller than GIF, better quality.",
  category: "image",
  keywords: ["webp animation", "animated webp", "webp maker", "webp generator"],
  icon: "Film",
  requiresNetwork: false,
  seo: {
    title: "WebP Animation Maker — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Create animated WebP files from multiple images. Smaller than GIF, better quality." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Multiple image to WebP, (2) (2) Frame delay, (3) (3) Loop count, (4) (4) Quality control, (5) (5) Drag-drop reorder, (6) (6) Preview animation, (7) (7) Download WebP, (8) (8) Frame extraction, (9) (9) Optimization, (10) (10) Before/after size, (11) (11) Bulk frame import, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
