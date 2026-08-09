/**
 * Add Header & Footer to PDF — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-add-header-footer",
  name: "Add Header & Footer to PDF",
  description: "Add headers and footers to PDF pages. Text, page numbers, date, custom position.",
  category: "pdf",
  keywords: ["pdf header", "pdf footer", "header footer", "pdf top bottom"],
  icon: "AlignVerticalJustifyCenter",
  requiresNetwork: false,
  seo: {
    title: "Add Header & Footer to PDF — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Add headers and footers to PDF pages. Text, page numbers, date, custom position." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) Drag-and-drop file upload; (2) Bulk processing; (3) Live preview; (4) Multiple format support; (5) Quality/size controls; (6) Preset configurations; (7) Export as ZIP; (8) Copy to clipboard; (9) History (localStorage); (10) PWA offline; (11) Privacy-first; (12) WCAG compliant." },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
