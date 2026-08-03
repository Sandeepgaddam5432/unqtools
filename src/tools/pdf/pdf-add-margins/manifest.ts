import type { ToolManifest } from "../../../lib/tool";
export const manifest: ToolManifest = {
  id: "pdf-add-margins",
  name: "Add Margins to PDF",
  description: "Adds white margins/whitespace around PDF pages. Uses pdf-lib, 100% client-side.",
  category: "pdf",
  keywords: ["add-margins-to-pdf", "pdf", "offline", "browser"],
  icon: "Maximize2",
  requiresNetwork: false,
  seo: { title: "Add Margins to PDF — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Adds white margins/whitespace around PDF pages" },
      { q: "Is my data sent to a server?", a: "No. All processing uses pdf-lib and runs 100% in your browser." },
      { q: "Does it work offline?", a: "Yes — install as a PWA and use without network." },
    ],
  },
  status: "done",
};
