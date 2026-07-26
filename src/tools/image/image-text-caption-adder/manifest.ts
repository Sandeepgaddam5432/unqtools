/**
 * Image Text (Caption) Adder — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-text-caption-adder",
  name: "Image Text (Caption) Adder",
  description: "Add text captions to images. Font, size, color, position, shadow, stroke control.",
  category: "image",
  keywords: ["image caption", "text on image", "add text", "image text"],
  icon: "Type",
  requiresNetwork: false,
  seo: {
    title: "Image Text (Caption) Adder — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Add text captions to images. Font, size, color, position, shadow, stroke control." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Text overlay, (2) (2) Font family, (3) (3) Font size, (4) (4) Color picker, (5) (5) 9 position presets, (6) (6) Custom position, (7) (7) Shadow, (8) (8) Stroke, (9) (9) Rotation, (10) (10) Download as PNG, (11) (11) Bulk processing, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
