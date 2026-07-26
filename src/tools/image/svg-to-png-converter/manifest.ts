/**
 * SVG to PNG Converter — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "svg-to-png-converter",
  name: "SVG to PNG Converter",
  description: "Convert SVG files to PNG at custom resolutions. Bulk conversion, transparency preservation.",
  category: "image",
  keywords: ["svg to png", "svg converter", "convert svg", "png from svg"],
  icon: "FileImage",
  requiresNetwork: false,
  seo: {
    title: "SVG to PNG Converter — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Convert SVG files to PNG at custom resolutions. Bulk conversion, transparency preservation." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) SVG to PNG, (2) (2) Custom resolution, (3) (3) Multiple sizes, (4) (4) Transparency preservation, (5) (5) Background color, (6) (6) Bulk convert, (7) (7) Download as ZIP, (8) (8) Per-file download, (9) (9) Live preview, (10) (10) Drag-drop, (11) (11) Quality control, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
