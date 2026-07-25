/**
 * Image Collage Maker — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-collage-maker",
  name: "Image Collage Maker",
  description:
    "Combine multiple images into a grid collage with adjustable columns, gaps and background. 100% private Canvas API.",
  category: "image",
  keywords: ["image collage", "photo grid", "image grid", "combine images", "montage"],
  icon: "grid-2x2",
  requiresNetwork: false,
  seo: {
    title: "Image Collage Maker — Grid Layout | UnQTools",
    faq: [
      {
        q: "Are my images uploaded?",
        a: "No. Collage composition runs locally via the Canvas API. Your images never leave your device.",
      },
      {
        q: "What extras does this tool have?",
        a: "Extras: (1) adjustable columns, (2) gap control, (3) background color, (4) auto-rows, (5) PNG/JPEG/WebP output, (6) quality slider, (7) live preview, (8) accessible labels, (9) no upload, (10) multi-file input, (11) drag-and-drop reorder, (12) fit/cover modes, (13) lightweight.",
      },
    ],
  },
  status: "done",
};
