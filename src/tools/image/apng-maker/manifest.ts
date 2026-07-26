/**
 * APNG Maker — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "apng-maker",
  name: "APNG Maker",
  description: "Create Animated PNG (APNG) files from multiple PNG frames. Frame delay, loop count, optimization.",
  category: "image",
  keywords: ["apng", "animated png", "apng maker", "apng generator"],
  icon: "Film",
  requiresNetwork: false,
  seo: {
    title: "APNG Maker — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Create Animated PNG (APNG) files from multiple PNG frames. Frame delay, loop count, optimization." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) PNG to APNG conversion, (2) (2) Frame delay control, (3) (3) Loop count (infinite/finite), (4) (4) Frame optimization, (5) (5) Drag-and-drop frame reorder, (6) (6) Disposal method, (7) (7) Blend mode, (8) (8) Preview animation, (9) (9) Frame extraction from existing APNG, (10) (10) Download APNG, (11) (11) Frame list export, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
