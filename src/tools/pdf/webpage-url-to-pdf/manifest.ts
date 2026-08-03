/**
 * Webpage (URL) to PDF — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "webpage-url-to-pdf",
  name: "Webpage (URL) to PDF",
  description: "Convert webpage URL to PDF. Print-friendly, capture full page.",
  category: "pdf",
  keywords: ["webpage to pdf", "url to pdf", "web to pdf", "html to pdf"],
  icon: "Globe",
  requiresNetwork: false,
  seo: {
    title: "Webpage (URL) to PDF — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Convert webpage URL to PDF. Print-friendly, capture full page." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) Drag-and-drop file upload; (2) Bulk processing; (3) Live preview; (4) Multiple format support; (5) Quality/size controls; (6) Preset configurations; (7) Export as ZIP; (8) Copy to clipboard; (9) History (localStorage); (10) PWA offline; (11) Privacy-first; (12) WCAG compliant." },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "planned",
};
