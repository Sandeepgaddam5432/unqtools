/**
 * JavaScript Obfuscator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "js-obfuscator",
  name: "JavaScript Obfuscator",
  description: "Obfuscate JavaScript code. Variable renaming, string encoding, control flow.",
  category: "developer",
  keywords: ["js obfuscator", "obfuscate javascript", "code obfuscation", "protect js"],
  icon: "Lock",
  requiresNetwork: false,
  seo: {
    title: "JavaScript Obfuscator — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Obfuscate JavaScript code. Variable renaming, string encoding, control flow." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) Drag-and-drop file upload; (2) Bulk processing; (3) Live preview; (4) Multiple format support; (5) Quality/size controls; (6) Preset configurations; (7) Export as ZIP; (8) Copy to clipboard; (9) History (localStorage); (10) PWA offline; (11) Privacy-first; (12) WCAG compliant." },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
