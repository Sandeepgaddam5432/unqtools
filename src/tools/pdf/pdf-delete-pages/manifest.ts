/**
 * Delete Pages from PDF — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-delete-pages",
  name: "Delete Pages from PDF",
  description: "Remove specific pages from PDF. Page range selection, preview before deletion.",
  category: "pdf",
  keywords: ["pdf delete", "delete pdf pages", "remove pages", "pdf remove"],
  icon: "Trash2",
  requiresNetwork: false,
  seo: {
    title: "Delete Pages from PDF — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Remove specific pages from PDF. Page range selection, preview before deletion." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) Drag-and-drop file upload; (2) Bulk processing; (3) Live preview; (4) Multiple format support; (5) Quality/size controls; (6) Preset configurations; (7) Export as ZIP; (8) Copy to clipboard; (9) History (localStorage); (10) PWA offline; (11) Privacy-first; (12) WCAG compliant." },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "planned",
};
