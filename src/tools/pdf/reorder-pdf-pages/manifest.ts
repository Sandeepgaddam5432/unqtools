import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "reorder-pdf-pages",
  name: "Reorder PDF Pages",
  description:
    "Change the page order in a PDF by typing a custom sequence (e.g. 3,1,2) or using quick presets: reverse all pages, or duplicate pages for printing. 100% private.",
  category: "pdf",
  keywords: [
    "reorder pdf pages",
    "rearrange pdf",
    "pdf page order",
    "reverse pdf",
    "pdf reorganize",
    "shuffle pdf pages",
  ],
  icon: "arrow-up-down",
  requiresNetwork: false,
  seo: {
    title: "Reorder PDF Pages Online — Custom Order, Reverse, Duplicate | UnQTools",
    faq: [
      {
        q: "Is my PDF uploaded anywhere?",
        a: "No. Everything runs in your browser. Your PDF stays on your device, even offline.",
      },
      {
        q: "How do I specify a custom page order?",
        a: "Enter a comma-separated sequence in the order you want, e.g. 3,1,2 to put page 3 first, then 1, then 2. You can repeat pages to duplicate them.",
      },
      {
        q: "What quick presets are available?",
        a: "Reverse: flips all pages to last-first order. Duplicate all: repeats every page twice (useful for 2-up printing). You can combine presets with a manual sequence.",
      },
    ],
  },
  status: "done",
};
