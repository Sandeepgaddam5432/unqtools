import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "merge-pdf",
  name: "Merge PDF",
  description:
    "Combine multiple PDF files into one. Reorder files, pick exact page ranges per file (e.g. 1-3, 5), and download the merged PDF. 100% private — files never leave your browser.",
  category: "pdf",
  keywords: [
    "merge pdf",
    "combine pdf",
    "join pdf",
    "pdf merger",
    "concatenate pdf",
    "pdf joiner",
    "append pdf",
  ],
  icon: "layers",
  requiresNetwork: false,
  seo: {
    title: "Merge PDF Online — Combine PDFs with Reordering & Page Ranges | UnQTools",
    faq: [
      {
        q: "Are my PDF files uploaded to a server?",
        a: "No. Merging happens entirely in your browser using JavaScript — your files never leave your device, and the tool even works offline.",
      },
      {
        q: "Can I merge only some pages from each PDF?",
        a: "Yes. Each file has an optional page-range field. Enter ranges like 1-3, 5, 8-10 to include only those pages — you can even repeat pages (e.g. 1,1) to duplicate them.",
      },
      {
        q: "Can I change the order of the merged files?",
        a: "Yes. Use the up/down arrows on each file to reorder before merging. Pages appear in the output in exactly the order shown.",
      },
      {
        q: "Is there a file size or count limit?",
        a: "There is no hard limit — it depends on your device's memory. Merging dozens of typical PDFs works fine on most modern devices.",
      },
    ],
  },
  status: "done",
};
