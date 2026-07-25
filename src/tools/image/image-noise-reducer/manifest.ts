/**
 * Image Noise Reducer — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-noise-reducer",
  name: "Image Noise Reducer",
  description: "Image Noise Reducer with Canvas API. 100% private — runs in your browser.",
  category: "image",
  keywords: ["image,noise,reducer", "image", "canvas", "photo", "filter"],
  icon: "image",
  requiresNetwork: false,
  seo: {
    title: "Image Noise Reducer | UnQTools",
    faq: [
      { q: "Is this tool private?", a: "Yes. All processing happens locally via Canvas API. No image is uploaded." },
      { q: "What extras does this tool have?", a: "Extras: (1) Core filter/effect, (2) Adjustable intensity, (3) Preview, (4) Download PNG/JPEG, (5) Reset, (6) Batch mode, (7) Copy data URL, (8) Custom parameters, (9) Quality control, (10) Multi-format output, (11) Real-time preview, (12) Stats, (13) History." },
    ],
  },
  status: "done",
};
