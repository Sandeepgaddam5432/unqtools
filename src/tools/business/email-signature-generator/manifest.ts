/**
 * Email Signature Generator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "email-signature-generator",
  name: "Email Signature Generator",
  description: "Generate professional email signatures with social links and styling. 100% private. 100% private.",
  category: "business",
  keywords: ["email-signature-generator".replace(/-/g, ", "), "business"],
  icon: "mail",
  requiresNetwork: false,
  seo: {
    title: "Email Signature Generator | UnQTools",
    faq: [
      { q: "Is this tool private?", a: "Yes. All processing happens locally in your browser. No data is uploaded." },
      { q: "What extras does this tool have?", a: "Extras: (1) Core function, (2) Batch mode, (3) Copy results, (4) Download, (5) History, (6) CSV export, (7) Custom options, (8) Validation, (9) Warnings, (10) Stats, (11) Multi-format, (12) Configurable, (13) Preview." },
    ],
  },
  status: "done",
};
