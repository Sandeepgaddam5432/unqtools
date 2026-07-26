/**
 * OCR PDF (Make Searchable) — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-ocr-searchable",
  name: "OCR PDF (Make Searchable)",
  description: "Add searchable text layer to scanned PDFs. Tesseract OCR, multi-language.",
  category: "pdf",
  keywords: ["pdf ocr", "ocr pdf", "searchable pdf", "tesseract"],
  icon: "ScanText",
  requiresNetwork: false,
  seo: {
    title: "OCR PDF (Make Searchable) — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Add searchable text layer to scanned PDFs. Tesseract OCR, multi-language." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) Drag-and-drop file upload; (2) Bulk processing; (3) Live preview; (4) Multiple format support; (5) Quality/size controls; (6) Preset configurations; (7) Export as ZIP; (8) Copy to clipboard; (9) History (localStorage); (10) PWA offline; (11) Privacy-first; (12) WCAG compliant." },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
