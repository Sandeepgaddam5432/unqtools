/**
 * Bates Numbering (Legal) — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "bates-numbering-legal",
  name: "Bates Numbering (Legal)",
  description: "Add Bates numbers to PDF for legal document indexing. Custom format.",
  category: "pdf",
  keywords: ["bates numbering", "legal pdf", "bates stamp", "document numbering"],
  icon: "Hash",
  requiresNetwork: false,
  seo: {
    title: "Bates Numbering (Legal) — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Add Bates numbers to PDF for legal document indexing. Custom format." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) Drag-and-drop file upload; (2) Bulk processing; (3) Live preview; (4) Multiple format support; (5) Quality/size controls; (6) Preset configurations; (7) Export as ZIP; (8) Copy to clipboard; (9) History (localStorage); (10) PWA offline; (11) Privacy-first; (12) WCAG compliant." },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "planned",
};
