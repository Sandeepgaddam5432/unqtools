import type { ToolManifest } from "../../../lib/tool";
export const manifest: ToolManifest = {
  id: "pdf-header-footer-adv",
  name: "Add Header & Footer (Advanced)",
  description: "Header/footer builder with multiple alignment options. Uses pdf-lib, 100% client-side.",
  category: "pdf",
  keywords: ["add-header-&-footer-(advanced)", "pdf", "offline", "browser"],
  icon: "FileText",
  requiresNetwork: false,
  seo: { title: "Add Header & Footer (Advanced) — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Header/footer builder with multiple alignment options" },
      { q: "Is my data sent to a server?", a: "No. All processing uses pdf-lib and runs 100% in your browser." },
      { q: "Does it work offline?", a: "Yes — install as a PWA and use without network." },
    ],
  },
  status: "done",
};
