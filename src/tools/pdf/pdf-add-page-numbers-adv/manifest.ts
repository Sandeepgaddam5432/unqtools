import type { ToolManifest } from "../../../lib/tool";
export const manifest: ToolManifest = {
  id: "pdf-add-page-numbers-adv",
  name: "Add Page Numbers (Advanced)",
  description: "Page number formatter with prefix/suffix/starting number. Uses pdf-lib, 100% client-side.",
  category: "pdf",
  keywords: ["add-page-numbers-(advanced)", "pdf", "offline", "browser"],
  icon: "Hash",
  requiresNetwork: false,
  seo: { title: "Add Page Numbers (Advanced) — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Page number formatter with prefix/suffix/starting number" },
      { q: "Is my data sent to a server?", a: "No. All processing uses pdf-lib and runs 100% in your browser." },
      { q: "Does it work offline?", a: "Yes — install as a PWA and use without network." },
    ],
  },
  status: "done",
};
