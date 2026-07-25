/**
 * Base64 to Image — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "base64-to-image",
  name: "Base64 to Image",
  description:
    "Convert a Base64 data URL back into a downloadable image file. 100% private — runs entirely in your browser.",
  category: "image",
  keywords: ["base64 to image", "decode base64", "data url to image", "base64 decoder", "base64 converter"],
  icon: "link",
  requiresNetwork: false,
  seo: {
    title: "Base64 to Image Converter | UnQTools",
    faq: [
      {
        q: "Are my data URLs uploaded?",
        a: "No. Decoding happens locally in the browser. Your data never leaves your device.",
      },
      {
        q: "What extras does this tool have?",
        a: "Extras: (1) data URL parser, (2) MIME detection, (3) live preview, (4) download as image, (5) paste support, (6) filename suggestion, (7) PNG/JPEG/WebP support, (8) accessible labels, (9) no upload, (10) clipboard-friendly, (11) keyboard input, (12) error handling, (13) lightweight.",
      },
    ],
  },
  status: "done",
};
