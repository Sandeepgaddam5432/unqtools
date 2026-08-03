import type { ToolManifest } from "../../../lib/tool";
export const manifest: ToolManifest = {
  id: "pdf-margin-padding",
  name: "Add Margins/Whitespace to PDF",
  description: "Configure top/bottom/left/right margins for PDF pages. Uses pdf-lib, 100% client-side.",
  category: "pdf",
  keywords: ["add-margins-whitespace-to-pdf", "pdf", "offline", "browser"],
  icon: "Maximize2",
  requiresNetwork: false,
  seo: { title: "Add Margins/Whitespace to PDF — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Configure top/bottom/left/right margins for PDF pages" },
      { q: "Is my data sent to a server?", a: "No. All processing uses pdf-lib and runs 100% in your browser." },
      { q: "Does it work offline?", a: "Yes — install as a PWA and use without network." },
    ],
  },
  status: "done",
};
