/**
 * Code to Image Screenshot Generator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "code-to-image",
  name: "Code to Image Screenshot Generator",
  description: "Convert code snippets to beautiful images. Syntax highlighting, themes, watermarks.",
  category: "developer",
  keywords: ["code image", "code screenshot", "carbon", "code to png"],
  icon: "Code",
  requiresNetwork: false,
  seo: {
    title: "Code to Image Screenshot Generator — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Convert code snippets to beautiful images. Syntax highlighting, themes, watermarks." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) Drag-and-drop file upload; (2) Bulk processing; (3) Live preview; (4) Multiple format support; (5) Quality/size controls; (6) Preset configurations; (7) Export as ZIP; (8) Copy to clipboard; (9) History (localStorage); (10) PWA offline; (11) Privacy-first; (12) WCAG compliant." },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
