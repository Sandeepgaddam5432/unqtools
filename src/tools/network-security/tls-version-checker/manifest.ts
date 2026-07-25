/**
 * TLS Version Reference — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "tls-version-checker",
  name: "TLS Version Reference",
  description: "Reference for TLS 1.0-1.3 versions, ciphers, deprecation status. 100% private. 100% private.",
  category: "network-security",
  keywords: ["tls-version-checker".replace(/-/g, ", "), "network-security"],
  icon: "shield",
  requiresNetwork: false,
  seo: {
    title: "TLS Version Reference | UnQTools",
    faq: [
      { q: "Is this tool private?", a: "Yes. All processing happens locally in your browser. No data is uploaded." },
      { q: "What extras does this tool have?", a: "Extras: (1) Core function, (2) Batch mode, (3) Copy results, (4) Download, (5) History, (6) CSV export, (7) Custom options, (8) Validation, (9) Warnings, (10) Stats, (11) Multi-format, (12) Configurable, (13) Preview." },
    ],
  },
  status: "done",
};
