import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "delete-pdf-pages",
  name: "Delete PDF Pages",
  description:
    "Remove unwanted pages from a PDF by entering page numbers or ranges (e.g. 2, 5-7). Preview the page count before and after, then download the cleaned PDF. 100% private.",
  category: "pdf",
  keywords: [
    "delete pdf pages",
    "remove pdf pages",
    "pdf page remover",
    "cut pages from pdf",
    "pdf delete",
  ],
  icon: "file-minus",
  requiresNetwork: false,
  seo: {
    title: "Delete PDF Pages Online — Remove Pages by Number or Range | UnQTools",
    faq: [
      {
        q: "Is my PDF sent to a server?",
        a: "No. Page deletion runs entirely in your browser. Your file never leaves your device.",
      },
      {
        q: "How do I specify which pages to delete?",
        a: "Enter page numbers or ranges separated by commas, e.g. 2, 5-7, 10. You can also use open-ended ranges like 8- to remove from page 8 to the end.",
      },
      {
        q: "Can I delete all pages?",
        a: "No. The tool requires at least one page to remain. If your range covers all pages, you will see an error.",
      },
    ],
  },
  status: "done",
};
