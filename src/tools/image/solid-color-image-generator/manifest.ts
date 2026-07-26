/**
 * Solid Color Image Generator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "solid-color-image-generator",
  name: "Solid Color Image Generator",
  description: "Generate solid color images at any dimension. Hex/RGB input, multiple formats.",
  category: "image",
  keywords: ["solid color", "color image", "solid background", "color png"],
  icon: "Square",
  requiresNetwork: false,
  seo: {
    title: "Solid Color Image Generator — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Generate solid color images at any dimension. Hex/RGB input, multiple formats." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Custom dimensions, (2) (2) Hex/RGB/HSL color, (3) (3) Format (PNG/JPG/WebP), (4) (4) Bulk generate, (5) (5) Download, (6) (6) Copy as data URL, (7) (7) Random colors, (8) (8) Color history, (9) (9) Live preview, (10) (10) Per-color download, (11) (11) ZIP download, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
