/**
 * Round Corners Tool — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "round-corners-tool",
  name: "Round Corners Tool",
  description: "Round the corners of images with customizable radius. PNG transparency preservation.",
  category: "image",
  keywords: ["round corners", "rounded corners", "image corners", "corner radius"],
  icon: "Square",
  requiresNetwork: false,
  seo: {
    title: "Round Corners Tool — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Round the corners of images with customizable radius. PNG transparency preservation." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Corner radius control, (2) (2) Per-corner control, (3) (3) PNG transparency, (4) (4) Background color (for JPG), (5) (5) Bulk processing, (6) (6) Download as PNG, (7) (7) Per-image download, (8) (8) ZIP download, (9) (9) Live preview, (10) (10) Preset radii, (11) (11) Copy CSS, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
