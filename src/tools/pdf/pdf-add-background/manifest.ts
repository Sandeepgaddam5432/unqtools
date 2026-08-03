import type { ToolManifest } from "../../../lib/tool";
export const manifest: ToolManifest = {
  id: "pdf-add-background",
  name: "Add Background to PDF",
  description: "Adds a background color or pattern to PDF pages using pdf-lib. Uses pdf-lib, 100% client-side.",
  category: "pdf",
  keywords: ["add-background-to-pdf", "pdf", "offline", "browser"],
  icon: "Palette",
  requiresNetwork: false,
  seo: { title: "Add Background to PDF — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Adds a background color or pattern to PDF pages using pdf-lib" },
      { q: "Is my data sent to a server?", a: "No. All processing uses pdf-lib and runs 100% in your browser." },
      { q: "Does it work offline?", a: "Yes — install as a PWA and use without network." },
    ],
  },
  status: "done",
};
