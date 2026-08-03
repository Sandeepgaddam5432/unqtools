import type { ToolManifest } from "../../../lib/tool";
export const manifest: ToolManifest = {
  id: "pdf-stamp-advanced-tool",
  name: "Add Stamp to PDF (Advanced)",
  description: "Advanced text/image stamping with position, size, rotation. Uses pdf-lib, 100% client-side.",
  category: "pdf",
  keywords: ["add-stamp-to-pdf-(advanced)", "pdf", "offline", "browser"],
  icon: "Stamp",
  requiresNetwork: false,
  seo: { title: "Add Stamp to PDF (Advanced) — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Advanced text/image stamping with position, size, rotation" },
      { q: "Is my data sent to a server?", a: "No. All processing uses pdf-lib and runs 100% in your browser." },
      { q: "Does it work offline?", a: "Yes — install as a PWA and use without network." },
    ],
  },
  status: "done",
};
