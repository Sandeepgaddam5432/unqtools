/**
 * Color Shades & Tints Generator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "color-shades-tints-generator",
  name: "Color Shades & Tints Generator",
  description: "Generate shades (darker) and tints (lighter) of any color. 10-step scales for design systems.",
  category: "image",
  keywords: ["color shades", "color tints", "color scale", "color variants"],
  icon: "Layers",
  requiresNetwork: false,
  seo: {
    title: "Color Shades & Tints Generator — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Generate shades (darker) and tints (lighter) of any color. 10-step scales for design systems." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) 10-step shade scale, (2) (2) 10-step tint scale, (3) (3) HSL-based generation, (4) (4) OKLCH-based generation, (5) (5) Custom step count, (6) (6) Hex/RGB/HSL input, (7) (7) Copy individual color, (8) (8) Export as CSS variables, (9) (9) Export as Tailwind config, (10) (10) Export as JSON, (11) (11) Live preview, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
