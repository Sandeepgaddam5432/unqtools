import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "reverse-pdf",
  name: "Reverse PDF Pages",
  description:
    "Reverse the page order of a PDF — last page becomes first, first becomes last. Instant, 100% private, runs in your browser.",
  category: "pdf",
  keywords: [
    "reverse pdf",
    "flip pdf pages",
    "backwards pdf",
    "pdf page order",
    "reverse page order",
    "invert pdf",
    "pdf reverser",
  ],
  icon: "arrow-down-up",
  requiresNetwork: false,
  seo: {
    title: "Reverse PDF Page Order Online — Free & Private | UnQTools",
    faq: [
      {
        q: "Are my PDFs uploaded to a server?",
        a: "No. Reversing happens entirely in your browser using JavaScript — your files never leave your device, and it works offline.",
      },
      {
        q: "Does reversing affect the content of each page?",
        a: "No. Each page is preserved exactly as-is — only the order of pages changes. Text, images, annotations, and form fields on each page remain untouched.",
      },
      {
        q: "Is there a page limit?",
        a: "No hard limit. It depends on your device's memory. Most modern devices handle hundreds of pages without issue.",
      },
    ],
  },
  status: "done",
};
