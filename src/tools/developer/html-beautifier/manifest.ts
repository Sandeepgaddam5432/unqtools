/**
 * HTML Beautifier — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "html-beautifier",
  name: "HTML Beautifier",
  description: "Format and beautify HTML with configurable indent, line wrapping, and attribute sorting.",
  category: "developer",
  keywords: ["html beautifier", "html formatter", "format html", "pretty html"],
  icon: "Code2",
  requiresNetwork: false,
  seo: {
    title: "HTML Beautifier — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Format and beautify HTML with configurable indent, line wrapping, and attribute sorting." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) Drag-and-drop file upload; (2) Bulk processing; (3) Live preview; (4) Multiple format support; (5) Quality/size controls; (6) Preset configurations; (7) Export as ZIP; (8) Copy to clipboard; (9) History (localStorage); (10) PWA offline; (11) Privacy-first; (12) WCAG compliant." },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "planned",
};
