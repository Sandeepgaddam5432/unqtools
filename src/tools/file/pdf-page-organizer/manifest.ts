/**
 * PDF Page Organizer — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-page-organizer",
  name: "PDF Page Organizer",
  description:
    "All-in-one PDF page operations: reorder, rotate, delete, extract, duplicate, split, merge, and bookmark. Visual preview, drag-drop, and 10+ extras. 100% private.",
  category: "file",
  keywords: ["pdf organizer", "pdf pages", "reorder pdf", "rotate pdf", "delete pages", "extract pages", "pdf manipulation"],
  icon: "file-stack",
  requiresNetwork: false,
  seo: {
    title: "PDF Page Organizer — Reorder/Rotate/Delete/Extract | UnQTools",
    faq: [
      { q: "What can I do with this tool?", a: "Reorder pages (drag-drop), rotate (90/180/270), delete unwanted pages, extract specific pages, duplicate pages, split into ranges, merge multiple PDFs, and add bookmarks — all in one interface. Live thumbnail preview shows changes." },
      { q: "What extras does this tool have?", a: "Extras: (1) Drag-drop reorder, (2) Rotate 90/180/270 (CW/CCW), (3) Delete page, (4) Extract subset to new PDF, (5) Duplicate page, (6) Insert page from another PDF, (7) Split into ranges, (8) Merge multiple PDFs, (9) Add bookmarks to pages, (10) Visual thumbnail preview, (11) Page-range syntax (e.g. '1-5,8,12-15'), (12) Reverse page order, (13) Sort by file size (when merging), (14) Download organized PDF, (15) Page-level metadata export CSV." },
    ],
  },
  status: "done",
};
