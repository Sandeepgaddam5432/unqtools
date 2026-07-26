/**
 * Image Placeholder Generator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-placeholder-generator",
  name: "Image Placeholder Generator",
  description: "Generate placeholder images with text, dimensions, and colors. Like placeholder.com offline.",
  category: "image",
  keywords: ["placeholder", "placeholder image", "dummy image", "test image"],
  icon: "ImagePlus",
  requiresNetwork: false,
  seo: {
    title: "Image Placeholder Generator — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Generate placeholder images with text, dimensions, and colors. Like placeholder.com offline." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Custom dimensions, (2) (2) Background color, (3) (3) Text overlay, (4) (4) Format (PNG/JPG/WebP), (5) (5) Font options, (6) (6) Bulk generate, (7) (7) Download, (8) (8) Copy as data URL, (9) (9) Random colors, (10) (10) URL generator (for external service), (11) (11) Live preview, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
