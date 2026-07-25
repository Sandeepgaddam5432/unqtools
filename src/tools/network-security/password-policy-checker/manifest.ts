/**
 * Password Policy Checker — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "password-policy-checker",
  name: "Password Policy Checker",
  description: "Check password against configurable policy rules (length, complexity, history). 100% private. 100% private.",
  category: "network-security",
  keywords: ["password-policy-checker".replace(/-/g, ", "), "network-security"],
  icon: "shield-check",
  requiresNetwork: false,
  seo: {
    title: "Password Policy Checker | UnQTools",
    faq: [
      { q: "Is this tool private?", a: "Yes. All processing happens locally in your browser. No data is uploaded." },
      { q: "What extras does this tool have?", a: "Extras: (1) Core function, (2) Batch mode, (3) Copy results, (4) Download, (5) History, (6) CSV export, (7) Custom options, (8) Validation, (9) Warnings, (10) Stats, (11) Multi-format, (12) Configurable, (13) Preview." },
    ],
  },
  status: "done",
};
