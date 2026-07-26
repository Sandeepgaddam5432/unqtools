/**
 * GIF Optimizer & Compressor — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "gif-optimizer",
  name: "GIF Optimizer & Compressor",
  description: "Optimize and compress animated GIFs. Reduce colors, remove duplicate frames, crop, resize.",
  category: "image",
  keywords: ["gif optimizer", "gif compress", "gif size", "optimize gif"],
  icon: "Archive",
  requiresNetwork: false,
  seo: {
    title: "GIF Optimizer & Compressor — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Optimize and compress animated GIFs. Reduce colors, remove duplicate frames, crop, resize." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Color reduction (256→128→64), (2) (2) Duplicate frame removal, (3) (3) Frame drop (every Nth), (4) (4) Resize, (5) (5) Crop, (6) (6) Lossy compression, (7) (7) Before/after size, (8) (8) Download optimized, (9) (9) Quality slider, (10) (10) Frame count display, (11) (11) Animation preview, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
