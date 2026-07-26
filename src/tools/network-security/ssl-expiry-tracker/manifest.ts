/**
 * SSL Expiry Countdown Tracker — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ssl-expiry-tracker",
  name: "SSL Expiry Countdown Tracker",
  description: "Track SSL certificate expiry dates with multi-domain support and warning thresholds. 100% private. 100% private.",
  category: "network-security",
  keywords: ["ssl-expiry-tracker".replace(/-/g, ", "), "network-security"],
  icon: "clock",
  requiresNetwork: false,
  seo: {
    title: "SSL Expiry Countdown Tracker | UnQTools",
    faq: [
      { q: "Is this tool private?", a: "Yes. All processing happens locally in your browser. No data is uploaded." },
      { q: "What extras does this tool have?", a: "Extras: (1) Core function, (2) Batch mode, (3) Copy results, (4) Download, (5) History, (6) CSV export, (7) Custom options, (8) Validation, (9) Warnings, (10) Stats, (11) Multi-format, (12) Configurable, (13) Preview." },
    ],
  },
  status: "done",
};
