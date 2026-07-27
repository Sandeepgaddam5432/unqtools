/**
 * OpenAPI/Swagger Viewer & Editor — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "openapi-viewer-editor",
  name: "OpenAPI/Swagger Viewer & Editor",
  description: "View and edit OpenAPI/Swagger specs. Syntax highlighting, validation.",
  category: "developer",
  keywords: ["openapi", "swagger", "api spec", "openapi viewer"],
  icon: "FileJson",
  requiresNetwork: false,
  seo: {
    title: "OpenAPI/Swagger Viewer & Editor — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "View and edit OpenAPI/Swagger specs. Syntax highlighting, validation." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) Drag-and-drop file upload; (2) Bulk processing; (3) Live preview; (4) Multiple format support; (5) Quality/size controls; (6) Preset configurations; (7) Export as ZIP; (8) Copy to clipboard; (9) History (localStorage); (10) PWA offline; (11) Privacy-first; (12) WCAG compliant." },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
