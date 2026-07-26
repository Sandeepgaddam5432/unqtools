/**
 * PDF Translate (Layout-Preserving) — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-translate",
  name: "PDF Translate (Layout-Preserving)",
  description: "Translate PDF text while preserving layout. Multi-language, side-by-side.",
  category: "pdf",
  keywords: ["pdf translate", "translate pdf", "pdf language", "pdf translation"],
  icon: "Languages",
  requiresNetwork: false,
  seo: {
    title: "PDF Translate (Layout-Preserving) — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Translate PDF text while preserving layout. Multi-language, side-by-side." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) Drag-and-drop file upload; (2) Bulk processing; (3) Live preview; (4) Multiple format support; (5) Quality/size controls; (6) Preset configurations; (7) Export as ZIP; (8) Copy to clipboard; (9) History (localStorage); (10) PWA offline; (11) Privacy-first; (12) WCAG compliant." },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
