/**
 * CRC32 Calculator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "crc32-calculator",
  name: "CRC32 Calculator",
  description: "Calculate CRC32 (IEEE 802.3), CRC32C (Castagnoli), CRC32B. Hex + decimal output. File support.",
  category: "developer",
  keywords: ["crc32 calculator", "crc32 calculator", "encode", "decode", "converter"],
  icon: "Hash",
  requiresNetwork: false,
  seo: {
    title: "CRC32 Calculator — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Calculate CRC32 (IEEE 802.3), CRC32C (Castagnoli), CRC32B. Hex + decimal output. File support." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded or tracked." },
      { q: "What extra features does this tool have?", a: "Extras: (1) Multiple modes/formats, (2) Live preview, (3) Import/export, (4) Bulk mode, (5) Copy/download, (6) History (localStorage), (7) Randomize, (8) Presets, (9) Validation, (10) PWA offline, (11) UTF-8 safe, (12) Dark mode." },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "planned",
};
