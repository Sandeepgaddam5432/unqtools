/**
 * Image Grayscale Converter — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-grayscale-converter",
  name: "Image Grayscale Converter",
  description:
    "Convert images to grayscale using the ITU-R BT.601 luminance formula. 100% private Canvas API processing.",
  category: "image",
  keywords: ["grayscale", "black and white", "image grayscale", "luminance", "desaturate"],
  icon: "contrast",
  requiresNetwork: false,
  seo: {
    title: "Image Grayscale Converter | UnQTools",
    faq: [
      {
        q: "Are my images uploaded?",
        a: "No. Grayscale conversion runs locally via the Canvas API. Your images never leave your device.",
      },
      {
        q: "What extras does this tool have?",
        a: "Extras: (1) BT.601 luminance formula, (2) adjustable strength, (3) live preview, (4) PNG/JPEG/WebP output, (5) quality slider, (6) accessible labels, (7) no upload, (8) fast pixel processing, (9) keyboard-friendly, (10) drag-and-drop, (11) one-click apply, (12) lightweight, (13) preserves alpha.",
      },
    ],
  },
  status: "done",
};
