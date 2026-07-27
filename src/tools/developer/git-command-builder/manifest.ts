/**
 * Git Command Builder & Cheatsheet — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "git-command-builder",
  name: "Git Command Builder & Cheatsheet",
  description: "Build git commands visually. Commit, branch, merge, rebase, cherry-pick. Cheatsheet.",
  category: "developer",
  keywords: ["git commands", "git cheatsheet", "git builder", "version control"],
  icon: "Terminal",
  requiresNetwork: false,
  seo: {
    title: "Git Command Builder & Cheatsheet — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Build git commands visually. Commit, branch, merge, rebase, cherry-pick. Cheatsheet." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) Drag-and-drop file upload; (2) Bulk processing; (3) Live preview; (4) Multiple format support; (5) Quality/size controls; (6) Preset configurations; (7) Export as ZIP; (8) Copy to clipboard; (9) History (localStorage); (10) PWA offline; (11) Privacy-first; (12) WCAG compliant." },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
