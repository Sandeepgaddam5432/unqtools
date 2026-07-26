/**
 * Sprite Sheet Splitter — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "sprite-sheet-splitter",
  name: "Sprite Sheet Splitter",
  description: "Split sprite sheets into individual images. Grid-based or manual selection, batch export.",
  category: "image",
  keywords: ["sprite splitter", "sprite sheet split", "extract sprites", "sprite extract"],
  icon: "Scissors",
  requiresNetwork: false,
  seo: {
    title: "Sprite Sheet Splitter — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What does this tool do?", a: "Split sprite sheets into individual images. Grid-based or manual selection, batch export." },
      { q: "Is my data sent to a server?", a: "No. This tool runs 100% in your browser. Nothing is uploaded, tracked, or stored remotely." },
      { q: "What extra features does this tool have?", a: "Extras: (1) (1) Grid-based split (rows x cols), (2) (2) Manual selection, (3) (3) Custom cell size, (4) (4) Spacing offset, (5) (5) Download as ZIP, (6) (6) Individual download, (7) (7) Per-sprite preview, (8) (8) Bulk import, (9) (9) JSON manifest export, (10) (10) Copy sprite info, (11) (11) Live preview, (12) (12) PWA offline" },
      { q: "Does this work offline?", a: "Yes — install as a PWA and use it without network." },
    ],
  },
  status: "done",
};
