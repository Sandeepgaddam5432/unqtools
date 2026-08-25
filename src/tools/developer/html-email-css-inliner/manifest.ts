/**
 * HTML Email CSS Inliner — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "html-email-css-inliner",
  name: "HTML Email CSS Inliner",
  description: "Inline CSS styles into HTML for email compatibility. Style tag to inline conversion.",
  category: "developer",
  keywords: ["css inliner", "email css", "html email", "inline css"],
  icon: "Mail",
  requiresNetwork: false,
  seo: {
    title: "HTML Email CSS Inliner — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Inline CSS styles into HTML for email compatibility. Style tag to inline conversion." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) Drag-and-drop file upload; (2) Bulk processing; (3) Live preview; (4) Multiple format support; (5) Quality/size controls; (6) Preset configurations; (7) Export as ZIP; (8) Copy to clipboard; (9) History (localStorage); (10) PWA offline; (11) Privacy-first; (12) WCAG compliant." },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "planned",
};
