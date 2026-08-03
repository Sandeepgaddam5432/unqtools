import type { ToolManifest } from "../../../lib/tool";
export const manifest: ToolManifest = {
  id: "pdf-header-footer-advanced",
  name: "Add Header & Footer (Advanced)",
  description: "Advanced header/footer with page numbers, dates, custom text per page. Uses pdf-lib, 100% client-side.",
  category: "pdf",
  keywords: ["add-header-&-footer-(advanced)", "pdf", "offline", "browser"],
  icon: "FileText",
  requiresNetwork: false,
  seo: { title: "Add Header & Footer (Advanced) — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Advanced header/footer with page numbers, dates, custom text per page" },
      { q: "Is my data sent to a server?", a: "No. All processing uses pdf-lib and runs 100% in your browser." },
      { q: "Does it work offline?", a: "Yes — install as a PWA and use without network." },
    ],
  },
  status: "done",
};
