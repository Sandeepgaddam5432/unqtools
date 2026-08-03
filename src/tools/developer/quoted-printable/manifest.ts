/**
 * Quoted-Printable Encode/Decode — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "quoted-printable",
  name: "Quoted-Printable Encode/Decode",
  description: "Encode/decode quoted-printable format. RFC 2045, email bodies.",
  category: "developer",
  keywords: ["quoted printable", "qp encode", "email encoding", "mime"],
  icon: "Mail",
  requiresNetwork: false,
  seo: {
    title: "Quoted-Printable Encode/Decode — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Encode/decode quoted-printable format. RFC 2045, email bodies." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) Drag-and-drop file upload; (2) Bulk processing; (3) Live preview; (4) Multiple format support; (5) Quality/size controls; (6) Preset configurations; (7) Export as ZIP; (8) Copy to clipboard; (9) History (localStorage); (10) PWA offline; (11) Privacy-first; (12) WCAG compliant." },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "planned",
};
