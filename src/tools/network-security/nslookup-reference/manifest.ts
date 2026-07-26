/**
 * NSLookup Reference — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "nslookup-reference",
  name: "NSLookup Reference",
  description: "Reference for DNS lookup types (A, AAAA, MX, TXT, CNAME, NS, SOA) with query builder. 100% private. 100% private.",
  category: "network-security",
  keywords: ["nslookup-reference".replace(/-/g, ", "), "network-security"],
  icon: "globe",
  requiresNetwork: false,
  seo: {
    title: "NSLookup Reference | UnQTools",
    faq: [
      { q: "Is this tool private?", a: "Yes. All processing happens locally in your browser. No data is uploaded." },
      { q: "What extras does this tool have?", a: "Extras: (1) Core function, (2) Batch mode, (3) Copy results, (4) Download, (5) History, (6) CSV export, (7) Custom options, (8) Validation, (9) Warnings, (10) Stats, (11) Multi-format, (12) Configurable, (13) Preview." },
    ],
  },
  status: "done",
};
