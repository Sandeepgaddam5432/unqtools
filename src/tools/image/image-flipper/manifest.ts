/**
 * Image Flipper — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-flipper",
  name: "Image Flipper",
  description:
    "Flip images horizontally, vertically, or both. Pure Canvas API, 100% private, no server uploads.",
  category: "image",
  keywords: ["image flipper", "flip image", "mirror image", "flip horizontal", "flip vertical", "reflect image"],
  icon: "flip-horizontal",
  requiresNetwork: false,
  seo: {
    title: "Image Flipper — Horizontal & Vertical | UnQTools",
    faq: [
      {
        q: "Are my images uploaded?",
        a: "No. Flipping happens locally in the browser via the Canvas API. Your images never leave your device.",
      },
      {
        q: "What extras does this tool have?",
        a: "Extras: (1) flip horizontal, (2) flip vertical, (3) flip both, (4) live preview, (5) PNG/JPEG/WebP output, (6) quality slider, (7) one-click presets, (8) accessible labels, (9) keyboard-friendly, (10) no upload, (11) drag-and-drop, (12) lightweight, (13) preserves resolution.",
      },
    ],
  },
  status: "done",
};
