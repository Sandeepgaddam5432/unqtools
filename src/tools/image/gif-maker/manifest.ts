/**
 * GIF Maker (from Images) — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "gif-maker",
  name: "GIF Maker (from Images)",
  description: "Create animated GIFs from multiple images. Frame delay, loop count, optimization, size reduction.",
  category: "image",
  keywords: ["gif maker", "gif generator", "animated gif", "gif from images"],
  icon: "Film",
  requiresNetwork: false,
  seo: {
    title: "GIF Maker (from Images) — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Create animated GIFs from multiple images. Frame delay, loop count, optimization, size reduction." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Multiple image to GIF, (2) (2) Frame delay control, (3) (3) Loop count, (4) (4) Color quantization, (5) (5) Dithering options, (6) (6) Resize on encode, (7) (7) Drag-drop reorder, (8) (8) Preview animation, (9) (9) Download GIF, (10) (10) Frame extraction, (11) (11) GIF optimization, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
