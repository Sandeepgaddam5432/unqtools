/**
 * Image Contrast Adjuster — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-contrast-adjuster",
  name: "Image Contrast Adjuster",
  description:
    "Adjust image contrast from -100 to +100. Pure Canvas API processing, 100% private, no uploads.",
  category: "image",
  keywords: ["image contrast", "contrast", "increase contrast", "decrease contrast", "tonal range"],
  icon: "contrast",
  requiresNetwork: false,
  seo: {
    title: "Image Contrast Adjuster | UnQTools",
    faq: [
      {
        q: "Are my images uploaded?",
        a: "No. Contrast adjustment runs locally via the Canvas API. Your images never leave your device.",
      },
      {
        q: "What extras does this tool have?",
        a: "Extras: (1) -100 to +100 range, (2) standard contrast formula, (3) live preview, (4) PNG/JPEG/WebP output, (5) quality slider, (6) accessible labels, (7) no upload, (8) fast, (9) keyboard-friendly, (10) drag-and-drop, (11) one-click apply, (12) preserves alpha, (13) lightweight.",
      },
    ],
  },
  status: "done",
};
