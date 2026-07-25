/**
 * Image Color Extractor — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-color-extractor",
  name: "Image Color Extractor",
  description:
    "Extract dominant colors from an image using a lightweight k-means quantization. 100% private, no uploads.",
  category: "image",
  keywords: ["color extractor", "dominant colors", "palette from image", "image colors", "k-means colors"],
  icon: "pipette",
  requiresNetwork: false,
  seo: {
    title: "Image Color Extractor — Palette Generator | UnQTools",
    faq: [
      {
        q: "Are my images uploaded?",
        a: "No. Color extraction runs locally via the Canvas API. Your images never leave your device.",
      },
      {
        q: "What extras does this tool have?",
        a: "Extras: (1) adjustable color count, (2) k-means lite clustering, (3) hex output, (4) RGB output, (5) copyable palette, (6) live preview, (7) accessible labels, (8) no upload, (9) fast sampling, (10) keyboard-friendly, (11) drag-and-drop, (12) percentage weights, (13) lightweight.",
      },
    ],
  },
  status: "done",
};
