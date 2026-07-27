/**
 * Conventional Commit Message Builder — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "conventional-commit-builder",
  name: "Conventional Commit Message Builder",
  description: "Build conventional commit messages. feat, fix, docs, chore, scope, breaking changes.",
  category: "developer",
  keywords: ["conventional commits", "commit message", "semantic commits", "git"],
  icon: "GitCommit",
  requiresNetwork: false,
  seo: {
    title: "Conventional Commit Message Builder — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Build conventional commit messages. feat, fix, docs, chore, scope, breaking changes." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) Drag-and-drop file upload; (2) Bulk processing; (3) Live preview; (4) Multiple format support; (5) Quality/size controls; (6) Preset configurations; (7) Export as ZIP; (8) Copy to clipboard; (9) History (localStorage); (10) PWA offline; (11) Privacy-first; (12) WCAG compliant." },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
