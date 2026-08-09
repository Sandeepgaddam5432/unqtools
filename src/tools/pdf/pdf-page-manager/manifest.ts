import type { ToolManifest } from "../../../lib/tool";

/**
 * PDF Page Manager — the merged, all-in-one destination for every page
 * operation that used to live in 14 separate tools:
 *   delete, extract, duplicate, insert, reorder, rotate, reverse.
 *
 * Old tool URLs 301-redirect here (see public/_redirects) so no link ever
 * breaks. All operations are real pdf-lib engines, 100% client-side.
 */
export const manifest: ToolManifest = {
  id: "pdf-page-manager",
  name: "PDF Page Manager",
  description:
    "All page operations in one place: delete, extract, duplicate, insert, reorder, rotate and reverse PDF pages. Load one file, switch between 7 tabs, download instantly. 100% private — runs in your browser.",
  category: "pdf",
  keywords: [
    "pdf page manager",
    "delete pdf pages",
    "extract pdf pages",
    "duplicate pdf pages",
    "insert pdf pages",
    "reorder pdf pages",
    "rotate pdf pages",
    "reverse pdf",
    "pdf page organizer",
    "pdf editor",
  ],
  icon: "layout-panel-top",
  requiresNetwork: false,
  seo: {
    title: "PDF Page Manager — Delete, Extract, Rotate, Reorder & More | UnQTools",
    faq: [
      {
        q: "What happened to the individual page tools (Delete Pages, Rotate PDF, etc.)?",
        a: "They were merged into this single PDF Page Manager so you can do every page operation on one uploaded file without re-uploading. The old URLs still work — they redirect here automatically.",
      },
      {
        q: "Is my PDF uploaded to a server?",
        a: "No. Every operation runs 100% locally in your browser with pdf-lib. Your file never leaves your device.",
      },
      {
        q: "Which operations can I perform?",
        a: "Delete pages, extract pages into a new PDF, duplicate pages, insert pages from another PDF, reorder pages with a custom sequence, rotate pages (90/180/270° on all, odd, even or custom pages), and reverse the whole document.",
      },
      {
        q: "Can I combine operations in one go?",
        a: "Run an operation, keep the file loaded, switch to another tab and apply the next operation on the same file. Each download saves the current state.",
      },
    ],
  },
  status: "done",
};
