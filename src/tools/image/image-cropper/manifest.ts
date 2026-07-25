/**
 * Image Cropper — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-cropper",
  name: "Image Cropper",
  description:
    "Crop images to a custom rectangle with adjustable x, y, width and height. 100% client-side Canvas API, no uploads.",
  category: "image",
  keywords: ["image cropper", "crop image", "trim image", "cut image", "rectangle crop"],
  icon: "crop",
  requiresNetwork: false,
  seo: {
    title: "Image Cropper — Custom Rectangle | UnQTools",
    faq: [
      {
        q: "Are my images uploaded?",
        a: "No. Cropping happens locally in the browser via the Canvas API. Your images never leave your device.",
      },
      {
        q: "What extras does this tool have?",
        a: "Extras: (1) custom x/y/width/height, (2) preset aspect ratios (1:1, 16:9, 4:3), (3) live preview, (4) PNG/JPEG/WebP output, (5) quality slider, (6) bounds validation, (7) drag-and-drop, (8) keyboard input, (9) accessible labels, (10) aspect-ratio lock, (11) quick presets, (12) original-size readout, (13) no upload.",
      },
    ],
  },
  status: "done",
};
