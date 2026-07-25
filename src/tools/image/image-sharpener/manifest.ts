/**
 * Image Sharpener — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-sharpener",
  name: "Image Sharpener",
  description:
    "Sharpen images using a 3×3 convolution kernel with adjustable strength. 100% private Canvas API processing.",
  category: "image",
  keywords: ["image sharpen", "sharpen", "convolution", "edge enhance", "unsharp mask"],
  icon: "sparkles",
  requiresNetwork: false,
  seo: {
    title: "Image Sharpener — Convolution Kernel | UnQTools",
    faq: [
      {
        q: "Are my images uploaded?",
        a: "No. Sharpening runs locally via the Canvas API. Your images never leave your device.",
      },
      {
        q: "What extras does this tool have?",
        a: "Extras: (1) 3×3 convolution kernel, (2) adjustable strength, (3) live preview, (4) PNG/JPEG/WebP output, (5) quality slider, (6) accessible labels, (7) no upload, (8) edge-aware, (9) keyboard-friendly, (10) drag-and-drop, (11) one-click apply, (12) lightweight, (13) preserves alpha.",
      },
    ],
  },
  status: "done",
};
