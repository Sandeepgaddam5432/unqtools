/**
 * Image Cartoonizer — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-cartoonizer",
  name: "Image Cartoonizer",
  description: "Convert photos to cartoon style with edge detection and color quantization. 100% private. 100% private.",
  category: "image",
  keywords: ["image-cartoonizer".replace(/-/g, ", "), "image"],
  icon: "sparkles",
  requiresNetwork: false,
  seo: {
    title: "Image Cartoonizer | UnQTools",
    faq: [
      { q: "Is this tool private?", a: "Yes. All processing happens locally in your browser. No data is uploaded." },
      { q: "What extras does this tool have?", a: "Extras: (1) Core function, (2) Batch mode, (3) Copy results, (4) Download, (5) History, (6) CSV export, (7) Custom options, (8) Validation, (9) Warnings, (10) Stats, (11) Multi-format, (12) Configurable, (13) Preview." },
    ],
  },
  status: "done",
};
