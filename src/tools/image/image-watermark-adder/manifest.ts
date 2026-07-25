/**
 * Image Watermark Adder — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-watermark-adder",
  name: "Image Watermark Adder",
  description:
    "Add a text watermark to images with custom position, opacity, font size and color. 100% private — no uploads.",
  category: "image",
  keywords: [
    "image watermark",
    "watermark",
    "add text to image",
    "stamp image",
    "image overlay text",
  ],
  icon: "droplets",
  requiresNetwork: false,
  seo: {
    title: "Image Watermark Adder — Text Overlay | UnQTools",
    faq: [
      {
        q: "Are my images uploaded?",
        a: "No. Watermarking happens locally via the Canvas API. Your images never leave your device.",
      },
      {
        q: "What extras does this tool have?",
        a: "Extras: (1) custom text, (2) 9 position presets, (3) opacity slider, (4) font size, (5) color picker, (6) rotation, (7) tile mode, (8) PNG/JPEG/WebP output, (9) live preview, (10) quality slider, (11) accessible labels, (12) no upload, (13) keyboard-friendly.",
      },
    ],
  },
  status: "done",
};
