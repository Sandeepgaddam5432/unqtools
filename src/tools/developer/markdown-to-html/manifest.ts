/**
 * Markdown to HTML Converter — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "markdown-to-html",
  name: "Markdown to HTML Converter",
  description: "Convert markdown to HTML. GitHub-flavored, syntax highlighting, table support.",
  category: "developer",
  keywords: ["markdown to html", "md to html", "markdown converter", "md html"],
  icon: "FileText",
  requiresNetwork: false,
  seo: {
    title: "Markdown to HTML Converter — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Convert markdown to HTML. GitHub-flavored, syntax highlighting, table support." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) Drag-and-drop file upload; (2) Bulk processing; (3) Live preview; (4) Multiple format support; (5) Quality/size controls; (6) Preset configurations; (7) Export as ZIP; (8) Copy to clipboard; (9) History (localStorage); (10) PWA offline; (11) Privacy-first; (12) WCAG compliant." },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
