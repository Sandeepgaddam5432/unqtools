/**
 * SHA-3 Hash Generator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "sha3-hash-generator",
  name: "SHA-3 Hash Generator",
  description: "Generate SHA-3 (Keccak) hashes. SHA3-256, SHA3-512, pure JS.",
  category: "developer",
  keywords: ["sha3", "sha-3", "keccak", "sha3 hash"],
  icon: "Hash",
  requiresNetwork: false,
  seo: {
    title: "SHA-3 Hash Generator — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Generate SHA-3 (Keccak) hashes. SHA3-256, SHA3-512, pure JS." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) Drag-and-drop file upload; (2) Bulk processing; (3) Live preview; (4) Multiple format support; (5) Quality/size controls; (6) Preset configurations; (7) Export as ZIP; (8) Copy to clipboard; (9) History (localStorage); (10) PWA offline; (11) Privacy-first; (12) WCAG compliant." },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "planned",
};
