/**
 * Image Blur Tool — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-blur-tool",
  name: "Image Blur Tool",
  description:
    "Apply a Gaussian-style blur to images using a fast box-blur approximation. 100% private Canvas API processing.",
  category: "image",
  keywords: ["image blur", "gaussian blur", "box blur", "soften image", "blur filter"],
  icon: "droplets",
  requiresNetwork: false,
  seo: {
    title: "Image Blur Tool — Gaussian / Box Blur | UnQTools",
    faq: [
      {
        q: "Are my images uploaded?",
        a: "No. Blurring happens locally via the Canvas API. Your images never leave your device.",
      },
      {
        q: "What extras does this tool have?",
        a: "Extras: (1) adjustable radius, (2) box-blur approximation, (3) separable horizontal/vertical passes, (4) live preview, (5) PNG/JPEG/WebP output, (6) quality slider, (7) accessible labels, (8) no upload, (9) fast, (10) keyboard-friendly, (11) drag-and-drop, (12) alpha preservation, (13) repeatable passes.",
      },
    ],
  },
  status: "done",
};
