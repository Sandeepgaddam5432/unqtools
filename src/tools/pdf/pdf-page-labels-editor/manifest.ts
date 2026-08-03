/**
 * PDF Page Labels Editor — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-page-labels-editor",
  name: "PDF Page Labels Editor",
  description: "Edit PDF page labels. Logical numbering (i, ii, 1, 2, A, B).",
  category: "pdf",
  keywords: ["pdf page labels", "page numbering", "pdf labels", "logical pages"],
  icon: "Tag",
  requiresNetwork: false,
  seo: {
    title: "PDF Page Labels Editor — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Edit PDF page labels. Logical numbering (i, ii, 1, 2, A, B)." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) Drag-and-drop file upload; (2) Bulk processing; (3) Live preview; (4) Multiple format support; (5) Quality/size controls; (6) Preset configurations; (7) Export as ZIP; (8) Copy to clipboard; (9) History (localStorage); (10) PWA offline; (11) Privacy-first; (12) WCAG compliant." },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "planned",
};
