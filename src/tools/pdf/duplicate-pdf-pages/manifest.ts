import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "duplicate-pdf-pages",
  name: "Duplicate PDF Pages",
  description:
    "Clone selected pages in a PDF N times. E.g. duplicate page 3 five times to repeat it. Supports page ranges. 100% private, runs in your browser.",
  category: "pdf",
  keywords: [
    "duplicate pdf pages",
    "clone pdf pages",
    "copy pdf pages",
    "repeat pdf pages",
    "pdf page duplicator",
    "multiply pdf pages",
    "pdf cloner",
  ],
  icon: "copy",
  requiresNetwork: false,
  seo: {
    title: "Duplicate PDF Pages Online — Clone & Repeat Pages Free | UnQTools",
    faq: [
      {
        q: "Are my PDFs uploaded to a server?",
        a: "No. Duplicating happens entirely in your browser using JavaScript — your files never leave your device, and it works offline.",
      },
      {
        q: "How does duplication work?",
        a: "You specify which pages to duplicate (e.g. '3' or '1-3, 5') and how many times to repeat them (e.g. 5). The selected pages are copied that many times and appended to the end of the document. The original pages remain in place.",
      },
      {
        q: "Can I duplicate a range of pages?",
        a: "Yes. Use comma-separated ranges like '1-3, 5, 8-10'. Each page in the specified ranges will be duplicated the number of times you choose.",
      },
    ],
  },
  status: "done",
};
