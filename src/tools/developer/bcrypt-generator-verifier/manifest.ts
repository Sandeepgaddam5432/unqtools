/**
 * Bcrypt Generator/Verifier — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "bcrypt-generator-verifier",
  name: "Bcrypt Generator/Verifier",
  description: "Generate and verify bcrypt password hashes. Cost 4-31. $2a/$2b/$2y prefix. Bulk verify.",
  category: "developer",
  keywords: ["bcrypt generator verifier", "bcrypt generator/verifier", "encode", "decode", "converter"],
  icon: "KeyRound",
  requiresNetwork: false,
  seo: {
    title: "Bcrypt Generator/Verifier — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Generate and verify bcrypt password hashes. Cost 4-31. $2a/$2b/$2y prefix. Bulk verify." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded or tracked." },
      { q: "What extra features does this tool have?", a: "Extras: (1) Multiple modes/formats, (2) Live preview, (3) Import/export, (4) Bulk mode, (5) Copy/download, (6) History (localStorage), (7) Randomize, (8) Presets, (9) Validation, (10) PWA offline, (11) UTF-8 safe, (12) Dark mode." },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "planned",
};
