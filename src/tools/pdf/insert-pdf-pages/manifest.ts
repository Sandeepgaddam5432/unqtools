import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "insert-pdf-pages",
  name: "Insert PDF Pages",
  description:
    "Insert pages from a second PDF into your main PDF at any position. Choose where to insert and which pages from the source. 100% private, runs in your browser.",
  category: "pdf",
  keywords: [
    "insert pdf pages",
    "add pages to pdf",
    "merge pdf at position",
    "insert pages",
    "pdf page inserter",
    "combine pdf pages",
    "pdf insert",
  ],
  icon: "insert",
  requiresNetwork: false,
  seo: {
    title: "Insert PDF Pages Online — Add Pages at Any Position Free | UnQTools",
    faq: [
      {
        q: "Are my PDFs uploaded to a server?",
        a: "No. Inserting happens entirely in your browser using JavaScript — your files never leave your device, and it works offline.",
      },
      {
        q: "How do I specify where to insert?",
        a: "Enter a position number. Position 1 inserts at the very beginning (before page 1). Position 3 inserts after page 2 (before page 3). You can also choose 'End' to append at the very end.",
      },
      {
        q: "Can I insert only specific pages from the second PDF?",
        a: "Yes. Use the page-range field on the source PDF to select which pages to insert, e.g. '1-3' or '5'. Leave blank to insert all pages.",
      },
    ],
  },
  status: "done",
};
