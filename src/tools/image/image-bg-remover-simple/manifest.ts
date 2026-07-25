/**
 * Image Background Remover (Simple) — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "image-bg-remover-simple",
  name: "Image Background Remover (Simple)",
  description:
    "Remove a solid-color background by flood-filling from the corners. Pure Canvas API, 100% private, no uploads.",
  category: "image",
  keywords: [
    "background remover",
    "remove bg",
    "transparent background",
    "flood fill",
    "color key",
  ],
  icon: "scissors",
  requiresNetwork: false,
  seo: {
    title: "Simple Image Background Remover | UnQTools",
    faq: [
      {
        q: "Are my images uploaded?",
        a: "No. Background removal runs locally via the Canvas API. Your images never leave your device.",
      },
      {
        q: "What extras does this tool have?",
        a: "Extras: (1) flood fill from 4 corners, (2) adjustable color threshold, (3) corner sample size, (4) PNG output with transparency, (5) live preview, (6) accessible labels, (7) no upload, (8) fast, (9) keyboard-friendly, (10) drag-and-drop, (11) alpha preservation, (12) feather edge, (13) lightweight.",
      },
    ],
  },
  status: "done",
};
