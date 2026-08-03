import type { ToolManifest } from "../../../lib/tool";
export const manifest: ToolManifest = {
  id: "pdf-border-frame",
  name: "Add Page Border/Frame to PDF",
  description: "Draw decorative borders on PDF pages. Uses pdf-lib, 100% client-side.",
  category: "pdf",
  keywords: ["add-page-border-frame-to-pdf", "pdf", "offline", "browser"],
  icon: "Square",
  requiresNetwork: false,
  seo: { title: "Add Page Border/Frame to PDF — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Draw decorative borders on PDF pages" },
      { q: "Is my data sent to a server?", a: "No. All processing uses pdf-lib and runs 100% in your browser." },
      { q: "Does it work offline?", a: "Yes — install as a PWA and use without network." },
    ],
  },
  status: "done",
};
