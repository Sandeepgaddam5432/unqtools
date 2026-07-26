/**
 * Image Upscaler — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-upscaler",
  name: "Image Upscaler",
  description: "Upscale images with Lanczos/bilinear interpolation and sharpening. 100% private. 100% private.",
  category: "image",
  keywords: ["image-upscaler".replace(/-/g, ", "), "image"],
  icon: "maximize-2",
  requiresNetwork: false,
  seo: {
    title: "Image Upscaler | UnQTools",
    faq: [
      { q: "Is this tool private?", a: "Yes. All processing happens locally in your browser. No data is uploaded." },
      { q: "What extras does this tool have?", a: "Extras: (1) Core function, (2) Batch mode, (3) Copy results, (4) Download, (5) History, (6) CSV export, (7) Custom options, (8) Validation, (9) Warnings, (10) Stats, (11) Multi-format, (12) Configurable, (13) Preview." },
    ],
  },
  status: "done",
};
