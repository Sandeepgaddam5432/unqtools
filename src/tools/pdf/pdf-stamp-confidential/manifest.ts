import type { ToolManifest } from "../../../lib/tool";
export const manifest: ToolManifest = {
  id: "pdf-stamp-confidential",
  name: "Add Confidential/Draft Stamp to PDF",
  description: "Adds CONFIDENTIAL or DRAFT watermark stamp to PDF pages. Uses pdf-lib, 100% client-side.",
  category: "pdf",
  keywords: ["add-confidential-draft-stamp-to-pdf", "pdf", "offline", "browser"],
  icon: "Stamp",
  requiresNetwork: false,
  seo: { title: "Add Confidential/Draft Stamp to PDF — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Adds CONFIDENTIAL or DRAFT watermark stamp to PDF pages" },
      { q: "Is my data sent to a server?", a: "No. All processing uses pdf-lib and runs 100% in your browser." },
      { q: "Does it work offline?", a: "Yes — install as a PWA and use without network." },
    ],
  },
  status: "done",
};
