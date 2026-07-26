/**
 * Favicon Generator (multi-size) — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "favicon-generator",
  name: "Favicon Generator (multi-size)",
  description: "Generate favicons in all sizes from a single source image. ICO, PNG, Apple touch icon, manifest.",
  category: "image",
  keywords: ["favicon", "favicon generator", "favicon icon", "website favicon"],
  icon: "Star",
  requiresNetwork: false,
  seo: {
    title: "Favicon Generator (multi-size) — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Generate favicons in all sizes from a single source image. ICO, PNG, Apple touch icon, manifest." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) All favicon sizes (16-512px), (2) (2) ICO format, (3) (3) PNG format, (4) (4) Apple touch icon, (5) (5) Android manifest icons, (6) (6) Site.webmanifest, (7) (7) HTML link tags, (8) (8) Source image upload, (9) (9) Download as ZIP, (10) (10) Copy HTML, (11) (11) Preview all sizes, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
