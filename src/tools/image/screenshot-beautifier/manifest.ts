/**
 * Screenshot Beautifier (Mockup BG) — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "screenshot-beautifier",
  name: "Screenshot Beautifier (Mockup BG)",
  description: "Beautify screenshots with gradients, mockups, shadows, and annotations. Social media ready.",
  category: "image",
  keywords: ["screenshot beautifier", "screenshot mockup", "screenshot design", "pretty screenshot"],
  icon: "Camera",
  requiresNetwork: false,
  seo: {
    title: "Screenshot Beautifier (Mockup BG) — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Beautify screenshots with gradients, mockups, shadows, and annotations. Social media ready." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Gradient backgrounds, (2) (2) Mockup frames, (3) (3) Shadow effects, (4) (4) Annotation tools, (5) (5) Padding, (6) (6) Aspect ratio presets (social media), (7) (7) Download as PNG, (8) (8) Copy HTML+CSS, (9) (9) Bulk beautify, (10) (10) Live preview, (11) (11) Preset themes, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
