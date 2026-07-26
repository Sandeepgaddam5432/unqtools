/**
 * Extract Text (PDF to TXT) Bulk — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-extract-text-bulk",
  name: "Extract Text (PDF to TXT) Bulk",
  description: "Extract text from multiple PDFs at once. Page range, bulk export.",
  category: "pdf",
  keywords: ["extract text pdf", "pdf to text", "pdf txt", "bulk extract"],
  icon: "FileOutput",
  requiresNetwork: false,
  seo: {
    title: "Extract Text (PDF to TXT) Bulk — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Extract text from multiple PDFs at once. Page range, bulk export." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) Drag-and-drop file upload; (2) Bulk processing; (3) Live preview; (4) Multiple format support; (5) Quality/size controls; (6) Preset configurations; (7) Export as ZIP; (8) Copy to clipboard; (9) History (localStorage); (10) PWA offline; (11) Privacy-first; (12) WCAG compliant." },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
