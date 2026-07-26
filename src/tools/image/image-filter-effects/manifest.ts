/**
 * Image Filter Effects (Sepia/Grayscale) — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-filter-effects",
  name: "Image Filter Effects (Sepia/Grayscale)",
  description: "Apply CSS-style filters to images: sepia, grayscale, blur, brightness, contrast, hue-rotate.",
  category: "image",
  keywords: ["image filters", "sepia", "grayscale", "photo filters"],
  icon: "Sparkles",
  requiresNetwork: false,
  seo: {
    title: "Image Filter Effects (Sepia/Grayscale) — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Apply CSS-style filters to images: sepia, grayscale, blur, brightness, contrast, hue-rotate." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Sepia, (2) (2) Grayscale, (3) (3) Blur, (4) (4) Brightness, (5) (5) Contrast, (6) (6) Hue-rotate, (7) (7) Saturate, (8) (8) Invert, (9) (9) Drop-shadow, (10) (10) Combine filters, (11) (11) Copy CSS filter, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
