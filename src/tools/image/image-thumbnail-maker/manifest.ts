/**
 * Image Thumbnail Maker — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-thumbnail-maker",
  name: "Image Thumbnail Maker",
  description:
    "Generate image thumbnails at multiple sizes (64, 128, 256, 512). Pure Canvas API processing, 100% private.",
  category: "image",
  keywords: ["image thumbnail", "thumbnail maker", "image sizes", "preview image", "generate thumbnails"],
  icon: "maximize-2",
  requiresNetwork: false,
  seo: {
    title: "Image Thumbnail Maker — Multi-Size | UnQTools",
    faq: [
      {
        q: "Are my images uploaded?",
        a: "No. Thumbnail generation runs locally via the Canvas API. Your images never leave your device.",
      },
      {
        q: "What extras does this tool have?",
        a: "Extras: (1) 4 default sizes, (2) custom sizes, (3) bulk download, (4) PNG/JPEG/WebP output, (5) quality slider, (6) live preview, (7) accessible labels, (8) no upload, (9) fast, (10) keyboard-friendly, (11) drag-and-drop, (12) aspect-ratio preservation, (13) one-click download all.",
      },
    ],
  },
  status: "done",
};
