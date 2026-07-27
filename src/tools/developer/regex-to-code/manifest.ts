/**
 * Regex to Code (JS/Python/PHP) — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "regex-to-code",
  name: "Regex to Code (JS/Python/PHP)",
  description: "Convert regex patterns to code in JavaScript, Python, PHP.",
  category: "developer",
  keywords: ["regex to code", "regexp code", "convert regex", "regex"],
  icon: "Code2",
  requiresNetwork: false,
  seo: {
    title: "Regex to Code (JS/Python/PHP) — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Convert regex patterns to code in JavaScript, Python, PHP." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) Drag-and-drop file upload; (2) Bulk processing; (3) Live preview; (4) Multiple format support; (5) Quality/size controls; (6) Preset configurations; (7) Export as ZIP; (8) Copy to clipboard; (9) History (localStorage); (10) PWA offline; (11) Privacy-first; (12) WCAG compliant." },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
