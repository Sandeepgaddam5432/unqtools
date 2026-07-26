/**
 * CORS Tester & Config Generator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "cors-tester-config-generator",
  name: "CORS Tester & Config Generator",
  description: "Generate CORS headers. Preflight simulator. Server config for Nginx/Apache/Express/Cloudflare.",
  category: "developer",
  keywords: ["cors tester config generator", "cors tester & config generator", "encode", "decode", "converter"],
  icon: "Globe",
  requiresNetwork: false,
  seo: {
    title: "CORS Tester & Config Generator — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Generate CORS headers. Preflight simulator. Server config for Nginx/Apache/Express/Cloudflare." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded or tracked." },
      { q: "What extra features does this tool have?", a: "Extras: (1) Multiple modes/formats, (2) Live preview, (3) Import/export, (4) Bulk mode, (5) Copy/download, (6) History (localStorage), (7) Randomize, (8) Presets, (9) Validation, (10) PWA offline, (11) UTF-8 safe, (12) Dark mode." },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
