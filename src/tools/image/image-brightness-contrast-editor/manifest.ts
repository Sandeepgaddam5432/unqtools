/**
 * Image Brightness & Contrast Editor — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-brightness-contrast-editor",
  name: "Image Brightness & Contrast Editor",
  description: "Adjust image brightness, contrast, exposure, and gamma. Real-time preview with histogram.",
  category: "image",
  keywords: ["brightness", "contrast", "image editor", "photo editor"],
  icon: "Sun",
  requiresNetwork: false,
  seo: {
    title: "Image Brightness & Contrast Editor — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Adjust image brightness, contrast, exposure, and gamma. Real-time preview with histogram." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Brightness adjustment, (2) (2) Contrast adjustment, (3) (3) Exposure, (4) (4) Gamma, (5) (5) Histogram display, (6) (6) Real-time preview, (7) (7) Reset all, (8) (8) Download adjusted, (9) (9) Preset adjustments, (10) (10) Bulk processing, (11) (11) Copy CSS filter, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
