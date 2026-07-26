/**
 * Color Palette Extractor — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "color-palette-extractor",
  name: "Color Palette Extractor",
  description: "Extract dominant color palettes from images. K-means clustering, 3-10 colors, hex/RGB/HSL output.",
  category: "image",
  keywords: ["color palette", "palette extractor", "image colors", "dominant colors"],
  icon: "Palette",
  requiresNetwork: false,
  seo: {
    title: "Color Palette Extractor — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Extract dominant color palettes from images. K-means clustering, 3-10 colors, hex/RGB/HSL output." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Dominant color extraction, (2) (2) K-means clustering, (3) (3) 3-10 color palettes, (4) (4) Hex/RGB/HSL output, (5) (5) Drag-drop image, (6) (6) Copy palette, (7) (7) Export as CSS variables, (8) (8) Export as JSON, (9) (9) Export as SCSS, (10) (10) Palette preview, (11) (11) Color frequency, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
