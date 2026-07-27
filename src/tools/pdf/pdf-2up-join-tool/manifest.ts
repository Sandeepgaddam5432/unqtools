/**
 * Combine Pages Side-by-Side (2-up) — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "pdf-2up-join-tool",
  name: "Combine Pages Side-by-Side (2-up)",
  description: "Combine 2 PDF pages side-by-side on one page. N-up imposition.",
  category: "pdf",
  keywords: ["2-up", "side by side", "pdf combine", "n-up"],
  icon: "Columns3",
  requiresNetwork: false,
  seo: {
    title: "Combine Pages Side-by-Side (2-up) — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Combine 2 PDF pages side-by-side on one page. N-up imposition." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) Drag-and-drop file upload; (2) Bulk processing; (3) Live preview; (4) Multiple format support; (5) Quality/size controls; (6) Preset configurations; (7) Export as ZIP; (8) Copy to clipboard; (9) History (localStorage); (10) PWA offline; (11) Privacy-first; (12) WCAG compliant." },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
