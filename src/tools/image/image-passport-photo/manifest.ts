/**
 * Passport Photo Maker — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-passport-photo",
  name: "Passport Photo Maker",
  description: "Create passport photos with country-specific sizes, head positioning guide, background check. 100% private. 100% private.",
  category: "image",
  keywords: ["image-passport-photo".replace(/-/g, ", "), "image"],
  icon: "user",
  requiresNetwork: false,
  seo: {
    title: "Passport Photo Maker | UnQTools",
    faq: [
      { q: "Is this tool private?", a: "Yes. All processing happens locally in your browser. No data is uploaded." },
      { q: "What extras does this tool have?", a: "Extras: (1) Core function, (2) Batch mode, (3) Copy results, (4) Download, (5) History, (6) CSV export, (7) Custom options, (8) Validation, (9) Warnings, (10) Stats, (11) Multi-format, (12) Configurable, (13) Preview." },
    ],
  },
  status: "done",
};
