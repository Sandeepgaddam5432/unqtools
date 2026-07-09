import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "interleave-pdf",
  name: "Interleave PDF Pages",
  description:
    "Merge two PDFs by alternating pages: page 1 from PDF A, page 1 from PDF B, page 2 from A, page 2 from B, and so on. Perfect for combining front/back scans. 100% private.",
  category: "pdf",
  keywords: [
    "interleave pdf",
    "alternate pdf pages",
    "merge pdf alternating",
    "combine pdf interleaved",
    "pdf collation",
    "front back pdf merge",
    "shuffle pdf pages",
  ],
  icon: "shuffle",
  requiresNetwork: false,
  seo: {
    title: "Interleave PDF Pages Online — Alternate Two PDFs Free | UnQTools",
    faq: [
      {
        q: "Are my PDFs uploaded to a server?",
        a: "No. Interleaving happens entirely in your browser using JavaScript — your files never leave your device, and it works offline.",
      },
      {
        q: "What happens if the two PDFs have different page counts?",
        a: "The tool alternates pages until one PDF runs out, then appends all remaining pages from the longer PDF at the end. So if PDF A has 5 pages and PDF B has 3, the output is: A1, B1, A2, B2, A3, B3, A4, A5.",
      },
      {
        q: "What's a typical use case?",
        a: "Combining front and back scans. If you scan the front pages of a document into one PDF and the back pages into another, interleaving them produces the correct reading order: front-1, back-1, front-2, back-2, etc.",
      },
    ],
  },
  status: "done",
};
