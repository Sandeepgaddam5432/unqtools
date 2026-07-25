/**
 * Image Color Inverter — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-color-inverter",
  name: "Image Color Inverter",
  description:
    "Invert image colors to create a photographic negative effect. Pure Canvas API, 100% private, no uploads.",
  category: "image",
  keywords: ["image inverter", "invert colors", "negative image", "color invert", "photo negative"],
  icon: "contrast",
  requiresNetwork: false,
  seo: {
    title: "Image Color Inverter — Negative Effect | UnQTools",
    faq: [
      {
        q: "Are my images uploaded?",
        a: "No. Inversion runs locally in the browser via the Canvas API. Your images never leave your device.",
      },
      {
        q: "What extras does this tool have?",
        a: "Extras: (1) full color inversion, (2) partial inversion strength, (3) live preview, (4) PNG/JPEG/WebP output, (5) quality slider, (6) alpha preservation, (7) accessible labels, (8) no upload, (9) fast, (10) keyboard-friendly, (11) drag-and-drop, (12) one-click apply, (13) lightweight.",
      },
    ],
  },
  status: "done",
};
