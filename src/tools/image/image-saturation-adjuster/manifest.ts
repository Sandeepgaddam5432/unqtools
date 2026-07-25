/**
 * Image Saturation Adjuster — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-saturation-adjuster",
  name: "Image Saturation Adjuster",
  description:
    "Adjust image saturation from -100 (grayscale) to +100 (vivid). Pure Canvas API processing, 100% private.",
  category: "image",
  keywords: ["image saturation", "saturation", "vivid colors", "desaturate", "color intensity"],
  icon: "droplets",
  requiresNetwork: false,
  seo: {
    title: "Image Saturation Adjuster | UnQTools",
    faq: [
      {
        q: "Are my images uploaded?",
        a: "No. Saturation adjustment runs locally via the Canvas API. Your images never leave your device.",
      },
      {
        q: "What extras does this tool have?",
        a: "Extras: (1) -100 to +100 range, (2) HSL-based saturation, (3) live preview, (4) PNG/JPEG/WebP output, (5) quality slider, (6) accessible labels, (7) no upload, (8) fast, (9) keyboard-friendly, (10) drag-and-drop, (11) one-click apply, (12) preserves alpha, (13) lightweight.",
      },
    ],
  },
  status: "done",
};
