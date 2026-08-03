import type { ToolManifest } from "../../../lib/tool";
export const manifest: ToolManifest = {
  id: "pdf-add-page-numbers",
  name: "Add Page Numbers to PDF",
  description: "Add page numbers to all pages of a PDF document. Uses pdf-lib, 100% client-side.",
  category: "pdf",
  keywords: ["add-page-numbers-to-pdf", "pdf", "offline", "browser"],
  icon: "Hash",
  requiresNetwork: false,
  seo: { title: "Add Page Numbers to PDF — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Add page numbers to all pages of a PDF document" },
      { q: "Is my data sent to a server?", a: "No. All processing uses pdf-lib and runs 100% in your browser." },
      { q: "Does it work offline?", a: "Yes — install as a PWA and use without network." },
    ],
  },
  status: "done",
};
