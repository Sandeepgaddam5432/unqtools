import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "extract-pdf-pages",
  name: "Extract PDF Pages",
  description:
    "Extract specific pages or ranges from a PDF into a new file. Enter ranges like 1-3, 5, 8- and download only the pages you need. 100% private, runs in your browser.",
  category: "pdf",
  keywords: [
    "extract pdf pages",
    "pdf page extractor",
    "save pages from pdf",
    "subset pdf",
    "pdf clip",
    "get pages from pdf",
  ],
  icon: "file-output",
  requiresNetwork: false,
  seo: {
    title: "Extract PDF Pages Online — Save Specific Pages as a New PDF | UnQTools",
    faq: [
      {
        q: "Is my PDF uploaded to a server?",
        a: "No. Extraction runs 100% in your browser — the file never leaves your device, and it works offline.",
      },
      {
        q: "What range formats are supported?",
        a: "Single pages (3), ranges (2-5), open-ended ranges (4- for page 4 to end, -3 for start to page 3), and any comma-separated mix like 1, 3-5, 8-.",
      },
      {
        q: "Can I extract the same page multiple times?",
        a: "Yes. Repeating a page number (e.g. 2, 2) duplicates it in the output — useful for booklets or handouts.",
      },
    ],
  },
  status: "done",
};
