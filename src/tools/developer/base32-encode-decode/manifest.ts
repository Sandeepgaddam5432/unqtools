/**
 * Base32 Encode/Decode — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "base32-encode-decode",
  name: "Base32 Encode/Decode",
  description: "RFC 4648 Base32 encoding/decoding (standard, base32hex, Crockford). UTF-8 safe.",
  category: "developer",
  keywords: ["base32 encode decode", "base32 encode/decode", "encode", "decode", "converter"],
  icon: "Binary",
  requiresNetwork: false,
  seo: {
    title: "Base32 Encode/Decode — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "RFC 4648 Base32 encoding/decoding (standard, base32hex, Crockford). UTF-8 safe." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded or tracked." },
      { q: "What extra features does this tool have?", a: "Extras: (1) Multiple modes/formats, (2) Live preview, (3) Import/export, (4) Bulk mode, (5) Copy/download, (6) History (localStorage), (7) Randomize, (8) Presets, (9) Validation, (10) PWA offline, (11) UTF-8 safe, (12) Dark mode." },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
