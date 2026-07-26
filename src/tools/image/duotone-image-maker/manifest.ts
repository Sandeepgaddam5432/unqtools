/**
 * Duotone Image Maker — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "duotone-image-maker",
  name: "Duotone Image Maker",
  description: "Convert images to duotone (two-color) effect. Shadow and highlight color picker.",
  category: "image",
  keywords: ["duotone", "two tone", "image filter", "duotone effect"],
  icon: "Droplets",
  requiresNetwork: false,
  seo: {
    title: "Duotone Image Maker — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Convert images to duotone (two-color) effect. Shadow and highlight color picker." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Duotone effect, (2) (2) Shadow color picker, (3) (3) Highlight color picker, (4) (4) Preset duotones (10+), (5) (5) Intensity control, (6) (6) Contrast adjustment, (7) (7) Bulk processing, (8) (8) Download as PNG, (9) (9) Copy CSS filter, (10) (10) Side-by-side preview, (11) (11) Custom gradient map, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
