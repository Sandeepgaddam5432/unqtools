/**
 * Dummy Image Generator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "dummy-image-generator",
  name: "Dummy Image Generator",
  description: "Generate placeholder/dummy images with custom dimensions, colors, and text. Like placeholder.com but offline.",
  category: "image",
  keywords: ["dummy image", "placeholder image", "test image", "dummy image generator"],
  icon: "Image",
  requiresNetwork: false,
  seo: {
    title: "Dummy Image Generator — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Generate placeholder/dummy images with custom dimensions, colors, and text. Like placeholder.com but offline." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Custom dimensions, (2) (2) Background color, (3) (3) Text overlay, (4) (4) Text color, (5) (5) Font size, (6) (6) Format (PNG/JPG/WebP), (7) (7) Bulk generate (multiple sizes), (8) (8) Download, (9) (9) Copy as data URL, (10) (10) Random colors, (11) (11) Pattern backgrounds, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
