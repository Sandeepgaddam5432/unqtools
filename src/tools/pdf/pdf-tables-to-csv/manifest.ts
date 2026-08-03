/**
 * PDF Tables to CSV — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-tables-to-csv",
  name: "PDF Tables to CSV",
  description: "Extract tables from PDF and convert to CSV. Table detection.",
  category: "pdf",
  keywords: ["pdf tables", "pdf to csv", "extract tables", "pdf data"],
  icon: "Table",
  requiresNetwork: false,
  seo: {
    title: "PDF Tables to CSV — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Extract tables from PDF and convert to CSV. Table detection." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) Drag-and-drop file upload; (2) Bulk processing; (3) Live preview; (4) Multiple format support; (5) Quality/size controls; (6) Preset configurations; (7) Export as ZIP; (8) Copy to clipboard; (9) History (localStorage); (10) PWA offline; (11) Privacy-first; (12) WCAG compliant." },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "planned",
};
