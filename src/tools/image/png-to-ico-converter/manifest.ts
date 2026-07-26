/**
 * PNG to ICO (Favicon) Converter — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "png-to-ico-converter",
  name: "PNG to ICO (Favicon) Converter",
  description: "Convert PNG images to ICO format for Windows favicons. Multi-resolution ICO support.",
  category: "image",
  keywords: ["png to ico", "ico converter", "favicon ico", "ico file"],
  icon: "FileImage",
  requiresNetwork: false,
  seo: {
    title: "PNG to ICO (Favicon) Converter — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Convert PNG images to ICO format for Windows favicons. Multi-resolution ICO support." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) PNG to ICO, (2) (2) Multi-resolution (16/32/48/64/128/256), (3) (3) Single or multiple sizes, (4) (4) Transparency preservation, (5) (5) Drag-drop, (6) (6) Download ICO, (7) (7) Bulk convert, (8) (8) Preview, (9) (9) File size display, (10) (10) ICO header validation, (11) (11) Per-size preview, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
