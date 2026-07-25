/**
 * Image Resizer — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-resizer",
  name: "Image Resizer",
  description:
    "Resize images to custom width and height with optional aspect-ratio lock. Pure Canvas API, 100% private — no uploads.",
  category: "image",
  keywords: [
    "image resizer",
    "resize image",
    "scale image",
    "change image dimensions",
    "aspect ratio",
    "image dimensions",
  ],
  icon: "maximize-2",
  requiresNetwork: false,
  seo: {
    title: "Image Resizer — Custom Width & Height | UnQTools",
    faq: [
      {
        q: "Are my images uploaded?",
        a: "No. All resizing happens locally in the browser via the Canvas API. Your images never leave your device.",
      },
      {
        q: "What extras does this tool have?",
        a: "Extras: (1) custom width/height, (2) aspect-ratio lock, (3) percent-based scaling, (4) preset sizes, (5) PNG/JPEG/WebP output, (6) quality slider, (7) live preview, (8) drag-and-drop, (9) bulk-friendly, (10) no upload, (11) preserves orientation, (12) keyboard-friendly, (13) accessible labels.",
      },
    ],
  },
  status: "done",
};
