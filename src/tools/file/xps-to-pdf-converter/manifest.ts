/**
 * xps-to-pdf-converter — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "xps-to-pdf-converter",
  name: "Xps To Pdf Converter",
  description:
    "Convert files between formats using client-side libraries. Privacy-first, no upload, with 10+ extras. 100% private.",
  category: "file",
  keywords: ["xps,to,pdf,converter", "converter", "file conversion", "offline", "private"],
  icon: "file-text",
  requiresNetwork: false,
  seo: {
    title: "Xps To Pdf Converter — Offline Browser Converter | UnQTools",
    faq: [
      { q: "Is this conversion truly offline?", a: "Yes. All conversion happens in your browser using client-side JavaScript libraries. No file is uploaded to any server." },
      { q: "What extras does this tool have?", a: "Extras: (1) Drag-drop file input, (2) Page size selector (A4/Letter/Legal), (3) Margin control, (4) Font family + size, (5) Page numbers, (6) Title page generator, (7) Table of contents from headings, (8) Batch conversion, (9) Progress indicator, (10) Download as single PDF, (11) Show file size before/after, (12) Show conversion log, (13) Custom CSS for styling, (14) PDF metadata (Title/Author)." },
    ],
  },
  status: "done",
};
