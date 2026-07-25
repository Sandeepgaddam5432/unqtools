/**
 * Image Hue Rotator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-hue-rotator",
  name: "Image Hue Rotator",
  description:
    "Rotate image hue 0-360 degrees using HSL conversion. Pure Canvas API processing, 100% private, no uploads.",
  category: "image",
  keywords: ["image hue", "hue rotate", "color shift", "color rotate", "hsl"],
  icon: "palette",
  requiresNetwork: false,
  seo: {
    title: "Image Hue Rotator | UnQTools",
    faq: [
      {
        q: "Are my images uploaded?",
        a: "No. Hue rotation runs locally via the Canvas API. Your images never leave your device.",
      },
      {
        q: "What extras does this tool have?",
        a: "Extras: (1) 0-360 degree range, (2) HSL-based rotation, (3) live preview, (4) PNG/JPEG/WebP output, (5) quality slider, (6) accessible labels, (7) no upload, (8) fast, (9) keyboard-friendly, (10) drag-and-drop, (11) one-click apply, (12) preserves luminance, (13) lightweight.",
      },
    ],
  },
  status: "done",
};
