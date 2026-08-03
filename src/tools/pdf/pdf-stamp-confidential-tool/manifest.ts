import type { ToolManifest } from "../../../lib/tool";
export const manifest: ToolManifest = {
  id: "pdf-stamp-confidential-tool",
  name: "Add Confidential/Draft Stamp",
  description: "Enhanced stamp tool with custom text, font size, rotation, opacity. Uses pdf-lib, 100% client-side.",
  category: "pdf",
  keywords: ["add-confidential-draft-stamp", "pdf", "offline", "browser"],
  icon: "Stamp",
  requiresNetwork: false,
  seo: { title: "Add Confidential/Draft Stamp — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Enhanced stamp tool with custom text, font size, rotation, opacity" },
      { q: "Is my data sent to a server?", a: "No. All processing uses pdf-lib and runs 100% in your browser." },
      { q: "Does it work offline?", a: "Yes — install as a PWA and use without network." },
    ],
  },
  status: "done",
};
