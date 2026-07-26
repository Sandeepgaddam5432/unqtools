/**
 * Atbash Cipher — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "atbash-cipher",
  name: "Atbash Cipher",
  description: "Encode/decode Atbash cipher (a↔z, A↔Z). Latin, Hebrew, Greek, Cyrillic alphabets. Self-inverse.",
  category: "developer",
  keywords: ["atbash cipher", "atbash cipher", "encode", "decode", "converter"],
  icon: "Lock",
  requiresNetwork: false,
  seo: {
    title: "Atbash Cipher — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Encode/decode Atbash cipher (a↔z, A↔Z). Latin, Hebrew, Greek, Cyrillic alphabets. Self-inverse." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded or tracked." },
      { q: "What extra features does this tool have?", a: "Extras: (1) Multiple modes/formats, (2) Live preview, (3) Import/export, (4) Bulk mode, (5) Copy/download, (6) History (localStorage), (7) Randomize, (8) Presets, (9) Validation, (10) PWA offline, (11) UTF-8 safe, (12) Dark mode." },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
