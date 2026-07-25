/**
 * Image Rotator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-rotator",
  name: "Image Rotator",
  description:
    "Rotate images 90, 180, 270 or any custom degrees. Pure Canvas API, 100% client-side, no uploads.",
  category: "image",
  keywords: ["image rotator", "rotate image", "rotate 90", "rotate 180", "rotate 270", "turn image"],
  icon: "rotate-cw",
  requiresNetwork: false,
  seo: {
    title: "Image Rotator — 90 / 180 / 270 / Custom | UnQTools",
    faq: [
      {
        q: "Are my images uploaded?",
        a: "No. Rotation runs locally in the browser via the Canvas API. Your images never leave your device.",
      },
      {
        q: "What extras does this tool have?",
        a: "Extras: (1) 90/180/270 quick buttons, (2) custom degree input, (3) clockwise/counter-clockwise, (4) live preview, (5) PNG/JPEG/WebP output, (6) auto canvas sizing for any angle, (7) quality slider, (8) accessible labels, (9) no upload, (10) preserves quality, (11) keyboard-friendly, (12) drag-and-drop, (13) bbox-aware rotation.",
      },
    ],
  },
  status: "done",
};
