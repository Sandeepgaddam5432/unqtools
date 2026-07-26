/**
 * Free Proxy List Verifier — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "free-proxy-verifier",
  name: "Free Proxy List Verifier",
  description: "Verify proxy lists with format validation and connection test reference. 100% private. 100% private.",
  category: "network-security",
  keywords: ["free-proxy-verifier".replace(/-/g, ", "), "network-security"],
  icon: "shield",
  requiresNetwork: false,
  seo: {
    title: "Free Proxy List Verifier | UnQTools",
    faq: [
      { q: "Is this tool private?", a: "Yes. All processing happens locally in your browser. No data is uploaded." },
      { q: "What extras does this tool have?", a: "Extras: (1) Core function, (2) Batch mode, (3) Copy results, (4) Download, (5) History, (6) CSV export, (7) Custom options, (8) Validation, (9) Warnings, (10) Stats, (11) Multi-format, (12) Configurable, (13) Preview." },
    ],
  },
  status: "done",
};
