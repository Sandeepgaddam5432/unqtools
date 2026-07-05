import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "split-pdf",
  name: "Split PDF",
  description:
    "Split a PDF into multiple files — by custom page ranges, every N pages, or one file per page. Download files individually or all at once. 100% private, runs in your browser.",
  category: "pdf",
  keywords: [
    "split pdf",
    "pdf splitter",
    "extract pdf pages",
    "separate pdf",
    "divide pdf",
    "pdf to pages",
    "break pdf",
  ],
  icon: "scissors",
  requiresNetwork: false,
  seo: {
    title: "Split PDF Online — By Page Ranges, Every N Pages, or Per Page | UnQTools",
    faq: [
      {
        q: "Is my PDF uploaded anywhere?",
        a: "No. Splitting happens entirely in your browser — the file never leaves your device, and the tool works offline.",
      },
      {
        q: "What split modes are available?",
        a: "Three modes: custom page ranges (each comma-separated group like 1-3, 4-6 becomes its own file), every N pages (equal chunks), and one file per page.",
      },
      {
        q: "Can the same page appear in multiple output files?",
        a: "Yes. In custom-ranges mode, groups may overlap — for example 1-3, 2-5 produces two files that both contain pages 2 and 3.",
      },
      {
        q: "How do I download all the output files?",
        a: "Use the Download all button — files are downloaded one after another. You can also download any file individually.",
      },
    ],
  },
  status: "done",
};
