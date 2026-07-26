/**
 * Argon2 Parameter Calculator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "argon2-param-calculator",
  name: "Argon2 Parameter Calculator",
  description: "Calculate Argon2 parameters (memory, iterations, parallelism) per OWASP RFC 9106. 100% private. 100% private.",
  category: "network-security",
  keywords: ["argon2-param-calculator".replace(/-/g, ", "), "network-security"],
  icon: "cpu",
  requiresNetwork: false,
  seo: {
    title: "Argon2 Parameter Calculator | UnQTools",
    faq: [
      { q: "Is this tool private?", a: "Yes. All processing happens locally in your browser. No data is uploaded." },
      { q: "What extras does this tool have?", a: "Extras: (1) Core function, (2) Batch mode, (3) Copy results, (4) Download, (5) History, (6) CSV export, (7) Custom options, (8) Validation, (9) Warnings, (10) Stats, (11) Multi-format, (12) Configurable, (13) Preview." },
    ],
  },
  status: "done",
};
