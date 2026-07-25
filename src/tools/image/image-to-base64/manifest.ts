/**
 * Image to Base64 — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-to-base64",
  name: "Image to Base64",
  description:
    "Convert image files to Base64 data URLs for inline embedding. 100% private — runs entirely in the browser.",
  category: "image",
  keywords: ["image to base64", "base64 image", "data url", "inline image", "image embed"],
  icon: "binary",
  requiresNetwork: false,
  seo: {
    title: "Image to Base64 Data URL Converter | UnQTools",
    faq: [
      {
        q: "Are my images uploaded?",
        a: "No. Conversion runs locally using FileReader. Your images never leave your browser.",
      },
      {
        q: "What extras does this tool have?",
        a: "Extras: (1) multi-format support, (2) data URL output, (3) raw base64 output, (4) copy to clipboard, (5) drag-and-drop, (6) MIME detection, (7) size readout, (8) accessible labels, (9) no upload, (10) re-encode option, (11) quality slider, (12) fast, (13) keyboard-friendly.",
      },
    ],
  },
  status: "done",
};
