/**
 * Image Brightness Adjuster — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-brightness-adjuster",
  name: "Image Brightness Adjuster",
  description:
    "Adjust image brightness from -100 to +100. Pure Canvas API processing, 100% private, no uploads.",
  category: "image",
  keywords: ["image brightness", "brightness", "lighten image", "darken image", "exposure"],
  icon: "sun",
  requiresNetwork: false,
  seo: {
    title: "Image Brightness Adjuster | UnQTools",
    faq: [
      {
        q: "Are my images uploaded?",
        a: "No. Brightness adjustment runs locally via the Canvas API. Your images never leave your device.",
      },
      {
        q: "What extras does this tool have?",
        a: "Extras: (1) -100 to +100 range, (2) live preview, (3) PNG/JPEG/WebP output, (4) quality slider, (5) accessible labels, (6) no upload, (7) fast pixel processing, (8) keyboard-friendly, (9) drag-and-drop, (10) one-click apply, (11) lightweight, (12) preserves alpha, (13) clamped output.",
      },
    ],
  },
  status: "done",
};
