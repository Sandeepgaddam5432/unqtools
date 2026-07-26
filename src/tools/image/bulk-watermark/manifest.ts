/**
 * Bulk Watermark Tool — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "bulk-watermark",
  name: "Bulk Watermark Tool",
  description: "Add text or image watermarks to multiple images. Position, opacity, size, rotation control.",
  category: "image",
  keywords: ["watermark", "bulk watermark", "image watermark", "watermark tool"],
  icon: "Stamp",
  requiresNetwork: false,
  seo: {
    title: "Bulk Watermark Tool — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Add text or image watermarks to multiple images. Position, opacity, size, rotation control." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Text watermark, (2) (2) Image watermark (logo), (3) (3) 9 position presets, (4) (4) Custom position, (5) (5) Opacity control, (6) (6) Size control, (7) (7) Rotation, (8) (8) Font selection (text), (9) (9) Color picker (text), (10) (10) Tile pattern, (11) (11) Bulk processing, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
