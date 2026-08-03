/**
 * Remove Line Breaks — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "remove-line-breaks",
  name: "Remove Line Breaks",
  description: "Remove line breaks from text. Join with space or custom separator.",
  category: "developer",
  keywords: ["remove line breaks", "join lines", "no line breaks", "single line"],
  icon: "Minus",
  requiresNetwork: false,
  seo: {
    title: "Remove Line Breaks — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Remove line breaks from text. Join with space or custom separator." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) Drag-and-drop file upload; (2) Bulk processing; (3) Live preview; (4) Multiple format support; (5) Quality/size controls; (6) Preset configurations; (7) Export as ZIP; (8) Copy to clipboard; (9) History (localStorage); (10) PWA offline; (11) Privacy-first; (12) WCAG compliant." },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "planned",
};
