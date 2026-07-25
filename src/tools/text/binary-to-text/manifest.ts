/**
 * Binary To Text — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "binary-to-text",
  name: "Binary To Text",
  description: "Binary To Text with multiple modes and options. 100% private.",
  category: "text",
  keywords: ["binary,to,text", "text", "convert", "transform"],
  icon: "type",
  requiresNetwork: false,
  seo: {
    title: "Binary To Text | UnQTools",
    faq: [
      { q: "Is this tool private?", a: "Yes. All processing happens locally in your browser." },
      { q: "What extras does this tool have?", a: "Extras: (1) Core function, (2) Batch mode, (3) Copy results, (4) Download, (5) History, (6) CSV export, (7) Custom options, (8) Validation, (9) Warnings, (10) Stats, (11) Multi-format, (12) Configurable, (13) Preview." },
    ],
  },
  status: "done",
};
