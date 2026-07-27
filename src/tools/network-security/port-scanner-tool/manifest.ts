/**
 * Port Scanner — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "port-scanner-tool",
  name: "Port Scanner",
  description: "Reference tool for common network ports. Generate port scan commands and port assignments.",
  category: "network-security",
  keywords: ["port scanner", "port scan", "network ports", "port reference"],
  icon: "Radar",
  requiresNetwork: false,
  seo: {
    title: "Port Scanner — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Reference tool for common network ports. Generate port scan commands and port assignments." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) Drag-and-drop file upload; (2) Bulk processing; (3) Live preview; (4) Multiple format support; (5) Quality/size controls; (6) Preset configurations; (7) Export as ZIP; (8) Copy to clipboard; (9) History (localStorage); (10) PWA offline; (11) Privacy-first; (12) WCAG compliant." },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
