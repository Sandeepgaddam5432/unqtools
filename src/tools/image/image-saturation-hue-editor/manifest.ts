/**
 * Image Saturation & Hue Editor — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-saturation-hue-editor",
  name: "Image Saturation & Hue Editor",
  description: "Adjust image saturation, hue, vibrance, and temperature. Real-time preview.",
  category: "image",
  keywords: ["saturation", "hue", "image editor", "color adjustment"],
  icon: "Droplet",
  requiresNetwork: false,
  seo: {
    title: "Image Saturation & Hue Editor — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Adjust image saturation, hue, vibrance, and temperature. Real-time preview." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Saturation adjustment, (2) (2) Hue shift, (3) (3) Vibrance, (4) (4) Temperature, (5) (5) Tint, (6) (6) Real-time preview, (7) (7) Reset all, (8) (8) Download adjusted, (9) (9) Preset adjustments, (10) (10) Copy CSS filter, (11) (11) Bulk processing, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
