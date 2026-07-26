/**
 * Color Mixer Blender — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "color-mixer-blender",
  name: "Color Mixer Blender",
  description: "Mix and blend two colors. Normal, multiply, screen, overlay, and 13 other blend modes.",
  category: "image",
  keywords: ["color mixer", "color blender", "blend colors", "color blend"],
  icon: "Blend",
  requiresNetwork: false,
  seo: {
    title: "Color Mixer Blender — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Mix and blend two colors. Normal, multiply, screen, overlay, and 13 other blend modes." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) 16 blend modes, (2) (2) Two-color blending, (3) (3) Opacity control, (4) (4) Live preview, (5) (5) Hex/RGB/HSL input, (6) (6) Color picker, (7) (7) Blend gradient generator, (8) (8) Bulk palette blending, (9) (9) Copy result, (10) (10) Export palette, (11) (11) History, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
