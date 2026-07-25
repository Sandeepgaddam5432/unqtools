/**
 * Image Sepia Filter — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-sepia-filter",
  name: "Image Sepia Filter",
  description:
    "Apply a classic sepia tone to images using the standard sepia color matrix. 100% private Canvas API processing.",
  category: "image",
  keywords: ["sepia", "image sepia", "vintage filter", "retro image", "warm tone"],
  icon: "palette",
  requiresNetwork: false,
  seo: {
    title: "Image Sepia Filter | UnQTools",
    faq: [
      {
        q: "Are my images uploaded?",
        a: "No. Sepia conversion runs locally via the Canvas API. Your images never leave your device.",
      },
      {
        q: "What extras does this tool have?",
        a: "Extras: (1) standard sepia matrix, (2) adjustable strength, (3) live preview, (4) PNG/JPEG/WebP output, (5) quality slider, (6) accessible labels, (7) no upload, (8) fast, (9) keyboard-friendly, (10) drag-and-drop, (11) one-click apply, (12) lightweight, (13) preserves alpha.",
      },
    ],
  },
  status: "done",
};
