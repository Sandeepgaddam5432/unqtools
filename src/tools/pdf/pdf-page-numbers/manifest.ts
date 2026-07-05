import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-page-numbers",
  name: "PDF Page Numbers",
  description:
    "Add page numbers to any PDF. Choose position (6 spots), format (Page X of N), starting number, pages to skip, and font size. 100% private, runs in your browser.",
  category: "pdf",
  keywords: [
    "add page numbers to pdf",
    "pdf pagination",
    "pdf numbering",
    "stamp page numbers pdf",
    "pdf footer page numbers",
  ],
  icon: "hash",
  requiresNetwork: false,
  seo: {
    title: "Add Page Numbers to PDF Online — Custom Position & Format | UnQTools",
    faq: [
      {
        q: "Is my PDF sent to a server?",
        a: "No. Everything runs in your browser. Your file never leaves your device.",
      },
      {
        q: "What positions are available?",
        a: "Six positions: bottom-left, bottom-center, bottom-right, top-left, top-center, top-right.",
      },
      {
        q: "Can I skip page numbers on some pages?",
        a: "Yes. Enter page numbers or ranges to skip (e.g. 1 to skip the cover page). The visible numbering still increments unless you adjust the start number.",
      },
      {
        q: "Can I control what format the numbers appear in?",
        a: "Yes. Choose from Page X, Page X of N, X, or X / N. You can also set the starting number (e.g. start at 0 or 3).",
      },
    ],
  },
  status: "done",
};
