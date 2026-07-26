/**
 * Gradient Image Generator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "gradient-image-generator",
  name: "Gradient Image Generator",
  description: "Generate gradient images (PNG/JPG) from CSS gradients. Linear, radial, conic with custom stops.",
  category: "image",
  keywords: ["gradient image", "gradient generator", "gradient png", "gradient background"],
  icon: "Palette",
  requiresNetwork: false,
  seo: {
    title: "Gradient Image Generator — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Generate gradient images (PNG/JPG) from CSS gradients. Linear, radial, conic with custom stops." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Linear gradient, (2) (2) Radial gradient, (3) (3) Conic gradient, (4) (4) Multi-stop colors, (5) (5) Angle control, (6) (6) Custom dimensions, (7) (7) Format (PNG/JPG/WebP), (8) (8) Download, (9) (9) Copy CSS, (10) (10) Preset gradients, (11) (11) Live preview, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
