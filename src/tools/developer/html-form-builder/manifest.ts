/**
 * HTML Form Builder — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "html-form-builder",
  name: "HTML Form Builder",
  description: "Build HTML forms visually. Input types, validation, labels, accessibility attributes.",
  category: "developer",
  keywords: ["html form", "form builder", "form generator", "html forms"],
  icon: "LayoutTemplate",
  requiresNetwork: false,
  seo: {
    title: "HTML Form Builder — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Build HTML forms visually. Input types, validation, labels, accessibility attributes." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) Drag-and-drop file upload; (2) Bulk processing; (3) Live preview; (4) Multiple format support; (5) Quality/size controls; (6) Preset configurations; (7) Export as ZIP; (8) Copy to clipboard; (9) History (localStorage); (10) PWA offline; (11) Privacy-first; (12) WCAG compliant." },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "planned",
};
